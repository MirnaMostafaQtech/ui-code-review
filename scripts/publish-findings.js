#!/usr/bin/env node
/*
    scripts/publish-findings.js

    Takes the review target (get-review-target.js) and the merged findings the reviewers produced,
    keeps only findings on changed lines, writes report.md, and - unless --dry-run - posts them:

        pr        -> one inline thread per line on the PR diff + one summary thread.
                     Re-runs don't repeat a comment (hidden fingerprint). A thread is marked Fixed
                     only when its finding is gone AND the line it was on was changed or removed
                     (hidden line marker): a finding a reviewer simply didn't repeat, or a reviewer
                     that didn't run, never closes a thread.
        changeset -> one comment per line on the changeset (TFS discussion API) + a summary comment.
                     If the server refuses that API, falls back to the changeset's linked work
                     item(s): one comment in the work item's Discussion with every finding and the
                     changeset link. No file is attached.

    findings.json: [ { ruleId, severity (Error|Warning|Info), file, line, message, fix, reviewer } ]
      - file is exactly the `path` from target.json; line is 1-based on the new side.

    Comment selection:
      - every Error and every Warning gets its own inline comment where it is (at most --max-warnings
        Warnings, chosen by priority: security, accessibility, localization, AXIS, images and assets,
        then any other, one per rule in turn;
        the rest are listed in the summary only); Info goes to the summary only;
      - findings on the same line are merged into one comment.

    The fingerprints must stay exactly as the PowerShell version computed them, or a re-run on a PR
    reviewed before would post every comment again: see common/dotnet-compat.js.

    Usage:
        node publish-findings.js --target-file <outDir>/target.json --findings-file <outDir>/findings.json [--dry-run] [--max-warnings 15]
*/
'use strict';

const crypto = require('crypto');
const path = require('path');
const { parseCli, warn, run } = require('../common/cli');
const { getTfsPat, tfsJson } = require('../common/tfs-auth');
const {
    trim, readAllText, readAllLines, writeUtf8, joinPath, leafName, psString, getProperty, hasProperty,
    escapeDataString, htmlEncode, sortBy, jsonItems,
} = require('../common/dotnet-compat');

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 };
const SEVERITY_NAME = { error: 'Error', warning: 'Warning', info: 'Info' };
const MARKER = 'ui-review';
// StringBuilder.AppendLine on Windows: the summary has always used \r\n.
const EOL = '\r\n';

// Occurrence tells apart lines with the same text (two identical <input> lines): it is how many lines
// above have that text. The first occurrence hashes as before, so fingerprints already posted still match.
function fingerprint(ruleId, filePath, lineText, occurrence = 0) {
    let key = `${psString(ruleId)}|${psString(filePath)}|${trim(psString(lineText))}`;
    if (occurrence > 0) key = `${key}|${occurrence}`;
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16);
}

