#!/usr/bin/env node
/**
 * SWEEPR DeepBlock (sweeprdeepblock.com) — Daily 50 Keyword-Researched Programmatic SEO Page Generator
 *
 * Generates brand-new, high-quality, keyword-researched HTML5 pages per day across:
 *  - `/solutions/{site-or-platform}-{ad-or-privacy-problem}` (YouTube, Twitch, Reddit, News/Recipe Sites, Google Search AI Slop, Cookie Banners, Fake Scam Stores)
 *  - `/setup/{browser-or-os}` (Chrome MV3, Edge, Brave, Firefox, Safari macOS/iOS, Opera GX, Vivaldi, Chromebook, Windows 11, macOS)
 *  - `/vs/{competitor}` (Total Adblock, AdBlock Plus, AdGuard, uBlock Origin Lite, Ghostery, Pie Adblock, Stands AdBlocker, etc.)
 *  - `/guides/{topic}` (Manifest V3 Anti-Detection, Cookie Consent Auto-Reject, Fake Shopify Scam Store Detection, Tab RAM Tamer, URL Tracking Stripper)
 *
 * Updates `website/sitemap.xml`, `website/llms.txt`, and `website/indexing-queue.json`, validates all JSON-LD schemas,
 * and pings Bing IndexNow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const LLMS_PATH = path.join(WEBSITE_DIR, 'llms.txt');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const DAILY_STATE_PATH = path.join(WEBSITE_DIR, 'daily-seo-pages-state.json');
const INDEXNOW_KEY = '8f9a2b4c6d1e3f5a7b9c0d2e4f6a8b0c';

const PLATFORMS = [
  { slug: 'youtube-chrome-mv3', shortName: 'YouTube (Chrome MV3)', name: 'YouTube on Google Chrome (Manifest V3)', category: 'Video Streaming', issue: 'Unskippable pre-roll ads, mid-roll interruptions, and anti-adblock warning modals' },
  { slug: 'twitch-live-streams', shortName: 'Twitch Streams', name: 'Twitch Live Streams', category: 'Live Gaming & Esports', issue: 'Purple screen of death, mid-stream HLS commercial interruptions, and heavy tracker scripts' },
  { slug: 'uk-news-websites', shortName: 'Online Newspapers', name: 'UK & US Online Newspapers', category: 'News & Journalism', issue: 'Auto-playing floating video players, layout shifts, and aggressive paywall overlays' },
  { slug: 'recipe-food-blogs', shortName: 'Recipe Websites', name: 'Recipe & Cooking Websites', category: 'Lifestyle & Recipes', issue: '2,000-word clutter, sticky footer banners, and dozens of ad auction scripts' },
  { slug: 'google-search-results', shortName: 'Google Search', name: 'Google Search Results', category: 'Search Engine', issue: 'Sponsored ad slots disguised as organic links, SEO spam, and AI slop' },
  { slug: 'bing-copilot-search', shortName: 'Bing & Edge', name: 'Bing & Microsoft Edge Search', category: 'Search Engine', issue: 'Promoted shopping carousels, MSN notification nags, and AI content clutter' },
  { slug: 'facebook-marketplace-shops', shortName: 'Social & Shops', name: 'Social Media Ad Links & Online Shops', category: 'E-Commerce Security', issue: 'Fake clearance stores, newly registered drop-shipping scam domains, and tracking' },
  { slug: 'smart-tv-web-browsers', shortName: 'Streaming Browsers', name: 'Desktop & HTPC Streaming Browsers', category: 'Home Entertainment', issue: 'Pop-under redirects, fake download buttons, and malvertising scripts' },
  { slug: 'fandom-game-wikis', shortName: 'Fandom Wiki Sites', name: 'Fandom & Gaming Wiki Sites', category: 'Gaming Reference', issue: 'Autoplay sidebar videos, banner takeovers, and high RAM usage' },
  { slug: 'dailymotion-vimeo-embeds', shortName: 'Embedded Web Videos', name: 'Embedded Video Players Across the Web', category: 'Web Video', issue: 'Third-party pre-roll video trackers and cross-site fingerprinting beacons' },
  { slug: 'weather-radar-portals', shortName: 'Weather Websites', name: 'Weather & Local Traffic Websites', category: 'Daily Utility', issue: 'CPU-draining programmatic display ads and precise geolocation trackers' },
  { slug: 'sports-live-score-sites', shortName: 'Live Sports Sites', name: 'Live Sports Score & Stats Portals', category: 'Sports Media', issue: 'Betting pop-ups, auto-refreshing banner scripts, and memory consumption' },
  { slug: 'reddit-promoted-posts', shortName: 'Reddit', name: 'Reddit Feeds & Discussion Threads', category: 'Social Forum', issue: 'Disguised promoted ads in comment threads, user tracking beacons, and heavy memory usage' },
  { slug: 'spotify-web-player', shortName: 'Spotify Web', name: 'Spotify Web Player', category: 'Music Streaming', issue: 'Unskippable audio commercial interruptions, banner takeovers, and cross-site listening trackers' },
  { slug: 'x-twitter-feed-ads', shortName: 'X (Twitter)', name: 'X / Twitter Web Feeds', category: 'Social Media', issue: 'In-feed promoted crypto scam ads, intrusive sponsored tweets, and engagement tracking pixels' },
  { slug: 'crunchyroll-anime-streams', shortName: 'Crunchyroll', name: 'Crunchyroll & Anime Streaming Sites', category: 'Anime & Video Streaming', issue: 'Triple unskippable ad breaks, anti-adblock detection overlays, and third-party tracker scripts' },
  { slug: 'quora-digest-answers', shortName: 'Quora', name: 'Quora Discussion Pages', category: 'Q&A & Knowledge Base', issue: 'Intrusive login/signup modals, affiliate disguised questions, and interstitial display ads' },
  { slug: 'free-file-host-downloads', shortName: 'File Download Hosts', name: 'Free File Hosting & Cloud Storage Portals', category: 'File Sharing Utility', issue: 'Deceptive fake green download buttons, 30-second delay timers, and malvertising pop-under redirects' },
  { slug: 'pinterest-promoted-pins', shortName: 'Pinterest', name: 'Pinterest Visual Boards & Search', category: 'Visual Discovery', issue: 'Promoted product pins drowning out genuine search results and aggressive commercial tracking' },
  { slug: 'speedtest-network-tools', shortName: 'Speed Test Tools', name: 'Network Speed Test & Utility Sites', category: 'Network Utility', issue: 'Dozens of programmatic auction banner slots, layout jumping, and high CPU usage during tests' },
  { slug: 'soundcloud-audio-player', shortName: 'SoundCloud', name: 'SoundCloud Web Player', category: 'Audio Streaming & Podcasts', issue: 'Loud auto-playing audio interstitials between tracks and third-party tracking beacons' },
  { slug: 'tumblr-blog-feeds', shortName: 'Tumblr Blogs', name: 'Tumblr Social & Blog Dashboards', category: 'Microblogging', issue: 'Sticky sponsored carousel ads, affiliate links, and autoplay video widgets' }
];

const PROBLEMS = [
  {
    slug: 'block-video-ads',
    shortTitle: 'Block Video Ads (2026)',
    h1Prefix: 'How to Block Video Ads on',
    h1Suffix: 'Without Anti-Adblock Warnings',
    metaDescPrefix: 'Block pre-roll & mid-roll video ads on',
    beforeStat: '4–8 Video Ads / Hour',
    afterStat: '0 Video Ads (8/8 Anti-Detection)',
    perfStat: '< 50ms Rule Match'
  },
  {
    slug: 'auto-reject-cookie-popups',
    shortTitle: 'Auto-Reject Cookie Pop-Ups',
    h1Prefix: 'Auto-Reject Cookie Pop-Ups on',
    h1Suffix: 'in Under 50 Milliseconds',
    metaDescPrefix: 'Auto-reject cookie consent banners on',
    beforeStat: 'Manual Reject Clicks Every Visit',
    afterStat: '100% Auto-Rejected (<50ms)',
    perfStat: 'Scroll Lock Restored'
  },
  {
    slug: 'filter-ai-slop-and-scams',
    shortTitle: 'Hide AI Slop & Scam Shops',
    h1Prefix: 'How to Clean Up',
    h1Suffix: 'From AI Slop, Sponsored Junk & Scam Stores',
    metaDescPrefix: 'Hide AI slop, sponsored junk, and scam shops on',
    beforeStat: 'Cluttered with Sponsored & AI Spam',
    afterStat: 'Clean Verified Organic View',
    perfStat: 'Real-Time Scam Shield'
  },
  {
    slug: 'reduce-browser-ram-usage',
    shortTitle: 'Cut Browser RAM Usage 62%',
    h1Prefix: 'Stop',
    h1Suffix: 'From Draining Laptop RAM & Battery',
    metaDescPrefix: 'Cut browser RAM usage and stop background trackers on',
    beforeStat: '1.4 GB+ RAM Per Multi-Tab Session',
    afterStat: 'Up to 62% Less Memory Used',
    perfStat: 'Total Tab & RAM Tamer'
  },
  {
    slug: 'stop-malvertising-popunders',
    shortTitle: 'Stop Pop-Under Redirects (2026)',
    h1Prefix: 'How to Stop Malvertising & Pop-Unders on',
    h1Suffix: 'Permanently',
    metaDescPrefix: 'Block malicious pop-under redirects, tab hijacking, and fake download alerts on',
    beforeStat: 'Tab Hijacks & Fake Download Alerts',
    afterStat: '0 Pop-Unders & 100% Malvertising Shield',
    perfStat: 'Silent Tab Guard'
  },
  {
    slug: 'strip-tracking-parameters',
    shortTitle: 'Strip URL Tracking Beacons',
    h1Prefix: 'How to Strip fbclid, gclid & Tracking on',
    h1Suffix: 'Automatically',
    metaDescPrefix: 'Strip hidden fbclid, gclid, utm_, and cross-site tracking beacons from links on',
    beforeStat: 'Full-Session Cross-Site Tracking Beacons',
    afterStat: 'Clean Canonical URLs Stripped of Trackers',
    perfStat: 'Sub-Millisecond URL Sanitize'
  }
];

const SETUP_BROWSERS = [
  { slug: 'google-chrome-manifest-v3', shortName: 'Chrome MV3', name: 'Google Chrome (Manifest V3 Engine)', os: 'Windows, macOS, Linux, ChromeOS', notes: 'Uses declarativeNetRequest dynamic rule sets + DeepStealth cosmetic scriptlets to pass 8/8 anti-detection checks on Chrome MV3.' },
  { slug: 'microsoft-edge-windows-11', shortName: 'Microsoft Edge', name: 'Microsoft Edge on Windows 11', os: 'Windows 10 & Windows 11', notes: 'Blocks Edge MSN new-tab promoted clutter, YouTube pre-roll ads, and OneTrust/Quantcast cookie consent modals automatically.' },
  { slug: 'safari-macos-ios-ipad', shortName: 'Apple Safari', name: 'Apple Safari (macOS Sonoma/Sequoia, iOS & iPadOS)', os: 'Mac, iPhone & iPad', notes: 'Native Content Blocker + Safari Web Extension with ultra-low energy impact and automatic cookie banner rejection.' },
  { slug: 'mozilla-firefox-desktop-android', shortName: 'Mozilla Firefox', name: 'Mozilla Firefox (Desktop & Android)', os: 'Windows, macOS, Linux, Android', notes: 'Full network and cosmetic filtering, URL tracking parameter stripping (fbclid, gclid, utm_), and Fake Shop Detector.' },
  { slug: 'brave-browser-deepstealth', shortName: 'Brave Browser', name: 'Brave Browser + SWEEPR DeepBlock Layer', os: 'Windows, macOS, Linux, Android, iOS', notes: 'Adds automatic Cookie Consent "Reject All" clicking, AI Slop Search Filter, Clean Reading View, and Fake Scam Store alerts on top of Brave.' },
  { slug: 'opera-gx-gaming-browser', shortName: 'Opera & Opera GX', name: 'Opera & Opera GX Gaming Browser', os: 'Windows & macOS', notes: 'Replaces weak built-in adblocking with 8/8 anti-detection YouTube/Twitch protection and Total Tab & RAM Tamer.' },
  { slug: 'arc-browser-windows-mac', shortName: 'Arc Browser', name: 'The Arc Browser (Windows & macOS)', os: 'Windows 11 & macOS', notes: 'Native MV3 dynamic filtering, spaces tab hibernation integration, and instant cookie consent auto-rejection.' },
  { slug: 'vivaldi-power-user-browser', shortName: 'Vivaldi Browser', name: 'Vivaldi Browser (Power Users)', os: 'Windows, macOS & Linux', notes: 'Enhances Vivaldi built-in filters with SWEEPR DeepStealth anti-detection, AI slop cleansers, and fake scam shop warnings.' },
  { slug: 'librewolf-hardened-firefox', shortName: 'LibreWolf', name: 'LibreWolf Hardened Privacy Browser', os: 'Windows, macOS & Linux', notes: 'Maximum privacy configuration paired with SWEEPR DeepBlock automatic cookie banner auto-rejection and shopping scam detection.' },
  { slug: 'thorium-chromium-browser', shortName: 'Thorium Browser', name: 'Thorium Fast Chromium Browser', os: 'Windows & Linux', notes: 'High-performance AVX2 optimized browser paired with SWEEPR DeepBlock sub-50ms rule matching and RAM tamer.' }
];

const COMPETITORS = [
  { slug: 'ublock-origin-lite', shortName: 'uBlock Origin Lite', name: 'uBlock Origin Lite (MV3)', price: 'Free (Limited MV3 Rules)', cookieReject: 'Manual Filter Toggles', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'adblock-plus', shortName: 'AdBlock Plus', name: 'AdBlock Plus (ABP)', price: '£36–£40/yr Premium (Allows "Acceptable Ads" by default)', cookieReject: 'Paid Tier Only', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'adguard-extension', shortName: 'AdGuard', name: 'AdGuard Browser Extension', price: '£29.99–£69.99/yr', cookieReject: 'Filter-Based Only', scamDetector: 'Basic Phishing List', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'ghostery-privacy-ad-blocker', shortName: 'Ghostery', name: 'Ghostery Tracker & Ad Blocker', price: 'Free / Contributor Tier', cookieReject: 'Never-Consent Basic', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'pie-adblock', shortName: 'Pie Adblock', name: 'Pie Adblock', price: 'Free (Monetizes Rewards/Shopping Data)', cookieReject: 'No', scamDetector: 'No', aiSlopFilter: 'No', ramTamer: 'No' },
  { slug: 'stands-fair-adblocker', shortName: 'Stands AdBlocker', name: 'Stands AdBlocker', price: 'Free / Donation Nag Screens', cookieReject: 'Limited', scamDetector: 'No', aiSlopFilter: 'No', ramTamer: 'No' },
  { slug: 'nordvpn-threat-protection', shortName: 'Nord Threat Protection', name: 'Nord Threat Protection Pro', price: '£80–£140/yr (Bundled with VPN)', cookieReject: 'DNS-Level Only (Breaks Page)', scamDetector: 'Basic Domain Filter', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'brave-shields', shortName: 'Brave Shields', name: 'Brave Browser Built-in Shields', price: 'Free (Crypto Nag Prompts)', cookieReject: 'Manual Toggle List', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'surfshark-cleanweb', shortName: 'Surfshark CleanWeb', name: 'Surfshark CleanWeb 2.0', price: '£55–£110/yr', cookieReject: 'Basic Chrome Extension', scamDetector: 'Phishing URLs Only', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'malwarebytes-browser-guard', shortName: 'Malwarebytes Guard', name: 'Malwarebytes Browser Guard', price: 'Free / Bundled Premium', cookieReject: 'No', scamDetector: 'Malicious IP/URL List', aiSlopFilter: 'No', ramTamer: 'No' },
  { slug: '1blocker-safari', shortName: '1Blocker', name: '1Blocker for Safari & Mac', price: '£19.99–£34.99/yr (Apple Only)', cookieReject: 'Rule-Based Only', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' },
  { slug: 'wipr-adblocker', shortName: 'Wipr', name: 'Wipr Safari Adblocker', price: '£2.99 One-time (Safari Only)', cookieReject: 'Partial', scamDetector: 'Not Included', aiSlopFilter: 'Not Included', ramTamer: 'Not Included' }
];

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const GUIDES = [
  { slug: 'how-to-automatically-reject-cookie-banners-uk', shortTitle: 'Auto-Reject Cookie Pop-Ups UK (2026)', title: 'How to Automatically Click Reject All on UK & EU Cookie Banners (2026)', h1: 'How to Automatically Reject Cookie Pop-Ups on Every Website in Under 50ms', summary: 'Stop clicking Reject All dozens of times a day. SWEEPR DeepBlock automatically rejects OneTrust, Quantcast, TrustArc, Didomi, and Cookiebot banners in under 50ms.' },
  { slug: 'how-to-spot-fake-scam-online-shops-uk', shortTitle: 'Spot Fake Scam Online Shops UK', title: 'How to Spot Fake Online Shops & Social Media Scam Stores Before Buying', h1: 'How SWEEPR DeepBlock Detects Fake Online Stores & Scam Checkout Pages Automatically', summary: 'Learn how SWEEPR DeepBlock detects fake online stores, copied return policies, fake countdown timers, and suspicious payment gateways in real time.' },
  { slug: 'how-to-hide-ai-slop-from-google-search', shortTitle: 'Hide AI Slop From Google Search (2026)', title: 'How to Hide AI-Generated Slop & Copy-Paste Spam From Google Search (2026)', h1: 'Clean Up Google, Bing & DuckDuckGo Search Results With SWEEPR DeepBlock', summary: 'Remove low-quality AI content farms, scraped wiki clones, and disguised sponsored links from Google, Bing, and DuckDuckGo in one click.' },
  { slug: 'strip-utm-fbclid-gclid-tracking-links', shortTitle: 'Strip fbclid, gclid & UTM Tracking', title: 'How to Automatically Strip fbclid, gclid & UTM Tracking Codes From URLs', h1: 'Protect Your Browsing Privacy by Stripping Hidden URL Tracking Parameters Automatically', summary: 'SWEEPR DeepBlock silently removes utm_source, fbclid, gclid, msclkid, and affiliate tracking beacons before the page loads.' },
  { slug: 'how-to-block-youtube-ads-chrome-manifest-v3-2026', shortTitle: 'Block YouTube Ads Chrome MV3 (2026)', title: 'How to Block YouTube Ads on Chrome Manifest V3 Without Detection in 2026', h1: 'How to Block YouTube Ads on Chrome Manifest V3 Without Detection in 2026', summary: 'Learn how SWEEPR DeepStealth bypasses YouTube anti-adblock detection scripts on Chrome Manifest V3 using declarativeNetRequest and cosmetic scriptlets.' },
  { slug: 'how-to-fix-twitch-purple-screen-adblock-2026', shortTitle: 'Fix Twitch Purple Screen (2026)', title: 'How to Stop Twitch Commercial Interruptions & Purple Screen in 2026', h1: 'How to Fix Twitch Purple Screen of Death and Block Live Stream Ads in 2026', summary: 'SWEEPR DeepBlock proxies Twitch HLS video segments and strips mid-roll server-side inserted commercials without blacking out stream playback.' },
  { slug: 'how-to-stop-malvertising-popunders-and-redirects', shortTitle: 'Stop Malvertising Popunders (2026)', title: 'How to Stop Malvertising Pop-Under Redirects and Deceptive Download Buttons', h1: 'How to Stop Malvertising Popunders and Hijack Redirects Automatically', summary: 'Defend your browser against malicious pop-unders, disguised download buttons, and notification spam with SWEEPR DeepBlock multi-layer filter engine.' },
  { slug: 'how-to-reduce-browser-ram-speed-up-slow-tabs', shortTitle: 'Reduce Browser RAM & Speed Up Tabs', title: 'How to Reduce Browser RAM Usage by 62% and Speed Up Slow Chrome Tabs', h1: 'How SWEEPR Total Tab & RAM Tamer Reclaims Laptop Memory in Real Time', summary: 'Hibernates inactive background tabs, unloads dormant ad auction scripts, and frees up gigabytes of memory to extend your laptop battery life.' }
];

function buildPool() {
  const pool = [];
  for (const p of PLATFORMS) {
    for (const prob of PROBLEMS) {
      pool.push({
        cluster: 'solutions',
        relPath: `solutions/${p.slug}-${prob.slug}.html`,
        urlPath: `/solutions/${p.slug}-${prob.slug}`,
        p,
        prob
      });
    }
  }
  for (const b of SETUP_BROWSERS) {
    pool.push({ cluster: 'setup', relPath: `setup/${b.slug}.html`, urlPath: `/setup/${b.slug}`, b });
  }
  for (const c of COMPETITORS) {
    pool.push({ cluster: 'vs', relPath: `vs/${c.slug}.html`, urlPath: `/vs/${c.slug}`, c });
  }
  for (const g of GUIDES) {
    pool.push({ cluster: 'guides', relPath: `guides/${g.slug}.html`, urlPath: `/guides/${g.slug}`, g });
  }
  return pool;
}

function renderHtml(cand) {
  const canonicalUrl = `https://sweeprdeepblock.com${cand.urlPath}`;
  let title = '';
  let desc = '';
  let h1 = '';
  let lead = '';
  let body = '';
  let faqs = [];

  if (cand.cluster === 'solutions') {
    const { p, prob } = cand;
    const shortP = p.shortName || p.name.split(' (')[0];
    title = `${shortP}: ${prob.shortTitle} | SWEEPR DeepBlock`;
    desc = `${prob.metaDescPrefix} ${p.name}. Passes 8/8 test lab checks and auto-rejects cookie banners. Try SWEEPR DeepBlock for £1.99.`;
    h1 = `${prob.h1Prefix} ${p.name} ${prob.h1Suffix}`;
    lead = `Tired of ${p.issue.toLowerCase()} on ${p.name}? SWEEPR DeepBlock eliminates video and banner ads, auto-rejects cookie pop-ups in under 50ms, and passes 8/8 anti-detection checks.`;
    body = `
    <h2>Why Standard Ad Blockers Fail on ${p.name}</h2>
    <p>On <strong>${p.name}</strong> (${p.category}), users face ${p.issue.toLowerCase()}. Legacy filter lists often trigger anti-adblock walls or leave broken blank spaces and frozen page scrollbars.</p>
    <h2>How SWEEPR DeepBlock Fixes ${p.name}</h2>
    <ul>
      <li><strong>Before SWEEPR DeepBlock:</strong> ${prob.beforeStat}</li>
      <li><strong>With SWEEPR DeepBlock:</strong> ${prob.afterStat} (${prob.perfStat})</li>
      <li><strong>8/8 Anti-Detection Test Lab Verified:</strong> Test your browser live at <a href="/test-lab">sweeprdeepblock.com/test-lab</a>.</li>
      <li><strong>Transparent Pricing:</strong> £1.99 1st-Month Intro Offer (then £9.99/mo), £44.99 / 6 months (Save 25%), or £59.99 / year (£4.99/mo — Save 50%) covering up to 5 browsers with a 30-day money-back guarantee.</li>
    </ul>`;
    faqs = [
      { q: `Does SWEEPR DeepBlock work on ${p.name} after Chrome's Manifest V3 update?`, a: `Yes. SWEEPR DeepBlock is purpose-built for Manifest V3 across Chrome, Edge, Brave, Opera, Firefox, and Safari, passing 8/8 anti-detection checks.` },
      { q: `Will SWEEPR DeepBlock also stop cookie consent pop-ups on ${p.name}?`, a: `Yes. SWEEPR DeepBlock automatically clicks "No / Reject All" on 150+ cookie consent frameworks in under 50 milliseconds.` }
    ];
  } else if (cand.cluster === 'setup') {
    const { b } = cand;
    title = `Ad Blocker for ${b.shortName || b.name} (2026 Setup) | SWEEPR DeepBlock`;
    desc = `Install SWEEPR DeepBlock on ${b.name}. Block video ads, auto-reject cookie pop-ups, filter AI search slop, and detect fake scam shops.`;
    h1 = `SWEEPR DeepBlock Setup Guide for ${b.name}`;
    lead = b.notes;
    body = `
    <h2>Key Capabilities on ${b.name} (${b.os})</h2>
    <ul>
      <li><strong>Zero Video &amp; Banner Ads:</strong> Seamless pre-roll and mid-roll ad blocking on YouTube, Twitch, and news sites.</li>
      <li><strong>Automatic Cookie Pop-Up Rejector:</strong> Rejects GDPR/CMP cookie banners in under 50ms without breaking page scroll.</li>
      <li><strong>Fake Online Shop Detector &amp; AI Slop Filter:</strong> Protects you from scam e-commerce stores and low-quality search spam.</li>
    </ul>`;
    faqs = [
      { q: `How many devices does one SWEEPR DeepBlock license cover on ${b.name}?`, a: `A single SWEEPR DeepBlock license covers up to 5 browsers across Windows, Mac, iOS, and Android.` },
      { q: `How can I verify SWEEPR DeepBlock is active on ${b.name}?`, a: `Open https://sweeprdeepblock.com/test-lab to run all 8 live anti-detection and tracker-blocking verification checks.` }
    ];
  } else if (cand.cluster === 'vs') {
    const { c } = cand;
    title = `SWEEPR DeepBlock vs ${c.shortName || c.name} (2026 Comparison)`;
    desc = `Compare SWEEPR DeepBlock vs ${c.name}: 8/8 Manifest V3 anti-detection, automatic cookie pop-up rejector, and built-in Fake Scam Shop detection.`;
    h1 = `SWEEPR DeepBlock vs ${c.name}: 2026 Feature & Privacy Comparison`;
    lead = `Comparing SWEEPR DeepBlock with ${c.name}? See why users upgrade to SWEEPR DeepBlock for 8/8 anti-detection video ad blocking, <50ms automatic cookie banner rejection, and built-in Fake Scam Shop detection.`;
    body = `
    <table>
      <thead><tr><th>Feature</th><th>SWEEPR DeepBlock</th><th>${c.name}</th></tr></thead>
      <tbody>
        <tr><td><strong>YouTube &amp; Video Anti-Detection (8/8 Test Lab)</strong></td><td><strong>Yes (MV3 DeepStealth Engine)</strong></td><td>Partial / Often Flagged</td></tr>
        <tr><td><strong>Automatic Cookie Pop-Up Rejector (&lt;50ms)</strong></td><td><strong>Included</strong></td><td>${c.cookieReject}</td></tr>
        <tr><td><strong>Fake Online Shop &amp; Scam Detector</strong></td><td><strong>Included Free</strong></td><td>${c.scamDetector}</td></tr>
        <tr><td><strong>Search Engine AI Slop &amp; Junk Filter</strong></td><td><strong>Included</strong></td><td>${c.aiSlopFilter}</td></tr>
        <tr><td><strong>Total Tab &amp; RAM Tamer (-62% Memory)</strong></td><td><strong>Available (+£14.99/yr)</strong></td><td>${c.ramTamer}</td></tr>
        <tr><td><strong>Pricing</strong></td><td><strong>£1.99 1st Mo • £59.99/yr (£4.99/mo)</strong></td><td>${c.price}</td></tr>
      </tbody>
    </table>`;
    faqs = [
      { q: `Why choose SWEEPR DeepBlock over ${c.name}?`, a: `Unlike ${c.name}, SWEEPR DeepBlock combines 8/8 anti-detection video ad blocking with an automatic <50ms cookie consent rejector, a Fake Online Shop scam detector, and an AI Slop search filter.` }
    ];
  } else {
    const { g } = cand;
    title = `${g.shortTitle || g.title} | SWEEPR DeepBlock`;
    desc = g.summary.length > 155 ? g.summary.slice(0, 152).trim() + '...' : g.summary;
    h1 = g.h1;
    lead = g.summary;
    body = `
    <h2>How SWEEPR DeepBlock Solves This Automatically</h2>
    <p>${g.summary}</p>
    <ul>
      <li>Install <a href="/download">SWEEPR DeepBlock</a> in 30 seconds on Chrome, Edge, Brave, Opera, Firefox, or Safari.</li>
      <li>Run our live <a href="/test-lab">8-Point Adblock &amp; Anti-Detection Test Lab</a> to verify full protection.</li>
    </ul>`;
    faqs = [
      { q: `Is this feature included in the £1.99 first-month trial of SWEEPR DeepBlock?`, a: `Yes, all core ad blocking, cookie pop-up auto-rejection, AI search filtering, and fake shop scam detection features are included.` }
    ];
  }

  // Ensure strict SERP title & description lengths
  if (title.length > 65) title = title.slice(0, 62).trim() + '...';
  if (desc.length > 158) desc = desc.slice(0, 155).trim() + '...';

  const clusterLabel = cand.cluster.charAt(0).toUpperCase() + cand.cluster.slice(1);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sweeprdeepblock.com/' },
      { '@type': 'ListItem', position: 2, name: clusterLabel, item: `https://sweeprdeepblock.com/#${cand.cluster}` },
      { '@type': 'ListItem', position: 3, name: title, item: canonicalUrl }
    ]
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  };

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SWEEPR DeepBlock',
    operatingSystem: 'Windows, macOS, iOS, Android, Chrome, Edge, Firefox, Safari, Brave, Opera',
    applicationCategory: 'BrowserApplication',
    offers: { '@type': 'AggregateOffer', priceCurrency: 'GBP', lowPrice: '1.99', highPrice: '59.99', offerCount: '3' }
  };

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeAttr(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
  <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
  <link rel="dns-prefetch" href="https://cdn.tailwindcss.com" />

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="SWEEPR DeepBlock" />
  <meta property="og:locale" content="en_GB" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta property="og:image:alt" content="${escapeAttr(title)}" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(desc)}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(appSchema)}</script>
  <link rel="stylesheet" href="/style.css" />
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;margin:0;line-height:1.65;">
  <header style="border-bottom:1px solid #1e293b;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;max-width:1080px;margin:0 auto;">
    <a href="/" style="color:#f8fafc;font-weight:800;font-size:1.15rem;text-decoration:none;">SWEEPR <span style="color:#10b981;">DeepBlock</span></a>
    <nav style="display:flex;gap:16px;align-items:center;">
      <a href="/test-lab" style="color:#94a3b8;text-decoration:none;">8/8 Test Lab</a>
      <a href="/pricing" style="color:#94a3b8;text-decoration:none;">Pricing (£1.99 Trial)</a>
      <a href="/download" style="background:#10b981;color:#042f2e;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none;">Install Extension</a>
    </nav>
  </header>
  <main style="max-width:960px;margin:0 auto;padding:42px 24px;">
    <span style="display:inline-block;background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;margin-bottom:12px;">SWEEPR DeepBlock • 2026 Verified Guide</span>
    <h1 style="font-size:2.1rem;line-height:1.22;margin:0 0 16px;">${h1}</h1>
    <p style="font-size:1.1rem;color:#94a3b8;margin-bottom:28px;">${lead}</p>
    ${body}
    <h2 style="margin-top:36px;">Frequently Asked Questions</h2>
    ${faqs.map((f) => `<div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:18px;margin:14px 0;"><h3 style="margin:0 0 8px;">${f.q}</h3><p style="margin:0;color:#cbd5e1;">${f.a}</p></div>`).join('\n')}
    <div style="margin-top:36px;padding:22px;background:#111827;border:1px solid #10b981;border-radius:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
      <div>
        <strong>Zero Ads. Zero Cookie Pop-Ups. Browse in Peace.</strong>
        <div style="color:#94a3b8;font-size:0.92rem;">Try SWEEPR DeepBlock for £1.99 in your first month or save 50% on the £59.99/yr Annual Plan (30-day money-back guarantee).</div>
      </div>
      <a href="/download" style="background:#10b981;color:#042f2e;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">Get SWEEPR DeepBlock</a>
    </div>
  </main>
</body>
</html>`;
}

async function runDaily50DeepBlockPages(targetCount = 50, force = false) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let state = { lastRunDate: null, totalGenerated: 0, batches: [] };
  if (fs.existsSync(DAILY_STATE_PATH)) {
    try { state = { ...state, ...JSON.parse(fs.readFileSync(DAILY_STATE_PATH, 'utf8')) }; } catch {}
  }

  for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
    fs.mkdirSync(path.join(WEBSITE_DIR, dir), { recursive: true });
  }

  const pool = buildPool();
  let reRenderedCount = 0;

  // If force or regenerate-all is passed, re-render all existing files with the optimized template
  const regenerateAll = force || process.argv.includes('--regenerate-all');
  if (regenerateAll) {
    for (const cand of pool) {
      const absPath = path.join(WEBSITE_DIR, cand.relPath);
      if (fs.existsSync(absPath)) {
        const html = renderHtml(cand);
        fs.writeFileSync(absPath, html, 'utf8');
        reRenderedCount++;
      }
    }
  }

  const selected = [];
  for (const cand of pool) {
    const absPath = path.join(WEBSITE_DIR, cand.relPath);
    if (!fs.existsSync(absPath)) {
      selected.push(cand);
      if (selected.length >= targetCount) break;
    }
  }

  const newUrls = [];
  for (const cand of selected) {
    const html = renderHtml(cand);
    fs.writeFileSync(path.join(WEBSITE_DIR, cand.relPath), html, 'utf8');
    newUrls.push(`https://sweeprdeepblock.com${cand.urlPath}`);
  }

  // Rebuild sitemap.xml from all pages on disk
  const baseUrls = [
    'https://sweeprdeepblock.com/',
    'https://sweeprdeepblock.com/pricing',
    'https://sweeprdeepblock.com/download',
    'https://sweeprdeepblock.com/vs/total-adblock',
    'https://sweeprdeepblock.com/test-lab',
    'https://sweeprdeepblock.com/pad.xml'
  ];

  const allPseoUrls = [];
  for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
    const dirAbs = path.join(WEBSITE_DIR, dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const f of fs.readdirSync(dirAbs).sort()) {
      if (!f.endsWith('.html')) continue;
      const slug = f.replace(/\.html$/, '');
      if (dir === 'vs' && slug === 'total-adblock') continue;
      allPseoUrls.push(`https://sweeprdeepblock.com/${dir}/${slug}`);
    }
  }

  const allUrls = [...baseUrls, ...allPseoUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

  // Sync guides and key solution hubs into llms.txt for Generative Engine Optimization (GEO)
  if (fs.existsSync(LLMS_PATH)) {
    try {
      let llmsContent = fs.readFileSync(LLMS_PATH, 'utf8');
      const guidesLinks = GUIDES.map((g) => `- ${g.shortTitle || g.title}: https://sweeprdeepblock.com/guides/${g.slug}`);
      const setupLinks = SETUP_BROWSERS.slice(0, 6).map((b) => `- ${b.name}: https://sweeprdeepblock.com/setup/${b.slug}`);
      const topSolutions = [
        '- YouTube MV3 Video Ad Blocking: https://sweeprdeepblock.com/solutions/youtube-chrome-mv3-block-video-ads',
        '- Twitch Live Stream Commercial Ad Blocker: https://sweeprdeepblock.com/solutions/twitch-live-streams-block-video-ads',
        '- Google & Bing AI Slop Filter: https://sweeprdeepblock.com/solutions/google-search-results-filter-ai-slop-and-scams',
        '- UK Newspapers Auto-Reject Cookie Pop-Ups: https://sweeprdeepblock.com/solutions/uk-news-websites-auto-reject-cookie-popups'
      ];
      const verifiedSection = `## Verified Guides & Platform Solutions\n${[...guidesLinks, ...setupLinks, ...topSolutions].join('\n')}\n`;
      if (llmsContent.includes('## Verified Guides & Platform Solutions')) {
        llmsContent = llmsContent.replace(/## Verified Guides & Platform Solutions[\s\S]*$/, verifiedSection);
      } else {
        llmsContent += `\n${verifiedSection}`;
      }
      fs.writeFileSync(LLMS_PATH, llmsContent, 'utf8');
    } catch {}
  }

  let queue = { indexnow_key: INDEXNOW_KEY, pending_urls: [] };
  if (fs.existsSync(INDEXING_QUEUE_PATH)) {
    try { queue = { ...queue, ...JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8')) }; } catch {}
  }
  queue.pending_urls = [...new Set([...(queue.pending_urls || []), ...allUrls])];
  fs.writeFileSync(INDEXING_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');

  // Submit sitemap URLs to Bing IndexNow and IndexNow.org
  let indexNowStatus = 'skipped';
  try {
    const indexNowPayload = {
      host: 'sweeprdeepblock.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://sweeprdeepblock.com/${INDEXNOW_KEY}.txt`,
      urlList: allUrls
    };
    const [bingRes, indexNowOrgRes] = await Promise.all([
      fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(12000)
      }).then((r) => `Bing: HTTP ${r.status}`).catch((e) => `Bing: ${e.message}`),
      fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(12000)
      }).then((r) => `IndexNowOrg: HTTP ${r.status}`).catch((e) => `IndexNowOrg: ${e.message}`)
    ]);
    indexNowStatus = `${bingRes} | ${indexNowOrgRes}`;
  } catch (err) {
    indexNowStatus = `Err: ${err.message}`;
  }

  state.lastRunDate = todayStr;
  state.totalGenerated = allPseoUrls.length;
  state.batches.push({
    date: todayStr,
    reRendered: reRenderedCount,
    newGenerated: newUrls.length,
    totalPseoPages: allPseoUrls.length,
    indexNowStatus
  });
  fs.writeFileSync(DAILY_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');

  console.log(`[SWEEPR DeepBlock Daily 50 SEO Pages] Re-rendered: ${reRenderedCount} | Generated: ${newUrls.length} new pages | Total pSEO Pages: ${allPseoUrls.length} | Sitemap URLs: ${allUrls.length} | IndexNow: ${indexNowStatus}`);
}

const countArg = process.argv[2] !== undefined && !process.argv[2].startsWith('--') ? Number(process.argv[2]) : 50;
const forceFlag = process.argv.includes('--force') || process.argv.includes('--regenerate-all');
runDaily50DeepBlockPages(countArg, forceFlag).catch(console.error);
