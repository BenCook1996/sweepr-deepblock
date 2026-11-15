# SWEEPR DeepBlock — Manifest V3 Ad & Video Blocker, Auto Cookie Rejector & Scam Shop Detector

**Official Website:** [https://sweeprdeepblock.com](https://sweeprdeepblock.com)  
**1-Click Browser Download:** [https://sweeprdeepblock.com/download](https://sweeprdeepblock.com/download)  
**Live Ad & Tracker Leak Test Lab:** [https://sweeprdeepblock.com/test-lab](https://sweeprdeepblock.com/test-lab)  
**Privacy Policy:** [https://sweeprdeepblock.com/privacy](https://sweeprdeepblock.com/privacy)

[![Version](https://img.shields.io/badge/version-v1.2.9-10b981?style=flat-square)](https://sweeprdeepblock.com/download)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3%20(253%20DNR%20Rules)-0f172a?style=flat-square)](https://sweeprdeepblock.com)
[![Local-First Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20On--Device-059669?style=flat-square)](https://sweeprdeepblock.com/privacy)

---

## Official Browser Extension Listings

- **Google Chrome Web Store:** [SWEEPR DeepBlock — Block Ads, Cookie Pop-Ups & Fake Shops](https://chromewebstore.google.com/detail/sweepr-deepblock-ad-cooki/bkdfhdgmglfancgpkcbdceinfdlccmpc) (`bkdfhdgmglfancgpkcbdceinfdlccmpc`)
- **Mozilla Firefox Add-ons (AMO):** [SWEEPR DeepBlock for Firefox](https://addons.mozilla.org/en-US/firefox/addon/sweepr-deepblock/) (`extension@sweeprdeepblock.com`)
- **Direct Packages & Release Assets:** See [GitHub Releases](https://github.com/BenCook1996/sweepr-deepblock/releases) or [https://sweeprdeepblock.com/download](https://sweeprdeepblock.com/download)

---

## Core Protection Architecture (v1.2.9)

1. **Zero-Latency Video & Banner Ad Blocking (MV3 `declarativeNetRequest`):**
   - Compiled **253 C++ Chromium `declarativeNetRequest` rules** (15μs lookup latency, zero background page bloat) + over-the-air delta filter updates (`dynamic_delta`).
   - Stops pre-roll and mid-roll video ads, ad-shield popunders, Clickadu WASM workers, and display ad networks across desktop and mobile browsers without breaking site playback or layout.
2. **Automatic Cookie Consent Pop-Up Rejector (`<50ms`):**
   - Automatically detects and selects **"Reject All"** / **"Necessary Only"** across **150+ GDPR & CCPA Consent Management Platforms (CMPs)** in under 50 milliseconds while keeping page scroll unlocked (`overflow` restoration).
3. **AI Slop Search Result Cleanser:**
   - Filters low-quality AI content farms and deceptive sponsored blocks out of Google, Bing, and DuckDuckGo search results locally in the browser.
4. **14-Point Fake Online Shop & Scam Detector:**
   - Evaluates live storefront signals including RDAP domain registration age, fabricated countdown timers, suspicious payment patterns, and cloned e-commerce templates before checkout.
5. **Private, Tracker-Free URL Hygiene & Total Tab & RAM Tamer:**
   - Strips URL tracking parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`) and safely hibernates inactive background tabs to reduce browser memory usage while sparing active audio, video, and unsaved forms.

---

## Local-First Privacy Guarantee

SWEEPR DeepBlock runs its filtering, cookie rejection, search cleansing, and scam-store heuristics **100% locally on your device**. The extension never uploads, logs, or sells your browsing history, search queries, form inputs, or personal data. Read the full policy at [https://sweeprdeepblock.com/privacy](https://sweeprdeepblock.com/privacy).
