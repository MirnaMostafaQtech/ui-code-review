/*
    common/tfs-auth.js

    TFS / Azure DevOps Server authentication and REST calls.

    The PAT convention here (HTTP Basic auth, empty user name, the PAT as the password) is specific
    to TFS / Azure DevOps Server, and is the exact reverse of SonarQube's (token as user name, empty
    password). The two must never be confused or copied between each other.

    The PAT is read from SONARTOOLKIT_TFS_PAT (process, else the Windows user environment), the
    same variable as q-ai-quality-review. It is never passed on a command line.

    Consumers: scripts/get-review-target.js, scripts/publish-findings.js, scm-adapters/tfs.js.
*/
'use strict';

const { spawnSync } = require('child_process');

const PAT_VARIABLE = 'SONARTOOLKIT_TFS_PAT';

// A variable set for the user after this process started is in the registry, not in process.env.
function readUserEnvironmentVariable(name) {
    if (process.platform !== 'win32') return '';
    const result = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) return '';
    const match = result.stdout.match(new RegExp(`^\\s*${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.*)$`, 'mi'));
    return match ? match[1].trim() : '';
}

function getTfsPat(caller) {
    const pat = process.env[PAT_VARIABLE] || readUserEnvironmentVariable(PAT_VARIABLE);
    if (!pat) throw new Error(`${caller}: ${PAT_VARIABLE} is not set.`);
    return pat;
}

function tfsAuthHeaders(pat) {
    return { Authorization: 'Basic ' + Buffer.from(`:${pat}`, 'ascii').toString('base64') };
}

async function tfsFetch(method, uri, pat, { body, contentType = 'application/json' } = {}) {
    if (!/^https:\/\//i.test(uri)) {
        throw new Error(`tfs-auth: refusing to send the PAT over http: ${uri}`);
    }
    const headers = tfsAuthHeaders(pat);
    const init = { method, headers };
    if (body !== undefined) {
        headers['Content-Type'] = `${contentType}; charset=utf-8`;
        init.body = Buffer.from(JSON.stringify(body), 'utf8');
    }
    let response;
    try {
        response = await fetch(uri, init);
    }
    catch (e) {
        const cause = e.cause && e.cause.code ? ` (${e.cause.code})` : '';
        throw new Error(`${method} ${uri} failed: ${e.message}${cause}. For a company certificate, see README "Requirements".`);
    }
    if (!response.ok) {
        const text = (await response.text().catch(() => '')).slice(0, 300);
        throw new Error(`${method} ${uri} failed: (${response.status}) ${response.statusText}${text ? ` - ${text}` : ''}`);
    }
    return response;
}

// Invoke-RestMethod: the parsed JSON reply (or null for an empty one).
async function tfsJson(method, uri, pat, options) {
    const response = await tfsFetch(method, uri, pat, options);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Invoke-WebRequest: the raw reply bytes (file content).
async function tfsBytes(uri, pat) {
    const response = await tfsFetch('GET', uri, pat);
    return Buffer.from(await response.arrayBuffer());
}

module.exports = { getTfsPat, tfsAuthHeaders, tfsJson, tfsBytes };
