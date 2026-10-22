# ASP.NET MVC / Razor discovery

**Audience: the MAIN agent.** Load this only when the Repository Profile's UI Stack is `ASP.NET MVC`, or
`Hybrid` (then scope every search below to the MVC/Razor surface roots). Never read it for an Angular target.

Covers ASP.NET Core MVC and classic ASP.NET MVC 5, and Razor Pages when they render part of the same UI.
Every answer must come from **this repository's** source. Never assume a convention (folder names,
localization mechanism, validation library) because it is the framework default — confirm it or write
`unknown`.

Exclude `bin/`, `obj/`, `packages/`, `node_modules/`, `wwwroot/lib/`, and any bundled/minified output
from every search.

---

## Minimal discovery (profile only — used by `../../common/project-context.md`)

Read the UI project's `.csproj`, `Program.cs` (and `Startup.cs` if present — for MVC 5: `Global.asax.cs`,
`App_Start/*.cs`, `Web.config`), the main `_Layout.cshtml`, `_ViewImports.cshtml`, and one representative
form view. Nothing else. Answer only these, and stop:

1. **Framework + version** — ASP.NET Core MVC (`TargetFramework` in the `.csproj`) or MVC 5 (.NET
   Framework `TargetFrameworkVersion`, `System.Web.Mvc` version); Razor Pages in use too?
2. **Localization** — mechanism actually wired: `AddViewLocalization`/`AddDataAnnotationsLocalization`
   and `@inject IViewLocalizer` / `IStringLocalizer<T>` / `IHtmlLocalizer<T>`; a strongly-typed `.resx`
   class (`@Resources.Strings.Key`); a custom JSON/DB localizer; or none. Resource file locations,
   cultures present (**note any culture file that is missing keys**), and the exact **attribute** idiom
   used in views (e.g. `aria-label="@Localizer["Close"]"`). Whether new keys in a strongly-typed `.resx`
   need `*.Designer.cs` regeneration. How JavaScript receives localized text, if at all. This is the field
   most fixes depend on.
3. **UI libraries + icon idiom** — CSS/JS framework and version (Bootstrap 3/4/5 differ in data
   attributes and ARIA handling), widget libraries (select pickers, grids, date pickers), and whether each
   manages focus/ARIA itself.
4. **Forms/validation** — DataAnnotations on view models; Tag Helpers (`asp-for`) vs HTML Helpers
   (`Html.TextBoxFor`) or both; error markup (`asp-validation-for` / `Html.ValidationMessageFor`,
   validation summary); client validation library and version (`jquery-validation` +
   `jquery-validation-unobtrusive` in `wwwroot/lib` or `Scripts/`), or none; shared EditorTemplates.
5. **Dynamic UI** — jQuery vs vanilla JS; how partial content is loaded (`$.ajax`/`.load()`,
   `data-ajax-*` unobtrusive AJAX, `fetch`, htmx); where hand-written scripts live and which folders are
   **compiled or bundled output** (never edit those).
6. **Commands** — build (`dotnet build <proj>`, or `msbuild` for MVC 5), test, JS lint (and whether a
   targeted per-file invocation exists). Whether views are compiled at build time or at runtime
   (`AddRazorRuntimeCompilation`, MVC 5 `MvcBuildViews`) — this decides what a build actually checks.
   Note any command **broken at HEAD**, with the reason.
7. **Direction** — how `_Layout.cshtml` sets `<html lang dir>` (static, or from the current culture) and
   whether culture/direction switches per request.
8. **Never-touch paths** — `bin/`, `obj/`, `wwwroot/lib/`, `packages/`, generated `*.Designer.cs`,
   bundles/minified output, and anything else vendored.

---

## Planning discovery (used by `accessibility-plan` Step 1)

Run this once per project. Prefer targeted greps/globs over opening every file; open a file only when a
grep can't answer the question.

**Read directly:** the UI `.csproj`, `Program.cs`/`Startup.cs` (MVC 5: `Global.asax.cs`, `RouteConfig.cs`,
`BundleConfig.cs`, `FilterConfig.cs`), every `_Layout*.cshtml`, `_ViewStart.cshtml`, `_ViewImports.cshtml`,
one representative form view, and the resource folder if present.

**Answer via targeted search, not full reads:**

1. **Framework + architecture** — version (minimal-discovery 1); single web project vs a solution with
   several UI projects; Areas in use; Razor Pages alongside MVC; which projects are backend-only (API,
   services, data) and therefore **out of the UI surface**.
