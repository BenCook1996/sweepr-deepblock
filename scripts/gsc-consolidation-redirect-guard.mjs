#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — GSC Consolidation & 301 Redirect Health Guard
 *
 * Continuously reconciles and audits the Google Search Console consolidation
 * & HTTP 301 redirect architecture across all PSEO clusters:
 *  1. Runs `consolidate-and-optimize-gsc.mjs` idempotently so any newly added
 *     `discoveredGscPaths` in `website/pillar-enrichment-state.json` or newly
 *     published keyword blueprints in `data/keyword-opportunity-matrix.json`
 *     are automatically promoted to self-canonicalized `index, follow` Pillars.
 *  2. Automatically runs `enrich-pillars-with-live-proof.mjs` if any indexable
 *     Pillar page is missing `#deepblock-live-rule-proof`.
 *  3. Audits all consolidated `noindex, follow` sub-variant pages (~1,291 URLs)
 *     to guarantee:
 *     - 0 redirect loops (self-canonical while marked noindex)
 *     - 0 redirect chains (canonical pointing to another noindex page)
 *     - 0 missing/404 canonical targets on disk
 *     - 0 `robots.txt` Disallow vs. `sitemap.xml` / `sitemap-sites.xml` conflicts
 *  4. Writes telemetry to `data/gsc-consolidation-health.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'gsc-consolidation-health.json');
const SCHEDULER_STATE_PATH = path.join(DATA_DIR, 'automation-scheduler-state.json');

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

function checkNeedsConsolidationSync(allHtmlFiles) {
  if (process.argv.includes('--force-sync')) return { needed: true, reason: '--force-sync flag' };

  const smPath = path.join(WEBSITE_DIR, 'sitemap.xml');
  const smXml = fs.existsSync(smPath) ? fs.readFileSync(smPath, 'utf8') : '';
  const smLocs = new Set([...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));

  const statePath = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      for (const p of st.discoveredGscPaths || []) {
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
        const route = opp.targetRoute || opp.recommendedUrlPath;
        if (opp.isPublishedOnDisk && route) {
          const fullUrl = `https://sweeprdeepblock.com${route}`;
          if (!smLocs.has(fullUrl)) {
            return { needed: true, reason: `published keyword blueprint ${route} not yet in sitemap.xml` };
          }
        }
      }
    } catch {}
  }

  for (const f of allHtmlFiles) {
    const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
    if (!/^(solutions|setup|vs|guides)\//i.test(rel)) continue;
    const raw = fs.readFileSync(f, 'utf8');
    const isNoIndex = /meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw);
    if (!isNoIndex) continue;
    const selfUrl = `https://sweeprdeepblock.com/${rel.replace(/\.html$/, '')}`;
    const canMatch = raw.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    if (!canMatch || canMatch[1].trim() === selfUrl) {
      return { needed: true, reason: `unconsolidated noindex self-canonical on ${rel}` };
    }
  }

  return { needed: false, reason: 'in_sync' };
}

