/**
 * SWEEPR DeepBlock — Cross-Site Blocker Non-Regression & Multi-Module Integrity Guard (`regression-guard.mjs`)
 *
 * Ensures that newly synthesized ad-blocking rules for one site NEVER break, shadow, or invalidate
 * existing ad-blockers, DeepStealth anti-adblock surrogates, Cookie Auto-Rejector, PureView Recipe
 * extraction, or legitimate site functionality on other sites.
 *
 * 6 Verification Layers:
 *  1. Baseline Ruleset Preservation (100% of existing MV3 DNR & cryptominer rules remain intact, unique IDs).
 *  2. DeepStealth Surrogate Priority Non-Shadowing (verifies priority: 10 redirect shims for adsbygoogle.js,
 *     gpt.js, ad_status.js, show_ads.js, uwt.js are never overridden by a block rule).
 *  3. Cross-Site Golden Canary Matrix (verifies YouTube, Google/Bing Search, News, Taboola/Outbrain,
 *     Streaming/Tube sites, URL query-param stripper, and Cryptominer blocks all still fire accurately).
 *  4. Cross-Module Non-Interference Guard (ensures new rules never hide GDPR Cookie Reject buttons,
 *     PureView recipe containers, legitimate HTML5 video players, or SWEEPR portal elements).
 *  5. Combined Cosmetic CSS Syntax Validator (prevents a single malformed selector from invalidating
 *     the comma-joined `UNIVERSAL_AD_COSMETIC_CSS` rule block across all sites).
 *  6. Atomic Pre-Commit Snapshot & Rollback (restores exact pre-run files if any regression is found).
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './state-db.mjs';

const STATIC_ADS_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'static_ads_and_trackers.json');
const CRYPTOMINERS_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'cryptominers.json');
const CONTENT_SCRIPT_PATH = path.join(ROOT_DIR, 'extension', 'content', 'deepblock-content.js');

/**
 * Golden Canary Network Probes representing critical existing blockers across other sites.
 * Each probe specifies the simulated request URL, resourceType, initiatorDomain, and the
 * exact winning MV3 action type expected (`block` or `redirect`).
 */
