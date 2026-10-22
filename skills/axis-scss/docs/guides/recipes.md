# Recipes

[← Back to README](../README.md)

Each recipe is the short form of a routine task. If this page and the linked document differ, the linked document is right. On the Node route no step here touches the build: directory mode finds every entry file on its own.

| #  | Section                                                    | What it covers                                     |
|----|------------------------------------------------------------|----------------------------------------------------|
| 1  | [Add an object](#add-an-object)                            | Creating and placing an object                     |
| 2  | [Add a component](#add-a-component)                        | Creating and placing a component                   |
| 3  | [Add a utility](#add-a-utility)                            | Creating and reaching a utility class              |
| 4  | [Add a module](#add-a-module)                              | Creating and placing a module                      |
| 5  | [Add a control module](#add-a-control-module)              | Creating and placing a control module              |
| 6  | [Add a vendor override](#add-a-vendor-override)            | Where a vendor correction belongs                  |
| 7  | [Add a layout](#add-a-layout)                              | Creating a layout and linking it                   |
| 8  | [Add a page](#add-a-page)                                  | Pointer to the Worked Example                      |
| 9  | [Add a package](#add-a-package)                            | Adding a vendor library's CSS                      |
| 10 | [Add a locale build](#add-a-locale-build)                  | Adding a second locale build                       |
| 11 | [Add a breakpoint](#add-a-breakpoint)                      | Adding a key to the breakpoints map                |
| 12 | [Set up a new client theme](#set-up-a-new-client-theme)    | Setting one deployment's identity values           |
| 13 | [Promote a file to common](#promote-a-file-to-common)      | Moving a page-local file to a `common/` aggregator |

---

## Add an object

| # | Step                                                                                                                                                                                                                                                     |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create `objects/_<object-name>.object.scss`, with the `o-` prefix on its block. Its pattern is fixed — a different pattern is a different object — but it may carry project-named variant classes and `is-*`/`has-*` states.                               |
| 2 | It is a partial, so it needs no build entry.                                                                                                                                                                                                               |
| 3 | Choose its import route by the [Placement Rule](../segments/common.md#placement-rule) (R-28): used by five or more page entries, or needed by any layout, `@use` it from `common/_objects.common.scss`; otherwise `@use` it from each page entry that needs it. |

See [Objects](../segments/objects.md).

## Add a component

| # | Step                                                                                                                                                                                                                                                       |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create `components/_<component-name>.component.scss`, with the `c-` prefix on its block.                                                                                                                                                                   |
| 2 | It is a partial, so it needs no build entry.                                                                                                                                                                                                               |
| 3 | Choose its import route by the [Placement Rule](../segments/common.md#placement-rule): used by five or more page entries, or needed by any layout, `@use` it from `common/_components.common.scss`; otherwise `@use` it from each page entry that needs it. |

See [Components](../segments/components.md).

## Add a utility

| # | Step                                                                                                                                                                         |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Pick the category that matches what it does: `accessibility/`, `interaction/`, `layout/`, `typography/` or `visual/`. The five are fixed.                                     |
| 2 | Add the class to that category's `_<name>.utility.scss`, or create one for a new group. A utility whose value is a scale step or numeric value is named `u-{property}-{value}`; otherwise it gets a clear, expected name. Have it set one thing. A generated color utility is added by adding a map entry in the project's colors settings file (`settings/_colors.settings.scss` in the examples), not by writing a class.                           |
| 3 | Reach a new file through that category's `_index.scss` — see [Best Practices — Folder Index Files](./best-practices.md#folder-index-files).                                |
| 4 | No new build entry: `utilities/utils.scss` is the entry. On the Web Compiler route, check that it is listed in `compilerconfig.json`; it is the entry most easily forgotten. |

See [Utilities](../segments/utilities.md).

## Add a module

| # | Step                                                                                                                                                     |
|---|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create `modules/_<module-name>.module.scss`, with the `m-` prefix on its block. It holds no vendor selector: a vendor override goes in a library module. |
| 2 | It is a partial, so it needs no build entry.                                                                                                             |
| 3 | Choose its import route by the Placement Rule, with `common/_modules.common.scss` as the shared route.                                                   |

See [Modules](../segments/modules.md).

## Add a control module

A control module is a reusable, complex, JavaScript-driven component from outside the project — such as a dropdown list, a table or a calendar — that the project styles itself.

| # | Step                                                                                        |
|---|---------------------------------------------------------------------------------------------|
| 1 | Create `modules/_<control-name>.control.module.scss`, with the `ctrl-` prefix on its block. |
| 2 | From here it is a module: no build entry, and the import route follows the Placement Rule.  |

See [Modules — Control Modules](../segments/modules.md#control-modules).

## Add a vendor override

| # | Step                                                                                                                                                                                                                                                                                                                                                                                                                  |
|---|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | A reset- or element-level correction to the vendor's styles belongs in Generic, written with element selectors only — never a vendor class.                                                                                                                                                                                                                                                                           |
| 2 | A component-level override (`.btn`, `.modal`, `.dropdown-menu`, `.form-control`) is a library module: create `modules/_<vendor-component>.<library>.module.scss`, named after the component (`_modal.bootstrap.module.scss` → `.m-modal`), add that `m-` class beside the vendor class on the vendor element, and write the rule against the `m-` class, with the vendor's inner parts nested inside it (R-30, R-36). |
| 3 | When the vendor element cannot take a class, or the vendor selector out-specifies the `m-` class, the wrapper case in R-30 and R-36 applies.                                                                                                                                                                                                                                                                                                                                |
| 4 | From here it is a module: no build entry, and the import route follows the Placement Rule.                                                                                                                                                                                                                                                                                                                            |
| 5 | An element the vendor's JS generates outside the project's markup is the exception named in R-30 and R-36.                                                                                                                                                                                                                                                                                                                                                                  |
| 6 | Never nest a vendor override inside a control module: a control module is isolated, and no other file styles or overrides its `ctrl-` block (R-31).                                                                                                                                                                                                                                                                   |

See [Modules — Vendor Override Scoping](../segments/modules.md#vendor-override-scoping).

## Add a layout

| # | Step                                                                                                                                                                                |
|---|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create `layout/<layout-name>/`, named after what the layout is.                                                                                                                     |
| 2 | Add its partials as `_<part>.<layout-name>.layout.scss`, with the `l-` prefix on their classes. A part every layout uses goes in `layout/shared/` as `_<part>.layout.scss` instead. |
| 3 | Create the entry file `layout/<layout-name>/<layout-name>.layout.scss`.                                                                                                             |
| 4 | On the Web Compiler route, add that entry to `compilerconfig.json`.                                                                                                                 |
| 5 | Link its compiled stylesheet in the `<head>`, in the position [HTML and CSS Output Reference](./output.md) gives it.                                                                |

See [Layout](../segments/layout.md).

## Add a page

Follow the [Worked Example](./walkthrough.md), which takes one page from markup to compiled output.

## Add a package

| # | Step                                                                                                                                                                                        |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Create `packages/<library><version>/`, one folder per library.                                                                                                                                        |
| 2 | Add the file with its content exactly as the library published it, renamed to `<library><major>.<locale>.min.css`. Never edit its content, compile it, or `@use`/`@import` it from SCSS (R-33).                                  |
| 3 | Link it directly in the layout `<head>`, before the project's own compiled stylesheets.                                                                                                        |
| 4 | Its size is measured as [Performance](./performance.md) describes but carries no budget — it is linked prebuilt, so no development decision changes it.                                       |

See [Packages](../segments/packages.md).

## Add a locale build

| # | Step                                                                                                                                                                                        |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Add the locale's build in the same library folder, side by side with the others — `<library><major>.<locale>.min.css`, with a real locale code such as `ar`. One file per locale, even when two locales' builds are identical. |
| 2 | The same request that decides which locale to serve also decides which locale's file to link and the `dir` attribute on `<html>` — a right-to-left locale such as `ar` links its own build with `dir="rtl"`. |

See [Packages](../segments/packages.md).

## Add a breakpoint

| # | Step                                                                                                                                                                         |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Add a key and its `rem` value, with its px equivalent in a comment (e.g. `md: 48rem, // 768px`), to `settings/_breakpoints.settings.scss`. Add it there before using it anywhere: the key set is the vocabulary every media query uses. |
| 2 | Write queries against the new key the way the project's own tools emit them. This standard publishes no media-query mixin; a project documents its own in its Tools segment. |

See [Settings — What the breakpoints map must provide](../segments/settings.md#what-the-breakpoints-map-must-provide).

## Set up a new client theme

One deployment serves one client, and a client's identity is set by the values in the Theme segment.

| # | Step                                                                                                                                                         |
|---|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Set that client's identity values in `theme/colors/colors.base.theme.css`.                                                                                  |
| 2 | Set that client's font family and its font-file path in `theme/fonts/fonts.theme.css`.                                                                      |
| 3 | Put theme-specific customizations, such as backgrounds and brand-asset positioning, in `theme/custom.theme.css`. No custom property; any class selector; `body` is the only element selector. |
| 4 | None of the theme files is compiled, so there is no build step. Do not rename or minify them.                                                               |

How a deployment itself is set up is not documented here.

See [Theme](../segments/theme.md).

## Promote a file to common

When a fifth page entry needs a page-local object, component or module, or a layout needs it:

| # | Step                                                                                                                                              |
|---|---------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Add its `@use` line to the matching aggregator: `common/_objects.common.scss`, `common/_components.common.scss` or `common/_modules.common.scss`. |
| 2 | Delete that `@use` line from every page entry that carries it.                                                                                    |
| 3 | Check that no page entry still imports it. A line left behind ships the file twice on that page, and is a review-blocking defect.                 |
| 4 | The file itself does not move.                                                                                                                    |

See [Common — Placement Rule](../segments/common.md#placement-rule).

[↑ Back to top](#recipes)
