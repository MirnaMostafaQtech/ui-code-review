# Agent contract — read-only auditors, single writer

**Audience: the MAIN agent.** The five `accessibility-*` specialist agents are self-contained — they carry
their own area rules and their own output schema, and they do **not** read this file. Do not tell them to.

---

## Architecture

Read-only area specialists audit in parallel and return **compact findings**. The **main agent is the
sole writer**: it reads the real source, applies fixes, adds translation keys centrally, and verifies.
One writer = no concurrent-edit race, no line-number drift, locale files touched once.

Agents report *what is wrong and what to do*. They do **not** ship source blocks — the main agent reads
the file itself before every edit. That is the single biggest context saving in this system.

---

## Selecting agents — never launch all five by default

Run a **cheap pre-scan** of the target files first (`Grep`/`Glob`, no full reads), then invoke **only**
the areas with real evidence. Zero, one, or two agents is the normal case. All five is rare and must be
justified by the scan.

These agents ship with this plugin, so the value in the **Invoke** column below is the exact
`subagent_type` to pass — plugin agents are addressed as `<plugin-name>:<agent-name>`.

The agents specialize by **accessibility area, not by technology** — the same five serve every stack.
Use the signal column that matches the target's stack (see "Stack routing" below).

| Invoke | Angular targets — the pre-scan finds |
|---|---|
| `ui-code-review:accessibility-labels` | `<input`, `<textarea`, `<select`, `formControlName`, `ngModel`, `ControlValueAccessor`, icon-only controls |
| `ui-code-review:accessibility-alt` | `<img`, `<svg`, `<fa-icon`, `<mat-icon`, `background-image`, icon-font classes |
| `ui-code-review:accessibility-aria` | `aria-`, `role=`, custom widgets (dropdown/tab/dialog/combobox), validation/error components, `@HostBinding` of state |
| `ui-code-review:accessibility-semantics` | `<table`, `<ul`/`<ol`, `<h1`–`<h6`, `(click)` on `div`/`span`/`li`, landmark gaps, `lang`/`dir`, component hosts inside `table`/`list` |
| `ui-code-review:accessibility-keyboard` | `tabindex`, `(keydown`, `(keyup`, `@HostListener`, modal/overlay/dropdown/tabs, focus/`.focus()`, custom interactive widgets |

| Invoke | ASP.NET MVC / Razor targets — the pre-scan finds |
|---|---|
| `ui-code-review:accessibility-labels` | `<input`, `<textarea`, `<select`, `asp-for`, `Html.*For(` form helpers, EditorTemplates, icon-only controls |
| `ui-code-review:accessibility-alt` | `<img`, `<svg`, icon-font classes, `background-image`, image-producing helpers |
| `ui-code-review:accessibility-aria` | `aria-`, `role=`, `asp-validation-for`, `ValidationMessageFor`, validation summary, widget `data-*` toggles, scripts setting `aria-*` |
| `ui-code-review:accessibility-semantics` | `<table`, `<ul`/`<ol`, `<h1`–`<h6`, `onclick`/click handlers on `div`/`span`/`li`, `@RenderBody` / landmark gaps, `lang`/`dir` |
| `ui-code-review:accessibility-keyboard` | `tabindex`, `keydown`/`keyup` handlers, `.focus(`, modal/dropdown/tabs scripts, AJAX content swaps, custom interactive widgets |

Suggested pre-scan (cheap, no file reads):

```bash
# Angular targets
grep -lE '<input|<textarea|<select|formControlName|ngModel' <targets>   # → labels
grep -lE '<img|<svg|fa-icon|mat-icon' <targets>                          # → alt
grep -lE 'aria-|role=|HostBinding' <targets>                             # → aria
grep -lE '<table|<ul|<h[1-6]|\(click\)' <targets>                        # → semantics
grep -lE 'tabindex|\(keydown|HostListener|\.focus\(' <targets>           # → keyboard

# ASP.NET MVC / Razor targets (.cshtml, generator .cs, project scripts)
grep -lE '<input|<textarea|<select|asp-for|Html\.[A-Za-z]+For\(' <targets>              # → labels
grep -lE '<img|<svg|class="[^"]*\b(fa|bi|glyphicon|icon)' <targets>                      # → alt
grep -lE 'aria-|role=|asp-validation|ValidationMessage|ValidationSummary' <targets>      # → aria
grep -lE '<table|<ul|<h[1-6]|onclick|RenderBody|\.on\(.click|addEventListener\(.click' <targets>   # → semantics
grep -lE 'tabindex|keydown|keyup|\.focus\(|\.modal\(|\.load\(|\$\.ajax|fetch\(' <targets>          # → keyboard
```

