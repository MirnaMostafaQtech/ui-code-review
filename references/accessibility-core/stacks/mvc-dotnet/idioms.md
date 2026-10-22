# ASP.NET MVC / Razor idioms — how to express an accessibility fix

> **OPTIONAL REFERENCE — do not read by default.**
> The agents and skills carry the core MVC idioms inline (string values for `aria-*` in Razor, `null` to
> omit, fix the generating partial/helper, the localization attribute idiom from the project profile).
> Open this file **only** when you hit a Razor / Tag Helper / HTML Helper / JavaScript pattern you
> cannot express confidently. Jump to the one section you need; never read it end-to-end.

The five areas in `../../common/accessibility-areas.md` say **what** to fix. This file says **how to write
it in a Razor-rendered app** without breaking model binding, validation, scripts, or localization.

**Everything here is conditional on the project actually using it.** Take the mechanism (localizer type,
validation library, JS style, UI library, Bootstrap version) from the Repository Profile. Never introduce a
convention the repository does not already use.

**Never write Angular syntax in these files** — no `[attr.*]`, `(click)`, `*ngIf`, `@Input()`, pipes.

---

## 1. The ways to put an attribute on an element

| Form | When | Example |
|---|---|---|
| **Static attribute** | value never changes and is not user-visible text | `role="tablist"` `scope="col"` `alt=""` |
| **Razor expression** | value is localized text or computed on the server | `aria-label="@Localizer["Close"]"` |
| **Tag Helper passthrough** | extra attribute on an `asp-for` element — unbound attributes are emitted as written | `<input asp-for="Email" aria-describedby="…" />` |
| **HTML Helper `htmlAttributes`** | element produced by `Html.TextBoxFor` & co. — `_` becomes `-` | `new { @class = "form-control", aria_describedby = "…" }` |
| **Generator code** | the element is produced by a custom Tag Helper / HTML Helper / View Component | `output.Attributes.SetAttribute("aria-expanded", "false")` |
| **JavaScript** | the value changes on the client after render | `trigger.setAttribute('aria-expanded', 'true')` |

### The rule that breaks most Razor patches: `aria-*` values must be **strings**, never C# `bool`

Razor treats an attribute whose whole value is a single expression as a **conditional attribute**:
`null` → attribute omitted; `false` → attribute omitted; `true` → rendered as `name="name"`.
That is right for `disabled`/`checked`, and wrong for every ARIA state:

```cshtml
@* WRONG — renders aria-expanded="aria-expanded" when true, and nothing at all when false *@
<button aria-expanded="@Model.IsOpen">
@* RIGHT *@
<button aria-expanded="@(Model.IsOpen ? "true" : "false")">
```

### Removing an attribute: evaluate to `null`

The same rule is the tool for omitting reference attributes:

```cshtml
<input asp-for="Email" aria-describedby="@(hasError ? errorId : null)" />
```

Asymmetry (same as everywhere): `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`,
`aria-invalid` are **meaningful when `"false"`** — render the string. `aria-hidden`, `aria-describedby`,
`aria-labelledby`, `aria-controls`, `aria-current` should be **absent** rather than false/empty — use `null`.

In JavaScript, likewise pass **strings** (`'true'`/`'false'`) and use `removeAttribute` to omit.

---

## 2. Labels and form controls

**Tag Helpers:**

```cshtml
<label asp-for="Email"></label>
<input asp-for="Email" class="form-control" />
```

- `asp-for` generates `id` and `name` from the expression; `<label asp-for>` generates the matching
  `for` — so the pair is associated **only when both use the same expression**. A hand-written
  `<label for="email">` next to `asp-for="Email"` (id `Email`) is a broken association — ids are
  case-sensitive.
- The label **text** comes from `[Display(Name = …)]` on the model property, or falls back to the
  **property name** (`EmailAddress`). A property-name fallback in a localized app is a finding: fix it with
  the project's DataAnnotations localization (`[Display(Name = "…", ResourceType = typeof(…))]`, or the
  key convention of `AddDataAnnotationsLocalization`) — never by hardcoding label text in the view.
- Collections: `asp-for="Items[i].Name"` generates id `Items_0__Name` and name `Items[0].Name`. Build any
  derived id from the generated one (`Html.IdFor(m => m.Items[i].Name)`) so it stays unique per row.

**HTML Helpers** — same association rules:

```cshtml
@Html.LabelFor(m => m.Email)
@Html.TextBoxFor(m => m.Email, new { @class = "form-control" })
```

