<#
    scm-adapters/tfs-pullrequest-adapter.ps1

    Creates a Pull Request on an on-prem TFS/Azure DevOps Server and attaches a file to it, for
    `/create-pr`. Pull Requests are a Git-only concept - there is no TFVC equivalent, and none is
    needed here (TFVC's own review/check-in path is handled entirely separately).

    Authentication via New-TfsBasicAuthHeader (common/tfs-auth.ps1) - the same PAT convention
    scm-adapters/tfs-workitem-adapter.ps1 already uses (empty username, PAT as password).

    Every endpoint here is confirmed, from the official Azure DevOps REST API reference, to exist
    under the on-prem "azure-devops-server-rest-*" API versions, not just cloud dev.azure.com.
#>

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '../common/tfs-auth.ps1')

function New-TfsPullRequest {
    <#
        Creates a pull request. $RepositoryName is passed directly as the API's own
        "repositoryId" path segment - Azure DevOps' Git Repositories API accepts either a
        repository's GUID or its plain name interchangeably there, so no separate name-to-GUID
        lookup call is needed first.

        Returns the new PR's id and a constructed web URL (the create-PR response's own `_links`
        do not include a browsable "html" link the way a work item's response does - only REST
        endpoint URLs - so the standard on-prem web URL shape is built directly instead:
        <collection>/<project>/_git/<repo>/pullrequest/<id>).
    #>
    param(
        [Parameter(Mandatory)]
        [string]$CollectionUrl,

        [Parameter(Mandatory)]
        [string]$Project,

        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [string]$SourceBranch,

        [Parameter(Mandatory)]
        [string]$TargetBranch,

        [Parameter(Mandatory)]
        [string]$Title,

        [string]$Description,

        # Defaults to the environment variable, read here inside the already-running process - see
        # Add-TfsWorkItemAttachment's identical note (tfs-workitem-adapter.ps1) for why this isn't
        # [Parameter(Mandatory)] any more, and why a caller must never embed
        # "-PatToken $env:SONARTOOLKIT_TFS_PAT" as literal text in an invoked command line.
        [string]$PatToken = $env:SONARTOOLKIT_TFS_PAT,

        [string]$ApiVersion = '5.0'
    )

    if (-not $PatToken) {
        throw 'tfs-pullrequest-adapter: no PAT token available (pass -PatToken, or set SONARTOOLKIT_TFS_PAT).'
    }

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $uri = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_apis/git/repositories/$([Uri]::EscapeDataString($RepositoryName))/pullrequests?api-version=$ApiVersion"

    $body = ConvertTo-Json -InputObject @{
        sourceRefName = "refs/heads/$SourceBranch"
        targetRefName = "refs/heads/$TargetBranch"
        title         = $Title
        description   = if ($Description) { $Description } else { '' }
    }

    $pr = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body -ContentType 'application/json'

    $webUrl = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_git/$([Uri]::EscapeDataString($RepositoryName))/pullrequest/$($pr.pullRequestId)"

    return [pscustomobject]@{
        PullRequestId = $pr.pullRequestId
        SourceRefName = $pr.sourceRefName
        TargetRefName = $pr.targetRefName
        WebUrl        = $webUrl
    }
}

