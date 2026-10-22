# Naming Conventions

[← Back to README](../README.md)

This page defines how files and classes are named in this architecture: kebab-case file names with a segment suffix, a prefix for each segment's classes, BEM for structure, and SMACSS-style prefixes for state.

| # | Section                                                                                                   | What it covers                                             |
|---|-----------------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| 1 | [File Naming](#file-naming)                                                                               | Kebab-case file names and the suffix per segment           |
| 2 | [Class Naming](#class-naming)                                                                             | The prefix each segment's classes carry                    |
| 3 | [BEM Methodology](#bem-methodology)                                                                       | Block and element syntax for components and modules        |
| 4 | [Naming Policy BEM for Structure and SMACSS for State](#naming-policy-bem-for-structure-and-smacss-for-state) | Why BEM and SMACSS are combined, and how state is prefixed |

---

## File Naming
- Use kebab-case for file names
- Include segment suffix: `_name.segment.scss`
- **Examples**:
  - `_button.component.scss`
  - `_reset.generic.scss`
  - `profile.page.scss`
  - `_colors.settings.scss`

### Suffix per segment

| Segment                   | File suffix                                    | Example                         | Entry file?                                         |
|---------------------------|------------------------------------------------|---------------------------------|-----------------------------------------------------|
| Settings                  | `.settings.scss`                               | `_breakpoints.settings.scss`    | No — partials only                                  |
| Tools — functions         | `.function.scss`                               | `_cut-unit.function.scss`       | No — each folder has an `_index.scss`               |
| Tools — mixins            | `.mixin.scss`                                  | `_circle.mixin.scss`            | No — each folder has an `_index.scss`               |
| Generic                   | `.generic.scss`                                | `_reset.generic.scss`           | No — the folder entry is `_index.scss`              |
| Elements                  | none — the segment is one file                 | `_index.scss`                   | No                                                  |
| Common                    | `.common.scss`                                 | `_components.common.scss`       | **Yes** — `common/common.scss`                      |
| Objects                   | `.object.scss`                                 | `_circle.object.scss`           | No                                                  |
| Components                | `.component.scss`                              | `_button.component.scss`        | No                                                  |
| Layout                    | `.layout.scss`, preceded by the layout's scope | `_header.app.layout.scss`       | **Yes** — one per layout, `app.layout.scss`         |
| Modules                   | `.module.scss`                                 | `_search-bar.module.scss`       | No                                                  |
| Modules — library modules | `.<library>.module.scss`, preceded by the vendor component | `_modal.bootstrap.module.scss`  | No                                                  |
| Modules — control modules | `.control.module.scss`                         | `_dropdown.control.module.scss` | No                                                  |
| Pages                     | `.page.scss`                                   | `home.page.scss`                | **Yes** — one per page                              |
| Packages                  | `<library><major>.<locale>.min.css`, content unchanged | `bootstrap5.<locale>.min.css`   | Not compiled — linked directly                      |
| Utilities                 | `.utility.scss`                                | `_font-size.utility.scss`       | **Yes** — `utils.scss`                              |
| Theme                     | `.theme.css` — plain CSS, never SCSS           | `colors.palette.theme.css`      | Not compiled — hand-authored and linked as authored |

Entry files carry no leading underscore and are the only files configured in the build; the complete list is in [Build — Entry files](./build.md#entry-files). Everything else is a partial, prefixed with `_` and reached through `@use`. Control modules and library modules are the two cases of a double suffix — the file is still a module; `.control.` marks a control module, whose block carries `ctrl-`, and `.<library>.` (for example `.bootstrap.`) marks a library module, which overrides one component of that library and whose block keeps `m-`. A Layout partial additionally carries the layout that owns it, dot-joined ahead of the suffix — `_header.app.layout.scss`, `_footer.intro.layout.scss`. That is a scope, not a second suffix: `.control.` says what kind of file it is, `.app.` says which layout owns it. Files in `layout/shared/` belong to no single layout and carry no scope.

## Class Naming
| Category        | Prefix        | Examples                                          |
|-----------------|---------------|---------------------------------------------------|
| Components      | `c-`          | `.c-button`, `.c-card`                            |
| Objects         | `o-`          | `.o-circle`                                       |
| Utilities       | `u-`          | `.u-text-neutral-200`, `.u-container`             |
| Modules         | `m-`          | `.m-search-bar`, `.m-modal`                       |
| Control modules | `ctrl-`       | `.ctrl-datepicker`, `.ctrl-dropdown`              |
| Layout          | `l-`          | `.l-app`, `.l-app__header`, `.l-footer`           |
| Page            | `p-`          | `.p-profile`, `.p-error-404`                      |
| JS state or hook | `js-`         | `.js-active`, `.js-disabled`, `.js-modal-trigger` |
| First-load state | `is-`, `has-` | `.is-current`, `.has-icon`                        |

The prefix column is what the standard fixes. The class names beside it are examples — a project names its own components, objects, modules, pages and utilities.

## BEM Methodology
Use BEM (Block, Element) for object, component, module, layout and page naming:

```scss
@charset "UTF-8";

.c-button {                    // Block
  &__icon {                    // Element
    // styles
  }
  
  &.is-current {               // First-load state (SMACSS)
    // styles
  }
  
  &.js-disabled {              // JS-changed state
    // styles
  }
}
```

## Naming Policy BEM for Structure and SMACSS for State

This architecture deliberately combines two methodologies rather than using BEM on its own:

- **BEM** is used for naming objects, components, modules, control modules, layouts and pages — **blocks and elements only** (`c-block`, `c-block__element`), with one element level only: `block__element`, never `block__element__child`.
- The BEM `--modifier` syntax is **not used** anywhere in this architecture, in this documentation, or in any project built on it.
- **SMACSS** supplies the `is-*` and `has-*` state prefixes, chained onto a block or element (`&.is-*`, `&.has-*`). They mark a state the markup is built with — the current navigation item is `is-current`, a button carrying an icon is `has-icon` — and nothing changes them after the page loads. Variant classes are not state: a project names its own, and this documentation marks any it shows as project-specific.
- **`js-*`** marks anything JavaScript changes. If a script adds, removes or toggles a class at runtime, that class carries the `js-*` prefix — `js-disabled`, `js-active`, `js-loading`. The prefix also covers a class a script only queries and never changes, such as `js-modal-trigger`. Either way, `js-*` is the signal that the class belongs to JavaScript.
- **The deciding test is who sets the class**, and the full sorting of every state class in this standard is in [Rules](./rules.md).

This is an intentional BEM + SMACSS hybrid, not a partial or incomplete implementation of BEM: BEM names blocks and elements, SMACSS names state.

[↑ Back to top](#naming-conventions)
