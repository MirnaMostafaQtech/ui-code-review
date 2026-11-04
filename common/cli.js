/*
    common/cli.js

    Argument parsing and the error/exit convention every script shares: Write-Output goes to stdout,
    Write-Warning to stderr as "WARNING: ...", and an error ends the script with exit code 1.

    Consumers: scripts/*.js.
*/
'use strict';

const { parseArgs } = require('util');

// options: { name: { type: 'string' | 'boolean', required?, default?, multiple? } }
// A `multiple` option may be given more than once and comes back as an array.
function parseCli(script, options) {
    const config = {};
    for (const [name, o] of Object.entries(options)) config[name] = { type: o.type, multiple: !!o.multiple };
    let values;
    try {
        ({ values } = parseArgs({ options: config, strict: true, allowPositionals: false }));
    }
    catch (e) {
        throw new Error(`${script}: ${e.message}`);
    }
    for (const [name, o] of Object.entries(options)) {
        if (values[name] === undefined && o.default !== undefined) values[name] = o.default;
        if (o.required && (values[name] === undefined || values[name] === '')) {
            throw new Error(`${script}: --${name} is required.`);
        }
    }
    return values;
}

function warn(message) {
    process.stderr.write(`WARNING: ${message}\n`);
}

function run(main) {
    Promise.resolve()
        .then(main)
        .catch((e) => {
            process.stderr.write(`${e && e.message ? e.message : e}\n`);
            process.exitCode = 1;
        });
}

module.exports = { parseCli, warn, run };
