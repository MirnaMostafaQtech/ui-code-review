# Environments

[← Back to README](../README.md)

The architecture in this documentation is environment-neutral: the segments, the naming rules, the import order and the link order do not depend on what serves the pages. What does depend on it is the shape of a path written into markup, and how the build is wired into the project. This document is the only place those details are explained. Examples elsewhere use `path/to/SCSS/directory` and root-relative hrefs; this page explains the ASP.NET form.

| # | Section                                         | What it covers                          |
|---|-------------------------------------------------|-----------------------------------------|
| 1 | [Dotnet projects](#dotnet-projects)             | The `~/` prefix and the `wwwroot/` root |
| 2 | [Other environments](#other-environments)       | What stays the same on another stack    |

---

## Dotnet projects

Two details belong to ASP.NET rather than to the architecture.

**The app-relative prefix `~/`.** `~/` is not a different folder. It is ASP.NET's app-relative prefix, so `~/path/to/SCSS/directory/…` in a Razor `<link>` is the same location as `wwwroot/path/to/SCSS/directory/…` on disk. It is resolved by .NET when the view renders, which means it works only in Razor markup — a Sass compiler, an npm script and `compilerconfig.json` all need the file-system form.

**The root `wwwroot/`.** `wwwroot/` is where ASP.NET serves static files from, so an SCSS tree under it is reachable by the browser as soon as it compiles. Everything after `wwwroot/` is the project's own choice and is not required by this standard — read it as `path/to/SCSS/directory`, as [Where the SCSS lives](../README.md#where-the-scss-lives) explains.

**Installing Web Compiler 2022+ (version 1.14.1 or later).** In Visual Studio 2022 or later: Extensions → search `Web Compiler 2022+` → install it, then close and reopen the IDE so the extension registers. Right-click an entry `.scss` file in Solution Explorer → Web Compiler → Compile file. This creates `compilerconfig.json` with that entry. Mapping entry files into that file is documented in the [Quick Start](./quick-start.md); the route itself is specified in [Build Documentation](./build.md).

[↑ Back to top](#environments)

## Other environments

Nothing above is required by the architecture. A project served by any other stack writes the URL form its own markup uses, and keeps everything else as documented: the same segment folders, the same entry files, the same order of links in the page head — see [HTML and CSS Output Reference](./output.md).

[↑ Back to top](#environments)
