#!/usr/bin/env node
/**
 * Adblocker Marketing Spend & Revenue-Reinvestment Simulator (GBP)
 * Models how a £10/day baseline budget compounds when reinvesting net revenue
 * across paid + organic channels over 6 months.
 */

function simulateGrowth({
  baseDailySpendGbp = 10.0,
  reinvestmentRate = 0.75,
  months = 6,
} = {}) {
  const stageConfigs = [
    // Month 1: Validation & Baseline Funnel Calibration
    { month: 1, stage: "Stage 1: Seed & Calibration (Days 1–30)", cpc: 0.52, clickToInstall: 0.30, installToPaid: 0.065, blendedNetAov: 23.50, organicInstalls: 160 },
    // Month 2: First Reinvestment & Welcome-Tab CRO Lift
    { month: 2, stage: "Stage 2: Micro-Scale & CRO (Days 31–60)", cpc: 0.50, clickToInstall: 0.34, installToPaid: 0.075, blendedNetAov: 24.50, organicInstalls: 380 },
    // Month 3: Dual-Channel Expansion (Reddit + Bing/ASA + SEO Traction)
    { month: 3, stage: "Stage 2: Dual-Channel Flywheel (Days 61–90)", cpc: 0.49, clickToInstall: 0.36, installToPaid: 0.080, blendedNetAov: 25.00, organicInstalls: 750 },
    // Month 4: Creator Affiliates + Retargeting Layer
    { month: 4, stage: "Stage 3: Multi-Channel Expansion (Days 91–120)", cpc: 0.51, clickToInstall: 0.37, installToPaid: 0.082, blendedNetAov: 25.50, organicInstalls: 1350 },
    // Month 5: Privacy Newsletters + Programmatic SEO Compounding
    { month: 5, stage: "Stage 3: Authority & Sponsorships (Days 121–150)", cpc: 0.53, clickToInstall: 0.38, installToPaid: 0.085, blendedNetAov: 26.00, organicInstalls: 2200 },
    // Month 6: EthicalAds / Carbon Ads + Full Ecosystem Scale
    { month: 6, stage: "Stage 4: Category Scale (Days 151–180)", cpc: 0.55, clickToInstall: 0.38, installToPaid: 0.088, blendedNetAov: 26.50, organicInstalls: 3500 },
  ];

  const results = [];
  let reinvestedPool = 0.0;

  for (const cfg of stageConfigs.slice(0, months)) {
    const baseMonthlyBudget = baseDailySpendGbp * 30.0;
    const totalAdSpend = Number((baseMonthlyBudget + reinvestedPool).toFixed(2));
    const effectiveDailyBudget = Number((totalAdSpend / 30.0).toFixed(2));

    const paidClicks = Math.floor(totalAdSpend / cfg.cpc);
    const paidInstalls = Math.floor(paidClicks * cfg.clickToInstall);
    const totalInstalls = paidInstalls + cfg.organicInstalls;

    const paidChannelBuyers = Number((paidInstalls * cfg.installToPaid).toFixed(1));
    const organicBuyers = Number((cfg.organicInstalls * (cfg.installToPaid * 1.1)).toFixed(1));
    const totalBuyers = Number((paidChannelBuyers + organicBuyers).toFixed(1));

    const paidRevenue = Number((paidChannelBuyers * cfg.blendedNetAov).toFixed(2));
    const totalNetRevenue = Number((totalBuyers * cfg.blendedNetAov).toFixed(2));

    const paidRoas = Number((paidRevenue / totalAdSpend).toFixed(2));
    const blendedRoas = Number((totalNetRevenue / totalAdSpend).toFixed(2));
    const paidCac = Number((totalAdSpend / Math.max(paidChannelBuyers, 1)).toFixed(2));
    const blendedCac = Number((totalAdSpend / Math.max(totalBuyers, 1)).toFixed(2));

    const nextReinvestment = Number((totalNetRevenue * reinvestmentRate).toFixed(2));
    const retainedCash = Number((totalNetRevenue - nextReinvestment).toFixed(2));

    results.push({
      month: cfg.month,
      stage: cfg.stage,
      dailyAdBudgetGbp: effectiveDailyBudget,
      monthlyAdSpendGbp: totalAdSpend,
      paidClicks,
      paidInstalls,
      organicInstalls: cfg.organicInstalls,
      totalInstalls,
      paidBuyers: paidChannelBuyers,
      organicBuyers,
      totalPayingCustomers: totalBuyers,
      paidCacGbp: paidCac,
      blendedCacGbp: blendedCac,
      paidRoas,
      blendedRoas,
      netRevenueGbp: totalNetRevenue,
      reinvestedIntoNextMonthGbp: nextReinvestment,
      retainedCashGbp: retainedCash,
    });

    reinvestedPool = nextReinvestment;
  }

  return results;
}

const data = simulateGrowth();
console.log(JSON.stringify(data, null, 2));
