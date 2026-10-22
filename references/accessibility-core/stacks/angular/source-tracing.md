# Source tracing — from a live DOM node back to the Angular source

> **OPTIONAL REFERENCE — browser skill only, read on demand.**
> Open this when you must map a live DOM node back to Angular source and the fast path
> (`ng.getOwningComponent(el)` in dev mode) is not enough. Jump to the rung you need.
> Angular surfaces only — the principles shared with every stack live in `../../common/source-tracing.md`.

A runtime scan reports a **DOM node**. You must edit **source**. In Angular that mapping is
indirect: the node was produced by a component template, a directive host binding, a projected
call site, a dynamically created component, or a third-party widget's own DOM — and the fix goes in
a different place in each case.

Getting this wrong is expensive in a specific way: you edit a shared component and change 40 pages,
or you edit one page while the real defect lives in a shared component used 40 times.

Work through the ladder below in order. Stop at the first rung that gives an unambiguous answer.

---

## Rung 1 — Angular's dev-mode debug API (fastest, most reliable)

When the app is served in **development mode**, Angular exposes a global `ng` object. This is the
single best tracing tool available, and it works without Angular DevTools installed.

```js
const el = document.querySelector('<the failing selector from axe>');

({
  // the component that OWNS the template this node was written in  <-- what you want
  owner:      window.ng?.getOwningComponent?.(el)?.constructor?.name,
  // the component whose host element this node IS (null if it is a plain element)
  self:       window.ng?.getComponent?.(el)?.constructor?.name,
  // directives applied to this node — a host binding may be the real author
  directives: (window.ng?.getDirectives?.(el) ?? []).map(d => d.constructor?.name),
  // nearest custom element ancestor, as a cross-check
  hostTag:    el.closest('[class],*') && (function(n){ while(n && !n.tagName.includes('-')) n = n.parentElement; return n?.tagName.toLowerCase(); })(el),
})
```

- **`getOwningComponent(el)`** is the key call: it returns the component whose **template** contains
  this node — i.e. the file you must edit.
- **`getComponent(el)`** returns non-null only when `el` is a component's own host element.
- **`getDirectives(el)`** matters when the offending attribute comes from a directive's
  `@HostBinding`, not from any template.
- Then grep for the class name to get the file:
  `Grep "class <Name>" --glob "**/*.ts"`, and its template via the `templateUrl` in that file.

**Caveats.** `ng` is absent in a production build. Class names may be **minified** — if
`constructor.name` looks like `t` or `e`, fall through to Rung 2. `ng.getOwningComponent` returns
the *nearest* owner, which for projected content is the **call site** — that is usually correct
(see Rung 4).

## Rung 2 — Custom element tag names

Angular renders each component as its selector tag. Walk up from the failing node to the nearest
tag containing a hyphen:

```js
(function(n){ const t=[]; while(n && n !== document.body){ if(n.tagName?.includes('-')) t.push(n.tagName.toLowerCase()); n = n.parentElement; } return t; })(document.querySelector('<selector>'))
```

That gives you the component nesting chain from innermost outward. Map each tag to a file:

```
Grep "selector: 'app-thing'"  --glob "**/*.ts"
```

The **innermost** tag is the component most likely to own the node; the chain tells you the page
context. Use the profile's `selectorPrefix` to recognise app components versus third-party ones
(`mat-*`, `p-*`, `ngb-*` → third party, fix at the call site).

**Caveat:** a component declared with an **attribute selector** (`selector: 'li[appItem]'`) or
`ng-container` renders no tag of its own — nothing to walk to. Fall through to Rung 3.

## Rung 3 — Encapsulation attributes and text-based grep

Angular stamps emulated-encapsulation markers:

- `_nghost-ng-c123456789` — this element **is** a component host.
- `_ngcontent-ng-c123456789` — this element was written **inside** the template of the component
  whose scope id is `123456789`.

The numeric id is build-generated and not greppable in source, **but two nodes sharing an
`_ngcontent-*` id came from the same template** — which lets you group findings and reason about
scope. Combined with Rung 2 (the nearest tag), that is usually decisive.

