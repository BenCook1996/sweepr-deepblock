#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Privacy & Ad-Tech Glossary Hub (`/glossary` + 20 Entries `/glossary/*`)
 *
 * Holographic Pearl Light Shell + M1 Decision Compliant:
 *  - `/glossary` (`KEEP_REWRITE`, indexable): self-contained technical glossary covering shipped
 *    v1.3.1 MV3 DNR, TCF v2.2 CMP, URL parameter stripping, Header Bidding, Shadow DOM,
 *    Cryptojacking, Tab Discarding, and SSAI concepts — zero links to pruned/301 routes.
 *  - 2 `/glossary/{slug}` (`CONSOLIDATE_301`): `noindex, follow` + target canonical.
 *  - 18 `/glossary/{slug}` (`NOINDEX_PRUNE`): `noindex, nofollow` + self-canonical.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_ORIGIN,
  PRODUCT_FACTS,
  escapeHtml,
  buildJsonLd,
  renderShellPage,
  renderBreadcrumbs,
  renderGlassCard,
  renderCtaBanner,
  renderRelatedGrid,
  getM1Decision
} from './lib/holographic-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const GLOSSARY_DIR = path.join(ROOT_DIR, 'website', 'glossary');

fs.mkdirSync(GLOSSARY_DIR, { recursive: true });

const VERSION = PRODUCT_FACTS.version;
const STATIC_RULES = PRODUCT_FACTS.staticDnrRules;

