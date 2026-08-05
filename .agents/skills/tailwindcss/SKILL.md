---
name: tailwindcss
description: Reference for writing or reviewing Tailwind CSS v4 code — utility classes, installation, and the CSS-first configuration model. Use this skill any time the user is building, styling, or troubleshooting a website or UI with Tailwind CSS, mentions "Tailwind" or utility classes, asks to set up or upgrade Tailwind in a project, asks about a specific utility (e.g. "what's the gap utility", "how do I do a gradient border"), or pastes Tailwind class names that look off or outdated. Tailwind v4 changed enough from v3 (CSS-first config via @theme, no tailwind.config.js by default, new import syntax) that older training data is likely to produce broken or deprecated code — consult this skill before writing Tailwind config or setup code even if you're confident about the utility classes themselves.
---

# Tailwind CSS (v4)

Tailwind CSS is a utility-first CSS framework: instead of writing custom CSS, you compose pre-defined utility classes directly in markup (`class="flex items-center gap-4 rounded-lg bg-white p-6 shadow-md"`).

This skill exists because **Tailwind v4 (released early 2025) changed core mechanics that a lot of pretrained knowledge still gets wrong.** The utility class names themselves (`flex`, `text-lg`, `hover:bg-blue-500`, etc.) are mostly unchanged from v3 and safe to write from memory. What's *not* safe is anything touching setup, configuration, or the build pipeline — that's where outdated patterns silently produce broken projects. Read the sections below before writing any Tailwind config or install steps; for everyday utility classes, just write them, falling back to `references/tailwindcss-llms.txt` (see bottom) only when you're unsure a utility exists or what category it lives in.

## What changed in v4 (read this first)

If you're about to write setup code, a config file, or `@import`/`@tailwind` directives, check this list. Each of these is a common way old training data breaks a v4 project:

1. **No `tailwind.config.js` by default.** Configuration now lives in CSS using `@theme`, directly in your main stylesheet. Don't generate a `tailwind.config.js` with `theme.extend` unless the user's project already has one and is intentionally staying on the JS-config path (v4 still supports it for compatibility, but it's not the default or recommended approach).

2. **One import line, not three `@tailwind` directives.** v3 used:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
   v4 uses a single line:
   ```css
   @import "tailwindcss";
   ```
   Writing the old three-directive form into a v4 project's CSS will not work as expected.

3. **Theme customization via `@theme`, not `theme.extend`.** Custom colors, fonts, spacing, breakpoints, etc. are defined as CSS custom properties inside an `@theme` block in your CSS file:
   ```css
   @theme {
     --color-brand: #7c3aed;
     --font-display: "Satoshi", "sans-serif";
     --breakpoint-3xl: 120rem;
   }
   ```
   This automatically generates corresponding utilities (`bg-brand`, `text-brand`, `font-display`, `3xl:flex`, etc.). Don't reach for a JS theme object as the first instinct.

4. **Automatic content detection — no `content: []` array.** v3 required listing template paths so Tailwind knew which files to scan for class names. v4 detects this automatically by scanning the project respecting `.gitignore`. Don't generate a `content` array unless the project needs to scan somewhere unusual (e.g. outside the project root), in which case use the `@source` directive in CSS instead:
   ```css
   @source "../node_modules/@my-company/ui-lib";
   ```

5. **Installation is most commonly a build tool plugin, not PostCSS-by-default.** The most seamless path for Vite-based setups (and frameworks like Laravel, SvelteKit, React Router, Nuxt, SolidJS) is the dedicated `@tailwindcss/vite` plugin, not the PostCSS plugin. For Next.js or Angular, PostCSS (`@tailwindcss/postcss`) is the right path. There's also a standalone CLI (`@tailwindcss/cli`) for projects with no other build step, and a Play CDN for zero-build prototyping. Pick based on the project's actual stack rather than defaulting to the old `npx tailwindcss init` + PostCSS combo. When unsure which install path fits, check `references/tailwindcss-llms.txt` for the relevant installation doc link (see bottom of this file) rather than guessing.

6. **Variants use `:where()`-based selectors and support arbitrary CSS at-rules.** Things like `not-*`, container queries (`@container`, `@sm:`, etc. on a container-typed element), and `starting:` (for `@starting-style`) are native v4 variants. If the user's project looks like it needs scroll-driven or container-query-based responsiveness, these are likely the right tool rather than reaching for custom CSS or JS.

7. **Dynamic values without arbitrary-value brackets in more places.** v4 lets many utilities accept arbitrary-ish values without `[...]` bracket syntax when they resolve against the theme scale (e.g. spacing utilities can take any value that fits the underlying scale). Bracket syntax (`w-[32rem]`, `bg-[#1da1f2]`, `top-[117px]`) is still correct and necessary for genuinely arbitrary one-off values — don't avoid it out of habit, but don't assume it's the *only* way to express a custom value either.

8. **Gradients are renamed `bg-linear-*`.** `bg-gradient-to-r` / `bg-gradient-to-b` etc. from v3 are now `bg-linear-to-r` / `bg-linear-to-b`. There are also new `bg-radial-*` and `bg-conic-*` utilities for radial/conic gradients that didn't exist in v3.

9. **Opacity is a slash modifier, not a separate utility, almost everywhere.** `bg-opacity-50` as a standalone v3 utility is gone — opacity is expressed inline with a modifier on the color utility itself, e.g. `bg-black/50`, `text-white/75`. This pattern (already partially true in v3) is now the only way for most color-related opacity.

10. **Plugins load with `@plugin` in CSS, not the JS `plugins: []` array.** e.g. `@plugin "@tailwindcss/typography";` placed in the same CSS file as the `@import`.

If the user is upgrading an existing v3 project rather than starting fresh, point them to the official upgrade guide rather than hand-translating their whole config from memory — `references/tailwindcss-llms.txt` has the link, and the migration involves an automated tool (`npx @tailwindcss/upgrade`) that handles most of the mechanical changes, including class renames in template files.

## Writing utility classes

This is the part of Tailwind that's safe to write directly without consulting anything:

- **Layout & spacing**: `flex`, `grid`, `gap-*`, `p-*` / `px-*` / `py-*`, `m-*`, `w-*`, `h-*`, `max-w-*`
- **Typography**: `text-*` (size), `font-*` (weight/family), `leading-*`, `tracking-*`
- **Color & backgrounds**: `bg-{color}-{shade}`, `text-{color}-{shade}`, `border-{color}-{shade}` (shades run 50–950)
- **Borders & radius**: `border`, `border-{width}`, `rounded-*`
- **Effects**: `shadow-*`, `opacity-*` (whole-element opacity), `blur-*`, `backdrop-*`
- **Flexbox/Grid placement**: `items-*`, `justify-*`, `grid-cols-*`, `col-span-*`
- **State variants**: prefix any utility with `hover:`, `focus:`, `active:`, `disabled:`, `dark:`, etc. — these stack, e.g. `dark:hover:bg-slate-800`
- **Responsive variants**: prefix with a breakpoint, e.g. `md:flex`, `lg:grid-cols-3` — mobile-first, so the unprefixed utility is the default/smallest screen

Per-property opacity (a color at partial opacity, rather than the whole element) uses the slash modifier described above (`bg-black/50`), not a separate `bg-opacity-*` utility — that standalone form was removed.

When composing a non-trivial UI (cards, nav bars, forms, dashboards), write classes directly inline rather than reaching for `@apply` to fake reusable "components" — that pattern fights against how v4's CSS-first model and Tailwind's own usage guidance both push toward composing utilities directly in markup, extracting to actual framework components (React/Vue/etc.) when reuse is genuinely needed.

## When you're not sure a utility exists or what it's called

The exact CSS property name is usually the Tailwind utility name too (`box-shadow` → utilities under "box-shadow", `aspect-ratio` → `aspect-*`). If you're unsure whether Tailwind has a utility for some CSS behavior, or what category it falls under (Layout, Flexbox & Grid, Spacing, Typography, Backgrounds, Borders, Effects, Filters, Transitions & Animation, Transforms, Interactivity, SVG, Accessibility, Tables), check `references/tailwindcss-llms.txt`. It's a flat index of every docs page on tailwindcss.com with a one-line description and URL — grep it for a CSS property or concept name to find the right doc page and confirm the utility exists before inventing a plausible-looking class name. It does not contain the actual class syntax (no `flex-row` vs `flex-col` examples, etc.), only page titles, categories, and descriptions, so use it to confirm *where to look*, not as a source of exact syntax — fetch the linked URL if you need the precise class names and values.