- A control rendered with a **custom** `id` (`new { id = "x" }`) no longer matches `LabelFor` — pass the
  same id to the label, or use `aria-labelledby`.
- **Never change a generated `name`** — model binding depends on it. Never change an `id` that scripts,
  styles or tests reference; add your hook alongside.

**Placeholder-only / no visible label** → localized `aria-label` (Razor expression, §5), or associate the
visible text that already acts as a label via `aria-labelledby`.

**Groups** (radio lists, checkbox lists) → `<fieldset>` + `<legend>`; the legend text is localized.

---

## 3. Validation accessibility

What the framework emits, and what it does not:

- `[Required]` produces `data-val-required`, **not** `required` or `aria-required`. Add
  `aria-required="true"` for required fields. Do **not** add the native `required` attribute as an
  accessibility fix — it enables browser validation and changes submit behavior.
- `<span asp-validation-for="Email">` / `Html.ValidationMessageFor(m => m.Email)` render a message
  container (`data-valmsg-for="Email"`) with **no `id`**, and the input gets **no `aria-describedby`** and
  **no `aria-invalid`** from the server.
- When `ModelState` has an error on a re-rendered POST, the input gets `input-validation-error` and the
  container gets `field-validation-error` — **classes only**, nothing announced.
- **Client-side libraries may already do part of this.** Recent jQuery Validation versions set
  `aria-invalid` on validated fields and append the id of their generated error element to
  `aria-describedby`. **Confirm for the version shipped in this repo** (read it in `wwwroot/lib` /
  `Scripts/`, then submit the form in the browser and inspect the input) before proposing anything —
  otherwise you create a duplicate id or a doubled announcement.

Rules:

1. **One description source per field.** Never reference both a container and an element nested inside
   it — the message is read twice. Never introduce an id the client library also generates (e.g.
   `<field-id>-error` when jQuery Validation uses that pattern).
2. **Cover both paths.** Server-rendered errors (POST re-render, or client validation disabled) and
   client-side errors. A fix for one path must not break the other. Every validation finding is
   `runtimeCheck: needed`, verified after **both** a client-side and a server-side failure.
3. **Server-rendered state** is expressible in Razor — conditional, so nothing references an empty or
   absent message (ASP.NET Core shown; adapt the `ModelState` lookup to the project's MVC/C# version):

   ```cshtml
   @{
       var fieldId  = Html.IdFor(m => m.Email).ToString();
       var hasError = ViewData.ModelState.TryGetValue(Html.NameFor(m => m.Email).ToString(), out var entry)
                      && entry.Errors.Count > 0;
       var msgId    = fieldId + "-validation";   // must not collide with any client-generated id
   }
   <label asp-for="Email"></label>
   <input asp-for="Email" aria-required="true"
          aria-invalid="@(hasError ? "true" : null)"
          aria-describedby="@(hasError ? msgId : null)" />
   <span asp-validation-for="Email" id="@msgId"></span>
   ```

   The same logic repeated on every field belongs in the **shared generator** (§6) — an EditorTemplate,
   a custom Tag Helper, or an HTML Helper extension — not pasted into forty views.
4. **Announcing errors.** Prefer the existing validation summary (`asp-validation-summary` /
   `Html.ValidationSummary()`): give it a localized heading and, on a failed submit, move focus to it —
   or make it a live region **that exists in the page before errors are inserted**. Putting
   `role="alert"` on every field's message announces every error at once; do not do that by default.
5. If a clean single-source linkage needs a change to validation-library configuration, **report it**
   — do not rewrite validation behavior.

---

## 4. Razor localization

Detect the mechanism **before** adding any string; use exactly the profile's idiom.

```cshtml
@* ASP.NET Core — view localizer (usually injected in _ViewImports.cshtml) *@
<button type="button" aria-label="@Localizer["Close"]">…</button>

@* ASP.NET Core — shared resource *@
@inject IStringLocalizer<SharedResource> L
<img src="~/img/logo.svg" alt="@L["Company logo"]" />

@* MVC 5 / strongly-typed resource class *@
<button type="button" aria-label="@Resources.Strings.Close">…</button>
```

Rules:

- **A static `aria-label="Close"` in a localized app is a localization bug** — the most common real
  finding. So is a C# ternary between literals (`@(open ? "Hide" : "Show")`) and a JavaScript literal
  (`el.setAttribute('aria-label', 'Close')`).
- `alt=""` and ARIA state values (`true`, `false`, `page`, `dialog`) are **not** text — never localize them.
- **Missing keys fail quietly.** `IStringLocalizer` returns the **key itself** when a resource is not
  found — an English-looking key renders fine in English and untranslated everywhere else. Add every new
  key to **every** culture's `.resx` (or the project's equivalent store), and verify in a non-default culture.
