#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Automated Funnel Drop-Off & Strike-Zone CRO Analyzer (`scripts/funnel-cro-analyzer.mjs`)
 *
 * Continuously evaluates:
 *   1. The 5-stage activation & monetization funnel (`Install` -> `Permissions Granted` -> `First Value / Test Lab` -> `Paywall Exposure` -> `Checkout + £89.99/yr Suite Attach`)
 *   2. Paywall Multi-Armed Bandit RPV performance (`data/ab-experiments-state.json`)
 *   3. SEO Strike-Zone & CTR Enrichment candidates (`data/keyword-opportunity-matrix.json`)
 *
 * Outputs:
 *   - `data/live-unit-economics.json` (consumed directly by `scripts/reinvestment-stage-gate.mjs`)
 *   - `data/cro-funnel-diagnostics.json` (served by `GET /api/cro/funnel-health` in `server.js`)
 *
 * Strictly £0.00 cost and 0 automated emails.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AB_STATE_PATH = path.join(DATA_DIR, 'ab-experiments-state.json');
const KEYWORD_MATRIX_PATH = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
const FUNNEL_EVENTS_PATH = path.join(DATA_DIR, 'telemetry-funnel-events.json');
const LIVE_ECON_OUT = path.join(DATA_DIR, 'live-unit-economics.json');
const CRO_DIAG_OUT = path.join(DATA_DIR, 'cro-funnel-diagnostics.json');

function readJsonSafe(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return fallback;
}

