---
name: axis-scss
description: AXIS (Architecture for eXtensible Intelligent Styles), the UI team's SCSS architecture standard (ITCSS + SMACSS + Atomic Design + BEM). Covers segment structure and order, class prefixes (o-, c-, m-, ctrl-, l-, p-, u-, is-/has-/js-), BEM naming, units, logical properties, color tokens, imports and the rules R-01..R-36. Use when writing, changing or reviewing SCSS/CSS, class names in Angular templates, or TypeScript that adds, removes or queries CSS classes.
---

# AXIS: SCSS architecture standard

The full standard (v2.0.0) is in `docs/` next to this file. Read the parts that apply. Don't guess
a rule from memory.

| What | File |
|---|---|
| Overview, segment order, prefixes | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/README.md` |
| **All rules R-01..R-36 (required / banned, with severity)** | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/rules.md` |
| **Review checklist for PRs** | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/review-checklist.md` |
| Class naming | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/naming-conventions.md` |
| Best practices, import order | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/best-practices.md` |
| Accessibility | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/accessibility.md` |
| Performance | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/guides/performance.md` |
| Per-segment rules (`R-OBJ-*`, `R-COMP-*`, `R-LAY-*`, `R-MOD-*`, ...) | `${CLAUDE_PLUGIN_ROOT}/skills/axis-scss/docs/segments/<segment>.md` |

Each project keeps its SCSS wherever it chooses (for example `src/assets/scss` in Angular projects, or `wwwroot/Content/styles` in ASP.NET projects).

## Rules that matter most when reviewing

**In templates (`.html`) and TypeScript:**
- **R-01:** every authored class carries its segment prefix (`o-`, `c-`, `m-`, `ctrl-`, `l-`,
  `p-`, `u-`) or a state prefix (`is-`, `has-`, `js-`).
- **R-03:** script code adds, removes or queries `js-*` classes only, never `c-`, `m-`, `ctrl-`,
  `l-`, `p-`, `u-`, `is-*` or `has-*`. In Angular this includes `[class.x]`, `[ngClass]`,
  `classList` and `Renderer2.addClass/removeClass` driven by component state.
- **R-04 / R-27:** BEM block and element naming, with no `--` modifier. A state fixed at first
  render is `is-*`/`has-*`; a state that changes at runtime is `js-*`.
- **R-02:** a `js-*` class used only as a script lookup target carries no styles.

**In SCSS:**
- **R-05:** max nesting depth 4 (`@media` not counted).
- **R-06 / R-25 / R-26:** class selectors only outside Generic/Elements. No ID selectors anywhere,
  and attribute selectors only where the rules allow them.
- **R-08 / R-09 / R-12:** `rem` for absolute lengths, logical properties only (`margin-inline-end`,
  not `margin-right`), max 4 decimal places.
- **R-10 / R-11:** colors come from CSS custom properties, and shades are authored in HSL. No hex,
  `rgb()` or named colors outside the theme token files.
- **R-20 / R-21 / R-22 / R-23:** no `!important`, no `@extend` except of a `%placeholder`, no
  duplicate selectors or properties, no empty blocks.
- **R-24:** a `u-` utility sets exactly one property.
- **R-32:** `@charset "UTF-8";` is the first line of every SCSS/CSS file, except under `packages/`.

When reporting a violation, cite the rule ID (for example `R-09`) so the developer can look it up.
