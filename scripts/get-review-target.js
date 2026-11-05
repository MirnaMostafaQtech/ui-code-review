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
        target.json fixWorkItems  [ { id, type, title, state, file } ] the linked Bugs / User Stories,
                                  each as <outDir>/workitems/<id>.md, for the fix reviewer
        target.json fullDiff      { file, files, truncated, omitted } <outDir>/full.diff: the diff of
                                  EVERY changed file (not only UI), capped at 3000 lines; null when
                                  there is no Bug / User Story. fixCheckSkipped says why it was skipped.

    Only UI files (UI_FILE_PATTERN) and translation files (TRANSLATION_PATTERN) are kept; minified,
    generated and test files are skipped. Each entry in files has role 'ui' or 'translation'.
    changedLines are 1-based, inclusive ranges on the NEW side - the only lines findings may anchor to.

    Usage:
        node get-review-target.js --kind pr        --id 123   --repo-root D:\repo --out-dir <dir>
        node get-review-target.js --kind changeset --id 31554 --collection-url https://tfs.example.com/DefaultCollection --out-dir <dir>
        --no-fix-check   don't read work items or build full.diff

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
const { getTfsRemoteInfo, getTfsPullRequest, getTfvcChangesetChanges, getPullRequestWorkItemIds, getWorkItems } = require('../scm-adapters/tfs');
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

// ---- Fix check context: linked Bugs / User Stories and the full diff of the change ----------------

// The work item types the fix check reads: Bug (repro steps) and the backlog types that carry
// acceptance criteria (Agile: User Story, Scrum: Product Backlog Item, CMMI: Requirement).
const FIX_WORK_ITEM_TYPES = /^(bug|user story|product backlog item|requirement)$/i;
const MAX_FULL_DIFF_LINES = 3000;
const MAX_CHANGESET_DIFF_FILES = 80;
// Generated or vendored files that only add noise to the diff the fix reviewer reads.
const DIFF_NOISE_PATTERN = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|packages\.lock\.json)$|\.min\.(css|js)$|\.map$|(^|\/)(node_modules|dist|bin|obj|wwwroot\/lib)\//i;

