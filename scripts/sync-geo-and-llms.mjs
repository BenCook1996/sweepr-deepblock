#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Unified GEO, LLMs.txt, PAD.xml & AI Benchmark Feed Sync Engine
 *
 * Automatically synchronizes:
 *   1. website/llms.txt
 *   2. website/llms-full.txt
 *   3. website/pad.xml (valid XML synced to extension/manifest.json v1.4.0 & pricing)
 *   4. website/geo-benchmark-feed.json (machine-readable Dataset for AI search crawlers)
 *
 * From live first-party sources of truth:
 *   - extension/manifest.json (v1.4.0, 5 static DNR rulesets)
 *   - extension/rules/static_ads_and_trackers.json + easyprivacy_trackers.json + regional_eu_filters.json + cryptominers.json + tracker_params.json + dynamic_delta.json + abp_filter_list.txt
 *   - extension/content/deepblock-content.js (verified CMP frameworks)
 *   - website/sitemap.xml (filtered against M1 KEEP_REWRITE / CONSOLIDATE_301 / NOINDEX_PRUNE decisions)
 *   - data/keyword-opportunity-matrix.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEPT_URLS_SET, isNoIndexPrunePath, CONSOLIDATE_301_MAP, normalizeUrlPath } from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');
const STATIC_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'static_ads_and_trackers.json');
const EASYPRIVACY_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'easyprivacy_trackers.json');
const REGIONAL_EU_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'regional_eu_filters.json');
const CRYPTO_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'cryptominers.json');
const TRACKER_PARAMS_PATH = path.join(EXTENSION_DIR, 'rules', 'tracker_params.json');
const DELTA_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'dynamic_delta.json');
const ABP_RULES_PATH = path.join(EXTENSION_DIR, 'rules', 'abp_filter_list.txt');
const CONTENT_SCRIPT_PATH = path.join(EXTENSION_DIR, 'content', 'deepblock-content.js');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
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
            .replace(/\s*\|\s*SWEEPR Deep[Bb]lock.*$/i, '')
            .replace(/\s*\|\s*Deep[Bb]lock.*$/i, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&pound;/g, '£')
            .replace(/\s*\(62%\s*Less\)/gi, '')
            .replace(/\bCut Browser RAM Usage 62%/gi, 'Cut Browser RAM Usage with Tab Hibernation')
            .replace(/\b62%(?:\s*(?:Less|Lower|Reduction(?:\s+in)?))?/gi, 'Lower')
            .replace(/\bHide AI Slop\s*(?:&|and)\s*Scam Shops?\b/gi, 'Block Malvertising & Trackers')
            .replace(/\bAI Slop\b/gi, 'Sponsored Clutter')
            .replace(/\bFake (?:Online )?Shops?\b/gi, 'Malvertising Redirects')
            .replace(/\bRecipe\b/gi, 'Food Blog')
            .replace(/\bDoH\b/gi, 'Network')
            .replace(/\bRDAP\b/gi, 'Domain')
            .replace(/15µs/gi, 'fast')
            .trim();
        }
      } catch {}
    }
  }
  return cleanRel.split('/').pop().replace(/-/g, ' ');
}

