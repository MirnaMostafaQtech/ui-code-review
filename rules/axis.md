# AXIS (SCSS / CSS and class names)

ui-code-review has no AXIS rules of its own. The rules live in the **axis-scss** skill, which must be
installed. The reviewer reads the skill and cites its rule IDs (`R-01`..`R-36`, `R-COMP-*`, ...) as-is.

| What | Where |
|---|---|
| Entry point | `axis-scss` skill → `SKILL.md` |
| All rules with priority | `docs/guides/rules.md` |
| PR review checklist | `docs/guides/review-checklist.md` |
| Stylesheet accessibility | `docs/guides/accessibility.md` |
| Segment rules | `docs/segments/<segment>.md` |

## How the review uses it

- Files: `.scss` / `.css` for stylesheet rules; `.html`, `.cshtml`, `.ts`, `.js` for class-name rules
  (R-01, R-02, R-03, R-04, R-27). Skip `packages/` and minified or compiled CSS.
- Keep only findings on lines in `changedLines`.
- Severity: AXIS `Critical` → **Error**, `High` → **Warning**, `Medium` → **Info**.
