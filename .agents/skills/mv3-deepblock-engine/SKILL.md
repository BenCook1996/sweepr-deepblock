---
name: mv3-deepblock-engine
description: >-
  Use this skill when building or updating the Manifest V3 adblocking engine,
  automated GDPR/CCPA cookie consent "Reject All" responder, or recipe/news
  DOM clutter stripper without breaking page scroll or layout.
---

# Manifest V3 Deepblock Engine & Cookie Auto-Rejector Skill

## Core Architecture

1. **Manifest V3 `declarativeNetRequest` (DNR) Rulesets**
   - Separate static rulesets into modular JSON files under `extension/rules/`:
     - `static_ads_and_trackers.json`: High-priority network blocks for ad servers (`doubleclick.net`, `googlesyndication.com`, `adnxs.com`, `taboola.com`, `outbrain.com`), telemetry pixels, and pre-roll video ad endpoints.
     - `cryptominers.json`: Blocks known browser mining pools, CoinHive clones, and runaway WebSocket mining endpoints.
   - Maintain a Free Tier that blocks 100% of standard banner ads while running the **Live Diagnostic Counter** for advanced modern web blight (*Cookie Prompts, AI Slop Pages, Fake Review Sites, Clutter Overlays*).

2. **Sub-50ms Automated GDPR Cookie "Reject All" Engine**
   - **Never** click "Accept All" and **never** merely hide a CMP modal with `display: none` alone (which leaves `overflow: hidden` on `<html>`/`<body>` and freezes scrolling).
   - **Free Diagnostic Mode:** Detect CMP presence (`#onetrust-banner-sdk`, `#CybotCookiebotDialog`, `.qc-cmp2-container`, `#didomi-host`, `[aria-label*="cookie" i]`), increment `stats.cookiePromptsDetected`, and display a subtle badge prompt to enable Auto-Reject.
   - **Pro Active Mode:**
     1. Trigger native CMP reject selectors immediately (`#onetrust-reject-all-handler`, `#CybotCookiebotDialogBodyButtonDecline`, `.qc-cmp2-summary-buttons button[mode="secondary"]`, `.didomi-continue-without-agreeing`).
     2. Fallback to heuristic button matching for text matching `/^(reject all|decline all|necessary only|essential only|refuse all|continue without accepting)$/i`.
     3. Restore document scrolling (`document.documentElement.style.overflow = ''`, `document.body.style.overflow = ''`) and remove backdrop overlays.

3. **Recipe, News & Paywall-Overlay Clutter Stripper ("1-Click PureView")**
   - Detect recipe pages (`[itemtype*="schema.org/Recipe"]`, `.wprm-recipe-container`, `.tasty-recipes`) and inject a floating **"⚡ Jump to Clean Recipe"** pill at the top of the viewport that extracts ingredients and steps into a distraction-free glass card.
   - Strip newsletter signup modals, exit-intent popups, and sticky bottom-right autoplay video boxes.

4. **DeepStealth — 5-Layer Anti-Adblock Detection Evasion & Cloaking Engine**
   - **Layer 1 (DNR Surrogate Redirects):** Route anti-adblock bait script URLs (`adsbygoogle.js`, `gpt.js`, `uwt.js`, `/ads.js`, `/adframe.js`) to harmless `data:application/javascript` surrogate shims via `declarativeNetRequest` `redirect` rules (`priority: 10`) so `<script onerror>` never fires `net::ERR_BLOCKED_BY_CLIENT`.
   - **Layer 2 (`MAIN`-World Ad SDK Spoofing at `document_start`):** Inject `content/deepstealth-main.js` with `"world": "MAIN"` and `"run_at": "document_start"` to define spec-compliant stubs for `window.adsbygoogle`, `window.googletag`, `window.canRunAds = true`, `window.isAdBlockActive = false`, and neutralize `BlockAdBlock` / `FuckAdBlock` / `admiral` detection callbacks.
   - **Layer 3 (DOM Bait Geometry Proxy):** Proxy `HTMLElement.prototype.offsetHeight`, `offsetWidth`, `clientHeight`, `clientWidth`, `getBoundingClientRect`, and `window.getComputedStyle` so bait elements (`.adsbox`, `.pub_300x250`, `.text-ad`, `.ad-banner`) report non-zero dimensions (`250px` × `300px`) and `display: "block"` to anti-adblock scripts while remaining visually hidden (`opacity: 0; pointer-events: none; position: fixed; left: -9999px`).
   - **Layer 4 (`fetch` & `XMLHttpRequest` Probe Spoofer):** Intercept `window.fetch` and `XMLHttpRequest` calls to ad-bait probes in `MAIN` world and resolve with a synthetic `200 OK` response so probe promises never reject.
   - **Layer 5 (Active Anti-Adblock Wall Neutralizer):** Automatically strip Google Funding Choices (`.fc-ab-root`), Admiral, PageFair, and Sourcepoint adblock walls and restore `overflow: auto !important` on `<html>` and `<body>`.
