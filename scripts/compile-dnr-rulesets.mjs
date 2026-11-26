#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Deterministic MV3 DeclarativeNetRequest Ruleset Compiler
 *
 * Compiles cached authentic upstream filter lists from `data/filter-sources/`:
 *   - easylist.txt        -> extension/rules/static_ads_and_trackers.json (preserves IDs 1..298 + surgical allow 500.. + EasyList 1000+)
 *   - easyprivacy.txt     -> extension/rules/easyprivacy_trackers.json
 *   - easylistgermany.txt + liste_fr.txt + easylistspanish.txt -> extension/rules/regional_eu_filters.json
 *   - tracker_params      -> extension/rules/tracker_params.json (Rule #6, 229 tracking query parameters)
 *   - cryptominers.json   -> validated & preserved intact (18 rules, IDs 101..118)
 *
 * Modes:
 *   node scripts/compile-dnr-rulesets.mjs           (offline deterministic mode)
 *   node scripts/compile-dnr-rulesets.mjs --refresh (downloads upstream sources via curl.exe first)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  GOLDEN_NETWORK_CANARIES,
  PROTECTED_LEGITIMATE_NETWORK_CANARIES,
  evaluateDnrRulesForRequest
} from './ad-filter-pipeline/regression-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT_DIR, 'data', 'filter-sources');
const RULES_DIR = path.join(ROOT_DIR, 'extension', 'rules');

const STATIC_ADS_PATH = path.join(RULES_DIR, 'static_ads_and_trackers.json');
const EASYPRIVACY_PATH = path.join(RULES_DIR, 'easyprivacy_trackers.json');
const REGIONAL_EU_PATH = path.join(RULES_DIR, 'regional_eu_filters.json');
const TRACKER_PARAMS_PATH = path.join(RULES_DIR, 'tracker_params.json');
const CRYPTOMINERS_PATH = path.join(RULES_DIR, 'cryptominers.json');

const SWEEPR_DOMAINS = [
  'sweeprdeepblock.com',
  'www.sweeprdeepblock.com',
  'sweeprcleaner.com',
  'www.sweeprcleaner.com',
  'sweeprvpn.com',
  'www.sweeprvpn.com'
];

const UPSTREAM_SOURCES = [
  {
    file: 'easylist.txt',
    urls: [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist-downloads.adblockplus.org/easylist.txt'
    ],
    minBytes: 1_500_000
  },
  {
    file: 'easyprivacy.txt',
    urls: [
      'https://easylist-downloads.adblockplus.org/easyprivacy.txt',
      'https://easylist.to/easylist/easyprivacy.txt'
    ],
    minBytes: 1_000_000
  },
  {
    file: 'easylistgermany.txt',
    urls: [
      'https://easylist.to/easylistgermany/easylistgermany.txt',
      'https://easylist-downloads.adblockplus.org/easylistgermany.txt'
    ],
    minBytes: 200_000
  },
  {
    file: 'liste_fr.txt',
    urls: [
      'https://easylist-downloads.adblockplus.org/liste_fr.txt'
    ],
    minBytes: 300_000
  },
  {
    file: 'easylistspanish.txt',
    urls: [
      'https://easylist-downloads.adblockplus.org/easylistspanish.txt'
    ],
    minBytes: 80_000
  }
];

const DEFAULT_SUBRESOURCE_TYPES = [
  'script',
  'image',
  'xmlhttprequest',
  'sub_frame',
  'stylesheet',
  'font',
  'media',
  'ping',
  'websocket',
  'object',
  'other'
];

const RESOURCE_TYPE_MAP = new Map([
  ['script', 'script'],
  ['image', 'image'],
  ['xmlhttprequest', 'xmlhttprequest'],
  ['xhr', 'xmlhttprequest'],
  ['subdocument', 'sub_frame'],
  ['stylesheet', 'stylesheet'],
  ['css', 'stylesheet'],
  ['font', 'font'],
  ['media', 'media'],
  ['ping', 'ping'],
  ['beacon', 'ping'],
  ['websocket', 'websocket'],
  ['object', 'object'],
  ['object-subrequest', 'object'],
  ['other', 'other']
]);

const UNSUPPORTED_OPTIONS = new Set([
  'csp',
  'popup',
  'popunder',
  'removeparam',
  'redirect',
  'redirect-rule',
  'rewrite',
  'badfilter',
  'generichide',
  'genericblock',
  'elemhide',
  'specifichide',
  'document',
  'doc',
  'all',
  'webrtc',
  'header',
  'replace',
  'empty',
  'mp4',
  'strict1p',
  'strict3p',
  'cname',
  'denyallow',
  'permissions',
  'uritransform',
  'method',
  'ipaddress',
  'to',
  'reason'
]);

