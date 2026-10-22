#!/usr/bin/env node
/**
 * Adblocker Marketing Spend & Revenue-Reinvestment Simulator (GBP)
 * Models how a £10/day baseline budget compounds when reinvesting net revenue
 * across Reddit, Microsoft/Bing (+ Copilot), Meta Ads, ChatGPT Ads & Claude GEO over 6 months.
 */

function simulateGrowth({
  baseDailySpendGbp = 10.0,
  reinvestmentRate = 0.75,
  months = 6,
} = {}) {
  const stageConfigs = [
    // Month 1: Validation & Baseline Funnel Calibration (£10/day: Reddit + Microsoft/Bing + Copilot)
    {
      month: 1,
      stage: "Stage 1: Seed & Calibration (Days 1–30)",
      cpc: 0.52,
      clickToInstall: 0.30,
      installToPaid: 0.065,
      blendedNetAov: 23.50,
      organicInstalls: 160,
      channelSplit: "£7.50/d Reddit CPC + £2.50/d Microsoft/Bing (+ Copilot) Exact-Match + Claude/ChatGPT GEO",
    },
    // Month 2: First Reinvestment & Meta Warm Retargeting Layer
    {
      month: 2,
      stage: "Stage 2: Micro-Scale & Meta Retargeting (Days 31–60)",
      cpc: 0.50,
      clickToInstall: 0.34,
      installToPaid: 0.075,
      blendedNetAov: 24.50,
      organicInstalls: 380,
      channelSplit: "£12/d Reddit + £7/d Microsoft/Bing (+ Copilot & LinkedIn Overlay) + £4.28/d Meta Warm Retargeting",
    },
    // Month 3: Unlocking ChatGPT Self-Serve Ads (Daily budget ~£51/d exceeds $25/£15 ChatGPT min)
    {
      month: 3,
      stage: "Stage 2B: ChatGPT Ads Unlock & Flywheel (Days 61–90)",
      cpc: 0.62,
      clickToInstall: 0.37,
      installToPaid: 0.084,
      blendedNetAov: 25.00,
      organicInstalls: 820,
      channelSplit: "£16/d ChatGPT Ads + £16/d Reddit + £13/d Microsoft/Bing + £5.98/d Meta Retargeting",
    },
    // Month 4: Unlocking Meta Cold Reels (Quiz->Direct Checkout Funnel, >£20/d learning floor)
    {
      month: 4,
      stage: "Stage 3: Meta Cold Reels & Conversational Scale (Days 91–120)",
      cpc: 0.68,
      clickToInstall: 0.38,
      installToPaid: 0.088,
      blendedNetAov: 25.50,
      organicInstalls: 1500,
      channelSplit: "£32/d ChatGPT Ads + £28/d Reddit + £20/d Bing/Google + £25.25/d Meta Reels (Quiz Funnel) & Retarg",
    },
    // Month 5: Privacy Newsletters + Programmatic SEO / Claude GEO Compounding
    {
      month: 5,
      stage: "Stage 3B: Omni-Channel Authority & Sponsorships (Days 121–150)",
      cpc: 0.72,
      clickToInstall: 0.39,
      installToPaid: 0.090,
      blendedNetAov: 26.00,
      organicInstalls: 2500,
      channelSplit: "£60/d ChatGPT + £45/d Reddit/X + £38/d Bing/Google + £35/d Meta Ads + £23.50/d Newsletters",
    },
    // Month 6: EthicalAds / Carbon Ads + Full Ecosystem Scale
    {
      month: 6,
      stage: "Stage 4: Category Scale (Days 151–180)",
      cpc: 0.75,
      clickToInstall: 0.40,
      installToPaid: 0.092,
      blendedNetAov: 26.50,
      organicInstalls: 4000,
      channelSplit: "£105/d ChatGPT + £75/d Reddit/X + £65/d Bing/Google + £55/d Meta Ads + £62.43/d EthicalAds/Newsletters",
    },
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
      channelSplit: cfg.channelSplit,
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
