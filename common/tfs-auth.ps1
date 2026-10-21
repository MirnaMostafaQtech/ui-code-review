<#
    common/tfs-auth.ps1

    Shared TFS/Azure DevOps Server authentication helper. Extracted here once a second real
    consumer existed (scm-adapters/tfs-pullrequest-adapter.ps1, alongside the original
    scm-adapters/tfs-workitem-adapter.ps1) - per Architecture Specification §4/§6, common/ holds
    logic only once it has two or more real consumers, not in anticipation of one.

    Named deliberately as "Tfs", not generically "Basic auth": this convention (empty username,
    Personal Access Token as password) is specific to TFS/Azure DevOps Server's own documented PAT
    scheme, and is the exact reverse of SonarQube's convention (token as username, empty password)
    used elsewhere in this toolkit (engine/quality-gate-check.ps1's Invoke-SonarApiRequest) - the
    two must never be confused or copy-pasted between each other.
#>

Set-StrictMode -Version Latest

function New-TfsBasicAuthHeader {
    <#
        Builds the Authorization header value for TFS/Azure DevOps Server's PAT convention: HTTP
        Basic auth with an empty username and the PAT as the password.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$PatToken
    )

    $basicAuthValue = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$PatToken"))
    return @{ Authorization = "Basic $basicAuthValue" }
}
