<#
    scripts/Release-ReviewLock.ps1

    Ends a review run: drops the PR / changeset review lock that Get-ReviewTarget.ps1 took for this
    run's OutDir, so the next review of the same target can start. It removes the lock only if this
    run holds it, and does nothing if the lock is already gone.

    Usage:
        Release-ReviewLock.ps1 -OutDir <dir>
#>
param(
    [Parameter(Mandatory)][string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '../common/review-lock.ps1')

Exit-ReviewLock -OutDir $OutDir
Write-Output "Review lock released for $OutDir"
