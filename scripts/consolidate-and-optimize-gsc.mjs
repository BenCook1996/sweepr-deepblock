#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — GSC Impressions Drop Reversal (Phases 1, 2 & 3)
 *
 * 1. Consolidates the index from 1,575 Cartesian-product pages down to the ~235
 *    Authoritative Indexable Pillar Pages (100% of the 150 URLs that ever earned
 *    GSC impressions + 8 core pages + flagship setup/vs/guide/solution hubs).
 * 2. Marks the ~1,340 redundant Cartesian permutations as `noindex, follow` and
 *    removes them from `website/sitemap.xml` to lift Google's Scaled Content demotion.
 * 3. Rewires the 8-link internal link mesh across all pages so 100% of internal link
 *    equity flows exclusively into the ~235 Indexable Pillar Pages (0 orphan pages).
 * 4. Executes Exact-Query CTR & Technical Differentiation Surgery on the Top 40
 *    proven GSC pages to match real user search queries (`thorium adblock`,
 *    `how to get no ads on crunchyroll pc`, `why does fandom use so much ram`, etc.).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KEPT_REWRITE_PATHS,
  KEPT_URLS_SET,
  CATEGORY_HUB_PATHS,
  ALL_INDEXABLE_PATHS,
  ALL_INDEXABLE_SET,
  CONSOLIDATE_301_MAP,
  isNoIndexPrunePath,
  resolveConsolidationTarget
} from './lib/m1-decisions.mjs';
import { renderRelatedGrid } from './lib/holographic-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const SITEMAP_CONSOLIDATIONS_PATH = path.join(WEBSITE_DIR, 'sitemap-consolidations.xml');
const CONSOLIDATION_SITEMAP_EXPIRES_AT = '2026-12-16T00:00:00Z';

// 1. All 150 URLs that ever earned impressions in Google Search Console (Oct 19 - Nov 2, 2026)
const GSC_PROVEN_PATHS = [
  '/',
  '/download',
  '/pricing',
  '/refund',
  '/support',
  '/terms',
  '/privacy',
  '/test-lab',
  '/setup/thorium-chromium-browser',
  '/solutions/geeksforgeeks-dev-portals-block-video-ads',
  '/setup/brave-macos-apple-silicon',
  '/setup/orion-browser-macos-ios',
  '/solutions/crunchyroll-anime-streams-block-video-ads',
  '/setup/floorp-browser-firefox-fork',
  '/setup/arc-browser-windows-mac',
  '/setup/zen-browser-privacy-tabs',
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '/setup/kiwi-browser-android',
  '/solutions/roblox-web-community-filter-ai-slop-and-scams',
  '/solutions/webtoon-manhwa-readers-block-video-ads',
  '/solutions/fandom-game-wikis-block-video-ads',
  '/solutions/fandom-game-wikis-auto-reject-cookie-popups',
  '/setup/ungoogled-chromium-mv3',
  '/solutions/soundcloud-audio-player-reduce-browser-ram-usage',
  '/solutions/fandom-game-wikis-stop-malvertising-popunders',
  '/solutions/dex-token-screeners-block-video-ads',
  '/solutions/geeksforgeeks-dev-portals-stop-malvertising-popunders',
  '/solutions/soundcloud-audio-player-block-video-ads',
  '/solutions/linkedin-feed-ads-block-video-ads',
  '/guides/how-to-automatically-reject-cookie-banners-uk',
  '/solutions/substack-newsletter-blogs-auto-reject-cookie-popups',
  '/solutions/crunchyroll-anime-streams-reduce-browser-ram-usage',
  '/setup/librewolf-hardened-firefox',
  '/solutions/reddit-promoted-posts-auto-reject-cookie-popups',
  '/solutions/rumble-video-streams-block-video-ads',
  '/solutions/espn-sports-streaming-stop-malvertising-popunders',
  '/guides/how-to-block-twitch-midroll-commercials-without-black-screen',
  '/solutions/linkedin-feed-ads-auto-reject-cookie-popups',
  '/guides/how-to-stop-temu-shein-scam-popups-and-tracking',
  '/solutions/kick-streaming-portals-reduce-browser-ram-usage',
  '/solutions/bilibili-anime-video-stop-malvertising-popunders',
  '/vs/avast-secure-browser-guard',
  '/solutions/manga-comic-readers-block-video-ads',
  '/solutions/manga-comic-readers-stop-malvertising-popunders',
  '/solutions/etsy-marketplace-shops-stop-malvertising-popunders',
  '/guides/how-to-block-sponsored-posts-and-crypto-bots-on-x-twitter',
  '/solutions/smart-tv-web-browsers-auto-reject-cookie-popups',
  '/solutions/manga-comic-readers-auto-reject-cookie-popups',
  '/solutions/temu-aliexpress-shopping-filter-ai-slop-and-scams',
  '/solutions/espn-sports-streaming-block-video-ads',
  '/solutions/fextralife-game-wikis-stop-malvertising-popunders',
  '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock',
  '/solutions/github-copilot-dev-portals-block-video-ads',
  '/solutions/etsy-marketplace-shops-filter-ai-slop-and-scams',
  '/solutions/github-copilot-dev-portals-reduce-browser-ram-usage',
  '/solutions/spotify-web-player-reduce-browser-ram-usage',
  '/solutions/tumblr-blog-feeds-stop-malvertising-popunders',
  '/solutions/tumblr-blog-feeds-block-video-ads',
  '/solutions/cnn-news-network-auto-reject-cookie-popups',
  '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed',
  '/solutions/soundcloud-audio-player-stop-malvertising-popunders',
  '/solutions/tech-gadget-review-blogs-auto-reject-cookie-popups',
  '/solutions/recipe-food-blogs-reduce-browser-ram-usage',
  '/solutions/crunchyroll-anime-streams-auto-reject-cookie-popups',
  '/solutions/free-file-host-downloads-auto-reject-cookie-popups',
  '/solutions/uk-news-websites-auto-reject-cookie-popups',
  '/solutions/imdb-movie-database-filter-ai-slop-and-scams',
  '/solutions/tiktok-web-reels-reduce-browser-ram-usage',
  '/vs/total-adblock',
  '/solutions/webtoon-manhwa-readers-filter-ai-slop-and-scams',
  '/solutions/flight-tracker-radars-stop-malvertising-popunders',
  '/solutions/pinterest-promoted-pins-reduce-browser-ram-usage',
  '/solutions/ign-gaming-reviews-stop-malvertising-popunders',
  '/solutions/imdb-movie-database-block-video-ads',
  '/solutions/roblox-web-community-auto-reject-cookie-popups',
  '/setup/chromium-linux-ubuntu',
  '/setup/vivaldi-power-user-browser',
  '/solutions/reddit-promoted-posts-filter-ai-slop-and-scams',
  '/solutions/fandom-game-wikis-filter-ai-slop-and-scams',
  '/solutions/github-copilot-dev-portals-stop-malvertising-popunders',
  '/solutions/the-guardian-news-block-video-ads',
  '/solutions/online-chess-gaming-filter-ai-slop-and-scams',
  '/solutions/anime-streaming-portals-stop-malvertising-popunders',
  '/solutions/bilibili-anime-video-block-video-ads',
  '/setup/raspberry-pi-chromium',
  '/solutions/threads-web-feed-stop-malvertising-popunders',
  '/solutions/recipe-food-blogs-auto-reject-cookie-popups',
  '/solutions/tumblr-blog-feeds-auto-reject-cookie-popups',
  '/solutions/recipe-food-blogs-stop-malvertising-popunders',
  '/solutions/crunchyroll-anime-streams-strip-tracking-parameters',
  '/solutions/automotive-car-classifieds-block-video-ads',
  '/solutions/medium-tech-blogs-auto-reject-cookie-popups',
  '/solutions/facebook-marketplace-shops-auto-reject-cookie-popups',
  '/solutions/forbes-business-media-filter-ai-slop-and-scams',
  '/solutions/imdb-movie-database-strip-tracking-parameters',
  '/solutions/webtoon-manhwa-readers-auto-reject-cookie-popups',
  '/solutions/ign-gaming-reviews-reduce-browser-ram-usage',
  '/vs/windscribe-robert-adblock',
  '/solutions/anime-streaming-portals-reduce-browser-ram-usage',
  '/solutions/fextralife-game-wikis-strip-tracking-parameters',
  '/solutions/twitch-live-streams-auto-reject-cookie-popups',
  '/guides/how-to-stop-fake-robot-captcha-verification-popups',
  '/setup/cachyos-arch-chromium',
  '/setup/ladybird-browser-privacy',
  '/solutions/anime-streaming-portals-auto-reject-cookie-popups',
  '/solutions/online-chess-gaming-strip-tracking-parameters',
  '/solutions/rapidgator-file-downloads-block-video-ads',
  '/solutions/speedtest-network-tools-stop-malvertising-popunders',
  '/setup/mullvad-browser-privacy',
  '/solutions/cnn-news-network-strip-tracking-parameters',
  '/solutions/reddit-promoted-posts-strip-tracking-parameters',
  '/solutions/rumble-video-streams-filter-ai-slop-and-scams',
  '/vs/adblock-plus',
  '/guides/how-to-bypass-anti-adblock-inspect-element-blockers',
  '/solutions/lyrics-and-chords-tabs-filter-ai-slop-and-scams',
  '/solutions/pinterest-promoted-pins-auto-reject-cookie-popups',
  '/solutions/twitch-live-streams-stop-malvertising-popunders',
  '/guides/best-manifest-v3-adblockers-for-google-chrome-2026',
  '/setup/waterfox-privacy-browser',
  '/solutions/f1-motorsport-news-block-video-ads',
  '/solutions/flight-tracker-radars-auto-reject-cookie-popups',
  '/solutions/online-chess-gaming-block-video-ads',
  '/solutions/x-twitter-feed-ads-block-video-ads',
  '/solutions/x-twitter-feed-ads-strip-tracking-parameters',
  '/solutions/bing-copilot-search-reduce-browser-ram-usage',
  '/solutions/linkedin-feed-ads-reduce-browser-ram-usage',
  '/solutions/lyrics-and-chords-tabs-block-video-ads',
  '/solutions/quora-digest-answers-stop-malvertising-popunders',
  '/solutions/rumble-video-streams-stop-malvertising-popunders',
  '/solutions/smart-tv-web-browsers-filter-ai-slop-and-scams',
  '/solutions/soundcloud-audio-player-filter-ai-slop-and-scams',
  '/solutions/sports-live-score-sites-stop-malvertising-popunders',
  '/solutions/spotify-web-player-stop-malvertising-popunders',
  '/solutions/student-study-hubs-block-video-ads',
  '/solutions/substack-newsletter-blogs-filter-ai-slop-and-scams',
  '/solutions/tiktok-web-reels-auto-reject-cookie-popups',
  '/solutions/tumblr-blog-feeds-reduce-browser-ram-usage',
  '/solutions/coursera-edx-learning-reduce-browser-ram-usage',
  '/solutions/google-search-results-filter-ai-slop-and-scams',
  '/solutions/tumblr-blog-feeds-filter-ai-slop-and-scams',
  '/solutions/dailymotion-vimeo-embeds-block-video-ads',
  '/solutions/smart-tv-web-browsers-block-video-ads',
  '/setup/opera-gx-gaming-browser',
  '/solutions/cnn-news-network-reduce-browser-ram-usage',
  '/guides/how-to-block-tab-freeze-crypto-miner-scripts',
  '/solutions/automotive-car-classifieds-reduce-browser-ram-usage',
  '/solutions/automotive-car-classifieds-strip-tracking-parameters',
  '/solutions/crypto-exchange-news-sites-auto-reject-cookie-popups',
  '/guides/how-to-hide-ai-slop-from-google-search',
  '/solutions/tech-gadget-review-blogs-filter-ai-slop-and-scams',
  '/guides/how-to-block-unskippable-audio-ads-on-spotify-web',
  '/solutions/weather-radar-portals-auto-reject-cookie-popups',
  // Newly proven active GSC pages (Nov 1 - Nov 9, 2026 update)
  '/solutions/1337x-torrent-indexer-block-video-ads',
  '/solutions/soundgasm-audio-streaming-stop-malvertising-popunders',
  '/solutions/strava-fitness-activity-stop-malvertising-popunders',
  '/solutions/nyaa-si-anime-torrents-strip-tracking-parameters',
  '/solutions/wattpad-web-novels-stop-malvertising-popunders',
  '/solutions/pinterest-promoted-pins-filter-ai-slop-and-scams',
  '/solutions/kick-streaming-portals-block-video-ads',
  '/vs/adblock-luna-vpn',
  '/guides/how-to-block-twitch-embedded-stream-ads-external',
  '/guides/how-to-fix-high-ram-usage-on-vivaldi-browser'
];

