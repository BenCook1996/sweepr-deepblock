#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Automated Daily 1,000-Site Ad-Filter Pipeline (`daily-ad-filter-pipeline.mjs`)
 *
 * Usage:
 *   node scripts/daily-ad-filter-pipeline.mjs [sampleSize=1000] [--git-mode=commit|push|pr|dry-run] [--concurrency=12] [--daemon]
 *
 * Stages:
 *   1. Daily Target Selection: Samples 1,000 unique ad-heavy sites (News, Gaming, Blogs, Entertainment, Recipes, Utilities)
 *      cross-referenced against `data/ad-filter-pipeline.sqlite` (30-day rolling deduplication window).
 *   2. Concurrent Headless Browser Evaluation & Multi-Layered Ad Detection:
 *      - DOM Inspection (visible third-party iframes, IAB ad dimensions 300x250 / 728x90, ad-slot/sponsored/dfp/taboola indicators)
 *      - Network Interception (200 OK third-party ad scripts/XHRs & CNAME-cloaked subdomains bypassing current MV3 rules)
 *      - Visual / DOM Snapshot Capture (`data/snapshots/`)
 *   3. Automated Rule Generation & Self-Healing Verification:
 *      - Synthesizes ABP/uBO rules (`||domain^$third-party`, `domain##.selector`) + MV3 DNR JSON rules
 *      - Verifies candidate rule blocks the ad AND preserves page layout/scroll/first-party scripts
 *   4. Project Repository Update & OTA Deployment:
 *      - Updates `extension/rules/static_ads_and_trackers.json`, `extension/rules/abp_filter_list.txt`,
 *        `extension/rules/dynamic_delta.json` (served live via `GET /api/filters/delta`), and `AD_FILTER_PIPELINE_LOG.md`
 *   5. CRM Logging & Reporting:
 *      - Sends per-site leak payloads + daily summary to the SWEEPR CRM API (`project=deepblock`) & custom webhook.
 */

import { PipelineStateDB } from './ad-filter-pipeline/state-db.mjs';
import { selectDailyTargetSites } from './ad-filter-pipeline/target-selector.mjs';
import { AdLeakBrowserScanner } from './ad-filter-pipeline/browser-scanner.mjs';
import { synthesizeBlockingRule, verifyCandidateRuleSelfHealing } from './ad-filter-pipeline/rule-generator.mjs';
import {
  applyVerifiedRulesToProject,
  appendPipelineAuditLog,
  deployRulesViaGit
} from './ad-filter-pipeline/git-deployer.mjs';
import { CrmPipelineReporter } from './ad-filter-pipeline/crm-reporter.mjs';

function parseArgs(argv) {
  const opts = {
    sampleSize: 1000,
    dedupWindowDays: 30,
    concurrency: 20,
    gitMode: process.env.GIT_DEPLOY_MODE || 'dry-run',
    daemon: false
  };

  for (const arg of argv.slice(2)) {
    if (/^\d+$/.test(arg)) {
      opts.sampleSize = Math.max(1, Math.min(5000, Number(arg)));
    } else if (arg.startsWith('--sample=')) {
      opts.sampleSize = Math.max(1, Math.min(5000, Number(arg.split('=')[1])));
    } else if (arg.startsWith('--dedup-days=')) {
      opts.dedupWindowDays = Math.max(1, Number(arg.split('=')[1]));
    } else if (arg.startsWith('--concurrency=')) {
      opts.concurrency = Math.max(1, Math.min(50, Number(arg.split('=')[1])));
    } else if (arg.startsWith('--git-mode=')) {
      opts.gitMode = arg.split('=')[1].trim();
    } else if (arg === '--daemon' || arg === '--cron') {
      opts.daemon = true;
    }
  }
  return opts;
}

