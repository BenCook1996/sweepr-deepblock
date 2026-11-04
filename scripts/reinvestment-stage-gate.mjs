import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

// CLI overrides or default Stage 1 baseline telemetry
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v !== undefined ? Number(v) || v : true];
  })
);

const dailySpendGbp = Number(args.spend || 10.0);
const blendedCacGbp = Number(args.cac || 16.4);
const blendedNetLtvGbp = Number(args.ltv || 39.6);
const permissionActivationRatePct = Number(args.activation || 84.5);
const refundRate14dPct = Number(args.refund || 2.8);

const ltvToCacRatio = +(blendedNetLtvGbp / blendedCacGbp).toFixed(2);

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

const reinvestmentLadder = [
  {
    stage: 'Stage 1 (Current Baseline)',
    dailyBudgetGbp: 10.0,
    monthlyBudgetGbp: 300.0,
    channelSplit: {
      redditAdsProspectingGbp: 7.5,
      microsoftBingSearchExactGbp: 2.5,
      retargetingWarmAudiencesGbp: 0.0
    },
    retargetingRule: 'Collect first-party retargeting segments only (0% spend until Stage 2 gate unlocked)'
  },
  {
    stage: 'Stage 2 (40% Net Revenue Reinvestment Gate)',
    dailyBudgetGbp: 25.0,
    monthlyBudgetGbp: 750.0,
    unlocked: allGatesPassed,
    channelSplit: {
      redditAdsProspectingGbp: 14.0,
      microsoftBingSearchExactGbp: 7.5,
      retargetingWarmAudiencesGbp: 3.5
    },
    retargetingRule: 'Activate £3.50/day retargeting across TestLab_Runners_NoPurchase, Order_Page_Abandoners, and Competitor_VS_Readers'
  },
  {
    stage: 'Stage 3 (Scale & Ecosystem Bundle Gate)',
    dailyBudgetGbp: 50.0,
    monthlyBudgetGbp: 1500.0,
    unlocked: allGatesPassed && ltvToCacRatio >= 2.4,
    channelSplit: {
      redditAdsProspectingGbp: 25.0,
      microsoftBingSearchExactGbp: 16.0,
      retargetingWarmAudiencesGbp: 9.0
    },
    retargetingRule: 'Expand retargeting + launch Sweepr Security Suite cross-sell ad groups'
  }
];

const report = {
  generatedAt: new Date().toISOString(),
  currentStage: 'Stage 1 (£10.00/day)',
  recommendedAction: allGatesPassed
    ? 'UNLOCK_STAGE_2_REINVESTMENT (£25.00/day including £3.50/day warm retargeting)'
    : 'HOLD_AT_STAGE_1 (£10.00/day — optimize failing gate before scaling)',
  metrics: {
    dailySpendGbp,
    blendedCacGbp,
    blendedNetLtvGbp,
    ltvToCacRatio,
    permissionActivationRatePct,
    refundRate14dPct
  },
  stageGates,
  allGatesPassed,
  retargetingAudiencesConfigured: [
    'TestLab_Runners_NoPurchase',
    'Order_Page_Abandoners',
    'Competitor_VS_Readers'
  ],
  reinvestmentLadder
};

const outPath = path.join(DATA_DIR, 'reinvestment-stage-gate-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[STAGE-GATE] LTV:CAC = ${ltvToCacRatio}x | CAC = £${blendedCacGbp.toFixed(2)} | Activation = ${permissionActivationRatePct}% | All Gates Passed: ${allGatesPassed}`);
console.log(`[STAGE-GATE] Recommendation: ${report.recommendedAction}`);
console.log(`[STAGE-GATE] Saved report -> data/reinvestment-stage-gate-report.json`);