const GLOSSARY_TERMS = [
  {
    slug: 'manifest-v3-declarative-net-request',
    includeInHub: true,
    term: 'Manifest V3 declarativeNetRequest (DNR)',
    shortTitle: 'What is Manifest V3 declarativeNetRequest? | SWEEPR Glossary',
    description: `Learn how Chrome and Edge Manifest V3 declarativeNetRequest (DNR) rules block ads and trackers at the browser network stack with zero browsing history access.`,
    category: 'Browser Architecture',
    ctaHref: '/benchmarks',
    ctaLabel: 'Explore v1.3.1 MV3 Benchmarks',
    definition: 'Manifest V3 declarativeNetRequest (DNR) is the modern Chromium extension network-filtering API where extensions register declarative JSON rule tables evaluated natively by the browser C++ network stack rather than intercepting every URL inside a JavaScript background page.',
    mechanism: `Instead of reading every URL you visit in JavaScript (the legacy Manifest V2 webRequestBlocking model), DNR compiles static and dynamic rulesets directly into the browser engine. SWEEPR Deepblock v${VERSION} combines ${STATIC_RULES} static DNR rules with 100 dynamic OTA rules and a document_start content script to filter ads and handle anti-adblock walls locally.`
  },
  {
    slug: 'cname-cloaking-trackers',
    includeInHub: true,
    term: 'CNAME Cloaking Trackers',
    shortTitle: 'What is CNAME Cloaking in Ad Tracking? | SWEEPR Glossary',
    description: 'Understand how CNAME cloaking disguises third-party tracking servers as first-party subdomains via DNS records, and how MV3 DNR filter lists address known endpoints.',
    category: 'Network Tracking',
    ctaHref: '/test-lab',
    ctaLabel: 'Run Browser Test Lab',
    definition: 'CNAME cloaking is an evasion technique where a website points a first-party subdomain (such as metrics.publisher.com) to a third-party tracking vendor using a DNS CNAME record so browsers treat third-party tracking cookies as first-party.',
    mechanism: `Because Chromium MV3 extensions cannot perform synchronous DNS lookups during request evaluation, SWEEPR Deepblock v${VERSION} compiles known CNAME-cloaked tracker host patterns directly into its ${STATIC_RULES} static rules and 100 OTA filter delta rules.`
  },
  {
    slug: 'canvas-fingerprinting',
    includeInHub: true,
    term: 'HTML5 Canvas Fingerprinting',
    shortTitle: 'What is HTML5 Canvas Fingerprinting? | SWEEPR Glossary',
    description: 'Discover how invisible HTML5 canvas scripts identify GPU and font rasterization characteristics without cookies, and how blocking third-party tracker scripts limits exposure.',
    category: 'Browser Fingerprinting',
    ctaHref: '/test-lab',
    ctaLabel: 'Run Browser Test Lab',
    definition: 'HTML5 Canvas Fingerprinting is a stateless tracking technique that instructs your browser to draw hidden 2D text and shapes on a canvas element and hashes the resulting pixel array via toDataURL() to generate a hardware-correlated identifier.',
    mechanism: `Slight differences in GPU shaders, graphics drivers, and OS font rasterization produce consistent signatures across sessions even in Incognito mode. SWEEPR Deepblock v${VERSION} blocks known third-party fingerprinting and analytics scripts at the DNR network layer before they execute.`
  },
  {
    slug: 'dns-over-https-doh',
    includeInHub: false,
    term: 'DNS-over-HTTPS (DoH)',
    shortTitle: 'What is DNS-over-HTTPS (DoH) Encrypted DNS? | SWEEPR Glossary',
    description: 'Learn how DNS-over-HTTPS (DoH) encrypts domain lookups over port 443 inside your browser settings to reduce ISP plaintext DNS snooping.',
    category: 'Network Privacy',
    ctaHref: '/benchmarks',
    ctaLabel: 'Inspect Extension Architecture',
    definition: 'DNS-over-HTTPS (DoH, RFC 8484) is a transport protocol that encrypts Domain Name System (DNS) resolution queries inside standard HTTPS TLS traffic on port 443 rather than sending plaintext UDP packets on port 53.',
    mechanism: `Enabling Secure DNS in Chrome, Edge, or Firefox encrypts domain lookups at the browser resolver level. SWEEPR Deepblock v${VERSION} complements browser-level Secure DNS by blocking ad, tracker, and cryptominer requests in the declarativeNetRequest engine without operating a separate DNS proxy.`
  },
  {
    slug: 'tcf-v2-cookie-consent-cmp',
    includeInHub: true,
    term: 'TCF v2.2 Cookie Consent CMP',
    shortTitle: 'What is a TCF v2.2 Cookie Consent CMP? | SWEEPR Glossary',
    description: 'Learn how IAB TCF v2.2 Consent Management Platforms (OneTrust, Sourcepoint, Quantcast, Didomi) work and how SWEEPR Deepblock rejects non-essential cookies cleanly.',
    category: 'Cookie Privacy',
    ctaHref: '/guides/how-to-automatically-reject-cookie-banners-uk',
    ctaLabel: 'Cookie Auto-Reject Guide',
    definition: 'A Consent Management Platform (CMP) implementing the IAB Transparency and Consent Framework (TCF v2.2) is the dialog used by publishers to request GDPR or UK-GDPR permission to share browsing signals with programmatic ad vendors.',
    mechanism: `Instead of merely hiding the modal with CSS (which leaves scroll-locks intact or defaults to legitimate-interest tracking), SWEEPR Deepblock v${VERSION} detects OneTrust, Sourcepoint, Quantcast, TrustArc, Usercentrics, and Didomi dialogs, triggers non-essential rejection, and restores page scrolling.`
  },
  {
    slug: 'webrtc-ip-leak',
    includeInHub: false,
    term: 'WebRTC STUN/TURN IP Exposure',
    shortTitle: 'What is WebRTC IP Exposure in Browsers? | SWEEPR Glossary',
    description: 'Understand how WebRTC RTCPeerConnection ICE candidate discovery works in browsers and how blocking third-party tracker scripts reduces unwanted enumeration.',
    category: 'Network Privacy',
    ctaHref: '/test-lab',
    ctaLabel: 'Run Browser Test Lab',
    definition: 'WebRTC IP exposure occurs when a webpage invokes the browser RTCPeerConnection API to query STUN/TURN servers and discover local or public network candidates outside standard HTTP request paths.',
    mechanism: `Ad-tech and behavioral scripts sometimes probe WebRTC APIs to correlate devices across sessions. SWEEPR Deepblock v${VERSION} blocks known third-party tracking scripts at the declarativeNetRequest boundary before they load.`
  },
  {
    slug: 'malvertising-popunders',
    includeInHub: true,
    term: 'Malvertising & Popunder Redirects',
    shortTitle: 'What is Malvertising & Popunder Adware? | SWEEPR Glossary',
    description: 'Learn how malicious ad-exchange payloads and popunder scripts hijack browser tabs to push fake alerts and deceptive redirects, and how DNR rules block them.',
    category: 'Threat Protection',
    ctaHref: '/guides/how-to-stop-malvertising-popunders-and-redirects',
    ctaLabel: 'Stop Malvertising & Popunders',
    definition: 'Malvertising is the injection of deceptive JavaScript, forced redirects, or background popunder windows through programmatic real-time bidding (RTB) ad exchanges.',
    mechanism: `SWEEPR Deepblock v${VERSION} blocks known popunder and malvertising domains at the MV3 declarativeNetRequest network layer and monitors unauthorized popunder tab creation to keep browsing sessions clean.`
  },
  {
    slug: 'youtube-server-side-ad-injection',
    includeInHub: true,
    term: 'Server-Side Ad Injection (SSAI)',
    shortTitle: 'What is Server-Side Video Ad Injection? | SWEEPR Glossary',
    description: 'Learn how video streaming platforms splice ads into media manifests and how Manifest V3 rules plus lightweight player state handling clean up playback.',
    category: 'Video Ad Blocking',
    ctaHref: '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026',
    ctaLabel: 'YouTube MV3 Ad-Block Guide',
    definition: 'Server-Side Ad Injection (SSAI) stitches video advertisements directly into the primary media stream or player state object so simple domain blocking alone cannot separate the ad from the video.',
    mechanism: `SWEEPR Deepblock v${VERSION} combines MV3 network rules with a document_start MAIN-world content script that strips ad-slot configurations and cleans residual pre-roll containers without tripping player warnings.`
  },
  {
    slug: 'acceptable-ads-program',
    includeInHub: true,
    term: 'Acceptable Ads Whitelist Program',
    shortTitle: 'What is the Acceptable Ads Whitelist Program? | SWEEPR Glossary',
    description: 'Why do some adblockers still show sponsored banners and search ads? Learn how the Acceptable Ads program works and why SWEEPR Deepblock refuses paid whitelists.',
    category: 'Industry Ethics',
    ctaHref: '/vs/adblock-plus',
    ctaLabel: 'SWEEPR Deepblock vs AdBlock Plus',
    definition: 'The Acceptable Ads program is a commercial licensing arrangement where large ad networks and tech companies pay fees to participating ad-blocking vendors to have their ads whitelisted by default.',
    mechanism: `Extensions participating in Acceptable Ads enable paid exception lists out of the box. SWEEPR Deepblock accepts zero Acceptable Ads payments—every ad network is filtered strictly on technical criteria.`
  },
  {
    slug: 'audio-context-fingerprinting',
    includeInHub: true,
    term: 'AudioContext Fingerprinting',
    shortTitle: 'What is Web Audio API Fingerprinting? | SWEEPR Glossary',
    description: 'Understand how trackers use OfflineAudioContext oscillator waveforms to fingerprint audio stacks without playing sound, and how script blocking mitigates it.',
    category: 'Browser Fingerprinting',
    ctaHref: '/vs/ublock-origin-lite',
    ctaLabel: 'Compare MV3 Content Blockers',
    definition: 'AudioContext fingerprinting uses the browser OfflineAudioContext API to generate a silent mathematical oscillator signal and pass it through a DynamicsCompressorNode, hashing the floating-point output.',
    mechanism: `Because CPU floating-point implementations and OS audio stacks process DSP math slightly differently, the resulting hash can contribute to a device fingerprint. Blocking third-party telemetry scripts in v${VERSION} prevents those scripts from running.`
  },
  {
    slug: 'webgl-hardware-fingerprinting',
    includeInHub: true,
    term: 'WebGL GPU Hardware Fingerprinting',
    shortTitle: 'What is WebGL GPU Hardware Fingerprinting? | SWEEPR Glossary',
    description: 'See how tracking scripts query WEBGL_debug_renderer_info to read GPU model strings, and how blocking third-party tracker scripts prevents unauthorized collection.',
    category: 'Browser Fingerprinting',
    ctaHref: '/benchmarks',
    ctaLabel: 'Review v1.3.1 Benchmarks',
    definition: 'WebGL hardware fingerprinting queries the browser WebGLRenderingContext and the WEBGL_debug_renderer_info extension to extract unmasked GPU vendor strings, graphics card models, and shader precision.',
    mechanism: `Combined with screen resolution and hardware concurrency, WebGL renderer strings narrow down browser uniqueness. SWEEPR Deepblock v${VERSION} blocks third-party analytics and ad-tech scripts before they query WebGL context attributes.`
  },
  {
    slug: 'url-tracking-parameters-utm-fbclid-gclid',
    includeInHub: true,
    term: 'URL Tracking Parameters (fbclid, gclid, msclkid)',
    shortTitle: 'What are fbclid, gclid & utm Tracking Links? | SWEEPR Glossary',
    description: 'Learn how click-ID query parameters (fbclid, gclid, msclkid, ttclid, utm_*) track you across websites and how MV3 queryTransform strips them automatically.',
    category: 'Network Tracking',
    ctaHref: '/guides/strip-utm-fbclid-gclid-tracking-links',
    ctaLabel: 'Strip URL Tracking Links Guide',
    definition: 'URL tracking parameters such as fbclid (Meta), gclid (Google), msclkid (Microsoft), ttclid (TikTok), and utm_* tags are click identifiers appended to outbound links to tie browsing sessions back to ad profiles.',
    mechanism: `SWEEPR Deepblock v${VERSION} uses a native Manifest V3 declarativeNetRequest redirect rule (tracker_params.json) with queryTransform.removeParams to strip 20 cross-site tracking parameters before the HTTP request leaves your browser.`
  },
  {
    slug: 'browser-tab-discarding-hibernation',
    includeInHub: true,
    term: 'Browser Tab Discarding & RAM Hibernation',
    shortTitle: 'What is Browser Tab Discarding & Hibernation? | SWEEPR Glossary',
    description: 'Discover how background ad-auction timers bloat Chrome and Edge memory usage and how native chrome.tabs.discard hibernation reclaims idle tab memory.',
    category: 'Browser Performance',
    ctaHref: '/tools/browser-ram-calculator',
    ctaLabel: 'Open Browser RAM Calculator',
    definition: 'Browser tab discarding (hibernation) is the process of unloading inactive background renderer processes from system RAM via the native chrome.tabs.discard API while keeping the tab visible on the tab strip.',
    mechanism: `Open publisher tabs run background Prebid.js auctions and polling timers. SWEEPR Deepblock v${VERSION} blocks ad timers at the network layer, and Total Tab & RAM Tamer discards tabs idle for 10 minutes (skipping active, pinned, audible, and allowlisted sites; manual shortcut Alt+Shift+Z).`
  },
  {
    slug: 'first-party-tracker-proxies',
    includeInHub: true,
    term: 'First-Party Tracker Proxies',
    shortTitle: 'What are First-Party Server-Side Tracker Proxies? | SWEEPR Glossary',
    description: 'Learn how websites proxy analytics and ad pixels through first-party paths and how modern content blockers distinguish essential assets from tracking beacons.',
    category: 'Network Tracking',
    ctaHref: '/guides/how-to-stop-facebook-meta-pixel-tracking',
    ctaLabel: 'Block Meta Pixel & Trackers',
    definition: 'A first-party tracker proxy routes third-party analytics or ad-pixel payloads through a path on the publisher’s own root domain so naive domain-only blocklists fail to catch the beacon.',
    mechanism: `SWEEPR Deepblock v${VERSION} pairs domain-level DNR rules with path-pattern matching, query parameter stripping, and OTA delta rules to neutralize known tracking endpoints.`
  },
  {
    slug: 'shadow-dom-ad-injection',
    includeInHub: true,
    term: 'Shadow DOM Ad Injection',
    shortTitle: 'What is Shadow DOM Ad Injection? | SWEEPR Glossary',
    description: 'Understand how ad networks and CMPs encapsulate widgets inside Shadow DOM trees to evade standard CSS selectors, and how MV3 network + deep traversal handles them.',
    category: 'Browser Architecture',
    ctaHref: '/guides/how-to-automatically-reject-cookie-banners-uk',
    ctaLabel: 'Shadow-DOM CMP Rejection Guide',
    definition: 'Shadow DOM injection places promotional widgets or consent overlays inside encapsulated Web Component shadow roots so global document stylesheets cannot style or hide inner elements.',
    mechanism: `SWEEPR Deepblock v${VERSION} blocks widget loader scripts at the MV3 DNR network layer before custom elements mount, and uses deep shadow-root traversal to handle Usercentrics and Didomi consent overlays cleanly.`
  },
  {
    slug: 'anti-adblock-bait-detection',
    includeInHub: true,
    term: 'Anti-Adblock Bait Detection Scripts',
    shortTitle: 'How Do Anti-Adblock Bait Scripts Work? | SWEEPR Glossary',
    description: 'Learn how Admiral, BlockAdBlock, and Funding Choices use invisible .adsbox bait elements and dummy script fetches to detect adblockers—and how surrogate shims help.',
    category: 'Anti-Adblock Stealth',
    ctaHref: '/test-lab',
    ctaLabel: 'Run Anti-Detection Test Lab',
    definition: 'Anti-adblock bait detection scripts create decoy DOM elements (such as <div class="adsbox">) or request dummy ad scripts (pagead2.googlesyndication.com) and check whether offsetHeight === 0 or the network request failed.',
    mechanism: `SWEEPR Deepblock v${VERSION} redirects selected ad-script bait fetches to local 200 OK neutered shims (rules/surrogates/ad_status.js, rules/surrogates/adsbygoogle.js, rules/surrogates/gpt.js, rules/surrogates/show_ads.js) while neutralizing Admiral and Funding Choices overlays.`
  },
  {
    slug: 'ai-slop-search-spam',
    includeInHub: false,
    term: 'Programmatic Search Spam & Ad Farms',
    shortTitle: 'What is Programmatic Search Spam? | SWEEPR Glossary',
    description: 'Learn how low-quality scraper farms monetize search queries with dense programmatic ad networks, and how blocking ad-tech endpoints cleans up browsing.',
    category: 'Search Hygiene',
    ctaHref: '/guides/how-to-block-sponsored-ads-on-google-search-2026',
    ctaLabel: 'Block Sponsored Search Ads',
    definition: 'Programmatic search spam refers to automated content farms and scraper domains built to capture long-tail search queries and load heavy display and native ad networks.',
    mechanism: `SWEEPR Deepblock v${VERSION} blocks sponsored search ad slots and strips downstream ad-network requests, popunders, and 20 URL tracking parameters across aggregator pages.`
  },
  {
    slug: 'fake-shopify-dropshipping-scam-indicators',
    includeInHub: false,
    term: 'Deceptive E-Commerce & Malvertising Traps',
    shortTitle: 'How Malvertising Feeds Deceptive Storefronts | SWEEPR Glossary',
    description: 'Understand how social ad click trackers and deceptive popunders route shoppers to low-trust clearance storefronts, and how to strip trackers and block ad networks.',
    category: 'Threat Protection',
    ctaHref: '/guides/how-to-stop-temu-shein-scam-popups-and-tracking',
    ctaLabel: 'Stop Shopping Ad Popups & Trackers',
    definition: 'Deceptive e-commerce campaigns frequently use aggressive social-media ad targeting, click-ID tracking links, and popunder redirects to funnel users to high-urgency clearance storefronts.',
    mechanism: `SWEEPR Deepblock v${VERSION} blocks known malvertising popunder networks and strips 20 cross-site click-ID parameters (fbclid, gclid, ttclid, utm_*). Users should independently verify merchant registration and reviews before entering payment details.`
  },
  {
    slug: 'header-bidding-openrtb-latency',
    includeInHub: true,
    term: 'Header Bidding & OpenRTB Latency',
    shortTitle: 'What is Header Bidding (Prebid / OpenRTB) Latency? | SWEEPR Glossary',
    description: 'Understand how Prebid.js and OpenRTB real-time ad auctions fire dozens of simultaneous network requests on page load and how DNR blocking prevents them.',
    category: 'Browser Performance',
    ctaHref: '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
    ctaLabel: 'Reduce Browser RAM & Tab Lag',
    definition: 'Header bidding (typically powered by Prebid.js and OpenRTB endpoints) is a programmatic auction where a webpage simultaneously queries 15 to 40 Supply-Side Platforms (PubMatic, Rubicon, Criteo, AppNexus, Index Exchange) before rendering page content.',
    mechanism: `Each auction round consumes main-thread CPU and network sockets. Blocking OpenRTB auction endpoints in the MV3 declarativeNetRequest layer prevents those requests from firing.`
  },
  {
    slug: 'cryptojacking-webassembly-miners',
    includeInHub: true,
    term: 'Browser Cryptojacking & WebAssembly Miners',
    shortTitle: 'What is Browser Cryptojacking? | SWEEPR Glossary',
    description: 'Learn how unauthorized WebAssembly and WebWorker scripts hijack CPU cycles in background tabs, and how SWEEPR Deepblock blocks 18 miner rulesets.',
    category: 'Threat Protection',
    ctaHref: '/guides/how-to-block-tab-freeze-crypto-miner-scripts',
    ctaLabel: 'Block Crypto Miner Scripts Guide',
    definition: 'Browser cryptojacking is the unauthorized use of a visitor’s CPU via WebAssembly (Wasm) and WebWorkers to mine cryptocurrency while a browser tab remains open.',
    mechanism: `SWEEPR Deepblock v${VERSION} ships 18 dedicated static cryptominer blocking rules (cryptominers.json) at the network layer and pairs them with 10-minute idle tab discarding in Total Tab & RAM Tamer.`
  }
];