function Get-TfsPullRequest {
    <#
        Retrieves an existing pull request by id - the source/target branches, title, and status
        `/quality-review pr <id>` needs to review a PR someone else already opened, without
        requiring the developer to have that branch checked out locally. Confirmed, from the
        official Azure DevOps REST API reference, to exist under the on-prem
        "azure-devops-server-rest-*" API versions, same standard as every other endpoint here.

        SourceBranch/TargetBranch strip the API's "refs/heads/" prefix, since every other Git
        branch name this toolkit passes around (git commands, -BaseBranch) is a plain name, not a
        full ref path - New-TfsPullRequest above adds that same prefix back on the way in.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$CollectionUrl,

        [Parameter(Mandatory)]
        [string]$Project,

        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [int]$PullRequestId,

        # See New-TfsPullRequest's identical note above.
        [string]$PatToken = $env:SONARTOOLKIT_TFS_PAT,

        [string]$ApiVersion = '5.0'
    )

    if (-not $PatToken) {
        throw 'tfs-pullrequest-adapter: no PAT token available (pass -PatToken, or set SONARTOOLKIT_TFS_PAT).'
    }

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $uri = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_apis/git/repositories/$([Uri]::EscapeDataString($RepositoryName))/pullrequests/$PullRequestId`?api-version=$ApiVersion"

    $pr = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get

    $webUrl = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_git/$([Uri]::EscapeDataString($RepositoryName))/pullrequest/$($pr.pullRequestId)"

    return [pscustomobject]@{
        PullRequestId = $pr.pullRequestId
        SourceBranch  = ($pr.sourceRefName -replace '^refs/heads/', '')
        TargetBranch  = ($pr.targetRefName -replace '^refs/heads/', '')
        Title         = $pr.title
        Status        = $pr.status
        WebUrl        = $webUrl
    }
}

function Add-TfsPullRequestComment {
    <#
        Posts one inline comment thread on a Pull Request, anchored to a specific file and line -
        the "Automated Instant Code Review with Inline Comments" use case: a finding rendered as a
        real comment thread in the PR's own diff view, the same place a human reviewer's comment
        would appear, rather than only inside the attached report file
        (Add-TfsPullRequestAttachment, above). Confirmed, from the official Azure DevOps REST API
        reference, to exist under the on-prem "azure-devops-server-rest-*" API versions, same
        standard as every other endpoint here - this is a genuinely different API
        (Pull Request Threads) from the Attachments one, not a variant of it.

        $Content is the caller's job to prefix with a clear "this is an automated review" marker -
        this function does not add one itself, since the exact wording is a product decision, not
        a REST-call concern. Posted under whichever identity $PatToken belongs to (there is no
        separate "bot" identity available here) - the caller is responsible for making the
        automated origin obvious in the text itself for that reason.

        $Line anchors the comment to that line on the "right" (new/current) side of the diff only -
        this toolkit has no reason to comment against the pre-change side. The exact character
        span highlighted (columns 1 through 200) is a deliberate simplification: Azure DevOps only
        needs a position on the right line to render the thread inline; the precise highlighted
        span is cosmetic, not functional.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$CollectionUrl,

        [Parameter(Mandatory)]
        [string]$Project,

        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [int]$PullRequestId,

        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(Mandatory)]
        [int]$Line,

        [Parameter(Mandatory)]
        [string]$Content,

        # See New-TfsPullRequest's identical note above.
        [string]$PatToken = $env:SONARTOOLKIT_TFS_PAT,

        [string]$ApiVersion = '5.0'
    )

    if (-not $PatToken) {
        throw 'tfs-pullrequest-adapter: no PAT token available (pass -PatToken, or set SONARTOOLKIT_TFS_PAT).'
    }

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $uri = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_apis/git/repositories/$([Uri]::EscapeDataString($RepositoryName))/pullRequests/$PullRequestId/threads?api-version=$ApiVersion"

    $normalizedFilePath = '/' + ($FilePath -replace '^/', '')
    $body = ConvertTo-Json -Depth 6 -InputObject @{
        comments     = @(
            @{ parentCommentId = 0; content = $Content; commentType = 1 }
        )
        status       = 1
        threadContext = @{
            filePath       = $normalizedFilePath
            rightFileStart = @{ line = $Line; offset = 1 }
            rightFileEnd   = @{ line = $Line; offset = 200 }
        }
    }

    $thread = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body -ContentType 'application/json'

    return [pscustomobject]@{
        ThreadId = $thread.id
        FilePath = $FilePath
        Line     = $Line
    }
}

function Add-TfsPullRequestAttachment {
    <#
        Attaches a file to a pull request - a single call, unlike Add-TfsWorkItemAttachment's
        upload-then-link pattern (tfs-workitem-adapter.ps1). Pull Request Attachments and Work Item
        Attachments are unrelated Azure DevOps APIs with genuinely different designs; this
        function's simplicity is a real difference, not a shortcut taken here.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$CollectionUrl,

        [Parameter(Mandatory)]
        [string]$Project,

        [Parameter(Mandatory)]
        [string]$RepositoryName,

        [Parameter(Mandatory)]
        [int]$PullRequestId,

        [Parameter(Mandatory)]
        [string]$FilePath,

        # See New-TfsPullRequest's identical note above.
        [string]$PatToken = $env:SONARTOOLKIT_TFS_PAT,

        [string]$ApiVersion = '5.0'
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "tfs-pullrequest-adapter: report file not found at '$FilePath'."
    }
    if (-not $PatToken) {
        throw 'tfs-pullrequest-adapter: no PAT token available (pass -PatToken, or set SONARTOOLKIT_TFS_PAT).'
    }

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $fileName = Split-Path -Leaf $FilePath
    $uri = "$CollectionUrl/$([Uri]::EscapeDataString($Project))/_apis/git/repositories/$([Uri]::EscapeDataString($RepositoryName))/pullRequests/$PullRequestId/attachments/$([Uri]::EscapeDataString($fileName))?api-version=$ApiVersion"

    $attachment = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -InFile $FilePath -ContentType 'application/octet-stream'

    return [pscustomobject]@{
        AttachmentId = $attachment.id
        Url          = $attachment.url
    }
}
