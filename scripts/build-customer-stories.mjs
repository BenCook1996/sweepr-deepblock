#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Archived Use-Case Scenarios (`/stories` + 6 Scenarios)
 *
 * Holographic Pearl Light Shell + M1 Decision Compliant:
 *  - 2 CONSOLIDATE_301 stories: `noindex, follow` + target canonical
 *  - `/stories` + 4 NOINDEX_PRUNE stories: `noindex, nofollow` + self-canonical
 *  - Zero synthetic personas/telemetry, zero removed-feature slop, zero links to pruned/301 URLs.
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
  renderCallout,
  renderCtaBanner,
  renderRelatedGrid,
  getM1Decision
} from './lib/holographic-shell.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const STORIES_DIR = path.join(WEBSITE_DIR, 'stories');

fs.mkdirSync(STORIES_DIR, { recursive: true });

const VERSION = PRODUCT_FACTS.version;
const STATIC_RULES = PRODUCT_FACTS.staticDnrRules;

const DELTA_RULE_COUNT = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/rules/dynamic_delta.json'), 'utf8'));
    const rules = Array.isArray(d) ? d : (d.dynamicDnrRules || d.rules || []);
    return rules.length || 100;
  } catch {
    return 100;
  }
})();

const STORIES = [
  {
    slug: 'switching-from-total-adblock-renewal-shock',
    title: 'Evaluating Flat-Rate Adblocker Pricing vs Renewal Traps | SWEEPR',
    metaDesc: `Compare introductory adblocker renewal pricing against SWEEPR Deepblock v${VERSION} flat £29.99/yr Pro pricing (£2.50/mo eq.) with 1-click portal control.`,
    category: 'Pricing & Renewal Comparison',
    summary: 'Overview of billing transparency, Manifest V3 rule coverage, and self-service cancellation compared with introductory renewal-spike pricing.',
    challenge: 'Introductory consumer adblocker promotions frequently renew at £99/yr or higher while leaving default Acceptable Ads whitelists enabled unless manually disabled.',
    architecture: `SWEEPR Deepblock Pro uses transparent flat-rate pricing (£29.99/yr across ${PRODUCT_FACTS.devicesIncluded} devices, or £89.99/yr for the Complete Security Suite) with ${STATIC_RULES} static C++ declarativeNetRequest rules, ${DELTA_RULE_COUNT} OTA delta rules, automated GDPR cookie rejection, and zero Acceptable Ads whitelisting.`,
    highlights: [
      'Predictable £29.99/yr annual rate (£2.50/mo equivalent) across up to 5 devices with 14-day refund eligibility.',
      'Zero Acceptable Ads paid whitelists — ad networks are filtered strictly on technical rules.',
      'Self-service pause, cancellation, and refund controls available directly inside the customer portal.'
    ],
    relatedLink: '/vs/total-adblock',
    relatedLabel: 'Compare SWEEPR Deepblock vs Total Adblock'
  },
  {
    slug: '40-tab-research-workflow-ram-tamer',
    title: 'Managing Multi-Tab Chromium Memory with Tab & RAM Tamer | SWEEPR',
    metaDesc: `How SWEEPR Deepblock v${VERSION} blocks background ad-auction requests and uses native chrome.tabs.discard hibernation to reduce multi-tab browser memory pressure.`,
    category: 'Browser Memory & Tab Management',
    summary: 'Architecture overview of blocking background Prebid/OpenRTB ad auctions alongside 10-minute idle tab discarding in Chromium browsers.',
    challenge: 'Keeping dozens of ad-supported news, wiki, and research tabs open simultaneously causes Chromium per-site renderer processes to allocate memory for third-party ad iframes and polling timers.',
    architecture: `SWEEPR Deepblock v${VERSION} blocks third-party ad and tracker requests at the Manifest V3 DNR layer before frames load, while Total Tab & RAM Tamer discards tabs idle for 10 minutes using chrome.tabs.discard (skipping active, pinned, audible, and allowlisted sites; manual shortcut Alt+Shift+Z).`,
    highlights: [
      'Blocks background ad-auction scripts and 18 known cryptominer patterns in the C++ network layer.',
      'Automatically excludes active, pinned, audible, and allowlisted tabs from automatic discarding.',
      'Includes an interactive estimator in the Browser RAM & Tab Bloat Calculator.'
    ],
    relatedLink: '/tools/browser-ram-calculator',
    relatedLabel: 'Open Browser RAM Calculator'
  },
  {
    slug: 'uk-news-sourcepoint-cookie-wall-elimination',
    title: 'Handling UK News Sourcepoint & OneTrust Cookie Modals | SWEEPR',
    metaDesc: `How SWEEPR Deepblock v${VERSION} automates non-essential cookie rejection on Sourcepoint, Quantcast, and OneTrust CMP dialogs without freezing page scroll.`,
    category: 'UK Cookie Banner Automation',
    summary: 'Technical notes on dispatching non-essential cookie rejection across Sourcepoint and OneTrust dialogs while restoring document scrollability.',
    challenge: 'Many UK news publishers render multi-layer Sourcepoint or Quantcast consent dialogs that apply overflow:hidden scroll locks until an explicit TCF v2.2 choice is recorded.',
    architecture: `SWEEPR Deepblock v${VERSION} detects supported CMP containers at page load, triggers non-essential rejection controls rather than merely hiding the overlay with CSS, and clears blocking scroll-lock styles on html/body.`,
    highlights: [
      'Targets Sourcepoint, OneTrust, and Quantcast non-essential rejection handlers cleanly.',
      'Restores document overflow styles so vertical page scrolling remains responsive.',
      'Note: strict server-side Pay-or-Consent ("Pur Abo") subscription walls cannot be bypassed by client-side extensions.'
    ],
    relatedLink: '/guides/how-to-automatically-reject-cookie-banners-uk',
    relatedLabel: 'Read UK Cookie Auto-Reject Guide'
  },
  {
    slug: 'youtube-mv3-zero-warning-playback',
    title: 'YouTube Ad Blocking & CPU Overhead on Chrome Manifest V3 | SWEEPR',
    metaDesc: `How SWEEPR Deepblock v${VERSION} combines Manifest V3 declarativeNetRequest rules and lightweight DOM cleanup for responsive video playback.`,
    category: 'Video & Anti-Adblock Architecture',
    summary: 'Technical overview of Manifest V3 network rule prioritization and lightweight player DOM cleanup for video streams.',
    challenge: 'Legacy script-heavy blockers or misconfigured filter rules can trigger anti-adblock warning overlays or high CPU usage during video playback.',
    architecture: `SWEEPR Deepblock v${VERSION} pairs static C++ declarativeNetRequest rules with lightweight document_start player state cleanup and companion ad-slot hiding.`,
    highlights: [
      'Evaluates network ad-endpoint blocks natively inside Chromium C++ DNR tables.',
      'Removes sidebar companion cards and homepage ad containers without blocking comments or playlists.',
      'Verify active browser behavior directly in the Live Anti-Detection Test Lab.'
    ],
    relatedLink: '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock',
    relatedLabel: 'Fix YouTube Anti-Adblock CPU Guide'
  },
  {
    slug: 'blocking-fake-clearance-shops-scam-detector',
    title: 'Stopping Deceptive Shopping Popups & Click Trackers | SWEEPR',
    metaDesc: `Archived guide note: how SWEEPR Deepblock v${VERSION} blocks malvertising popunders and strips 20 cross-site URL click-IDs on shopping links.`,
    category: 'Archived Notice',
    summary: 'Updated guidance on how SWEEPR Deepblock v1.3.1 blocks deceptive popunder ad networks and strips social-ad tracking parameters.',
    challenge: 'Aggressive social media promotions and popunder networks use click-ID tracking parameters (fbclid, gclid, ttclid) and deceptive ad overlays to push shoppers toward unfamiliar storefronts.',
    architecture: `SWEEPR Deepblock v${VERSION} focuses on core Manifest V3 ad, tracker, and cryptominer blocking, popunder suppression, and 20-parameter URL click-ID stripping via tracker_params.json. Dedicated in-extension e-commerce store vetting is not shipped; shoppers should verify merchant registration and independent reviews directly.`,
    highlights: [
      'Strips 20 cross-site URL tracking tokens (fbclid, gclid, ttclid, utm_*) at the network boundary.',
      'Blocks popunder ad networks and deceptive overlay banners on browsing portals.',
      'Updated guidance is consolidated in our shopping popup and tracker guide.'
    ],
    relatedLink: '/guides/how-to-stop-temu-shein-scam-popups-and-tracking',
    relatedLabel: 'Stop Shopping Popups & Trackers Guide'
  },
  {
    slug: 'de-fr-usercentrics-didomi-cmp-automation',
    title: 'German Usercentrics & French Didomi CMP Automation | SWEEPR',
    metaDesc: `How SWEEPR Deepblock v${VERSION} traverses Shadow DOM Usercentrics (DE) and Didomi (FR) cookie dialogs under TDDDG § 25 and CNIL Art. 82.`,
    category: 'European GDPR / TCF v2.2',
    summary: 'Overview of Shadow-DOM traversal for Usercentrics (Germany) and Didomi CNIL dialogs (France) in localized European hubs.',
    challenge: 'German and French media sites frequently isolate consent controls inside Web Component Shadow DOM roots (#usercentrics-root, #didomi-host) where global CSS selectors cannot reach.',
    architecture: `SWEEPR Deepblock v${VERSION} traverses Shadow DOM trees up to depth 4 to trigger non-essential rejection controls while stripping Criteo, Taboola, and Outbrain bidder requests in the DNR layer.`,
    highlights: [
      'Supports Usercentrics Shadow-DOM traversal for German DACH publishers under TDDDG § 25.',
      'Triggers Didomi non-essential rejection controls under French CNIL Article 82 guidelines.',
      'Full localized documentation is published on our /de and /fr language hubs.'
    ],
    relatedLink: '/de',
    relatedLabel: 'Open Deutsch (/de) Hub'
  }
];

