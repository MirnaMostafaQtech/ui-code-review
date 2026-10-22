# Angular idioms — how to express an accessibility fix

> **OPTIONAL REFERENCE — do not read by default.**
> The agents and skills carry the idioms they need inline (`[attr.aria-*]` not `[aria-*]`, bind `null`
> to omit, host metadata over imperative DOM writes, the localization attribute idiom from the project
> profile). Open this file **only** when you hit an Angular pattern you cannot express confidently —
> content projection, host-wrapper breaks, dynamic components, CVA plumbing, signals/OnPush staleness.
> Jump to the one section you need; never read it end-to-end.
> Angular targets only — for Razor/MVC targets use `../mvc-dotnet/idioms.md`.

The five areas in `../../common/accessibility-areas.md` say **what** to fix. This file says **how to write it in
Angular** without breaking bindings, change detection, SSR, or localization.

Read this before proposing any edit. Most bad Angular accessibility patches are not wrong about
accessibility — they are wrong about Angular.

---

## 1. The five ways to put an attribute on an element

| Form | When | Example |
|---|---|---|
| **Static attribute** | value never changes and is not user-visible text | `role="button"` `scope="col"` `alt=""` |
| **Interpolation** | value is user-visible text from a translation | `placeholder="{{ 'form.name' \| translate }}"` |
| **`[attr.*]` binding** | value is dynamic, or must be *removable* | `[attr.aria-expanded]="isOpen"` |
| **Host metadata / `@HostBinding`** | the element is a component's or directive's own host | `host: { '[attr.aria-pressed]': 'active()' }` |
| **`Renderer2.setAttribute`** | a directive must touch an element it queried, not its host | `this.r.setAttribute(el, 'aria-hidden', 'true')` |

### The rule that breaks most patches: use `[attr.aria-*]`, never `[aria-*]`

ARIA attributes are **attributes**, not DOM properties. `[aria-label]="x"` fails to compile with
*"Can't bind to 'aria-label' since it isn't a known property of ..."*. Always:

```html
<!-- WRONG — will not compile -->
<button [aria-label]="label">
<!-- RIGHT -->
<button [attr.aria-label]="label">
```

The same applies to `role` when bound (`[attr.role]`), and to `tabindex` when bound —
`[attr.tabindex]` is the safe form (`[tabIndex]` exists as a property but the attribute form is
consistent with the rest of your ARIA and works everywhere).

### Removing an attribute: bind to `null`

`[attr.x]="false"` renders `x="false"` — which for `aria-hidden` means *"explicitly not hidden"*
and for `aria-describedby` means a **broken reference to the empty string**. To omit an attribute,
bind `null`:

```html
<!-- describedby only when an error is actually rendered -->
<input [attr.aria-describedby]="control.invalid && control.touched ? 'name-error' : null">
<!-- aria-hidden only when truly decorative -->
<img [attr.aria-hidden]="isDecorative ? 'true' : null">
```

Note the asymmetry: `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`, and
`aria-invalid` are **tri-state and meaningful when false** — bind the boolean directly
(`[attr.aria-expanded]="isOpen"` correctly renders `"false"` when closed). `aria-hidden`,
`aria-describedby`, `aria-labelledby`, `aria-controls`, and `aria-current` should be **absent**
rather than false/empty — use the `: null` form.

---

## 2. Localization inside attributes

Take the exact idiom from the repo profile (`templateAttr`). The three common shapes:

```html
<!-- ngx-translate / Transloco: pipe inside an [attr.*] binding -->
<button [attr.aria-label]="'actions.close' | translate">
<!-- ...or interpolation for plain attributes -->
<input placeholder="{{ 'form.search' | translate }}">

<!-- Angular built-in i18n: the i18n-<attr> prefix is MANDATORY -->
<button i18n-aria-label="@@actions.close" aria-label="Close">
```

Rules:

- **A static `aria-label="Close"` is a localization bug**, even in an English-first repo, whenever
  the repo has a translation mechanism. It is one of the most common real findings.
- A **bound but untranslated** value is the same bug wearing a binding:
  `[attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"` and
  `[attr.aria-label]="lang === 'ar' ? 'إزالة الكل' : 'Remove all'"` are both hardcoded. Route them
  through the translation mechanism and let it pick the locale — never hand-roll a language ternary.
- `alt=""` on a decorative image is **not** text and must **not** be translated.
- ARIA *state* values (`true`, `false`, `page`, `ascending`) are **not** translated.
- In TypeScript, use the profile's `typescript` idiom. `TranslateService.instant()` only works after
  translations have loaded — for a value read during construction, prefer a template binding or the
  observable form.

---

## 3. Component and directive hosts

Two equivalent styles; **match the file you are editing**.

