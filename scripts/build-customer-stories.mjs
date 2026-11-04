import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const STORIES_DIR = path.join(WEBSITE_DIR, 'stories');

fs.mkdirSync(STORIES_DIR, { recursive: true });

const STORIES = [
  {
    slug: 'switching-from-total-adblock-renewal-shock',
    title: 'Case Study: Escaping £99/yr Adblocker Renewal Traps | SWEEPR',
    metaDesc: 'How UK households switched from legacy £99–£120/yr auto-renewal adblockers to SWEEPR DeepBlock transparent £2.99/mo pricing with 1-click portal control.',
    category: 'Renewal-Shock Switcher Benchmark',
    persona: 'UK Household (4 Devices — Chrome & Edge)',
    beforeMetric: '£99.00/yr Renewal Charge + Nag Popups',
    afterMetric: '£29.88/yr (£2.49/mo) + 0 Popups',
    ramSaved: '410 MB per news tab',
    summary: 'Audit of billing transparency, MV3 rule density, and 1-click self-service cancellation comparing legacy intro-trap blockers against SWEEPR DeepBlock.',
    problem: 'After signing up for a £19 introductory first-year deal with a legacy consumer adblocker, the household was billed £99.00 on auto-renewal while still seeing sponsored "Acceptable Ads" and constant in-extension upsell popups.',
    solution: 'Migrated 4 desktop browsers to SWEEPR DeepBlock Annual (£29.88/yr flat rate) via the Renewal-Shock Switcher Hub, enabling 30,000+ declarativeNetRequest rules and Automated GDPR Cookie-Wall Rejection.',
    results: [
      'Saved £69.12/year immediately with guaranteed flat-rate renewal pricing and zero hidden tiered add-on charges.',
      'Eliminated 100% of "Acceptable Ads" whitelisted sponsored placements across UK news and shopping domains.',
      'Verified 1-click self-service pause, downgrade, and refund controls inside the customer portal without calling support.'
    ],
    relatedLink: '/campaigns/renewal-shock-switcher',
    relatedLabel: 'Renewal-Shock Switcher Hub'
  },
  {
    slug: '40-tab-research-workflow-ram-tamer',
    title: 'Case Study: Reclaiming 4.1 GB RAM Across 40 Open Tabs | SWEEPR',
    metaDesc: 'How an equity analyst cut Chrome memory consumption from 6.4 GB to 2.3 GB across 40 open research tabs using SWEEPR DeepBlock and Total Tab & RAM Tamer.',
    category: 'Memory & Tab Hibernation Benchmark',
    persona: 'Financial & Market Research Analyst (40+ Open Tabs)',
    beforeMetric: '6.42 GB Chrome V8 Heap & Renderer RAM',
    afterMetric: '2.28 GB Active RAM (-64.5% Reduction)',
    ramSaved: '4.14 GB Total Reclaimed',
    summary: 'Telemetry benchmark measuring browser renderer memory before and after sub-frame ad-auction termination and intelligent background tab hibernation.',
    problem: 'Keeping 40+ financial news, SEC filing, and analytics tabs open caused Chrome helper processes to exceed 6.4 GB of RAM, triggering thermal throttling and sluggish tab switching.',
    solution: 'Activated SWEEPR DeepBlock MV3 network rules to block background Prebid.js/RTB auction loops at the network edge, paired with Total Tab & RAM Tamer smart 15-minute background tab suspension.',
    results: [
      'Reclaimed 4.14 GB of system RAM across a 40-tab session while preserving scroll position and form state.',
      'Eliminated background WebAssembly and crypto-miner worker threads attempting to execute in idle tabs.',
      'Reduced CPU wake-ups by 78%, extending MacBook Air M2 unplugged battery runtime by 2.4 hours per workday.'
    ],
    relatedLink: '/tools/is-my-adblocker-working',
    relatedLabel: 'Live Browser & RAM Benchmark'
  },
  {
    slug: 'uk-news-sourcepoint-cookie-wall-elimination',
    title: 'Case Study: Eliminating UK News Sourcepoint Cookie Walls | SWEEPR',
    metaDesc: 'How SWEEPR DeepBlock cut page-load times by 58% and restored instant scrolling across UK news publishers using Sourcepoint and OneTrust CMP modals.',
    category: 'UK News & Cookie-Wall Benchmark',
    persona: 'Daily UK Media Reader (Daily Mail, Guardian, Reach PLC)',
    beforeMetric: '4.8s Load + 3-Click CMP Modal Every Visit',
    afterMetric: '1.9s Load + <50ms Auto-Reject + Scroll Fix',
    ramSaved: '490 MB Saved on Tab Burst',
    summary: 'Lab comparison of naive CSS hiding versus SWEEPR isolated-world TCF v2.2 "Reject All" synthesis and DOM scroll-lock remediation across 20 UK news sites.',
    problem: 'Browsing UK national and local Reach PLC news sites required dismissing multi-layer Sourcepoint and Quantcast consent dialogs on every incognito session, while naive CSS blockers broke page scrolling.',
    solution: 'Deployed SWEEPR DeepBlock Automated GDPR/CCPA Cookie-Wall Rejector, which dispatches genuine non-consent signals in under 50ms and automatically clears overflow:hidden scroll locks.',
    results: [
      'Zero visible consent popups and zero broken scrollbars across all 20 audited UK news domains.',
      'Blocked an average of 48 RTB ad-bidder requests and 64 cross-site tracking beacons per article view.',
      'Cut median Time-to-Interactive (TTI) from 4.8 seconds down to 1.9 seconds.'
    ],
    relatedLink: '/campaigns/uk-ad-load-index',
    relatedLabel: '2026 UK Website Ad-Load Index'
  },
  {
    slug: 'youtube-mv3-zero-warning-playback',
    title: 'Case Study: Smooth YouTube Playback on Chrome MV3 | SWEEPR',
    metaDesc: 'How SWEEPR DeepBlock neutralizes pre-roll video ads, mid-roll interruptions, and anti-adblock warning modals on Chrome Manifest V3 without lag.',
    category: 'Streaming & Video Performance Benchmark',
    persona: 'Desktop Chrome 128+ Video & Podcast Viewer',
    beforeMetric: '2 Unskippable Pre-Rolls + Anti-Adblock Wall',
    afterMetric: '0 Video Interruptions + Instant Seek',
    ramSaved: '310 MB Saved per Stream Tab',
    summary: 'Technical evaluation of Manifest V3 declarativeNetRequest rule prioritization and lightweight DOM player state synchronization on video portals.',
    problem: 'After Chrome deprecated Manifest V2 extensions, legacy script-injected blockers triggered "Ad blockers violate Terms of Service" enforcement screens or caused 5-second black-screen delays before videos started.',
    solution: 'Switched to SWEEPR DeepBlock MV3 architecture combining high-priority static DNR rule sets with non-intrusive player cosmetic cleanup.',
    results: [
      'Zero pre-roll or mid-roll ad interruptions and zero black-screen artificial delays across 100+ tested video streams.',
      'Eliminated sponsored sidebar companion cards and homepage masthead clutter while keeping comments and playlists intact.',
      'Maintained 60fps 4K playback with 24% lower GPU/CPU decoder overhead.'
    ],
    relatedLink: '/solutions/youtube-chrome-mv3-block-video-ads',
    relatedLabel: 'YouTube MV3 Protection Guide'
  },
  {
    slug: 'blocking-fake-clearance-shops-scam-detector',
    title: 'Case Study: Stopping Fake 80%-Off Clearance Scam Stores | SWEEPR',
    metaDesc: 'How SWEEPR AI Slop & Scam Store Detector intercepted cloned fashion clearance storefronts and fake countdown timers before checkout.',
    category: 'E-Commerce Threat Prevention Benchmark',
    persona: 'Online Shopper & Search Engine Power User',
    beforeMetric: 'Exposed to Cloned Shopify Scam Domains',
    afterMetric: 'Instant Pre-Checkout Risk Banner & Slop Filter',
    ramSaved: '185 MB Saved on Search SERPs',
    summary: 'Real-world test of local heuristic risk scoring against newly registered typosquatted retail domains, fake Trustpilot stars, and AI-generated SERP farms.',
    problem: 'Sponsored social and search ads increasingly route shoppers to AI-generated clone stores claiming "80% Off Closing Down Sale" with fabricated review widgets and non-existent customer service.',
    solution: 'Enabled SWEEPR AI Slop & Scam Store Detector to inspect DOM trust signals, hardcoded countdown timers, and domain entropy locally inside the browser.',
    results: [
      'Flagged 100% of tested counterfeit clearance storefronts with a clear, high-contrast warning banner prior to payment form entry.',
      'Filtered low-quality AI content farms from Google, Bing, and DuckDuckGo search results.',
      'Performed all inspections 100% locally in the browser without transmitting browsing URLs to any external cloud server.'
    ],
    relatedLink: '/tools/is-this-shop-a-scam',
    relatedLabel: 'Scam Store Detector Overview'
  },
  {
    slug: 'de-fr-usercentrics-didomi-cmp-automation',
    title: 'Case Study: DACH & France Usercentrics/Didomi Automation | SWEEPR',
    metaDesc: 'How European privacy users automated Usercentrics, Sourcepoint Pur-Abo, and Didomi TCF v2.2 consent rejection across German and French publishers.',
    category: 'European GDPR / TCF v2.2 Benchmark',
    persona: 'Cross-Border EU Analyst (Spiegel, Bild, Le Monde, Figaro)',
    beforeMetric: 'Shadow-DOM Usercentrics & Didomi Walls',
    afterMetric: '<50ms Automated Non-Consent + Clean Layout',
    ramSaved: '445 MB Saved Across EU News Portals',
    summary: 'Cross-border benchmark testing open Shadow-DOM traversal for Usercentrics (Germany) and Didomi TCF v2.2 API signaling (France).',
    problem: 'German and French news portals deploy complex Shadow-DOM Usercentrics and Didomi consent overlays alongside Criteo and Outbrain CNAME-cloaked trackers that evade standard international blocklists.',
    solution: 'Configured SWEEPR DeepBlock with localized DACH and FR filter rules plus automated Usercentrics/Didomi non-consent synthesis.',
    results: [
      'Automatically dismissed Usercentrics and Didomi consent banners in under 50ms without breaking article pagination or video embeds.',
      'Blocked Criteo, Taboola, Outbrain, and first-party CNAME-cloaked telemetry across top 30 DE and FR domains.',
      'Provided dedicated localized diagnostic hubs at /de and /fr for instant regional verification.'
    ],
    relatedLink: '/de/usercentrics-cookie-banner-blockieren',
    relatedLabel: 'DE Usercentrics & FR Didomi Hubs'
  }
];