function renderStoryPage(s) {
  const selfPath = `/stories/${s.slug}`;
  const decision = getM1Decision(selfPath);
  const isConsolidate = decision?.action === 'CONSOLIDATE_301' && decision.redirectTarget;
  const robots = isConsolidate ? 'noindex, follow' : 'noindex, nofollow';
  const canonicalUrl = isConsolidate ? `${SITE_ORIGIN}${decision.redirectTarget}` : `${SITE_ORIGIN}${selfPath}`;

  const breadcrumbs = [
    { name: 'Home', item: '/' },
    { name: 'Archived Scenarios', item: '/stories' },
    { name: s.category, item: selfPath }
  ];

  const jsonLd = buildJsonLd({
    canonicalUrl,
    breadcrumbs,
    includeSoftwareApp: true,
    article: {
      '@type': 'TechArticle',
      headline: s.title.replace(' | SWEEPR', ''),
      description: s.metaDesc,
      url: canonicalUrl,
      datePublished: '2026-11-04'
    }
  });

  const contentHtml = `
    ${renderBreadcrumbs(breadcrumbs)}
    <header class="space-y-3">
      <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">${escapeHtml(s.category)}</span>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(s.title.replace(' | SWEEPR', ''))}</h1>
      <p class="text-base text-gray-600 leading-relaxed max-w-3xl">${escapeHtml(s.summary)}</p>
    </header>

    ${renderCallout({
      tone: 'amber',
      title: 'Archived Overview Page',
      bodyHtml: `This scenario note summarizes general browser architecture in ${PRODUCT_FACTS.name} v${escapeHtml(VERSION)} rather than an individual customer measurement. For current technical documentation, visit <a href="${escapeHtml(s.relatedLink)}" class="text-emerald-700 font-semibold underline">${escapeHtml(s.relatedLabel)}</a>.`
    })}

    ${renderGlassCard({
      title: '1. Technical Challenge',
      badge: `v${VERSION}`,
      bodyHtml: `<p class="text-sm sm:text-base text-gray-700 leading-relaxed m-0">${escapeHtml(s.challenge)}</p>`
    })}

    ${renderGlassCard({
      title: '2. SWEEPR Deepblock Architecture',
      badge: `${STATIC_RULES} Static Rules`,
      bodyHtml: `<p class="text-sm sm:text-base text-gray-700 leading-relaxed m-0">${escapeHtml(s.architecture)}</p>`
    })}

    ${renderGlassCard({
      title: '3. Key Implementation Notes',
      bodyHtml: `<ul class="list-disc pl-5 space-y-2 text-sm sm:text-base text-gray-700 m-0">
        ${s.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('\n        ')}
      </ul>`
    })}

    ${renderCtaBanner({
      badge: `${PRODUCT_FACTS.name} v${VERSION}`,
      heading: 'Explore Live Diagnostics & Current Guides',
      subtext: 'Verify active browser filtering in the Live Anti-Detection Test Lab or review the linked guide below.',
      primaryLabel: s.relatedLabel,
      primaryHref: s.relatedLink,
      secondaryLabel: 'Run Live Test Lab',
      secondaryHref: '/test-lab'
    })}

    ${renderRelatedGrid({
      heading: 'Primary Guides & Tools',
      items: [
        { href: '/vs/total-adblock', badge: 'Comparison', label: 'SWEEPR Deepblock vs Total Adblock' },
        { href: '/tools/browser-ram-calculator', badge: 'Calculator', label: 'Browser RAM & Tab Bloat Calculator' },
        { href: '/guides/how-to-automatically-reject-cookie-banners-uk', badge: 'Cookie Guide', label: 'Auto-Reject Cookie Banners (UK & EU)' },
        { href: '/benchmarks', badge: 'Architecture', label: `SWEEPR Deepblock v${VERSION} Benchmarks` }
      ]
    })}
  `;

  return renderShellPage({
    title: s.title,
    description: s.metaDesc,
    canonicalUrl,
    currentPath: '/stories',
    lang: 'en',
    htmlLang: 'en-GB',
    robots,
    ogType: 'article',
    maxWidth: 'max-w-4xl',
    jsonLd,
    contentHtml
  });
}

