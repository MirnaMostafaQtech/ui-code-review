<#
    common/review-lock.ps1

    One review at a time per PR / changeset. Two runs on the same target used to share one output
    folder and overwrite each other's replies; now every run has its own folder, and this lock stops
    a second run from starting while the first is still going.

    The lock is a file next to the run folders, <root>/<kind>-<id>.lock, holding the run's OutDir and
    start time. It is taken by Get-ReviewTarget.ps1 and dropped by Release-ReviewLock.ps1 at the end
    of the review. A run that dies without releasing leaves a stale lock: it is taken over after
    $ReviewLockTtlMinutes, or at once with -Force.

    Consumers: scripts/Get-ReviewTarget.ps1, scripts/Release-ReviewLock.ps1.
#>

Set-StrictMode -Version Latest

$ReviewLockTtlMinutes = 120

function Get-ReviewLockPath([string]$Root, [string]$Kind, [int]$Id) {
    return Join-Path $Root "$Kind-$Id.lock"
}

function Enter-ReviewLock {
    <#
        Takes the lock for this target or throws, naming the run that holds it. Creating the file
        with CreateNew is atomic, so two runs starting together can't both get it.
    #>
    param(
        [Parameter(Mandatory)][string]$Kind,
        [Parameter(Mandatory)][int]$Id,
        [Parameter(Mandatory)][string]$OutDir,
        [switch]$Force
    )

    $root = Split-Path -Parent $OutDir
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $lockPath = Get-ReviewLockPath $root $Kind $Id
    $body = [Text.Encoding]::UTF8.GetBytes((@{
        kind    = $Kind
        id      = $Id
        outDir  = $OutDir
        started = (Get-Date).ToString('o')
    } | ConvertTo-Json))

    for ($attempt = 0; $attempt -lt 2; $attempt++) {
        try {
            $stream = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try { $stream.Write($body, 0, $body.Length) } finally { $stream.Dispose() }
            return
        }
        catch [IO.IOException] {
            if ($attempt -gt 0 -or -not (Test-Path -LiteralPath $lockPath)) { throw }
        }

        # Someone holds it: take over only if it is stale or -Force was given.
        $holder = $null
        try { $holder = [IO.File]::ReadAllText($lockPath, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { }
        $started = if ($holder) { [DateTime]::Parse($holder.started) } else { (Get-Item -LiteralPath $lockPath).LastWriteTime }
        $ageMinutes = [int]((Get-Date) - $started).TotalMinutes
        if (-not $Force -and $ageMinutes -lt $ReviewLockTtlMinutes) {
            $where = if ($holder) { " Its folder: $($holder.outDir)." } else { '' }
            throw "REVIEW-LOCKED: another review of $Kind $Id started $ageMinutes minute(s) ago ($($started.ToString('HH:mm'))) and is still running.$where Wait for it to finish, or run again with -Force if that review is no longer running."
        }
        Remove-Item -LiteralPath $lockPath -Force
    }
}

function Exit-ReviewLock {
    <#
        Drops the lock, but only if this run (OutDir) holds it: a run that was taken over must not
        remove the lock of the run that replaced it.
    #>
    param([Parameter(Mandatory)][string]$OutDir)

    $root = Split-Path -Parent $OutDir
    if (-not (Test-Path -LiteralPath $root)) { return }
    $full = [IO.Path]::GetFullPath($OutDir)
    foreach ($lock in @(Get-ChildItem -LiteralPath $root -Filter '*.lock' -File)) {
        $holder = $null
        try { $holder = [IO.File]::ReadAllText($lock.FullName, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { continue }
        if ($holder -and [IO.Path]::GetFullPath("$($holder.outDir)") -eq $full) {
            Remove-Item -LiteralPath $lock.FullName -Force
        }
    }
}
