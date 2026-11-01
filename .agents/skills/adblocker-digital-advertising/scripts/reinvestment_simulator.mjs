#!/usr/bin/env node
/**
 * SWEEPR Deepblock (sweeprdeepblock.com) — Marketing Spend & Revenue-Reinvestment Simulator (GBP)
 * Calibrated to actual Nov 2026 live state:
 * - Pricing: £59.99/yr Annual (50% off), £44.99/6-mo, £1.99 30-day Intro (-> £9.99/mo)
 * - Order Bump: Total Tab & RAM Tamer (+£14.99/yr, +£9.99/6-mo, +£1.99/mo) on /order
 * - Blended Day-1 Net Cash Collected (AOV after Stripe fees across 55% Annual, 15% 6-Mo, 30% £1.99 Intro + 35% RAM Tamer attach): ~£42.50 -> £46.50 GBP
 * - Existing Organic Asset Baseline: 1,324 indexable canonical pSEO pages, 7,775 DR89 backlinks, /test-lab, /llms.txt
 */

function simulateSweeprGrowth({
  baseDailySpendGbp = 10.0,
  reinvestmentRate = 0.75,
  months = 6,
} = {}) {
  const stageConfigs = [
    // Month 1 (Nov 2026): £10/day Seed — Calibrated to live GSC (171 indexed pages, Pos 13.8, 6 clicks in first 12d) + Firefox AMO Approved
    {
      month: 1,
      stage: "Stage 1: Seed & Calibration (Month 1 — £10/day Base)",
      cpc: 0.52,
      clickToFunnel: 0.34, // Clicks to /test-lab, /download, or welcome.html
      funnelToPaidOrder: 0.055, // Converts on /order (£1.99 Intro, £44.99 6m, £59.99 Annual + £14.99 RAM Tamer)
      blendedNetCashAov: 41.80, // Blended Day-1 net cash after Stripe fees (+ Day-30 £9.99 rebills from £1.99 intro cohort)
      organicFunnelUsers: 55, // Grounded in live GSC (171 indexed pages @ Pos 13.8) + Firefox AMO live + 4 weekly Reddit posts
      channelSplit: "£7.50/d Reddit CPC (store-creatives Alt 4) + £2.50/d Microsoft/Bing (& Copilot) Exact-Match",
    },
    // Month 2 (Dec 2026): First Reinvestment + Meta Warm Retargeting on /order & /test-lab
    {
      month: 2,
      stage: "Stage 2: Meta Retargeting & Bing LinkedIn Overlay (Month 2)",
      cpc: 0.54,
      clickToFunnel: 0.36,
      funnelToPaidOrder: 0.062,
      blendedNetCashAov: 43.20,
      organicFunnelUsers: 160, // CWS approved + Bing crawl throttle lifted + 171->450 GSC indexed pages moving to Pos 7-10
      channelSplit: "£10.50/d Reddit CPC + £6.90/d Microsoft/Bing (+ Copilot) + £5.00/d Meta Warm Retargeting (/order & /test-lab)",
    },
    // Month 3 (Jan 2027): Unlocking ChatGPT Self-Serve Ads (ads.openai.com) + Meta Retargeting Scale
    {
      month: 3,
      stage: "Stage 2B: ChatGPT Ads & Meta Retargeting Scale (Month 3)",
      cpc: 0.64,
      clickToFunnel: 0.38,
      funnelToPaidOrder: 0.068,
      blendedNetCashAov: 44.50,
      organicFunnelUsers: 420, // ~900+ pages indexed across Google & Bing + Store ASO review velocity + GEO citations
      channelSplit: "£19/d ChatGPT Ads (Context Hints) + £11/d Reddit + £7.50/d Meta + £5.21/d Bing/Copilot",
    },
    // Month 4 (Feb 2027): Multi-Channel Scale + Partner Portal Affiliates (/partner/:token)
    {
      month: 4,
      stage: "Stage 3: Conversational & Creator Partner Scale (Month 4)",
      cpc: 0.68,
      clickToFunnel: 0.39,
      funnelToPaidOrder: 0.072,
      blendedNetCashAov: 45.50,
      organicFunnelUsers: 950,
      channelSplit: "£28/d ChatGPT oCPC + £22/d Meta Ads + £18/d Reddit/X + £13.84/d Bing/Google",
    },
    // Month 5 (Mar 2027): EthicalAds / Carbon Ads + International Geo-Pricing Scale (8 Currencies)
    {
      month: 5,
      stage: "Stage 3B: International 8-Currency & EthicalAds Expansion (Month 5)",
      cpc: 0.72,
      clickToFunnel: 0.40,
      funnelToPaidOrder: 0.075,
      blendedNetCashAov: 46.20,
      organicFunnelUsers: 1950,
      channelSplit: "£52/d ChatGPT + £42/d Meta + £34/d Bing/Google (US/EU/UK/JP) + £25/d Reddit/X + £13.06/d Newsletters",
    },
    // Month 6 (Apr 2027): Category Dominance across Desktop, Mobile QR Sync & Browser Stores
    {
      month: 6,
      stage: "Stage 4: Category Dominance & Recurring Rebill Flywheel (Month 6)",
      cpc: 0.75,
      clickToFunnel: 0.41,
      funnelToPaidOrder: 0.078,
      blendedNetCashAov: 47.00,
      organicFunnelUsers: 3600,
      channelSplit: "£105/d ChatGPT + £85/d Meta + £70/d Search/ASA + £55/d Reddit/X + £33.89/d EthicalAds/Carbon/Creators",
    },
  ];

  const results = [];
  let reinvestedPool = 0.0;

  for (const cfg of stageConfigs.slice(0, months)) {
    const baseMonthlyBudget = baseDailySpendGbp * 30.0;
    const totalAdSpend = Number((baseMonthlyBudget + reinvestedPool).toFixed(2));
    const effectiveDailyBudget = Number((totalAdSpend / 30.0).toFixed(2));

    const paidClicks = Math.floor(totalAdSpend / cfg.cpc);
    const paidFunnelUsers = Math.floor(paidClicks * cfg.clickToFunnel);
    const totalFunnelUsers = paidFunnelUsers + cfg.organicFunnelUsers;

    const paidBuyers = Number((paidFunnelUsers * cfg.funnelToPaidOrder).toFixed(1));
    const organicBuyers = Number((cfg.organicFunnelUsers * (cfg.funnelToPaidOrder * 0.65)).toFixed(1));
    const totalBuyers = Number((paidBuyers + organicBuyers).toFixed(1));

    const paidRevenue = Number((paidBuyers * cfg.blendedNetCashAov).toFixed(2));
    const totalNetRevenue = Number((totalBuyers * cfg.blendedNetCashAov).toFixed(2));

    const paidRoas = Number((paidRevenue / totalAdSpend).toFixed(2));
    const blendedRoas = Number((totalNetRevenue / totalAdSpend).toFixed(2));
    const paidCac = Number((totalAdSpend / Math.max(paidBuyers, 1)).toFixed(2));
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
      paidFunnelUsers,
      organicFunnelUsers: cfg.organicFunnelUsers,
      totalFunnelUsers,
      paidBuyers,
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

const data = simulateSweeprGrowth();
console.log(JSON.stringify(data, null, 2));
