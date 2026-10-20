---
name: adblocker-seo-aso
description: >-
  Use this skill when planning, executing, or auditing Search Engine Optimization (SEO),
  Generative Engine Optimization (GEO), or App/Extension Store Optimization (ASO) for an
  adblocker, privacy extension, DNS filter, or tracker-blocking software product.
---

# Adblocker SEO, GEO & Extension Store ASO Skill

This skill provides an operator-grade workflow for driving high-intent organic search traffic and extension/app store installs for an adblocker product. Because adblocker buyers are privacy-conscious and skeptical of intrusive ads, organic search and store rankings are the highest-LTV acquisition channels.

## Core Workflow

1. **Map Intent Across the 4 Adblocker Search Pillars**
   Consult [keyword-clusters-and-aso.md](./references/keyword-clusters-and-aso.md) and build dedicated landing pages or programmatic hubs around four high-intent clusters:
   - **Platform & Site-Specific Pain Points**: Queries triggered by acute user frustration (e.g., *"block YouTube ads Chrome 2026"*, *"stop Twitch pre-roll ads"*, *"block recipe site popups on iPhone"*).
   - **Browser Ecosystem Shifts (Manifest V3 & Beyond)**: Capture switching intent when browsers restrict legacy extensions (e.g., *"best Manifest V3 adblocker"*, *"uBlock Origin alternative for Chrome"*).
   - **Competitor & Alternative Comparisons**: Bottom-of-funnel commercial intent (e.g., *"[Product] vs AdGuard"*, *"Total Adblock renewal price alternative"*, *"lightweight alternative to Ghostery"*).
   - **Adjacent Performance & Security Angles**: Capture users searching for symptoms of heavy ad trackers (e.g., *"speed up slow Chrome tabs"*, *"stop malvertising popups"*, *"reduce browser RAM usage"*).

2. **Optimize Extension & App Store Listings (ASO)**
   Extension stores (Chrome Web Store, Firefox Add-ons, Edge Add-ons, Apple App Store) function as closed search engines weighted by keyword relevance, conversion rate, review velocity, and **24-hour uninstall rate**:
   - **Title Formula**: `[Brand Name]: [Primary Keyword] & [Secondary Benefit]` (e.g., *"ShieldBlock: Fast Ad Blocker & Privacy Guard"* — stay under 45 characters on Chrome Web Store to prevent truncation).
   - **Short Description (132 chars max on CWS)**: Front-load the top 3 pain-point keywords and a quantifiable speed/privacy claim.
   - **Visual Carousel**:
     - Slide 1: Split-screen "Before vs. After" showing page load speed and clutter removal.
     - Slide 2: Extension popup UI highlighting the live "Ads & Trackers Blocked" counter.
     - Slide 3: One-click whitelist / custom element zapper / zero-telemetry pledge.
   - **In-Product Review Loop**: Trigger a non-intrusive review prompt inside the extension UI *only* after the user hits a positive value milestone (e.g., 500 or 1,000 ads blocked and at least 3 days post-install).

3. **Execute Generative Engine Optimization (GEO)**
   Modern users frequently ask AI assistants (ChatGPT, Perplexity, Gemini, Claude) *"What adblocker still works on Chrome?"*:
   - Maintain a public, crawlable **Benchmark & Transparency Page** publishing objective metrics: RAM footprint (MB), CPU overhead (%), filter list update frequency, and independent test scores (e.g., `d3ward` / `adblock-tester` score out of 100).
   - Use structured `SoftwareApplication` and `FAQPage` JSON-LD schema on all landing pages, explicitly declaring price, operating system compatibility, and ratings.

4. **Build Interactive Free Tools as Link Magnets**
   Create a free, client-side **"Ad & Tracker Leak Test"** page on your domain where visitors test how well their current browser blocks trackers. Score their browser from 0–100 and offer a 1-click install/upgrade CTA for every failed test category.

## Validation Checklist

- [ ] Every target landing page maps to a single primary search intent with `SoftwareApplication` JSON-LD schema.
- [ ] Store listing title is $\le 45$ characters and short description is $\le 132$ characters with primary keywords front-loaded.
- [ ] First-24-hour onboarding requires zero mandatory account creation before demonstrating core blocking value (protecting store ASO rankings).
