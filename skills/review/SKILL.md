---
name: review
description: UI code review of a Git Pull Request or a TFVC changeset on the team's TFS / Azure DevOps Server. Reviews only the changed lines of UI files (SCSS/CSS, Angular templates and TypeScript, Razor views, scripts) against AXIS (R-xx), localization (I18N-xx), UI security (SEC-xx), images and assets (PERF-xx) and the accessibility rules (A11Y-*), shows the comments for approval, then posts them on the PR or changeset. Use when asked to review, check or comment on a PR or changeset's UI code.
argument-hint: pr <id> | changeset <id> [--collection <url>] [--dry-run]
---

# /ui-code-review:review

**Usage**
```
/ui-code-review:review pr <id> [--dry-run]
/ui-code-review:review changeset <id> [--collection <url>] [--dry-run]
```
- `pr <id>`: run from inside the Git repository the PR belongs to.
- `changeset <id>`: needs the TFVC collection URL: `--collection`, else `$env:UI_REVIEW_TFVC_COLLECTION`,
  else ask the user once (for example `https://tfs25.alqemam.com/qCollection`).
- `--dry-run`: show the preview and stop; don't ask to post.

Nothing is ever posted without the user's yes: Step 5 always shows the comments first and asks.

Requires `SONARTOOLKIT_TFS_PAT` (same token as q-ai-quality-review). The AXIS rules
(`skills/axis-scss`) and the accessibility agents (`agents/accessibility-*.md`, `references/`) ship
inside this plugin. Never print or pass the token on a command line; the scripts read it from the
environment.

All scripts are Windows PowerShell; run them as
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/<script>.ps1" ...`.

## Step 1: Build the review target

Output folder: `<OutDir>` = `%TEMP%\ui-code-review\<kind>-<id>-<yyyyMMdd-HHmmss>`, a new folder for every
run (use the current time). Never reuse or delete another run's folder: another review of the same
target may be using it.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/Get-ReviewTarget.ps1" -Kind pr -Id <id> -RepoRoot "<repo root>" -OutDir "<OutDir>"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/Get-ReviewTarget.ps1" -Kind changeset -Id <id> -CollectionUrl "<collection url>" -OutDir "<OutDir>"
```

**One review per target at a time.** The script takes a lock for the PR / changeset. If it fails with
`REVIEW-LOCKED`, another review of the same target is running: tell the user when it started and stop.
Don't retry and don't touch that run's folder. Run again with `-Force` only if the user confirms that
review is no longer running (for example a window that was closed mid-review). A lock older than 2
hours is taken over automatically.

From here on, the review holds the lock until it ends. **Every way the review ends** (Step 5 done,
the user declines, a large change they don't want, an error after Step 1) finishes with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/Release-ReviewLock.ps1" -OutDir "<OutDir>"
```

Read `<OutDir>/target.json`. Each entry in `files` has `path` (repo or server path), `contentFile` (the
full new file on disk) and `changedLines` (new-side line ranges). If `files` is empty, tell the user
there are no changed UI files and stop (the script has already released the lock).

**Large change:** if `files` has more than 40 entries, tell the user how many UI files are in scope and
ask whether to review all of them before going on. If they say no, release the lock and stop.

## Step 2: Decide which reviewers run

