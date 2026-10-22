<#
    scripts/Get-ReviewTarget.ps1

    Turns a Git Pull Request or a TFVC changeset into one unified review target, so the review
    steps after it are identical for both sources:

        <OutDir>/target.json      { kind, id, title, webUrl, collectionUrl, project, repository,
                                    files: [ { path, changeType, contentFile, changedLines: [[start,end]...] } ] }
        <OutDir>/files/...        the full new content of every UI file in scope (UTF-8)
        target.json translations  [ { path, contentFile } ] every translation file at the reviewed
                                  version, read-only context for the I18N reviewer
        <OutDir>/translations/... their content
        target.json assets        [ { path, sizeBytes } ] every image, font and video file the
                                  review adds or changes, for the performance reviewer

    Only UI files (see $UiFilePattern) and translation files (see $TranslationPattern) are kept;
    minified, generated and test files are skipped. Each entry in files has role 'ui' or 'translation'.
    changedLines are 1-based, inclusive ranges on the NEW side - the only lines findings may anchor to.

    Usage:
        Get-ReviewTarget.ps1 -Kind pr        -Id 123   -RepoRoot D:\repo           -OutDir <dir>
        Get-ReviewTarget.ps1 -Kind changeset -Id 31554 -CollectionUrl https://tfs25.alqemam.com/qCollection -OutDir <dir>

    OutDir is a new folder per run (<root>/<kind>-<id>-<yyyyMMdd-HHmmss>). The script takes the
    target's review lock first (common/review-lock.ps1) and fails with REVIEW-LOCKED if another run
    holds it; -Force takes over a lock whose run is no longer going. The lock is released here on
    failure or when no UI file changed, otherwise by Release-ReviewLock.ps1 at the end of the review.
    Run folders of the same target older than 7 days are deleted.

    PAT: $env:SONARTOOLKIT_TFS_PAT (process or user scope) - same variable as q-ai-quality-review.
#>
param(
    [Parameter(Mandatory)][ValidateSet('pr', 'changeset')][string]$Kind,
    [Parameter(Mandatory)][int]$Id,
    [Parameter(Mandatory)][string]$OutDir,
    [string]$RepoRoot = (Get-Location).Path,
    [string]$CollectionUrl,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '../common/tfs-auth.ps1')
. (Join-Path $PSScriptRoot '../scm-adapters/tfs-workitem-adapter.ps1')
. (Join-Path $PSScriptRoot '../scm-adapters/tfs-pullrequest-adapter.ps1')
. (Join-Path $PSScriptRoot '../scm-adapters/tfvc-adapter.ps1')
. (Join-Path $PSScriptRoot '../common/review-lock.ps1')

$UiFilePattern = '\.(html|scss|css|ts|cshtml|js)$'
# ngx-translate style JSON under a translations folder, and .NET resource files.
$TranslationPattern = '((^|/)(i18n|l10n|locale|locales|lang|langs|translations)/.+\.json$)|(\.resx$)'
$MaxTranslationFiles = 80
$AssetPattern = '\.(png|jpe?g|gif|bmp|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|ogg)$'
$SkipPattern = '(\.min\.(css|js)$)|(\.spec\.ts$)|(\.d\.ts$)|(/node_modules/)|(/dist/)|(/bin/)|(/obj/)'

$pat = $env:SONARTOOLKIT_TFS_PAT
if (-not $pat) { $pat = [Environment]::GetEnvironmentVariable('SONARTOOLKIT_TFS_PAT', 'User') }
if (-not $pat) { throw 'Get-ReviewTarget: SONARTOOLKIT_TFS_PAT is not set.' }

# A trap covers the whole script, so it releases only once this run holds the lock.
$lockHeld = $false
trap { if ($lockHeld) { Exit-ReviewLock -OutDir $OutDir }; break }

if (Test-Path -LiteralPath $OutDir) { throw "Get-ReviewTarget: $OutDir already exists; every run needs a new folder." }
Enter-ReviewLock -Kind $Kind -Id $Id -OutDir $OutDir -Force:$Force
$lockHeld = $true

