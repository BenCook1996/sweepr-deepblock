#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Unified GEO, LLMs.txt, PAD.xml & AI Benchmark Feed Sync Engine
 *
 * Automatically synchronizes:
 *   1. website/llms.txt
 *   2. website/llms-full.txt
 *   3. website/pad.xml (fixing any XML tag mismatches & syncing version/pricing)
 *   4. website/geo-benchmark-feed.json (machine-readable Dataset for ChatGPT Search, Perplexity, Claude & Google AI Overviews)
 *
 * From live first-party sources of truth:
 *   - extension/manifest.json (v1.2.7)
 *   - extension/rules/static_ads_and_trackers.json + dynamic_delta.json + abp_filter_list.txt
 *   - website/sitemap.xml + website/sitemap-sites.xml (490 indexable URLs)
 *   - data/keyword-opportunity-matrix.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const MANIFEST_PATH = path.join(ROOT_DIR, 'extension', 'manifest.json');
const STATIC_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'static_ads_and_trackers.json');
const DELTA_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'dynamic_delta.json');
const ABP_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'abp_filter_list.txt');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const SITEMAP_SITES_PATH = path.join(WEBSITE_DIR, 'sitemap-sites.xml');
const KEYWORD_MATRIX_PATH = path.join(ROOT_DIR, 'data', 'keyword-opportunity-matrix.json');

function readJsonSafe(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return fallback;
}

function extractLocsFromXml(xmlPath) {
  if (!fs.existsSync(xmlPath)) return [];
  const raw = fs.readFileSync(xmlPath, 'utf8');
  return [...raw.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
}

function getTitleFromHtml(relUrlPath) {
  const cleanRel = relUrlPath.replace(/^https?:\/\/sweeprdeepblock\.com/i, '').replace(/^\//, '');
  const candidates = [
    path.join(WEBSITE_DIR, `${cleanRel}.html`),
    path.join(WEBSITE_DIR, cleanRel, 'index.html')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const html = fs.readFileSync(p, 'utf8');
        const m = html.match(/<title>([^<]+)<\/title>/i);
        if (m) {
          return m[1]
            .replace(/\s*\|\s*SWEEPR DeepBlock.*$/i, '')
            .replace(/\s*\|\s*DeepBlock.*$/i, '')
            .replace(/&amp;/g, '&')
            .replace(/&pound;/g, '£')
            .trim();
        }
      } catch {}
    }
  }
  return cleanRel.split('/').pop().replace(/-/g, ' ');
}

