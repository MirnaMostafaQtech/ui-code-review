# Angular rules (NG-xx)

**Status: draft for team-lead review.**

Every rule names its source:
- **`angular.json: ng-*`** — the deterministic company checklist in q-ai-quality-review
  (`config/checklist/technology/angular.json`).
- **`javascript.json: js-*`** — the same checklist's JavaScript rules (`config/checklist/technology/javascript.json`).
- **`QC → <section>`** — the Angular guidance in q-ai-quality-review's
  `claude/_shared/quality-conventions.md`: the `angular` family note (Components, Templates, RxJS, State
  Management, HTTP, ...) or a Company Checklist category (JavaScript and Frontend, Resource Management).
- **Team rule** — not in either source; needs the team lead's approval before it is enforced.

## How the reviewer uses this file

- **Scope:** only lines in `changedLines`. A rule about a whole class (NG-12) is checked only when
  the class is new in this change.
- **Files:** Angular files only: `*.component.html`, `*.component.ts`, `*.directive.ts`, `*.pipe.ts`,
  `*.service.ts` and other `.ts` under an Angular app. Not `.cshtml` or MVC scripts.
- **Severity:** Error = a bug, leak or security risk. Warning = performance or maintainability
  problem. Info = recommended, not required.
- **Know the Angular version** (from `package.json` if it is available). Rules marked *v17+* apply only
  when the project is on Angular 17 or later.
- **Report only what you can show.** If a rule depends on something outside the changed lines (for
  example, whether a subscription is cleaned up in `ngOnDestroy`), read the rest of the file before
  reporting.

## Templates

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-01 | Info | `angular.json: ng-prefer-new-control-flow` | *v17+*: new template code uses `@if` / `@for` / `@switch`, not `*ngIf` / `*ngFor` / `[ngSwitch]`. | Use the built-in control flow. |
| NG-02 | Warning | `angular.json: ng-missing-trackby` | `@for` has a meaningful `track` (an id, not `$index` for lists that change); `*ngFor` has `trackBy`. | `track item.id` / add a `trackBy` function. |
| NG-03 | Warning | `angular.json: ng-function-call-in-template` | No method calls in bindings or interpolation (`{{ getName() }}`, `[x]="calc()"`). **Not a violation:** reading a signal (`count()`, `form.value()`), a pure pipe, an event binding `(click)="save()"`. | Use a pure pipe, a `computed()` signal or a precomputed field. |
| NG-13 | Info | QC → Templates | Logic that belongs in the component or a service is not in the template (chained ternaries, long conditions, data shaping). A component that subscribes manually only to render a value uses the `async` pipe instead. | Move the logic to the component / a `computed()`; render with `async`. |
| NG-14 | Warning | Team rule | No inline `style="..."` or `[style.x]` for static values in templates. Dynamic values bound to state are allowed. | Use an AXIS class (see `axis.md`). |
| NG-15 | Warning | QC → Resource Management; QC → JavaScript and Frontend (magic strings) | No hard-coded user-visible text in templates or TS (labels, messages, `title`, `placeholder`): it comes from the project's resource / translation files. | Use the translation pipe / resource key. |

## Components, RxJS and state

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-09 | Error | QC → RxJS; QC → Components | Every manual `.subscribe()` in a component, directive or pipe is unsubscribed: `takeUntil`, `takeUntilDestroyed`, or the `async` pipe. | Add `takeUntilDestroyed(this.destroyRef)` or render with `async`. |
| NG-10 | Warning | QC → RxJS | No `subscribe` inside another subscribe's callback. | Use `switchMap` / `mergeMap` / `concatMap`. |
| NG-12 | Info | QC → Components | `ChangeDetectionStrategy.OnPush` is used where it fits, for performance. Recommended, not required. When OnPush is used, `@Input` updates replace the object reference instead of mutating it (mutation silently defeats OnPush). | Consider `OnPush`; pass new references to inputs. |
| NG-16 | Error | QC → Components (timers); QC → JavaScript and Frontend (event handler cleanup) | Every timer (`setInterval`, `setTimeout` that can outlive the component) and every listener added with `addEventListener` / `fromEvent` is cleaned up when the component is destroyed. | Clear it in `ngOnDestroy` / `DestroyRef.onDestroy`, or use `@HostListener`. |
| NG-19 | Info | QC → State Management | Simple local state uses `signal()` rather than a `BehaviorSubject`. If NgRx is used, actions / reducers / effects are separate and state is never mutated directly. | Use `signal()`; keep NgRx state immutable. |

