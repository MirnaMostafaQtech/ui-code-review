/*
    common/agent-replies.js

    Reads a reviewer's final reply straight from the log Claude Code keeps for every subagent, so the
    main agent never has to retype the reply into reviews/<name>.txt.

    Where the log is: <config dir>/projects/<project>/<session>/subagents/agent-<agentId>.jsonl, next to
    agent-<agentId>.meta.json. <config dir> is CLAUDE_CONFIG_DIR, else ~/.claude.

    The reply is the last assistant message: the `message` of its SubagentHandback tool call when there is
    one, else its text. The meta file must name the expected reviewer (agentType) and say it finished, so
    a wrong or still-running agent id is refused instead of filing the wrong reply.

    This depends on Claude Code's log layout, which is not a published interface. Every failure says what
    it could not find, so the review can fall back to saving the reply by hand.

    Consumers: scripts/merge-findings.js.
*/
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// reviews/<name>.txt -> the agent that must have written it.
const REVIEWER_AGENTS = {
    'axis': 'reviewer-axis',
    'i18n': 'reviewer-i18n',
    'security': 'reviewer-security',
    'performance': 'reviewer-performance',
    'a11y-labels': 'accessibility-labels',
    'a11y-alt': 'accessibility-alt',
    'a11y-aria': 'accessibility-aria',
    'a11y-semantics': 'accessibility-semantics',
    'a11y-keyboard': 'accessibility-keyboard',
};

function projectsDir() {
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    return path.join(configDir, 'projects');
}

// Every subagents/ folder under <config dir>/projects/*/*/, or just `override` when given.
function subagentDirs(override) {
    if (override) return [override];
    const root = projectsDir();
    const dirs = [];
    let projects = [];
    try { projects = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); }
    catch { return dirs; }
    for (const project of projects) {
        let sessions = [];
        try { sessions = fs.readdirSync(path.join(root, project.name), { withFileTypes: true }).filter((d) => d.isDirectory()); }
        catch { continue; }
        for (const session of sessions) {
            const dir = path.join(root, project.name, session.name, 'subagents');
            if (fs.existsSync(dir)) dirs.push(dir);
        }
    }
    return dirs;
}

function findLog(agentId, override) {
    const name = `agent-${agentId}.jsonl`;
    const found = subagentDirs(override)
        .map((dir) => path.join(dir, name))
        .filter((file) => fs.existsSync(file));
    if (found.length === 0) return null;
    // Agent ids are random; if one shows up twice, the newest log is the live one.
    return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function lastReply(logFile) {
    const entries = [];
    for (const line of fs.readFileSync(logFile, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try { entries.push(JSON.parse(line)); }
        catch { /* a line still being written: ignore it */ }
    }
    for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        const blocks = e.message.content;
        const handback = blocks.find((b) => b.type === 'tool_use' && b.name === 'SubagentHandback');
        if (handback && handback.input && typeof handback.input.message === 'string') return handback.input.message;
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        if (text.trim()) return text;
    }
    return null;
}

// Returns the reply text, or throws an Error that says what was missing.
function readAgentReply(reviewerName, agentId, subagentsDirOverride) {
    const expected = REVIEWER_AGENTS[reviewerName];
    if (!expected) {
        throw new Error(`unknown reviewer '${reviewerName}' (expected one of: ${Object.keys(REVIEWER_AGENTS).join(', ')})`);
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(agentId)) throw new Error(`agent id '${agentId}' is not a valid id`);

    const logFile = findLog(agentId, subagentsDirOverride);
    if (!logFile) throw new Error(`no log found for agent ${agentId} under ${subagentsDirOverride || projectsDir()}`);

    const metaFile = logFile.replace(/\.jsonl$/, '.meta.json');
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); }
    catch { throw new Error(`agent ${agentId}: no readable ${path.basename(metaFile)} next to its log`); }

    const agentType = String(meta.agentType || '');
    if (agentType !== expected && !agentType.endsWith(`:${expected}`)) {
        throw new Error(`agent ${agentId} is '${agentType || 'unknown'}', not ${expected}: wrong id for ${reviewerName}`);
    }
    if (meta.finished === false) throw new Error(`agent ${agentId} (${expected}) has not finished yet`);

    const reply = lastReply(logFile);
    if (reply === null) throw new Error(`agent ${agentId} (${expected}): no final reply in its log`);
    return reply;
}

module.exports = { REVIEWER_AGENTS, readAgentReply };