const BROAD_ROOT_DOMAINS = new Set([
  'com',
  'net',
  'org',
  'edu',
  'gov',
  'info',
  'biz',
  'io',
  'co',
  'uk',
  'co.uk',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'ru',
  'cn',
  'jp',
  'br',
  'au',
  'ca',
  'us',
  'eu',
  'cloudfront.net',
  'amazonaws.com',
  's3.amazonaws.com',
  'googleapis.com',
  'gstatic.com',
  'google.com',
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'cloudflare.com',
  'akamaized.net',
  'akamaihd.net',
  'fastly.net',
  'jsdelivr.net',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'github.com',
  'github.io',
  'githubusercontent.com',
  'herokuapp.com',
  'azureedge.net',
  'stripe.com',
  'paypal.com',
  'paypalobjects.com',
  'shopify.com',
  'apple.com',
  'microsoft.com',
  'live.com',
  'recaptcha.net',
  'hcaptcha.com',
  'sweeprdeepblock.com',
  'sweeprcleaner.com',
  'sweeprvpn.com'
]);

const SURROGATE_URLS = [
  { url: 'https://static.doubleclick.net/instream/ad_status.js', resourceType: 'script', initiator: 'youtube.com' },
  { url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', resourceType: 'script', initiator: 'forbes.com' },
  { url: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', resourceType: 'script', initiator: 'nytimes.com' },
  { url: 'https://pagead2.googlesyndication.com/pagead/show_ads.js', resourceType: 'script', initiator: 'independent.co.uk' }
];

const BANNED_SUBSTRINGS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '817797',
  'chrome-extension://',
  'moz-extension://',
  'safari-web-extension://',
  'data:'
];

const SURGICAL_ALLOW_SPECS = [
  // Payment / Checkout
  { urlFilter: '||js.stripe.com^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest'] },
  { urlFilter: '||checkout.stripe.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image', 'font'] },
  { urlFilter: '||api.stripe.com^', resourceTypes: ['xmlhttprequest', 'script', 'sub_frame'] },
  { urlFilter: '||m.stripe.network^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest'] },
  { urlFilter: '||hooks.stripe.com^', resourceTypes: ['sub_frame', 'xmlhttprequest', 'script'] },
  { urlFilter: '||paypal.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'] },
  { urlFilter: '||paypalobjects.com^', resourceTypes: ['script', 'image', 'stylesheet', 'font', 'sub_frame'] },
  { urlFilter: '||js.braintreegateway.com^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest'] },
  { urlFilter: '||assets.braintreegateway.com^', resourceTypes: ['script', 'sub_frame', 'stylesheet', 'image'] },
  { urlFilter: '||checkoutshopper-live.adyen.com^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'stylesheet'] },
  { urlFilter: '||checkout.shopify.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet'] },
  { urlFilter: '||cdn.shopify.com^', resourceTypes: ['script', 'stylesheet', 'font', 'image', 'xmlhttprequest'] },
  { urlFilter: '||shop.app^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'] },
  // OAuth / SSO
  { urlFilter: '||accounts.google.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image', 'font'] },
  { urlFilter: '||oauth2.googleapis.com^', resourceTypes: ['xmlhttprequest', 'script'] },
  { urlFilter: '||login.microsoftonline.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||login.live.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||appleid.apple.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'] },
  { urlFilter: '||idmsa.apple.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'] },
  { urlFilter: '||auth0.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet'] },
  { urlFilter: '||okta.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet'] },
  { urlFilter: '||oktacdn.com^', resourceTypes: ['script', 'stylesheet', 'font', 'image'] },
  { urlFilter: '||github.com/login/', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest'] },
  { urlFilter: '||github.com/sessions/', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] },
  // YouTube Playback
  { urlFilter: '||googlevideo.com^', resourceTypes: ['media', 'xmlhttprequest', 'other'] },
  { urlFilter: '||ytimg.com^', resourceTypes: ['image', 'script', 'stylesheet', 'font', 'xmlhttprequest'] },
  { urlFilter: '||youtube.com/youtubei/', resourceTypes: ['xmlhttprequest', 'other'] },
  { urlFilter: '||youtube.com/s/player/', resourceTypes: ['script', 'stylesheet', 'xmlhttprequest'] },
  { urlFilter: '||youtube-nocookie.com/s/player/', resourceTypes: ['script', 'stylesheet', 'xmlhttprequest'] },
  // JS / Font CDNs
  { urlFilter: '||fonts.googleapis.com^', resourceTypes: ['stylesheet', 'font'] },
  { urlFilter: '||fonts.gstatic.com^', resourceTypes: ['font', 'stylesheet', 'image'] },
  { urlFilter: '||cdn.jsdelivr.net^', resourceTypes: ['script', 'stylesheet', 'font', 'xmlhttprequest'] },
  { urlFilter: '||cdnjs.cloudflare.com^', resourceTypes: ['script', 'stylesheet', 'font', 'xmlhttprequest'] },
  { urlFilter: '||unpkg.com^', resourceTypes: ['script', 'stylesheet', 'font', 'xmlhttprequest'] },
  { urlFilter: '||ajax.googleapis.com^', resourceTypes: ['script', 'stylesheet'] },
  { urlFilter: '||d3e54v103j8qbb.cloudfront.net^', resourceTypes: ['script', 'stylesheet', 'font', 'image'] },
  { urlFilter: '||cdn.prod.website-files.com^', resourceTypes: ['script', 'stylesheet', 'font', 'image', 'media'] },
  { urlFilter: '||files.finsweet.com^', resourceTypes: ['script', 'xmlhttprequest'] },
  { urlFilter: '||cdn.finsweet.com^', resourceTypes: ['script', 'stylesheet', 'xmlhttprequest'] },
  // SWEEPR Domains + Scoped Analytics
  { urlFilter: '||sweeprdeepblock.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image', 'font', 'ping', 'media', 'other'] },
  { urlFilter: '||sweeprcleaner.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image', 'font', 'ping', 'media', 'other'] },
  { urlFilter: '||sweeprvpn.com^', resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest', 'stylesheet', 'image', 'font', 'ping', 'media', 'other'] },
  { urlFilter: '||google-analytics.com^', resourceTypes: ['script', 'image', 'xmlhttprequest', 'ping'], initiatorDomains: SWEEPR_DOMAINS },
  { urlFilter: '||googletagmanager.com^', resourceTypes: ['script', 'xmlhttprequest', 'ping'], initiatorDomains: SWEEPR_DOMAINS },
  // Captcha / Bot Verification
  { urlFilter: '||challenges.cloudflare.com^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||www.google.com/recaptcha/', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||www.gstatic.com/recaptcha/', resourceTypes: ['script', 'image', 'stylesheet'] },
  { urlFilter: '||recaptcha.net^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||hcaptcha.com^', resourceTypes: ['script', 'sub_frame', 'xmlhttprequest', 'stylesheet', 'image'] },
  { urlFilter: '||newassets.hcaptcha.com^', resourceTypes: ['script', 'stylesheet', 'image', 'font'] }
];

const TRACKER_REMOVE_PARAMS = [
  // Existing 20 (preserved)
  'gclid', 'gclsrc', 'fbclid', 'msclkid', 'twclid', 'ttclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'mc_eid', 'oly_enc_id', 'oly_anon_id', '_hsenc', '_hsmi',
  'vero_id', 'igshid', 'yclid', 'rb_clickid',
  // Google Ads / GA / Search Telemetry (31)
  'dclid', 'wbraid', 'gbraid', 'srsltid', 'gad_source', 'gad_campaignid',
  '_ga', '_gl', '_gac', '_gid', 'utm_id', 'utm_source_platform',
  'utm_creative_format', 'utm_marketing_tactic', 'utm_name', 'utm_reader',
  'utm_referrer', 'utm_social', 'utm_social-type', 'utm_pubreferrer', 'utm_swu',
  'gs_l', 'gs_lcp', 'gs_ssp', 'ved', 'sclient', 'uact', 'bih', 'biw', 'rlz', 'sourceid',
  // YouTube / Social Share & Ad Clicks (17)
  'si', 'igsh', 'ref_src', 'ref_url', 'tw_source', 'tw_adid', 'tw_campaign',
  's_kwcid', 'ef_id', 'rdt_cid', 'epik', 'ScCid', 'sccid', 'tt_medium',
  'tt_content', 'is_from_webapp', 'sender_device',
  // Meta / Facebook (10)
  'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref', 'fb_comment_id',
  'action_object_map', 'action_type_map', 'action_ref_map', '__tn__', 'cft[0]',
  // Microsoft / Bing / LinkedIn (8)
  'ms_c', 'cvid', 'li_fat_id', 'lipi', 'licu', 'trk', 'trkInfo', 'trkCampaign',
  // Email Marketing & CRM (34)
  'mc_cid', 'hsCtaTracking', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad',
  'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver', 'mkt_tok',
  '_kx', 'kl_id', '_ke', '_branch_match_id', '_branch_referrer', 'sfmc_id',
  'sfmc_activityid', 'sfmc_sub', 'pi_list_email', 'vgo_ee', '__s', 'os_ehash',
  'omnisendContactID', 'si_id', '_se', 'ck_subscriber_id', 'elqTrackId',
  'elqTrack', 'elqaid', 'elqat', 'elqCampaignId',
  // Yandex / VK / Yahoo (5)
  'ysclid', 'ymclid', '_openstat', 'frommarket', 'ybaip',
  // Affiliate / Attribution / AdTech (21)
  'irclickid', 'irgwc', 'cjevent', 'cjdata', 'awc', 'ranMID', 'ranEAID',
  'ranSiteID', 'sscid', 'ps_partner_key', 'ps_xid', 'obOrigUrl', 'tblci',
  'cto_bundle', 'cto_pld', '__adroll_fpc', 'wickedid', 'wickedsource',
  'h_ad_id', 'nb_cid', 'nb_pid',
  // E-Commerce / Retail Tracking (30)
  'pd_rd_r', 'pd_rd_w', 'pd_rd_wg', 'pf_rd_p', 'pf_rd_r', 'pf_rd_s',
  'pf_rd_t', 'pf_rd_i', 'campid', 'mkevt', 'mkcid', 'mkrid', 'algo_expid',
  'algo_pvid', 'btsid', 'ws_ab_test', 'spm', 'scm', 'aff_fcid', 'aff_fsk',
  'aff_platform', 'aff_trace_key', 'ga_order', 'ga_search_type', 'ga_view_type',
  'pr_prod_strat', 'pr_rec_id', 'pr_rec_pid', 'pr_ref_pid', 'pr_seq',
  // Analytics / Mobile Attribution (33)
  'sc_cid', 'cmpid', 'icid', 'ncid', 'ocid', 'intcmp', 'int_cmp',
  'mtm_campaign', 'mtm_keyword', 'mtm_source', 'mtm_medium', 'mtm_content',
  'mtm_cid', 'mtm_group', 'mtm_placement', 'pk_campaign', 'pk_kwd', 'pk_source',
  'pk_medium', 'pk_content', 'pk_cid', 'mp_id', 'amp_device_id', 'ajs_aid',
  'ajs_uid', 'ajs_event', 'af_xp', 'af_pid', 'af_c_id', 'adj_t',
  'adj_campaign', 'adj_adgroup', 'adj_creative',
  // Publisher / News / Broadcast Tracking (20)
  'ito', 'at_medium', 'at_campaign', 'at_custom1', 'at_custom2', 'at_custom3',
  'at_custom4', 'ns_mchannel', 'ns_source', 'ns_campaign', 'ns_linkname',
  'ns_fee', 'xtor', 'xtref', 'wt_mc', 'wt_zmc', 'mbid', 'smid', 'smtyp', 's_cid'
];

function refreshSourcesFromUpstream() {
  fs.mkdirSync(SOURCES_DIR, { recursive: true });
  for (const src of UPSTREAM_SOURCES) {
    const destPath = path.join(SOURCES_DIR, src.file);
    const tmpPath = destPath + '.tmp';
    let downloaded = false;
    for (const url of src.urls) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        execFileSync(
          'curl.exe',
          ['-sSL', '-C', '-', '--retry', '5', '--max-time', '90', '--speed-limit', '500', '--speed-time', '10', '-o', tmpPath, url],
          { cwd: ROOT_DIR, stdio: 'pipe' }
        );
        const stat = fs.statSync(tmpPath);
        const head = fs.readFileSync(tmpPath, 'utf8').slice(0, 256);
        if (stat.size >= src.minBytes && /\[Adblock Plus/i.test(head)) {
          fs.renameSync(tmpPath, destPath);
          console.log(`[Compiler] Refreshed ${src.file} (${stat.size} bytes) from ${url}`);
          downloaded = true;
          break;
        }
      } catch {
        // try next mirror
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    }
    if (!downloaded) {
      throw new Error(`[Compiler] Failed to download authentic non-truncated ${src.file}`);
    }
  }
}

function containsBannedSubstring(text) {
  const lower = String(text || '').toLowerCase();
  return BANNED_SUBSTRINGS.some((sub) => lower.includes(sub));
}

function isValidAsciiDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return parts.every((p) => p.length > 0 && p.length <= 63 && !p.startsWith('-') && !p.endsWith('-'));
}

