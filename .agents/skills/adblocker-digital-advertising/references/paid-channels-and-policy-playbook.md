# Paid Channels, Ad Policy Compliance & Creative Playbook (GBP / UK & Tier-1 Markets)

## 1. Channel-by-Channel Economics & Minimum Budget Thresholds

| Channel | Best Stage | Est. CPC (GBP) | Est. Install CVR | Policy Sensitivity | Strategic Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Reddit Ads (Subreddit CPC)** | Stage 1 (£10/day) | £0.35 – £0.85 | 15% – 28% | Low (allows direct adblock/privacy messaging) | Best Day-1 cold traffic source for tech/privacy users. |
| **Microsoft / Bing + Copilot Ads** | Stage 1–4 (£2.50–£60/day) | £0.45 – £1.10 | 22% – 38% | Low–Medium (Software Downloads disclosure required) | **#1 Desktop Search Channel**: 30–46% cheaper than Google, serves in **Microsoft Copilot**, supports LinkedIn profile overlays. |
| **Meta Ads (Warm Retargeting)** | Stage 2–4 (£4–£15/day) | £0.45 – £0.95 | 18% – 32% (Checkout) | Medium (2% UK regulatory fee; avoid "spyware" scare copy) | Retargets `/welcome` & `/test` visitors who didn't buy Pro; bypasses 50-event learning floor. |
| **Meta Ads (Cold Reels/Feed)** | Stage 3–4 (£20–£50+/day) | £0.65 – £1.50 (£8–£18 CPM) | 12% – 22% (Quiz Funnel) | Medium–High (Advantage+ mobile skew requires Quiz->Checkout funnel) | Must route mobile clicks to **Direct-to-Checkout + Email Desktop Install Link** (Total Adblock playbook). |
| **Apple Search Ads (ASA)** | Stage 1–2 (if iOS/Mac) | £0.60 – £1.40 | 35% – 55% | Low (native Content Blocker category approved) | Highest store-to-install conversion rate in digital advertising. |
| **Google Search Ads** | Stage 2–3 (£20+/day) | £0.90 – £2.40 | 20% – 35% | **High** (strict ToS around YouTube & circumvention) | Target competitor alternatives & anti-popup/malvertising keywords only. |
| **ChatGPT Ads (`ads.openai.com`)** | Stage 2–4 (£15+/day min; ideal at £50+/day total budget) | £1.95 – £3.90 ($2.50–$5.00) | 32% – 45% | Low–Medium (restricts rival AI generators, permits browser utilities) | High-trust "Sponsored" slot at bottom of Free/Go tier chats via **Context Hints**. |
| **Claude (Anthropic)** | N/A (No Paid Ads) | N/A (100% Ad-Free) | N/A | **Strict No-Ad Pledge** (*"Claude is a space to think"*) | Cannot buy ads. Capture Claude's ad-averse users via GEO (`llms.txt`) & Reddit/X hooks. |
| **Niche Privacy Newsletters** | Stage 3 (£30+/day) | £0.50 – £1.20 (eff.) | 18% – 30% | None (Direct sponsor) | Fixed-fee sponsorships (£100–£350) in tech/privacy newsletters. |
| **EthicalAds / Carbon Ads** | Stage 4 (£50+/day) | £0.80 – £1.80 (eff.) | 10% – 20% | None (Privacy-native) | Contextual developer/privacy placements (~£780 / $1,000 min spend). |

---

## 2. Ad Policy Compliance Matrix (What Gets Approved vs. Banned)

| Element | ❌ Disapproved / High Ban Risk | ✅ Approved & High-Converting |
| :--- | :--- | :--- |
| **Headline** | *"Block All YouTube & Twitch Video Ads Free"* | *"Stop Annoying Popups, Auto-Play Video & Trackers"* |
| **Value Prop** | *"Bypass Paywalls and Defeat Anti-Adblockers"* | *"Browse 3x Faster: Lightweight Privacy & Popup Shield"* |
| **Security Angle** | *"Google Is Spying On You — Block Their Ads"* | *"Protect Your Browser From Malvertising & Scam Redirects"* |
| **Competitor Angle** | *"uBlock Origin Is Dead on Chrome"* | *"Built for Modern Chrome (MV3): Zero-Lag Tracker Blocker"* |

---

## 3. High-Converting Ad Copy Templates (Ready to Deploy)

