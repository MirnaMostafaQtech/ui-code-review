# Objects Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Objects** segment holds class-based selectors that define **undecorated design patterns** — flat structural patterns that carry no meaning on their own. An object defines a shape and an arrangement; whatever is placed inside it supplies the meaning. The same shell holding three dots and holding a plus sign is the same object used twice.

| # | Section                                   | What it covers                                         |
|---|-------------------------------------------|--------------------------------------------------------|
| 1 | [Purpose](#purpose)                       | What the segment is for                                |
| 2 | [File Structure](#file-structure)         | The folder tree and what each file holds               |
| 3 | [Naming Conventions](#naming-conventions) | The `o-` prefix and the BEM element syntax             |
| 4 | [What an object is](#what-an-object-is)   | The three properties that separate it from a component |
| 5 | [Object or utility?](#object-or-utility)  | The test for which segment a class belongs to          |
| 6 | [Rules](#rules)                           | What a review rejects                                  |
| 7 | [Related Files](#related-files)           | The segments this one works with                       |

---

## Purpose

The Objects segment provides:

| Aspect                     | Description                                                                        |
|----------------------------|------------------------------------------------------------------------------------|
| Structural patterns        | Reusable flat patterns, such as a circle that centers whatever is placed inside it |
| No meaning alone           | An object is not a component — it has no purpose until something is placed in it   |
| One fixed pattern per file | An object's pattern is fixed; a different pattern is a different object            |

[↑ Back to top](#objects-segment-documentation)

## File Structure

```
objects/
├── _circle.object.scss
├── ...
└── ...
```

Object files use the `.object.scss` suffix: `_<object-name>.object.scss`.

[↑ Back to top](#objects-segment-documentation)

## Naming Conventions

### Class Prefix
- **MUST** use `o-` prefix for object classes
- Example: `_circle.object.scss` → `.o-circle`

### BEM Methodology
Objects are BEM blocks and may have elements, like components, modules and layouts. The BEM `--modifier` syntax is not used here, as it is not used anywhere in this architecture.

```scss
@charset "UTF-8";

.o-object-name {              // Object block
  &__element {                // Object element
    // element styles
  }
}
```

[↑ Back to top](#objects-segment-documentation)

## What an object is

An object is a **class-based selector defining an undecorated design pattern**. Three properties follow from that, and together they separate an object from a component:

1. **It has no meaning standing alone.** A component means something by itself — a button is a button. An object is a container waiting for content.
2. **Its pattern is flat and fixed.** If a second shape is needed, that is a second object, not a variant of the first. An object may still carry project-named variant classes and `is-*`/`has-*` states, as long as its pattern stays the same.
3. **It may carry color, but not a specific color.** Objects use CSS custom properties for color on the same terms as components and modules. No literal color value belongs in an object, and no particular color is part of an object's definition.

### Circle example

A circle that centers whatever is placed inside it. The shell is the object; the three dots are not.

```scss
@charset "UTF-8";

.o-circle {
  inline-size: 3rem;
  block-size: 3rem;
  border-radius: 50%;

  display: flex;
  justify-content: center;
  align-items: center;
}
```

A project with a mixin for circular shapes may use it in place of the three sizing declarations. The mixin would be the project's own; what makes this an object is the pattern, not how it is written.

```html
<span class="o-circle">
  <span class="c-dots"></span>
</span>
```

[↑ Back to top](#objects-segment-documentation)

## Object or utility

A recommended test, not a settled rule — adopt it or replace it with a better one:

- A class named after a **thing**, whose declarations are interdependent so that removing one breaks the pattern, is an **object**.
- A class named after an **effect**, setting one self-sufficient declaration, is a **utility**.

The circle above is an object: remove the border radius or either size and it stops being a circle — the declarations depend on each other. `u-text-align-center` is a utility: it sets one thing and stands alone.

This test also explains the case that looks like an exception. A utility permitted to set more than one property for accessibility or layout reasons — `u-container` for layout, `u-sr-only` and `u-not-sr-only` for accessibility, are the documented examples — is still a utility, because it serves an *effect* rather than being a named structural *thing*. It stays in the Utilities segment and is not reclassified here.

[↑ Back to top](#objects-segment-documentation)

## Rules

| # | ID      | Rule              | Description                                                                                                                                                    | Priority |
|---|---------|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| 1 | R-OBJ-1 | **o- Prefix**     | All object classes must use the `o-` prefix                                                                                                                    | Critical |
| 2 | R-OBJ-2 | **Undecorated**   | An object defines a design pattern, not a meaning. It carries no purpose until content is placed inside it                                                     | Critical |
| 3 | R-OBJ-3 | **Fixed Pattern** | An object's pattern is fixed: it takes no parameters and no overrides from a consuming component. It may carry project-named variant classes and `is-*`/`has-*` states. A different pattern is a different object | Critical |
| 4 | R-OBJ-4 | **Color**         | Objects use CSS custom properties for color, on the same terms as components and modules. No literal color values                                              | Critical |
| 5 | R-OBJ-5 | **Not a Utility** | No existing utility is reclassified as an object. `u-container` stays in the Utilities segment                                                                 | Critical |
| 6 | R-OBJ-6 | **Never Moves**   | Every object file stays in `objects/`. Sharing changes only which file `@use`s it — see the placement rule in [Common Documentation](./common.md)              | Critical |

[↑ Back to top](#objects-segment-documentation)

## Related Files

| Segment                                   | Usage                                                                           |
|-------------------------------------------|---------------------------------------------------------------------------------|
| **[Common Segment](./common.md)**         | Imports the objects that are shared application-wide                            |
| **[Components Segment](./components.md)** | Components place content inside objects, and supply the meaning an object lacks |
| **[Utilities Segment](./utilities.md)**   | Single-purpose helpers — see the object/utility test above for the boundary     |
| **[Tools Segment](./tools.md)**           | Mixins and functions used when authoring objects                                |
| **[Theme Segment](./theme.md)**           | Supplies the color custom properties an object may reference                    |

[↑ Back to top](#objects-segment-documentation)
