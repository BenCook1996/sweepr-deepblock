import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATE_301_MAP, isNoIndexPrunePath } from './lib/m1-decisions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');

function isIndexableRouteOnDisk(route) {
  const clean = String(route || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (!clean.startsWith('/')) return false;
  if (isNoIndexPrunePath(clean) || CONSOLIDATE_301_MAP.has(clean)) return false;
  const rel = clean.replace(/^\/+/, '');
  const htmlFile = clean === '/' ? path.join(WEBSITE_DIR, 'index.html') : path.join(WEBSITE_DIR, `${rel}.html`);
  const indexFile = clean === '/' ? htmlFile : path.join(WEBSITE_DIR, rel, 'index.html');
  const fp = fs.existsSync(htmlFile) ? htmlFile : fs.existsSync(indexFile) ? indexFile : null;
  if (!fp) return false;
  const html = fs.readFileSync(fp, 'utf8');
  return !/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
}

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
    'SWEEPR Deepblock v1.4.0 — Deterministic MV3 Ad, Tracker & Cookie-Wall Engine',
    'Runs 100% locally via 36,019 static declarativeNetRequest rules across 5 rulesets and isolated-world DOM synthesis. Blocks video ads, 160 CMP cookie walls, and 229 tracking parameters with a no-card 7-day full Pro trial.',
    'https://sweeprdeepblock.com/setup/google-chrome-manifest-v3?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_mv3_intent',
    'https://sweeprdeepblock.com/setup/google-chrome-manifest-v3',
    '0.85'
  ],
  [
    'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
    campaignState,
    'Requires Reinvestment Pool >= 19.00 GBP/day',
    'CGPT_AG2_Total_Adblock_Renewal_Alternative',
    'total adblock charged me 99 pounds alternative transparent pricing',
    'Switch From £99–£120/yr Renewal Traps to Transparent £2.50/mo Pro (£29.99/yr)',
    'Flat-rate £29.99/yr Pro (5 devices, includes Tab & RAM Tamer) or £89.99/yr Complete Security Suite (Deepblock Pro + VPN + Cleaner across 5 devices) with zero renewal price jumps and 1-click self-serve cancellation.',
    'https://sweeprdeepblock.com/vs/total-adblock?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_switcher',
    'https://sweeprdeepblock.com/vs/total-adblock',
    '0.95'
  ],
  [
    'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
    campaignState,
    'Requires Reinvestment Pool >= 19.00 GBP/day',
    'CGPT_AG3_Publisher_Ad_Load_Benchmarks',
    'why do uk news websites freeze my browser tabs how to block sourcepoint popups',
    'Verified Manifest V3 Benchmarks — Cut Tab Bloat & Block Video Ads',
    'Inspect reproducible v1.4.0 Manifest V3 benchmarks across 36,019 static DNR rules and 100 OTA rules or run a live browser protection leak test in seconds.',
    'https://sweeprdeepblock.com/benchmarks?utm_source=chatgpt_search&utm_medium=cpc&utm_campaign=stage3_ad_load_index',
    'https://sweeprdeepblock.com/benchmarks',
    '0.70'
  ]
];

