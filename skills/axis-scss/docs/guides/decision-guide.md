# Decision Guide

[← Back to README](../README.md)

This page answers the question this architecture generates more often than any other: which segment does this file belong in. It is a router, not a rulebook — each pair gets a one-line test and a link to the document that owns the rule. If this page and the linked document differ, the linked document is right.

| I am about to write…                                | The question                     | Section                              |
|-----------------------------------------------------|----------------------------------|--------------------------------------|
| A widget, and I am not sure it stands alone         | Component or module              | [→](#component-or-module)            |
| The header, navbar, side menu or footer             | Module or layout                 | [→](#module-or-layout)               |
| Something that is either page content or what surrounds it | Layout or page                   | [→](#layout-or-page)                 |
| A pattern that holds other things                    | Object or component              | [→](#object-or-component)            |
| A small reusable shape, or a one-property helper    | Object or utility                | [→](#object-or-utility)              |
| A quick override on top of existing styles          | Utility or component             | [→](#utility-or-component)           |
| A file a fifth page has just asked for              | Page-local or common             | [→](#page-local-or-common)           |
| A correction to Bootstrap or another library        | Vendor fix in Generic or Common or Modules | [→](#vendor-fix-in-generic-or-common-or-modules) |
| A background                                        | Background in Elements or Theme  | [→](#background-in-elements-or-theme) |

---

## Component or module

**Test:** Does it mean something standing alone, as one widget? Component. Does it exist only because two or more widgets are placed together, or is it a component from outside the project that the project styles itself — a control module — or a library module — the scoped override of one vendor component? Module.

A component is one reusable UI widget that means something on its own. Modules cover the rest: the interaction between components placed together, library modules — scoped overrides of one vendor component each, and control modules — reusable, complex, JavaScript-driven components from outside the project, such as a dropdown list, a table or a calendar, that the project styles itself. Control modules live in Modules rather than Components because they are not self-contained components of the current project, and they carry `ctrl-` rather than `m-`.

*Example:* `c-button` is a component. The gap between that button and a search input sitting beside it is a module.

Settled by [Components](../segments/components.md) and [Modules](../segments/modules.md).

## Module or layout

**Test:** Is it a region of the page, or something placed inside a region?

Layout styles what surrounds the content: the header, the navbar, the side menu, the footer and the region the content sits in — and every Layout rule is written against an `l-`-prefixed class. Anything placed inside that region is a component or a module.

*Example:* `l-app__header` is the header band itself; a search bar sitting in it is an `m-` block.

Settled by [Layout](../segments/layout.md).

## Layout or page

**Test:** Is it the page's own content, or what surrounds it?

Everything that is not the content belongs to Layout — the header, the navbar, the side menu, the footer, the shell the content sits in. A page file holds only what is unique to that page. A new layout is justified when what surrounds the content differs; two pages inside the same shell are two pages, not two layouts.

*Example:* the header band above a checkout form is Layout. The form's own arrangement is the page.

Settled by [Layout](../segments/layout.md) and [Pages](../segments/pages.md).

## Object or component

**Test:** Does it mean something by itself?

A component means something by itself — a button is a button. An object is a shape that means nothing until something is put inside it, and its pattern is fixed: a second shape is a second object rather than a variant of the first, though an object may carry project-named variant classes and `is-*`/`has-*` states.

*Example:* `o-circle` centers whatever is placed inside it. The `c-dots` placed in it supply the meaning the shell lacks.

Settled by [Objects](../segments/objects.md).

## Object or utility

**Test:** Named after a thing, or named after an effect?

This boundary already has a documented test, together with the case that looks like an exception — a utility permitted more than one property for an accessibility or layout reason. It is not repeated here. Read it where it lives: [Object or utility?](../segments/objects.md#object-or-utility) in the Objects segment.

Settled by [Objects](../segments/objects.md).

## Utility or component

**Test:** Is it single-purpose, or is it a self-contained piece of UI?

A utility is a single-purpose class used sparingly, for specific overrides and quick fixes. It is an ordinary single-class selector carrying no more specificity than a component or page class — it wins because `utils.min.css` is linked after the page stylesheet, not because it out-specifies. Never raise a utility's specificity to make it win. A component, by contrast, is reusable and self-contained.

*Example:* `u-fs-xs` sets one font size and stands alone. `c-card` is a widget with a header, a body and a footer.

Settled by [Utilities](../segments/utilities.md) and [Components](../segments/components.md).

## Page-local or common

**Test:** How many page entries need it?

Nothing moves on disk — objects stay in `objects/`, components in `components/`, modules in `modules/`. This is an import-route choice only. Used by five or more page entries, or needed by any layout, it is `@use`d from the matching `common/` aggregator and compiles once into `common.min.css`. Used by four pages or fewer, and needed by no layout, it is `@use`d by each of those page entries. It must never be both.

*Example:* a component four pages use is imported by each of those four page entries. The moment a fifth needs it, move its `@use` line into `common/_components.common.scss` and delete it from all four. Leaving one behind is a review-blocking defect.

Settled by [Common](../segments/common.md).

## Vendor fix in Generic or Common or Modules

**Test:** Is the correction reset-level or element-level, or is it component-level? If component-level, can the overridden element carry an `m-` class, or is it markup the vendor's JS generates outside the project's own markup?

Reset- and element-level corrections to a vendor framework such as Bootstrap belong to the Generic segment, written with element selectors only, never vendor classes. A component-level override — `.btn`, `.modal`, `.dropdown-menu`, `.form-control` — belongs to Modules, in its own library module `_<vendor-component>.<library>.module.scss` (R-36), written against an `m-` class placed beside the vendor class, with the vendor's inner parts nested inside it; a vendor selector nests inside an owned `m-` wrapper only when the vendor element cannot take a class or the vendor selector out-specifies the `m-` class (R-30). A bare vendor selector at the top level of a file is not permitted; the one exception, vendor-generated markup outside the project, is in [Vendor Override Scoping](../segments/modules.md#vendor-override-scoping) (R-30, R-36). This has a markup consequence: overriding a vendor widget requires an `m-` class on the vendor element, or on an owned wrapper around it when the element cannot take one or the vendor selector out-specifies the `m-` class.

A control module is isolated from the rest of the project and is never overridden from outside (R-31); it is not a vendor-override route.

*Example:* `_form-control.bootstrap.module.scss` holds `.m-form-control { … }`, for `<input class="form-control m-form-control">`.

Settled by [Modules](../segments/modules.md).

## Background in Elements or Theme

**Test:** Does the background change with the theme?

The Elements segment declares the **base** body background, including its different images for different screen sizes. A background that changes with the theme is not declared there — it goes in `custom.theme.css` in the Theme segment, which is linked after Elements and therefore overrides it. Never declare the same per-theme background in both places.

Settled by [Elements](../segments/elements.md) and [Theme](../segments/theme.md).

[↑ Back to top](#decision-guide)
