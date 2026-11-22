#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Category Directory Hubs Builder (`scripts/build-category-hubs.mjs`)
 *
 * Generates lightweight, static Tailwind directory hub pages at:
 *   - `website/vs/index.html`        (Canonical: https://sweeprdeepblock.com/vs)
 *   - `website/solutions/index.html` (Canonical: https://sweeprdeepblock.com/solutions)
 *   - `website/setup/index.html`     (Canonical: https://sweeprdeepblock.com/setup)
 *   - `website/guides/index.html`    (Canonical: https://sweeprdeepblock.com/guides)
 *
 * Strictly excludes any consolidated `noindex` HTML files, enforces `< 55 KB` raw and
 * `< 12 KB` Brotli budgets, uses zero runtime Tailwind CDN or deprecated FAQPage/HowTo schema,
 * applies `rel="nofollow"` on `/order*` and `/login*` links, and registers all 4 hubs in
 * `website/sitemap.xml`.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeHtml(str) {
  return String(str ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function collectIndexablePages(cluster) {
  const dirAbs = path.join(WEBSITE_DIR, cluster);
  if (!fs.existsSync(dirAbs)) return [];
  const items = [];
  for (const file of fs.readdirSync(dirAbs).sort()) {
    if (!file.endsWith('.html') || file === 'index.html') continue;
    const html = fs.readFileSync(path.join(dirAbs, file), 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
    const slug = file.replace(/\.html$/, '');
    const href = `/${cluster}/${slug}`;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let label = h1Match
      ? decodeHtml(h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      : titleMatch
      ? decodeHtml(titleMatch[1].replace(/\s*\|\s*SWEEPR.*$/i, '').trim())
      : slug.replace(/-/g, ' ');
    label = label
      .replace(/^SWEEPR DeepBlock vs\.?\s+/i, 'vs ')
      .replace(/\s*\(2026 Comparison\)$/i, '')
      .replace(/\s*:\s*2026 Feature, Speed & Privacy Comparison$/i, '');
    if (label.length > 74) label = label.slice(0, 71).replace(/\s+\S*$/, '') + ' — MV3';
    items.push({ slug, href, label });
  }
  return items;
}

function classifyVs(item) {
  const s = item.slug;
  if (/(total-adblock|adblock-plus|adlock|1blocker|wipr|adaware)/i.test(s)) {
    return 'Renewal Switcher & Paid AdBlockers';
  }
  if (/(nordvpn|surfshark|proton|windscribe|expressvpn|control-d|nextdns|pi-hole|adguard-home|quad9|mullvad|whoer)/i.test(s)) {
    return 'DNS Filters, VPN Threat Shields & Routers';
  }
  return 'Free, MV3 & Browser Privacy Extensions';
}

function classifySolutions(item) {
  const s = item.slug;
  if (/(youtube|twitch|kick|crunchyroll|bilibili|hulu|max-hbo|paramount|peacock|pluto|tubi|dailymotion|imdb-tv|rumble|spotify|soundcloud|soundgasm)/i.test(s)) {
    return 'Video, Live Streaming & Audio Portals';
  }
  if (/(fandom|fextralife|ign|pcgamer|chesscom|online-chess|roblox|nexus-mods|mangadex|manga-comic|webtoon|anilist|imdb-movie|lyrics|ultimate-guitar)/i.test(s)) {
    return 'Gaming, Wikis, Comics & Entertainment';
  }
  if (/(reddit|quora|twitter|linkedin|instagram|tiktok|medium|substack|forbes|guardian|daily-mail|cnn|yahoo|geeksforgeeks|student-study|recipe)/i.test(s)) {
    return 'News, Communities, Dev & Reading';
  }
  return 'Shopping, Finance, Speed & Utilities';
}

function classifySetup(item) {
  const s = item.slug;
  if (/(android|ios|iphone|ipad|kiwi|samsung-internet|chromium-steamos|steam-deck|raspberry-pi)/i.test(s)) {
    return 'Mobile (Android & iOS) & Compact Linux';
  }
  if (/(firefox|librewolf|floorp|waterfox|zen|mullvad|tor-browser|safari|orion|ladybird|mercury)/i.test(s)) {
    return 'Privacy Forks, Gecko & Apple Safari';
  }
  return 'Chrome, Edge, Brave, Arc & Chromium MV3';
}

function classifyGuides(item) {
  const s = item.slug;
  if (/(cookie|cmp|axeptio|civic|consentmanager|didomi|usercentrics|quantcast|onetrust|sourcepoint|tracking|fbclid|utm|fingerprint|audio-context|dns)/i.test(s)) {
    return 'GDPR Cookie Auto-Reject, Fingerprinting & DNS';
  }
  if (/(youtube|twitch|vimeo|prime-video|tubi|pluto|autoplay|video|anime)/i.test(s)) {
    return 'Streaming Video & Player Anti-Detection';
  }
  if (/(scam|slop|temu|shein|ai-|gambling|torrent|fake|deceptive|hijack)/i.test(s)) {
    return 'Scam Store Alerts, AI Slop & Pop-Under Safety';
  }
  return 'Browser RAM Optimization & MV3 Architecture';
}

function groupBy(items, classifier, sectionOrder) {
  const map = new Map();
  for (const name of sectionOrder) map.set(name, []);
  for (const it of items) {
    const group = classifier(it);
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(it);
  }
  return [...map.entries()].filter(([, list]) => list.length > 0);
}

const HUB_DEFINITIONS = [
  {
    cluster: 'vs',
    title: 'AdBlocker Comparisons & Renewal Switcher Hub | SWEEPR',
    description:
      'Compare SWEEPR DeepBlock vs Total Adblock, uBlock Origin Lite, AdGuard, AdBlock Plus, Pie, NextDNS, and 20+ privacy blockers on MV3 blocking and renewal price.',
    badge: 'Comparisons Hub • Zero Acceptable Ads Bribes',
    h1: 'SWEEPR DeepBlock Comparisons & Renewal Switcher Hub',
    lead: 'Side-by-side Manifest V3 benchmarks, <50ms GDPR cookie consent auto-rejection audits, and multi-year renewal price comparisons across every major adblocker, DNS sinkhole, and privacy extension.',
    editorial:
      'Unlike legacy ad blockers that monetize Acceptable Ads whitelists or triple renewal pricing in Year 2, SWEEPR DeepBlock executes 271+ native C++ declarativeNetRequest rules locally with zero browsing history logging, bundled AI Slop filtering, 14-point scam shop checks, and Total Tab & RAM Tamer hibernation across up to 5 devices for £29.99/yr.',
    classifier: classifyVs,
    sectionOrder: [
      'Renewal Switcher & Paid AdBlockers',
      'Free, MV3 & Browser Privacy Extensions',
      'DNS Filters, VPN Threat Shields & Routers'
    ]
  },
  {
    cluster: 'solutions',
    title: 'Platform & Streaming Ad-Block Solutions Hub | SWEEPR',
    description:
      'Explore 80+ platform-specific Manifest V3 guides to block video commercials, strip tracking parameters, reject cookie walls, and lower browser RAM usage.',
    badge: 'Solutions Directory • Streaming, Wikis & News',
    h1: 'Platform, Streaming & Website Ad-Block Solutions',
    lead: 'Browse verified DeepStealth and Manifest V3 configurations tailored to video streaming platforms, high-RAM game wikis, developer portals, financial charts, social feeds, and torrent indexers.',
    editorial:
      'Modern media sites combine server-side or script-injected video commercials with dozens of OpenRTB header-bidding timers that consume over 500 MB per tab and trigger anti-adblock overlays. Select any platform below to inspect exact declarativeNetRequest filters, anti-detection bypass safeguards, and RAM telemetry savings.',
    classifier: classifySolutions,
    sectionOrder: [
      'Video, Live Streaming & Audio Portals',
      'Gaming, Wikis, Comics & Entertainment',
      'News, Communities, Dev & Reading',
      'Shopping, Finance, Speed & Utilities'
    ]
  },
  {
    cluster: 'setup',
    title: 'Browser & OS Manifest V3 Setup Guides Hub | SWEEPR',
    description:
      'Step-by-step SWEEPR DeepBlock installation guides for Chrome MV3, Firefox, Brave, Edge, Safari macOS/iOS, Thorium, Floorp, Zen, LibreWolf, and Android browsers.',
    badge: 'Setup Hub • Cross-Browser & ARM64 Optimized',
    h1: 'Browser & OS Setup Guides for SWEEPR DeepBlock',
    lead: 'Choose your desktop or mobile browser below for tailored installation instructions across Windows, macOS Apple Silicon, Linux Wayland, FreeBSD, ChromeOS, iOS, and Android.',
    editorial:
      'Every browser engine handles content blocking differently—from Chrome and Edge Manifest V3 declarativeNetRequest rulesets to Firefox Gecko web extensions, Safari Apple Encrypted DNS Profiles, and privacy forks like Floorp, Zen, LibreWolf, and Kiwi Browser on Android. Pick your environment to configure zero-latency protection.',
    classifier: classifySetup,
    sectionOrder: [
      'Chrome, Edge, Brave, Arc & Chromium MV3',
      'Privacy Forks, Gecko & Apple Safari',
      'Mobile (Android & iOS) & Compact Linux'
    ]
  },
  {
    cluster: 'guides',
    title: 'Technical Privacy, CMP Cookie & RAM Guides Hub | SWEEPR',
    description:
      'Browse 90+ practical guides covering <50ms GDPR cookie consent rejection, Twitch & YouTube MV3 blocking, Canvas fingerprinting defense, and 62% RAM savings.',
    badge: 'Engineering Guides • Privacy, Speed & Safety',
    h1: 'Technical Privacy, Cookie Auto-Reject & Speed Guides',
    lead: 'Step-by-step troubleshooting playbooks for eliminating purple screens, automatically rejecting UK & EU CMP cookie banners without breaking scroll, hiding Google AI slop, and slashing browser memory load.',
    editorial:
      'Simply hiding cookie pop-ups with CSS often leaves body overflow:hidden scroll locks active, while aggressive filterlists can trigger anti-adblock modals on streaming portals. Our engineering playbooks document verified MAIN-world stealth techniques, CMP signal synthesis, and Total Tab & RAM Tamer tuning across every major website pattern.',
    classifier: classifyGuides,
    sectionOrder: [
      'Streaming Video & Player Anti-Detection',
      'GDPR Cookie Auto-Reject, Fingerprinting & DNS',
      'Scam Store Alerts, AI Slop & Pop-Under Safety',
      'Browser RAM Optimization & MV3 Architecture'
    ]
  }
];

function renderHubHtml(hub, items) {
  const canonicalUrl = `https://sweeprdeepblock.com/${hub.cluster}`;
  const groups = groupBy(items, hub.classifier, hub.sectionOrder);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: hub.h1,
        description: hub.description,
        url: canonicalUrl,
        inLanguage: 'en-GB',
        publisher: {
          '@type': 'Organization',
          name: 'SWEEPR Global Limited',
          url: 'https://sweeprdeepblock.com/'
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sweeprdeepblock.com/' },
          { '@type': 'ListItem', position: 2, name: hub.h1, item: canonicalUrl }
        ]
      }
    ]
  });

  const sectionsHtml = groups
    .map(
      ([groupName, list]) => `<section class="space-y-3">
      <h2 class="text-xl font-black text-white">${escapeHtml(groupName)} <span class="text-xs font-mono text-emerald-400">(${list.length})</span></h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${list
          .map(
            (it) =>
              `<a href="${escapeHtml(it.href)}" class="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 text-sm font-semibold text-white no-underline block transition">${escapeHtml(it.label)} &rarr;</a>`
          )
          .join('\n        ')}
      </div>
    </section>`
    )
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(hub.title)}</title>
  <meta name="description" content="${escapeHtml(hub.description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SWEEPR DeepBlock" />
  <meta property="og:title" content="${escapeHtml(hub.title)}" />
  <meta property="og:description" content="${escapeHtml(hub.description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(hub.title)}" />
  <meta name="twitter:description" content="${escapeHtml(hub.description)}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />
  <link rel="stylesheet" href="/sweepr-tailwind.min.css?v=20261117" />
  <script type="application/ld+json">${jsonLd}</script>
  <script src="/nav.js?v=20261120" defer></script>
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', { transport_url: window.location.origin + '/metrics', first_party_collection: true });
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
  <header class="border-b border-slate-800/80 bg-slate-950/90 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2.5 text-white font-black text-lg no-underline">
        <img src="/logo.svg" alt="SWEEPR DeepBlock logo" width="32" height="32" class="w-8 h-8" />
        <span>SWEEPR <span class="text-emerald-400">DeepBlock</span></span>
      </a>
      <nav aria-label="Primary" class="hidden md:flex items-center gap-4 text-sm font-semibold text-slate-300">
        <a href="/vs" class="${hub.cluster === 'vs' ? 'text-emerald-400' : 'hover:text-white'}">Comparisons</a>
        <a href="/solutions" class="${hub.cluster === 'solutions' ? 'text-emerald-400' : 'hover:text-white'}">Solutions</a>
        <a href="/setup" class="${hub.cluster === 'setup' ? 'text-emerald-400' : 'hover:text-white'}">Setups</a>
        <a href="/guides" class="${hub.cluster === 'guides' ? 'text-emerald-400' : 'hover:text-white'}">Guides</a>
        <a href="/test-lab" class="hover:text-white">8/8 Test Lab</a>
        <a href="/pricing" class="hover:text-white">Pricing</a>
      </nav>
      <a href="/download" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm no-underline">Install Free &rarr;</a>
    </div>
  </header>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
    <div class="space-y-3">
      <div class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
        <a href="/" class="hover:underline">Home</a> / <span>${escapeHtml(hub.badge)}</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-black text-white">${escapeHtml(hub.h1)} (${items.length} Verified Guides)</h1>
      <p class="text-slate-300 max-w-3xl text-base leading-relaxed">${escapeHtml(hub.lead)}</p>
      <p class="text-slate-400 max-w-4xl text-sm leading-relaxed">${escapeHtml(hub.editorial)}</p>
      <div class="flex flex-wrap gap-3 pt-2">
        <a href="/download" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm no-underline">Download Free Extension &rarr;</a>
        <a href="/pricing" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 no-underline">View Pro &amp; Suite Pricing</a>
        <a href="/test-lab" class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs sm:text-sm border border-emerald-500/30 no-underline">Run 8/8 Live Test Lab</a>
        <a href="/order?plan=suite_annual" rel="nofollow" class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs sm:text-sm border border-amber-500/30 no-underline">Complete Suite (£89.99/yr)</a>
      </div>
    </div>

    ${sectionsHtml}

    <section class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
      <h2 class="text-lg font-black text-white">Explore All SWEEPR DeepBlock Directories &amp; Tools</h2>
      <div class="flex flex-wrap gap-3 text-sm font-semibold">
        <a href="/vs" class="text-emerald-400 hover:underline">AdBlocker Comparisons (/vs)</a>
        <a href="/solutions" class="text-emerald-400 hover:underline">Platform Solutions (/solutions)</a>
        <a href="/setup" class="text-emerald-400 hover:underline">Browser Setups (/setup)</a>
        <a href="/guides" class="text-emerald-400 hover:underline">Technical Guides (/guides)</a>
        <a href="/site" class="text-sky-400 hover:underline">150 Site Audits (/site)</a>
        <a href="/tools" class="text-sky-400 hover:underline">Privacy Diagnostic Tools (/tools)</a>
        <a href="/stories" class="text-sky-400 hover:underline">Customer Switcher Stories (/stories)</a>
        <a href="/glossary" class="text-sky-400 hover:underline">Privacy Glossary (/glossary)</a>
        <a href="/campaigns/uk-ad-load-index" class="text-teal-300 hover:underline">UK Ad-Load Index</a>
        <a href="/campaigns/renewal-shock-switcher" class="text-teal-300 hover:underline">Renewal Shock Calculator</a>
        <a href="/benchmarks" class="text-teal-300 hover:underline">MV3 Benchmarks</a>
      </div>
    </section>
  </main>

  <footer class="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div>&copy; 2026 SWEEPR Global Limited. Local-first Manifest V3 engine &mdash; zero browsing history logged.</div>
      <div class="flex flex-wrap gap-4">
        <a href="/" class="hover:text-white">Home</a>
        <a href="/download" class="hover:text-white">Download</a>
        <a href="/pricing" class="hover:text-white">Pricing</a>
        <a href="/vs" class="hover:text-white">Comparisons</a>
        <a href="/solutions" class="hover:text-white">Solutions</a>
        <a href="/setup" class="hover:text-white">Setups</a>
        <a href="/guides" class="hover:text-white">Guides</a>
        <a href="/site" class="hover:text-white">Site Audits</a>
        <a href="/tools" class="hover:text-white">Tools</a>
        <a href="/stories" class="hover:text-white">Stories</a>
        <a href="/glossary" class="hover:text-white">Glossary</a>
        <a href="/de" hreflang="de" class="hover:text-white">DE</a>
        <a href="/fr" hreflang="fr" class="hover:text-white">FR</a>
        <a href="/es" hreflang="es" class="hover:text-white">ES</a>
        <a href="/login" rel="nofollow" class="hover:text-white">Customer Portal</a>
        <a href="/support" class="hover:text-white">Support</a>
        <a href="/privacy" class="hover:text-white">Privacy Policy</a>
        <a href="/terms" class="hover:text-white">Terms</a>
        <a href="/refund" class="hover:text-white">Refund Policy</a>
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

function registerHubsInSitemap(hubPaths) {
  if (!fs.existsSync(SITEMAP_PATH)) return;
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const todayStr = new Date().toISOString().slice(0, 10);
  const toInsert = [];
  for (const p of hubPaths) {
    const loc = `https://sweeprdeepblock.com${p}`;
    if (!xml.includes(`<loc>${loc}</loc>`)) {
      toInsert.push(
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${todayStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`
      );
    }
  }
  if (toInsert.length > 0 && xml.includes('</urlset>')) {
    xml = xml.replace('</urlset>', `${toInsert.join('\n')}\n</urlset>`);
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  }
}

export function buildCategoryHubs() {
  const summary = [];
  const registered = [];
  for (const hub of HUB_DEFINITIONS) {
    const items = collectIndexablePages(hub.cluster);
    const html = renderHubHtml(hub, items);
    const outPath = path.join(WEBSITE_DIR, hub.cluster, 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');

    const rawBytes = Buffer.byteLength(html, 'utf8');
    const brotliBytes = zlib.brotliCompressSync(Buffer.from(html, 'utf8'), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
    }).length;
    summary.push({
      route: `/${hub.cluster}`,
      items: items.length,
      rawKb: Number((rawBytes / 1024).toFixed(2)),
      brotliKb: Number((brotliBytes / 1024).toFixed(2))
    });
    registered.push(`/${hub.cluster}`);
  }
  registerHubsInSitemap(registered);
  console.log('[CATEGORY-HUBS] Built 4 indexable directory hubs:', JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  buildCategoryHubs();
}
