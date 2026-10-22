# The five accessibility areas — ownership map

Scope for every `accessibility-*` skill is **these five areas, not a full WCAG audit** — on every supported
UI stack (Angular, ASP.NET MVC / Razor, Hybrid). The areas are stack-independent; how a fix is written is
not (`../stacks/<stack>/idioms.md`).

**The detection and fix rules for each area now live inside that area's agent definition**
(`${CLAUDE_PLUGIN_ROOT}/agents/accessibility-*.md`), so an agent loads only its own rules. This file keeps
only what is genuinely cross-cutting: who owns what, and the supersession rule.

The three principles, the hard safety rules, and the global out-of-scope list live in
`agent-contract.md` ("Cross-cutting rules") — the single copy.

---

## Ownership matrix

Overlap on one **element** is normal (an `<input>` can need §1 + §3 + §5). Overlap on one **attribute**
is a bug in the audit.

| Concern | Owner | Not |
|---|---|---|
| A form field's accessible **name** (`label`/`for`, `aria-label`/`aria-labelledby` as name) | **§1 labels** | §3 |
| A control group's name text (`<legend>` content) | **§1** | §4 |
| `alt`, icon text alternatives, `aria-hidden` on **decorative graphics** | **§2 alt** | §3 |
| Accessible name of a control whose only content is an icon | **§2** (paired: name on control, `aria-hidden` on icon) | §1, §3 |
| `role` on custom widgets; ARIA **state** (`aria-expanded`, `aria-selected`, `aria-current`, `aria-sort`, `aria-pressed`) | **§3 aria** | — |
| Validation ARIA (`aria-invalid`, `aria-describedby`→error, `aria-required`), `role="alert"`, `aria-live` | **§3** | §1 |
| Removing redundant/invalid ARIA; fixing broken id references | **§3** | — |
| Choice of **element** (`<button>`, `<fieldset>`, `<ul>`, `<table>`, `<nav>`) | **§4 semantics** | §3 |
| Landmarks, heading order, table `scope`/`caption`, `lang`/`dir` | **§4** | — |
| Wrappers breaking required parent/child relationships (Angular component hosts; MVC partial/helper wrapper markup) | **§4** | — |
| `tabindex`, focus order, key handlers, focus traps, roving tabindex, focus restore | **§5 keyboard** | §3 |
| Focus-visible indicators, contrast, any CSS | **nobody — report it** | all |

## The one supersession rule

When **§4** replaces a fake control with a native element, **§3's `role` and §5's `tabindex` + key
handlers become redundant and must be dropped.** §4 flags it; the main agent enforces it during merge.