### Template A: Reddit Promoted Post ("The Transparent Founder")
- **Target Subreddits**: `r/browsers`, `r/chrome`, `r/firefox`, `r/macapps`, `r/techsupport`, `r/pcmasterrace`
- **Headline**: `We got tired of bloated adblockers eating 1GB of RAM and selling "Acceptable Ads" whitelists—so we built a lightweight alternative. [Open for feedback]`
- **Media**: 8-second side-by-side MP4 recording of a heavy news site loading in 0.4s with 0 trackers vs 6.2s without.
- **CTA Button**: `Install Free` / `Learn More`

### Template B: Microsoft/Bing & Google Search Exact-Match ("Competitor Renewal Switcher")
- **Target Keywords**: `[total adblock alternative]`, `[total adblock renewal cost]`, `[best popup blocker chrome]`, `[adguard alternative]`
- **Headline 1**: `Tired of £99 Adblock Renewals?`
- **Headline 2**: `Transparent Pricing — £19.99/Yr or Lifetime`
- **Headline 3**: `Blocks Popups, Trackers & Malvertising Instantly`
- **Description**: `Switch in 30 seconds. Lightweight Manifest V3 engine, zero telemetry, no "Acceptable Ads" bribes. Try free today with our 30-day guarantee.`

### Template C: ChatGPT Self-Serve Ads (`ads.openai.com` — Stage 2/3 Context-Hint Campaign)
- **Minimum Campaign Budget**: £15–£19/day ($25 USD/day minimum)
- **Context Hints (Ad-Group Semantic Prompts)**:
  1. *"User asking how to speed up a slow Chrome or Edge browser, reduce high RAM memory usage, or stop laggy tabs caused by heavy scripts."*
  2. *"User troubleshooting annoying popup redirects, fake virus warnings, malvertising overlays, or recipe/news website clutter."*
  3. *"User comparing adblockers after Chrome Manifest V3 updates or looking for a transparent alternative to expensive £99/year adblock subscription renewals."*
- **Sponsored Response Copy**: `Stop browser bloat and hidden trackers at the source. [Brand] cuts tab RAM usage by up to 42% and blocks intrusive popups with zero telemetry. Test your browser's leak score in 10 seconds.`
- **CTA**: `Run Free Browser Leak Test` $\rightarrow$ `/test?utm_source=chatgpt&utm_medium=cpc&utm_campaign=stage2_context_hints`

### Template D: Meta Ads (Facebook/Instagram) — Warm Retargeting (Stage 2) & Cold Reels Quiz Funnel (Stage 3)
- **2026 Placement & Mobile Workaround**:
  - Since Meta's Advantage+ removes hard ad-set device checkboxes and 94% of traffic is mobile in-app browser, **never send cold Meta clicks directly to the Desktop Chrome Web Store**.
  - **Stage 2 Warm Retargeting (£4–£5/day)**: Target custom audience `welcome_tab_visitors_non_buyers_30d`. Creative shows a 6-second reminder: *"Still on the Free Tier? Unlock System-Wide DNS + Streaming Turbo + 5-Device Protection for £19.99/yr (or £44.99 Lifetime) before your 48-hour Founder Pass expires."*
  - **Stage 3 Cold Reels Campaign (£20–£35/day)**: Apply **Placement Value Rules** (-90% bid modifier on Audience Network/in-stream) and route mobile/desktop clicks to `yourdomain.com/quiz` (Funnel B: 20-sec Tracker Exposure Scan $\rightarrow$ Direct Annual/Lifetime Checkout $\rightarrow$ Instant Magic Install Link emailed to their desktop + iOS/Android activation).
  - **UK Billing Note**: Factor in Meta's **2% UK Regulatory Operating Fee** (+ VAT if unregistered) in ROAS calculations.

### Template E: Microsoft Advertising (Bing Search + Copilot Native + LinkedIn Overlay)
- **Software Downloads Policy Compliance**: Landing page MUST clearly show Publisher Name, exact renewal price (£19.99/yr), OS/browser requirements, and a 1-click "How to Uninstall" footer link to pass Microsoft editorial review.
- **Copilot Native Activation**: Attach Logo, Image, and Multimedia extensions to your exact-match search ad group so Microsoft automatically injects your product into **Windows Copilot / Edge Copilot** answers when users ask about slow browsers or popups.
- **LinkedIn Profile Bid Modifiers**: Add **+25% Bid Adjustment** on LinkedIn Industry segments (*Software & IT Services*, *Financial Services*) where Lifetime (£44.99) uptake is highest.

---

## 4. Standardized UTM Taxonomy

Every paid link must append:
`?utm_source={platform}&utm_medium={cpc|sponsor}&utm_campaign={stage}_{funnel_type}&utm_content={creative_id}`
Example:
`?utm_source=reddit&utm_medium=cpc&utm_campaign=stage1_welcome_upsell&utm_content=splitscreen_ram_v1`
