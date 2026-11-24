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
import {
  SITE_ORIGIN,
  PRODUCT_FACTS,
  escapeHtml,
  buildJsonLd,
  renderBreadcrumbs,
  renderGlassCard,
  renderCtaBanner,
  renderShellPage
} from './lib/holographic-shell.mjs';
import {
  CONSOLIDATE_301_MAP,
  isNoIndexPrunePath,
  normalizeUrlPath
} from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');

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
    const slug = file.replace(/\.html$/, '');
    const href = normalizeUrlPath(`/${cluster}/${slug}`);
    if (isNoIndexPrunePath(href) || CONSOLIDATE_301_MAP.has(href)) continue;
    const html = fs.readFileSync(path.join(dirAbs, file), 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let label = h1Match
      ? decodeHtml(h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      : titleMatch
      ? decodeHtml(titleMatch[1].replace(/\s*\|\s*SWEEPR.*$/i, '').trim())
      : slug.replace(/-/g, ' ');
    label = label
      .replace(/^SWEEPR Deep[Bb]lock vs\.?\s+/i, 'vs ')
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
  if (/(android|kiwi|firefox-android)/i.test(s)) {
    return 'Android Mobile & Extension Alternatives';
  }
  if (/(firefox|librewolf|floorp|waterfox|zen|orion|mercury)/i.test(s)) {
    return 'Privacy Forks, Gecko & macOS WebKit';
  }
  return 'Chrome, Edge, Brave, Arc & Chromium MV3';
}

function classifyGuides(item) {
  const s = item.slug;
  if (/(cookie|cmp|axeptio|civic|consentmanager|didomi|usercentrics|quantcast|onetrust|sourcepoint|tracking|fbclid|utm|fingerprint|audio-context|meta-pixel)/i.test(s)) {
    return 'GDPR Cookie Auto-Reject & Tracker Stripping';
  }
  if (/(youtube|twitch|vimeo|prime-video|tubi|pluto|autoplay|video|anime)/i.test(s)) {
    return 'Streaming Video & Player Anti-Detection';
  }
  if (/(scam|slop|temu|shein|ai-|gambling|torrent|fake|deceptive|hijack|malvertising|captcha|sponsored|popunder)/i.test(s)) {
    return 'Malvertising, Redirect & Sponsored Feed Safety';
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
      'Compare SWEEPR Deepblock v1.3.1 vs Total Adblock, uBlock Origin Lite, AdGuard, AdBlock Plus, Pie, Ghostery, and Windscribe on MV3 blocking and renewal price.',
    badge: 'Comparisons Hub • Zero Acceptable Ads Bribes',
    h1: 'SWEEPR Deepblock Comparisons & Renewal Switcher Hub',
    lead: 'Side-by-side Manifest V3 benchmarks, automated GDPR cookie consent rejection audits, and multi-year renewal price comparisons across major adblockers and privacy extensions.',
    editorial:
      `Unlike legacy ad blockers that monetize Acceptable Ads whitelists or triple renewal pricing in Year 2, SWEEPR Deepblock v${PRODUCT_FACTS.version} executes ${PRODUCT_FACTS.staticDnrRules} static declarativeNetRequest rules locally with zero browsing history logging, URL tracking parameter stripping, cryptominer protection, and Total Tab & RAM Tamer across up to ${PRODUCT_FACTS.devicesIncluded} devices for £29.99/yr.`,
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
      'Explore verified platform-specific Manifest V3 guides to block video commercials, strip tracking parameters, reject cookie walls, and lower browser RAM usage.',
    badge: 'Solutions Directory • Streaming, Wikis & News',
    h1: 'Platform, Streaming & Website Ad-Block Solutions',
    lead: 'Browse verified DeepStealth and Manifest V3 configurations tailored to video streaming portals, high-RAM game wikis, developer portals, financial charts, and social feeds.',
    editorial:
      `Modern media sites combine script-injected video commercials with dozens of OpenRTB header-bidding timers and pop-unders. Select any platform below to inspect SWEEPR Deepblock v${PRODUCT_FACTS.version} declarativeNetRequest filters, anti-detection bypass safeguards, and Total Tab & RAM Tamer hibernation workflows.`,
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
      'Step-by-step SWEEPR Deepblock v1.3.1 installation guides for Chrome MV3, Edge, Firefox (Desktop & Android), Brave, Opera GX, Thorium, Floorp, Zen, and LibreWolf.',
    badge: 'Setup Hub • Cross-Browser & ARM64 Optimized',
    h1: 'Browser & OS Setup Guides for SWEEPR Deepblock',
    lead: 'Choose your desktop or Android Firefox browser below for tailored installation instructions across Windows, macOS Apple Silicon, Linux, and Android Firefox.',
    editorial:
      `Every browser engine handles content blocking differently—from Chrome, Edge, Brave, and Opera Manifest V3 declarativeNetRequest rulesets (${PRODUCT_FACTS.staticDnrRules} static rules) to Mozilla Firefox (Desktop & Android) and privacy forks like Floorp, Zen, LibreWolf, and Waterfox. Pick your environment to configure zero-telemetry protection.`,
    classifier: classifySetup,
    sectionOrder: [
      'Chrome, Edge, Brave, Arc & Chromium MV3',
      'Privacy Forks, Gecko & macOS WebKit',
      'Android Mobile & Extension Alternatives'
    ]
  },
  {
    cluster: 'guides',
    title: 'Technical Privacy, CMP Cookie & RAM Guides Hub | SWEEPR',
    description:
      'Browse practical guides covering automated GDPR cookie consent rejection, YouTube & Twitch MV3 blocking, URL tracker stripping, and browser memory optimization.',
    badge: 'Engineering Guides • Privacy, Speed & Safety',
    h1: 'Technical Privacy, Cookie Auto-Reject & Speed Guides',
    lead: 'Step-by-step troubleshooting playbooks for eliminating Twitch commercial interruptions, automatically rejecting UK & EU CMP cookie banners without breaking scroll, stripping fbclid/gclid tracking tokens, and reducing tab memory load.',
    editorial:
      `Simply hiding cookie pop-ups with CSS often leaves body overflow:hidden scroll locks active, while aggressive filterlists can trigger anti-adblock modals on streaming portals. Our engineering playbooks document verified DeepStealth stealth techniques, CMP signal synthesis, cryptominer blocking, and Total Tab & RAM Tamer tuning across supported browsers.`,
    classifier: classifyGuides,
    sectionOrder: [
      'Streaming Video & Player Anti-Detection',
      'GDPR Cookie Auto-Reject & Tracker Stripping',
      'Malvertising, Redirect & Sponsored Feed Safety',
      'Browser RAM Optimization & MV3 Architecture'
    ]
  }
];

function renderHubHtml(hub, items) {
  const currentPath = `/${hub.cluster}`;
  const canonicalUrl = `${SITE_ORIGIN}${currentPath}`;
  const groups = groupBy(items, hub.classifier, hub.sectionOrder);
  const breadcrumbs = [
    { name: 'Home', href: '/', item: '/' },
    { name: hub.h1, item: currentPath }
  ];

  const collectionPage = {
    '@type': 'CollectionPage',
    name: hub.h1,
    description: hub.description,
    url: canonicalUrl,
    inLanguage: 'en-GB',
    publisher: {
      '@type': 'Organization',
      name: 'SWEEPR Global Limited',
      url: `${SITE_ORIGIN}/`
    }
  };

  const jsonLd = buildJsonLd({
    canonicalUrl,
    breadcrumbs,
    includeSoftwareApp: false,
    extraGraph: [collectionPage]
  });

  const sectionsHtml = groups
    .map(
      ([groupName, list]) => `<section class="space-y-3">
      <h2 class="text-xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(groupName)} <span class="text-xs font-mono text-emerald-700">(${list.length})</span></h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${list
          .map(
            (it) =>
              `<a href="${escapeHtml(it.href)}" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-xl p-3.5 text-sm font-semibold text-gray-900 no-underline block transition-all shadow-sm">${escapeHtml(it.label)} &rarr;</a>`
          )
          .join('\n        ')}
      </div>
    </section>`
    )
    .join('\n    ');

  const directoryCardHtml = renderGlassCard({
    title: 'Explore SWEEPR Deepblock Directories & Tools',
    bodyHtml: `<div class="flex flex-wrap gap-3 text-sm font-semibold">
        <a href="/vs" class="text-emerald-700 hover:underline">AdBlocker Comparisons (/vs)</a>
        <a href="/solutions" class="text-emerald-700 hover:underline">Platform Solutions (/solutions)</a>
        <a href="/setup" class="text-emerald-700 hover:underline">Browser Setups (/setup)</a>
        <a href="/guides" class="text-emerald-700 hover:underline">Technical Guides (/guides)</a>
        <a href="/tools" class="text-sky-700 hover:underline">Diagnostic Tools (/tools)</a>
        <a href="/glossary" class="text-sky-700 hover:underline">Privacy Glossary (/glossary)</a>
        <a href="/benchmarks" class="text-emerald-700 hover:underline">MV3 Benchmarks</a>
        <a href="/test-lab" class="text-emerald-700 hover:underline">Free Adblock Test Lab</a>
      </div>`
  });

  const contentHtml = `<header class="space-y-4">
      ${renderBreadcrumbs(breadcrumbs)}
      <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHtml(hub.badge)}</div>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">${escapeHtml(hub.h1)} (${items.length} Verified Guides)</h1>
      <p class="text-gray-700 max-w-3xl text-base leading-relaxed">${escapeHtml(hub.lead)}</p>
      <p class="text-gray-600 max-w-4xl text-sm leading-relaxed">${escapeHtml(hub.editorial)}</p>
      <div class="flex flex-wrap gap-3 pt-2">
        <a href="/download" class="btn btn-go px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm no-underline">Download Free Extension &rarr;</a>
        <a href="/pricing" class="btn px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-bold text-xs sm:text-sm border border-gray-200 no-underline">View Pro &amp; Suite Pricing</a>
        <a href="/test-lab" class="btn px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-200 no-underline">Run Free Adblock Test Lab</a>
        <a href="/order?plan=suite_annual" rel="nofollow" class="btn px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs sm:text-sm border border-amber-200 no-underline">Complete Suite (£89.99/yr)</a>
      </div>
    </header>

    ${sectionsHtml}

    ${renderCtaBanner({
      badge: `SWEEPR Deepblock v${PRODUCT_FACTS.version}`,
      heading: 'Zero Ads. Automated Cookie Rejection. 283 Static MV3 Rules.',
      subtext: 'Protect up to 5 browsers/devices with SWEEPR Deepblock Pro (£29.99/yr) or add Total Tab & RAM Tamer + VPN + Cleaner in the Complete Security Suite (£89.99/yr).',
      primaryLabel: 'Install Free Extension',
      primaryHref: '/download?install=1',
      secondaryLabel: 'Compare Plans',
      secondaryHref: '/pricing'
    })}

    ${directoryCardHtml}`;

  return renderShellPage({
    title: hub.title,
    description: hub.description,
    canonicalUrl,
    currentPath,
    ogType: 'website',
    breadcrumbs,
    jsonLd,
    includeSoftwareApp: false,
    maxWidth: 'max-w-6xl',
    contentHtml
  });
}

function registerHubsInSitemap(hubPaths) {
  if (!fs.existsSync(SITEMAP_PATH)) return;
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const todayStr = new Date().toISOString().slice(0, 10);
  const toInsert = [];
  for (const p of hubPaths) {
    const loc = `${SITE_ORIGIN}${p}`;
    if (!xml.includes(`<loc>${loc}</loc>`)) {
      toInsert.push(
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${todayStr}</lastmod>\n  </url>`
      );
    }
  }
  if (toInsert.length > 0 && xml.includes('</urlset>')) {
    xml = xml.replace('</urlset>', `${toInsert.join('\n')}\n</urlset>`);
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  }
}

export function buildCategoryHubs({ force = process.argv.includes('--force') } = {}) {
  const summary = [];
  const registered = [];
  for (const hub of HUB_DEFINITIONS) {
    const outPath = path.join(WEBSITE_DIR, hub.cluster, 'index.html');
    if (!force && fs.existsSync(outPath)) {
      registered.push(`/${hub.cluster}`);
      summary.push({ route: `/${hub.cluster}`, preserved: true });
      continue;
    }
    const items = collectIndexablePages(hub.cluster);
    const html = renderHubHtml(hub, items);
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
  console.log('[CATEGORY-HUBS] Processed 4 indexable directory hubs:', JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  buildCategoryHubs();
}
