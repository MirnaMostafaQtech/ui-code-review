<#
    scripts/Publish-Findings.ps1

    Takes the review target (Get-ReviewTarget.ps1) and the merged findings the reviewers produced,
    keeps only findings on changed lines, writes report.md, and - unless -DryRun - posts them:

        pr        -> one inline thread per line on the PR diff + one summary thread.
                     Re-runs don't repeat a comment (hidden fingerprint), and threads whose finding
                     is gone are marked Fixed.
        changeset -> one comment per line on the changeset (TFS discussion API) + a summary comment.
                     If the server refuses that API, falls back to the changeset's linked work
                     item(s): one comment in the work item's Discussion with every finding and the
                     changeset link. No file is attached.

    findings.json: [ { ruleId, severity (Error|Warning|Info), file, line, message, fix, reviewer } ]
      - file is exactly the `path` from target.json; line is 1-based on the new side.

    Comment selection:
      - every Error and every Warning gets its own inline comment where it is (at most $MaxWarnings
        Warnings, chosen by priority: security, accessibility, localization, AXIS, images and assets,
        then any other, one per rule in turn;
        the rest are listed in the summary only); Info goes to the summary only;
      - findings on the same line are merged into one comment.
#>
param(
    [Parameter(Mandatory)][string]$TargetFile,
    [Parameter(Mandatory)][string]$FindingsFile,
    [switch]$DryRun,
    [int]$MaxWarnings = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '../common/tfs-auth.ps1')

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$target = [IO.File]::ReadAllText($TargetFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
# foreach enumerates the parsed array (PowerShell 5.1's ConvertFrom-Json emits a JSON array as one object).
$rawFindings = @()
foreach ($item in ([IO.File]::ReadAllText($FindingsFile, [Text.Encoding]::UTF8) | ConvertFrom-Json)) { $rawFindings += $item }
$outDir = Split-Path -Parent $TargetFile

$severityRank = @{ Error = 0; Warning = 1; Info = 2 }
$marker = 'ui-review'

# ---------- helpers ----------

# Occurrence tells apart lines with the same text (two identical <input> lines): it is how many lines
# above have that text. The first occurrence hashes as before, so fingerprints already posted still match.
function Get-Fingerprint([string]$RuleId, [string]$Path, [string]$LineText, [int]$Occurrence = 0) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $key = "$RuleId|$Path|$($LineText.Trim())"
    if ($Occurrence -gt 0) { $key = "$key|$Occurrence" }
    $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($key))
    return ([BitConverter]::ToString($bytes) -replace '-', '').Substring(0, 16).ToLower()
}

function Get-TfsPat {
    $pat = $env:SONARTOOLKIT_TFS_PAT
    if (-not $pat) { $pat = [Environment]::GetEnvironmentVariable('SONARTOOLKIT_TFS_PAT', 'User') }
    if (-not $pat) { throw 'Publish-Findings: SONARTOOLKIT_TFS_PAT is not set.' }
    return $pat
}

function Invoke-TfsJson([string]$Method, [string]$Uri, $Body, [string]$ContentType = 'application/json') {
    $headers = New-TfsBasicAuthHeader -PatToken (Get-TfsPat)
    if ($null -eq $Body) {
        return Invoke-RestMethod -Uri $Uri -Headers $headers -Method $Method
    }
    # Send UTF-8 bytes explicitly; Windows PowerShell 5.1 would otherwise mangle non-ASCII text.
    $json = ConvertTo-Json -InputObject $Body -Depth 10
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Uri $Uri -Headers $headers -Method $Method -Body $bytes -ContentType "$ContentType; charset=utf-8"
}

# ---------- 1. validate and keep findings on changed lines ----------

$fileIndex = @{}
foreach ($f in @($target.files)) { $fileIndex[$f.path] = $f }
$lineCache = @{}

