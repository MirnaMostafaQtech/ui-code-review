# Utilities Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Utilities** segment contains `single-purpose` utility classes that provide quick styling solutions. A utility is an ordinary single-class selector — it carries no more specificity than a component or page class. It wins because the compiled utilities stylesheet is linked after the page stylesheet, so at equal specificity the later stylesheet takes effect; see [HTML and CSS Output Reference](../guides/output.md). Use utilities sparingly, for specific overrides and quick fixes.

| # | Section                                                                       | What it covers                                                                    |
|---|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| 1 | [Purpose](#purpose)                                                           | What the Utilities segment provides                                               |
| 2 | [File Structure](#file-structure)                                             | The five fixed categories, the tree, and the `utils.scss` entry file              |
| 3 | [Naming Conventions](#naming-conventions)                                     | The `u-` prefix, the `u-{property}-{value}` pattern, and the short property names |
| 4 | [Hand-written and generated utilities](#hand-written-and-generated-utilities) | Which utilities are looped from a settings map, and which are hand-written        |
| 5 | [Utility Categories](#utility-categories)                                     | What each of the five categories holds, with an example                           |
| 6 | [Usage Examples](#usage-examples)                                             | A short illustrative example                                                      |
| 7 | [Rules](#rules)                                                               | The rules a utility must follow                                                   |
| 8 | [Related Files](#related-files)                                               | Other segments and guides this one depends on                                     |

---

## Purpose

The Utilities segment provides:

| Aspect             | Description                                                                                    |
|--------------------|------------------------------------------------------------------------------------------------|
| Quick Styling      | Single-purpose classes for rapid development                                                   |
| Wins By Load Order | Loaded after page styles, so a utility overrides at equal specificity — no `!important` needed |
| Consistency        | Standardized utility classes across the application                                            |
| Flexibility        | Quick solutions for edge cases                                                                 |
| Lightweight        | This bundle is linked by every page, so what is added here is paid for everywhere              |

[↑ Back to top](#utilities-segment-documentation)

## File Structure

```
utilities/
├── utils.scss                        # Entry file — compiles to the utilities bundle
├── utils.min.css                     # Compiled utilities CSS
├── accessibility/
│   ├── _index.scss
│   └── _<name>.utility.scss
├── interaction/
│   ├── _index.scss
│   └── _<name>.utility.scss
├── layout/
│   ├── _index.scss
│   └── _<name>.utility.scss
├── typography/
│   ├── _index.scss
│   └── _<name>.utility.scss
└── visual/
    ├── _index.scss
    └── _<name>.utility.scss
```

**The five categories are fixed by the standard**; a utility belongs to whichever one matches what it does. What sits inside them is the project's: one file per group of related utilities, each named `_<name>.utility.scss`, and a category may nest sub-folders when it outgrows a flat list. A project whose palette has six color families ends up with six background files; a project with three ends up with three.

`utils.min.css` is the Web Compiler route's output name; the Node route compiles the same entry to `utils.css`. Output naming is specified in [Build Documentation](../guides/build.md).

> **Entry file**: `utils.scss` is one of the project's compiled entry files (no leading underscore). On the Web Compiler route it must be listed in `compilerconfig.json`; on the Node route directory mode discovers it, because its name has no leading underscore. See the entry-file rule and complete entry-file list in [Build Documentation](../guides/build.md#entry-files).

### Entry file

`utils.scss` imports every category, in category order, and nothing else:

```scss
@charset "UTF-8";

@use "./accessibility" as *;
@use "./interaction" as *;
@use "./layout" as *;
@use "./typography" as *;
@use "./visual" as *;
```

[↑ Back to top](#utilities-segment-documentation)

## Naming Conventions

### Class Prefix
- **MUST** use `u-` prefix for utility classes
- Examples: `u-text-neutral-200`, `u-bg-neutral-25`, `u-bg-primary-200` — **illustrative only**. The pattern is what the standard fixes; the token names in these examples are one project's.

### Utility Naming
- Use semantic names
- Use descriptive names — `u-text-neutral-200` and `u-text-primary-200` show the form, not names a project must define
- `u-{property}-{value}` names a utility whose value is a scale step or a numeric value — colors, font sizes, font weights, backgrounds and the like. A utility whose value is not a scale step gets a clear, expected name instead: `u-container`, `u-sr-only`
- No breakpoint appears in a utility's name. A value that has to change with the viewport scales instead — see [Theme](./theme.md)

### Short property names

| Short name   | Property            |
|--------------|----------------------|
| `ff`         | `font-family`        |
| `fs`         | `font-size`          |
| `fw`         | `font-weight`        |
| `bg`         | `background-color`   |
| `text`       | `color`              |
| `text-align` | `text-align`         |

`text` alone always means `color`. A `text-align` utility spells its property in full: `u-text-align-center`.

[↑ Back to top](#utilities-segment-documentation)

## Hand-written and generated utilities

Most utilities in this segment are hand-written, one file per group as shown in [File Structure](#file-structure) above. The exceptions are the text-color and background-color utilities: each file under `visual/colors/` and `visual/backgrounds/` — one per color family — `@use`s the project's colors settings file (`settings/_colors.settings.scss`) directly (see [Settings segment](./settings.md)), and generates that family's classes with an `@each` loop over the family's own map rather than listing them by hand.

```scss
@charset "UTF-8";

// @dependencies:
// - CSS info colors
@use "../../../settings/colors.settings" as Color;

@each $name, $color in Color.$info-colors {
  .u-text-#{$name} {
    color: $color;
  }
}
```

The background-color files follow the same shape, with `.u-bg-#{$name}` and `background-color`. The map's keys carry the family and the step, so the class reads `u-text-<family>-<step>`.

**Illustrative only** — the map's variable name, its keys and values are the project's own; what the standard fixes is that each generated color file loops over its family's settings map instead of being hand-written, and that the family and the step both appear in the class name.

[↑ Back to top](#utilities-segment-documentation)

## Utility Categories

| Category               | What it holds                          | Files a project might hold                                                              | Example              | Code                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-------------------------|-----------------------------------------|-------------------------------------------------------------------------------------------|-----------------------|------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`/accessibility/`**  | Screen-reader-only visibility utilities | `_sr-only.utility.scss`                                                                    | `.u-sr-only`          | `position: absolute;`<br>`overflow: hidden;`                                                                            | `u-sr-only` and `u-not-sr-only` are the segment's screen-reader exceptions to the one-property rule (see [Rules](#rules)). The code above is **illustrative only** and shortened — it shows the shape, not the complete declaration block a project writes                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **`/interaction/`**    | User interactions and events           | `_event.utility.scss`<br>`_scroll.utility.scss`                                         | `.u-cursor-pointer`   | `cursor: pointer;`                                                                                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`/layout/`**         | Layout and positioning                 | `_container.utility.scss`<br>`_width.utility.scss`                                      | `.u-container`        | `max-inline-size: 79.25rem;`<br>`margin-inline: auto;`<br>`padding-inline: clamp(1rem, calc(1vw + 1.2rem), 1.75rem);` | `u-container` is a documented exception to the one-property rule — it combines sizing, centering, and inline spacing into a single class because it represents one layout concern (constraining and centering a content column), not three unrelated ones. It should not be treated as a pattern for future utilities to follow: any other utility that needs more than one property for an accessibility or layout purpose must be named as its own exception in the same way, not assumed to qualify by analogy. |
| **`/typography/`**     | Text styling and typography            | `_font-family.utility.scss`<br>`_font-size.utility.scss`<br>`_font-weight.utility.scss` | `.u-fs-xs`            | `font-size: var(--fs-xs);`                                                                                            | The class name and the token name here are **illustrative only** — a typography utility names a step that exists in `theme/fonts/fonts.theme.css`, and which steps exist is the project's own; see the [Theme segment](./theme.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`/visual/`**         | Colors, backgrounds and visual effects | `/backgrounds/`<br>`/colors/`<br>`/misc/`                                               | `.u-bg-primary-300`   | `background-color: var(--primary-300);`                                                                               | One file per color family is the shape under `/backgrounds/` and `/colors/`, so how many there are follows from the project's palette in `theme/colors/colors.palette.theme.css`. The class name and the token name here are **illustrative only**. `/colors/` generates the text colors from the SCSS maps in `_colors.settings.scss`. The files under `/colors/` (text color) and `/backgrounds/` are the generated ones — see [Hand-written and generated utilities](#hand-written-and-generated-utilities)                                                                                                                                                                          |

[↑ Back to top](#utilities-segment-documentation)

## Usage Examples

**Illustrative only** — the steps and the color families below are one project's. What the standard fixes is the `u-` prefix and the `u-{property}-{value}` pattern.

```html
<div class="u-container">
  <p class="c-card__meta u-fs-xs u-text-neutral-600">Text</p>
</div>
```

[↑ Back to top](#utilities-segment-documentation)

## Rules

| # | ID         | Rule                        | Description                                                                                                                                                                                                                               | Priority |
|---|------------|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-UTIL-1   | **`u-` prefix**             | Every utility class carries it, with no exception                                                                                                                                                                                         | Critical |
| 2 | R-UTIL-2   | **Single purpose**          | One utility sets one thing. `u-container`, `u-sr-only` and `u-not-sr-only` are the documented exceptions, and any other utility needing more than one property is named as its own exception rather than assumed to qualify              | Critical |
| 3 | R-UTIL-3   | **Wins by load order**      | A utility overrides because the utilities bundle is linked last of the compiled stylesheets, not because it out-specifies. Never raise a utility's specificity to make it win                                                                                         | High |
| 4 | R-UTIL-4   | **Used sparingly**          | A utility adds to an element's own `c-`/`m-`/`p-`/`l-` styling; it never replaces it                                                                                                                                                      | High     |
| 5 | R-UTIL-5   | **Consistent naming**       | A utility whose value is a scale step or numeric value follows `u-{property}-{value}`, so the name says what the class does before it is opened; any other utility gets a clear, expected name instead                                    | Critical |
| 6 | R-UTIL-6   | **No breakpoint in a name** | A utility whose value has to change with the viewport reads a token that scales — a `clamp()` declared in the [Theme segment](./theme.md). Type steps are the usual case. There is no breakpoint-suffixed variant of a utility class      | Critical |

[↑ Back to top](#utilities-segment-documentation)

## Related Files

| Segment                                                | Usage                                                                                                  |
|--------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| **[Theme Segment](./theme.md)**                        | Defines the color and type steps a utility references; which steps exist is the project's              |
| **[Settings Segment](./settings.md)**                  | Supplies the color maps the text-color and background utilities loop over                              |
| **[Objects Segment](./objects.md)**                    | States the object/utility boundary — an object is a pattern, a utility sets one thing                  |
| **[Pages Segment](./pages.md)**                        | Page rules a utility overrides at equal specificity, because the utilities bundle is linked after them |
| **[HTML and CSS Output Reference](../guides/output.md)** | Why a utility wins by link order rather than by out-specifying                                       |
| **[Build Documentation](../guides/build.md)**          | The two output names for this segment's bundle — `utils.min.css` and `utils.css`                       |
| **[Tools Segment](./tools.md)**                        | Supplies the mixins and functions a utility is authored with                                           |

[↑ Back to top](#utilities-segment-documentation)
