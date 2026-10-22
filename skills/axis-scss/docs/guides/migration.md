# Migrating an Existing Project

[← Back to README](../README.md)

This guide is for a project that already has CSS, already ships, and cannot stop while it reorganizes. A new project needs none of it: it starts on the segment layout from the first file — see [Quick Start](./quick-start.md).

**This path is proposed; no project has completed it yet.** Nothing here is mandated: a project adopts the architecture, or part of it, when its team decides to.

| # | Section                                                                     | What it covers                           |
|---|-----------------------------------------------------------------------------|------------------------------------------|
| 1 | [The legacy stylesheet](#the-legacy-stylesheet)                             | What stays linked, frozen, and shrinking |
| 2 | [The order](#the-order)                                                     | The five steps, in sequence              |
| 3 | [How to tell it is done](#how-to-tell-it-is-done)                           | The finish-line checklist                |
| 4 | [What a stalled migration looks like](#what-a-stalled-migration-looks-like) | The state worse than either end          |

---

## The legacy stylesheet

Whatever CSS the project ships today is called the legacy stylesheet here — one file or several.

- **It stays linked while the migration runs,** directly after the vendor CSS and before `common`. It is linked early for the same reason vendor CSS is: at equal specificity the later stylesheet wins, so every AXIS rule can override a legacy rule without `!important` — as long as its specificity is not lower than the legacy rule's; a legacy selector of higher specificity still wins. Its slot is shown in the canonical list in [HTML and CSS Output Reference](./output.md#the-link-list).
- **It is frozen.** No new rule is added to it from the day the migration starts. A change that would have gone into it is written in the segment it belongs to instead. An override of a global, non-vendor class the project does not own goes in `common/_classes.common.scss` — the bridge between the legacy stylesheet and the new architecture for the rest of the migration; a vendor override goes in Modules, in its library module (R-30, R-36), except for an element the vendor's JS generates outside the project's markup, which goes in `common/_classes.common.scss` instead; see [Common](../segments/common.md#file-structure).
- **It shrinks.** When a page moves, the legacy rules only that page used are deleted from it. A rule still used by a page that has not moved stays until that page moves.

[↑ Back to top](#migrating-an-existing-project)

## The order

1. **Foundation — Settings, Tools and Theme.** Settings and Tools emit no CSS, and the three token files (`colors.base.theme.css`, `colors.palette.theme.css`, `fonts.theme.css`) declare custom properties only, so nothing on screen changes. Link the three token files in their documented positions; `custom.theme.css` waits for step 3, because it holds real rules.
2. **Common, without Generic and Elements.** Create `common/common.scss` and add it to the build — see [Build — Entry files](./build.md#entry-files). Leave out its two `@use` lines for Generic and Elements for now; see step 5.
3. **Layout.** Each layout's shell — header, navbar, side menu, footer — moves as one step, because every page using that layout shows it. Add its entry to the build, give its markup the `l-` classes, and delete the legacy rules it replaces. Link `custom.theme.css` in its documented position now; its backgrounds and brand-asset positioning target the layout's `l-` classes and `body`.
4. **Pages, one at a time.** A page moves as a unit: its components, modules and page entry, each placed by the [Placement Rule](../segments/common.md#placement-rule), counting only the pages that have already moved. Its markup takes the prefixed classes, and its legacy rules are deleted. A module that already holds vendor selectors is renamed to its library module form, `_<vendor-component>.<library>.module.scss`, and its rules move onto an `m-` class placed beside the vendor class (R-30, R-36). Every new page starts here directly. Utilities are written as the pages that need them move; `utilities/utils.scss` joins the build with the first one.
5. **Generic and Elements, last.** Their reset and element rules apply to every page, so they wait until no page depends on the legacy stylesheet. Adding them changes every page at once, so plan a full visual pass over the whole application before it ships. Then add their two `@use` lines to `common/common.scss`, as [Common](../segments/common.md) specifies.

Steps 3 and 4 may interleave; step 5 does not start before both are finished.

[↑ Back to top](#migrating-an-existing-project)

## How to tell it is done

- The legacy stylesheet is empty, unlinked and deleted.
- `common/common.scss` imports Generic and Elements, in the documented order.
- Every class the project authors carries a segment prefix — see [Rules](./rules.md).
- Every page passes the [Review Checklist](./review-checklist.md).

[↑ Back to top](#migrating-an-existing-project)

## What a stalled migration looks like

- The legacy stylesheet is still linked on every page, and rules are still being added to it.
- The segment folders exist, but pages still depend on legacy rules to look right.
- Prefixed class names sit on markup the legacy stylesheet also styles, so two files decide one element.

That state is worse than either end. It looks compliant, so nobody treats it as unfinished, and every change now has two places it might belong. A project that stops partway should stop between steps: the legacy stylesheet frozen, and the pages that moved fully moved.

[↑ Back to top](#migrating-an-existing-project)
