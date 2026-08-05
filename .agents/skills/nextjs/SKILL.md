---
name: nextjs
description: Reference for writing or reviewing Next.js App Router code — routing conventions, layouts/pages, Server Actions, Route Handlers, proxy.ts, data fetching, caching/revalidation, and metadata. Next.js changes fast enough that pretrained knowledge is frequently stale (middleware→proxy rename, async cookies/headers, Cache Components/PPR, Turbopack as default) — use this skill instead of guessing APIs from memory.
---

# Next.js (App Router)

**Don't guess Next.js APIs from memory, and don't use a Next.js MCP server for this.** Next.js ships fast; a plausible-looking API from training data is often renamed, deprecated, or gated behind a config flag by the time you use it. Two sources of truth, in priority order:

1. **The version-matched docs bundled with the project's own install**, at `node_modules/next/dist/docs/` (present for any project on Next.js 15.5+). These match the exact installed version — always prefer them over anything else when they exist. Confirm the version first:
   ```bash
   grep '"version"' node_modules/next/package.json
   ```
2. **`references/nextjs-doc.md`** in this skill folder — a saved copy of `nextjs.org/docs/llms.txt`, the official index of every docs page with a one-line description and URL. Grep it to find the right page, then fetch that URL for full content. Use this when the bundled docs aren't available (dependencies not installed yet, or exploring a feature ahead of upgrading).

## Map of the bundled docs

If working from `node_modules/next/dist/docs/`, here's where things live (paths relative to `01-app/`) — grep for the topic, then read the one file, don't read them all:

| Path                                              | Covers                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `01-getting-started/`                              | Routing, layouts/pages, data fetching, mutating data, caching, revalidating, error handling, metadata, route handlers, proxy — start here for concepts |
| `02-guides/`                                       | Task-oriented: auth, forms, caching-without-cache-components, data-security, streaming, instrumentation, testing, self-hosting, migrating |
| `03-api-reference/01-directives/`                  | `use client`, `use server`, `use cache` (+ `use cache: private`/`remote`)          |
| `03-api-reference/02-components/`                  | `<Image>`, `<Link>`, `<Script>`, `<Form>`                                          |
| `03-api-reference/03-file-conventions/`             | `page`, `layout`, `route`, `proxy`, `error`, `not-found`, `loading`, `template`, parallel/intercepting routes, route groups, metadata files |
| `03-api-reference/04-functions/`                    | `cookies`, `headers`, `redirect`, `revalidatePath`/`revalidateTag`, `after`, `connection`, `generateMetadata`, `generateStaticParams`, `use-router`, etc. |
| `03-api-reference/05-config/01-next-config-js/`     | Every `next.config.ts` option (e.g. `cacheComponents`, `turbopack`)                |
| `02-pages/`                                         | Pages Router — only relevant if the project doesn't use the App Router            |
| `03-architecture/`                                  | Accessibility, Fast Refresh, compiler, browser support                            |

`references/nextjs-doc.md` mirrors this same structure as flat links (Getting Started, Guides, API Reference, Architecture, Community) — use it the same way when there's no local install to read from.

## Traps in pretrained knowledge (verify against the docs above before relying on these)

- **`middleware.ts` → `proxy.ts`** (Next.js 16). The file convention was renamed; the exported function is named `proxy`, not `middleware`. Only one proxy function per file is supported.
- **Proxy has matcher gaps that silently affect Server Actions too.** Server Actions are POST requests to the route they're defined on, so a proxy matcher that excludes a path also skips proxy-based auth for Server Actions on that path. Don't rely on proxy alone for auth — verify inside each Server Action / Route Handler (defense in depth), matching the "Data Security" guide's recommendation.
- **`cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` are all async** (since Next.js 15) — always `await` them, including in Server Components, even where older examples show synchronous access.
- **`PageProps`/`LayoutProps` global type helpers** exist for typed `params`/`searchParams`/parallel-route slots — no manual prop-typing or imports needed: `PageProps<'/blog/[slug]'>`, `LayoutProps<'/dashboard'>`.
- **Cache Components / `use cache` / `cacheLife` / `cacheTag` / Partial Prerendering are opt-in** behind `cacheComponents: true` in `next.config.ts` (introduced in Next.js 16). Check that flag before assuming this model applies — if it's off, caching follows the "Previous Model": `fetch` cache options, `unstable_cache`, route segment config (`dynamic`, `revalidate`, `fetchCache`), `revalidatePath`/`revalidateTag`. Reaching for `use cache` in a project that doesn't have the flag enabled is a no-op.
- **Turbopack is the default bundler** for both `dev` and `build` since Next.js 16 — don't add webpack config assuming it's still the default, and don't assume Turbopack is experimental/opt-in.
- **Route Handlers vs Server Actions**: Server Actions are the default for app-owned mutations; reach for a `route.ts` Route Handler only when you need real HTTP semantics (webhooks, external callers, non-form content types).

## Workflow

1. Identify the concept (routing convention, data fetching, caching, Server Action, proxy, metadata, etc.).
2. Check whether `node_modules/next/dist/docs/` exists in the project — if so, grep/read the matching file using the map above. Otherwise grep `references/nextjs-doc.md` for the topic and fetch the linked URL.
3. Cross-check any project-specific conventions (e.g. a custom `AGENTS.md`, route group layout, or middleware→proxy migration already done) before writing code — this skill covers the framework, not a specific app's conventions.
4. Write the code, then run the project's lint/typecheck/build (e.g. `next lint`, `tsc --noEmit`, `next build`, or whatever wrapper the repo uses) before considering the task done.