// 2. Strategic Flagship Pillar Pages (strictly M1 kept + 4 category hubs)
const STRATEGIC_PILLAR_PATHS = [
  ...CATEGORY_HUB_PATHS,
  '/setup/google-chrome-manifest-v3',
  '/setup/mozilla-firefox-desktop-android',
  '/setup/microsoft-edge-windows-11',
  '/setup/chromium-linux-ubuntu',
  '/setup/floorp-browser-firefox-fork',
  '/setup/zen-browser-privacy-tabs',
  '/setup/librewolf-hardened-firefox',
  '/setup/vivaldi-power-user-browser',
  '/setup/waterfox-privacy-browser',
  '/solutions/crunchyroll-anime-streams-block-video-ads',
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '/solutions/imdb-movie-database-block-video-ads',
  '/solutions/anilist-myanimelist-tracker-block-video-ads',
  '/solutions/nexus-mods-community-stop-malvertising-popunders',
  '/solutions/curseforge-gaming-mods-stop-malvertising-popunders',
  '/solutions/coinmarketcap-crypto-prices-stop-malvertising-popunders',
  '/solutions/tradingview-charts-web-reduce-browser-ram-usage',
  '/vs/total-adblock',
  '/vs/ublock-origin-lite',
  '/vs/adguard-extension',
  '/vs/ghostery-privacy-ad-blocker',
  '/vs/pie-adblock',
  '/vs/brave-shields',
  '/vs/adblock-plus',
  '/vs/windscribe-robert-adblock',
  '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026',
  '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '/guides/strip-utm-fbclid-gclid-tracking-links'
].filter((p) => ALL_INDEXABLE_SET.has(p));

// Also automatically include any Pillar URL referenced in website/llms.txt so llms.txt & indexable pages stay 100% synced
const llmsReferencedPaths = [];
const llmsPath = path.join(WEBSITE_DIR, 'llms.txt');
if (fs.existsSync(llmsPath)) {
  const llmsRaw = fs.readFileSync(llmsPath, 'utf8');
  const matches = llmsRaw.matchAll(/https:\/\/sweeprdeepblock\.com(\/[a-z0-9/-]+)/gi);
  for (const m of matches) {
    if (/^\/(solutions|setup|vs|guides)\//i.test(m[1])) {
      llmsReferencedPaths.push(m[1]);
    }
  }
}