const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
    const args = parseCli('publish-findings', {
        'target-file': { type: 'string', required: true },
        'findings-file': { type: 'string', required: true },
        'dry-run': { type: 'boolean', default: false },
        'max-warnings': { type: 'string', default: '15' },
    });
    const maxWarnings = Number(args['max-warnings']);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) throw new Error('publish-findings: --max-warnings must be a whole number.');

    const target = JSON.parse(readAllText(args['target-file']));
    const rawFindings = jsonItems(JSON.parse(readAllText(args['findings-file'])));
    const outDir = path.dirname(args['target-file']);
    const targetFiles = target.files || [];

    // ---------- 1. validate and keep findings on changed lines ----------

    // Paths compare case-insensitively, as in a PowerShell hashtable.
    const fileIndex = new Map();
    for (const f of targetFiles) fileIndex.set(psString(f.path).toLowerCase(), f);
    const lineCache = new Map();
    const linesOf = (f) => {
        if (!lineCache.has(f.path)) lineCache.set(f.path, readAllLines(f.contentFile));
        return lineCache.get(f.path);
    };

    let kept = [];
    let dropped = 0;
    for (const finding of rawFindings) {
        const file = fileIndex.get(psString(getProperty(finding, 'file')).toLowerCase());
        const severityKey = psString(getProperty(finding, 'severity')).toLowerCase();
        if (!file || !(severityKey in SEVERITY_RANK)) { dropped++; continue; }
        const line = Math.trunc(Number(getProperty(finding, 'line')));
        const onChangedLine = (file.changedLines || []).some((r) => line >= r[0] && line <= r[1]);
        if (!onChangedLine) { dropped++; continue; }

        const lines = linesOf(file);
        const lineText = line <= lines.length ? lines[line - 1] : '';
        let occurrence = 0;
        for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
            if (trim(lines[i]) === trim(lineText)) occurrence++;
        }

        const ruleId = psString(getProperty(finding, 'ruleId'));
        kept.push({
            ruleId,
            severity: psString(getProperty(finding, 'severity')),
            severityKey,
            file: file.path,
            line,
            message: psString(getProperty(finding, 'message')),
            fix: psString(getProperty(finding, 'fix')),
            fingerprint: fingerprint(ruleId, file.path, lineText, occurrence),
            lineKey: fingerprint('line', file.path, lineText, occurrence),
        });
    }

    // Line keys of every line as it is now, in every file of the review (same text + occurrence rule as the
    // fingerprints). A thread whose line key is still here sits on an unchanged line.
    const currentLineKeys = new Set();
    for (const f of targetFiles) {
        const seenText = new Map();
        for (const text of linesOf(f)) {
            const trimmed = trim(text);
            const occurrence = seenText.get(trimmed) || 0;
            seenText.set(trimmed, occurrence + 1);
            currentLineKeys.add(fingerprint('line', f.path, text, occurrence));
        }
    }
    kept = sortBy(kept, (k) => SEVERITY_RANK[k.severityKey], (k) => k.file, (k) => k.line);

    // ---------- 2. choose what becomes an inline comment ----------

    // Every Error. Warnings by priority up to maxWarnings: security, accessibility, localization, AXIS,
    // images and assets, then any other, taking one finding per rule in turn so a single repeated rule
    // can't fill every slot.
    const inline = kept.filter((k) => k.severityKey === 'error');
    const RULE_FAMILY_ORDER = [/^SEC-/i, /^A11Y-/i, /^I18N-/i, /^R-/i, /^PERF-/i];
    const ruleFamilyRank = (ruleId) => {
        const i = RULE_FAMILY_ORDER.findIndex((re) => re.test(ruleId));
        return i < 0 ? RULE_FAMILY_ORDER.length : i;
    };
    const warningGroups = new Map();
    for (const k of kept.filter((x) => x.severityKey === 'warning')) {
        const key = k.ruleId.toLowerCase();
        if (!warningGroups.has(key)) warningGroups.set(key, { name: k.ruleId, items: [] });
        warningGroups.get(key).items.push(k);
    }
    const warningQueues = sortBy([...warningGroups.values()], (g) => ruleFamilyRank(g.name), (g) => g.name).map((g) => g.items);
    let warningCount = 0;
    for (let round = 0; warningCount < maxWarnings; round++) {
        let took = false;
        for (const queue of warningQueues) {
            if (warningCount >= maxWarnings) break;
            if (round < queue.length) { inline.push(queue[round]); warningCount++; took = true; }
        }
        if (!took) break;
    }

    // One comment per (file, line).
    const byLine = new Map();
    for (const k of inline) {
        const key = `${k.file}|${k.line}`.toLowerCase();
        if (!byLine.has(key)) byLine.set(key, []);
        byLine.get(key).push(k);
    }
    const comments = [];
    for (const items of byLine.values()) {
        const body = items.map((x) => `🤖 UI Review — **${x.ruleId}** (${x.severity}): ${x.message}\n\n**Fix:** ${x.fix}`).join('\n\n---\n\n');
        const prints = items.map((x) => `<!-- ${MARKER}:${x.fingerprint} -->`).join('') + `<!-- ${MARKER}-line:${items[0].lineKey} -->`;
        comments.push({
            file: items[0].file,
            line: items[0].line,
            content: `${body}\n\n${prints}`,
            fingerprints: items.map((x) => x.fingerprint),
        });
    }

    // ---------- 3. summary + report.md ----------

    const counts = { error: 0, warning: 0, info: 0 };
    for (const f of kept) counts[f.severityKey]++;
    const fileCount = targetFiles.length;

    const sb = [];
    sb.push(`## 🤖 UI Review — ${target.kind} ${target.id}`, '');
    if (kept.length === 0) {
        sb.push(`No findings on the changed lines of ${fileCount} UI file(s).`);
    }
    else {
        sb.push(`**${counts.error} Error · ${counts.warning} Warning · ${counts.info} Info** on the changed lines of ${fileCount} UI file(s).`, '');
        sb.push('| Severity | Rule | File | Line | Finding |');
        sb.push('|---|---|---|---|---|');
        for (const f of kept) {
            const msg = f.message.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
            sb.push(`| ${f.severity} | ${f.ruleId} | \`${f.file}\` | ${f.line} | ${msg} |`);
        }
        const notInline = counts.warning - warningCount;
        if (notInline > 0) {
            sb.push('', `${notInline} Warning(s) beyond the ${maxWarnings} highest-priority ones are listed here only, without an inline comment.`);
        }
    }
    sb.push('', 'Rules: AXIS (`R-xx`), localization (`I18N-xx`), security (`SEC-xx`), images and assets (`PERF-xx`), accessibility (`A11Y-*`).');
    // Review signature: changes only when the set of findings changes. A re-run with the same signature
    // posts nothing new (summary and work item comment are skipped).
    const reviewKey = `${target.kind}-${target.id}`;
    const reviewSig = fingerprint('review', reviewKey, kept.map((k) => k.fingerprint).sort().join(','));
    sb.push('', `<!-- ${MARKER}:summary:${reviewKey}:${reviewSig} -->`);
    const summary = sb.join(EOL) + EOL;
    const summaryPattern = new RegExp(`${MARKER}:summary:${regexEscape(reviewKey)}:([0-9a-f]{16})`, 'i');

    const reportFile = joinPath(outDir, 'report.md');
    writeUtf8(reportFile, summary);

    // HTML version of the summary for a work item's Discussion (System.History renders HTML, not markdown).
    // It is the only thing posted in the fallback, so it lists every finding (Errors first).
    let html = `<p><b>🤖 UI Review</b> — ${target.kind} <a href="${htmlEncode(target.webUrl)}">${target.id}</a></p>`;
    if (kept.length === 0) {
        html += `<p>No findings on the changed lines of ${fileCount} UI file(s).</p>`;
    }
    else {
        html += `<p><b>${counts.error} Error · ${counts.warning} Warning · ${counts.info} Info</b> on the changed lines of ${fileCount} UI file(s).</p><ul>`;
        for (const f of kept) {
            html += `<li><b>${htmlEncode(f.ruleId)}</b> (${f.severity}) — <code>${htmlEncode(leafName(f.file))}:${f.line}</code>: ${htmlEncode(f.message)} <i>Fix:</i> ${htmlEncode(f.fix)}</li>`;
        }
        html += '</ul>';
    }
    // Visible footer: TFS strips HTML comments from work item History, so the signature is plain text.
    html += `<p><small>Review id: ${reviewKey}:${reviewSig}</small></p>`;
    const historyPattern = new RegExp(`Review id: ${regexEscape(reviewKey)}:([0-9a-f]{16})`, 'i');
    writeUtf8(joinPath(outDir, 'work-item-comment.html'), html);
    writeUtf8(joinPath(outDir, 'comments.json'), JSON.stringify(comments, null, 4));

    process.stdout.write(`Findings: ${kept.length} kept, ${dropped} dropped (not on a changed line / unknown file). Inline comments: ${comments.length}. Report: ${reportFile}\n`);
    if (args['dry-run']) {
        process.stdout.write('Dry run: nothing posted.\n');
        return;
    }

    // ---------- 4. publish ----------

    // Every path below is idempotent: a re-run never repeats a line comment (fingerprint per finding),
    // and posts a new summary / work item comment only when the review signature changed.
    const pat = getTfsPat('publish-findings');
    const commentText = (c) => (hasProperty(c, 'content') ? psString(getProperty(c, 'content')) : '');
    const fingerprintsIn = (text) => [...text.matchAll(new RegExp(`<!-- ${MARKER}:([0-9a-f]{16}) -->`, 'g'))].map((m) => m[1]);
    const lineKeysIn = (text) => [...text.matchAll(new RegExp(`<!-- ${MARKER}-line:([0-9a-f]{16}) -->`, 'g'))].map((m) => m[1]);
    const allThere = (prints, has) => prints.filter(has).length === prints.length;

    if (target.kind === 'pr') {
        const base = `${target.collectionUrl}/${escapeDataString(target.project)}/_apis/git/repositories/${escapeDataString(target.repository)}/pullRequests/${target.id}/threads`;

        // Fingerprints already on the PR, which thread carries each, and the existing summary thread.
        const existing = new Map();
        let summaryThread = null;
        let summaryComment = null;
        let oldSig = null;
        const threadsReply = await tfsJson('GET', `${base}?api-version=5.0`, pat);
        for (const thread of jsonItems(threadsReply && threadsReply.value)) {
            for (const comment of jsonItems(thread.comments)) {
                for (const print of fingerprintsIn(commentText(comment))) existing.set(print, thread);
                const m = commentText(comment).match(summaryPattern);
                if (m) { summaryThread = thread; summaryComment = comment; oldSig = m[1]; }
            }
        }

        let posted = 0;
        let skipped = 0;
        let failed = 0;
        for (const c of comments) {
            if (allThere(c.fingerprints, (p) => existing.has(p))) { skipped++; continue; }
            try {
                await tfsJson('POST', `${base}?api-version=5.0`, pat, {
                    body: {
                        comments: [{ parentCommentId: 0, content: c.content, commentType: 1 }],
                        status: 1,
                        threadContext: {
                            filePath: '/' + c.file.replace(/^\//, ''),
                            rightFileStart: { line: c.line, offset: 1 },
                            rightFileEnd: { line: c.line, offset: 200 },
                        },
                    },
                });
                posted++;
            }
            catch (e) { failed++; warn(`Comment on ${c.file}:${c.line} failed: ${e.message}`); }
        }

        // Mark an active thread Fixed (status 2) only when none of its findings came back AND the line it
        // was on was changed or removed. Reviewers are not deterministic, and a reviewer may be skipped or
        // its reply unreadable: a finding missing from this run on an unchanged line is not proof of a fix.
        // Threads posted before line markers existed have none and are left alone.
        const current = new Set(kept.map((f) => f.fingerprint));
        let resolved = 0;
        let keptOpen = 0;
        const threads = [...new Map([...existing.values()].map((t) => [t.id, t])).values()].sort((a, b) => a.id - b.id);
        for (const thread of threads) {
            if (!['active', '1'].includes(psString(thread.status).toLowerCase())) continue;
            const threadText = jsonItems(thread.comments).map(commentText).join('');
            const prints = fingerprintsIn(threadText);
            if (prints.length === 0 || prints.some((p) => current.has(p))) continue;
            const lineKeys = lineKeysIn(threadText);
            if (lineKeys.length === 0 || lineKeys.some((k) => currentLineKeys.has(k))) { keptOpen++; continue; }
            try { await tfsJson('PATCH', `${base}/${thread.id}?api-version=5.0`, pat, { body: { status: 2 } }); resolved++; }
            catch (e) { warn(`Resolving thread ${thread.id} failed: ${e.message}`); }
        }

        // One summary per PR: edit it in place when the findings changed, leave it when they didn't.
        let summaryState;
        if (!summaryThread) {
            await tfsJson('POST', `${base}?api-version=5.0`, pat, {
                body: { comments: [{ parentCommentId: 0, content: summary, commentType: 1 }], status: 4 },
            });
            summaryState = 'summary posted';
        }
        else if (oldSig !== reviewSig) {
            await tfsJson('PATCH', `${base}/${summaryThread.id}/comments/${summaryComment.id}?api-version=5.0`, pat, { body: { content: summary } });
            summaryState = 'summary updated';
        }
        else summaryState = 'summary unchanged';

        process.stdout.write(`PR ${target.id}: ${posted} posted, ${skipped} already there, ${failed} failed, ${resolved} resolved, ${keptOpen} left open (finding not repeated but its line is unchanged), ${summaryState}.\n`);
        return;
    }

    // TFVC changeset: legacy discussion API (route discussion/threads exists on TFS / Azure DevOps Server; needs a PAT
    // with Code (Read & Write)).
    const artifactUri = `vstfs:///VersionControl/Changeset/${target.id}`;
    const existingPrints = new Set();
    let oldSig = null;
    try {
        const known = await tfsJson('GET', `${target.collectionUrl}/_apis/discussion/threads?artifactUri=${escapeDataString(artifactUri)}&api-version=3.0-preview.1`, pat);
        for (const thread of jsonItems(known && known.value)) {
            for (const comment of jsonItems(thread.comments)) {
                for (const print of fingerprintsIn(commentText(comment))) existingPrints.add(print);
                const m = commentText(comment).match(summaryPattern);
                if (m) oldSig = m[1];
            }
        }
    }
    catch (e) { warn(`Reading existing changeset comments failed (${e.message}).`); }

    const threads = [];
    let skipped = 0;
    for (const c of comments) {
        if (allThere(c.fingerprints, (p) => existingPrints.has(p))) { skipped++; continue; }
        threads.push({
            artifactUri,
            itemPath: c.file,
            position: { positionContext: 'RightBuffer', startLine: c.line, endLine: c.line, startColumn: 1, endColumn: 200 },
            comments: [{ content: c.content, commentType: 1 }],
            status: 1,
        });
    }
    if (oldSig !== reviewSig) {
        threads.push({ artifactUri, comments: [{ content: summary, commentType: 1 }], status: 4 });
    }

    if (threads.length === 0) {
        process.stdout.write(`Changeset ${target.id}: nothing new (${skipped} comment(s) already there, summary unchanged).\n`);
        return;
    }

    try {
        await tfsJson('POST', `${target.collectionUrl}/_apis/discussion/threadsBatch?api-version=3.0-preview.1`, pat, { body: threads });
        process.stdout.write(`Changeset ${target.id}: ${threads.length} comment(s) posted, ${skipped} already there.\n`);
    }
    catch (e) {
        warn(`Changeset comments failed (${e.message}). Falling back to the linked work item(s).`);
        const workItems = jsonItems(target.workItems);
        if (workItems.length === 0) throw new Error('publish-findings: changeset has no linked work item to comment on.');

        for (const wi of workItems) {
            // A work item can live in a different Team Project than the code (e.g. code in ProjectA,
            // bugs in ProjectB), so read its own project first.
            const wiFields = await tfsJson('GET', `${target.collectionUrl}/_apis/wit/workitems/${wi}?fields=System.TeamProject&api-version=5.0`, pat);
            const wiProject = wiFields.fields['System.TeamProject'];
            const wiUri = `${target.collectionUrl}/${escapeDataString(wiProject)}/_apis/wit/workitems/${wi}?api-version=5.0`;

            // Latest signature this review left in the work item's History.
            let lastSig = null;
            const updates = await tfsJson('GET', `${target.collectionUrl}/_apis/wit/workitems/${wi}/updates?api-version=5.0`, pat);
            for (const update of jsonItems(updates && updates.value)) {
                const historyField = update.fields && update.fields['System.History'];
                const history = historyField && hasProperty(historyField, 'newValue') ? psString(historyField.newValue) : '';
                if (history) {
                    const m = history.match(historyPattern);
                    if (m) lastSig = m[1];
                }
            }
            if (lastSig === reviewSig) {
                process.stdout.write(`Work item ${wi}: already has this review (no change), nothing posted.\n`);
                continue;
            }

            // The review in the work item's Discussion: shows in History and notifies its followers.
            const patch = [{ op: 'add', path: '/fields/System.History', value: html }];
            try {
                await tfsJson('PATCH', wiUri, pat, { body: patch, contentType: 'application/json-patch+json' });
                process.stdout.write(`Summary posted to work item ${wi} Discussion.\n`);
            }
            catch (err) { warn(`Discussion comment on work item ${wi} failed: ${err.message}`); }
        }
    }
}

run(main);