2. **Routing & authorization** — conventional routes (`MapControllerRoute`, `MapAreaControllerRoute`,
   `RouteConfig`), attribute routes on view-returning controllers, Razor Pages routes. `[Authorize]`
   (with `Roles`/`Policy`) on controllers/actions/pages, and global filters. Note which areas/controllers
   are permission-gated and by what.
3. **Features/pages** — derive the list from `Controllers/` × `Views/<Controller>/` (and
   `Areas/*/Controllers`, `Areas/*/Views`, `Pages/`), not by opening every view. Group near-duplicate
   CRUD controllers (Index/Details/Create/Edit/Delete) whose views are structurally similar into one batch
   candidate — verify with one representative set.
4. **Layouts & navigation** — every layout (`_Layout*.cshtml`) and which views use it (`_ViewStart` per
   folder, explicit `Layout =`); header/nav/sidebar/footer partials; menu View Components; breadcrumbs.
   The layout owns landmarks, the skip link and `<html lang dir>`.
5. **Shared partials & fan-out** — glob `Views/Shared/**`, `Areas/*/Views/Shared/**`. For each partial,
   count consumers with one grep over `partial name="<name>"`, `Html.Partial("<name>"`,
   `Html.RenderPartial("<name>"`, `PartialAsync("<name>"` — do **not** open every consumer.
6. **Editor/Display templates** — `Views/Shared/EditorTemplates/*`, `DisplayTemplates/*`. These render
   for every `EditorFor`/`DisplayFor` of their type — often the highest fan-out form markup in the repo.
7. **View Components** — classes deriving from `ViewComponent` and their views
   (`Views/Shared/Components/<Name>/*.cshtml`); consumer count via `Component.InvokeAsync("<Name>"` and
   `<vc:<kebab-name>`.
8. **Tag Helpers & HTML Helpers** — custom classes deriving from `TagHelper` (with their
   `[HtmlTargetElement]`), custom `IHtmlHelper`/`HtmlHelper` extension methods, `TagBuilder` usage.
   Each is repo-wide blast radius: count usages of its element/attribute or method name.
9. **Forms & validation** — minimal-discovery 4, plus the shared error/validation markup pattern (usually
   the highest-leverage single fix) and any custom client-validation adapters.
10. **Modals / dynamic UI** — the modal/dialog mechanism (Bootstrap modal, a widget library, custom JS),
    AJAX-loaded partials (actions returning `PartialView`, `data-ajax-update`, `.load(`), and
    toast/notification scripts. List distinct modal **content** partials separately from the modal shell.
11. **Custom interactive widgets** — hand-written or library-wrapped dropdowns, comboboxes/select
    pickers, tabs, accordions, date pickers, steppers, carousels, maps, data grids, and the JS that drives
    them. These get their own batch regardless of size — highest keyboard/ARIA risk.
12. **Localization & RTL/LTR** — minimal-discovery 2 and 7 in full: every culture's resource files, the
    shared-resource class, DataAnnotations localization, `RequestLocalizationOptions` cultures, RTL
    stylesheets or `dir` switching.
13. **Build/test/lint commands** — minimal-discovery 6.
14. **Runtime constraints** — `Properties/launchSettings.json` (`applicationUrl`, profiles) or IIS Express
    settings for MVC 5; database/external services required to render pages; authentication scheme
    (cookie, Identity, Windows auth, external IdP). This shapes the final runtime batch only.
15. **Dead/unreachable views** (when useful, not exhaustive) — a view with no action returning it and no
    `partial`/`Partial(`/`EditorFor` reference found by grep → **dead-code candidate**, flag it rather than
    silently including or excluding it.
16. **Large/high-risk views** — a quick `wc -l` over `*.cshtml` sorted descending, plus views that mix
    large forms, tables and heavy inline script. These usually need their own batch slot.

Stop discovery here. Per-batch detail is the batch owner's job when that batch runs.

---

## Batch-skeleton mapping (ASP.NET MVC)

How the planning skill's generic priority skeleton maps onto MVC artifacts:

| Skeleton slot | MVC artifacts |
|---|---|
| High-fan-out shared controls | EditorTemplates (step 6), custom Tag/HTML Helpers (step 8), shared validation markup (step 9), highest-count partials (step 5) |
| Shell-level | layouts, header/nav/footer partials and menu View Components (step 4), modal shell (step 10), site-wide JS modules |
| Shared presentational / form controls | lower-fan-out partials and View Components (steps 5, 7) |
| Feature/page batches | controller + its views (+ its area), grouped when structurally similar (step 3) |
| Source-only special components | custom widgets and their JS (step 11), AJAX-loaded partials (step 10), large views (step 16) |