const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
let enrichmentState = { titleUpdatedAt: {}, customQuerySurgery: {}, discoveredGscPaths: [], gscRecoveryHistory: [] };
if (fs.existsSync(ENRICHMENT_STATE_PATH)) {
  try {
    enrichmentState = { ...enrichmentState, ...JSON.parse(fs.readFileSync(ENRICHMENT_STATE_PATH, 'utf8')) };
  } catch {}
}

// Preserve all existing indexable Pillar URLs from website/sitemap.xml and data/keyword-opportunity-matrix.json
const existingSitemapPillarPaths = [];
if (fs.existsSync(SITEMAP_PATH)) {
  try {
    const smRaw = fs.readFileSync(SITEMAP_PATH, 'utf8');
    for (const m of smRaw.matchAll(/<loc>https:\/\/sweeprdeepblock\.com(\/[a-z0-9/-]*)<\/loc>/gi)) {
      const p = m[1] || '/';
      if (p === '/' || /^\/(solutions|setup|vs|guides)\//i.test(p)) {
        existingSitemapPillarPaths.push(p);
      }
    }
  } catch {}
}

const keywordMatrixPaths = [];
const kwMatrixPath = path.join(ROOT_DIR, 'data', 'keyword-opportunity-matrix.json');
if (fs.existsSync(kwMatrixPath)) {
  try {
    const kwMatrix = JSON.parse(fs.readFileSync(kwMatrixPath, 'utf8'));
    if (Array.isArray(kwMatrix.opportunities)) {
      for (const opp of kwMatrix.opportunities) {
        const route = opp.targetRoute || opp.recommendedUrlPath;
        if (opp.isPublishedOnDisk && route) {
          keywordMatrixPaths.push(route);
        }
      }
    }
  } catch {}
}

const RAW_PILLAR_PATHS = [
  ...KEPT_REWRITE_PATHS,
  ...CATEGORY_HUB_PATHS,
  ...GSC_PROVEN_PATHS,
  ...STRATEGIC_PILLAR_PATHS,
  ...llmsReferencedPaths,
  ...existingSitemapPillarPaths,
  ...keywordMatrixPaths,
  ...(Array.isArray(enrichmentState.discoveredGscPaths) ? enrichmentState.discoveredGscPaths : [])
].filter((p) => !isNoIndexPrunePath(p) && !CONSOLIDATE_301_MAP.has(p) && ALL_INDEXABLE_SET.has(p));

