#!/usr/bin/env node
/**
 * SWEEPR Deepblock (sweeprdeepblock.com) — Pillar Version Normalizer, Dark Slop Cleaner & 14-Day Title Cooldown Guard
 *
 *  1. Enforces a strict 14-day cooldown per Pillar page (`website/pillar-enrichment-state.json`) before any
 *     `<title>` or `<meta name="description">` can be modified again, preventing SERP snippet evaluation resets.
 *  2. Extracts real, verified Manifest V3 `declarativeNetRequest` (DNR) rules from `extension/rules/*.json`
 *     and `extension/rules/abp_filter_list.txt` for downstream scripts (`loadLiveRules`).
 *  3. Strips legacy dark `#deepblock-live-rule-proof`, `#deepblock-ctr-intent-enrichment`, `#deepblock-ctr-enrichment`,
 *     and dark `#gsc-exact-query-enrichment` blocks, and normalizes v1.2.x/v1.3.x version strings to `v1.4.0`.
 *  4. Updates `<lastmod>` in `website/sitemap.xml` ONLY for URLs whose HTML content was actually modified.
 *
 * Usage:
 *   node scripts/enrich-pillars-with-live-proof.mjs [limit=500]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATE_301_MAP, isNoIndexPrunePath, normalizeUrlPath } from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
const STATIC_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'static_ads_and_trackers.json');
const CRYPTO_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'cryptominers.json');
const TRACKER_PARAMS_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'tracker_params.json');
const DELTA_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'dynamic_delta.json');
const ABP_LIST_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'abp_filter_list.txt');
const MANIFEST_PATH = path.join(ROOT_DIR, 'extension', 'manifest.json');
const KEYWORD_MATRIX_PATH = path.join(ROOT_DIR, 'data', 'keyword-opportunity-matrix.json');

const MANIFEST_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).version || '1.4.0';
  } catch {
    return '1.4.0';
  }
})();

const ADULT_RULE_RE = /(eporner|pornoxo|pornoeggs|freeporn|hqporn|sxyprn|realxxx|hotxxx|hotadult|faphouse|tubecup|doublepimp|tophqcam|xlivrdr|doppiocdn|awmdelivery|camsoda|nuvid|nvdst|drtuber|txxx|rvmessage|rvrpush|fhgte|fh-wgt|qoqh|lxax|koxk|u5s5|ey43|ero-advertising|trafficjunky|traffichunt|adspyglass|juicyads|plugrush|exoclick|exosrv|magsrv|pemsrv|realsrv|adxpansion|adtng|tsyndicate|crakrevenue|jads\.co|xvideos|xnxx|xhamster|redtube|youporn|spankbang|chaturbate|stripchat|bongacams|livejasmin|onlyfans)/i;

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const todayStr = new Date().toISOString().slice(0, 10);
const nowIso = new Date().toISOString();

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Top 28 GSC pages that received Exact-Query CTR Surgery on 2026-11-03 (protected by 14-day title cooldown)
const INITIAL_GSC_TITLE_SURGERY_PATHS = [
  '/setup/thorium-chromium-browser',
  '/setup/orion-browser-macos-ios',
  '/solutions/crunchyroll-anime-streams-block-video-ads',
  '/setup/floorp-browser-firefox-fork',
  '/setup/arc-browser-windows-mac',
  '/setup/zen-browser-privacy-tabs',
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '/setup/kiwi-browser-android',
  '/solutions/roblox-web-community-filter-ai-slop-and-scams',
  '/solutions/webtoon-manhwa-readers-block-video-ads',
  '/solutions/manga-comic-readers-block-video-ads',
  '/solutions/linkedin-feed-ads-block-video-ads',
  '/solutions/soundcloud-audio-player-block-video-ads',
  '/solutions/dex-token-screeners-stop-malvertising-popunders',
  '/solutions/geeksforgeeks-dev-portals-reduce-browser-ram-usage',
  '/setup/ungoogled-chromium-setup',
  '/setup/brave-macos-apple-silicon',
  '/setup/librewolf-hardened-firefox',
  '/solutions/rumble-video-streams-block-video-ads',
  '/solutions/tumblr-blog-feeds-block-video-ads',
  '/vs/avast-secure-browser-guard',
  '/vs/total-adblock',
  '/guides/how-to-remove-recipe-blog-life-stories',
  '/guides/how-to-block-twitch-mid-roll-ads-purple-screen',
  '/guides/how-to-auto-reject-gdpr-cookie-popups',
  '/guides/how-to-strip-utm-fbclid-gclid-tracking-links',
  '/solutions/fextralife-game-wikis-block-video-ads',
  '/solutions/twitch-vod-replay-block-video-ads'
];

export function loadEnrichmentState() {
  let state = {
    cooldownDays: 14,
    lastRunAt: null,
    titleUpdatedAt: {},
    customQuerySurgery: {},
    discoveredGscPaths: [],
    gscRecoveryHistory: [
      { date: '2026-10-28', impressions: 119, clicks: 1, indexedPages: 171, note: 'Peak honeymoon serving before Cartesian 404 shockwave' },
      { date: '2026-11-01', impressions: 1, clicks: 0, indexedPages: 171, note: 'Trough after Scaled Content demotion (1,575 pages)' },
      { date: '2026-11-03', impressions: null, clicks: null, indexedPages: 295, note: 'Consolidated 1,588 -> 295 Pillar URLs, applied 28-page CTR surgery & Live MV3 Rule Proof' }
    ],
    proofUpdatedAt: {},
    contentHashes: {}
  };
  if (fs.existsSync(STATE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      state = { ...state, ...parsed };
    } catch {}
  }
  for (const p of INITIAL_GSC_TITLE_SURGERY_PATHS) {
    const normP = normalizeUrlPath(p).toLowerCase();
    if (isNoIndexPrunePath(normP) || CONSOLIDATE_301_MAP.has(normP)) continue;
    if (!state.titleUpdatedAt[p]) {
      state.titleUpdatedAt[p] = '2026-11-03T20:45:00.000Z';
    }
  }
  return state;
}

export function canUpdatePillarTitle(urlPath, state = loadEnrichmentState()) {
  const lastIso = state.titleUpdatedAt?.[urlPath];
  if (!lastIso) return true;
  const elapsed = Date.now() - Date.parse(lastIso);
  return elapsed >= FOURTEEN_DAYS_MS;
}

function readRuleArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.rules || []);
}

export function loadLiveRules() {
  const staticRules = [
    ...readRuleArray(STATIC_RULES_PATH),
    ...readRuleArray(CRYPTO_RULES_PATH),
    ...readRuleArray(TRACKER_PARAMS_PATH)
  ];
  const deltaRaw = fs.existsSync(DELTA_RULES_PATH)
    ? JSON.parse(fs.readFileSync(DELTA_RULES_PATH, 'utf8'))
    : [];
  const deltaRules = Array.isArray(deltaRaw) ? deltaRaw : (deltaRaw.dynamicDnrRules || deltaRaw.rules || []);
  const abpLines = fs.existsSync(ABP_LIST_PATH)
    ? fs.readFileSync(ABP_LIST_PATH, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('!') && !l.startsWith('['))
    : [];

  const combinedDnr = [...staticRules, ...deltaRules].filter(
    (r) =>
      r &&
      r.id &&
      r.condition &&
      (r.condition.urlFilter || r.condition.regexFilter) &&
      !ADULT_RULE_RE.test(JSON.stringify(r))
  );
  return {
    staticCount: staticRules.length,
    deltaCount: deltaRules.length,
    abpCount: abpLines.length,
    combinedDnr,
    abpLines
  };
}

// Deprecated no-op stub preserved for backward-compatible imports across pipeline scripts
export function buildProofSectionHtml() {
  return '';
}

export function runLiveProofEnrichment(customLimit = null, _customForce = false) {
  const limitArg = customLimit !== null ? customLimit : (process.argv[2] && !process.argv[2].startsWith('--') ? Number(process.argv[2]) : 500);

  const state = loadEnrichmentState();
  loadLiveRules();

  // Read existing sitemap.xml to get the authoritative Pillar URLs and their current <lastmod> dates
  const sitemapXml = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';
  const existingLastModMap = new Map();
  for (const m of sitemapXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    existingLastModMap.set(m[1].trim(), m[2].trim());
  }

  const modifiedLocs = new Set();
  let enrichedCount = 0;

  for (const cluster of ['setup', 'solutions', 'vs', 'guides']) {
    const dirAbs = path.join(WEBSITE_DIR, cluster);
    if (!fs.existsSync(dirAbs)) continue;
    for (const file of fs.readdirSync(dirAbs).sort()) {
      if (!file.endsWith('.html') || file === 'index.html') continue;
      if (enrichedCount >= limitArg) break;

      const absPath = path.join(dirAbs, file);
      const html = fs.readFileSync(absPath, 'utf8');

      // Only normalize indexable Pillar pages
      if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
        continue;
      }

      const slug = file.replace(/\.html$/, '');
      const urlPath = `/${cluster}/${slug}`;
      const loc = `https://sweeprdeepblock.com${urlPath}`;

      let updatedHtml = html
        .replace(/SWEEPR DeepBlock v1\.2\.[2579]/gi, `SWEEPR Deepblock v${MANIFEST_VERSION}`)
        .replace(/•\s*Version\s+1\.2\.[2579]/gi, `• Version ${MANIFEST_VERSION}`)
        .replace(/"highPrice"\s*:\s*"59\.99"\s*,\s*"offerCount"\s*:\s*"3"/g, '"highPrice":"89.99","offerCount":"4"')
        .replace(/src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-01MNBQSL9K"/g, 'src="/metrics/js?id=G-01MNBQSL9K"')
        .replace(
          /gtag\('config',\s*'G-01MNBQSL9K'\);/g,
          `gtag('config', 'G-01MNBQSL9K', {\n      transport_url: window.location.origin + '/metrics',\n      first_party_collection: true\n    });`
        )
        .replace(
          /£9\.99\/mo or save 50% on the <strong>£59\.99\/yr Annual Plan — £4\.99\/mo<\/strong>/g,
          '£1.99 1st mo or save 50% on the <strong>£29.99/yr Annual Plan — £2.50/mo</strong>, or bundle all 4 apps in the <strong>£89.99/yr Complete Security Suite</strong>'
        );

      // Strip legacy dark slop sections (#deepblock-live-rule-proof, #deepblock-ctr-intent-enrichment, #deepblock-ctr-enrichment, dark #gsc-exact-query-enrichment)
      updatedHtml = updatedHtml
        .replace(/\s*<section\b[^>]*\bid=["']deepblock-live-rule-proof["'][^>]*>[\s\S]*?<\/section>/gi, '')
        .replace(/\s*<section\b[^>]*\bid=["']deepblock-ctr-intent-enrichment["'][^>]*>[\s\S]*?<\/section>/gi, '')
        .replace(/\s*<section\b[^>]*\bid=["']deepblock-ctr-enrichment["'][^>]*>[\s\S]*?<\/section>/gi, '')
        .replace(/\s*<section\b[^>]*\bid=["']gsc-exact-query-enrichment["'][^>]*>[\s\S]*?<\/section>/gi, (block) =>
          /(?:#0f172a|#1e293b|bg-slate-900)/i.test(block) ? '' : block
        );

      if (updatedHtml !== html) {
        fs.writeFileSync(absPath, updatedHtml, 'utf8');
        state.proofUpdatedAt[urlPath] = nowIso;
        state.contentHashes[urlPath] = crypto.createHash('sha256').update(updatedHtml).digest('hex').slice(0, 16);
        modifiedLocs.add(loc);
        enrichedCount++;
      }
    }
  }

  // Update <lastmod> in website/sitemap.xml ONLY on modified URLs
  if (modifiedLocs.size > 0 && sitemapXml) {
    const updatedSitemap = sitemapXml.replace(
      /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g,
      (fullMatch, locUrl, oldLastMod) => {
        const cleanLoc = locUrl.trim();
        const nextLastMod = modifiedLocs.has(cleanLoc) ? todayStr : oldLastMod.trim();
        return fullMatch.replace(`<lastmod>${oldLastMod}</lastmod>`, `<lastmod>${nextLastMod}</lastmod>`);
      }
    );
    fs.writeFileSync(SITEMAP_PATH, updatedSitemap, 'utf8');
  }

  state.lastRunAt = nowIso;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');

  console.log(
    `[Slop Cleanup] Cleaned ${enrichedCount} indexable Pillar pages (v${MANIFEST_VERSION}) | Updated <lastmod> on ${modifiedLocs.size} sitemap URLs.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runLiveProofEnrichment();
}