export function runGeoAndLlmsSync() {
  const manifest = readJsonSafe(MANIFEST_PATH, { version: '1.4.0' });
  const version = manifest.version || '1.4.0';
  const geckoMinVersion = manifest.browser_specific_settings?.gecko?.strict_min_version || '128.0';
  const todayIso = new Date().toISOString().slice(0, 10);
  const [yearStr, monthStr, dayStr] = todayIso.split('-');

  const countRulesInFile = (filePath, fallback = 0) => {
    const raw = readJsonSafe(filePath, null);
    if (!raw) return fallback;
    return Array.isArray(raw) ? raw.length : (raw.rules?.length || fallback);
  };

  const enabledResources = (manifest.declarative_net_request?.rule_resources || []).filter((r) => r.enabled);
  const rulesetCountsById = {};
  let staticCount = 0;
  for (const res of enabledResources) {
    const c = countRulesInFile(path.join(EXTENSION_DIR, res.path), 0);
    rulesetCountsById[res.id] = c;
    staticCount += c;
  }

  const staticBaseCount = rulesetCountsById.ads_and_trackers ?? countRulesInFile(STATIC_RULES_PATH, 20000);
  const easyPrivacyCount = rulesetCountsById.easyprivacy_trackers ?? countRulesInFile(EASYPRIVACY_RULES_PATH, 12000);
  const regionalEuCount = rulesetCountsById.regional_eu_filters ?? countRulesInFile(REGIONAL_EU_RULES_PATH, 4000);
  const cryptoCount = rulesetCountsById.cryptominers_and_heavy_scripts ?? countRulesInFile(CRYPTO_RULES_PATH, 18);
  const trackerParamsRaw = readJsonSafe(TRACKER_PARAMS_PATH, []);
  const trackerParamsCount = rulesetCountsById.tracker_param_stripping ?? (Array.isArray(trackerParamsRaw) ? trackerParamsRaw.length : (trackerParamsRaw.rules?.length || 1));
  if (staticCount === 0) {
    staticCount = staticBaseCount + easyPrivacyCount + regionalEuCount + cryptoCount + trackerParamsCount;
  }
  const rulesetsActive = enabledResources.length || 5;
  const trackerParamsList = Array.isArray(trackerParamsRaw) ? trackerParamsRaw : (trackerParamsRaw.rules || []);
  const trackerParamsStripped = trackerParamsList[0]?.action?.redirect?.transform?.queryTransform?.removeParams?.length || 229;

  let cmpFrameworksCount = 160;
  if (fs.existsSync(CONTENT_SCRIPT_PATH)) {
    try {
      const contentSrc = fs.readFileSync(CONTENT_SCRIPT_PATH, 'utf8');
      const cmpBlock = contentSrc.match(/const\s+CMP_FRAMEWORKS\s*=\s*\[([\s\S]*?)\r?\n\s*\];/);
      if (cmpBlock) {
        const names = new Set([...cmpBlock[1].matchAll(/\bname\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1].trim()));
        if (names.size >= 150) cmpFrameworksCount = names.size;
      }
    } catch {}
  }

  const deltaRaw = readJsonSafe(DELTA_RULES_PATH, []);
  const deltaCount = Array.isArray(deltaRaw) ? deltaRaw.length : (deltaRaw.dynamicDnrRules?.length || deltaRaw.rules?.length || 100);
  const otaCosmeticCount = Array.isArray(deltaRaw?.extraCosmeticSelectors) ? deltaRaw.extraCosmeticSelectors.length : 0;
  const abpCount = fs.existsSync(ABP_RULES_PATH)
    ? fs
        .readFileSync(ABP_RULES_PATH, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('!') && !l.startsWith('[')).length
    : 75;
  const staticCountFmt = staticCount.toLocaleString('en-US');

  const isKeptSitemapLoc = (loc) => {
    const p = normalizeUrlPath(loc);
    if (isNoIndexPrunePath(p) || CONSOLIDATE_301_MAP.has(p)) return false;
    return KEPT_URLS_SET.has(p) || p === '/vs' || p === '/solutions' || p === '/setup' || p === '/guides';
  };

  const mainLocs = extractLocsFromXml(SITEMAP_PATH).filter(isKeptSitemapLoc);
  const totalIndexableUrls = mainLocs.length;

  const vsUrls = mainLocs.filter((u) => u.includes('/vs/'));
  const toolUrls = mainLocs.filter((u) => u.includes('/tools/'));
  const guideUrls = mainLocs.filter((u) => u.includes('/guides/'));
  const solutionUrls = mainLocs.filter((u) => u.includes('/solutions/'));
  const setupUrls = mainLocs.filter((u) => u.includes('/setup/'));

  const formatUrlList = (urls, maxItems = 40) =>
    urls
      .slice(0, maxItems)
      .map((u) => `- ${getTitleFromHtml(u)}: ${u}`)
      .join('\n');

  // 1. Build website/llms.txt
  const llmsTxt = `# SWEEPR Deepblock v${version} — Zero Ads. Zero Pop-Ups. Browse in Peace.

> SWEEPR Deepblock (https://sweeprdeepblock.com) is a proprietary, privacy-first, local-first Manifest V3 browser extension for Google Chrome, Microsoft Edge, Mozilla Firefox (Gecko ${geckoMinVersion}+ Desktop & Android), Apple Safari (macOS & iOS), Brave, and Opera. New installs start an immediate no-card 7-day full Pro trial blocking video & banner ads (${staticCountFmt} static declarativeNetRequest rules across ${rulesetsActive} rulesets: ${staticBaseCount.toLocaleString('en-US')} EasyList ads/trackers + surgical allow rules, ${easyPrivacyCount.toLocaleString('en-US')} EasyPrivacy, ${regionalEuCount.toLocaleString('en-US')} Regional DE/FR/ES, ${cryptoCount} cryptominers, ${trackerParamsCount} URL tracking parameter rule stripping ${trackerParamsStripped} parameters + ${deltaCount} dynamic OTA rules + ${abpCount} cosmetic selectors), automatically clicking "Reject All" on GDPR cookie pop-ups across ${cmpFrameworksCount} CMP frameworks without breaking page scrolling, stripping ${trackerParamsStripped} tracking parameters, providing an interactive Element Zapper, and hibernating idle tabs with Total Tab & RAM Tamer.

## Key Consumer Benefits & Verified Capabilities (v${version})
- **No-Card 7-Day Full Pro Trial:** Fresh installs activate all Pro protections (YouTube Shield, Cookie Auto-Reject + Scroll Unlock, OTA Delta, Total Tab & RAM Tamer, 5-device sync) for 7 days with no credit card or license key required; Pro modules gate automatically after day 7 unless upgraded.
- **Zero Video & Banner Ads:** Blocks pre-roll and mid-roll video ads on YouTube, Twitch, and streaming sites using native Manifest V3 \`declarativeNetRequest\` rules (${staticCountFmt} static rules across ${rulesetsActive} rulesets + ${deltaCount} dynamic OTA rules) + DeepStealth DOM sanitization.
- **Automatic Cookie Pop-Up Rejector + Scroll Unlock:** Automatically executes the genuine "Reject All / Necessary Only" signal across ${cmpFrameworksCount} verified GDPR consent frameworks (OneTrust, Didomi, Usercentrics, Quantcast, Sourcepoint, TrustArc, Cookiebot, and 150+ regional CMPs) while keeping page scrolling unlocked.
- **URL Tracking Parameter Stripping (${trackerParamsStripped} Parameters):** Strips ${trackerParamsStripped} tracking parameters (\`utm_*\`, \`fbclid\`, \`gclid\`, \`msclkid\`, \`twclid\`, \`ttclid\`, etc.) from clicked links at the network layer.
- **Element Zapper & Anti-Adblock Stealth:** One-click visual page element removal paired with MAIN-world anti-adblock bait protection.
- **Total Tab & RAM Tamer:** Automatically hibernates inactive background tabs to reduce browser memory usage while protecting pinned, audio, and active form tabs.

## Live Anti-Detection Benchmark (Test Lab)
SWEEPR Deepblock verifies browser protection across 8 live checks on the public Adblock & Anti-Detection Test Lab (https://sweeprdeepblock.com/test-lab):
1. Network Ad Request Blocking (Google Ads \`adsbygoogle.js\`)
2. Cosmetic Bait Honeypot Protection (\`adsbox\` layout check)
3. Page Scroll Restoration after Cookie Banner Removal
4. YouTube & Video Player Ad Protection
5. Tracking Beacon & Analytics Blocking (GA4, Meta Pixel, TikTok Pixel)
6. URL Tracking Parameter Stripping (\`utm_\`, \`fbclid\`, \`gclid\`)
7. Third-Party Banner & Overlay Script Neutralization
8. Zero Browser Fingerprinting Script Exposure

## Transparent Pricing & Multi-App Security Suite (2026)
- **First-Month Intro Offer:** £1.99 for your first 30 days (Monthly Plan, then £4.99/month; cancel anytime in 1 click).
- **SWEEPR Deepblock Pro Annual Plan (Save 50%):** £29.99/year (equivalent to £2.50/month) — covers up to 5 browsers/devices across Windows, macOS, Linux, iOS (Safari), and Android (Firefox ${geckoMinVersion}+).
- **6-Month Pro Plan:** £19.99 billed every 6 months (£3.33/month eq.).
- **Sweepr Complete Security Suite (Save 45% — Flagship Bundle):** £89.99/year (equivalent to £7.50/month) — includes **SWEEPR Deepblock Pro** (https://sweeprdeepblock.com) + **Total Tab & RAM Tamer** + **Sweepr VPN Pro** (https://sweeprvpn.com) + **Sweepr Desktop Cleaner Pro** (https://sweeprcleaner.com) across up to 5 devices: https://sweeprdeepblock.com/order?plan=suite_annual
- **Trial & Guarantee:** No-card 7-day full Pro trial on install + 14-day money-back guarantee with 1-click self-serve cancellation and zero surprise Year-2 renewal price hikes.

## Official Core Pages & Interactive Diagnostic Tools
- Homepage: https://sweeprdeepblock.com/
- Pricing & Plans: https://sweeprdeepblock.com/pricing
- Direct Suite Checkout (£89.99/yr All-in-One Bundle): https://sweeprdeepblock.com/order?plan=suite_annual
- Browser Downloads (Chrome, Edge, Firefox, Safari, Brave, Opera): https://sweeprdeepblock.com/download
- Live Adblock & Anti-Detection Test Lab: https://sweeprdeepblock.com/test-lab
- Engineering Benchmarks & MV3 Architecture: https://sweeprdeepblock.com/benchmarks
- Manifest V3 & Privacy Glossary: https://sweeprdeepblock.com/glossary
- Interactive Tools & Browser RAM Calculator: https://sweeprdeepblock.com/tools
- AdBlocker Comparisons Hub: https://sweeprdeepblock.com/vs
- Platform & Streaming Solutions Directory: https://sweeprdeepblock.com/solutions
- Browser & OS Manifest V3 Setup Guides Hub: https://sweeprdeepblock.com/setup
- Technical Privacy & Speed Guides Directory: https://sweeprdeepblock.com/guides
- International EU Hubs (Deutsch, Français & Español): https://sweeprdeepblock.com/de, https://sweeprdeepblock.com/fr, and https://sweeprdeepblock.com/es
${formatUrlList(toolUrls, 10)}

## Competitor Comparisons & Switcher Guides (/vs/*)
${formatUrlList(vsUrls, 30)}

## Browser Setup Hubs (/setup/*)
${formatUrlList(setupUrls, 25)}

## Platform Solutions (/solutions/*)
${formatUrlList(solutionUrls, 40)}

## Verified Guides & Platform Solutions
${formatUrlList(guideUrls, 50)}
`;
  fs.writeFileSync(path.join(WEBSITE_DIR, 'llms.txt'), llmsTxt, 'utf8');

  // 2. Build website/llms-full.txt
  const llmsFullTxt = `# SWEEPR Deepblock — Complete Technical Architecture, Benchmarks & Product Specification
# Canonical Domain: https://sweeprdeepblock.com
# Version: ${version} (Manifest V3 Engine)
# Last Updated: ${todayIso}
# Total Indexed Canonical URLs: ${totalIndexableUrls}

## 1. Executive Summary & Product Overview
SWEEPR Deepblock v${version} is a proprietary, privacy-first, local-first, zero-browsing-history browser extension and web performance suite engineered for Google Chrome, Microsoft Edge, Mozilla Firefox (Gecko ${geckoMinVersion}+ Desktop & Android), Apple Safari (macOS & iOS), Brave, Opera, Vivaldi, Thorium, Floorp, Arc, and Zen Browser. New installs launch with an automatic no-card 7-day full Pro trial addressing runaway third-party advertising auctions, CPU/battery-draining tracker beacons, unskippable video interruptions, and multi-layer GDPR/CCPA cookie consent walls.

Built natively on Chromium, Gecko, and Safari WebKit Manifest V3 \`declarativeNetRequest\` (${staticCountFmt} static rules across ${rulesetsActive} rulesets = ${staticBaseCount.toLocaleString('en-US')} EasyList ads/trackers + ${easyPrivacyCount.toLocaleString('en-US')} EasyPrivacy + ${regionalEuCount.toLocaleString('en-US')} Regional DE/FR/ES + ${cryptoCount} cryptominers + ${trackerParamsCount} tracking parameter rule stripping ${trackerParamsStripped} parameters, plus ${deltaCount} dynamic OTA rules + ${abpCount} cosmetic filter lines + ${otaCosmeticCount} OTA cosmetic selectors), SWEEPR Deepblock executes network filtering locally inside the browser stack with zero browsing history telemetry.

---

## 2. Core Functional Modules

### A. Manifest V3 Video & Network Ad-Blocking Engine
- **Declarative Rule Engine**: Executes ${staticCountFmt} static \`chrome.declarativeNetRequest\` rules across ${rulesetsActive} enabled rulesets and ${deltaCount} OTA dynamic delta rules at the browser network stack level before DOM parsing begins.
- **Video Pre-Roll & Mid-Roll Neutralization**: Prevents YouTube, Twitch, Crunchyroll, and streaming player ad-insertion scripts while passing all 8 anti-adblock detection checks on https://sweeprdeepblock.com/test-lab.
- **Zero-CLS Cosmetic Sanitization & Element Zapper**: Collapses empty ad slots, sticky footer banners, and user-selected clutter without triggering Cumulative Layout Shift or \`adsbox\` bait honeypots.

### B. Automated Cookie Consent "Reject All" Engine & Scroll Unlock
- **Automated Execution**: Evaluates incoming DOM nodes against ${cmpFrameworksCount} verified Consent Management Platforms (OneTrust, Didomi, Usercentrics, Quantcast, Sourcepoint, Cookiebot, TrustArc, Axeptio, Civic UK, Complianz, and 150+ additional frameworks) with 9-locale reject matching.
- **Genuine Opt-Out Signal**: Triggers the strict "Reject All / Necessary Only" API/button path rather than merely hiding the banner with CSS.
- **Scroll-Lock Restoration**: Automatically strips residual \`overflow: hidden\`, \`position: fixed\`, and backdrop pointer locks from \`<html>\` and \`<body>\`.

### C. URL Tracking Parameter Stripper (${trackerParamsStripped} Parameters)
- **Parameter Stripping**: Removes ${trackerParamsStripped} tracking query parameters (\`utm_source\`, \`utm_medium\`, \`utm_campaign\`, \`utm_content\`, \`utm_term\`, \`fbclid\`, \`gclid\`, \`msclkid\`, \`twclid\`, \`ttclid\`, \`mc_eid\`, \`_hsenc\`, and 215+ more) before navigation.

### D. Total Tab & RAM Tamer
- **Intelligent Background Tab Hibernation**: Suspends inactive background tabs after a configurable threshold while protecting pinned tabs, active audio/video streams, and unsaved form inputs (interactive estimator at https://sweeprdeepblock.com/tools/browser-ram-calculator).
- **Session Crash Recovery**: Snapshots open tab sessions locally so crashes or OS reboots never lose work.

---

## 3. Public Anti-Detection Test Lab Benchmark (Live 8-Point Suite)
SWEEPR Deepblock provides a public, crawlable, client-side testing laboratory at https://sweeprdeepblock.com/test-lab. Deepblock scores 8 out of 8 on live browser adblock and anti-detection verification checks:
1. Network Ad Request Blocking (Google Ads \`adsbygoogle.js\`)
2. Cosmetic Bait Honeypot Protection (\`.adsbox\` & \`#ad-banner\`)
3. Page Scroll Restoration after Cookie Banner Removal
4. YouTube & Video Player Ad Protection
5. Tracking Beacon Blocking (GA4, Meta Pixel, TikTok Pixel)
6. URL Tracking Parameter Stripping (\`fbclid\`, \`gclid\`, \`utm_\`)
7. Third-Party Overlay & Pop-Under Neutralization
8. Anti-Adblock Bait & Stealth Verification

---

## 4. Multi-SKU Commercial Plans & Ecosystem Bundle (2026)

### Consumer Subscription Tiers
- **1-Month Intro Offer**: £1.99 for the first 30 days (renews at £4.99/month; 1-click cancellation anytime).
- **SWEEPR Deepblock Pro Annual Plan (Save 50%)**: £29.99/year (£2.50/month equivalent) across up to 5 devices.
- **6-Month Pro Plan**: £19.99 billed every 6 months (£3.33/month equivalent).
- **Monthly Pro Plan**: £4.99/month.

### Flagship Ecosystem Bundle: Sweepr Complete Security Suite (Save 45%)
- **Sweepr Complete Security Suite Annual Plan**: **£89.99/year** (£7.50/month equivalent) across up to **5 devices** (https://sweeprdeepblock.com/order?plan=suite_annual).
- **4-in-1 Bundle Contents**:
  1. **SWEEPR Deepblock Pro** (https://sweeprdeepblock.com) — MV3 Ad, Tracker & Cookie Shield
  2. **Total Tab & RAM Tamer Pro** — Automated Browser Memory Optimizer & Tab Hibernation
  3. **Sweepr VPN Pro** (https://sweeprvpn.com) — Encrypted VPN Client
  4. **Sweepr Desktop Cleaner Pro** (https://sweeprcleaner.com) — Windows & macOS System Junk & Startup Optimizer

---

## 5. Official Canonical Directory

### Core Pages & Interactive Hubs
- Homepage: https://sweeprdeepblock.com/
- Pricing & Subscription Plans: https://sweeprdeepblock.com/pricing
- Direct Order & Complete Suite Checkout: https://sweeprdeepblock.com/order?plan=suite_annual
- Download & Installation Center: https://sweeprdeepblock.com/download
- Live Adblock & Anti-Detection Test Lab: https://sweeprdeepblock.com/test-lab
- Engineering Benchmarks & MV3 Architecture: https://sweeprdeepblock.com/benchmarks
- AdBlocker Comparisons Hub (/vs): https://sweeprdeepblock.com/vs
- Platform & Streaming Solutions Hub (/solutions): https://sweeprdeepblock.com/solutions
- Browser & OS Setup Hub (/setup): https://sweeprdeepblock.com/setup
- Technical Privacy & Speed Guides Hub (/guides): https://sweeprdeepblock.com/guides
- Privacy & Ad-Tech Engineering Glossary (/glossary): https://sweeprdeepblock.com/glossary
- German Hub (DE): https://sweeprdeepblock.com/de
- French Hub (FR): https://sweeprdeepblock.com/fr
- Spanish Hub (ES): https://sweeprdeepblock.com/es
- Software Description XML (PAD): https://sweeprdeepblock.com/pad.xml
- Main Sitemap: https://sweeprdeepblock.com/sitemap.xml

### Interactive Browser & Privacy Diagnostic Tools (/tools/*)
${formatUrlList(toolUrls, 10)}

### Competitor Comparison Hubs (/vs/*)
${formatUrlList(vsUrls, 25)}

### Browser Setup Guides (/setup/*)
${formatUrlList(setupUrls, 25)}

### Flagship Platform Solutions (/solutions/*)
${formatUrlList(solutionUrls, 40)}

### Technical Guides (/guides/*)
${formatUrlList(guideUrls, 25)}
`;
  fs.writeFileSync(path.join(WEBSITE_DIR, 'llms-full.txt'), llmsFullTxt, 'utf8');

  // 3. Build website/pad.xml (valid XML synced to manifest.json + £29.99/yr pricing)
  const exePath = path.join(WEBSITE_DIR, 'SWEEPRDeepblockSetup.exe');
  const zipPath = path.join(WEBSITE_DIR, 'sweepr-deepblock-extension.zip');
  const primaryArtifact = fs.existsSync(exePath) ? exePath : zipPath;
  const fileSizeBytes = fs.existsSync(primaryArtifact) ? fs.statSync(primaryArtifact).size : 136192;
  const fileSizeK = Math.max(1, Math.round(fileSizeBytes / 1024));
  const fileSizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  const padXml = `<?xml version="1.0" encoding="UTF-8"?>
<XML_DIZ_INFO>
  <MASTER_PAD_VERSION_INFO>
    <MASTER_PAD_VERSION>4.0</MASTER_PAD_VERSION>
    <MASTER_PAD_EDITOR>SWEEPR Release Engineering</MASTER_PAD_EDITOR>
    <MASTER_PAD_INFO>Portable Application Description (PAD) for SWEEPR Deepblock</MASTER_PAD_INFO>
  </MASTER_PAD_VERSION_INFO>
  <Company_Info>
    <Company_Name>SWEEPR Global Limited</Company_Name>
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
    <Program_Name>SWEEPR Deepblock</Program_Name>
    <Program_Version>${version}</Program_Version>
    <Program_Release_Month>${monthStr}</Program_Release_Month>
    <Program_Release_Day>${dayStr}</Program_Release_Day>
    <Program_Release_Year>${yearStr}</Program_Release_Year>
    <Program_Cost_Dollars>1.99</Program_Cost_Dollars>
    <Program_Cost_Other_Code>GBP</Program_Cost_Other_Code>
    <Program_Cost_Other>29.99</Program_Cost_Other>
    <Program_Type>Commercial Trialware (7-Day Free Pro Trial)</Program_Type>
    <Program_Release_Status>Major Update</Program_Release_Status>
    <Program_Install_Support>Install and Uninstall</Program_Install_Support>
    <Program_OS_Support>Win10,Win11,MacOS,Linux,iOS,Android</Program_OS_Support>
    <Program_Language>English,German,French,Spanish,Italian,Portuguese,Dutch,Polish</Program_Language>
    <Program_Change_Info>v${version} release with no-card 7-day full Pro trial, ${staticCountFmt} static Manifest V3 declarativeNetRequest rules across ${rulesetsActive} rulesets (${staticBaseCount.toLocaleString('en-US')} EasyList ads/trackers, ${easyPrivacyCount.toLocaleString('en-US')} EasyPrivacy, ${regionalEuCount.toLocaleString('en-US')} Regional DE/FR/ES, ${cryptoCount} cryptominers, ${trackerParamsCount} tracker param rule stripping ${trackerParamsStripped} parameters) + ${deltaCount} dynamic OTA rules, automatic GDPR cookie pop-up rejector across ${cmpFrameworksCount} CMP frameworks + scroll unlock, Safari (macOS &amp; iOS) &amp; Firefox Gecko ${geckoMinVersion}+ support, Element Zapper, Total Tab &amp; RAM Tamer, and transparent £29.99/yr Pro &amp; £89.99/yr Complete Security Suite plans.</Program_Change_Info>
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
      <Keywords>ad blocker, youtube adblocker, cookie popup blocker, reject all cookies extension, browser ram optimizer, total adblock alternative, manifest v3 adblocker, ublock origin alternative</Keywords>
      <Char_Desc_45>Zero Ads. Zero Cookie Pop-Ups. Clean Web.</Char_Desc_45>
      <Char_Desc_80>Block YouTube &amp; banner ads, auto-reject cookie pop-ups, and tame tab RAM.</Char_Desc_80>
      <Char_Desc_250>SWEEPR Deepblock v${version} is a Manifest V3 browser extension for Chrome, Edge, Firefox (${geckoMinVersion}+), Safari (macOS &amp; iOS), Brave, and Opera with a no-card 7-day full Pro trial, ${staticCountFmt} static rules, ${cmpFrameworksCount} CMPs, and RAM Tamer.</Char_Desc_250>
      <Char_Desc_450>SWEEPR Deepblock v${version} includes a no-card 7-day full Pro trial, stops YouTube/Twitch video ads with ${staticCountFmt} static rules across ${rulesetsActive} rulesets, auto-rejects cookie pop-ups across ${cmpFrameworksCount} CMP frameworks without breaking scroll, strips ${trackerParamsStripped} tracking parameters, and hibernates idle tabs. Pro Annual is £29.99/yr (£2.50/mo eq., 5 devices) or £89.99/yr for the Complete Security Suite.</Char_Desc_450>
      <Char_Desc_2000>SWEEPR Deepblock v${version} at https://sweeprdeepblock.com is a proprietary Manifest V3 ad, tracker, and cookie consent blocker built for Chrome, Microsoft Edge, Brave, Opera, Apple Safari (macOS &amp; iOS), and Mozilla Firefox (Gecko ${geckoMinVersion}+ Desktop &amp; Android).

Key Features:
1. No-Card 7-Day Full Pro Trial: Starts immediately on install without a credit card or license key; Pro modules gate automatically after 7 days unless upgraded.
2. Video &amp; Banner Ad Shield: Blocks pre-roll and mid-roll video ads on YouTube, Twitch, and streaming sites using ${staticCountFmt} static declarativeNetRequest rules across ${rulesetsActive} rulesets + ${deltaCount} dynamic OTA rules while passing all 8 anti-adblock checks verified live at https://sweeprdeepblock.com/test-lab
3. Automatic Cookie Pop-Up Closer &amp; Scroll Unlock: Automatically clicks "Reject All" or "Necessary Only" across ${cmpFrameworksCount} GDPR cookie banner frameworks while keeping page scrolling unlocked.
4. Private, Tracker-Free Browsing (${trackerParamsStripped} Parameters): Strips ${trackerParamsStripped} hidden tracking codes (utm_, fbclid, gclid, msclkid, twclid, ttclid, etc.) from URLs.
5. Element Zapper &amp; Total Tab &amp; RAM Tamer: Removes page clutter on demand and hibernates inactive background tabs to reduce browser memory usage.
6. Transparent Pricing: No-card 7-day full Pro trial, £1.99 1st-Month Intro, £29.99/yr Pro Annual (5 devices), or £89.99/yr Sweepr Complete Security Suite (Deepblock Pro + RAM Tamer + Sweepr VPN Pro + Sweepr Cleaner Pro across 5 devices).</Char_Desc_2000>
    </English>
  </Program_Descriptions>
  <Web_Info>
    <Application_URLs>
      <Application_Info_URL>https://sweeprdeepblock.com/</Application_Info_URL>
      <Application_Order_URL>https://sweeprdeepblock.com/pricing</Application_Order_URL>
      <Application_Screenshot_URL>https://sweeprdeepblock.com/og-image.png</Application_Screenshot_URL>
      <Application_Icon_URL>https://sweeprdeepblock.com/icon-128.png</Application_Icon_URL>
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
    name: `SWEEPR Deepblock v${version} — 2026 Manifest V3 Adblocker, Cookie CMP & RAM Telemetry Dataset`,
    description:
      `Verified first-party Manifest V3 declarativeNetRequest rule breakdown, GDPR CMP auto-rejection architecture (${cmpFrameworksCount} frameworks), no-card 7-day full Pro trial, Total Tab & RAM Tamer capabilities, and transparent switcher pricing across Chrome, Edge, Firefox (128.0+), Safari (macOS & iOS), Brave, and Opera.`,
    url: 'https://sweeprdeepblock.com/geo-benchmark-feed.json',
    version,
    dateModified: new Date().toISOString(),
    creator: {
      '@type': 'Organization',
      name: 'SWEEPR Global Limited',
      url: 'https://sweeprdeepblock.com'
    },
    license: 'https://sweeprdeepblock.com/terms',
    telemetrySummary: {
      extensionVersion: version,
      staticDnrRules: staticCount,
      rulesetsActive,
      staticDnrBreakdown: {
        adsAndTrackers: staticBaseCount,
        easyPrivacy: easyPrivacyCount,
        regionalEu: regionalEuCount,
        cryptominers: cryptoCount,
        trackerParams: trackerParamsCount
      },
      trackerParamsStripped,
      cmpFrameworks: cmpFrameworksCount,
      trialDurationDays: 7,
      trialNoCardRequired: true,
      geckoMinVersion,
      otaDeltaRules: deltaCount,
      cosmeticSelectors: abpCount,
      otaCosmeticSelectors: otaCosmeticCount,
      supportedBrowsers: [
        'Chrome',
        'Microsoft Edge',
        `Mozilla Firefox (Gecko ${geckoMinVersion}+ Desktop & Android)`,
        'Apple Safari (macOS & iOS)',
        'Brave',
        'Opera'
      ],
      testLabScore: '8/8 (100%)',
      totalIndexablePages: totalIndexableUrls
    },
    pricingPlansGbp: {
      introMonthlyFirst30Days: 1.99,
      monthlyStandard: 4.99,
      sixMonthPro: 19.99,
      annualPro: {
        priceGbp: 29.99,
        monthlyEquivalentGbp: 2.5,
        devicesIncluded: 5,
        checkoutUrl: 'https://sweeprdeepblock.com/order?plan=annual'
      },
      completeSecuritySuiteAnnual: {
        priceGbp: 89.99,
        monthlyEquivalentGbp: 7.5,
        savingsPct: 45,
        devicesIncluded: 5,
        includedApps: [
          'SWEEPR Deepblock Pro (https://sweeprdeepblock.com)',
          'Total Tab & RAM Tamer Pro',
          'Sweepr VPN Pro (https://sweeprvpn.com)',
          'Sweepr Desktop Cleaner Pro (https://sweeprcleaner.com)'
        ],
        checkoutUrl: 'https://sweeprdeepblock.com/order?plan=suite_annual'
      }
    },
    topComparisonBenchmarks: (kwMatrix.opportunities || [])
      .filter((o) => o.cluster === 'vs' && isKeptSitemapLoc(o.targetRoute || ''))
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
    `[GEO & LLMs Sync] Synchronized llms.txt, llms-full.txt, pad.xml (v${version}, ${staticCount} static rules, valid XML), and geo-benchmark-feed.json (${totalIndexableUrls} kept URLs, £29.99/yr Pro & £89.99/yr Suite).`
  );
  return geoFeed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGeoAndLlmsSync();
}