## DOM and logging

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-11 | Warning | QC → Angular family note (direct DOM manipulation, "flag on sight"); QC → JavaScript and Frontend | No direct DOM manipulation that bypasses Angular: `document.querySelector`, `getElementById`, writing to `ElementRef.nativeElement` (style, classList, innerHTML). | Use template bindings, `viewChild()`, or `Renderer2`. |
| NG-18 | Warning | `javascript.json: js-no-console-log` | No `console.log` left in the change. | Remove it, or use the project's logger. |

## TypeScript and configuration

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-04 | Warning | `angular.json: ng-avoid-any-type` | No `any` type annotation. | Use an interface or `unknown`. |
| NG-05 | Error | `angular.json: ng-tsconfig-strict-disabled` | `tsconfig` does not turn off `strict` or its sub-flags. | Keep strict on; fix the type errors. |
| NG-08 | Warning | `angular.json: ng-eslint-disable-comment` | No `eslint-disable` comments without a reason on the same line. | Fix the lint issue, or add the reason. |

## Security

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-06 | Error | `angular.json: ng-innerhtml-direct-assignment` | No direct `innerHTML` / `outerHTML` assignment in TS. | Bind `[innerHTML]` (sanitized) or use text bindings. |
| NG-07 | Error | `angular.json: ng-bypass-security-trust` | No `bypassSecurityTrust*` unless the value is proven safe; the reason is written in a comment. | Remove it, or sanitize the value first. |

## Project structure, forms and routing

| ID | Severity | Source | Check | Fix |
|---|---|---|---|---|
| NG-20 | Info | QC → Project Structure | A **new** component, directive or pipe is standalone, not added to an NgModule (when the project's Angular version supports it). | Mark it standalone and import what it uses. |
| NG-21 | Info | QC → Project Structure | **New** files go in their feature's folder, not in folders grouped by file type (`components/`, `services/`). | Move the file into the feature folder. |
| NG-22 | Info | QC → Forms | A **new** form uses Reactive Forms rather than template-driven forms (`ngModel`). | Use `FormGroup` / `FormControl`. |
| NG-23 | Warning | QC → Forms | A form has client-side validation (`Validators` or custom validators) and shows the errors to the user. A reactive form with no validation at all is flagged. | Add validators and visible error messages. |
| NG-24 | Info | QC → Routing | A large feature is lazy-loaded with `loadComponent` / `loadChildren`, not imported eagerly into the root routes. | Lazy-load the feature route. |
| NG-28 | Info | QC → Components (naming) | File names are kebab-case with their type suffix (`user-card.component.ts`); classes are PascalCase and end in their type (`UserCardComponent`). | Rename the file / class. |
| NG-29 | Info | QC → Naming Conventions (markup ids) | An element `id` in a template is specific to its component, not generic (`container`, `btn`, `content`) that can collide with another element. | Use a specific id, or an instance-scoped one. |

## Not here

- Class names and SCSS: `axis.md` (including R-03 for `[class.x]` / `[ngClass]` / `classList`).
- Accessibility: `a11y.md` (the bundled accessibility agents).
- Back-end and data-layer concerns are out of scope for the UI review. NG-17 (HTTP error handling /
  interceptors), NG-25 (route guards / authorization), NG-26 (shared state in root services) and
  NG-27 (token storage) were removed; their IDs are not reused.
