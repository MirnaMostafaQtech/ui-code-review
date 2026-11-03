#!/usr/bin/env node
/*
    scripts/get-review-target.js

    Turns a Git Pull Request or a TFVC changeset into one unified review target, so the review
    steps after it are identical for both sources:

        <outDir>/target.json      { kind, id, title, webUrl, collectionUrl, project, repository,
                                    files: [ { path, role, changeType, contentFile, changedLines: [[start,end]...] } ] }
        <outDir>/files/...        the full new content of every UI file in scope (UTF-8)
        target.json translations  [ { path, contentFile } ] every translation file at the reviewed
                                  version, read-only context for the I18N reviewer
        <outDir>/translations/... their content
        target.json assets        [ { path, sizeBytes } ] every image, font and video file the
                                  review adds or changes, for the performance reviewer

    Only UI files (UI_FILE_PATTERN) and translation files (TRANSLATION_PATTERN) are kept; minified,
    generated and test files are skipped. Each entry in files has role 'ui' or 'translation'.
    changedLines are 1-based, inclusive ranges on the NEW side - the only lines findings may anchor to.

    Usage:
        node get-review-target.js --kind pr        --id 123   --repo-root D:\repo --out-dir <dir>
        node get-review-target.js --kind changeset --id 31554 --collection-url https://tfs.example.com/DefaultCollection --out-dir <dir>

    outDir is a new folder per run (<root>/<kind>-<id>-<yyyyMMdd-HHmmss>). The script takes the
    target's review lock first (common/review-lock.js) and fails with REVIEW-LOCKED if another run
    holds it; --force takes over a lock whose run is no longer going. The lock is released here on
    failure or when no UI file changed, otherwise by release-review-lock.js at the end of the review.
    Run folders of the same target older than 7 days are deleted.

    PAT: SONARTOOLKIT_TFS_PAT (process or user scope) - same variable as q-ai-quality-review.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseCli, warn, run } = require('../common/cli');
const { getTfsPat, tfsJson, tfsBytes } = require('../common/tfs-auth');
const { enterReviewLock, exitReviewLock } = require('../common/review-lock');
const { getTfsRemoteInfo, getTfsPullRequest, getTfvcChangesetChanges } = require('../scm-adapters/tfs');
const { readAllText, writeUtf8, utf8BytesToText, escapeDataString, joinPath, psString } = require('../common/dotnet-compat');

const UI_FILE_PATTERN = /\.(html|scss|css|ts|cshtml|js)$/i;
// Translation files, Angular and .NET:
//   - JSON under a translations folder (ngx-translate / transloco), or under Resources (.NET JSON localization)
//   - TypeScript / JS dictionaries: *.i18n.ts, *.translations.ts, or <lang>.ts under a translations folder
//   - Angular built-in i18n (.xlf / .xliff, messages.<lang>.json)
//   - .NET .resx and .po files
const TRANSLATION_FOLDERS = '(i18n|l10n|locale|locales|lang|langs|translations|resources)';
const TRANSLATION_PATTERN = new RegExp([
    `((^|/)${TRANSLATION_FOLDERS}/.+\\.json$)`,
    '(\\.(i18n|translations?|locale)\\.(ts|js)$)',
    `((^|/)${TRANSLATION_FOLDERS}/(.+/)?[a-z]{2}([-_][A-Za-z]{2,4})?\\.(ts|js)$)`,
    '(\\.(xlf|xliff)$)',
    '((^|/)messages(\\.[A-Za-z-]+)?\\.json$)',
    '(\\.(resx|po)$)',
].join('|'), 'i');
const MAX_TRANSLATION_FILES = 80;
const ASSET_PATTERN = /\.(png|jpe?g|gif|bmp|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|ogg)$/i;
const SKIP_PATTERN = /(\.min\.(css|js)$)|(\.spec\.ts$)|(\.d\.ts$)|((^|\/)(node_modules|dist|bin|obj)\/)/i;

const slashes = (p) => String(p).replace(/\\/g, '/');
const isUiFile = (p) => UI_FILE_PATTERN.test(slashes(p)) && !SKIP_PATTERN.test(slashes(p));
const isTranslationFile = (p) => TRANSLATION_PATTERN.test(slashes(p)) && !SKIP_PATTERN.test(slashes(p));
const isAssetFile = (p) => ASSET_PATTERN.test(slashes(p)) && !SKIP_PATTERN.test(slashes(p));

// Translation first: a dictionary such as shell.i18n.ts is also a .ts file.
function fileRole(p) {
    if (isTranslationFile(p)) return 'translation';
    if (isUiFile(p)) return 'ui';
    return null;
}

function safeFileName(p) {
    return String(p).replace(/^[$/]+/, '').replace(/[\\/:*?"<>|]/g, '_');
}

function git(args, { encoding = 'utf8' } = {}) {
    return spawnSync('git', args, { encoding, windowsHide: true, maxBuffer: 1024 * 1024 * 1024 });
}

function outputLines(result) {
    return String(result.stdout || '').split(/\r?\n/).filter((l, i, all) => !(l === '' && i === all.length - 1));
}

// Parses `git diff -U0` output into new-side line ranges.
function changedLineRanges(diffLines) {
    const ranges = [];
    for (const line of diffLines) {
        const m = line.match(/^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,(?<count>\d+))? @@/);
        if (!m) continue;
        const start = Number(m.groups.start);
        const count = m.groups.count !== undefined && m.groups.count !== '' ? Number(m.groups.count) : 1;
        if (count > 0) ranges.push([start, start + count - 1]);
    }
    return ranges;
}

function wholeFileRange(text) {
    return [[1, Math.max(1, text.split('\n').length)]];
}

async function main() {
    const args = parseCli('get-review-target', {
        'kind': { type: 'string', required: true },
        'id': { type: 'string', required: true },
        'out-dir': { type: 'string', required: true },
        'repo-root': { type: 'string', default: process.cwd() },
        'collection-url': { type: 'string' },
        'force': { type: 'boolean', default: false },
    });
    const kind = args.kind;
    if (!['pr', 'changeset'].includes(kind)) throw new Error("get-review-target: --kind must be 'pr' or 'changeset'.");
    if (!/^\d+$/.test(args.id)) throw new Error('get-review-target: --id must be a number.');
    const id = Number(args.id);
    const outDir = args['out-dir'];
    const repoRoot = args['repo-root'];

    const pat = getTfsPat('get-review-target');

    if (fs.existsSync(outDir)) throw new Error(`get-review-target: ${outDir} already exists; every run needs a new folder.`);
    enterReviewLock({ kind, id, outDir, force: args.force });
    // From here on, any failure releases the lock this run holds.
    try {
        await buildTarget({ kind, id, outDir, repoRoot, collectionUrl: args['collection-url'], pat });
    }
    catch (e) {
        exitReviewLock(outDir);
        throw e;
    }
}

async function buildTarget({ kind, id, outDir, repoRoot, collectionUrl, pat }) {
    const runRoot = path.dirname(outDir);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(runRoot)) {
        const full = path.join(runRoot, name);
        if (!name.toLowerCase().startsWith(`${kind}-${id}-`)) continue;
        try {
            const stat = fs.statSync(full);
            if (stat.isDirectory() && stat.mtimeMs < weekAgo) fs.rmSync(full, { recursive: true, force: true });
        }
        catch { /* another run may be removing it */ }
    }

    const filesDir = joinPath(outDir, 'files');
    fs.mkdirSync(filesDir, { recursive: true });
    const tempDir = joinPath(outDir, '.tmp');
    fs.mkdirSync(tempDir, { recursive: true });

    function lineRangesBetween(oldText, newText) {
        const oldFile = joinPath(tempDir, 'old.txt');
        const newFile = joinPath(tempDir, 'new.txt');
        writeUtf8(oldFile, oldText);
        writeUtf8(newFile, newText);
        const diff = git(['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-color', '-U0', '--ignore-cr-at-eol', '--', oldFile, newFile]);
        return changedLineRanges(outputLines(diff));
    }

    const files = [];
    const assets = [];
    let target;
    let translationPaths = [];
    let readTranslation;

    if (kind === 'changeset') {
        if (!collectionUrl) throw new Error('get-review-target: --collection-url is required for --kind changeset (e.g. https://tfs.example.com/DefaultCollection).');
        collectionUrl = collectionUrl.replace(/\/+$/, '');
        if (!/^https:\/\//i.test(collectionUrl)) throw new Error('get-review-target: refusing to send the PAT over http; use an https:// collection URL.');

        const cs = await tfsJson('GET', `${collectionUrl}/_apis/tfvc/changesets/${id}?api-version=5.0`, pat);
        const changes = await getTfvcChangesetChanges({ collectionUrl, changesetId: id, pat });
        const workItemsReply = await tfsJson('GET', `${collectionUrl}/_apis/tfvc/changesets/${id}/workItems?api-version=5.0`, pat);
        const workItems = ((workItemsReply && workItemsReply.value) || []).map((w) => w.id);
        const itemUri = (serverPath, version) => `${collectionUrl}/_apis/tfvc/items?path=${escapeDataString(serverPath)}&versionDescriptor.versionType=Changeset&versionDescriptor.version=${version}&includeContent=true&api-version=5.0`;

        let project = null;
        for (const change of changes) {
            if (!project) {
                const m = change.serverPath.match(/^\$\/(?<p>[^/]+)/i);
                if (m) project = m.groups.p;
            }
            if (/delete/i.test(change.changeType)) continue;
            if (isAssetFile(change.serverPath)) {
                const bytes = await tfsBytes(itemUri(change.serverPath, id), pat);
                assets.push({ path: change.serverPath, sizeBytes: bytes.length });
                continue;
            }
            const role = fileRole(change.serverPath);
            if (!role) continue;

            const newText = utf8BytesToText(await tfsBytes(itemUri(change.serverPath, id), pat));
            let ranges;
            if (/\badd\b|branch|undelete/i.test(change.changeType)) {
                ranges = wholeFileRange(newText);
            }
            else {
                // A renamed file had its old path at the previous version.
                const oldPath = change.sourceServerPath || change.serverPath;
                try {
                    const oldText = utf8BytesToText(await tfsBytes(itemUri(oldPath, id - 1), pat));
                    ranges = lineRangesBetween(oldText, newText);
                }
                catch (e) {
                    warn(`get-review-target: no previous version of ${oldPath} (${e.message}); reviewing the whole file.`);
                    ranges = wholeFileRange(newText);
                }
            }
            if (ranges.length === 0) continue;

            const contentFile = joinPath(filesDir, safeFileName(change.serverPath));
            writeUtf8(contentFile, newText);
            files.push({ path: change.serverPath, role, changeType: change.changeType, contentFile, changedLines: ranges });
        }

        // Translation files at this changeset: search upward from the folder the changed files share,
        // stopping at the first folder that has any, and never above $/<project>/<branch>.
        if (files.length > 0) {
            const dirs = files.map((f) => f.path.split('/').slice(0, -1));
            const common = [];
            for (let i = 0; i < dirs[0].length; i++) {
                const segment = dirs[0][i];
                if (!dirs.every((d) => d.length > i && d[i].toLowerCase() === segment.toLowerCase())) break;
                common.push(segment);
            }
            for (let depth = common.length; depth >= 3 && translationPaths.length === 0; depth--) {
                const scope = common.slice(0, depth).join('/');
                const listUri = `${collectionUrl}/_apis/tfvc/items?scopePath=${escapeDataString(scope)}&recursionLevel=Full&versionDescriptor.versionType=Changeset&versionDescriptor.version=${id}&api-version=5.0`;
                const items = ((await tfsJson('GET', listUri, pat)) || {}).value || [];
                translationPaths = items.filter((it) => !it.isFolder && isTranslationFile(it.path)).map((it) => it.path);
            }
        }
        readTranslation = async (p) => utf8BytesToText(await tfsBytes(itemUri(p, id), pat));

        target = {
            kind: 'changeset',
            id,
            title: cs.comment ?? null,
            author: cs.author ? cs.author.displayName ?? null : null,
            webUrl: `${collectionUrl}/${escapeDataString(psString(project))}/_versionControl/changeset/${id}`,
            collectionUrl,
            project,
            repository: null,
            workItems,
            files,
        };
    }
    else {
        const remote = getTfsRemoteInfo(repoRoot);
        const pr = await getTfsPullRequest({
            collectionUrl: remote.collectionUrl, project: remote.project, repositoryName: remote.repositoryName,
            pullRequestId: id, pat,
        });

        // Use the PR's own commits, not branch names: they still exist after the PR is completed or its
        // source branch is deleted, and the target commit is the one the PR was reviewed against.
        const head = psString(pr.raw.lastMergeSourceCommit && pr.raw.lastMergeSourceCommit.commitId);
        const targetCommit = psString(pr.raw.lastMergeTargetCommit && pr.raw.lastMergeTargetCommit.commitId);

        if (git(['-C', repoRoot, 'fetch', '--quiet', 'origin', head, targetCommit]).status !== 0) {
            // Server refused fetching by commit id: fetch the branches that still exist instead.
            git(['-C', repoRoot, 'fetch', '--quiet', 'origin', pr.targetBranch]);
            git(['-C', repoRoot, 'fetch', '--quiet', 'origin', pr.sourceBranch]);
        }
        for (const commit of [head, targetCommit]) {
            if (git(['-C', repoRoot, 'cat-file', '-e', `${commit}^{commit}`]).status !== 0) {
                throw new Error(`get-review-target: commit ${commit} of PR ${id} is not available locally after fetch.`);
            }
        }
        const mergeBase = git(['-C', repoRoot, 'merge-base', targetCommit, head]);
        if (mergeBase.status !== 0) throw new Error(`get-review-target: no merge base between ${targetCommit} and ${head}: ${String(mergeBase.stderr).trim()}`);
        const base = String(mergeBase.stdout).trim();

        const nameStatus = outputLines(git(['-C', repoRoot, '-c', 'core.quotepath=false', 'diff', '--name-status', '-M', '--no-color', base, head]));
        for (const entry of nameStatus) {
            if (!entry) continue;
            const parts = entry.split('\t');
            const status = parts[0];
            const filePath = parts[parts.length - 1];
            if (/^D/i.test(status)) continue;
            if (isAssetFile(filePath)) {
                const size = git(['-C', repoRoot, 'cat-file', '-s', `${head}:${filePath}`]);
                if (size.status === 0) assets.push({ path: filePath, sizeBytes: Number(String(size.stdout).trim()) });
                continue;
            }
            const role = fileRole(filePath);
            if (!role) continue;

            // The file's raw bytes, as git stores them.
            const contentFile = joinPath(filesDir, safeFileName(filePath));
            const show = git(['-C', repoRoot, 'show', `${head}:${filePath}`], { encoding: 'buffer' });
            fs.writeFileSync(contentFile, show.stdout || Buffer.alloc(0));
            if (show.status !== 0) continue;

            let ranges;
            if (/^A/i.test(status)) {
                ranges = wholeFileRange(readAllText(contentFile));
            }
            else {
                // A rename needs both paths in the pathspec, or git sees only the new one and diffs it as
                // an added file (every line changed).
                const pathspec = /^[RC]/i.test(status) ? [parts[1], filePath] : [filePath];
                const diff = git(['-C', repoRoot, '-c', 'core.quotepath=false', 'diff', '--no-color', '-U0', '-M', '--ignore-cr-at-eol', base, head, '--', ...pathspec]);
                ranges = changedLineRanges(outputLines(diff));
            }
            if (ranges.length === 0) continue;

            files.push({ path: filePath, role, changeType: status, contentFile, changedLines: ranges });
        }

        translationPaths = outputLines(git(['-C', repoRoot, '-c', 'core.quotepath=false', 'ls-tree', '-r', '--name-only', head]))
            .filter((p) => p && isTranslationFile(p));
        readTranslation = async (p) => utf8BytesToText(git(['-C', repoRoot, 'show', `${head}:${p}`], { encoding: 'buffer' }).stdout);

        target = {
            kind: 'pr',
            id,
            title: pr.title ?? null,
            author: null,
            webUrl: pr.webUrl,
            collectionUrl: remote.collectionUrl,
            project: remote.project,
            repository: remote.repositoryName,
            sourceBranch: pr.sourceBranch,
            targetBranch: pr.targetBranch,
            baseCommit: base,
            headCommit: head,
            files,
        };
    }

    // Every translation file at the reviewed version, so the I18N reviewer can check that a key used on a
    // changed line exists in each language.
    const translations = [];
    if (files.length > 0 && translationPaths.length > 0) {
        if (translationPaths.length > MAX_TRANSLATION_FILES) {
            warn(`get-review-target: ${translationPaths.length} translation files found; exporting the first ${MAX_TRANSLATION_FILES}.`);
            translationPaths = translationPaths.slice(0, MAX_TRANSLATION_FILES);
        }
        const translationsDir = joinPath(outDir, 'translations');
        fs.mkdirSync(translationsDir, { recursive: true });
        for (const p of translationPaths) {
            const contentFile = joinPath(translationsDir, safeFileName(p));
            writeUtf8(contentFile, await readTranslation(p));
            translations.push({ path: p, contentFile });
        }
    }
    target.translations = translations;
    target.assets = assets;

    fs.rmSync(tempDir, { recursive: true, force: true });
    const targetFile = joinPath(outDir, 'target.json');
    writeUtf8(targetFile, JSON.stringify(target, null, 4));
    // Nothing to review means the review ends here, so it doesn't keep the lock.
    if (files.length === 0) exitReviewLock(outDir);
    process.stdout.write(`Review target: ${target.kind} ${id} - ${files.length} UI file(s) in scope, ${translations.length} translation file(s) for context -> ${targetFile}\n`);
}

if (require.main === module) run(main);

module.exports = { fileRole, isAssetFile, safeFileName, changedLineRanges, wholeFileRange };
