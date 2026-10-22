<#
    scm-adapters/tfvc-adapter.ps1

    Answers "what changed" for a TFVC workspace (Architecture Specification §6, §8). TFVC has no
    push-based diff the way Git does: there is no local pre-check-in hook, and no two-revision
    range to compare. "What changed" for TFVC is the workspace's pending changes — files
    currently checked out, added, deleted, or renamed locally but not yet checked in — found via
    `tf status`.

    Per Architecture Specification §6, this module must not contain scanning logic or Quality
    Gate logic — only change detection.
#>

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '../common/tfs-auth.ps1')

function Find-TfCliPath {
    <#
        Locates tf.exe, the TFVC command-line client bundled with Visual Studio's Team Explorer /
        "Team Foundation Version Control" component — not guaranteed to be on PATH even when
        installed. Prefers vswhere.exe (consistent with Find-MSBuildExePath in
        scanners/run-msbuild-family.ps1), falling back to a plain PATH lookup. Returns $null if
        neither finds it.
    #>
    $vswherePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (Test-Path -LiteralPath $vswherePath) {
        $vsInstallPath = & $vswherePath -latest -products * -property installationPath 2>$null |
            Select-Object -First 1
        if ($vsInstallPath) {
            $candidatePath = Join-Path $vsInstallPath `
                'Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\TF.exe'
            if (Test-Path -LiteralPath $candidatePath) {
                return $candidatePath
            }
        }
    }

    $onPath = Get-Command 'tf.exe' -ErrorAction SilentlyContinue
    if ($onPath) {
        return $onPath.Source
    }

    return $null
}

function Test-TfCliInstalled {
    <#
        Checks whether tf.exe can be located. A runtime prerequisite check, not something
        install/ sets up — see Test-DotnetSonarScannerInstalled in run-msbuild-family.ps1 for why
        that responsibility lives here.
    #>
    return [bool](Find-TfCliPath)
}

function ConvertTo-RepoRelativePath {
    <#
        tf.exe reports pending-change local-item paths as absolute Windows paths. Every other
        adapter/scanner in this toolkit works in repo-relative paths (contracts/ScanScope.md), so
        this strips $RepoRoot as a prefix. Case-insensitive, since Windows paths are.
    #>
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$AbsolutePath
    )

    $normalizedRoot = $RepoRoot.TrimEnd('\', '/')
    if ($AbsolutePath.StartsWith($normalizedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        $relative = $AbsolutePath.Substring($normalizedRoot.Length).TrimStart('\', '/')
    } else {
        $relative = $AbsolutePath
    }

    return ($relative -replace '\\', '/')
}

function Invoke-TfStatusCommand {
    <#
        Returns [pscustomobject]@{ ExitCode; Output }. Output is captured explicitly rather than
        left to flow through to the caller — see the identical comment on
        scanners/run-msbuild-family.ps1's Invoke-MSBuildExeBuild for why that matters. Kept as its
        own function (rather than inlined into Get-TfvcChangedFiles) so tests can mock exactly
        this call.
    #>
    param(
        [Parameter(Mandatory)][string]$TfPath,
        [Parameter(Mandatory)][string]$RepoRoot
    )

    $output = & $TfPath status $RepoRoot /recursive /format:xml 2>&1
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}

function Get-XmlChildElement {
    <#
        Safe accessor for an XML node's child element or attribute by name. Under Set-StrictMode
        -Version Latest, plain dot-notation (`$node.Name`) throws PropertyNotFoundException when
        the named child/attribute doesn't exist on that particular node - found via real pilot
        validation, where this crashed Get-TfvcChangedFiles outright (before it ever reached Sonar)
        against a newer tf.exe whose `tf status /format:xml` output is shaped differently than
        this code assumed (see Get-TfvcChangedFiles). $Node itself may legitimately be $null (e.g.
        a schema branch that doesn't apply) - that's not an error, it's just "nothing to find here."
    #>
    param(
        $Node,
        [Parameter(Mandatory)][string]$Name
    )

    if (-not $Node) {
        return $null
    }

    $property = $Node.PSObject.Properties[$Name]
    if (-not $property) {
        return $null
    }
    return $property.Value
}

function Get-TfvcChangedFiles {
    <#
        Returns the repo-relative paths of files with a pending change (edit/add/delete/rename)
        in the TFVC workspace rooted at $RepoRoot. An empty array is a valid, meaningful result:
        nothing pending to scan — mirrors Get-GitChangedFiles in git-adapter.ps1.

        Two `tf status /format:xml` schemas are recognized here, not one - real pilot validation
        found that the version of tf.exe bundled with a newer Visual Studio emits a structurally
        different schema than the one originally assumed (which came from documentation, never
        verified against a live tf.exe): an extra <PendingSet> wrapper per workspace, PascalCase
        element names, and different attribute names (local vs. local-item, chg vs. change-type).
        Both are checked - cheap insurance against whichever shape a given machine's tf.exe
        actually produces, the same reasoning as sending both sonar.token and sonar.login in
        scanners/run-msbuild-family.ps1.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot
    )

    $tfPath = Find-TfCliPath
    if (-not $tfPath) {
        throw 'tfvc-adapter: tf.exe was not found. Install Visual Studio with the Team ' +
              'Explorer / Team Foundation Version Control component.'
    }

    $statusResult = Invoke-TfStatusCommand -TfPath $tfPath -RepoRoot $RepoRoot

    if ($statusResult.ExitCode -ne 0) {
        throw "tfvc-adapter: 'tf status' failed (exit code $($statusResult.ExitCode)): $($statusResult.Output)"
    }

    try {
        [xml]$statusXml = $statusResult.Output
    } catch {
        throw "tfvc-adapter: could not parse 'tf status' XML output: $($_.Exception.Message)"
    }

    $statusNode = Get-XmlChildElement -Node $statusXml -Name 'status'
    $changedFiles = @()

    # Newer tf.exe (confirmed via real pilot validation against a live workspace):
    # <Status><PendingSet><PendingChanges><PendingChange local="..." /></PendingChanges>
    # </PendingSet></Status> - one <PendingSet> per workspace the status result covers (normally
    # exactly one, but not assumed to be).
    $pendingSets = @(Get-XmlChildElement -Node $statusNode -Name 'PendingSet') | Where-Object { $_ }
    foreach ($pendingSet in $pendingSets) {
        $pendingChangesNode = Get-XmlChildElement -Node $pendingSet -Name 'PendingChanges'
        $pendingChanges = @(Get-XmlChildElement -Node $pendingChangesNode -Name 'PendingChange') | Where-Object { $_ }
        foreach ($change in $pendingChanges) {
            $localPath = Get-XmlChildElement -Node $change -Name 'local'
            if ($localPath) {
                $changedFiles += ConvertTo-RepoRelativePath -RepoRoot $RepoRoot -AbsolutePath $localPath
            }
        }
    }

    # Older, previously-assumed schema: <status><pending-changes><pending-change
    # local-item="..." /></pending-changes></status> - kept for any tf.exe version that still
    # emits it; harmless to check even when the newer schema above already matched, since a
    # well-formed document only ever matches one of the two shapes.
    $pendingChangesNode = Get-XmlChildElement -Node $statusNode -Name 'pending-changes'
    $pendingChanges = @(Get-XmlChildElement -Node $pendingChangesNode -Name 'pending-change') | Where-Object { $_ }
    foreach ($change in $pendingChanges) {
        $localPath = Get-XmlChildElement -Node $change -Name 'local-item'
        if ($localPath) {
            $changedFiles += ConvertTo-RepoRelativePath -RepoRoot $RepoRoot -AbsolutePath $localPath
        }
    }

    return ,@($changedFiles)
}

function Invoke-TfWorkfoldCommand {
    <#
        Thin wrapper around bare `tf workfold` (no arguments), kept separate so tests can Mock
        exactly this call - same reasoning as Invoke-TfStatusCommand. Run with the current
        directory set to $RepoRoot: confirmed via real pilot validation that this is what actually
        lists EVERY mapping in the workspace $RepoRoot belongs to (matching the official example,
        `c:\projects>tf workfold`) - passing $RepoRoot as a positional argument instead (the same
        style Invoke-TfStatusCommand uses for `tf status`) was also tested directly and confirmed to
        return only the ONE mapping covering that specific folder, not the whole workspace, which is
        not enough to translate an arbitrary changeset file's server path.
    #>
    param(
        [Parameter(Mandatory)][string]$TfPath,
        [Parameter(Mandatory)][string]$RepoRoot
    )

    Push-Location -LiteralPath $RepoRoot
    try {
        $output = & $TfPath workfold 2>&1
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
    } finally {
        Pop-Location
    }
}

function Get-TfvcWorkfoldMappings {
    <#
        Returns this TFVC workspace's real folder mappings - CollectionUrl plus one
        ServerPath/LocalPath pair per mapping - needed to translate a Changeset's server-relative
        paths ($/Project/...) to real local paths (Changeset review's `-UseCurrentFiles` mode) or to
        this toolkit's usual repo-relative shape (the historical snapshot mode,
        New-TfvcChangesetContentSnapshot below).

        `tf workfold` has no structured output option at all - confirmed directly against a real
        tf.exe on a real pilot machine that `/format:xml` is rejected outright ("TF10120:
        Unrecognized command option 'format'", exit code 100). Free-text parsing is the only
        mechanism available, and the exact shape below was captured from that same real machine's
        tf.exe, not assumed from documentation - the same "verify against a live tf.exe" discipline
        Get-TfvcChangedFiles already applies to `tf status`:

            ===============================================================================
            Workspace : DEVWorkSpace (Hend mohamed)
            Collection: https://tfs25.alqemam.com/gcollection
             $/qCLP/Branches/qCLP-branch: D:\g_tfs_2025\qCLP-branch
             $/qCMS/qCMS: D:\makeenmaster\qCMS (cloaked)

        Mappings are recursive by design (a mapping also covers every subfolder beneath it), so a
        cloaked mapping is kept in the returned list, tagged, rather than dropped - callers that
        resolve a specific server path (Resolve-TfvcMappingForServerPath) need to know when the
        longest-matching mapping is actually cloaked, to report that plainly instead of guessing at
        a local path no content was ever retrieved for.
    #>
    param([Parameter(Mandatory)][string]$RepoRoot)

    $tfPath = Find-TfCliPath
    if (-not $tfPath) {
        throw 'tfvc-adapter: tf.exe was not found. Install Visual Studio with the Team ' +
              'Explorer / Team Foundation Version Control component.'
    }

    $result = Invoke-TfWorkfoldCommand -TfPath $tfPath -RepoRoot $RepoRoot
    if ($result.ExitCode -ne 0) {
        throw "tfvc-adapter: 'tf workfold' failed (exit code $($result.ExitCode)): $($result.Output)"
    }

    $workspace = $null
    $collectionUrl = $null
    $mappings = @()

    foreach ($line in ($result.Output -split "`r?`n")) {
        if ($line -match '^Workspace\s*:\s*(?<name>\S+)') {
            $workspace = $Matches['name']
            continue
        }
        if ($line -match '^Collection:\s*(?<url>\S+)') {
            $collectionUrl = $Matches['url']
            continue
        }
        if ($line -match '^\s(?<server>\$/\S.*?):\s(?<local>.+?)(?:\s\(cloaked\))?$') {
            $mappings += [pscustomobject]@{
                ServerPath = $Matches['server']
                LocalPath  = $Matches['local'].Trim()
                Cloaked    = [bool]($line -match '\(cloaked\)\s*$')
            }
        }
    }

    if (-not $collectionUrl) {
        throw "tfvc-adapter: could not find a 'Collection:' line in 'tf workfold' output - unexpected format. Raw output: $($result.Output)"
    }
    if ($collectionUrl -notmatch '^https://') {
        throw "tfvc-adapter: workspace collection '$collectionUrl' uses 'http', not 'https' - refusing to send a PAT over an unencrypted connection."
    }

    return [pscustomobject]@{
        Workspace     = $workspace
        CollectionUrl = $collectionUrl
        Mappings      = @($mappings)
    }
}

function Resolve-TfvcMappingForServerPath {
    <#
        Longest-prefix match: TFVC mappings are recursive (mapping $/Project also covers every
        subfolder beneath it unless a more specific mapping overrides part of that tree - the real
        workspace captured for Get-TfvcWorkfoldMappings has exactly this shape, e.g. both
        $/qCLP/Branches/qCLP-branch and the broader $/qCLP/Branches-G_Branch are mapped
        independently), so the mapping whose ServerPath is the longest matching prefix is the one
        that actually applies - not just the first one found. Returns $null when no mapping covers
        $ServerPath at all (genuinely outside this workspace).
    #>
    param(
        [Parameter(Mandatory)][string]$ServerPath,
        [Parameter(Mandatory)][AllowEmptyCollection()][array]$Mappings
    )

    $best = $null
    $bestLength = -1
    foreach ($mapping in $Mappings) {
        $prefix = $mapping.ServerPath.TrimEnd('/')
        $isMatch = ($ServerPath -ieq $prefix) -or $ServerPath.StartsWith("$prefix/", [StringComparison]::OrdinalIgnoreCase)
        if ($isMatch -and $prefix.Length -gt $bestLength) {
            $best = $mapping
            $bestLength = $prefix.Length
        }
    }

    return $best
}

function ConvertTo-LocalPathFromServerPath {
    <#
        Translates one TFVC server-relative path ($/Project/folder/File.cs) to the real local path
        on disk, via this workspace's own recorded mappings (Get-TfvcWorkfoldMappings) - never
        guessed from the server path's own shape. Throws a plainly-worded, distinct error for the
        two different reasons this can fail: genuinely unmapped (outside this workspace entirely) vs.
        mapped but cloaked (mapped in principle, but no content is retrieved for it locally) - a
        caller building a file list needs to tell these apart to report the skip accurately.
    #>
    param(
        [Parameter(Mandatory)][string]$ServerPath,
        [Parameter(Mandatory)][AllowEmptyCollection()][array]$Mappings
    )

    $mapping = Resolve-TfvcMappingForServerPath -ServerPath $ServerPath -Mappings $Mappings
    if (-not $mapping) {
        throw "tfvc-adapter: no workspace mapping covers '$ServerPath' - it is outside this workspace."
    }
    if ($mapping.Cloaked) {
        throw "tfvc-adapter: '$ServerPath' is under a cloaked mapping ('$($mapping.ServerPath)') - no local content is retrieved for it."
    }

    $prefix = $mapping.ServerPath.TrimEnd('/')
    $suffix = $ServerPath.Substring($prefix.Length).TrimStart('/')
    if (-not $suffix) {
        return $mapping.LocalPath
    }

    return Join-Path $mapping.LocalPath ($suffix -replace '/', '\')
}

function Get-TfvcRemoteInfo {
    <#
        Resolves the TFS/Azure DevOps Server collection URL and Team Project name for a TFVC
        working folder - the TFVC equivalent of tfs-workitem-adapter.ps1's Get-TfsRemoteInfo (which
        reads a Git 'origin' remote; a TFVC working folder has no such concept to read). Needed by
        `/quality-review changeset ... --task`, which must resolve the same information
        Add-TfsWorkItemAttachment needs without a Git remote available.

        Project is derived from the first path segment of whichever workspace mapping's LocalPath
        most closely covers $RepoRoot - the mirror image of Resolve-TfvcMappingForServerPath's
        longest-prefix reasoning, just inverted: matching on LocalPath containment instead of
        ServerPath containment. A TFVC server path is always $/<TeamProject>/..., so that first
        segment is the Team Project name.
    #>
    param([Parameter(Mandatory)][string]$RepoRoot)

    $mappingInfo = Get-TfvcWorkfoldMappings -RepoRoot $RepoRoot
    $normalizedRepoRoot = ($RepoRoot.TrimEnd('\', '/') -replace '/', '\')

    $best = $null
    $bestLength = -1
    foreach ($mapping in $mappingInfo.Mappings) {
        $mappingLocal = $mapping.LocalPath.TrimEnd('\', '/')
        $isMatch = ($normalizedRepoRoot -ieq $mappingLocal) -or $normalizedRepoRoot.StartsWith("$mappingLocal\", [StringComparison]::OrdinalIgnoreCase)
        if ($isMatch -and $mappingLocal.Length -gt $bestLength) {
            $best = $mapping
            $bestLength = $mappingLocal.Length
        }
    }

    if (-not $best) {
        throw "tfvc-adapter: no workspace mapping covers '$RepoRoot' - cannot resolve its TFS Team Project."
    }

    if ($best.ServerPath -notmatch '^\$/(?<project>[^/]+)') {
        throw "tfvc-adapter: could not extract a Team Project name from mapping '$($best.ServerPath)'."
    }

    return [pscustomobject]@{
        CollectionUrl = $mappingInfo.CollectionUrl
        Project       = $Matches['project']
    }
}

function Invoke-TfvcChangesetChangesRequest {
    <#
        Thin wrapper around the REST call, kept separate so tests can Mock exactly this call.
    #>
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][hashtable]$Headers
    )

    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Get
}

function Get-TfvcChangesetChanges {
    <#
        Returns the files touched by one TFVC changeset, as [pscustomobject]@{ServerPath;
        ChangeType; SourceServerPath}. SourceServerPath is the path before a rename (the API's
        sourceServerItem), else $null. Confirmed, from the official Azure DevOps REST API reference, to exist under
        the on-prem "azure-devops-server-rest-*" API versions (5.0/6.0/7.0/7.1), not just cloud
        dev.azure.com - the same standard already applied to every other TFS REST call in this
        toolkit (scm-adapters/tfs-pullrequest-adapter.ps1).

        $Top caps the single page fetched - large enough for any realistic changeset, and simpler
        than implementing full continuation-token pagination for a case this toolkit hasn't actually
        needed yet. A changeset genuinely larger than $Top would silently return an incomplete list;
        this doc comment, not silent truncation being invisible, is the mitigation for now.
    #>
    param(
        [Parameter(Mandatory)][string]$CollectionUrl,
        [Parameter(Mandatory)][int]$ChangesetId,
        [Parameter(Mandatory)][string]$PatToken,
        [int]$Top = 500,
        [string]$ApiVersion = '5.0'
    )

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $uri = "$CollectionUrl/_apis/tfvc/changesets/$ChangesetId/changes?`$top=$Top&api-version=$ApiVersion"
    $response = Invoke-TfvcChangesetChangesRequest -Uri $uri -Headers $headers

    $changes = @()
    foreach ($entry in @($response.value)) {
        $source = if ($entry.PSObject.Properties['sourceServerItem']) { "$($entry.sourceServerItem)" } else { '' }
        $changes += [pscustomobject]@{
            ServerPath       = $entry.item.path
            ChangeType       = "$($entry.changeType)"
            SourceServerPath = if ($source) { $source } else { $null }
        }
    }
    return ,@($changes)
}

function Invoke-TfvcItemContentRequest {
    <#
        Thin wrapper around the REST call, kept separate so tests can Mock exactly this call.
    #>
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][hashtable]$Headers
    )

    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Get
}

