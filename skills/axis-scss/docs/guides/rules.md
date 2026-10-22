# Rules

[← Back to README](../README.md)

Each rule below has a stable ID. Cite it in review rather than quoting the rule, and keep it stable — an ID is never reused, and a withdrawn rule keeps its number with a note.

| # | Section                                                 | What it covers                                                                                                           |
|---|---------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| 1 | [Naming and Structure](#naming-and-structure)           | Prefixes, BEM naming, nesting depth, selector scope, token names                                                         |
| 2 | [Units and Values](#units-and-values)                   | `rem` lengths and breakpoints, logical properties, color tokens, precision                                               |
| 3 | [Architecture](#architecture)                           | Segment boundaries and `:root`-only token files                                                                          |
| 4 | [Code Quality](#code-quality)                           | Forbidden patterns, duplicate or empty rules                                                                             |
| 5 | [State Management](#state-management)                   | The `is-`/`has-`/`js-` prefix rule and how every state class in this standard sorts                                      |
| 6 | [Imports Isolation and Theme](#imports-isolation-and-theme) | The placement rule, no double import, vendor scoping, control module isolation, `@charset`, packages, `custom.theme.css` |

---

## Naming and Structure
| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-01 | ✅          | Every class the project authors carries its segment prefix (`c-`, `o-`, `m-`, `ctrl-`, `l-`, `p-`, `u-`), a state prefix (`is-`, `has-`, `js-`), or, for a variant class, a prefix the project chooses; the standard names no variant prefix.<br>Exception: a vendor or global class the project does not own keeps its own name.<br>Exception: a vendor override is written on an `m-` class in its library module per R-30 and R-36.<br>Exception: vendor-generated markup outside the project's own markup, and a global, non-vendor class the project does not own, are overridden in `common/_classes.common.scss` | Critical |
| R-02 | ✅          | A `js-*` class that carries a state is styled like any other state class. A `js-*` class that exists only as a script's lookup target carries no styles — styling one makes the markup impossible to refactor without breaking the design | Critical |
| R-03 | ✅          | JavaScript adds, removes and queries `js-*` classes only — never `c-`, `m-`, `ctrl-`, `l-`, `p-`, `u-`, `is-*` or `has-*`. A class a script changes is `js-*` by definition. Where existing markup has a script touching any other prefix, treat it as a migration item rather than a rule already met | Critical |
| R-04 | ✅          | Use BEM (block, element) naming for objects, components, modules, layouts and pages; use `is-*`/`has-*` for a state fixed at first load and `js-*` for a state JavaScript changes — the `--` modifier syntax is not used | High |
| R-05 | ✅          | Maximum nesting depth: 4 levels, counting the root selector as level 1. Only `@media` is not counted; every other nested rule, including `@supports` and `@container`, is. Every nested selector counts, whether written `&__el`, `&.state` or a descendant: `.c-card { &__field { &.js-error { .c-card__label {} } } }` is 4 levels | Critical |
| R-06 | ✅          | Outside the Generic and Elements segments, use class selectors only — never element (type) selectors.<br>Exception: `body` in `theme/custom.theme.css` (R-34).<br>Exception: `:root` in the color token files (R-19).<br>Exception: attribute selectors where R-26 permits them | Critical |
| R-07 | ✅          | Name tokens by role, or by family and step — `--primary-500`, `--neutral-900` — never by a literal appearance such as `--blue` or `--light-gray`. The names themselves are the project's, and the shape of a token name is in [Theme](../segments/theme.md#token-sets-and-their-values) | Critical |

## Units and Values
| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-08 | ✅          | Author absolute lengths in `rem`. Other units are permitted where they fit: `%`, `vw`/`vh`/`dvh`/`svh`, `fr`, `ch` and unitless values where they express a ratio or a viewport; `em` only for sizes relative to the element's own font size; `ms`/`s` for time. A raw `px` value is permitted in two cases only: `1px` (a hairline border, for example), and a breakpoint value in `settings/_breakpoints.settings.scss` where a project must use px. Where the project ships the `px()` function, use it to convert a px figure from a design; where it does not, write the `rem` value directly. Breakpoint values are authored in `rem` too, each with its px equivalent in a comment. Prefer the range syntax — `(width >= 48rem)` and `(width < 48rem)` — which has no gap, over `max-width`, which stops `0.0625rem` below the matching `min-width`; the range syntax is preferred, not required, so `min-width` and `max-width` stay allowed. | Critical |
| R-09 | ✅          | Use logical properties only (no `margin-right`, use `margin-inline-end`) | Critical |
| R-10 | ✅          | Outside the Theme token files (`colors.base.theme.css`, `colors.palette.theme.css`), colors come from CSS custom properties — no hex, `rgb()`/`hsl()` literal or named color. The keywords `transparent` and `currentColor` are permitted | Critical |
| R-11 | ✅          | Every shade is authored in HSL, neutrals included — no hex exception | Critical |
| R-12 | ✅          | Maximum precision: 4 decimal places (so `0.0625rem` is valid) | Critical |

## Architecture
| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-13 | ✅          | Keep Settings/Tools free of CSS output | Critical |
| R-14 | ✅          | Keep Components self-contained with `c-` prefix | Critical |
| R-15 | ✅          | Keep Modules composite with `m-` prefix; a library module (`.<library>.module.scss`) also carries `m-`, and a control module carries `ctrl-` | Critical |
| R-16 | ✅          | Keep Layout to what surrounds page content — header, navbar, side menu, footer — with `l-` prefix | Critical |
| R-17 | ✅          | Keep Pages minimal with `p-` prefix | Critical |
| R-18 | ✅          | Keep Utilities single-purpose with `u-` prefix | Critical |
| R-19 | ✅          | In `theme/colors/colors.base.theme.css` and `theme/colors/colors.palette.theme.css`, `:root` is the only selector permitted — these files declare custom properties and nothing else. A `:root` block may be wrapped in an at-rule such as `@media (prefers-contrast: more)`; no other selector, including a class or an element selector, may appear.<br>`theme/fonts/fonts.theme.css` holds only `@font-face` rules and `:root` blocks | Critical |

## Code Quality
| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-20 | ❌          | The `!important` flag.<br>Exception: the one Generic `@media (prefers-reduced-motion: reduce)` block | Critical |
| R-21 | ❌          | `@extend`.<br>Exception: `@extend` of a `%placeholder` selector | Critical |
| R-22 | ❌          | Duplicate selectors or properties | Critical |
| R-23 | ❌          | Empty blocks and empty comments | Critical |
| R-24 | ✅          | A utility class sets exactly one CSS property.<br>Exception: a documented, named list of utilities that serve accessibility or layout purposes only — currently `u-container`, `u-sr-only` and `u-not-sr-only` — which may set more than one property as a deliberate, documented exception, not a violation | Critical |
| R-25 | ❌          | ID selectors anywhere, including in the Generic and Elements segments — no segment is exempt | Critical |
| R-26 | ❌          | Attribute selectors.<br>Exception: in the Generic and Elements segments.<br>Exception: in `common/_attributes.common.scss`, for elements belonging to third-party frameworks, plugins or libraries (for example Bootstrap) that cannot be given project class names (vendor markup).<br>Exception: `[aria-*]` or `:is([dir="rtl"])` chained onto a project class anywhere | Critical |

## State Management
| Prefix  | Purpose                                                                 | Examples                                          |
|---------|-------------------------------------------------------------------------|---------------------------------------------------|
| `is-*`  | Boolean state, fixed at first load and never changed by a script        | `.is-current`, `.is-active`                       |
| `has-*` | Presence state, fixed at first load and never changed by a script       | `.has-icon`                                       |
| `js-*`  | Anything JavaScript changes at runtime, plus any class a script queries | `.js-active`, `.js-disabled`, `.js-modal-trigger` |

| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-27 | ✅          | The rule that decides the prefix: **a class written into the markup when the page is built, and never changed from JavaScript afterwards, is `is-*` or `has-*`; a class JavaScript changes is `js-*`** | Critical |

Every state class in this standard sorts as follows.

| Class           | Decided by | Set by                                                            |
|-----------------|------------|-------------------------------------------------------------------|
| `is-current`    | First load | Markup; the server marks the current item, and no script changes it |
| `is-active`     | First load | Markup; set when the page is built, and no script changes it      |
| `has-icon`      | First load | Markup; no script changes it                                      |
| `js-active`     | JavaScript | A script adds and removes it                                      |
| `js-disabled`   | JavaScript | A script adds and removes it                                      |
| `js-loading`    | JavaScript | A script adds it when a request starts and removes it on response |
| `js-error`      | JavaScript | A script adds it to a field wrapper when validation fails         |
| `js-invalid`    | JavaScript | A script adds it to the input itself when validation fails        |
| `js-open`       | JavaScript | A script adds it when a modal or panel opens                      |

SMACSS as published names the last one `is-open`; under this architecture's prefix rule a script changes it, so it is `js-open` here. A state that is both rendered at first load and changed later by a script is `js-*`, because a script changes it.

Variant classes — a primary or a small button, for example — are not state, and this rule does not cover them. A variant class carries a prefix the project chooses (R-01); the standard names no variant. Where this documentation shows one, it is marked project-specific.

## Imports Isolation and Theme
| ID   | Do / Don't | Description | Priority |
|------|------------|-------------|----------|
| R-28 | ✅          | An object, component or module used by five or more page entries, or needed by any layout, is imported through the matching `common/` aggregator.<br>An object, component or module used by fewer than five page entries, and needed by no layout, is imported by each of those page entries directly.<br>A layout entry never `@use`s an object, component or module itself; the `common/` aggregator is its only route.<br>Only a module may `@use` a component; that component then counts as used by every page that uses the module. Objects and components never `@use` another object, component or module.<br>See [Common — Placement Rule](../segments/common.md#placement-rule) | Critical |
| R-29 | ❌          | A file imported through a `common/` aggregator is also `@use`d by a page entry or a layout entry — that ships it twice on the same page. See [Common — Placement Rule](../segments/common.md#placement-rule) | Critical |
| R-30 | ✅          | A vendor component is overridden through an `m-` class placed on the vendor element beside the vendor class; the rule targets the `m-` class, and the vendor's inner parts (such as `.modal-header`) are nested inside it.<br>Exception: when the vendor element cannot take a class, or the vendor selector out-specifies the `m-` class, the vendor selector (`.btn`, `.modal`, `.dropdown-menu`, `.form-control`) is nested inside an owned `m-` wrapper block.<br>Exception: an element the vendor's JS generates outside the project's markup (for example a Bootstrap tooltip appended to `<body>`) cannot carry an `m-` class and is overridden in `common/_classes.common.scss`.<br>A bare top-level vendor selector is not permitted outside these exceptions. See [Modules](../segments/modules.md#vendor-override-scoping) | High |
| R-31 | ✅          | A control module is isolated from the project. Its styles live only in its own `_<name>.control.module.scss`, inside its `ctrl-` block. No other file styles or overrides a `ctrl-` block.<br>A library module is a component of a linked framework or library (a Bootstrap modal, Swiper). A control module is a standalone JS widget with its own markup (a datepicker, a Select2-style list, a data grid). Its SCSS lives in `modules/`; if the widget comes with a CSS file, that CSS is converted into SCSS in its control module file. `packages/` holds only external libraries and frameworks.<br>A popup the widget appends outside its `ctrl-` block is styled in the same control module file, on a second class set passed through the widget's options (`.ctrl-<name>-popup`).<br>See [Modules](../segments/modules.md) | Critical |
| R-32 | ✅          | `@charset "UTF-8";` is the first line of every SCSS and CSS file in the project — entry files and partials alike, except files under `packages/`, which ship unchanged (R-33). See [Best Practices](./best-practices.md#import-order) | Critical |
| R-33 | ❌          | A file under `packages/` is never compiled, never `@use`d or `@import`ed from SCSS, and its content is never modified — it ships exactly as the library published it, renamed to `<library><major>.<locale>.min.css` inside `packages/<library><version>/`. See [Packages](../segments/packages.md) | Critical |
| R-34 | ✅          | `theme/custom.theme.css` holds theme-specific customizations, such as background overrides and brand-asset positioning.<br>Any class selector is permitted (`c-`, `m-`, `ctrl-`, `p-`, `l-`, `u-`), and `body` is the only element selector allowed (R-06). The one other limit is that it never defines a custom property (R-35).<br>See [Theme — custom.theme.css](../segments/theme.md#the-custom-theme-file) | Critical |
| R-35 | ❌          | `theme/custom.theme.css` defines a custom property — colors and fonts already have one source of truth in the Theme token files, and a token defined there would be a second, untracked one. See [Theme — custom.theme.css](../segments/theme.md#the-custom-theme-file) | Critical |
| R-36 | ✅          | Every override of a vendor component lives in its own library module, `modules/_<vendor-component>.<library>.module.scss`, named after the component it overrides (`_modal.bootstrap.module.scss` → `.m-modal`); `<library>` is the package's name, lowercase, without a version.<br>A plain `_<module-name>.module.scss` holds no vendor selector; an own module that needs a context-only style for a vendor element targets the library module's `m-` class, never the vendor class.<br>Exception: vendor-generated markup outside the project's markup is overridden in `common/_classes.common.scss` (R-30).<br>A project links one component framework — Bootstrap, for example — and other libraries, such as Swiper, may sit beside it; an own `_<module-name>.module.scss` never takes the name of a library module's component, so an `m-` class such as `.m-modal` is declared once.<br>See [Modules](../segments/modules.md#vendor-override-scoping) | High |

[↑ Back to top](#rules)
