---
name: adblocker-digital-advertising
description: >-
  Use this skill when planning, launching, or scaling paid digital advertising campaigns,
  navigating ad-network policy restrictions for adblockers, writing high-converting ad creative,
  or modeling revenue-reinvestment budgets (including micro-budgets such as £10/day).
---

# Adblocker Digital Advertising & Revenue-Reinvestment Skill

Advertising an adblocker presents a unique paradox: major ad platforms (Google, Meta) depend on ad revenue and scrutinize creatives that directly attack their business model, while privacy-conscious users often ignore traditional banner ads. This skill provides the exact playbook to buy profitable traffic starting at **£10/day** and compound revenue back into paid acquisition.

## Core Workflow

1. **Apply the Ad Policy Compliance Shield ("Benefit-First Framing")**
   Before launching ads on Google, Microsoft/Bing, or Meta, consult [paid-channels-and-policy-playbook.md](./references/paid-channels-and-policy-playbook.md):
   - **Never** mention breaking specific platform monetization (e.g., do not put *"Block YouTube Ads"* in paid Google Ads headlines — this triggers immediate policy disapproval under Terms of Service / Circumventing Systems).
   - **Always** frame paid search/social creatives around **Web Performance, Privacy Protection, Anti-Malvertising, and Clean Browsing** (e.g., *"Stop Intrusive Popups & Hidden Trackers"*, *"Load Pages 3x Faster & Cut Browser RAM by 40%"*, *"Block Malicious Redirects & Scam Overlays"*). Reserve platform-specific topics for organic SEO and community channels.

2. **Allocate Micro-Budgets (£10/Day) Using the "Single-Channel Concentration" Rule**
   Never split £10/day across 4 ad networks (£2.50/day per network cannot exit algorithmic learning phases). Concentrate 100% of the initial £10/day into **one primary high-intent channel** + **one retargeting/exact-match layer**:
   - **£7.50/day — Primary Acquisition**:
     - *If Browser Extension / Desktop*: **Reddit Ads** (Targeted Subreddit CPC campaigns in `r/browsers`, `r/techsupport`, `r/pcmasterrace`, `r/macapps`, `r/chrome` with comments enabled and transparent founder copy).
     - *If iOS/macOS Native*: **Apple Search Ads (ASA)** on exact-match terms (`safari ad blocker`, `popup blocker`).
   - **£2.50/day — High-Intent Search & AI Capture (Microsoft/Bing + Copilot Ads)**:
     - **Microsoft Advertising (Bing Search + Copilot Native)**: Target exact-match competitor renewal & popup-blocker keywords (`[total adblock alternative]`, `[total adblock cancel]`, `[adguard alternative]`) at 30%–46% lower CPC than Google. Add Multimedia/Logo assets so your £2.50/day campaign automatically serves inside **Microsoft Copilot** conversational answers on Windows/Edge.
   - **Meta Ads (Facebook/Instagram) Stage-Gated Rule**:
     - Do **not** run cold Meta prospecting in Stage 1 (£10/day)—94%+ of Meta traffic is mobile in-app browser (which cannot install desktop extensions), Meta requires ~£20–£50/day per ad set to exit the 50-conversions/week learning phase, and Meta applies a 2% UK regulatory fee.
     - Deploy **Meta Ads in Stage 2 (£4–£5/day)** strictly for **Warm Retargeting** (`/welcome` and `/test` non-buyers), and unlock **Cold Meta Reels in Stage 3–4 (£20+/day)** only via a **Direct-to-Checkout + Email Desktop Link** funnel (with -90% Placement Value Rules on mobile if desktop-only).

3. **Deploy Lo-Fi Native & Demonstration Ad Creatives**
   - Use **5-to-12 second split-screen video/GIF recordings**: Left side shows a cluttered, slow news/recipe page choking on popups (RAM counter at 1.8 GB); Right side shows instant 0.4s clean load with your adblocker active (RAM at 420 MB).
   - Use the **PAS (Problem–Agitate–Solve)** or **Transparency Founder Hook** for Reddit/X ads.

4. **Run the Compounding Revenue-Reinvestment Engine**
   Execute the financial simulator script [reinvestment_simulator.mjs](./scripts/reinvestment_simulator.mjs) to calculate stage-gate transitions:
   ```bash
   node .agents/skills/adblocker-digital-advertising/scripts/reinvestment_simulator.mjs
   ```
   - **Reinvestment Formula**:
     $$\text{Daily Budget}_{t+1} = £10 + \frac{\text{Net Revenue}_{t} \times \text{Reinvestment Rate}}{30}$$
   - Maintain a **70%–80% Net Revenue Reinvestment Rate** during Stages 1–3 once Return on Ad Spend ($\text{ROAS}$) exceeds $1.3\times$, unlocking higher-minimum channels:
     - **ChatGPT Ads (`ads.openai.com`)** at Stage 2/3 (requires **~£15–£19/day [$25 USD/day]** minimum per campaign; uses semantic **Context Hints** targeting Free/Go-tier troubleshooting chats).
     - **Newsletter Sponsorships** at £150–£300/drop.
     - **EthicalAds / Carbon Ads** at £750+/mo.
     - *Note on Claude (Anthropic)*: Claude is strictly 100% ad-free (*"Claude is a space to think"* — no paid ad platform exists). Capture Claude's ad-averse user base via GEO (`llms.txt` + benchmark citations) under `adblocker-seo-aso`, and use the "AI Chatbot Ad Wars" as a creative hook on Reddit/X.

## Validation Checklist

- [ ] Ad copy passes the Compliance Shield check (zero trademark/ToS-circumvention triggers in paid headlines).
- [ ] All ad destination URLs include standardized UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`).
- [ ] Conversion tracking fires on both **Free Install (`install_complete`)** and **Paid Checkout (`purchase_complete` with GBP value)**.
- [ ] Reinvestment simulator has been run to verify CAC, ROAS, and daily budget scaling thresholds.
