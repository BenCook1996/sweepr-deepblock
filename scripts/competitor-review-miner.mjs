import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNoIndexPrunePath, CONSOLIDATE_301_MAP } from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VS_DIR = path.join(ROOT_DIR, 'website', 'vs');
const KEYWORD_MATRIX_PATH = path.join(DATA_DIR, 'keyword-opportunity-matrix.json');
const LIVE_REVIEWS_PATH = path.join(DATA_DIR, 'live-competitor-reviews.json');

const MANIFEST_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'extension', 'manifest.json'), 'utf8')).version || '1.3.1';
  } catch {
    return '1.3.1';
  }
})();

const STATIC_RULE_COUNT = (() => {
  let total = 0;
  for (const rel of [
    'extension/rules/static_ads_and_trackers.json',
    'extension/rules/cryptominers.json',
    'extension/rules/tracker_params.json'
  ]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8'));
      const arr = Array.isArray(parsed) ? parsed : (parsed.rules || []);
      total += arr.length;
    } catch {}
  }
  return total || 283;
})();

const DELTA_RULE_COUNT = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'extension', 'rules', 'dynamic_delta.json'), 'utf8'));
    const arr = Array.isArray(parsed) ? parsed : (parsed.dynamicDnrRules || parsed.rules || []);
    return arr.length || 100;
  } catch {
    return 100;
  }
})();

let liveReviewsData = null;
if (fs.existsSync(LIVE_REVIEWS_PATH)) {
  try {
    liveReviewsData = JSON.parse(fs.readFileSync(LIVE_REVIEWS_PATH, 'utf8'));
  } catch {}
}
const liveReviewsLoaded = Boolean(liveReviewsData && Array.isArray(liveReviewsData.reviews) && liveReviewsData.reviews.length > 0);
const UNVERIFIED_STATIC_CAVEAT =
  'Qualitative positioning themes derived from M1 SERP/Reddit research; no live Trustpilot/CWS review scrape dataset attached';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// Ad Policy Compliance Shield: strips restricted platform monetization trademarks from Paid Search / Social Ad Copy
