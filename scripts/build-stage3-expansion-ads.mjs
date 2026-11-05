import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');

fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const stageGateReportPath = path.join(DATA_DIR, 'reinvestment-stage-gate-report.json');
let stageGate = {
  stageGate: {
    currentStage: 'STAGE_1_MICRO_10GBP',
    recommendedDailyBudgetGbp: 10,
    unlockStage2AtDailyGbp: 19,
    unlockStage3AtDailyGbp: 42
  }
};

if (fs.existsSync(stageGateReportPath)) {
  try {
    stageGate = JSON.parse(fs.readFileSync(stageGateReportPath, 'utf8'));
  } catch (_) {}
}

const currentDailyGbp = Number(
  stageGate?.stageGate?.recommendedDailyBudgetGbp || stageGate?.recommendedDailyBudgetGbp || 10
);
const stage2Unlocked = currentDailyGbp >= 19.0;
const campaignState = stage2Unlocked ? 'Enabled' : 'Paused';

// 1. ChatGPT Search Ads / Conversational AI Search Export Pack (Stage 3 Expansion)
const chatGptSearchRows = [
  [
    'Campaign Name',
    'Campaign Status',
    'Stage Gate Unlock Requirement',
    'Ad Group',
    'Conversational Prompt Cluster',
    'Headline',
    'Sponsored Answer Summary',
    'Destination URL',
    'Verification Citation URL',
    'Max CPC Bid (GBP)'
  ],
  [
    'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
    campaignState,
    'Requires Reinvestment Pool >= 19.00 GBP/day',
    'CGPT_AG1_Best_Adblocker_After_Manifest_V3',
    'best adblocker for chrome after manifest v3 that blocks video ads and cookie banners',
    'SWEEPR DeepBlock v1.2.7 — Deterministic MV3 Ad, Tracker & Cookie-Wall Engine',
    'Runs 100% locally via 242 C++ declarativeNetRequest rules (<15us latency) and isolated-world DOM synthesis. Blocks video ads, Usercentrics/Didomi/Sourcepoint cookie walls, and scam stores with zero telemetry.',
    'https://sweeprdeepblock.com/setup/google-chrome-manifest-v3?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_mv3_intent',
    'https://sweeprdeepblock.com/glossary/manifest-v3-declarative-net-request',
    '0.85'
  ],
  [
    'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
    campaignState,
    'Requires Reinvestment Pool >= 19.00 GBP/day',
    'CGPT_AG2_Total_Adblock_Renewal_Alternative',
    'total adblock charged me 99 pounds alternative transparent pricing',
    'Switch From £99–£120/yr Renewal Traps to Transparent £2.50/mo Pro (£29.99/yr)',
    'Flat-rate £29.99/yr Pro (4 devices) or £89.99/yr Complete Security Suite (DeepBlock Pro + RAM Tamer + VPN + Cleaner, 5 devices) with zero renewal price jumps and 1-click self-serve cancellation.',
    'https://sweeprdeepblock.com/campaigns/renewal-shock-switcher?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_switcher',
    'https://sweeprdeepblock.com/vs/total-adblock-cancel-subscription',
    '0.95'
  ],
  [
    'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
    campaignState,
    'Requires Reinvestment Pool >= 19.00 GBP/day',
    'CGPT_AG3_Publisher_Ad_Load_Benchmarks',
    'why do uk news websites freeze my browser tabs how to block sourcepoint popups',
    'Verified UK & EU Publisher Ad-Load Index — Reclaim 380 MB RAM Per News Tab',
    'Audit real tracker, CNAME cloaking, and heap memory overhead across 150 top domains or run a live 8-point browser leak test in 5 seconds.',
    'https://sweeprdeepblock.com/campaigns/uk-ad-load-index?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_ad_load_index',
    'https://sweeprdeepblock.com/site',
    '0.70'
  ]
];

const keywordMatrixPath = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
if (fs.existsSync(keywordMatrixPath)) {
  try {
    const kwMatrix = JSON.parse(fs.readFileSync(keywordMatrixPath, 'utf8'));
    const topLowKd = (kwMatrix.opportunities || []).slice(0, 5);
    topLowKd.forEach((opp, idx) => {
      const oppSlug = String(opp.slug || opp.targetRoute?.split('/').pop() || 'kw');
      chatGptSearchRows.push([
        'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
        campaignState,
        'Requires Reinvestment Pool >= 19.00 GBP/day',
        `CGPT_AG${idx + 4}_LowKD_${oppSlug.slice(0, 24).replace(/-/g, '_')}`,
        opp.keyword,
        `${opp.pageBlueprint?.shortLinkTitle || opp.keyword} — SWEEPR DeepBlock v1.2.7`,
        `Verified 8/8 Manifest V3 C++ declarativeNetRequest protection (<15us latency), <50ms cookie auto-rejection, and transparent £29.99/yr Pro or £89.99/yr Complete Suite pricing.`,
        `https://sweeprdeepblock.com${opp.targetRoute}?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_low_kd_matrix`,
        'https://sweeprdeepblock.com/test-lab',
        '0.80'
      ]);
    });
  } catch (_) {}
}

function toCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const str = String(cell ?? '');
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    )
    .join('\n') + '\n';
}

const chatGptCsvPath = path.join(DIST_DIR, 'chatgpt-search-ads-stage3-export.csv');
fs.writeFileSync(chatGptCsvPath, toCsv(chatGptSearchRows), 'utf8');

// 2. Localized DE & FR Microsoft Advertising Bulk Import Pack (Usercentrics & Didomi Cookie-Wall Intent)
const msEuRows = [
  [
    'Type',
    'Status',
    'Campaign',
    'Budget',
    'Budget Type',
    'Ad Group',
    'Keyword',
    'Match Type',
    'Bid',
    'Title Part 1',
    'Title Part 2',
    'Title Part 3',
    'Text Part 1',
    'Text Part 2',
    'Final URL',
    'Path 1',
    'Path 2'
  ],
  [
    'Campaign',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '6.50',
    'DailyBudgetStandard',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ],
  [
    'Ad Group',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'DE_AG1_Usercentrics_Pur_Abo_Blocker',
    '',
    '',
    '0.65',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ],
  [
    'Keyword',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'DE_AG1_Usercentrics_Pur_Abo_Blocker',
    'usercentrics cookie banner automatisch ablehnen',
    'Phrase',
    '0.65',
    '',
    '',
    '',
    '',
    '',
    'https://sweeprdeepblock.com/de/usercentrics-cookie-banner-blockieren?utm_source=bing_de&utm_medium=cpc&utm_campaign=stage3_de_usercentrics',
    '',
    ''
  ],
  [
    'Keyword',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'DE_AG1_Usercentrics_Pur_Abo_Blocker',
    'cookie banner blockieren chrome manifest v3',
    'Phrase',
    '0.60',
    '',
    '',
    '',
    '',
    '',
    'https://sweeprdeepblock.com/de?utm_source=bing_de&utm_medium=cpc&utm_campaign=stage3_de_hub',
    '',
    ''
  ],
  [
    'Responsive Search Ad',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'DE_AG1_Usercentrics_Pur_Abo_Blocker',
    '',
    '',
    '',
    'Usercentrics & Cookie-Walls',
    'Automatisch Ablehnen in <50ms',
    'SWEEPR DeepBlock (DE/AT/CH)',
    'Keine nervigen Cookie-Dialoge auf Spiegel, Bild & Heise. 100% lokal ohne Cloud-Telemetrie.',
    'Inkl. Scroll-Lock-Reparatur & 242 C++ Manifest-V3-Filterregeln (<15µs). Jetzt Browser kostenlos testen.',
    'https://sweeprdeepblock.com/de/usercentrics-cookie-banner-blockieren?utm_source=bing_de&utm_medium=cpc&utm_campaign=stage3_de_usercentrics',
    'de',
    'cookie-blocker'
  ],
  [
    'Ad Group',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'FR_AG2_Didomi_Bandeau_Cookie_Blocker',
    '',
    '',
    '0.60',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ],
  [
    'Keyword',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'FR_AG2_Didomi_Bandeau_Cookie_Blocker',
    'bloquer bandeau cookie didomi automatiquement',
    'Phrase',
    '0.60',
    '',
    '',
    '',
    '',
    '',
    'https://sweeprdeepblock.com/fr/bloquer-bandeau-cookie-didomi?utm_source=bing_fr&utm_medium=cpc&utm_campaign=stage3_fr_didomi',
    '',
    ''
  ],
  [
    'Keyword',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'FR_AG2_Didomi_Bandeau_Cookie_Blocker',
    'bloqueur publicite et cookies chrome manifest v3',
    'Phrase',
    '0.55',
    '',
    '',
    '',
    '',
    '',
    'https://sweeprdeepblock.com/fr?utm_source=bing_fr&utm_medium=cpc&utm_campaign=stage3_fr_hub',
    '',
    ''
  ],
  [
    'Responsive Search Ad',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'FR_AG2_Didomi_Bandeau_Cookie_Blocker',
    '',
    '',
    '',
    'Bloquer Bandeaux Didomi & TCF',
    'Refus Automatique en <50ms',
    'SWEEPR DeepBlock (FR/BE/CH)',
    'Éliminez les bandeaux cookies Didomi sur Le Monde, Le Figaro et 20 Minutes sans casser le défilement.',
    'Moteur Manifest V3 100% local avec zéro télémétrie cloud. Testez votre navigateur gratuitement.',
    'https://sweeprdeepblock.com/fr/bloquer-bandeau-cookie-didomi?utm_source=bing_fr&utm_medium=cpc&utm_campaign=stage3_fr_didomi',
    'fr',
    'anti-cookies'
  ]
];

const msEuCsvPath = path.join(DIST_DIR, 'eu-de-fr-microsoft-ads-stage3.csv');
fs.writeFileSync(msEuCsvPath, toCsv(msEuRows), 'utf8');

console.log(`Built Stage-3 Expansion Ad Packs (Gate Status: ${campaignState}, Current Recommended Pool: £${currentDailyGbp.toFixed(2)}/day):`);
console.log(` - ${chatGptCsvPath}`);
console.log(` - ${msEuCsvPath}`);
