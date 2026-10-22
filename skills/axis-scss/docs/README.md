# SCSS Architecture Documentation

*Architecture owner: Khaled Mohamed (UI Developer) · Created: 2025 · Current Version: 2.0.0*

**AXIS** (Architecture for eXtensible Intelligent Styles) follows **ITCSS (Inverted Triangle CSS)**, incorporating concepts from **SMACSS** and **Atomic Design**, and **BEM** for naming, to create a scalable, maintainable and consistent SCSS structure that any project can adopt.

| # | Section                                                         | What it covers                                                   |
|---|-----------------------------------------------------------------|------------------------------------------------------------------|
| 1 | [Who is this for](#who-is-this-for)                             | Who the standard serves, and that a vendor framework is optional |
| 2 | [Prerequisites and assumptions](#prerequisites-and-assumptions) | What a project needs before adopting it                          |
| 3 | [Where the SCSS lives](#where-the-scss-lives)                   | The placeholder root, and how to read an example path            |
| 4 | [References](#references)                                       | The published methodologies it is built from                     |
| 5 | [Start Here](#start-here)                                       | Where to go for the most common first tasks                      |
| 6 | [Quick Reference](#quick-reference)                             | The owner of each piece of daily-use data                        |
| 7 | [Segment Structure in Authoring Order](#segment-structure-in-authoring-order) | The thirteen segments, their order and prefixes |
| 8 | [Documentation Map](#documentation-map)                         | Every guide and segment document                                 |

---

## Who is this for

AXIS is the SCSS architecture standard for the UI team: front-end developers and new team members. It fixes how SCSS is organized, named, built and linked, so any project can adopt it.

**A vendor CSS framework is optional.** Nothing in this architecture depends on one: [Generic](./segments/generic.md) is the reset whether a framework is present or not. Where a project does link one — Bootstrap is the example this documentation names throughout — Generic also corrects that framework's reboot, and [Modules](./segments/modules.md) carries its component-level overrides, each in its own library module, on an `m-`-prefixed class.

---

[↑ Back to top](#scss-architecture-documentation)

## Prerequisites and assumptions

| Assumption                             | Detail                                                                                                                                                                                                           |
|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Dart Sass 1.23 or later**            | The architecture depends on `@use` throughout. LibSass never implemented it and cannot compile this tree — see [Build — Compiler and version](./guides/build.md#compiler-and-version). A project's own tools may raise the floor — for example, `math.div` needs 1.33.                           |
| **Any server stack**                   | Nothing in the architecture depends on what serves the pages; only paths in markup and the build wiring do — see [Environments](./guides/environments.md).                                                       |
| **The 4 latest browser versions**      | Chrome, Edge, Firefox and Safari, on desktop and iOS — the 4 latest versions of each. No legacy support and no Autoprefixer step; vendor prefixes are hand-authored where still required — see [Build — Browser targets and vendor prefixing](./guides/build.md#browser-targets-and-vendor-prefixing). |
| **A vendor CSS framework is optional** | Nothing depends on one — see [Who is this for](#who-is-this-for).                                                                                                                                               |
| **Any SCSS location**                  | The standard fixes the structure below the root, not the root itself — see [Where the SCSS lives](#where-the-scss-lives).                                                                                        |
| **One source of truth**                | The standard lives in the AXIS repository and carries the version named at the top of this page. Read it there; do not copy it into a project — see [Onboarding](./guides/onboarding.md).                       |

---

[↑ Back to top](#scss-architecture-documentation)

## Where the SCSS lives

This standard does not dictate where a project keeps its SCSS. Throughout this documentation that location is written as `path/to/SCSS/directory`. What the standard fixes is the structure below it — the segment folders, their names and their order. Anywhere this documentation shows a value you replace, a location reads `path/to/…` and a name you substitute into a filename or identifier reads `<in-angle-brackets>`. `<path-to-root>` is the relative path from the file that contains it up to the SCSS root, such as `..` or `../../..`; it is explained in [Best Practices — Using the Tools Segment](./guides/best-practices.md#using-the-tools-segment).

Keep whatever casing your project chooses consistent everywhere: it makes no difference on Windows and breaks the build the moment the tree is compiled or served from a case-sensitive file system.

`<link>` examples write root-relative URLs, `/path/to/SCSS/directory/…`. How a project on a specific server stack writes them is in [Environments](./guides/environments.md).

---

[↑ Back to top](#scss-architecture-documentation)

## References

These are the published sources this architecture is built from. Each row says what is taken from it. How the four are blended — and where this architecture departs from them — is set out in the [Architecture Overview](./guides/architecture.md), which is the only document here that describes them.

| Source                                                                          | Full name                                 | What is taken from it                                                                                                                            |
|---------------------------------------------------------------------------------|-------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| [ITCSS](https://www.xfive.co/blog/itcss-scalable-maintainable-css-architecture) | Inverted Triangle CSS                     | Source of the specificity ordering, and of the Settings, Tools, Generic, Elements, Objects, Components and Utilities segments.                   |
| [SMACSS](https://smacss.com/)                                                   | Scalable and Modular Architecture for CSS | Source of the Layout and Theme segments, of the Modules segment (split from its Module category), and of the `is-*` / `has-*` state prefixes.    |
| [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)             | Design System Methodology                 | Source of the Pages segment and of the composition model.                                                                                        |
| [BEM](https://bem.info/en/methodology/css/)                                     | Block Element Modifier                    | Source of block and element naming; the `--modifier` syntax is deliberately not used — see [Naming Conventions](./guides/naming-conventions.md). |

---

[↑ Back to top](#scss-architecture-documentation)

## Start Here

| I want to…                                      | Go to                                                |
|-------------------------------------------------|------------------------------------------------------|
| Compile SCSS and see output                     | [Quick Start](./guides/quick-start.md)               |
| Understand why the architecture looks like this | [Architecture Overview](./guides/architecture.md)    |
| Look up one segment in detail                   | [Segment Index](./segments/README.md)                |
| Decide which segment a new file belongs in      | [Decision Guide](./guides/decision-guide.md)         |
| Follow the steps for a routine task             | [Recipes](./guides/recipes.md)                       |
| Name a class or a file correctly                | [Naming Conventions](./guides/naming-conventions.md) |
| Check what is allowed and what is banned        | [Rules](./guides/rules.md)                           |
| Join the team and get productive                | [Onboarding Guide](./guides/onboarding.md)           |

---

[↑ Back to top](#scss-architecture-documentation)

## Quick Reference

What a developer looks up most often, and the one place each is stated. Every row links to the section that owns the subject. If this page and the linked document differ, the linked document is right.

| I need                                                             | Owned by                                                                                                                   |
|--------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| The segment order, the class prefixes, and which segments ship CSS | [Segment Structure in Authoring Order](#segment-structure-in-authoring-order)                                              |
| The filename suffix for each segment                               | [Naming Conventions — Suffix per segment](./guides/naming-conventions.md#suffix-per-segment)                               |
| How to name a class                                                | [Naming Conventions — Class Naming](./guides/naming-conventions.md#class-naming)                                           |
| Whether a component is shared or page-local                        | [Common — Placement Rule](./segments/common.md#placement-rule)                                                             |
| Which files are entry files                                        | [Build — Entry files](./guides/build.md#entry-files)                                                                       |
| What each build route names its output                             | [Build — Output filenames differ between the two routes](./guides/build.md#output-filenames-differ-between-the-two-routes) |
| The order of links in `<head>`                                     | [HTML and CSS Output Reference](./guides/output.md)                                                                        |
| What is required and what is banned                                | [Rules](./guides/rules.md)                                                                                                 |
| What the breakpoints map must provide                              | [Settings — What the breakpoints map must provide](./segments/settings.md#what-the-breakpoints-map-must-provide)           |
| What the color and typography token sets must provide              | [Theme — Token sets and their values](./segments/theme.md#token-sets-and-their-values)                                     |
| The project's mixins and functions                                 | [Tools — Documenting what the project tools do](./segments/tools.md#documenting-what-the-project-tools-do)                 |

Breakpoint values, token names and values, and the set of tools belong to each project, so this documentation publishes none of them. The last three rows lead to what the standard requires of them.

---

[↑ Back to top](#scss-architecture-documentation)

## Segment Structure in Authoring Order

The table below is the **single source of truth for segment order** in this architecture. Where any other document states a different order, this table governs.

This is the order in which segments are authored. It is **not** the order the compiled stylesheets are linked in the page; that order differs deliberately, and each difference is explained in [HTML and CSS Output Reference](./guides/output.md). Two differences stand out: Packages, authored eleventh, is linked first, ahead of every project stylesheet; and Theme, authored last, is linked in two positions — its token files before Layout and `custom.theme.css` after the page stylesheet.

| Segment                                    | Purpose                        | Ships CSS | Prefix          | Description                                                                                                           |
|--------------------------------------------|--------------------------------|-----------|-----------------|-----------------------------------------------------------------------------------------------------------------------|
| **[Settings](./segments/settings.md)**     | Variables, maps, configuration | ❌         | None            | Foundation values                                                                                                     |
| **[Tools](./segments/tools.md)**           | Mixins & functions             | ❌         | None            | Reusable logic                                                                                                        |
| **[Generic](./segments/generic.md)**       | Reset/normalize styles         | ✅         | None            | Browser normalization                                                                                                 |
| **[Elements](./segments/elements.md)**     | Bare HTML element styles       | ✅         | None            | Element defaults                                                                                                      |
| **[Common](./segments/common.md)**         | Shared global styles           | ✅         | None            | App-wide shared styles; imported objects, components and modules keep their own `o-` / `c-` / `m-` / `ctrl-` prefixes |
| **[Objects](./segments/objects.md)**       | Undecorated design patterns    | ✅         | `o-*`           | Flat structural patterns with no meaning alone                                                                        |
| **[Components](./segments/components.md)** | Self-contained reusable UI     | ✅         | `c-*`           | Self-contained components                                                                                             |
| **[Layout](./segments/layout.md)**         | What surrounds page content    | ✅         | `l-*`           | One shell per layout, plus shared parts                                                                               |
| **[Modules](./segments/modules.md)**       | Complex components, overrides  | ✅         | `m-*`, `ctrl-*` | Composite components                                                                                                  |
| **[Pages](./segments/pages.md)**           | Page-specific styles           | ✅         | `p-*`           | Minimal page overrides                                                                                                |
| **[Packages](./segments/packages.md)**     | External library styles        | ✅         | None            | Bootstrap, Swiper, etc.                                                                                               |
| **[Utilities](./segments/utilities.md)**   | Single-purpose helpers         | ✅         | `u-*`           | Linked last of the compiled stylesheets, so they override at equal specificity                                        |
| **[Theme](./segments/theme.md)**           | Colors, fonts, custom          | ✅         | None            | Theming system                                                                                                        |

**Ships CSS** means the segment puts rules on the page — not that it compiles. Nine of the eleven marked ✅ compile from SCSS; **Packages** is prebuilt vendor CSS linked as published, and **Theme** is hand-authored plain CSS that ships as written. Neither has an entry in the build; the complete entry-file list is in [Build — Entry files](./guides/build.md#entry-files).

Each segment is summarized in the [Segment Index](./segments/README.md) and documented in full in its own file.

> **A note on words.** This architecture calls its own unit a **segment**. ITCSS, SMACSS and Atomic Design call theirs a **layer**, a **category** and a **stage** — that word is kept only in the [Architecture Overview](./guides/architecture.md), where those methodologies are described as their authors published them.

> **A note on names.** This standard fixes four things — the thirteen segments and the order they are authored in, the file-name suffix each segment uses, the class prefixes each segment carries where it has any, and the shape a token name takes (see [Theme](./segments/theme.md#token-sets-and-their-values)) — plus the fixed names listed below. Everything else named in these documents — the files inside a segment, the color and typography token names, the breakpoint keys, the page and component names — belongs to the project that owns it. Those names appear here only as examples, because a shape is easier to read with something in it. Copy the shape; name the contents yourself.

### Fixed names

These files, folders and prefixes keep the name given here, because a rule or a document depends on it.

| File, folder or prefix                                                                           | Rule or document that depends on it                                                             |
|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| `common/common.scss`                                                                             | The Common entry file — [Build — Entry files](./guides/build.md#entry-files)                  |
| `common/_objects.common.scss`, `_components.common.scss`, `_modules.common.scss`                 | The aggregators `common.scss` uses — [Common](./segments/common.md)                           |
| `common/_classes.common.scss`                                                                    | Overrides of global classes the project does not own — [Common](./segments/common.md)         |
| `common/_attributes.common.scss`                                                                 | Attribute-selector rules — [Common](./segments/common.md)                                     |
| `utilities/utils.scss`                                                                           | The Utilities entry file — [Build — Entry files](./guides/build.md#entry-files)               |
| `accessibility/`, `interaction/`, `layout/`, `typography/`, `visual/` (under `utilities/`)       | The five utility categories — [Utilities](./segments/utilities.md)                            |
| `theme/colors/colors.base.theme.css`, `theme/colors/colors.palette.theme.css`                    | The link list — [HTML and CSS Output Reference](./guides/output.md)                           |
| `theme/fonts/fonts.theme.css`, `theme/custom.theme.css`                                          | The link list — [HTML and CSS Output Reference](./guides/output.md)                           |
| `layout/shared/`                                                                                 | The parts shared by every layout — [Layout](./segments/layout.md)                             |
| `pages/standalone/`, `pages/state/`                                                              | Reserved page folders — [Pages](./segments/pages.md)                                          |
| `settings/_breakpoints.settings.scss`, `settings/_colors.settings.scss`                          | What the breakpoints map and the color maps must provide — [Settings](./segments/settings.md)   |
| The `is-`, `has-` and `js-` prefixes                                                             | State and script-hook classes — [Naming Conventions](./guides/naming-conventions.md)          |

---

[↑ Back to top](#scss-architecture-documentation)

## Documentation Map

### Guides

| Guide                                                                              | What it covers                                                                  |
|------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| [Quick Start](./guides/quick-start.md)                                             | compiling SCSS with the `sass` CLI, or in Visual Studio with Web Compiler 2022+ |
| [Architecture Overview](./guides/architecture.md)                                  | the four methodologies and how they are blended                                 |
| [Decision Guide](./guides/decision-guide.md)                                       | which segment a new file belongs in, pair by pair                               |
| [Naming Conventions](./guides/naming-conventions.md)                               | file names, class prefixes, BEM + SMACSS policy                                 |
| [Best Practices](./guides/best-practices.md)                                       | import order, custom properties, responsive design                              |
| [Rules](./guides/rules.md)                                                         | what is required and what is banned                                             |
| [Review Checklist](./guides/review-checklist.md)                                   | what the author and the reviewer check before a merge                           |
| [Accessibility](./guides/accessibility.md)                                         | what the stylesheets must do for accessibility                                  |
| [Onboarding Guide](./guides/onboarding.md)                                         | the path for a new team member                                                  |
| [Migrating an Existing Project](./guides/migration.md)                             | a proposed path for a project that already has CSS                              |
| [Worked Example](./guides/walkthrough.md)                                          | a login page from markup to compiled output                                     |
| [Recipes](./guides/recipes.md)                                                     | the short steps for routine tasks                                               |
| [Build Documentation](./guides/build.md)                                           | both build routes in full                                                       |
| [Environments](./guides/environments.md)                                           | how paths are written on a specific server stack                                |
| [HTML and CSS Output Reference](./guides/output.md)                                | the canonical `<head>` link order and why                                       |
| [Performance — Bundle Size Budget](./guides/performance.md)                        | what each stylesheet may weigh                                                  |
| [Glossary](./guides/glossary.md)                                                   | the words this documentation uses in a local sense                              |

### Segment References

[Segment Index](./segments/README.md) — all thirteen at a glance.

| #  | Segment                                |
|----|----------------------------------------|
| 1  | [Settings](./segments/settings.md)     |
| 2  | [Tools](./segments/tools.md)           |
| 3  | [Generic](./segments/generic.md)       |
| 4  | [Elements](./segments/elements.md)     |
| 5  | [Common](./segments/common.md)         |
| 6  | [Objects](./segments/objects.md)       |
| 7  | [Components](./segments/components.md) |
| 8  | [Layout](./segments/layout.md)         |
| 9  | [Modules](./segments/modules.md)       |
| 10 | [Pages](./segments/pages.md)           |
| 11 | [Packages](./segments/packages.md)     |
| 12 | [Utilities](./segments/utilities.md)   |
| 13 | [Theme](./segments/theme.md)           |

### The Methodologies

This documentation does not restate ITCSS, SMACSS, Atomic Design or BEM. Their published sources are linked under [References](#references) above, and what this architecture takes from each is explained in the [Architecture Overview](./guides/architecture.md).

---

[↑ Back to top](#scss-architecture-documentation)
