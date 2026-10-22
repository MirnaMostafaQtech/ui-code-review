# Angular discovery

**Audience: the MAIN agent.** Load this only when the Repository Profile's UI Stack is `Angular`, or
`Hybrid` (then scope every search below to the Angular surface root). Never read it for an MVC target.

**Workspace root.** Angular may live in a subfolder of a .NET solution (`ClientApp/`, `src/<App>.Web/ClientApp/`,
`frontend/`). Resolve it from the `angular.json` location and run every search and command relative to
it. Record it as `Workspace root` in the profile. A sibling .NET API project is **not** part of the
Angular surface — do not profile it.

---

## Minimal discovery (profile only — used by `../../common/project-context.md`)

Read `package.json`, `angular.json`, one representative template, and the i18n folder. Nothing else.
Answer only these, and stop:

1. **Angular version + authoring** — standalone vs NgModule; `@if` vs `*ngIf` (or mixed); signals in use?
2. **Localization** — library, locale files, registered namespaces (**note any folder the loader does
   NOT register — keys added there are dead**), key shape, and the exact **attribute** idiom, e.g.
   `[attr.aria-label]="'KEY' | translate"`. This is the field most fixes depend on.
3. **UI libraries + icon idiom** — and whether each library manages focus itself.
4. **Forms** — reactive vs template-driven; the shared error/validation component (usually the
   highest-leverage single fix in the repo); custom `ControlValueAccessor` controls.
5. **`@angular/cdk` present or absent** — decisive for all focus work.
6. **Commands** — type-check, lint (and whether a *targeted* per-file lint invocation exists), test,
   build. Note any that are **broken at HEAD**, with the reason.
7. **Direction** — `<html lang dir>` and whether direction switches at runtime.
8. **Never-touch paths.**

---

## Planning discovery (used by `accessibility-plan` Step 1)

Run this once per project. Prefer targeted greps/globs over opening every file; open a file only when a
grep can't answer the question. Never assume the structure of a previous project — every finding below
must come from this repo.

**Read directly:** `package.json`, `angular.json` (or `project.json` for Nx), the root routing module(s),
`tsconfig*.json`, one representative feature module/component, and the i18n/locale folder if present.

**Answer via targeted search, not full reads:**

1. **Angular version + architecture** — version from `package.json`; standalone vs NgModule; Nx/monorepo
   vs single app; `@if`/`*ngIf` (or mixed); signals in use; zoneless or not.
2. **Routing & guards** — enumerate route files (`*-routing.module.ts`, `app.routes.ts`, or equivalent).
   List top-level feature routes, lazy-loaded chunks, and guard types (auth, role/permission, resolver).
   Note which routes are permission-gated and what role(s) gate them.
3. **Features/pages** — derive the feature list from the route tree and the top-level `src/app/**`
   (or `apps/**`) folder structure, not from opening every component. Group near-duplicate CRUD-style
   features (e.g. multiple "list + detail + form" modules) into one batch candidate when their templates
   are structurally similar — verify the similarity with one representative file, not all of them.
4. **Layouts & navigation** — identify the shell/layout component(s), header/sidebar/footer, breadcrumb,
   and any nav/menu components. These are typically imported almost everywhere.
5. **Shared components & fan-out** — glob the shared/common/UI component folder(s) (name varies by
   project: `shared/`, `common/`, `ui/`, `components/`, a UI library path, etc.). For each shared
   component, get its consumer **count** with one `grep -rl "<selector>"` (or import path) — do **not**
   open every consumer. Rank by fan-out; the highest-fan-out controls (buttons, inputs, tables, pagers,
   cards, error/validation display) are the highest-leverage batch.
6. **Custom form controls / CVAs** — grep for `implements ControlValueAccessor` and `NG_VALUE_ACCESSOR`.
   List each with its consumer count.
7. **Shared directives** — grep for `@Directive` outside feature folders. List each with a rough usage
   count (`grep -rl` on its selector). Directives are repo-wide blast radius by nature.
8. **Dialogs / modals / programmatic UI** — grep for the modal/dialog service or component idiom in use
   (varies: CDK overlay, a UI library's dialog service, a custom modal service, `ViewContainerRef`
   injection). List distinct modal/dialog **content** components separately from the modal **shell**.
9. **Custom interactive widgets** — grep/glob for dropdown, combobox, select, autocomplete, tabs,
   accordion, calendar/datepicker, stepper, carousel, and map components — both hand-rolled and
   UI-library wrappers around them. These get their own batch regardless of size because they carry the
   highest keyboard/ARIA risk.
10. **Localization & RTL/LTR** — detect the i18n library (or absence of one), locale file locations, the
    attribute idiom for translated strings, and how/whether `dir`/`lang` switch at runtime. Do not assume
    any particular library.
11. **Build/type-check/lint/test commands** — read `package.json` scripts and `angular.json`
    architect targets. Note the type-check command, the lint command (and whether a targeted per-file
    invocation exists), the test command, and the build command. Note any that look broken or unused.
12. **Browser/runtime constraints, auth, permission gating** — note if the app requires a backend to boot,
    how login works, and which routes/features are behind a role or permission (from step 2) — this
    shapes the final runtime-verification batch, not this skill's own testing.
13. **Dead/unreachable components** (when useful, not exhaustive) — for a component with a suspiciously
    low fan-out (0 route references, 0 imports outside its own folder found via grep), flag it as a
    **dead-code candidate** rather than silently including or excluding it from batches.
14. **Routeless but user-reachable components** — components rendered via a service (toasts, modals,
    dynamic host, overlay) rather than a route. These are easy to miss in a route-driven scan; find them
    via the dialog/modal-service grep from step 8 plus any `ViewContainerRef`/`createComponent` call sites.
15. **Large/high-risk templates** — templates with a high line count, deep nesting, or a dense mix of
    tables/forms/conditionals (a quick `wc -l` pass over templates, sorted descending, is enough — don't
    read them all). These usually need their own batch slot rather than being folded into a feature group.

Stop discovery here. Per-batch detail (exact file lists, exact issue counts) is the batch owner's job when
that batch runs, not the planning skill's.

---

## Batch-skeleton mapping (Angular)

How the planning skill's generic priority skeleton maps onto Angular artifacts:

| Skeleton slot | Angular artifacts |
|---|---|
| High-fan-out shared controls | shared components ranked by selector consumer count (step 5), error/validation component |
| Shell-level | shell/layout component, nav/menu, shared directives (step 7), modal/dialog shells (step 8) |
| Shared presentational / form controls | lower-fan-out shared components, CVAs (step 6) |
| Feature/page batches | route-tree features, grouped when structurally similar (step 3) |
| Source-only special components | custom interactive widgets (step 9), large templates (step 15), routeless components (step 14) |