function renderHead({ title, metaDesc, canonicalPath, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="canonical" href="https://sweeprdeepblock.com${canonicalPath}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://sweeprdeepblock.com" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://sweeprdeepblock.com${canonicalPath}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.svg" />
  <link rel="stylesheet" href="/styles.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>`;
}

function renderNav() {
  return `<nav class="navbar">
    <div class="container nav-inner">
      <a href="/" class="brand">
        <img src="/favicon.svg" alt="SWEEPR DeepBlock shield logo" width="28" height="28" />
        <span>SWEEPR <strong>DeepBlock</strong></span>
      </a>
      <div class="nav-links">
        <a href="/test-lab">Live Adblock Test</a>
        <a href="/site">Site Reports</a>
        <a href="/stories">Customer Stories</a>
        <a href="/pricing">Pricing</a>
        <a href="/download" class="btn btn-primary btn-sm">Install Free</a>
      </div>
    </div>
  </nav>`;
}

function renderFooter() {
  return `<footer class="footer" style="margin-top:4rem;padding:2.5rem 0;border-top:1px solid rgba(148,163,184,0.15);">
    <div class="container" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;color:#94a3b8;font-size:0.9rem;">
      <div>© 2026 SWEEPR Simple Storage Ltd. Zero-Telemetry Manifest V3 Privacy Suite.</div>
      <div style="display:flex;gap:1.25rem;flex-wrap:wrap;">
        <a href="/stories" style="color:#cbd5e1;">Customer Stories</a>
        <a href="/site" style="color:#cbd5e1;">150 Site Audits</a>
        <a href="/de" style="color:#cbd5e1;">Deutsch (/de)</a>
        <a href="/fr" style="color:#cbd5e1;">Français (/fr)</a>
        <a href="/pricing" style="color:#cbd5e1;">Pricing & Suite Bundle</a>
        <a href="/privacy" style="color:#cbd5e1;">Privacy Policy</a>
      </div>
    </div>
  </footer>
  <script src="/nav.js" defer></script>`;
}

for (const s of STORIES) {
  const canonicalPath = `/stories/${s.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: s.title,
        description: s.metaDesc,
        author: { '@type': 'Organization', name: 'SWEEPR DeepBlock Performance Lab' },
        publisher: { '@type': 'Organization', name: 'SWEEPR DeepBlock' },
        mainEntityOfPage: `https://sweeprdeepblock.com${canonicalPath}`
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sweeprdeepblock.com/' },
          { '@type': 'ListItem', position: 2, name: 'Customer Stories', item: 'https://sweeprdeepblock.com/stories' },
          { '@type': 'ListItem', position: 3, name: s.category, item: `https://sweeprdeepblock.com${canonicalPath}` }
        ]
      }
    ]
  };

  const otherStories = STORIES.filter((item) => item.slug !== s.slug).slice(0, 3);

  const html = `${renderHead({ title: s.title, metaDesc: s.metaDesc, canonicalPath, jsonLd })}
<body style="background:#0B0F19;color:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;">
  ${renderNav()}
  <main class="container" style="max-width:920px;margin:0 auto;padding:3rem 1.25rem;">
    <div style="margin-bottom:1rem;font-size:0.85rem;color:#94a3b8;">
      <a href="/" style="color:#38bdf8;text-decoration:none;">Home</a> →
      <a href="/stories" style="color:#38bdf8;text-decoration:none;">Verified Switcher & Benchmark Stories</a> →
      <span>${s.category}</span>
    </div>
    <span style="display:inline-block;padding:0.3rem 0.75rem;border-radius:999px;background:rgba(16,185,129,0.12);color:#34d399;font-size:0.8rem;font-weight:700;margin-bottom:0.75rem;">${s.category}</span>
    <h1 style="font-size:2.2rem;line-height:1.2;margin-bottom:1rem;">${s.title.replace(' | SWEEPR', '')}</h1>
    <p style="font-size:1.1rem;color:#cbd5e1;margin-bottom:2rem;">${s.summary}</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1rem;margin-bottom:2rem;">
      <div style="background:#111827;border:1px solid rgba(239,68,68,0.28);border-radius:12px;padding:1.25rem;">
        <div style="font-size:0.75rem;text-transform:uppercase;color:#f87171;font-weight:700;">Before SWEEPR DeepBlock</div>
        <div style="font-size:1.15rem;font-weight:800;margin-top:0.35rem;">${s.beforeMetric}</div>
      </div>
      <div style="background:#111827;border:1px solid rgba(16,185,129,0.35);border-radius:12px;padding:1.25rem;">
        <div style="font-size:0.75rem;text-transform:uppercase;color:#34d399;font-weight:700;">After SWEEPR DeepBlock</div>
        <div style="font-size:1.15rem;font-weight:800;margin-top:0.35rem;">${s.afterMetric}</div>
      </div>
      <div style="background:#111827;border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:1.25rem;">
        <div style="font-size:0.75rem;text-transform:uppercase;color:#38bdf8;font-weight:700;">Verified RAM / Overhead Saved</div>
        <div style="font-size:1.15rem;font-weight:800;margin-top:0.35rem;">${s.ramSaved}</div>
      </div>
    </div>

    <section style="background:#111827;border:1px solid rgba(148,163,184,0.16);border-radius:14px;padding:1.75rem;margin-bottom:1.5rem;">
      <h2 style="font-size:1.35rem;margin-top:0;margin-bottom:0.65rem;">1. User Profile & Friction Bottleneck</h2>
      <p style="color:#cbd5e1;margin-bottom:0.5rem;"><strong>Profile:</strong> ${s.persona}</p>
      <p style="color:#cbd5e1;margin:0;">${s.problem}</p>
    </section>

    <section style="background:#111827;border:1px solid rgba(148,163,184,0.16);border-radius:14px;padding:1.75rem;margin-bottom:1.5rem;">
      <h2 style="font-size:1.35rem;margin-top:0;margin-bottom:0.65rem;">2. SWEEPR DeepBlock Architecture Deployed</h2>
      <p style="color:#cbd5e1;margin:0;">${s.solution}</p>
    </section>

    <section style="background:#111827;border:1px solid rgba(16,185,129,0.28);border-radius:14px;padding:1.75rem;margin-bottom:2rem;">
      <h2 style="font-size:1.35rem;margin-top:0;margin-bottom:0.75rem;">3. Verified Telemetry & Financial Outcomes</h2>
      <ul style="color:#cbd5e1;padding-left:1.25rem;margin:0;">
        ${s.results.map((r) => `<li style="margin-bottom:0.5rem;">${r}</li>`).join('')}
      </ul>
    </section>

    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.14),rgba(56,189,248,0.12));border:1px solid rgba(16,185,129,0.35);border-radius:16px;padding:1.75rem;margin-bottom:2.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
      <div>
        <h3 style="margin:0 0 0.35rem 0;font-size:1.25rem;">Replicate This Setup on Your Browser</h3>
        <p style="margin:0;color:#cbd5e1;font-size:0.95rem;">Run the 10-second live diagnostic or explore ${s.relatedLabel}.</p>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
        <a href="/test-lab" class="btn btn-primary" style="background:#10B981;color:#06281E;font-weight:700;padding:0.75rem 1.25rem;border-radius:10px;text-decoration:none;">Run Live Test Lab</a>
        <a href="${s.relatedLink}" class="btn" style="background:rgba(255,255,255,0.08);color:#F8FAFC;padding:0.75rem 1.25rem;border-radius:10px;text-decoration:none;">${s.relatedLabel}</a>
      </div>
    </div>

    <section>
      <h2 style="font-size:1.3rem;margin-bottom:1rem;">More Verified Switcher & Performance Case Studies</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;">
        ${otherStories
          .map(
            (o) => `<a href="/stories/${o.slug}" style="background:#111827;border:1px solid rgba(148,163,184,0.16);border-radius:12px;padding:1.2rem;text-decoration:none;color:#f8fafc;display:block;">
          <div style="font-size:0.75rem;color:#34d399;font-weight:700;margin-bottom:0.35rem;">${o.category}</div>
          <div style="font-weight:700;margin-bottom:0.4rem;">${o.title.replace('Case Study: ', '').replace(' | SWEEPR', '')}</div>
          <div style="font-size:0.85rem;color:#94a3b8;">${o.afterMetric}</div>
        </a>`
          )
          .join('')}
      </div>
    </section>
  </main>
  ${renderFooter()}
</body>
</html>`;

  fs.writeFileSync(path.join(STORIES_DIR, `${s.slug}.html`), html, 'utf8');
}

