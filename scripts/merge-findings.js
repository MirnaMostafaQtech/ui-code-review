#!/usr/bin/env node
/*
    scripts/merge-findings.js

    Turns the reviewers' raw replies into one findings.json, with fixed rules, so the same review always
    produces the same findings (and publish-findings.js' fingerprints - which include the line - stay
    stable between runs).

    Input: <outDir>/reviews/*.txt, one file per reviewer, holding that reviewer's reply exactly as
    returned:
        axis.txt, i18n.txt,             -> a ```json``` array already in findings shape
        security.txt, performance.txt
        a11y-labels.txt, a11y-alt.txt,  -> the accessibility-framework area format:
        a11y-aria.txt, a11y-semantics.txt,     Area: / Findings: - file: location: issue: fix:
        a11y-keyboard.txt                      runtimeCheck: ... / Conflicts: / OutOfScope:
        fix.txt                         -> a ```json``` object { verdict: [...], findings: [...] }
        fix-runtime.txt (optional)      -> a ```json``` array of runtime results, written by the
                                           review skill's runtime check (Step 4b)
        fix-figma.txt (optional)        -> a ```json``` array of Figma comparison results, written by
                                           the review skill's Figma check (Step 4c, --figma only)

    Fix check: fix.txt's findings go through the same checks as every JSON reviewer. Its verdict is
    normalized (one entry per target.fixWorkItems item, unknown statuses -> Unclear, a work item with no
    verdict -> Unclear) and written to <outDir>/fix-verdict.json. When fix-runtime.txt exists, each
    result updates its work item: pass -> Fixed, fail -> NotAddressed (+ a FIX-01 finding when the result
    names a changed file and line), blocked -> unchanged. Then, when fix-figma.txt exists, each result
    sets the design criterion (kind: "design", added if the reviewer left it out): match -> met,
    mismatch -> not met and Fixed becomes Partial (+ FIX-01 when it names a changed line), blocked ->
    unchanged. Design match is opt-in: without fix-figma.txt it never affects the status.

    Accessibility mapping (always the same):
        ruleId   = A11Y-<AREA>  (from the file name)
        severity = Warning
        line     = from the line list in `location` (the text before any '(' or ';', which may cite
                   other files): the first number on a changed line, else the first number; a
                   finding with no number is dropped
        message  = issue (+ " Needs a keyboard / screen-reader check." when runtimeCheck: needed)
        fix      = fix
        file     = matched to a `path` in target.json (exact, then by path suffix, then by unique file name)

    Output: <outDir>/findings.json. Exact duplicates (ruleId + file + line) are dropped, and so is any
    finding (from any reviewer) whose message says it is not a defect or unverified, or whose fix
    starts with "none" or "optional".

    Getting the replies: with --agent <name>=<agentId> (once per reviewer that ran), the script reads each
    reviewer's final reply from its Claude Code subagent log (common/agent-replies.js) and writes it to
    reviews/<name>.txt itself, so nobody retypes it. <name> is the reply file name without .txt (axis,
    i18n, security, performance, a11y-labels, a11y-alt, a11y-aria, a11y-semantics, a11y-keyboard). If a
    reply can't be read, the script stops and names it; save that reply by hand to reviews/<name>.txt and
    run again without its --agent. Replies already in reviews/ are used as they are.

    Usage:
        node merge-findings.js --out-dir <dir> [--agent <name>=<agentId> ...] [--subagents-dir <dir>]
*/
'use strict';

const fs = require('fs');
const { parseCli, warn, run } = require('../common/cli');
const { readAgentReply } = require('../common/agent-replies');
const {
    trim, trimEnd, trimChars, readAllText, writeUtf8, joinPath, leafName, psString, getProperty,
    sortBy, parseJsonLikePowerShell, jsonItems,
} = require('../common/dotnet-compat');

