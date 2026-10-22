# Packages Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Packages** segment holds the CSS of external libraries and packages — Bootstrap, Swiper and anything like them — gathered into one place for `separation of concerns`. Nothing in this segment is written by the project, and nothing in it is compiled: each file's content ships exactly as the library published it, under the renamed form shown in [File Structure](#file-structure).

| # | Section                                             | What it covers                                |
|---|-----------------------------------------------------|-----------------------------------------------|
| 1 | [Purpose](#purpose)                                 | What the segment is for                       |
| 2 | [File Structure](#file-structure)                   | One folder per library, and its locale builds |
| 3 | [How Packages Are Loaded](#how-packages-are-loaded) | Why files here are linked, never `@use`d      |
| 4 | [Best Practices](#best-practices)                   | How to author this segment                    |
| 5 | [Rules](#rules)                                     | What a review rejects                         |
| 6 | [Related Files](#related-files)                     | The segments this one works with              |

---

## Purpose

The Packages segment provides:

| Aspect                     | Description                                                                                       |
|----------------------------|---------------------------------------------------------------------------------------------------|
| **Separation of concerns** | Every third-party stylesheet lives in one segment, never mixed into the project's own SCSS        |
| **No recompilation**       | Vendor CSS is linked directly in the layout, so the SCSS compiler never reprocesses it            |
| **Caching**                | A prebuilt vendor file is byte-identical across pages and across releases while its version stays the same, so the browser caches it once |
| **Upgradability**          | Because the files are untouched, replacing a library is a folder swap plus one `<link>` edit per layout, not a merge |

[↑ Back to top](#packages-segment-documentation)

## File Structure

```
packages/
└── <library><version>/
    └── <library><major>.<locale>.min.css   # one build per locale
```

`<library>` is the package's name (e.g. `bootstrap`); `<version>` is its full version with dots (e.g. `5.3.3`); `<major>` is its major version only (e.g. `5`). `<locale>` is a real locale code of the project's supported locales, such as `ar`.

`packages/` holds only external libraries and frameworks. Each library gets its own folder under `packages/`. Locale-specific builds sit side by side inside it, one file per locale — even when two locales' builds are identical, each has its own file. Every build carries its locale, even when the library publishes only one.

Renaming a file leaves the `/*# sourceMappingURL=… */` comment inside it pointing at a map file that is not shipped; dev tools show a harmless 404. The comment stays, because file content is never modified (R-33).

[↑ Back to top](#packages-segment-documentation)

## How Packages Are Loaded

A packages file is **never** `@use`d from SCSS — not from a page entry, not from a layout entry, and not from `common/common.scss`. It is linked directly in the layout HTML:

```html
<!-- The component framework or library first -->
<link href="/path/to/SCSS/directory/packages/bootstrap<version>/bootstrap<major>.<locale>.min.css" rel="stylesheet" />
<!-- Then the other packages, in no fixed order -->
<link href="/path/to/SCSS/directory/packages/<library><version>/<library><major>.<locale>.min.css" rel="stylesheet" />
<!-- A right-to-left locale links its own build, with dir="rtl" on the html element. -->
```

All packages are linked before the project's own stylesheets; the component framework or library comes first among them, and the other packages follow in no fixed order.
Importing it into SCSS would make the compiler reprocess CSS that is already final, cost build time for nothing, and bury the library inside a bundle that changes whenever the project's own styles change — destroying its cacheability. See [HTML and CSS Output Reference](../guides/output.md).

[↑ Back to top](#packages-segment-documentation)

## Best Practices

| # | Principle                  | Guidelines                                                                                                                                                                                                              |
|---|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Never modify**           | - Do not edit a vendor file in place <br> - An edit is lost on the next library upgrade and leaves no record of what changed                                                                                            |
| 2 | **Where overrides go**     | - Component-level overrides (`.btn`, `.modal`, `.dropdown-menu`, `.form-control`) belong to **Modules**, in library modules; reset- and element-level corrections belong to **Generic** — full rule in [Modules — Vendor Override Scoping](./modules.md#vendor-override-scoping) |
| 3 | **No prefix**              | - This segment adds no class prefix of its own; the library's own class names are used as published                                                                                                                     |
| 4 | **Locale builds**          | - Keep one build per locale side by side and select between them in the layout <br> - A right-to-left locale's build is linked together with `dir="rtl"` on the `html` element                                          |
| 5 | **Version clarity**        | - Keep the full version in the folder name (`packages/bootstrap<version>/`) and the major version in the filename (`bootstrap<major>.*`), so what is shipping is readable at a glance                                                                                                                 |
| 6 | **Measured, not budgeted** | - The size of a vendor build is counted in the performance report but carries no budget — it is linked prebuilt, so no decision a developer makes can change it                                                         |

[↑ Back to top](#packages-segment-documentation)

## Rules

| # | ID        | Rule                       | Description                                                                                                                                                                                                          | Priority |
|---|-----------|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-PKG-1   | **Never compiled**         | No file in this segment passes through the SCSS compiler, and no entry for it appears in `compilerconfig.json` or in the Node build scripts (R-33)                                                                   | Critical |
| 2 | R-PKG-2   | **Never imported**         | No `@use` or `@import` anywhere in the project points into `packages/` (R-33)                                                                                                                                         | Critical |
| 3 | R-PKG-3   | **Never modified**         | Vendor file content ships exactly as published; corrections live in Modules or Generic (R-33)                                                                                                                                | Critical |
| 4 | R-PKG-4   | **Linked first**           | The vendor stylesheet is linked before the project's own compiled stylesheets, so the project's styles win at equal specificity — see the link-order principle in [HTML and CSS Output Reference](../guides/output.md) | Critical |

[↑ Back to top](#packages-segment-documentation)

## Related Files

| Segment                                                | Usage                                                                                |
|--------------------------------------------------------|--------------------------------------------------------------------------------------|
| **[Modules Segment](./modules.md)**                    | Holds every component-level vendor override, one library module per vendor component |
| **[Generic Segment](./generic.md)**                    | Holds reset- and element-level corrections to vendor styles                          |
| **[HTML and CSS Output Reference](../guides/output.md)** | The `<link>` order the layout uses, and why vendor CSS is linked rather than imported |
| **[Performance](../guides/performance.md)**            | Why the vendor build is measured but not budgeted                                    |

[↑ Back to top](#packages-segment-documentation)
