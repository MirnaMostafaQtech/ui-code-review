# Onboarding Guide

[← Back to README](../README.md)

This page is the reading path for a new team member: the documents to work through in order, and a quick reference to keep at hand afterwards.

| # | Section                                       | What it covers                  |
|---|-----------------------------------------------|---------------------------------|
| 1 | [For New Team Members](#for-new-team-members) | The documents to read, in order |
| 2 | [Quick Reference](#quick-reference)           | The pages to keep at hand       |

---

## For New Team Members

| # | Step                           | What to do                                                                                                                                             |
|---|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Set up the build               | Compile a first tree — see [Quick Start](./quick-start.md)                                                                                             |
| 2 | Read the Architecture Overview | Understand the four methodologies it draws on — see [Architecture Overview](./architecture.md)                                                         |
| 3 | Learn the thirteen segments    | Familiarize yourself with the segment architecture — see the [Segment Index](../segments/README.md)                                                    |
| 4 | Master Naming                  | Learn the prefix system and BEM methodology — see [Naming Conventions](./naming-conventions.md)                                                        |
| 5 | Use the project's tools        | Learn the functions and mixins your project's Tools segment provides, and import them with a single `@use` — see [Tools Segment](../segments/tools.md) |
| 6 | Practice Building              | Work through the [Worked Example](./walkthrough.md) — a login page from markup to compiled output — then build a page of your own the same way         |
| 7 | Follow Rules                   | Adhere to the [Rules](./rules.md) for consistency                                                                                                      |

## Quick Reference

| Topic                              | Where to look                                                                                                                                                                                                                                                               |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Getting the standard               | Read the docs in the AXIS repository; do not copy them into a project. The version is named at the top of [README](../README.md).                                                                                                                                           |
| Entry files                        | See the complete list in [Build — Entry files](./build.md#entry-files)                                                                                                                                                                                                      |
| Partial Files                      | Files whose names start with `_`; imported only, never compiled                                                                                                                                                                                                             |
| Which segment does this belong in? | See the [Decision Guide](./decision-guide.md)                                                                                                                                                                                                                               |
| How do I do a common task?         | See [Recipes](./recipes.md)                                                                                                                                                                                                                                                 |
| What does a term mean?             | See the [Glossary](./glossary.md)                                                                                                                                                                                                                                           |
| Before opening a pull request      | See the [Review Checklist](./review-checklist.md)                                                                                                                                                                                                                           |
| Compilation                        | `Web Compiler 2022+` with `compilerconfig.json`, or the `sass` npm package with npm scripts — both are supported, see [Build Documentation](./build.md)                                                                                                                     |
| Output                             | Compiled SCSS ships minified — named `.min.css` on the Web Compiler route and `.css` on the Node route, see [Build Documentation](./build.md); the four hand-authored `theme/` CSS files ship unminified by design — see [Quick Start](./quick-start.md) → "Verify outputs" |

[↑ Back to top](#onboarding-guide)
