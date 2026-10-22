# Project context — persist once, reuse forever

Repository discovery is expensive and its answers barely change. Persist it **in the repository**, not
in a session scratchpad, so a brand-new Claude session can continue work by reading two small files.

---

## Step 0 for every accessibility run

Look for these, in order, in the repo (typically under `docs/accessibility/` or the repo root):

| File | Role | Written by |
|---|---|---|
| `accessibility-audit-plan.md` | batch definitions, scope, execution order | planning run |
| `accessibility-progress.md` | **Repository Profile** + established patterns + per-batch status | every batch |
| `accessibility-baseline.md` | project-specific preventive standard — **Greenfield Mode only** | `accessibility-setup` |

**Project Mode.** Read the profile's `Project Mode` line first. `Greenfield` → also read
`accessibility-baseline.md` and follow `greenfield-mode.md` (same folder); there is no audit plan and no
batches. `Remediation` **or no line at all** → everything below applies unchanged.

**Decision:**

- **`accessibility-progress.md` exists with a valid Repository Profile** → read it and **skip discovery
  entirely**. Do targeted discovery *only* for a field the current task needs that is missing or clearly
  stale (e.g. `package.json` or a `.csproj` changed since the profile was written).
- **It does not exist** → run the **minimal discovery** below **once**, then create the file.

A new session continues from: `accessibility-audit-plan.md` → `accessibility-progress.md` → the current
target files. **Never re-scan the whole project.**

Treat a profile line as stale only with evidence (a dependency added, a command renamed). "It might have
changed" is not evidence.

### Legacy profiles (written by plugin v1.0.0)

A profile with no `UI Stack` line but with an `- Angular:` line is a **valid Angular profile**. Treat it
as `UI Stack: Angular`, use its flat fields as the Angular block below, and **do not rediscover**. The next
time you update the progress file, add `- UI Stack: Angular — evidence: legacy v1.0.0 profile` as the
first profile line; change nothing else.

---

## Minimal discovery (only when no progress file exists)

1. **Detect the UI stack** — `stack-detection.md` (same folder). If the result is `Unknown`, stop and
   report the evidence; there is nothing to profile.
2. **Answer only the minimal-discovery questions of the detected stack(s)**, and stop:
   - Angular → `../stacks/angular/discovery.md` § "Minimal discovery"
   - ASP.NET MVC → `../stacks/mvc-dotnet/discovery.md` § "Minimal discovery"
   - Hybrid → both, each scoped to its own surface root
3. Fill the common fields below (architecture, direction, runtime requirements, never-touch).

Do not enumerate every route, every component, every view, or every consumer during discovery. That is
per-batch work.

---

## `accessibility-progress.md` format

Keep it compact. It is a reusable cache, not a log. No diffs, no tool calls, no long prose.

**Include only the stack block(s) the repository actually has.** Never write Angular fields into an MVC
profile or MVC fields into an Angular profile. Use `unknown` rather than guessing.

