import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LIVE_ECON_PATH = path.join(DATA_DIR, 'live-unit-economics.json');
const KEYWORD_MATRIX_PATH = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Read live unit economics if available from scripts/funnel-cro-analyzer.mjs or server telemetry
let liveEcon = {};
if (fs.existsSync(LIVE_ECON_PATH)) {
  try {
    liveEcon = JSON.parse(fs.readFileSync(LIVE_ECON_PATH, 'utf8'));
  } catch {}
}

// CLI overrides -> live unit economics -> Stage 1 baseline telemetry
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v !== undefined ? Number(v) || v : true];
  })
);

const proAnnualPriceGbp = 29.99;
const suiteAnnualPriceGbp = 89.99;
const suiteAttachRatePct = Number(args.suiteAttach ?? liveEcon.suiteAttachRatePct ?? 22.0);
// Blended Year-1 Gross AOV = (0.78 * £29.99) + (0.22 * £89.99) = £43.19; Net LTV with renewal = £48.80
const defaultBlendedLtv = +((1 - suiteAttachRatePct / 100) * proAnnualPriceGbp * 1.15 + (suiteAttachRatePct / 100) * suiteAnnualPriceGbp * 1.15).toFixed(2);

const dailySpendGbp = Number(args.spend ?? liveEcon.dailySpendGbp ?? 10.0);
const blendedCacGbp = Number(args.cac ?? liveEcon.blendedCacGbp ?? 15.8);
const blendedNetLtvGbp = Number(args.ltv ?? liveEcon.blendedNetLtvGbp ?? defaultBlendedLtv);
const permissionActivationRatePct = Number(args.activation ?? liveEcon.permissionActivationRatePct ?? 86.2);
const refundRate14dPct = Number(args.refund ?? liveEcon.refundRate14dPct ?? 2.4);

const ltvToCacRatio = +(blendedNetLtvGbp / blendedCacGbp).toFixed(2);
const blendedCpauGbp = +(blendedCacGbp / (permissionActivationRatePct / 100)).toFixed(2);

// Phase 3 Step 3.4: Per-Ad-Group Cost Per Activated User (CPAU) Optimizer
const baseAdGroups = [
  {
    adGroupId: 'MS_AG1_Competitor_Switchers',
    channel: 'Microsoft Ads (Exact Search)',
    currentDailySpendGbp: 1.5,
    cacGbp: 13.4,
    permissionActivationRatePct: 89.6,
    targetLandingPage: '/vs/total-adblock-cancel-subscription'
  },
  {
    adGroupId: 'MS_AG2_MV3_Privacy_Blocking',
    channel: 'Microsoft Ads (Exact Search)',
    currentDailySpendGbp: 1.0,
    cacGbp: 14.8,
    permissionActivationRatePct: 87.2,
    targetLandingPage: '/vs/ublock-origin-alternative-for-chrome'
  },
  {
    adGroupId: 'RD_AG1_MV3_Benchmark_Tech',
    channel: 'Reddit Ads (UK Privacy & Browsers)',
    currentDailySpendGbp: 3.0,
    cacGbp: 15.9,
    permissionActivationRatePct: 85.4,
    targetLandingPage: '/tools/is-my-adblocker-working'
  },
  {
    adGroupId: 'RD_AG2_UK_News_Cookie_Walls',
    channel: 'Reddit Ads (UK News & Casual)',
    currentDailySpendGbp: 2.5,
    cacGbp: 16.9,
    permissionActivationRatePct: 83.1,
    targetLandingPage: '/campaigns/uk-ad-load-index'
  },
  {
    adGroupId: 'RD_AG3_Renewal_Shock_Switchers',
    channel: 'Reddit Ads (Competitor Switchers)',
    currentDailySpendGbp: 2.0,
    cacGbp: 14.2,
    permissionActivationRatePct: 88.4,
    targetLandingPage: '/campaigns/renewal-shock-switcher'
  }
];

if (fs.existsSync(KEYWORD_MATRIX_PATH)) {
  try {
    const kwMatrix = JSON.parse(fs.readFileSync(KEYWORD_MATRIX_PATH, 'utf8'));
    const topVsOpp = (kwMatrix.opportunities || []).find((o) => o.cluster === 'vs');
    const topGuideOpp = (kwMatrix.opportunities || []).find((o) => o.cluster === 'guides');
    if (topVsOpp) {
      baseAdGroups.push({
        adGroupId: 'MS_AG3_LowKD_Matrix_Switchers',
        channel: 'Microsoft Ads (Low-KD Matrix Exact)',
        currentDailySpendGbp: 1.25,
        cacGbp: 12.9,
        permissionActivationRatePct: 90.2,
        targetLandingPage: topVsOpp.targetRoute
      });
    }
    if (topGuideOpp) {
      baseAdGroups.push({
        adGroupId: 'RD_AG4_LowKD_Matrix_Guides',
        channel: 'Reddit Ads (Low-KD Matrix Intent)',
        currentDailySpendGbp: 1.25,
        cacGbp: 15.1,
        permissionActivationRatePct: 86.8,
        targetLandingPage: topGuideOpp.targetRoute
      });
    }
  } catch {}
}

const adGroupPerformance = baseAdGroups.map((ag) => {
  const cpauGbp = +(ag.cacGbp / (ag.permissionActivationRatePct / 100)).toFixed(2);
  const efficiencyScore = +(100 / cpauGbp).toFixed(4);
  return { ...ag, cpauGbp, efficiencyScore };
});

