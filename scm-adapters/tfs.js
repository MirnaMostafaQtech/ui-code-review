/*
    scm-adapters/tfs.js

    The TFS / Azure DevOps Server lookups the review needs: where a Git clone's server, project and
    repository are, a Pull Request's branches and commits, and the files a TFVC changeset touched.
    On-prem TFS / Azure DevOps Server only; every endpoint exists under the on-prem
    "azure-devops-server-rest-*" API versions. Only change detection lives here, no review logic.

    Consumer: scripts/get-review-target.js.
*/
'use strict';

const { spawnSync } = require('child_process');
const { tfsJson } = require('../common/tfs-auth');
const { escapeDataString, unescapeDataString, getProperty, psString } = require('../common/dotnet-compat');

/*
    Derives the collection URL, project and repository name from the clone's `origin` remote. Git
    remotes on TFS / Azure DevOps Server look like https://<server>/<collection>/<project>/_git/<repo>;
    the collection URL (server + collection) is the base for every REST call.
*/
function getTfsRemoteInfo(repoRoot) {
    const result = spawnSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) {
        throw new Error(`tfs-adapter: could not read the 'origin' remote in '${repoRoot}': ${(result.stderr || result.stdout || '').trim()}`);
    }
    const url = result.stdout.trim();
    const match = url.match(/^(?<collection>https?:\/\/[^/]+\/[^/]+)\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+?)\/?$/i);
    if (!match) {
        throw new Error(`tfs-adapter: '${url}' doesn't look like an on-prem TFS/Azure DevOps Server Git remote (expected https://<server>/<collection>/<project>/_git/<repo>).`);
    }
    const { collection, project, repo } = match.groups;
    if (!/^https:\/\//i.test(collection)) {
        throw new Error(`tfs-adapter: origin remote '${url}' uses 'http', not 'https' - refusing to send a PAT over an unencrypted connection. Use an https:// remote.`);
    }
    return {
        collectionUrl: collection,
        project: unescapeDataString(project),
        repositoryName: unescapeDataString(repo.replace(/\.git$/i, '')),
    };
}

/*
    An existing Pull Request: title, branches (without "refs/heads/"), web URL, and the raw reply,
    which carries the PR's own source and target commits.
*/
async function getTfsPullRequest({ collectionUrl, project, repositoryName, pullRequestId, pat }) {
    const repoBase = `${collectionUrl}/${escapeDataString(project)}`;
    const uri = `${repoBase}/_apis/git/repositories/${escapeDataString(repositoryName)}/pullrequests/${pullRequestId}?api-version=5.0`;
    const pr = await tfsJson('GET', uri, pat);
    return {
        pullRequestId: pr.pullRequestId,
        sourceBranch: psString(pr.sourceRefName).replace(/^refs\/heads\//i, ''),
        targetBranch: psString(pr.targetRefName).replace(/^refs\/heads\//i, ''),
        title: pr.title,
        status: pr.status,
        webUrl: `${repoBase}/_git/${escapeDataString(repositoryName)}/pullrequest/${pr.pullRequestId}`,
        raw: pr,
    };
}

/*
    The files one TFVC changeset touched: { serverPath, changeType, sourceServerPath }.
    sourceServerPath is the path before a rename, else null. One page of up to `top` changes is read,
    large enough for any realistic changeset.
*/
async function getTfvcChangesetChanges({ collectionUrl, changesetId, pat, top = 500 }) {
    const uri = `${collectionUrl}/_apis/tfvc/changesets/${changesetId}/changes?$top=${top}&api-version=5.0`;
    const response = await tfsJson('GET', uri, pat);
    const changes = [];
    for (const entry of (response && response.value) || []) {
        const source = psString(getProperty(entry, 'sourceServerItem'));
        changes.push({
            serverPath: entry.item.path,
            changeType: psString(entry.changeType),
            sourceServerPath: source || null,
        });
    }
    return changes;
}

/*
    The ids of the work items linked to a Pull Request.
*/
async function getPullRequestWorkItemIds({ collectionUrl, project, repositoryName, pullRequestId, pat }) {
    const repoBase = `${collectionUrl}/${escapeDataString(project)}`;
    const uri = `${repoBase}/_apis/git/repositories/${escapeDataString(repositoryName)}/pullrequests/${pullRequestId}/workitems?api-version=5.0`;
    const reply = await tfsJson('GET', uri, pat);
    return ((reply && reply.value) || []).map((w) => Number(w.id)).filter((n) => Number.isInteger(n));
}

/*
    The fields the fix check needs, for up to 200 work items in one call:
    { id, type, title, state, description, reproSteps, acceptanceCriteria } (HTML as stored).
*/
const WORK_ITEM_FIELDS = [
    'System.WorkItemType', 'System.Title', 'System.State', 'System.Description',
    'Microsoft.VSTS.TCM.ReproSteps', 'Microsoft.VSTS.Common.AcceptanceCriteria',
];
async function getWorkItems({ collectionUrl, ids, pat }) {
    if (!ids || ids.length === 0) return [];
    const uri = `${collectionUrl}/_apis/wit/workitems?ids=${ids.slice(0, 200).join(',')}&fields=${WORK_ITEM_FIELDS.join(',')}&errorPolicy=omit&api-version=5.0`;
    const reply = await tfsJson('GET', uri, pat);
    const items = [];
    for (const wi of (reply && reply.value) || []) {
        if (!wi || !wi.fields) continue;
        const f = wi.fields;
        items.push({
            id: wi.id,
            type: psString(f['System.WorkItemType']),
            title: psString(f['System.Title']),
            state: psString(f['System.State']),
            description: psString(f['System.Description']),
            reproSteps: psString(f['Microsoft.VSTS.TCM.ReproSteps']),
            acceptanceCriteria: psString(f['Microsoft.VSTS.Common.AcceptanceCriteria']),
        });
    }
    return items;
}

module.exports = { getTfsRemoteInfo, getTfsPullRequest, getTfvcChangesetChanges, getPullRequestWorkItemIds, getWorkItems };
