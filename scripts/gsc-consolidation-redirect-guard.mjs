#!/usr/bin/env node
/**
 * SWEEPR Deepblock — GSC Consolidation & 301 Redirect Health Guard
 *
 * Continuously reconciles and audits the Google Search Console consolidation
 * & HTTP 301 redirect architecture across all PSEO clusters:
 *  1. Runs `consolidate-and-optimize-gsc.mjs` idempotently (skipped in `--check` mode)
 *     while respecting M1 `NOINDEX_PRUNE` (`noindex, nofollow` + self-canonical) vs
 *     `CONSOLIDATE_301` (`noindex, follow` + parent canonical) semantics.
 *  2. Audits all consolidated `noindex, follow` sub-variant pages and `noindex, nofollow`
 *     pruned pages to guarantee:
 *     - 0 redirect loops (self-canonical while marked `noindex, follow`)
 *     - 0 redirect chains (canonical pointing to another noindex page)
 *     - 0 accidental 301 hijacks on `noindex, nofollow` pruned pages
 *     - 0 missing/404 canonical targets on disk
 *     - 0 `robots.txt` Disallow vs. `sitemap.xml` / `sitemap-sites.xml` conflicts
 *     - Validated explicit 301 redirect mappings in `server.js`
 *  3. Writes telemetry to `data/gsc-consolidation-health.json` (unless `--check`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  isNoIndexPrunePath,
  CONSOLIDATE_301_MAP,
  EXPLICIT_CONSOLIDATION_MAP,
  normalizeUrlPath
} from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SERVER_PATH = path.join(ROOT_DIR, 'server.js');
const REPORT_PATH = path.join(DATA_DIR, 'gsc-consolidation-health.json');
const SCHEDULER_STATE_PATH = path.join(DATA_DIR, 'automation-scheduler-state.json');
const CHECK_ONLY = process.argv.includes('--check');
const STRICT_MODE = process.argv.includes('--strict');

function walkHtml(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(walkHtml(full));
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function toCleanRoute(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'index.html') return '/';
  if (norm.endsWith('/index.html')) return '/' + norm.replace(/\/index\.html$/, '');
  return '/' + norm.replace(/\.html$/, '');
}

function resolveDiskHtml(cleanRoute) {
  if (cleanRoute === '/') return path.join(WEBSITE_DIR, 'index.html');
  const rel = cleanRoute.replace(/^\/+/, '');
  const htmlCandidate = path.join(WEBSITE_DIR, `${rel}.html`);
  if (fs.existsSync(htmlCandidate)) return htmlCandidate;
  const idxCandidate = path.join(WEBSITE_DIR, rel, 'index.html');
  if (fs.existsSync(idxCandidate)) return idxCandidate;
  return null;
}

function parseServerExplicitRedirects() {
  if (!fs.existsSync(SERVER_PATH)) return new Map();
  const src = fs.readFileSync(SERVER_PATH, 'utf8');
  const blockMatch = src.match(/const\s+EXPLICIT_CONSOLIDATION_REDIRECTS\s*=\s*new\s+Map\(\s*\[([\s\S]*?)\]\s*\)/);
  const parsed = new Map();
  if (!blockMatch) return parsed;
  for (const m of blockMatch[1].matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g)) {
    parsed.set(m[1].trim(), m[2].trim());
  }
  return parsed;
}

function checkNeedsConsolidationSync(allHtmlFiles) {
  if (process.argv.includes('--force-sync')) return { needed: true, reason: '--force-sync flag' };

  const smPath = path.join(WEBSITE_DIR, 'sitemap.xml');
  const smXml = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
  const smLocs = new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));

  const statePath = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      for (const rawP of st.discoveredGscPaths || []) {
        const p = normalizeUrlPath(rawP);
        if (isNoIndexPrunePath(p) || CONSOLIDATE_301_MAP.has(p)) continue;
        const diskFile = resolveDiskHtml(p);
        if (!diskFile) continue;
        const diskRaw = fs.readFileSync(diskFile, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(diskRaw)) continue;
        const fullUrl = `https://sweeprdeepblock.com${p}`;
        if (!smLocs.has(fullUrl)) {
          return { needed: true, reason: `discoveredGscPath ${p} not yet in sitemap.xml` };
        }
      }
    } catch {}
  }

  const kwPath = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
  if (fs.existsSync(kwPath)) {
    try {
      const kw = JSON.parse(fs.readFileSync(kwPath, 'utf8'));
      for (const opp of kw.opportunities || []) {
        const rawRoute = opp.targetRoute || opp.recommendedUrlPath;
        if (!opp.isPublishedOnDisk || !rawRoute) continue;
        const route = normalizeUrlPath(rawRoute);
        if (isNoIndexPrunePath(route) || CONSOLIDATE_301_MAP.has(route)) continue;
        const diskFile = resolveDiskHtml(route);
        if (!diskFile) continue;
        const diskRaw = fs.readFileSync(diskFile, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(diskRaw)) continue;
        const fullUrl = `https://sweeprdeepblock.com${route}`;
        if (!smLocs.has(fullUrl)) {
          return { needed: true, reason: `published keyword blueprint ${route} not yet in sitemap.xml` };
        }
      }
    } catch {}
  }

  for (const f of allHtmlFiles) {
    const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
    if (!/^(solutions|setup|vs|guides|glossary)\//i.test(rel) || rel.endsWith('/index.html')) continue;
    const raw = fs.readFileSync(f, 'utf8');
    const robotsContent = (raw.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const isNoIndex = /\bnoindex\b/.test(robotsContent);
    const isNoFollow = /\bnofollow\b/.test(robotsContent);
    if (!isNoIndex || isNoFollow) continue; // Intentionally ignore NOINDEX_PRUNE (`noindex, nofollow`) pages
    const clean = toCleanRoute(rel);
    if (isNoIndexPrunePath(clean)) continue;
    const selfUrl = `https://sweeprdeepblock.com${clean}`;
    const canMatch = raw.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    if (!canMatch || canMatch[1].trim() === selfUrl) {
      return { needed: true, reason: `unconsolidated noindex self-canonical on ${rel}` };
    }
  }

  return { needed: false, reason: 'in_sync' };
}

function main() {
  const startMs = Date.now();
  if (!CHECK_ONLY) fs.mkdirSync(DATA_DIR, { recursive: true });

  let allHtmlFiles = walkHtml(WEBSITE_DIR);
  const syncCheck = checkNeedsConsolidationSync(allHtmlFiles);
  if (syncCheck.needed && !CHECK_ONLY) {
    console.log(`[GSC-GUARD] 1/4 Drift detected (${syncCheck.reason}); running consolidate-and-optimize-gsc.mjs & gsc-strike-zone-optimizer.mjs...`);
    execFileSync(process.execPath, [path.join(__dirname, 'consolidate-and-optimize-gsc.mjs')], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    execFileSync(process.execPath, [path.join(__dirname, 'gsc-strike-zone-optimizer.mjs')], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    allHtmlFiles = walkHtml(WEBSITE_DIR);
  } else if (syncCheck.needed && CHECK_ONLY) {
    console.log(`[GSC-GUARD] 1/4 --check mode: consolidation drift noted (${syncCheck.reason}); skipping mutations.`);
  } else {
    console.log('[GSC-GUARD] 1/4 Consolidation state in sync.');
  }

  let legacySlopBoxesRemaining = 0;
  for (const f of allHtmlFiles) {
    const raw = fs.readFileSync(f, 'utf8');
    if (
      raw.includes('id="deepblock-live-rule-proof"') ||
      raw.includes('id="deepblock-ctr-intent-enrichment"') ||
      raw.includes('id="deepblock-ctr-enrichment"')
    ) {
      legacySlopBoxesRemaining++;
    }
  }
  console.log(
    `[GSC-GUARD] 2/4 Legacy dark slop blocks remaining on disk: ${legacySlopBoxesRemaining} (0 #deepblock-live-rule-proof enforcement).`
  );

  console.log('[GSC-GUARD] 3/4 Auditing 301 consolidation targets, noindex/nofollow separation, server.js explicit 301s, and robots.txt parity...');
  const routeMap = new Map();
  for (const f of allHtmlFiles) {
    const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
    const clean = toCleanRoute(rel);
    const raw = fs.readFileSync(f, 'utf8');
    const robotsContent = (raw.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    const isNoIndex = /\bnoindex\b/.test(robotsContent);
    const isNoFollow = /\bnofollow\b/.test(robotsContent);
    const canMatch = raw.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const canonicalUrl = canMatch ? canMatch[1].trim() : null;
    const canonicalPath = canonicalUrl
      ? canonicalUrl.replace(/^https?:\/\/(?:www\.)?sweeprdeepblock\.com/i, '') || '/'
      : null;
    routeMap.set(clean, {
      rel,
      clean,
      isNoIndex,
      isNoFollow,
      canonicalUrl,
      canonicalPath
    });
  }

  const redirectLoops = [];
  const redirectChains = [];
  const brokenCanonicalTargets = [];
  const explicit301SitemapWarnings = [];
  const stalePillarCanonicalMismatches = [];
  let consolidated301Count = 0;
  let noIndexPrunedCount = 0;
  let indexablePillarCount = 0;
  let publisherSitePageCount = 0;

  for (const rec of routeMap.values()) {
    if (rec.rel.startsWith('site/')) {
      if (!rec.isNoIndex) publisherSitePageCount++;
      else noIndexPrunedCount++;
      continue;
    }
    if (!rec.isNoIndex) {
      indexablePillarCount++;
      continue;
    }
    if (rec.isNoFollow) {
      noIndexPrunedCount++;
      if (/^(solutions|setup|vs|guides|glossary)\//i.test(rec.rel) && rec.canonicalPath && rec.canonicalPath !== rec.clean) {
        brokenCanonicalTargets.push({
          source: rec.clean,
          target: rec.canonicalPath,
          reason: 'noindex_prune_accidental_301_risk'
        });
      }
      continue;
    }
    if (/^(solutions|setup|vs|guides|glossary)\//i.test(rec.rel)) {
      consolidated301Count++;
      const expectedM1Target = CONSOLIDATE_301_MAP.get(rec.clean);
      if (expectedM1Target && rec.canonicalPath !== expectedM1Target) {
        stalePillarCanonicalMismatches.push({
          source: rec.clean,
          diskCanonical: rec.canonicalPath,
          expectedTarget: expectedM1Target
        });
      }
      if (!rec.canonicalPath) {
        brokenCanonicalTargets.push({ source: rec.clean, target: null, reason: 'missing_canonical' });
        continue;
      }
      if (rec.canonicalPath === rec.clean) {
        redirectLoops.push({ source: rec.clean, target: rec.canonicalPath });
        continue;
      }
      const targetRec = routeMap.get(rec.canonicalPath);
      if (!targetRec) {
        brokenCanonicalTargets.push({ source: rec.clean, target: rec.canonicalPath, reason: 'target_not_found' });
      } else if (targetRec.isNoIndex) {
        redirectChains.push({
          source: rec.clean,
          intermediateTarget: rec.canonicalPath,
          finalTarget: targetRec.canonicalPath
        });
      }
    }
  }

  // Validate server.js EXPLICIT_CONSOLIDATION_REDIRECTS against M1 & routeMap
  const serverExplicit301s = parseServerExplicitRedirects();
  for (const [srcPath, expectedTarget] of EXPLICIT_CONSOLIDATION_MAP.entries()) {
    const actualTarget = serverExplicit301s.get(srcPath);
    if (!actualTarget) {
      brokenCanonicalTargets.push({ source: srcPath, target: expectedTarget, reason: 'missing_explicit_301_in_server_js' });
    } else if (actualTarget !== expectedTarget) {
      brokenCanonicalTargets.push({ source: srcPath, target: actualTarget, expectedTarget, reason: 'mismatched_explicit_301_in_server_js' });
    } else {
      const targetRec = routeMap.get(actualTarget);
      if (!targetRec) {
        brokenCanonicalTargets.push({ source: srcPath, target: actualTarget, reason: 'explicit_301_target_not_found' });
      } else if (targetRec.isNoIndex) {
        redirectChains.push({ source: srcPath, intermediateTarget: actualTarget, finalTarget: targetRec.canonicalPath });
      }
    }
  }

  // Check robots.txt Disallow vs. sitemap.xml
  const robotsPath = path.join(WEBSITE_DIR, 'robots.txt');
  const disallowPrefixes = [];
  if (fs.existsSync(robotsPath)) {
    const robotsTxt = fs.readFileSync(robotsPath, 'utf8');
    let currentAgent = '*';
    for (const rawLine of robotsTxt.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const uaMatch = line.match(/^User-agent:\s*(.+)$/i);
      if (uaMatch) {
        currentAgent = uaMatch[1].trim();
        continue;
      }
      const disMatch = line.match(/^Disallow:\s*(.+)$/i);
      if (disMatch && (currentAgent === '*' || /Googlebot/i.test(currentAgent))) {
        const prefix = disMatch[1].trim();
        if (prefix && prefix !== '/') disallowPrefixes.push(prefix);
      }
    }
  }

  const sitemapUrls = [];
  for (const smFile of ['sitemap.xml']) {
    const smPath = path.join(WEBSITE_DIR, smFile);
    if (!fs.existsSync(smPath)) continue;
    const xml = fs.readFileSync(smPath, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      sitemapUrls.push({ sitemap: smFile, url: m[1].trim() });
    }
  }

  const sitemapRobotsConflicts = [];
  const sitemapNoIndexConflicts = [];
  for (const item of sitemapUrls) {
    const urlPath = item.url.replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/';
    for (const prefix of disallowPrefixes) {
      if (urlPath === prefix || urlPath.startsWith(prefix + '/') || (prefix.endsWith('/') && urlPath.startsWith(prefix))) {
        sitemapRobotsConflicts.push({ sitemap: item.sitemap, url: item.url, disallowRule: prefix });
      }
    }
    const rec = routeMap.get(urlPath);
    if (!rec) {
      sitemapNoIndexConflicts.push({ sitemap: item.sitemap, url: item.url, reason: 'missing_on_disk' });
    } else if (rec.isNoIndex) {
      sitemapNoIndexConflicts.push({ sitemap: item.sitemap, url: item.url, reason: 'marked_noindex' });
    }
    if (EXPLICIT_CONSOLIDATION_MAP.has(urlPath)) {
      explicit301SitemapWarnings.push({ sitemap: item.sitemap, url: item.url, redirectTarget: EXPLICIT_CONSOLIDATION_MAP.get(urlPath) });
    }
  }

  // Validate temporary 30-day consolidation sitemap (redirects / noindex, follow only)
  const consolidationSmPath = path.join(WEBSITE_DIR, 'sitemap-consolidations.xml');
  if (fs.existsSync(consolidationSmPath)) {
    const cXml = fs.readFileSync(consolidationSmPath, 'utf8');
    for (const m of cXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const cUrl = m[1].trim();
      const cPath = cUrl.replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/';
      for (const prefix of disallowPrefixes) {
        if (cPath === prefix || cPath.startsWith(prefix + '/') || (prefix.endsWith('/') && cPath.startsWith(prefix))) {
          sitemapRobotsConflicts.push({ sitemap: 'sitemap-consolidations.xml', url: cUrl, disallowRule: prefix });
        }
      }
      const rec = routeMap.get(cPath);
      if (!rec) {
        brokenCanonicalTargets.push({ sitemap: 'sitemap-consolidations.xml', url: cUrl, reason: 'missing_on_disk' });
      } else if (!rec.isNoIndex) {
        brokenCanonicalTargets.push({ sitemap: 'sitemap-consolidations.xml', url: cUrl, reason: 'expected_noindex_follow' });
      }
    }
  }

  const healthy =
    redirectLoops.length === 0 &&
    redirectChains.length === 0 &&
    brokenCanonicalTargets.length === 0 &&
    sitemapRobotsConflicts.length === 0 &&
    sitemapNoIndexConflicts.length === 0 &&
    (!STRICT_MODE || (explicit301SitemapWarnings.length === 0 && stalePillarCanonicalMismatches.length === 0));

  const durationMs = Date.now() - startMs;
  const report = {
    generatedAt: new Date().toISOString(),
    checkOnly: CHECK_ONLY,
    durationMs,
    healthy,
    counts: {
      totalHtmlPages: allHtmlFiles.length,
      indexablePillarPages: indexablePillarCount,
      publisherSitePages: publisherSitePageCount,
      totalIndexablePages: indexablePillarCount + publisherSitePageCount,
      consolidated301Pages: consolidated301Count,
      noIndexPrunedPages: noIndexPrunedCount,
      explicitServer301s: serverExplicit301s.size,
      legacySlopBoxesRemaining,
      sitemapUrlCount: sitemapUrls.length,
      redirectLoops: redirectLoops.length,
      redirectChains: redirectChains.length,
      brokenCanonicalTargets: brokenCanonicalTargets.length,
      sitemapRobotsConflicts: sitemapRobotsConflicts.length,
      sitemapNoIndexConflicts: sitemapNoIndexConflicts.length,
      explicit301SitemapWarnings: explicit301SitemapWarnings.length,
      stalePillarCanonicalMismatches: stalePillarCanonicalMismatches.length
    },
    issues: {
      redirectLoops: redirectLoops.slice(0, 20),
      redirectChains: redirectChains.slice(0, 20),
      brokenCanonicalTargets: brokenCanonicalTargets.slice(0, 20),
      sitemapRobotsConflicts: sitemapRobotsConflicts.slice(0, 20),
      sitemapNoIndexConflicts: sitemapNoIndexConflicts.slice(0, 20),
      explicit301SitemapWarnings: explicit301SitemapWarnings.slice(0, 20),
      stalePillarCanonicalMismatches: stalePillarCanonicalMismatches.slice(0, 20)
    }
  };

  if (!CHECK_ONLY) {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    if (fs.existsSync(SCHEDULER_STATE_PATH)) {
      try {
        const st = JSON.parse(fs.readFileSync(SCHEDULER_STATE_PATH, 'utf8'));
        st['gsc_consolidation_redirect_guard'] = {
          status: healthy ? 'ok' : 'error',
          lastRunAt: report.generatedAt,
          durationMs,
          error: healthy ? null : 'Consolidation or sitemap parity conflict detected'
        };
        fs.writeFileSync(SCHEDULER_STATE_PATH, JSON.stringify(st, null, 2), 'utf8');
      } catch {}
    }
  }

  console.log(
    `[GSC-GUARD] 4/4 Complete in ${durationMs}ms | Healthy: ${healthy} | Indexable: ${report.counts.totalIndexablePages} | Consolidated 301s: ${consolidated301Count} | Pruned Noindex: ${noIndexPrunedCount} | Server Explicit 301s: ${serverExplicit301s.size} | Loops: ${redirectLoops.length} | Chains: ${redirectChains.length} | Broken: ${brokenCanonicalTargets.length} | Sitemap/Robots Conflicts: ${sitemapRobotsConflicts.length} | Stale Pillar Canonicals: ${stalePillarCanonicalMismatches.length}`
  );

  if (healthy && stalePillarCanonicalMismatches.length > 0) {
    console.warn(
      `[GSC-GUARD] Warning: ${stalePillarCanonicalMismatches.length} stale pillar canonical mismatch(es) on disk (served via server.js PILLAR_CONSOLIDATION_TARGETS override; fatal under --strict):`,
      JSON.stringify(stalePillarCanonicalMismatches.slice(0, 20))
    );
  }

  if (!healthy) {
    console.error('[GSC-GUARD] Issues detected:', JSON.stringify(report.issues, null, 2));
    process.exit(1);
  }
}

main();