export async function runDailyAdFilterPipeline(options = {}) {
  const sampleSize = Number(options.sampleSize || 1000);
  const dedupWindowDays = Number(options.dedupWindowDays || 30);
  const concurrency = Number(options.concurrency || 20);
  const gitMode = options.gitMode || 'dry-run';

  const startedAt = new Date().toISOString();
  const runId = `adpipe-${startedAt.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;

  console.log('======================================================================');
  console.log(`  SWEEPR DEEPBLOCK — DAILY 1,000-SITE AD-FILTER PIPELINE (${runId})`);
  console.log('======================================================================');
  console.log(`  Started At (UTC) : ${startedAt}`);
  console.log(`  Target Sample    : ${sampleSize} unique sites (${dedupWindowDays}-day deduplication)`);
  console.log(`  Worker Pool      : ${concurrency} concurrent contexts | Git Mode: ${gitMode}`);
  console.log('----------------------------------------------------------------------');

  const stateDb = new PipelineStateDB({ dedupWindowDays });

  try {
    // ========================================================================
    // STAGE 1: Target Selection & 30-Day Deduplication
    // ========================================================================
    const { selected, stats: selectionStats } = await selectDailyTargetSites(stateDb, {
      sampleSize,
      dedupWindowDays
    });
    console.log(
      `[Stage 1/5 — Target Selection] Selected ${selected.length} unique domains (Pool: ${selectionStats.totalPoolSize} | Excluded from last ${dedupWindowDays}d: ${selectionStats.recentlyScannedExcluded} | CRM Blocked Excluded: ${selectionStats.crmBlockedExcluded || 0})`
    );

    // ========================================================================
    // STAGE 2: Headless Browser Evaluation & Multi-Layer Ad Detection
    // ========================================================================
    const scanner = new AdLeakBrowserScanner({
      concurrency,
      maxPagesPerInstance: 50,
      navigationTimeoutMs: 10000,
      maxRetries: 2
    });

    let lastLogBucket = 0;
    const scanResults = await scanner.scanSitesBatch(selected, ({ completed, total }) => {
      const pct = Math.floor((completed / total) * 100);
      if (pct >= lastLogBucket + 25 || completed === total) {
        lastLogBucket = pct;
        console.log(`[Stage 2/5 — Browser Scanner] Evaluated ${completed}/${total} sites (${pct}%)...`);
      }
    });

    // ========================================================================
    // STAGE 3: Automated Rule Generation & Self-Healing Verification
    // ========================================================================
    const allEvaluatedLeaks = [];
    const seenRulesInRun = new Set();

    for (const siteRes of scanResults) {
      if (!siteRes || !Array.isArray(siteRes.leaks) || siteRes.leaks.length === 0) continue;

      for (const leak of siteRes.leaks) {
        const candidateRule = synthesizeBlockingRule(siteRes.domain, leak);
        if (!candidateRule || !candidateRule.generatedRule) continue;

        // Deduplicate identical rules synthesized within the same 1,000-site run
        if (seenRulesInRun.has(candidateRule.generatedRule)) continue;
        seenRulesInRun.add(candidateRule.generatedRule);

        const verification = await verifyCandidateRuleSelfHealing({
          targetUrl: siteRes.targetUrl,
          targetDomain: siteRes.domain,
          leak,
          candidateRule,
          existingDnrRules: scanner.blockerDefs.dnrRules
        });

        const record = {
          runId,
          timestamp: new Date().toISOString(),
          targetUrl: siteRes.targetUrl,
          domain: siteRes.domain,
          adTypeDetected: candidateRule.adTypeDetected,
          offendingArtifact: leak.offendingArtifact,
          generatedRule: candidateRule.generatedRule,
          dnrRule: candidateRule.dnrRule,
          candidateRule,
          fixStatus: verification.fixStatus,
          verificationNotes: verification.notes,
          commitHash: 'pending'
        };

        allEvaluatedLeaks.push(record);
      }
    }

    const autoPatched = allEvaluatedLeaks.filter((r) => r.fixStatus === 'Auto-Patched');
    const manualReview = allEvaluatedLeaks.filter((r) => r.fixStatus !== 'Auto-Patched');

    console.log(
      `[Stage 3/5 — Rule Synthesis & Verification] Leaks Evaluated: ${allEvaluatedLeaks.length} | Auto-Patched: ${autoPatched.length} | Manual Review: ${manualReview.length}`
    );

    // ========================================================================
    // STAGE 4: Project Filter List Update, OTA Delta & Git Deployment
    // ========================================================================
    const mergeStats = applyVerifiedRulesToProject(autoPatched, { runId });
    const gitResult = await deployRulesViaGit({
      gitMode,
      runId,
      autoPatchedCount: autoPatched.length
    });

    const commitRef = gitResult.prLink || gitResult.commitHash || 'local';

    appendPipelineAuditLog({
      runId,
      timestamp: new Date().toISOString(),
      sitesSampled: selected.length,
      sitesScanned: scanResults.length,
      leaksDetected: allEvaluatedLeaks.length,
      autoPatchedCount: autoPatched.length,
      manualReviewCount: manualReview.length,
      mergeStats,
      commitHash: commitRef,
      verifiedPatches: allEvaluatedLeaks
    });

    console.log(
      `[Stage 4/5 — Repository, Cross-Site Regression Guard & OTA Update] Added ${mergeStats.addedDnrRulesCount} new MV3 DNR rules & ${mergeStats.addedAbpRulesCount} ABP rules (Total MV3 DNR: ${mergeStats.totalStaticDnrRules} | Cross-Site Canaries: ${mergeStats.regressionAudit?.canariesPassed || 0}/${mergeStats.regressionAudit?.canariesTotal || 0} PASS | Commit Ref: ${commitRef})`
    );

    // Persist scanned domains & leak records into 30-day SQLite State DB
    stateDb.recordScannedDomains(
      scanResults.map((r) => ({
        domain: r.domain,
        category: r.category,
        status: r.status,
        leaksFound: Array.isArray(r.leaks) ? r.leaks.length : 0
      }))
    );

    for (const leakRec of allEvaluatedLeaks) {
      leakRec.commitHash = commitRef;
      stateDb.recordLeak({ ...leakRec, crmSynced: true });
    }

    // ========================================================================
    // STAGE 5: CRM Logging & Reporting
    // ========================================================================
    const crmReporter = new CrmPipelineReporter();
    const crmResult = await crmReporter.reportRunResultsToCrm({
      runId,
      leakRecords: allEvaluatedLeaks,
      scannedSites: scanResults,
      summary: {
        sitesSampled: selected.length,
        sitesScanned: scanResults.length,
        leaksDetected: allEvaluatedLeaks.length,
        rulesAutoPatched: autoPatched.length,
        manualReviewCount: manualReview.length
      },
      commitRef
    });

    stateDb.recordRunSummary({
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      sitesSampled: selected.length,
      sitesScanned: scanResults.length,
      leaksDetected: allEvaluatedLeaks.length,
      rulesAutoPatched: autoPatched.length,
      manualReviewCount: manualReview.length,
      commitHash: commitRef,
      crmSynced: crmResult.summarySynced
    });

    console.log(
      `[Stage 5/5 — CRM Reporting] Synced ${crmResult.syncedCount}/${crmResult.totalRecords} leak payloads + ${crmResult.registrySyncedCount || 0} blocked sites in CRM Registry + Daily Summary (${crmResult.summarySynced ? 'OK' : 'Queued in DLQ'})`
    );
    console.log('======================================================================\n');

    return {
      ok: true,
      runId,
      sitesSampled: selected.length,
      sitesScanned: scanResults.length,
      leaksDetected: allEvaluatedLeaks.length,
      rulesAutoPatched: autoPatched.length,
      manualReviewCount: manualReview.length,
      mergeStats,
      commitRef,
      crmResult
    };
  } finally {
    stateDb.close();
  }
}

/**
 * Built-in 00:00 UTC Daily Cron Daemon Mode (`--daemon`)
 */
function startUtcMidnightCronDaemon(opts) {
  console.log('[Scheduler] Starting 00:00 UTC daily cron daemon for SWEEPR DeepBlock Ad-Filter Pipeline...');
  let lastTriggeredDate = '';

  const checkSchedule = async () => {
    const now = new Date();
    const utcDateStr = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && lastTriggeredDate !== utcDateStr) {
      lastTriggeredDate = utcDateStr;
      try {
        await runDailyAdFilterPipeline(opts);
      } catch (err) {
        console.error('[Scheduler] Uncaught pipeline run error:', err);
      }
    }
  };

  setInterval(checkSchedule, 30000);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const cliOpts = parseArgs(process.argv);
  if (cliOpts.daemon) {
    startUtcMidnightCronDaemon(cliOpts);
  } else {
    runDailyAdFilterPipeline(cliOpts).catch((err) => {
      console.error('[AdFilterPipeline Fatal Error]', err);
      process.exitCode = 1;
    });
  }
}