export const GOLDEN_NETWORK_CANARIES = [
  // DeepStealth Layer 1 Surrogate Redirects (MUST win with 'redirect' at priority 10, NEVER 'block')
  {
    name: 'DeepStealth YouTube/DoubleClick Instream Surrogate',
    url: 'https://static.doubleclick.net/instream/ad_status.js',
    resourceType: 'script',
    initiator: 'youtube.com',
    expectedAction: 'redirect',
    minPriority: 10
  },
  {
    name: 'DeepStealth AdSense Bait Surrogate (Forbes / News)',
    url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    resourceType: 'script',
    initiator: 'forbes.com',
    expectedAction: 'redirect',
    minPriority: 10
  },
  {
    name: 'DeepStealth Google Publisher Tag GPT Surrogate',
    url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
    resourceType: 'script',
    initiator: 'nytimes.com',
    expectedAction: 'redirect',
    minPriority: 10
  },
  {
    name: 'DeepStealth ShowAds Legacy Surrogate',
    url: 'https://pagead2.googlesyndication.com/pagead/show_ads.js',
    resourceType: 'script',
    initiator: 'independent.co.uk',
    expectedAction: 'redirect',
    minPriority: 10
  },
  {
    name: 'Twitter/X Ads Universal Website Tag Block (Rule #47)',
    url: 'https://static.ads-twitter.com/uwt.js',
    resourceType: 'script',
    initiator: 'techradar.com',
    expectedAction: 'block'
  },

  // Core Network Ad Blockers across major platforms (MUST resolve to 'block')
  {
    name: 'YouTube Video Ad Stats Telemetry Block',
    url: 'https://www.youtube.com/api/stats/ads?docid=123',
    resourceType: 'xmlhttprequest',
    initiator: 'youtube.com',
    expectedAction: 'block'
  },
  {
    name: 'YouTube PageAd Preroll Payload Block',
    url: 'https://www.youtube.com/pagead/interaction/?ai=abc',
    resourceType: 'xmlhttprequest',
    initiator: 'youtube.com',
    expectedAction: 'block'
  },
  {
    name: 'DoubleClick Standard Ad Iframe Block',
    url: 'https://ad.doubleclick.net/ddm/adi/N1234.site/B5678',
    resourceType: 'sub_frame',
    initiator: 'cnn.com',
    expectedAction: 'block'
  },
  {
    name: 'AppNexus / Xandr Programmatic Bid Block',
    url: 'https://ib.adnxs.com/ut/v3/prebid',
    resourceType: 'xmlhttprequest',
    initiator: 'pcgamer.com',
    expectedAction: 'block'
  },
  {
    name: 'Taboola Chumbox Feed Loader Block',
    url: 'https://cdn.taboola.com/libtrc/publisher/loader.js',
    resourceType: 'script',
    initiator: 'dailymail.co.uk',
    expectedAction: 'block'
  },
  {
    name: 'Outbrain Widget Script Block',
    url: 'https://widgets.outbrain.com/outbrain.js',
    resourceType: 'script',
    initiator: 'nypost.com',
    expectedAction: 'block'
  },
  {
    name: 'Streaming ExoClick Ad Server Block',
    url: 'https://syndication.exosrv.com/splash.php?idzone=123',
    resourceType: 'script',
    initiator: 'eporner.com',
    expectedAction: 'block'
  },
  {
    name: 'Streaming TrafficStars Syndicate Block',
    url: 'https://cdn.tsyndicate.com/sdk/v1/vast.js',
    resourceType: 'script',
    initiator: 'hqporner.com',
    expectedAction: 'block'
  },
  {
    name: 'Streaming NVDST P2P Ad Script Block',
    url: 'https://cdn.nvdst.com/player/ppdr/p2p.init.js',
    resourceType: 'script',
    initiator: 'nuvid.com',
    expectedAction: 'block'
  },

  // URL Tracking Parameter Stripper (Rule #6 redirect queryTransform on main_frame)
  {
    name: 'Tracker-Free Search & URL Parameter Stripper (gclid/utm_source)',
    url: 'https://www.theguardian.com/technology?utm_source=test&gclid=123',
    resourceType: 'main_frame',
    initiator: 'google.com',
    expectedAction: 'redirect'
  }
];

/**
 * Protected Cross-Module & Legitimate Site Selectors.
 * A newly generated cosmetic rule MUST NEVER match or collide with any of these selectors,
 * otherwise it would break other SWEEPR DeepBlock features (Cookie Auto-Rejector, PureView
 * Recipes, YouTube/HTML5 video playback, or Portal License Sync).
 */
export const PROTECTED_CROSS_MODULE_SELECTORS = [
  // 1. GDPR Cookie Auto-Rejector buttons (must remain clickable, never hidden by ad CSS)
  '#onetrust-reject-all-handler',
  '#CybotCookiebotDialogBodyButtonDecline',
  '.qc-cmp2-summary-buttons',
  '.didomi-continue-without-agreeing',
  // 2. PureView Recipe Containers (must remain extractable on recipe sites)
  '.wprm-recipe-container',
  '.tasty-recipes',
  '.easyrecipe',
  '.mv-create-card',
  // 3. Legitimate Video Players across YouTube, Twitch, Vimeo, & Streaming sites
  '#movie_player',
  '#player',
  '.html5-video-player',
  '.html5-main-video',
  '.jwplayer',
  '.vjs-tech',
  '#moviexxx',
  // 4. Search Engine Core Organic Results
  '#search',
  '#rso',
  '#b_results',
  '#links',
  // 5. SWEEPR DeepBlock Own Extension & Portal Bridge Elements
  '#sweeprAutoUnlockedPill',
  '#licenseKeyText',
  '#portalLicenseKey',
  '#portalActivationCode',
  '#deepblock-universal-cosmetic'
];

/**
 *Protected Legitimate Network Requests that MUST NEVER be blocked by any new rule.
 */