// Wording a reviewer uses for something that needs no change, or that it could not confirm.
// "Could not / did not read" counts only in the first person or the passive: "users cannot open the
// menu" describes a real defect.
const NON_DEFECT_PATTERN = new RegExp([
    "\\bnot a defect\\b",
    "\\bno [\\p{L}\\p{Mn}\\p{Nd}\\p{Pc}-]+ defect\\b",
    "\\bunverified\\b",
    "\\bnot verified\\b",
    "\\bI (could|can) ?not (read|open|verify|confirm|check|inspect)\\b",
    "\\bI (couldn't|can't|did not|didn't) (read|open|verify|confirm|check|inspect)\\b",
    "\\b(could|can) ?not be (read|opened|verified|confirmed|checked)\\b",
    "\\bwas not opened\\b",
    "\\bleave (the markup|it|this) as is\\b",
    "\\bnot worth\\b",
].join('|'), 'iu');
const NON_DEFECT_FIX_PATTERN = /^\s*(none|optional)\b/i;

const AREA_RULE = {
    'a11y-labels': 'A11Y-LABELS',
    'a11y-alt': 'A11Y-ALT',
    'a11y-aria': 'A11Y-ARIA',
    'a11y-semantics': 'A11Y-SEMANTICS',
    'a11y-keyboard': 'A11Y-KEYBOARD',
};

const lowerEq = (a, b) => a.toLowerCase() === b.toLowerCase();

// ---- Fix check (reviewer-fix and the optional runtime check) --------------------------------------

const FIX_STATUSES = ['Fixed', 'Partial', 'SymptomOnly', 'NotAddressed', 'Unclear'];
const CRITERION_MET = ['yes', 'no', 'unclear'];

// The JSON object inside the reply's ```json block (or the whole reply).
function jsonObjectBlock(text) {
    const m = String(text).match(/```json\s*(?<j>[\s\S]*?)```/);
    return JSON.parse(m ? m.groups.j : trim(text));
}