$kept = @()
$dropped = 0
foreach ($finding in $rawFindings) {
    $file = $fileIndex[$finding.file]
    if (-not $file -or -not $severityRank.ContainsKey("$($finding.severity)")) { $dropped++; continue }
    $line = [int]$finding.line
    $onChangedLine = $false
    foreach ($range in @($file.changedLines)) {
        if ($line -ge $range[0] -and $line -le $range[1]) { $onChangedLine = $true; break }
    }
    if (-not $onChangedLine) { $dropped++; continue }

    if (-not $lineCache.ContainsKey($file.path)) {
        $lineCache[$file.path] = [IO.File]::ReadAllLines($file.contentFile, [Text.Encoding]::UTF8)
    }
    $lines = $lineCache[$file.path]
    $lineText = if ($line -le $lines.Count) { $lines[$line - 1] } else { '' }
    $occurrence = 0
    for ($i = 0; $i -lt [Math]::Min($line - 1, $lines.Count); $i++) {
        if ($lines[$i].Trim() -ceq $lineText.Trim()) { $occurrence++ }
    }

    $kept += [pscustomobject]@{
        ruleId      = "$($finding.ruleId)"
        severity    = "$($finding.severity)"
        file        = $file.path
        line        = $line
        message     = "$($finding.message)"
        fix         = "$($finding.fix)"
        fingerprint = Get-Fingerprint $finding.ruleId $file.path $lineText $occurrence
    }
}
$kept = @($kept | Sort-Object { $severityRank[$_.severity] }, file, line)

# ---------- 2. choose what becomes an inline comment ----------

# Every Error. Warnings by priority up to $MaxWarnings: security, accessibility, localization, AXIS,
# images and assets, then any other, taking one finding per rule in turn so a single repeated rule
# can't fill every slot.
$inline = @($kept | Where-Object { $_.severity -eq 'Error' })
$ruleFamilyOrder = @('SEC-*', 'A11Y-*', 'I18N-*', 'R-*', 'PERF-*')
$ruleFamilyRank = {
    param($ruleId)
    for ($i = 0; $i -lt $ruleFamilyOrder.Count; $i++) { if ($ruleId -like $ruleFamilyOrder[$i]) { return $i } }
    return $ruleFamilyOrder.Count
}
$warningQueues = @($kept | Where-Object { $_.severity -eq 'Warning' } |
    Group-Object ruleId | Sort-Object { & $ruleFamilyRank $_.Name }, Name |
    ForEach-Object { , @($_.Group) })
$warningCount = 0
for ($round = 0; $warningCount -lt $MaxWarnings; $round++) {
    $took = $false
    foreach ($queue in $warningQueues) {
        if ($warningCount -ge $MaxWarnings) { break }
        if ($round -lt $queue.Count) { $inline += $queue[$round]; $warningCount++; $took = $true }
    }
    if (-not $took) { break }
}

# One comment per (file, line).
$comments = @()
foreach ($group in ($inline | Group-Object { "$($_.file)|$($_.line)" })) {
    $items = @($group.Group)
    $body = ($items | ForEach-Object {
        "🤖 UI Review — **$($_.ruleId)** ($($_.severity)): $($_.message)`n`n**Fix:** $($_.fix)"
    }) -join "`n`n---`n`n"
    $prints = ($items | ForEach-Object { "<!-- ${marker}:$($_.fingerprint) -->" }) -join ''
    $comments += [pscustomobject]@{
        file         = $items[0].file
        line         = $items[0].line
        content      = "$body`n`n$prints"
        fingerprints = @($items | ForEach-Object { $_.fingerprint })
    }
}

# ---------- 3. summary + report.md ----------

$counts = @{ Error = 0; Warning = 0; Info = 0 }
foreach ($f in $kept) { $counts[$f.severity]++ }

