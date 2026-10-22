# Generic Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Generic** segment contains reset/normalize styles and base styles that set the foundation for the entire application. This segment overrides default browser styles and, where a project links an external CSS framework such as Bootstrap, that framework's reboot styles.

| # | Section                           | What it covers                           |
|---|-----------------------------------|------------------------------------------|
| 1 | [Purpose](#purpose)               | What the segment is for                  |
| 2 | [File Structure](#file-structure) | The folder tree and what each file holds |
| 3 | [Files Overview](#files-overview) | What each generic file holds             |
| 4 | [Key Features](#key-features)     | The reset's scope, feature by feature    |
| 5 | [Best Practices](#best-practices) | How to author this segment               |
| 6 | [Rules](#rules)                   | What a review rejects                    |
| 7 | [Related Files](#related-files)   | The segments this one works with         |

---

## Purpose

The Generic segment provides:

| Aspect              | Description                                                                             |
|---------------------|-----------------------------------------------------------------------------------------|
| **Consistency**     | Normalized styles across all browsers                                                   |
| **Foundation**      | Base styles for the entire application                                                  |
| **Reset**           | Override default browser styles, and an external framework's reboot where one is linked |


[↑ Back to top](#generic-segment-documentation)

## File Structure

```
generic/
├── _index.scss               # Folder index for the generic segment
└── _reset.generic.scss       # CSS reset and normalize styles
```

This segment compiles into the Common stylesheet through the Common segment: `common/common.scss` is the only file that imports it, and no page or layout entry does. See [Common](./common.md).

[↑ Back to top](#generic-segment-documentation)

## Files Overview

### Index file

`_index.scss` is the folder index for the generic segment that imports all generic styles.

**Content:**
```scss
@charset "UTF-8";

@use "./reset.generic" as *;
```

### Reset file

`_reset.generic.scss` contains comprehensive reset and normalize styles that override default browser styles and, where one is linked, an external framework's reboot — Bootstrap's, for example. This is also where the one `@media (prefers-reduced-motion: reduce)` block lives, switching off transitions and animations for the whole page — see [Accessibility](../guides/accessibility.md). That block is the one place `!important` is allowed (R-20 in [Rules](../guides/rules.md)):

```scss
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}
```

[↑ Back to top](#generic-segment-documentation)

## Key Features

| # | Principle                 | Guidelines                                                                                                                                                                                                                                  |
|---|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Universal Reset**       | - Resets all elements to a consistent baseline<br>- Removes browser default styles<br>- Ensures predictable behavior across browsers                                                                                                        |
| 2 | **Vendor Compatibility**  | - Overrides an external framework's reboot styles, Bootstrap's for example<br>- Keeps that framework working while customizing appearance<br>- Ensures design system consistency<br>- Applies only to a project that links such a framework |
| 3 | **Responsive Media**      | - Ensures images and videos are responsive by default<br>- Sets proper aspect ratios<br>- Handles media element sizing consistently                                                                                                         |
| 4 | **Form Normalization**    | - Normalizes form element styling<br>- Sets no font values; it only makes form controls inherit them<br>- Removes browser default form styles |

[↑ Back to top](#generic-segment-documentation)

## Best Practices

| # | Principle              | Guidelines                                                                                                                                    |
|---|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Minimal Reset**      | - Only reset what's necessary<br>- Avoid over-resetting that might break functionality<br>- Focus on consistency rather than complete removal |
| 2 | **Vendor Integration** | - Override an external framework's styles carefully<br>- Maintain its responsive behavior<br>- Ensure compatibility with its components<br>- Applies only to a project that links such a framework |
| 3 | **Performance**        | - Keep reset styles lightweight<br>- Avoid complex selectors<br>- Minimize CSS output                                                         |
| 4 | **Maintainability**    | - Document overrides clearly<br>- Use comments to explain complex resets<br>- Keep reset styles organized and readable                        |

[↑ Back to top](#generic-segment-documentation)

## Rules

| # | ID        | Rule                           | Description                                                                                                                                                                                                                                                                                           | Priority |
|---|-----------|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-GEN-1   | **Project-Wide Selector Rule** | Generic is one of only two segments — the other being Elements — where element (type) selectors are permitted. Outside them, R-06 allows only these exemptions: `body` in `custom.theme.css` (R-34); `:root` in the theme token files (R-19); and attribute selectors where R-26 permits them — in Generic and Elements, in `common/_attributes.common.scss` for vendor markup, and `[aria-*]` or `:is([dir="rtl"])` chained onto a project class — see [Rules](../guides/rules.md). Every other file must use class selectors only. ID selectors remain banned in every segment without exception, including here. | Critical |

[↑ Back to top](#generic-segment-documentation)

## Related Files

| Segment                                        | Usage                                                                |
|------------------------------------------------|----------------------------------------------------------------------|
| **[Elements Segment](./elements.md)**          | Builds upon generic reset with element-specific styles               |
| **[Common Segment](./common.md)**              | Uses generic foundation for shared styles                            |
| **[Components Segment](./components.md)**      | Relies on generic reset for consistent component behavior            |
| **External framework (for example Bootstrap)** | Its reboot styles are overridden here rather than in another segment |

[↑ Back to top](#generic-segment-documentation)
