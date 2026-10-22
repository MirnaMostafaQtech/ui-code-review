# Pages Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Pages** segment contains page-specific styles that are unique to individual pages. This segment should be minimal and primarily use components, modules, and utilities from other segments.

| # | Section                                   | What it covers                         |
|---|-------------------------------------------|----------------------------------------|
| 1 | [Purpose](#purpose)                       | What the segment is for                |
| 2 | [File Structure](#file-structure)         | One folder per page, and output naming |
| 3 | [Naming Conventions](#naming-conventions) | File naming and the `p-` class prefix  |
| 4 | [Usage Examples](#usage-examples)         | A page in markup                       |
| 5 | [Best Practices](#best-practices)         | How to author this segment             |
| 6 | [Rules](#rules)                           | What a review rejects                  |
| 7 | [Related Files](#related-files)           | The segments this one works with       |

---

## Purpose

The Pages segment provides:

| Aspect                | Description                             |
|-----------------------|-----------------------------------------|
| Page-Specific Styles  | Unique styles for individual pages      |
| Content Arrangement   | How this page's own content is laid out |
| Content Styling       | Page-specific content presentation      |
| Minimal Customization | Lightweight page-specific overrides     |

[↑ Back to top](#pages-segment-documentation)

## File Structure

```
pages/
├── standalone/
│   └── <page-name>/
│       ├── <page-name>.page.scss
│       └── <page-name>.page.min.css
├── state/
│   └── <state-page>/
│       ├── <state-page>.page.scss
│       └── <state-page>.page.min.css
└── <main-program>/
    └── <sub-program>/
        └── <page-name>/
            ├── <page-name>.page.scss
            └── <page-name>.page.min.css
```

`standalone` and `state` are reserved names: no main program or sub-program may use them. A standalone page, such as a login page, goes in `standalone/<page-name>/`. A state page — an error page, a no-permission page, or any other page that reports a state — goes in `state/<state-page>/`. When a main program contains sub-programs — the items under one entry of the side menu, for example — each page goes in `<main-program>/<sub-program>/<page-name>/`, so a sub-program can hold many pages; a project has as many main-program folders as it needs. Each page folder holds one entry, named after the page. A main-program page sits four levels below the SCSS root, so its `@use` paths step up four times (`../../../../tools`); a standalone or state page sits three levels below it and steps up three times (`../../../tools`).

`*.page.min.css` is the Web Compiler route's output name; the Node route compiles the same entry to `*.page.css`. Output naming is specified in [Build Documentation](../guides/build.md).

[↑ Back to top](#pages-segment-documentation)

## Naming Conventions

### File Naming
- Use kebab-case for file names
- Include `.page.scss` suffix
- Place each page in `standalone/`, `state/` or its main program's folder — see [File Structure](#file-structure)
- Example: `home.page.scss`, `profile.page.scss`

### Class Naming
- Use `p-` prefix for page-specific classes
- Follow BEM methodology
- Keep names descriptive and specific

[↑ Back to top](#pages-segment-documentation)

## Usage Examples

### A page in markup

One project's page, **illustrative only** — the page name, the element names and the copy are its own. What the standard fixes is the `p-` prefix, one page folder per page, and that a page adds only what is specific to it. `<variant-class>` stands for the project's own variant class.

```html
<div class="p-home">
  <section class="p-home__hero">
    <div class="p-home__hero-content">
      <h1 class="p-home__title">Page title</h1>
      <p class="p-home__subtitle">A line of introductory copy</p>
      <div class="p-home__actions">
        <button class="c-button <variant-class>">Primary action</button>
        <button class="c-button <variant-class>">Secondary action</button>
      </div>
    </div>
  </section>
</div>
```

[↑ Back to top](#pages-segment-documentation)

## Best Practices

| # | Principle                 | Guidelines                                                                                                                                                            |
|---|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Minimal Customization** | - Use existing components and utilities <br> - Only add page-specific styles when necessary <br> - Avoid duplicating component styles                                 |
| 2 | **Component Composition** | - Build a page from objects, components and modules that already exist, imported through that page's own entry file <br> - Leverage utility classes for quick styling |
| 3 | **Responsive Design**     | - Test across all breakpoints <br> - Use flexible layouts                                                                                                             |
| 4 | **Performance**           | - Keep page styles lightweight <br> - Minimize CSS output <br> - Use efficient selectors                                                                              |
| 5 | **Maintainability**       | - Use clear naming conventions <br> - Keep styles organized and readable                                                                                              |

[↑ Back to top](#pages-segment-documentation)

## Rules

| # | ID        | Rule                          | Description                                                                                                                                                                                                                                                                     | Priority |
|---|-----------|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-PAGE-1  | **Page-Specific**             | Only styles unique to this page. A page entry is never `@use`d from another page, a layout, a module or `common` — a page bundle is an endpoint, not a source                                                                                                                   | Critical |
| 2 | R-PAGE-2  | **No Page Chrome**            | A page holds its own content and nothing around it. The header, the navbar, the side menu, the footer and the shell the content sits in belong to [Layout](./layout.md), whichever layout the page uses — never to a page file                                                  | Critical |
| 3 | R-PAGE-3  | **Import What Is Page-Local** | A page entry `@use`s what it needs when four pages or fewer use it and no layout needs it. Once a fifth page needs it, or a layout needs it, it is promoted to a `common/` aggregator and removed from every page entry, never left in both — see [Common Documentation](./common.md) | Critical |
| 4 | R-PAGE-4  | **Responsive**                | Renders with no horizontal overflow from 320 CSS px up, and is checked at every breakpoint key the project defines                                                                                                                                                              | Critical |
| 5 | R-PAGE-5  | **Accessible**                | Meets the rules in [Accessibility](../guides/accessibility.md)                                                                                                                                                                                                                  | Medium   |

[↑ Back to top](#pages-segment-documentation)

## Related Files

| Segment                                   | Usage                                                |
|-------------------------------------------|------------------------------------------------------|
| **[Common Segment](./common.md)**         | Holds the components and modules shared across pages |
| **[Components Segment](./components.md)** | Uses self-contained components                       |
| **[Modules Segment](./modules.md)**       | Uses complex components                              |
| **[Layout Segment](./layout.md)**         | Uses layout patterns                                 |
| **[Utilities Segment](./utilities.md)**   | Uses utility classes                                 |
| **[Tools Segment](./tools.md)**           | Uses mixins and functions                            |

[↑ Back to top](#pages-segment-documentation)