function Get-TfvcItemContentAtChangeset {
    <#
        Returns one file's raw content as of a specific historical changeset - for the default
        (historical) changeset review mode, which must review the code as it looked at check-in
        time, not whatever is on disk right now.

        Deliberately does NOT request `Accept: application/json`: confirmed via the official REST
        reference that `includeContent=true` only wraps content in a JSON envelope "when requesting
        json" - the default response for a text file is the raw file content itself in the response
        body, which is exactly what's needed here, with no metadata envelope to strip back out.
    #>
    param(
        [Parameter(Mandatory)][string]$CollectionUrl,
        [Parameter(Mandatory)][string]$ServerPath,
        [Parameter(Mandatory)][int]$ChangesetId,
        [Parameter(Mandatory)][string]$PatToken,
        [string]$ApiVersion = '5.0'
    )

    $headers = New-TfsBasicAuthHeader -PatToken $PatToken
    $encodedPath = [Uri]::EscapeDataString($ServerPath)
    $uri = "$CollectionUrl/_apis/tfvc/items?path=$encodedPath&versionDescriptor.version=$ChangesetId&versionDescriptor.versionType=Changeset&includeContent=true&api-version=$ApiVersion"

    return Invoke-TfvcItemContentRequest -Uri $uri -Headers $headers
}

