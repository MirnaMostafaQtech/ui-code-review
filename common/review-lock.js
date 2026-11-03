/*
    common/review-lock.js

    One review at a time per PR / changeset. Two runs on the same target used to share one output
    folder and overwrite each other's replies; now every run has its own folder, and this lock stops
    a second run from starting while the first is still going.

    The lock is a file next to the run folders, <root>/<kind>-<id>.lock, holding the run's outDir and
    start time. It is taken by get-review-target.js and dropped by release-review-lock.js at the end
    of the review. A run that dies without releasing leaves a stale lock: it is taken over after
    REVIEW_LOCK_TTL_MINUTES, or at once with --force.

    Consumers: scripts/get-review-target.js, scripts/release-review-lock.js.
*/
'use strict';

const fs = require('fs');
const path = require('path');

const REVIEW_LOCK_TTL_MINUTES = 120;

function lockPathFor(root, kind, id) {
    return path.join(root, `${kind}-${id}.lock`);
}

function readHolder(lockPath) {
    try { return JSON.parse(fs.readFileSync(lockPath, 'utf8').replace(/^﻿/, '')); }
    catch { return null; }
}

function samePath(a, b) {
    const x = path.resolve(a);
    const y = path.resolve(b);
    return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/*
    Takes the lock for this target or throws, naming the run that holds it. Creating the file with
    the 'wx' flag is atomic, so two runs starting together can't both get it.
*/
function enterReviewLock({ kind, id, outDir, force = false }) {
    const root = path.dirname(outDir);
    fs.mkdirSync(root, { recursive: true });
    const lockPath = lockPathFor(root, kind, id);
    const body = JSON.stringify({ kind, id, outDir, started: new Date().toISOString() }, null, 4);

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(lockPath, body, { flag: 'wx' });
            return;
        }
        catch (e) {
            if (e.code !== 'EEXIST' || attempt > 0 || !fs.existsSync(lockPath)) throw e;
        }

        // Someone holds it: take over only if it is stale or --force was given.
        const holder = readHolder(lockPath);
        const started = holder && holder.started ? new Date(holder.started) : fs.statSync(lockPath).mtime;
        const ageMinutes = Math.round((Date.now() - started.getTime()) / 60000);
        if (!force && ageMinutes < REVIEW_LOCK_TTL_MINUTES) {
            const where = holder ? ` Its folder: ${holder.outDir}.` : '';
            const hhmm = `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`;
            throw new Error(`REVIEW-LOCKED: another review of ${kind} ${id} started ${ageMinutes} minute(s) ago (${hhmm}) and is still running.${where} Wait for it to finish, or run again with --force if that review is no longer running.`);
        }
        fs.rmSync(lockPath, { force: true });
    }
}

/*
    Drops the lock, but only if this run (outDir) holds it: a run that was taken over must not
    remove the lock of the run that replaced it.
*/
function exitReviewLock(outDir) {
    const root = path.dirname(outDir);
    if (!fs.existsSync(root)) return;
    for (const name of fs.readdirSync(root)) {
        if (!name.toLowerCase().endsWith('.lock')) continue;
        const lockPath = path.join(root, name);
        if (!fs.statSync(lockPath).isFile()) continue;
        const holder = readHolder(lockPath);
        if (holder && holder.outDir && samePath(holder.outDir, outDir)) fs.rmSync(lockPath, { force: true });
    }
}

module.exports = { enterReviewLock, exitReviewLock };