### Stack routing — tell each agent which stack it is auditing

Resolve the stack of **every target** before launching agents (`stack-detection.md`, "Resolving the stack
for a single target"). Every agent prompt states it explicitly, e.g. `Stack: ASP.NET MVC` — and in a
Hybrid repo, per target file. An agent never infers the stack from the repository as a whole, and never
receives a mixed-stack target list without a per-file stack label.

### The pre-scan is a routing hint, not proof

A grep says which areas are *likely* relevant. It does **not** prove a target is clean — headings,
landmarks, table structure, host-wrapper breaks, `lang`/`dir`, and reading order leave no distinctive
token to grep for.

**If the pre-scan surfaces no obvious area, do one lightweight structural skim before concluding zero
agents are needed:** read the target template (or the class's inline template / host metadata) once and
look for headings and heading order, landmark structure, tables and lists, component hosts sitting
inside a `table`/list parent, text acting as a control, and any `lang`/`dir` need. If the skim surfaces
anything, route it — usually to semantics. Only after a clean skim may you report "no agent needed".
This is a single read of the target; it is **not** discovery, and it never widens to the repository.

### Route by target type as well as by source signal

Combine the grep signals with what the target *is*. Use the narrower of the two — this is still
selective routing, never a fallback to all five.

| Target type | Usually route to |
|---|---|
| Layout / page shell (Angular shell component, Razor `_Layout.cshtml`) | semantics, keyboard (landmarks, skip link, route focus) |
| Custom form control (Angular CVA; MVC EditorTemplate / form Tag Helper / HTML Helper) | labels, aria, keyboard |
| Custom dropdown / combobox / listbox | labels, aria, keyboard |
| Tabs | semantics, aria, keyboard |
| Modal / dialog / overlay | semantics, aria, keyboard |
| Image / icon component | alt (+ labels when the icon is a control's only content) |
| Table / grid | semantics, aria |
| Error / validation component (MVC: validation message / summary markup) | aria (+ labels for linkage naming) |
| AJAX-loaded partial + its inserting script (MVC) | aria, keyboard (announcement, focus after swap) |
| Static content / presentational | skim first; often semantics only, sometimes none |

**Browser findings:** route each violation to its area by rule id and send only that area's findings to
that agent. Never broadcast the full violation list to every agent.

---

## Compact finding schema (what agents return)

```yaml
Area: <1 Labels | 2 Alt | 3 ARIA | 4 Semantic | 5 Keyboard>

Findings:
  - file: <repo-relative path>
    location: <line | member | element selector>
    issue: <one line: what is wrong>
    fix: <one line: the precise change to make>
    translationKey: <key + locale values, or none>
    sharedImpact: <consumer count, or none>
    runtimeCheck: <needed | not-needed>

Conflicts:
  - <file:element — also owned by §N, why>

OutOfScope:
  - <one line each>

moreFindings: <true | false>
remainingCount: <number or approximate, when moreFindings is true>
```

Verify on receipt:
- **No source blocks, no anchors, no replacement text, no full files.**
- **Duplicates grouped.** One shared-control finding with `sharedImpact: 16 consumers`, never 16 identical findings.
- Highest-value findings only, ~10 grouped findings per agent — but **never silently truncated**. If
  more confirmed unique findings remain, the agent must set `moreFindings: true` and `remainingCount:
  <n or approximate>`. When you see that, decide whether to request another focused pass on that target.

---

## Merge → apply → verify (main agent)

**Merge**
1. Group by `file`, then by element. One element collecting a §1 name + §3 `aria-describedby` + §5
   `tabindex` is **one** edit, not three.
2. **Supersession:** if §4 swaps a fake control for a native element, drop §3's `role` and §5's
   `tabindex`/key handlers for that element.
3. Precedence on genuine clashes: §1 > §3 for a field's name; §2 > §3 for graphics; §5 > §3 for
   `tabindex`; §4's element swap over anything it makes unnecessary.
4. Drop duplicates and no-ops.

**Apply**
5. **Read the target file yourself before editing it.** Agents send instructions, not anchors — you own
   locating the exact text and keeping every binding, directive, class, `id`, and `#ref` intact (MVC:
   every `asp-*` attribute, generated `name`, `data-*` hook, and script binding).
6. Apply sequentially with `Edit`. Prefer semantic HTML over ARIA; never a positive `tabindex`.
   **Write in the target's stack idiom only** — never Angular syntax in a Razor/script file, never Razor
   or Tag Helper syntax in an Angular file.
7. **Add translation keys centrally**, into **every** locale file, per the project's key shape and
   registered namespaces (MVC: every culture's `.resx` or the project's equivalent store). Only you write
   locale files.
8. If a fix needs a new dependency or a contract change beyond the stack's **additive** option — Angular:
   an additive optional `@Input()`; MVC: an optional `ViewData` key with a fallback, an optional View
   Component parameter with a default, or an optional Tag Helper property / helper parameter — **stop and
   report** instead of widening the change.

**Sanity-check the merged markup**: exactly one accessible name per element, valid role+attribute
combinations, every `aria-*` reference pointing at an id that exists in that rendered state.

---

## Cross-cutting rules (all areas, all skills)

1. **Semantic HTML first.** A native element with the role, focusability and keyboard behavior beats
   any ARIA. `<button>` over `<div role="button" tabindex="0">`.
2. **No ARIA beats bad ARIA.** A wrong role, stale state, or reference to a missing id makes a screen
   reader confidently announce something false. Deleting bad ARIA is a legitimate fix.
3. **Never break the app.** Every binding, directive, class, `id`, `#ref` survives. A reported problem
   is a good outcome; a broken page is not.
4. **Never a positive `tabindex`.**
5. **No hardcoded user-visible text** — route it through the project's localization mechanism. A
   binding wrapping a hardcoded string (`cond ? 'Hide' : 'Show'`) is still hardcoded. `alt=""` and ARIA
   state values (`true`, `page`, `dialog`) are **not** text and are never translated.
6. **RTL respected** — never hardcode `dir`; horizontal arrow-key semantics are direction-dependent.
7. **No dependency installation** (Angular: including `@angular/cdk`; MVC: any NuGet, npm or LibMan
   package) without explicit approval — report the gap and what it would enable. Never hand-roll a focus
   trap or roving-tabindex manager as a substitute.
8. **Never touch** generated or vendored output — Angular: `node_modules`, `dist`, `.angular`, generated
   clients, vendor bundles; MVC: `bin`, `obj`, `packages`, `wwwroot/lib`, generated `*.Designer.cs`,
   minified/bundled output. Fix third-party widgets at the call site via documented inputs/options.
9. **Shared components: check blast radius first.** Count consumers (Angular: grep the selector; MVC:
   grep every partial / View Component / helper invocation form), decide whether the value is
   caller-invariant (fix inside) or caller-specific (the stack's additive option, or a call-site fix).
10. **A scanner passing is not keyboard accessibility.** axe cannot press Tab. §5 is never certified by
    static analysis or by a clean axe run.

**Global out of scope — report, never silently change:** all CSS/SCSS (contrast, focus-indicator
styling, reflow, motion — ask before anything visual); timing/session limits; media captions;
lint/build config; reformatting; DOM reordering and structural refactors; component contracts beyond the
stack's additive option (Angular: optional `@Input()`; MVC: see Apply step 8); controller/action, routing,
model-binding or view-model changes; full WCAG conformance claims.
