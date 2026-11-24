# Holographic Pearl Shell API (`scripts/lib/holographic-shell.mjs`)

Shared light-mode design system shell and authoritative M1 URL decision module for M2–M5 page generators and remediations.

## Constants & M1 Decision Exports
- `SITE_ORIGIN`: `'https://sweeprdeepblock.com'`
- `ASSET_VERSION`: `'20261122'`
- `PRODUCT_FACTS`: `{ name: 'SWEEPR Deepblock', version: '1.3.1', staticDnrRules: 283, staticRuleBreakdown: { adsAndTrackers: 264, cryptominers: 18, trackerParams: 1 }, operatingSystem, browsersLabel, devicesIncluded: 5, pricing }`
- `KEPT_DIRECTORY_95`: Structured object `{ core, locales, tools, vs, setup, guides, solutions }` containing all **95 `KEEP_REWRITE` URLs** with clean v1.3.1 labels.
- Re-exported from `scripts/lib/m1-decisions.mjs`:
  - `KEPT_REWRITE_PATHS`, `KEPT_URLS_SET` (`95`)
  - `CATEGORY_HUB_PATHS` (`4`: `/vs`, `/solutions`, `/setup`, `/guides`), `ALL_INDEXABLE_PATHS` (`99`), `ALL_INDEXABLE_SET` (`99`)
  - `CONSOLIDATE_301_ENTRIES`, `CONSOLIDATE_301_MAP`, `EXPLICIT_CONSOLIDATION_MAP` (`8`), `PILLAR_CONSOLIDATION_MAP` (`55`)
  - `NOINDEX_PRUNE_PATHS`, `NOINDEX_PRUNE_SET` (`121`)
  - `isNoIndexPrunePath(rawPath)` (returns `true` for all `NOINDEX_PRUNE` routes plus `/site` and `/site/*`)
  - `resolveConsolidationTarget(rawTarget)` (resolves redirect chains up to 3 hops)
  - `getM1Decision(rawPath)`

## Component & Page Helpers
- `escapeHtml(value)` — HTML entity escaping (`&`, `<`, `>`, `"`, `'`).
- `buildJsonLd({ canonicalUrl, breadcrumbs, includeSoftwareApp, softwareName, article, extraGraph })` — Returns `@graph` with `BreadcrumbList` + `SoftwareApplication` (`v1.3.1`, `283` rules, shipped platforms only, GBP `AggregateOffer`) and optional `TechArticle`, automatically filtering out any `FAQPage` or `HowTo` nodes.
- `renderHead({ title, description, canonicalUrl, lang, robots, ogType, hreflangs, jsonLd, extraHead, assetVersion })` — Emits `<meta name="color-scheme" content="light">`, `/sweepr-tailwind.min.css?v=20261122`, `/style.css?v=20261122`, `/nav.js?v=20261122`, `/i18n.js`, deferred GA4 (`/metrics/js?id=G-01MNBQSL9K`), and JSON-LD.
- `renderNav({ currentPath, lang })` — Canonical `.glass-nav` header with mobile-safe compact padding (zero `390px` truncation), `SWEEPR Deepblock` casing, Tile 1 `/vs/total-adblock`, Tile 2 `Total Tab & RAM Tamer` -> `/pricing`, `<a rel="nofollow" href="/login">`, and `Add to Browser`.
- `renderMainOpen({ maxWidth, extraClasses })` / `renderMainClose()` — `<main class="flex-1 w-full min-w-0 pt-24 sm:pt-32 pb-16 px-4 sm:px-6 ...">`.
- `renderBreadcrumbs(items)` — Light `<nav aria-label="Breadcrumb">`.
- `renderGlassCard({ title, badge, bodyHtml, id, extraClasses })` — Light `.glass-card`.
- `renderComparisonTable({ headers, rows, caption, id })` — Responsive light comparison table inside `overflow-x-auto`.
- `renderCallout({ title, bodyHtml, tone })` — Light callout (`tone`: `'emerald' | 'amber' | 'slate'`).
- `renderCtaBanner({ badge, heading, subtext, primaryLabel, primaryHref, secondaryLabel, secondaryHref })` — Light conversion card (`rel="nofollow"` added automatically on `/order*` or `/login*`).
- `renderRelatedGrid({ heading, items })` — Light `.glass-card` 4-column related links grid (`data-sweepr-related="1"`).
- `renderFooter({ currentPath, lang, includeMobileStickyCta })` — 2-line centered footer (`pt-8 pb-24 md:pb-8`; no `/site`, no pruned/301 URLs; emits `/privacy` and `/glossary` only on `/` and core root pages `/download`, `/pricing`, `/benchmarks`, `/test-lab`, `/support`, `/terms`, `/refund`, `/privacy` to preserve commercial link equity) + `<details>` drawer populated with kept URLs + `md:hidden` mobile sticky CTA bar.
- `renderShellPage(options)` — Composes a complete `<!DOCTYPE html>` Holographic Pearl document.

## Tailwind Build Constraint
All Tailwind utility classes in `holographic-shell.mjs` and templates calling it must remain plain static string literals supported by `scripts/build-static-tailwind.mjs` (no `${...}` inside `class="..."`, and avoid `overflow-x-hidden`, `break-words`, `align-top`, `space-x-*`). Rebuild `website/sweepr-tailwind.min.css` via `node scripts/build-static-tailwind.mjs` after adding new classes.