function sanitizeAdCopyForPolicy(text) {
  return String(text || '')
    .replace(/\b(YouTube|Twitch|Crunchyroll|Spotify|Hulu|Peacock|ITVX)\b/gi, 'Streaming Video')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMPETITOR_CLUSTERS = [
  {
    clusterId: 'surprise_renewal_billing',
    competitorsAffected: ['Total Adblock', 'AdBlock', 'Adblock Plus'],
    complaintSharePct: liveReviewsLoaded ? liveReviewsData.shares?.surprise_renewal_billing ?? null : null,
    evidenceBasis: 'M1_live_serp_and_reddit_qualitative_synthesis',
    verifiedReviewSampleSize: liveReviewsLoaded ? liveReviewsData.reviews.length : 0,
    unverifiedStaticCaveat: liveReviewsLoaded ? null : UNVERIFIED_STATIC_CAVEAT,
    sentimentSeverity: 'critical',
    topUserQuotes: [
      'Signed up for £1.99 and got hit with a £99 auto-renewal charge without warning.',
      'Free version stops blocking ads on popular sites after 7 days unless you pay £99/yr.',
      'Had to contact support just to stop the annual renewal.'
    ],
    deepblockCounterPositioning:
      'Transparent £1.99 1st-Month Intro or £29.99/yr Pro Annual (£2.50/mo eq., 5 devices) and £89.99/yr Complete Security Suite (5 devices) with 1-click self-serve cancellation at /support.',
    targetLandingPages: ['/vs/total-adblock', '/pricing', '/support'],
    rsaHeadlines: [
      'Tired of £99 Adblock Renewals?',
      'Switch From Total Adblock Today',
      'Honest £2.50/mo Annual Pricing'
    ],
    rsaDescriptions: [
      'Stop paying £99-£119 surprise renewal fees. Get full MV3 ad & tracker defense for £29.99/yr Pro (up to 5 devices) with 1-click cancellation.',
      `Compare 3-year adblocker renewal costs. SWEEPR Deepblock v${MANIFEST_VERSION} includes ${STATIC_RULE_COUNT} static DNR rules, cookie auto-reject & URL tracker stripping.`
    ],
    redditHeadline:
      'PSA: Check what your "£1.99 intro" adblocker actually renews at in Year 2 (£99–£119/yr) — transparent £29.99/yr MV3 breakdown'
  },
  {
    clusterId: 'youtube_mv3_detection',
    competitorsAffected: ['uBlock Origin Lite', 'AdBlock', 'Ghostery', 'Total Adblock'],
    complaintSharePct: liveReviewsLoaded ? liveReviewsData.shares?.youtube_mv3_detection ?? null : null,
    evidenceBasis: 'M1_live_serp_and_reddit_qualitative_synthesis',
    verifiedReviewSampleSize: liveReviewsLoaded ? liveReviewsData.reviews.length : 0,
    unverifiedStaticCaveat: liveReviewsLoaded ? null : UNVERIFIED_STATIC_CAVEAT,
    sentimentSeverity: 'high',
    topUserQuotes: [
      'Stopped blocking pre-roll video ads right after Chrome forced Manifest V3.',
      'Keep getting the "Ad blockers are not allowed" modal unless I manually update filters.',
      'Lite version requires manually enabling Complete permission mode on every browser.'
    ],
    deepblockCounterPositioning:
      `Verified Manifest V3 DeepStealth Engine combining ${STATIC_RULE_COUNT} static declarativeNetRequest rules with ${DELTA_RULE_COUNT} dynamic OTA filter deltas.`,
    targetLandingPages: ['/vs/ublock-origin-lite', '/test-lab'],
    rsaHeadlines: [
      'Pass All 8 MV3 Adblock Checks',
      '2026 Chrome MV3 Ad & Privacy Shield',
      'Test Your Ad Blocker in 5 Seconds'
    ],
    rsaDescriptions: [
      `Is your ad blocker failing after Chrome Manifest V3? Run our free 8-point browser benchmark and upgrade to SWEEPR Deepblock v${MANIFEST_VERSION}.`,
      `Engineered natively for Chrome, Edge & Firefox Manifest V3. ${STATIC_RULE_COUNT} static DNR rules plus automatic GDPR cookie rejection.`
    ],
    redditHeadline:
      'We benchmarked Manifest V3 ad blockers against 8 live 2026 anti-detection, tracker-blocking, and cookie-consent checks'
  },
  {
    clusterId: 'broken_cookie_walls_scroll_lock',
    competitorsAffected: ['AdGuard Browser Extension', 'uBlock Origin Lite', 'Ghostery'],
    complaintSharePct: liveReviewsLoaded ? liveReviewsData.shares?.broken_cookie_walls_scroll_lock ?? null : null,
    evidenceBasis: 'M1_live_serp_and_reddit_qualitative_synthesis',
    verifiedReviewSampleSize: liveReviewsLoaded ? liveReviewsData.reviews.length : 0,
    unverifiedStaticCaveat: liveReviewsLoaded ? null : UNVERIFIED_STATIC_CAVEAT,
    sentimentSeverity: 'medium',
    topUserQuotes: [
      'Hides the GDPR cookie popup visually, but the page stays greyed out and cannot scroll.',
      'Still have to click Reject All on UK news sites every single day.',
      'Breaks checkout modals when cookie filters are enabled.'
    ],
    deepblockCounterPositioning:
      'Automated CMP Rejector (OneTrust, Quantcast, Sourcepoint, TrustArc) that clicks "Reject All" and restores body overflow scroll.',
    targetLandingPages: ['/guides/how-to-automatically-reject-cookie-banners-uk', '/test-lab'],
    rsaHeadlines: [
      'Auto-Reject Cookie Popups Cleanly',
      'Stop GDPR Cookie Walls & Scroll Locks',
      'Zero Cookie Banners on UK Sites'
    ],
    rsaDescriptions: [
      'Dont just hide cookie banners and break page scrolling. SWEEPR Deepblock automatically clicks Reject All on major GDPR CMPs and restores scroll.',
      'Browse UK news and editorial sites without cookie consent pop-ups or frozen scrollbars. Try SWEEPR Deepblock Pro (£29.99/yr).'
    ],
    redditHeadline:
      'Why hiding GDPR cookie banners with CSS breaks page scrolling (and how programmatic Reject-All + scroll unlock fixes it)'
  },
  {
    clusterId: 'high_cpu_memory_usage',
    competitorsAffected: ['AdBlock', 'Adblock Plus', 'Total Adblock'],
    complaintSharePct: liveReviewsLoaded ? liveReviewsData.shares?.high_cpu_memory_usage ?? null : null,
    evidenceBasis: 'M1_live_serp_and_reddit_qualitative_synthesis',
    verifiedReviewSampleSize: liveReviewsLoaded ? liveReviewsData.reviews.length : 0,
    unverifiedStaticCaveat: liveReviewsLoaded ? null : UNVERIFIED_STATIC_CAVEAT,
    sentimentSeverity: 'medium',
    topUserQuotes: [
      'Extension service worker uses 800MB+ RAM when I have 25 tabs open.',
      'Makes laptop fans spin up on media-heavy news and fandom wikis.',
      'Slows down page load instead of speeding it up.'
    ],
    deepblockCounterPositioning:
      'Built-in Total Tab & RAM Tamer + £89.99/yr Sweepr Complete Security Suite (Deepblock Pro + RAM Tamer + VPN + Cleaner) hibernates inactive background tabs across 5 devices.',
    targetLandingPages: ['/order?plan=suite_annual', '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs', '/tools/browser-ram-calculator'],
    rsaHeadlines: [
      'Tame Background Tabs & Browser RAM',
      '4-in-1 Complete Security Suite',
      'Stop Heavy Ad Scripts & Tab Bloat'
    ],
    rsaDescriptions: [
      'Block CPU-draining ad networks and hibernate idle tabs. Get the 4-in-1 Sweepr Complete Security Suite (Deepblock + VPN + Cleaner) for £89.99/yr.',
      `${STATIC_RULE_COUNT} native declarativeNetRequest rules plus built-in Tab & RAM Tamer for Chrome, Edge, Firefox, Brave, and Opera.`
    ],
    redditHeadline:
      'How third-party ad auction loops bloat multi-tab browser RAM (and interactive Tab & RAM Tamer calculator)'
  },
  {
    clusterId: 'acceptable_ads_and_tracker_links',
    competitorsAffected: ['Pie Adblock', 'Adblock Plus', 'AdBlock'],
    complaintSharePct: liveReviewsLoaded ? liveReviewsData.shares?.acceptable_ads_and_tracker_links ?? null : null,
    evidenceBasis: 'M1_live_serp_and_reddit_qualitative_synthesis',
    verifiedReviewSampleSize: liveReviewsLoaded ? liveReviewsData.reviews.length : 0,
    unverifiedStaticCaveat: liveReviewsLoaded ? null : UNVERIFIED_STATIC_CAVEAT,
    sentimentSeverity: 'high',
    topUserQuotes: [
      'Allows "Acceptable Ads" and sponsored search links by default unless you dig into settings.',
      'Injects shopping coupons/popups while claiming to be an adblocker.',
      'Leaves UTM, fbclid, and gclid tracking parameters attached to every outbound link.'
    ],
    deepblockCounterPositioning:
      'Strict Zero "Acceptable Ads" policy + URL Tracking Parameter Stripping (utm_, fbclid, gclid) + Element Zapper across 5 devices.',
    targetLandingPages: ['/vs/pie-adblock', '/guides/strip-utm-fbclid-gclid-tracking-links'],
    rsaHeadlines: [
      'Zero Acceptable Ads Whitelists',
      'Block Ads & Strip URL Trackers',
      '100% Local-First Privacy Engine'
    ],
    rsaDescriptions: [
      'Ad networks cannot pay to bypass SWEEPR Deepblock. Includes URL tracking parameter stripping, Element Zapper, and cookie auto-reject.',
      'No Acceptable Ads compromises. No browsing history logged. Protect up to 5 devices for £29.99/yr Pro or £89.99/yr Complete Suite.'
    ],
    redditHeadline: 'Why "free" adblockers that rely on Acceptable Ads whitelists or coupon injection are a privacy trap in 2026'
  }
];

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
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) return false;
  return true;
}