// 3. Exact-Query CTR & Technical Differentiation Overrides for Kept M1 Pillar Pages
const EXACT_QUERY_SURGERY = {
  '/setup/thorium-chromium-browser': {
    title: 'Thorium AdBlock (2026): Best Ad Blocker for Thorium Browser',
    desc: 'Looking for Thorium AdBlock? Install SWEEPR Deepblock v1.4.0 on Thorium Browser (AVX2) to block YouTube pre-roll ads, popunders, and cookie banners.',
    h1: 'Thorium AdBlock (2026): Best MV3 Ad Blocker for Thorium Browser (AVX2)',
    lead: 'Searching for the best Thorium AdBlock setup? Pair Thorium Fast Chromium Browser (AVX2/SSE4) on Windows and Linux with SWEEPR Deepblock v1.4.0 for anti-detection YouTube ad blocking, automatic cookie pop-up rejection, and tab RAM hibernation.'
  },
  '/setup/orion-browser-macos-ios': {
    title: 'Orion Browser Ad Blocker (macOS): Block YouTube Ads',
    desc: 'Need an Orion browser ad blocker on macOS? SWEEPR Deepblock v1.4.0 supports Chrome & Firefox extensions on Orion macOS for video ads and cookie banners.',
    h1: 'Orion Browser Ad Blocker (macOS): 2026 Setup & WebExtension Guide',
    lead: 'Orion Browser on macOS supports Chrome and Firefox WebExtensions alongside built-in filtering. Adding SWEEPR Deepblock v1.4.0 gives Orion macOS video ad blocking and automatic GDPR cookie rejection.'
  },
  '/setup/floorp-browser-firefox-fork': {
    title: 'Floorp AdBlock (2026): Best Ad Blocker for Floorp Browser',
    desc: 'Set up Floorp AdBlock in 30 seconds. SWEEPR Deepblock v1.4.0 adds anti-detection YouTube ad blocking, cookie auto-rejection, and tab RAM hibernation.',
    h1: 'Floorp AdBlock Setup (2026): Best Ad & Tracker Blocker for Floorp Browser',
    lead: 'Upgrade Floorp Browser (Firefox-based workspaces & vertical tabs) with SWEEPR Deepblock v1.4.0. Block unskippable YouTube and Crunchyroll video commercials, auto-decline GDPR cookie walls, and hibernate background workspace tabs.'
  },
  '/setup/arc-browser-windows-mac': {
    title: 'Arc Browser Ad Blocker (2026): Best Arc AdBlocker (Win & Mac)',
    desc: 'Install the best Arc browser ad blocker for Windows 11 and macOS. Block YouTube mid-roll ads, auto-reject cookie banners, and tame Arc tab RAM.',
    h1: 'Arc Browser Ad Blocker (Windows & Mac): Best Arc AdBlocker Setup (2026)',
    lead: 'Looking for an Arc browser ad blocker that also fixes Arc high memory usage? SWEEPR Deepblock v1.4.0 installs in 30 seconds on Arc for Windows 11 and macOS, blocking YouTube pre-roll ads, auto-rejecting cookie pop-ups, and hibernating inactive tabs.'
  },
  '/setup/zen-browser-privacy-tabs': {
    title: 'Zen Browser Ad Blocker (2026): Block YouTube Ads & Tame RAM',
    desc: 'Upgrade Zen Browser with SWEEPR Deepblock v1.4.0: anti-detection YouTube ad blocking, automatic cookie pop-up rejection, and URL tracker stripping.',
    h1: 'Zen Browser Ad Blocker (2026): Zero-Lag YouTube Blocking & Tab RAM Tamer',
    lead: 'Zen Browser delivers a clean Firefox-based vertical tab experience. Pairing Zen Browser with SWEEPR Deepblock v1.4.0 adds anti-detection video ad blocking on YouTube and Twitch, automatic cookie banner rejection, and Total Tab & RAM Tamer.'
  },
  '/setup/kiwi-browser-android': {
    title: 'Kiwi Browser Archived: Android AdBlock Migration Guide (2026)',
    desc: 'Kiwi Browser was archived in January 2025. Migrate to Mozilla Firefox for Android or Edge Android with SWEEPR Deepblock v1.4.0 for MV3 ad & cookie blocking.',
    h1: 'Kiwi Browser Archived (Jan 2025): Recommended Android Ad Blocker Setup',
    lead: 'Kiwi Browser was archived in January 2025 and no longer receives Chromium security updates. Install SWEEPR Deepblock v1.4.0 on Mozilla Firefox for Android (.xpi) or Microsoft Edge Android to block mobile video ads, pop-unders, and GDPR cookie walls.'
  },
  '/setup/ungoogled-chromium-mv3': {
    title: 'Ungoogled Chromium Ad Blocker (MV3): Setup Without Web Store',
    desc: 'Install SWEEPR Deepblock v1.4.0 on Ungoogled Chromium (MV3) without Google sync. Block YouTube video ads, trackers, and cookie walls.',
    h1: 'Ungoogled Chromium MV3 Ad Blocker (2026): Direct Setup & Anti-Detection Guide',
    lead: 'Running Ungoogled Chromium on Linux, Windows, or macOS? Load SWEEPR Deepblock v1.4.0 directly without a Google account to enforce anti-detection video ad blocking, URL tracker stripping, and cookie wall rejection.'
  },
  '/setup/brave-macos-apple-silicon': {
    title: 'Brave Mac Ad Blocker (Apple Silicon M1–M4): Stop YouTube Lag',
    desc: 'Boost Brave Browser on macOS Apple Silicon (M1–M4) with SWEEPR Deepblock v1.4.0: auto-reject GDPR cookie walls, strip URL trackers, and hibernate tabs.',
    h1: 'Brave Browser on Mac (Apple Silicon M1/M2/M3/M4): SWEEPR Deepblock Setup',
    lead: 'Even with Brave Shields enabled on macOS, GDPR cookie consent banners and YouTube anti-adblock prompts can still interrupt browsing. Add SWEEPR Deepblock v1.4.0 on Apple Silicon Macs for automated cookie auto-rejection, URL tracker stripping, and Total Tab & RAM Tamer.'
  },
  '/setup/librewolf-hardened-firefox': {
    title: 'LibreWolf Ad Blocker (2026): Hardened Privacy & RAM Tamer',
    desc: 'Configure SWEEPR Deepblock v1.4.0 on LibreWolf Hardened Firefox. Add automatic cookie banner rejection, Element Zapper, and tab RAM hibernation.',
    h1: 'LibreWolf Ad Blocker Setup (2026): Hardened Anti-Detection & Cookie Auto-Reject',
    lead: 'LibreWolf clears cookies on exit, causing websites to bombard you with repeated GDPR cookie walls on every visit. SWEEPR Deepblock v1.4.0 automatically clicks Reject All while blocking video ads and stripping URL trackers.'
  },
  '/solutions/crunchyroll-anime-streams-block-video-ads': {
    title: 'How to Get No Ads on Crunchyroll PC (Best Crunchyroll AdBlock)',
    desc: 'Learn how to get no ads on Crunchyroll PC in 2026. Block unskippable Crunchyroll pre-roll and mid-roll video commercials without black screens.',
    h1: 'How to Get No Ads on Crunchyroll PC (2026 Best AdBlocker for Crunchyroll)',
    lead: 'Tired of unskippable commercials when watching anime on Crunchyroll on PC? Discover how SWEEPR Deepblock v1.4.0 neutralizes Crunchyroll VAST/VMAP pre-roll and mid-roll video ad pods in Chrome, Firefox, Edge, and Brave without black-screen freezes.'
  },
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage': {
    title: 'Why Does Fandom Use So Much RAM? Fix Fandom Memory & Video Ads',
    desc: 'Why does Fandom use so much memory and RAM? Fandom loads autoplay videos and dozens of ad auction scripts. Block Fandom bloat with SWEEPR Deepblock v1.4.0.',
    h1: 'Why Does Fandom Use So Much Memory & RAM? (Fix Fandom Wiki Lag in 2026)',
    lead: 'Wondering why Fandom uses so much memory when you open a few gaming wiki tabs? A single Fandom page executes dozens of real-time ad bidding scripts and sticky autoplay video players. SWEEPR Deepblock v1.4.0 blocks those scripts before execution and hibernates inactive wiki tabs.'
  },
  '/solutions/webtoon-manhwa-readers-block-video-ads': {
    title: 'Webtoon Ad Blocker (2026): Block Popunders, Banners & Video Ads',
    desc: 'Webtoon ad blocker for desktop and Firefox Android. Stop full-screen manhwa redirect popunders, sticky banners, and video ads automatically.',
    h1: 'Webtoon Ad Blocker (2026): Stop Manhwa Redirect Pop-Unders & Sticky Banners',
    lead: 'Reading Webtoons or manhwa online shouldn’t trigger full-screen tab redirects or sticky banners that block vertical scrolling. SWEEPR Deepblock v1.4.0 intercepts click-jacking pop-under scripts and banner overlays cleanly.'
  },
  '/solutions/manga-comic-readers-block-video-ads': {
    title: 'How to Block Ads on Manga Sites (2026 Manga Reader AdBlocker)',
    desc: 'Learn how to block ads on manga sites without breaking chapter images. Stop click-jacking redirects, pop-unders, and sticky banners.',
    h1: 'How to Block Ads on Manga Sites (Stop Pop-Unders & Redirects on Manga Readers)',
    lead: 'Searching for how to block ads on manga sites without breaking chapter image loaders? SWEEPR Deepblock v1.4.0 neutralizes deceptive overlay click-traps, new-tab pop-unders, and floating banners across manga and comic readers.'
  },
  '/solutions/linkedin-feed-ads-block-video-ads': {
    title: 'LinkedIn Ad Blocker Chrome Extension: Block Promoted Feed Ads',
    desc: 'Need a Chrome extension that stops LinkedIn ads? Hide promoted posts, sponsored video ads, and tracking beacons in your LinkedIn feed.',
    h1: 'LinkedIn Ad Blocker Extension for Chrome & Firefox: Hide Promoted Feed Ads',
    lead: 'Looking for a Chrome extension that stops LinkedIn ads and promoted posts from cluttering your professional feed? SWEEPR Deepblock v1.4.0 hides Promoted feed cards, autoplay video ads, and strips outbound tracking parameters.'
  },
  '/solutions/soundcloud-audio-player-block-video-ads': {
    title: 'SoundCloud Ad Blocker Extension: How to Block SoundCloud Ads',
    desc: 'Learn how to block ads on SoundCloud Web Player. Silence between-track audio commercials and banner clutter with SWEEPR Deepblock v1.4.0.',
    h1: 'SoundCloud Ad Blocker Extension (2026): How to Block Audio Ads on SoundCloud',
    lead: 'Want to know how to block ads on SoundCloud without interruptions between tracks? SWEEPR Deepblock v1.4.0 intercepts third-party audio ad streams, visual takeover banners, and telemetry beacons.'
  },
  '/solutions/dex-token-screeners-block-video-ads': {
    title: 'DEXScreener Ad Blocker: Block Token Banners & Malvertising Ads',
    desc: 'Block intrusive DEXScreener ads and high-CPU banner clutter while keeping live crypto charts fast with SWEEPR Deepblock v1.4.0.',
    h1: 'DEXScreener Ad Blocker (2026): Stop Intrusive Banners & Chart Lag',
    lead: 'Trading on DEXScreener or token price trackers exposes your browser to high-CPU banner ads and malvertising pop-ups. SWEEPR Deepblock v1.4.0 strips DEXScreener ad slots and blocks cryptominer scripts natively.'
  },
  '/solutions/geeksforgeeks-dev-portals-block-video-ads': {
    title: 'GeeksforGeeks Ad Blocker: Stop Login Popups & Video Banners',
    desc: 'Block intrusive GeeksforGeeks video ads, sticky course banners, and overlay clutter while reading coding tutorials with SWEEPR Deepblock v1.4.0.',
    h1: 'GeeksforGeeks Ad Blocker (2026): Remove Floating Videos & Overlay Clutter',
    lead: 'Reading algorithms and coding articles on GeeksforGeeks shouldn’t mean fighting floating video players and expanding header banners. SWEEPR Deepblock v1.4.0 cleans developer documentation portals automatically.'
  },
  '/solutions/roblox-web-community-filter-ai-slop-and-scams': {
    title: 'Roblox Web Ad & Pop-Up Blocker: Clean Wikis & Community Sites',
    desc: 'Clean up Roblox community wikis and accessory portals with SWEEPR Deepblock v1.4.0. Block banner ads, pop-under redirects, and tracking beacons.',
    h1: 'Roblox Web Community Ad & Pop-Up Blocker (2026 Guide)',
    lead: 'Roblox community wikis, value lists, and accessory portals are overloaded with intrusive display banners and pop-under redirects. SWEEPR Deepblock v1.4.0 blocks third-party ad networks and strips tracking links.'
  },
  '/solutions/rumble-video-streams-block-video-ads': {
    title: 'Rumble Ad Blocker (2026): Block Pre-Roll & Mid-Roll Video Ads',
    desc: 'Block unskippable pre-roll and mid-roll commercials on Rumble video streams. SWEEPR Deepblock v1.4.0 stops Rumble ads cleanly.',
    h1: 'Rumble Ad Blocker (2026): Block Pre-Roll & Livestream Ads Without Playback Lag',
    lead: 'Watching videos or livestreams on Rumble? SWEEPR Deepblock v1.4.0 intercepts Rumble’s VAST pre-roll ad requests and collapses sidebar display banners so videos start immediately.'
  },
  '/solutions/tumblr-blog-feeds-block-video-ads': {
    title: 'Tumblr Ad Blocker (2026): Hide Sponsored Posts & Video Ads',
    desc: 'Clean up your Tumblr dashboard with SWEEPR Deepblock v1.4.0. Block Tumblr sponsored posts, Blaze promotions, and autoplay video ads.',
    h1: 'Tumblr Ad Blocker: Hide Dashboard Sponsored Posts & Autoplay Video Ads',
    lead: 'Stop sponsored posts, Blaze promotions, and sticky video widgets from interrupting your Tumblr dashboard. SWEEPR Deepblock v1.4.0 hides Tumblr feed ads and strips outbound tracking parameters.'
  },
  '/guides/how-to-automatically-reject-cookie-banners-uk': {
    title: 'Automatically Reject Cookies (2026): Auto-Decline Popups',
    desc: 'Automatically reject cookies across UK, EU, and US websites without breaking page scroll. SWEEPR Deepblock v1.4.0 clicks Reject All on OneTrust & 160 CMPs.',
    h1: 'How to Automatically Reject Cookies & GDPR Pop-Ups Without Scroll Lock (2026)',
    lead: 'Tired of clicking "Manage Preferences" and "Reject All" on every website you visit? SWEEPR Deepblock v1.4.0 automatically rejects non-essential cookies across OneTrust, Quantcast, Didomi, Cookiebot, TrustArc, and 160 CMP frameworks without breaking page scroll.'
  },
  '/guides/how-to-block-twitch-midroll-commercials-without-black-screen': {
    title: 'Blocking Mid-Roll Ads on Twitch & YouTube Without Black Screen',
    desc: 'Master blocking mid-roll ads on Twitch and YouTube in 2026 without black screens or purple playback errors using SWEEPR Deepblock v1.4.0.',
    h1: 'Blocking Mid-Roll Ads on Twitch & YouTube Without Black Screens (2026 Guide)',
    lead: 'Legacy ad blockers frequently trigger black screens, infinite buffering spinners, or Twitch’s purple error screen when blocking mid-roll ads. Learn how SWEEPR Deepblock v1.4.0 neutralizes mid-roll video commercials cleanly.'
  },
  '/guides/how-to-block-sponsored-posts-and-crypto-bots-on-x-twitter': {
    title: 'How to Stop Spam Ads on Twitter / X (Block Promoted Tweets)',
    desc: 'Learn how to stop spam ads on Twitter (X) in 2026. Automatically hide promoted tweets, crypto scam replies, and tracking pixels.',
    h1: 'How to Stop Spam Ads on Twitter / X (Block Promoted Posts & Crypto Scam Bots)',
    lead: 'Searching for how to stop spam ads on Twitter (X)? SWEEPR Deepblock v1.4.0 strips disguised "Ad" and "Promoted" posts from your timeline while blocking known malvertising links.'
  },
  '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed': {
    title: 'Reddit Promoted Ad Blocker: Hide Sponsored Posts in Feed (2026)',
    desc: 'Looking for a Reddit promoted ad blocker? Automatically hide disguised "Promoted" posts in feeds and comment threads on Reddit Web.',
    h1: 'Reddit Promoted Ad Blocker: How to Hide Sponsored Posts in Feeds & Comments',
    lead: 'Reddit disguises promoted advertisements as genuine user posts and top comments. SWEEPR Deepblock v1.4.0 hides `<shreddit-ad-post>` and promoted comment units before they clutter your screen.'
  },
  '/vs/total-adblock': {
    title: 'SWEEPR Deepblock vs Total Adblock (2026 Pricing & Test Lab)',
    desc: 'Compare SWEEPR Deepblock vs Total Adblock in 2026: YouTube MV3 anti-detection, GDPR cookie auto-rejection, and transparent £29.99/yr Pro pricing.',
    h1: 'SWEEPR Deepblock vs Total Adblock: 2026 Feature, Renewal Pricing & Speed Audit'
  }
};

