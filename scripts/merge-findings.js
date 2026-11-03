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

    Usage:
        node merge-findings.js --out-dir <dir>
*/
'use strict';

const fs = require('fs');
const { parseCli, warn, run } = require('../common/cli');
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

function main() {
    const { 'out-dir': outDir } = parseCli('merge-findings', { 'out-dir': { type: 'string', required: true } });

    const target = JSON.parse(readAllText(joinPath(outDir, 'target.json')));
    const targetPaths = (target.files || []).map((t) => psString(t.path));
    const reviewDir = joinPath(outDir, 'reviews');
    if (!fs.existsSync(reviewDir)) throw new Error(`Merge-Findings: no reviews folder at '${reviewDir}'.`);

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
    const replyFiles = sortBy(fs.readdirSync(reviewDir).filter((n) => n.toLowerCase().endsWith('.txt')), (n) => n);
    for (const fileName of replyFiles) {
        const name = fileName.replace(/\.txt$/i, '').toLowerCase();
        const text = readAllText(joinPath(reviewDir, fileName));

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
            for (const f of jsonFindings) {
                const field = (k) => psString(getProperty(f, k));
                const ruleId = trim(field('ruleId'));
                const filePath = resolveTargetPath(field('file'));
                if (!filePath) { dropped.push(`${name}: file '${field('file')}' not in this review`); continue; }
                // line may come as a number, a string or a range such as "12-14": use its first number.
                const lineMatch = field('line').match(/\d+/);
                if (!lineMatch) { dropped.push(`${name}: ${ruleId} in ${filePath} has no line number ('${field('line')}')`); continue; }
                if (!ruleId) { dropped.push(`${name}: finding at ${filePath}:${lineMatch[0]} has no ruleId`); continue; }
                const message = trim(field('message'));
                if (!message) { dropped.push(`${name}: ${ruleId} at ${filePath}:${lineMatch[0]} has no message`); continue; }
                all.push({ ruleId, severity: trim(field('severity')), file: filePath, line: Number(lineMatch[0]), message, fix: trim(field('fix')), reviewer: name });
            }
        }
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