- **Strongly-typed `.resx` classes** (`Resources.Strings.Close`) come from a generated `*.Designer.cs`.
  Check whether the project regenerates it at build; if it relies on the Visual Studio custom tool, a new
  key does not compile until it is regenerated. Never hand-edit generated code — prefer an indexer-based
  localizer the project already uses, otherwise add the keys and **report** the regeneration step.
- **JavaScript text** must come from the server: a `data-*` attribute rendered with the localizer on the
  element the script manipulates (`data-label-expanded="@Localizer["Collapse"]"`), or a localized strings
  object the project already renders. Never a hardcoded literal in a `.js` file of a localized app, and
  never a new global strings mechanism the project does not already have — report the gap instead.
- HTML-encoding: `IViewLocalizer`/`IHtmlLocalizer` values are encoded correctly in attributes. **Never use
  `@Html.Raw`** to emit accessibility attributes or localized text.

---

## 5. Layout and landmarks — `_Layout.cshtml`

The layout owns what every page shares, so a layout fix is repo-wide:

- **`<html lang dir>`** — from the current culture when the app switches culture per request, matching the
  project's existing mechanism:
  `<html lang="@CultureInfo.CurrentUICulture.Name" dir="@(CultureInfo.CurrentUICulture.TextInfo.IsRightToLeft ? "rtl" : "ltr")">`.
  Never hardcode `dir` in an app that switches direction.
- **Landmarks** — `<header>`, `<nav>` (distinct localized names when there is more than one),
  `<main>` wrapping `@RenderBody()`, `<footer>`. Add them in the layout only when purely additive (wrap,
  do not reorder).
- **Skip link** — the first focusable element in `<body>`, targeting `<main id="…" tabindex="-1">`, text
  localized, visually hidden using the profile's **existing** sr-only/visually-hidden class (Bootstrap 4
  `sr-only sr-only-focusable`, Bootstrap 5 `visually-hidden-focusable`). If no such class exists, adding
  CSS is out of scope — report it.
- **Headings** — the view owns its `<h1>`; a layout that hard-codes an `<h1>` (site name) makes every view's
  `<h1>` a duplicate. Check before changing; headings inside shared partials land at different depths.
- Multiple layouts (`_Layout`, `_AdminLayout`, `_LoginLayout`) each need the same fixes — list which views
  each serves (`_ViewStart.cshtml` per folder, explicit `Layout =`).

---

## 6. Partials, EditorTemplates, View Components — fix inside or at the call site?