// Work item HTML (TFS stores rich text as HTML) to plain text, keeping line and list structure.
function htmlToText(html) {
    return String(html || '')
        .replace(/\r/g, '')
        .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/tr|\/ul|\/ol)\s*\/?>/gi, '\n')
        .replace(/<\s*(p|div|h[1-6]|tr)(\s[^>]*)?>/gi, '\n')
        .replace(/<\s*li[^>]*>/gi, '\n- ')
        .replace(/<\s*\/(td|th)\s*>/gi, ' | ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/gi, '&')
        .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Repro steps often carry test logins. The fix reviewer never needs a secret, and anything in these files
// can end up in a PR comment, so the value after a password / token / secret label is replaced.
const SECRET_LABEL_PATTERN = /((?:password|passwd|pwd|pass|otp|pin|token|secret|api[-_ ]?key|كلمة\s*(?:ال)?مرور|كلمة\s*السر|الرقم\s*السري|رمز\s*التحقق)\s*[:：=]\s*)\S+/giu;
function redactSecrets(text) {
    return String(text).replace(SECRET_LABEL_PATTERN, '$1[redacted]');
}

function workItemMarkdown(wi) {
    const section = (name, html) => {
        const text = redactSecrets(htmlToText(html));
        return text ? [`## ${name}`, '', text, ''] : [];
    };
    return [
        `# ${wi.type} ${wi.id}: ${wi.title}`,
        '',
        `State: ${wi.state || 'unknown'}`,
        '',
        ...section('Description', wi.description),
        ...section('Repro steps', wi.reproSteps),
        ...section('Acceptance criteria', wi.acceptanceCriteria),
    ].join('\n');
}

// Writes <outDir>/workitems/<id>.md for each linked Bug / User Story; returns the target.json entries.
async function exportFixWorkItems({ outDir, collectionUrl, ids, pat }) {
    const items = (await getWorkItems({ collectionUrl, ids, pat })).filter((wi) => FIX_WORK_ITEM_TYPES.test(wi.type));
    if (items.length === 0) return [];
    const dir = joinPath(outDir, 'workitems');
    fs.mkdirSync(dir, { recursive: true });
    return items.map((wi) => {
        const file = joinPath(dir, `${wi.id}.md`);
        writeUtf8(file, workItemMarkdown(wi));
        return { id: wi.id, type: wi.type, title: wi.title, state: wi.state, file, figmaLinks: figmaLinksIn(wi) };
    });
}

// Figma design links written in a work item (text or href), so the review can point out that a
// --figma check is possible. They are never opened unless the user passes --figma.
function figmaLinksIn(wi) {
    const text = [wi.description, wi.reproSteps, wi.acceptanceCriteria].map((s) => String(s || '')).join(' ').replace(/&amp;/gi, '&');
    const links = text.match(/https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto)\/[A-Za-z0-9]+[^\s"'<>)]*/g) || [];
    return [...new Set(links)];
}

/*
    Writes <outDir>/full.diff from per-file diff chunks ({ path, text }). Keeps it under
    MAX_FULL_DIFF_LINES: chunks whose path shares a word with a work item title go first, the rest in
    their original order; whole chunks only, and the files left out are listed at the end.
*/
function writeFullDiff(outDir, chunks, workItems) {
    const words = new Set();
    for (const wi of workItems) {
        for (const w of String(wi.title).toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w.length >= 4) words.add(w);
    }
    const score = (p) => [...words].filter((w) => p.toLowerCase().includes(w)).length;
    const kept = chunks.filter((c) => !DIFF_NOISE_PATTERN.test(slashes(c.path)));
    const ordered = kept.map((c, i) => ({ c, i, s: score(c.path) })).sort((a, b) => (b.s - a.s) || (a.i - b.i)).map((x) => x.c);

    const out = [];
    const omitted = [];
    let lines = 0;
    for (const chunk of ordered) {
        const n = chunk.text.split('\n').length;
        if (lines + n > MAX_FULL_DIFF_LINES) { omitted.push(chunk.path); continue; }
        out.push(chunk.text.replace(/\n?$/, '\n'));
        lines += n;
    }
    if (omitted.length > 0) {
        out.push(`\n# Diff truncated at ${MAX_FULL_DIFF_LINES} lines. Changed files not shown above:\n${omitted.map((p) => `#   ${p}`).join('\n')}\n`);
    }
    const file = joinPath(outDir, 'full.diff');
    writeUtf8(file, out.join(''));
    return { file, files: kept.length, truncated: omitted.length > 0, omitted };
}

// Splits `git diff` output into one chunk per file, keyed by the new path.
function splitGitDiff(text) {
    const chunks = [];
    for (const part of String(text).split(/^(?=diff --git )/m)) {
        if (!part.startsWith('diff --git ')) continue;
        const m = part.match(/^diff --git a\/.+? b\/(.+)$/m);
        chunks.push({ path: m ? m[1] : '?', text: part });
    }
    return chunks;
}

async function main() {
    const args = parseCli('get-review-target', {
        'kind': { type: 'string', required: true },
        'id': { type: 'string', required: true },
        'out-dir': { type: 'string', required: true },
        'repo-root': { type: 'string', default: process.cwd() },
        'collection-url': { type: 'string' },
        'force': { type: 'boolean', default: false },
        'no-fix-check': { type: 'boolean', default: false },
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
        await buildTarget({ kind, id, outDir, repoRoot, collectionUrl: args['collection-url'], pat, fixCheck: !args['no-fix-check'] });
    }
    catch (e) {
        exitReviewLock(outDir);
        throw e;
    }
}

async function buildTarget({ kind, id, outDir, repoRoot, collectionUrl, pat, fixCheck = true }) {
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
    // How to get the linked work item ids and the full diff, set by each source below.
    let fixSource = null;
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

        fixSource = {
            workItemIds: async () => workItems,
            // TFVC has no diff endpoint: diff each changed text file's previous and new version locally.
            diffChunks: async () => {
                const chunks = [];
                const candidates = changes.filter((c) => !isAssetFile(c.serverPath) && !DIFF_NOISE_PATTERN.test(slashes(c.serverPath)));
                if (candidates.length > MAX_CHANGESET_DIFF_FILES) {
                    warn(`get-review-target: ${candidates.length} files changed; the fix check diff covers the first ${MAX_CHANGESET_DIFF_FILES}.`);
                }
                for (const change of candidates.slice(0, MAX_CHANGESET_DIFF_FILES)) {
                    const isDelete = /delete/i.test(change.changeType);
                    const isAdd = /\badd\b|branch|undelete/i.test(change.changeType);
                    const oldPath = change.sourceServerPath || change.serverPath;
                    let oldText = '';
                    let newText = '';
                    try { if (!isAdd) oldText = utf8BytesToText(await tfsBytes(itemUri(oldPath, id - 1), pat)); } catch { /* new in this changeset */ }
                    try { if (!isDelete) newText = utf8BytesToText(await tfsBytes(itemUri(change.serverPath, id), pat)); } catch { /* unreadable */ }
                    const oldFile = joinPath(tempDir, 'fix-old.txt');
                    const newFile = joinPath(tempDir, 'fix-new.txt');
                    writeUtf8(oldFile, oldText);
                    writeUtf8(newFile, newText);
                    const diff = git(['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-color', '-U3', '--ignore-cr-at-eol', '--', oldFile, newFile]);
                    const body = outputLines(diff).filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l)).join('\n');
                    if (!body.trim()) continue;
                    chunks.push({ path: change.serverPath, text: `diff --git a${oldPath} b${change.serverPath}\n--- a${oldPath}\n+++ b${change.serverPath}\n${body}\n` });
                }
                return chunks;
            },
        };

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

        fixSource = {
            workItemIds: () => getPullRequestWorkItemIds({
                collectionUrl: remote.collectionUrl, project: remote.project, repositoryName: remote.repositoryName,
                pullRequestId: id, pat,
            }),
            // Every file, not only UI: a fix often lives in a service, an API or a config file.
            diffChunks: async () => splitGitDiff(git(['-C', repoRoot, '-c', 'core.quotepath=false', 'diff', '--no-color', '-M', '-U3', '--ignore-cr-at-eol', base, head]).stdout),
        };

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

    // Fix check context. A failure here never stops the UI review: it is recorded and the check is skipped.
    target.fixWorkItems = [];
    target.figmaLinks = [];
    target.fullDiff = null;
    if (fixCheck && files.length > 0 && fixSource) {
        try {
            const ids = await fixSource.workItemIds();
            target.fixWorkItems = await exportFixWorkItems({ outDir, collectionUrl: target.collectionUrl, ids, pat });
            target.figmaLinks = [...new Set(target.fixWorkItems.flatMap((w) => w.figmaLinks))];
            if (target.fixWorkItems.length === 0) {
                target.fixCheckSkipped = ids.length === 0 ? 'no linked work item' : 'no linked Bug or User Story';
            }
            else {
                target.fullDiff = writeFullDiff(outDir, await fixSource.diffChunks(), target.fixWorkItems);
            }
        }
        catch (e) {
            warn(`get-review-target: fix check context unavailable (${e.message}); the fix check will be skipped.`);
            target.fixWorkItems = [];
            target.fullDiff = null;
            target.fixCheckSkipped = 'work items could not be read';
            target.workItemsError = e.message;
        }
    }
    else if (!fixCheck) {
        target.fixCheckSkipped = 'turned off (--no-fix-check)';
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    const targetFile = joinPath(outDir, 'target.json');
    writeUtf8(targetFile, JSON.stringify(target, null, 4));
    // Nothing to review means the review ends here, so it doesn't keep the lock.
    if (files.length === 0) exitReviewLock(outDir);
    const fixNote = target.fixWorkItems.length > 0
        ? `, fix check: ${target.fixWorkItems.length} work item(s), ${target.fullDiff.files} file(s) in the diff${target.fullDiff.truncated ? ' (truncated)' : ''}`
        : (target.fixCheckSkipped ? `, fix check skipped: ${target.fixCheckSkipped}` : '');
    process.stdout.write(`Review target: ${target.kind} ${id} - ${files.length} UI file(s) in scope, ${translations.length} translation file(s) for context${fixNote} -> ${targetFile}\n`);
}

if (require.main === module) run(main);

module.exports = { fileRole, isAssetFile, safeFileName, changedLineRanges, wholeFileRange, htmlToText, redactSecrets, workItemMarkdown, writeFullDiff, splitGitDiff, figmaLinksIn };
