# Greenfield / Preventive Mode — workflow, not rules

**Audience: the MAIN agent.** This file defines *how work flows* in a project whose Repository Profile says
`Project Mode: Greenfield`. It holds **no accessibility rules** — those stay in the agents, `agent-contract.md`
and the stack adapters (`../stacks/<stack>/idioms.md`). Nothing here changes Remediation behavior.

---

## Project Mode

| Profile line | Meaning | Entry point |
|---|---|---|
| `- Project Mode: Remediation` **or no Project Mode line** | existing UI being audited and fixed in planned batches | `accessibility-plan` |
| `- Project Mode: Greenfield` | new project; accessibility applied while UI is written | `accessibility-setup` (once) |

A missing `Project Mode` line is always **Remediation** — every v1.0.0 / v1.1.0 progress file keeps its
exact behavior.

A Greenfield project carries three project files:

| File | Role | Written by |
|---|---|---|
| `accessibility-baseline.md` | the project-specific preventive standard + Definition of Done | `accessibility-setup` (re-run to refresh) |
| `accessibility-progress.md` | Repository Profile, Established Patterns, Accessibility Feature Progress | setup, then every feature |
| project instructions (`CLAUDE.md`) | managed `accessibility-framework` block that makes the baseline active | `accessibility-setup` only |

There is **no `accessibility-audit-plan.md`** in Greenfield Mode — its absence is normal, never an error.

---

## Declared stack

When setup ran on a repository too new to detect, the profile says e.g.
`- UI Stack: Angular — evidence: declared by user during accessibility-setup (not yet corroborated)`.

- Treat a declared stack as valid. Do not re-ask.
- The **first time** a skill (or feature work) touches real UI files, corroborate it once with
  `stack-detection.md`. Agreement → replace the evidence with the real signals. Contradiction (e.g. declared
  Angular, but `.cshtml` views now render the UI) → stop and ask; never silently switch adapters.

---

## Feature flow (normal development after setup)

The developer asks for a feature ("create the login component", "implement the users table"); nobody has
to mention accessibility.

```
Feature requirement
  → read the project's accessibility instructions (managed CLAUDE.md block)
  → read accessibility-baseline.md
  → read accessibility-progress.md — Repository Profile, Established Patterns, Feature Progress
  → determine the target stack (stack-detection.md, "Resolving the stack for a single target")
  → implement using that stack's idioms and the baseline's project idioms
  → focused review of the new/modified files:
       markup   → accessibility-template   (Greenfield review)
       behavior → accessibility-dynamic    (Greenfield review)
  → main agent resolves the findings
  → runtime verification with accessibility-test when the app is runnable
  → update Established Patterns + Accessibility Feature Progress
```

- **Never rediscover the project per feature.** The profile, baseline and Established Patterns are the
  cache; targeted discovery only for a field the feature needs that is `unknown` or provably stale.
- **No full audit per component.** The focused review covers only the files the feature created or
  modified. Its pre-scan often selects zero or one agent — that is the expected case.
- **Reuse first.** A pattern recorded under Established Patterns or a shared component marked accessible
  is reused, not re-derived and not re-reviewed.
- **Runtime verification is conditional.** Only when the app is runnable and a dev server is already
  running (`accessibility-test` never launches one). Otherwise record `Runtime: pending` for the feature.

### Reusable components

Priority targets in Greenfield Mode — the first implementation sets the pattern every later feature
reuses: button, input, select, checkbox, radio, modal/dialog, dropdown, tabs, accordion, date picker,
table, pagination, alert/notification.

Ownership follows `source-tracing.md` and `agent-contract.md` rule 9:

- **Caller-invariant** accessibility (role, state, keyboard behavior, focus management, `aria-hidden` on
  decorative internals, internal id wiring, label↔control linkage) → **inside** the reusable component.
- **Caller-specific** information (the accessible name, description, error text, heading level when it
  varies by context) → **at the call site**, passed through the stack's input mechanism (Angular
  `@Input()`/signal input; MVC partial model, View Component parameter, Tag Helper property).
- Record the component and its contract under Established Patterns and the Shared Controls Ledger when it
  is first verified.

---

## How the existing skills behave in Greenfield Mode

Each skill checks `Project Mode` in Step 0. Remediation behavior is unchanged; in Greenfield Mode:

| Skill | Greenfield behavior |
|---|---|
| `accessibility-plan` | not the entry point. Reports that the project is in Greenfield Mode and asks before producing a remediation plan; never overwrites the baseline, Feature Progress or managed block |
| `accessibility-template` | **focused review of new/modified markup** for the current feature |
| `accessibility-dynamic` | **focused review of new/modified dynamic behavior** for the current feature |
| `accessibility-test` | **runtime verification** of the feature's routes/interactions |

Common Greenfield deltas for the review skills:

1. Read `accessibility-baseline.md` in Step 0, alongside the profile. Its project idioms and component
   ownership decisions count as Established Patterns.
2. Scope = the files the current feature created or modified (named by the user, or the files the main
   agent just wrote; `git status`/`git diff --name-only` when available). Not the repository, not a batch.
3. For code **created by the current feature**, the additive-only contract rule does not constrain the
   component's own design — the contract is being written now, so ownership (above) decides. Pre-existing
   shared components touched by the feature keep the Remediation rules (blast radius, additive option).
4. Record results under `## Accessibility Feature Progress`, not a batch section.

---

## `## Accessibility Feature Progress` format

Compact, one entry per feature, appended to `accessibility-progress.md`:

```markdown
## Accessibility Feature Progress

### Feature: <name>
- Stack: <Angular | ASP.NET MVC>
- Status: <In progress | Reviewed | Verified | Blocked>
- Scope: <components/views/scripts, routes>
- Reviewed: <Template | Dynamic behavior | Keyboard/focus | Runtime> (only what actually ran)
- Established Patterns: <new reusable decisions, or "reused: <pattern names>">
- Remaining: <runtime pending, open items, or none>
```

Status meanings: `Reviewed` = static focused review done and findings resolved; `Verified` = also
verified at runtime by `accessibility-test`. Never mark `Verified` without a real runtime run.