**Caveat:** with `ViewEncapsulation.None` (common on shared input/table components) these
attributes are absent entirely.

Then grep source for the node itself. In order of reliability:

1. **A distinctive CSS class** from the node → grep templates for it.
2. **A distinctive attribute or binding** — `formControlName="subject"`, `id="…"`, `data-*`.
3. **The visible text — via the translation key, not the text.** The rendered text is a translation
   *value*, so grep the locale JSON/XLF for the value to obtain the **key**, then grep templates for
   the key. This is the most effective trick in a localized Angular repo:
   ```
   Grep "إزالة الكل"            --glob "src/assets/i18n/**"     # value -> key
   Grep "actions.removeAll"     --glob "**/*.html" --glob "**/*.ts"
   ```
   If the text is **not** in any locale file, that is itself a finding: the string is hardcoded, so
   grep the literal directly and expect to find it in a template or a TS ternary.
4. **`ng-reflect-*` attributes** exist in dev mode and name the input that fed the node — useful,
   but do not rely on them (absent in production, and being phased down).

## Rung 4 — Decide *which* file to edit: owner vs call site

You now know the component. That is not yet the same as knowing where the fix goes.

| Situation | Fix goes |
|---|---|
| Node written directly in component X's template | **X's template** |
| Node is **projected** into X via `<ng-content>` | **the call site** — X cannot reach it (see `idioms.md` §6) |
| The attribute comes from a **directive host binding** | **the directive** (it affects every host) |
| Node is inside a **shared** component, and the correct value is identical for all callers | **the shared component** |
| Node is inside a **shared** component, but the correct value differs per caller | **the call sites**, via a new/existing `@Input()` |
| Node is a **third-party** component's internal DOM | **the call site**, via the library's documented input — never `node_modules` |
| Node was created by `createComponent()` / `Renderer2` / `[innerHTML]` | **the TypeScript that creates it** |

## Rung 5 — Blast radius, before you edit anything

Once you have the file, quantify the reach:

```
Grep "<app-thing"        --glob "**/*.html"    -c      # component usages
Grep "appThingDirective" --glob "**/*.html"    -c      # directive usages
```

Then state, in the report:

- **usage count** — how many call sites the edit affects;
- whether the value is **caller-invariant** (safe in the shared component) or **caller-specific**
  (must be an `@Input()`);
- whether other findings in the run collapse into this one fix (they usually do — a shared error
  component, a shared icon button, a shared grid header is often responsible for dozens of
  reported nodes across many routes).

**One shared-component fix that clears 30 nodes is the best outcome available.** Look for it before
proposing 30 per-page patches. This is also what makes the cross-route ledger effective: after the
shared fix, later routes go quiet.

---

## Reverse direction — confirm a fix reached the DOM

Stack-independent: see `../../common/source-tracing.md` § "Reverse direction". With `ng serve`, the
dev-server rebuild after a source edit is what you verify against.

---

## Pitfalls that waste the most time

- **Not all DOM is Angular's.** Third-party maps, charts, editors, and grids build their own nodes;
  a portal/overlay renders at `document.body`, far from its logical parent. Confirm ownership before
  hunting for a template that does not exist.
- **Conditional and repeated content.** A node inside `@if`/`*ngIf` exists only in one state, and
  ids inside `@for`/`*ngFor` repeat unless built from the iteration key. Duplicate ids silently
  break every `aria-*` reference to them — check for that specifically.
- **Production builds erase your tools.** No `ng` global, minified class names, no `ng-reflect-*`.
  Trace against a **dev** server.
- **The same visible text in ten places.** Grepping text finds all ten; use the surrounding class,
  the `formControlName`, or the component chain to pick the right one.
- **The node you were given may not be the node to fix.** An axe `button-name` failure on an inner
  `<span>` is usually fixed on the enclosing control; a `list` failure on `<ul>` is usually fixed on
  the child component's selector. Fix the cause, not the reported line.
