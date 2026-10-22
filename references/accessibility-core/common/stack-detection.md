# UI stack detection — decide what renders the UI before anything else

**Audience: the MAIN agent.** Run this before any discovery, planning, or fixing on a repository whose
`accessibility-progress.md` has no `UI Stack` line. It is cheap: globs and a few targeted greps, no full
reads beyond the handful of files named below.

Accessibility work is decided by the technology that **renders the user-facing markup** — not by
whatever else lives in the repository. A .NET solution that only serves JSON to an Angular client is an
**Angular** UI, full stop.

Supported results:

| Result | Meaning | Adapter |
|---|---|---|
| `UI Stack: Angular` | Angular renders every user-facing surface | `stacks/angular/` |
| `UI Stack: ASP.NET MVC` | Razor views (`.cshtml`) render every user-facing surface — ASP.NET MVC 5 or ASP.NET Core MVC, including Razor Pages used alongside MVC | `stacks/mvc-dotnet/` |
| `UI Stack: Hybrid` | both render real user-facing surfaces | both, **chosen per surface** |
| `UI Stack: Unknown` | no supported UI stack evidenced, or evidence is contradictory | none — **stop** |

---

## Step 1 — Collect evidence (globs/greps only)

Exclude `node_modules`, `bin`, `obj`, `dist`, `.angular`, `wwwroot/lib`, `packages` from every search.

### Angular UI evidence

| Signal | Weight |
|---|---|
| `angular.json` (or Nx `project.json` using an `@angular-devkit`/`@nx/angular` builder) | strong |
| a `package.json` at **any depth** (root, `ClientApp/`, `src/<App>/ClientApp/`, …) listing `@angular/core` | strong |
| `*.component.html` / `*.component.ts` files — count them | **UI-rendering** |
| `app.routes.ts`, `*-routing.module.ts`, `bootstrapApplication` / `platformBrowserDynamic` in `main.ts` | supporting |
| `src/app/` folder | supporting |

### ASP.NET MVC / Razor UI evidence

| Signal | Weight |
|---|---|
| `*.cshtml` under `Views/`, `Areas/*/Views/`, or `Pages/` — count them, **excluding** `_ViewImports`, `_ViewStart` and `Error.cshtml` | **UI-rendering** |
| `_Layout.cshtml` that contains real page chrome (`<header>`, `<nav>`, menus) around `@RenderBody()` | **UI-rendering** |
| `Program.cs` / `Startup.cs` calling `AddControllersWithViews`, `AddMvc`, `AddRazorPages`, `MapControllerRoute`, `MapDefaultControllerRoute`, `MapRazorPages` | strong |
| Controllers deriving from `Controller` (not only `ControllerBase`) that `return View(...)` / `PartialView(...)` | strong |
| Classic MVC 5: `Global.asax`, `App_Start/RouteConfig.cs`, `System.Web.Mvc` in `Web.config` / `packages.config` | strong |
| `*.csproj` with `Sdk="Microsoft.NET.Sdk.Web"` | supporting only |
| View Components (`: ViewComponent`), custom Tag Helpers (`: TagHelper`), `_ViewImports.cshtml` with `@addTagHelper` | supporting |
| `wwwroot/` | supporting only (an Angular SPA host has one too) |

### API-only / non-UI evidence (counts **against** MVC UI)

- `[ApiController]`, controllers deriving only from `ControllerBase`, `AddControllers()` without views,
  `MapControllers()` only, Swagger/OpenAPI setup, no `.cshtml` beyond boilerplate.
- SPA-host wiring: `UseSpa`, `UseSpaStaticFiles`, `MapFallbackToFile("index.html")`, a SPA proxy — these
  mean ASP.NET **hosts** a client app; they are not Razor UI.

### Unsupported UI evidence (report, never adapt)

`*.razor` (Blazor), React/Vue/Svelte in `package.json`, Web Forms (`*.aspx`). Record them under
`Other UI files` in the profile (or in the stop report when the result is `Unknown`); they do not make the
repository Angular or MVC.

---

## Step 2 — Decide

**Never decide from one file.** A stack is present only when it has **at least one UI-rendering signal
plus at least one strong signal** that corroborates it. File counts are not a threshold — they go into the
profile as evidence of scale and inform batching.

**Boilerplate `.cshtml`** means files that render no application page: `_ViewImports`, `_ViewStart`,
`Error.cshtml`, and a layout used only by those. Any other `.cshtml` that a controller action or Razor
Pages route actually renders to users is a Razor surface, however small. If the only such views are
trivial (e.g. one redirect page), still record them and ask whether they are in scope — never drop them
silently.

