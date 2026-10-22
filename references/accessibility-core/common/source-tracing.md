# Source tracing — common principles (browser skill only)

> **OPTIONAL REFERENCE — `accessibility-test` only, read on demand.** This file holds what is identical
> for every stack. The tracing ladder itself is stack-specific:
>
> - Angular → `../stacks/angular/source-tracing.md`
> - ASP.NET MVC / Razor → `../stacks/mvc-dotnet/source-tracing.md`

A runtime scan reports a **DOM node**. You must edit **source**. The rule that governs every stack:

**Fix the source that generates the defect, not merely the DOM node where the defect appears.**

Getting this wrong is expensive in a specific way: you edit a shared generator and change 40 pages, or you
edit one page while the real defect lives in a shared generator used 40 times. Always quantify the reach
(usage count, caller-invariant vs caller-specific) before editing, and look for the one shared fix that
clears many reported nodes before proposing per-page patches.

---

## Choosing the ladder for a finding

| Repository Profile | Ladder |
|---|---|
| `UI Stack: Angular` | Angular |
| `UI Stack: ASP.NET MVC` | MVC/Razor |
| `UI Stack: Hybrid` | **per finding**, from the live node: inside an Angular root (an ancestor carrying `ng-version`, or the node carries `_ngcontent-*`/`_nghost-*` attributes, or `window.ng?.getOwningComponent?.(el)` returns a component in dev mode) → **Angular**; otherwise, and for a Razor layout wrapped *around* the Angular root → **MVC/Razor**. When the node sits on the boundary, trace both and say which owns the attribute. |

```js
// Hybrid: which surface owns this node?
const el = document.querySelector('<selector>');
({ angularRoot: !!el.closest('[ng-version]'),
   ngScoped:    [...el.attributes].some(a => a.name.startsWith('_ng')),
   ngOwner:     window.ng?.getOwningComponent?.(el)?.constructor?.name ?? null })
```

---

## Reverse direction — confirm a fix reached the DOM

After applying an edit and letting the app rebuild/reload, verify the attribute is actually on the live
node rather than trusting the diff:

```js
const el = document.querySelector('<selector>');
({ outer: el.outerHTML.slice(0, 200),
   name:  el.getAttribute('aria-label') ?? el.getAttribute('alt'),
   role:  el.getAttribute('role'), tabindex: el.getAttribute('tabindex') })
```

Check three things, not one:

1. the attribute is **present** on the real node;
2. its value is **localized** — actual translated text, not a raw key like `actions.close` (a raw key
   means the localization idiom was wrong or the key is missing from that locale). Check a non-default
   locale too: some localizers fall back to the key itself, which can look correct in the default language;
3. no **duplicate or conflicting** name (an element with both `aria-label` and `aria-labelledby`
   announces only one — usually not the one you intended).

If the attribute is absent, the served output is stale or the fix went into the wrong source — see the
stack ladder's pitfalls before editing again.
