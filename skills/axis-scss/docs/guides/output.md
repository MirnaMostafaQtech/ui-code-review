# HTML and CSS Output Reference

[← Back to README](../README.md)

This page is the canonical `<head>` link list: the exact stylesheets a page loads, and the order it loads them in. That order is load-bearing: when two rules have equal specificity, the one in the later stylesheet wins, so the order decides whether the project overrides the vendor and whether utilities win.

| # | Section                                                                   | What it covers                                                   |
|---|---------------------------------------------------------------------------|------------------------------------------------------------------|
| 1 | [Why each stylesheet is where it is](#why-each-stylesheet-is-where-it-is) | The reasoning behind every entry in the link list, in link order |
| 2 | [The link list](#the-link-list)                                           | The canonical `<head>` block itself                              |

---

## Why each stylesheet is where it is

1) Vendor CSS — Bootstrap in these examples — is not included in any `SCSS` file, not even `common.scss`. Importing it would make the `SCSS compiler` recompile CSS that is already final, at a cost and for no reason. It is linked in the layout HTML instead, where it also benefits from `caching`.
   - During a migration, the legacy stylesheet is linked directly after the vendor CSS, for the same reason — see [Migrating an Existing Project](./migration.md#the-legacy-stylesheet). A project that is not migrating has no such link.

2) `common/common.min.css` is the only route [Generic and Elements](../segments/common.md#what-the-common-entry-imports) have into the build, and it also carries every shared object, component and module aggregated through `_objects.common.scss`, `_components.common.scss` and `_modules.common.scss`. It is linked right after the vendor CSS, so the project's own rules override the vendor's at equal specificity. Like the vendor CSS, it changes rarely and is cached app-wide.

3) `theme/colors/colors.base.theme.css` holds the `theme`-related color values. It is kept separate from `theme/colors/colors.palette.theme.css` so that the `hue` degree can be changed easily.
   - The three theme token files that follow — `colors.base.theme.css`, `colors.palette.theme.css` and `fonts.theme.css` — declare custom properties only. A custom property has no effect by itself; it resolves only where a rule reads it with `var()`, at the point of use. Because they set no property on any element themselves, their link position relative to Common does not change which rule wins, which is why they may come after it.

4) `theme/fonts/fonts.theme.css` holds the theme's typography: the font family, the path its font files load from, and the size and weight steps. The colors are split into two files, but the fonts are not: one file is enough, and splitting it would be over-engineering. The family and its path sit at the top of the file and are what a theme changes; the steps below them stay the same from one theme to the next.

5) Next come the `layout` styles, specified by what the application needs.

6) Next is the stylesheet of the current page. Every page has its own CSS file, so that no page's rules override another's and no `!important` is needed, as it would be if one SCSS file were shared by every page.
   - Cost of this choice: `@use` deduplicates only inside one compilation unit. Each page compiles to its own `*.page.min.css`, so a component or module imported by several page entries is emitted once **per bundle**, and a visitor moving between those pages downloads the same rules again. Editing that one component also invalidates the cached bundle of every page that imported it.
   - This is why anything used by five or more page entries, or needed by any layout, is imported through `common/_objects.common.scss`, `common/_components.common.scss` or `common/_modules.common.scss` instead: it then compiles once into `common.min.css`, which is cached across the whole application. Anything used by four pages or fewer stays in those pages' bundles, where the duplication is the intended trade — see [Performance](./performance.md).
   - That cost is measurable rather than assumed. [Performance — Bundle Size Budget](./performance.md) sets a size budget for each bundle.

