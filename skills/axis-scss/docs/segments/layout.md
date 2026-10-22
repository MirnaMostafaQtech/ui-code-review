# Layout Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Layout** segment contains the styles for what surrounds a page's content — the header, the navbar, the side menu, the footer, the shell the content sits in — never the content's own structure, which is the page's job. A project has one folder per layout, plus `shared/` for what belongs to no single layout. A typical application has two layouts — `app`, for pages behind the login, and `intro`, for everything in front of it — shown throughout this document as the usual example; a project adds as many layouts as it needs, named for what each one is.

| # | Section                                               | What it covers                                             |
|---|-------------------------------------------------------|------------------------------------------------------------|
| 1 | [Purpose](#purpose)                                   | What the segment is for                                    |
| 2 | [File Structure](#file-structure)                     | One folder per layout, plus `shared/`                      |
| 3 | [Naming Conventions](#naming-conventions)             | The `l-` prefix and BEM naming                             |
| 4 | [What belongs to a layout](#what-belongs-to-a-layout) | The Layout/Pages boundary, and the layouts a project holds |
| 5 | [Best Practices](#best-practices)                     | How to author a layout                                     |
| 6 | [Rules](#rules)                                       | What a review rejects                                      |
| 7 | [Related Files](#related-files)                       | The segments this one works with                           |

---

## Purpose

The Layout segment provides:

| Aspect         | Description                                                                                          |
|----------------|------------------------------------------------------------------------------------------------------|
| Page chrome    | The header, navbar, side menu and footer the pages of one layout share                               |
| Content region | The area the page's content sits in, which it sizes and positions without styling anything inside it |
| Responsiveness | Layout adaptations for different screen sizes                                                        |
| Consistency    | Standardized layout patterns across the application                                                  |

[↑ Back to top](#layout-segment-documentation)

## File Structure

```
layout/
├── <layout-name>/
│   ├── _<part>.<layout-name>.layout.scss   # a partial of this layout
│   ├── <layout-name>.layout.scss           # entry file — one per layout
│   └── <layout-name>.layout.min.css        # compiled output
└── shared/
    └── _<part>.layout.scss                 # belongs to no single layout
```

One folder per layout, each with its own entry file, so each layout compiles to its own stylesheet and a page links only the one it uses. `shared/` is the exception: it holds what every layout uses, so its files carry no layout name.

**A typical application has** two layouts, shown below as the example:

```
layout/
├── app/
│   ├── _header.app.layout.scss    # Application header styles
│   ├── _main.app.layout.scss      # Main application layout
│   ├── app.layout.scss            # App layout entry file
│   └── app.layout.min.css         # Compiled app layout CSS
├── intro/
│   ├── _header.intro.layout.scss  # Introduction header styles
│   ├── _main.intro.layout.scss    # Main intro content region
│   ├── intro.layout.scss          # Intro layout entry file
│   └── intro.layout.min.css       # Compiled intro layout CSS
└── shared/
    └── _footer.layout.scss        # Shared footer styles
```

This assumes the footer in front of the login is identical to the one behind it, so it lives in `shared/` rather than in either layout — see the footer rule in [`shared/`](#the-shared-folder) for when it is not.

A project that needs a third layout adds a third folder beside these, named after what that layout is, and its partials carry that name in the same dot-joined position.

`*.layout.min.css` is the Web Compiler route's output name; the Node route compiles the same entry to `*.layout.css`. Output naming is specified in [Build Documentation](../guides/build.md).

Every partial in a layout folder names the layout it belongs to, dot-joined ahead of the suffix: `_header.app.layout.scss`, `_header.intro.layout.scss`. `shared/` is the exception — its files belong to no single layout, so they carry no scope, which is why `_footer.layout.scss` is named as it is.

A layout folder may group its partials into sub-folders once it outgrows a flat list. The entry file stays where it is and keeps its name; each sub-folder gets an `_index.scss` so the entry can pull the whole folder in with one line. The scope in each filename is what still says which layout a partial belongs to once the folder name no longer does.

App layout (pages behind the login). Its entry imports the shared footer:

```
layout/app/
├── header/
│   ├── _index.scss                # @use each file below, so the entry reaches them in one line
│   ├── _header.app.layout.scss
│   └── _nav.app.layout.scss
├── main/
│   ├── _index.scss
│   └── _main.app.layout.scss
├── app.layout.scss                # entry file — @use "./header" as *; @use "./main" as *; @use "../shared/footer.layout" as *;
└── app.layout.min.css             # compiled output, unchanged
```

Intro layout (pages in front of the login). Here the footer in front of the login differs from the one behind it, so it is not in `shared/` — intro carries its own:

```
layout/intro/
├── header/
│   ├── _index.scss
│   └── _header.intro.layout.scss
├── main/
│   ├── _index.scss
│   └── _main.intro.layout.scss
├── footer/
│   ├── _index.scss
│   └── _footer.intro.layout.scss
├── intro.layout.scss              # entry file — @use "./header" as *; @use "./main" as *; @use "./footer" as *;
└── intro.layout.min.css           # compiled output, unchanged
```

A project only ever has one of these two footer shapes — shared or per-layout — never both at once; the two are shown together here only to illustrate each option.

The entry file itself never has an `_index.scss` beside it. What the entry file imports changes; what the build compiles does not. The rule these files follow is in [Best Practices](../guides/best-practices.md#folder-index-files).

[↑ Back to top](#layout-segment-documentation)

## Naming Conventions

- **MUST** use `l-` prefix for layout classes
- A layout's own parts are BEM elements of its block, never a separate `l-` block: `.l-app__header`, `.l-app__main`
- A part that lives in `shared/` is its own `l-` block, not an element of any layout's block: `.l-footer`
- Examples: `l-app`, `l-app__header`, `l-intro`, `l-footer`

### BEM Methodology

The general pattern is in [Naming Conventions](../guides/naming-conventions.md); what follows is what it looks like for a layout shell — three sibling elements in one block.

```scss
@charset "UTF-8";

.l-app {                    // Layout block
  &__header {               // Layout element
    // header styles
  }
  
  &__main {                 // Layout element
    // main content styles
  }
  
  &__sidebar {              // Layout element
    // sidebar styles
  }
}
```

[↑ Back to top](#layout-segment-documentation)

## What belongs to a layout

**Everything that is not the page's own content belongs here.** The header, the navbar, the side menu, the footer, the shell the content sits in — all of it is Layout, and none of it is written in the Pages segment. Each layout's root `l-` class (`.l-app`, `.l-intro`) owns the shell grid, and its main region (`l-app__main`, `l-intro__main`) owns the height — for example the `1fr` row of the shell grid — so a page never sets either. A page holds what is unique to that page and nothing around it. The same boundary is in [Decision Guide](../guides/decision-guide.md#layout-or-page) and [Pages](./pages.md).

It follows that a new layout is justified whenever what surrounds the content is different — a different header, navbar, side menu or footer, or none at all. Two pages inside the same shell are two pages, not two layouts.

A layout entry `@use`s only its own partials and its `shared/` parts. An object, component or module a layout needs is `@use`d from the matching `common/` aggregator — never from the layout entry — so it compiles once, into `common.min.css` (R-28, R-29).

### A layout folder

Each layout folder holds that layout's partials and its entry file. **Examples, from a typical application's two:**

- `app/` — pages behind the login. `_header.app.layout.scss` carries the header with its navigation and user menu; `_main.app.layout.scss` the main content area; `app.layout.scss` is the entry file.
- `intro/` — pages in front of the login. `_header.intro.layout.scss` carries a simpler header; `_main.intro.layout.scss` the content region; `intro.layout.scss` is the entry file.

What partials a layout holds is the project's own; the entry file and the naming are not.

### The shared folder

Folder: `layout/shared/`.

Holds a part only when it is identical in every layout — a footer common to all of them, for example, in `_footer.layout.scss`. These files belong to no single layout, which is why they carry no layout name. That is the one exception to the naming rule above.

When the footer in front of the login differs from the one behind it, there is no shared footer: each layout carries its own, named the same way any other partial is — `_footer.app.layout.scss`, `_footer.intro.layout.scss`.

[↑ Back to top](#layout-segment-documentation)

## Best Practices

| # | Principle             | Guidelines                                                                                                                                         |
|---|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Layout Separation** | - Keep each layout in its own folder<br>- Put what every layout uses in `shared/`<br>- Never style the page's content here; that is the page's job |
| 2 | **Responsive Design** | - Position the header, navbar, side menu, footer and content region with CSS Grid or Flexbox<br>- Test across all breakpoints                      |
| 3 | **Performance**       | - Keep layout styles lightweight<br>- Use efficient selectors<br>- Minimize layout shifts                                                          |
| 4 | **Accessibility**     | - Ensure proper heading hierarchy<br>- Maintain logical tab order<br>- Use semantic HTML structure<br>- See [Markup](../guides/accessibility.md#markup) |
| 5 | **Maintainability**   | - Use clear naming conventions<br>- Document complex layouts<br>- Keep styles organized                                                            |

[↑ Back to top](#layout-segment-documentation)

## Rules

| # | ID      | Rule                   | Description                                                    | Priority |
|---|---------|------------------------|----------------------------------------------------------------|----------|
| 1 | R-LAY-1 | **l- Prefix**          | All layout classes must use `l-` prefix                        | Critical |
| 2 | R-LAY-2 | **Semantic Structure** | Use semantic HTML elements — see [Markup](../guides/accessibility.md#markup) | Critical |
| 3 | R-LAY-3 | **Responsive**         | Renders with no horizontal overflow from 320 CSS px up, and is checked at every breakpoint key the project defines | Critical |
| 4 | R-LAY-4 | **Accessible**         | Meets the rules in [Accessibility](../guides/accessibility.md) | Medium   |

[↑ Back to top](#layout-segment-documentation)

## Related Files

| Segment                                   | Usage                                      |
|-------------------------------------------|--------------------------------------------|
| **[Components Segment](./components.md)** | Components used within layouts             |
| **[Elements Segment](./elements.md)**     | Base element styles a layout builds on     |
| **[Tools Segment](./tools.md)**           | Mixins and functions for responsive design |
| **[Settings Segment](./settings.md)**     | Breakpoints and design values              |
| **[Common Segment](./common.md)**         | Carries every object, component and module a layout needs |
| **[Pages Segment](./pages.md)**           | Holds the content a layout surrounds       |

[↑ Back to top](#layout-segment-documentation)