const PROBLEM_SUFFIXES = [
  '-block-video-ads',
  '-auto-reject-cookie-popups',
  '-filter-ai-slop-and-scams',
  '-protect-checkout-fake-shop-shield',
  '-remove-page-clutter-and-ram-bloat',
  '-reduce-browser-ram-usage',
  '-stop-malvertising-popunders',
  '-strip-tracking-parameters',
  '-bypass-anti-adblock-walls',
  '-stop-autoplay-floating-videos',
  '-stop-notification-permission-spam',
  '-encrypted-dns-doh-protection',
  '-block-crypto-miners-cpu-drain',
  '-block-sponsored-feed-carousels',
  '-clean-reader-distraction-free',
  '-hibernate-idle-background-tabs',
  '-prevent-canvas-webrtc-fingerprinting'
];

const PLATFORM_PREFIX_ALIASES = {
  'fandom-game-lore-wikis': 'fandom-game-wikis',
  'kick-gambling-livestreams': 'kick-streaming-portals'
};

// Preferred canonical Pillar when collapsing multiple Cartesian problem variants on the same platform (M1 KEPT_REWRITE targets only)
const PRIMARY_PLATFORM_PILLAR_OVERRIDES = {
  'fandom-game-wikis': '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  'crunchyroll-anime-streams': '/solutions/crunchyroll-anime-streams-block-video-ads',
  'tumblr-blog-feeds': '/solutions/tumblr-blog-feeds-block-video-ads',
  'soundcloud-audio-player': '/solutions/soundcloud-audio-player-block-video-ads',
  'reddit-promoted-posts': '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed',
  'twitch-live-streams': '/guides/how-to-block-twitch-midroll-commercials-without-black-screen',
  'youtube-chrome-mv3': '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock',
  'linkedin-feed-ads': '/solutions/linkedin-feed-ads-block-video-ads',
  'webtoon-manhwa-readers': '/solutions/webtoon-manhwa-readers-block-video-ads',
  'manga-comic-readers': '/solutions/manga-comic-readers-block-video-ads',
  'rumble-video-streams': '/solutions/rumble-video-streams-block-video-ads',
  'geeksforgeeks-dev-portals': '/solutions/geeksforgeeks-dev-portals-block-video-ads',
  'roblox-web-community': '/solutions/roblox-web-community-filter-ai-slop-and-scams',
  'facebook-marketplace-shops': '/guides/how-to-stop-facebook-meta-pixel-tracking',
  'x-twitter-feed-ads': '/solutions/x-twitter-feed-ads-block-video-ads'
};

