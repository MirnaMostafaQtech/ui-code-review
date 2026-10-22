# Images and assets (PERF-xx)

Rules for how templates, views and stylesheets load images, fonts and media. The performance reviewer
(`agents/reviewer-performance.md`) applies them to the changed lines only. CSS bundle size is AXIS's
(`skills/axis-scss/docs/guides/performance.md`), not this.

`assets` in target.json lists the image, font and video files the PR / changeset adds or changes, with
`sizeBytes`. Sizes of files the review didn't change aren't known.

## Rules

| ID | Severity | Check | Fix |
|---|---|---|---|
| PERF-01 | Warning | An `<img>` (or Angular `ngSrc` image) with neither `width` and `height` attributes nor a class or style that fixes its box (`aspect-ratio`, fixed `inline-size` and `block-size`). The page jumps when it loads. Icons sized by a class, and images with `fill` in `ngSrc`, are not this. | Add the image's real `width` and `height` attributes, or a class with `aspect-ratio`. |
| PERF-02 | Warning | A content image that isn't on screen when the page opens, without `loading="lazy"`: a photo, illustration, avatar or an image whose `src` comes from data (`[src]="item.photo"`, `src="@Model.ImageUrl"`), inside a repeated block (`*ngFor`, `@for`, Razor `foreach`), a table or grid row, a modal or dialog, a closed tab, accordion or dropdown, or the page footer. Icons are not this (see below). | Add `loading="lazy"` (and `decoding="async"`). |
| PERF-03 | Warning | A changed line uses an image, font or video from `assets` that is too big: a raster image (`png`, `jpg`, `gif`, `bmp`, `webp`, `avif`) over 200 KB, an `svg` over 100 KB, a font file over 150 KB, a video over 2 MB. | Compress or resize it (export at the size shown, use `webp`/`avif` for photos, subset the font to the scripts used), or load the video on demand. |
| PERF-04 | Warning | A `png`, `jpg` or `gif` used for an icon or a flat graphic (logo, arrow, symbol) where the project has, or could use, an `svg`. | Use the `svg` version. |
| PERF-05 | Warning | An `@font-face` without `font-display`; a web font loaded with CSS `@import url(...)` (it blocks rendering); a font file in `ttf`, `otf` or `eot` where `woff2` is available. | Add `font-display: swap`; load the font with a `<link>` in the page head or self-host it; use `woff2`. |
| PERF-06 | Warning | A `<video>` that autoplays or has `preload="auto"` without being the page's main content; an `<iframe>` (map, video, embed) off screen without `loading="lazy"`. | Use `preload="none"` or `metadata` and a poster image; add `loading="lazy"` to the iframe. |
| PERF-07 | Warning | An image referenced through a path the build won't find or rewrite: an absolute path to the dev server (`http://localhost`), a path to `src/assets/...` instead of `assets/...` in Angular, or `~/` used outside a Razor view. The image breaks in production. | Use the project's asset path (`assets/...` in Angular, `~/...` in a Razor view). |

## How the reviewer uses this file

- Report only findings on a line in `changedLines`, and only when you can point to the exact code.
- PERF-03 needs the file's size from `assets`. If the file isn't in `assets`, you don't know its size:
  don't report it.
- PERF-02: report only when the code shows the image is off screen (one of the listed containers).
  Don't guess from position in the file. Never report it for an icon: an `svg`, an image whose path
  has `icon` / `icons` in it, or a small UI image (arrow, bin, search, dots, close, check) used in a
  button, link, label or menu item. Icons are a few hundred bytes; lazy-loading them gains nothing
  and makes them pop in late. One finding per image element, not one per repeated copy.
- PERF-04: report only for an image whose name or use makes clear it is an icon or flat graphic
  (`icon-`, `arrow`, `logo`, inside a button next to text). Photos and illustrations are not this.
- Not in scope: commented-out code, `.spec.ts` and test files, images set by a CSS framework you
  weren't given.
- One finding per rule per line.