for (const s of STORIES) {
  fs.writeFileSync(path.join(STORIES_DIR, `${s.slug}.html`), renderStoryPage(s), 'utf8');
}

// Build /stories index (`NOINDEX_PRUNE` -> `noindex, nofollow` + self-canonical)
const indexCanonical = `${SITE_ORIGIN}/stories`;
const indexBreadcrumbs = [
  { name: 'Home', item: '/' },
  { name: 'Use-Case Archive', item: '/stories' }
];
const indexJsonLd = buildJsonLd({
  canonicalUrl: indexCanonical,
  breadcrumbs: indexBreadcrumbs,
  includeSoftwareApp: true,
  extraGraph: [
    {
      '@type': 'CollectionPage',
      name: `${PRODUCT_FACTS.name} Use-Case & Architecture Archive`,
      url: indexCanonical,
      description: `Archived architecture notes covering renewal pricing transparency, Chromium tab discarding, and European CMP automation in v${VERSION}.`
    }
  ]
});

const indexContent = `
  ${renderBreadcrumbs(indexBreadcrumbs)}
  <header class="space-y-3">
    <span class="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">Archived Use-Case Notes · v${escapeHtml(VERSION)}</span>
    <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Browser Architecture &amp; Use-Case Scenarios</h1>
    <p class="text-base text-gray-600 max-w-3xl leading-relaxed">
      Explore archived scenario notes or jump directly to our active comparison guides, European language hubs, and interactive browser diagnostics.
    </p>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    ${STORIES.map(
      (s) => `<a href="${escapeHtml(s.relatedLink)}" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-6 shadow-sm no-underline flex flex-col justify-between gap-3 transition-all">
      <div class="space-y-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">${escapeHtml(s.category)}</span>
        <h2 class="text-lg font-extrabold text-gray-900 leading-snug">${escapeHtml(s.title.replace(' | SWEEPR', ''))}</h2>
        <p class="text-sm text-gray-600 leading-relaxed m-0">${escapeHtml(s.summary)}</p>
      </div>
      <span class="text-xs font-bold text-emerald-700">${escapeHtml(s.relatedLabel)} &rarr;</span>
    </a>`
    ).join('\n    ')}
  </div>

  ${renderRelatedGrid({
    heading: 'Localized European Hubs & Diagnostics',
    items: [
      { href: '/de', badge: 'Deutsch', label: 'Deutsch (DE) Hub — Usercentrics & TDDDG' },
      { href: '/fr', badge: 'Français', label: 'Français (FR) Hub — Didomi & CNIL' },
      { href: '/es', badge: 'Español', label: 'Español (ES) Hub — AEPD & TCF v2.2' },
      { href: '/test-lab', badge: 'Live Diagnostic', label: 'Free Adblock Test Lab' }
    ]
  })}
`;

const indexHtml = renderShellPage({
  title: 'Browser Architecture & Use-Case Scenarios | SWEEPR',
  description: `Archived scenario notes covering SWEEPR Deepblock v${VERSION} Manifest V3 filtering, Chromium tab hibernation, and European cookie banner automation.`,
  canonicalUrl: indexCanonical,
  currentPath: '/stories',
  lang: 'en',
  htmlLang: 'en-GB',
  robots: 'noindex, nofollow',
  ogType: 'website',
  maxWidth: 'max-w-5xl',
  jsonLd: indexJsonLd,
  contentHtml: indexContent
});

fs.writeFileSync(path.join(STORIES_DIR, 'index.html'), indexHtml, 'utf8');
console.log(`Built /stories index + ${STORIES.length} Holographic Pearl story pages.`);
