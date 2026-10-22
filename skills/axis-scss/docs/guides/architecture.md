# Architecture Overview

[← Back to README](../README.md)

This architecture is built from four published methodologies. This page explains what each one contributes and how they are blended, and it is the **only** document here that describes them — everything else in this documentation describes this architecture. The methodologies are not restated in full anywhere in these files: read them at their own published sources, linked in the table below and under [References](../README.md#references). The authoritative **segment order** lives in the table in [README.md](../README.md) — this page does not restate it.

> **A note on words.** The methodologies below name their own units in their own words — ITCSS **layers**, SMACSS **categories**, Atomic Design **stages** — and those words are used faithfully when describing them. This architecture calls its own units **segments**, and every other document in this set uses that word.

| # | Section                                                     | What it covers                                               |
|---|-------------------------------------------------------------|--------------------------------------------------------------|
| 1 | [All Methodologies overview](#all-methodologies-overview)   | Each methodology, its layers or mapping, pros and cons       |
| 2 | [Methodologies Integration](#methodologies-integration)     | How the methodologies are blended here                       |
| 3 | [Component or Module or Layout](#component-or-module-or-layout) | Why the question arises; the answer is in the Decision Guide |

---

## All Methodologies overview

| Methodology                                                                                    | Layers/Mapping                                                                                                                                                                                       | Pros                                                                                                                                                                     | Cons                                                                                                                                                     |
|------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **[ITCSS](https://www.xfive.co/blog/itcss-scalable-maintainable-css-architecture)**            | **Layers**: Settings → Tools → Generic → Elements → Objects → Components → Utilities — ITCSS as published. This project's own segment order is the table in [README.md](../README.md), not this row. | Predictable cascade and specificity; scales to large codebases; reduces selector conflicts; clear layering and import order; works well with tooling and partial builds. | Requires discipline and onboarding; upfront structure overhead; strict import order can feel rigid in very small projects.                               |
| **[SMACSS](https://smacss.com/)**   | **Mapping**: Base = Generic + Elements; Layout = Layout; Module = Components + Modules; State = `.is-*`, `.has-*`; Theme = Theme                                                                     | Flexible categories (Base/Layout/Module/State/Theme); easy to adopt incrementally; pairs nicely with BEM; clear separation of layout vs module vs state.                 | Looser rules can drift without team conventions; categories can be interpreted inconsistently; limited guidance on specificity compared to ITCSS.        |
| **[Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)** | **Mapping**: Atoms = Elements + Utilities; Molecules = Components; Organisms = Modules; Templates = Layout; Pages = Pages                                                                            | Strong reusability and composition; shared vocabulary (atoms → pages); ideal for design systems and component libraries; aligns with component-based frameworks.         | Risk of over-abstraction; mapping real UI to levels can be subjective; can duplicate layout concerns if misapplied; needs discipline to keep pages thin. |

> This architecture blends them: ITCSS for layering and specificity, SMACSS for state and theme semantics, Atomic Design for component composition, and BEM for block/element naming.

## Methodologies Integration

- This architecture is organized from the most generic to the most specific.

- It takes from the layers, categories and stages of the published methodologies only what it needs, and each unit it keeps becomes a segment here.

- From `ITCSS` it takes these layers: `settings`, `tools`, `generic`, `elements`, `objects`, `components`, `utilities`. The `objects` segment holds undecorated design patterns — flat structural patterns such as a circle that centers whatever is placed inside it. An object carries no meaning on its own, which is exactly what separates it from a component, so the two are kept apart rather than merged. See [Objects Documentation](../segments/objects.md).

- From SMACSS it takes Layout, Theme and the State prefixes. The `Base` category is already covered by `ITCSS`, so it is omitted. The `Module` category is split into two segments, Components and Modules, for `separation of concerns` and a cleaner architecture for `DX (Developer Experience)`.

- From `Atomic Design` it takes only `Pages`, so that each page is worked on individually and its styles do not conflict with other pages. Its composition flow still describes how a page is assembled here: build atoms, combine them into molecules, assemble those into organisms, place them inside a template, and produce a page — which in this architecture reads as elements and utilities, then components, then modules, then a layout, then a page.

- **BEM** supplies block/element naming — see [Naming Conventions](./naming-conventions.md).

- It also adds two segments of its own: `common`, `packages`.

The first, `common`, generates all common styles in the application, and this file compiles to one stylesheet. Its aggregators gather the objects, components and modules that five or more page entries use, or any layout needs, so each compiles once instead of once per page — the file list and the placement rule are in [Common Segment](../segments/common.md). The second segment, `packages`, wraps all external libraries or packages, such as Bootstrap, in one segment for `separation of concerns`.

The `State` category from `SMACSS` is what lets one component serve many situations. A state fixed when the page is built takes `is-*` or `has-*` — `is-current` on the current navigation item, `has-icon` on a button that carries an icon — and no script changes it afterwards. A state a script changes at runtime takes `js-*` instead — see [Rules](./rules.md). Variant classes, such as a primary button, are not state; how a project names them is its own.

## Component or Module or Layout

Splitting SMACSS's single `Module` category into two segments is what makes this question come up, and that reasoning belongs here.

The answer does not. Which segment a given file belongs in — component against module, module against layout, and seven other pairs — is settled once, in the [Decision Guide](./decision-guide.md). The resulting `<head>` link order is in [HTML and CSS Output Reference](./output.md).

[↑ Back to top](#architecture-overview)
