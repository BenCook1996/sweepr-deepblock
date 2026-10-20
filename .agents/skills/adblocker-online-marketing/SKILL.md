---
name: adblocker-online-marketing
description: >-
  Use this skill when designing online marketing funnels, Conversion Rate Optimization (CRO),
  pricing tiers, product-led viral loops, community seeding (Reddit, Hacker News, Product Hunt),
  creator affiliate programs, or lifecycle retention campaigns for an adblocker product.
---

# Adblocker Online Marketing, CRO & Product-Led Growth Skill

Selling a paid or freemium adblocker requires overcoming two core market objections:
1. *"Why pay when free adblockers exist?"*
2. *"Can I trust this software with my browsing data?"*

This skill equips the agent to structure high-converting sales channels, pricing architectures that generate immediate cashflow for marketing reinvestment, and zero-cost community & viral loops.

## Core Workflow

1. **Position Around Differentiated Paid Value (The "Why Pay?" Framework)**
   Never pitch a paid adblocker solely as "blocks banner ads." Position the paid product around capabilities free browser extensions cannot easily sustain:
   - **System-Wide & Cross-Device Protection**: Blocking ads inside desktop apps, mobile apps, smart TVs, and encrypted DNS level.
   - **Zero-Config Resilient Video & Streaming Blocking**: Instant rapid-response filter updates when video platforms change anti-adblock scripts.
   - **Anti-Malvertising, Phishing & Identity Shield**: Protecting non-technical users or families from scam popups, fake download buttons, and session trackers.
   - **Strict Zero-Telemetry & No "Acceptable Ads" Bribes**: Explicit commitment that ad networks cannot pay to whitelist their ads (unlike AdBlock Plus).

2. **Optimize Sales Channel Conversion Rate (Landing Page & Onboarding CRO)**
   Follow the architecture in [conversion-funnels-and-community.md](./references/conversion-funnels-and-community.md):
   - **Above-the-Fold Rule**: Dynamic browser/OS detection on the CTA button (e.g., *"Add to Chrome — Free"* or *"Download for Windows — 7-Day Pro Trial"*), accompanied by an instant visual counter or side-by-side speed comparison.
   - **The "Post-Install Welcome Page" Funnel**: For browser extensions, `chrome.runtime.onInstalled` opens a dedicated onboarding tab. This page has **100% open rate** and is your #1 monetization surface. Offer a limited-time **"Founder's Upgrade / Annual or Lifetime Pro Pass"** on this welcome screen.
   - **Pricing Architecture for Cashflow Reinvestment**:
     - Offer a low-friction Monthly anchor (e.g., £2.99/mo), a high-value **Annual Plan** (e.g., £19.99–£24.99/yr billed upfront), and an optional **Lifetime / Family License** (e.g., £39.99–£49.99 one-time).
     - Upfront Annual and Lifetime collections create **Day-1 positive cashflow** so £10/day ad spend can be recouped and compounded immediately rather than waiting 6 months for monthly subscriptions to pay back CAC.

3. **Execute Community Seeding & Trust-Building**
   - **Open-Source Core or Public Filter Audit**: Publish either your core engine, filter lists, or a reproducible privacy audit on GitHub.
   - **Reddit & Forum Playbook**: Engage authentically in `r/privacy`, `r/browsers`, `r/Adblock`, `r/techsupport`, and `r/macapps` / `r/ios`. Lead with technical breakdowns (e.g., *"How we engineered a declarativeNetRequest filter to cut RAM usage by 42%"*) rather than sales pitches.

4. **Engineer Product-Led Viral & Referral Loops**
   - **The "Privacy Shield Scorecard" Share Loop**: Inside the extension dashboard, generate a sleek monthly summary card (*"Blocked 14,820 ads, 4,190 trackers, and saved 1.4 GB of bandwidth this month with [Brand]"*) with 1-click sharing to X/Reddit and a referral link.
   - **Give-1-Get-1 Referral Mechanics**: Let free-tier users unlock 30 days of Pro (or custom cosmetic rules / DNS sync) for every friend who installs via their invite link.

## Validation Checklist

- [ ] Pricing page includes an upfront Annual or Lifetime tier that exceeds target CAC on Day 1.
- [ ] Extension/App opens a high-converting Welcome/Onboarding tab immediately upon installation.
- [ ] Trust signals (No Acceptable Ads pledge, privacy policy in plain English, independent benchmark score) appear directly adjacent to the checkout CTA.