function extractSolutionPlatformPrefix(urlPath) {
  if (!/^\/solutions\//i.test(urlPath)) return null;
  const slug = urlPath.replace(/^\/solutions\//, '');
  for (const suf of PROBLEM_SUFFIXES) {
    if (slug.endsWith(suf)) {
      const rawPrefix = slug.slice(0, -suf.length);
      return PLATFORM_PREFIX_ALIASES[rawPrefix] || rawPrefix;
    }
  }
  return null;
}

const rawPillarSet = new Set(RAW_PILLAR_PATHS);
const keywordMatrixPathSet = new Set(keywordMatrixPaths);
const gscProvenRank = new Map(GSC_PROVEN_PATHS.map((p, idx) => [p, idx]));
const strategicRank = new Map(STRATEGIC_PILLAR_PATHS.map((p, idx) => [p, idx]));

const solutionGroupsByPlatform = new Map();
for (const p of rawPillarSet) {
  if (!/^\/solutions\//i.test(p) || keywordMatrixPathSet.has(p)) continue;
  const platPrefix = extractSolutionPlatformPrefix(p);
  if (!platPrefix) continue;
  if (!solutionGroupsByPlatform.has(platPrefix)) {
    solutionGroupsByPlatform.set(platPrefix, []);
  }
  solutionGroupsByPlatform.get(platPrefix).push(p);
}

const collapsedSiblings = new Set();
const collapsedSiblingToWinner = new Map();
for (const [platPrefix, candidates] of solutionGroupsByPlatform.entries()) {
  if (candidates.length <= 1) continue;
  const override = PRIMARY_PLATFORM_PILLAR_OVERRIDES[platPrefix];
  let winner = override && candidates.includes(override) ? override : null;
  if (!winner) {
    const sorted = [...candidates].sort((a, b) => {
      const aSurg = EXACT_QUERY_SURGERY[a] ? 0 : 1;
      const bSurg = EXACT_QUERY_SURGERY[b] ? 0 : 1;
      if (aSurg !== bSurg) return aSurg - bSurg;
      const aStrat = strategicRank.has(a) ? strategicRank.get(a) : 99999;
      const bStrat = strategicRank.has(b) ? strategicRank.get(b) : 99999;
      if (aStrat !== bStrat) return aStrat - bStrat;
      const aGsc = gscProvenRank.has(a) ? gscProvenRank.get(a) : 99999;
      const bGsc = gscProvenRank.has(b) ? gscProvenRank.get(b) : 99999;
      if (aGsc !== bGsc) return aGsc - bGsc;
      return a.localeCompare(b);
    });
    winner = sorted[0];
  }
  for (const cand of candidates) {
    if (cand !== winner) {
      collapsedSiblings.add(cand);
      collapsedSiblingToWinner.set(cand, winner);
    }
  }
}

const PILLAR_SET = new Set([...rawPillarSet].filter((p) => !collapsedSiblings.has(p)));

if (collapsedSiblings.size > 0 && Array.isArray(enrichmentState.discoveredGscPaths)) {
  const beforeLen = enrichmentState.discoveredGscPaths.length;
  enrichmentState.discoveredGscPaths = enrichmentState.discoveredGscPaths.filter((p) => !collapsedSiblings.has(p));
  if (enrichmentState.discoveredGscPaths.length !== beforeLen && fs.existsSync(ENRICHMENT_STATE_PATH)) {
    fs.writeFileSync(ENRICHMENT_STATE_PATH, JSON.stringify(enrichmentState, null, 2), 'utf8');
  }
}
console.log(`[CONSOLIDATE] Collapsed ${collapsedSiblings.size} multi-variant /solutions/ siblings across ${solutionGroupsByPlatform.size} platforms.`);

const PROBLEM_FALLBACK_PILLAR = {
  '-block-video-ads': '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026',
  '-auto-reject-cookie-popups': '/guides/how-to-automatically-reject-cookie-banners-uk',
  '-filter-ai-slop-and-scams': '/guides/how-to-block-sponsored-ads-on-google-search-2026',
  '-protect-checkout-fake-shop-shield': '/guides/how-to-stop-temu-shein-scam-popups-and-tracking',
  '-remove-page-clutter-and-ram-bloat': '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '-reduce-browser-ram-usage': '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '-stop-malvertising-popunders': '/guides/how-to-stop-malvertising-popunders-and-redirects',
  '-strip-tracking-parameters': '/guides/strip-utm-fbclid-gclid-tracking-links',
  '-bypass-anti-adblock-walls': '/guides/how-to-bypass-anti-adblock-inspect-element-blockers',
  '-stop-autoplay-floating-videos': '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '-stop-notification-permission-spam': '/guides/how-to-stop-fake-robot-captcha-verification-popups',
  '-encrypted-dns-doh-protection': '/guides/strip-utm-fbclid-gclid-tracking-links',
  '-block-crypto-miners-cpu-drain': '/guides/how-to-block-tab-freeze-crypto-miner-scripts',
  '-block-sponsored-feed-carousels': '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed',
  '-clean-reader-distraction-free': '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '-hibernate-idle-background-tabs': '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '-prevent-canvas-webrtc-fingerprinting': '/guides/how-to-stop-facebook-meta-pixel-tracking'
};

const BARE_AMP_RE = /&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);)/g;

function escapeBareAmpersands(raw) {
  return String(raw ?? '').replace(BARE_AMP_RE, '&amp;');
}

function escapeHtml(str) {
  return escapeBareAmpersands(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlInsideCode(raw) {
  return escapeHtml(raw);
}

function renderTextWithInlineCode(str) {
  return String(str ?? '')
    .split(/(`[^`\r\n]+`)/g)
    .map((part) => {
      if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtmlInsideCode(part.slice(1, -1))}</code>`;
      }
      return escapeHtml(part);
    })
    .join('');
}

function walkHtml(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out = out.concat(walkHtml(full));
    } else if (entry.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const allHtmlFiles = walkHtml(WEBSITE_DIR);
const NON_CARTESIAN_CLUSTERS = new Set(['tools', 'glossary', 'campaigns', 'de', 'fr', 'es', 'stories', 'site']);

// Map every Cartesian/core HTML file to its clean URL path and metadata (excluding standalone non-Cartesian hubs)
const pageRecords = [];
for (const filePath of allHtmlFiles) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const cluster = rel.includes('/') ? rel.split('/')[0] : 'root';
  if (NON_CARTESIAN_CLUSTERS.has(cluster)) continue;
  if (/^(solutions|setup|vs|guides)\/index\.html$/i.test(rel)) continue;
  const urlPath = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
  const isPillar = KEPT_URLS_SET.has(urlPath) || (PILLAR_SET.has(urlPath) && !isNoIndexPrunePath(urlPath) && !CONSOLIDATE_301_MAP.has(urlPath));
  pageRecords.push({ filePath, rel, urlPath, isPillar, cluster });
}

// Sort deterministically
pageRecords.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

const pillarPages = pageRecords.filter((p) => p.isPillar);
const pseoPillarPages = pillarPages.filter((p) => p.cluster !== 'root');

// Map platform prefix -> primary Pillar URL in /solutions/*
const platformToPillarUrl = new Map();
for (const p of pseoPillarPages) {
  if (p.cluster === 'solutions') {
    const platPrefix = extractSolutionPlatformPrefix(p.urlPath);
    if (platPrefix && !platformToPillarUrl.has(platPrefix)) {
      platformToPillarUrl.set(platPrefix, p.urlPath);
    }
  }
}

function resolveConsolidatingPillarPath(rec) {
  if (rec.isPillar) return rec.urlPath;
  if (CONSOLIDATE_301_MAP.has(rec.urlPath)) {
    return resolveConsolidationTarget(CONSOLIDATE_301_MAP.get(rec.urlPath));
  }
  if (rec.cluster === 'solutions') {
    const slug = rec.urlPath.replace(/^\/solutions\//, '');
    for (const suf of PROBLEM_SUFFIXES) {
      if (slug.endsWith(suf)) {
        const rawPrefix = slug.slice(0, -suf.length);
        const platPrefix = PLATFORM_PREFIX_ALIASES[rawPrefix] || rawPrefix;
        if (platformToPillarUrl.has(platPrefix)) {
          return resolveConsolidationTarget(platformToPillarUrl.get(platPrefix));
        }
        if (PROBLEM_FALLBACK_PILLAR[suf] && PILLAR_SET.has(PROBLEM_FALLBACK_PILLAR[suf])) {
          return PROBLEM_FALLBACK_PILLAR[suf];
        }
      }
    }
    return '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock';
  }
  if (rec.cluster === 'setup') return '/setup/google-chrome-manifest-v3';
  if (rec.cluster === 'vs') return '/vs/total-adblock';
  if (rec.cluster === 'guides') return '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026';
  return '/';
}

console.log(`[CONSOLIDATE] Total HTML files: ${pageRecords.length}`);
console.log(`[CONSOLIDATE] Authoritative Indexable Pillar Pages: ${pillarPages.length}`);
console.log(`[CONSOLIDATE] Consolidated Secondary Pages (noindex, follow): ${pageRecords.length - pillarPages.length}`);

// Helper to build a clean card badge & title for a pillar page in the Related section
function getPillarCardMeta(rec) {
  const content = fs.readFileSync(rec.filePath, 'utf8');
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleMatch
    ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/ \| SWEEPR Deepblock.*$/i, '').replace(/ \| Deepblock.*$/i, '').trim()
    : rec.urlPath;
  let badge = '2026 Verified Guide';
  if (rec.cluster === 'setup') badge = 'Browser Setup • MV3 & WebExtensions';
  else if (rec.cluster === 'solutions') badge = 'Platform Solution • MV3 & Cookie Shield';
  else if (rec.cluster === 'vs') badge = '2026 Head-to-Head Benchmark';
  else if (rec.cluster === 'guides') badge = 'Step-by-Step Privacy Guide';
  return { urlPath: rec.urlPath, badge, cardTitle: rawTitle };
}

const modifiedFilePaths = new Set();
const substantiveModifiedPaths = new Set();

function writeFileSafe(filePath, content, isSubstantive = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      const resolved = path.resolve(filePath);
      modifiedFilePaths.add(resolved);
      if (isSubstantive) {
        substantiveModifiedPaths.add(resolved);
      }
      return;
    } catch (err) {
      if (attempt === 4) throw err;
      const start = Date.now();
      while (Date.now() - start < 40 * (attempt + 1)) {}
    }
  }
}

