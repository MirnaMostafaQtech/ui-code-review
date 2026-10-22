# Performance Bundle Size Budget

[← Back to README](../README.md)

This document specifies how the compiled CSS of this architecture is measured and what sizes it should stay within. The measurement commands below are examples for a project to run.

**No baseline has been measured.** No project has recorded measurements yet, so every number below is a target chosen to be tight enough to be useful. The first project to run the procedure records its real figures, and the budgets are re-set from them.

| # | Section                                                 | What it covers                                                            |
|---|---------------------------------------------------------|---------------------------------------------------------------------------|
| 1 | [What is measured](#what-is-measured)                   | Which stylesheets are budgeted, and that the per-page total is the figure |
| 2 | [Measurement basis is gzip](#measurement-basis-is-gzip) | Why gzip is the basis, and how to measure                                 |
| 3 | [The budget](#the-budget)                               | The per-page ceiling and each entry's share of it                         |
| 4 | [When a budget is exceeded](#when-a-budget-is-exceeded) | What happens, and what does not                                           |
| 5 | [Calibrating the numbers](#calibrating-the-numbers)     | That every figure is a target, not a measurement, and how to re-set it    |

---

## What is measured

A page loads nine stylesheets in the canonical list; more when a project links a second vendor build or a legacy stylesheet (see [HTML and CSS Output Reference](./output.md)). Eight of them are produced or hand-authored by this architecture and are budgeted. The ninth — the vendor framework build (Bootstrap in these examples) — is not.

Because all nine are render-blocking, the meaningful number is the **per-page total**, not any single file. The per-file figures below are allocations inside that total.

[↑ Back to top](#performance-bundle-size-budget)

## Measurement basis is gzip

Sizes are measured **gzip-compressed**. Two consequences follow:

- **Raw size is not budgeted.** CSS compresses at roughly five to one, so a raw-size budget describes a file nobody downloads.
- **Brotli is not the basis either**, even where a server sends it. Brotli output is typically smaller than gzip for the same file, so a gzip budget is the conservative figure. A project that serves brotli is simply further inside its budget than the number says.

Measure with Node.js. A project on the Node route already has it; a project on the Web Compiler route installs it to run this command:

```bash
node -e "const z=require('zlib'),f=require('fs');for(const p of process.argv.slice(1))console.log((z.gzipSync(f.readFileSync(p)).length/1024).toFixed(1)+' KB', p)" common/common.min.css utilities/utils.min.css
```

Pass every stylesheet the page links. A project on the Web Compiler route passes the files under their `.min.css` names; a project on the Node route passes the `.css` names that route produces — see [Build Documentation](./build.md).

[↑ Back to top](#performance-bundle-size-budget)

## The budget

**Per-page ceiling: 60 KB gzip**, counting only the stylesheets this architecture produces or authors.

| Entry                                 | Budget (gzip) | Why this share                                                                                                                                                                                        |
|---------------------------------------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `common.min.css`                      | 20 KB         | The largest share, because it is the only bundle that amortizes: it is downloaded once and cached across the whole application, and it carries every object, component and module used by five or more page entries, or needed by any layout. |
| The four `theme/` CSS files, combined | 3 KB          | Custom property declarations and font rules. They ship unminified by design, but they are highly repetitive and compress hard.                                                                        |
| `*.layout.min.css`, each              | 8 KB          | Cached across every page that uses that layout, so it amortizes too — across fewer pages than `common`, but across more than one.                                                                     |
| `*.page.min.css`, each                | **12 KB**     | The tightest allocation and the one that matters most. A page bundle is not cached across pages, and it is where duplicated rules land.                                                               |
| `utils.min.css`                       | 8 KB          | Most utilities are hand-written; the text-color and background-color utilities are generated from the settings color maps, so growth here comes from new hand-written utilities or from new map entries — each color family or step adds generated classes.                                        |
| **Allocated total**                   | **51 KB**     |                                                                                                                                                                                                       |
| **Headroom to the ceiling**           | **9 KB**      | Deliberate. One entry going over its allocation should not by itself put the page over the ceiling.                                                                                                   |

The per-page total is `common` + the four `theme/` files + one layout + one page + `utils`.

### Vendor CSS is measured but not budgeted

A vendor framework build — Bootstrap in these examples — is linked prebuilt and is never compiled from source, so no decision a developer makes can change its size. Giving it a budget would spend a large share of the ceiling on something nobody can act on.

Measure it once per locale build and record the figure beside the others, so the true per-page download is known, then leave it out of the budget arithmetic. Expect it to be the single largest stylesheet on the page. That is a reason to keep the eight budgeted files honest, not a reason to relax them.

### Source maps are outside the budget

Source maps are committed on both build routes, and there is no separate production build that strips them — see [Build Documentation](./build.md). A browser requests a `.map` file only when developer tools are open, so a map costs an ordinary visitor nothing and is not counted here. The `sourceMappingURL` comment left in each compiled file does ship, but it is one line and falls well inside the headroom above.

[↑ Back to top](#performance-bundle-size-budget)

## When a budget is exceeded

**Exceeding a budget warns. It never fails a build.** No gate is introduced by this document and there is no automated pipeline to hang one on.

Stated plainly rather than implying enforcement that does not exist: this budget is a review signal, and it is only as strong as the person who reads the recorded numbers before a release. Run the measurement at release, record the figures, and review acts on them or nothing does.

What to do when a figure is over:

| # | When                           | What to check                                                                                                                                                                                                                                                                                        |
|---|--------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | A page bundle is over 12 KB    | check which components or modules several page entries import directly instead of through `common`. That is the usual cause.                                                                                                                                                                         |
| 2 | `common.min.css` is over 20 KB | look for the opposite mistake: something only a few pages use that was put in `common` anyway. A component belongs in `common` only once five or more page entries use it, or any layout needs it.                                                                                                   |
| 3 | `utils.min.css` is over 8 KB   | most utilities there are hand-written, so the usual cause is new hand-written utilities being added; check for ones nothing uses. Text-color and background-color utilities are generated from the settings color maps, so growth can also come from a new color family or step added to those maps. |
| 4 | A layout bundle is over 8 KB   | the same question as a page bundle: is anything in it shared with another layout, and therefore `common`'s?                                                                                                                                                                                          |

[↑ Back to top](#performance-bundle-size-budget)

## Calibrating the numbers

Every figure in the budget table is a target, not a measurement.

The first project to run the procedure should:

1. Measure every budgeted stylesheet, gzip, and record the per-page total for its largest page and for its smallest.
2. Compare the figures against the table above and adjust the allocations to sit a little above what a healthy page actually weighs — close enough that ordinary growth trips them.

A budget set far above reality never fires and is decoration. A budget set below reality fires constantly and gets ignored. Neither is worth recording.

[↑ Back to top](#performance-bundle-size-budget)
