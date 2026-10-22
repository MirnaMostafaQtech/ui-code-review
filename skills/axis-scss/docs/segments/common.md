# Common Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Common** segment holds application-wide shared styles that compile into a single stylesheet, loaded on every page.

| # | Section                                                | What it covers                                   |
|---|--------------------------------------------------------|--------------------------------------------------|
| 1 | [Purpose](#purpose)                                    | What the segment is for                          |
| 2 | [File Structure](#file-structure)                      | The folder tree and what each file holds         |
| 3 | [Naming Conventions](#naming-conventions)              | The prefixes files here keep or add              |
| 4 | [What the Common Entry Imports](#what-the-common-entry-imports) | The `@use` order and why                |
| 5 | [Placement Rule](#placement-rule)                      | Common vs. page-local: the import-route decision |
| 6 | [Rules](#rules)                                        | What a review rejects                            |
| 7 | [Related Files](#related-files)                        | The segments this one works with                 |

---

## Purpose

The Common segment provides:

| Aspect                                 | Description                                                                                                                                                                                                                                            |
|----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Application-Wide Reach                 | Styles loaded on every page, once                                                                                                                                                                                                                      |
| Shared Aggregation                     | A single place that gathers the objects, components and modules used across the application                                                                                                                                                            |
| Single Compilation                     | Shared styles compile once into one stylesheet, cached across the whole application                                                                                                                                                                    |
| Attribute & Class Overrides (optional) | attribute selectors for third-party elements that cannot take a project class name (R-26), and overrides of global classes the project does not own, plus the one vendor exception — an element the vendor's JS generates outside the project's markup |

[↑ Back to top](#common-segment-documentation)

## File Structure

```
common/
├── _attributes.common.scss  // optional
├── _classes.common.scss  // optional
├── _objects.common.scss
├── _components.common.scss
├── _modules.common.scss
└── common.scss
```

| File                      | Role                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `_attributes.common.scss` | Optional; HTML attribute selectors, permitted only for third-party elements that cannot take a project class name (R-26)                                                                                                                                                                                                                                                                                                                 |
| `_classes.common.scss`    | Optional; overrides of global, non-vendor classes the project does not own, and the bridge between legacy code and the new architecture during a migration. A vendor override belongs in Modules, not here — see [Vendor Override Scoping](./modules.md#vendor-override-scoping) (R-30, R-36) |
| `_objects.common.scss`    | `@use` aggregator for shared objects                                                                                                                                                                                                                                                                                                                                                                                                     |
| `_components.common.scss` | `@use` aggregator for shared components                                                                                                                                                                                                                                                                                                                                                                                                  |
| `_modules.common.scss`    | `@use` aggregator for shared modules                                                                                                                                                                                                                                                                                                                                                                                                     |
| `common.scss`             | Main entry file; produces `common.min.css`. It is the only route Generic and Elements have into the build — see the import order below                                                                                                                                                                                                                                                                                                   |

Both `_attributes.common.scss` and `_classes.common.scss` are optional: a project adds one only when it has something to put in it.

[↑ Back to top](#common-segment-documentation)

## Naming Conventions

The Common segment itself adds **no prefix of its own**. Where a project has one, `_attributes.common.scss` holds attribute selectors, which carry no segment prefix. The classes overridden in `_classes.common.scss` are vendor or global names the project does not own, and they keep those names unchanged — the R-01 exemption for a class the project does not author.

Objects, components and modules imported through `_objects.common.scss`, `_components.common.scss` and `_modules.common.scss` **keep their own `o-`, `c-`, `m-` and `ctrl-` prefixes unchanged**. Being shared through a `common/` aggregator is an import-route decision only — it does not rename anything, and it does not strip or replace the `o-`/`c-`/`m-`/`ctrl-` prefix the file already carries.

[↑ Back to top](#common-segment-documentation)

## What the Common Entry Imports

`common.scss` is the only route the Generic and Elements segments have into a compiled stylesheet. Neither one is imported by a page entry or by a layout entry: that would emit the reset and the element rules a second time inside that bundle, which the No Double Import rule below forbids for every other file reached through this segment.

The order follows the segment order this architecture authors in, so the broadest rules are emitted first and the classes built on them come after:

```scss
@charset "UTF-8";

@use "../generic" as *;
@use "../elements" as *;
@use "./attributes.common" as *; // optional
@use "./classes.common" as *; // optional
@use "./objects.common" as *;
@use "./components.common" as *;
@use "./modules.common" as *;
```

Generic and Elements are `@use`d directly rather than through a `common/` aggregator of their own: an aggregator gathers many files of one kind, and each of these segments is reached through its folder index already. `../generic` and `../elements` resolve to those segments' `_index.scss` files, one level up from `common/`.

`_attributes.common.scss` and `_classes.common.scss` are emitted before the three aggregators, so an object, component or module rule wins over a global class rule at equal specificity.

Which objects, components and modules a project shares is its own — the three aggregators are what the standard fixes, not their contents.

[↑ Back to top](#common-segment-documentation)

## Placement Rule

An object, component or module never physically moves. Every object always lives in `objects/` with the `.object.scss` extension, every component always lives in `components/` with the `.component.scss` extension, and every module always lives in `modules/`. "Common vs. its own segment" is not a storage choice — it is an **import-route** choice:

- **Used by five or more page entries, or needed by any layout** → `@use` it from `common/_objects.common.scss`, `common/_components.common.scss` or `common/_modules.common.scss`. It then compiles once, into `common.min.css`.
- **Used by one to four page entries, and needed by no layout** → `@use` it from each of those page entries. It compiles into each of those pages' `*.page.min.css`.
- A file imported through a `common/` aggregator **must not also be `@use`d by a page entry** — that ships it twice on the same page.
- **A layout entry never `@use`s an object, component or module itself.** Anything a layout needs is `@use`d from the matching `common/` aggregator, and reaches the layout's pages through `common.min.css` (R-28, R-29).
- **Only a module may `@use` a component.** That component then counts as used by every page that uses the module. Objects and components never `@use` another object, component or module (R-28).
- **Promotion path**: the moment a fifth page needs a page-local object, component or module, move its `@use` line out of all four page entries and into the matching `common/` aggregator, then delete it from every page entry. Leaving one `@use` line behind in a page entry after promoting is a review-blocking defect, because it ships the file twice on that page.

The `.min.css` names above are the Web Compiler route's; the Node route compiles the same entries to `common.css` and `*.page.css`. Output naming is specified in [Build Documentation](../guides/build.md).

[↑ Back to top](#common-segment-documentation)

## Rules

| # | ID        | Rule                     | Description                                                                                                                                      | Priority |
|---|-----------|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-COM-1   | **No Prefix Of Its Own** | `_attributes.common.scss` and `_classes.common.scss` are optional, and carry no segment prefix of their own when present; the vendor or global classes overridden in `_classes.common.scss` keep their own names — the R-01 exemption | Critical |
| 2 | R-COM-2   | **Prefixes Unchanged**   | An object, component or module imported through a `common/` aggregator keeps its own `o-`/`c-`/`m-`/`ctrl-` prefix                               | Critical |
| 3 | R-COM-3   | **Never Moves**          | Objects stay in `objects/`, components stay in `components/`, modules stay in `modules/`, regardless of import route                             | Critical |
| 4 | R-COM-4   | **Shared Threshold**     | Used by five or more page entries, or needed by any layout, is imported via the matching `common/` aggregator (R-28)                            | Critical |
| 5 | R-COM-5   | **Page-Local Threshold** | Used by one to four page entries, and needed by no layout, is imported by each of those page entries (R-28)                                     | Critical |
| 6 | R-COM-6   | **No Double Import**     | A file imported through a `common/` aggregator must not also be `@use`d by a page entry or a layout entry (R-29)                                 | Critical |
| 7 | R-COM-7   | **Mandatory Promotion**  | The moment a fifth page needs a page-local file, move its `@use` line into the matching `common/` aggregator and remove it from every page entry | Critical |

[↑ Back to top](#common-segment-documentation)

## Related Files

| Segment                                   | Usage                                                                                     |
|-------------------------------------------|-------------------------------------------------------------------------------------------|
| **[Objects Segment](./objects.md)**       | Supplies the undecorated design patterns that `_objects.common.scss` may import           |
| **[Components Segment](./components.md)** | Supplies the self-contained components that `_components.common.scss` may import          |
| **[Modules Segment](./modules.md)**       | Supplies the modules that `_modules.common.scss` may import                               |
| **[Pages Segment](./pages.md)**           | Imports whatever is page-local; anything promoted here is removed from the page entry     |
| **[Layout Segment](./layout.md)**         | Any object, component or module imported by a layout is always shared, never page-local   |

[↑ Back to top](#common-segment-documentation)
