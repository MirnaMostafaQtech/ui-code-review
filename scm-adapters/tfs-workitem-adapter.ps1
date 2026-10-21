<#
    scm-adapters/tfs-workitem-adapter.ps1

    Attaches a generated Quality Review report to an existing TFS/Azure DevOps Server work item, so
    a reviewer using `/quality-review branch --task <id>` gets the report linked directly on the
    task under review, with no manual upload. On-prem TFS/Azure DevOps Server only, matching what
    this pilot's teams actually run - a cloud dev.azure.com remote has a different URL shape and
    isn't handled here.

    This is a best-effort convenience, not enforcement: a failure anywhere in this file (bad token,
    unreachable server, unknown work item id) must never fail or block the quality review itself -
    the caller (claude/skills/quality-review/SKILL.md) is expected to catch and report failures from
    these functions without treating them as fatal.
#>

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '../common/tfs-auth.ps1')

function Get-TfsRemoteInfo {
    <#
        Derives the TFS/Azure DevOps Server collection URL, project name, and repository name from
        the repository's `origin` remote, so a reviewer only has to supply a work item id - not the
        server, collection, project, or repository - to attach a report. Git-hosted TFS/Azure
        DevOps Server remotes look like https://<server>/<collection>/<project>/_git/<repo>; the
        collection URL (server + collection segment) is also the base for every work item REST API
        call. RepositoryName was added once scm-adapters/tfs-pullrequest-adapter.ps1 (for
        /create-pr) became a second real consumer needing it - Add-TfsWorkItemAttachment itself
        never needed the repo name, since work items are project-scoped, not repository-scoped.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot
    )

    $url = & git -C $RepoRoot remote get-url origin 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "tfs-workitem-adapter: could not read the 'origin' remote in '$RepoRoot': $url"
    }
    $url = "$url".Trim()

    if ($url -notmatch '^(?<collection>https?://[^/]+/[^/]+)/(?<project>[^/]+)/_git/(?<repo>[^/]+?)/?$') {
        throw "tfs-workitem-adapter: '$url' doesn't look like an on-prem TFS/Azure DevOps Server Git remote (expected https://<server>/<collection>/<project>/_git/<repo>)."
    }

    # Captured into plain variables immediately, before any further -match/-notmatch: PowerShell's
    # automatic $Matches variable is reassigned by ANY subsequent -match/-notmatch operation (even
    # one testing an unrelated string), so reading $Matches['...'] again after the scheme check
    # below would silently read the wrong (or empty) value - found via a real test failure, not a
    # hypothetical.
    $collectionUrl = $Matches['collection']
    $project = $Matches['project']
    $repo = $Matches['repo']

    if ($collectionUrl -notmatch '^https://') {
        throw "tfs-workitem-adapter: origin remote '$url' uses 'http', not 'https' - refusing to send a PAT over an unencrypted connection. Use an https:// remote."
    }

    return [pscustomobject]@{
        CollectionUrl  = $collectionUrl
        Project        = [Uri]::UnescapeDataString($project)
        RepositoryName = [Uri]::UnescapeDataString(($repo -replace '\.git$', ''))
    }
}

function Invoke-TfsAttachmentUpload {
    <#
        Thin wrapper around the attachment-upload call, kept as its own function so tests can Mock
        exactly this call independently of Invoke-TfsWorkItemPatch.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter(Mandatory)]
        [hashtable]$Headers,

        [Parameter(Mandatory)]
        [string]$FilePath
    )

    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Post `
        -InFile $FilePath -ContentType 'application/octet-stream'
}

function Invoke-TfsWorkItemPatch {
    <#
        Thin wrapper around the work-item PATCH call, kept as its own function so tests can Mock
        exactly this call independently of Invoke-TfsAttachmentUpload.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter(Mandatory)]
        [hashtable]$Headers,

        [Parameter(Mandatory)]
        [string]$Body
    )

    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Patch `
        -Body $Body -ContentType 'application/json-patch+json'
}

function Add-TfsWorkItemAttachment {
    <#
        Uploads $FilePath to the work item REST API and links it to $WorkItemId as an AttachedFile
        relation. Two calls, per the API's own design: an attachment is uploaded as an anonymous
        blob first, then linked to a specific work item by URL in a second, separate call.

        Authentication via New-TfsBasicAuthHeader (common/tfs-auth.ps1) - Azure DevOps' documented
        PAT convention (empty username, PAT as password), the reverse of Sonar's token-as-username
        convention used elsewhere in this toolkit (engine/quality-gate-check.ps1's
        Invoke-SonarApiRequest), so don't copy that pattern here.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$CollectionUrl,

        [Parameter(Mandatory)]
        [string]$Project,

        [Parameter(Mandatory)]
        [int]$WorkItemId,

        [Parameter(Mandatory)]
        [string]$FilePath,

        # Defaults to the environment variable, read here inside the already-running process,
        # rather than requiring a caller (a Claude Code Skill's own command text) to embed
        # "-PatToken $env:SONARTOOLKIT_TFS_PAT" as a literal substring of a command line - that
        # gets interpolated to the real secret value by the invoking shell before this script ever
        # runs, exposing it in the OS process list. See docs/Architecture-Specification.md's
        # security notes for the confirmed reasoning. Deliberately not [Parameter(Mandatory)]
        # any more - a default expression and Mandatory cannot coexist - so the explicit check
        # below is what actually enforces "a real token was available."
        [string]$PatToken = $env:SONARTOOLKIT_TFS_PAT,

        [string]$ApiVersion = '5.0',

        # Shown next to the file in the work item's Attachments tab.
        [string]$Comment = 'SonarToolkit quality review report'
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "tfs-workitem-adapter: report file not found at '$FilePath'."
    }
    if (-not $PatToken) {
        throw 'tfs-workitem-adapter: no PAT token available (pass -PatToken, or set SONARTOOLKIT_TFS_PAT).'
    }

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $fileName = Split-Path -Leaf $FilePath

    $uploadUri = "$CollectionUrl/_apis/wit/attachments?fileName=$([Uri]::EscapeDataString($fileName))&api-version=$ApiVersion"
    $attachment = Invoke-TfsAttachmentUpload -Uri $uploadUri -Headers $headers -FilePath $FilePath

    # -InputObject (not the pipeline) keeps this a genuine one-element JSON array: piping a
    # single-element PowerShell array through ConvertTo-Json collapses it back to a bare object,
    # but the work item API rejects a JSON patch document that isn't an array.
    $patchDocument = @(
        @{
            op    = 'add'
            path  = '/relations/-'
            value = @{
                rel        = 'AttachedFile'
                url        = $attachment.url
                attributes = @{ comment = $Comment }
            }
        }
    )
    $patchBody = ConvertTo-Json -InputObject $patchDocument -Depth 6

    $workItemUri = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_apis/wit/workitems/$WorkItemId`?api-version=$ApiVersion"
    $workItem = Invoke-TfsWorkItemPatch -Uri $workItemUri -Headers $headers -Body $patchBody

    return [pscustomobject]@{
        WorkItemId  = $WorkItemId
        WorkItemUrl = $workItem._links.html.href
    }
}