$runRoot = Split-Path -Parent $OutDir
foreach ($old in @(Get-ChildItem -LiteralPath $runRoot -Directory -Filter "$Kind-$Id-*")) {
    if ($old.LastWriteTime -lt (Get-Date).AddDays(-7)) { Remove-Item -LiteralPath $old.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$filesDir = Join-Path $OutDir 'files'
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
$tempDir = Join-Path $OutDir '.tmp'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

function Test-UiFile([string]$Path) {
    $p = $Path -replace '\\', '/'
    return ($p -match $UiFilePattern) -and ($p -notmatch $SkipPattern)
}

function Test-TranslationFile([string]$Path) {
    $p = $Path -replace '\\', '/'
    return ($p -match $TranslationPattern) -and ($p -notmatch $SkipPattern)
}

function Get-FileRole([string]$Path) {
    if (Test-UiFile $Path) { return 'ui' }
    if (Test-TranslationFile $Path) { return 'translation' }
    return $null
}

function Get-SafeFileName([string]$Path) {
    return ($Path.TrimStart('$', '/') -replace '[\\/:*?"<>|]', '_')
}

function ConvertFrom-Utf8Bytes([byte[]]$Bytes) {
    if ($null -eq $Bytes) { return '' }
    $text = [Text.Encoding]::UTF8.GetString($Bytes)
    return $text.TrimStart([char]0xFEFF)
}

# Parses `git diff -U0` output into new-side line ranges.
function Get-ChangedLineRanges([string[]]$DiffLines) {
    $ranges = @()
    foreach ($line in $DiffLines) {
        if ($line -match '^@@ -\d+(?:,\d+)? \+(?<start>\d+)(?:,(?<count>\d+))? @@') {
            $start = [int]$Matches['start']
            $count = if ($Matches.ContainsKey('count') -and $Matches['count'] -ne '') { [int]$Matches['count'] } else { 1 }
            if ($count -gt 0) { $ranges += , @($start, ($start + $count - 1)) }
        }
    }
    return , $ranges
}

function Get-LineRangesBetween([string]$OldText, [string]$NewText) {
    $oldFile = Join-Path $tempDir 'old.txt'
    $newFile = Join-Path $tempDir 'new.txt'
    [IO.File]::WriteAllText($oldFile, $OldText, $utf8NoBom)
    [IO.File]::WriteAllText($newFile, $NewText, $utf8NoBom)
    $diff = & git -c core.autocrlf=false diff --no-index --no-color -U0 --ignore-cr-at-eol -- $oldFile $newFile 2>$null
    return Get-ChangedLineRanges -DiffLines @($diff)
}

function Get-WholeFileRange([string]$Text) {
    $count = ($Text -split "`n").Count
    return , @(, @(1, [Math]::Max(1, $count)))
}

function Invoke-TfsBytes([string]$Uri) {
    $headers = New-TfsBasicAuthHeader -PatToken $pat
    $response = Invoke-WebRequest -Uri $Uri -Headers $headers -UseBasicParsing
    return $response.RawContentStream.ToArray()
}

$files = @()
$assets = @()

function Test-AssetFile([string]$Path) {
    $p = $Path -replace '\\', '/'
    return ($p -match $AssetPattern) -and ($p -notmatch $SkipPattern)
}

if ($Kind -eq 'changeset') {
    if (-not $CollectionUrl) { throw 'Get-ReviewTarget: -CollectionUrl is required for -Kind changeset (e.g. https://tfs25.alqemam.com/qCollection).' }
    $CollectionUrl = $CollectionUrl.TrimEnd('/')
    if ($CollectionUrl -notmatch '^https://') { throw 'Get-ReviewTarget: refusing to send the PAT over http; use an https:// collection URL.' }

    $headers = New-TfsBasicAuthHeader -PatToken $pat
    $cs = Invoke-RestMethod -Uri "$CollectionUrl/_apis/tfvc/changesets/$Id`?api-version=5.0" -Headers $headers
    $changes = Get-TfvcChangesetChanges -CollectionUrl $CollectionUrl -ChangesetId $Id -PatToken $pat
    $workItems = @((Invoke-RestMethod -Uri "$CollectionUrl/_apis/tfvc/changesets/$Id/workItems?api-version=5.0" -Headers $headers).value | ForEach-Object { $_.id })

    $project = $null
    foreach ($change in $changes) {
        if (-not $project -and $change.ServerPath -match '^\$/(?<p>[^/]+)') { $project = $Matches['p'] }
        if ($change.ChangeType -match 'delete') { continue }
        if (Test-AssetFile $change.ServerPath) {
            $encoded = [Uri]::EscapeDataString($change.ServerPath)
            $bytes = Invoke-TfsBytes "$CollectionUrl/_apis/tfvc/items?path=$encoded&versionDescriptor.versionType=Changeset&versionDescriptor.version=$Id&includeContent=true&api-version=5.0"
            $assets += [pscustomobject]@{ path = $change.ServerPath; sizeBytes = $bytes.Length }
            continue
        }
        $role = Get-FileRole $change.ServerPath
        if (-not $role) { continue }

        $encoded = [Uri]::EscapeDataString($change.ServerPath)
        $itemUri = "$CollectionUrl/_apis/tfvc/items?path=$encoded&versionDescriptor.versionType=Changeset&includeContent=true&api-version=5.0"
        $newText = ConvertFrom-Utf8Bytes (Invoke-TfsBytes "$itemUri&versionDescriptor.version=$Id")

        $isNew = $change.ChangeType -match '\badd\b|branch|undelete'
        if ($isNew) {
            $ranges = Get-WholeFileRange $newText
        }
        else {
            $oldText = ConvertFrom-Utf8Bytes (Invoke-TfsBytes "$itemUri&versionDescriptor.version=$($Id - 1)")
            $ranges = Get-LineRangesBetween -OldText $oldText -NewText $newText
        }
        if ($ranges.Count -eq 0) { continue }

        $contentFile = Join-Path $filesDir (Get-SafeFileName $change.ServerPath)
        [IO.File]::WriteAllText($contentFile, $newText, $utf8NoBom)
        $files += [pscustomobject]@{ path = $change.ServerPath; role = $role; changeType = $change.ChangeType; contentFile = $contentFile; changedLines = $ranges }
    }

    # Translation files at this changeset: search upward from the folder the changed files share,
    # stopping at the first folder that has any, and never above $/<project>/<branch>.
    $translationPaths = @()
    if (@($files).Count -gt 0) {
        $dirs =@($files | ForEach-Object { , @(($_.path -split '/') | Select-Object -SkipLast 1) })
        $common = @()
        for ($i = 0; $i -lt $dirs[0].Count; $i++) {
            $segment = $dirs[0][$i]
            if (@($dirs | Where-Object { $_.Count -gt $i -and $_[$i] -eq $segment }).Count -ne $dirs.Count) { break }
            $common += $segment
        }
        for ($depth = $common.Count; $depth -ge 3 -and $translationPaths.Count -eq 0; $depth--) {
            $scope = ($common[0..($depth - 1)]) -join '/'
            $listUri = "$CollectionUrl/_apis/tfvc/items?scopePath=$([Uri]::EscapeDataString($scope))&recursionLevel=Full&versionDescriptor.versionType=Changeset&versionDescriptor.version=$Id&api-version=5.0"
            $items = @((Invoke-RestMethod -Uri $listUri -Headers $headers).value)
            $translationPaths = @($items | Where-Object { -not $_.isFolder -and (Test-TranslationFile $_.path) } | ForEach-Object { $_.path })
        }
    }
    $readTranslation = {
        param($path)
        $encoded = [Uri]::EscapeDataString($path)
        return ConvertFrom-Utf8Bytes (Invoke-TfsBytes "$CollectionUrl/_apis/tfvc/items?path=$encoded&versionDescriptor.versionType=Changeset&versionDescriptor.version=$Id&includeContent=true&api-version=5.0")
    }

    $target = [ordered]@{
        kind          = 'changeset'
        id            = $Id
        title         = $cs.comment
        author        = $cs.author.displayName
        webUrl        = "$CollectionUrl/$([Uri]::EscapeDataString("$project"))/_versionControl/changeset/$Id"
        collectionUrl = $CollectionUrl
        project       = $project
        repository    = $null
        workItems     = $workItems
        files         = $files
    }
}
else {
    $remote = Get-TfsRemoteInfo -RepoRoot $RepoRoot
    $pr = Get-TfsPullRequest -CollectionUrl $remote.CollectionUrl -Project $remote.Project -RepositoryName $remote.RepositoryName -PullRequestId $Id -PatToken $pat

    # Use the PR's own commits, not branch names: they still exist after the PR is completed or its
    # source branch is deleted, and the target commit is the one the PR was reviewed against.
    $headers = New-TfsBasicAuthHeader -PatToken $pat
    $prUri = "$($remote.CollectionUrl)/$([Uri]::EscapeDataString($remote.Project))/_apis/git/repositories/$([Uri]::EscapeDataString($remote.RepositoryName))/pullrequests/$Id`?api-version=5.0"
    $prRaw = Invoke-RestMethod -Uri $prUri -Headers $headers
    $head = "$($prRaw.lastMergeSourceCommit.commitId)"
    $targetCommit = "$($prRaw.lastMergeTargetCommit.commitId)"

    & git -C $RepoRoot fetch --quiet origin $head $targetCommit 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Server refused fetching by commit id: fetch the branches that still exist instead.
        & git -C $RepoRoot fetch --quiet origin $pr.TargetBranch 2>$null
        & git -C $RepoRoot fetch --quiet origin $pr.SourceBranch 2>$null
    }
    foreach ($commit in @($head, $targetCommit)) {
        & git -C $RepoRoot cat-file -e "$commit^{commit}" 2>$null
        if ($LASTEXITCODE -ne 0) { throw "Get-ReviewTarget: commit $commit of PR $Id is not available locally after fetch." }
    }
    $base = (& git -C $RepoRoot merge-base $targetCommit $head).Trim()

    $nameStatus = & git -C $RepoRoot -c core.quotepath=false diff --name-status -M --no-color $base $head
    foreach ($entry in @($nameStatus)) {
        $parts = $entry -split "`t"
        $status = $parts[0]
        $path = $parts[-1]
        if ($status -like 'D*') { continue }
        if (Test-AssetFile $path) {
            $size = & git -C $RepoRoot cat-file -s "$($head):$path" 2>$null
            if ($LASTEXITCODE -eq 0) { $assets += [pscustomobject]@{ path = $path; sizeBytes = [long]"$size".Trim() } }
            continue
        }
        $role = Get-FileRole $path
        if (-not $role) { continue }

        $contentFile = Join-Path $filesDir (Get-SafeFileName $path)
        # cmd redirection keeps git's raw bytes (PowerShell 5.1 pipes would re-encode them).
        & cmd /c "git -C `"$RepoRoot`" show `"$($head):$path`" > `"$contentFile`""
        if ($LASTEXITCODE -ne 0) { continue }

        if ($status -like 'A*') {
            $ranges = Get-WholeFileRange ([IO.File]::ReadAllText($contentFile, [Text.Encoding]::UTF8))
        }
        else {
            $diff = & git -C $RepoRoot -c core.quotepath=false diff --no-color -U0 -M --ignore-cr-at-eol $base $head -- $path
            $ranges = Get-ChangedLineRanges -DiffLines @($diff)
        }
        if ($ranges.Count -eq 0) { continue }

        $files += [pscustomobject]@{ path = $path; role = $role; changeType = $status; contentFile = $contentFile; changedLines = $ranges }
    }

    $translationPaths = @(& git -C $RepoRoot -c core.quotepath=false ls-tree -r --name-only $head | Where-Object { Test-TranslationFile $_ })
    $readTranslation = {
        param($path)
        $tmp = Join-Path $tempDir 'translation.bin'
        & cmd /c "git -C `"$RepoRoot`" show `"$($head):$path`" > `"$tmp`""
        return ConvertFrom-Utf8Bytes ([IO.File]::ReadAllBytes($tmp))
    }

    $target = [ordered]@{
        kind          = 'pr'
        id            = $Id
        title         = $pr.Title
        author        = $null
        webUrl        = $pr.WebUrl
        collectionUrl = $remote.CollectionUrl
        project       = $remote.Project
        repository    = $remote.RepositoryName
        sourceBranch  = $pr.SourceBranch
        targetBranch  = $pr.TargetBranch
        baseCommit    = $base
        headCommit    = $head
        files         = $files
    }
}

# Every translation file at the reviewed version, so the I18N reviewer can check that a key used on a
# changed line exists in each language.
$translations = @()
if (@($files).Count -gt 0 -and $translationPaths.Count -gt 0) {
    if ($translationPaths.Count -gt $MaxTranslationFiles) {
        Write-Warning "Get-ReviewTarget: $($translationPaths.Count) translation files found; exporting the first $MaxTranslationFiles."
        $translationPaths = @($translationPaths | Select-Object -First $MaxTranslationFiles)
    }
    $translationsDir = Join-Path $OutDir 'translations'
    New-Item -ItemType Directory -Force -Path $translationsDir | Out-Null
    foreach ($path in $translationPaths) {
        $contentFile = Join-Path $translationsDir (Get-SafeFileName $path)
        [IO.File]::WriteAllText($contentFile, (& $readTranslation $path), $utf8NoBom)
        $translations += [pscustomobject]@{ path = $path; contentFile = $contentFile }
    }
}
$target['translations'] = $translations
$target['assets'] = @($assets)

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
$targetFile = Join-Path $OutDir 'target.json'
[IO.File]::WriteAllText($targetFile, ($target | ConvertTo-Json -Depth 6), $utf8NoBom)
# Nothing to review means the review ends here, so it doesn't keep the lock.
if (@($files).Count -eq 0) { Exit-ReviewLock -OutDir $OutDir }
Write-Output "Review target: $($target.kind) $Id - $(@($files).Count) UI file(s) in scope, $($translations.Count) translation file(s) for context -> $targetFile"
