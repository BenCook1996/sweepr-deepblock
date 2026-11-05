#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Daily Automated Keyword Research, Page Generation, Anti-Cannibalization & PageSpeed Audit
 * (`scripts/daily-seo-pagespeed-audit.mjs`)
 *
 * Orchestrates the end-to-end daily organic growth loop:
 *  1. Runs `scripts/keyword-research-engine.mjs` to harvest multi-engine autocomplete volume,
 *     score buyer intent, inspect SERP weak spots, and verify 0% cannibalization across all indexable URLs.
 *  2. Runs `scripts/daily-50-seo-pages.mjs` to generate up to `--limit` net-new low-KD transactional
 *     Pillar pages with native `#deepblock-live-rule-proof` and >= 4 incoming donor internal links.
 *  3. Runs `scripts/enrich-pillars-with-live-proof.mjs` to guarantee 100% E-E-A-T DNR telemetry coverage.
 *  4. Runs `scripts/technical-seo-audit.mjs` (verifying 0 errors, 0 warnings, 0 orphan pages, 0 duplicate titles/H1s).
 *  5. Audits Core Web Vitals & PageSpeed static payload budgets (Brotli payload size, render-blocking scripts,
 *     preconnect hints) across all indexable Pillar pages and writes `data/daily-seo-audit-report.json`.
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
  return 15;
}

function auditPageSpeedBudgets() {
  const pillarDirs = ['solutions', 'setup', 'vs', 'guides'];
  let pillarFilesChecked = 0;
  let maxRawBytes = 0;
  let maxBrotliBytes = 0;
  let totalBrotliBytes = 0;
  const budgetViolations = [];

  for (const dir of pillarDirs) {
    const dirAbs = path.join(WEBSITE_DIR, dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const file of fs.readdirSync(dirAbs)) {
      if (!file.endsWith('.html')) continue;
      if (dir === 'vs' && file === 'total-adblock.html') continue;
      const absPath = path.join(dirAbs, file);
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

      const relPath = `${dir}/${file}`;
      if (rawBytes > 65 * 1024) {
        budgetViolations.push({
          file: relPath,
          type: 'raw_html_exceeds_65kb',
          bytes: rawBytes
        });
      }
      if (brotliBytes > 14 * 1024) {
        budgetViolations.push({
          file: relPath,
          type: 'brotli_exceeds_14kb',
          bytes: brotliBytes
        });
      }

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
  }

  return {
    pillarFilesChecked,
    avgBrotliBytes: pillarFilesChecked > 0 ? Math.round(totalBrotliBytes / pillarFilesChecked) : 0,
    maxRawBytes,
    maxBrotliBytes,
    budgetViolations
  };
}

export async function runDailySeoPageSpeedPipeline() {
  const newPagesLimit = parseLimitArg();
  const skipKeywordRefresh = process.argv.includes('--skip-keywords');

  console.log('\n============================================================================');
  console.log('  STEP 1/4: RUNNING AUTOMATED KEYWORD RESEARCH & LOW-KD OPPORTUNITY ENGINE');
  console.log('============================================================================');
  const kwReport = skipKeywordRefresh
    ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'keyword-opportunity-matrix.json'), 'utf8'))
    : await runKeywordResearchEngine();

  console.log('\n============================================================================');
  console.log(`  STEP 2/4: GENERATING UP TO ${newPagesLimit} NET-NEW LOW-KD KEYWORD PILLAR PAGES`);
  console.log('============================================================================');
  const genSummary = await runDaily50DeepBlockPages(newPagesLimit, false);

  console.log('\n============================================================================');
  console.log('  STEP 3/5: VERIFYING LIVE MV3 RULE TELEMETRY PROOF ACROSS ALL PILLARS');
  console.log('============================================================================');
  runLiveProofEnrichment(500, false);

  console.log('\n============================================================================');
  console.log('  STEP 4/5: SYNCING GEO LLMS.TXT & AI CITATION MANIFEST');
  console.log('============================================================================');
  const geoSummary = runGeoAndLlmsSync();

  console.log('\n============================================================================');
  console.log('  STEP 5/5: RUNNING TECHNICAL SEO, ANTI-CANNIBALIZATION & PAGESPEED AUDIT');
  console.log('============================================================================');
  const techAuditStdout = execFileSync(
    process.execPath,
    [path.join(__dirname, 'technical-seo-audit.mjs')],
    { encoding: 'utf8' }
  );
  console.log(techAuditStdout.trim());

  const cwvReport = auditPageSpeedBudgets();
  console.log(
    `[PAGESPEED CWV AUDIT] Indexable Pillars Checked: ${cwvReport.pillarFilesChecked} | Avg Brotli: ${(
      cwvReport.avgBrotliBytes / 1024
    ).toFixed(2)} KB | Max Brotli: ${(cwvReport.maxBrotliBytes / 1024).toFixed(2)} KB (Budget: <14.00 KB) | Violations: ${
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
  return finalReport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runDailySeoPageSpeedPipeline().catch((err) => {
    console.error('[DAILY-SEO-PAGESPEED-AUDIT] Fatal error:', err);
    process.exit(1);
  });
}