| Reviewer | Files it gets |
|---|---|
| `ui-code-review:reviewer-axis` | every `role: ui` file in `files` (it skips what AXIS doesn't cover) |
| `ui-code-review:reviewer-i18n` | `role: ui` files that are `.html`, `.cshtml`, `.ts` or `.js`, and every `role: translation` file. Skip it when there are none. |
| `ui-code-review:reviewer-security` | `role: ui` files that are `.html`, `.cshtml`, `.ts` or `.js` and match the security pre-scan below |
| `ui-code-review:reviewer-performance` | `role: ui` files that are `.html`, `.cshtml`, `.scss`, `.css` or `.ts` and match the performance pre-scan below |
| accessibility areas | markup files (`.html`, `.cshtml`) and Angular component `.ts`, per the pre-scan below |

**Security and performance pre-scan.** Grep each candidate file's `contentFile` (case-insensitive) and
pass the reviewer only the files that match; skip the reviewer when none do. Always include a file
named `environment*.ts` in the security review.

| Reviewer | Run on a file that contains |
|---|---|
| security | `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `bypassSecurityTrust`, `Html.Raw`, `HtmlString`, `eval(`, `new Function`, `setTimeout('`, `setInterval('`, `javascript:`, `localStorage`, `sessionStorage`, `document.cookie`, `target="_blank"`, `window.open`, `http://`, `<script`, `<iframe`, `BeginForm`, `.html(`, `$.ajax`, `$.post`, `apiKey`, `api_key`, `secret`, `password`, `token`, `connectionString` |
| performance | `<img`, `ngSrc`, `<picture`, `<video`, `<iframe`, `@font-face`, `@import url`, `url(`, `background-image`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` |

**Accessibility pre-scan.** Grep each markup file's `contentFile` and run only the areas that match
something; pass each area only the files that matched it:

| Area agent | Run when the file contains |
|---|---|
| `ui-code-review:accessibility-labels` | `<input`, `<select`, `<textarea`, `formControlName`, `asp-for`, `<label` |
| `ui-code-review:accessibility-alt` | `<img`, `<svg`, `<i `, `icon`, `<mat-icon`, `<fa-icon` |
| `ui-code-review:accessibility-aria` | `aria-`, `role=`, `[attr.`, `modal`, `dialog`, `toast`, `invalid` |
| `ui-code-review:accessibility-semantics` | `(click)`, `onclick`, `<table`, `<ul`, `<ol`, `<h1`..`<h6`, `<form`, `href="#"`, `javascript:` |
| `ui-code-review:accessibility-keyboard` | `tabindex`, `(click)`, `onclick`, `keydown`, `keyup`, `modal`, `dropdown` |

Stack for each file: Angular for `.html` / `.ts` in an Angular app; `ASP.NET MVC` for `.cshtml` and
MVC scripts.

## Step 3: Run the reviewers in parallel

Launch every selected reviewer **in one message** (they are independent).

**AXIS:** prompt contains
- `AXIS docs: ${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs` (as an absolute path; if the folder
  doesn't exist, skip AXIS and say so in the final answer)
- `Files:` the selected entries as JSON (`path`, `contentFile`, `changedLines`).

**I18N:** prompt contains
- `Rules: ${CLAUDE_PLUGIN_ROOT}/rules/i18n.md` (as an absolute path)
- `Files:` the selected entries as JSON (`path`, `role`, `contentFile`, `changedLines`)
- `Translations:` the `translations` array of target.json as JSON (`path`, `contentFile`), or `[]`.

**Security:** prompt contains
- `Rules: ${CLAUDE_PLUGIN_ROOT}/rules/security.md` (as an absolute path)
- `Files:` the selected entries as JSON (`path`, `contentFile`, `changedLines`)
- `Context files (read-only):` every other `role: ui` entry in `files` (`path` and `contentFile`).

**Performance:** prompt contains
- `Rules: ${CLAUDE_PLUGIN_ROOT}/rules/performance.md` (as an absolute path)
- `Files:` the selected entries as JSON (`path`, `contentFile`, `changedLines`)
- `Assets:` the `assets` array of target.json as JSON (`path`, `sizeBytes`), or `[]`.

**Accessibility areas:** prompt contains, per file: `Stack: Angular` or `Stack: ASP.NET MVC`, the
original `path`, the `contentFile` to read, and its `changedLines`. Also list every other entry in
`files` (`path` and `contentFile`) under `Context files (read-only):`, so the agent can open a
component's `.ts`, or a child component, before reporting. Tell the agent:

"Audit only these files. Report only findings on the changed lines.
- Under `Findings:`, list only defects that need a code change. Put observations, 'no defect',
  optional or low-priority suggestions under `OutOfScope:`.
- If a finding depends on code in another file, read that file first (from the files above or the
  context files). If you can't open the file that decides it, put the finding under `OutOfScope:`.
- Give `location` as one line number in contentFile: the line of the element at fault, not the start
  of the block around it. If the same defect is on several lines, give one finding per line.
- Text written in code instead of a translation key, or a missing translation, is the I18N reviewer's:
  don't report it. Report a missing or wrong accessible name only when no text, translated or not,
  provides it."

## Step 4: Merge the findings

Don't convert or edit the replies yourself. Save each reviewer's reply **exactly as returned**
(unchanged, complete) to `<OutDir>/reviews/<name>.txt`:

| Reviewer | File |
|---|---|
| reviewer-axis | `axis.txt` |
| reviewer-i18n | `i18n.txt` |
| reviewer-security | `security.txt` |
| reviewer-performance | `performance.txt` |
| accessibility-labels / alt / aria / semantics / keyboard | `a11y-labels.txt` / `a11y-alt.txt` / `a11y-aria.txt` / `a11y-semantics.txt` / `a11y-keyboard.txt` |

Then build `findings.json` with fixed rules (same replies → same findings → no duplicate comments on a
re-run):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/Merge-Findings.ps1" -OutDir "<OutDir>"
```

It prints the count per reviewer and a warning for every finding it had to drop (file not in the
review, no line number, a message that calls the finding not a defect or unverified, or a fix that
starts with "none" or "optional"); mention those drops to the user in Step 5.

## Step 5: Preview, ask, then publish

**5a. Preview (always).** Run with `-DryRun`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/scripts/Publish-Findings.ps1" -TargetFile "<OutDir>\target.json" -FindingsFile "<OutDir>\findings.json" -DryRun
```

It keeps only findings on changed lines and writes `<OutDir>/comments.json` (the inline comments
exactly as they would be posted) and `<OutDir>/report.md` (the summary comment). Show the user:
- every inline comment: `file:line`, rule, severity, and its text (drop the `<!-- ui-review:... -->`
  fingerprints), Errors first;
- the summary counts, and the findings that appear in the summary only (Info, and Warnings beyond the
  limit).

With `--dry-run`, release the lock and stop here. Otherwise ask the user whether to post, and where
(the PR / changeset); if they decide not to post, release the lock and stop.
If they want changes first (drop a comment, change wording), edit `<OutDir>/findings.json` (not the
reviews), run 5a again and show the new preview.

**5b. Post (only after the user says yes).** Run the same command without `-DryRun`. It posts:
- **PR:** an inline comment per line + one summary comment. Comments already on the PR are not
  repeated; threads whose finding is gone are marked Fixed.
- **Changeset:** a comment per line + a summary on the changeset. If the server refuses, it falls back
  to the changeset's linked work item(s): one comment in the work item's Discussion listing every
  finding. No file is attached.

Nothing is posted twice: a re-run skips comments already there, and posts a new summary / work item
comment only when the findings changed.

## Step 6: Release the lock and answer the user

Release the lock (Step 1). Then say where the comments went (PR link / changeset link / work item) and how many were
posted or already there, and list anything skipped (a reviewer that didn't run, comments that
failed to post). Keep it short; the details are in the comments.