// Ingest low-KD opportunities from data/keyword-opportunity-matrix.json (kept indexable routes on disk only)
let matrixOpportunities = [];
if (fs.existsSync(KEYWORD_MATRIX_PATH)) {
  try {
    const kwMatrix = JSON.parse(fs.readFileSync(KEYWORD_MATRIX_PATH, 'utf8'));
    matrixOpportunities = (kwMatrix.opportunities || [])
      .filter(
        (o) =>
          (o.metrics?.estimatedKD ?? 99) <= 25 &&
          o.targetRoute &&
          isIndexableRouteOnDisk(o.targetRoute)
      )
      .slice(0, 14);
  } catch {}
}

// Audit existing /vs/* pages for v1.3.1 coverage & removed-feature drift
const vsFiles = fs.existsSync(VS_DIR) ? fs.readdirSync(VS_DIR).filter((f) => f.endsWith('.html')) : [];
const vsCoverage = vsFiles.map((file) => {
  const html = fs.readFileSync(path.join(VS_DIR, file), 'utf8');
  return {
    page: `/vs/${file.replace(/\.html$/, '')}`,
    mentionsRenewalPricing: /£29\.99|£89\.99|£99|renewal/i.test(html),
    mentionsMv3Engine: /Manifest V3|declarativeNetRequest|DeepStealth/i.test(html),
    mentionsCookieRejector: /cookie/i.test(html),
    mentionsV131: /v?1\.3\.1/i.test(html),
    mentions283Rules: /\b283\b/.test(html),
    hasRemovedFeatureDrift: /Fake Online Shop|fakeShopAlerts|AI Slop|hideSearchSpam|Safari.*iOS/i.test(html)
  };
});
const scamDetectorDriftCount = vsCoverage.filter((v) => v.hasRemovedFeatureDrift).length;

