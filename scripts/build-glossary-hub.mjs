#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Step 2.9: Privacy & Ad-Tech Glossary Hub (`/glossary` + 20 Entries `/glossary/*`)
 *
 * Implements Inpages Strategy #7 (Glossary & Concept Hub) coupled with Strategy #6 (Tool Links):
 *  - Builds `website/glossary/index.html` (`/glossary`)
 *  - Builds 20 technical glossary pages in `website/glossary/{slug}.html` with `DefinedTerm` JSON-LD schema
 *  - Links every glossary term directly to the corresponding `/tools/*` diagnostic tool and `/site/*` audit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const GLOSSARY_DIR = path.join(ROOT_DIR, 'website', 'glossary');

fs.mkdirSync(GLOSSARY_DIR, { recursive: true });

const todayStr = new Date().toISOString().slice(0, 10);

const GLOSSARY_TERMS = [
  {
    slug: 'manifest-v3-declarative-net-request',
    term: 'Manifest V3 declarativeNetRequest (DNR)',
    shortTitle: 'What is Manifest V3 declarativeNetRequest? | SWEEPR Glossary',
    description: 'Learn how Chrome and Edge Manifest V3 declarativeNetRequest (DNR) rules block ads and trackers at the browser network stack with zero browsing history access.',
    category: 'Browser Architecture',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Is My AdBlocker Working? MV3 Test',
    siteSlug: 'forbes-com',
    definition: 'Manifest V3 declarativeNetRequest (DNR) is the modern Chromium extension network-filtering API where extensions register declarative JSON rule tables evaluated natively by the browser C++ network stack rather than intercepting every URL inside a JavaScript background page.',
    mechanism: 'Instead of reading every URL you visit in JavaScript (the legacy Manifest V2 webRequestBlocking model), DNR compiles static and dynamic rulesets directly into the browser engine. SWEEPR DeepBlock combines high-priority MV3 DNR rules with a document_start DeepStealth content script to block ads and bypass anti-adblock walls.'
  },
  {
    slug: 'cname-cloaking-trackers',
    term: 'CNAME Cloaking Trackers',
    shortTitle: 'What is CNAME Cloaking in Ad Tracking? | SWEEPR Glossary',
    description: 'Understand how CNAME cloaking disguises third-party tracking servers as first-party subdomains via DNS records, and how SWEEPR DeepBlock blocks them.',
    category: 'Network Tracking',
    toolPath: '/tools/dns-leak-test',
    toolName: 'DNS Leak & Tracker Parameter Test',
    siteSlug: 'dailymail-co-uk',
    definition: 'CNAME cloaking is an evasion technique where a website points a first-party subdomain (such as metrics.publisher.com) to a third-party tracking vendor using a DNS CNAME record so browsers treat third-party tracking cookies as first-party.',
    mechanism: 'Because Chromium MV3 extensions cannot perform synchronous DNS lookups during request evaluation, SWEEPR DeepBlock compiles known CNAME-cloaked tracker subdomains directly into our daily OTA DNR filter delta.'
  },
  {
    slug: 'canvas-fingerprinting',
    term: 'HTML5 Canvas Fingerprinting',
    shortTitle: 'What is HTML5 Canvas Fingerprinting? | SWEEPR Glossary',
    description: 'Discover how invisible HTML5 canvas rendering identifies your GPU, font sub-pixel antialiasing, and OS driver without cookies, and how to test your browser.',
    category: 'Browser Fingerprinting',
    toolPath: '/tools/browser-fingerprint-test',
    toolName: 'Browser Fingerprint Entropy Test',
    siteSlug: 'fandom-com',
    definition: 'HTML5 Canvas Fingerprinting is a stateless tracking technique that instructs your browser to draw hidden 2D text and shapes on an <canvas> element and hashes the resulting pixel array via toDataURL() to create a persistent hardware identifier.',
    mechanism: 'Slight differences in GPU shaders, graphics drivers, and OS font rasterization produce a deterministic hash across sessions even in Incognito mode. SWEEPR DeepBlock blocks known fingerprinting scripts (FingerprintJS, ThreatMetrix, Moat) before they execute.'
  },
  {
    slug: 'dns-over-https-doh',
    term: 'DNS-over-HTTPS (DoH)',
    shortTitle: 'What is DNS-over-HTTPS (DoH) Encrypted DNS? | SWEEPR Glossary',
    description: 'Learn how DNS-over-HTTPS (DoH) encrypts domain lookups over port 443 to prevent ISP snooping and DNS manipulation, and test your browser for DNS leaks.',
    category: 'Encrypted DNS',
    toolPath: '/tools/dns-leak-test',
    toolName: 'Live DNS & WebRTC Leak Test',
    siteSlug: 'independent-co-uk',
    definition: 'DNS-over-HTTPS (DoH, RFC 8484) is a security protocol that encrypts Domain Name System (DNS) resolution queries inside standard HTTPS TLS traffic on port 443 rather than sending plaintext UDP packets on port 53.',
    mechanism: 'Without DoH, your ISP or public Wi-Fi operator can log every hostname your browser resolves even when visiting HTTPS websites. Pairing encrypted DoH resolvers with SWEEPR DeepBlock prevents ISP domain logging.'
  },
  {
    slug: 'tcf-v2-cookie-consent-cmp',
    term: 'TCF v2.2 Cookie Consent CMP',
    shortTitle: 'What is a TCF v2.2 Cookie Consent CMP? | SWEEPR Glossary',
    description: 'Learn how IAB TCF v2.2 Consent Management Platforms (OneTrust, Sourcepoint, Quantcast, Didomi) work and how SWEEPR DeepBlock auto-rejects them in <50ms.',
    category: 'Cookie Privacy',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Cookie CMP Auto-Reject Test',
    siteSlug: 'mirror-co-uk',
    definition: 'A Consent Management Platform (CMP) implementing the IAB Transparency and Consent Framework (TCF v2.2) is the pop-up dialog used by publishers to request GDPR/UK-GDPR permission to share your data with hundreds of programmatic ad vendors.',
    mechanism: 'Instead of merely hiding the modal with CSS (which leaves scroll-locks intact or defaults to legitimate-interest tracking), SWEEPR DeepBlock detects OneTrust, Sourcepoint, Quantcast, TrustArc, and Didomi dialogs and clicks the non-essential rejection button in under 50ms.'
  },
  {
    slug: 'webrtc-ip-leak',
    term: 'WebRTC STUN/TURN IP Leak',
    shortTitle: 'What is a WebRTC IP Leak in Browsers? | SWEEPR Glossary',
    description: 'Understand how WebRTC RTCPeerConnection ICE candidate discovery can expose your network IP address and how to test your browser for WebRTC leaks.',
    category: 'Encrypted DNS',
    toolPath: '/tools/dns-leak-test',
    toolName: 'WebRTC & DNS Leak Diagnostic',
    siteSlug: 'express-co-uk',
    definition: 'A WebRTC IP leak occurs when a webpage uses the browser RTCPeerConnection API to query STUN/TURN servers and discover your local or public IP addresses outside normal HTTP proxy routing.',
    mechanism: 'Ad-tech and anti-fraud scripts abuse silent WebRTC data channels to correlate users across sessions. Our DNS & WebRTC Leak Test inspects RTCPeerConnection ICE candidates directly in your browser.'
  },
  {
    slug: 'malvertising-popunders',
    term: 'Malvertising & Popunder Redirects',
    shortTitle: 'What is Malvertising & Popunder Adware? | SWEEPR Glossary',
    description: 'Learn how malicious ad-exchange payloads and popunder scripts hijack browser tabs to push fake antivirus scares and phishing pages, and how to block them.',
    category: 'Threat Protection',
    toolPath: '/tools/is-this-shop-a-scam',
    toolName: 'Scam & Malvertising URL Scanner',
    siteSlug: 'dexerto-com',
    definition: 'Malvertising is the injection of malicious JavaScript, forced redirects, or background popunder windows through legitimate real-time bidding (RTB) ad exchanges.',
    mechanism: 'SWEEPR DeepBlock blocks known popunder networks (PropellerAds, ExoClick, PopAds, Clickadu) at the MV3 network layer and monitors chrome.tabs.onCreated to automatically close unauthorized popunder child tabs.'
  },
  {
    slug: 'youtube-server-side-ad-injection',
    term: 'Server-Side Ad Injection (SSAI)',
    shortTitle: 'What is Server-Side Video Ad Injection? | SWEEPR Glossary',
    description: 'Learn how video streaming platforms splice ads directly into HLS/DASH media manifests and how Manifest V3 DeepStealth neutralizes video ad interruptions.',
    category: 'Video Ad Blocking',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Video & MV3 Ad-Blocker Test',
    siteSlug: 'ign-com',
    definition: 'Server-Side Ad Injection (SSAI) stitches video advertisements directly into the primary media stream or player state object so simple network domain blocking cannot separate the ad from the video.',
    mechanism: 'SWEEPR DeepBlock combines MV3 network rules with a document_start MAIN-world stealth script that sanitizes player ad-slot configurations and fast-forwards residual pre-roll containers.'
  },
  {
    slug: 'acceptable-ads-program',
    term: 'Acceptable Ads Whitelist Program',
    shortTitle: 'What is the Acceptable Ads Whitelist Program? | SWEEPR Glossary',
    description: 'Why do some adblockers still show sponsored banners and search ads? Learn how the Acceptable Ads program works and why SWEEPR DeepBlock refuses whitelists.',
    category: 'Industry Ethics',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Test If Your AdBlocker Allows Whitelisted Ads',
    siteSlug: 'thesun-co-uk',
    definition: 'The Acceptable Ads program is a commercial licensing arrangement where large ad networks and tech companies pay fees to ad-blocking vendors to have their ads whitelisted by default.',
    mechanism: 'Extensions participating in Acceptable Ads enable paid whitelist rulesets out of the box. SWEEPR DeepBlock takes zero Acceptable Ads payments—every ad network is blocked strictly on technical criteria.'
  },
  {
    slug: 'audio-context-fingerprinting',
    term: 'AudioContext Fingerprinting',
    shortTitle: 'What is Web Audio API Fingerprinting? | SWEEPR Glossary',
    description: 'Understand how trackers use OfflineAudioContext oscillator waveforms to fingerprint your audio stack without playing sound, and test your browser exposure.',
    category: 'Browser Fingerprinting',
    toolPath: '/tools/browser-fingerprint-test',
    toolName: 'AudioContext & Canvas Fingerprint Test',
    siteSlug: 'pcgamer-com',
    definition: 'AudioContext fingerprinting uses the browser OfflineAudioContext API to generate a silent mathematical triangle oscillator signal and pass it through a DynamicsCompressorNode, hashing the floating-point output.',
    mechanism: 'Because CPU floating-point implementations and OS audio stacks process DSP math slightly differently, the resulting sum acts as a high-entropy device identifier alongside Canvas and WebGL hashes.'
  },
  {
    slug: 'webgl-hardware-fingerprinting',
    term: 'WebGL GPU Hardware Fingerprinting',
    shortTitle: 'What is WebGL GPU Hardware Fingerprinting? | SWEEPR Glossary',
    description: 'See how websites read WEBGL_debug_renderer_info to identify your exact graphics card model and driver version, and run a live WebGL fingerprint check.',
    category: 'Browser Fingerprinting',
    toolPath: '/tools/browser-fingerprint-test',
    toolName: 'WebGL & Hardware Fingerprint Test',
    siteSlug: 'tomshardware-com',
    definition: 'WebGL hardware fingerprinting queries the browser WebGLRenderingContext and the WEBGL_debug_renderer_info extension to extract your unmasked GPU vendor, graphics card model, and shader precision.',
    mechanism: 'Combined with screen resolution and navigator.hardwareConcurrency, WebGL renderer strings narrow down a browser to a small anonymity set. Test your exact unmasked WebGL renderer in our Fingerprint Lab.'
  },
  {
    slug: 'url-tracking-parameters-utm-fbclid-gclid',
    term: 'URL Tracking Parameters (fbclid, gclid, msclkid)',
    shortTitle: 'What are fbclid, gclid & utm Tracking Links? | SWEEPR Glossary',
    description: 'Learn how click-ID query parameters (fbclid, gclid, msclkid, ttclid, mc_cid) track you across websites and how MV3 queryTransform strips them automatically.',
    category: 'Network Tracking',
    toolPath: '/tools/dns-leak-test',
    toolName: 'URL Tracking Parameter Stripper Test',
    siteSlug: 'techradar-com',
    definition: 'URL tracking parameters such as fbclid (Meta), gclid (Google), msclkid (Microsoft), and mc_cid (Mailchimp) are unique click identifiers appended to outbound links to tie your browsing session back to an ad profile.',
    mechanism: 'SWEEPR DeepBlock uses native Manifest V3 declarativeNetRequest redirect rules with queryTransform.removeParams to strip cross-site tracking tokens before the HTTP request leaves your browser.'
  },
  {
    slug: 'browser-tab-discarding-hibernation',
    term: 'Browser Tab Discarding & RAM Hibernation',
    shortTitle: 'What is Browser Tab Discarding & Hibernation? | SWEEPR Glossary',
    description: 'Discover how background ad-auction timers bloat Chrome and Edge memory usage to 8GB+ and how native tab discarding frees up to 62% of browser RAM.',
    category: 'Browser Performance',
    toolPath: '/tools/browser-ram-calculator',
    toolName: 'Browser RAM & Tab Bloat Calculator',
    siteSlug: 'fandom-com',
    definition: 'Browser tab discarding (hibernation) is the process of unloading inactive background renderer processes from system RAM via the native chrome.tabs.discard API while keeping the tab visible on the tab strip.',
    mechanism: 'Open publisher tabs continuously run Prebid.js header-bidding auctions every 30 seconds in the background. SWEEPR DeepBlock + Total Tab & RAM Tamer blocks the ad timers and automatically hibernates idle tabs while backing up your session.'
  },
  {
    slug: 'first-party-tracker-proxies',
    term: 'First-Party Tracker Proxies',
    shortTitle: 'What are First-Party Server-Side Tracker Proxies? | SWEEPR Glossary',
    description: 'Learn how websites proxy analytics and ad pixels through first-party paths and how modern content blockers distinguish essential assets from tracking beacons.',
    category: 'Network Tracking',
    toolPath: '/tools/dns-leak-test',
    toolName: 'Tracker & DNS Diagnostic Tool',
    siteSlug: 'businessinsider-com',
    definition: 'A first-party tracker proxy routes third-party analytics or ad-pixel payloads through a path on the publisher’s own root domain so naive domain-only blocklists fail to catch the beacon.',
    mechanism: 'SWEEPR DeepBlock inspects URL path signatures, query parameter patterns, and script behavior rather than relying solely on third-party domain names.'
  },
  {
    slug: 'shadow-dom-ad-injection',
    term: 'Shadow DOM Ad Injection',
    shortTitle: 'What is Shadow DOM Ad Injection? | SWEEPR Glossary',
    description: 'Understand how ad networks encapsulate sponsored widgets inside closed or open Shadow DOM trees to evade standard CSS cosmetic filters.',
    category: 'Browser Architecture',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'DOM & Cosmetic Ad-Slot Test',
    siteSlug: 'allrecipes-com',
    definition: 'Shadow DOM ad injection places promotional banners and chumbox widgets inside encapsulated Web Component shadow roots so global document stylesheets cannot hide them.',
    mechanism: 'By blocking the underlying widget loader script at the MV3 DNR network layer before the custom element is defined, SWEEPR DeepBlock prevents Shadow DOM ad units from rendering.'
  },
  {
    slug: 'anti-adblock-bait-detection',
    term: 'Anti-Adblock Bait Detection Scripts',
    shortTitle: 'How Do Anti-Adblock Bait Scripts Work? | SWEEPR Glossary',
    description: 'Learn how Admiral, BlockAdBlock, and Funding Choices use invisible .adsbox bait elements and fake pagead2 fetches to detect adblockers—and how DeepStealth passes.',
    category: 'Anti-Adblock Stealth',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Run 8-Point Anti-Adblock Stealth Test',
    siteSlug: 'forbes-com',
    definition: 'Anti-adblock bait detection scripts create decoy DOM elements (such as <div class="adsbox">) or request dummy ad scripts (pagead2.googlesyndication.com) and check whether offsetHeight === 0 or the network request failed.',
    mechanism: 'SWEEPR DeepBlock redirects bait script requests to local 200 OK neutered shims (/rules/empty.js) and preserves bait geometry in <head> while neutralizing Admiral and Funding Choices wall overlays.'
  },
  {
    slug: 'ai-slop-search-spam',
    term: 'AI Slop & Programmatic Search Spam',
    shortTitle: 'What is AI Slop Search Spam? | SWEEPR Glossary',
    description: 'Learn how mass-produced AI scraper farms pollute Google, Bing, and DuckDuckGo search results and how SWEEPR DeepBlock cleanses SERPs in real time.',
    category: 'Search Hygiene',
    toolPath: '/tools/is-this-shop-a-scam',
    toolName: 'AI Slop & Scam Domain Checker',
    siteSlug: 'geeksforgeeks-org',
    definition: 'AI Slop search spam refers to low-quality, LLM-generated content farms and scraped code/recipe aggregator domains designed purely to rank for long-tail search queries and serve high-density programmatic ads.',
    mechanism: 'SWEEPR DeepBlock’s Search Slop Purifier scores search result cards on Google, Bing, and DuckDuckGo against known content-farm domains and synthetic boilerplate patterns, collapsing spam results cleanly.'
  },
  {
    slug: 'fake-shopify-dropshipping-scam-indicators',
    term: 'Fake Online Shop & Dropshipping Scam Indicators',
    shortTitle: 'How to Spot Fake Online Shops & Scam Stores | SWEEPR Glossary',
    description: 'Discover the 6 technical red flags of fake UK/US closing-down sale dropshipping scam stores and test any URL instantly in our Scam Shop Detector.',
    category: 'Threat Protection',
    toolPath: '/tools/is-this-shop-a-scam',
    toolName: 'Free Online Shop Scam Checker',
    siteSlug: 'dailymail-co-uk',
    definition: 'Fake online shop scams are fraudulent e-commerce storefronts—often promoted via social media ads claiming a "Heritage Boutique Closing Down Sale — 80% Off"—that ship counterfeit goods or steal payment details.',
    mechanism: 'SWEEPR DeepBlock evaluates storefront DOM heuristics in real time: fabricated countdown timers,cloned review stars without verified merchant IDs, Newly Registered Domain (NRD) patterns, and missing company registration disclosures.'
  },
  {
    slug: 'header-bidding-openrtb-latency',
    term: 'Header Bidding & OpenRTB Latency',
    shortTitle: 'What is Header Bidding (Prebid / OpenRTB) Latency? | SWEEPR Glossary',
    description: 'Understand how Prebid.js and OpenRTB real-time ad auctions fire 50+ simultaneous network requests on page load and how blocking them speeds up browsing.',
    category: 'Browser Performance',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Test Ad-Auction Network Blocking',
    siteSlug: 'manchestereveningnews-co-uk',
    definition: 'Header bidding (typically powered by Prebid.js and OpenRTB endpoints) is a programmatic auction where a webpage simultaneously queries 15 to 40 Supply-Side Platforms (PubMatic, Rubicon, Criteo, AppNexus, Index Exchange) before rendering page content.',
    mechanism: 'Each auction round saturates browser main-thread CPU and network sockets. Blocking OpenRTB auction endpoints at the MV3 DNR layer eliminates 3 to 5 seconds of page-load delay on news and recipe sites.'
  },
  {
    slug: 'cryptojacking-webassembly-miners',
    term: 'Browser Cryptojacking & WebAssembly Miners',
    shortTitle: 'What is Browser Cryptojacking? | SWEEPR Glossary',
    description: 'Learn how unauthorized WebAssembly and WebWorker scripts hijack your CPU to mine cryptocurrency in background tabs, and how SWEEPR DeepBlock blocks them.',
    category: 'Threat Protection',
    toolPath: '/tools/is-my-adblocker-working',
    toolName: 'Browser Security & Blocker Diagnostic',
    siteSlug: 'u-gg',
    definition: 'Browser cryptojacking is the unauthorized use of a visitor’s CPU and GPU via WebAssembly (Wasm) and WebWorkers to mine cryptocurrency while a tab remains open.',
    mechanism: 'SWEEPR DeepBlock blocks known mining pools and WebAssembly miner loaders at the network layer and hibernates inactive background tabs so rogue scripts cannot drain laptop battery.'
  }
];

