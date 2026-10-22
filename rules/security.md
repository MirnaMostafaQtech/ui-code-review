# UI security (SEC-xx)

Rules for front-end code in Angular templates and TypeScript, ASP.NET MVC Razor views and plain
scripts. The security reviewer (`agents/reviewer-security.md`) applies them to the changed lines only.
They cover what a reviewer can see in UI code; server-side checks (authorization, input validation on
the API, SQL) are out of scope.

## Rules

| ID | Severity | Check | Fix |
|---|---|---|---|
| SEC-01 | Error | HTML built from data that isn't a constant written in the code: `[innerHTML]` / `[outerHTML]` bound to API, route, user or translated-with-parameters data that the code also builds into HTML; `element.innerHTML =`, `outerHTML =`, `insertAdjacentHTML(...)`, `document.write(...)`; jQuery `.html(x)`, `.append(x)`, `.before(x)`, `.after(x)`, `$(x)` where `x` is a string with markup and data in it. | Render the data as text (interpolation, `textContent`, `.text()`), or build the elements with the framework. Keep `[innerHTML]` only for HTML the app itself owns. |
| SEC-02 | Error | Angular sanitization switched off: `bypassSecurityTrustHtml / Script / Style / Url / ResourceUrl(...)` on a value that isn't a constant written in the code. | Remove the bypass and let Angular sanitize; for a URL, check it against an allow-list before trusting it. |
| SEC-03 | Error | Razor output not encoded: `@Html.Raw(...)`, `new HtmlString(...)`, `MvcHtmlString.Create(...)` on model, ViewBag, ViewData, query or resource values that can hold user data; a value written into a `<script>` block without JSON encoding (`var x = '@Model.Name';`). | Let Razor encode (`@Model.Name`); in a script use `@Json.Serialize(...)` / `@Html.Raw(Json.Encode(...))` on the whole value. |
| SEC-04 | Error | Code run from a string: `eval(...)`, `new Function(...)`, `setTimeout('...')` / `setInterval('...')` with a string, `javascript:` URLs built from data. | Call the function directly; parse data with `JSON.parse`. |
| SEC-05 | Error | A secret in front-end code or a file the browser downloads: API keys, client secrets, passwords, connection strings, private tokens, in `environment*.ts`, config JSON under `assets/`, scripts or views. Public identifiers that are meant to be public (a map's public key the provider documents as browser-safe, an OAuth client id) are not this. | Move it to the server and fetch what the browser needs through the API; rotate the leaked value. |
| SEC-06 | Warning | A token, password or personal data stored in `localStorage` / `sessionStorage` / a cookie set from script (`document.cookie`). | Keep tokens in memory or in an `HttpOnly` cookie set by the server; don't store passwords or personal data in the browser. |
| SEC-07 | Warning | `target="_blank"` on a link to another site without `rel="noopener"` (or `noreferrer`); `window.open(url)` on another site without `noopener`. | Add `rel="noopener noreferrer"` / pass `'noopener'` to `window.open`. |
| SEC-08 | Warning | A script, style, API or iframe URL over plain `http://`; a script or stylesheet from a CDN with no `integrity` attribute. | Use `https://`; add `integrity` and `crossorigin="anonymous"` to CDN tags, or serve the file from the app. |
| SEC-09 | Error | A Razor form that posts without an antiforgery token: `Html.BeginForm` / `Ajax.BeginForm` with POST and no `@Html.AntiForgeryToken()` in it (ASP.NET MVC 5); an AJAX POST, PUT or DELETE from a view's script that sends no antiforgery token. The ASP.NET Core `<form method="post">` tag helper adds the token by itself: not this. | Add `@Html.AntiForgeryToken()` to the form, and send the token in a header for AJAX. |
| SEC-10 | Warning | Sensitive data written to the console or shown in an error message: tokens, passwords, full API responses with personal data, stack traces shown to the user. | Remove the log, or log only what's needed without the sensitive fields. |

## How the reviewer uses this file

- Report only findings on a line in `changedLines`, and only when you can point to the exact code.
- Follow the data: SEC-01, -02, -03 and -04 apply only when the value can come from outside the code
  (API, route, query, form input, storage, a translation with parameters). Read back to where the
  value is set before reporting. A constant written in the code, or a value the code builds only from
  constants, is not a finding.
- If deciding a finding needs a file you can't open (the service that fills a value, the server
  action), don't report it.
- Not in scope: `.spec.ts` and test files, code that is commented out, mock data, and sample values
  in documentation comments.
- One finding per rule per line.
