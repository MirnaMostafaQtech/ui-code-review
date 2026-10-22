# Worked Example of a Login Page from Start to Finish

[← Back to README](../README.md)

This document walks one realistic page — a login page using the `intro` layout — through the segments a page touches: markup, SCSS imports, the build configuration, the compiled `<head>` block, and the files that come out the other end.

**Paths below are written relative to the SCSS root, `path/to/SCSS/directory/`, except `@use` paths, which are relative to the file they are written in** — so every `@use` line here can be checked against the project's actual file structure.

This is a worked example, not a template to copy verbatim: the component names, the field, and the exact classes are specific to a login page. The pattern — where files live, how they import each other, and how the build turns them into what ships — is what to take from it.

| #  | Section                                                                                        | What it covers                                  |
|----|------------------------------------------------------------------------------------------------|-------------------------------------------------|
| 1  | [Step 1 The markup](#step-1-the-markup)                                                        | The finished HTML the page renders              |
| 2  | [Step 2 The file layout](#step-2-the-file-layout)                                              | Which files the page needs, and where each sits |
| 3  | [Step 3 The shared component](#step-3-the-shared-component)                                    | A button most pages use                         |
| 4  | [Step 4 The page-local component](#step-4-the-page-local-component)                            | A card only this page uses                      |
| 5  | [Step 5 The shared import route](#step-5-the-shared-import-route)                              | How the shared component reaches the build      |
| 6  | [Step 6 The page entry](#step-6-the-page-entry)                                                | What the page itself imports                    |
| 7  | [Step 7 Building it](#step-7-building-it)                                                      | Compiling the page's bundles                    |
| 8  | [Step 8 The head block](#step-8-the-head-block)                                                | The link order the page ships with              |
| 9  | [Step 9 What the build produces](#step-9-what-the-build-produces)                              | The files on disk afterwards                    |
| 10 | [Closing note](#closing-note)                                                                  | What the example settles and what it does not   |

---

## Step 1 The markup

```html
<body>
  <div class="l-intro">
    <header class="l-intro__header">
      <!-- from layout/intro/_header.intro.layout.scss -->
    </header>

    <main class="l-intro__main">
      <section class="p-login">
        <div class="c-login-card">
          <h1 class="c-login-card__title">Sign in</h1>

          <form class="c-login-card__form">
            <div class="c-login-card__field js-error">
              <label class="c-login-card__label" for="email">Email</label>
              <input
                id="email"
                type="email"
                class="c-login-card__input js-invalid"
                aria-invalid="true"
                aria-describedby="email-error"
              />
              <p id="email-error" class="c-login-card__error">Enter a valid email address.</p>
            </div>

            <div class="c-login-card__field">
              <label class="c-login-card__label" for="password">Password</label>
              <input id="password" type="password" class="c-login-card__input" />
            </div>

            <button type="submit" class="c-button <variant-class>">
              <span class="c-button__icon" aria-hidden="true">&rarr;</span>
              Sign in
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer class="l-footer">
      <!-- from layout/shared/_footer.layout.scss -->
    </footer>
  </div>
</body>
```

What this markup demonstrates:

- **Layout and page prefixes.** `l-intro` is the layout block, wrapping `l-intro__header` and `l-intro__main` as its BEM elements, plus the shared `l-footer` block used across every layout (`layout/shared/_footer.layout.scss`) — a separate block, not an `l-intro__` element, because it is not specific to this layout. This assumes the `app` and `intro` layouts share an identical footer; see [Layout](../segments/layout.md#the-shared-folder) for the per-layout footer this example does not use. `p-login` is the page root (`p-` prefix), nested inside `l-intro__main`.
- **A shared component and a page-local one.** `c-button` is used on most pages in a real project — any page with a primary action — so it is well past the five-page threshold and is shared. `c-login-card` exists only on this page, so it is page-local. Both are BEM blocks with at least one `__element` (`c-button__icon`; `c-login-card__title`, `__field`, `__label`, `__input`, `__error`, `__form`). Neither uses the BEM `--modifier` syntax — this architecture does not use it anywhere.
- **State: `js-*` for anything a script changes.** The email field is invalid, which is the natural place to show it: `js-error` on the field wrapper (`c-login-card__field`) marks that the field currently has an error, and `js-invalid` on the input itself is the boolean state of that input. Both carry the `js-` prefix because validation adds and removes them at runtime. `<variant-class>` on the submit button stands for this project's own variant class — **project-specific only**: the standard fixes `is-*` for state, not for variants (see [Rules — State Management](./rules.md#state-management)), and the project names its variants with its own prefix (R-01).
- **How the script reaches the field.** The input already carries `id="email"`, so validation finds it directly and toggles `js-invalid` on it and `js-error` on its wrapper. No separate lookup class is needed here. A class that exists only as a script's lookup target is still written `js-*` — `js-modal-trigger` is the usual shape — with one difference: a lookup class carries no styles, while `js-invalid` and `js-error` do. The same script sets `aria-invalid="true"` on the input when it adds `js-invalid`, and removes both together; `aria-describedby` ties the error text to the input for screen readers.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 2 The file layout

Files this example adds, rooted at the SCSS root (`path/to/SCSS/directory/`):

```
path/to/SCSS/directory/
├── components/
│   ├── _button.component.scss          (new — shared component)
│   └── _login-card.component.scss      (new — page-local component)
├── common/
│   └── _components.common.scss         (existing aggregator — one @use line added)
└── pages/
    └── standalone/
        └── login/
            ├── login.page.scss         (new — page entry)
            └── login.page.min.css      (build output, Web Compiler route — not authored)
```

Component files carry the leading underscore that marks any Sass partial, matching every existing file in `components/` (see the [Components segment documentation](../segments/components.md)). A partial is never compiled on its own — on the Node build route, a leading `_` is the only thing that tells the compiler to skip a file, and on the Web Compiler route a partial is never given its own `compilerconfig.json` entry. `@use` paths below refer to these same files without the underscore, which is standard Sass resolution, not a different file.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 3 The shared component

File: `components/_button.component.scss`

```scss
@charset "UTF-8";

// kept for consistency with every other component; this file calls no tool
@use "../tools" as *;

.c-button {
  min-inline-size: 3.75rem; // 60px
  padding-block: 0.5rem; // 8px
  padding-inline: 1rem; // 16px
  border: 1px solid transparent;
  border-radius: 0.5rem; // 8px
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem; // 8px

  &__icon {
    display: inline-flex;
  }

  &.<variant-class> { // the project's own variant class, named with its own prefix (R-01)
    background-color: var(--primary-500);
    color: var(--neutral-25);
  }

  &:focus-visible {
    outline: 0.125rem solid var(--primary-500); // 2px
    outline-offset: 0.125rem; // 2px
  }

  @media (width >= 48rem) { // 768px
    padding-inline: 1.5rem; // 24px
  }
}
```

`components/` sits one level below the SCSS root, so tools is `../tools` from here. This file calls no tool: lengths are written in `rem` with their px value in a comment, and the breakpoint is a plain `@media` query in range syntax, which [Rules](./rules.md) prefers. The import stays so every component starts the same way; a project that ships its own tools — a px-to-rem function, a media-query mixin — may use them here instead (see [Tools](../segments/tools.md)). `padding-block: 0.5rem`, with the line height, keeps the button at or above the 24 × 24 px target size the [Accessibility](./accessibility.md) rules require, and `&:focus-visible` gives the button its own visible focus style.

**Why shared:** most pages in a real project use a primary-action button, well past the five-page threshold, so `c-button` is imported once through the common aggregator ([Step 5](#step-5-the-shared-import-route)) rather than repeated in every page that needs it.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 4 The page-local component

File: `components/_login-card.component.scss`

```scss
@charset "UTF-8";

// kept for consistency with every other component; this file calls no tool
@use "../tools" as *;

.c-login-card {
  padding: 1.5rem; // 24px
  border-radius: 0.5rem; // 8px

  &__title {
    margin-block-end: 1rem; // 16px
  }

  &__field {
    margin-block-end: 0.75rem; // 12px

    &.js-error .c-login-card__label {
      color: var(--danger-500);
    }
  }

  &__input {
    padding-block: 0.5rem; // 8px
    padding-inline: 0.75rem; // 12px

    &.js-invalid {
      border-color: var(--danger-500);
    }
  }

  &__error {
    color: var(--danger-500);
  }

  @media (width >= 48rem) { // 768px
    padding: 2rem; // 32px
  }
}
```

Same depth as the button, so the same `../tools` path resolves here for the same reason.

**Why page-local:** only the login page uses `c-login-card`. **It still lives in `components/`**, in the same folder as the shared button — a component never moves between folders. Only its import route differs: the button is imported once through `common/_components.common.scss`, and the login card is imported directly by the one page entry that needs it. This is the rule most easily misread — being page-local is about which file `@use`s the component, not about where the component's own file sits.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 5 The shared import route

File: `common/_components.common.scss`

```scss
@charset "UTF-8";

// common/_components.common.scss (existing aggregator — one line added)
@use "../components/button.component" as *;
```

`common/` sits one level below the SCSS root, so `../components/button.component` resolves to `components/_button.component.scss`. This is what puts `c-button`'s rules into `common.min.css` exactly once, shared across the whole application — not into every page that happens to use a button.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 6 The page entry

File: `pages/standalone/login/login.page.scss`

```scss
@charset "UTF-8";

// 1) tools — kept for consistency with every page entry; this page calls no tool
@use "../../../tools" as *;

// 2) Components — page-local only. c-button is shared, so it is NOT repeated here;
//    it arrives already compiled into common.min.css (see Step 5).
@use "../../../components/login-card.component" as *;

// 3) Local page rules
.p-login {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

The page sets no height of its own: the layout's main region (`l-intro__main`) supplies it, so `.p-login` only centers its content.

`pages/standalone/login/login.page.scss` sits three levels below the SCSS root (`pages/`, `standalone/`, then `login/`), so tools is `../../../tools` and components are reached through `../../../components/...` from here.

**The button is deliberately absent from this file.** If `login.page.scss` also imported `components/button.component`, `.c-button`'s rules would compile a second time — once into `common.min.css` ([Step 5](#step-5-the-shared-import-route)) and again into `login.page.min.css` — shipping the same CSS twice to every visitor who loads this page, and creating exactly the double-import the [Common segment](../segments/common.md) warns against.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 7 Building it

**Web Compiler 2022+ route** — add one entry to `compilerconfig.json`:

```json
{
  "inputFile": "path/to/SCSS/directory/pages/standalone/login/login.page.scss",
  "outputFile": "path/to/SCSS/directory/pages/standalone/login/login.page.min.css",
  "options": {
    "sourceMap": true,
    "style": "compressed"
  }
}
```

**Node route** — no entry needed. Directory mode compiles every non-partial file it finds under the SCSS root on its own, and skips `_`-prefixed files automatically, so `login.page.scss` is picked up without any configuration change.

Neither route is restated here beyond this one entry — see [Build Documentation](./build.md) for the full build, including how the two routes differ.

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 8 The head block

The list below is the canonical order from [HTML and CSS Output Reference](./output.md), with this example's layout and page filenames substituted. If the two ever differ in order, that file is right and this one is stale.

```html
<!-- Packages first. The component framework or library first. -->
<!-- <locale> is chosen per request -->
<link href="/path/to/SCSS/directory/packages/bootstrap<version>/bootstrap<major>.<locale>.min.css" rel="stylesheet" />

<!-- Common styles shared across the whole application -->
<link href="/path/to/SCSS/directory/common/common.min.css" rel="stylesheet" />

<!-- Identity color values, the base each theme changes -->
<link href="/path/to/SCSS/directory/theme/colors/colors.base.theme.css" rel="stylesheet" />

<!-- Palette colors, the same in every theme -->
<link href="/path/to/SCSS/directory/theme/colors/colors.palette.theme.css" rel="stylesheet" />

<!-- fonts related to themes -->
<link href="/path/to/SCSS/directory/theme/fonts/fonts.theme.css" rel="stylesheet" />

<!-- Layout related styles: this page uses the intro layout -->
<link href="/path/to/SCSS/directory/layout/intro/intro.layout.min.css" rel="stylesheet" />

<!-- Current page related styles -->
<link href="/path/to/SCSS/directory/pages/standalone/login/login.page.min.css" rel="stylesheet" />

<!-- Utility classes, loaded last so utilities win at equal specificity -->
<link href="/path/to/SCSS/directory/utilities/utils.min.css" rel="stylesheet" />

<!-- Theme-specific customizations: backgrounds, brand-asset positioning; no custom properties -->
<link href="/path/to/SCSS/directory/theme/custom.theme.css" rel="stylesheet" />
```

The `.min.css` names above are the **Web Compiler 2022+** route's output. A project on the **Node route** links `common.css`, `intro.layout.css`, `login.page.css` and `utils.css` instead — same content, different filename, because that route names each output after its source file rather than by hand. See [Build Documentation](./build.md) for why the two routes diverge and what a route migration requires.

**One page, both directions.** Nothing in this example is written twice for Arabic. The markup, the SCSS and the build are the same for both locales. Two things change per request, and the same decision sets both: which vendor build is linked — here Bootstrap's `bootstrap<major>.<locale>.min.css` for that locale — and whether the `html` element carries `dir="rtl"`. The two must never disagree, or RTL component internals render inside an LTR page. The components in Steps 3 and 4 need no Arabic copy because they are written in logical properties — `padding-inline`, `margin-block-end`, `min-inline-size` — as [Rules](./rules.md) requires, so they follow `dir` without any change. See [HTML and CSS Output Reference](./output.md).

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Step 9 What the build produces

For this example, compiling the page entry produces:

- `pages/standalone/login/login.page.min.css` (Web Compiler route) — or `pages/standalone/login/login.page.css` (Node route)
- the matching `.map` source map file, alongside it, on either route

`common.min.css` is not a new file — it already exists — but it must be **recompiled** once `_components.common.scss` picks up the added `@use` line from [Step 5](#step-5-the-shared-import-route), since that changes what compiles into it. On the Web Compiler route, confirm that `common.scss` was recompiled before committing; see [Build — Committed output and staleness](./build.md#committed-output-and-staleness).

---

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)

## Closing note

Every `@use` path above resolves against the documented segment folders — `components/`, `common/` and `pages/standalone/<page-name>/` — at the depth the path assumes.

[↑ Back to top](#worked-example-of-a-login-page-from-start-to-finish)