function renderGlossaryStubPage(item) {
  const selfPath = `/glossary/${item.slug}`;
  const decision = getM1Decision(selfPath);
  const isConsolidate = decision?.action === 'CONSOLIDATE_301' && decision.redirectTarget;
  const robots = isConsolidate ? 'noindex, follow' : 'noindex, nofollow';
  const canonicalUrl = isConsolidate ? `${SITE_ORIGIN}${decision.redirectTarget}` : `${SITE_ORIGIN}${selfPath}`;

  const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Privacy & Ad-Tech Glossary', item: '/glossary' },
    { name: item.term, item: selfPath }
  ];

  const jsonLd = buildJsonLd({
    canonicalUrl,
    breadcrumbs,
    includeSoftwareApp: true,
    extraGraph: [
      {
        '@type': 'DefinedTerm',
        name: item.term,
        description: item.definition,
        inDefinedTermSet: `${SITE_ORIGIN}/glossary`,
        url: canonicalUrl
      }
    ]
  });

  const contentHtml = `
    ${renderBreadcrumbs(breadcrumbs)}
    <header class="space-y-3">
      <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">${escapeHtml(item.category)}</span>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(item.term)}</h1>
    </header>

    ${renderGlassCard({
      title: 'Technical Definition',
      badge: `v${VERSION}`,
      bodyHtml: `<div class="space-y-4 text-gray-700 leading-relaxed">
        <p class="text-base">${escapeHtml(item.definition)}</p>
        <div class="pt-3 border-t border-gray-200">
          <h3 class="text-sm font-extrabold uppercase tracking-wider text-emerald-800 mb-2">How ${PRODUCT_FACTS.name} v${VERSION} Addresses It</h3>
          <p class="text-sm sm:text-base text-gray-700">${escapeHtml(item.mechanism)}</p>
        </div>
      </div>`
    })}

    ${renderCtaBanner({
      badge: `${PRODUCT_FACTS.name} v${VERSION}`,
      heading: `Explore ${item.term} in Practice`,
      subtext: 'Inspect our complete self-contained Privacy & Ad-Tech Glossary or jump directly to the related interactive diagnostic or guide.',
      primaryLabel: item.ctaLabel,
      primaryHref: item.ctaHref,
      secondaryLabel: 'Browse Full Glossary',
      secondaryHref: '/glossary'
    })}

    ${renderRelatedGrid({
      heading: 'Core Guides & Tools',
      items: [
        { href: '/glossary', badge: 'Glossary Hub', label: 'Manifest V3 & Privacy Glossary' },
        { href: '/test-lab', badge: 'Live Diagnostic', label: 'Browser Anti-Detection Test Lab' },
        { href: '/tools/browser-ram-calculator', badge: 'Calculator', label: 'Browser RAM & Tab Bloat Calculator' },
        { href: '/benchmarks', badge: 'Architecture', label: `SWEEPR Deepblock v${VERSION} Benchmarks` }
      ]
    })}
  `;

  return renderShellPage({
    title: item.shortTitle,
    description: item.description,
    canonicalUrl,
    currentPath: '/glossary',
    lang: 'en',
    htmlLang: 'en-GB',
    robots,
    ogType: 'article',
    maxWidth: 'max-w-4xl',
    jsonLd,
    contentHtml
  });
}

