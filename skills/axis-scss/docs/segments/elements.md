# Elements Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Elements** segment contains styles for bare HTML elements. This segment is not a reset but provides global styles for HTML elements used across the entire application.

| # | Section                           | What it covers                                     |
|---|-----------------------------------|----------------------------------------------------|
| 1 | [Purpose](#purpose)               | What the segment is for                            |
| 2 | [File Structure](#file-structure) | The folder tree and what each file holds           |
| 3 | [Files Overview](#files-overview) | What the elements file holds                       |
| 4 | [Key Features](#key-features)     | What is fixed vs. illustrative, feature by feature |
| 5 | [Best Practices](#best-practices) | How to author this segment                         |
| 6 | [Rules](#rules)                   | What a review rejects                              |
| 7 | [Related Files](#related-files)   | The segments this one works with                   |

---

## Purpose

The Elements segment provides:

| Aspect          | Description                                                |
|-----------------|------------------------------------------------------------|
| Element Styling | Global styles for HTML elements                            |
| Consistency     | Uniform appearance for basic HTML elements across browsers |
| Foundation      | Base element styles that components can build upon         |
| Global Behavior | Application-wide element behavior                          |
| Not a Reset     | This is not a reset segment; it enhances elements          |

[↑ Back to top](#elements-segment-documentation)

## File Structure

```
elements/
└── _index.scss               # Element styles for HTML elements
```

This segment compiles into the Common stylesheet through the Common segment: `common/common.scss` is the only file that imports it, and no page or layout entry does. See [Common](./common.md).

[↑ Back to top](#elements-segment-documentation)

## Files Overview

### Index file

`_index.scss` contains styles for HTML elements used globally across the application.

**Contents:**
- Selection styles for text
- Focus-visible styles
- Base `body` background (the shell grid is not here: it sits on each layout's root `l-` class, owned by Layout)
- Form element styling
- Media element behavior
- Base typography: the font family, size and line height (`--lh-<step>`) on `html` and `body`, read from the Theme font tokens

[↑ Back to top](#elements-segment-documentation)

## Key Features

Each row below states what the segment is for, then gives an example of how one project satisfied it. **The examples are illustrative** — a project's layout root may or may not be a grid, and may or may not have a parallax background. What the standard fixes is which selectors are permitted here and which rules belong here rather than in another segment.

| # | Feature                   | Guidelines                                                                                                                                                                                                                                                                                                                                                                |
|---|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Shell Layout**          | - The shell grid is not declared on `body`: it sits on each layout's root `l-` class (for example `.l-app`, `.l-intro`), owned by the Layout segment, because `body` is shared by every layout<br>- `body` keeps only what suits every layout: the base background and typography<br>- *Example:* a three-row CSS Grid on the layout root — header, main content, footer  |
| 2 | **Responsive Background** | - Declares the **base** body background only: different background images for different screen sizes<br>- A background that changes with the theme is **not** declared here. It goes in `custom.theme.css` in the Theme segment, which is linked after this segment and therefore overrides this one<br>- *Example:* a fixed background attachment, for a parallax effect |
| 3 | **Form Enhancement**      | - Bare form controls are styled here, not in a component — they are elements<br>- *Examples:* accent colors on checkboxes and radios, a caret color for text inputs, autofill styling matched to the project's tokens                                                                                                                                                     |
| 4 | **Accessibility**         | - Focus-visible styles for keyboard navigation<br>- High contrast text selection colors<br>- Proper focus management                                                                                                                                                                                                                                                      |
| 5 | **User Experience**       | - Disabled user selection on media elements<br>- Smooth transitions and interactions<br>- Consistent visual feedback                                                                                                                                                                                                                                                      |
| 6 | **Base Typography**       | - The base font family, font size and line height are declared on `html` and `body` here, reading the font tokens from the Theme segment; the line height is read from `--lh-<step>`<br>- Generic sets no font values; it only makes form controls inherit them |

[↑ Back to top](#elements-segment-documentation)

## Best Practices

| # | Principle                   | Guidelines                                                                                                         |
|---|-----------------------------|--------------------------------------------------------------------------------------------------------------------|
| 1 | **Element-Specific Styles** | - Only style HTML elements, not classes<br>- Keep styles global and reusable<br>- Avoid component-specific styling |
| 2 | **Performance**             | - Use efficient selectors<br>- Minimize CSS output<br>- Optimize for rendering performance                         |
| 3 | **Accessibility**           | - Ensure proper focus management<br>- Use semantic color choices<br>- Maintain keyboard navigation support         |
| 4 | **Maintainability**         | - Document complex styles<br>- Use clear and descriptive comments<br>- Keep styles organized and readable          |

[↑ Back to top](#elements-segment-documentation)

## Rules

| # | ID         | Rule                           | Description                                                                                                                                                                                                                                                                                           | Priority |
|---|------------|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-ELEM-1   | **Element Only**               | Style only HTML elements, not classes or IDs                                                                                                                                                                                                                                                          | Critical |
| 2 | R-ELEM-2   | **Project-Wide Selector Rule** | Elements is one of only two segments — the other being Generic — where element (type) selectors are permitted. Outside them, R-06 allows only these exemptions: `body` in `custom.theme.css` (R-34); `:root` in the theme token files (R-19); and attribute selectors where R-26 permits them — in Generic and Elements, in `common/_attributes.common.scss` for vendor markup, and `[aria-*]` or `:is([dir="rtl"])` chained onto a project class — see [Rules](../guides/rules.md). Every other file must use class selectors only. ID selectors remain banned in every segment without exception, including here. | Critical |
| 3 | R-ELEM-3   | **Base Background Only**       | This segment declares the base body background and its responsive variants. A background that varies by theme belongs to `custom.theme.css` in the Theme segment, which is linked later and wins. Never declare the same per-theme background in both places.                                         | Critical |

[↑ Back to top](#elements-segment-documentation)

## Related Files

| Segment                                   | Usage                                                                               |
|-------------------------------------------|-------------------------------------------------------------------------------------|
| **[Generic Segment](./generic.md)**       | Builds upon reset styles                                                            |
| **[Common Segment](./common.md)**         | Uses element styles for shared components                                           |
| **[Components Segment](./components.md)** | Relies on element styles for consistent behavior                                    |
| **[Settings Segment](./settings.md)**     | Uses design system variables and values                                             |
| **[Theme Segment](./theme.md)**           | Overrides the base body background declared here when a theme needs a different one |

[↑ Back to top](#elements-segment-documentation)