function renderGlossaryPage(item, idx, allItems) {
  const canonical = `https://sweeprdeepblock.com/glossary/${item.slug}`;
  const related = [
    allItems[(idx + 1) % allItems.length],
    allItems[(idx + 3) % allItems.length],
    allItems[(idx + 6) % allItems.length]
  ];

  const schemaJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        name: item.term,
        description: item.definition,
        inDefinedTermSet: 'https://sweeprdeepblock.com/glossary',
        url: canonical
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sweeprdeepblock.com/' },
          { '@type': 'ListItem', position: 2, name: 'Privacy & Ad-Tech Glossary', item: 'https://sweeprdeepblock.com/glossary' },
          { '@type': 'ListItem', position: 3, name: item.term, item: canonical }
        ]
      }
    ]
  });

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${item.shortTitle}</title>
  <meta name="description" content="${item.description}" />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="canonical" href="${canonical}" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${item.shortTitle}" />
  <meta property="og:description" content="${item.description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${item.shortTitle}" />
  <meta name="twitter:description" content="${item.description}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script type="application/ld+json">${schemaJson}</script>
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', { transport_url: window.location.origin + '/metrics', first_party_collection: true });
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
  <header class="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2.5 text-white font-black text-lg tracking-tight no-underline">
        <img src="/logo.svg" alt="SWEEPR DeepBlock logo" width="32" height="32" class="w-8 h-8" />
        <span>SWEEPR <span class="text-emerald-400">DeepBlock</span></span>
      </a>
      <nav class="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-300">
        <a href="/glossary" class="text-emerald-400">Glossary</a>
        <a href="/site" class="hover:text-white">Site Audits</a>
        <a href="/campaigns/uk-ad-load-index" class="hover:text-white">UK Ad-Load Index</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
      </nav>
      <a href="${item.toolPath}" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm no-underline">
        Run Live Test →
      </a>
    </div>
  </header>

  <main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
        <a href="/glossary" class="hover:underline">Privacy &amp; Ad-Tech Glossary</a>
        <span>/</span>
        <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">${item.category}</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-black text-white">${item.term}</h1>
    </div>

    <section class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
      <h2 class="text-lg font-black text-emerald-400 uppercase tracking-wide">Technical Definition</h2>
      <p class="text-slate-200 text-base leading-relaxed">${item.definition}</p>
      <h2 class="text-lg font-black text-teal-300 uppercase tracking-wide pt-3">How SWEEPR DeepBlock Mitigates It</h2>
      <p class="text-slate-300 text-sm sm:text-base leading-relaxed">${item.mechanism}</p>
    </section>

    <!-- Direct Interactive Diagnostic Tool Link -->
    <section class="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
      <div class="space-y-1.5">
        <div class="text-xs font-extrabold uppercase text-emerald-300">Interactive Browser Diagnostic</div>
        <h3 class="text-xl font-black text-white">Test Your Browser Against ${item.term}</h3>
        <p class="text-sm text-slate-300">Run our free client-side diagnostic tool or inspect a live publisher audit report.</p>
      </div>
      <div class="flex flex-wrap gap-3 shrink-0">
        <a href="${item.toolPath}" class="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm no-underline">${item.toolName} →</a>
        <a href="/site/${item.siteSlug}" class="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 no-underline">View Live Site Audit</a>
      </div>
    </section>

    <section class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-3">
      <h3 class="text-sm font-black uppercase tracking-wider text-slate-300">Related Privacy &amp; Ad-Tech Concepts</h3>
      <ul class="space-y-2 text-sm">
        ${related.map((r) => `<li><a href="/glossary/${r.slug}" class="text-emerald-400 hover:underline font-semibold">${r.term}</a> — ${r.category}</li>`).join('\n')}
        <li><a href="/glossary" class="text-teal-300 hover:underline font-bold">Browse All 20 Privacy &amp; Ad-Tech Glossary Entries →</a></li>
      </ul>
    </section>
  </main>

  <footer class="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div>© 2026 SWEEPR Global Limited. Local-first Manifest V3 engine.</div>
      <div class="flex flex-wrap gap-4">
        <a href="https://sweeprcleaner.com/?utm_source=sweeprdeepblock.com&amp;utm_medium=glossary_footer" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Sweepr Cleaner</a>
        <a href="https://sweeprvpn.com/?utm_source=sweeprdeepblock.com&amp;utm_medium=glossary_footer" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Sweepr VPN</a>
        <a href="/order?plan=suite_annual" class="text-emerald-300 font-bold hover:underline">Complete Suite (£89.99/yr)</a>
        <a href="/glossary" class="hover:text-white">Glossary</a>
        <a href="/site" class="hover:text-white">Site Reports</a>
        <a href="/stories" class="hover:text-white">Customer Stories</a>
        <a href="/de" class="hover:text-white">Deutsch (/de)</a>
        <a href="/fr" class="hover:text-white">Français (/fr)</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
        <a href="/privacy" class="hover:text-white">Privacy Policy</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

