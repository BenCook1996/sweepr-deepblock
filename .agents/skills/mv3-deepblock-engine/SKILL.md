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
