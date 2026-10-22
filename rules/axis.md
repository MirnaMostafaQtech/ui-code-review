# AXIS (SCSS / CSS and class names)

The AXIS rules ship with this plugin as the **axis-scss** skill, in `skills/axis-scss/`. The reviewer
reads it and cites its rule IDs (`R-01`..`R-36`, `R-COMP-*`, ...) as-is. Paths below are relative to
`skills/axis-scss/`.

| What | Where |
|---|---|
| Entry point | `SKILL.md` |
| All rules with priority | `docs/guides/rules.md` |
| PR review checklist | `docs/guides/review-checklist.md` |
| Stylesheet accessibility | `docs/guides/accessibility.md` |
| Segment rules | `docs/segments/<segment>.md` |

## How the review uses it

- Files: `.scss` / `.css` for stylesheet rules; `.html`, `.cshtml`, `.ts`, `.js` for class-name rules
  (R-01, R-02, R-03, R-04, R-27). Skip `packages/` and minified or compiled CSS.
- Keep only findings on lines in `changedLines`.
- Severity: AXIS `Critical` → **Error**, `High` → **Warning**, `Medium` → **Info**.