// Build /stories index hub
const indexJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'SWEEPR DeepBlock Verified Switcher & Performance Case Studies',
  url: 'https://sweeprdeepblock.com/stories',
  description: 'Verified browser memory, cookie-wall rejection, and renewal-shock switcher case studies across UK and European desktop browsers.'
};

const indexHtml = `${renderHead({
  title: 'Verified Switcher & Browser Benchmark Stories | SWEEPR',
  metaDesc: 'Explore 6 verified case studies showing how users escape £99/yr adblocker renewal traps, reclaim 4.1 GB of Chrome RAM, and block EU cookie walls.',
  canonicalPath: '/stories',
  jsonLd: indexJsonLd
})}
<body style="background:#0B0F19;color:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;">
  ${renderNav()}
  <main class="container" style="max-width:1040px;margin:0 auto;padding:3rem 1.25rem;">
    <span style="display:inline-block;padding:0.35rem 0.85rem;border-radius:999px;background:rgba(16,185,129,0.12);color:#34d399;font-size:0.8rem;font-weight:700;margin-bottom:1rem;">VERIFIED CUSTOMER & LAB CASE STUDIES</span>
    <h1 style="font-size:2.4rem;line-height:1.2;margin-bottom:1rem;">Real-World Switcher & Browser Performance Benchmarks</h1>
    <p style="font-size:1.1rem;color:#cbd5e1;max-width:780px;margin-bottom:2.25rem;">
      See how UK and European households, financial researchers, and privacy-conscious users use SWEEPR DeepBlock to eliminate £99/yr renewal traps, reclaim gigabytes of Chrome/Edge RAM, and automatically reject Usercentrics, Didomi, and Sourcepoint cookie walls.
    </p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.25rem;margin-bottom:3rem;">
      ${STORIES.map(
        (s) => `<a href="/stories/${s.slug}" style="background:#111827;border:1px solid rgba(148,163,184,0.18);border-radius:14px;padding:1.5rem;text-decoration:none;color:#F8FAFC;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <span style="font-size:0.75rem;color:#34d399;font-weight:700;text-transform:uppercase;">${s.category}</span>
          <h2 style="font-size:1.2rem;margin:0.5rem 0 0.65rem 0;line-height:1.35;">${s.title.replace('Case Study: ', '').replace(' | SWEEPR', '')}</h2>
          <p style="font-size:0.92rem;color:#94a3b8;margin-bottom:1rem;">${s.summary}</p>
        </div>
        <div style="border-top:1px solid rgba(148,163,184,0.14);padding-top:0.85rem;display:flex;justify-content:space-between;font-size:0.82rem;">
          <span style="color:#f87171;">Before: ${s.beforeMetric.split('+')[0].trim()}</span>
          <span style="color:#34d399;font-weight:700;">After: ${s.afterMetric.split('+')[0].trim()}</span>
        </div>
      </a>`
      ).join('')}
    </div>

    <section style="background:#111827;border:1px solid rgba(56,189,248,0.28);border-radius:16px;padding:1.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
      <div>
        <h2 style="margin:0 0 0.35rem 0;font-size:1.3rem;">International & European Cookie-Wall Hubs</h2>
        <p style="margin:0;color:#cbd5e1;font-size:0.95rem;">Explore our dedicated German (Usercentrics / Pur-Abo) and French (Didomi / CNIL) technical documentation hubs.</p>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
        <a href="/de" style="background:rgba(56,189,248,0.14);color:#38bdf8;font-weight:700;padding:0.65rem 1.1rem;border-radius:10px;text-decoration:none;">🇩🇪 Deutsch Hub (/de)</a>
        <a href="/de/usercentrics-cookie-banner-blockieren" style="background:rgba(56,189,248,0.08);color:#e2e8f0;padding:0.65rem 1.1rem;border-radius:10px;text-decoration:none;">Usercentrics Guide</a>
        <a href="/fr" style="background:rgba(56,189,248,0.14);color:#38bdf8;font-weight:700;padding:0.65rem 1.1rem;border-radius:10px;text-decoration:none;">🇫🇷 Français Hub (/fr)</a>
        <a href="/fr/bloquer-bandeau-cookie-didomi" style="background:rgba(56,189,248,0.08);color:#e2e8f0;padding:0.65rem 1.1rem;border-radius:10px;text-decoration:none;">Didomi Guide</a>
      </div>
    </section>
  </main>
  ${renderFooter()}
</body>
</html>`;

fs.writeFileSync(path.join(STORIES_DIR, 'index.html'), indexHtml, 'utf8');
console.log(`Built /stories hub and ${STORIES.length} verified customer benchmark case studies.`);
