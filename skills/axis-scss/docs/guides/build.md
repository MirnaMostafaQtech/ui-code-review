# Build Documentation

[← Back to README](../README.md)

This document specifies how SCSS is compiled to CSS in this architecture. It is a specification, not a runnable configuration: no `package.json`, `compilerconfig.json`, or other config file is created by this document. The scripts and settings below are examples for a project to add.

| #  | Section                                                                                           | What it covers                                                            |
|----|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| 1  | [Scope](#scope)                                                                                   | Which part of the build is specific to Visual Studio, and which is not    |
| 2  | [The two build routes](#the-two-build-routes)                                                     | Web Compiler 2022+ and the Node route, both supported                     |
| 3  | [Compiler and version](#compiler-and-version)                                                     | Dart Sass 1.23 as the floor, and how the lockfile pins the version        |
| 4  | [Output filenames differ between the two routes](#output-filenames-differ-between-the-two-routes) | Why the same CSS is named `.min.css` on one route and `.css` on the other |
| 5  | [Invocation on the Web Compiler route](#invocation-on-the-web-compiler-route)                     | That the entry list is maintained by hand                                 |
| 6  | [Invocation on the Node route](#invocation-on-the-node-route)                                     | The npm scripts and the in/out directory relationship                     |
| 7  | [Entry files](#entry-files)                                                                       | The four kinds of entry file, and how each route finds them               |
| 8  | [Source maps](#source-maps)                                                                       | That both routes emit them and both commit them                           |
| 9  | [Committed output and staleness](#committed-output-and-staleness)                                 | Compiled CSS in the repository, and that nothing checks it is current     |
| 10 | [Browser targets and vendor prefixing](#browser-targets-and-vendor-prefixing)                     | Modern browsers only, and no Autoprefixer step                            |
| 11 | [Relationship to the IDE extension](#relationship-to-the-ide-extension)                           | That the Web Compiler route is not retired                                |

---

## Scope

Both routes below compile with Dart Sass and neither is tied to a particular server stack. What is specific to Visual Studio is the tooling one of them uses — the Web Compiler 2022+ extension and `compilerconfig.json`; see [Environments](./environments.md). A project on another stack uses the Node route exactly as specified here.

[↑ Back to top](#build-documentation)

## The two build routes

Both routes below are supported. Neither is mandated — the choice of which one a project uses is made per project.

| Route                                          | Status                                                                                                                   | Driven by                     |
|------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|-------------------------------|
| Web Compiler 2022+ (Visual Studio extension)   | Current documented build. Still in active use and **not retired**.                                                       | `compilerconfig.json`         |
| Node route (the `sass` npm package, Dart Sass) | Direction of travel for Visual Studio projects going forward. No project is required to move to it.                      | npm scripts in `package.json` |

See [Relationship to the IDE extension](#relationship-to-the-ide-extension) below for how the two routes coexist long-term.

[↑ Back to top](#build-documentation)

## Compiler and version

Both routes compile with **Dart Sass**. This matters because two different Visual Studio extensions have shared a similar name:

- **Web Compiler 2022+** — the extension referenced by this document and by the [Quick Start](./quick-start.md) — runs Dart Sass from version 1.14.1 ("SASS: Replace Node Sass with Dart Sass (#8)" in the [changelog](https://github.com/failwyn/WebCompiler/blob/master/CHANGELOG.md)). Use version 1.14.1 or later.
- The older, pre-2022 **Web Compiler** extension ran LibSass, which never implemented the [`@use`](https://sass-lang.com/documentation/at-rules/use/) rule.

This architecture depends on `@use` throughout its import order (see the `@use "tools" as *;` pattern used across entry files), so LibSass is not a viable compiler for it under any route.

**Required minimum: Dart Sass 1.23 or later.** That floor is set by `@use "<path>" as *;`, the syntax the import order depends on everywhere in this architecture. A project's own tools may raise the floor — for example, [`math.div`](https://sass-lang.com/documentation/modules/math/#div) needs 1.33.

**The lockfile pins the version.** `npm install --save-dev sass` records a caret range such as `"sass": "^1.105.0"` in `package.json`, which sets the floor, and writes the exact resolved release to `package-lock.json`. The lockfile is committed, so every developer who installs with `npm ci` compiles with the same Dart Sass release and commits the same compiled CSS from the same source.

[↑ Back to top](#build-documentation)

## Output filenames differ between the two routes

The `<link>` list in [HTML and CSS Output Reference](./output.md) depends on these names.

`sass path/to/SCSS/directory:path/to/SCSS/directory` — the command the Node route uses — is Dart Sass **directory mode**. It compiles every `.scss` file in the tree that does not begin with `_`, names each output after its source file, and writes it to the same relative path under the output directory. This architecture compiles in place — the output directory is the SCSS directory itself — so each output lands beside its entry file and the `<link>` hrefs in [HTML and CSS Output Reference](./output.md) resolve. `--style=compressed` minifies the file's **content**; it has no effect on the output **filename**.

The Web Compiler route names its output by hand: the `.min.css` name is written into `outputFile` in `compilerconfig.json`. The compiler does not choose that name — whoever configured the entry did.

So the same compressed CSS is named differently depending on the route:

| Route              | Entry                | Output                  | Why that name                                                                                   |
|--------------------|----------------------|-------------------------|-------------------------------------------------------------------------------------------------|
| Web Compiler 2022+ | `common/common.scss` | `common/common.min.css` | Written by hand into `outputFile` in `compilerconfig.json`.                                     |
| Node route         | `common/common.scss` | `common/common.css`     | Directory mode derives the name from the source file. There is no option to make it `.min.css`. |

Both outputs are compressed. On the Web Compiler route, an entry's `minify` settings decide whether an extra file is written beside it; only the compressed file is linked.

Two consequences follow from this, and both matter to a reader:

1. **A project on the Node route links `common.css`, `app.layout.css`, `dashboard.page.css`, `utils.css`** in its layout — not the `.min.css` names shown in the `<link>` example in [HTML and CSS Output Reference](./output.md). That example reflects the Web Compiler route's naming.
2. **A project migrating from the Web Compiler route to the Node route must clean up after itself**: delete the old `.min.css` and `.map` files, retire `compilerconfig.json`, and update the `<link>` hrefs in its layout. Skipping this leaves the stale `.min.css` files being served while the new `.css` files sit unused beside them, with nothing to reveal that the swap is incomplete.

[↑ Back to top](#build-documentation)

## Invocation on the Web Compiler route

The full workflow is documented in [Quick Start](./quick-start.md); this document does not restate it. Two things the Quick Start does not say:

- The entry list in `compilerconfig.json` is **maintained by hand**. Every entry file has to be added to it individually.
- Adding a new page (or layout, or the common entry) to the build means remembering to add a matching entry to `compilerconfig.json`. There is no discovery mechanism — an entry that is never added is an entry that never compiles.

[↑ Back to top](#build-documentation)

## Invocation on the Node route

Install the `sass` package (the compiler) and `concurrently` (the task runner) as development dependencies: `npm install --save-dev sass concurrently`.

`package.json` lives in the project that serves the pages. The SCSS directory is chosen per project, and the output directory is that same directory, so each compiled file sits beside its entry — shown below with the placeholder:

```json
"scripts": {
  "dev": "concurrently \"npm:sass:watch\"",
  "sass:watch": "sass path/to/SCSS/directory:path/to/SCSS/directory --style=compressed --watch",
  "sass:build": "sass path/to/SCSS/directory:path/to/SCSS/directory --style=compressed --source-map"
}
```

`dev` runs `concurrently`, which runs watch tasks in parallel. A project that later adds a second watch task (for example, a JS bundler's watcher) adds it to the `concurrently` invocation without changing how the SCSS build itself is started. The wrapper is written for npm here to match the route description above; a project using yarn or pnpm writes the equivalent invocation for its own package manager — nothing else in this document changes with that choice.

[↑ Back to top](#build-documentation)

## Entry files

The complete entry-file set is the same regardless of route:

- `common/common.scss`
- `layout/<layout-name>/<layout-name>.layout.scss`
- `pages/**/<page-name>.page.scss` — a main-program page sits four folders below `pages/`, in `<main-program>/<sub-program>/<page-name>/`; a standalone or state page sits in `standalone/<page-name>/` or `state/<state-page>/`; see [Pages](../segments/pages.md#file-structure)
- `utilities/utils.scss`

Never a file whose name starts with `_`.

**Web Compiler route**: each of these is listed by hand in `compilerconfig.json`. `utilities/utils.scss` is part of the set and is easy to omit by mistake.

**Node route**: directory mode discovers every entry automatically. A file is skipped only because its name starts with `_` — nothing else marks a file as a partial. There is no entry list to maintain, and no entry can be forgotten. This is the Node route's main practical advantage over the Web Compiler route.

[↑ Back to top](#build-documentation)

## Source maps

Source maps are produced on **both** routes, and are committed to the repository alongside the compiled CSS — there is no route that omits them.

- `sass:build` passes `--source-map` explicitly.
- `sass:watch` does not name the flag, but the `sass` CLI emits source maps by default, so watch-mode output is mapped too.
- The Web Compiler route's `compilerconfig.json` sets `"sourceMap": true` on every entry.

There is no separate production build that strips maps out. The same source-mapped, compressed output that is generated during development is what ships.

[↑ Back to top](#build-documentation)

## Committed output and staleness

Compiled CSS files and their `.map` files are committed to git, on both routes.

There is no automated check that a fresh recompile matches what is committed. The mitigations that do exist are:

| Route        | Mitigation                                                                                                                                                                          |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Node         | `sass:watch` regenerates output on every save while a developer is working, so drift mostly cannot accumulate during active development.                                            |
| Web Compiler | After a change to a shared partial, confirm that every entry importing it was recompiled before committing, since the entry's compiled file is what ships. |
| Both         | Review is the backstop: a stale compiled file left out of a commit is something a reviewer can catch, since nothing else will.                                                      |

[↑ Back to top](#build-documentation)

## Browser targets and vendor prefixing

The declared baseline is **the 4 latest versions of Chrome, Edge, Firefox and Safari**, on desktop and on iOS — no legacy browser support.

There is no PostCSS or Autoprefixer step on either route, and none is proposed here. Vendor prefixes are hand-authored where a browser still needs one — for example [`-webkit-line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp), which works only together with `display: -webkit-box` and `-webkit-box-orient: vertical`, and [`-webkit-user-select`](https://developer.mozilla.org/en-US/docs/Web/CSS/user-select) for Safari. An Autoprefixer step would not remove the need for the line-clamp set.

[↑ Back to top](#build-documentation)

## Relationship to the IDE extension

The Web Compiler 2022+ extension is not retired by this document. It remains a supported, current build route, in active use today alongside the Node route, which is the direction of travel. A project may stay on the Web Compiler route indefinitely; nothing in this document requires a move to the Node route.

[↑ Back to top](#build-documentation)