function main() {
  const startMs = Date.now();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let allHtmlFiles = walkHtml(WEBSITE_DIR);
  const syncCheck = checkNeedsConsolidationSync(allHtmlFiles);
  if (syncCheck.needed) {
    console.log(`[GSC-GUARD] 1/4 Drift detected (${syncCheck.reason}); running consolidate-and-optimize-gsc.mjs...`);
    execFileSync(process.execPath, [path.join(__dirname, 'consolidate-and-optimize-gsc.mjs')], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    allHtmlFiles = walkHtml(WEBSITE_DIR);
  } else {
    console.log('[GSC-GUARD] 1/4 Consolidation state already 100% in sync (0 new unpromoted paths).');
  }
  let missingProofCount = 0;
  for (const f of allHtmlFiles) {
    const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
    if (!/^(solutions|setup|vs|guides)\//i.test(rel) || rel === 'vs/total-adblock.html') continue;
    const raw = fs.readFileSync(f, 'utf8');
    if (/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw)) continue;
    if (!raw.includes('id="deepblock-live-rule-proof"')) {
      missingProofCount++;
    }
  }

  if (missingProofCount > 0) {
    console.log(`[GSC-GUARD] 2/4 Detected ${missingProofCount} Pillar(s) missing #deepblock-live-rule-proof; running enrich-pillars-with-live-proof.mjs...`);
    execFileSync(process.execPath, [path.join(__dirname, 'enrich-pillars-with-live-proof.mjs')], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
  } else {
    console.log('[GSC-GUARD] 2/4 All indexable Pillars already contain #deepblock-live-rule-proof.');
  }

  console.log('[GSC-GUARD] 3/4 Auditing 301 consolidation targets, redirect chains, and robots.txt parity...');
  const routeMap = new Map();
  for (const f of allHtmlFiles) {
    const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
    const clean = toCleanRoute(rel);
    const raw = fs.readFileSync(f, 'utf8');
    const isNoIndex = /meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw);
    const canMatch = raw.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const canonicalUrl = canMatch ? canMatch[1].trim() : null;
    const canonicalPath = canonicalUrl
      ? canonicalUrl.replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/'
      : null;
    routeMap.set(clean, {
      rel,
      clean,
      isNoIndex,
      canonicalUrl,
      canonicalPath
    });
  }

  const redirectLoops = [];
  const redirectChains = [];
  const brokenCanonicalTargets = [];
  let consolidated301Count = 0;
  let indexablePillarCount = 0;
  let publisherSitePageCount = 0;

  for (const rec of routeMap.values()) {
    if (rec.rel.startsWith('site/')) {
      if (!rec.isNoIndex) publisherSitePageCount++;
      continue;
    }
    if (!rec.isNoIndex) {
      indexablePillarCount++;
      continue;
    }
    if (/^(solutions|setup|vs|guides)\//i.test(rec.rel)) {
      consolidated301Count++;
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

  // Check robots.txt Disallow vs. sitemap.xml + sitemap-sites.xml
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
  for (const smFile of ['sitemap.xml', 'sitemap-sites.xml']) {
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
  }

  const healthy =
    redirectLoops.length === 0 &&
    redirectChains.length === 0 &&
    brokenCanonicalTargets.length === 0 &&
    sitemapRobotsConflicts.length === 0 &&
    sitemapNoIndexConflicts.length === 0;

  const durationMs = Date.now() - startMs;
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs,
    healthy,
    counts: {
      totalHtmlPages: allHtmlFiles.length,
      indexablePillarPages: indexablePillarCount,
      publisherSitePages: publisherSitePageCount,
      totalIndexablePages: indexablePillarCount + publisherSitePageCount,
      consolidated301Pages: consolidated301Count,
      sitemapUrlCount: sitemapUrls.length,
      redirectLoops: redirectLoops.length,
      redirectChains: redirectChains.length,
      brokenCanonicalTargets: brokenCanonicalTargets.length,
      sitemapRobotsConflicts: sitemapRobotsConflicts.length,
      sitemapNoIndexConflicts: sitemapNoIndexConflicts.length
    },
    issues: {
      redirectLoops: redirectLoops.slice(0, 20),
      redirectChains: redirectChains.slice(0, 20),
      brokenCanonicalTargets: brokenCanonicalTargets.slice(0, 20),
      sitemapRobotsConflicts: sitemapRobotsConflicts.slice(0, 20),
      sitemapNoIndexConflicts: sitemapNoIndexConflicts.slice(0, 20)
    }
  };

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

  console.log(
    `[GSC-GUARD] 4/4 Complete in ${durationMs}ms | Healthy: ${healthy} | Indexable: ${report.counts.totalIndexablePages} (${indexablePillarCount} Pillars + ${publisherSitePageCount} Publisher) | Consolidated 301s: ${consolidated301Count} | Loops: ${redirectLoops.length} | Chains: ${redirectChains.length} | Broken: ${brokenCanonicalTargets.length} | Sitemap/Robots Conflicts: ${sitemapRobotsConflicts.length}`
  );

  if (!healthy) {
    console.error('[GSC-GUARD] Issues detected:', JSON.stringify(report.issues, null, 2));
    process.exit(1);
  }
}

main();