```markdown
# Accessibility Progress

## Repository Profile
- Project Mode: Greenfield                                     # written ONLY by accessibility-setup; accessibility-plan omits the line (absent = Remediation)
- UI Stack: <Angular | ASP.NET MVC | Hybrid> — evidence: <2-4 decisive signals | declared by user during accessibility-setup (not yet corroborated)>
  - Angular surfaces: <root path(s); routes/URL space>          # Hybrid only
  - MVC/Razor surfaces: <root path(s); routes/areas>            # Hybrid only
  - Boundaries: <e.g. Razor _Layout wraps <app-root>>           # Hybrid only
  - Other UI files: <boilerplate or unsupported UI noted, not planned>   # when any
- Architecture: <single app | Nx/monorepo | multi-project solution — which project renders UI, which are backend-only>
- Direction: <lang/dir, where set, runtime switching?>
- Runtime requirements: <backend/DB/services needed to render pages — details in Runtime Profile>
- Never touch: <paths>

### Angular                       # UI Stack = Angular or Hybrid
- Angular: <version, standalone/NgModule, control-flow, signals>
- Workspace root: <. or subfolder, e.g. ClientApp/ — commands run from here>
- Localization: <lib>; files <paths>; registered namespaces <list>; DEAD namespaces <list>
  - attr idiom: <exact string>
  - typescript idiom: <exact string>
  - locales: <list> (in sync? which is short)
- UI libs: <list + focus-management notes>
- Icons: <dominant idiom>
- Forms: <reactive/template>; error component: <path>; CVAs: <paths>
- Dynamic UI: <shared directives, dialog/overlay service, createComponent sites, announcer>
- @angular/cdk: <PRESENT|ABSENT>   sr-only class: <name>
- Commands: type-check `<cmd>` | lint `<cmd>` | targeted lint `<cmd>` | test `<cmd>` | build `<cmd>`
  - BROKEN: <command + reason, if any>

### ASP.NET MVC                   # UI Stack = ASP.NET MVC or Hybrid
- Framework: <ASP.NET Core MVC x on .NET y | ASP.NET MVC 5 on .NET Framework y>; Razor Pages: <yes/no>
- UI project(s): <.csproj path(s)>
- Views: <view roots; layouts; _ViewStart/_ViewImports locations>
- Partials & templates: <shared partials; EditorTemplates/DisplayTemplates>
- View Components: <paths | none>
- Tag Helpers: <built-in in use; custom tag helper classes | none>
- HTML Helpers: <usage level; custom helper extensions | none>
- Localization: <IViewLocalizer/IStringLocalizer/IHtmlLocalizer | strongly-typed .resx class | custom | none>; resources <paths>; cultures <list>
  - attr idiom: <exact string, e.g. aria-label="@Localizer["Close"]">
  - model idiom: <DataAnnotations localization, e.g. [Display(Name=..., ResourceType=...)] | none>
  - js idiom: <how scripts receive localized text | none>
  - Designer.cs regeneration needed for new keys: <yes/no>
- UI libs: <CSS/JS frameworks + versions, widgets, whether each manages focus>
- Icons: <dominant idiom>
- Forms/validation: <DataAnnotations; client validation lib + version; error markup helper; validation summary usage>
- Dynamic UI: <jQuery/vanilla/other; AJAX partial loading mechanism; modal/tab/dropdown implementation>
- Script sources: <where hand-written JS/TS lives; compiled/bundled output paths that must not be edited>
- sr-only class: <name | none>
- View compilation: <build-time | runtime compilation enabled | MVC 5 runtime>
- Commands: build `<cmd>` | test `<cmd>` | JS lint `<cmd>` | targeted JS lint `<cmd>`
  - BROKEN: <command + reason, if any>

## Runtime Profile
- Dev URL: <url> (source: <where found>)            # Hybrid: one line per surface if they differ
- Backend required to boot: <yes/no — details>
- Auth/session: <how routes are gated; can we log in? NO/YES — reuse existing session?>
- Axe source: <repo package name, or CDN injection>
- HMR: <yes/no — does a source edit hot-reload? per surface in Hybrid>

## Runtime Verification
| Route | Last verified | axe (touched rules) | Tab walk | Notes |
|---|---|---|---|---|
| <route> | <date> | clean / <rule ids open> | done / not done | <[Angular]/[MVC] in Hybrid>; <blockers, e.g. permission needed> |

## Established Patterns
- <shared accessibility decisions already implemented and reusable>
- e.g. "Error component exposes `messageId` @Input; fields link via aria-describedby"   (Angular)
- e.g. "Instance-scoped ids via `readonly uid = \`x-${++Cls.next}\``"                 (Angular)
- e.g. "Calendar subtree localizes via CALENDAR_LABELS, not the i18n JSON"             (Angular)
- e.g. "Validation spans carry id `<field-id>-error`; inputs reference it via aria-describedby"   (MVC)
- e.g. "Layout owns the polite live region `#page-status` used by AJAX loaders"                  (MVC)

## Shared Controls Ledger
| Control | Consumers | Status |
|---|---:|---|
| <selector | partial | view component | tag helper | JS module> | <n> | done / partial / pending |

## Batch N — DONE
- Scope: <targets>
- Stack: <Angular | ASP.NET MVC>                 # Hybrid only
- Fixed: <one line per class of fix>
- Shared impact: <controls touched + consumer counts>
- Verification: <gates run + result; what remains unverified>
- Remaining: <deferred items>

## Batch N+1 — PENDING
```

**Update it after every batch.** Future batches reuse `Established Patterns` instead of rediscovering
them, and skip anything already marked DONE.

### Greenfield profiles

A `Project Mode: Greenfield` profile (written by `accessibility-setup`) adds a short common summary right
after the `UI Stack` line, then the usual stack block(s). The summary lines are one-line pointers for
everyday feature work; **the stack block stays authoritative** for idioms and commands, and both are
updated together.

```markdown
- Project Mode: Greenfield
- UI Stack: <...> — evidence: <...>
- Framework/version: <e.g. Angular 20 standalone + signals | ASP.NET Core MVC on .NET 9 | unknown>
- Architecture: <...>
- Localization: <library/mechanism + attribute idiom | unknown>
- Direction: <lang/dir; RTL? runtime switching? | unknown>
- Forms/validation: <Reactive/template-driven | DataAnnotations + client validation lib | unknown>
- Dynamic UI: <dialog/overlay mechanism, CDK, jQuery/vanilla, AJAX | unknown>
- UI libraries: <list | none | unknown>
- Runtime commands: <dev/serve command as documented — never run by setup | unknown>
- Never-touch paths: <paths>
- Baseline: <path to accessibility-baseline.md>
```

Greenfield profiles have no batch sections; feature work is tracked under
`## Accessibility Feature Progress` (format: `greenfield-mode.md`). `Established Patterns`, the Shared
Controls Ledger, the Runtime Profile and the Runtime Verification table are used exactly as above.

---

## Rules

- Discovery is **read-only**: no installs, no config edits, no builds, no restores, no starting the app.
- The **Runtime Profile** and **Runtime Verification** table are written by `accessibility-test`
  and reused by it — it must not rediscover the dev URL, auth model or axe source when they are recorded,
  and must not re-test a route already listed as verified unless a shared control it depends on changed.
- Cite what you read; use `unknown` rather than a plausible guess.
- Record conflicting signals (e.g. a test config pointing at a file that does not exist) — knowing about
  broken tooling prevents a wrong verification claim later.
- **Never redo a batch marked DONE** unless a shared change invalidated it.
- Pass the profile's path — and, in a Hybrid repo, **the stack of each target** — to any subagent that
  needs the localization idiom; agents must not re-discover.