for (const item of GLOSSARY_TERMS) {
  fs.writeFileSync(path.join(GLOSSARY_DIR, `${item.slug}.html`), renderGlossaryStubPage(item), 'utf8');
}

// Build kept `/glossary` hub (`KEEP_REWRITE` — rich, self-contained, zero links to pruned/301 URLs)
const hubTerms = GLOSSARY_TERMS.filter((t) => t.includeInHub);
const hubCanonical = `${SITE_ORIGIN}/glossary`;
const hubBreadcrumbs = [
  { name: 'Home', item: '/' },
  { name: 'Manifest V3 & Privacy Glossary', item: '/glossary' }
];

const hubJsonLd = buildJsonLd({
  canonicalUrl: hubCanonical,
  breadcrumbs: hubBreadcrumbs,
  includeSoftwareApp: true,
  extraGraph: [
    {
      '@type': 'DefinedTermSet',
      name: `${PRODUCT_FACTS.name} Browser Privacy, Manifest V3 & Ad-Tech Glossary`,
      url: hubCanonical,
      description: `Engineering-grade definitions of ${hubTerms.length} core Manifest V3, DNR, GDPR CMP, URL parameter stripping, and browser memory concepts.`,
      hasDefinedTerm: hubTerms.map((t) => ({
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.definition,
        url: `${hubCanonical}#${t.slug}`
      }))
    }
  ]
});