**SPA-host wiring counts against MVC UI only for the URL space it serves.** `MapFallbackToFile`, `UseSpa`,
or a catch-all action rendering the Angular shell means ASP.NET hosts Angular *there*. When other routes
still return real Razor views, the repository is `Hybrid`, not Angular.

| Angular UI | MVC/Razor UI | Result |
|---|---|---|
| present | absent (API-only, SPA host, or boilerplate `.cshtml` only) | **Angular** — even with `.csproj`, `Controllers/`, `Program.cs`, `wwwroot/` |
| absent | present | **ASP.NET MVC** — even with a `package.json` used for bundling or npm client libraries |
| present | present, and both render real user-facing surfaces | **Hybrid** |
| absent | absent | **Unknown** |

Edge cases:

- **Angular SPA template leftovers.** The ASP.NET Core Angular template ships `Pages/Error.cshtml` and
  `Pages/_ViewImports.cshtml`. These alone do **not** make a Razor surface. Classify Angular and list them
  under `Other UI files` in the profile.
- **Razor layout hosting an Angular app.** A `.cshtml` that renders `<app-root>` (or an Angular element)
  plus the Angular bundle, with Razor-rendered header/nav/footer around it, is **Hybrid**: the shell is
  an MVC surface, everything inside the Angular root is an Angular surface.
- **Angular elements embedded in MVC views.** MVC views using a few Angular custom elements are
  **Hybrid**; list the element tags as the Angular surface.
- **Contradictory evidence** (e.g. `angular.json` pointing at a missing `sourceRoot`, `.cshtml` files never
  referenced by any controller or route) → do not guess. Report the contradiction; classify only what is
  corroborated, or `Unknown` if nothing is.

---

## Step 3 — Act on the result

- **Unknown → stop.** Do not plan, do not fix. Report the evidence found per stack (what was present,
  what was missing) and any unsupported UI detected, and ask the user how to proceed.
- **Angular / ASP.NET MVC →** load only that stack's `../stacks/<stack>/discovery.md`. Never read the other stack's files.
- **Hybrid → map the surfaces before planning.** For each stack record:
  - **root path(s)** — e.g. `ClientApp/` (Angular `sourceRoot`), `Views/`, `Areas/Admin/Views/`;
  - **the routes/URL space it serves** — Angular: base href / SPA fallback path / proxy prefix;
    MVC: `MapControllerRoute` patterns, `[Route]` on view-returning controllers, areas;
  - **shared boundaries** — a Razor layout wrapping an Angular root, Angular elements inside views.

  Then run **both** stacks' discovery, each scoped to its own root.

Record the result, with the 2–4 decisive signals as evidence, in `accessibility-progress.md` under
`## Repository Profile` (schema: `project-context.md`).

### Greenfield exception — `accessibility-setup` only

`Unknown` means "stop" for every skill **except** `accessibility-setup`, and only when it is `Unknown`
because the repository is **too new or empty** — no UI-rendering signal for any stack, no unsupported UI,
no contradiction. Then setup **asks the user which UI stack the project will use** (Angular, ASP.NET MVC,
Hybrid) and records it as a declared stack (`greenfield-mode.md`, "Declared stack"). It never guesses from
supporting-only signals (a bare `.csproj`, `wwwroot/`, an API project).

`Unknown` caused by unsupported UI (Blazor, React, Vue, Web Forms …) or by contradictory evidence still
**stops** setup too — report the evidence and ask how to proceed.

A fresh scaffold normally detects cleanly: `ng new` yields `angular.json` + `@angular/core` + `app`
component templates → **Angular**; `dotnet new mvc` yields `AddControllersWithViews` + `Views/Home/*.cshtml`
+ a `_Layout.cshtml` with nav chrome → **ASP.NET MVC**. Scaffold size is irrelevant to the decision.

---

## Resolving the stack for a single target (every fix/test skill, every agent prompt)

| Profile says | Target stack |
|---|---|
| `Angular` | Angular |
| `ASP.NET MVC` | ASP.NET MVC |
| `Hybrid` | from the target: `*.component.html`, `*.component.ts` and any file under an Angular surface root → **Angular**; `*.cshtml`, view/tag-helper/HTML-helper/View Component `.cs`, and JS/TS under an MVC project's script folders (`wwwroot/js`, `Scripts/`) → **ASP.NET MVC**. A batch's `Stack:` line overrides when present. For a live DOM node, see the test skill's per-finding rule. |

If a Hybrid target matches neither rule, **ask** — never apply one stack's idioms by default.