| Situation | Fix goes |
|---|---|
| Value is identical for every caller (a close button's name, a table's `scope`) | **inside** the partial / template / View Component view |
| Value differs per caller (a section's accessible name, a heading level) | **at the call site**, passed in through the mechanism the partial already uses — its model, `view-data` / `ViewData`, or a View Component invocation argument |
| The partial has no way to receive the value | propose the **additive** option: an optional `ViewData` key read with a fallback, or an optional View Component parameter with a default. Anything else (required parameter, view-model contract change) → **report** |
| Markup rendered for every `EditorFor`/`DisplayFor` of a type | the **EditorTemplate / DisplayTemplate** — one edit fixes every form |

Blast radius first — grep every invocation form:

```
partial name="_Name"        Html.Partial("_Name"      Html.RenderPartial("_Name"      PartialAsync("_Name"
Component.InvokeAsync("Name"         <vc:name
EditorFor( … ) of the template's type
```

**Ids in repeated partials.** A partial rendered in a loop repeats every static `id` — breaking every
`for`/`aria-*` reference. Derive ids from the generated field id (`Html.IdFor`) or from a key passed by the
caller.

---

## 7. Tag Helpers and HTML Helpers — fix the generator

When a custom Tag Helper or HTML Helper produces the broken markup, **fix the generator**, not the many
views that call it:

```csharp
// custom Tag Helper
output.Attributes.SetAttribute("aria-expanded", IsOpen ? "true" : "false");
output.Attributes.SetAttribute("aria-label", _localizer["Close"].Value);

// custom HTML Helper
var tag = new TagBuilder("button");
tag.MergeAttribute("type", "button");
tag.MergeAttribute("aria-label", label);
```

- Localize inside a Tag Helper through an injected localizer (Tag Helpers support constructor injection),
  or accept the text from the caller — never a literal.
- A caller-specific value → an **additive optional** property on the Tag Helper (bound attribute) or an
  optional parameter on the helper method. Changing existing properties/signatures is a contract change →
  report.
- Count usages (`<element-name`, the attribute it targets, or the method name) and state the count.

---

## 8. JavaScript / jQuery widgets and dynamic content

The accessibility rules are the same as for any widget; express them in the project's actual script
style (jQuery or vanilla — match the file).

- **Server-render what is static, script what changes.** Roles, `aria-controls`, and initial state
  belong in the Razor markup; scripts only update state. Initial ARIA written by a `document.ready`
  script is missing from AJAX-inserted content.
- **State tracks the visual state, in the same function:**

  ```js
  function setOpen(open) {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  ```

- **Keyboard for a custom control** — prefer converting to a native `<button>`. Fallback: `tabindex="0"`
  and a `keydown` handler that calls the **same function** the click handler calls; Enter + Space for
  buttons (Space calls `preventDefault()`), Enter only for links; Escape closes overlays via the existing
  close function.
- **Hidden content must not be focusable** — hide with `hidden` / `display: none` (a class that maps to
  `display: none` is fine; `visibility`/opacity/off-screen classes are not).
- **Focus** — capture the trigger on open, restore it on close; after a script removes the focused
  element, move focus somewhere meaningful (the new content's heading with `tabindex="-1"`, or the trigger).
- **Event delegation** for content that is replaced by AJAX (`$(container).on('keydown', '.js-x', …)`),
  otherwise handlers bound before the swap are lost.
- **AJAX partial updates** (`.load()`, `$.ajax` + `.html()`, `data-ajax-update`, `fetch` + `innerHTML`):
  - announce the result through a **persistent** polite live region that exists in the layout before
    the update (text localized, supplied by the server);
  - `aria-busy="true"` on the region while loading, removed after;
  - if the swap destroyed the focused element, move focus (above);
  - a form inserted by AJAX has no client validation until the project re-parses it — if that call is
    missing, **report** it (it is behavior, not an attribute).
- **UI-library widgets** (e.g. Bootstrap modal/dropdown/collapse/tab) manage `aria-expanded`, Escape and
  modal focus **themselves when their documented markup is present** — add the documented attributes for
  the library version in the profile (Bootstrap 3/4 `data-toggle` vs 5 `data-bs-toggle`); never add a
  second handler or trap. Confirm with a Tab walk.
- **No focus-trap or roving-tabindex library in the project → report.** Never hand-roll one.
- **Compiled scripts.** If `wwwroot/js` is output (TypeScript `outDir`, webpack, a bundler), edit the
  **source** file, never the output.

---

## 9. Third-party UI libraries

- **Never patch** `wwwroot/lib/**`, `node_modules/**`, `Scripts/` files installed by NuGet (MVC 5), any
  `*.min.js`/`*.min.css`, or bundle output.
- Configure through the library's **documented** options or after-init hooks, at the call site. Read the
  library's API for the installed version; do not guess option names.
- If the library cannot be made accessible by configuration, **report** it with the library, version and
  what is missing.

---

## 10. Things never to do

- Never write Angular syntax (`[attr.*]`, `(event)`, `*ngIf`, pipes, `@Input()`) in a `.cshtml` or `.js`.
- Never pass a C# `bool` as an `aria-*` value.
- Never use a **positive `tabindex`**.
- Never hardcode user-visible text in a view, a helper, or a script — including inside a ternary.
- Never add `role` to an element that already has that semantic (`role="button"` on `<button>`).
- Never leave an `aria-*` reference pointing at an id that may not exist in that rendered state.
- Never change a generated `name`/`id`, controller/action logic, routes, model binding, or a view-model
  contract as part of an accessibility fix.
- Never use `@Html.Raw` to emit accessibility markup.
- Never edit `bin/`, `obj/`, `wwwroot/lib/`, `packages/`, generated `*.Designer.cs`, or vendor/bundled output.
- Never add a NuGet/npm/LibMan package, or change `bundleconfig.json`/`BundleConfig.cs`/`libman.json`,
  lint or build config, or reformat a file as part of an accessibility fix.
- Never remove an existing class (styling or `js-*` hook), `id`, `data-*` attribute, or event binding to
  make room for an attribute.