function fixReply(text) {
    const obj = jsonObjectBlock(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected an object');
    return { verdict: jsonItems(getProperty(obj, 'verdict')), findings: jsonItems(getProperty(obj, 'findings')) };
}

// One entry per linked work item, in the target's order, with only known fields and values. A work item
// the reviewer left out is Unclear, so the summary never silently skips one.
function normalizeVerdict(raw, fixWorkItems) {
    const byId = new Map();
    for (const v of raw) {
        const id = Number(psString(getProperty(v, 'workItem')).match(/\d+/)?.[0]);
        if (Number.isInteger(id) && !byId.has(id)) byId.set(id, v);
    }
    const ids = fixWorkItems.length > 0 ? fixWorkItems.map((w) => Number(w.id)) : [...byId.keys()];
    return ids.map((id) => {
        const wi = fixWorkItems.find((w) => Number(w.id) === id) || {};
        const v = byId.get(id);
        const field = (k) => trim(psString(v ? getProperty(v, k) : ''));
        const status = FIX_STATUSES.find((s) => lowerEq(s, field('status'))) || 'Unclear';
        const criteria = jsonItems(v ? getProperty(v, 'criteria') : []).map((c) => {
            const criterion = {
                text: trim(psString(getProperty(c, 'text'))),
                met: CRITERION_MET.find((s) => lowerEq(s, trim(psString(getProperty(c, 'met'))))) || 'unclear',
                evidence: trim(psString(getProperty(c, 'evidence'))),
            };
            if (lowerEq(trim(psString(getProperty(c, 'kind'))), 'design')) criterion.kind = 'design';
            return criterion;
        }).filter((c) => c.text);
        return {
            workItem: id,
            type: psString(wi.type) || null,
            title: psString(wi.title) || null,
            status,
            summary: v ? field('summary') : 'The fix reviewer gave no verdict for this work item.',
            criteria,
            runtimeCheck: /^needed$/i.test(field('runtimeCheck')) || status === 'Unclear' ? 'needed' : 'not-needed',
            steps: jsonItems(v ? getProperty(v, 'steps') : []).map((s) => trim(psString(s))).filter(Boolean),
            runtime: null,
            figma: null,
        };
    });
}

// reviews/fix-runtime.txt: [ { workItem, result: pass|fail|blocked, observed, step, file?, line? } ]
function runtimeResults(text) {
    const m = String(text).match(/```json\s*(?<j>[\s\S]*?)```/);
    const parsed = JSON.parse(m ? m.groups.j : trim(text));
    if (!Array.isArray(parsed)) throw new Error('expected an array');
    return parsed;
}

// pass -> Fixed, fail -> NotAddressed (+ FIX-01 when it names a changed line), blocked -> unchanged.
function applyRuntime(verdict, results) {
    const findings = [];
    let count = 0;
    for (const r of results) {
        const id = Number(psString(getProperty(r, 'workItem')).match(/\d+/)?.[0]);
        const v = verdict.find((x) => x.workItem === id);
        if (!v) continue;
        const result = trim(psString(getProperty(r, 'result'))).toLowerCase();
        if (!['pass', 'fail', 'blocked'].includes(result)) continue;
        const observed = trim(psString(getProperty(r, 'observed')));
        const step = trim(psString(getProperty(r, 'step')));
        const numberOf = (k) => { const n = Number(psString(getProperty(r, k)).match(/\d+/)?.[0]); return Number.isFinite(n) ? n : null; };
        v.runtime = { result, observed, step, actions: numberOf('actions'), seconds: numberOf('seconds') };
        if (result === 'pass') { v.status = 'Fixed'; v.runtimeCheck = 'not-needed'; }
        if (result === 'fail') {
            v.status = 'NotAddressed';
            v.runtimeCheck = 'not-needed';
            const file = psString(getProperty(r, 'file'));
            const line = psString(getProperty(r, 'line'));
            if (file && line) {
                findings.push({
                    ruleId: 'FIX-01', severity: 'Warning', file, line,
                    message: `Work item ${id} still fails in the running app${step ? ` at "${step}"` : ''}: ${observed}`,
                    fix: 'Fix the case the runtime check reproduced, then run the review again.',
                });
            }
        }
        count++;
    }
    return { findings, count };
}

// reviews/fix-figma.txt: [ { workItem, result: match|mismatch|blocked, frame, checks: [ { what, design, app, ok } ],
// actions?, seconds?, file?, line? } ]. Sets the design criterion; mismatch turns Fixed into Partial.
function applyFigma(verdict, results) {
    const findings = [];
    let count = 0;
    for (const r of results) {
        const id = Number(psString(getProperty(r, 'workItem')).match(/\d+/)?.[0]);
        const v = verdict.find((x) => x.workItem === id);
        if (!v) continue;
        const result = trim(psString(getProperty(r, 'result'))).toLowerCase();
        if (!['match', 'mismatch', 'blocked'].includes(result)) continue;
        const checks = jsonItems(getProperty(r, 'checks')).map((c) => ({
            what: trim(psString(getProperty(c, 'what'))),
            design: trim(psString(getProperty(c, 'design'))),
            app: trim(psString(getProperty(c, 'app'))),
            ok: getProperty(c, 'ok') === true || lowerEq(trim(psString(getProperty(c, 'ok'))), 'true'),
        })).filter((c) => c.what);
        const numberOf = (k) => { const n = Number(psString(getProperty(r, k)).match(/\d+/)?.[0]); return Number.isFinite(n) ? n : null; };
        v.figma = { result, frame: trim(psString(getProperty(r, 'frame'))), checks, actions: numberOf('actions'), seconds: numberOf('seconds') };
        count++;
        if (result === 'blocked') continue;

        let design = v.criteria.find((c) => c.kind === 'design');
        if (!design) {
            design = { text: 'The screen matches the Figma frame', met: 'unclear', evidence: '', kind: 'design' };
            v.criteria.push(design);
        }
        const failed = checks.filter((c) => !c.ok);
        design.met = result === 'match' ? 'yes' : 'no';
        design.evidence = `${checks.length - failed.length} of ${checks.length} design values match`;
        if (result === 'mismatch') {
            if (v.status === 'Fixed') v.status = 'Partial';
            const file = psString(getProperty(r, 'file'));
            const line = psString(getProperty(r, 'line'));
            if (file && line && failed.length > 0) {
                findings.push({
                    ruleId: 'FIX-01', severity: 'Warning', file, line,
                    message: `Work item ${id} differs from the Figma frame: ${failed.map((c) => `${c.what} is ${c.app}, design ${c.design}`).join('; ')}.`,
                    fix: 'Set these values to the ones in the Figma frame.',
                });
            }
        }
    }
    return { findings, count };
}

function main() {
    const {
        'out-dir': outDir,
        agent: agentSpecs = [],
        'subagents-dir': subagentsDir,
    } = parseCli('merge-findings', {
        'out-dir': { type: 'string', required: true },
        agent: { type: 'string', multiple: true },
        'subagents-dir': { type: 'string' },
    });

    const target = JSON.parse(readAllText(joinPath(outDir, 'target.json')));
    const targetPaths = (target.files || []).map((t) => psString(t.path));
    const reviewDir = joinPath(outDir, 'reviews');

    // Copy each reviewer's reply from its log, unchanged. All or nothing: a reviewer whose reply can't be
    // read must not silently drop out of the review.
    if (agentSpecs.length > 0) {
        const replies = [];
        const failed = [];
        for (const spec of agentSpecs) {
            const m = String(spec).match(/^\s*([a-z0-9-]+)\s*=\s*(\S+)\s*$/i);
            if (!m) { failed.push(`'${spec}': expected <name>=<agentId>`); continue; }
            const name = m[1].toLowerCase();
            try { replies.push({ name, text: readAgentReply(name, m[2], subagentsDir) }); }
            catch (e) { failed.push(`${name}: ${e.message}`); }
        }
        if (failed.length > 0) {
            throw new Error(`merge-findings: could not read these replies from the agent logs:\n  ${failed.join('\n  ')}\n`
                + 'Save each of them by hand to reviews/<name>.txt and run again without its --agent.');
        }
        fs.mkdirSync(reviewDir, { recursive: true });
        for (const r of replies) {
            writeUtf8(joinPath(reviewDir, `${r.name}.txt`), r.text);
            process.stdout.write(`Reply read from log: reviews/${r.name}.txt\n`);
        }
    }
    if (!fs.existsSync(reviewDir)) throw new Error(`merge-findings: no reviews folder at '${reviewDir}'.`);

    // Paths compare case-insensitively, as in a PowerShell hashtable.
    const changedByPath = new Map();
    for (const t of target.files || []) changedByPath.set(psString(t.path).toLowerCase(), t.changedLines || []);

    function resolveTargetPath(raw) {
        // Keep the path itself: drop backticks/quotes and anything after the first space or '('.
        const p = trimChars(trim(psString(raw)), ['`', '"', "'"]).split(/[\s(]/)[0].replace(/\\/g, '/');
        if (!p) return null;
        if (targetPaths.some((t) => lowerEq(t, p))) return p;
        const bySuffix = targetPaths.filter((t) => t.endsWith(`/${p}`) || p.endsWith(`/${t}`) || p.endsWith(t));
        if (bySuffix.length === 1) return bySuffix[0];
        const name = leafName(p);
        const byName = targetPaths.filter((t) => lowerEq(leafName(t), name));
        if (byName.length === 1) return byName[0];
        return null;
    }

    function anchorLine(location, filePath) {
        // Only the line list: notes in parentheses or after ';' may cite lines of other files.
        let head = location.split(/[(;]/)[0];
        if (!trim(head)) head = location;
        const numbers = (head.match(/\d+/g) || []).map(Number);
        if (numbers.length === 0) return null;
        for (const n of numbers) {
            for (const range of changedByPath.get(filePath.toLowerCase()) || []) {
                if (range === null) continue;
                if (n >= range[0] && n <= range[1]) return n;
            }
        }
        return numbers[0];
    }

    function jsonBlock(text) {
        const m = text.match(/```json\s*(?<j>[\s\S]*?)```/);
        const json = m ? m.groups.j : trim(text);
        return jsonItems(parseJsonLikePowerShell(json));
    }

    // Parses the accessibility-framework "Findings:" list. Values are one line; an indented line without a
    // `key:` continues the previous value.
    function a11yFindings(text) {
        const findings = [];
        let current = null;
        let lastKey = null;
        let inFindings = false;
        for (const rawLine of text.split(/\r?\n/)) {
            const line = trimEnd(rawLine);
            let m = line.match(/^\s*Findings:\s*(\[\s*\])?\s*$/i);
            if (m) { inFindings = !m[1]; continue; }
            if (/^\s*(Conflicts|OutOfScope|moreFindings|remainingCount)\s*:/i.test(line)) { inFindings = false; continue; }
            if (!inFindings) continue;

            if ((m = line.match(/^\s*-\s+file:\s*(?<v>.*)$/i))) {
                if (current) findings.push(current);
                current = { file: m.groups.v, location: '', issue: '', fix: '', runtimecheck: '' };
                lastKey = 'file';
            }
            else if (current && (m = line.match(/^\s*(?<k>location|issue|fix|translationKey|sharedImpact|runtimeCheck):\s*(?<v>.*)$/i))) {
                lastKey = m.groups.k.toLowerCase();
                if (lastKey in current) current[lastKey] = m.groups.v;
            }
            else if (current && lastKey && lastKey in current && trim(line)) {
                current[lastKey] = `${current[lastKey]} ${trim(line)}`;
            }
        }
        if (current) findings.push(current);
        return findings;
    }

    const all = [];
    const dropped = [];
    let fixVerdict = null;
    const replyFiles = sortBy(fs.readdirSync(reviewDir).filter((n) => n.toLowerCase().endsWith('.txt')), (n) => n);
    for (const fileName of replyFiles) {
        const name = fileName.replace(/\.txt$/i, '').toLowerCase();
        const text = readAllText(joinPath(reviewDir, fileName));

        // The runtime results are applied to the fix verdict below, after every reply is read.
        if (name === 'fix-runtime' || name === 'fix-figma') continue;

        if (name === 'fix') {
            // { verdict: [...], findings: [...] }: the verdict goes to fix-verdict.json, the findings
            // through the same checks as every other JSON reviewer.
            let reply;
            try { reply = fixReply(text); }
            catch (e) { dropped.push(`fix: reply is not the { verdict, findings } object, all of it skipped (${e.message})`); continue; }
            fixVerdict = reply.verdict;
            for (const f of reply.findings) addJsonFinding(name, f);
            continue;
        }

        if (AREA_RULE[name]) {
            for (const f of a11yFindings(text)) {
                const filePath = resolveTargetPath(f.file);
                if (!filePath) { dropped.push(`${name}: file '${f.file}' not in this review`); continue; }
                const num = anchorLine(f.location, filePath);
                if (num === null) { dropped.push(`${name}: no line number in location '${f.location}'`); continue; }
                let message = trim(f.issue);
                if (/^\s*needed/i.test(f.runtimecheck)) message = `${message} Needs a keyboard / screen-reader check.`;
                all.push({ ruleId: AREA_RULE[name], severity: 'Warning', file: filePath, line: num, message, fix: trim(f.fix), reviewer: name });
            }
        }
        else {
            // One unreadable reply must not lose the other reviewers' findings.
            let jsonFindings;
            try { jsonFindings = jsonBlock(text); }
            catch (e) { dropped.push(`${name}: reply is not a JSON findings array, all of it skipped (${e.message})`); continue; }
            for (const f of jsonFindings) addJsonFinding(name, f);
        }
    }

    function addJsonFinding(name, f) {
        const field = (k) => psString(getProperty(f, k));
        const ruleId = trim(field('ruleId'));
        const filePath = resolveTargetPath(field('file'));
        if (!filePath) { dropped.push(`${name}: file '${field('file')}' not in this review`); return; }
        // line may come as a number, a string or a range such as "12-14": use its first number.
        const lineMatch = field('line').match(/\d+/);
        if (!lineMatch) { dropped.push(`${name}: ${ruleId} in ${filePath} has no line number ('${field('line')}')`); return; }
        if (!ruleId) { dropped.push(`${name}: finding at ${filePath}:${lineMatch[0]} has no ruleId`); return; }
        const message = trim(field('message'));
        if (!message) { dropped.push(`${name}: ${ruleId} at ${filePath}:${lineMatch[0]} has no message`); return; }
        all.push({ ruleId, severity: trim(field('severity')), file: filePath, line: Number(lineMatch[0]), message, fix: trim(field('fix')), reviewer: name });
    }

    // ---- Fix check verdict ------------------------------------------------------------------------
    const fixWorkItems = jsonItems(target.fixWorkItems);
    if (fixVerdict !== null || fixWorkItems.length > 0) {
        const verdict = normalizeVerdict(fixVerdict || [], fixWorkItems);
        const runtimeFile = joinPath(reviewDir, 'fix-runtime.txt');
        if (fs.existsSync(runtimeFile)) {
            try {
                const applied = applyRuntime(verdict, runtimeResults(readAllText(runtimeFile)));
                for (const f of applied.findings) addJsonFinding('fix-runtime', f);
                process.stdout.write(`Fix check: runtime results applied to ${applied.count} work item(s)\n`);
            }
            catch (e) { dropped.push(`fix-runtime: reply is not a JSON array, runtime results skipped (${e.message})`); }
        }
        // After the runtime results, so a design mismatch can still turn a runtime pass into Partial.
        const figmaFile = joinPath(reviewDir, 'fix-figma.txt');
        if (fs.existsSync(figmaFile)) {
            try {
                const applied = applyFigma(verdict, runtimeResults(readAllText(figmaFile)));
                for (const f of applied.findings) addJsonFinding('fix-figma', f);
                process.stdout.write(`Fix check: Figma results applied to ${applied.count} work item(s)\n`);
            }
            catch (e) { dropped.push(`fix-figma: reply is not a JSON array, Figma results skipped (${e.message})`); }
        }
        writeUtf8(joinPath(outDir, 'fix-verdict.json'), JSON.stringify(verdict, null, 4));
        process.stdout.write(`Fix check: ${verdict.map((v) => `${v.workItem} ${v.status}`).join(', ')} -> ${joinPath(outDir, 'fix-verdict.json')}\n`);
    }

    // Exact duplicates: keep the first (files are read in name order, so this is stable).
    const seen = new Set();
    const merged = [];
    for (const f of all) {
        // The message decides whether it is a defect; doubt in the fix is only about how to fix it.
        if (NON_DEFECT_PATTERN.test(f.message) || NON_DEFECT_FIX_PATTERN.test(f.fix)) {
            dropped.push(`${f.reviewer}: ${f.ruleId} at ${f.file}:${f.line} - its own text says it is not a defect, optional or unverified`);
            continue;
        }
        const key = `${f.ruleId}|${f.file}|${f.line}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(f);
    }

    writeUtf8(joinPath(outDir, 'findings.json'), JSON.stringify(merged, null, 4));

    const perReviewer = new Map();
    for (const f of merged) perReviewer.set(f.reviewer, (perReviewer.get(f.reviewer) || 0) + 1);
    for (const [reviewer, count] of perReviewer) process.stdout.write(`${reviewer}: ${count} finding(s)\n`);
    process.stdout.write(`Merged: ${merged.length} finding(s) -> ${joinPath(outDir, 'findings.json')}\n`);
    for (const d of dropped) warn(`Dropped - ${d}`);
}

run(main);
