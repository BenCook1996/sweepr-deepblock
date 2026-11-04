#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Automated Transactional Keyword Research & Low-Competition Opportunity Engine
 * (`scripts/keyword-research-engine.mjs`)
 *
 * Zero-cost (£0.00) 5-Layer Organic Growth & Keyword Discovery Pipeline:
 *  1. Multi-Engine Autocomplete Discovery & Mathematical VolumeScore (0–100):
 *     - Queries live Google Chrome Autocomplete (15 slots + google:suggestrelevance),
 *       YouTube Autocomplete (15 slots + suggestrelevance), Bing OSJson (en-GB), and DuckDuckGo (uk-en)
 *       across a 6-Pillar Hierarchical Seed Matrix with 24h persistent disk caching.
 *  2. 2-Stage Transactional & Commercial Buyer-Intent Classifier (TransactionalScore 0–100):
 *     - Stage 1 Hard Junk Gatekeeper: Rejects closed TV/console OS hardware (Roku, Firestick, Apple TV),
 *       piracy/warez, NSFW, APK mods, coding syntax, third-party navigational domains, and dictionary lookups.
 *     - Stage 2 Weighted Lexical & Synergy Scoring + 5-Tier Intent Routing (/vs/*, /solutions/*, /setup/*, /guides/*).
 *  3. Unified 485-URL Corpus IDF Semantic Anti-Cannibalization & Intra-Batch Clustering:
 *     - Reads BOTH website/sitemap.xml and website/sitemap-sites.xml + HTML <title>/<h1> tokens.
 *     - Computes IDF-weighted Cosine, Slug Containment, and Jaccard similarity.
 *     - Routes net-new intents (<0.55 overlap) to APPROVED_NEW_PILLAR and near-matches (0.55–0.72) to
 *       APPROVED_CTR_SURGERY_EXISTING_PILLAR. Clusters intra-batch synonyms into secondaryKeywords[].
 *  4. 3-Tier Live SERP Weak-Spot / Low-Competition Scorer (LowCompetitionScore 0–100):
 *     - 7-day disk cache -> DuckDuckGo Lite HTML SERP -> Bing Organic RSS -> Deterministic Lexical Heuristic.
 *     - Scores UGC/Forum Top-5 presence (+25), Title Exact-Match Gap (+25), Stale Year Gap (+20),
 *       Long-Tail Specificity (+15), and High-DR Editorial Wall Penalty (-35).
 *  5. 5-Gate Non-Compensatory Admission & Page Blueprint Synthesis:
 *     - Writes `data/keyword-opportunity-matrix.json` and `data/seo-intent-gaps.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CACHE_DIR = path.join(DATA_DIR, '.cache');

const SITEMAP_MAIN_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const SITEMAP_SITES_PATH = path.join(WEBSITE_DIR, 'sitemap-sites.xml');
const AUTOCOMPLETE_CACHE_PATH = path.join(CACHE_DIR, 'autocomplete-cache.json');
const SERP_CACHE_PATH = path.join(DATA_DIR, 'serp-weakspot-cache.json');
const MATRIX_OUTPUT_PATH = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
const LEGACY_GAPS_OUTPUT_PATH = path.join(DATA_DIR, 'seo-intent-gaps.json');
const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');

const AUTOCOMPLETE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SERP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// 1. 6-PILLAR HIERARCHICAL SEED MATRIX
// ============================================================================
export const PILLAR_SEED_MATRIX = [
  {
    pillarId: 'P1_COMMERCIAL_SWITCHER',
    name: 'Commercial Switcher & Renewal Shock',
    funnelStage: 'BOFU',
    defaultCpcGbp: 0.65,
    engines: ['google', 'bing', 'ddg'],
    entities: [
      'total adblock',
      'adblock plus',
      'ublock origin lite',
      'ublock origin',
      'pie adblock',
      'adguard extension',
      'ghostery',
      'stands adblocker',
      '1blocker',
      'wipr adblock',
      'brave shields',
      'privacy badger'
    ],
    modifiers: ['alternative', 'vs', 'renewal price', 'cancel', 'not working', 'chrome manifest v3'],
    directSeeds: [
      'total adblock renewal charge alternative',
      'best manifest v3 adblocker vs ublock origin lite',
      'adblock without acceptable ads whitelist',
      'pie adblock safe or scam alternative',
      'switch from adblock plus to manifest v3',
      'adguard vs ublock origin lite chrome 2026',
      'lightweight alternative to ghostery chrome'
    ]
  },
  {
    pillarId: 'P2_MV3_PLATFORM_BLOCKING',
    name: 'Manifest V3 & Platform Ad Blocking',
    funnelStage: 'BOFU_MOFU',
    defaultCpcGbp: 0.55,
    engines: ['google', 'youtube', 'bing', 'ddg'],
    entities: [
      'youtube adblock',
      'twitch purple screen',
      'twitch adblock',
      'crunchyroll ads',
      'spotify web player ads',
      'chrome manifest v3 adblocker',
      'kick stream ads',
      'itvx ads browser',
      'channel 4od ads chrome',
      'fandom wiki video ads',
      'reddit promoted posts blocker'
    ],
    modifiers: ['2026', 'chrome', 'edge', 'firefox', 'safari', 'fix', 'extension'],
    directSeeds: [
      'manifest v3 adblocker that blocks youtube ads',
      'block youtube pre roll ads chrome 2026',
      'stop twitch mid roll ads without purple screen',
      'block crunchyroll video ads chrome extension',
      'block fandom autoplay sidebar videos chrome',
      'best adblocker for thorium browser',
      'best adblocker for floorp browser',
      'best adblocker for zen browser',
      'best adblocker for arc browser windows'
    ]
  },
  {
    pillarId: 'P3_URGENT_TROUBLESHOOTING',
    name: 'Urgent Anti-Adblock & Troubleshooting',
    funnelStage: 'MOFU_URGENT',
    defaultCpcGbp: 0.45,
    engines: ['google', 'youtube', 'bing', 'ddg'],
    entities: [
      'ad blocker not working on',
      'why am i still seeing ads on',
      'bypass adblock detection on',
      'adblock stopped working on',
      'stop pop up redirects on'
    ],
    modifiers: [
      'youtube chrome',
      'twitch 2026',
      'safari mac',
      'microsoft edge',
      'crunchyroll',
      'fandom',
      'forbes',
      'dailymail',
      'hulu web'
    ],
    directSeeds: [
      'adblock not working after chrome manifest v3 update',
      'youtube experiencing interruptions adblock fix',
      'twitch error 2000 adblocker fix chrome',
      'how to test if manifest v3 adblocker is working'
    ]
  },
  {
    pillarId: 'P4_COOKIE_CONSENT_GDPR',
    name: 'Cookie Consent & GDPR Auto-Reject',
    funnelStage: 'MOFU',
    defaultCpcGbp: 0.50,
    engines: ['google', 'bing', 'ddg'],
    entities: [
      'auto reject cookie popups',
      'onetrust cookie popup blocker',
      'didomi cookie banner blocker',
      'cookie banner scroll lock fix',
      'sourcepoint cookie consent reject',
      'usercentrics cookie popup blocker',
      'quantcast cookie consent auto reject',
      'trustarc cookie banner blocker'
    ],
    modifiers: ['chrome extension', 'uk', 'automatically', 'without breaking scroll'],
    directSeeds: [
      'automatically click reject all on cookie banners chrome',
      'cookie blocker broke page scrolling fix',
      'stop gdpr cookie walls on uk news sites',
      'auto reject legitimate interest cookies extension'
    ]
  },
  {
    pillarId: 'P5_SCAM_STORE_REVIEW_SHIELD',
    name: 'Scam Store & Fake Review Protection',
    funnelStage: 'TOFU_MOFU',
    defaultCpcGbp: 0.45,
    engines: ['google', 'bing', 'ddg'],
    entities: [
      'fake shopify store detector',
      'scam website checker extension',
      'check if online shop is legit',
      'fake clearance store detector',
      'facebook ad scam store checker',
      'hide ai slop google search'
    ],
    modifiers: ['uk', 'chrome extension', 'free tool', '2026'],
    directSeeds: [
      'chrome extension to detect fake online stores',
      'how to spot a fake dropshipping website uk',
      'remove sponsored links and ai slop from google search',
      'check domain age and scam score online shop'
    ]
  },
  {
    pillarId: 'P6_BROWSER_RAM_TAB_TAMER',
    name: 'Browser RAM & Tab Hibernation',
    funnelStage: 'MOFU',
    defaultCpcGbp: 0.40,
    engines: ['google', 'bing', 'ddg'],
    entities: [
      'chrome using too much ram',
      'hibernate background tabs chrome',
      'adblocker high cpu usage fix',
      'browser tabs crashing out of memory',
      'reduce microsoft edge memory usage',
      'macbook safari chrome battery drain ads'
    ],
    modifiers: ['fix', 'extension', 'windows 11', 'macbook'],
    directSeeds: [
      'adblocker with built in tab suspender',
      'reduce chrome ram usage from ad trackers',
      'stop news websites freezing browser tabs',
      'lightweight manifest v3 adblocker low memory'
    ]
  }
];

// ============================================================================
// 2. STAGE 1 HARD JUNK & ZERO-CONVERSION GATEKEEPER
// ============================================================================
const JUNK_FILTERS = [
  {
    reason: 'piracy_or_warez',
    regex: /\b(crack|cracked|keygen|serial\s*key|pirate|torrent|1337x|piratebay|fitgirl|nulled|warez|patcher|free\s+premium\s+account|hack\s+tool)\b/i
  },
  {
    reason: 'nsfw_adult',
    regex: /\b(porn|pornhub|xxx|sex|hentai|xvideos|xnxx|nsfw|onlyfans|chaturbate|stripchat|rule34|nhentai|erome)\b/i
  },
  {
    reason: 'mobile_apk_mod_or_sideload',
    regex: /\b(revanced|vanced|mod\s*apk|apk\s*mod|lucky\s*patcher|happymod|sideload|ipa\s+download|trollstore|altstore|jailbreak|magisk|xposed|root\s+android|unlocked\s+apk)\b/i
  },
  {
    reason: 'unsupported_closed_hardware_tv_console',
    test: (q) =>
      /\b(roku|firestick|fire\s+tv|apple\s+tv|chromecast|ps4|ps5|playstation|xbox|nintendo\s+switch|lg\s+tv|samsung\s+tv|vizio\s+tv|hisense\s+tv|kodi)\b/i.test(q) &&
      !/\b(browser|web|chrome|firefox|edge|safari|pc|laptop)\b/i.test(q)
  },
  {
    reason: 'unrelated_gaming_or_software',
    regex: /\b(minecraft\s+server|fortnite|valorant|genshin|call\s+of\s+duty|warzone|gta\s*5|sims\s*4|aimbot|wallhack|cheat\s+engine|roblox\s+executor|script\s+executor)\b/i
  },
  {
    reason: 'coding_or_developer_syntax',
    regex: /\b(javascript\s+code|python\s+script|selenium|puppeteer|playwright|beautifulsoup|how\s+to\s+code|build\s+an\s+adblocker|manifest\.json\s+tutorial|regex\s+syntax|npm\s+install|react\s+component|css\s+selector\s+tutorial)\b/i
  },
  {
    reason: 'third_party_navigational_domain',
    regex: /\b(dnsleaktest\.com|dnsleaktest\s+(v6|extended|safe|org)|downdetector|speedtest\.net\s+login|virustotal\.com|scamadviser\.com|trustpilot\.com\s+login)\b/i
  },
  {
    reason: 'non_latin_or_regional_transliteration',
    regex: /[^\x00-\x7F£€]|\b(kaise|kare|kiya|nahi|tamil|telugu|hindi|bangla|malayalam|urdu|pashto|tagalog)\b/i
  },
  {
    reason: 'zero_conversion_definitional_informational',
    regex: /^(what\s+is\s+an?\s+|what\s+does\s+.*?\s+mean|who\s+invented|who\s+owns|history\s+of|definition\s+of|meaning\s+of|wikipedia\b)|(\b(meaning|explained|definition|essay|wikipedia|stock\s+price|net\s+worth|headquarters|careers|jobs|salary)\b)$/i
  }
];

export function evaluateJunkFilter(query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 10 || q.split(/\s+/).length < 3) {
    return { isJunk: true, reason: 'too_short_or_broad_head_term' };
  }
  for (const rule of JUNK_FILTERS) {
    if (typeof rule.test === 'function') {
      if (rule.test(q)) return { isJunk: true, reason: rule.reason };
    } else if (rule.regex && rule.regex.test(q)) {
      return { isJunk: true, reason: rule.reason };
    }
  }
  return { isJunk: false, reason: null };
}

// ============================================================================
// 3. LEXICAL CANONICALIZER & IDF SEMANTIC ANTI-CANNIBALIZATION ENGINE
// ============================================================================
const STOPWORDS = new Set([
  'how', 'why', 'what', 'when', 'where', 'who', 'which', 'does', 'do', 'did',
  'is', 'are', 'am', 'was', 'were', 'can', 'could', 'will', 'would', 'should',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these', 'those', 'my',
  'your', 'our', 'their', 'his', 'her', 'its', 'on', 'in', 'to', 'of', 'at',
  'by', 'into', 'onto', 'upon', 'out', 'off', 'up', 'down', 'over', 'under',
  'still', 'anymore', 'getting', 'seeing', 'keep', 'keeps', 'way', 'best',
  'top', 'good', 'great', 'new', 'use', 'using', 'used', 'work', 'works',
  'working', 'make', 'makes', 'making', 'get', 'gets', 'got', 'all', 'any',
  'some', 'more', 'most', 'less', 'least', 'very', 'too', 'much', 'many',
  '2023', '2024', '2025', '2026', '2027', 'uk', 'us', 'usa', 'gb'
]);

const PROTECTED_STEM_TOKENS = new Set([
  'forbes', 'twitch', 'reddit', 'windows', 'macos', 'ios', 'chrome', 'edge',
  'firefox', 'safari', 'brave', 'opera', 'vivaldi', 'thorium', 'floorp',
  'orion', 'ublock', 'ublocklite', 'adblock', 'adblockplus', 'adguard',
  'ghostery', 'onetrust', 'didomi', 'sourcepoint', 'usercentrics', 'quantcast',
  'trustarc', 'youtube', 'crunchyroll', 'spotify', 'fandom', 'hulu', 'itvx',
  'cookies', 'cookie', 'scam', 'shop', 'shopify', 'virus', 'dns', 'webrtc',
  'canvas', 'ram', 'cpu'
]);

export function canonicalizeIntentTokens(rawText) {
  let s = String(rawText || '').toLowerCase();
  // Normalize compound domain synonyms first
  s = s
    .replace(/\bad[\s-]*block(?:er|ers|ing)?\b/g, ' adblock ')
    .replace(/\bpop[\s-]*ups?\b/g, ' popup ')
    .replace(/\bpop[\s-]*unders?\b/g, ' popunder ')
    .replace(/\bmanifest[\s-]*v3\b|\bmv3\b/g, ' mv3 ')
    .replace(/\bublock[\s-]*origin[\s-]*lite\b|\bubolite\b/g, ' ublocklite ')
    .replace(/\bublock[\s-]*origin\b|\bubo\b/g, ' ublock ')
    .replace(/\badblock[\s-]*plus\b|\babp\b/g, ' adblockplus ')
    .replace(/\btotal[\s-]*adblock\b/g, ' totaladblock ')
    .replace(/\bpie[\s-]*adblock\b/g, ' pieadblock ')
    .replace(/\bstands[\s-]*adblocker\b/g, ' stands ')
    .replace(/\bnot[\s-]+working\b|\bstopped[\s-]+working\b|\bbroken\b|\bfails?\b/g, ' notworking ')
    .replace(/\bmemory\b/g, ' ram ')
    .replace(/\bprocessor\b/g, ' cpu ')
    .replace(/\bcookie[\s-]+(?:banner|popup|wall|consent|popups|banners)s?\b/g, ' cookiebanner ')
    .replace(/\blegitimate\b/g, ' legit ')
    .replace(/\bpre[\s-]*rolls?\b/g, ' preroll ')
    .replace(/\bmid[\s-]*rolls?\b/g, ' midroll ')
    .replace(/\banti[\s-]*adblock\b/g, ' antiadblock ')
    .replace(/\bchannel[\s-]*4(?:od)?\b|\ball4\b/g, ' channel4 ')
    .replace(/\bmicrosoft[\s-]*edge\b/g, ' edge ')
    .replace(/\bgoogle[\s-]*chrome\b/g, ' chrome ')
    .replace(/\bads\b|\badvertisements?\b|\bcommercials?\b/g, ' ad ');

  const rawWords = s
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tokens = [];
  const seen = new Set();

  for (let w of rawWords) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    if (!PROTECTED_STEM_TOKENS.has(w) && w.length >= 5) {
      if (w.endsWith('ing') && w.length > 6) w = w.slice(0, -3);
      else if (w.endsWith('tion') && w.length > 6) w = w.slice(0, -4);
      else if (w.endsWith('ment') && w.length > 6) w = w.slice(0, -4);
      else if (w.endsWith('ies') && w.length > 5) w = w.slice(0, -3) + 'y';
      else if (w.endsWith('ers') && w.length > 5) w = w.slice(0, -3);
      else if (w.endsWith('es') && w.length > 5) w = w.slice(0, -2);
      else if (w.endsWith('ed') && w.length > 5) w = w.slice(0, -2);
      else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    }
    if (w === 'cookies') w = 'cookie';
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    if (!seen.has(w)) {
      seen.add(w);
      tokens.push(w);
    }
  }

  const sorted = tokens.slice().sort();
  return {
    tokens,
    tokenSet: new Set(tokens),
    fingerprint: sorted.join('|')
  };
}

export function loadUnifiedIndexableCorpus() {
  const urls = new Set();
  for (const sitemapFile of [SITEMAP_MAIN_PATH, SITEMAP_SITES_PATH]) {
    if (!fs.existsSync(sitemapFile)) continue;
    const xml = fs.readFileSync(sitemapFile, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.add(m[1].trim());
    }
  }

  const pages = [];
  const dfMap = new Map();

  for (const loc of urls) {
    let pathname = '/';
    try {
      pathname = new URL(loc).pathname;
    } catch {
      continue;
    }
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const relHtml = cleanPath === '/' ? 'index.html' : `${cleanPath.replace(/^\//, '')}.html`;
    const fullHtmlPath = path.join(WEBSITE_DIR, relHtml);

    let titleText = '';
    let h1Text = '';
    if (fs.existsSync(fullHtmlPath)) {
      try {
        const html = fs.readFileSync(fullHtmlPath, 'utf8');
        const tMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        titleText = tMatch ? tMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';
        h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, ' ').trim() : '';
      } catch {}
    }

    const slugCanon = canonicalizeIntentTokens(cleanPath.replace(/\//g, ' '));
    const combinedCanon = canonicalizeIntentTokens(`${cleanPath.replace(/\//g, ' ')} ${titleText} ${h1Text}`);

    for (const t of combinedCanon.tokenSet) {
      dfMap.set(t, (dfMap.get(t) || 0) + 1);
    }

    pages.push({
      url: loc,
      pathname: cleanPath,
      relPath: relHtml,
      title: titleText,
      h1: h1Text,
      slugTokens: slugCanon.tokens,
      slugTokenSet: slugCanon.tokenSet,
      slugFingerprint: slugCanon.fingerprint,
      combinedTokens: combinedCanon.tokens,
      combinedTokenSet: combinedCanon.tokenSet
    });
  }

  const N = Math.max(1, pages.length);
  const idf = (token) => {
    const df = dfMap.get(token) || 0;
    return Math.log(1 + N / (1 + df));
  };

  return { pages, totalIndexableCount: pages.length, idf };
}

export function evaluateCorpusCannibalization(queryCanon, suggestedRoute, corpus) {
  const { pages, idf } = corpus;
  const qTokens = queryCanon.tokens;
  if (qTokens.length === 0) {
    return {
      status: 'EXACT_SLUG_COLLISION',
      maxCannibScore: 1,
      tokenOverlapRatio: 1,
      jaccardSimilarity: 1,
      closestExistingUrl: '/',
      closestExistingTitle: 'Home'
    };
  }

  let qIdfSum = 0;
  let qIdfSqSum = 0;
  for (const t of qTokens) {
    const w = idf(t);
    qIdfSum += w;
    qIdfSqSum += w * w;
  }

  let bestScore = 0;
  let bestSlugContainment = 0;
  let bestJaccard = 0;
  let bestPage = null;

  for (const page of pages) {
    if (page.pathname === suggestedRoute || (page.slugFingerprint && page.slugFingerprint === queryCanon.fingerprint)) {
      return {
        status: 'EXACT_SLUG_COLLISION',
        maxCannibScore: 1.0,
        tokenOverlapRatio: 1.0,
        jaccardSimilarity: 1.0,
        closestExistingUrl: page.pathname,
        closestExistingTitle: page.title
      };
    }

    // 1. IDF Cosine against combinedTokens
    let dotCombined = 0;
    let pIdfSqSum = 0;
    for (const pt of page.combinedTokenSet) {
      const pw = idf(pt);
      pIdfSqSum += pw * pw;
      if (queryCanon.tokenSet.has(pt)) {
        dotCombined += pw * pw;
      }
    }
    const cosIdf = qIdfSqSum > 0 && pIdfSqSum > 0 ? dotCombined / (Math.sqrt(qIdfSqSum) * Math.sqrt(pIdfSqSum)) : 0;

    // 2. IDF Containment & Jaccard against slugTokenSet
    let slugMatchedIdf = 0;
    let slugIntersectCount = 0;
    for (const qt of qTokens) {
      if (page.slugTokenSet.has(qt)) {
        slugMatchedIdf += idf(qt);
        slugIntersectCount++;
      }
    }
    const slugContainmentIdf = qIdfSum > 0 ? slugMatchedIdf / qIdfSum : 0;
    const unionSize = qTokens.length + page.slugTokenSet.size - slugIntersectCount;
    const jaccardSlug = unionSize > 0 ? slugIntersectCount / unionSize : 0;

    const cannibScore = 0.45 * cosIdf + 0.35 * slugContainmentIdf + 0.20 * jaccardSlug;

    if (cannibScore > bestScore) {
      bestScore = cannibScore;
      bestSlugContainment = slugContainmentIdf;
      bestJaccard = jaccardSlug;
      bestPage = page;
    }
  }

  let status = 'NEW_PAGE_OPPORTUNITY';
  if (bestScore >= 0.68 || bestSlugContainment >= 0.82) {
    status = 'COVERED_BY_EXISTING_PILLAR';
  }

  return {
    status,
    maxCannibScore: +bestScore.toFixed(3),
    tokenOverlapRatio: +bestSlugContainment.toFixed(3),
    jaccardSimilarity: +bestJaccard.toFixed(3),
    closestExistingUrl: bestPage ? bestPage.pathname : null,
    closestExistingTitle: bestPage ? bestPage.title : null
  };
}

// ============================================================================
// 4. STAGE 2 TRANSACTIONAL & COMMERCIAL BUYER-INTENT CLASSIFIER (0-100)
// ============================================================================
const INTENT_SIGNALS = [
  {
    id: 'POS_BUY_COMMERCIAL',
    weight: 32,
    regex: /\b(buy|price|pricing|cost|subscription|annual|lifetime|pro|premium|license|discount|deal|coupon|worth\s+it|paid|cheap|affordable|bundle)\b/i
  },
  {
    id: 'POS_SWITCHER_ALT',
    weight: 30,
    regex: /\b(vs|versus|alternative|alternatives|replacement|replace|switch\s+from|better\s+than|instead\s+of|compare|comparison|cancel|renewal|auto\s*renewal|overcharged|refund|charge)\b/i
  },
  {
    id: 'POS_DIAGNOSTIC_TOOL',
    weight: 28,
    regex: /\b(test|tester|check|checker|benchmark|verify|is\s+my\s+ad\s*blocker\s+working|adblock\s+test|dns\s+leak|fingerprint|webrtc\s+leak|canvas|is\s+.*?\s+(legit|scam|safe|trustworthy)|scam\s+detector|fake\s+(shop|store|website|review))\b/i
  },
  {
    id: 'POS_URGENT_PAIN_FIX',
    weight: 25,
    regex: /\b(not\s+working|stopped\s+working|anymore|broken|bypass|detected|anti\s*adblock|warning|modal|popup\s+blocker|purple\s+screen|black\s+screen|error\s+2000|experiencing\s+interruptions|slowing\s+down|high\s+(ram|cpu|memory)|too\s+much\s+(ram|memory|cpu)|scroll\s*lock|breaking\s+scroll|broke\s+page\s+scrolling|freezing)\b/i
  },
  {
    id: 'POS_COMPETITOR_BRAND',
    weight: 22,
    regex: /\b(total\s*adblock|adguard|ublock(\s+origin)?(\s+lite)?|adblock\s*plus|abp|ghostery|pie\s*adblock|stands(\s+adblocker)?|1blocker|wipr|adlock|nextdns|privacy\s*badger|brave\s*shields)\b/i
  },
  {
    id: 'POS_ACTION_INSTALL',
    weight: 18,
    regex: /\b(extension|add\s*on|plugin|for\s+(chrome|firefox|edge|safari|brave|opera|vivaldi|arc|orion|thorium|floorp|zen|kiwi|librewolf|ungoogled\s+chromium|windows\s*11|mac|macos|ios|iphone|ipad|android)|best\s+ad\s*blocker|best\s+manifest\s*v3)\b/i
  },
  {
    id: 'POS_CORE_MODULE_MATCH',
    weight: 16,
    regex: /\b(manifest\s*v3|mv3|youtube\s+ads|pre\s*roll|mid\s*roll|twitch\s+ads|crunchyroll\s+ads|spotify\s+web\s+ads|itvx\s+ads|channel\s*4od\s+ads|fandom\s+ads|reject\s+(all\s+)?cookies|cookie\s+(banner|popup|wall|consent)|onetrust|didomi|sourcepoint|usercentrics|quantcast|trustarc|ai\s+slop|sponsored\s+(posts|results|links)|tab\s+(suspender|hibernat)|ram\s+tamer)\b/i
  },
  {
    id: 'POS_YEAR_FRESHNESS',
    weight: 10,
    regex: /\b(2026|2027|after\s+chrome\s+update|new\s+chrome)\b/i
  }
];

export function scoreAndClassifyBuyerIntent(query, pillarId) {
  const junkCheck = evaluateJunkFilter(query);
  if (junkCheck.isJunk) {
    return {
      isJunk: true,
      disqualificationReason: junkCheck.reason,
      transactionalScore: 0,
      intentTier: 'rejected_junk',
      matchedSignals: [],
      cluster: null,
      recommendedFormat: null,
      targetRoute: null
    };
  }

  const q = String(query || '').trim().toLowerCase();
  let score = 30;
  const matchedIds = new Set();
  const matchedSignals = [];

  for (const sig of INTENT_SIGNALS) {
    if (sig.regex.test(q)) {
      score += sig.weight;
      matchedIds.add(sig.id);
      matchedSignals.push(`${sig.id} (+${sig.weight})`);
    }
  }

  // Synergy bonuses
  if (
    matchedIds.has('POS_COMPETITOR_BRAND') &&
    (matchedIds.has('POS_BUY_COMMERCIAL') || matchedIds.has('POS_SWITCHER_ALT') || matchedIds.has('POS_URGENT_PAIN_FIX'))
  ) {
    score += 10;
    matchedSignals.push('SYNERGY_COMPETITOR_SWITCH (+10)');
  }
  if (matchedIds.has('POS_ACTION_INSTALL') && matchedIds.has('POS_CORE_MODULE_MATCH')) {
    score += 8;
    matchedSignals.push('SYNERGY_INSTALL_MODULE (+8)');
  }

  // Negative modifiers
  if (
    /^(how\s+to|why\s+does|why\s+is)\b/i.test(q) &&
    !matchedIds.has('POS_ACTION_INSTALL') &&
    !matchedIds.has('POS_BUY_COMMERCIAL') &&
    !matchedIds.has('POS_COMPETITOR_BRAND') &&
    !matchedIds.has('POS_DIAGNOSTIC_TOOL') &&
    !matchedIds.has('POS_CORE_MODULE_MATCH')
  ) {
    score -= 25;
    matchedSignals.push('NEG_GENERIC_QUESTION (-25)');
  }
  if (/\b(free\s+forever|open\s+source\s+only|github\s+repo|hosts\s+file\s+txt|pihole\s+blocklist)\b/i.test(q)) {
    score -= 25;
    matchedSignals.push('NEG_NON_MONETIZABLE_DIY (-25)');
  }

  const transactionalScore = Math.max(0, Math.min(100, score));

  // Determine Intent Tier & Cluster Folder
  let intentTier = 'informational_low_value';
  let cluster = 'solutions';
  let recommendedFormat = 'platform_solution';

  const hasCompetitor = matchedIds.has('POS_COMPETITOR_BRAND');
  const hasSwitcher = matchedIds.has('POS_SWITCHER_ALT');
  const hasBuy = matchedIds.has('POS_BUY_COMMERCIAL');
  const hasTool = matchedIds.has('POS_DIAGNOSTIC_TOOL');
  const hasPain = matchedIds.has('POS_URGENT_PAIN_FIX');
  const isBrowserSetupQuery =
    /\b(for\s+(chrome|firefox|edge|safari|brave|opera|vivaldi|arc|orion|thorium|floorp|zen|kiwi|librewolf|ungoogled\s+chromium|windows\s*11|mac|macos|ios|iphone)|thorium\s+browser|floorp\s+browser|zen\s+browser|arc\s+browser|orion\s+browser)\b/i.test(q) &&
    !hasCompetitor;

  if ((hasBuy || (hasCompetitor && /\b(renewal|cancel|price|cost|charge|refund|worth)\b/i.test(q))) && transactionalScore >= 72) {
    intentTier = 'transactional_purchase';
    if (hasCompetitor || hasSwitcher) {
      cluster = 'vs';
      recommendedFormat = 'competitor_comparison';
    } else if (isBrowserSetupQuery) {
      cluster = 'setup';
      recommendedFormat = 'browser_setup_guide';
    } else {
      cluster = 'solutions';
      recommendedFormat = 'platform_solution';
    }
  } else if ((hasSwitcher || hasCompetitor) && transactionalScore >= 68) {
    intentTier = 'commercial_switcher';
    cluster = 'vs';
    recommendedFormat = 'competitor_comparison';
  } else if (hasTool && transactionalScore >= 66) {
    intentTier = 'diagnostic_tool_intent';
    // Route indexable programmatic guides/solutions around diagnostics to /guides or /solutions so they integrate with Pillar templates
    cluster = /\b(scam|shop|store|legit|shopify|clearance)\b/i.test(q) ? 'solutions' : 'guides';
    recommendedFormat = 'interactive_tool';
  } else if (transactionalScore >= 65 && (hasPain || matchedIds.has('POS_CORE_MODULE_MATCH') || matchedIds.has('POS_ACTION_INSTALL'))) {
    intentTier = 'high_urgency_fix';
    if (isBrowserSetupQuery) {
      cluster = 'setup';
      recommendedFormat = 'browser_setup_guide';
    } else if (/\b(not\s+working|stopped\s+working|error\s+2000|experiencing\s+interruptions|how\s+to|fix|broke)\b/i.test(q)) {
      cluster = 'guides';
      recommendedFormat = 'troubleshooting_guide';
    } else {
      cluster = 'solutions';
      recommendedFormat = 'platform_solution';
    }
  }

  const slug = q
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 62)
    .replace(/-+$/g, '');

  const targetRoute = `/${cluster}/${slug}`;
  const relPath = `${cluster}/${slug}.html`;

  return {
    isJunk: false,
    disqualificationReason: null,
    transactionalScore,
    intentTier,
    matchedSignals,
    cluster,
    recommendedFormat,
    targetRoute,
    relPath,
    pillarId
  };
}

// ============================================================================
// 5. LAYER 1: MULTI-ENGINE AUTOCOMPLETE HARVESTER & VOLUMESCORE (0-100)
// ============================================================================
function loadJsonFileSafe(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJsonFileSafe(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function fetchAutocompleteFromEngine(engine, seed, cacheObj, forceFresh = false) {
  const cacheKey = crypto.createHash('sha1').update(`${engine}:gb:${seed.toLowerCase()}`).digest('hex');
  const now = Date.now();
  const cached = cacheObj[cacheKey];
  if (!forceFresh && cached && now - cached.ts < AUTOCOMPLETE_TTL_MS && Array.isArray(cached.items)) {
    return cached.items;
  }

  let items = [];
  try {
    if (engine === 'google' || engine === 'youtube') {
      const dsParam = engine === 'youtube' ? '&ds=yt' : '';
      const url = `https://suggestqueries.google.com/complete/search?client=chrome${dsParam}&hl=en&gl=gb&q=${encodeURIComponent(seed)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions = Array.isArray(data?.[1]) ? data[1] : [];
        const relevances = Array.isArray(data?.[4]?.['google:suggestrelevance'])
          ? data[4]['google:suggestrelevance']
          : [];
        items = suggestions.map((text, idx) => ({
          text: String(text || '').trim().toLowerCase(),
          rank: idx + 1,
          relevance: typeof relevances[idx] === 'number' ? relevances[idx] : null
        }));
      }
    } else if (engine === 'bing') {
      const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(seed)}&market=en-GB`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/131.0.0.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions = Array.isArray(data?.[1]) ? data[1] : [];
        items = suggestions.map((text, idx) => ({
          text: String(text || '').trim().toLowerCase(),
          rank: idx + 1,
          relevance: null
        }));
      }
    } else if (engine === 'ddg') {
      const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(seed)}&type=list&kl=uk-en`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data?.[1])
          ? data[1]
          : Array.isArray(data)
            ? data.map((x) => x?.phrase).filter(Boolean)
            : [];
        items = rawList.map((text, idx) => ({
          text: String(text || '').trim().toLowerCase(),
          rank: idx + 1,
          relevance: null
        }));
      }
    }
  } catch {
    items = cached?.items || [];
  }

  items = items.filter((x) => x.text && x.text.length >= 6);
  if (items.length > 0) {
    cacheObj[cacheKey] = { ts: now, engine, seed, items };
  }
  return items;
}

export function calculateVolumeScore(record) {
  const ENGINE_WEIGHTS = { google: 1.0, youtube: 0.92, bing: 0.88, ddg: 0.85 };
  const engines = Object.keys(record.bestRankByEngine);
  if (engines.length === 0) {
    return {
      volumeScore: 48,
      slotAnchorScore: 36,
      engineConsensusScore: 0,
      modifierDepthScore: 12
    };
  }

  const strengths = [];
  for (const eng of engines) {
    const r = record.bestRankByEngine[eng] || 10;
    const alpha = ENGINE_WEIGHTS[eng] || 0.85;
    const wSlot = Math.exp(-0.16 * (r - 1));
    const rel = record.bestRelevanceByEngine[eng];
    const bRel = typeof rel === 'number' ? 0.15 * Math.max(0, Math.min(1, (rel - 500) / 800)) : 0;
    const s = Math.min(1.0, alpha * wSlot + bRel);
    strengths.push(s);
  }

  const maxStrength = Math.max(...strengths);
  const meanStrength = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  const slotAnchorScore = +(55 * maxStrength).toFixed(1);

  const k = Math.min(4, engines.length);
  const engineConsensusScore =
    k > 1 ? +(30 * Math.pow((k - 1) / 3, 0.85) * (0.5 + 0.5 * meanStrength)).toFixed(1) : 0;

  const baseDepthPts = record.minDepth === 0 ? 12 : record.minDepth === 1 ? 8 : 3;
  const modifierDepthScore = Math.min(15, baseDepthPts + Math.min(3, Math.max(0, record.seedCount - 1)));

  const volumeScore = Math.max(
    1,
    Math.min(100, Math.round(slotAnchorScore + engineConsensusScore + modifierDepthScore))
  );

  return {
    volumeScore,
    slotAnchorScore,
    engineConsensusScore,
    modifierDepthScore
  };
}

// ============================================================================
// 6. LAYER 3: 3-TIER RESILIENT LIVE SERP WEAK-SPOT SCORER (0-100)
// ============================================================================
const UGC_FORUM_DOMAIN_RE =
  /(^|\.)(reddit\.com|quora\.com|superuser\.com|stackoverflow\.com|stackexchange\.com|askubuntu\.com|community\.brave\.com|linustechtips\.com|news\.ycombinator\.com|forums\.macrumors\.com|tenforums\.com|elevenforum\.com)$/i;

const UGC_URL_PATH_RE =
  /(support\.google\.com\/chrome\/thread|support\.mozilla\.org\/[^/]+\/questions|answers\.microsoft\.com\/|discussions\.apple\.com\/thread|github\.com\/[^/]+\/[^/]+\/(issues|discussions)\/)/i;

const HIGH_DR_EDITORIAL_DOMAINS = new Set([
  'pcmag.com',
  'techradar.com',
  'tomsguide.com',
  'nytimes.com',
  'cnet.com',
  'forbes.com',
  'zdnet.com',
  'theverge.com',
  'wired.com',
  'lifewire.com',
  'howtogeek.com',
  'cybernews.com',
  'security.org',
  'pcworld.com',
  'macworld.com'
]);

const STALE_SERP_RE = /\b(2019|2020|2021|2022|2023|2024|manifest\s*v2|mv2)\b/i;

async function fetchLiveBingRssSerp(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-GB&cc=GB&format=rss`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const results = [];
    for (const m of items.slice(0, 6)) {
      const block = m[1];
      const title = ((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim();
      const link = ((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
      const snippet = ((block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (!link || !title) continue;
      let domain = '';
      try {
        domain = new URL(link).hostname.replace(/^www\./i, '').toLowerCase();
      } catch {
        continue;
      }
      results.push({ rank: results.length + 1, url: link, domain, title, snippet });
      if (results.length >= 5) break;
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchLiveDdgHtmlSerp(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=uk-en`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.includes('anomaly-modal') || html.includes('cc=botnet')) return [];
    const linkMatches = [...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const results = [];
    for (const m of linkMatches) {
      let rawHref = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (rawHref.includes('y.js') || rawHref.includes('ad_provider')) continue;
      if (rawHref.includes('uddg=')) {
        try {
          const parsed = new URL(rawHref, 'https://html.duckduckgo.com');
          rawHref = decodeURIComponent(parsed.searchParams.get('uddg') || rawHref);
        } catch {}
      }
      let domain = '';
      try {
        domain = new URL(rawHref).hostname.replace(/^www\./i, '').toLowerCase();
      } catch {
        continue;
      }
      results.push({ rank: results.length + 1, url: rawHref, domain, title, snippet: '' });
      if (results.length >= 5) break;
    }
    return results;
  } catch {
    return [];
  }
}

export async function evaluateSerpWeakSpotScore(query, queryCanon, serpCache, allowLiveNetwork = true) {
  const qNorm = String(query || '').trim().toLowerCase();
  const now = Date.now();
  const cached = serpCache[qNorm];
  if (cached && now - cached.ts < SERP_CACHE_TTL_MS && typeof cached.lowCompetitionScore === 'number') {
    return cached;
  }

  let top5 = [];
  let source = 'lexical_heuristic_fallback';

  if (allowLiveNetwork) {
    top5 = await fetchLiveBingRssSerp(qNorm);
    if (top5.length >= 3) {
      source = 'bing_rss_live';
    } else {
      const ddgResults = await fetchLiveDdgHtmlSerp(qNorm);
      if (ddgResults.length >= 3) {
        top5 = ddgResults;
        source = 'ddg_html_live';
      }
    }
  }

  const wordCount = qNorm.split(/\s+/).length;
  const hasSpecificityModifier =
    /\b(total\s*adblock|adguard|ublock|pie\s*adblock|ghostery|adblock\s*plus|stands|1blocker|wipr|thorium|floorp|zen|arc|orion|kiwi|vivaldi|brave|youtube|twitch|crunchyroll|spotify|itvx|channel\s*4|fandom|onetrust|didomi|sourcepoint|usercentrics|quantcast|trustarc|shopify|manifest\s*v3|mv3|purple\s+screen|error\s+2000|scroll\s*lock|renewal|ram|cpu|scam|legit)\b/i.test(
      qNorm
    );

  let ugcPoints = 0;
  let titleGapPoints = 0;
  let freshnessGapPoints = 0;
  let longTailPoints = 0;
  let editorialWallPenalty = 0;
  const ugcMatchedUrls = [];
  const editorialDomainsFound = [];

  if (wordCount >= 4 && wordCount <= 9 && hasSpecificityModifier) {
    longTailPoints = 15;
  } else if (wordCount === 3 && hasSpecificityModifier) {
    longTailPoints = 8;
  }

  if (top5.length >= 3) {
    // Live SERP Evaluation
    let exactTitleMatchCount = 0;
    let staleCount = 0;
    let fresh2026Count = 0;

    for (const item of top5) {
      if (UGC_FORUM_DOMAIN_RE.test(item.domain) || UGC_URL_PATH_RE.test(item.url)) {
        ugcMatchedUrls.push(item.url);
      }
      if (HIGH_DR_EDITORIAL_DOMAINS.has(item.domain)) {
        editorialDomainsFound.push(item.domain);
      }

      const itemCanon = canonicalizeIntentTokens(item.title);
      const allCoreMatched = queryCanon.tokens.every((t) => itemCanon.tokenSet.has(t));
      if (allCoreMatched) exactTitleMatchCount++;

      if (STALE_SERP_RE.test(`${item.title} ${item.snippet}`)) staleCount++;
      if (/\b2026\b/i.test(item.title)) fresh2026Count++;
    }

    if (ugcMatchedUrls.length > 0) ugcPoints = 25;
    if (exactTitleMatchCount < 2) titleGapPoints = 25;
    else if (exactTitleMatchCount === 2) titleGapPoints = 10;

    if ((staleCount > 0 || fresh2026Count === 0) && fresh2026Count < 2) {
      freshnessGapPoints = 20;
    }

    if (
      editorialDomainsFound.length >= 3 ||
      (top5[0] &&
        top5[1] &&
        HIGH_DR_EDITORIAL_DOMAINS.has(top5[0].domain) &&
        HIGH_DR_EDITORIAL_DOMAINS.has(top5[1].domain))
    ) {
      editorialWallPenalty = 35;
    } else if (editorialDomainsFound.length === 2) {
      editorialWallPenalty = 18;
    }
  } else {
    // Tier 3 Deterministic Lexical & Domain-Difficulty Heuristic
    const isUgcHeavyTopic =
      /\b(not\s+working|stopped\s+working|purple\s+screen|error\s+2000|experiencing\s+interruptions|thorium|floorp|zen\s+browser|orion\s+browser|arc\s+browser|crunchyroll|fandom|itvx|channel\s*4|onetrust|didomi|sourcepoint|usercentrics|quantcast|trustarc|scroll\s*lock|renewal\s+charge|pie\s+adblock|total\s+adblock\s+cancel)\b/i.test(
        qNorm
      );
    if (isUgcHeavyTopic) ugcPoints = 22;

    const entityCount = queryCanon.tokens.length;
    if (entityCount >= 4 && hasSpecificityModifier) titleGapPoints = 22;
    else if (entityCount === 3 && hasSpecificityModifier) titleGapPoints = 14;

    if (/\b(manifest\s*v3|mv3|2026|ublock\s+origin\s+lite|after\s+chrome\s+update)\b/i.test(qNorm)) {
      freshnessGapPoints = 18;
    } else if (hasSpecificityModifier) {
      freshnessGapPoints = 12;
    }

    const isLockedHeadTerm =
      /^(best\s+ad\s*blocker|free\s+ad\s*blocker|ad\s*blocker\s+chrome|best\s+ad\s*blocker\s+for\s+(chrome|iphone|android|mac|windows|safari))$/i.test(
        qNorm
      );
    if (isLockedHeadTerm) editorialWallPenalty = 35;
  }

  const lowCompetitionScore = Math.max(
    5,
    Math.min(100, 30 + ugcPoints + titleGapPoints + freshnessGapPoints + longTailPoints - editorialWallPenalty)
  );
  const estimatedKD = Math.max(1, Math.min(95, 100 - lowCompetitionScore));

  const result = {
    ts: now,
    inspectionSource: source,
    lowCompetitionScore,
    estimatedKD,
    editorialWallCount: editorialDomainsFound.length,
    signals: {
      ugcPoints,
      titleGapPoints,
      freshnessGapPoints,
      longTailPoints,
      editorialWallPenalty,
      ugcMatchedUrls: ugcMatchedUrls.slice(0, 3),
      editorialDomainsFound: editorialDomainsFound.slice(0, 3)
    },
    top5Organic: top5.slice(0, 5)
  };

  serpCache[qNorm] = result;
  return result;
}

// ============================================================================
// 7. BLUEPRINT SYNTHESIS ENGINE (STRICT SEO LENGTH & CTA VALIDATION)
// ============================================================================
function toTitleCase(str) {
  const UPPER = new Set(['mv3', 'uk', 'us', 'cpu', 'ram', 'dns', 'gdpr', 'ccpa', 'tv', 'pc', 'ios', 'ai', 'url', 'id', 'itvx', '4od']);
  const BRANDS = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    crunchyroll: 'Crunchyroll',
    ublock: 'uBlock',
    adblock: 'AdBlock',
    adblocker: 'AdBlocker',
    adguard: 'AdGuard',
    onetrust: 'OneTrust',
    trustarc: 'TrustArc',
    usercentrics: 'Usercentrics',
    didomi: 'Didomi',
    sourcepoint: 'Sourcepoint',
    quantcast: 'Quantcast',
    shopify: 'Shopify',
    macos: 'macOS',
    iphone: 'iPhone',
    ipad: 'iPad',
    macbook: 'MacBook',
    dailymail: 'DailyMail'
  };
  return String(str || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (BRANDS[lower]) return BRANDS[lower];
      if (UPPER.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function clampSeoTitle(rawBase) {
  let clean = rawBase.replace(/\s+/g, ' ').trim();
  const suffixFull = ' (2026) | SWEEPR DeepBlock';
  const suffixMid = ' | SWEEPR DeepBlock';
  const suffixShort = ' | DeepBlock';

  if (!/\b2026\b/.test(clean) && (clean + suffixFull).length <= 65) {
    return clean + suffixFull;
  }
  if ((clean + suffixMid).length <= 65) {
    return clean + suffixMid;
  }
  if ((clean + suffixShort).length <= 65) {
    return clean + suffixShort;
  }
  // Trim word-by-word to fit <= 65 chars without '...'
  const words = clean.split(' ');
  while (words.length > 3 && (words.join(' ') + suffixShort).length > 65) {
    words.pop();
  }
  const candidate = (words.join(' ') + suffixShort).slice(0, 65).trim();
  return candidate.length >= 25 ? candidate : `${candidate} 2026 MV3 Shield`;
}

function clampMetaDescription(rawDesc) {
  let clean = rawDesc.replace(/\s+/g, ' ').trim();
  if (clean.length > 158) {
    const cut = clean.slice(0, 155);
    const lastSpace = cut.lastIndexOf(' ');
    clean = (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:-]+$/, '') + '.';
  }
  if (clean.length < 70) {
    clean += ' Built natively on Chrome & Firefox Manifest V3 with <50ms cookie rejection.';
  }
  return clean.slice(0, 160);
}

export function synthesizePageBlueprint(keyword, secondaryKeywords, intentInfo, metrics) {
  const titlePhrase = toTitleCase(keyword);
  const title = clampSeoTitle(titlePhrase);
  const h1 = `${titlePhrase}: Verified 2026 Manifest V3 Protection & Fix`;

  const isRamOrSuite = /\b(ram|cpu|memory|hibernat|suspender|battery|suite|bundle)\b/i.test(keyword);
  const isScamOrShop = /\b(scam|shop|store|legit|shopify|clearance|review|ai\s+slop)\b/i.test(keyword);
  const isCookie = /\b(cookie|onetrust|didomi|sourcepoint|usercentrics|quantcast|trustarc|gdpr|scroll)\b/i.test(keyword);
  const isCompetitor = intentInfo.cluster === 'vs';

  let metaDescription = '';
  if (isCompetitor) {
    metaDescription = clampMetaDescription(
      `${titlePhrase} compared in 2026: 8/8 Manifest V3 ad & tracker defense, <50ms cookie auto-rejection, and transparent £29.99/yr Pro pricing without renewal traps.`
    );
  } else if (isScamOrShop) {
    metaDescription = clampMetaDescription(
      `${titlePhrase}: inspect domain age, fake checkout timers, and phishing patterns in real time while blocking sponsored AI search slop with SWEEPR DeepBlock.`
    );
  } else if (isCookie) {
    metaDescription = clampMetaDescription(
      `${titlePhrase}: automatically click Reject All on GDPR cookie popups in under 50ms and unlock frozen page scrollbars across Chrome, Edge, and Firefox.`
    );
  } else if (isRamOrSuite) {
    metaDescription = clampMetaDescription(
      `${titlePhrase}: cut browser RAM usage by up to 62% with sub-millisecond C++ declarativeNetRequest ad filtering and automatic background tab hibernation.`
    );
  } else {
    metaDescription = clampMetaDescription(
      `${titlePhrase}: pass all 8/8 Manifest V3 anti-detection checks in 2026 with C++ declarativeNetRequest filtering, zero video ads, and <50ms cookie rejection.`
    );
  }

  const recommendedToolWidget = isScamOrShop
    ? {
        toolRoute: '/tools/is-this-shop-a-scam',
        ctaHeadline: 'Verify Any Online Store in 5 Seconds (14-Point Scam Audit)',
        ctaButton: 'Open Free Scam Shop Detector →'
      }
    : {
        toolRoute: '/tools/is-my-adblocker-working',
        ctaHeadline: 'Test Your Current Browser Against 8 Live MV3 Ad & Tracker Vectors',
        ctaButton: 'Run Free 8/8 MV3 Adblock Diagnostic →'
      };

  const primaryCta = isRamOrSuite
    ? {
        href: '/order?plan=suite_annual',
        label: 'Get Complete Security Suite (£89.99/yr — All 3 Pro Apps)'
      }
    : {
        href: '/order?plan=annual',
        label: 'Unlock SWEEPR DeepBlock Pro (£29.99/yr — Save 58%)'
      };

  const secondaryCta = {
    href: '/order?plan=suite_annual',
    label: 'Bundle VPN + Cleaner + DeepBlock + RAM Tamer (£89.99/yr)'
  };

  const secList = secondaryKeywords.slice(0, 3);
  const customFaqs = [
    {
      q: `How does SWEEPR DeepBlock solve "${keyword}" in 2026?`,
      a: `SWEEPR DeepBlock v1.2.7 combines 242 C++ declarativeNetRequest network rules (15µs match latency) with local-first DOM & player sanitization, eliminating video ad interruptions, cookie walls, and tracker bloat without triggering anti-adblock modals.`
    },
    {
      q: secList[0]
        ? `What about ${secList[0]}?`
        : `Does this work on Chrome, Edge, Brave, and Firefox Manifest V3?`,
      a: `Yes. Every SWEEPR DeepBlock rule pack is compiled natively for Chromium Manifest V3 (Chrome, Edge, Brave, Thorium, Vivaldi, Opera, Arc) and Firefox WebExtensions with zero cloud browsing telemetry.`
    },
    {
      q: secList[1]
        ? `How do I fix ${secList[1]} without breaking page scrolling?`
        : `Why do standard ad blockers fail or break page scrolling on modern sites?`,
      a: `Legacy CSS-hiding extensions delete the visual overlay while leaving body{overflow:hidden} locked and consented tracker scripts active. SWEEPR DeepBlock executes the genuine "Reject All" CMP signal in under 50ms and restores clean scrolling automatically.`
    },
    {
      q: `What is included in SWEEPR DeepBlock Pro vs the Complete Security Suite?`,
      a: `SWEEPR DeepBlock Pro (£29.99/yr or £1.99 1st-Month Intro) unlocks all 6 browser protection modules across 4 devices. The Sweepr Complete Security Suite (£89.99/yr, save 45%) bundles DeepBlock Pro, Total Tab & RAM Tamer, Sweepr VPN Pro, and Sweepr Desktop Cleaner Pro across 5 devices.`
    }
  ];

  return {
    title,
    h1,
    metaDescription,
    shortLinkTitle: titlePhrase.length > 48 ? titlePhrase.slice(0, 45).trim() + '' : titlePhrase,
    linkBadge: `${intentInfo.cluster.toUpperCase()} • KD ${metrics.estimatedKD} • Score ${metrics.opportunityScore}`,
    painPointIssue: `Eliminating ${keyword} with verified C++ declarativeNetRequest filtering, <50ms CMP auto-rejection, and local-first privacy protection`,
    beforeStat: isRamOrSuite ? '1.8 GB+ Browser Tab RAM Bloat' : 'Unskippable Ads & Tracker Walls',
    afterStat: isRamOrSuite ? 'Up to 62% Lower Memory Overhead' : '0 Video Ads • <50ms Auto-Reject',
    perfStat: '15µs C++ DNR Match',
    recommendedToolWidget,
    primaryCta,
    secondaryCta,
    customFaqs
  };
}

// ============================================================================
// 8. MAIN PIPELINE ORCHESTRATOR (`runKeywordResearchEngine`)
// ============================================================================
export async function runKeywordResearchEngine(options = {}) {
  const forceFresh = Boolean(options.forceFresh || process.argv.includes('--no-cache'));
  const offlineMode = Boolean(options.offline || process.argv.includes('--offline'));
  const maxLiveSerpChecks = Number(options.maxLiveSerpChecks ?? 25);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const autocompleteCache = loadJsonFileSafe(AUTOCOMPLETE_CACHE_PATH, {});
  const serpCache = loadJsonFileSafe(SERP_CACHE_PATH, {});
  const corpus = loadUnifiedIndexableCorpus();

  // Build hierarchical seed queries across the 6 pillars
  const seedJobs = [];
  const seenSeedKey = new Set();

  for (const pillar of PILLAR_SEED_MATRIX) {
    // Depth 0: Direct high-intent seeds
    for (const ds of pillar.directSeeds || []) {
      const k = `${pillar.pillarId}:${ds.toLowerCase()}`;
      if (!seenSeedKey.has(k)) {
        seenSeedKey.add(k);
        seedJobs.push({ pillar, seed: ds, depth: 0 });
      }
    }
    // Depth 0/1: Entity x Modifier combinations
    for (const ent of pillar.entities || []) {
      for (const mod of pillar.modifiers || ['']) {
        const phrase = mod ? `${ent} ${mod}`.trim() : ent.trim();
        const depth = mod ? 1 : 0;
        const k = `${pillar.pillarId}:${phrase.toLowerCase()}`;
        if (!seenSeedKey.has(k)) {
          seenSeedKey.add(k);
          seedJobs.push({ pillar, seed: phrase, depth });
        }
      }
    }
  }

  const rawHarvestMap = new Map();

  // Seed with all directSeeds first so even in offline/air-gapped environments high-value seeds are evaluated
  for (const job of seedJobs) {
    if (job.depth === 0) {
      const q = job.seed.toLowerCase().trim();
      if (!rawHarvestMap.has(q)) {
        rawHarvestMap.set(q, {
          query: q,
          pillarId: job.pillar.pillarId,
          seed: job.seed,
          minDepth: 0,
          seedCount: 1,
          bestRankByEngine: { google: 2, bing: 3 },
          bestRelevanceByEngine: { google: 950 }
        });
      }
    }
  }

  // Query live autocomplete endpoints with bounded concurrency (batch of 6 seed jobs)
  if (!offlineMode) {
    const BATCH_SIZE = 6;
    // Limit live network expansion to top 36 seed jobs per run for fast execution (<15s)
    const activeSeedJobs = seedJobs.slice(0, 36);
    for (let i = 0; i < activeSeedJobs.length; i += BATCH_SIZE) {
      const slice = activeSeedJobs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        slice.map(async (job) => {
          for (const eng of job.pillar.engines) {
            const suggestions = await fetchAutocompleteFromEngine(eng, job.seed, autocompleteCache, forceFresh);
            for (const item of suggestions) {
              const q = item.text;
              if (!rawHarvestMap.has(q)) {
                rawHarvestMap.set(q, {
                  query: q,
                  pillarId: job.pillar.pillarId,
                  seed: job.seed,
                  minDepth: job.depth,
                  seedCount: 1,
                  bestRankByEngine: { [eng]: item.rank },
                  bestRelevanceByEngine: item.relevance ? { [eng]: item.relevance } : {}
                });
              } else {
                const rec = rawHarvestMap.get(q);
                rec.seedCount++;
                if (job.depth < rec.minDepth) rec.minDepth = job.depth;
                if (!rec.bestRankByEngine[eng] || item.rank < rec.bestRankByEngine[eng]) {
                  rec.bestRankByEngine[eng] = item.rank;
                }
                if (
                  item.relevance &&
                  (!rec.bestRelevanceByEngine[eng] || item.relevance > rec.bestRelevanceByEngine[eng])
                ) {
                  rec.bestRelevanceByEngine[eng] = item.relevance;
                }
              }
            }
          }
        })
      );
    }
    saveJsonFileSafe(AUTOCOMPLETE_CACHE_PATH, autocompleteCache);
  }

  // Evaluate VolumeScore, Buyer Intent, and Corpus Cannibalization
  let junkRejectedCount = 0;
  let lowIntentRejectedCount = 0;
  let alreadyCoveredCount = 0;
  const candidatePool = [];
  const coveredQueriesSample = [];

  for (const rec of rawHarvestMap.values()) {
    const intentInfo = scoreAndClassifyBuyerIntent(rec.query, rec.pillarId);
    if (intentInfo.isJunk) {
      junkRejectedCount++;
      continue;
    }
    if (intentInfo.transactionalScore < 65 || intentInfo.intentTier === 'informational_low_value') {
      lowIntentRejectedCount++;
      continue;
    }

    const volInfo = calculateVolumeScore(rec);
    if (volInfo.volumeScore < 45) continue;

    const queryCanon = canonicalizeIntentTokens(rec.query);
    const cannib = evaluateCorpusCannibalization(queryCanon, intentInfo.targetRoute, corpus);

    if (cannib.status === 'EXACT_SLUG_COLLISION') {
      alreadyCoveredCount++;
      coveredQueriesSample.push({
        query: rec.query,
        matchedPage: cannib.closestExistingUrl,
        overlapRatio: cannib.tokenOverlapRatio
      });
      continue;
    }

    candidatePool.push({
      ...rec,
      queryCanon,
      volInfo,
      intentInfo,
      cannib
    });
  }

  // Sort by preliminary Transactional + Volume score before Intra-Batch Clustering
  candidatePool.sort(
    (a, b) =>
      b.intentInfo.transactionalScore + b.volInfo.volumeScore - (a.intentInfo.transactionalScore + a.volInfo.volumeScore)
  );

  // Stage B: Intra-Batch Greedy Single-Linkage Clustering (prevents synonym cannibalization)
  const clusters = [];
  let intraBatchMergedCount = 0;

  for (const cand of candidatePool) {
    let mergedInto = null;
    for (const leader of clusters) {
      if (leader.queryCanon.fingerprint === cand.queryCanon.fingerprint) {
        mergedInto = leader;
        break;
      }
      // Compute IDF Jaccard between leader and cand
      let interIdf = 0;
      let unionIdf = 0;
      const allToks = new Set([...leader.queryCanon.tokens, ...cand.queryCanon.tokens]);
      for (const t of allToks) {
        const w = corpus.idf(t);
        unionIdf += w;
        if (leader.queryCanon.tokenSet.has(t) && cand.queryCanon.tokenSet.has(t)) {
          interIdf += w;
        }
      }
      const idfJaccard = unionIdf > 0 ? interIdf / unionIdf : 0;
      if (idfJaccard >= 0.72) {
        mergedInto = leader;
        break;
      }
    }

    if (mergedInto) {
      intraBatchMergedCount++;
      if (
        cand.query !== mergedInto.query &&
        !mergedInto.secondaryKeywords.includes(cand.query) &&
        mergedInto.secondaryKeywords.length < 6
      ) {
        mergedInto.secondaryKeywords.push(cand.query);
      }
    } else {
      clusters.push({
        ...cand,
        secondaryKeywords: []
      });
    }
  }

  // Stage C: Live SERP Weak-Spot Inspection & 5-Gate Admission
  const approvedOpportunities = [];
  const ctrEnrichmentQueue = [];
  let liveSerpChecksPerformed = 0;

  for (const item of clusters) {
    const allowLive = !offlineMode && liveSerpChecksPerformed < maxLiveSerpChecks;
    const wasCached = Boolean(serpCache[item.query] && Date.now() - serpCache[item.query].ts < SERP_CACHE_TTL_MS);
    const serpInfo = await evaluateSerpWeakSpotScore(item.query, item.queryCanon, serpCache, allowLive);
    if (allowLive && !wasCached && serpInfo.inspectionSource.endsWith('_live')) {
      liveSerpChecksPerformed++;
    }

    const volumeScore = item.volInfo.volumeScore;
    const lowCompetitionScore = serpInfo.lowCompetitionScore;
    const transactionalScore = item.intentInfo.transactionalScore;

    // Gate 3 check: LowCompetitionScore >= 55 & editorialWallCount < 3
    if (lowCompetitionScore < 55 || serpInfo.editorialWallCount >= 3) {
      continue;
    }

    const rawLinear = 0.30 * volumeScore + 0.35 * lowCompetitionScore + 0.35 * transactionalScore;
    const balanceBonus = Math.min(volumeScore, lowCompetitionScore, transactionalScore) >= 65 ? 5 : 0;
    const cannibPenalty =
      item.cannib.maxCannibScore >= 0.68 ? -100 : item.cannib.maxCannibScore >= 0.55 ? -12 : 0;
    const opportunityScore = Math.max(0, Math.min(100, +(rawLinear + balanceBonus + cannibPenalty).toFixed(1)));

    const metrics = {
      opportunityScore,
      volumeScore,
      lowCompetitionScore,
      transactionalScore,
      estimatedKD: serpInfo.estimatedKD,
      wordCount: item.query.split(/\s+/).length
    };

    if (item.cannib.maxCannibScore >= 0.55) {
      // Near-match -> Route to CTR / FAQ Surgery on existing Pillar page instead of minting duplicate URL
      alreadyCoveredCount++;
      ctrEnrichmentQueue.push({
        keyword: item.query,
        secondaryKeywords: item.secondaryKeywords,
        targetExistingPage: item.cannib.closestExistingUrl,
        targetExistingTitle: item.cannib.closestExistingTitle,
        cannibalizationScore: item.cannib.maxCannibScore,
        metrics,
        recommendedAction: 'ENRICH_EXISTING_PILLAR_FAQ_AND_CTR'
      });
      continue;
    }

    // Gate 5: OpportunityScore >= 72 for Net-New Pillar Page
    if (opportunityScore < 72) continue;

    const pageBlueprint = synthesizePageBlueprint(
      item.query,
      item.secondaryKeywords,
      item.intentInfo,
      metrics
    );

    const isPublishedOnDisk = fs.existsSync(path.join(WEBSITE_DIR, item.intentInfo.relPath));

    approvedOpportunities.push({
      id: `kw_${item.intentInfo.cluster}_${item.queryCanon.tokens.slice(0, 4).join('_')}`,
      keyword: item.query,
      secondaryKeywords: item.secondaryKeywords,
      tokenFingerprint: item.queryCanon.fingerprint,
      pillar: item.pillarId,
      intentTier: item.intentInfo.intentTier,
      cluster: item.intentInfo.cluster,
      recommendedFormat: item.intentInfo.recommendedFormat,
      targetRoute: item.intentInfo.targetRoute,
      relPath: item.intentInfo.relPath,
      isPublishedOnDisk,
      status: isPublishedOnDisk ? 'published' : 'approved_for_generation',
      metrics,
      volumeBreakdown: {
        ...item.volInfo,
        enginesMatched: Object.keys(item.bestRankByEngine),
        bestRankByEngine: item.bestRankByEngine
      },
      serpCompetition: {
        inspectionSource: serpInfo.inspectionSource,
        lowCompetitionScore: serpInfo.lowCompetitionScore,
        estimatedKD: serpInfo.estimatedKD,
        signals: serpInfo.signals,
        top5Organic: serpInfo.top5Organic
      },
      cannibalization: {
        status: 'clean',
        closestExistingPage: item.cannib.closestExistingUrl,
        maxCannibScore: item.cannib.maxCannibScore,
        tokenOverlapRatio: item.cannib.tokenOverlapRatio,
        jaccardSimilarity: item.cannib.jaccardSimilarity
      },
      pageBlueprint
    });
  }

  saveJsonFileSafe(SERP_CACHE_PATH, serpCache);

  approvedOpportunities.sort((a, b) => b.metrics.opportunityScore - a.metrics.opportunityScore);
  ctrEnrichmentQueue.sort((a, b) => b.metrics.opportunityScore - a.metrics.opportunityScore);

  const matrixReport = {
    generatedAt: new Date().toISOString(),
    engineVersion: '2.0.0',
    summary: {
      totalIndexablePagesChecked: corpus.totalIndexableCount,
      seedQueriesExpanded: seedJobs.length,
      rawAutocompleteHarvested: rawHarvestMap.size,
      junkDisqualifiedCount: junkRejectedCount,
      lowIntentRejectedCount,
      intraBatchSynonymsMerged: intraBatchMergedCount,
      alreadyCoveredOrEnrichedCount: alreadyCoveredCount,
      approvedLowKdOpportunitiesCount: approvedOpportunities.length,
      ctrEnrichmentQueueCount: ctrEnrichmentQueue.length
    },
    opportunities: approvedOpportunities,
    ctrEnrichmentQueue: ctrEnrichmentQueue.slice(0, 50)
  };

  saveJsonFileSafe(MATRIX_OUTPUT_PATH, matrixReport);

  // Also write backwards-compatible `data/seo-intent-gaps.json`
  const legacyGapsReport = {
    generatedAt: matrixReport.generatedAt,
    engineVersion: matrixReport.engineVersion,
    seedsQueried: seedJobs.length,
    indexablePagesChecked: corpus.totalIndexableCount,
    totalAutocompleteQueriesDiscovered: rawHarvestMap.size,
    alreadyCoveredCount,
    uncoveredIntentGapsCount: approvedOpportunities.length,
    topPriorityGaps: approvedOpportunities.slice(0, 50).map((opp) => ({
      query: opp.keyword,
      secondaryKeywords: opp.secondaryKeywords,
      seed: opp.pillar,
      intentScore: opp.metrics.transactionalScore,
      volumeScore: opp.metrics.volumeScore,
      lowCompetitionScore: opp.metrics.lowCompetitionScore,
      estimatedKD: opp.metrics.estimatedKD,
      opportunityScore: opp.metrics.opportunityScore,
      recommendedFormat: opp.recommendedFormat,
      suggestedRoute: opp.targetRoute,
      closestExistingPage: opp.cannibalization.closestExistingPage,
      overlapRatio: opp.cannibalization.tokenOverlapRatio
    })),
    sampleCoveredQueries: coveredQueriesSample.slice(0, 20)
  };

  saveJsonFileSafe(LEGACY_GAPS_OUTPUT_PATH, legacyGapsReport);

  console.log('============================================================================');
  console.log('  SWEEPR DEEPBLOCK — TRANSACTIONAL KEYWORD & LOW-KD OPPORTUNITY ENGINE v2.0');
  console.log('============================================================================');
  console.log(`  Indexable Corpus Audited (Both Sitemaps) : ${corpus.totalIndexableCount} URLs`);
  console.log(`  Hierarchical Seed Queries Expanded       : ${seedJobs.length}`);
  console.log(`  Raw Multi-Engine Queries Harvested       : ${rawHarvestMap.size}`);
  console.log(`  Hard Junk / Non-Browser Disqualified     : ${junkRejectedCount}`);
  console.log(`  Intra-Batch Synonyms Clustered           : ${intraBatchMergedCount}`);
  console.log(`  Approved Low-KD New Pillar Blueprints    : ${approvedOpportunities.length}`);
  console.log(`  Routed to Existing Pillar CTR Surgery    : ${ctrEnrichmentQueue.length}`);
  console.log('----------------------------------------------------------------------------');
  console.log('  Top 10 Approved Low-Competition + High-Volume Transactional Opportunities:');
  for (const opp of approvedOpportunities.slice(0, 10)) {
    console.log(
      `  • [Opp ${opp.metrics.opportunityScore} | Vol ${opp.metrics.volumeScore} | KD ${opp.metrics.estimatedKD} | Trans ${opp.metrics.transactionalScore}] "${opp.keyword}" -> ${opp.targetRoute}`
    );
  }
  console.log('============================================================================');

  return matrixReport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runKeywordResearchEngine().catch((err) => {
    console.error('[KEYWORD-ENGINE] Fatal error:', err);
    process.exit(1);
  });
}