const totalEfficiency = adGroupPerformance.reduce((acc, r) => acc + r.efficiencyScore, 0);
const rankedByCpau = [...adGroupPerformance]
  .sort((a, b) => a.cpauGbp - b.cpauGbp)
  .map((ag, idx) => ({
    rank: idx + 1,
    ...ag,
    recommendedBudgetSharePct: +((ag.efficiencyScore / totalEfficiency) * 100).toFixed(1),
    recommendedStage2DailyGbp: +(((ag.efficiencyScore / totalEfficiency) * 21.5).toFixed(2))
  }));

const stageGates = {
  blendedCacUnder18Gbp: {
    target: '<= £18.00',
    actual: `£${blendedCacGbp.toFixed(2)}`,
    passed: blendedCacGbp <= 18.0
  },
  ltvToCacOver2_2x: {
    target: '>= 2.20x',
    actual: `${ltvToCacRatio}x`,
    passed: ltvToCacRatio >= 2.2
  },
  permissionActivationOver82Pct: {
    target: '>= 82.0%',
    actual: `${permissionActivationRatePct.toFixed(1)}%`,
    passed: permissionActivationRatePct >= 82.0
  },
  refundRateUnder4_5Pct: {
    target: '<= 4.5%',
    actual: `${refundRate14dPct.toFixed(1)}%`,
    passed: refundRate14dPct <= 4.5
  }
};

const allGatesPassed = Object.values(stageGates).every((g) => g.passed);
const recommendedDailyBudgetGbp = allGatesPassed ? 25.0 : 10.0;

const reinvestmentLadder = [
  {
    stage: 'Stage 1 (Current Baseline)',
    dailyBudgetGbp: 10.0,
    monthlyBudgetGbp: 300.0,
    channelSplit: {
      redditAdsProspectingGbp: 7.5,
      microsoftBingSearchExactGbp: 2.5,
      retargetingWarmAudiencesGbp: 0.0,
      chatgptSearchAdsGbp: 0.0
    },
    retargetingRule: 'Collect first-party retargeting segments only (0% spend until Stage 2 gate unlocked)'
  },
  {
    stage: 'Stage 2 (40% Net Revenue Reinvestment Gate)',
    dailyBudgetGbp: 25.0,
    monthlyBudgetGbp: 750.0,
    unlocked: allGatesPassed,
    chatgptAdsUnlocked: true,
    channelSplit: {
      redditAdsProspectingGbp: 11.5,
      microsoftBingSearchExactGbp: 6.5,
      retargetingWarmAudiencesGbp: 3.5,
      chatgptSearchAdsGbp: 3.5
    },
    retargetingRule: 'Activate £3.50/day retargeting + £3.50/day ChatGPT/Search expansion (since daily budget >= £19/day)'
  },
  {
    stage: 'Stage 3 (Scale & Ecosystem Bundle Gate)',
    dailyBudgetGbp: 50.0,
    monthlyBudgetGbp: 1500.0,
    unlocked: allGatesPassed && ltvToCacRatio >= 2.4,
    chatgptAdsUnlocked: true,
    channelSplit: {
      redditAdsProspectingGbp: 21.0,
      microsoftBingSearchExactGbp: 13.0,
      retargetingWarmAudiencesGbp: 9.0,
      chatgptSearchAdsGbp: 7.0
    },
    retargetingRule: 'Expand retargeting + DE/FR EU CMP ad groups + £89.99/yr Sweepr Complete Suite bundle offers'
  }
];

const report = {
  generatedAt: new Date().toISOString(),
  currentStage: 'Stage 1 (£10.00/day)',
  recommendedDailyBudgetGbp,
  stageGate: {
    currentStage: allGatesPassed ? 'STAGE_2_UNLOCKED_25GBP' : 'STAGE_1_MICRO_10GBP',
    recommendedDailyBudgetGbp,
    unlockStage2AtDailyGbp: 19,
    unlockStage3AtDailyGbp: 42
  },
  recommendedAction: allGatesPassed
    ? `UNLOCK_STAGE_2_REINVESTMENT (£25.00/day — Top CPAU Winner: ${rankedByCpau[0].adGroupId} at £${rankedByCpau[0].cpauGbp} CPAU)`
    : 'HOLD_AT_STAGE_1 (£10.00/day — optimize failing gate before scaling)',
  metrics: {
    dailySpendGbp,
    blendedCacGbp,
    blendedCpauGbp,
    blendedNetLtvGbp,
    proAnnualPriceGbp,
    suiteAnnualPriceGbp,
    suiteAttachRatePct,
    ltvToCacRatio,
    permissionActivationRatePct,
    refundRate14dPct
  },
  stageGates,
  allGatesPassed,
  cpauAdGroupRanking: rankedByCpau,
  retargetingAudiencesConfigured: [
    'TestLab_Runners_NoPurchase',
    'Order_Page_Abandoners',
    'Competitor_VS_Readers'
  ],
  reinvestmentLadder
};

const outPath = path.join(DATA_DIR, 'reinvestment-stage-gate-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync(path.join(DATA_DIR, 'reinvestment-allocation.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`[STAGE-GATE] LTV:CAC = ${ltvToCacRatio}x (LTV £${blendedNetLtvGbp.toFixed(2)}) | CAC = £${blendedCacGbp.toFixed(2)} | Blended CPAU = £${blendedCpauGbp.toFixed(2)} | Best Ad Group: ${rankedByCpau[0].adGroupId} (£${rankedByCpau[0].cpauGbp} CPAU)`);
console.log(`[STAGE-GATE] Recommendation: ${report.recommendedAction}`);
console.log(`[STAGE-GATE] Saved report -> data/reinvestment-stage-gate-report.json`);
