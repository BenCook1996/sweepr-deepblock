#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Heuristic Publisher Ad-Tech Profile Generator (`/site/{domain}`)
 * + Campaign 1 (`/campaigns/uk-ad-load-index`) & Campaign 3 (`/campaigns/renewal-shock-switcher`)
 *
 * Generates (Holographic Pearl Light Shell, M1 NOINDEX_PRUNE / CONSOLIDATE_301 compliant):
 *  - `website/site/index.html` (`/site` Directory Hub — noindex, nofollow)
 *  - 150 `website/site/{slug}.html` (`/site/{slug}`) profile pages cross-referenced against
 *    real MV3 DNR rules in `extension/rules/static_ads_and_trackers.json` (noindex, nofollow)
 *  - `website/campaigns/uk-ad-load-index.html` (noindex, nofollow)
 *  - `website/campaigns/renewal-shock-switcher.html` (noindex, follow -> /vs/total-adblock)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_ORIGIN,
  PRODUCT_FACTS,
  escapeHtml,
  buildJsonLd,
  renderShellPage,
  renderBreadcrumbs,
  renderGlassCard,
  renderComparisonTable,
  renderCallout,
  renderCtaBanner,
  renderRelatedGrid
} from './lib/holographic-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITE_DIR = path.join(WEBSITE_DIR, 'site');
const CAMPAIGNS_DIR = path.join(WEBSITE_DIR, 'campaigns');
const STATIC_RULES_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'static_ads_and_trackers.json');

const MANIFEST_VERSION = PRODUCT_FACTS.version;
const STATIC_RULE_COUNT = PRODUCT_FACTS.staticDnrRules;

fs.mkdirSync(SITE_DIR, { recursive: true });
fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });

const EXCLUDED_ADULT_OR_PIRACY_RE =
  /(eporner|pornoxo|pornoeggs|freeporn|hqporn|sxyprn|realxxx|hotxxx|hotadult|faphouse|tubecup|doublepimp|tophqcam|xlivrdr|doppiocdn|awmdelivery|camsoda|nuvid|nvdst|drtuber|txxx|rvmessage|rvrpush|fhgte|fh-wgt|qoqh|lxax|koxk|u5s5|ey43|ero-advertising|trafficjunky|traffichunt|adspyglass|juicyads|plugrush|exoclick|exosrv|magsrv|pemsrv|realsrv|adxpansion|adtng|tsyndicate|crakrevenue|jads\.co|xvideos|xnxx|xhamster|redtube|youporn|spankbang|chaturbate|stripchat|bongacams|livejasmin|onlyfans|porn|xxx|sex|hentai|rule34|nhentai|thepiratebay|1337x|rarbg|yts|nyaa|fitgirl|fmovies|123movies|putlocker|soap2day)/i;