7) Next, `utils.scss` is the entry file of the `utilities` segment. It compiles to `utils.min.css`, which the HTML layout links so that it applies across the whole application. It is loaded **after** the page stylesheet, on purpose. It is the last of the compiled stylesheets; only `custom.theme.css` is linked after it, and that file holds theme-specific customizations, such as backgrounds and brand-asset positioning, and defines no custom property (see [Theme — custom.theme.css](../segments/theme.md#the-custom-theme-file), R-34):
   - `.u-fs-xs` (a utility) and `.p-home__title` (a page rule) both have specificity `(0,1,0)`, so at equal specificity the later stylesheet in the cascade wins. Loading utilities last is what makes the utilities segment actually override page styles when needed, as documented in the [Rules](./rules.md) and the [Utilities segment](../segments/utilities.md), without resorting to `!important`, which those rules ban outright.
   - Chosen over declaring CSS `@layer` because it fixes the documented order today, with no new mechanism to build; `@layer` remains the preferred longer-term replacement, at which point layer order — not link order — governs precedence.
   - Trade-off: because utilities load last, a page stylesheet can no longer override a utility either. If a page genuinely needs a different value than a utility provides on a given element, that utility must not be applied to that element at all — set the value directly in the page stylesheet instead.

8) `custom.theme.css` is for theme-specific customizations, such as backgrounds and brand-asset positioning; any class selector is permitted and `body` is the only element selector allowed, but it defines no custom property (see [Theme — custom.theme.css](../segments/theme.md#the-custom-theme-file), R-34). It is plain `CSS`, not `SCSS`, so those specific styles can be added without needing any `SCSS compiler`.

9) The four `theme/` stylesheets above — `colors.base.theme.css`, `colors.palette.theme.css`, `fonts.theme.css` and `custom.theme.css` — are the only stylesheets in this list that are not minified. They are hand-authored `CSS`, not compiled `SCSS` output, so the rule that compiled output ships as `.min.css` does not apply to them. They ship as authored and must not be renamed, because the links below depend on these names.

10) The `.min.css` names in the links below are what the **Web Compiler 2022+** route produces, because that name is written by hand into its output path. The **Node** route compiles a whole directory and names each output after its source, so the same compressed CSS arrives as `common.css`, `app.layout.css`, `dashboard.page.css` and `utils.css`. A project on that route links those names instead, and everything else below — the order of the links and the reasoning behind it — is unchanged. The content is identical on both routes; only the filename differs. See [Build Documentation](./build.md).

**Why the order below is load-bearing.** Every stylesheet here is authored at ordinary class specificity, so where two rules tie, the later stylesheet wins. That is the whole mechanism: vendor CSS is linked first so the project's own styles can override it, and the utilities bundle is linked last of the compiled stylesheets so a utility can override a page. Nothing in this list relies on `!important`, which is banned, and the order between stylesheets never depends on one selector out-specifying another; inside a library module, a nested vendor part such as `.m-modal .modal-header` does win by specificity, as [Modules](../segments/modules.md#vendor-override-scoping) intends.

[↑ Back to top](#html-and-css-output-reference)

## The link list

The hrefs below are root-relative URLs with the SCSS root as a placeholder. How a project on a specific server stack writes them is in [Environments](./environments.md).

The `<head>` block in a layout contains:

```html
  <!-- Packages first. The component framework or library comes first among them.
       One build per locale: the request's locale selects which build is linked,
       and the same decision sets dir on the html element - the two must never disagree,
       or right-to-left component internals render inside a left-to-right page. -->
  <link href="/path/to/SCSS/directory/packages/bootstrap<version>/bootstrap<major>.<locale>.min.css" rel="stylesheet" />
  <!-- Other packages follow, in no fixed order -->
  <link href="/path/to/SCSS/directory/packages/<library><version>/<library><major>.<locale>.min.css" rel="stylesheet" />
  <!-- A right-to-left locale links its own build, with dir="rtl" on the html element. -->

  <!-- Legacy stylesheet, during a migration only - see Migrating an Existing Project -->
  <link href="/path/to/legacy-stylesheet.css" rel="stylesheet" />

  <!-- Common styles shared across the whole application -->
  <link href="/path/to/SCSS/directory/common/common.min.css" rel="stylesheet" />

  <!-- Identity color values, the base each theme changes -->
  <link href="/path/to/SCSS/directory/theme/colors/colors.base.theme.css" rel="stylesheet" />

  <!-- Palette colors, the same in every theme -->
  <link href="/path/to/SCSS/directory/theme/colors/colors.palette.theme.css" rel="stylesheet" />

  <!-- fonts related to themes -->
  <link href="/path/to/SCSS/directory/theme/fonts/fonts.theme.css" rel="stylesheet" />

  <!-- Layout related styles -->
  <!-- Example of using app layout -->
  <link href="/path/to/SCSS/directory/layout/app/app.layout.min.css" rel="stylesheet" />

  <!-- Current page related styles -->
  <!-- Example of a sub-program page's styles -->
  <link href="/path/to/SCSS/directory/pages/<main-program>/<sub-program>/<page-name>/<page-name>.page.min.css" rel="stylesheet" />

  <!-- Utility classes, last of the compiled stylesheets so utilities win at equal specificity -->
  <link href="/path/to/SCSS/directory/utilities/utils.min.css" rel="stylesheet" />

  <!-- Theme-specific customizations: backgrounds, brand-asset positioning; no custom properties -->
  <link href="/path/to/SCSS/directory/theme/custom.theme.css" rel="stylesheet" />
```

This is the canonical link list. Where another document shows a `<head>` block, it is a copy specialized to that document's own example — the order here governs.

---

[↑ Back to top](#html-and-css-output-reference)
