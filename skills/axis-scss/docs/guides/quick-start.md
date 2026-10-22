# Quick Start

[← Back to README](../README.md)

This page gets a project compiling its SCSS tree for the first time: what it needs, and the two ways to compile — the `sass` CLI anywhere, or Web Compiler 2022+ in Visual Studio.

| # | Section                                                                                           | What it covers                               |
|---|---------------------------------------------------------------------------------------------------|----------------------------------------------|
| 1 | [What you need](#what-you-need)                                                                   | The Dart Sass floor and the SCSS tree layout |
| 2 | [Compiling anywhere with the sass CLI](#compiling-anywhere-with-the-sass-cli)                     | The one-command Dart Sass route              |
| 3 | [Compiling in Visual Studio with Web Compiler](#compiling-in-visual-studio-with-web-compiler)     | The Web Compiler 2022+ route                 |

---

## What you need

- **Node.js with npm.** The `sass` CLI is an npm package. Install it in the project that serves the pages with `npm install --save-dev sass`, and run it through `npx sass` — see [Build Documentation](./build.md).
- **Dart Sass 1.23 or later.** The floor is set by `@use "<path>" as *;`, which this architecture depends on everywhere. A project's own tools may raise the floor — for example, [`math.div`](https://sass-lang.com/documentation/modules/math/#div) needs 1.33. LibSass never implemented [`@use`](https://sass-lang.com/documentation/at-rules/use/) and cannot compile this tree. See [Build Documentation](./build.md).
- **An SCSS tree in the segment layout**, rooted wherever your project keeps it — written throughout this documentation as `path/to/SCSS/directory`.

### A minimal tree

To compile for the first time, create these files under `path/to/SCSS/directory/`, each starting with `@charset "UTF-8";`:

| # | File                                           | Content besides `@charset`                         |
|---|------------------------------------------------|----------------------------------------------------|
| 1 | `generic/_index.scss`                          | nothing yet                                        |
| 2 | `elements/_index.scss`                         | nothing yet                                        |
| 3 | `common/common.scss`                           | `@use "../generic" as *;` and `@use "../elements" as *;` |
| 4 | `layout/<layout-name>/<layout-name>.layout.scss` | nothing yet                                      |
| 5 | `pages/standalone/<page-name>/<page-name>.page.scss` | nothing yet                                  |
| 6 | `utilities/utils.scss`                         | nothing yet                                        |

The other folders from [The tree](../segments/README.md#the-tree) are added as their first file is written.

[↑ Back to top](#quick-start)

## Compiling anywhere with the sass CLI

The architecture needs no particular editor, IDE or server stack. Dart Sass compiles the whole tree in one command:

```bash
npx sass path/to/SCSS/directory:path/to/SCSS/directory --style=compressed --source-map
```

Directory mode compiles every `.scss` file whose name does not begin with `_`, names each output after its source, and writes it beside its source, because the output directory is the SCSS directory itself — so `common/common.scss` becomes `common/common.css`, not `common.min.css`. Add `--watch` while working.

**Expected result:** a `.css` file and a `.css.map` file beside each entry — `common/common.css`, `layout/<layout-name>/<layout-name>.layout.css`, `pages/standalone/<page-name>/<page-name>.page.css` and `utilities/utils.css` — and no output for any file whose name starts with `_`.

The full specification of this route, including how it differs from the Visual Studio route, is in [Build Documentation](./build.md).

[↑ Back to top](#quick-start)

## Compiling in Visual Studio with Web Compiler

Follow these steps to compile SCSS to CSS using the **Web Compiler 2022+** extension (version 1.14.1 or later) in Visual Studio 2022 or later. Installing the extension is described in [Environments](./environments.md#dotnet-projects); this page does not repeat it.

### 1. Create the config file
Right-click an entry `.scss` file (not a partial) in Solution Explorer → `Web Compiler` → `Compile file`. Web Compiler creates `compilerconfig.json` at the project root, with that entry in it.

### 2. Map inputs to outputs
Open `compilerconfig.json` and add the other entry `SCSS` files — only entry files.

Example:

```json
[
  {
    "inputFile": "path/to/SCSS/directory/common/common.scss",
    "outputFile": "path/to/SCSS/directory/common/common.min.css",
    "options": {
      "sourceMap": true,
      "style": "compressed"
    }
  },
  {
    "inputFile": "path/to/SCSS/directory/layout/app/app.layout.scss",
    "outputFile": "path/to/SCSS/directory/layout/app/app.layout.min.css",
    "options": {
      "sourceMap": true,
      "style": "compressed"
    }
  },
  {
    "inputFile": "path/to/SCSS/directory/layout/intro/intro.layout.scss",
    "outputFile": "path/to/SCSS/directory/layout/intro/intro.layout.min.css",
    "options": {
      "sourceMap": true,
      "style": "compressed"
    }
  },
  {
    "inputFile": "path/to/SCSS/directory/pages/standalone/<page-name>/<page-name>.page.scss",
    "outputFile": "path/to/SCSS/directory/pages/standalone/<page-name>/<page-name>.page.min.css",
    "options": {
      "sourceMap": true,
      "style": "compressed"
    }
  },
  {
    "inputFile": "path/to/SCSS/directory/utilities/utils.scss",
    "outputFile": "path/to/SCSS/directory/utilities/utils.min.css",
    "options": {
      "sourceMap": true,
      "style": "compressed"
    }
  }
]
```

### 3. Recompile (optional)
- Right-click an entry `.scss` file (not a partial) → `Web Compiler` → `Recompile file`.

### 4. Verify outputs
- A `.min.css` file appears next to its entry file, at the path you specified in the `compilerconfig.json` file. Make sure the path is correct. Every file compiled from SCSS ships minified, and only the minified file is referenced. The `.min.css` name comes from the output path you configured, not from the compiler; the entry's `minify` settings decide whether Web Compiler writes any extra file beside it. The Node route names the same compressed output `.css` instead. See [Build Documentation](./build.md).
- This rule covers compiled output only. The four theme stylesheets — `theme/colors/colors.base.theme.css`, `theme/colors/colors.palette.theme.css`, `theme/fonts/fonts.theme.css` and `theme/custom.theme.css` — are hand-authored plain CSS, are not compiled from SCSS, and ship exactly as authored. The exemption is deliberate: it lets a theme be adjusted without running an SCSS compiler. Do not minify or rename them, because the layout links them directly by these names.
- Trade-off: those four files are therefore served unminified on every page. They stay small and token-focused by design, which is what keeps that cost acceptable. If the Node route named in the "Direction of travel" note below takes over, minifying them there would be a reasonable later improvement; nothing in this document requires it today.

> **Important**: Only configure entry files. The complete set of entry files is: `common/common.scss`, `layout/<layout-name>/<layout-name>.layout.scss` (e.g. `app.layout.scss`), `pages/**/<page-name>.page.scss`, and `utilities/utils.scss` — never a file whose name starts with `_`; those partials are imported only and never compiled on their own.

> **Direction of travel**: The Web Compiler 2022+ workflow above is the current documented build for Visual Studio projects. Compiling with the `sass` npm package (Dart Sass) — the Node route — is the intended direction for those projects going forward, and no project is required to move to it yet. Both routes are specified in full in [Build Documentation](./build.md), including the output filenames each one produces, which differ.

[↑ Back to top](#quick-start)
