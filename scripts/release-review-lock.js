#!/usr/bin/env node
/*
    scripts/release-review-lock.js

    Ends a review run: drops the PR / changeset review lock that get-review-target.js took for this
    run's outDir, so the next review of the same target can start. It removes the lock only if this
    run holds it, and does nothing if the lock is already gone.

    Usage:
        node release-review-lock.js --out-dir <dir>
*/
'use strict';

const { parseCli, run } = require('../common/cli');
const { exitReviewLock } = require('../common/review-lock');

run(() => {
    const { 'out-dir': outDir } = parseCli('release-review-lock', { 'out-dir': { type: 'string', required: true } });
    exitReviewLock(outDir);
    process.stdout.write(`Review lock released for ${outDir}\n`);
});