// First pass: apply Exact-Query CTR Surgery & robots meta tags
let exactSurgeryApplied = 0;
for (const rec of pageRecords) {
  // Never modify prototype/mockup non-indexable root files
  if (rec.cluster === 'root' && !rec.isPillar) continue;

  const origHtml = fs.readFileSync(rec.filePath, 'utf8');
  let html = origHtml;

  // 1. Update robots meta tag & canonical tag respecting NOINDEX_PRUNE vs CONSOLIDATE_301 vs KEEP_REWRITE
  if (rec.isPillar) {
    if (/meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />'
      );
    }
    const selfCanUrl = `https://sweeprdeepblock.com${rec.urlPath === '/' ? '/' : rec.urlPath}`;
    html = html.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']\s*\/?>/i,
      `<link rel="canonical" href="${selfCanUrl}" />`
    );
  } else if (isNoIndexPrunePath(rec.urlPath)) {
    if (/meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
        '<meta name="robots" content="noindex, nofollow" />'
      );
    } else {
      html = html.replace(
        /<\/title>/i,
        '</title>\n  <meta name="robots" content="noindex, nofollow" />'
      );
    }
    const selfCanUrl = `https://sweeprdeepblock.com${rec.urlPath}`;
    html = html.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']\s*\/?>/i,
      `<link rel="canonical" href="${selfCanUrl}" />`
    );
  } else {
    if (/meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
        '<meta name="robots" content="noindex, follow" />'
      );
    } else {
      html = html.replace(
        /<\/title>/i,
        '</title>\n  <meta name="robots" content="noindex, follow" />'
      );
    }
    const parentPillarPath = resolveConsolidatingPillarPath(rec);
    const parentCanUrl = `https://sweeprdeepblock.com${parentPillarPath}`;
    html = html.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']\s*\/?>/i,
      `<link rel="canonical" href="${parentCanUrl}" />`
    );
  }

  // 2. Apply Exact-Query CTR Surgery if this page is in EXACT_QUERY_SURGERY or customQuerySurgery
  // Never overwrite a page whose title was dynamically updated after the baseline date unless customQuerySurgery is provided
  const customSurgery = enrichmentState.customQuerySurgery && enrichmentState.customQuerySurgery[rec.urlPath];
  const updatedIso = enrichmentState.titleUpdatedAt && enrichmentState.titleUpdatedAt[rec.urlPath];
  const wasDynamicallyUpdatedAfterBaseline = updatedIso && new Date(updatedIso).getTime() > new Date('2026-11-04T00:00:00Z').getTime();
  const surgery = customSurgery || (wasDynamicallyUpdatedAfterBaseline ? null : EXACT_QUERY_SURGERY[rec.urlPath]);
  if (surgery) {
    const safeTitle = escapeHtml(surgery.title);
    const safeDesc = escapeHtml(surgery.desc);

    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
    html = html.replace(
      /<meta\s+name=["']description["']\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:title["']\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:description["']\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );
    html = html.replace(
      /<meta\s+property=["']og:image:alt["']\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image:alt" content="${safeTitle}" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:title["']\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`
    );
    html = html.replace(
      /<meta\s+name=["']twitter:description["']\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`
    );

    if (surgery.h1 && rec.cluster !== 'root' && rec.urlPath !== '/vs/total-adblock') {
      html = html.replace(
        /<h1([^>]*)>[\s\S]*?<\/h1>/i,
        `<h1$1>${escapeHtml(surgery.h1)}</h1>`
      );
    }
    if (surgery.lead && rec.cluster !== 'root' && rec.urlPath !== '/vs/total-adblock') {
      html = html.replace(
        /(<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>)[\s\S]*?(<\/p>)/i,
        `$1${renderTextWithInlineCode(surgery.lead)}$2`
      );
    }

    // Strip any deprecated FAQPage or HowTo JSON-LD blocks
    html = html.replace(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi, (fullMatch, jsonStr) => {
      try {
        const parsed = JSON.parse(jsonStr.trim());
        const t = parsed['@type'];
        if (t === 'FAQPage' || t === 'HowTo' || (Array.isArray(t) && (t.includes('FAQPage') || t.includes('HowTo')))) {
          return '';
        }
        if (Array.isArray(parsed['@graph'])) {
          parsed['@graph'] = parsed['@graph'].filter((n) => {
            const nt = n?.['@type'];
            return nt !== 'FAQPage' && nt !== 'HowTo' && (!Array.isArray(nt) || (!nt.includes('FAQPage') && !nt.includes('HowTo')));
          });
          if (parsed['@graph'].length === 0) return '';
          return `<script type="application/ld+json">${JSON.stringify(parsed)}</script>`;
        }
        return fullMatch;
      } catch {
        return fullMatch;
      }
    });

    exactSurgeryApplied++;
  }

  if (html !== origHtml) {
    writeFileSafe(rec.filePath, html, true);
  }
}
console.log(`[CONSOLIDATE] Applied Exact-Query CTR Surgery to ${exactSurgeryApplied} top GSC pages.`);

// Precompute card metadata for all PSEO pillar pages (excluding custom /vs/total-adblock which has its own layout)
const pseoRingPages = pseoPillarPages.filter((rec) => rec.urlPath !== '/vs/total-adblock');
const pseoPillarCards = pseoRingPages.map((rec) => getPillarCardMeta(rec));
const pillarCardByPath = new Map(pseoPillarCards.map((c) => [c.urlPath, c]));

// Second pass: Preserve already-valid 8-link meshes so adding 1 Pillar doesn't churn all 1,800 HTML files.
// Only rewrite <section> meshes that reference non-Pillar / collapsed siblings, lack links, or miss parentPillarPath.
const M = pseoPillarCards.length;
const OFFSETS = [1, 2, 3, 5, 11, 23, 47, 89];
let meshUpdatedCount = 0;
let meshPreservedCount = 0;

const RELATED_SECTION_RE = /(?:<section style="margin-top:36px;padding-top:24px;border-top:1px solid #1e293b;">[\s\S]*?<\/section>|<section\b[^>]*data-sweepr-related=["']1["'][\s\S]*?<\/section>)/i;
const allPseoPages = pageRecords.filter((rec) => rec.cluster !== 'root' && rec.urlPath !== '/vs/total-adblock');
for (let i = 0; i < allPseoPages.length; i++) {
  const rec = allPseoPages[i];
  const origHtml = fs.readFileSync(rec.filePath, 'utf8');
  let html = origHtml;

  const existingSectionMatch = origHtml.match(RELATED_SECTION_RE);
  if (!existingSectionMatch) continue;

  const existingHrefMatches = [...existingSectionMatch[0].matchAll(/<a\s+[^>]*href=["'](\/[^"'#?]+)["']/gi)].map((m) => m[1]);
  const expectedParent = !rec.isPillar && !isNoIndexPrunePath(rec.urlPath) ? resolveConsolidatingPillarPath(rec) : null;
  const allTargetsAreValidPillars =
    existingHrefMatches.length >= 8 &&
    existingHrefMatches.every((href) => href !== rec.urlPath && PILLAR_SET.has(href) && !isNoIndexPrunePath(href) && !CONSOLIDATE_301_MAP.has(href)) &&
    (!expectedParent || existingHrefMatches.includes(expectedParent));

  if (allTargetsAreValidPillars && existingSectionMatch[0].includes('data-sweepr-related="1"')) {
    meshPreservedCount++;
    continue;
  }

  const relatedCards = [];
  const seen = new Set([rec.urlPath]);
  if (expectedParent) {
    const parentCard = pillarCardByPath.get(expectedParent);
    if (parentCard && !seen.has(parentCard.urlPath)) {
      seen.add(parentCard.urlPath);
      relatedCards.push(parentCard);
    }
  }
  for (const off of OFFSETS) {
    if (relatedCards.length >= 8) break;
    const target = pseoPillarCards[(i + off) % M];
    if (target && !seen.has(target.urlPath)) {
      seen.add(target.urlPath);
      relatedCards.push(target);
    }
  }

  const newRelatedSection = renderRelatedGrid({
    heading: 'Related Browser Setups, Platform Solutions & Guides',
    items: relatedCards.map((rc) => ({
      href: rc.urlPath,
      badge: rc.badge,
      label: rc.cardTitle
    }))
  });

  html = html.replace(RELATED_SECTION_RE, newRelatedSection);
  if (html !== origHtml) {
    writeFileSafe(rec.filePath, html, false);
    meshUpdatedCount++;
  }
}
console.log(`[CONSOLIDATE] Preserved ${meshPreservedCount} healthy link meshes; repaired ${meshUpdatedCount} stale/collapsed meshes -> ${M} PSEO Pillar Pages.`);

// Third pass: Preserve canonical xmlns:xhtml website/sitemap.xml (99 URLs) without stripping hreflangs or adding <changefreq>/<priority>
const todayStr = new Date().toISOString().slice(0, 10);
const existingLastModMap = new Map();
const prevSm = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';
if (prevSm) {
  for (const m of prevSm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    existingLastModMap.set(m[1].trim(), m[2].trim());
  }
}

const HREFLANG_ROUTES = new Set(['/', '/de', '/fr', '/es']);
const expectedSitemapLocs = new Set(ALL_INDEXABLE_PATHS.map((p) => `https://sweeprdeepblock.com${p}`));
const hasCanonicalXhtmlSchema =
  prevSm.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"') &&
  expectedSitemapLocs.size === existingLastModMap.size &&
  [...expectedSitemapLocs].every((loc) => existingLastModMap.has(loc));

if (hasCanonicalXhtmlSchema) {
  console.log(`[CONSOLIDATE] Preserved canonical xmlns:xhtml website/sitemap.xml (${expectedSitemapLocs.size} URLs).`);
} else {
  const fileByPath = new Map(pillarPages.map((p) => [p.urlPath, p.filePath]));
  const sitemapXmlEntries = [...ALL_INDEXABLE_PATHS].map((urlPath) => {
    const loc = `https://sweeprdeepblock.com${urlPath}`;
    const fp = fileByPath.get(urlPath);
    const wasSubstantive = fp && substantiveModifiedPaths.has(path.resolve(fp));
    const lastmod = wasSubstantive ? todayStr : (existingLastModMap.get(loc) || todayStr);
    const xhtmlBlock = HREFLANG_ROUTES.has(urlPath)
      ? `\n    <xhtml:link rel="alternate" hreflang="en" href="https://sweeprdeepblock.com/" />\n    <xhtml:link rel="alternate" hreflang="de" href="https://sweeprdeepblock.com/de" />\n    <xhtml:link rel="alternate" hreflang="fr" href="https://sweeprdeepblock.com/fr" />\n    <xhtml:link rel="alternate" hreflang="es" href="https://sweeprdeepblock.com/es" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="https://sweeprdeepblock.com/" />`
      : '';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>${xhtmlBlock}\n  </url>`;
  });
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapXmlEntries.join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');
  console.log(`[CONSOLIDATE] Wrote ${sitemapXmlEntries.length} canonical URLs to website/sitemap.xml.`);
}

// Fourth pass: Keep website/sitemap-consolidations.xml empty by default so legacy Cartesian 301s are not re-submitted
if (process.argv.includes('--populate-consolidations') && Date.now() < Date.parse(CONSOLIDATION_SITEMAP_EXPIRES_AT)) {
  const existingConsolLastMod = new Map();
  if (fs.existsSync(SITEMAP_CONSOLIDATIONS_PATH)) {
    const prevConsol = fs.readFileSync(SITEMAP_CONSOLIDATIONS_PATH, 'utf8');
    for (const m of prevConsol.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
      existingConsolLastMod.set(m[1].trim(), m[2].trim());
    }
  }
  const consolidatedRecords = pageRecords.filter(
    (p) => !p.isPillar && !isNoIndexPrunePath(p.urlPath) && /^(solutions|setup|vs|guides)\//i.test(p.rel)
  );
  const consolXml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Temporary 30-day HTTP 301 discovery sitemap (expires ${CONSOLIDATION_SITEMAP_EXPIRES_AT}) to clear stale indexed Cartesian snapshots -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${consolidatedRecords.map((p) => {
  const loc = `https://sweeprdeepblock.com${p.urlPath}`;
  const defaultMod = todayStr;
  const lastmod = existingConsolLastMod.get(loc) || defaultMod;
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}).join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_CONSOLIDATIONS_PATH, consolXml, 'utf8');
  console.log(`[CONSOLIDATE] Wrote ${consolidatedRecords.length} temporary HTTP 301 discovery URLs to website/sitemap-consolidations.xml (expires ${CONSOLIDATION_SITEMAP_EXPIRES_AT}).`);
} else {
  const emptyConsolXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
  if (!fs.existsSync(SITEMAP_CONSOLIDATIONS_PATH) || fs.readFileSync(SITEMAP_CONSOLIDATIONS_PATH, 'utf8') !== emptyConsolXml) {
    fs.writeFileSync(SITEMAP_CONSOLIDATIONS_PATH, emptyConsolXml, 'utf8');
  }
  console.log('[CONSOLIDATE] Kept website/sitemap-consolidations.xml empty (0 URLs).');
}