export function runFunnelCroAnalyzer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const abState = readJsonSafe(AB_STATE_PATH, { variants: {} });
  const kwMatrix = readJsonSafe(KEYWORD_MATRIX_PATH, { opportunities: [], ctrEnrichmentQueue: [] });
  const rawFunnel = readJsonSafe(FUNNEL_EVENTS_PATH, {});

  // Aggregate real, unfloored funnel telemetry counters (zero synthetic cold-start floors)
  const storeAndDownloadViews = Math.max(0, Number(rawFunnel.storeAndDownloadViews ?? 0));
  const extensionInstalls = Math.max(0, Number(rawFunnel.extensionInstalls ?? 0));
  const permissionsGranted = Math.max(0, Number(rawFunnel.permissionsGranted ?? 0));
  const firstValueAhaMoment = Math.max(0, Number(rawFunnel.firstValueAhaMoment ?? 0));
  const paywallExposures = Math.max(0, Number(rawFunnel.paywallExposures ?? 0));
  const totalPaidCheckouts = Math.max(0, Number(rawFunnel.totalPaidCheckouts ?? 0));
  const suiteAnnualCheckouts = Math.max(0, Number(rawFunnel.suiteAnnualCheckouts ?? 0));
  const refunds14d = Math.max(0, Number(rawFunnel.refunds14d ?? 0));

  const installRatePct = storeAndDownloadViews > 0 ? +((extensionInstalls / storeAndDownloadViews) * 100).toFixed(1) : 0;
  const permissionActivationRatePct = extensionInstalls > 0 ? +((permissionsGranted / extensionInstalls) * 100).toFixed(1) : 0;
  const ahaCompletionRatePct = permissionsGranted > 0 ? +((firstValueAhaMoment / permissionsGranted) * 100).toFixed(1) : 0;
  const freeToProCheckoutRatePct = extensionInstalls > 0 ? +((totalPaidCheckouts / extensionInstalls) * 100).toFixed(2) : 0;
  const suiteAttachRatePct = totalPaidCheckouts > 0 ? +((suiteAnnualCheckouts / totalPaidCheckouts) * 100).toFixed(1) : 0;
  const refundRate14dPct = totalPaidCheckouts > 0 ? +((refunds14d / totalPaidCheckouts) * 100).toFixed(1) : 0;

  const proAnnualPriceGbp = 29.99;
  const suiteAnnualPriceGbp = 89.99;
  const year1BlendedAovGbp =
    totalPaidCheckouts > 0
      ? +((1 - suiteAttachRatePct / 100) * proAnnualPriceGbp + (suiteAttachRatePct / 100) * suiteAnnualPriceGbp).toFixed(2)
      : 0;
  const blendedNetLtvGbp = totalPaidCheckouts > 0 ? +(year1BlendedAovGbp * 1.14).toFixed(2) : 0;
  const blendedCacGbp = Number(rawFunnel.blendedCacGbp) > 0 ? Number(rawFunnel.blendedCacGbp) : null;
  const ltvToCacRatio = blendedCacGbp && blendedNetLtvGbp > 0 ? +(blendedNetLtvGbp / blendedCacGbp).toFixed(2) : null;
  const hasMinimumConversionSample = totalPaidCheckouts >= 10;

  const funnelStages = [
    {
      stageId: '1_store_or_download_to_install',
      name: 'Download / Store Listing -> Extension Installed',
      visitorsIn: storeAndDownloadViews,
      conversionsOut: extensionInstalls,
      conversionRatePct: installRatePct,
      targetRatePct: 28.0,
      status: storeAndDownloadViews === 0 ? 'INSUFFICIENT_TELEMETRY' : installRatePct >= 28.0 ? 'HEALTHY' : 'NEEDS_CRO_ATTENTION',
      automatedRemedy:
        storeAndDownloadViews > 0 && installRatePct >= 28.0
          ? 'Maintain 1-click browser-detected download CTA and live 8/8 Test Lab proof badge on /download.'
          : 'Promote interactive 8/8 Test Lab widget above the fold on /download and /vs/* pages.'
    },
    {
      stageId: '2_install_to_permissions_granted',
      name: 'Extension Installed -> MV3 Permissions Activated',
      visitorsIn: extensionInstalls,
      conversionsOut: permissionsGranted,
      conversionRatePct: permissionActivationRatePct,
      targetRatePct: 85.0,
      status: extensionInstalls === 0 ? 'INSUFFICIENT_TELEMETRY' : permissionActivationRatePct >= 85.0 ? 'HEALTHY' : 'BOTTLENECK_DETECTED',
      automatedRemedy:
        extensionInstalls > 0 && permissionActivationRatePct >= 85.0
          ? 'Keep 2-step annotated permission visual guide active on /welcome.'
          : 'Trigger simplified single-screen permission activation modal in extension onboarding.'
    },
    {
      stageId: '3_permissions_to_aha_moment_60s',
      name: 'Permissions Activated -> First 100 Trackers Blocked / 8/8 Test Lab Run (<60s)',
      visitorsIn: permissionsGranted,
      conversionsOut: firstValueAhaMoment,
      conversionRatePct: ahaCompletionRatePct,
      targetRatePct: 75.0,
      status: permissionsGranted === 0 ? 'INSUFFICIENT_TELEMETRY' : ahaCompletionRatePct >= 75.0 ? 'HEALTHY' : 'NEEDS_CRO_ATTENTION',
      automatedRemedy:
        permissionsGranted > 0 && ahaCompletionRatePct >= 75.0
          ? 'Continue auto-opening live 8/8 Test Lab verification receipt upon installation.'
          : 'Auto-run 5-second Test Lab diagnostic on /welcome immediately after install.'
    },
    {
      stageId: '4_active_free_to_pro_checkout',
      name: 'Active Free User -> Paid Pro / Suite Checkout',
      visitorsIn: extensionInstalls,
      conversionsOut: totalPaidCheckouts,
      conversionRatePct: freeToProCheckoutRatePct,
      targetRatePct: 4.2,
      status: extensionInstalls === 0 || !hasMinimumConversionSample ? 'INSUFFICIENT_TELEMETRY' : freeToProCheckoutRatePct >= 4.2 ? 'HEALTHY' : 'NEEDS_CRO_ATTENTION',
      automatedRemedy:
        'Paywall Multi-Armed Bandit routes 80% of traffic to highest-RPV framing while testing £1.99 Intro vs £29.99/yr Pro vs £89.99/yr Complete Suite.'
    },
    {
      stageId: '5_pro_checkout_to_complete_suite_bundle',
      name: 'Paid Checkout -> £89.99/yr Sweepr Complete Security Suite Attach',
      visitorsIn: totalPaidCheckouts,
      conversionsOut: suiteAnnualCheckouts,
      conversionRatePct: suiteAttachRatePct,
      targetRatePct: 20.0,
      status: totalPaidCheckouts === 0 ? 'INSUFFICIENT_TELEMETRY' : suiteAttachRatePct >= 20.0 ? 'HEALTHY' : 'BUNDLE_UPSELL_OPPORTUNITY',
      automatedRemedy:
        totalPaidCheckouts > 0 && suiteAttachRatePct >= 20.0
          ? 'Keep 4-in-1 Sweepr Complete Security Suite (£89.99/yr — Save 45%) highlighted across sweeprdeepblock.com, sweeprvpn.com, and sweeprcleaner.com.'
          : 'Increase bandit exploration weight on ram_speedometer_bundle variant pre-selecting /order?plan=suite_annual.'
    }
  ];

  // Evaluate Strike-Zone SEO & CTR Enrichment opportunities
  const strikeZonePrescriptions = (kwMatrix.opportunities || [])
    .filter((o) => o.isPublishedOnDisk)
    .slice(0, 10)
    .map((o) => ({
      keyword: o.keyword,
      targetRoute: o.targetRoute,
      estimatedKD: o.metrics?.estimatedKD,
      opportunityScore: o.metrics?.opportunityScore,
      primaryCta: o.pageBlueprint?.primaryCta?.href || '/order?plan=annual',
      recommendedTool: o.pageBlueprint?.recommendedToolWidget?.toolRoute || '/test-lab',
      status: 'PUBLISHED_AND_INTERLINKED'
    }));

  const liveUnitEconomics = {
    updatedAt: new Date().toISOString(),
    dataMode: 'real_telemetry_unfloored',
    dailySpendGbp: 10.0,
    storeAndDownloadViews,
    extensionInstalls,
    permissionsGranted,
    firstValueAhaMoment,
    paywallExposures,
    totalPaidCheckouts,
    suiteAnnualCheckouts,
    refunds14d,
    hasMinimumConversionSample,
    blendedCacGbp,
    year1BlendedAovGbp,
    blendedNetLtvGbp,
    ltvToCacRatio,
    permissionActivationRatePct,
    freeToProCheckoutRatePct,
    suiteAttachRatePct,
    refundRate14dPct,
    pricingTiersGbp: {
      introMonthly: 1.99,
      monthlyStandard: 4.99,
      sixMonthPro: 19.99,
      annualPro: 29.99,
      completeSuiteAnnual: 89.99
    }
  };
  fs.writeFileSync(LIVE_ECON_OUT, JSON.stringify(liveUnitEconomics, null, 2), 'utf8');

  const diagnosticsReport = {
    generatedAt: new Date().toISOString(),
    dataMode: 'real_telemetry_unfloored',
    totalPaidCheckouts,
    hasMinimumConversionSample,
    overallHealth: funnelStages.every((s) => s.status === 'HEALTHY')
      ? 'OPTIMAL'
      : funnelStages.some((s) => s.status === 'INSUFFICIENT_TELEMETRY')
      ? 'INSUFFICIENT_TELEMETRY'
      : 'ACTION_RECOMMENDED',
    unitEconomics: liveUnitEconomics,
    funnelStages,
    paywallBanditSnapshot: abState,
    strikeZoneSeoPrescriptions: strikeZonePrescriptions,
    ctrEnrichmentTargetsQueued: (kwMatrix.ctrEnrichmentQueue || []).length
  };
  fs.writeFileSync(CRO_DIAG_OUT, JSON.stringify(diagnosticsReport, null, 2), 'utf8');

  console.log(
    `[CRO Funnel Analyzer] Mode: real_telemetry_unfloored | Health: ${diagnosticsReport.overallHealth} | Installs: ${extensionInstalls} | Paid Checkouts: ${totalPaidCheckouts} | Activation: ${permissionActivationRatePct}% | Free->Paid: ${freeToProCheckoutRatePct}% | Blended AOV: £${year1BlendedAovGbp} | Net LTV: £${blendedNetLtvGbp}`
  );
  return diagnosticsReport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runFunnelCroAnalyzer();
}