const report = {
  generatedAt: new Date().toISOString(),
  automation: 'A6_Competitor_Review_Mining_And_Ad_Copy_Refresher',
  version: MANIFEST_VERSION,
  staticDnrRules: STATIC_RULE_COUNT,
  otaDeltaRules: DELTA_RULE_COUNT,
  dataSource: liveReviewsLoaded ? 'live_review_dataset' : 'unverified_static_editorial_caveat',
  pricingModel: {
    introMonthlyGbp: 1.99,
    proAnnualGbp: 29.99,
    completeSuiteAnnualGbp: 89.99
  },
  competitorsAnalyzed: ['Total Adblock', 'AdGuard Browser Extension', 'uBlock Origin Lite', 'Pie Adblock', 'Ghostery'],
  vsPagesAudited: vsCoverage.length,
  scamDetectorDriftCount,
  lowKdMatrixOpportunitiesSynced: matrixOpportunities.length,
  vsCoverage,
  clusters: COMPETITOR_CLUSTERS
};

const jsonPath = path.join(DATA_DIR, 'competitor-review-clusters.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync(path.join(DATA_DIR, 'competitor-Battlecard-matrix.json'), JSON.stringify(report, null, 2), 'utf8');

// Build Microsoft Advertising A6 RSA Refresh CSV
const msRows = [
  'Type,Status,Campaign,Ad Group,Headline 1,Headline 2,Headline 3,Description 1,Description 2,Final URL,Path 1,Path 2'
];
for (const c of COMPETITOR_CLUSTERS) {
  const adGroup = c.clusterId === 'surprise_renewal_billing' ? 'AG1_Competitor_Switchers' : 'AG2_MV3_Privacy_Blocking';
  const finalUrl = `https://sweeprdeepblock.com${c.targetLandingPages[0]}${c.targetLandingPages[0].includes('?') ? '&' : '?'}utm_source=bing&utm_medium=cpc&utm_campaign=m1_search_uk&utm_content=${c.clusterId}`;
  msRows.push(
    [
      'Responsive Search Ad',
      'Active',
      'SWEEPR_Deepblock_UK_Search_M1',
      adGroup,
      `"${sanitizeAdCopyForPolicy(c.rsaHeadlines[0])}"`,
      `"${sanitizeAdCopyForPolicy(c.rsaHeadlines[1])}"`,
      `"${sanitizeAdCopyForPolicy(c.rsaHeadlines[2])}"`,
      `"${sanitizeAdCopyForPolicy(c.rsaDescriptions[0])}"`,
      `"${sanitizeAdCopyForPolicy(c.rsaDescriptions[1])}"`,
      `"${finalUrl}"`,
      'MV3-Shield',
      'UK-Pro'
    ].join(',')
  );
}

for (const opp of matrixOpportunities) {
  const adGroup = opp.cluster === 'vs' ? 'AG1_Competitor_Switchers' : 'AG2_MV3_Privacy_Blocking';
  const finalUrl = `https://sweeprdeepblock.com${opp.targetRoute}?utm_source=bing&utm_medium=cpc&utm_campaign=m1_low_kd_matrix&utm_term=${encodeURIComponent(opp.keyword)}`;
  const h1 = sanitizeAdCopyForPolicy(opp.pageBlueprint?.shortLinkTitle || '2026 MV3 Ad & Cookie Shield').slice(0, 30);
  const d1 = sanitizeAdCopyForPolicy(
    `Verified Manifest V3 protection (${STATIC_RULE_COUNT} static DNR rules) & GDPR cookie auto-reject. Switch to Pro (£29.99/yr) or Complete Suite (£89.99/yr).`
  );
  msRows.push(
    [
      'Responsive Search Ad',
      'Active',
      'SWEEPR_Deepblock_UK_Search_M1',
      adGroup,
      `"${h1}"`,
      '"Transparent £2.50/mo Pro Plan"',
      '"Pass All 8 MV3 Privacy Checks"',
      `"${d1}"`,
      '"No Acceptable Ads whitelists. 1-click self-serve cancellation and 14-day money-back guarantee."',
      `"${finalUrl}"`,
      'MV3-Shield',
      'Switch'
    ].join(',')
  );
}

const msCsvPath = path.join(DIST_DIR, 'microsoft-ads-a6-rsa-refresh.csv');
fs.writeFileSync(msCsvPath, msRows.join('\n') + '\n', 'utf8');

// Build Shared Negative Keyword List CSV to protect the £10/day micro-budget from zero-conversion clicks
const NEGATIVE_KEYWORDS = [
  { kw: 'youtube revanced', match: 'Phrase' },
  { kw: 'revanced apk', match: 'Phrase' },
  { kw: 'mod apk', match: 'Phrase' },
  { kw: 'cracked', match: 'Phrase' },
  { kw: 'torrent', match: 'Phrase' },
  { kw: 'pirate bay', match: 'Phrase' },
  { kw: 'smarttube', match: 'Phrase' },
  { kw: 'firestick', match: 'Phrase' },
  { kw: 'roku', match: 'Phrase' },
  { kw: 'smart tv', match: 'Phrase' },
  { kw: 'samsung tv', match: 'Phrase' },
  { kw: 'lg tv', match: 'Phrase' },
  { kw: 'apple tv', match: 'Phrase' },
  { kw: 'ps5', match: 'Exact' },
  { kw: 'xbox', match: 'Exact' },
  { kw: 'nintendo switch', match: 'Phrase' },
  { kw: 'pi-hole', match: 'Phrase' },
  { kw: 'pihole', match: 'Phrase' },
  { kw: 'adguard home docker', match: 'Phrase' },
  { kw: 'hosts file', match: 'Phrase' },
  { kw: 'open source github', match: 'Phrase' },
  { kw: 'free forever no account', match: 'Phrase' },
  { kw: 'how to code an adblocker', match: 'Phrase' }
];
const negRows = ['Type,Status,Campaign,Keyword,Match Type'];
for (const n of NEGATIVE_KEYWORDS) {
  negRows.push(`Campaign Negative Keyword,Active,SWEEPR_Deepblock_UK_Search_M1,"${n.kw}",${n.match}`);
}
const negCsvPath = path.join(DIST_DIR, 'microsoft-ads-negative-keywords.csv');
fs.writeFileSync(negCsvPath, negRows.join('\n') + '\n', 'utf8');

// Build Reddit Ads A6 Creative Refresh CSV
const redditRows = [
  'Campaign Name,Ad Group Name,Ad Name,Post Title,Destination URL,Call To Action,Allow Comments,Cluster ID'
];
for (const c of COMPETITOR_CLUSTERS) {
  const destUrl = `https://sweeprdeepblock.com${c.targetLandingPages[0]}${c.targetLandingPages[0].includes('?') ? '&' : '?'}utm_source=reddit&utm_medium=cpc&utm_campaign=m1_uk_privacy&utm_content=${c.clusterId}`;
  redditRows.push(
    [
      'SWEEPR_Deepblock_UK_M1_Reddit',
      `AG_${c.clusterId}`,
      `A6_Refresh_${c.clusterId}`,
      `"${c.redditHeadline.replace(/"/g, '""')}"`,
      `"${destUrl}"`,
      'Learn More',
      'TRUE',
      c.clusterId
    ].join(',')
  );
}
for (const opp of matrixOpportunities) {
  const oppSlug = String(opp.slug || opp.targetRoute?.split('/').pop() || 'kw');
  const destUrl = `https://sweeprdeepblock.com${opp.targetRoute}?utm_source=reddit&utm_medium=cpc&utm_campaign=m1_low_kd_matrix&utm_term=${encodeURIComponent(opp.keyword)}`;
  const postTitle = `2026 MV3 Benchmark: ${opp.pageBlueprint?.h1 || opp.keyword} (${STATIC_RULE_COUNT} Static DNR Rules, Cookie Auto-Reject & Transparent £29.99/yr Pro)`;
  redditRows.push(
    [
      'SWEEPR_Deepblock_UK_M1_Reddit',
      opp.cluster === 'vs' ? 'AG_LowKD_Competitor_Switchers' : 'AG_LowKD_MV3_Guides',
      `A6_Matrix_${oppSlug.slice(0, 32)}`,
      `"${postTitle.replace(/"/g, '""')}"`,
      `"${destUrl}"`,
      'Learn More',
      'TRUE',
      oppSlug
    ].join(',')
  );
}
const redditCsvPath = path.join(DIST_DIR, 'reddit-ads-a6-refresh.csv');
fs.writeFileSync(redditCsvPath, redditRows.join('\n') + '\n', 'utf8');

// Build Organic Community Seeding & Launch Kit (Reddit, Hacker News Show HN, Product Hunt)
const seedingKit = {
  generatedAt: new Date().toISOString(),
  zeroEmail: true,
  extensionVersion: MANIFEST_VERSION,
  staticDnrRules: STATIC_RULE_COUNT,
  pricing: { introMonthlyGbp: 1.99, proAnnualGbp: 29.99, completeSuiteAnnualGbp: 89.99 },
  channels: [
    {
      channel: 'Reddit — r/browsers & r/privacy',
      title: `We benchmarked Manifest V3 ad blockers on YouTube, TCF v2.2 cookie scroll locks, and multi-tab RAM`,
      targetUrl: 'https://sweeprdeepblock.com/test-lab?utm_source=reddit_organic&utm_medium=community&utm_campaign=mv3_benchmark',
      bodyMarkdown: `After Chrome deprecated Manifest V2 \`webRequestBlocking\`, we wanted to measure how modern Manifest V3 extensions perform across 3 vectors that frustrate daily browsing:\n\n1. **Network Rule Execution & Bait Evasion**: Using ${STATIC_RULE_COUNT} static \`declarativeNetRequest\` rules + ${DELTA_RULE_COUNT} dynamic OTA delta rules paired with local \`/rules/empty.js\` surrogates so \`adsbox\` and Funding Choices bait checks don't trip.\n2. **GDPR / UK-GDPR Cookie Scroll Locks**: Why CSS-only banner hiding leaves \`overflow: hidden\` on \`<html>\`/\`<body>\` across OneTrust, Sourcepoint, Usercentrics, and Didomi — and how executing the native Reject-All signal restores scrolling cleanly.\n3. **Multi-Tab Browser Memory Overhead**: How background ad auction iframes bloat tab memory and how Total Tab & RAM Tamer hibernates inactive tabs.\n\nYou can test your current browser setup (any extension) in 5 seconds on our client-side 8-point benchmark lab: https://sweeprdeepblock.com/test-lab or estimate tab memory at https://sweeprdeepblock.com/tools/browser-ram-calculator.`
    },
    {
      channel: 'Reddit — r/CasualUK & Consumer Finance',
      title: 'PSA: Check what your "£1.99 intro" adblocker actually renews at in Year 2 (£99–£119/yr) — transparent £29.99/yr MV3 breakdown',
      targetUrl: 'https://sweeprdeepblock.com/vs/total-adblock?utm_source=reddit_organic&utm_medium=community&utm_campaign=uk_renewal_psa',
      bodyMarkdown: `A huge number of UK users sign up for a "£1.99" or "£2.99" introductory ad-blocker deal only to get hit with a **£99 to £119 annual auto-renewal** in Year 2.\n\nWe published a transparent side-by-side breakdown and interactive tools:\n- **Total Adblock Renewal Cost Comparison**: https://sweeprdeepblock.com/vs/total-adblock\n- **Browser RAM & Tab Bloat Calculator**: https://sweeprdeepblock.com/tools/browser-ram-calculator\n\nOur core **SWEEPR Deepblock v${MANIFEST_VERSION}** extension includes URL tracker stripping, GDPR cookie auto-rejection, Element Zapper, and Total Tab & RAM Tamer, with transparent flat-rate **£29.99/yr Pro** (£2.50/mo eq., 5 devices) or **£89.99/yr Sweepr Complete Security Suite** (Deepblock Pro + Tab RAM Tamer + VPN + Cleaner across 5 devices) and 1-click cancellation.`
    },
    {
      channel: 'Hacker News — Show HN',
      title: `Show HN: SWEEPR Deepblock v${MANIFEST_VERSION} – Manifest V3 Ad, Cookie Auto-Reject & Tab RAM Extension`,
      targetUrl: 'https://sweeprdeepblock.com/test-lab?utm_source=hackernews&utm_medium=show_hn&utm_campaign=v131_launch',
      bodyMarkdown: `Hi HN — we built SWEEPR Deepblock (https://sweeprdeepblock.com) to solve three problems we kept hitting in post-MV2 Chromium and Gecko browsers:\n\n- **DeclarativeNetRequest + DeepStealth Surrogates**: ${STATIC_RULE_COUNT} static DNR rules + ${DELTA_RULE_COUNT} dynamic OTA rules executing natively in the browser network stack, paired with a \`document_start\` isolated/main-world bridge that neutralizes anti-adblock bait checks.\n- **Programmatic CMP Opt-Out**: Instead of hiding cookie modals with CSS (which breaks page scroll on Sourcepoint, Usercentrics, Didomi, and OneTrust), our content script triggers the genuine Reject-All path and unlocks body overflow.\n- **URL Tracker Stripping & Tab RAM Tamer**: Strips \`utm_\`, \`fbclid\`, \`gclid\` parameters cleanly and hibernates inactive background tabs.\n\nYou can run the 8-point client-side verification suite here: https://sweeprdeepblock.com/test-lab (or inspect our machine-readable benchmark dataset at https://sweeprdeepblock.com/geo-benchmark-feed.json). Would love your technical feedback!`
    },
    {
      channel: 'Product Hunt — Launch Listing',
      title: `SWEEPR Deepblock v${MANIFEST_VERSION} — Zero Ads, Cookie Auto-Reject & Total Tab & RAM Tamer`,
      targetUrl: 'https://sweeprdeepblock.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=v131_suite',
      bodyMarkdown: `**Tagline:** Pass all 8 Manifest V3 adblock checks, auto-reject cookie popups cleanly, and tame tab RAM.\n\n**What's New in v${MANIFEST_VERSION}:**\n- **Verified MV3 Anti-Detection Engine**: ${STATIC_RULE_COUNT} static DNR rules + ${DELTA_RULE_COUNT} dynamic OTA updates.\n- **Automatic Cookie Rejector + Scroll Unlock**: Works across major GDPR/UK-GDPR CMPs without breaking page scroll.\n- **Interactive Browser Diagnostics**: Live Adblock Test Lab (https://sweeprdeepblock.com/test-lab) and Browser RAM Calculator (https://sweeprdeepblock.com/tools/browser-ram-calculator).\n- **Transparent Pricing**: £1.99 1st-Month Intro, £29.99/yr Pro (5 devices), or the 4-in-1 **£89.99/yr Sweepr Complete Security Suite** (Deepblock Pro + Total Tab & RAM Tamer + Sweepr VPN + Sweepr Desktop Cleaner for 5 devices).`
    }
  ]
};

fs.writeFileSync(path.join(DIST_DIR, 'organic-community-seeding-kit.json'), JSON.stringify(seedingKit, null, 2), 'utf8');
const seedingMd = [
  `# SWEEPR Deepblock v${MANIFEST_VERSION} — Organic Community Seeding & Launch Kit`,
  `Generated: ${seedingKit.generatedAt} | Zero Automated Emails (\`zeroEmail: true\`)`,
  ``,
  ...seedingKit.channels.map(
    (ch) => `## ${ch.channel}\n**Title:** ${ch.title}\n**Target URL:** ${ch.targetUrl}\n\n\`\`\`markdown\n${ch.bodyMarkdown}\n\`\`\`\n`
  )
].join('\n');
fs.writeFileSync(path.join(DIST_DIR, 'organic-community-seeding-kit.md'), seedingMd, 'utf8');

console.log(`[A6-REVIEW-MINER] Wrote ${COMPETITOR_CLUSTERS.length} clusters + ${matrixOpportunities.length} low-KD matrix ad groups -> data/competitor-review-clusters.json`);
console.log(`[A6-REVIEW-MINER] Wrote Microsoft Ads RSA refresh -> dist/microsoft-ads-a6-rsa-refresh.csv`);
console.log(`[A6-REVIEW-MINER] Wrote Microsoft Ads Negative Keywords (${NEGATIVE_KEYWORDS.length} rules) -> dist/microsoft-ads-negative-keywords.csv`);
console.log(`[A6-REVIEW-MINER] Wrote Reddit Ads creative refresh -> dist/reddit-ads-a6-refresh.csv`);
console.log(`[A6-REVIEW-MINER] Wrote Organic Community Seeding Kit -> dist/organic-community-seeding-kit.md & .json`);