$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine("## 🤖 UI Review — $($target.kind) $($target.id)")
[void]$sb.AppendLine()
if ($kept.Count -eq 0) {
    [void]$sb.AppendLine("No findings on the changed lines of $(@($target.files).Count) UI file(s).")
}
else {
    [void]$sb.AppendLine("**$($counts.Error) Error · $($counts.Warning) Warning · $($counts.Info) Info** on the changed lines of $(@($target.files).Count) UI file(s).")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('| Severity | Rule | File | Line | Finding |')
    [void]$sb.AppendLine('|---|---|---|---|---|')
    foreach ($f in $kept) {
        $msg = ($f.message -replace '\|', '\|' -replace "`r?`n", ' ')
        [void]$sb.AppendLine("| $($f.severity) | $($f.ruleId) | ``$($f.file)`` | $($f.line) | $msg |")
    }
    $notInline = $counts.Warning - $warningCount
    if ($notInline -gt 0) {
        [void]$sb.AppendLine()
        [void]$sb.AppendLine("$notInline Warning(s) beyond the $MaxWarnings highest-priority ones are listed here only, without an inline comment.")
    }
}
[void]$sb.AppendLine()
[void]$sb.AppendLine('Rules: AXIS (`R-xx`), localization (`I18N-xx`), security (`SEC-xx`), images and assets (`PERF-xx`), accessibility (`A11Y-*`).')
# Review signature: changes only when the set of findings changes. A re-run with the same signature
# posts nothing new (summary and work item comment are skipped).
$reviewKey = "$($target.kind)-$($target.id)"
$reviewSig = Get-Fingerprint 'review' $reviewKey ((@($kept | ForEach-Object { $_.fingerprint }) | Sort-Object) -join ',')
[void]$sb.AppendLine()
[void]$sb.AppendLine("<!-- ${marker}:summary:${reviewKey}:$reviewSig -->")
$summary = $sb.ToString()
$summaryPattern = "${marker}:summary:$([regex]::Escape($reviewKey)):([0-9a-f]{16})"

$reportFile = Join-Path $outDir 'report.md'
[IO.File]::WriteAllText($reportFile, $summary, $utf8NoBom)