for (let i = 0; i < GLOSSARY_TERMS.length; i++) {
  const item = GLOSSARY_TERMS[i];
  fs.writeFileSync(path.join(GLOSSARY_DIR, `${item.slug}.html`), renderGlossaryPage(item, i, GLOSSARY_TERMS), 'utf8');
}

const glossaryHubHtml = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Browser Privacy, Manifest V3 &amp; Ad-Tech Glossary | SWEEPR</title>
  <meta name="description" content="Comprehensive 2026 technical glossary explaining Manifest V3 declarativeNetRequest, CNAME cloaking, canvas fingerprinting, TCF v2.2 CMPs, and DNS-over-HTTPS." />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="canonical" href="https://sweeprdeepblock.com/glossary" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Browser Privacy, Manifest V3 &amp; Ad-Tech Glossary | SWEEPR" />
  <meta property="og:description" content="Explore 20 technical guides on browser fingerprinting, Manifest V3 ad blocking, CNAME cloaking, and GDPR cookie consent CMPs." />
  <meta property="og:url" content="https://sweeprdeepblock.com/glossary" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Browser Privacy, Manifest V3 &amp; Ad-Tech Glossary | SWEEPR" />
  <meta name="twitter:description" content="Explore 20 technical guides on browser fingerprinting, Manifest V3 ad blocking, CNAME cloaking, and GDPR cookie consent CMPs." />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'SWEEPR DeepBlock Browser Privacy & Ad-Tech Glossary',
    url: 'https://sweeprdeepblock.com/glossary',
    description: 'Technical definitions and interactive diagnostic links for 20 core ad-blocking, anti-fingerprinting, and browser security concepts.'
  })}</script>
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', { transport_url: window.location.origin + '/metrics', first_party_collection: true });
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
  <header class="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2.5 text-white font-black text-lg tracking-tight no-underline">
        <img src="/logo.svg" alt="SWEEPR DeepBlock logo" width="32" height="32" class="w-8 h-8" />
        <span>SWEEPR <span class="text-emerald-400">DeepBlock</span></span>
      </a>
      <nav class="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-300">
        <a href="/site" class="hover:text-white">Site Audits</a>
        <a href="/campaigns/uk-ad-load-index" class="hover:text-white">UK Ad-Load Index</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
        <a href="/pricing" class="hover:text-white">Pricing</a>
      </nav>
      <a href="/download" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm no-underline">Get Extension →</a>
    </div>
  </header>
  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
    <div class="space-y-3">
      <span class="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase">20 Core Privacy &amp; Ad-Tech Concepts</span>
      <h1 class="text-3xl sm:text-4xl font-black text-white">Browser Privacy, Manifest V3 &amp; Ad-Tech Glossary</h1>
      <p class="text-slate-300 max-w-3xl text-sm sm:text-base">Plain-English and engineering-grade explanations of how modern ad auctions, CNAME trackers, hardware fingerprinters, and cookie consent CMPs operate—and how to test your browser against each vector.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${GLOSSARY_TERMS.map(
        (g) => `<a href="/glossary/${g.slug}" class="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 transition no-underline space-y-2">
        <div class="text-xs font-bold uppercase text-emerald-400">${g.category}</div>
        <div class="text-lg font-black text-white">${g.term}</div>
        <p class="text-xs text-slate-300 line-clamp-2">${g.definition}</p>
        <div class="text-xs font-bold text-teal-300 pt-1">Read Definition &amp; Run Live Test →</div>
      </a>`
      ).join('\n')}
    </div>
  </main>
  <footer class="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div>© 2026 SWEEPR Global Limited. Local-first Manifest V3 engine.</div>
      <div class="flex flex-wrap gap-4">
        <a href="https://sweeprcleaner.com/?utm_source=sweeprdeepblock.com&amp;utm_medium=glossary_hub" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Sweepr Cleaner</a>
        <a href="https://sweeprvpn.com/?utm_source=sweeprdeepblock.com&amp;utm_medium=glossary_hub" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Sweepr VPN</a>
        <a href="/order?plan=suite_annual" class="text-emerald-300 font-bold hover:underline">Complete Suite (£89.99/yr)</a>
        <a href="/site" class="hover:text-white">Site Audits</a>
        <a href="/stories" class="hover:text-white">Customer Stories</a>
        <a href="/de" class="hover:text-white">Deutsch (/de)</a>
        <a href="/fr" class="hover:text-white">Français (/fr)</a>
        <a href="/campaigns/uk-ad-load-index" class="hover:text-white">UK Ad-Load Index</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
fs.writeFileSync(path.join(GLOSSARY_DIR, 'index.html'), glossaryHubHtml, 'utf8');

console.log(`Built /glossary hub + ${GLOSSARY_TERMS.length} technical glossary pages.`);
