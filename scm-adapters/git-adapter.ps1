<#
    scm-adapters/git-adapter.ps1

    Answers "what changed" for a Git repository. Per Architecture Specification §6, this module
    must not contain scanning logic or Quality Gate logic — only change detection.
#>

Set-StrictMode -Version Latest

$script:GitEmptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
$script:GitZeroRevision = '0' * 40
$script:GitConventionalBaseBranches = @('develop', 'origin/develop', 'main', 'origin/main', 'master', 'origin/master')

function Get-GitMergeBaseWithKnownBranch {
    <#
        Finds a sensible comparison point against a base branch by looking for the commit
        $LocalRevision actually forked from, rather than diffing against that branch's current
        tip directly. This is correct whether or not $LocalRevision has since been merged into the
        base branch: merge-base finds the real historical fork point either way, so the same call
        answers both "this branch is still open" and "this branch's PR already completed" without
        needing to tell the two apart. Confirmed via real pilot validation against a genuinely
        completed, already-merged PR - merge-base still reproduced the exact same changed-file
        list Azure DevOps itself showed for that PR.

        Originally built for one specific caller (Get-GitChangedFiles's brand-new-branch, all-zero-
        remote-sha case, where $script:GitConventionalBaseBranches - develop/main/master, local or
        origin/ - is tried in order). -TargetBranch generalizes it to a second caller
        (/quality-review branch [<base-branch>]): a reviewer naming one specific branch to compare
        against, instead of guessing from the conventional list.

        A candidate whose own tip is exactly $LocalRevision is skipped rather than used: that
        means $LocalRevision *is* that base branch (e.g. pushing 'develop' itself to a brand-new
        remote for the first time), where "everything is new" is the correct answer, not a bug -
        merge-base of a branch with itself would otherwise silently report zero changed files.

        Returns $null when no candidate exists at all, none share history with $LocalRevision, or
        an explicit -TargetBranch doesn't exist - callers decide what "no answer" means for them
        (Get-GitChangedFiles falls back to the empty-tree comparison; /quality-review branch
        reports a clear error instead of guessing).
    #>
    param(
        [Parameter(Mandatory)][string]$RepoRoot,
        [Parameter(Mandatory)][string]$LocalRevision,
        [string]$TargetBranch
    )

    $candidates = if ($TargetBranch) {
        @($TargetBranch, "origin/$TargetBranch")
    } else {
        $script:GitConventionalBaseBranches
    }

    foreach ($candidate in $candidates) {
        $candidateSha = & git -C $RepoRoot rev-parse --verify --quiet $candidate 2>&1
        if ($LASTEXITCODE -ne 0) {
            continue
        }
        $candidateSha = "$candidateSha".Trim()

        if ($candidateSha -eq $LocalRevision) {
            continue
        }

        $mergeBase = & git -C $RepoRoot merge-base $candidate $LocalRevision 2>&1
        if ($LASTEXITCODE -eq 0) {
            return "$mergeBase".Trim()
        }
    }

    return $null
}

function Get-GitChangedFiles {
    <#
        Resolves the set of repo-relative file paths that differ between $RemoteRevision and
        $LocalRevision — the files a `git push` of $LocalRevision would introduce or modify on
        the remote.

        $RemoteRevision equal to the all-zero SHA means the remote ref does not exist yet (a new
        branch being pushed for the first time). Rather than unconditionally treating every file
        reachable from $LocalRevision as changed, this first tries to find the real fork point via
        Get-GitMergeBaseWithKnownBranch (e.g. a feature branch created from 'develop') and diffs
        against that instead - only falling back to "everything is changed" when no such base
        branch can be found, which is the genuine edge case (e.g. a brand-new repository).

        $LocalRevision equal to the all-zero SHA means the local ref is being deleted (nothing is
        being pushed); an empty result is returned.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot,

        [Parameter(Mandatory)]
        [string]$LocalRevision,

        [Parameter(Mandatory)]
        [string]$RemoteRevision
    )

    if ($LocalRevision -eq $script:GitZeroRevision) {
        # The unary comma forces PowerShell to emit this empty array as a single pipeline object,
        # rather than emitting zero objects (which would make the caller see $null instead of @()).
        return ,@()
    }

    $baseRevision = if ($RemoteRevision -eq $script:GitZeroRevision) {
        $mergeBase = Get-GitMergeBaseWithKnownBranch -RepoRoot $RepoRoot -LocalRevision $LocalRevision
        if ($mergeBase) { $mergeBase } else { $script:GitEmptyTreeHash }
    } else {
        $RemoteRevision
    }

    $output = & git -C $RepoRoot diff --name-only $baseRevision $LocalRevision 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git-adapter: 'git diff' failed comparing $baseRevision..$LocalRevision : $output"
    }

    # Comma-prefixed for the same reason as above: without it, a single changed file collapses
    # from a one-element array into a bare string when the caller captures this function's result.
    return ,@($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-GitCurrentRevision {
    <#
        Returns the current HEAD commit SHA for $RepoRoot. Used by Get-ChangedFilesForRepo
        (engine/scope-resolver.ps1) to default $LocalRevision for a manually-triggered command
        (e.g. /quality-review), which — unlike the pre-push hook — has no ref pair supplied to it
        from Git itself.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot
    )

    $output = & git -C $RepoRoot rev-parse HEAD 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git-adapter: could not resolve HEAD in '$RepoRoot': $output"
    }

    return "$output".Trim()
}

function Get-GitUpstreamRevision {
    <#
        Returns the commit SHA of $RepoRoot's upstream tracking branch, or the all-zero revision
        if no upstream is configured. The all-zero fallback deliberately reuses
        Get-GitChangedFiles's existing "new branch" semantics (§ its own comment above): with no
        upstream, everything reachable from HEAD is genuinely not on any remote yet, the same
        situation as a first-time push of a new branch.
    #>
    param(
        [Parameter(Mandatory)]
        [string]$RepoRoot
    )

    $output = & git -C $RepoRoot rev-parse '@{u}' 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $script:GitZeroRevision
    }

    return "$output".Trim()
}