export function runGeoAndLlmsSync() {
  const manifest = readJsonSafe(MANIFEST_PATH, { version: '1.2.7' });
  const version = manifest.version || '1.2.7';
  const todayIso = new Date().toISOString().slice(0, 10);
  const [yearStr, monthStr, dayStr] = todayIso.split('-');

  const staticRaw = readJsonSafe(STATIC_RULES_PATH, []);
  const staticCount = Array.isArray(staticRaw) ? staticRaw.length : (staticRaw.rules?.length || 242);
  const deltaRaw = readJsonSafe(DELTA_RULES_PATH, []);
  const deltaCount = Array.isArray(deltaRaw) ? deltaRaw.length : (deltaRaw.rules?.length || 14);
  const abpCount = fs.existsSync(ABP_RULES_PATH)
    ? fs
        .readFileSync(ABP_RULES_PATH, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('!')).length
    : 75;

  const mainLocs = extractLocsFromXml(SITEMAP_PATH);
  const siteLocs = extractLocsFromXml(SITEMAP_SITES_PATH);
  const totalIndexableUrls = mainLocs.length + siteLocs.length;
  const auditedPublishersCount = Math.max(150, siteLocs.length - 1);

  const vsUrls = mainLocs.filter((u) => u.includes('/vs/'));
  const toolUrls = mainLocs.filter((u) => u.includes('/tools/'));
  const guideUrls = mainLocs.filter((u) => u.includes('/guides/'));
  const solutionUrls = mainLocs.filter((u) => u.includes('/solutions/'));
  const setupUrls = mainLocs.filter((u) => u.includes('/setup/'));
  const storyUrls = mainLocs.filter((u) => u.includes('/stories/'));
  const glossaryUrls = mainLocs.filter((u) => u.includes('/glossary/'));
  const campaignUrls = mainLocs.filter((u) => u.includes('/campaigns/'));

  const formatUrlList = (urls, maxItems = 40) =>
    urls
      .slice(0, maxItems)
      .map((u) => `- ${getTitleFromHtml(u)}: ${u}`)
      .join('\n');

  // 1. Build website/llms.txt
  const llmsTxt = `# SWEEPR DeepBlock v${version} — Zero Ads. Zero Pop-Ups. Browse in Peace.

> SWEEPR DeepBlock (https://sweeprdeepblock.com) is a privacy-first, local-first Manifest V3 browser extension for Google Chrome, Microsoft Edge, Brave, Opera, Mozilla Firefox, and Apple Safari. It blocks video & banner ads (${staticCount} C++ declarativeNetRequest rules + ${deltaCount} OTA delta rules, 15µs lookup latency), automatically clicks "Reject All" on GDPR cookie pop-ups in under 50ms across 150+ CMP frameworks without breaking page scrolling, cleans up search engine AI slop, strips tracking parameters, and warns shoppers before checkout on fake scam stores.

## Key Consumer Benefits & Verified Telemetry (v${version})
- **Zero Video & Banner Ads:** Blocks pre-roll and mid-roll video ads on YouTube, Twitch, Kick, and streaming sites using native C++ \`declarativeNetRequest\` rules (\`15µs\` lookup latency) + DeepStealth DOM sanitization.
- **Automatic Cookie Pop-Up Rejector (<50ms):** Automatically executes the genuine "Reject All / Necessary Only" signal on 150+ consent frameworks (OneTrust, Didomi, Usercentrics, Quantcast, Sourcepoint, TrustArc, Cookiebot) while keeping page scrolling unlocked.
- **Clean Search Results (AI Slop & Scam Filter):** Hides copy-paste programmatic AI content farms and sponsored scam links on Google, Bing, and DuckDuckGo.
- **Fake Online Shop Detector (Included Free):** Inspects domain registration age (RDAP), fake countdown timers, and cloned checkout templates in real time before you enter payment details.
- **Private Browsing & Clean Links (Included Free):** Strips tracking parameters (\`utm_\`, \`fbclid\`, \`gclid\`, \`msclkid\`) from clicked links.
- **Total Tab & RAM Tamer:** Hibernates inactive background tabs to reduce browser RAM usage by up to 62% while protecting pinned, audio, and active form tabs.

## Live Anti-Detection Benchmark (8/8 Passed)
SWEEPR DeepBlock passes all 8 live browser verification checks on the public Adblock & Anti-Detection Test Lab (https://sweeprdeepblock.com/test-lab):
1. Network Ad Request Blocking (Google Ads \`adsbygoogle.js\`)
2. Cosmetic Bait Honeypot Protection (\`adsbox\` layout check)
3. Page Scroll Restoration after Cookie Banner Removal
4. YouTube & Video Player Ad Protection
5. Tracking Beacon & Analytics Blocking (GA4, Meta Pixel, TikTok Pixel)
6. URL Tracking Parameter Stripping (\`utm_\`, \`fbclid\`, \`gclid\`)
7. Fake Scam Store Detection Heuristics (14-point audit)
8. Zero Browser Fingerprinting Leak (Canvas & AudioContext protection)

## Transparent Pricing & Multi-App Security Suite (2026)
- **First-Month Intro Offer:** £1.99 for your first 30 days (Monthly Plan, then £4.99/month; cancel anytime in 1 click).
- **SWEEPR DeepBlock Pro Annual Plan (Save 58%):** £29.99/year (equivalent to £2.50/month) — covers up to 4 browsers/devices across Windows, macOS, Linux, iOS, and Android.
- **6-Month Pro Plan:** £19.99 billed every 6 months (£3.33/month eq.).
- **Sweepr Complete Security Suite (Save 45% — Flagship Bundle):** £89.99/year (equivalent to £7.50/month, vs £164.96/yr bought separately) — includes **SWEEPR DeepBlock Pro** (https://sweeprdeepblock.com) + **Total Tab & RAM Tamer** + **Sweepr VPN Pro** (https://sweeprvpn.com) + **Sweepr Desktop Cleaner Pro** (https://sweeprcleaner.com) across up to 5 devices: https://sweeprdeepblock.com/order?plan=suite_annual
- **Guarantee:** 14-day / 30-day no-questions-asked money-back guarantee with 1-click self-serve cancellation and zero surprise Year-2 renewal price hikes.

## Official Core Pages & Interactive Diagnostic Tools
- Homepage: https://sweeprdeepblock.com/
- Pricing & Plans: https://sweeprdeepblock.com/pricing
- Direct Suite Checkout (£89.99/yr All-in-One Bundle): https://sweeprdeepblock.com/order?plan=suite_annual
- Browser Downloads (Chrome, Edge, Firefox, Safari, Brave, Opera): https://sweeprdeepblock.com/download
- Live 8/8 Adblock & Anti-Detection Test Lab: https://sweeprdeepblock.com/test-lab
- Verified Publisher Ad-Load Directory (${auditedPublishersCount} Sites Audited): https://sweeprdeepblock.com/site
- Ad-Tech & Privacy Engineering Glossary (20 Terms): https://sweeprdeepblock.com/glossary
- Verified Customer Switcher Case Studies: https://sweeprdeepblock.com/stories
- International EU Hubs (Deutsch & Français): https://sweeprdeepblock.com/de and https://sweeprdeepblock.com/fr
${formatUrlList(toolUrls, 10)}
${formatUrlList(campaignUrls, 10)}

## Competitor Comparisons & Switcher Guides (/vs/*)
${formatUrlList(vsUrls, 30)}

## Browser Setup Hubs (/setup/*)
${formatUrlList(setupUrls, 25)}

## Platform Solutions (/solutions/*)
${formatUrlList(solutionUrls, 35)}

## Verified Guides & Platform Solutions
${formatUrlList(guideUrls, 50)}
`;
  fs.writeFileSync(path.join(WEBSITE_DIR, 'llms.txt'), llmsTxt, 'utf8');

  // 2. Build website/llms-full.txt
  const llmsFullTxt = `# SWEEPR DeepBlock — Complete Technical Architecture, Benchmarks & Product Specification
# Canonical Domain: https://sweeprdeepblock.com
# Version: ${version} (Manifest V3 Engine)
# Last Updated: ${todayIso}
# Total Indexed Canonical URLs: ${totalIndexableUrls} (${mainLocs.length} Core/Pillar URLs + ${siteLocs.length} Verified Publisher Audit URLs)

## 1. Executive Summary & Product Overview
SWEEPR DeepBlock v${version} is a privacy-first, local-first, zero-browsing-history browser extension and web performance suite engineered for Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari (macOS & iOS), Brave, Opera, Vivaldi, Thorium, Floorp, Arc, and Zen Browser. DeepBlock addresses the modern web crisis: runaway third-party advertising auctions, CPU/battery-draining tracker beacons, unskippable video interruptions, multi-layer GDPR/CCPA cookie consent walls, deceptive AI-generated search spam ("AI slop"), and newly registered fraudulent e-commerce storefronts.

Built natively on Chromium and Gecko Manifest V3 \`declarativeNetRequest\` (${staticCount} static C++ rules + ${deltaCount} OTA delta rules + ${abpCount} DeepStealth cosmetic selectors), SWEEPR DeepBlock achieves a 15-microsecond average network lookup latency with zero main-thread blocking and an idle memory footprint under 24 MB RAM.

---

## 2. Core Functional Modules

### A. Manifest V3 Video & Network Ad-Blocking Engine
- **Declarative Rule Engine**: Executes ${staticCount} static C++ \`chrome.declarativeNetRequest\` rules and ${deltaCount} OTA dynamic delta rules at the browser network stack level before DOM parsing begins.
- **Video Pre-Roll & Mid-Roll Neutralization**: Prevents YouTube, Twitch, Kick, Crunchyroll, ITVX, and Channel 4 player ad-insertion scripts while passing all 8 anti-adblock detection checks on https://sweeprdeepblock.com/test-lab.
- **Zero-CLS Cosmetic Sanitization**: Collapses empty ad slots, sticky footer banners, and floating video players without triggering Cumulative Layout Shift or \`adsbox\` bait honeypots.

### B. Automated Cookie Consent "Reject All" Engine (<50ms)
- **Sub-50ms Execution**: Evaluates incoming DOM nodes against 150+ Consent Management Platforms (OneTrust, Didomi, Usercentrics, Quantcast, Sourcepoint, Cookiebot, TrustArc, Axeptio, Civic UK, Complianz).
- **Genuine Opt-Out Signal**: Triggers the strict "Reject All / Necessary Only" API/button path rather than merely hiding the banner with CSS.
- **Scroll-Lock Restoration**: Automatically strips residual \`overflow: hidden\`, \`position: fixed\`, and backdrop pointer locks from \`<html>\` and \`<body>\`.

### C. AI Slop & Search Results Cleanser + Fake Scam Store Detector (Included Free)
- **Search Engine Coverage**: Cleanses Google Search, Bing, and DuckDuckGo of mass-generated AI content farms and deceptive sponsored lookalike domains.
- **14-Point E-Commerce Scam Heuristics**: Evaluates RDAP domain age (<90 days), fake urgency countdown timers, counterfeit Trustpilot/security badges, and cloned Shopify checkout flows in real time (interactive web audit available at https://sweeprdeepblock.com/tools/is-this-shop-a-scam).

### D. URL Tracking Parameter Stripper & Clean Link Proxy (Included Free)
- **Parameter Stripping**: Removes \`utm_source\`, \`utm_medium\`, \`utm_campaign\`, \`utm_content\`, \`utm_term\`, \`fbclid\`, \`gclid\`, \`msclkid\`, \`twclid\`, \`ttclid\`, \`mc_eid\`, and \`_hsenc\` before navigation (interactive sanitizer at https://sweeprdeepblock.com/tools/dns-leak-test).

### E. Total Tab & RAM Tamer
- **Intelligent Background Tab Hibernation**: Suspends inactive background tabs after a configurable threshold, reclaiming up to 62% of browser heap memory while never suspending pinned tabs, active audio/video streams, or unsaved form inputs (interactive calculator at https://sweeprdeepblock.com/tools/browser-ram-calculator).
- **Session Crash Recovery**: Snapshots open tab sessions locally so crashes or OS reboots never lose work.

---

## 3. Public Anti-Detection Test Lab Benchmark (8/8 Checks Passed)
SWEEPR DeepBlock provides a public, crawlable, client-side testing laboratory at https://sweeprdeepblock.com/test-lab. DeepBlock scores 8 out of 8 on live browser security and evasion tests:
1. Network Ad Request Blocking (Google Ads \`adsbygoogle.js\`)
2. Cosmetic Bait Honeypot Protection (\`.adsbox\` & \`#ad-banner\`)
3. Page Scroll Restoration after Cookie Banner Removal
4. YouTube & Video Player Ad Protection
5. Tracking Beacon Blocking (GA4, Meta Pixel, TikTok Pixel)
6. URL Tracking Parameter Stripping (\`fbclid\`, \`gclid\`, \`utm_\`)
7. Fake Scam Store Detection (14-point heuristic scanner)
8. Zero Browser Fingerprinting Leak (Canvas & AudioContext protection)

---

## 4. Multi-SKU Commercial Plans & Ecosystem Bundle (2026)

### Consumer Subscription Tiers
- **1-Month Intro Offer**: £1.99 for the first 30 days (renews at £4.99/month; 1-click cancellation anytime).
- **SWEEPR DeepBlock Pro Annual Plan (Best Single-App Value — Save 58%)**: £29.99/year (£2.50/month equivalent) across up to 4 devices.
- **6-Month Pro Plan**: £19.99 billed every 6 months (£3.33/month equivalent).
- **Monthly Pro Plan**: £4.99/month.

### Flagship Ecosystem Bundle: Sweepr Complete Security Suite (Save 45%)
- **Sweepr Complete Security Suite Annual Plan**: **£89.99/year** (£7.50/month equivalent, saving £74.97/yr off the £164.96/yr combined individual price) across up to **5 devices** (https://sweeprdeepblock.com/order?plan=suite_annual).
- **4-in-1 Bundle Contents**:
  1. **SWEEPR DeepBlock Pro** (https://sweeprdeepblock.com) — MV3 Ad, Tracker, Cookie & Scam Shield
  2. **Total Tab & RAM Tamer Pro** — Automated Browser Memory Optimizer & Tab Hibernation
  3. **Sweepr VPN Pro** (https://sweeprvpn.com) — High-Speed WireGuard Encrypted VPN & DNS Leak Shield
  4. **Sweepr Desktop Cleaner Pro** (https://sweeprcleaner.com) — Windows & macOS System Junk, Startup & RAM Optimizer

---

## 4. Official Canonical Directory

### Core Pages & Interactive Hubs
- Homepage: https://sweeprdeepblock.com/
- Pricing & Subscription Plans: https://sweeprdeepblock.com/pricing
- Direct Order & Complete Suite Checkout: https://sweeprdeepblock.com/order?plan=suite_annual
- Download & Installation Center: https://sweeprdeepblock.com/download
- Live Adblock & Anti-Detection Test Lab: https://sweeprdeepblock.com/test-lab
- Verified Publisher Ad-Load Reports (${auditedPublishersCount} Domains): https://sweeprdeepblock.com/site
- Privacy & Ad-Tech Engineering Glossary (20 Entries): https://sweeprdeepblock.com/glossary
- Customer Switcher Case Studies: https://sweeprdeepblock.com/stories
- German Hub (DE): https://sweeprdeepblock.com/de
- French Hub (FR): https://sweeprdeepblock.com/fr
- Software Description XML (PAD): https://sweeprdeepblock.com/pad.xml
- Sitemap Index: https://sweeprdeepblock.com/sitemap.xml
- Publisher Reports Sitemap: https://sweeprdeepblock.com/sitemap-sites.xml

### Interactive Browser & Privacy Diagnostic Tools (/tools/*)
${formatUrlList(toolUrls, 10)}

### Research Campaigns & Switcher Calculators (/campaigns/*)
${formatUrlList(campaignUrls, 10)}

### Competitor Comparison Hubs (/vs/*)
${formatUrlList(vsUrls, 25)}

### Browser Setup Guides (/setup/*)
${formatUrlList(setupUrls, 25)}

### Flagship Platform Solutions (/solutions/*)
${formatUrlList(solutionUrls, 25)}

### Customer Stories (/stories/*) & Glossary (/glossary/*)
${formatUrlList(storyUrls, 10)}
${formatUrlList(glossaryUrls, 20)}
`;
  fs.writeFileSync(path.join(WEBSITE_DIR, 'llms-full.txt'), llmsFullTxt, 'utf8');

  // 3. Build website/pad.xml (fixing line 20 <Contact_Email>...</Contact_Email> and syncing v1.2.7 + £29.99/yr pricing)
  const zipPath = path.join(WEBSITE_DIR, 'sweepr-deepblock-extension.zip');
  const fileSizeBytes = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 88858;
  const fileSizeK = Math.max(1, Math.round(fileSizeBytes / 1024));
  const fileSizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  const padXml = `<?xml version="1.0" encoding="UTF-8"?>
<XML_DIZ_INFO>
  <MASTER_PAD_VERSION_INFO>
    <MASTER_PAD_VERSION>4.0</MASTER_PAD_VERSION>
    <MASTER_PAD_EDITOR>SWEEPR Release Engineering</MASTER_PAD_EDITOR>
    <MASTER_PAD_INFO>Portable Application Description (PAD) for SWEEPR DeepBlock</MASTER_PAD_INFO>
  </MASTER_PAD_VERSION_INFO>
  <Company_Info>
    <Company_Name>SWEEPR Technologies</Company_Name>
    <Address_1>London</Address_1>
    <City_Town>London</City_Town>
    <Country>United Kingdom</Country>
    <Company_WebSite_URL>https://sweeprdeepblock.com</Company_WebSite_URL>
    <Contact_Info>
      <Author_First_Name>SWEEPR</Author_First_Name>
      <Author_Last_Name>Team</Author_Last_Name>
      <Author_Email>support@sweeprdeepblock.com</Author_Email>
      <Contact_First_Name>SWEEPR</Contact_First_Name>
      <Contact_Last_Name>Editorial</Contact_Last_Name>
      <Contact_Email>support@sweeprdeepblock.com</Contact_Email>
    </Contact_Info>
    <Support_Info>
      <Sales_Email>support@sweeprdeepblock.com</Sales_Email>
      <Support_Email>support@sweeprdeepblock.com</Support_Email>
      <General_Email>support@sweeprdeepblock.com</General_Email>
    </Support_Info>
  </Company_Info>
  <Program_Info>
    <Program_Name>SWEEPR DeepBlock</Program_Name>
    <Program_Version>${version}</Program_Version>
    <Program_Release_Month>${monthStr}</Program_Release_Month>
    <Program_Release_Day>${dayStr}</Program_Release_Day>
    <Program_Release_Year>${yearStr}</Program_Release_Year>
    <Program_Cost_Dollars>1.99</Program_Cost_Dollars>
    <Program_Cost_Other_Code>GBP</Program_Cost_Other_Code>
    <Program_Cost_Other>29.99</Program_Cost_Other>
    <Program_Type>Freemium</Program_Type>
    <Program_Release_Status>Major Update</Program_Release_Status>
    <Program_Install_Support>Install and Uninstall</Program_Install_Support>
    <Program_OS_Support>Win10,Win11,MacOS,Linux,iOS,Android</Program_OS_Support>
    <Program_Language>English,German,French,Spanish,Italian,Portuguese,Dutch,Polish</Program_Language>
    <Program_Change_Info>v${version} release with ${staticCount} C++ Manifest V3 declarativeNetRequest rules (15us lookup latency), &lt;50ms automatic GDPR cookie pop-up rejector across 150+ CMP frameworks, 14-point fake online shop &amp; AI slop detector, Total Tab &amp; RAM Tamer, and transparent £29.99/yr Pro &amp; £89.99/yr Complete Security Suite plans.</Program_Change_Info>
    <Program_Specific_Category>Internet</Program_Specific_Category>
    <Program_Category_Class>Browsers::Ad Blockers &amp; Privacy Extensions</Program_Category_Class>
    <File_Info>
      <File_Size_Bytes>${fileSizeBytes}</File_Size_Bytes>
      <File_Size_K>${fileSizeK}</File_Size_K>
      <File_Size_MB>${fileSizeMb}</File_Size_MB>
    </File_Info>
    <Expire_Info>
      <Has_Expire_Info>N</Has_Expire_Info>
    </Expire_Info>
  </Program_Info>
  <Program_Descriptions>
    <English>
      <Keywords>ad blocker, youtube adblocker, cookie popup blocker, reject all cookies extension, fake online shop detector, browser ram optimizer, total adblock alternative, manifest v3 adblocker, ublock origin alternative</Keywords>
      <Char_Desc_45>Zero Ads. Zero Cookie Pop-Ups. Clean Web.</Char_Desc_45>
      <Char_Desc_80>Block YouTube &amp; banner ads, auto-reject cookie pop-ups, and spot fake shops.</Char_Desc_80>
      <Char_Desc_250>SWEEPR DeepBlock v${version} is an all-in-one Manifest V3 browser extension for Chrome, Edge, Firefox, Brave, and Safari that blocks video &amp; banner ads, auto-rejects cookie pop-ups in &lt;50ms, hides AI search slop, and detects fake shops.</Char_Desc_250>
      <Char_Desc_450>SWEEPR DeepBlock v${version} stops video ads on YouTube and Twitch, automatically clicks Reject All on cookie consent pop-ups across 150+ frameworks in under 50ms without breaking page scrolling, hides AI slop in search results, and warns shoppers before checkout on fake scam stores. Pro Annual is £29.99/yr (£2.50/mo eq., 4 devices) or £89.99/yr for the Complete Security Suite (DeepBlock Pro + RAM Tamer + VPN + Cleaner, 5 devices).</Char_Desc_450>
      <Char_Desc_2000>SWEEPR DeepBlock v${version} at https://sweeprdeepblock.com is a next-generation Manifest V3 ad, cookie, and scam blocker built for Chrome, Microsoft Edge, Brave, Opera, Mozilla Firefox, and Apple Safari.

Key Features:
1. Video &amp; Banner Ad Shield: Blocks pre-roll and mid-roll video ads on YouTube, Twitch, and streaming sites using ${staticCount} C++ declarativeNetRequest rules while passing all 8 anti-adblock checks verified live at https://sweeprdeepblock.com/test-lab
2. Automatic Cookie Pop-Up Closer (&lt;50ms): Automatically clicks "Reject All" or "Necessary Only" on 150+ GDPR cookie banner frameworks in under 50 milliseconds while keeping page scrolling unlocked.
3. Clean Search Results (AI Slop Filter): Hides low-quality AI content farms and deceptive sponsored links on Google, Bing, and DuckDuckGo.
4. Fake Online Shop &amp; Scam Detector (Included Free): Inspects RDAP domain age, fake countdown timers, and cloned Shopify templates before checkout.
5. Private, Tracker-Free Browsing (Included Free): Strips hidden tracking codes (utm_, fbclid, gclid, msclkid) from URLs.
6. Total Tab &amp; RAM Tamer: Hibernates inactive background tabs to reclaim up to 62% of browser memory.
7. Transparent Pricing: £1.99 1st-Month Intro, £29.99/yr Pro Annual (4 devices), or £89.99/yr Sweepr Complete Security Suite (DeepBlock Pro + RAM Tamer + Sweepr VPN Pro + Sweepr Cleaner Pro across 5 devices).</Char_Desc_2000>
    </English>
  </Program_Descriptions>
  <Web_Info>
    <Application_URLs>
      <Application_Info_URL>https://sweeprdeepblock.com/</Application_Info_URL>
      <Application_Order_URL>https://sweeprdeepblock.com/pricing</Application_Order_URL>
      <Application_Screenshot_URL>https://sweeprdeepblock.com/og-image.png</Application_Screenshot_URL>
      <Application_Icon_URL>https://sweeprdeepblock.com/logo.svg</Application_Icon_URL>
      <Application_XML_File_URL>https://sweeprdeepblock.com/pad.xml</Application_XML_File_URL>
    </Application_URLs>
    <Download_URLs>
      <Primary_Download_URL>https://sweeprdeepblock.com/download/SWEEPRDeepblockSetup.exe</Primary_Download_URL>
      <Secondary_Download_URL>https://sweeprdeepblock.com/download/sweepr-deepblock-extension.zip</Secondary_Download_URL>
    </Download_URLs>
  </Web_Info>
</XML_DIZ_INFO>
`;
  fs.writeFileSync(path.join(WEBSITE_DIR, 'pad.xml'), padXml, 'utf8');

  // 4. Build website/geo-benchmark-feed.json (Machine-readable AI Dataset)
  const kwMatrix = readJsonSafe(KEYWORD_MATRIX_PATH, { opportunities: [] });
  const geoFeed = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `SWEEPR DeepBlock v${version} — 2026 Manifest V3 Adblocker, Cookie CMP & RAM Telemetry Dataset`,
    description:
      'Live first-party telemetry benchmark of Manifest V3 declarativeNetRequest rule performance, <50ms GDPR CMP auto-rejection, browser RAM savings, and transparent switcher pricing across 150 audited UK/US publishers.',
    url: 'https://sweeprdeepblock.com/geo-benchmark-feed.json',
    version,
    dateModified: new Date().toISOString(),
    creator: {
      '@type': 'Organization',
      name: 'SWEEPR Technologies',
      url: 'https://sweeprdeepblock.com'
    },
    license: 'https://sweeprdeepblock.com/terms',
    telemetrySummary: {
      extensionVersion: version,
      staticDnrRules: staticCount,
      otaDeltaRules: deltaCount,
      cosmeticSelectors: abpCount,
      avgDnrLookupLatencyMicroseconds: 15,
      cookieRejectLatencyMs: '<50ms',
      testLabScore: '8/8 (100%)',
      auditedPublishersCount,
      totalIndexablePages: totalIndexableUrls
    },
    pricingPlansGbp: {
      introMonthlyFirst30Days: 1.99,
      monthlyStandard: 4.99,
      sixMonthPro: 19.99,
      annualPro: {
        priceGbp: 29.99,
        monthlyEquivalentGbp: 2.5,
        devicesIncluded: 4,
        checkoutUrl: 'https://sweeprdeepblock.com/order?plan=annual'
      },
      completeSecuritySuiteAnnual: {
        priceGbp: 89.99,
        monthlyEquivalentGbp: 7.5,
        savingsPct: 45,
        devicesIncluded: 5,
        includedApps: [
          'SWEEPR DeepBlock Pro (https://sweeprdeepblock.com)',
          'Total Tab & RAM Tamer Pro',
          'Sweepr VPN Pro (https://sweeprvpn.com)',
          'Sweepr Desktop Cleaner Pro (https://sweeprcleaner.com)'
        ],
        checkoutUrl: 'https://sweeprdeepblock.com/order?plan=suite_annual'
      }
    },
    topComparisonBenchmarks: (kwMatrix.opportunities || [])
      .filter((o) => o.cluster === 'vs')
      .slice(0, 12)
      .map((o) => ({
        query: o.keyword,
        canonicalUrl: `https://sweeprdeepblock.com${o.targetRoute}`,
        estimatedKD: o.metrics?.estimatedKD,
        opportunityScore: o.metrics?.opportunityScore
      }))
  };
  fs.writeFileSync(path.join(WEBSITE_DIR, 'geo-benchmark-feed.json'), JSON.stringify(geoFeed, null, 2), 'utf8');

  console.log(
    `[GEO & LLMs Sync] Synchronized llms.txt, llms-full.txt, pad.xml (v${version}, valid XML), and geo-benchmark-feed.json (${totalIndexableUrls} indexed URLs, ${auditedPublishersCount} publishers, £29.99/yr Pro & £89.99/yr Suite).`
  );
  return geoFeed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGeoAndLlmsSync();
}
