# Accessibility

[← Back to README](../README.md)

This standard specifies what its stylesheets must do for accessibility, and a short set of markup rules besides. The table below is the stylesheet rules: every one of them can be checked by reading the SCSS alone. Accessible markup — ARIA attributes, heading hierarchy, tab order, semantic HTML — is written in the project's views; the [Markup](#markup) section further down carries those rules, and each one is checked by reading the views.

| # | Section                               | What it covers                         |
|---|---------------------------------------|----------------------------------------|
| 1 | [Stylesheet rules](#stylesheet-rules) | The rules checked by reading the SCSS  |
| 2 | [Markup](#markup)                     | The rules checked by reading the views |

---

## Stylesheet rules

| # | Rule                         | Description                                                                                                                                                                                                                                                                                        | How to check                                                                                                             | Priority |
|---|------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | **Visible focus**            | Never remove the focus indicator without replacing it. `outline: none` or `outline: 0` is written only where a `:focus-visible` style takes its place in the same rule. The base `:focus-visible` style is declared in [Elements](../segments/elements.md)                                         | Every `outline: none` and `outline: 0` sits beside a `:focus-visible` style                                              | High     |
| 2 | **No hover-only affordance** | Whatever `:hover` shows, `:focus-visible` shows too, so keyboard users see it. Hover styles sit inside `@media (hover: hover)`, so a touch tap does not leave the hover state stuck                                                                                                                                                           | Every `:hover` block has a matching `:focus-visible`, and sits inside `@media (hover: hover)`                            | High     |
| 3 | **Reduced motion**           | Transitions and animations are switched off under `@media (prefers-reduced-motion: reduce)`, in one block in [Generic](../segments/generic.md) that applies to the whole page                                                                                                                      | The block exists in Generic, and no later rule reintroduces motion under it                                              | High     |
| 4 | **Text contrast**            | In each client's theme, every text and background token pair meets WCAG 2.2 level AA ([SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)): 4.5:1 for body text, and 3:1 for large text and for the borders of interface controls                                                                                                                        | Run a contrast checker on the token pairs whenever a client's values are set or changed in [Theme](../segments/theme.md) | High     |
| 5 | **Visually hidden text**     | Text meant for screen readers only uses `u-sr-only`; `u-not-sr-only` reverses it. Both are on the named list of utilities that may set more than one property, in [Rules](./rules.md), and both live in `utilities/accessibility/`; neither is re-implemented elsewhere                    | `u-sr-only` and `u-not-sr-only` are each declared once, in `utilities/accessibility/`, and no other rule reproduces them   | High     |
| 6 | **Target size**              | An interactive control is at least 24 × 24 CSS px (WCAG 2.2 success criterion [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)), written as `1.5rem` at the default root size, or as `px(24)` where the project ships `px()`, as [Rules](./rules.md) requires of every length. Its width is set with `min-inline-size`; its height with `min-block-size`, or with `padding-block` that, together with the content's line height, reaches the minimum | Controls declare `min-inline-size`, and either `min-block-size` or a `padding-block` that reaches 24px                   | Medium   |

Lengths in `rem`, which [Rules](./rules.md) requires, also serve accessibility: text scales with the reader's browser font setting.

[↑ Back to top](#accessibility)

## Markup

These rules govern the project's views, not its SCSS; each is checked by reading the markup, not the stylesheets.

| #  | Rule                                | Description                                                                                                                                                                     | How to check                                                                      | Priority |
|----|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|----------|
| 7  | **Semantic HTML**                   | Elements are chosen for what they mean — `nav`, `header`, `footer`, `main`, `button` — rather than a generic `div` or `span` with a role bolted on                              | Read the view: elements match the content and behavior they carry                   | Medium   |
| 8  | **Heading hierarchy**               | Headings (`h1`–`h6`) follow a logical, unbroken order within each page and component; no level is skipped to reach a smaller or larger visual size                             | Read the view: heading levels never skip                                            | Medium   |
| 9  | **Logical tab order**               | Interactive elements receive focus in the order the page is read or the order the interaction expects; `tabindex` takes only `0` or `-1`                                       | Tab through the view: focus order matches reading and interaction order             | Medium   |
| 10 | **ARIA where native is not enough** | `role` and `aria-*` attributes are added only when no native element expresses the same state or relationship; a native element never carries a redundant or conflicting role  | Read the view: every ARIA attribute sits on an element with no native equivalent    | Medium   |
| 11 | **Keyboard operability**            | Every control that a mouse can operate, a keyboard can operate too — Enter or Space to activate, arrow keys where a widget pattern calls for them — with no keyboard trap       | Operate the view using only the keyboard                                            | Medium   |
| 12 | **Focus management**                | When a view shows, hides, or replaces content — a modal opens, a panel expands, a route changes — focus moves to a sensible place, and returns to the trigger when it closes   | Trigger the interaction in the view: confirm where focus moves and returns          | Medium   |

[↑ Back to top](#accessibility)
