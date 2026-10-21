# ui-code-review

A Claude Code plugin that reviews the UI changes in a Git Pull Request or a TFVC changeset on the
team's TFS / Azure DevOps Server, and posts the findings as review comments.

It reviews **only the changed lines** of UI files against three rule sets:

| Rule set | Rule IDs | Source |
|---|---|---|
| AXIS (SCSS / CSS and class names) | `R-xx` | the `axis-scss` skill |
| Angular templates and TypeScript | `NG-xx` | [`rules/angular.md`](rules/angular.md) |
| Accessibility (Angular and Razor) | `A11Y-*` | the `accessibility-framework` plugin |

Nothing is posted until you approve the preview.

## Requirements

- Windows PowerShell 5.1 and Claude Code.
- The `axis-scss` skill in `%USERPROFILE%\.claude\skills\axis-scss`.
- The `accessibility-framework` plugin, v1.2.0 or newer.
- `SONARTOOLKIT_TFS_PAT`: a TFS Personal Access Token in an environment variable (the same token as
  q-ai-quality-review). The scripts read it from the environment; it is never passed on a command line.
- For a PR: a local Git clone of the repository, with an `https://` TFS remote named `origin`.
- For a changeset: the TFVC collection URL, for example `https://tfs25.alqemam.com/GCollection`.

## Install

From the folder that holds `.claude-plugin/marketplace.json` (the folder above this one):

```
/plugin marketplace add <path to that folder>
/plugin install ui-code-review@ui-review-local
```

## Use

```
/ui-code-review:review pr <id> [--dry-run]
/ui-code-review:review changeset <id> [--collection <url>] [--dry-run]
```

- Run `pr` from inside the repository's local clone.
- For `changeset`, the collection comes from `--collection`, else `UI_REVIEW_TFVC_COLLECTION`, else the
  review asks once.
- `--dry-run` shows the preview and stops.

## How it works

```
1. Build target   →  2. Pick reviewers  →  3. Review (parallel)  →  4. Merge  →  5. Preview → approve → post
Get-ReviewTarget     by file type and       AXIS, Angular,          Merge-       Publish-Findings
                     a11y pre-scan          a11y areas              Findings
```

All working files go to `%TEMP%\ui-code-review\<pr|changeset>-<id>\`.

### 1. Build the review target: `scripts/Get-ReviewTarget.ps1`

- **PR:** reads the PR from the server, fetches its source and target branches, and diffs the merge
  base against the PR head.
- **Changeset:** reads the changeset's files and their previous versions from the server.

It keeps only UI files (`.html`, `.scss`, `.css`, `.ts`, `.cshtml`, `.js`). It skips minified files,
`.spec.ts`, `.d.ts`, and anything under `node_modules`, `dist`, `bin` or `obj`. The output is:

- `target.json`: each file's `path`, `contentFile` (the full new file) and `changedLines` (new-side line
  ranges).
- `files\`: the full new content of each file.

If no UI file changed, the review stops. If more than 40 changed, it asks before going on.

### 2. Pick the reviewers

| Reviewer | Gets |
|---|---|
| `reviewer-axis` | every file (stylesheet rules for `.scss` / `.css`, class-name rules for markup and scripts) |
| `reviewer-angular` | Angular `.ts` / `.html` only |
| accessibility areas | markup files and Angular component `.ts`, only for the areas a quick grep matches |

The accessibility pre-scan runs an area only when a file contains something it covers. For example,
Labels needs `<input`, `<select`, `<label` and the like, and Alt needs `<img`, `<svg`, icons.

### 3. Review

All selected reviewers run at the same time. They are read-only: they can read files but never edit
them. Each one:

- checks the changed lines only;
- reports only real defects that need a change, and only ones it could confirm. If a finding depends
  on another file, it reads that file first. Accessibility agents get the other files in the review as
  read-only context for this.
- gives one exact line per finding.

AXIS and Angular reply with a JSON list; accessibility agents reply in the accessibility-framework area
format. Each reply is saved unchanged to `reviews\<name>.txt`.

### 4. Merge: `scripts/Merge-Findings.ps1`

Turns the replies into one `findings.json` with fixed rules, so the same replies always give the same
findings:

- Accessibility findings become `A11Y-<AREA>` Warnings. When the agent says a runtime check is needed,
  the comment says so.
- The line is the first line in the finding's `location` that is a changed line. Notes in parentheses
  or after `;` are ignored, because they often point at other files.
- A finding is dropped, with a warning, when:
  - its file is not in the review;
  - it has no line number;
  - its message says it is not a defect or unverified;
  - its fix starts with "none" or "optional".
- Exact duplicates (same rule, file and line) are kept once.

### 5. Preview, approve, post: `scripts/Publish-Findings.ps1`

With `-DryRun` it writes the preview and posts nothing:

- `comments.json`: the inline comments exactly as they would be posted.
- `report.md`: the summary comment.

Which findings become comments:

- Only findings on changed lines are kept.
- Every Error gets an inline comment.
- Warnings get inline comments up to `-MaxWarnings` (15 by default). Any beyond that appear in the
  summary only.
- Info appears in the summary only.
- Findings on the same line share one comment.

The review shows you the preview. You can drop a comment or change its wording, which edits
`findings.json`, and then see the preview again. It posts only after you say yes:

- **PR:** one inline thread per line on the PR diff, plus one summary thread.
- **Changeset:** one comment per line, plus a summary on the changeset. If the server refuses
  changeset comments, it posts one comment in the linked work item's Discussion instead, listing every
  finding.

### Re-runs

Every comment carries a hidden fingerprint (`<!-- ui-review:... -->`), made from the rule, the file
path and the text of the line. It does not use the line number, so moving a line does not create a new
comment. On a re-run:

- comments already on the PR or changeset are not posted again;
- on a PR, an active thread whose finding is gone is marked **Fixed**. Threads someone already resolved
  are left alone.
- the PR summary is edited in place when the findings change. A new changeset or work item summary is
  posted only when the findings change.

## Files

```
ui-code-review/
├─ .claude-plugin/plugin.json     plugin name and version
├─ skills/review/SKILL.md         the /ui-code-review:review steps Claude follows
├─ agents/
│  ├─ reviewer-axis.md            AXIS reviewer (read-only)
│  └─ reviewer-angular.md         Angular reviewer (read-only)
├─ rules/
│  ├─ angular.md                  the NG-xx rules, severities and fixes
│  ├─ axis.md                     how AXIS is applied (rules live in the axis-scss skill)
│  └─ a11y.md                     how the accessibility areas are applied
├─ scripts/
│  ├─ Get-ReviewTarget.ps1        step 1
│  ├─ Merge-Findings.ps1          step 4
│  └─ Publish-Findings.ps1        step 5
├─ scm-adapters/                  Git, TFVC, PR and work item API helpers
└─ common/tfs-auth.ps1            TFS PAT authentication header
```

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `not a git repository` on `pr` | Run the review from inside the repository's local clone. |
| Work item not found / 404 | The work item is in another collection. Use the right one in `--collection`. |
| `401 Unauthorized` on changeset comments | The PAT can't comment on changesets in that collection. The review falls back to the work item; to comment on the changeset itself, extend the PAT's permissions. |
| AXIS skipped | The `axis-scss` skill folder is missing. Install the skill. |
| An accessibility area skipped | The `accessibility-framework` plugin is missing or older than v1.2.0. |

## Known limits

- The reviewers are AI agents, so two runs on the same code can find different things. Check the
  preview before posting.
- Accessibility findings that depend on runtime behaviour (focus, keyboard) say "Needs a keyboard /
  screen-reader check". Confirm them in the running app.