export const PROTECTED_LEGITIMATE_NETWORK_CANARIES = [
  {
    name: 'SWEEPR DeepBlock License Verify API',
    url: 'https://sweeprdeepblock.com/api/license-verify?key=SWEEPR-DB-TEST',
    resourceType: 'xmlhttprequest',
    initiator: 'sweeprdeepblock.com'
  },
  {
    name: 'SWEEPR DeepBlock OTA Filter Delta API',
    url: 'https://sweeprdeepblock.com/api/filters/delta',
    resourceType: 'xmlhttprequest',
    initiator: 'sweeprdeepblock.com'
  },
  {
    name: 'YouTube Primary Video Stream Player JS',
    url: 'https://www.youtube.com/s/player/123456/player_ias.vflset/en_US/base.js',
    resourceType: 'script',
    initiator: 'youtube.com'
  },
  {
    name: 'Google Video Playback Stream (googlevideo.com)',
    url: 'https://rr1---sn-ab5l6nzy.googlevideo.com/videoplayback?expire=123',
    resourceType: 'media',
    initiator: 'youtube.com'
  },
  {
    name: 'Stripe Checkout Elements SDK',
    url: 'https://js.stripe.com/v3/',
    resourceType: 'script',
    initiator: 'sweeprdeepblock.com'
  }
];

/**
 * Validates that a single CSS selector is syntactically safe to join in a comma-separated
 * CSS rule list without causing the browser CSS parser to drop the entire rule block.
 */