function New-TfvcChangesetContentSnapshot {
    <#
        Materializes the historical content of every file touched by $ChangesetIds, as of its own
        changeset, into a fresh temporary directory laid out the same repo-relative way the rest of
        this toolkit already expects (engine/checklist-evaluator.ps1's Invoke-ChecklistEvaluation
        reads `Join-Path RepoRoot file`) - so the existing Checklist evaluator, and the code-reviewer
        Subagent reading by absolute path, can run unmodified against this directory as if it were
        $RepoRoot itself. Never touches or modifies the developer's real working folder.

        Only files whose real local mapping falls under $RepoRoot are included - a changeset can
        touch files belonging to a different mapped project entirely, which a command scoped to one
        $RepoRoot has no meaningful way to review; those come back in SkippedFiles instead of being
        silently dropped, same for a file that turns out to be unmapped or cloaked. Deletes are
        skipped too (nothing to review). When the same file is touched by more than one requested
        changeset, the highest changeset id wins - the most recent version among the ones actually
        asked about.

        The caller owns cleanup of the returned SnapshotPath (a temp directory) once it's done
        reading from it - this function only ever creates one, deliberately, since the directory
        must still exist for a later, separate process (the code-reviewer Subagent, invoked by
        claude/skills/quality-review/SKILL.md after this PowerShell process has already exited).
    #>
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][int[]]$ChangesetIds,
        [Parameter(Mandatory)][string]$PatToken
    )

    $mappingInfo = Get-TfvcWorkfoldMappings -RepoRoot $RepoRoot
    # Backslash-normalized before comparison below: Join-Path (used by ConvertTo-
    # LocalPathFromServerPath) always normalizes its result to backslashes regardless of which
    # separator style its inputs used, so comparing against a $RepoRoot that happened to contain a
    # forward slash anywhere would otherwise silently fail the containment check - found via a real
    # test failure (engine/scope-resolver.ps1's Get-TfvcChangesetFilesForRepo has the identical
    # comparison and hit the exact same bug), not a hypothetical.
    $normalizedRepoRoot = ($RepoRoot.TrimEnd('\', '/') -replace '/', '\')

    # ServerPath -> highest requested ChangesetId that touched it (excluding deletes).
    $latestChangesetByServerPath = @{}
    foreach ($changesetId in $ChangesetIds) {
        $changes = Get-TfvcChangesetChanges -CollectionUrl $mappingInfo.CollectionUrl -ChangesetId $changesetId -PatToken $PatToken
        foreach ($change in $changes) {
            if ($change.ChangeType -match 'delete') {
                continue
            }
            if (-not $latestChangesetByServerPath.ContainsKey($change.ServerPath) -or
                $latestChangesetByServerPath[$change.ServerPath] -lt $changesetId) {
                $latestChangesetByServerPath[$change.ServerPath] = $changesetId
            }
        }
    }

    $snapshotPath = Join-Path ([IO.Path]::GetTempPath()) "sonartoolkit-changeset-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $snapshotPath -Force | Out-Null

    $files = @()
    $skippedFiles = @()

    foreach ($serverPath in $latestChangesetByServerPath.Keys) {
        $changesetId = $latestChangesetByServerPath[$serverPath]

        try {
            $localPath = ConvertTo-LocalPathFromServerPath -ServerPath $serverPath -Mappings $mappingInfo.Mappings
        } catch {
            $skippedFiles += [pscustomobject]@{ ServerPath = $serverPath; Reason = $_.Exception.Message }
            continue
        }

        if (-not $localPath.StartsWith($normalizedRepoRoot, [StringComparison]::OrdinalIgnoreCase)) {
            $skippedFiles += [pscustomobject]@{ ServerPath = $serverPath; Reason = "maps to '$localPath', outside of '$RepoRoot' - belongs to a different local working folder." }
            continue
        }

        $repoRelative = ($localPath.Substring($normalizedRepoRoot.Length).TrimStart('\', '/') -replace '\\', '/')

        try {
            $content = Get-TfvcItemContentAtChangeset -CollectionUrl $mappingInfo.CollectionUrl -ServerPath $serverPath -ChangesetId $changesetId -PatToken $PatToken
        } catch {
            $skippedFiles += [pscustomobject]@{ ServerPath = $serverPath; Reason = "could not fetch historical content: $($_.Exception.Message)" }
            continue
        }

        $destinationPath = Join-Path $snapshotPath $repoRelative
        $destinationDir = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationDir)) {
            New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        }
        Set-Content -LiteralPath $destinationPath -Value $content -NoNewline

        $files += $repoRelative
    }

    return [pscustomobject]@{
        SnapshotPath = $snapshotPath
        Files        = @($files)
        SkippedFiles = @($skippedFiles)
    }
}
