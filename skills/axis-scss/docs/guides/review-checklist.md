# Review Checklist

[← Back to README](../README.md)

Answer each question before a pull request is merged. The `R-` IDs are rules in [Rules](./rules.md); every other line links to the document that states its rule. Nothing here is enforced by a tool — the checklist is only as good as the person who reads it.

| # | Section                                                               | What it covers                     |
|---|-----------------------------------------------------------------------|------------------------------------|
| 1 | [Before you open the pull request](#before-you-open-the-pull-request) | The questions the author answers   |
| 2 | [What the reviewer checks](#what-the-reviewer-checks)                 | The questions the reviewer answers |
| 3 | [Segment rules](#segment-rules)                                       | The Critical rules each segment adds |

---

## Before you open the pull request

| #  | Question                                                                                                                                    | Rule                                                             |
|----|-----------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| 1  | Does every class you added carry its segment's prefix?                                                                                      | R-01, [R-OBJ-1](../segments/objects.md#rules), [R-COMP-1](../segments/components.md#rules), [R-LAY-1](../segments/layout.md#rules), [R-MOD-1](../segments/modules.md#rules), [R-COM-1](../segments/common.md#rules), [R-COM-2](../segments/common.md#rules), [R-UTIL-1](../segments/utilities.md#rules) |
| 2  | Does a `js-*` class that carries a state get styled like any other state class, and does a `js-*` class that exists only as a script's lookup target carry no styles? | R-02                                                              |
| 3  | Does JavaScript in this change add, remove or query only `js-*` classes — never `c-`, `m-`, `ctrl-`, `l-`, `p-`, `u-`, `is-*` or `has-*`?    | R-03                                                              |
| 4  | Are blocks and elements named with BEM, with no `--` modifier?                                                                              | R-04                                                              |
| 5  | Is each state class `is-*` or `has-*` when the markup sets it, and `js-*` when a script changes it?                                         | R-27                                                              |
| 6  | Is nesting four levels deep at most, counting the root selector as level 1 and not counting `@media`?                                       | R-05                                                              |
| 7  | Outside Generic and Elements, does every selector you added target a class rather than an element — except `body` in `custom.theme.css`, `:root` in the color token files, and attribute selectors where R-26 permits them? | R-06, [R-GEN-1](../segments/generic.md#rules), [R-ELEM-2](../segments/elements.md#rules) |
| 8  | Is every new custom property named by role, or by family and step, never by a literal appearance?                                           | R-07, [R-SET-3](../segments/settings.md#rules), [R-THEME-3](../segments/theme.md#rules) |
| 9  | Are absolute lengths in `rem` and other units only where R-08 allows them, with no raw `px` value except `1px` and a breakpoint value in `settings/_breakpoints.settings.scss`? | R-08                                                              |
| 10 | Are only logical properties used, such as `margin-inline-end` rather than `margin-right`?                                                   | R-09                                                              |
| 11 | Does every color come from a CSS custom property, with no hex, `rgb()`/`hsl()` literal or named color?                                                      | R-10, [R-OBJ-4](../segments/objects.md#rules) |
| 12 | Is every color shade you authored in HSL, with no hex exception even for a neutral?                                                          | R-11                                                              |
| 13 | Do the decimal values you authored use at most 4 decimal places?                                                                             | R-12                                                              |
| 14 | Is the file free of `!important`, except in the Generic reduced-motion block? | R-20                                                              |
| 15 | Is the file free of `@extend` on an arbitrary selector?                                                                                      | R-21                                                              |
| 16 | Is the file free of duplicate selectors, and duplicate properties within the same rule?                                                     | R-22                                                              |
| 17 | Is the file free of empty rule blocks and empty comments?                                                                                    | R-23                                                              |
| 18 | Is the file free of ID selectors?                                                                                                            | R-25                                                              |
| 19 | Are attribute selectors used only where R-26 permits them — Generic, Elements, `common/_attributes.common.scss`, and `[aria-*]` or `:is([dir="rtl"])` chained onto a project class? | R-26                                                              |
| 20 | Is `@charset "UTF-8";` the first line of every file you added, except files under `packages/`? | R-32, [Best Practices](./best-practices.md#import-order)         |
| 21 | Is each new file in the segment the Decision Guide gives it?                                                                                | R-13–R-18, [Decision Guide](./decision-guide.md)                  |
| 22 | If you touched a Theme color file (`colors.base.theme.css` or `colors.palette.theme.css`), is `:root` — optionally wrapped in an at-rule — the only selector in it? | R-19, [R-THEME-2](../segments/theme.md#rules) |
| 23 | Is each object, component or module imported from `common/` when five or more page entries use it or any layout needs it, and by each page entry otherwise — and is a component `@use`d only by a module? | R-28, R-29, [Common — Placement Rule](../segments/common.md#placement-rule), [R-PAGE-3](../segments/pages.md#rules), [R-COM-4](../segments/common.md#rules), [R-COM-5](../segments/common.md#rules), [R-COM-6](../segments/common.md#rules), [R-COM-7](../segments/common.md#rules) |
| 24 | Does every vendor override you added target an `m-` class placed beside the vendor class, with the vendor's inner parts nested inside it — or nest a vendor selector (`.btn`, `.modal`, `.dropdown-menu`, `.form-control`) inside an `m-` wrapper only where the vendor element cannot take a class or the vendor selector out-specifies the `m-` class — except for vendor-generated markup outside the project's own markup, which goes in `common/_classes.common.scss` instead? | R-30                                                              |
| 25 | Does every vendor override you added live in its own `_<vendor-component>.<library>.module.scss`, with no vendor selector in a plain `.module.scss`?                      | R-36                                                              |
| 26 | If you touched a control module, do its styles live only in its own `_<name>.control.module.scss`, inside its `ctrl-` block, with no other file styling or overriding it? | R-31                                                              |
| 27 | Is the content of every file under `packages/` left exactly as shipped — never modified, and never `@use`d or `@import`ed from SCSS?                       | R-33, [R-PKG-1](../segments/packages.md#rules), [R-PKG-2](../segments/packages.md#rules), [R-PKG-3](../segments/packages.md#rules) |
| 28 | If you added an entry file, is it in the build?                                                                                             | [Build — Entry files](./build.md#entry-files)                     |
| 29 | Is every new file named in kebab-case, with its segment suffix, and with a leading `_` if it is a partial?                                  | [Naming Conventions](./naming-conventions.md)                     |

[↑ Back to top](#review-checklist)

## What the reviewer checks

| # | Question                                                                                                                | Rule                                                                                  |
|---|-------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| 1 | Does a change to `custom.theme.css` use only class selectors and `body`, and define no custom property?                 | R-34, R-35, [R-THEME-6](../segments/theme.md#rules), [R-THEME-7](../segments/theme.md#rules), [Theme — custom.theme.css](../segments/theme.md#the-custom-theme-file) |
| 2 | Is the compiled CSS committed, and does it match a fresh compile of the sources?                                        | [Build — Committed output and staleness](./build.md#committed-output-and-staleness)     |
| 3 | At a release, have the bundle sizes been measured and recorded against the budget?                                      | [Performance — When a budget is exceeded](./performance.md#when-a-budget-is-exceeded)   |
| 4 | Does each new utility set exactly one CSS property — unless it is on the named exceptions list (`u-container`, `u-sr-only`, `u-not-sr-only`) — and is it a specific override, not a primary way of styling? | R-24, [R-UTIL-2](../segments/utilities.md#rules), [Utilities — Rules](../segments/utilities.md#rules) |
| 5 | Does the change meet the rules in Accessibility?                                                                        | [Accessibility](./accessibility.md), [R-LAY-2](../segments/layout.md#rules)              |

[↑ Back to top](#review-checklist)

## Segment rules

Each row asks for a Critical rule that one of the segments adds and that no question above already asks. A Critical segment rule that a question above already asks is cited in that question's Rule cell instead.

| #  | Question                                                                                                                                       | Rule                                                                                                          |
|----|------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| 1  | Does a Settings or Tools file generate no CSS ruleset?                                                                                         | [R-SET-1](../segments/settings.md#rules), [R-TOOL-1](../segments/tools.md#rules)                              |
| 2  | Is configuration that SCSS reads kept in Settings, with color values left to the Theme segment and only referenced from the Settings maps?     | [R-SET-2](../segments/settings.md#rules)                                                                      |
| 3  | Does each tool take the values it needs as parameters, and hard-code no component, page or client value?                                       | [R-TOOL-2](../segments/tools.md#rules)                                                                        |
| 4  | Does each tool check every parameter and raise `@error` on an invalid one?                                                                     | [R-TOOL-3](../segments/tools.md#rules)                                                                        |
| 5  | Does each tool document its signature, its parameters with defaults, its output and one example, in one place?                                 | [R-TOOL-4](../segments/tools.md#rules)                                                                        |
| 6  | Does every selector in an Elements file target an HTML element, never a class or an ID?                                                        | [R-ELEM-1](../segments/elements.md#rules)                                                                     |
| 7  | Does Elements declare only the base body background, with a per-theme background left to `custom.theme.css` and never declared in both places? | [R-ELEM-3](../segments/elements.md#rules)                                                                     |
| 8  | Does an object define a design pattern and no meaning, carrying no purpose until content is placed inside it?                                  | [R-OBJ-2](../segments/objects.md#rules)                                                                       |
| 9  | Is an object's pattern fixed, taking no parameters and no overrides from a consuming component?                                                | [R-OBJ-3](../segments/objects.md#rules)                                                                       |
| 10 | Is every object a new pattern, with no existing utility reclassified as an object?                                                             | [R-OBJ-5](../segments/objects.md#rules)                                                                       |
| 11 | Does every object, component and module file stay in its own segment folder, with sharing changing only which file `@use`s it?                 | [R-OBJ-6](../segments/objects.md#rules), [R-COMP-6](../segments/components.md#rules), [R-MOD-4](../segments/modules.md#rules), [R-COM-3](../segments/common.md#rules) |
| 12 | Does a component file style only its own `c-` block, never another component's classes?                                                        | [R-COMP-3](../segments/components.md#rules)                                                                   |
| 13 | Does a component, a layout or a page render with no horizontal overflow from 320 CSS px up, checked at every breakpoint key the project defines? | [R-COMP-4](../segments/components.md#rules), [R-LAY-3](../segments/layout.md#rules), [R-PAGE-4](../segments/pages.md#rules) |
| 14 | Does a page file hold only styles unique to that page, and is a page entry never `@use`d from another page, a layout, a module or `common`?    | [R-PAGE-1](../segments/pages.md#rules)                                                                        |
| 15 | Does a page hold its own content only, with the header, navbar, side menu, footer and shell left to Layout?                                    | [R-PAGE-2](../segments/pages.md#rules)                                                                        |
| 16 | Does a module style two or more components placed together, or is it a library module or a control module — and nothing else?                  | [R-MOD-2](../segments/modules.md#rules)                                                                       |
| 17 | Does every utility whose value is a scale step or a numeric value follow `u-{property}-{value}`, and any other utility get a clear, expected name? | [R-UTIL-5](../segments/utilities.md#rules)                                                                    |
| 18 | Is every utility name free of a breakpoint, with a value that changes with the viewport read from a token that scales?                         | [R-UTIL-6](../segments/utilities.md#rules)                                                                    |
| 19 | Is the vendor stylesheet linked before the project's own compiled stylesheets?                                                                 | [R-PKG-4](../segments/packages.md#rules)                                                                      |
| 20 | Does every theme value use a CSS custom property?                                                                                              | [R-THEME-1](../segments/theme.md#rules)                                                                       |
| 21 | Is every Theme file plain hand-authored CSS — not compiled, not minified and not renamed?                                                      | [R-THEME-5](../segments/theme.md#rules)                                                                       |
| 22 | Is `colors.palette.theme.css` the only file in Theme that defines a color shade?                                                               | [R-THEME-8](../segments/theme.md#rules)                                                                       |
| 23 | Is a token whose value changes with the viewport declared as a `clamp()` in Theme, and never re-declared by the class that reads it?           | [R-THEME-9](../segments/theme.md#rules)                                                                       |

[↑ Back to top](#review-checklist)