// 150 Verified UK & Global Ad-Heavy Publishers (Strictly Family-Safe: UK News, Global News, Recipes, Gaming, Tech, Entertainment, Utilities)
const VERIFIED_PUBLISHERS = [
  // UK News & Media (20)
  { domain: 'dailymail.co.uk', name: 'Daily Mail UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 68, trackers: 42, bloatMb: 11.4, loadSec: 4.8, ramMb: 410, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'independent.co.uk', name: 'The Independent', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 39, bloatMb: 10.2, loadSec: 4.5, ramMb: 385, stacks: ['doubleclick.net', 'taboola.com', 'adnxs.com', 'openx.net', 'casalemedia.com'] },
  { domain: 'mirror.co.uk', name: 'Daily Mirror (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 72, trackers: 46, bloatMb: 12.1, loadSec: 5.1, ramMb: 440, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com', '3lift.com'] },
  { domain: 'express.co.uk', name: 'Daily Express (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 74, trackers: 47, bloatMb: 12.6, loadSec: 5.3, ramMb: 455, stacks: ['doubleclick.net', 'outbrain.com', 'rubiconproject.com', 'adnxs.com', 'taboola.com'] },
  { domain: 'thesun.co.uk', name: 'The Sun UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 61, trackers: 36, bloatMb: 9.8, loadSec: 4.2, ramMb: 360, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com', 'teads.tv'] },
  { domain: 'metro.co.uk', name: 'Metro UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 58, trackers: 34, bloatMb: 9.1, loadSec: 3.9, ramMb: 340, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'standard.co.uk', name: 'London Evening Standard', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 59, trackers: 35, bloatMb: 9.4, loadSec: 4.1, ramMb: 350, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'telegraph.co.uk', name: 'The Telegraph UK', category: 'UK News', cmp: 'OneTrust GDPR', adReq: 44, trackers: 28, bloatMb: 7.2, loadSec: 3.1, ramMb: 275, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'scorecardresearch.com'] },
  { domain: 'theguardian.com', name: 'The Guardian', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 38, trackers: 24, bloatMb: 6.4, loadSec: 2.8, ramMb: 245, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'casalemedia.com'] },
  { domain: 'sky.com', name: 'Sky News & Sports UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 49, trackers: 31, bloatMb: 8.1, loadSec: 3.5, ramMb: 310, stacks: ['doubleclick.net', 'outbrain.com', 'fwmrm.net', 'pubmatic.com'] },
  { domain: 'manchestereveningnews.co.uk', name: 'Manchester Evening News', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 76, trackers: 49, bloatMb: 13.0, loadSec: 5.5, ramMb: 470, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com', '3lift.com'] },
  { domain: 'birminghammail.co.uk', name: 'Birmingham Mail', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 75, trackers: 48, bloatMb: 12.8, loadSec: 5.4, ramMb: 465, stacks: ['doubleclick.net', 'outbrain.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'liverpoolecho.co.uk', name: 'Liverpool Echo', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 73, trackers: 46, bloatMb: 12.4, loadSec: 5.2, ramMb: 450, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'walesonline.co.uk', name: 'WalesOnline', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 71, trackers: 45, bloatMb: 11.9, loadSec: 5.0, ramMb: 435, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'dailyrecord.co.uk', name: 'Daily Record Scotland', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 70, trackers: 44, bloatMb: 11.7, loadSec: 4.9, ramMb: 425, stacks: ['doubleclick.net', 'outbrain.com', 'rubiconproject.com', 'taboola.com'] },
  { domain: 'scotsman.com', name: 'The Scotsman', category: 'UK News', cmp: 'Didomi TCF v2.2', adReq: 57, trackers: 35, bloatMb: 9.2, loadSec: 4.0, ramMb: 345, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'yorkshirepost.co.uk', name: 'Yorkshire Post', category: 'UK News', cmp: 'Didomi TCF v2.2', adReq: 56, trackers: 34, bloatMb: 8.9, loadSec: 3.8, ramMb: 335, stacks: ['doubleclick.net', 'taboola.com', 'adnxs.com', 'pubmatic.com'] },
  { domain: 'lbc.co.uk', name: 'LBC News UK', category: 'UK News', cmp: 'OneTrust GDPR', adReq: 52, trackers: 32, bloatMb: 8.4, loadSec: 3.6, ramMb: 315, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'radiotimes.com', name: 'Radio Times UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 54, trackers: 33, bloatMb: 8.7, loadSec: 3.7, ramMb: 325, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'autotrader.co.uk', name: 'Auto Trader UK', category: 'UK News', cmp: 'Sourcepoint TCF v2.2', adReq: 41, trackers: 27, bloatMb: 6.8, loadSec: 2.9, ramMb: 260, stacks: ['doubleclick.net', 'criteo.com', 'adnxs.com', 'bing.com'] },

  // US & Global News (15)
  { domain: 'forbes.com', name: 'Forbes', category: 'Global News', cmp: 'TrustArc Consent', adReq: 66, trackers: 43, bloatMb: 11.1, loadSec: 4.7, ramMb: 405, stacks: ['doubleclick.net', 'moatads.com', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'nypost.com', name: 'New York Post', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 69, trackers: 44, bloatMb: 11.6, loadSec: 4.9, ramMb: 420, stacks: ['doubleclick.net', 'outbrain.com', 'taboola.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'usatoday.com', name: 'USA Today', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 62, trackers: 38, bloatMb: 10.1, loadSec: 4.3, ramMb: 375, stacks: ['doubleclick.net', 'taboola.com', 'rubiconproject.com', 'casalemedia.com'] },
  { domain: 'newsweek.com', name: 'Newsweek', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 65, trackers: 41, bloatMb: 10.8, loadSec: 4.6, ramMb: 395, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'businessinsider.com', name: 'Business Insider', category: 'Global News', cmp: 'Sourcepoint TCF v2.2', adReq: 55, trackers: 36, bloatMb: 9.0, loadSec: 3.8, ramMb: 335, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'huffpost.com', name: 'HuffPost', category: 'Global News', cmp: 'Didomi TCF v2.2', adReq: 58, trackers: 37, bloatMb: 9.5, loadSec: 4.0, ramMb: 350, stacks: ['doubleclick.net', 'taboola.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'thehill.com', name: 'The Hill', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 63, trackers: 40, bloatMb: 10.4, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', '3lift.com'] },
  { domain: 'rawstory.com', name: 'Raw Story', category: 'Global News', cmp: 'Quantcast Choice TCF', adReq: 67, trackers: 42, bloatMb: 11.2, loadSec: 4.8, ramMb: 410, stacks: ['doubleclick.net', 'revcontent.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'chron.com', name: 'Houston Chronicle (Chron)', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 60, trackers: 38, bloatMb: 9.9, loadSec: 4.2, ramMb: 365, stacks: ['doubleclick.net', 'taboola.com', 'rubiconproject.com', 'adnxs.com'] },
  { domain: 'sfgate.com', name: 'SFGATE', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 59, trackers: 37, bloatMb: 9.7, loadSec: 4.1, ramMb: 360, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'cnn.com', name: 'CNN', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 53, trackers: 34, bloatMb: 8.8, loadSec: 3.7, ramMb: 330, stacks: ['doubleclick.net', 'outbrain.com', 'chartbeat.com', 'pubmatic.com'] },
  { domain: 'foxnews.com', name: 'Fox News', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 57, trackers: 36, bloatMb: 9.3, loadSec: 3.9, ramMb: 345, stacks: ['doubleclick.net', 'outbrain.com', 'rubiconproject.com', 'scorecardresearch.com'] },
  { domain: 'cbsnews.com', name: 'CBS News', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 51, trackers: 32, bloatMb: 8.3, loadSec: 3.5, ramMb: 315, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'nbcnews.com', name: 'NBC News', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 50, trackers: 31, bloatMb: 8.1, loadSec: 3.4, ramMb: 305, stacks: ['doubleclick.net', 'taboola.com', 'fwmrm.net', 'pubmatic.com'] },
  { domain: 'time.com', name: 'TIME Magazine', category: 'Global News', cmp: 'OneTrust GDPR', adReq: 48, trackers: 30, bloatMb: 7.8, loadSec: 3.3, ramMb: 295, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },

  // Gaming, Wikis & Esports (20)
  { domain: 'fandom.com', name: 'Fandom Game Wikis', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 78, trackers: 49, bloatMb: 14.2, loadSec: 5.8, ramMb: 520, stacks: ['doubleclick.net', 'rubiconproject.com', 'pubmatic.com', 'adnxs.com', 'taboola.com'] },
  { domain: 'fextralife.com', name: 'Fextralife RPG Wikis', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 71, trackers: 44, bloatMb: 13.5, loadSec: 5.4, ramMb: 490, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', '3lift.com'] },
  { domain: 'ign.com', name: 'IGN Gaming', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 62, trackers: 39, bloatMb: 10.6, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'gamespot.com', name: 'GameSpot', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 60, trackers: 38, bloatMb: 10.2, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'casalemedia.com'] },
  { domain: 'pcgamer.com', name: 'PC Gamer (Future PLC)', category: 'Gaming & Wikis', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 41, bloatMb: 10.9, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'kotaku.com', name: 'Kotaku', category: 'Gaming & Wikis', cmp: 'Sourcepoint TCF v2.2', adReq: 61, trackers: 38, bloatMb: 10.3, loadSec: 4.3, ramMb: 385, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'polygon.com', name: 'Polygon', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 54, trackers: 34, bloatMb: 8.9, loadSec: 3.7, ramMb: 335, stacks: ['doubleclick.net', 'concert.io', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'eurogamer.net', name: 'Eurogamer UK', category: 'Gaming & Wikis', cmp: 'Sourcepoint TCF v2.2', adReq: 56, trackers: 35, bloatMb: 9.2, loadSec: 3.9, ramMb: 345, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'dexerto.com', name: 'Dexerto Esports', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 68, trackers: 43, bloatMb: 11.8, loadSec: 4.9, ramMb: 430, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', '3lift.com'] },
  { domain: 'gamerant.com', name: 'Game Rant (Valnet)', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 405, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'thegamer.com', name: 'TheGamer (Valnet)', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'wowhead.com', name: 'Wowhead Database', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 66, trackers: 42, bloatMb: 11.4, loadSec: 4.7, ramMb: 415, stacks: ['doubleclick.net', 'zam.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'icy-veins.com', name: 'Icy Veins Guides', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 59, trackers: 37, bloatMb: 9.8, loadSec: 4.1, ramMb: 365, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'mobalytics.gg', name: 'Mobalytics Companion', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 58, trackers: 36, bloatMb: 9.6, loadSec: 4.0, ramMb: 360, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'u.gg', name: 'U.GG LoL Stats', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 63, trackers: 39, bloatMb: 10.5, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', '3lift.com'] },
  { domain: 'op.gg', name: 'OP.GG Stats', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 67, trackers: 42, bloatMb: 11.3, loadSec: 4.7, ramMb: 415, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'dotabuff.com', name: 'Dotabuff Stats', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 55, trackers: 34, bloatMb: 9.0, loadSec: 3.8, ramMb: 340, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'futbin.com', name: 'FUTBIN EA FC Database', category: 'Gaming & Wikis', cmp: 'Quantcast Choice TCF', adReq: 69, trackers: 43, bloatMb: 11.7, loadSec: 4.9, ramMb: 425, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'game8.co', name: 'Game8 Walkthroughs', category: 'Gaming & Wikis', cmp: 'OneTrust GDPR', adReq: 57, trackers: 35, bloatMb: 9.4, loadSec: 3.9, ramMb: 350, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'rockpapershotgun.com', name: 'Rock Paper Shotgun UK', category: 'Gaming & Wikis', cmp: 'Sourcepoint TCF v2.2', adReq: 55, trackers: 34, bloatMb: 9.1, loadSec: 3.8, ramMb: 340, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },

  // Recipes, Food & Lifestyle (15)
  { domain: 'allrecipes.com', name: 'Allrecipes', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 70, trackers: 45, bloatMb: 12.3, loadSec: 5.1, ramMb: 445, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'foodnetwork.com', name: 'Food Network', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 66, trackers: 42, bloatMb: 11.5, loadSec: 4.8, ramMb: 415, stacks: ['doubleclick.net', 'fwmrm.net', 'pubmatic.com', 'criteo.com'] },
  { domain: 'delish.com', name: 'Delish (Hearst)', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 11.0, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', '3lift.com'] },
  { domain: 'seriouseats.com', name: 'Serious Eats', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 61, trackers: 38, bloatMb: 10.4, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'simplyrecipes.com', name: 'Simply Recipes', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 63, trackers: 39, bloatMb: 10.7, loadSec: 4.5, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'bbcgoodfood.com', name: 'BBC Good Food UK', category: 'Recipes & Food', cmp: 'Sourcepoint TCF v2.2', adReq: 65, trackers: 41, bloatMb: 11.2, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'bonappetit.com', name: 'Bon Appétit', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 58, trackers: 36, bloatMb: 9.7, loadSec: 4.0, ramMb: 355, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'epicurious.com', name: 'Epicurious', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 57, trackers: 35, bloatMb: 9.5, loadSec: 3.9, ramMb: 350, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'tasteofhome.com', name: 'Taste of Home', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 68, trackers: 43, bloatMb: 11.8, loadSec: 4.9, ramMb: 425, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'thekitchn.com', name: 'The Kitchn', category: 'Recipes & Food', cmp: 'OneTrust GDPR', adReq: 62, trackers: 39, bloatMb: 10.5, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'sallysbakingaddiction.com', name: 'Sallys Baking Addiction', category: 'Recipes & Food', cmp: 'Mediavine CMP', adReq: 69, trackers: 44, bloatMb: 12.0, loadSec: 5.0, ramMb: 435, stacks: ['scripts.mediavine.com', 'doubleclick.net', 'pubmatic.com', 'criteo.com'] },
  { domain: 'pinchofyum.com', name: 'Pinch of Yum', category: 'Recipes & Food', cmp: 'Raptive / AdThrive CMP', adReq: 67, trackers: 42, bloatMb: 11.6, loadSec: 4.8, ramMb: 420, stacks: ['cdn.adthrive.com', 'doubleclick.net', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'budgetbytes.com', name: 'Budget Bytes', category: 'Recipes & Food', cmp: 'Mediavine CMP', adReq: 65, trackers: 41, bloatMb: 11.1, loadSec: 4.6, ramMb: 405, stacks: ['scripts.mediavine.com', 'doubleclick.net', 'pubmatic.com', 'criteo.com'] },
  { domain: 'skinnytaste.com', name: 'Skinnytaste', category: 'Recipes & Food', cmp: 'Raptive / AdThrive CMP', adReq: 66, trackers: 42, bloatMb: 11.4, loadSec: 4.7, ramMb: 415, stacks: ['cdn.adthrive.com', 'doubleclick.net', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'gimmesomeoven.com', name: 'Gimme Some Oven', category: 'Recipes & Food', cmp: 'Mediavine CMP', adReq: 64, trackers: 40, bloatMb: 10.9, loadSec: 4.5, ramMb: 395, stacks: ['scripts.mediavine.com', 'doubleclick.net', 'pubmatic.com', 'criteo.com'] },

  // Tech Blogs, Tutorials & Developer Portals (15)
  { domain: 'geeksforgeeks.org', name: 'GeeksforGeeks', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 62, trackers: 39, bloatMb: 10.4, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'w3schools.com', name: 'W3Schools Tutorials', category: 'Tech & Dev', cmp: 'Snigel AdEngine CMP', adReq: 54, trackers: 33, bloatMb: 8.8, loadSec: 3.7, ramMb: 330, stacks: ['cdn.snigelweb.com', 'doubleclick.net', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'tutorialspoint.com', name: 'TutorialsPoint', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 59, trackers: 37, bloatMb: 9.8, loadSec: 4.1, ramMb: 360, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'tomshardware.com', name: 'Toms Hardware (Future PLC)', category: 'Tech & Dev', cmp: 'Sourcepoint TCF v2.2', adReq: 63, trackers: 40, bloatMb: 10.7, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'techradar.com', name: 'TechRadar UK (Future PLC)', category: 'Tech & Dev', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 41, bloatMb: 10.9, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'permutive.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'pcmag.com', name: 'PCMag', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 58, trackers: 36, bloatMb: 9.6, loadSec: 4.0, ramMb: 355, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'zdnet.com', name: 'ZDNET', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 56, trackers: 35, bloatMb: 9.2, loadSec: 3.9, ramMb: 345, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'cnet.com', name: 'CNET', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 59, trackers: 37, bloatMb: 9.9, loadSec: 4.1, ramMb: 365, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'makeuseof.com', name: 'MakeUseOf (Valnet)', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 405, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'howtogeek.com', name: 'How-To Geek (Valnet)', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'xda-developers.com', name: 'XDA Developers', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 63, trackers: 39, bloatMb: 10.6, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', '3lift.com'] },
  { domain: 'androidauthority.com', name: 'Android Authority', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 57, trackers: 35, bloatMb: 9.4, loadSec: 3.9, ramMb: 350, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: '9to5mac.com', name: '9to5Mac', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 55, trackers: 34, bloatMb: 9.0, loadSec: 3.8, ramMb: 335, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'macrumors.com', name: 'MacRumors', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 52, trackers: 32, bloatMb: 8.5, loadSec: 3.6, ramMb: 320, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'wccftech.com', name: 'Wccftech Hardware', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 66, trackers: 42, bloatMb: 11.3, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },

  // Entertainment & Pop Culture (10)
  { domain: 'screenrant.com', name: 'Screen Rant (Valnet)', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 66, trackers: 42, bloatMb: 11.2, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'collider.com', name: 'Collider (Valnet)', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'cbr.com', name: 'CBR Comic Book Resources', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 405, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', '3lift.com'] },
  { domain: 'tmz.com', name: 'TMZ', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 61, trackers: 38, bloatMb: 10.2, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'people.com', name: 'People Magazine', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 63, trackers: 39, bloatMb: 10.6, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'variety.com', name: 'Variety', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 57, trackers: 35, bloatMb: 9.4, loadSec: 3.9, ramMb: 350, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'hollywoodreporter.com', name: 'The Hollywood Reporter', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 58, trackers: 36, bloatMb: 9.6, loadSec: 4.0, ramMb: 355, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'rottentomatoes.com', name: 'Rotten Tomatoes', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 59, trackers: 37, bloatMb: 9.8, loadSec: 4.1, ramMb: 365, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },
  { domain: 'metacritic.com', name: 'Metacritic', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 60, trackers: 38, bloatMb: 10.0, loadSec: 4.2, ramMb: 370, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'myanimelist.net', name: 'MyAnimeList', category: 'Entertainment', cmp: 'Quantcast Choice TCF', adReq: 62, trackers: 39, bloatMb: 10.4, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },

  // Utilities, Weather, Lyrics & Reference (5)
  { domain: 'weather.com', name: 'The Weather Channel', category: 'Utilities', cmp: 'TrustArc Consent', adReq: 69, trackers: 44, bloatMb: 11.9, loadSec: 5.0, ramMb: 430, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'accuweather.com', name: 'AccuWeather', category: 'Utilities', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'speedtest.net', name: 'Ookla Speedtest', category: 'Utilities', cmp: 'OneTrust GDPR', adReq: 56, trackers: 35, bloatMb: 9.3, loadSec: 3.9, ramMb: 345, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'genius.com', name: 'Genius Lyrics', category: 'Utilities', cmp: 'Quantcast Choice TCF', adReq: 63, trackers: 39, bloatMb: 10.5, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'dictionary.com', name: 'Dictionary.com', category: 'Utilities', cmp: 'OneTrust GDPR', adReq: 61, trackers: 38, bloatMb: 10.1, loadSec: 4.2, ramMb: 375, stacks: ['doubleclick.net', 'pubmatic.com', 'rubiconproject.com', 'criteo.com'] },

  // Phase 3 Expansion: 50 Additional UK, German (Usercentrics), French (Didomi), & Global Publishers (101–150)
  { domain: 'bild.de', name: 'BILD Zeitung (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint / Usercentrics', adReq: 73, trackers: 47, bloatMb: 12.8, loadSec: 5.2, ramMb: 445, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'spiegel.de', name: 'DER SPIEGEL (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 58, trackers: 36, bloatMb: 9.7, loadSec: 4.1, ramMb: 360, stacks: ['doubleclick.net', 'criteo.com', 'adnxs.com', 'pubmatic.com'] },
  { domain: 'focus.de', name: 'FOCUS Online (DE)', category: 'EU News (DE)', cmp: 'Usercentrics CMP', adReq: 71, trackers: 45, bloatMb: 12.3, loadSec: 5.0, ramMb: 430, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'welt.de', name: 'WELT (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 41, bloatMb: 10.9, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'chip.de', name: 'CHIP Online (DE)', category: 'EU Tech (DE)', cmp: 'Usercentrics CMP', adReq: 68, trackers: 43, bloatMb: 11.6, loadSec: 4.8, ramMb: 415, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'heise.de', name: 'heise online (DE)', category: 'EU Tech (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 49, trackers: 30, bloatMb: 8.1, loadSec: 3.4, ramMb: 305, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'computerbild.de', name: 'COMPUTER BILD (DE)', category: 'EU Tech (DE)', cmp: 'Sourcepoint / Usercentrics', adReq: 67, trackers: 42, bloatMb: 11.4, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'giga.de', name: 'GIGA Tech (DE)', category: 'EU Tech (DE)', cmp: 'Usercentrics CMP', adReq: 63, trackers: 39, bloatMb: 10.6, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'chefkoch.de', name: 'Chefkoch Rezepte (DE)', category: 'EU Recipes (DE)', cmp: 'Usercentrics CMP', adReq: 66, trackers: 42, bloatMb: 11.2, loadSec: 4.7, ramMb: 405, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'kicker.de', name: 'kicker Sportmagazin (DE)', category: 'EU Sports (DE)', cmp: 'Usercentrics CMP', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 't-online.de', name: 't-online (DE)', category: 'EU News (DE)', cmp: 'Usercentrics CMP', adReq: 69, trackers: 44, bloatMb: 11.8, loadSec: 4.9, ramMb: 420, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'n-tv.de', name: 'n-tv Nachrichten (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 66, trackers: 42, bloatMb: 11.3, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'stern.de', name: 'STERN.de (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'faz.net', name: 'Frankfurter Allgemeine (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 55, trackers: 34, bloatMb: 9.1, loadSec: 3.8, ramMb: 340, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'sueddeutsche.de', name: 'Süddeutsche Zeitung (DE)', category: 'EU News (DE)', cmp: 'Sourcepoint TCF v2.2', adReq: 57, trackers: 35, bloatMb: 9.4, loadSec: 3.9, ramMb: 350, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'lemonde.fr', name: 'Le Monde (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 56, trackers: 35, bloatMb: 9.3, loadSec: 3.9, ramMb: 345, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'smartadserver.com'] },
  { domain: 'lefigaro.fr', name: 'Le Figaro (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 68, trackers: 43, bloatMb: 11.5, loadSec: 4.8, ramMb: 415, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'smartadserver.com'] },
  { domain: 'bfmtv.com', name: 'BFMTV (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 69, trackers: 44, bloatMb: 11.7, loadSec: 4.9, ramMb: 420, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: '20minutes.fr', name: '20 Minutes (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 67, trackers: 42, bloatMb: 11.3, loadSec: 4.7, ramMb: 410, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'smartadserver.com'] },
  { domain: 'leparisien.fr', name: 'Le Parisien (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'jeuxvideo.com', name: 'JeuxVideo.com (FR)', category: 'EU Gaming (FR)', cmp: 'Didomi CNIL CMP', adReq: 70, trackers: 45, bloatMb: 12.1, loadSec: 5.0, ramMb: 430, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'smartadserver.com'] },
  { domain: 'marmiton.org', name: 'Marmiton Recettes (FR)', category: 'EU Recipes (FR)', cmp: 'Didomi CNIL CMP', adReq: 68, trackers: 43, bloatMb: 11.6, loadSec: 4.8, ramMb: 415, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'rubiconproject.com'] },
  { domain: 'allocine.fr', name: 'AlloCiné (FR)', category: 'EU Entertainment (FR)', cmp: 'Didomi CNIL CMP', adReq: 66, trackers: 42, bloatMb: 11.2, loadSec: 4.7, ramMb: 405, stacks: ['doubleclick.net', 'criteo.com', 'smartadserver.com', 'pubmatic.com'] },
  { domain: 'lequipe.fr', name: 'L’Équipe Sport (FR)', category: 'EU Sports (FR)', cmp: 'Didomi CNIL CMP', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'smartadserver.com'] },
  { domain: '01net.com', name: '01net Tech (FR)', category: 'EU Tech (FR)', cmp: 'Didomi CNIL CMP', adReq: 62, trackers: 39, bloatMb: 10.4, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'frandroid.com', name: 'Frandroid (FR)', category: 'EU Tech (FR)', cmp: 'Didomi CNIL CMP', adReq: 61, trackers: 38, bloatMb: 10.2, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'smartadserver.com'] },
  { domain: 'numerama.com', name: 'Numerama (FR)', category: 'EU Tech (FR)', cmp: 'Didomi CNIL CMP', adReq: 58, trackers: 36, bloatMb: 9.6, loadSec: 4.0, ramMb: 355, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'adnxs.com'] },
  { domain: 'Ouest-france.fr'.toLowerCase(), name: 'Ouest-France (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 66, trackers: 42, bloatMb: 11.2, loadSec: 4.7, ramMb: 405, stacks: ['doubleclick.net', 'taboola.com', 'criteo.com', 'smartadserver.com'] },
  { domain: 'liberation.fr', name: 'Libération (FR)', category: 'EU News (FR)', cmp: 'Didomi CNIL CMP', adReq: 59, trackers: 37, bloatMb: 9.8, loadSec: 4.1, ramMb: 365, stacks: ['doubleclick.net', 'outbrain.com', 'criteo.com', 'pubmatic.com'] },
  { domain: 'lesnumeriques.com', name: 'Les Numériques (FR)', category: 'EU Tech (FR)', cmp: 'Didomi CNIL CMP', adReq: 60, trackers: 38, bloatMb: 10.0, loadSec: 4.2, ramMb: 370, stacks: ['doubleclick.net', 'criteo.com', 'pubmatic.com', 'smartadserver.com'] },
  { domain: 'kentonline.co.uk', name: 'KentOnline (UK)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 67, trackers: 43, bloatMb: 11.4, loadSec: 4.8, ramMb: 410, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'lancs.live', name: 'LancsLive (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 74, trackers: 48, bloatMb: 13.0, loadSec: 5.3, ramMb: 455, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'pubmatic.com'] },
  { domain: 'edinburghlive.co.uk', name: 'Edinburgh Live (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 73, trackers: 47, bloatMb: 12.8, loadSec: 5.2, ramMb: 445, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'pubmatic.com'] },
  { domain: 'glasgowlive.co.uk', name: 'Glasgow Live (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 74, trackers: 48, bloatMb: 12.9, loadSec: 5.3, ramMb: 450, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'criteo.com'] },
  { domain: 'belfastlive.co.uk', name: 'Belfast Live (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 72, trackers: 46, bloatMb: 12.5, loadSec: 5.1, ramMb: 435, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'pubmatic.com'] },
  { domain: 'nottinghampost.com', name: 'Nottingham Post (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 75, trackers: 49, bloatMb: 13.2, loadSec: 5.4, ramMb: 460, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'criteo.com'] },
  { domain: 'leicestermercury.co.uk', name: 'Leicester Mercury (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 74, trackers: 48, bloatMb: 13.0, loadSec: 5.3, ramMb: 455, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'pubmatic.com'] },
  { domain: 'stokesentinel.co.uk', name: 'StokeonTrentLive (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 73, trackers: 47, bloatMb: 12.7, loadSec: 5.2, ramMb: 445, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'criteo.com'] },
  { domain: 'derbytelegraph.co.uk', name: 'Derbyshire Live (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 72, trackers: 46, bloatMb: 12.5, loadSec: 5.1, ramMb: 440, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'pubmatic.com'] },
  { domain: 'hull-daily-mail.co.uk', name: 'Hull Live (Reach PLC)', category: 'UK News', cmp: 'Quantcast Choice TCF', adReq: 73, trackers: 47, bloatMb: 12.6, loadSec: 5.2, ramMb: 445, stacks: ['doubleclick.net', 'mantis-intelligence.com', 'taboola.com', 'criteo.com'] },
  { domain: 'trustedreviews.com', name: 'Trusted Reviews (UK)', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 61, trackers: 38, bloatMb: 10.2, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'pocket-lint.com', name: 'Pocket-lint (UK / Valnet)', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'stuff.tv', name: 'Stuff UK Gadget Magazine', category: 'Tech & Dev', cmp: 'Quantcast Choice TCF', adReq: 59, trackers: 37, bloatMb: 9.8, loadSec: 4.1, ramMb: 365, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'expertreviews.co.uk', name: 'Expert Reviews UK', category: 'Tech & Dev', cmp: 'OneTrust GDPR', adReq: 58, trackers: 36, bloatMb: 9.6, loadSec: 4.0, ramMb: 355, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'adnxs.com'] },
  { domain: 'whatcar.com', name: 'What Car? UK', category: 'UK Motoring', cmp: 'OneTrust GDPR', adReq: 62, trackers: 39, bloatMb: 10.4, loadSec: 4.4, ramMb: 385, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'autocar.co.uk', name: 'Autocar UK', category: 'UK Motoring', cmp: 'OneTrust GDPR', adReq: 61, trackers: 38, bloatMb: 10.2, loadSec: 4.3, ramMb: 380, stacks: ['doubleclick.net', 'pubmatic.com', 'adnxs.com', 'criteo.com'] },
  { domain: 'autoexpress.co.uk', name: 'Auto Express UK', category: 'UK Motoring', cmp: 'Sourcepoint TCF v2.2', adReq: 64, trackers: 40, bloatMb: 10.8, loadSec: 4.5, ramMb: 395, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'pistonheads.com', name: 'PistonHeads UK', category: 'UK Motoring', cmp: 'Quantcast Choice TCF', adReq: 60, trackers: 37, bloatMb: 9.9, loadSec: 4.1, ramMb: 370, stacks: ['doubleclick.net', 'pubmatic.com', 'criteo.com', 'rubiconproject.com'] },
  { domain: 'timeout.com', name: 'Time Out London & UK', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 63, trackers: 39, bloatMb: 10.6, loadSec: 4.4, ramMb: 390, stacks: ['doubleclick.net', 'taboola.com', 'pubmatic.com', 'criteo.com'] },
  { domain: 'digitalspy.com', name: 'Digital Spy UK', category: 'Entertainment', cmp: 'OneTrust GDPR', adReq: 65, trackers: 41, bloatMb: 11.0, loadSec: 4.6, ramMb: 400, stacks: ['doubleclick.net', 'outbrain.com', 'pubmatic.com', 'criteo.com'] }
].filter((p) => !EXCLUDED_ADULT_OR_PIRACY_RE.test(p.domain));

const staticRules = fs.existsSync(STATIC_RULES_PATH)
  ? JSON.parse(fs.readFileSync(STATIC_RULES_PATH, 'utf8'))
  : [];

const BARE_AMP_RE = /&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);)/g;

function escapeBareAmpersands(raw) {
  return String(raw ?? '').replace(BARE_AMP_RE, '&amp;');
}

function escapeHtmlText(raw) {
  return escapeBareAmpersands(raw)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(raw) {
  return escapeHtmlText(raw).replace(/"/g, '&quot;');
}

function escapeHtmlInsideCode(raw) {
  return String(raw ?? '')
    .replace(/&(?!(?:amp|lt|gt|quot|#39|#x27|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function convertBackticksToCode(str) {
  return String(str ?? '')
    .split(/(`[^`\r\n]+`)/g)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return `<code class="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">${escapeHtmlInsideCode(part.slice(1, -1))}</code>`;
      }
      return escapeBareAmpersands(part);
    })
    .join('');
}

function domainToSlug(domain) {
  return String(domain).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const FALLBACK_HOST_PATTERNS = [
  '||doubleclick.net^',
  '||googlesyndication.com^',
  '||criteo.com^',
  '||taboola.com^',
  '||pubmatic.com^'
];

function getMatchedDnrRulesForPublisher(pub) {
  const matched = [];
  for (const r of staticRules) {
    const uf = String(r?.condition?.urlFilter || '').toLowerCase();
    if (!uf || EXCLUDED_ADULT_OR_PIRACY_RE.test(uf)) continue;
    if (pub.stacks.some((st) => uf.includes(st.replace(/^(?:cdn|scripts)\./i, '').split('.')[0]))) {
      matched.push({
        id: r.id,
        action: r.action?.type || 'block',
        urlFilter: r.condition.urlFilter,
        resourceTypes: (r.condition.resourceTypes || ['script', 'xmlhttprequest']).slice(0, 3).join(', ')
      });
    }
    if (matched.length >= 5) break;
  }
  for (const pattern of FALLBACK_HOST_PATTERNS) {
    if (matched.length >= 3) break;
    if (matched.some((m) => m.urlFilter === pattern)) continue;
    const rule = staticRules.find((r) => r?.condition?.urlFilter === pattern);
    if (rule) {
      matched.push({
        id: rule.id,
        action: rule.action?.type || 'block',
        urlFilter: rule.condition.urlFilter,
        resourceTypes: (rule.condition?.resourceTypes || ['script', 'xmlhttprequest']).slice(0, 3).join(', ')
      });
    }
  }
  return matched;
}

const CMP_PROFILES = {
  'Sourcepoint TCF v2.2': {
    short: 'Sourcepoint',
    domHook: 'cross-origin iframe container (`[id^="sp_message_container_"]`) paired with `.sp-message-open` viewport lock styles',
    apiBehavior: 'evaluates IAB TCF v2.2 `__tcfapi` consent state and falls back to paywall/Nag gating if consent cookies remain unset',
    remediation: 'targets Sourcepoint’s non-essential rejection frame automatically, records clean negative consent flags (`euconsent-v2`), and clears `.sp-message-open` `overflow:hidden` locks immediately.'
  },
  'Quantcast Choice TCF': {
    short: 'Quantcast Choice',
    domHook: 'nested `#qc-cmp2-container` portal with delayed Purpose-1 legitimate-interest toggles',
    apiBehavior: 'holds page interactivity while loading full vendor leg-interest matrices from Quantcast CDN edge nodes',
    remediation: 'dispatches programmatic Disapprove-All events inside the Quantcast Choice v2 wrapper before UI paint, preventing banner flash and body lock.'
  },
  'OneTrust GDPR': {
    short: 'OneTrust',
    domHook: '`#onetrust-consent-sdk` modal backdrop and `#onetrust-banner-sdk` sticky footer banner',
    apiBehavior: 'initializes Optanon consent groups (`C0001`–`C0004`) via `OptanonActiveGroups` before firing Google Tag Manager triggers',
    remediation: 'triggers native `#onetrust-reject-all-handler` callbacks cleanly at `document_start`, persisting strictly-necessary cookies only.'
  },
  'Didomi CNIL CMP': {
    short: 'Didomi CNIL',
    domHook: '`#didomi-host` Shadow-DOM wrapper combined with `didomi-popup-open` root scroll locks',
    apiBehavior: 'enforces French CNIL consent proof requirements across SmartAdServer and Criteo SSP bid adapters',
    remediation: 'invokes Didomi’s "Continuer sans accepter" handler inside the host shadow root automatically while restoring smooth scrolling.'
  },
  'Didomi TCF v2.2': {
    short: 'Didomi TCF v2.2',
    domHook: '`#didomi-notice` overlay with multi-tab vendor disclosure trees',
    apiBehavior: 'suspends header-bidding auctions until explicit user interaction updates `didomi_token`',
    remediation: 'applies instant negative TCF signal propagation across Didomi’s SDK so articles render immediately with zero banner flicker.'
  },
  'Usercentrics CMP': {
    short: 'Usercentrics',
    domHook: '`#usercentrics-root` closed-style Web Component Shadow DOM with custom host styling',
    apiBehavior: 'isolates Accept/Deny buttons inside a shadow root where legacy element-hiding stylesheets cannot reach',
    remediation: 'bridges safely into `#usercentrics-root` from an isolated content context to select "Alles ablehnen" and clear viewport overlays.'
  },
  'Sourcepoint / Usercentrics': {
    short: 'Sourcepoint / Usercentrics',
    domHook: 'hybrid dual-layer CMP pairing Sourcepoint edge routing with `#usercentrics-root` Shadow DOM modals',
    apiBehavior: 'switches dynamically between German Pur-Abo subscription prompts and standard IAB TCF v2.2 dialogs',
    remediation: 'detects active CMP routing at parse time and executes non-essential cookie rejection while neutralizing overlay scroll-freeze styles.'
  },
  'TrustArc Consent': {
    short: 'TrustArc',
    domHook: '`#truste-consent-track` iframe bar paired with asynchronous `consent.trustarc.com` preference frames',
    apiBehavior: 'loads multi-stage vendor preference tables across third-party iframes on North American &amp; international editions',
    remediation: 'intercepts TrustArc beacon initialization and sets functional-only preference state locally without loading tracking pixels.'
  },
  'Mediavine CMP': {
    short: 'Mediavine',
    domHook: 'Mediavine programmatic banner paired with `grow.me` newsletter sign-up interstitials',
    apiBehavior: 'bundles CMP consent collection directly into `scripts.mediavine.com` ad-slot auction timers',
    remediation: 'blocks `scripts.mediavine.com` bidder payloads at the C++ `declarativeNetRequest` boundary while keeping recipe cards intact.'
  },
  'Raptive / AdThrive CMP': {
    short: 'Raptive / AdThrive',
    domHook: '`cdn.adthrive.com` floating consent dock and anchored footer video containers',
    apiBehavior: 'synchronizes sticky bottom video players and mid-content density slots after consent handshake',
    remediation: 'terminates AdThrive bidder orchestration in Chromium’s C++ network layer so editorial text stays readable from top to bottom.'
  },
  'Snigel AdEngine CMP': {
    short: 'Snigel AdEngine',
    domHook: '`cdn.snigelweb.com` consent modal and asynchronous Prebid auction queues',
    apiBehavior: 'defers interactive sandbox widgets until AdEngine completes header-bidding floor timeouts',
    remediation: 'drops Snigel bid endpoints pre-request and neutralizes CMP modal containers so code examples remain unobstructed.'
  }
};

const VERTICAL_PROFILES = {
  'UK News': {
    verticalFocus: 'British national and regional breaking-news journalism',
    adPattern: 'dense in-article recommendation grids ("chumboxes"), sticky right-rail skyscraper units, and autoplay outstream video slots refreshed on scroll timers',
    benefitNote: 'Keep live blogs responsive without continuous Prebid auction timers draining laptop batteries or triggering browser fan noise.'
  },
  'Global News': {
    verticalFocus: 'high-frequency international newsroom and business reporting',
    adPattern: 'multi-partner OpenRTB header bidding, viewability measurement beacons, and sticky bottom breaking-news promo bars',
    benefitNote: 'Read long-form financial and world coverage without viewability polling scripts inflating Chrome tab memory.'
  },
  'Gaming & Wikis': {
    verticalFocus: 'structured strategy wikis, item databases, and esports patch tables',
    adPattern: 'persistent floating Twitch/video mini-players, narrow side-rail display wrappers, and heavy DOM mutation listeners during search filtering',
    benefitNote: 'Alt-tab between live game matches and database builds without ad-tech iframes spiking GPU usage or causing frame drops.'
  },
  'Recipes & Food': {
    verticalFocus: 'step-by-step culinary guides, ingredient lists, and cooking timers',
    adPattern: 'autoplay corner video players, newsletter popup curtains, and dozens of interleaved native ad cards between preparation photos',
    benefitNote: 'Jump directly to ingredient quantities and cooking temperatures on kitchen phones or tablets without erratic layout jumps.'
  },
  'Tech & Dev': {
    verticalFocus: 'hardware reviews, benchmark comparisons, and developer documentation',
    adPattern: 'affiliate comparison overlays, sticky sidebar display units, and inline sponsored software download widgets',
    benefitNote: 'Inspect specification charts and terminal code snippets cleanly with zero deceptive fake "Download" banner interference.'
  },
  'Entertainment': {
    verticalFocus: 'film reviews, episode explainers, and pop-culture coverage',
    adPattern: 'paginated slideshow galleries designed to re-trigger full Prebid ad auctions on each slide transition',
    benefitNote: 'Scroll multi-section reviews and media galleries smoothly without waiting seconds between image loads.'
  },
  'Utilities': {
    verticalFocus: 'real-time forecast dashboards, speed diagnostics, and reference tools',
    adPattern: 'background AJAX telemetry refreshes and high-impact takeover skins framing utility widgets',
    benefitNote: 'Preserve bandwidth during diagnostic or weather checks so measurements reflect actual ISP performance rather than ad transfers.'
  },
  'EU News (DE)': {
    verticalFocus: 'German daily newsrooms and DACH current-affairs reporting',
    adPattern: 'Pur-Abo subscription walls paired with German programmatic retargeting tags and Outbrain/Taboola native feeds',
    benefitNote: 'Read DACH news efficiently while enforcing GDPR non-tracking preferences across Usercentrics and Sourcepoint dialogs.'
  },
  'EU Tech (DE)': {
    verticalFocus: 'German software download portals and hardware test labs',
    adPattern: 'bundled download wrapper banners flanked by display advertising slots and Usercentrics consent gates',
    benefitNote: 'Locate official software download buttons immediately without confusing adjacent promotional placements.'
  },
  'EU Recipes (DE)': {
    verticalFocus: 'German community recipe collections and nutrition planners',
    adPattern: 'sticky mobile footer banners and mid-step native sponsorship cards triggered by scroll depth',
    benefitNote: 'Prepare recipes cleanly on kitchen screens without misclicking pop-over banners while scrolling ingredients.'
  },
  'EU Sports (DE)': {
    verticalFocus: 'Bundesliga match tickers and live European sports coverage',
    adPattern: 'live-refreshing ticker pages that re-fire header-bidding auctions during every scoreboard update',
    benefitNote: 'Follow live football minutes without exponential tab RAM growth over a 90-minute match.'
  },
  'EU News (FR)': {
    verticalFocus: 'French national daily reporting and breaking-news feeds',
    adPattern: 'CNIL-regulated Didomi consent barriers combined with French SSP auctions (SmartAdServer, Criteo) and native widgets',
    benefitNote: 'Enforce strict "Tout refuser" cookie hygiene automatically across French journalism portals.'
  },
  'EU Gaming (FR)': {
    verticalFocus: 'French video game forums, walkthroughs, and hardware coverage',
    adPattern: 'skin takeovers, video pre-roll containers, and continuous forum-thread ad re-auctions',
    benefitNote: 'Browse community forums and game guides swiftly with zero intrusive audio autoplay banners.'
  },
  'EU Recipes (FR)': {
    verticalFocus: 'French culinary guides and daily meal preparation pages',
    adPattern: 'multi-slot grocery retargeting pixels and floating video boxes blocking step instructions',
    benefitNote: 'Keep cooking steps clear from top to bottom on desktop and mobile devices.'
  },
  'EU Entertainment (FR)': {
    verticalFocus: 'French cinema listings, box-office reviews, and streaming guides',
    adPattern: 'theatrical skin takeovers and video trailer pre-roll ad wrappers before film clips start',
    benefitNote: 'Check showtimes and film ratings immediately without waiting through pre-roll commercial wrappers.'
  },
  'EU Sports (FR)': {
    verticalFocus: 'French sports newspapers, cycling tickers, and Ligue 1 live scores',
    adPattern: 'periodic live-score DOM updates bundled with real-time bidding refresh requests',
    benefitNote: 'Track live sporting events smoothly with consistent low CPU utilization.'
  },
  'EU Tech (FR)': {
    verticalFocus: 'French consumer electronics tests, smartphone guides, and buying tables',
    adPattern: 'reticular Criteo commerce retargeting pixels alongside comparison card ad injections',
    benefitNote: 'Compare hardware specifications cleanly without cross-site shopping trackers profiling your device.'
  },
  'UK Motoring': {
    verticalFocus: 'UK vehicle road tests, Car-of-the-Year reviews, and classified listings',
    adPattern: 'heavy dealership retargeting pixels, high-resolution sponsorship skins, and configurator lead-gen widgets',
    benefitNote: 'Research vehicle running costs and reviews fast while blocking dealership retargeting pixels.'
  }
};

const STACK_VENDOR_NOTES = Object.fromEntries(
  Object.entries({
    'doubleclick.net': 'Google Ad Manager / DoubleClick (`doubleclick.net`) orchestrates primary GPT ad-slot auctions and cross-domain conversion beacons',
    'taboola.com': 'Taboola (`taboola.com`) injects multi-column "Around the Web" sponsored widget grids and click telemetry trackers',
    'outbrain.com': 'Outbrain (`outbrain.com`) renders native recommendation chumboxes and persistent viewport-visibility observers',
    'criteo.com': 'Criteo (`criteo.com`) runs persistent commerce retargeting pixels that match product views across retailer sites',
    'pubmatic.com': 'PubMatic (`pubmatic.com`) participates in client-side OpenRTB header-bidding waterfalls on initial document paint',
    'rubiconproject.com': 'Magnite / Rubicon Project (`rubiconproject.com`) fires high-frequency Prebid bid adapters inside hidden auction iframes',
    'adnxs.com': 'Xandr / AppNexus (`adnxs.com`) coordinates programmatic display/native DSP auctions and cookie-sync pixels',
    'openx.net': 'OpenX (`openx.net`) executes header-bidding bid requests alongside user-ID synchronization cascades',
    'casalemedia.com': 'Index Exchange (`casalemedia.com`) manages real-time identity wrappers and multi-size ad-slot bidding loops',
    '3lift.com': 'TripleLift (`3lift.com`) serves dynamic native-style sponsored cards styled to mimic editorial thumbnails',
    'teads.tv': 'Teads (`teads.tv`) injects outstream video players directly between article paragraphs when scrolled into view',
    'scorecardresearch.com': 'Comscore (`scorecardresearch.com`) dispatches cross-publisher audience measurement tracking pixels',
    'fwmrm.net': 'FreeWheel (`fwmrm.net`) coordinates mid-roll and pre-roll video commercial insertion manifests',
    'permutive.com': 'Permutive (`permutive.com`) builds browser-stored behavioral cohort segments from reading topics and scroll depth',
    'moatads.com': 'Oracle Moat (`moatads.com`) runs continuous cursor/scroll frame polling scripts to measure ad-slot viewability',
    'revcontent.com': 'Revcontent (`revcontent.com`) loads high-density native widget grids at article footers',
    'chartbeat.com': 'Chartbeat (`chartbeat.com`) polls active tab engagement intervals every few seconds in background timers',
    'concert.io': 'Concert (`concert.io`) serves high-impact publisher collective display takeovers',
    'zam.com': 'ZAM Network (`zam.com`) runs gaming wiki wrapper scripts for floating video and sidebar slots',
    'scripts.mediavine.com': 'Mediavine (`scripts.mediavine.com`) injects continuous inline display slots and corner autoplay video units across recipe posts',
    'cdn.adthrive.com': 'Raptive / AdThrive (`cdn.adthrive.com`) dynamically inserts in-content ad containers triggered by scroll velocity',
    'cdn.snigelweb.com': 'Snigel AdEngine (`cdn.snigelweb.com`) coordinates asynchronous header-bidding floors across tutorial pages',
    'smartadserver.com': 'Equativ / SmartAdServer (`smartadserver.com`) handles European programmatic display, audio, and native auctions',
    'mantis-intelligence.com': 'Mantis (`mantis-intelligence.com`) runs page-level semantic NLP scanners to target contextual news advertising',
    'bing.com': 'Microsoft Advertising (`bing.com`) fires conversion and audience-matching UET event pixels'
  }).map(([k, v]) => [k, convertBackticksToCode(v)])
);

const REGION_COMPLIANCE_PROSE = {
  de: {
    heading: 'German TDDDG §25 & Pur-Abo Consent Landscape',
    body: 'German media portals fall under §25 TDDDG (Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz) and Data Protection Conference (DSK) guidance governing Pur-Abo subscription walls. Publishers frequently nest dark-pattern multi-toggle dialogs behind closed Web Component shadow roots where superficial element-hiding stylesheets break keyboard focus and freeze body scrolling.'
  },
  fr: {
    heading: 'French CNIL Article 82 Enforcement Context',
    body: 'French publishers operate under CNIL Article 82 deliberation guidelines requiring first-layer parity for "Continuer sans accepter" alongside acceptance controls. Despite strict regulatory scrutiny from Paris auditors, multi-stage vendor trees routinely re-trigger modal backdrops across paginated sports galleries, recipe cards, and consumer electronics comparisons.'
  },
  uk: {
    heading: 'UK ICO PECR & Programmatic Wrapper Audit',
    body: 'British newsrooms and motoring publications follow UK Information Commissioner’s Office (ICO) PECR enforcement notices emphasizing unambiguous consent refusal. However, commercial wrapper scripts frequently withhold editorial hero typography or lock vertical viewport touch scrolling until an explicit IAB Transparency Framework bitmask populates browser storage.'
  },
  global: {
    heading: 'CPRA Global Privacy Control & US-Nat String Handling',
    body: 'North American and global domains predominantly respond to IAB US-Nat consent arrays and HTTP `Sec-GPC: 1` opt-out preference headers. Even when Global Privacy Control transmits successfully, client-side JavaScript waterfall libraries still spawn heavy iframe bid requests and background viewability polling timers unless blocked prior to network dispatch.'
  }
};

const STACK_DEEP_ANALYSIS = {
  'doubleclick.net': { role: 'Ad Exchange Orchestrator', detail: 'Google Ad Manager / DoubleClick (`doubleclick.net`) executes synchronous GPT tag initialization, SafeFrame sandbox negotiation, and cross-property frequency capping lookups prior to layout stabilization.' },
  'taboola.com': { role: 'Recommendation Grid Engine', detail: 'Taboola (`taboola.com`) hydrates multi-row clickbait thumbnail widgets at bottom viewports while dispatching scroll-velocity telemetry beacons back to discovery servers.' },
  'outbrain.com': { role: 'Native Feed Distributor', detail: 'Outbrain (`outbrain.com`) injects sponsored story cards stylized after surrounding editorial headlines and runs IntersectionObserver visibility timers on mobile screens.' },
  'criteo.com': { role: 'Retail Retargeting Bidder', detail: 'Criteo (`criteo.com`) performs real-time commerce profile matching via ID-sync redirect chains that re-target recently viewed footwear, flight, or appliance listings.' },
  'pubmatic.com': { role: 'Header-Bidding SSP Node', detail: 'PubMatic (`pubmatic.com`) participates in client-side OpenRTB multi-size banner auctions during initial DOM parsing, contending directly with main-thread JavaScript parsing.' },
  'rubiconproject.com': { role: 'Magnite Prebid Adapter', detail: 'Magnite / Rubicon Project (`rubiconproject.com`) dispatches high-frequency Prebid auction JSON requests inside ephemeral iframes, inflating Chromium V8 heap allocations.' },
  'adnxs.com': { role: 'Xandr Demand Exchange', detail: 'Xandr / AppNexus (`adnxs.com`) coordinates programmatic display/native DSP auction responses alongside cookie-matching image pixels distributed across buyer networks.' },
  'openx.net': { role: 'SSP Auction Partner', detail: 'OpenX (`openx.net`) triggers asynchronous display/video bid requests combined with cross-domain identity synchronization cascades.' },
  'casalemedia.com': { role: 'Index Exchange Wrapper', detail: 'Index Exchange (`casalemedia.com`) evaluates identity envelope tokens inside client-side Prebid libraries before forwarding winning creative markup.' },
  '3lift.com': { role: 'Native Creative Adapter', detail: 'TripleLift (`3lift.com`) transforms structured programmatic metadata into fluid in-feed sponsored tiles that shift gallery spacing.' },
  'teads.tv': { role: 'Outstream Video Player', detail: 'Teads (`teads.tv`) dynamically expands inline video player DOM nodes between editorial paragraphs once viewport scroll reaches mid-article checkpoints.' },
  'scorecardresearch.com': { role: 'Panel Audience Telemetry', detail: 'Comscore (`scorecardresearch.com`) fires cross-publisher measurement beacons cataloging browser resolution, session timestamps, and referral chains.' },
  'fwmrm.net': { role: 'FreeWheel Video Server', detail: 'FreeWheel (`fwmrm.net`) delivers VAST/VMAP video commercial manifests enforcing unskippable mid-roll breaks inside embedded players.' },
  'permutive.com': { role: 'Edge Cohort Profiler', detail: 'Permutive (`permutive.com`) runs dedicated client-side cohort scripts computing interest segments inside IndexedDB and LocalStorage from scroll history.' },
  'moatads.com': { role: 'Viewability Frame Poller', detail: 'Oracle Moat (`moatads.com`) attaches continuous high-frequency pointer and scroll listeners monitoring millisecond ad-slot exposure metrics.' },
  'revcontent.com': { role: 'Widget Content Ad Network', detail: 'Revcontent (`revcontent.com`) appends high-density footer thumbnail grids optimized for sensational referral traffic arbitrage.' },
  'chartbeat.com': { role: 'Live Editorial Ping Loop', detail: 'Chartbeat (`chartbeat.com`) sustains recurring idle keep-alive XHR timers preventing background tabs from entering low-power sleep.' },
  'concert.io': { role: 'Collective Display Takeover', detail: 'Concert (`concert.io`) loads heavyweight full-bleed sponsorship skins framing top navigation bars.' },
  'zam.com': { role: 'Gaming Database Wrapper', detail: 'ZAM (`zam.com`) orchestrates dual sticky video containers alongside right-rail item tooltip monetization frames.' },
  'scripts.mediavine.com': { role: 'Blog Monetization Suite', detail: 'Mediavine (`scripts.mediavine.com`) injects automated in-content banners every few paragraphs alongside persistent corner autoplay video thumbnails.' },
  'cdn.adthrive.com': { role: 'Raptive Publisher Stack', detail: 'Raptive / AdThrive (`cdn.adthrive.com`) injects sticky mobile anchor ribbons and scroll-triggered mid-recipe advertising cards.' },
  'cdn.snigelweb.com': { role: 'Tutorial AdEngine Wrapper', detail: 'Snigel (`cdn.snigelweb.com`) coordinates dynamic ad-floor refresh loops around interactive sandbox tutorials and code playgrounds.' },
  'smartadserver.com': { role: 'Equativ European SSP', detail: 'Equativ / SmartAdServer (`smartadserver.com`) handles European programmatic display skins, native cards, and GDPR consent synchronization.' },
  'mantis-intelligence.com': { role: 'Semantic Context Scanner', detail: 'Mantis (`mantis-intelligence.com`) scans rendered article paragraphs client-side to classify brand-safety keywords for regional ad buyers.' },
  'bing.com': { role: 'UET Conversion Tracker', detail: 'Microsoft Advertising (`bing.com`) transmits UET behavioral event payloads correlating search clicks with marketplace browsing.' }
};

function getRegionInfo(pub) {
  const cat = String(pub?.category || '');
  const name = String(pub?.name || '');
  const domain = String(pub?.domain || '');
  if (/\(DE\)/i.test(cat) || /\(DE\)/i.test(name) || /\.de$/i.test(domain)) return REGION_COMPLIANCE_PROSE.de;
  if (/\(FR\)/i.test(cat) || /\(FR\)/i.test(name) || /\.fr$/i.test(domain)) return REGION_COMPLIANCE_PROSE.fr;
  if (/^UK\b/i.test(cat) || /\bUK\b/.test(name) || /\.uk$/i.test(domain)) return REGION_COMPLIANCE_PROSE.uk;
  return REGION_COMPLIANCE_PROSE.global;
}

function getPeerPublishers(pub, idx, allPubs) {
  const sameCategory = allPubs.filter((p) => p.domain !== pub.domain && p.category === pub.category);
  const catIdx = Math.max(0, sameCategory.findIndex((p) => p.domain > pub.domain));
  const peerSet = [];
  const addPeer = (candidate) => {
    if (candidate && candidate.domain !== pub.domain && !peerSet.some((x) => x.domain === candidate.domain)) {
      peerSet.push(candidate);
    }
  };
  for (const off of [1, 3, 7, 13, 29]) {
    addPeer(allPubs[(idx + off) % allPubs.length]);
    addPeer(allPubs[(idx - off + allPubs.length) % allPubs.length]);
    if (sameCategory.length > 0) {
      addPeer(sameCategory[(catIdx + off) % sameCategory.length]);
    }
    if (peerSet.length >= 6) break;
  }
  return peerSet.slice(0, 6);
}

const todayStr = new Date().toISOString().slice(0, 10);

function renderSiteReportPage(pub, idx, allPubs) {
  const slug = domainToSlug(pub.domain);
  const selfPath = `/site/${slug}`;
  const canonical = `${SITE_ORIGIN}${selfPath}`;
  const cmpProfile = CMP_PROFILES[pub.cmp] || CMP_PROFILES['OneTrust GDPR'];
  const vertProfile = VERTICAL_PROFILES[pub.category] || VERTICAL_PROFILES['Global News'];
  const regInfo = getRegionInfo(pub);
  const peerPubs = getPeerPublishers(pub, idx, allPubs);

  const rawTitle = `Block Ads & ${cmpProfile.short} Popups on ${pub.domain} (2026)`;
  const safeTitle = rawTitle.length <= 65 ? rawTitle : `Block Ads & Cookies on ${pub.domain} (2026) | SWEEPR`;
  const rawDesc = `Static ad-tech profile for ${pub.domain}: typical ${pub.adReq} ad requests (~${pub.bloatMb} MB), ${pub.trackers} tracker patterns, and ${pub.cmp} cookie handling.`;
  const safeDesc = rawDesc.length <= 165 ? rawDesc : `Ad-tech profile for ${pub.domain}: ~${pub.adReq} ad calls (${pub.bloatMb} MB), ${pub.trackers} trackers, and ${pub.cmp} handling.`;

  const matchedRules = getMatchedDnrRulesForPublisher(pub);

  const payloadKb = Math.round(pub.bloatMb * 1024);
  const monthlyDataSavedGb = ((pub.bloatMb * 30) / 1024).toFixed(2);
  const annualDataSavedGb = ((pub.bloatMb * 365) / 1024).toFixed(2);
  const tenTabRamGb = ((pub.ramMb * 10) / 1024).toFixed(2);
  const hundredLoadMins = ((pub.loadSec * 100) / 60).toFixed(1);
  const loadSeverity = pub.adReq >= 70 ? 'high ad-auction density' : pub.adReq >= 60 ? 'elevated multi-bidder density' : 'moderate programmatic wrapper overhead';

  const stackBullets = pub.stacks.map((st) => {
    const entry = STACK_DEEP_ANALYSIS[st] || {
      role: 'Programmatic Bidder',
      detail: `External ad-tech endpoint (\`${st}\`) commonly present in unshielded ${pub.domain} header-bidding waterfalls.`
    };
    return `<li class="text-sm text-gray-700 leading-relaxed"><strong class="text-gray-900">${escapeHtml(entry.role)} — ${escapeHtml(st)}:</strong> ${convertBackticksToCode(entry.detail)}</li>`;
  });

  const summaryIntroMap = [
    `Static pattern profiling for <strong>${escapeHtml(pub.domain)}</strong> models roughly <strong>${pub.adReq} OpenRTB calls</strong> (~${payloadKb} KB), <strong>${pub.trackers} tracking patterns</strong>, and a ${escapeHtml(pub.cmp)} overlay (~${pub.ramMb} MB estimated tab overhead). <strong>${PRODUCT_FACTS.name} v${escapeHtml(MANIFEST_VERSION)}</strong> applies ${STATIC_RULE_COUNT} static C++ <code class="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">declarativeNetRequest</code> rules at Chromium’s network layer while rejecting non-essential consent dialogs.`,
    `Baseline ad-tech analysis for <strong>${escapeHtml(pub.name)}</strong> identifies roughly <strong>${pub.bloatMb} MB</strong> of third-party bidder assets, <strong>${pub.trackers} tracker endpoints</strong> (${escapeHtml(pub.stacks.slice(0, 3).join(', '))}), and ${escapeHtml(cmpProfile.short)} DOM barriers (~+${pub.loadSec}s estimated overhead). Filtering ${escapeHtml(pub.domain)} with <strong>v${escapeHtml(MANIFEST_VERSION)}</strong> blocks matched bidder domains before network dispatch.`,
    `On unshielded ${escapeHtml(pub.category)} pages like <strong>${escapeHtml(pub.domain)}</strong>, browsers typically initiate ~<strong>${pub.adReq} external ad auctions</strong> alongside ${pub.trackers} tracker patterns under ${escapeHtml(pub.cmp)}. Enabling <strong>${PRODUCT_FACTS.name} v${escapeHtml(MANIFEST_VERSION)}</strong> blocks matched ad-exchange hosts and clears consent scroll locks.`
  ];
  const directAnswer = summaryIntroMap[idx % summaryIntroMap.length];

  const breadcrumbs = [
    { name: 'Home', href: '/', item: '/' },
    { name: 'Site Ad-Tech Profiles', href: '/site', item: '/site' },
    { name: pub.domain, item: selfPath }
  ];

  const jsonLd = buildJsonLd({
    canonicalUrl: canonical,
    breadcrumbs,
    includeSoftwareApp: false,
    article: {
      '@type': 'TechArticle',
      headline: `${pub.name} (${pub.domain}) — 2026 Static Ad-Tech & Cookie CMP Profile`,
      description: safeDesc,
      url: canonical,
      datePublished: '2026-11-04',
      dateModified: todayStr
    }
  });

  const disclaimerHtml = renderCallout({
    tone: 'amber',
    title: 'Heuristic Ad-Tech Profile Estimate (Not Live Browser Telemetry)',
    bodyHtml: `Numbers on this page are static baseline estimates of typical SSP/ad-tech and CMP patterns for <strong>${escapeHtml(pub.domain)}</strong> rather than live Playwright or HAR telemetry. Test real-time browser blocking in our <a href="/test-lab" class="text-emerald-700 font-semibold underline">Browser Test Lab</a> or review <a href="/benchmarks" class="text-emerald-700 font-semibold underline">v${escapeHtml(MANIFEST_VERSION)} MV3 Benchmarks</a>.`
  });

  const comparisonTableHtml = renderComparisonTable({
    id: 'publisher-baseline-comparison',
    caption: `${pub.domain} heuristic ad-tech baseline vs ${PRODUCT_FACTS.name} v${MANIFEST_VERSION}`,
    headers: [`${pub.domain} Profile`, 'Unshielded Browser (Est.)', `${PRODUCT_FACTS.name} v${MANIFEST_VERSION}`],
    rows: [
      ['Bid Auctions & Transfer', `~${pub.adReq} requests (${pub.bloatMb} MB est.)`, 'Matched SSP/ad hosts blocked at DNR layer'],
      [`CMP Handling (${cmpProfile.short})`, `${pub.cmp} overlay & scroll lock`, 'Non-essential consent rejected automatically'],
      ['Tracking Hosts', `~${pub.trackers} (${pub.stacks.slice(0, 3).join(', ')})`, 'Known ad/tracker patterns blocked pre-request'],
      ['10-Tab Footprint (Est.)', `~${tenTabRamGb} GB (+${pub.loadSec}s est. load)`, 'Inactive tabs eligible for 10-min Tab & RAM Tamer']
    ]
  });

  const dnrTableHtml = renderComparisonTable({
    id: 'dnr-filter-patterns',
    caption: `Static DNR rules matched for ${pub.domain}`,
    headers: ['Rule ID', 'Mode', 'Host Pattern', 'Resource Types'],
    rows: matchedRules.map((r) => [
      `#${r.id}`,
      r.action,
      r.urlFilter,
      r.resourceTypes
    ])
  });

  const peerCardsHtml = `<section class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="glass-card p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
      <h2 class="text-sm font-extrabold uppercase tracking-wider text-gray-900">More ${escapeHtml(pub.category)} Profiles</h2>
      <ul class="space-y-2 text-sm text-gray-700">
        ${peerPubs
          .map(
            (p) =>
              `<li><a href="/site/${domainToSlug(p.domain)}" class="text-emerald-700 hover:underline font-semibold">${escapeHtml(p.name)} (${escapeHtml(p.domain)})</a> — ~${p.adReq} est. calls, ${escapeHtml(p.cmp)}</li>`
          )
          .join('\n        ')}
      </ul>
    </div>
    <article class="glass-card p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
      <h2 class="text-sm font-extrabold uppercase tracking-wider text-gray-900">${escapeHtml(pub.domain)} Quick Reference</h2>
      <p class="text-sm text-gray-600 leading-relaxed">
        ${escapeHtml(pub.name)} commonly integrates ${escapeHtml(pub.stacks.join(', '))} alongside ${escapeHtml(pub.cmp)}. Baseline modeling estimates ~${payloadKb} KB of ad-auction payload and ~${pub.ramMb} MB per tab (~${tenTabRamGb} GB across 10 open tabs).
      </p>
      <div class="flex flex-wrap gap-3 pt-1 text-xs font-bold">
        <a href="/tools/browser-ram-calculator" class="text-emerald-700 hover:underline">Open Browser RAM Calculator &rarr;</a>
        <a href="/guides/how-to-automatically-reject-cookie-banners-uk" class="text-emerald-700 hover:underline">Cookie Auto-Reject Guide &rarr;</a>
      </div>
    </article>
  </section>`;

  const relatedHtml = renderRelatedGrid({
    heading: 'Verified Architecture & Guides',
    items: [
      { href: '/test-lab', badge: 'Live Diagnostic', label: 'Browser Anti-Detection Test Lab' },
      { href: '/tools/browser-ram-calculator', badge: 'Calculator', label: 'Browser RAM & Tab Bloat Calculator' },
      { href: '/benchmarks', badge: 'Architecture', label: `SWEEPR Deepblock v${MANIFEST_VERSION} Benchmarks` },
      { href: '/guides/how-to-automatically-reject-cookie-banners-uk', badge: 'Cookie Guide', label: 'Auto-Reject Cookie Banners (UK & EU)' }
    ]
  });

  const contentHtml = `
    ${renderBreadcrumbs(breadcrumbs)}
    <header class="space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span>${escapeHtml(pub.category)}</span>
        <span aria-hidden="true">&middot;</span>
        <time datetime="${todayStr}">${todayStr}</time>
      </div>
      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
        ${escapeHtml(pub.name)} (<code class="px-2 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-2xl sm:text-3xl">${escapeHtml(pub.domain)}</code>) — Ad-Tech &amp; CMP Profile
      </h1>
      <div class="glass-card p-5 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <p class="text-gray-800 text-base leading-relaxed m-0">${directAnswer}</p>
        <div class="flex flex-wrap gap-4 text-xs font-bold">
          <a href="/test-lab" class="text-emerald-700 underline">Run Live Browser Test Lab &rarr;</a>
          <a href="/tools/browser-ram-calculator" class="text-emerald-700 underline">Estimate Tab RAM Savings &rarr;</a>
        </div>
      </div>
    </header>

    ${disclaimerHtml}

    ${renderGlassCard({
      title: `${pub.name}: ${regInfo.heading} & ${cmpProfile.short} Breakdown`,
      badge: `v${MANIFEST_VERSION} · ${STATIC_RULE_COUNT} Static Rules`,
      bodyHtml: `<div class="space-y-4">
        <p class="text-sm text-gray-700 leading-relaxed">
          Focused on ${escapeHtml(vertProfile.verticalFocus)}, <strong>${escapeHtml(pub.domain)}</strong> exhibits ${loadSeverity} driven by ${escapeHtml(vertProfile.adPattern)}. Based on static baseline estimates, one daily visit totals roughly <strong>${monthlyDataSavedGb} GB monthly</strong> (${annualDataSavedGb} GB annually) in third-party ad transfers (~${hundredLoadMins} minutes across 100 page loads).
        </p>
        <p class="text-sm text-gray-700 leading-relaxed">
          <strong>Consent Layer (${escapeHtml(pub.cmp)}):</strong> ${convertBackticksToCode(regInfo.body)} Specifically on ${escapeHtml(pub.domain)}, the site typically uses a ${convertBackticksToCode(cmpProfile.domHook)} that ${convertBackticksToCode(cmpProfile.apiBehavior)}. ${PRODUCT_FACTS.name} v${escapeHtml(MANIFEST_VERSION)} ${convertBackticksToCode(cmpProfile.remediation)} ${escapeHtml(vertProfile.benefitNote)}
        </p>
        <ul class="list-disc pl-5 space-y-2 pt-1">
          ${stackBullets.join('\n          ')}
        </ul>
      </div>`
    })}

    ${comparisonTableHtml}

    <div class="space-y-3">
      <h2 class="text-xl font-extrabold text-gray-900 tracking-tight">Matched Static DNR Rules for ${escapeHtml(pub.name)}</h2>
      <p class="text-sm text-gray-600">Rules below are read directly from <code class="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">extension/rules/static_ads_and_trackers.json</code> in ${PRODUCT_FACTS.name} v${escapeHtml(MANIFEST_VERSION)}.</p>
      ${dnrTableHtml}
    </div>

    ${renderCtaBanner({
      badge: `${PRODUCT_FACTS.name} v${MANIFEST_VERSION}`,
      heading: `Browse ${pub.domain} Without Ad-Tech Clutter`,
      subtext: `${STATIC_RULE_COUNT} static Manifest V3 declarativeNetRequest rules, automated GDPR cookie rejection, URL tracking parameter stripping, and Total Tab & RAM Tamer across ${PRODUCT_FACTS.devicesIncluded} devices.`,
      primaryLabel: 'Install Free Extension',
      primaryHref: '/download?install=1',
      secondaryLabel: 'Compare Pro Plans',
      secondaryHref: '/pricing'
    })}

    ${peerCardsHtml}
    ${relatedHtml}
  `;

  return renderShellPage({
    title: safeTitle,
    description: safeDesc,
    canonicalUrl: canonical,
    currentPath: selfPath,
    lang: 'en',
    htmlLang: 'en-GB',
    robots: 'noindex, nofollow',
    ogType: 'article',
    jsonLd,
    contentHtml
  });
}

// 1. Write all 150 /site/{slug}.html pages
for (let i = 0; i < VERIFIED_PUBLISHERS.length; i++) {
  const pub = VERIFIED_PUBLISHERS[i];
  const slug = domainToSlug(pub.domain);
  const html = renderSiteReportPage(pub, i, VERIFIED_PUBLISHERS);
  fs.writeFileSync(path.join(SITE_DIR, `${slug}.html`), html, 'utf8');
}

// 2. Write /site/index.html hub (`noindex, nofollow`, self-canonical)
const publisherCount = VERIFIED_PUBLISHERS.length;
const siteHubCanonical = `${SITE_ORIGIN}/site`;
const siteHubBreadcrumbs = [
  { name: 'Home', href: '/', item: '/' },
  { name: 'Publisher Ad-Tech Profiles', item: '/site' }
];
const siteHubJsonLd = buildJsonLd({
  canonicalUrl: siteHubCanonical,
  breadcrumbs: siteHubBreadcrumbs,
  includeSoftwareApp: false,
  extraGraph: [
    {
      '@type': 'CollectionPage',
      name: `${PRODUCT_FACTS.name} Publisher Ad-Tech & Cookie CMP Profiles`,
      url: siteHubCanonical,
      description: `Heuristic static ad-tech, tracker pattern, and cookie consent CMP profiles for ${publisherCount} UK, EU, and global websites.`
    }
  ]
});

const siteHubContent = `
  ${renderBreadcrumbs(siteHubBreadcrumbs)}
  <header class="space-y-3">
    <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">Heuristic Profiles · ${publisherCount} Publishers</span>
    <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Website Ad-Load &amp; Cookie CMP Profiles (${publisherCount} Publishers)</h1>
    <p class="text-gray-600 max-w-3xl text-sm sm:text-base leading-relaxed">
      Explore static baseline ad-tech profiles cross-referenced against ${PRODUCT_FACTS.name} v${escapeHtml(MANIFEST_VERSION)} Manifest V3 <code class="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">declarativeNetRequest</code> rulesets and regional CMP signatures.
    </p>
  </header>

  ${renderCallout({
    tone: 'amber',
    title: 'Heuristic Ad-Tech Profile Estimate (Not Live Browser Telemetry)',
    bodyHtml: `Each profile below models typical SSP/ad-server stacks and cookie consent frameworks rather than live automated browser measurements. For live client-side checks, visit the <a href="/test-lab" class="text-emerald-700 font-semibold underline">Browser Test Lab</a> or <a href="/benchmarks" class="text-emerald-700 font-semibold underline">v${escapeHtml(MANIFEST_VERSION)} Benchmarks</a>.`
  })}

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    ${VERIFIED_PUBLISHERS.map(
      (p) => `<a href="/site/${domainToSlug(p.domain)}" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-4 transition-all no-underline flex flex-col justify-between gap-2 shadow-sm">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-emerald-700 uppercase">${escapeHtml(p.category)}</span>
            <span class="text-xs font-mono text-rose-700 font-bold">~${p.adReq} est. reqs</span>
          </div>
          <div class="text-base font-extrabold text-gray-900 mt-1">${escapeHtml(p.name)}</div>
          <div class="text-xs font-mono text-gray-500">${escapeHtml(p.domain)}</div>
        </div>
        <div class="text-xs text-gray-600 pt-2 border-t border-gray-200 flex items-center justify-between">
          <span>CMP: ${escapeHtml(p.cmp)}</span>
          <span class="text-emerald-700 font-bold">~${p.ramMb} MB est. &rarr;</span>
        </div>
      </a>`
    ).join('\n    ')}
  </div>

  ${renderRelatedGrid({
    heading: 'Core Diagnostics & Guides',
    items: [
      { href: '/test-lab', badge: 'Live Diagnostic', label: 'Browser Anti-Detection Test Lab' },
      { href: '/tools/browser-ram-calculator', badge: 'Calculator', label: 'Browser RAM & Tab Bloat Calculator' },
      { href: '/benchmarks', badge: 'Architecture', label: 'v1.3.1 MV3 Benchmarks' },
      { href: '/vs/total-adblock', badge: 'Comparison', label: 'SWEEPR Deepblock vs Total Adblock' }
    ]
  })}
`;

const siteHubHtml = renderShellPage({
  title: `Website Ad & Cookie CMP Profiles (${publisherCount} Sites) | SWEEPR`,
  description: `Explore ${publisherCount} static heuristic ad-load, tracker pattern, and GDPR cookie consent CMP profiles across UK news, EU media, recipe blogs, gaming wikis, and tech portals.`,
  canonicalUrl: siteHubCanonical,
  currentPath: '/site',
  lang: 'en',
  htmlLang: 'en-GB',
  robots: 'noindex, nofollow',
  ogType: 'website',
  maxWidth: 'max-w-6xl',
  jsonLd: siteHubJsonLd,
  contentHtml: siteHubContent
});
fs.writeFileSync(path.join(SITE_DIR, 'index.html'), siteHubHtml, 'utf8');

// Note: M1 marks all /site* URLs NOINDEX_PRUNE — never write /site* URLs to sitemap-sites.xml or robots.txt.

// 3. Write Campaign 1: "The UK Website Ad-Load Index" (`website/campaigns/uk-ad-load-index.html`, NOINDEX_PRUNE)
const sortedByBloat = [...VERIFIED_PUBLISHERS].sort((a, b) => b.adReq - a.adReq);
const campaign1Canonical = `${SITE_ORIGIN}/campaigns/uk-ad-load-index`;
const campaign1Breadcrumbs = [
  { name: 'Home', href: '/', item: '/' },
  { name: 'UK Website Ad-Load Index', item: '/campaigns/uk-ad-load-index' }
];
const campaign1JsonLd = buildJsonLd({
  canonicalUrl: campaign1Canonical,
  breadcrumbs: campaign1Breadcrumbs,
  includeSoftwareApp: false,
  extraGraph: [
    {
      '@type': 'Dataset',
      name: 'The 2026 UK Website Ad-Load & Cookie Wall Profile Index',
      description: `Static heuristic index comparing ${publisherCount} UK, EU, and global websites by estimated ad-auction patterns, tracking frameworks, CMP cookie consent platforms, and tab RAM overhead.`,
      url: campaign1Canonical,
      creator: { '@type': 'Organization', name: 'SWEEPR Global Limited', url: `${SITE_ORIGIN}/` }
    }
  ]
});

const campaign1Content = `
  ${renderBreadcrumbs(campaign1Breadcrumbs)}
  <header class="space-y-4">
    <span class="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
      2026 Heuristic Research Index · ${publisherCount} Publishers
    </span>
    <h1 class="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">The 2026 UK Website Ad-Load Index</h1>
    <p class="text-gray-600 max-w-3xl text-base leading-relaxed">
      Static heuristic index comparing ${publisherCount} UK newspapers, regional Reach PLC titles, European newsrooms, gaming wikis, recipe blogs, and tech portals by typical ad-auction stacks, tracker patterns, and GDPR cookie consent CMPs.
    </p>
    <div class="flex flex-wrap gap-3 pt-1">
      <button id="copyRedditTableBtn" type="button" class="btn btn-go px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer">
        Copy Top 10 Markdown Table
      </button>
      <a href="/test-lab" class="btn px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm no-underline">
        Test Your Browser Protection &rarr;
      </a>
    </div>
  </header>

  ${renderCallout({
    tone: 'amber',
    title: 'Heuristic Ad-Tech Profile Estimate (Not Live Browser Telemetry)',
    bodyHtml: `Values below represent static baseline estimates for typical ad-tech stacks rather than live Playwright or HAR measurements. Run live browser checks in the <a href="/test-lab" class="text-emerald-700 font-semibold underline">Browser Test Lab</a> or inspect <a href="/benchmarks" class="text-emerald-700 font-semibold underline">v${escapeHtml(MANIFEST_VERSION)} MV3 Benchmarks</a>.`
  })}

  <section class="glass-card bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
    <div class="overflow-x-auto w-full">
      <table class="w-full text-left text-xs sm:text-sm border-collapse">
        <thead class="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[11px]">
          <tr>
            <th scope="col" class="py-3.5 px-4 font-bold">Rank</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Publisher Domain</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Category</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Est. Ad Calls</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Est. Trackers</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Cookie CMP Wall</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Est. Delay</th>
            <th scope="col" class="py-3.5 px-4 font-bold">Est. RAM Overhead</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${sortedByBloat
            .map(
              (p, idx) => `<tr class="hover:bg-emerald-50/30 transition-colors">
            <td class="py-3 px-4 font-mono font-bold text-gray-500">#${idx + 1}</td>
            <td class="py-3 px-4 font-bold"><a href="/site/${domainToSlug(p.domain)}" class="text-emerald-700 hover:underline">${escapeHtml(p.name)} (${escapeHtml(p.domain)})</a></td>
            <td class="py-3 px-4 text-gray-700">${escapeHtml(p.category)}</td>
            <td class="py-3 px-4 font-mono font-bold text-rose-700">~${p.adReq}</td>
            <td class="py-3 px-4 font-mono text-amber-800">~${p.trackers}</td>
            <td class="py-3 px-4 text-gray-700">${escapeHtml(p.cmp)}</td>
            <td class="py-3 px-4 font-mono text-emerald-700">+${p.loadSec}s</td>
            <td class="py-3 px-4 font-mono text-gray-800">~${p.ramMb} MB</td>
          </tr>`
            )
            .join('\n          ')}
        </tbody>
      </table>
    </div>
  </section>

  ${renderCtaBanner({
    badge: `${PRODUCT_FACTS.name} v${MANIFEST_VERSION}`,
    heading: 'Block Ad-Tech Bloat Across All Listed Categories',
    subtext: `${STATIC_RULE_COUNT} static Manifest V3 declarativeNetRequest rules, automated GDPR cookie rejection, URL tracker stripping, and Total Tab & RAM Tamer across ${PRODUCT_FACTS.devicesIncluded} devices.`,
    primaryLabel: 'Install Free Extension',
    primaryHref: '/download?install=1',
    secondaryLabel: 'Open Browser RAM Calculator',
    secondaryHref: '/tools/browser-ram-calculator'
  })}

  <script>
    document.getElementById('copyRedditTableBtn')?.addEventListener('click', function() {
      const md = [
        '| Rank | Website | Est. Ad Calls | Est. Trackers | Cookie CMP | Est. Delay | Est. RAM |',
        '|---|---|---|---|---|---|---|',
        ${JSON.stringify(
          sortedByBloat
            .slice(0, 10)
            .map((p, i) => `| #${i + 1} | ${p.domain} | ~${p.adReq} | ~${p.trackers} | ${p.cmp} | +${p.loadSec}s | ~${p.ramMb} MB |`)
        )}.join('\\n'),
        '',
        'Heuristic ad-tech index: https://sweeprdeepblock.com/benchmarks'
      ].join('\\n');
      navigator.clipboard?.writeText(md);
      this.textContent = 'Copied Markdown Table';
    });
  </script>
`;

const campaign1Html = renderShellPage({
  title: `2026 UK Website Ad-Load Index (${publisherCount} Sites) | SWEEPR`,
  description: `Static heuristic index comparing ${publisherCount} UK, EU, and global websites by estimated ad-auction calls, tracker patterns, cookie CMP walls, and tab RAM overhead.`,
  canonicalUrl: campaign1Canonical,
  currentPath: '/campaigns/uk-ad-load-index',
  lang: 'en',
  htmlLang: 'en-GB',
  robots: 'noindex, nofollow',
  ogType: 'article',
  maxWidth: 'max-w-6xl',
  jsonLd: campaign1JsonLd,
  contentHtml: campaign1Content
});
fs.writeFileSync(path.join(CAMPAIGNS_DIR, 'uk-ad-load-index.html'), campaign1Html, 'utf8');

// 4. Write Campaign 3: "Renewal Shock Switcher" Hub (`website/campaigns/renewal-shock-switcher.html`, CONSOLIDATE_301 -> /vs/total-adblock)
const campaign3Canonical = `${SITE_ORIGIN}/vs/total-adblock`;
const campaign3Breadcrumbs = [
  { name: 'Home', href: '/', item: '/' },
  { name: 'vs Total Adblock', item: '/vs/total-adblock' }
];
const campaign3JsonLd = buildJsonLd({
  canonicalUrl: campaign3Canonical,
  breadcrumbs: campaign3Breadcrumbs,
  includeSoftwareApp: true,
  softwareName: PRODUCT_FACTS.name
});

const campaign3Content = `
  ${renderBreadcrumbs(campaign3Breadcrumbs)}
  <div class="space-y-3 text-center max-w-3xl mx-auto">
    <span class="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Renewal Shock Switcher Calculator</span>
    <h1 class="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">Tired of £99+ Ad-Blocker Auto-Renewal Shock?</h1>
    <p class="text-gray-600 text-base leading-relaxed">
      Many UK and US users sign up for an introductory ad-blocker deal only to face a <strong>£99 to £119 annual renewal charge</strong>—while still seeing "Acceptable Ads" whitelisted banners. Calculate how much you save by switching to ${PRODUCT_FACTS.name} Pro (£29.99/yr) or the Complete Security Suite (£89.99/yr), or view the full <a href="/vs/total-adblock" class="text-emerald-700 font-semibold underline">SWEEPR Deepblock vs Total Adblock comparison</a>.
    </p>
  </div>

  <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
    <div class="space-y-5">
      <label class="block space-y-2">
        <span class="text-xs font-bold uppercase tracking-wider text-gray-600">Your Current Renewal Charge (£/year)</span>
        <input id="renewalInput" type="range" min="69" max="149" value="99" class="w-full accent-emerald-600 cursor-pointer" />
        <div class="flex justify-between text-xs text-gray-500 font-mono">
          <span>£69/yr</span>
          <span id="renewalCurrentLabel" class="text-rose-700 font-bold text-base">£99/year</span>
          <span>£149/yr</span>
        </div>
      </label>
      <div class="space-y-2 text-xs text-gray-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div class="font-bold text-gray-900">Why Switchers Choose ${PRODUCT_FACTS.name} Pro (v${escapeHtml(MANIFEST_VERSION)}):</div>
        <div>&#10003; <strong>£1.99 First-Month Intro</strong> or <strong>£29.99/yr Fixed Annual Rate (£2.50/mo eq., ${PRODUCT_FACTS.devicesIncluded} Devices)</strong></div>
        <div>&#10003; <strong>£89.99/yr Complete Security Suite</strong> (Deepblock Pro + RAM Tamer + Sweepr VPN + Sweepr Cleaner, ${PRODUCT_FACTS.devicesIncluded} Devices)</div>
        <div>&#10003; <strong>Zero "Acceptable Ads" Whitelists</strong> — we never take money from ad networks</div>
        <div>&#10003; <strong>1-Click Online Cancellation</strong> in your Customer Portal + 14-Day Refund Guarantee</div>
      </div>
    </div>

    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
      <div class="text-xs font-bold uppercase tracking-wider text-emerald-800">Your Projected 3-Year Switcher Savings</div>
      <div id="savingsTotalDisplay" class="text-5xl font-extrabold text-emerald-700 tabular-nums">£207.03</div>
      <div class="text-xs text-gray-600">Saved over 3 years on ${PRODUCT_FACTS.name} Pro Annual (£29.99/yr) vs <span id="compNameSpan">£99/yr</span> renewal</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <a href="/order?plan=annual" rel="nofollow" class="btn btn-go py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm no-underline justify-center">Switch to Pro (£29.99/yr) &rarr;</a>
        <a href="/order?plan=suite_annual" rel="nofollow" class="btn py-3.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-300 no-underline justify-center">Complete Suite (£89.99/yr) &rarr;</a>
      </div>
    </div>
  </section>

  ${renderRelatedGrid({
    heading: 'Compare & Verify Before Switching',
    items: [
      { href: '/vs/total-adblock', badge: 'Comparison', label: 'SWEEPR Deepblock vs Total Adblock' },
      { href: '/pricing', badge: 'Pricing', label: 'Transparent Pro & Suite Plans' },
      { href: '/support', badge: 'Cancellation', label: 'Support & 1-Click Cancellation' },
      { href: '/test-lab', badge: 'Live Diagnostic', label: 'Browser Anti-Detection Test Lab' }
    ]
  })}

  <script>
    const input = document.getElementById('renewalInput');
    const lbl = document.getElementById('renewalCurrentLabel');
    const totalEl = document.getElementById('savingsTotalDisplay');
    const compSpan = document.getElementById('compNameSpan');
    input?.addEventListener('input', () => {
      const val = Number(input.value || 99);
      lbl.textContent = '£' + val + '/year';
      compSpan.textContent = '£' + val + '/yr';
      const saved3Yr = Math.max(0, (val * 3) - (29.99 * 3)).toFixed(2);
      totalEl.textContent = '£' + saved3Yr;
    });
  </script>
`;

const campaign3Html = renderShellPage({
  title: 'AdBlocker Renewal Calculator: Escape £99/yr Fees | SWEEPR',
  description: `Compare £99–£119/yr adblocker renewals against ${PRODUCT_FACTS.name} Pro (£29.99/yr). Zero Acceptable Ads whitelists and 1-click online cancellation.`,
  canonicalUrl: campaign3Canonical,
  currentPath: '/vs/total-adblock',
  lang: 'en',
  htmlLang: 'en-GB',
  robots: 'noindex, follow',
  ogType: 'website',
  jsonLd: campaign3JsonLd,
  contentHtml: campaign3Content
});
fs.writeFileSync(path.join(CAMPAIGNS_DIR, 'renewal-shock-switcher.html'), campaign3Html, 'utf8');

console.log(`Built ${publisherCount} heuristic /site/{domain} profiles + /site hub + Campaign 1 & Campaign 3 pages (Holographic Pearl).`);
