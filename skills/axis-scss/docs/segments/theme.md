# Theme Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The Theme segment provides shared tokens for the entire application: colors and fonts. A small `custom.theme.css` file is available for theme-specific customizations — see the `custom.theme.css` section below. Keep this segment minimal and token-focused.

| # | Section                                                     | What it covers                                                   |
|---|-------------------------------------------------------------|------------------------------------------------------------------|
| 1 | [Purpose](#purpose)                                         | What the segment is for                                          |
| 2 | [File Structure](#file-structure)                           | The token files and where they sit                               |
| 3 | [Files Overview](#files-overview)                           | What each token file holds, and the `custom.theme.css` allowlist |
| 4 | [Token sets and their values](#token-sets-and-their-values) | What the standard fixes, and what the project names              |
| 5 | [Rules](#rules)                                             | What a review rejects                                            |
| 6 | [Related Files](#related-files)                             | The segments this one works with                                 |

---

## Purpose

| Aspect                | Description                                                                                                          |
|-----------------------|----------------------------------------------------------------------------------------------------------------------|
| **Shared Tokens**     | Color and font CSS custom properties used across all segments, from one source of truth                              |
| **Visual Foundation** | Base colors, fonts, and visual styles                                                                                |
| **Client Identities** | One deployment serves one client, with that client's own colors and brand assets                                     |
| **Brand Consistency** | Centralized brand colors and typography                                                                              |
| **Customization**     | A client's identity is set by the values in this segment; `custom.theme.css` covers theme-specific customizations, such as backgrounds and brand-asset positioning |

**What this segment is for.** A project may serve many clients, each with its own visual identity — colors, logos and other brand assets. This segment exists to carry those differences and nothing else. It is **not** a light/dark mode mechanism, and light and dark are not supported today. If they are ever needed, the neutral values in `colors.palette.theme.css` are redefined in a `:root` block wrapped in an at-rule such as `@media (prefers-color-scheme: dark)`, which R-19 allows.

[↑ Back to top](#theme-segment-documentation)

## File Structure

```
theme/
├── custom.theme.css              # Theme-specific customizations: backgrounds, brand-asset positioning, …
├── colors/
│   ├── colors.base.theme.css    # Per-client identity values (hue, saturation, lightness)
│   └── colors.palette.theme.css # The color shades every segment uses
└── fonts/
    └── fonts.theme.css          # Font families, font-file path, sizes, weights
```

Every file in this segment is hand-authored plain CSS. None of them is compiled from SCSS and none is minified — they ship exactly as authored, so a theme can be adjusted without running an SCSS compiler. Do not rename or minify them; the layout links them directly by these names.

[↑ Back to top](#theme-segment-documentation)

## Files Overview

### Base colors file
`colors.base.theme.css` holds the per-client identity values. These are what differ from one client to the next. Example:

```css
@charset "UTF-8";

:root {
  --hue: <value>;
  --saturation: <value>;
  --lightness: <value>;
}
```

### Palette file
`colors.palette.theme.css` is the single source of truth for color values — the shades every other segment references. This file does not change from one client to the next: its shades resolve from the identity values in `colors.base.theme.css`, so rotating a client's hue changes what they evaluate to without editing anything here. Group one `:root` block per color family. Every shade, neutrals included, is authored in HSL (R-11). Only the brand families derive from the identity values; the status families (success, danger and the like) and the neutrals are fixed HSL values. The 500 step takes the identity values as they are; the other steps shift the lightness with `calc(var(--lightness) ± <n>%)`. A second brand family uses its own identity values, named `--hue-2` and so on.

```css
@charset "UTF-8";

:root {
  --primary-500: hsl(var(--hue) var(--saturation) var(--lightness));
  --primary-<step>: hsl(var(--hue) var(--saturation) calc(var(--lightness) ± <n>%));
  /* ... */
}

:root {
  --success-500: <hsl-value>;
  /* ... */
}

:root {
  --neutral-50: <hsl-value>;
}
```

### Fonts file
`fonts.theme.css` holds the font families, the paths their font files load from, and a minimal type scale. This file holds only `@font-face` rules and `:root` blocks (R-19). The path is declared in an `@font-face` rule, not as a custom property: a `var()` cannot be read inside `@font-face`, so a token holding the path would never load a font.

```css
@charset "UTF-8";

@font-face {
  font-family: "<family-name>";
  src: url("<path/to/font-file>");
}

:root {
  --ff: <value>;
  --fs-<size>: <value>;
  --fw-<weight>: <value>;
  --lh-<step>: <value>;

  /* ... */
}
```

### The custom theme file
File: `theme/custom.theme.css`.

This file holds theme-specific customizations, such as:

1. Body or shell background images and their responsive variants, overriding the base body background declared in the Elements segment. The body background uses the `body` selector (R-06); a shell background uses the layout's `l-` class (e.g. `.l-app`). This file is linked after the compiled segments, so a background declared here wins.
2. Brand asset positioning that varies per deployment (logo offsets, watermark placement) — this may target an `l-` class, for example `.l-app__logo { margin-block-start: 0.5rem; /* 8px */ }`.

These two are examples, not a closed list: any class selector is permitted here (`c-`, `m-`, `ctrl-`, `p-`, `l-`, `u-`), and of the HTML elements only `body` is (R-34, R-06). The one other limit is that the file defines no custom property at all. Colors and fonts already have one source of truth in the files above, and a token defined here would create a second, untracked source for the same value (R-35).

**Review rule**: reject any change to this file that defines a CSS custom property.

```css
@charset "UTF-8";

/* Example: override the base body background declared in the Elements segment */
body {
  background-image: url("<path/to/image>");
}
```

[↑ Back to top](#theme-segment-documentation)

## Token sets and their values

The standard fixes which files hold tokens, what each file is for and the rules those files obey. **It does not fix the token names or their values** — those are each project's own, in the same way the SCSS root is a placeholder and the settings maps are the project's; see [Settings](./settings.md).

So no document in this set lists a project's color tokens or their values. The examples above show the shape of each file, not its contents — to read the live set, open the file in the project you are working in.

**What the standard does fix is the shape of a token name.** A shade in `colors.palette.theme.css` is a family and a step — `--<family>-<step>` — so a shade can be read without looking it up. The font tokens the utilities read take one of four keys: `--ff` for the family — with more than one family, `--ff-1`, `--ff-2` and so on — `--fs-<size>` for a size step, `--fw-<weight>` for a weight step, `--lh-<step>` for a line-height step. Which families exist, which steps they run through and what any of them evaluate to are the project's.

```css
/* colors.palette.theme.css */
:root {
  --primary-500: <hsl-value>;   /* --<family>-<step> */
}

/* fonts.theme.css */
:root {
  --fs-sm: <value>;         /* --fs-<size> */
  --lh-md: <value>;         /* --lh-<step> */
}
```

`primary`, `500`, `sm` and `md` above are one project's choices. The shape they sit in is not.

| Token file                        | What it holds                                                                                                  | What the standard fixes                                                                                                                                                                        |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `colors/colors.base.theme.css`    | The per-client identity values every derived shade resolves from                                               | That this is where per-client difference lives, and that it contains `:root` blocks only                                                                                                       |
| `colors/colors.palette.theme.css` | One entry per shade, grouped one `:root` block per family                                                      | That it is the single source of truth for color values, that it contains `:root` blocks only, and that every shade — neutrals included — is authored in HSL (R-11), though the status families and the neutrals are fixed values rather than derived from the identity values |
| `fonts/fonts.theme.css`           | The font family or families, the path the font files load from, and the size, weight and line-height steps the project uses. Only `@font-face` rules and `:root` blocks (R-19) | That this is where typography tokens live, that the family and its font-file path are declared here, that the file holds only `@font-face` rules and `:root` blocks (R-19), and that the utilities naming a step depend on the step existing here |

Token names are semantic — they say what a value is for, not what it looks like. That rule, with its examples, is in [Rules](../guides/rules.md), and so is the `:root` restriction, which also appears in the Rules table further down this page.

The size and weight steps are the project's own, and so are their names. The font family is declared in the same file, together with the path its font files load from, so the typeface and the scale built on it stay in one place. What the standard fixes is the direction of the dependency: a `u-fs-*` or `u-fw-*` class in [Utilities](./utilities.md) names a step in this file, so a step that does not exist here has no utility, and adding one here is what makes the matching utility possible.

A step whose value has to change with the viewport is declared here as a `clamp()`, so it scales continuously instead of jumping at a breakpoint. The fluidity belongs to the token: everything that reads the step — a utility class, a component, a page rule — gets the same value, and no consumer restates the scale. Type steps are the usual case. The values inside the `clamp()` are the project's, like every other token value in this segment.

[↑ Back to top](#theme-segment-documentation)

## Rules

| # | ID        | Rule                                | Description                                                                                                                                                                                                     | Priority |
|---|-----------|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-THEME-1 | **CSS Custom Properties**           | Use CSS custom properties for all theme values                                                                                                                                                                  | Critical |
| 2 | R-THEME-2 | **`:root` Only**                    | `colors.base.theme.css` and `colors.palette.theme.css` contain `:root` blocks and nothing else — no class, element or other selector. Wrapping a `:root` block in an at-rule is allowed (R-19)                   | Critical |
| 3 | R-THEME-3 | **Semantic Names**                  | See [R-07](../guides/rules.md#naming-and-structure)                                                                                                                                                             | Critical |
| 4 | R-THEME-4 | **Accessibility**                   | Meets the rules in [Accessibility](../guides/accessibility.md)                                                                                                                                                  | Medium   |
| 5 | R-THEME-5 | **Never Compiled**                  | Every file in this segment is hand-authored plain CSS. None is compiled from SCSS, none is minified, and none is renamed — the layout links them by the names they have                                         | Critical |
| 6 | R-THEME-6 | **No Tokens In `custom.theme.css`** | That file must not define a custom property. The rule is absolute: colors and fonts already have one source of truth in the files above, and a token defined there would be a second, untracked one (R-35)       | Critical |
| 7 | R-THEME-7 | **Class Selectors And `body`**      | `custom.theme.css` holds theme-specific customizations (R-34): any class selector is allowed, and `body` is the only element selector                                                                            | Critical |
| 8 | R-THEME-8 | **Palette Is The Source**           | `colors.palette.theme.css` is the single source of truth for color values. No other file in the segment defines a shade                                                                                         | Critical |
| 9 | R-THEME-9 | **Fluid Steps Scale Here**          | A token whose value has to change with the viewport is declared as a `clamp()` in this segment, never re-declared by the class that reads it                                                                    | Critical |

[↑ Back to top](#theme-segment-documentation)

## Related Files

| Segment                                   | Usage                                                                                                |
|-------------------------------------------|------------------------------------------------------------------------------------------------------|
| **[Settings Segment](./settings.md)**     | Theme variables used in SCSS settings                                                                |
| **[Components Segment](./components.md)** | Components use theme variables                                                                       |
| **[Utilities Segment](./utilities.md)**   | Utilities reference theme variables                                                                  |
| **[Elements Segment](./elements.md)**     | Elements use theme variables, and declare the base body background that `custom.theme.css` overrides |

[↑ Back to top](#theme-segment-documentation)
