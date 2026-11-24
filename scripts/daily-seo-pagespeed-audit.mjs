#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Daily Automated Keyword Research, Page Generation, Anti-Cannibalization & PageSpeed Audit
 * (`scripts/daily-seo-pagespeed-audit.mjs`)
 *
 * Orchestrates the end-to-end daily organic growth loop:
 *  1. Runs `scripts/keyword-research-engine.mjs` to harvest multi-engine autocomplete volume,
 *     score buyer intent, inspect SERP weak spots, and verify 0% cannibalization across all indexable URLs.
 *  2. Runs `scripts/daily-50-seo-pages.mjs` to generate up to `--limit` net-new low-KD transactional
 *     Pillar pages using the Holographic Pearl shell and >= 4 incoming donor internal links.
 *  3. Runs `scripts/enrich-pillars-with-live-proof.mjs` to strip legacy dark slop blocks and normalize `v1.3.1`.
 *  4. Runs `scripts/gsc-consolidation-redirect-guard.mjs` to verify 0 loops/chains/broken canonicals.
 *  5. Rebuilds category hubs, sculpts internal links, optimizes strike-zone links, and syncs GEO/LLMs manifests.
 *  6. Runs `scripts/technical-seo-audit.mjs` and audits Core Web Vitals & PageSpeed static payload budgets
 *     (Brotli < 20 KB, raw HTML < 85 KB, zero runtime Tailwind CDN) and writes `data/daily-seo-audit-report.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runKeywordResearchEngine } from './keyword-research-engine.mjs';
import { runDaily50DeepBlockPages } from './daily-50-seo-pages.mjs';
import { runLiveProofEnrichment } from './enrich-pillars-with-live-proof.mjs';
import { runGeoAndLlmsSync } from './sync-geo-and-llms.mjs';
import { logSeoChangesToCrm } from './log-seo-changes-to-crm.mjs';
import { buildCategoryHubs } from './build-category-hubs.mjs';
import { sculptInternalLinks } from './sculpt-internal-links.mjs';
import { runGscStrikeZoneOptimizer } from './gsc-strike-zone-optimizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REPORT_OUTPUT_PATH = path.join(DATA_DIR, 'daily-seo-audit-report.json');

function parseLimitArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) {
      const n = Number(arg.split('=')[1]);
      if (!Number.isNaN(n) && n >= 0) return n;
    } else if (!arg.startsWith('--')) {
      const n = Number(arg);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  return 0;
}

function auditPageSpeedBudgets() {
  const candidates = [];
  for (const rootFile of ['index.html', 'pricing.html', 'download.html', 'benchmarks.html', 'test-lab.html']) {
    const abs = path.join(WEBSITE_DIR, rootFile);
    if (fs.existsSync(abs)) candidates.push({ absPath: abs, relPath: rootFile });
  }
  for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
    const dirAbs = path.join(WEBSITE_DIR, dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const file of fs.readdirSync(dirAbs)) {
      if (!file.endsWith('.html')) continue;
      candidates.push({ absPath: path.join(dirAbs, file), relPath: `${dir}/${file}` });
    }
  }

  let pillarFilesChecked = 0;
  let maxRawBytes = 0;
  let maxBrotliBytes = 0;
  let totalBrotliBytes = 0;
  let brotliWarnCount = 0;
  let holographicShellPages = 0;
  let legacyDarkThemePages = 0;
  let v131Pages = 0;
  let staleV12Pages = 0;
  const budgetViolations = [];

  for (const { absPath, relPath } of candidates) {
    const html = fs.readFileSync(absPath, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;

    pillarFilesChecked++;
    const rawBuf = Buffer.from(html, 'utf8');
    const brotliBuf = zlib.brotliCompressSync(rawBuf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
    });

    const rawBytes = rawBuf.length;
    const brotliBytes = brotliBuf.length;
    if (rawBytes > maxRawBytes) maxRawBytes = rawBytes;
    if (brotliBytes > maxBrotliBytes) maxBrotliBytes = brotliBytes;
    totalBrotliBytes += brotliBytes;

    if (brotliBytes > 14 * 1024) brotliWarnCount++;

    if (rawBytes > 85 * 1024) {
      budgetViolations.push({
        file: relPath,
        type: 'raw_html_exceeds_85kb',
        bytes: rawBytes
      });
    }
    if (brotliBytes > 20 * 1024) {
      budgetViolations.push({
        file: relPath,
        type: 'brotli_exceeds_20kb',
        bytes: brotliBytes
      });
    }
    if (/<script\b[^>]*cdn\.tailwindcss\.com/i.test(html)) {
      budgetViolations.push({
        file: relPath,
        type: 'runtime_tailwind_cdn'
      });
    }

    const isLightShell =
      /<meta\s+name=["']color-scheme["']\s+content=["']light["']/i.test(html) &&
      /class=["'][^"']*\bglass-nav\b/i.test(html) &&
      !/background\s*:\s*(?:#090d16|#0b0f19)/i.test(html);
    if (isLightShell) holographicShellPages++;
    else legacyDarkThemePages++;

    if (/\bv?1\.3\.1\b/.test(html)) v131Pages++;
    if (/\bv?1\.2\.\d+\b/i.test(html)) staleV12Pages++;

    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const headHtml = headMatch[1];
      const extScripts = [...headHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
      for (const sm of extScripts) {
        const tag = sm[0];
        if (!/\b(async|defer)\b/i.test(tag)) {
          budgetViolations.push({
            file: relPath,
            type: 'render_blocking_head_script',
            scriptSrc: sm[1]
          });
        }
      }
    }
  }

  return {
    pillarFilesChecked,
    avgBrotliBytes: pillarFilesChecked > 0 ? Math.round(totalBrotliBytes / pillarFilesChecked) : 0,
    maxRawBytes,
    maxBrotliBytes,
    brotliWarnCount,
    holographicShellPages,
    legacyDarkThemePages,
    v131Pages,
    staleV12Pages,
    budgetViolations
  };
}

export async function runDailySeoPageSpeedPipeline() {
  const newPagesLimit = parseLimitArg();
  const skipKeywordRefresh = process.argv.includes('--skip-keywords');

  console.log('\n============================================================================');
  console.log('  STEP 1/6: RUNNING AUTOMATED KEYWORD RESEARCH & LOW-KD OPPORTUNITY ENGINE');
  console.log('============================================================================');
  const kwReport = skipKeywordRefresh
    ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'keyword-opportunity-matrix.json'), 'utf8'))
    : await runKeywordResearchEngine();

  console.log('\n============================================================================');
  console.log(`  STEP 2/6: GENERATING UP TO ${newPagesLimit} NET-NEW LOW-KD KEYWORD PILLAR PAGES`);
  console.log('============================================================================');
  const genSummary = await runDaily50DeepBlockPages(newPagesLimit, false);

  console.log('\n============================================================================');
  console.log('  STEP 3/6: STRIPPING LEGACY DARK SLOP BLOCKS & NORMALIZING PILLARS');
  console.log('============================================================================');
  runLiveProofEnrichment(500, false);

  console.log('\n============================================================================');
  console.log('  STEP 4/6: RUNNING GSC CONSOLIDATION & 301 REDIRECT HEALTH GUARD');
  console.log('============================================================================');
  const guardStdout = execFileSync(
    process.execPath,
    [path.join(__dirname, 'gsc-consolidation-redirect-guard.mjs')],
    { encoding: 'utf8' }
  );
  console.log(guardStdout.trim());

  console.log('\n============================================================================');
  console.log('  STEP 5/6: REBUILDING CATEGORY HUBS, SCULPTING LINKS & SYNCING GEO MANIFEST');
  console.log('============================================================================');
  buildCategoryHubs();
  sculptInternalLinks();
  runGscStrikeZoneOptimizer();
  const geoSummary = runGeoAndLlmsSync();

  console.log('\n============================================================================');
  console.log('  STEP 6/6: RUNNING TECHNICAL SEO, ANTI-CANNIBALIZATION & PAGESPEED AUDIT');
  console.log('============================================================================');
  const techAuditStdout = execFileSync(
    process.execPath,
    [path.join(__dirname, 'technical-seo-audit.mjs')],
    { encoding: 'utf8' }
  );
  console.log(techAuditStdout.trim());

  const cwvReport = auditPageSpeedBudgets();
  console.log(
    `[PAGESPEED CWV AUDIT] Indexable Pages Checked: ${cwvReport.pillarFilesChecked} | Avg Brotli: ${(
      cwvReport.avgBrotliBytes / 1024
    ).toFixed(2)} KB | Max Brotli: ${(cwvReport.maxBrotliBytes / 1024).toFixed(2)} KB (Budget: <20.00 KB, >14 KB warns: ${cwvReport.brotliWarnCount}) | Light Shell: ${cwvReport.holographicShellPages}/${cwvReport.pillarFilesChecked} | Violations: ${
      cwvReport.budgetViolations.length
    }`
  );

  if (cwvReport.budgetViolations.length > 0) {
    console.error('[PAGESPEED CWV AUDIT] Budget violations detected:', cwvReport.budgetViolations);
    process.exitCode = 1;
  }

  const finalReport = {
    generatedAt: new Date().toISOString(),
    status: cwvReport.budgetViolations.length === 0 ? 'PASS' : 'FAIL',
    keywordEngineSummary: kwReport?.summary || {},
    pageGenerationSummary: genSummary,
    geoSyncSummary: geoSummary,
    pageSpeedCwvAudit: cwvReport
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(finalReport, null, 2), 'utf8');

  if (!process.argv.includes('--no-crm')) {
    try {
      await logSeoChangesToCrm();
    } catch (crmErr) {
      console.warn('[DAILY-SEO-PAGESPEED-AUDIT] CRM logging warning:', crmErr?.message || crmErr);
    }
  }
  return finalReport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runDailySeoPageSpeedPipeline().catch((err) => {
    console.error('[DAILY-SEO-PAGESPEED-AUDIT] Fatal error:', err);
    process.exit(1);
  });
}
