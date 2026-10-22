# Components Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Components** segment contains self-contained, reusable UI components. Each component is self-contained and follows BEM methodology for naming conventions.

| #  | Section                                                    | What it covers                             |
|----|------------------------------------------------------------|--------------------------------------------|
| 1  | [Purpose](#purpose)                                        | What the segment is for                    |
| 2  | [File Structure](#file-structure)                          | The folder tree and what each file holds   |
| 3  | [Naming Conventions](#naming-conventions)                  | The `c-` prefix, and BEM without modifiers |
| 4  | [Component Structure](#component-structure)                | Base, elements and state                   |
| 5  | [Responsive Design](#responsive-design)                    | Breakpoints inside a component             |
| 6  | [Design System Integration](#design-system-integration)    | The tokens a component reads               |
| 7  | [A component, worked through](#a-component-worked-through) | One component from markup to CSS           |
| 8  | [Best Practices](#best-practices)                          | How to author one                          |
| 9  | [Rules](#rules)                                            | What a review rejects                      |
| 10 | [Related Files](#related-files)                            | The segments this one works with           |

---

## Purpose

The Components segment provides:

| Aspect          | Description                                         |
|-----------------|-----------------------------------------------------|
| Reusability     | Self-contained components that can be used anywhere |
| Consistency     | Standardized component behavior and appearance      |
| Maintainability | Isolated component styles for easy updates          |
| Scalability     | Modular approach for building complex interfaces    |

[↑ Back to top](#components-segment-documentation)

## File Structure

```
components/
├── _<component-name>.component.scss
├── ...
└── ...
```

Component files use the `.component.scss` suffix: `_<component-name>.component.scss`. What a project puts here is its own — a project holds whatever components its interface needs, named after what they are. One ordinary example, illustrative only:

```
components/
└── _button.component.scss
```

[↑ Back to top](#components-segment-documentation)

## Naming Conventions

### Class Prefix
- **MUST** use `c-` prefix for all component classes
- Example: `_button.component.scss` → `.c-button`

### BEM Methodology
Use BEM (Block, Element) for component naming. `is-*`/`has-*` are SMACSS state prefixes, not BEM modifiers; the block-and-element pattern, with the state prefixes chained onto it, is shown in [Naming Conventions](../guides/naming-conventions.md).

[↑ Back to top](#components-segment-documentation)

## Component Structure

### Base Component
```scss
@charset "UTF-8";

.c-component-name {
  // Base styles
  // Layout
  // Typography
  // Colors
  // Spacing
}
```

### Elements
```scss
@charset "UTF-8";

.c-component-name {
  &__element {
    // Element-specific styles
  }

  &__another-element {
    // Another element styles
  }
}
```

### State
A state fixed when the page is built uses the SMACSS `is-*`/`has-*` prefixes; a state JavaScript changes at runtime uses `js-*` — see [Rules](../guides/rules.md). All three are chained onto the block or element with `&`. True CSS pseudo-classes express interaction state directly, with no class needed. `:hover` is guarded by a hover media query, so a touch device does not hold the hover state after a tap; whatever it shows, `:focus-visible` shows too, so keyboard users see it — see [Accessibility](../guides/accessibility.md).
```scss
@charset "UTF-8";

.c-component-name {
  @media (hover: hover) {
    &:hover {
      // Hover state
    }
  }

  &:focus-visible {
    // Hover state, repeated here so keyboard users see it too
  }

  &.js-active {
    // Active state, added by a script
  }

  &.js-disabled {
    // Disabled state, added by a script
  }

  &.is-current {
    // First-load state, written into the markup and never changed
  }

  &.has-icon {
    // Presence state, written into the markup and never changed
  }
}
```

A disabled state may be expressed either way — the native `disabled` attribute, styled through `:disabled`, or `js-disabled` when a script toggles it; either is correct.

[↑ Back to top](#components-segment-documentation)

## Responsive Design

A component is authored for the narrow viewport first, then adjusted upward. The block below uses a plain `@media` query, which every project has. A project that ships its own media-query mixin may use that instead — the breakpoints it reads, and the mixin itself, belong to the project, not to this standard. A value that scales continuously needs no breakpoint at all; `clamp()` covers that case.

```scss
@charset "UTF-8";

.c-component {
  // Base styles, narrow viewport first
  inline-size: 100%;
  padding: 1rem;

  @media (width >= 48rem) { // 768px
    inline-size: 50%;
    padding: 1.25rem;
  }
}
```

[↑ Back to top](#components-segment-documentation)

## Design System Integration

The token names below — `--primary-500`, `--neutral-25`, `--ff`, `--fs-sm` and the rest — are **illustrative only**. They show that a component reads its colors and type from custom properties rather than hard-coding values; the names themselves belong to the project, and where they are defined is in the [Theme segment](./theme.md).

```scss
@charset "UTF-8";

.c-component {
  background-color: var(--primary-500);
  color: var(--neutral-25);

  font-family: var(--ff);
  font-size: var(--fs-sm);

  padding: 1rem;
}
```

Colors and type come from custom properties defined in the Theme segment. Nothing else about the component depends on where those values live.

[↑ Back to top](#components-segment-documentation)

## A component worked through

One component a project is likely to have, **illustrative only** — a project holds whatever its interface needs, and names them itself. What it shows is the shape: a `c-`-prefixed block, its BEM elements, and state and variant classes rather than modifiers.

### Button component

**Features a button component (`_button.component.scss`) might carry:**
- Size and style variations, as project-named variant classes rather than BEM modifiers
- Icon support
- Disabled states
- Responsive design

The specific variations — how many sizes, which styles, what they are called — are the project's own. What the standard fixes is the `c-` prefix, the `.component.scss` suffix, and that no variation uses `--modifier`. How variants are named is the project's own; `<variant-class>` below stands for one, and it carries a prefix the project chooses (R-01).

**Usage:**
```html
<button class="c-button <variant-class>">
  <span class="c-button__icon" aria-hidden="true"><!-- icon --></span>
  Send Email
</button>

<button class="c-button <variant-class>" disabled>
  Cancel
</button>
```

The complete component, with its responsive rules and the reasoning for why it is shared rather than page-local, is in the [Worked Example](../guides/walkthrough.md).

[↑ Back to top](#components-segment-documentation)

## Best Practices

| # | Principle          | Guidelines                                                                                                                                              |
|---|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Self-contained** | A component is independent: it does not depend on another component, and it is composed rather than inherited from                                      |
| 2 | **BEM naming**     | Descriptive block names, semantic element names, and state prefixes rather than BEM `--` modifiers — which prefix applies is in the State section above |
| 3 | **Responsive**     | Flexible units, and tested across the breakpoints the project defines                                                                                   |
| 4 | **Accessible**     | ARIA attributes where they are needed, keyboard navigation — see [Markup](../guides/accessibility.md#markup) — and color contrast maintained            |
| 5 | **Efficient**      | Efficient selectors and properties, and no more CSS output than the component needs                                                                     |

[↑ Back to top](#components-segment-documentation)

## Rules

| # | ID       | Rule                | Description                                                                                                                                             | Priority |
|---|----------|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-COMP-1 | **c- Prefix**       | All component classes must use the `c-` prefix                                                                                                          | Critical |
| 2 | R-COMP-2 | **BEM Methodology** | See [R-04](../guides/rules.md#naming-and-structure)                                                                                                     | High     |
| 3 | R-COMP-3 | **Self-Contained**  | A component file styles only its own `c-` block; it never styles another component's classes                                                            | Critical |
| 4 | R-COMP-4 | **Responsive**      | Renders with no horizontal overflow from 320 CSS px up, and is checked at every breakpoint key the project defines                                       | Critical |
| 5 | R-COMP-5 | **Accessible**      | Meets the rules in [Accessibility](../guides/accessibility.md)                                                                                          | Medium   |
| 6 | R-COMP-6 | **Never Moves**     | Every component file stays in `components/`. Sharing changes only which file `@use`s it — see the placement rule in [Common Documentation](./common.md) | Critical |

[↑ Back to top](#components-segment-documentation)

## Related Files

| Segment                       | Usage                                                                       |
|-------------------------------|-----------------------------------------------------------------------------|
| **[Tools](./tools.md)**       | Supplies the mixins and functions a component authors with                  |
| **[Settings](./settings.md)** | Supplies the maps those tools read                                          |
| **[Elements](./elements.md)** | Styles the bare elements a component builds on                              |
| **[Common](./common.md)**     | Imports the components shared application-wide, and owns the placement rule |
| **[Layout](./layout.md)**     | Places components inside a layout region                                    |
| **[Pages](./pages.md)**       | Places components inside a page                                             |

[↑ Back to top](#components-segment-documentation)
