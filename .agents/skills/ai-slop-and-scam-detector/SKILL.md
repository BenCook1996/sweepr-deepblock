---
name: ai-slop-and-scam-detector
description: >-
  Use this skill when building or tuning the AI Slop search result cleanser (Google, Bing, DuckDuckGo)
  or the Fake E-Commerce Store & Fake Amazon/Trustpilot Review Detector bundle module.
---

# AI Slop Search Purifier & Fake E-Commerce Store Detector Skill

## 1. AI Slop & SEO Content-Farm SERP Purifier

- **Target Search Engines:** Google (`google.*`), Bing (`bing.com`), DuckDuckGo (`duckduckgo.com`), Brave Search (`search.brave.com`).
- **Detection Heuristics & Domain Signatures:**
  - Known programmatic scraper patterns, multi-hyphenated SEO spam domains, auto-translated StackOverflow/Reddit clones, and low-trust AI-generated "Best X in 2026" affiliate farms.
  - Content signals in SERP snippets: repetitive LLM boilerplate phrases (*"In conclusion, when it comes to"*, *"delve into the tapestry"*, auto-generated author bylines, mass-generated dated titles).
- **Execution Modes:**
  - **Free Diagnostic Mode:** Highlights flagged SERP items with a warning pill (*"⚠️ AI Slop / Low-Trust Content Farm Detected"*) and increments `stats.aiSlopDetected`.
  - **Pro Active Mode:** Automatically collapses flagged results into a single expandable summary bar at the top of the SERP: *"🤖 X AI Slop & Scraper Results Hidden by Total Deepblock Pro (Click to Inspect)"*.

## 2. Fake E-Commerce Store & Review Detector (`DeepShop Shield`)

- **Dropshipping & Scam Store Heuristics (Shopify / WooCommerce):**
  - Check for fake scarcity/urgency scripts (`hurrify`, `countdown-timer`, fake *"Someone from [City] just bought this 2 minutes ago"* toasts).
  - Inspect merchant trust signals: missing physical address/company registration in footer, generic Gmail contact addresses on checkout stores, and 70%–90% site-wide strikethrough markdowns.
- **Fake Amazon & Review Authenticity Grader (A–F Score):**
  - Analyze review distribution skew (e.g., >85% 5-star burst with unverified purchases or repetitive AI-generated review phrasing).
  - Inject a clean **DeepShop Trust Grade Badge (`Grade A` to `Grade F`)** adjacent to the product title on Amazon and Shopify product pages.
