<#
    scripts/Merge-Findings.ps1

    Turns the reviewers' raw replies into one findings.json, with fixed rules, so the same review always
    produces the same findings (and Publish-Findings' fingerprints - which include the line - stay
    stable between runs).

    Input: <OutDir>/reviews/*.txt, one file per reviewer, holding that reviewer's reply exactly as
    returned:
        axis.txt, i18n.txt,             -> a ```json``` array already in findings shape
        security.txt, performance.txt
        a11y-labels.txt, a11y-alt.txt,  -> the accessibility-framework area format:
        a11y-aria.txt, a11y-semantics.txt,     Area: / Findings: - file: location: issue: fix:
        a11y-keyboard.txt                      runtimeCheck: ... / Conflicts: / OutOfScope:

    Accessibility mapping (always the same):
        ruleId   = A11Y-<AREA>  (from the file name)
        severity = Warning
        line     = from the line list in `location` (the text before any '(' or ';', which may cite
                   other files): the first number on a changed line, else the first number; a
                   finding with no number is dropped
        message  = issue (+ " Needs a keyboard / screen-reader check." when runtimeCheck: needed)
        fix      = fix
        file     = matched to a `path` in target.json (exact, then by path suffix, then by unique file name)

    Output: <OutDir>/findings.json. Exact duplicates (ruleId + file + line) are dropped, and so is any
    finding (from any reviewer) whose message says it is not a defect or unverified, or whose fix
    starts with "none" or "optional".
#>
param(
    [Parameter(Mandatory)][string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$target = [IO.File]::ReadAllText((Join-Path $OutDir 'target.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$targetPaths = @($target.files | ForEach-Object { "$($_.path)" })
$reviewDir = Join-Path $OutDir 'reviews'
if (-not (Test-Path $reviewDir)) { throw "Merge-Findings: no reviews folder at '$reviewDir'." }

$changedByPath = @{}
foreach ($t in $target.files) { $changedByPath["$($t.path)"] = @($t.changedLines) }

# Wording a reviewer uses for something that needs no change, or that it could not confirm.
$nonDefectPattern = '(?i)\bnot a defect\b|\bno [\w-]+ defect\b|\bunverified\b|\bnot verified\b|\b(could|can) ?not (read|open|verify|confirm|check)\b|\bdid not (open|read|check|inspect|verify)\b|\bwas not opened\b|\bleave (the markup|it|this) as is\b|\bnot worth\b'
$nonDefectFixPattern = '(?i)^\s*(none|optional)\b'

$areaRule = @{
    'a11y-labels'    = 'A11Y-LABELS'
    'a11y-alt'       = 'A11Y-ALT'
    'a11y-aria'      = 'A11Y-ARIA'
    'a11y-semantics' = 'A11Y-SEMANTICS'
    'a11y-keyboard'  = 'A11Y-KEYBOARD'
}

function Resolve-TargetPath([string]$Raw) {
    # Keep the path itself: drop backticks/quotes and anything after the first space or '('.
    $p = ($Raw.Trim().Trim('`', '"', "'") -split '[\s(]', 2)[0] -replace '\\', '/'
    if (-not $p) { return $null }
    if ($targetPaths -contains $p) { return $p }
    $bySuffix = @($targetPaths | Where-Object { $_.EndsWith("/$p") -or $p.EndsWith("/$_") -or $p.EndsWith($_) })
    if ($bySuffix.Count -eq 1) { return $bySuffix[0] }
    $name = Split-Path -Leaf $p
    $byName = @($targetPaths | Where-Object { (Split-Path -Leaf $_) -eq $name })
    if ($byName.Count -eq 1) { return $byName[0] }
    return $null
}

function Get-AnchorLine([string]$Location, [string]$Path) {
    # Only the line list: notes in parentheses or after ';' may cite lines of other files.
    $head = ($Location -split '[(;]', 2)[0]
    if (-not $head.Trim()) { $head = $Location }
    $numbers = @([regex]::Matches($head, '\d+') | ForEach-Object { [int]$_.Value })
    if ($numbers.Count -eq 0) { return $null }
    foreach ($n in $numbers) {
        foreach ($range in @($changedByPath[$Path])) {
            if ($null -eq $range) { continue }
            if ($n -ge $range[0] -and $n -le $range[1]) { return $n }
        }
    }
    return $numbers[0]
}

function Get-JsonBlock([string]$Text) {
    $m = [regex]::Match($Text, '```json\s*(?<j>[\s\S]*?)```')
    $json = if ($m.Success) { $m.Groups['j'].Value } else { $Text.Trim() }
    $items = @()
    foreach ($item in ($json | ConvertFrom-Json)) { $items += $item }
    return , $items
}

# Parses the accessibility-framework "Findings:" list. Values are one line; an indented line without a
# `key:` continues the previous value.
function Get-A11yFindings([string]$Text) {
    $findings = @()
    $current = $null
    $lastKey = $null
    $inFindings = $false
    foreach ($rawLine in ($Text -split "`r?`n")) {
        $line = $rawLine.TrimEnd()
        if ($line -match '^\s*Findings:\s*(\[\s*\])?\s*$') { $inFindings = -not $Matches[1]; continue }
        if ($line -match '^\s*(Conflicts|OutOfScope|moreFindings|remainingCount)\s*:') { $inFindings = $false; continue }
        if (-not $inFindings) { continue }

        if ($line -match '^\s*-\s+file:\s*(?<v>.*)$') {
            if ($current) { $findings += $current }
            $current = [ordered]@{ file = $Matches['v']; location = ''; issue = ''; fix = ''; runtimeCheck = '' }
            $lastKey = 'file'
        }
        elseif ($current -and $line -match '^\s*(?<k>location|issue|fix|translationKey|sharedImpact|runtimeCheck):\s*(?<v>.*)$') {
            $lastKey = $Matches['k']
            if ($current.Contains($lastKey)) { $current[$lastKey] = $Matches['v'] }
        }
        elseif ($current -and $lastKey -and $current.Contains($lastKey) -and $line.Trim()) {
            $current[$lastKey] = "$($current[$lastKey]) $($line.Trim())"
        }
    }
    if ($current) { $findings += $current }
    return , $findings
}

$all = @()
$dropped = @()
foreach ($file in (Get-ChildItem -LiteralPath $reviewDir -Filter '*.txt' | Sort-Object Name)) {
    $name = $file.BaseName.ToLower()
    $text = [IO.File]::ReadAllText($file.FullName, [Text.Encoding]::UTF8)

    if ($areaRule.ContainsKey($name)) {
        foreach ($f in (Get-A11yFindings $text)) {
            $path = Resolve-TargetPath $f.file
            if (-not $path) { $dropped += "${name}: file '$($f.file)' not in this review"; continue }
            $num = Get-AnchorLine "$($f.location)" $path
            if ($null -eq $num) { $dropped += "${name}: no line number in location '$($f.location)'"; continue }
            $message = "$($f.issue)".Trim()
            if ("$($f.runtimeCheck)" -match '^\s*needed') { $message = "$message Needs a keyboard / screen-reader check." }
            $all += [pscustomobject]@{
                ruleId   = $areaRule[$name]
                severity = 'Warning'
                file     = $path
                line     = $num
                message  = $message
                fix      = "$($f.fix)".Trim()
                reviewer = $name
            }
        }
    }
    else {
        foreach ($f in (Get-JsonBlock $text)) {
            $path = Resolve-TargetPath "$($f.file)"
            if (-not $path) { $dropped += "${name}: file '$($f.file)' not in this review"; continue }
            $all += [pscustomobject]@{
                ruleId   = "$($f.ruleId)"
                severity = "$($f.severity)"
                file     = $path
                line     = [int]$f.line
                message  = "$($f.message)".Trim()
                fix      = "$($f.fix)".Trim()
                reviewer = $name
            }
        }
    }
}

# Exact duplicates: keep the first (files are read in name order, so this is stable).
$seen = @{}
$merged = @()
foreach ($f in $all) {
    # The message decides whether it is a defect; doubt in the fix is only about how to fix it.
    if ($f.message -match $nonDefectPattern -or $f.fix -match $nonDefectFixPattern) {
        $dropped += "$($f.reviewer): $($f.ruleId) at $($f.file):$($f.line) - its own text says it is not a defect, optional or unverified"
        continue
    }
    $key = "$($f.ruleId)|$($f.file)|$($f.line)"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $merged += $f
}

[IO.File]::WriteAllText((Join-Path $OutDir 'findings.json'), (ConvertTo-Json -InputObject @($merged) -Depth 5), $utf8NoBom)

foreach ($group in ($merged | Group-Object reviewer)) { Write-Output ("{0}: {1} finding(s)" -f $group.Name, $group.Count) }
Write-Output "Merged: $($merged.Count) finding(s) -> $(Join-Path $OutDir 'findings.json')"
foreach ($d in $dropped) { Write-Warning "Dropped - $d" }