```ts
// decorator metadata style
@Component({
  selector: 'app-toggle',
  host: {
    'role': 'button',
    '[attr.aria-expanded]': 'isOpen()',
    '[attr.aria-controls]': 'panelId',
    '[class.is-open]': 'isOpen()',
    '(keydown.enter)': 'toggle($event)',
    '(keydown.space)': 'toggle($event)',
  },
})

// decorator-on-member style
@HostBinding('attr.aria-expanded') get expanded() { return this.isOpen; }
@HostListener('keydown.escape', ['$event']) onEsc(e: KeyboardEvent) { this.close(); }
```

Notes:

- `host` metadata and `@HostBinding` on the **same** attribute conflict — pick one per attribute.
- Prefer host bindings over `ElementRef.nativeElement.setAttribute` — they are declarative, they
  update with change detection, and they are SSR-safe.
- A **directive** is the right tool when several unrelated elements need the same accessibility behavior
  (this is the Angular-native replacement for copy-pasting attributes across templates).
- **`host: { style: 'display: contents' }`** is a legitimate trick for making a component host
  transparent so it does not break a required parent/child relationship (see §5 below), but
  understand it before proposing it: it removes the host's box, so any styling, layout, or
  `position` on that host stops working.

---

## 4. Angular key-event bindings — why keyboard fixes are cheap here

This is a genuine advantage over server-rendered stacks: keyboard operability is a **template
binding**, not a separate script file. Angular parses key names for you:

```html
<div role="button" tabindex="0"
     (click)="activate()"
     (keydown.enter)="activate()"
     (keydown.space)="activate(); $event.preventDefault()">
```

