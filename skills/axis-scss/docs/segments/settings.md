# Settings Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Settings** segment is the foundation of this architecture. It contains all SCSS variables, maps, and configuration that the rest of the application reads.

| # | Section                                         | What it covers                                  |
|---|-------------------------------------------------|-------------------------------------------------|
| 1 | [Purpose](#purpose)                             | What the segment is for                         |
| 2 | [File Structure](#file-structure)               | The folder tree and what each file holds        |
| 3 | [Files Overview](#files-overview)               | What each settings file holds                   |
| 4 | [Maps and their values](#maps-and-their-values) | What the standard fixes vs. what a project owns |
| 5 | [Best Practices](#best-practices)               | How to author this segment                      |
| 6 | [Rules](#rules)                                 | What a review rejects                           |
| 7 | [Related Files](#related-files)                 | The segments this one works with                |

---

## Purpose

The Settings segment provides:

| Aspect              | Description                                                                |
|---------------------|----------------------------------------------------------------------------|
| **Consistency**     | Centralized configuration for colors, breakpoints, and other design values |
| **Maintainability** | Single source of truth for design values                                   |
| **Flexibility**     | Easy to modify design system values                                        |
| **No CSS Output**   | This segment must never generate CSS rulesets                              |

[↑ Back to top](#settings-segment-documentation)

## File Structure

```
settings/
├── _breakpoints.settings.scss    # Responsive breakpoint definitions
└── _colors.settings.scss         # Color utility maps (values live in the theme palette)
```

The `.settings.scss` suffix and both file names, `_breakpoints.settings.scss` and `_colors.settings.scss`, are fixed. The maps' keys and values stay the project's own. A project may extend the segment with more settings files, as long as each follows the rules of this segment.

[↑ Back to top](#settings-segment-documentation)

## Files Overview

### Breakpoints settings file

`_breakpoints.settings.scss` contains responsive breakpoint definitions used throughout the application.

### Colors settings file

`_colors.settings.scss` contains one SCSS map per color family, each read by that family's `@each` loop in `utilities/visual/colors/` and in `utilities/visual/backgrounds/`, which generate the text-color and background-color utilities. Each map entry references a CSS custom property from `theme/colors/colors.palette.theme.css`, which is the single source of truth for color values — no color value is defined in this file.

[↑ Back to top](#settings-segment-documentation)

## Maps and their values

Every file in this segment is a set of named values collected in an SCSS map. **The standard fixes what each map is for, what its keys mean and what reads them. It does not fix the keys or the values** — those are each project's own, in the same way the SCSS root is a placeholder rather than a fixed path.

So no document in this set lists a project's breakpoint names, its color token names or their values. To read the live set, open the map file in the project you are working in. The one thing that is fixed is the shape a token name takes — it is stated in [Theme](./theme.md#token-sets-and-their-values), which owns the token files.

| Map file                     | What it holds                                                                      | Where its values live                                                                    |
|------------------------------|------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `_breakpoints.settings.scss` | One named entry per viewport threshold, for each axis the project needs            | Here. Whatever emits the project's media queries reads this file                         |
| `_colors.settings.scss`      | One map per color family, one entry per shade, each referencing a custom property  | Not here. They live in `theme/colors/colors.palette.theme.css` — see [Theme](./theme.md) |

### What the breakpoints map must provide

- **The keys are the names the rest of the project uses.** A breakpoint is referred to by its key wherever a media query is written, so the key set is the vocabulary — add one here before using it anywhere.
- **Both axes may be defined.** A project that writes height queries as well as width queries defines a height set beside the width set.
- **Values are `rem`, each with its px equivalent in a comment** — e.g. `md: 48rem, // 768px`. A `max` query written with `max-width` stops `0.0625rem` (1px) below the matching `min`, so the two queries never both match at the same width; prefer the range syntax — `(width >= 48rem)` and `(width < 48rem)` — which has no gap, per [MDN range syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using#targeting_media_features).
- A project that must use px may do so only in this map; `rem` is recommended (R-08). A px value here is **not** a breach of the hard-coded-pixel rule in [Rules](../guides/rules.md): that rule governs authored style lengths, and a breakpoint is a viewport threshold, not an authored style length.

[↑ Back to top](#settings-segment-documentation)

## Best Practices

| # | Principle                 | Guidelines                                                                                                                                                                                  |
|---|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **CSS Custom Properties** | - Color values are custom properties declared in the [Theme segment](./theme.md); this segment only references them. The naming and color rules are in [Rules](../guides/rules.md) |
| 2 | **Map Usage**             | - Use SCSS maps for organized data                                                                                                                                                          |
| 3 | **Naming Conventions**    | - Use kebab-case for variable names <br> - Use descriptive names: `$primary-colors`, `$breakpoints` <br> - File names follow [Naming Conventions](../guides/naming-conventions.md)          |
| 4 | **Documentation**         | - Include [`@dependencies`](./tools.md#dependencies-comments) comments <br> - Document complex maps and variables                                                                           |

[↑ Back to top](#settings-segment-documentation)

## Rules

| # | ID        | Rule                       | Description                                   | Priority |
|---|-----------|----------------------------|-----------------------------------------------|----------|
| 1 | R-SET-1   | **No CSS Output**          | This segment must never generate CSS rulesets | Critical |
| 2 | R-SET-2   | **Single Source of Truth** | Configuration that SCSS reads lives here; color **values** live in the Theme segment, and the maps in this segment reference them | Critical |
| 3 | R-SET-3   | **Semantic Names**         | See [R-07](../guides/rules.md#naming-and-structure) | Critical |
| 4 | R-SET-4   | **Documentation**          | Each map has a comment stating what it holds and what reads it | High     |

[↑ Back to top](#settings-segment-documentation)

## Related Files

| Segment                                 | Usage                                  |
|-----------------------------------------|----------------------------------------|
| **[Tools Segment](./tools.md)**         | Uses settings for mixins and functions |
| **[Utilities Segment](./utilities.md)** | Uses settings for utility classes      |

This segment has no `_index.scss`. See [Best Practices — Using the Tools Segment](../guides/best-practices.md#using-the-tools-segment) for how a file reaches a settings map directly.

[↑ Back to top](#settings-segment-documentation)