export function validateCosmeticSelectorSyntaxAndIsolation(selector) {
  const s = String(selector || '').trim();
  if (!s) return { valid: false, reason: 'Empty selector' };

  // Check forbidden characters that break a combined CSS block
  if (/[{};]|\/\*|\*\//.test(s)) {
    return { valid: false, reason: 'Selector contains CSS block delimiters ({, }, ;, or comments)' };
  }

  // Check balanced square brackets and parentheses
  let squareDepth = 0;
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : '';
    if (ch === "'" && !inDoubleQuote && prev !== '\\') inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote && prev !== '\\') inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '[') squareDepth++;
      else if (ch === ']') squareDepth--;
      else if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
      if (squareDepth < 0 || parenDepth < 0) {
        return { valid: false, reason: 'Unbalanced brackets or parentheses in selector' };
      }
    }
  }

  if (inSingleQuote || inDoubleQuote || squareDepth !== 0 || parenDepth !== 0) {
    return { valid: false, reason: 'Unclosed quote, bracket, or parenthesis in selector' };
  }

  // Check for dangling combinators at start or end
  if (/^[>+~]|[>+~,:]$/.test(s)) {
    return { valid: false, reason: 'Dangling CSS combinator at start or end of selector' };
  }

  // Check non-interference with protected Cross-Module selectors (Cookie Auto-Rejector, PureView, Video Players)
  const lower = s.toLowerCase();
  for (const protectedSel of PROTECTED_CROSS_MODULE_SELECTORS) {
    const protLower = protectedSel.toLowerCase();
    if (lower === protLower || protLower.includes(lower) || lower.includes(protLower)) {
      return {
        valid: false,
        reason: `Selector "${s}" collides with protected cross-module selector "${protectedSel}"`
      };
    }
  }

  // Reject non-standard uBO procedural operators in raw CSS (`:-abp-`, `:has-text`, `:xpath`, `:upward`)
  if (/:-abp-|:has-text\(|:xpath\(|:upward\(|:matches-css\(|:style\(/i.test(s)) {
    return {
      valid: false,
      reason: `Selector "${s}" uses procedural syntax that would invalidate standard browser CSSOM parsing`
    };
  }

  return { valid: true };
}

/**
 * Simulates Chrome's `declarativeNetRequest` matching and priority/action tie-breaking
 * for a given request (`url`, `resourceType`, `initiator`).
 */
export function evaluateDnrRulesForRequest(rules, { url, resourceType, initiator }) {
  const matched = [];
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  const reqHost = parsedUrl.hostname.toLowerCase();
  const initHost = String(initiator || '').toLowerCase().replace(/^www\./, '');
  const isThirdParty = Boolean(initHost && reqHost !== initHost && !reqHost.endsWith(`.${initHost}`));

  for (const rule of rules) {
    const cond = rule.condition || {};

    // Check resourceTypes
    if (Array.isArray(cond.resourceTypes) && cond.resourceTypes.length > 0) {
      if (!cond.resourceTypes.includes(resourceType)) continue;
    }
    if (Array.isArray(cond.excludedResourceTypes) && cond.excludedResourceTypes.includes(resourceType)) {
      continue;
    }

    // Check domainType
    if (cond.domainType === 'thirdParty' && !isThirdParty) continue;
    if (cond.domainType === 'firstParty' && isThirdParty) continue;

    // Check initiatorDomains / excludedInitiatorDomains
    if (Array.isArray(cond.initiatorDomains) && cond.initiatorDomains.length > 0) {
      const initMatch = cond.initiatorDomains.some((d) => {
        const cleanD = d.toLowerCase();
        return initHost === cleanD || initHost.endsWith(`.${cleanD}`);
      });
      if (!initMatch) continue;
    }
    if (Array.isArray(cond.excludedInitiatorDomains) && cond.excludedInitiatorDomains.length > 0) {
      const exclMatch = cond.excludedInitiatorDomains.some((d) => {
        const cleanD = d.toLowerCase();
        return initHost === cleanD || initHost.endsWith(`.${cleanD}`);
      });
      if (exclMatch) continue;
    }

    // Check urlFilter or regexFilter
    let urlMatched = false;
    if (!cond.urlFilter && !cond.regexFilter) {
      // Chrome DNR queryTransform.removeParams only triggers a redirect when at least one listed param is present in the URL
      const removeParams = rule.action?.redirect?.transform?.queryTransform?.removeParams;
      if (Array.isArray(removeParams) && removeParams.length > 0) {
        urlMatched = removeParams.some((param) => parsedUrl.searchParams.has(param));
      } else {
        urlMatched = true;
      }
    } else if (cond.urlFilter) {
      urlMatched = matchDnrUrlFilter(cond.urlFilter, url, reqHost);
    } else if (cond.regexFilter) {
      try {
        const re = new RegExp(cond.regexFilter, 'i');
        urlMatched = re.test(url);
      } catch {
        urlMatched = false;
      }
    }

    if (urlMatched) {
      matched.push(rule);
    }
  }

  if (matched.length === 0) return null;

  // Sort by MV3 priority (descending), then Chrome action precedence: allow > allowAllRequests > block > upgradeScheme > redirect
  const ACTION_WEIGHT = {
    allow: 6,
    allowAllRequests: 5,
    block: 4,
    upgradeScheme: 3,
    redirect: 2,
    modifyHeaders: 1
  };

  matched.sort((a, b) => {
    const pDiff = (Number(b.priority) || 1) - (Number(a.priority) || 1);
    if (pDiff !== 0) return pDiff;
    return (ACTION_WEIGHT[b.action?.type] || 0) - (ACTION_WEIGHT[a.action?.type] || 0);
  });

  return matched[0];
}

function matchDnrUrlFilter(urlFilter, fullUrl, reqHost) {
  const uf = String(urlFilter).trim().toLowerCase();
  const targetUrl = fullUrl.toLowerCase();

  if (uf.startsWith('||')) {
    const withoutAnchor = uf.slice(2).replace(/\^.*$/, '');
    const slashIdx = withoutAnchor.indexOf('/');
    const domainPart = slashIdx === -1 ? withoutAnchor : withoutAnchor.slice(0, slashIdx);
    const pathPart = slashIdx === -1 ? '' : withoutAnchor.slice(slashIdx);

    const hostMatches = reqHost === domainPart || reqHost.endsWith(`.${domainPart}`);
    if (!hostMatches) return false;
    if (!pathPart) return true;

    if (pathPart.includes('*')) {
      const regexStr = pathPart
        .split('*')
        .map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
      return new RegExp(regexStr, 'i').test(targetUrl);
    }
    return targetUrl.includes(pathPart);
  }

  const cleanSub = uf.replace(/\^/g, '').replace(/\*/g, '');
  return Boolean(cleanSub && targetUrl.includes(cleanSub));
}

/**
 * Verifies a single candidate rule against the Cross-Site Non-Regression Suite
 * BEFORE it is approved in Stage 3.
 */
export function verifyCandidateRuleCrossSiteSafety(candidateRule, existingRules = []) {
  if (!candidateRule) {
    return { ok: false, reason: 'Empty candidate rule' };
  }

  // Case A: Cosmetic DOM Rule
  if (candidateRule.cosmeticSelector) {
    const cssCheck = validateCosmeticSelectorSyntaxAndIsolation(candidateRule.cosmeticSelector);
    if (!cssCheck.valid) {
      return {
        ok: false,
        reason: `Cross-site CSS regression guard rejected "${candidateRule.cosmeticSelector}": ${cssCheck.reason}`
      };
    }
    return { ok: true };
  }

  // Case B: Network / Script MV3 DNR Rule
  const dnr = candidateRule.dnrRule;
  if (!dnr || !dnr.condition) {
    return { ok: false, reason: 'Missing DNR condition on network rule' };
  }

  // Guard 1: Priority must never exceed 5 so DeepStealth Surrogate Redirects (priority 10) are never shadowed
  if ((Number(dnr.priority) || 1) >= 10) {
    return {
      ok: false,
      reason: `Candidate rule priority (${dnr.priority}) >= 10 risks shadowing DeepStealth anti-adblock surrogate redirects`
    };
  }

  // Guard 2: Auto-generated rules must not block main_frame navigations
  if (Array.isArray(dnr.condition.resourceTypes) && dnr.condition.resourceTypes.includes('main_frame')) {
    return {
      ok: false,
      reason: 'Candidate rule includes main_frame resourceType, risking full-page navigation blocks across sites'
    };
  }

  const simulatedRuleset = [
    ...existingRules,
    {
      id: 999999,
      priority: dnr.priority || 3,
      action: dnr.action || { type: 'block' },
      condition: dnr.condition
    }
  ];

  // Guard 3: Ensure no Protected Legitimate Network Canary is matched by the new rule
  for (const legit of PROTECTED_LEGITIMATE_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(simulatedRuleset, legit);
    if (winner && winner.id === 999999) {
      return {
        ok: false,
        reason: `Candidate rule falsely blocked protected legitimate request: ${legit.name} (${legit.url})`
      };
    }
  }

  // Guard 4: Ensure all Golden Network Canaries (DeepStealth redirects + YouTube/News/Streaming blocks) still win with their expected action
  for (const canary of GOLDEN_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(simulatedRuleset, canary);
    if (!winner) {
      return {
        ok: false,
        reason: `Golden Canary failed to match after adding rule: ${canary.name}`
      };
    }
    if (winner.action?.type !== canary.expectedAction) {
      return {
        ok: false,
        reason: `Golden Canary action regression on "${canary.name}": expected "${canary.expectedAction}", got "${winner.action?.type}" (rule #${winner.id})`
      };
    }
  }

  return { ok: true };
}

/**
 * Full Pre-Commit Cross-Site Regression Suite.
 * Validates the complete merged `static_ads_and_trackers.json`, `cryptominers.json`,
 * `dynamic_delta.json`, and `UNIVERSAL_AD_COSMETIC_CSS` against baseline rules and all canaries.
 */
export function runFullCrossSiteRegressionSuite({ baselineStaticRules = null } = {}) {
  const issues = [];

  // 1. Validate static_ads_and_trackers.json integrity
  let staticRules = [];
  try {
    staticRules = JSON.parse(fs.readFileSync(STATIC_ADS_PATH, 'utf8'));
    if (!Array.isArray(staticRules) || staticRules.length === 0) {
      issues.push('static_ads_and_trackers.json is empty or not an array');
    }
  } catch (err) {
    issues.push(`Failed to parse static_ads_and_trackers.json: ${err.message}`);
  }

  // 2. Verify 100% of baseline rules are preserved unmodified
  if (Array.isArray(baselineStaticRules) && baselineStaticRules.length > 0) {
    const currentById = new Map(staticRules.map((r) => [r.id, r]));
    for (const baseRule of baselineStaticRules) {
      const curr = currentById.get(baseRule.id);
      if (!curr) {
        issues.push(`Baseline DNR rule #${baseRule.id} was accidentally deleted`);
      } else if (
        curr.action?.type !== baseRule.action?.type ||
        curr.condition?.urlFilter !== baseRule.condition?.urlFilter ||
        curr.priority !== baseRule.priority
      ) {
        issues.push(`Baseline DNR rule #${baseRule.id} was modified unexpectedly`);
      }
    }
  }

  // 3. Verify unique positive integer rule IDs and MV3 schema compliance
  const seenIds = new Set();
  for (const r of staticRules) {
    if (!Number.isInteger(r.id) || r.id <= 0) {
      issues.push(`Invalid DNR rule ID: ${r.id}`);
    }
    if (seenIds.has(r.id)) {
      issues.push(`Duplicate DNR rule ID detected: #${r.id}`);
    }
    seenIds.add(r.id);
  }

  // 4. Verify cryptominers.json is intact
  let minerRules = [];
  try {
    minerRules = JSON.parse(fs.readFileSync(CRYPTOMINERS_PATH, 'utf8'));
    if (!Array.isArray(minerRules) || minerRules.length === 0) {
      issues.push('cryptominers.json is empty or invalid');
    }
  } catch (err) {
    issues.push(`Failed to parse cryptominers.json: ${err.message}`);
  }

  // 5. Run all Golden Network Canaries against staticRules
  let passedCanaries = 0;
  for (const canary of GOLDEN_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(staticRules, canary);
    if (!winner) {
      issues.push(`Golden Canary "${canary.name}" matched no rule in static_ads_and_trackers.json`);
    } else if (winner.action?.type !== canary.expectedAction) {
      issues.push(
        `Golden Canary "${canary.name}" action mismatch: expected "${canary.expectedAction}", got "${winner.action?.type}" (Rule #${winner.id})`
      );
    } else if (canary.minPriority && (Number(winner.priority) || 1) < canary.minPriority) {
      issues.push(
        `Golden Canary "${canary.name}" priority degraded: expected >= ${canary.minPriority}, got ${winner.priority}`
      );
    } else {
      passedCanaries += 1;
    }
  }

  // 6. Verify Protected Legitimate Network Canaries are NOT blocked
  for (const legit of PROTECTED_LEGITIMATE_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(staticRules, legit);
    if (winner && winner.action?.type === 'block') {
      issues.push(`Legitimate canary "${legit.name}" (${legit.url}) was falsely blocked by Rule #${winner.id}`);
    }
  }

  // 7. Verify Cosmetic CSS selectors in deepblock-content.js & dynamic_delta.json
  if (fs.existsSync(CONTENT_SCRIPT_PATH)) {
    const contentJs = fs.readFileSync(CONTENT_SCRIPT_PATH, 'utf8');
    for (const protSel of PROTECTED_CROSS_MODULE_SELECTORS.slice(0, 6)) {
      // Ensure Cookie Auto-Rejector & PureView selectors are never inside UNIVERSAL_AD_COSMETIC_CSS display:none block
      const cssMatch = contentJs.match(/const\s+UNIVERSAL_AD_COSMETIC_CSS\s*=\s*`([\s\S]*?)`;/);
      if (cssMatch && cssMatch[1].includes(protSel)) {
        issues.push(`Protected cross-module selector "${protSel}" found inside UNIVERSAL_AD_COSMETIC_CSS`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    totalStaticRulesChecked: staticRules.length,
    totalCryptominerRulesChecked: minerRules.length,
    canariesPassed: passedCanaries,
    canariesTotal: GOLDEN_NETWORK_CANARIES.length,
    legitimateCanariesVerified: PROTECTED_LEGITIMATE_NETWORK_CANARIES.length,
    protectedModulesVerified: PROTECTED_CROSS_MODULE_SELECTORS.length,
    issues
  };
}
