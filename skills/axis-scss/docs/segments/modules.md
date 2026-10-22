# Modules Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Modules** segment serves three purposes: (1) styling the interaction between two or more components placed together — for example the gap between a button and a search input sitting side by side; (2) **library modules** — overrides of one component of a linked framework or library, each in its own `_<vendor-component>.<library>.module.scss` file (see [Vendor Override Scoping](#vendor-override-scoping)); and (3) styles for **control modules** — standalone JavaScript widgets with their own markup, such as a datepicker, a Select2-style list, or a data grid.

| # | Section                                             | What it covers                                                                                                       |
|---|-----------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| 1 | [Purpose](#purpose)                                 | What the Modules segment provides                                                                                    |
| 2 | [File Structure](#file-structure)                   | Module, library module and control module file naming                                                                |
| 3 | [Naming Conventions](#naming-conventions)           | The `m-` and `ctrl-` prefixes, BEM                                                                                   |
| 4 | [Control Modules](#control-modules)                 | What a control module is, and its isolation from the rest of the project                                             |
| 5 | [Vendor Override Scoping](#vendor-override-scoping) | Library modules: where a vendor override goes, and the one exception for vendor-generated markup outside the project |
| 6 | [Best Practices](#best-practices)                   | How to author a module                                                                                               |
| 7 | [Rules](#rules)                                     | What a review rejects                                                                                                |
| 8 | [Related Files](#related-files)                     | The segments this one works with                                                                                     |

---

## Purpose

The Modules segment provides:

| Aspect                | Description                                                                                                                                                              |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Component Interaction | Styles for two or more components placed together — layout, gaps, and interaction between them (for example a button next to a search input)                             |
| Library Modules       | Scoped overrides of one external framework or library component, such as Bootstrap's `.modal`, each in its own `_<vendor-component>.<library>.module.scss`               |
| Control Modules       | Styles for a standalone JavaScript widget with its own markup — for example a datepicker, a Select2-style list, or a data grid                                          |

[↑ Back to top](#modules-segment-documentation)

## File Structure

```
modules/
├── _<module-name>.module.scss
├── _<vendor-component>.<library>.module.scss
├── _<control-name>.control.module.scss
├── ...
└── ...
```

| File                                        | Holds                                                                   | Block prefix |
|---------------------------------------------|-------------------------------------------------------------------------|--------------|
| `_<module-name>.module.scss`                | The project's own components placed together; no vendor selector (R-36) | `m-`         |
| `_<vendor-component>.<library>.module.scss` | The override of one vendor component — a library module (R-36)          | `m-`         |
| `_<control-name>.control.module.scss`       | A control module (R-31)                                                 | `ctrl-`      |

`<library>` is the package's name as in [Packages](./packages.md#file-structure), lowercase and without a version (`bootstrap`, `swiper`). `<vendor-component>` is the vendor component the file overrides (`modal`, `form-control`).

[↑ Back to top](#modules-segment-documentation)

## Naming Conventions

### Class Prefix
- **MUST** use `m-` prefix for module and library module classes, and `ctrl-` for control module classes
- Examples: `_search-bar.module.scss` → `.m-search-bar`; `_modal.bootstrap.module.scss` → `.m-modal`; `_datepicker.control.module.scss` → `.ctrl-datepicker`

### BEM Methodology

Modules are BEM blocks with elements, like components, objects and layouts — see [Naming Conventions](../guides/naming-conventions.md). The `m-` and `ctrl-` prefixes are what distinguish them.

[↑ Back to top](#modules-segment-documentation)

## Control Modules

A **library module** is an override of a component of a linked framework or library — a Bootstrap modal, Swiper. A **control module** is a standalone JavaScript widget with its own markup — a datepicker, a Select2-style list, a data grid. It lives in Modules rather than Components because it is not a self-contained component of the current project, and it is not an `m-` module: an `m-` module composes the project's own components or overrides a vendor component. A control module's block carries the `ctrl-` prefix.

The project's styling of the widget lives in `modules/_<control-name>.control.module.scss`, with the block `.ctrl-<control-name>`. If the widget comes with a CSS file, that CSS is converted into SCSS in its control module file; the widget's CSS does not stay a plain `.css` file and does not go in `packages/`, which holds only external libraries and frameworks.

A control module is isolated from the rest of the project: its styles live only in its own control module file, inside its own `ctrl-` block. No other file — module, page, layout, common, or theme — styles or overrides a `ctrl-` block (R-31).

A popup the widget appends outside its `ctrl-` block cannot sit inside that block. It is styled in the same file, on a second class set through the widget's options, named `.ctrl-<control-name>-popup`:

```scss
@charset "UTF-8";

// _datepicker.control.module.scss
.ctrl-datepicker {
  // the widget's own markup
}

.ctrl-datepicker-popup {
  // the popup, appended outside .ctrl-datepicker; the class is passed in the widget's options
}
```

[↑ Back to top](#modules-segment-documentation)

## Vendor Override Scoping

A **library module** holds the override of one component of an external framework or library — Bootstrap's `.modal`, `.btn`, `.dropdown-menu`, `.form-control`. Each overridden component gets its own file, named after it, with an `m-` class of the same name: `_modal.bootstrap.module.scss` → `.m-modal`, `_form-control.bootstrap.module.scss` → `.m-form-control`. Every override of a vendor component lives in its library module and nowhere else; a plain `_<module-name>.module.scss` holds no vendor selector (R-36). A project links one component framework — Bootstrap, for example — and other libraries, such as Swiper, may sit beside it; an own `_<module-name>.module.scss` never takes the name of a library module's component, so an `m-` class such as `.m-modal` is declared once (R-36).

The `m-` class sits **on the vendor element itself**, beside the vendor class. The rule is written against the `m-` class only; a vendor state is repeated on it, and the vendor's inner parts are nested inside it (R-30):

```html
<input class="form-control m-form-control">

<div class="modal m-modal">
  <div class="modal-header">…</div>
</div>
```

```scss
@charset "UTF-8";

// _form-control.bootstrap.module.scss
.m-form-control {
  // vendor override, on the project's own class
  &:focus {
    // a vendor state, repeated on the m- class
  }
}
```

```scss
@charset "UTF-8";

// _modal.bootstrap.module.scss
.m-modal {
  .modal-header {
    // a vendor inner part, nested inside the m- class
  }
}
```

At equal specificity, the `m-` class wins over the vendor's own rule by load order: the project's CSS is linked after the vendor CSS — see [HTML and CSS Output Reference](../guides/output.md). An owned wrapper element carrying the `m-` class goes around the vendor element, with the vendor selector nested inside that wrapper, in two cases only: the vendor element cannot take a class, or the vendor's own selector is more specific than the `m-` class, so load order alone cannot win.

A style an own module needs only in its own context is written in that own module, against the library module's `m-` class — never against the vendor class:

```scss
@charset "UTF-8";

// _search-bar.module.scss
.m-search-bar {
  .m-form-control {
    // search-bar-only style
  }
}
```

A bare vendor selector at the top level of a file is not permitted. The one exception is an element the vendor's JS generates outside the project's markup — for example a Bootstrap tooltip appended to `<body>` — which cannot carry an `m-` class; that is overridden in `common/_classes.common.scss` instead — see [Common](./common.md#file-structure). `_classes.common.scss` otherwise holds only overrides of global, non-vendor classes the project does not own, and stays the legacy bridge; it is not a general app-wide vendor-override route. A control module is not a vendor-override route either: its `ctrl-` block is isolated (R-31), and a vendor override never nests inside one.

Reset-level and element-level corrections to a vendor framework such as Bootstrap belong to the **Generic** segment, not here — Modules only carries component-level overrides, each in its library module.

[↑ Back to top](#modules-segment-documentation)

## Best Practices

| # | Principle                 | Guidelines                                                                                                                                                                                                                                |
|---|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Component Composition** | - Build modules from self-contained components; a module may `@use` the components it composes, and each counts as used by every page that uses the module (R-28) <br> - Avoid duplicating component styles <br> - Use composition over inheritance |
| 2 | **Vendor Integration**    | - Override vendor components only as [Vendor Override Scoping](#vendor-override-scoping) describes <br> - Keep the vendor widget working                                                                                                |
| 3 | **Accessibility**         | - Include proper ARIA attributes <br> - Ensure keyboard navigation <br> - Maintain focus management <br> - See [Markup](../guides/accessibility.md#markup)                                                                                |
| 4 | **Performance**           | - Keep modules lightweight <br> - Use efficient selectors                                                                                                                                                                               |
| 5 | **Maintainability**       | - Document complex interactions <br> - Use clear naming conventions <br> - Keep modules focused and single-purpose                                                                                                                        |

[↑ Back to top](#modules-segment-documentation)

## Rules

| # | ID      | Rule                   | Description                                                                                                                                                                                           | Priority |
|---|---------|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-MOD-1 | **Prefixes**           | Module and library module classes use `m-`; control module classes use `ctrl-`                                                                                                                        | Critical |
| 2 | R-MOD-2 | **Complex Components** | A module styles two or more components placed together, is a library module, or is a control module — nothing else                                                                                    | Critical |
| 3 | R-MOD-3 | **Vendor Overrides**   | Every vendor override lives in its library module (R-36, R-30) — see [Vendor Override Scoping](#vendor-override-scoping).                                                                           | High     |
| 4 | R-MOD-4 | **Never Moves**        | Every module file stays in `modules/`. Sharing changes only which file `@use`s it — see the placement rule in [Common Documentation](./common.md)                                                     | Critical |
| 5 | R-MOD-5 | **Accessibility**      | Meets the rules in [Accessibility](../guides/accessibility.md)                                                                                                                                        | Medium   |

[↑ Back to top](#modules-segment-documentation)

## Related Files

| Segment                                         | Usage                                                                  |
|-------------------------------------------------|------------------------------------------------------------------------|
| **[Common Segment](./common.md)**               | Imports the modules that are shared application-wide                   |
| **[Components Segment](./components.md)**       | Components a module composes; the module `@use`s them (R-28)           |
| **[Layout Segment](./layout.md)**               | Layout considerations for modules                                      |
| **[Tools Segment](./tools.md)**                 | Mixins and functions for complex interactions                          |
| **External frameworks (for example Bootstrap)** | Override and extend their components here, one library module per component, on an `m-` class |

[↑ Back to top](#modules-segment-documentation)