- **Space must `preventDefault()`** or the page scrolls.
- `(keydown.escape)`, `(keydown.arrowdown)`, `(keydown.shift.tab)`, `(keydown.control.enter)` all
  work. Prefer `keydown` over `keyup` for activation (matches native behavior and beats the
  browser's default action).
- A key handler must call the **same method** the existing `(click)` calls. If it needs different
  logic, that is a behavior change, not an accessibility fix.
- **Before adding key handlers, ask whether a native `<button>` is the real answer.** A `<button>`
  gets focusability, Enter, Space, and the role for free. Bolting three attributes onto a `<div>`
  is the fallback, not the goal.

---

## 5. The component-host wrapper trap (Angular-specific, and it breaks real semantics)

Angular inserts the component's host element into the DOM. When a relationship requires specific
parent/child elements, a host element in between **silently destroys it**:

```html
<!-- The rendered DOM is <ul><app-item><li>…</li></app-item></ul> — no longer a valid list -->
<ul>
  <app-item *ngFor="let i of items"></app-item>
</ul>
```

This is why `list`, `listitem`, `table`, `th-has-data-cells`, and `definition-list` axe rules fail
in Angular codebases for no visible reason. It hits `<ul>/<li>`, `<ol>/<li>`,
`<table>/<thead>/<tr>/<td>`, `<dl>/<dt>/<dd>`, and `<select>/<option>`.

Three fixes, in order of preference:

1. **Attribute selector on the component** — the component *becomes* the required element:
   ```ts
   @Component({ selector: 'li[appItem]', ... })   // used as <li appItem>
   ```
2. **`display: contents` on the host** — removes the wrapper's box so the relationship is restored
   in modern browsers. Cheap and non-invasive, but it disables layout/styling on that host.
3. **Move the loop inside the child** or project with `<ng-container>` — a structural refactor.

Options 1 and 3 change component contracts, so they are **usually a report, not a drive-by fix**.
Option 2 is often acceptable. Always say which you chose and why.

---

## 6. Content projection — you cannot fix what you do not own

You cannot add an attribute to projected content from inside the receiving component:

```html
<!-- inside app-card: you cannot reach into whatever the caller passed -->
<div class="card"><ng-content></ng-content></div>
```

If the accessibility problem is in the projected markup, **the fix belongs at the call site**. If
the *container* needs an accessible name that varies per caller, the component needs an `@Input()`.
State this explicitly rather than patching the wrong file.

---

## 7. Custom form controls (`ControlValueAccessor`)

An accessible name must reach the **inner native control**. Putting `aria-label` on the component
host names nothing, because `<app-my-input>` has no role:

```html
<!-- USELESS: the host is not the input -->
<app-my-input aria-label="Full name" formControlName="name">
```

Correct approaches:

- Thread it through an `@Input()` the component applies to its inner input:
  ```ts
  @Input() label?: string;        @Input() inputId?: string;
  ```
  ```html
  <input [id]="inputId" [attr.aria-label]="label" ...>
  ```
- Or expose an `@Input() ariaLabelledBy` and bind `[attr.aria-labelledby]` on the inner input to an
  external visible label's id.
- For a **third-party** custom control, use its documented input (`ariaLabel`, `inputId`,
  `ariaLabelledBy`) — read the library's API, do not guess, and never patch `node_modules`.

Also: with `ViewEncapsulation.None`, `id` collisions across instances become possible — if you
introduce an `id`, make it unique per instance (a counter, `crypto.randomUUID()`, or an
`@Input() inputId` the caller supplies).

---

## 8. Reactive Forms → ARIA (the highest-leverage Angular pattern)

Because form state is available in the template, the validation linkage that server-rendered
stacks must defer to JavaScript is **fully expressible here**:

```html
<label for="subject">{{ 'form.subject' | translate }}</label>

<input id="subject" formControlName="subject"
       [attr.aria-required]="true"
       [attr.aria-invalid]="isInvalid(subject) ? 'true' : null"
       [attr.aria-describedby]="isInvalid(subject) ? 'subject-error' : null">

<div id="subject-error" role="alert" *ngIf="isInvalid(subject)">
  {{ 'form.subject.required' | translate }}
</div>
```

- `isInvalid(c)` is normally `c.invalid && (c.touched || c.dirty)` — announcing an error before the
  user has touched the field is its own accessibility problem.
- **`Validators.required` does not emit a `required` attribute.** Add `required` or
  `[attr.aria-required]="true"` explicitly.
- `role="alert"` on the error container makes the message announced when it appears. It works
  because the container is created by `@if`/`*ngIf` — an alert that is always in the DOM and merely
  hidden will not announce.
- The error element's `id` must be **unique per field and per row** — inside `@for`, build it from
  the iteration key: `[attr.id]="'subject-error-' + item.id"`, and bind the `aria-describedby` the
  same way.
- **If the repo has a shared error-message component, fix it there.** One edit gives every form
  field in the app announced errors. That is the single highest-value accessibility change in most Angular
  repos — and it is a shared component, so check and state the usage count.

For **template-driven** forms the same applies via the control's exported directive:
`#name="ngModel"` then `[attr.aria-invalid]="name.invalid && name.touched ? 'true' : null"`.

---

## 9. Signals, getters, and change detection

- Binding `[attr.aria-*]` to a **signal** (`[attr.aria-expanded]="isOpen()"`) or a `computed()` is
  ideal — correct with `OnPush` and zoneless.
- Binding to a **getter** works but runs every change-detection cycle; keep it a trivial derived
  value, never a computation or an array/object allocation.
- With `OnPush`, an ARIA value driven by a field mutated outside Angular's awareness will go
  stale. If you find that, the fix is a signal or a `markForCheck()` — and if that is more than
  trivial, report it.
- Never call `TranslateService.instant()` inside a getter bound in a template — it re-runs
  constantly. Use the pipe.

---

## 10. Dynamic DOM and dynamic components

- **`ViewContainerRef.createComponent()`** → set accessibility inputs with
  `ref.setInput('ariaLabel', …)`, or reach the host via `ref.location.nativeElement` and use
  `Renderer2`. Prefer inputs.
- **`Renderer2`** over `nativeElement` for any direct DOM work — it is the SSR-safe path:
  ```ts
  this.renderer.setAttribute(el, 'aria-hidden', 'true');
  this.renderer.removeAttribute(el, 'aria-describedby');
  ```
- **Never introduce `[innerHTML]`** to solve an accessibility problem. If existing markup uses it,
  attributes inside that HTML string are sanitizer-dependent and easy to get wrong — prefer moving
  the element into the template. If the repo sanitizes with `DomSanitizer`/DOMPurify, note that
  `bypassSecurityTrustHtml` is a security decision that is not yours to make.
- **Third-party widgets that build their own DOM** (grids, maps, editors): configure accessibility through
  the library's options, or attach attributes after render via the library's own lifecycle hook —
  never by patching the vendor bundle.

---

## 11. Focus and announcements

- **`@angular/cdk/a11y` is the standard toolkit** — `cdkTrapFocus` / `FocusTrapFactory`,
  `FocusMonitor`, `FocusKeyManager` / `ListKeyManager` (roving tabindex), `LiveAnnouncer`
  (`aria-live` announcements), `A11yModule`.
- **Check the profile first: if `@angular/cdk` is not already a dependency, do not add it.** Report
  the gap. A hand-rolled focus trap is a reliability and maintenance hazard, and adding a
  dependency is the user's decision, not yours.
- If the UI library already manages focus for dialogs and overlays (Material, PrimeNG, CDK
  Overlay), **do not add a second trap** — competing focus management is worse than none. Verify by
  reading the library usage, then confirm with a real Tab walk.
- SPA route changes do **not** move focus. The fix belongs in the shell (a router-events
  subscription that focuses the main region or heading after navigation) — a behavioral change, so
  propose it only when the invoking skill's scope allows it.

---

## 12. Things never to do

- Never bind `[aria-*]` (use `[attr.aria-*]`).
- Never use a **positive `tabindex`**.
- Never hardcode user-visible text, in a template or in TypeScript, including inside a ternary.
- Never add `role` to an element that already has that semantic (`role="button"` on `<button>`).
- Never leave an `aria-*` reference pointing at an id that may not exist.
- Never mix `@if`/`@for` with `*ngIf`/`*ngFor` in the same template.
- Never edit `node_modules`, `dist`, `.angular`, generated clients, or committed vendor bundles.
- Never add a dependency, change a lint config, or reformat a file as part of an accessibility fix.
- Never remove an existing binding, directive, `id`, `#ref`, or CSS class to make room for an
  attribute.