function splitPatternAndOptions(line) {
  const dollarIdx = line.lastIndexOf('$');
  if (dollarIdx === -1) return { pattern: line, optionsStr: '' };
  const after = line.slice(dollarIdx + 1);
  // If suffix contains '/' or '?' or '=' with url-like chars not matching domain=, check carefully
  // In ABP, options never contain '/' except inside regex/csp/rewrite (which we reject anyway)
  if (!after || after.includes('/')) {
    return { pattern: line, optionsStr: '' };
  }
  return {
    pattern: line.slice(0, dollarIdx),
    optionsStr: after
  };
}

function parseAbpLineToDnr(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('!') || line.startsWith('[')) return null;
  if (!/^[\x20-\x7E]+$/.test(line)) return null;
  if (/##|#@#|#\?#|#@\$#|#\$#|\$\$|\$@\$/.test(line)) return null;
  if (containsBannedSubstring(line)) return null;

  const isAllow = line.startsWith('@@');
  const body = isAllow ? line.slice(2) : line;
  if (!body) return null;

  const { pattern: rawPattern, optionsStr } = splitPatternAndOptions(body);
  let pattern = rawPattern.trim();
  if (!pattern) return null;

  // Reject regex rules (/.../)
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 1) return null;
  if (pattern.length > 180) return null;

  // Parse options
  const positiveTypes = new Set();
  const negatedTypes = new Set();
  let domainType = null;
  let matchCase = false;
  let isImportant = false;
  const initiatorDomains = [];
  const excludedInitiatorDomains = [];

  if (optionsStr) {
    const tokens = optionsStr.split(',').map((t) => t.trim()).filter(Boolean);
    for (const tok of tokens) {
      const lowerTok = tok.toLowerCase();
      if (lowerTok.startsWith('domain=')) {
        const domList = tok.slice(7).split('|').map((d) => d.trim().toLowerCase()).filter(Boolean);
        if (domList.length === 0) return null;
        for (const d of domList) {
          const negated = d.startsWith('~');
          const cleanDom = (negated ? d.slice(1) : d).replace(/^\.+/, '');
          if (!isValidAsciiDomain(cleanDom) || containsBannedSubstring(cleanDom)) {
            return null;
          }
          if (negated) excludedInitiatorDomains.push(cleanDom);
          else initiatorDomains.push(cleanDom);
        }
        continue;
      }

      const optName = lowerTok.includes('=') ? lowerTok.slice(0, lowerTok.indexOf('=')) : lowerTok;
      const bareOpt = optName.startsWith('~') ? optName.slice(1) : optName;

      if (UNSUPPORTED_OPTIONS.has(bareOpt)) return null;

      if (lowerTok === 'third-party' || lowerTok === '3p') {
        if (domainType === 'firstParty') return null;
        domainType = 'thirdParty';
      } else if (lowerTok === '~third-party' || lowerTok === 'first-party' || lowerTok === '1p' || lowerTok === '~3p') {
        if (domainType === 'thirdParty') return null;
        domainType = 'firstParty';
      } else if (lowerTok === 'match-case') {
        matchCase = true;
      } else if (lowerTok === '~match-case') {
        matchCase = false;
      } else if (lowerTok === 'important') {
        isImportant = true;
      } else if (RESOURCE_TYPE_MAP.has(bareOpt)) {
        const mapped = RESOURCE_TYPE_MAP.get(bareOpt);
        if (optName.startsWith('~')) negatedTypes.add(mapped);
        else positiveTypes.add(mapped);
      } else {
        // Unknown option — reject safely
        return null;
      }
    }
  }

  // Avoid Chrome/Firefox DNR ambiguity when both positive and negated initiatorDomains appear
  if (initiatorDomains.length > 0 && excludedInitiatorDomains.length > 0) {
    return null;
  }

  // Compute explicit resourceTypes (always excluding main_frame for blocks & list-level @@ exceptions)
  let resourceTypes;
  if (positiveTypes.size > 0) {
    resourceTypes = DEFAULT_SUBRESOURCE_TYPES.filter((t) => positiveTypes.has(t) && !negatedTypes.has(t));
  } else if (negatedTypes.size > 0) {
    resourceTypes = DEFAULT_SUBRESOURCE_TYPES.filter((t) => !negatedTypes.has(t));
  } else {
    resourceTypes = [...DEFAULT_SUBRESOURCE_TYPES];
  }
  if (resourceTypes.length === 0) return null;

  // Normalize pattern
  if (/^\|https?:\/\//i.test(pattern)) {
    pattern = '||' + pattern.replace(/^\|https?:\/\//i, '');
  }
  if (pattern.startsWith('||*.')) {
    pattern = '||' + pattern.slice(4);
  }
  if (pattern.startsWith('||')) {
    pattern = pattern.toLowerCase();
    // Clean ^/ -> /
    pattern = pattern.replace(/\^\//g, '/');
    const rest = pattern.slice(2);
    const sepIdx = rest.search(/[/?*^]/);
    const hostPart = sepIdx === -1 ? rest : rest.slice(0, sepIdx);
    const tailPart = sepIdx === -1 ? '' : rest.slice(sepIdx);

    if (!isValidAsciiDomain(hostPart)) return null;
    if (containsBannedSubstring(hostPart)) return null;

    const hasPath = tailPart.includes('/') || (tailPart.length > 1 && tailPart !== '^');
    if (!hasPath && BROAD_ROOT_DOMAINS.has(hostPart)) return null;

    // Normalize bare ||domain -> ||domain^
    if (!tailPart) {
      pattern = `||${hostPart}^`;
    } else if (tailPart.startsWith('^') && tailPart.length > 1) {
      // Avoid ||domain^foo ambiguity in simple matchers and collapse leading * after ^ to avoid **
      const afterCaret = tailPart.slice(1).replace(/^\*+/, '');
      pattern = afterCaret ? `||${hostPart}*${afterCaret}` : `||${hostPart}^`;
    }
    pattern = pattern.replace(/\*{2,}/g, '*');
  } else {
    // Only allow domain-anchored rules (`||...`) to prevent broad substring false positives
    return null;
  }

  // Non-wildcard character check
  const nonWild = pattern.replace(/[|*^]/g, '');
  if (nonWild.length < 4) return null;

  const condition = {
    urlFilter: pattern,
    resourceTypes
  };
  if (domainType) condition.domainType = domainType;
  if (initiatorDomains.length > 0) {
    condition.initiatorDomains = [...new Set(initiatorDomains)].sort();
  }
  if (excludedInitiatorDomains.length > 0) {
    condition.excludedInitiatorDomains = [...new Set(excludedInitiatorDomains)].sort();
  }
  if (matchCase) condition.isUrlFilterCaseSensitive = true;

  // Priority strictly in 1..5 (never >= 10)
  let priority = 1;
  if (isAllow) {
    priority = initiatorDomains.length > 0 || pattern.includes('/') ? 5 : 4;
  } else if (isImportant) {
    priority = 5;
  } else if (pattern.includes('/') && initiatorDomains.length > 0) {
    priority = 3;
  } else if (domainType === 'thirdParty' || pattern.includes('/')) {
    priority = 2;
  }

  const rule = {
    id: 0,
    priority,
    action: { type: isAllow ? 'allow' : 'block' },
    condition
  };

  // Quality score for deterministic top-N selection
  let score = 0;
  if (!isAllow) {
    const isBareDomain = !pattern.includes('/') && pattern.endsWith('^');
    score += isBareDomain ? 100 : 70;
    if (domainType === 'thirdParty') score += 15;
    if (initiatorDomains.length === 0) score += 10;
    if (resourceTypes.includes('script') || resourceTypes.includes('xmlhttprequest') || resourceTypes.includes('sub_frame')) {
      score += 5;
    }
  } else {
    score += 60;
    if (initiatorDomains.length > 0) score += 5;
  }

  return { rule, score };
}

function canonicalRuleKey(rule) {
  const c = rule.condition || {};
  return JSON.stringify([
    rule.action?.type || 'block',
    c.urlFilter || '',
    c.domainType || '',
    c.isUrlFilterCaseSensitive || false,
    [...(c.resourceTypes || [])].sort(),
    [...(c.initiatorDomains || [])].sort(),
    [...(c.excludedInitiatorDomains || [])].sort(),
    [...(c.excludedRequestDomains || [])].sort()
  ]);
}

function isRuleSafeAgainstCanaries(rule) {
  const testSet = [rule];
  if (rule.action?.type === 'block') {
    for (const legit of PROTECTED_LEGITIMATE_NETWORK_CANARIES) {
      const winner = evaluateDnrRulesForRequest(testSet, legit);
      if (winner) return false;
    }
  } else if (rule.action?.type === 'allow') {
    for (const canary of GOLDEN_NETWORK_CANARIES) {
      const winner = evaluateDnrRulesForRequest(testSet, canary);
      if (winner) return false;
    }
    for (const surr of SURROGATE_URLS) {
      const winner = evaluateDnrRulesForRequest(testSet, surr);
      if (winner) return false;
    }
  }
  return true;
}

function compileSourceList(fileName, alreadySeenKeys) {
  const fullPath = path.join(SOURCES_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`[Compiler] Missing cached filter source: ${fullPath}. Run with --refresh to download.`);
  }
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const candidates = new Map();

  for (const line of lines) {
    const parsed = parseAbpLineToDnr(line);
    if (!parsed) continue;
    const key = canonicalRuleKey(parsed.rule);
    if (alreadySeenKeys.has(key) || candidates.has(key)) continue;
    if (!isRuleSafeAgainstCanaries(parsed.rule)) continue;
    candidates.set(key, { ...parsed, key });
  }

  // Deterministic ranking: highest quality score, then lexicographical canonical key
  return [...candidates.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

function sortAndAssignIds(entries, startId) {
  const sorted = [...entries].sort((a, b) => {
    const aAllow = a.rule.action.type === 'allow' ? 1 : 0;
    const bAllow = b.rule.action.type === 'allow' ? 1 : 0;
    if (aAllow !== bAllow) return aAllow - bAllow;
    const aUf = a.rule.condition.urlFilter;
    const bUf = b.rule.condition.urlFilter;
    if (aUf !== bUf) return aUf < bUf ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return sorted.map((entry, idx) => ({
    ...entry.rule,
    id: startId + idx
  }));
}

function formatCompactRulesJson(rules) {
  return '[\n' + rules.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n';
}

function validateFinalRuleset(name, rules, rawJson, { maxRules = 30000 } = {}) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error(`[Compiler] ${name} is empty`);
  }
  if (rules.length > maxRules) {
    throw new Error(`[Compiler] ${name} has ${rules.length} rules, exceeding limit ${maxRules}`);
  }
  if (/"url"\s*:\s*"data:/i.test(rawJson)) {
    throw new Error(`[Compiler] Disallowed data: URL found in ${name}`);
  }
  if (containsBannedSubstring(rawJson)) {
    throw new Error(`[Compiler] Banned substring (localhost/127.0.0.1/817797/data:) found in ${name}`);
  }
  const seenIds = new Set();
  for (const r of rules) {
    if (!Number.isInteger(r.id) || r.id <= 0 || r.id > 60000 || r.id === 817797) {
      throw new Error(`[Compiler] Invalid rule ID ${r.id} in ${name}`);
    }
    if (seenIds.has(r.id)) {
      throw new Error(`[Compiler] Duplicate rule ID ${r.id} in ${name}`);
    }
    seenIds.add(r.id);
    if (r.action?.type === 'block') {
      const rt = r.condition?.resourceTypes;
      if (!Array.isArray(rt) || rt.length === 0 || rt.includes('main_frame')) {
        throw new Error(`[Compiler] Unsafe main_frame or empty resourceTypes on block rule #${r.id} in ${name}`);
      }
    }
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--refresh')) {
    refreshSourcesFromUpstream();
  }

  // 1. Preserve baseline rules 1..298 from static_ads_and_trackers.json (strip main_frame from block rules)
  const existingStatic = JSON.parse(fs.readFileSync(STATIC_ADS_PATH, 'utf8'));
  const baselineRules = existingStatic
    .filter((r) => Number.isInteger(r.id) && r.id >= 1 && r.id <= 298)
    .map((r) => {
      if (r.action?.type === 'block' && Array.isArray(r.condition?.resourceTypes) && r.condition.resourceTypes.includes('main_frame')) {
        return {
          ...r,
          condition: {
            ...r.condition,
            resourceTypes: r.condition.resourceTypes.filter((rt) => rt !== 'main_frame')
          }
        };
      }
      return r;
    });
  if (baselineRules.length !== 264) {
    throw new Error(`[Compiler] Expected 264 baseline rules (IDs 1..298), found ${baselineRules.length}`);
  }

  // 2. Build surgical anti-breakage allow rules (IDs 500..549, priority: 100)
  const surgicalAllowRules = SURGICAL_ALLOW_SPECS.map((spec, idx) => {
    const condition = {
      urlFilter: spec.urlFilter,
      resourceTypes: spec.resourceTypes
    };
    if (spec.initiatorDomains) {
      condition.initiatorDomains = [...spec.initiatorDomains];
    }
    const rule = {
      id: 500 + idx,
      priority: 100,
      action: { type: 'allow' },
      condition
    };
    if (!isRuleSafeAgainstCanaries(rule)) {
      throw new Error(`[Compiler] Surgical allow rule ${spec.urlFilter} conflicts with GOLDEN_NETWORK_CANARIES`);
    }
    return rule;
  });

  const seenKeys = new Set();
  for (const r of [...baselineRules, ...surgicalAllowRules]) {
    seenKeys.add(canonicalRuleKey(r));
  }

  // 3. Compile EasyList into static_ads_and_trackers.json (target 20,000 total rules)
  const EASYLIST_QUOTA = 20000 - baselineRules.length - surgicalAllowRules.length;
  const easyListRanked = compileSourceList('easylist.txt', seenKeys);
  const selectedEasyList = easyListRanked.slice(0, EASYLIST_QUOTA);
  for (const entry of selectedEasyList) seenKeys.add(entry.key);
  const compiledEasyListRules = sortAndAssignIds(selectedEasyList, 1000);
  const staticAllRules = [...baselineRules, ...surgicalAllowRules, ...compiledEasyListRules];

  // 4. Compile EasyPrivacy into easyprivacy_trackers.json (target 12,000 rules)
  const EASYPRIVACY_QUOTA = 12000;
  const easyPrivacyRanked = compileSourceList('easyprivacy.txt', seenKeys);
  const selectedEasyPrivacy = easyPrivacyRanked.slice(0, EASYPRIVACY_QUOTA);
  for (const entry of selectedEasyPrivacy) seenKeys.add(entry.key);
  const easyPrivacyRules = sortAndAssignIds(selectedEasyPrivacy, 1);

  // 5. Compile Regional EU (DE + FR + ES) into regional_eu_filters.json (target 4,000 rules, balanced)
  const REGIONAL_TARGET = 4000;
  const esRanked = compileSourceList('easylistspanish.txt', seenKeys);
  const selectedEs = esRanked.slice(0, 700);
  for (const entry of selectedEs) seenKeys.add(entry.key);

  const deRanked = compileSourceList('easylistgermany.txt', seenKeys);
  const selectedDe = deRanked.slice(0, 1700);
  for (const entry of selectedDe) seenKeys.add(entry.key);

  const frQuota = REGIONAL_TARGET - selectedEs.length - selectedDe.length;
  const frRanked = compileSourceList('liste_fr.txt', seenKeys);
  const selectedFr = frRanked.slice(0, frQuota);
  for (const entry of selectedFr) seenKeys.add(entry.key);

  const regionalEuRules = sortAndAssignIds([...selectedEs, ...selectedDe, ...selectedFr], 1);

  // 6. Build tracker_params.json (Rule #6, 229 deduplicated params)
  const dedupedParams = [...new Set(TRACKER_REMOVE_PARAMS)];
  const trackerParamsRules = [
    {
      id: 6,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: {
              removeParams: dedupedParams
            }
          }
        }
      },
      condition: {
        excludedRequestDomains: [...SWEEPR_DOMAINS],
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }
  ];

  // 7. Verify cryptominers.json intact
  const cryptominerRaw = fs.readFileSync(CRYPTOMINERS_PATH, 'utf8');
  const cryptominerRules = JSON.parse(cryptominerRaw);
  if (cryptominerRules.length !== 18) {
    throw new Error(`[Compiler] Expected 18 cryptominer rules, found ${cryptominerRules.length}`);
  }

  // 8. Serialize & validate all 5 rulesets
  const staticJson = formatCompactRulesJson(staticAllRules);
  const easyPrivacyJson = formatCompactRulesJson(easyPrivacyRules);
  const regionalEuJson = formatCompactRulesJson(regionalEuRules);
  const trackerParamsJson = JSON.stringify(trackerParamsRules, null, 2) + '\n';

  validateFinalRuleset('static_ads_and_trackers.json', staticAllRules, staticJson);
  validateFinalRuleset('easyprivacy_trackers.json', easyPrivacyRules, easyPrivacyJson);
  validateFinalRuleset('regional_eu_filters.json', regionalEuRules, regionalEuJson);
  validateFinalRuleset('tracker_params.json', trackerParamsRules, trackerParamsJson);
  validateFinalRuleset('cryptominers.json', cryptominerRules, cryptominerRaw);

  // 9. Cross-ruleset canary verification
  const allCombined = [
    ...staticAllRules,
    ...easyPrivacyRules,
    ...regionalEuRules,
    ...trackerParamsRules,
    ...cryptominerRules
  ];
  for (const canary of GOLDEN_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(allCombined, canary);
    if (!winner || winner.action?.type !== canary.expectedAction) {
      throw new Error(`[Compiler] Golden canary failed: ${canary.name} (got ${winner?.action?.type || 'none'})`);
    }
    if (canary.minPriority && (Number(winner.priority) || 1) < canary.minPriority) {
      throw new Error(`[Compiler] Golden canary priority degraded: ${canary.name}`);
    }
  }
  for (const legit of PROTECTED_LEGITIMATE_NETWORK_CANARIES) {
    const winner = evaluateDnrRulesForRequest(allCombined, legit);
    if (winner && winner.action?.type === 'block') {
      throw new Error(`[Compiler] Protected legitimate canary blocked: ${legit.name} by Rule #${winner.id}`);
    }
  }

  // 10. Write outputs
  fs.writeFileSync(STATIC_ADS_PATH, staticJson, 'utf8');
  fs.writeFileSync(EASYPRIVACY_PATH, easyPrivacyJson, 'utf8');
  fs.writeFileSync(REGIONAL_EU_PATH, regionalEuJson, 'utf8');
  fs.writeFileSync(TRACKER_PARAMS_PATH, trackerParamsJson, 'utf8');

  const total =
    staticAllRules.length +
    easyPrivacyRules.length +
    regionalEuRules.length +
    trackerParamsRules.length +
    cryptominerRules.length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        counts: {
          static_ads_and_trackers: staticAllRules.length,
          baseline_preserved: baselineRules.length,
          surgical_allow: surgicalAllowRules.length,
          easylist_compiled: compiledEasyListRules.length,
          easyprivacy_trackers: easyPrivacyRules.length,
          regional_eu_filters: regionalEuRules.length,
          regional_breakdown: {
            es: selectedEs.length,
            de: selectedDe.length,
            fr: selectedFr.length
          },
          tracker_params_rules: trackerParamsRules.length,
          tracker_params_count: dedupedParams.length,
          cryptominers: cryptominerRules.length,
          total_static_rules: total
        }
      },
      null,
      2
    )
  );
}

main();
