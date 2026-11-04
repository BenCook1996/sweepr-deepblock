#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Automated Search-Intent Gap Miner (`scripts/search-intent-gap-miner.mjs`)
 *
 * Replaces blind swap-text pSEO generation with live search-intent discovery:
 *  1. Queries live Google & DuckDuckGo Autocomplete endpoints across high-intent
 *     ad-blocking, cookie-consent, anti-adblock, scam-detection, and RAM-optimization seeds.
 *  2. Cross-references all discovered queries against the 300 indexable URLs in `website/sitemap.xml`.
 *  3. Ranks uncovered search queries by commercial & diagnostic intent and outputs
 *     `data/seo-intent-gaps.json` with recommended page formats and target slugs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT_DIR, 'website', 'sitemap.xml');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'seo-intent-gaps.json');

const SEED_QUERIES = [
  'ad blocker not working on',
  'how to block ads on',
  'block youtube ads on',
  'auto reject cookie popups',
  'is my adblocker',
  'best ad blocker for',
  'manifest v3 ad blocker',
  'twitch adblock',
  'stop pop up ads on',
  'how to check if online store is legit',
  'dns leak test',
  'browser using too much ram'
];

const EXCLUDED_TERMS = /(porn|xxx|sex|hentai|xvideos|xnxx|pirate|torrent|crack|keygen|apk\s*mod)/i;

function normalizeTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !['how', 'the', 'and', 'for', 'with', 'from', 'that', 'this'].includes(w));
}

function loadExistingIndexableSlugs() {
  if (!fs.existsSync(SITEMAP_PATH)) return [];
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return locs.map((url) => {
    const pathname = new URL(url).pathname;
    return {
      url,
      pathname,
      tokens: new Set(normalizeTokens(pathname))
    };
  });
}

async function fetchGoogleAutocomplete(seed) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/132.0' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.[1]) ? data[1].map((s) => String(s).trim().toLowerCase()) : [];
  } catch {
    return [];
  }
}

async function fetchDuckDuckGoAutocomplete(seed) {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(seed)}&type=list`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data?.[1])) {
      return data[1].map((s) => String(s).trim().toLowerCase());
    }
    if (Array.isArray(data)) {
      return data.map((item) => String(item?.phrase || '').trim().toLowerCase()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

function scoreQueryAndClassify(query, seed) {
  let score = 55;
  if (/not working|stopped working|bypass|detected|fix|broken|purple screen/i.test(query)) score += 22;
  if (/test|check|working|leak|fingerprint|scam|legit/i.test(query)) score += 18;
  if (/youtube|twitch|crunchyroll|spotify|hulu|reddit|forbes|fandom/i.test(query)) score += 12;
  if (/chrome|firefox|safari|edge|brave|opera|iphone|ios|android|mac|windows/i.test(query)) score += 10;
  if (/manifest v3|mv3|cookie|gdpr|consent|ram|memory|slow/i.test(query)) score += 10;
  score = Math.min(99, score);

  let format = 'platform_solution';
  let folder = 'solutions';
  if (/test|check|is my|legit|scam|leak/i.test(query)) {
    format = 'interactive_tool';
    folder = 'tools';
  } else if (/not working|fix|stopped|purple screen|bypass/i.test(query)) {
    format = 'troubleshooting_guide';
    folder = 'guides';
  } else if (/chrome|firefox|safari|edge|brave|opera|vivaldi|arc|iphone|ios|android|mac|windows/i.test(query)) {
    format = 'browser_setup_guide';
    folder = 'setup';
  } else if (/\bvs\b|alternative|compare/i.test(query)) {
    format = 'competitor_comparison';
    folder = 'vs';
  }

  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 65);

  return {
    query,
    seed,
    intentScore: score,
    recommendedFormat: format,
    suggestedRoute: `/${folder}/${slug}`
  };
}

async function runIntentMiner() {
  const existingPages = loadExistingIndexableSlugs();
  const discoveredMap = new Map();

  for (const seed of SEED_QUERIES) {
    const [googleSuggestions, ddgSuggestions] = await Promise.all([
      fetchGoogleAutocomplete(seed),
      fetchDuckDuckGoAutocomplete(seed)
    ]);
    for (const q of [...googleSuggestions, ...ddgSuggestions]) {
      if (!q || q.length < 6 || EXCLUDED_TERMS.test(q)) continue;
      if (!discoveredMap.has(q)) {
        discoveredMap.set(q, seed);
      }
    }
  }

  const uncoveredGaps = [];
  const coveredQueries = [];

  for (const [query, seed] of discoveredMap.entries()) {
    const qTokens = normalizeTokens(query);
    if (qTokens.length === 0) continue;

    let bestOverlap = 0;
    let matchedPage = null;

    for (const page of existingPages) {
      let matchedCount = 0;
      for (const t of qTokens) {
        if (page.tokens.has(t)) matchedCount++;
      }
      const ratio = matchedCount / qTokens.length;
      if (ratio > bestOverlap) {
        bestOverlap = ratio;
        matchedPage = page.pathname;
      }
    }

    if (bestOverlap >= 0.72) {
      coveredQueries.push({ query, matchedPage, overlapRatio: +bestOverlap.toFixed(2) });
    } else {
      const classified = scoreQueryAndClassify(query, seed);
      uncoveredGaps.push({
        ...classified,
        closestExistingPage: matchedPage,
        overlapRatio: +bestOverlap.toFixed(2)
      });
    }
  }

  uncoveredGaps.sort((a, b) => b.intentScore - a.intentScore || a.overlapRatio - b.overlapRatio);

  const report = {
    generatedAt: new Date().toISOString(),
    seedsQueried: SEED_QUERIES.length,
    indexablePagesChecked: existingPages.length,
    totalAutocompleteQueriesDiscovered: discoveredMap.size,
    alreadyCoveredCount: coveredQueries.length,
    uncoveredIntentGapsCount: uncoveredGaps.length,
    topPriorityGaps: uncoveredGaps.slice(0, 50),
    sampleCoveredQueries: coveredQueries.slice(0, 20)
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('======================================================================');
  console.log('  SWEEPR DEEPBLOCK — SEARCH-INTENT GAP MINER REPORT');
  console.log('======================================================================');
  console.log(`  Seeds Queried             : ${report.seedsQueried}`);
  console.log(`  Indexable Pages Checked   : ${report.indexablePagesChecked}`);
  console.log(`  Live Queries Discovered   : ${report.totalAutocompleteQueriesDiscovered}`);
  console.log(`  Already Covered in Sitemap: ${report.alreadyCoveredCount}`);
  console.log(`  Uncovered Intent Gaps     : ${report.uncoveredIntentGapsCount}`);
  console.log('----------------------------------------------------------------------');
  console.log('  Top 10 Uncovered High-Intent Opportunities:');
  for (const item of uncoveredGaps.slice(0, 10)) {
    console.log(`  • [Score ${item.intentScore}] "${item.query}" -> ${item.suggestedRoute} (${item.recommendedFormat})`);
  }
  console.log('======================================================================');
}

runIntentMiner().catch((err) => {
  console.error('[SEO-INTENT-MINER] Error:', err);
  process.exit(1);
});