const keywordMatrixPath = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
if (fs.existsSync(keywordMatrixPath)) {
  try {
    const kwMatrix = JSON.parse(fs.readFileSync(keywordMatrixPath, 'utf8'));
    const topLowKd = (kwMatrix.opportunities || [])
      .filter((opp) => opp?.targetRoute && isIndexableRouteOnDisk(opp.targetRoute))
      .slice(0, 5);
    topLowKd.forEach((opp, idx) => {
      const oppSlug = String(opp.slug || opp.targetRoute?.split('/').pop() || 'kw');
      chatGptSearchRows.push([
        'SWEEPR_Stage3_ChatGPT_Search_UK_EU',
        campaignState,
        'Requires Reinvestment Pool >= 19.00 GBP/day',
        `CGPT_AG${idx + 4}_LowKD_${oppSlug.slice(0, 24).replace(/-/g, '_')}`,
        opp.keyword,
        `${opp.pageBlueprint?.shortLinkTitle || opp.keyword} — SWEEPR Deepblock v1.4.0`,
        `Verified Manifest V3 declarativeNetRequest protection (36,019 static rules), automated cookie auto-rejection across 160 CMPs, 7-day no-card Pro trial, and transparent £29.99/yr Pro or £89.99/yr Complete Suite pricing.`,
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
    'https://sweeprdeepblock.com/de?utm_source=bing_de&utm_medium=cpc&utm_campaign=stage3_de_usercentrics',
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
    'Automatisch Ablehnen (MV3)',
    'SWEEPR Deepblock (DE/AT/CH)',
    'Keine nervigen Cookie-Dialoge auf Spiegel, Bild & Heise. 100% lokal ohne Cloud-Telemetrie.',
    'Inkl. Scroll-Lock-Reparatur & 36.019 Manifest-V3-Filterregeln. 7 Tage Pro-Test ohne Kreditkarte.',
    'https://sweeprdeepblock.com/de?utm_source=bing_de&utm_medium=cpc&utm_campaign=stage3_de_usercentrics',
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
    'https://sweeprdeepblock.com/fr?utm_source=bing_fr&utm_medium=cpc&utm_campaign=stage3_fr_didomi',
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
    'Refus Automatique Sans Blocage',
    'SWEEPR Deepblock (FR/BE/CH)',
    'Éliminez les bandeaux cookies Didomi sur Le Monde, Le Figaro et 20 Minutes sans casser le défilement.',
    'v1.4.0 : 36,019 règles MV3, 160 CMP, 229 paramètres. Essai Pro 7 jours sans carte.',
    'https://sweeprdeepblock.com/fr?utm_source=bing_fr&utm_medium=cpc&utm_campaign=stage3_fr_didomi',
    'fr',
    'anti-cookies'
  ],
  [
    'Ad Group',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'ES_AG3_Bloqueador_Cookies_Hub',
    '',
    '',
    '0.50',
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
    'ES_AG3_Bloqueador_Cookies_Hub',
    'bloqueador de anuncios y cookies chrome manifest v3',
    'Phrase',
    '0.50',
    '',
    '',
    '',
    '',
    '',
    'https://sweeprdeepblock.com/es?utm_source=bing_es&utm_medium=cpc&utm_campaign=stage3_es_hub',
    '',
    ''
  ],
  [
    'Responsive Search Ad',
    campaignState,
    'SWEEPR_Stage3_DE_FR_CookieWall_Search',
    '',
    '',
    'ES_AG3_Bloqueador_Cookies_Hub',
    '',
    '',
    '',
    'Bloqueador MV3 y Cookies',
    'Sin Pop-Ups ni Ralentizaciones',
    'SWEEPR Deepblock Español',
    'Elimina anuncios de vídeo y rechaza banners de cookies automáticamente sin bloquear el scroll.',
    'Motor local-first con 36.019 reglas Manifest V3 y prueba Pro de 7 días sin tarjeta. Pruébalo gratis.',
    'https://sweeprdeepblock.com/es?utm_source=bing_es&utm_medium=cpc&utm_campaign=stage3_es_hub',
    'es',
    'bloqueador-anuncios'
  ]
];

const msEuCsvPath = path.join(DIST_DIR, 'eu-de-fr-microsoft-ads-stage3.csv');
fs.writeFileSync(msEuCsvPath, toCsv(msEuRows), 'utf8');

console.log(`Built Stage-3 Expansion Ad Packs (Gate Status: ${campaignState}, Current Recommended Pool: £${currentDailyGbp.toFixed(2)}/day):`);
console.log(` - ${chatGptCsvPath}`);
console.log(` - ${msEuCsvPath}`);