# HTML version of the summary for a work item's Discussion (System.History renders HTML, not markdown).
# It is the only thing posted in the fallback, so it lists every finding (Errors first).
$enc = { param($s) [Net.WebUtility]::HtmlEncode("$s") }
$html = New-Object Text.StringBuilder
[void]$html.Append("<p><b>🤖 UI Review</b> — $($target.kind) <a href=`"$(& $enc $target.webUrl)`">$($target.id)</a></p>")
if ($kept.Count -eq 0) {
    [void]$html.Append("<p>No findings on the changed lines of $(@($target.files).Count) UI file(s).</p>")
}
else {
    [void]$html.Append("<p><b>$($counts.Error) Error · $($counts.Warning) Warning · $($counts.Info) Info</b> on the changed lines of $(@($target.files).Count) UI file(s).</p><ul>")
    foreach ($f in $kept) {
        $fileName = Split-Path -Leaf $f.file
        [void]$html.Append("<li><b>$(& $enc $f.ruleId)</b> ($($f.severity)) — <code>$(& $enc $fileName):$($f.line)</code>: $(& $enc $f.message) <i>Fix:</i> $(& $enc $f.fix)</li>")
    }
    [void]$html.Append('</ul>')
}
# Visible footer: TFS strips HTML comments from work item History, so the signature is plain text.
[void]$html.Append("<p><small>Review id: ${reviewKey}:$reviewSig</small></p>")
$discussionHtml = $html.ToString()
$historyPattern = "Review id: $([regex]::Escape($reviewKey)):([0-9a-f]{16})"
[IO.File]::WriteAllText((Join-Path $outDir 'work-item-comment.html'), $discussionHtml, $utf8NoBom)
[IO.File]::WriteAllText((Join-Path $outDir 'comments.json'), (ConvertTo-Json -InputObject @($comments) -Depth 6), $utf8NoBom)

Write-Output "Findings: $($kept.Count) kept, $dropped dropped (not on a changed line / unknown file). Inline comments: $($comments.Count). Report: $reportFile"
if ($DryRun) {
    Write-Output 'Dry run: nothing posted.'
    return
}

# ---------- 4. publish ----------

# Every path below is idempotent: a re-run never repeats a line comment (fingerprint per finding),
# and posts a new summary / work item comment only when the review signature changed.

function Get-CommentText($Comment) {
    if ($Comment.PSObject.Properties['content']) { return "$($Comment.content)" }
    return ''
}

function Get-Fingerprints([string]$Text) {
    return @([regex]::Matches("$Text", "<!-- ${marker}:([0-9a-f]{16}) -->") | ForEach-Object { $_.Groups[1].Value })
}

if ($target.kind -eq 'pr') {
    $base = "$($target.collectionUrl)/$([Uri]::EscapeDataString($target.project))/_apis/git/repositories/$([Uri]::EscapeDataString($target.repository))/pullRequests/$($target.id)/threads"

    # Fingerprints already on the PR, which thread carries each, and the existing summary thread.
    $existing = @{}
    $summaryThread = $null; $summaryComment = $null; $oldSig = $null
    foreach ($thread in @((Invoke-TfsJson GET "$base`?api-version=5.0" $null).value)) {
        foreach ($comment in @($thread.comments)) {
            foreach ($print in (Get-Fingerprints (Get-CommentText $comment))) { $existing[$print] = $thread }
            $m = [regex]::Match((Get-CommentText $comment), $summaryPattern)
            if ($m.Success) { $summaryThread = $thread; $summaryComment = $comment; $oldSig = $m.Groups[1].Value }
        }
    }

    $posted = 0; $skipped = 0; $failed = 0
    foreach ($c in $comments) {
        if (@($c.fingerprints | Where-Object { $existing.ContainsKey($_) }).Count -eq $c.fingerprints.Count) { $skipped++; continue }
        try {
            [void](Invoke-TfsJson POST "$base`?api-version=5.0" @{
                comments      = @(@{ parentCommentId = 0; content = $c.content; commentType = 1 })
                status        = 1
                threadContext = @{
                    filePath       = '/' + ($c.file -replace '^/', '')
                    rightFileStart = @{ line = $c.line; offset = 1 }
                    rightFileEnd   = @{ line = $c.line; offset = 200 }
                }
            })
            $posted++
        }
        catch { $failed++; Write-Warning "Comment on $($c.file):$($c.line) failed: $($_.Exception.Message)" }
    }

    # Mark active threads whose findings are all gone as Fixed (status 2).
    $current = @{}
    foreach ($f in $kept) { $current[$f.fingerprint] = $true }
    $resolved = 0
    foreach ($thread in @($existing.Values | Sort-Object id -Unique)) {
        if ("$($thread.status)" -notin @('active', '1')) { continue }
        $prints = Get-Fingerprints (($thread.comments | ForEach-Object { Get-CommentText $_ }) -join '')
        if ($prints.Count -gt 0 -and @($prints | Where-Object { $current.ContainsKey($_) }).Count -eq 0) {
            try { [void](Invoke-TfsJson PATCH "$base/$($thread.id)?api-version=5.0" @{ status = 2 }); $resolved++ }
            catch { Write-Warning "Resolving thread $($thread.id) failed: $($_.Exception.Message)" }
        }
    }

    # One summary per PR: edit it in place when the findings changed, leave it when they didn't.
    if (-not $summaryThread) {
        [void](Invoke-TfsJson POST "$base`?api-version=5.0" @{
            comments = @(@{ parentCommentId = 0; content = $summary; commentType = 1 })
            status   = 4
        })
        $summaryState = 'summary posted'
    }
    elseif ($oldSig -ne $reviewSig) {
        [void](Invoke-TfsJson PATCH "$base/$($summaryThread.id)/comments/$($summaryComment.id)?api-version=5.0" @{ content = $summary })
        $summaryState = 'summary updated'
    }
    else { $summaryState = 'summary unchanged' }

    Write-Output "PR $($target.id): $posted posted, $skipped already there, $failed failed, $resolved resolved, $summaryState."
}
else {
    # TFVC changeset: legacy discussion API (route discussion/threads exists on tfs25; needs a PAT
    # with Code (Read & Write)).
    $artifactUri = "vstfs:///VersionControl/Changeset/$($target.id)"
    $existingPrints = @{}
    $oldSig = $null
    try {
        $known = Invoke-TfsJson GET "$($target.collectionUrl)/_apis/discussion/threads?artifactUri=$([Uri]::EscapeDataString($artifactUri))&api-version=3.0-preview.1" $null
        foreach ($thread in @($known.value)) {
            foreach ($comment in @($thread.comments)) {
                foreach ($print in (Get-Fingerprints (Get-CommentText $comment))) { $existingPrints[$print] = $true }
                $m = [regex]::Match((Get-CommentText $comment), $summaryPattern)
                if ($m.Success) { $oldSig = $m.Groups[1].Value }
            }
        }
    }
    catch { Write-Warning "Reading existing changeset comments failed ($($_.Exception.Message))." }

    $threads = @()
    $skipped = 0
    foreach ($c in $comments) {
        if (@($c.fingerprints | Where-Object { $existingPrints.ContainsKey($_) }).Count -eq $c.fingerprints.Count) { $skipped++; continue }
        $threads += @{
            artifactUri = $artifactUri
            itemPath    = $c.file
            position    = @{ positionContext = 'RightBuffer'; startLine = $c.line; endLine = $c.line; startColumn = 1; endColumn = 200 }
            comments    = @(@{ content = $c.content; commentType = 1 })
            status      = 1
        }
    }
    if ($oldSig -ne $reviewSig) {
        $threads += @{ artifactUri = $artifactUri; comments = @(@{ content = $summary; commentType = 1 }); status = 4 }
    }

    if ($threads.Count -eq 0) {
        Write-Output "Changeset $($target.id): nothing new ($skipped comment(s) already there, summary unchanged)."
        return
    }

    try {
        [void](Invoke-TfsJson POST "$($target.collectionUrl)/_apis/discussion/threadsBatch?api-version=3.0-preview.1" @($threads))
        Write-Output "Changeset $($target.id): $($threads.Count) comment(s) posted, $skipped already there."
    }
    catch {
        Write-Warning "Changeset comments failed ($($_.Exception.Message)). Falling back to the linked work item(s)."
        $workItems = @($target.workItems)
        if ($workItems.Count -eq 0) { throw 'Publish-Findings: changeset has no linked work item to comment on.' }

        foreach ($wi in $workItems) {
            # A work item can live in a different Team Project than the code (e.g. code in qElite,
            # bugs in qManagement), so read its own project first.
            $wiProject = (Invoke-TfsJson GET "$($target.collectionUrl)/_apis/wit/workitems/$wi`?fields=System.TeamProject&api-version=5.0" $null).fields.'System.TeamProject'
            $wiUri = "$($target.collectionUrl)/$([Uri]::EscapeDataString($wiProject))/_apis/wit/workitems/$wi`?api-version=5.0"

            # Latest signature this review left in the work item's History.
            $lastSig = $null
            $updates = Invoke-TfsJson GET "$($target.collectionUrl)/_apis/wit/workitems/$wi/updates?api-version=5.0" $null
            foreach ($update in @($updates.value)) {
                $history = $null
                if ($update.PSObject.Properties['fields'] -and $update.fields.PSObject.Properties['System.History']) {
                    $historyField = $update.fields.'System.History'
                    if ($historyField.PSObject.Properties['newValue']) { $history = "$($historyField.newValue)" }
                }
                if ($history) {
                    $m = [regex]::Match($history, $historyPattern)
                    if ($m.Success) { $lastSig = $m.Groups[1].Value }
                }
            }
            if ($lastSig -eq $reviewSig) {
                Write-Output "Work item ${wi}: already has this review (no change), nothing posted."
                continue
            }

            # The review in the work item's Discussion: shows in History and notifies its followers.
            $patch = @(@{ op = 'add'; path = '/fields/System.History'; value = $discussionHtml })
            try {
                [void](Invoke-TfsJson PATCH $wiUri $patch 'application/json-patch+json')
                Write-Output "Summary posted to work item $wi Discussion."
            }
            catch { Write-Warning "Discussion comment on work item $wi failed: $($_.Exception.Message)" }
        }
    }
}