const hubContent = `
  ${renderBreadcrumbs(hubBreadcrumbs)}
  <header class="space-y-4">
    <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
      ${hubTerms.length} Core Privacy &amp; Manifest V3 Concepts · v${escapeHtml(VERSION)}
    </span>
    <h1 class="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">Browser Privacy, Manifest V3 &amp; Ad-Tech Glossary</h1>
    <p class="text-gray-600 max-w-3xl text-base leading-relaxed">
      Plain-English and engineering-grade explanations of how Manifest V3 <code class="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">declarativeNetRequest</code> filtering, TCF v2.2 cookie consent CMPs, CNAME cloaking, URL click-ID stripping, and tab hibernation operate inside modern Chromium and Firefox browsers.
    </p>
  </header>

  <section class="glass-card bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
    <h2 class="text-sm font-extrabold uppercase tracking-wider text-gray-900 mb-3">Quick Jump Index</h2>
    <div class="flex flex-wrap gap-2">
      ${hubTerms
        .map(
          (g) => `<a href="#${escapeHtml(g.slug)}" class="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-semibold text-gray-800 hover:text-emerald-800 no-underline transition-colors">${escapeHtml(g.term)}</a>`
        )
        .join('\n      ')}
    </div>
  </section>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    ${hubTerms
      .map(
        (g) => `<article id="${escapeHtml(g.slug)}" class="glass-card bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4 scroll-mt-24">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">${escapeHtml(g.category)}</span>
        </div>
        <h2 class="text-xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(g.term)}</h2>
        <p class="text-sm text-gray-700 leading-relaxed"><strong class="text-gray-900">Definition:</strong> ${escapeHtml(g.definition)}</p>
        <p class="text-sm text-gray-600 leading-relaxed"><strong class="text-gray-900">How SWEEPR Deepblock v${escapeHtml(VERSION)} Handles It:</strong> ${escapeHtml(g.mechanism)}</p>
      </div>
      <div class="pt-3 border-t border-gray-200">
        <a href="${escapeHtml(g.ctaHref)}" class="text-xs font-bold text-emerald-700 hover:underline no-underline">${escapeHtml(g.ctaLabel)} &rarr;</a>
      </div>
    </article>`
      )
      .join('\n    ')}
  </div>

  ${renderCtaBanner({
    badge: `${PRODUCT_FACTS.name} v${VERSION} · ${STATIC_RULES} Static Rules`,
    heading: 'Put Manifest V3 Privacy Architecture to the Test',
    subtext: `Run live network and cosmetic probes in the Browser Test Lab, calculate background tab RAM overhead, or install ${PRODUCT_FACTS.name} across ${PRODUCT_FACTS.devicesIncluded} devices.`,
    primaryLabel: 'Open Browser Test Lab',
    primaryHref: '/test-lab',
    secondaryLabel: 'Install Free Extension',
    secondaryHref: '/download?install=1'
  })}

  ${renderRelatedGrid({
    heading: 'Next Steps & Diagnostics',
    items: [
      { href: '/test-lab', badge: 'Live Diagnostic', label: 'Browser Anti-Detection Test Lab' },
      { href: '/tools/browser-ram-calculator', badge: 'Calculator', label: 'Browser RAM & Tab Bloat Calculator' },
      { href: '/guides/strip-utm-fbclid-gclid-tracking-links', badge: 'Guide', label: 'Strip UTM, fbclid & gclid Trackers' },
      { href: '/guides/how-to-automatically-reject-cookie-banners-uk', badge: 'Guide', label: 'Auto-Reject Cookie Banners (UK & EU)' }
    ]
  })}
`;

const glossaryHubHtml = renderShellPage({
  title: 'Browser Privacy, Manifest V3 & Ad-Tech Glossary | SWEEPR',
  description: 'Technical glossary explaining Manifest V3 declarativeNetRequest, CNAME cloaking, canvas fingerprinting, TCF v2.2 CMPs, URL stripping, and tab hibernation.',
  canonicalUrl: hubCanonical,
  currentPath: '/glossary',
  lang: 'en',
  htmlLang: 'en-GB',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogType: 'website',
  maxWidth: 'max-w-6xl',
  jsonLd: hubJsonLd,
  contentHtml: hubContent
});

fs.writeFileSync(path.join(GLOSSARY_DIR, 'index.html'), glossaryHubHtml, 'utf8');

console.log(`Built /glossary hub (${hubTerms.length} curated definitions) + ${GLOSSARY_TERMS.length} glossary entry pages (Holographic Pearl).`);
