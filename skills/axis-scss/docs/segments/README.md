# Segment Index

[← Back to README](../README.md)

This is the index of the thirteen segments, in authoring order; each row links to the segment's full document. Order, prefixes, purpose and which segments ship CSS are governed by the table in [README.md](../README.md).

| #  | Section                       | What it covers                                        |
|----|-------------------------------|-------------------------------------------------------|
| —  | [The tree](#the-tree)         | The canonical folder layout of the whole architecture |
| 1  | [Settings](./settings.md)     | Variables, maps and lists; no CSS output              |
| 2  | [Tools](./tools.md)           | Mixins and functions; no CSS output                   |
| 3  | [Generic](./generic.md)       | Reset and base styles                                 |
| 4  | [Elements](./elements.md)     | Bare HTML elements                                    |
| 5  | [Common](./common.md)         | Styles and import routes shared application-wide      |
| 6  | [Objects](./objects.md)       | Undecorated design patterns                           |
| 7  | [Components](./components.md) | Self-contained reusable components                    |
| 8  | [Layout](./layout.md)         | What surrounds a page's content                       |
| 9  | [Modules](./modules.md)       | Composite components and library modules              |
| 10 | [Pages](./pages.md)           | Styles unique to one page                             |
| 11 | [Packages](./packages.md)     | Third-party CSS, never compiled                       |
| 12 | [Utilities](./utilities.md)   | Single-purpose helper classes                         |
| 13 | [Theme](./theme.md)           | Color and font tokens                                 |

---

## The tree

```
path/to/SCSS/directory/
├── settings/       _*.settings.scss                         (no CSS output)
├── tools/          functions/, mixins/, _index.scss         (no CSS output)
├── generic/        _index.scss, _reset.generic.scss
├── elements/       _index.scss
├── common/         _*.common.scss aggregators, common.scss  ← entry
├── objects/        _*.object.scss
├── components/     _*.component.scss
├── layout/         <layout-name>/, shared/               ← entry per layout
├── modules/        _*.module.scss, _*.<library>.module.scss, _*.control.module.scss
├── pages/          standalone/, state/, <main-program>/     ← entry per page
├── packages/       <library><version>/ prebuilt vendor CSS  (never compiled)
├── utilities/      category folders, utils.scss             ← entry
└── theme/          custom.theme.css, colors/, fonts/        (plain CSS, never compiled)
```

`←` marks a file the build compiles; everything else is a partial, reached through `@use`. The complete entry list is in [Build — Entry files](../guides/build.md#entry-files). Each folder is one level deep here on purpose, and the sub-folder rules are in [Best Practices](../guides/best-practices.md#folder-index-files).

[↑ Back to top](#segment-index)
