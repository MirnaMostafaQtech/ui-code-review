# Best Practices

[← Back to README](../README.md)

This page collects the authoring practices that apply across segments: reaching the Tools segment, the import order, folder index files, CSS custom properties, responsive design and units. Where a practice is a rule, the section links to the document that owns it.

| # | Section                                                               | What it covers                                |
|---|-----------------------------------------------------------------------|-----------------------------------------------|
| 1 | [Using the Tools Segment](#using-the-tools-segment)                   | Reaching a project's own mixins and functions |
| 2 | [Import Order](#import-order)                                         | The fixed `@use` order in a page entry        |
| 3 | [Folder Index Files](#folder-index-files)                             | When a folder gets one, and what it holds     |
| 4 | [CSS Custom Properties](#css-custom-properties)                       | Where the source of truth for colors lives    |
| 5 | [Responsive Design](#responsive-design)                               | Writing media queries                         |
| 6 | [Units](#units)                                                       | Where the units rules are stated              |

---

## Using the Tools Segment

A project's own functions and mixins live in the Tools segment and are documented there — this standard publishes no set of them. What it does fix is how they are reached.

Import all mixins and functions at the top of your SCSS files:
```scss
@charset "UTF-8";

@use "<path-to-root>/tools" as *; // forwards all mixins and functions
```

`<path-to-root>` is the relative path from the importing file up to the SCSS root, and it depends on how deep that file sits, not on which segment it belongs to. A file directly under a segment folder — `components/_<component-name>.component.scss` — steps up one level to reach it; a standalone page entry, two folders deeper — `pages/standalone/<page-name>/<page-name>.page.scss` — steps up three, and a main-program page entry — `pages/<main-program>/<sub-program>/<page-name>/<page-name>.page.scss` — steps up four. Every segment is reached the same way: `<path-to-root>/<segment>/…`. Include a mixin with `@include <mixin-name>(...)` and call a function as `<function-name>(...)`.

> **Note**: A tool that takes parameters validates them and throws `@error` on an invalid one. All maps, lists and variables live in `settings`.

**Reaching Settings.** Settings has no `_index.scss` (see [Folder Index Files](#folder-index-files)), so a file that reads a settings map does not reach it through one `@use` line the way it reaches Tools. It `@use`s that settings file directly — `@use "<path-to-root>/settings/breakpoints.settings" as *;` — with the same `<path-to-root>` as above.

## Import Order

Layout is absent from this list on purpose. A layout compiles to its own bundle and is linked separately in the page, so a page entry never imports it — importing it here would compile the layout a second time into the page's own stylesheet.

Every path in the block below starts with the placeholder `<path-to-root>`, because the depth is not part of the order — it follows from where the importing file sits. A standalone or state page entry — in `pages/standalone/<page-name>/` or `pages/state/<state-page>/` — sits three levels below the SCSS root, so its `<path-to-root>` steps up three times; a main-program page entry — in `pages/<main-program>/<sub-program>/<page-name>/` — sits four levels below it and steps up four times.

Use this exact order in page files like `pages/.../*.page.scss`:

```scss
@charset "UTF-8";

// 1) use the project's tools (mixins, functions)
@use "<path-to-root>/tools" as *;

// 2) Objects (undecorated design patterns) — page-local objects only.
//    A shared object is imported from common/_objects.common.scss instead,
//    and must NOT be repeated here. See the placement rule in segments/common.md.
@use "<path-to-root>/objects/<object-name>.object" as *;

// 3) Components (self-contained UI) — page-local components only.
//    A shared component is imported from common/_components.common.scss instead,
//    and must NOT be repeated here. See the placement rule in segments/common.md.
@use "<path-to-root>/components/<component-name>.component" as *;

// 4) Modules (composed of more than one component) — page-local modules only.
//    A shared module is imported from common/_modules.common.scss instead,
//    and must NOT be repeated here. See the placement rule in segments/common.md.
@use "<path-to-root>/modules/<control-name>.control.module" as *;
@use "<path-to-root>/modules/<vendor-component>.<library>.module" as *;
@use "<path-to-root>/modules/<module-name>.module" as *;

// 5) Local page rules (scoped with p- prefix)
.p-<page-name> {
  /* minimal page-specific overrides only */
}
```

> **`@charset` rule** (R-32): `@charset "UTF-8";` is the first line of every SCSS and CSS file in this project — entry files and partials alike, except files under `packages/`, which ship unchanged (R-33).

## Folder Index Files

A folder that is imported as a unit carries an `_index.scss`. `@use "<path-to-root>/tools" as *;` resolves to `tools/_index.scss`, and that is what lets a whole segment or sub-folder be pulled in with one line instead of one line per file.

- **It is always a partial.** Leading underscore, never configured in the build, never compiled to a stylesheet of its own.
- **Its content is `@charset` and import lines, nothing else.** A folder whose files emit CSS — Generic, a Utilities category, a layout sub-folder — uses `@use` lines; the Generic segment is the model: `@charset "UTF-8";` followed by `@use "./reset.generic" as *;`. A Tools folder holds mixins and functions, and `@use` does not pass those on to the file that imports the index, so `tools/_index.scss`, `tools/functions/_index.scss` and `tools/mixins/_index.scss` use `@forward` lines instead — for example `@forward "./functions";`.
- **A folder never holds both an `_index.scss` and a non-partial entry file.** `utilities/` holds `utils.scss` and `layout/app/` holds `app.layout.scss`; those are compiled entries, and they are how the folder is reached. Folders nested below an entry carry an `_index.scss` each, which is how a nested folder's files reach the entry through one line — `utilities/visual/backgrounds/` is the worked case.
- **A segment small enough to be one file writes its rules in `_index.scss` directly.** Elements is the only case: `elements/_index.scss` holds the element styles themselves rather than forwarding to a second file.
- **A folder whose files are imported one by one does not get one.** Objects, Components and Modules are reached file by file, through a `common/` aggregator or a page entry, so there is no `@use "<path-to-root>/components" as *;`.

Folders with an `_index.scss` today: `tools/`, `tools/functions/`, `tools/mixins/`, `generic/`, `elements/`, every category and sub-category folder under `utilities/`, and every sub-folder inside a layout folder. Settings, Common, Objects, Components, Modules, Pages, Packages and Theme have none.

## CSS Custom Properties
- Which values are custom properties, and which file is the single source of truth for colors, are set in the [Theme segment](../segments/theme.md); the naming rule and the HSL rule are stated once, in [Rules](./rules.md).

## Responsive Design
- Write media queries as plain `@media` rules, which every project has; where the project ships its own media-query mixin, use that instead

## Units
The units rules — the authored unit, the permitted hard-coded pixel values, and the precision limit — are stated once, in [Rules](./rules.md).

[↑ Back to top](#best-practices)
