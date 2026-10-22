# Tools Segment Documentation

[← Segment Index](./README.md) · [← README](../README.md)

The **Tools** segment contains all SCSS mixins and functions that provide reusable logic and calculations throughout the application. This segment must never generate CSS rulesets.

| # | Section                                                                        | What it covers                                                         |
|---|--------------------------------------------------------------------------------|------------------------------------------------------------------------|
| 1 | [Purpose](#purpose)                                                            | What the segment is for                                                |
| 2 | [File Structure](#file-structure)                                              | The folder tree and what each file holds                               |
| 3 | [Documenting what the project tools do](#documenting-what-the-project-tools-do) | Where a project's own signatures live, and the `@dependencies` comment |
| 4 | [Usage Examples](#usage-examples)                                              | A file that imports the segment                                        |
| 5 | [Best Practices](#best-practices)                                              | How to author this segment                                             |
| 6 | [Rules](#rules)                                                                | What a review rejects                                                  |
| 7 | [Related Files](#related-files)                                                | The segments this one works with                                       |

---

## Purpose

The Tools segment provides:

| Aspect              | Description                                             |
|---------------------|---------------------------------------------------------|
| **Reusability**     | Common mixins and functions used across the application |
| **Consistency**     | Standardized approaches to common styling patterns      |
| **Maintainability** | Centralized logic for complex operations                |
| **No CSS Output**   | This segment must never generate CSS rulesets           |

[↑ Back to top](#tools-segment-documentation)

## File Structure

```
tools/
├── _index.scss                   # Folder index
├── functions/
│   ├── _index.scss               # Folder index for functions
│   └── _<name>.function.scss     # one file per function
└── mixins/
    ├── _index.scss               # Folder index for mixins
    └── _<name>.mixin.scss        # one file per mixin
```

**Which tools a project writes is the project's own.** A project adds the functions and mixins its interface needs and names them itself. What the standard fixes is the shape above: two folders, one file per tool, the `.function.scss` and `.mixin.scss` suffixes, and an `_index.scss` in each folder that `@forward`s what it holds, so one `@use` line reaches everything.

[↑ Back to top](#tools-segment-documentation)

## Documenting what the project tools do

This standard does not publish a set of tools, so it does not publish their signatures either. A project documents its own: for each tool, its signature, each parameter and its default, what it returns or emits, and one short usage example. Keep that documentation in one place, so a signature is written once and cannot drift against a second copy.

### Dependencies comments

`@dependencies` is a comment placed at the top of a file, immediately after `@charset`, listing the settings and tools files that file reads. A file with more than one dependency lists one per line.

```scss
@charset "UTF-8";

// @dependencies: settings/_breakpoints.settings.scss
// @dependencies: tools/functions/_<name>.function.scss
```

This is the one definition; [Settings — Best Practices](./settings.md#best-practices) points here rather than repeating it.

[↑ Back to top](#tools-segment-documentation)

## Usage Examples

### A file that imports the segment

```scss
@charset "UTF-8";

@use "<path-to-root>/tools" as *;

.c-card {
  padding: 1rem;
  border-radius: 0.5rem;

  @media (width >= 48rem) { // 768px
    padding: 1.5rem;
  }
}
```

The import line is what the standard fixes: one `@use` reaches every tool the project's Tools segment forwards. What the rules inside look like is up to the project — the CSS above is written plainly, and a project that has a mixin for a media query or a length conversion may use it here instead.

[↑ Back to top](#tools-segment-documentation)

## Best Practices

| # | Principle           | Guidelines                                                                                                                                                       |
|---|---------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Function Naming** | - Use a descriptive name that says what the function returns<br>- Follow kebab-case for file names<br>- Include type in filename: `_function-name.function.scss` |
| 2 | **Mixin Naming**    | - Use a descriptive name that says what the mixin emits<br>- Follow kebab-case for file names<br>- Include type in filename: `_mixin-name.mixin.scss`            |
| 3 | **Documentation**   | - Include [`@dependencies`](#dependencies-comments) comments<br>- Document parameters and return values<br>- Provide usage examples                              |
| 4 | **Error Handling**  | - Validate input parameters<br>- Provide meaningful error messages<br>- Use `@error` directive for invalid inputs                                                |
| 5 | **Performance**     | - Keep functions and mixins lightweight<br>- Avoid complex calculations in loops<br>- Use efficient algorithms for list operations                               |

[↑ Back to top](#tools-segment-documentation)

## Rules

| # | ID         | Rule              | Description                                         | Priority |
|---|------------|-------------------|-----------------------------------------------------|----------|
| 1 | R-TOOL-1   | **No CSS Output** | This segment must never generate CSS rulesets       | Critical |
| 2 | R-TOOL-2   | **Reusability**   | A tool takes the values it needs as parameters; it never hard-codes a component, page or client value | Critical |
| 3 | R-TOOL-3   | **Validation**    | Every parameter is checked; an invalid one raises `@error` | High     |
| 4 | R-TOOL-4   | **Documentation** | Each tool has its signature, parameters with defaults, output and one example, in one place | Critical |
| 5 | R-TOOL-5   | **Testing**       | Each tool's documented usage example is compiled once, in a scratch entry that is not committed, and its output is compared with what the documentation says it emits; an invalid argument must raise the tool's `@error`; delete the scratch entry and its output after the check | High     |

[↑ Back to top](#tools-segment-documentation)

## Related Files

| Segment                                   | Usage                                                 |
|-------------------------------------------|-------------------------------------------------------|
| **[Settings Segment](./settings.md)**     | Uses settings for breakpoints and other configuration |
| **[Components Segment](./components.md)** | Uses tools for consistent styling patterns            |
| **[Layout Segment](./layout.md)**         | Uses tools for responsive layouts                     |
| **[Utilities Segment](./utilities.md)**   | Uses tools for utility class generation               |
| **[Modules Segment](./modules.md)**       | Uses tools when composing modules from components     |
| **[Objects Segment](./objects.md)**       | Uses tools when authoring an object's pattern         |
| **[Pages Segment](./pages.md)**           | Uses tools in a page's own styles                     |

[↑ Back to top](#tools-segment-documentation)
