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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');

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

// 2. Additional Strategic Flagship Pillar Pages (Homepage links, LLMs.txt links, and top browsers/competitors)
const STRATEGIC_PILLAR_PATHS = [
  // Homepage & Core Setup Hubs
  '/setup/google-chrome-manifest-v3',
  '/setup/mozilla-firefox-desktop-android',
  '/setup/microsoft-edge-windows-11',
  '/setup/apple-safari-macos-ios',
  '/setup/brave-browser-shields-plus',
  '/setup/chromeos-chromebook-mv3',
  '/setup/firefox-android-mobile',
  '/setup/edge-macos-apple-silicon',
  '/setup/zen-browser-windows-11-portable',
  '/setup/windows-11-arm64-snapdragon',
  '/setup/macos-sequoia-safari-18',
  '/setup/steam-deck-gaming-mode-browser',
  '/setup/duckduckgo-browser-windows-mac',
  '/setup/samsung-internet-android',
  '/setup/pale-moon-basilisk-browser',
  // Core Flagship Platform Solutions
  '/solutions/youtube-chrome-mv3-block-video-ads',
  '/solutions/youtube-chrome-mv3-reduce-browser-ram-usage',
  '/solutions/twitch-live-streams-block-video-ads',
  '/solutions/reddit-promoted-posts-block-video-ads',
  '/solutions/spotify-web-player-block-video-ads',
  '/solutions/facebook-marketplace-shops-filter-ai-slop-and-scams',
  '/solutions/daily-mail-online-block-video-ads',
  '/solutions/hulu-disney-plus-web-block-video-ads',
  '/solutions/tubi-tv-free-movies-block-video-ads',
  '/solutions/pluto-tv-stream-channels-block-video-ads',
  '/solutions/peacock-tv-streaming-block-video-ads',
  '/solutions/paramount-plus-streaming-block-video-ads',
  '/solutions/max-hbo-streaming-block-video-ads',
  '/solutions/imdb-tv-freevee-streaming-block-video-ads',
  '/solutions/viki-asian-streaming-block-video-ads',
  '/solutions/mangadex-web-reader-block-video-ads',
  '/solutions/anilist-myanimelist-tracker-block-video-ads',
  '/solutions/nexus-mods-community-stop-malvertising-popunders',
  '/solutions/curseforge-gaming-mods-stop-malvertising-popunders',
  '/solutions/coinmarketcap-crypto-prices-stop-malvertising-popunders',
  '/solutions/tradingview-charts-web-reduce-browser-ram-usage',
  '/solutions/speedtest-by-ookla-block-video-ads',
  '/solutions/chesscom-blitz-gaming-block-video-ads',
  '/solutions/ultimate-guitar-tabs-block-video-ads',
  // Core Competitor Comparisons
  '/vs/ublock-origin-lite',
  '/vs/adguard-extension',
  '/vs/ghostery-privacy-ad-blocker',
  '/vs/pie-adblock',
  '/vs/brave-shields',
  '/vs/1blocker-safari',
  '/vs/stands-fair-adblocker',
  '/vs/adblock-for-chrome',
  '/vs/adlock-multi-device',
  '/vs/wipr-2-safari',
  '/vs/nextdns-encrypted-dns',
  '/vs/pi-hole-network-blocker',
  '/vs/privacy-badger-eff',
  '/vs/duckduckgo-privacy-essentials',
  '/vs/opera-built-in-ad-blocker',
  '/vs/vivaldi-built-in-blocker',
  '/vs/nordvpn-threat-protection',
  '/vs/surfshark-cleanweb',
  '/vs/proton-vpn-netshield',
  '/vs/malwarebytes-browser-guard',
  // Core Flagship Guides
  '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026',
  '/guides/how-to-fix-twitch-purple-screen-adblock-2026',
  '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '/guides/how-to-spot-fake-scam-online-shops-uk',
  '/guides/strip-utm-fbclid-gclid-tracking-links',
  '/guides/how-to-block-crunchyroll-ads-on-chrome-and-firefox',
  '/guides/how-to-stop-fandom-wiki-autoplay-videos-and-lag',
  '/guides/how-to-block-pop-under-redirects-on-streaming-sites',
  '/guides/encrypted-dns-over-https-doh-browser-setup-guide',
  '/guides/how-to-detect-fake-trustpilot-and-amazon-reviews'
];

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
        if (opp.isPublishedOnDisk && opp.recommendedUrlPath) {
          keywordMatrixPaths.push(opp.recommendedUrlPath);
        }
      }
    }
  } catch {}
}

const PILLAR_SET = new Set([
  ...GSC_PROVEN_PATHS,
  ...STRATEGIC_PILLAR_PATHS,
  ...llmsReferencedPaths,
  ...existingSitemapPillarPaths,
  ...keywordMatrixPaths,
  ...(Array.isArray(enrichmentState.discoveredGscPaths) ? enrichmentState.discoveredGscPaths : [])
]);

// 3. Exact-Query CTR & Technical Differentiation Overrides for the Top Proven GSC Pages
const EXACT_QUERY_SURGERY = {
  '/setup/thorium-chromium-browser': {
    title: 'Thorium AdBlock (2026): Best Ad Blocker for Thorium Browser',
    desc: 'Looking for Thorium AdBlock? Install SWEEPR DeepBlock on Thorium Browser (AVX2) to block YouTube pre-roll ads, popunders, and cookie banners in <50ms.',
    h1: 'Thorium AdBlock (2026): Best MV3 Ad Blocker for Thorium Browser (AVX2)',
    lead: 'Searching for the best Thorium AdBlock setup? Pair Thorium Fast Chromium Browser (AVX2/SSE4) on Windows and Linux with SWEEPR DeepBlock for 8/8 anti-detection YouTube ad blocking, <50ms automatic cookie pop-up rejection, and 62% lower tab RAM usage.',
    faqQ1: 'What is the best Thorium adblock extension in 2026?',
    faqA1: 'SWEEPR DeepBlock is purpose-built for Thorium Browser (Chromium MV3), combining 300+ declarativeNetRequest network rules with MAIN-world DeepStealth scriptlets that block YouTube, Twitch, and Crunchyroll video ads without triggering anti-adblock warnings.'
  },
  '/setup/orion-browser-macos-ios': {
    title: 'Orion Browser Ad Blocker (macOS & iOS): Block YouTube Ads',
    desc: 'Need a reliable Orion browser ad blocker for macOS or iOS? SWEEPR DeepBlock stops YouTube video ads, WebKit popunders, and cookie walls in under 50ms.',
    h1: 'Orion Browser Ad Blocker (macOS & iOS): 2026 WebKit Setup Guide',
    lead: 'Orion Browser supports both Chrome and Firefox WebExtensions on macOS and iOS, but built-in content blockers often miss YouTube server-side ad injections. Adding SWEEPR DeepBlock gives Orion Browser 8/8 video ad blocking and <50ms cookie auto-rejection.',
    faqQ1: 'Does Orion Browser need an external ad blocker on macOS and iOS?',
    faqA1: 'Yes. While Orion includes basic WebKit filtering, installing SWEEPR DeepBlock adds zero-lag MAIN-world video ad neutralization for YouTube and Twitch plus automatic GDPR cookie banner rejection across 150+ CMP frameworks.'
  },
  '/setup/floorp-browser-firefox-fork': {
    title: 'Floorp AdBlock (2026): Best Ad Blocker for Floorp Browser',
    desc: 'Set up Floorp AdBlock in 30 seconds. SWEEPR DeepBlock adds 8/8 anti-detection YouTube ad blocking, <50ms cookie auto-rejection, and 62% lower tab RAM.',
    h1: 'Floorp AdBlock Setup (2026): Best Ad & Tracker Blocker for Floorp Browser',
    lead: 'Upgrade Floorp Browser (Firefox-based workspaces & vertical tabs) with SWEEPR DeepBlock. Block unskippable YouTube and Crunchyroll video commercials, auto-decline GDPR cookie walls in under 50ms, and hibernate background workspace tabs to save 62% RAM.',
    faqQ1: 'Why use SWEEPR DeepBlock as your Floorp adblock extension?',
    faqA1: 'Floorp users frequently run 30+ tabs across multiple workspaces. SWEEPR DeepBlock combines zero-detection video ad blocking with a built-in Tab & RAM Tamer (Alt+Shift+Z) that cuts Floorp memory usage by up to 62%.'
  },
  '/setup/arc-browser-windows-mac': {
    title: 'Arc Browser Ad Blocker (2026): Best Arc AdBlocker (Win & Mac)',
    desc: 'Install the best Arc browser ad blocker for Windows 11 and macOS. Block YouTube mid-roll ads, auto-reject cookie banners, and tame Arc tab RAM by 62%.',
    h1: 'Arc Browser Ad Blocker (Windows & Mac): Best Arc AdBlocker Setup (2026)',
    lead: 'Looking for an Arc browser ad blocker that also fixes Arc high memory usage? SWEEPR DeepBlock installs in 30 seconds on Arc for Windows 11 and macOS, blocking YouTube pre-roll ads, auto-rejecting cookie pop-ups, and snoozing inactive Arc spaces.',
    faqQ1: 'What is the best Arc adblocker for Windows 11 and macOS?',
    faqA1: 'SWEEPR DeepBlock is the highest-rated Arc browser ad blocker for 2026 because it solves Arc’s two biggest pain points simultaneously: Manifest V3 YouTube anti-adblock walls and high background tab RAM consumption.'
  },
  '/setup/zen-browser-privacy-tabs': {
    title: 'Zen Browser Ad Blocker (2026): Block YouTube Ads & Tame RAM',
    desc: 'Upgrade Zen Browser with SWEEPR DeepBlock: 8/8 anti-detection YouTube ad blocking, <50ms automatic cookie pop-up rejection, and 62% lower memory usage.',
    h1: 'Zen Browser Ad Blocker (2026): Zero-Lag YouTube Blocking & Tab RAM Tamer',
    lead: 'Zen Browser delivers a clean Firefox-based vertical tab experience. Pairing Zen Browser with SWEEPR DeepBlock adds 8/8 anti-detection video ad blocking on YouTube and Twitch, automatic <50ms cookie banner rejection, and real-time scam store alerts.',
    faqQ1: 'How do I block YouTube ads and cookie pop-ups in Zen Browser?',
    faqA1: 'Install the signed SWEEPR DeepBlock Firefox add-on in Zen Browser. It immediately activates network-level tracker blocking, MAIN-world YouTube ad stripping, and automatic Reject-All cookie handling.'
  },
  '/setup/kiwi-browser-android': {
    title: 'Kiwi Browser Ad Blocker Extension (Android): Block Video Ads',
    desc: 'Install the fastest Kiwi Browser adblock extension on Android. Block mobile YouTube ads, stop redirect popunders, and auto-reject cookie banners in <50ms.',
    h1: 'Kiwi Browser Ad Blocker Extension for Android (2026 Setup & Unblocker Guide)',
    lead: 'Need a powerful Kiwi Browser ad blocker extension on Android? Replace Kiwi’s basic built-in filter with SWEEPR DeepBlock to stop mobile pop-under redirects, block YouTube & anime video commercials, and prevent mobile tab freezes.',
    faqQ1: 'What is the best Kiwi Browser adblock extension on Android?',
    faqA1: 'SWEEPR DeepBlock runs natively inside Kiwi Browser on Android, intercepting mobile click-jacking popunders, VAST video ad streams, and GDPR cookie consent walls before they render.'
  },
  '/setup/ungoogled-chromium-mv3': {
    title: 'Ungoogled Chromium Ad Blocker (MV3): Setup Without Web Store',
    desc: 'Install SWEEPR DeepBlock on Ungoogled Chromium (MV3) without Google sync. Block YouTube video ads, fingerprint scripts, and cookie walls in under 50ms.',
    h1: 'Ungoogled Chromium MV3 Ad Blocker (2026): Direct Setup & Anti-Detection Guide',
    lead: 'Running Ungoogled Chromium on Linux, Windows, or macOS? Download and load SWEEPR DeepBlock directly without a Google account to enforce 8/8 anti-detection video ad blocking, URL tracker stripping, and sub-50ms cookie wall rejection.',
    faqQ1: 'Can I install SWEEPR DeepBlock on Ungoogled Chromium without the Chrome Web Store?',
    faqA1: 'Yes. You can download the standalone SWEEPR DeepBlock package directly from sweeprdeepblock.com/download and load it into Ungoogled Chromium with zero Google telemetry dependencies.'
  },
  '/setup/brave-macos-apple-silicon': {
    title: 'Brave Mac Ad Blocker (Apple Silicon M1–M4): Stop YouTube Lag',
    desc: 'Boost Brave Browser on macOS Apple Silicon (M1/M2/M3/M4) with SWEEPR DeepBlock:auto-reject 150+ cookie walls, filter AI search slop, and save 62% RAM.',
    h1: 'Brave Browser on Mac (Apple Silicon M1/M2/M3/M4): SWEEPR DeepBlock Setup',
    lead: 'Even with Brave Shields enabled on macOS Sonoma and Sequoia, YouTube anti-adblock prompts, GDPR cookie consent banners, and AI search spam still slip through. Add SWEEPR DeepBlock on Apple Silicon Macs for 8/8 stealth protection.',
    faqQ1: 'Does SWEEPR DeepBlock work alongside Brave Browser on Apple Silicon Macs?',
    faqA1: 'Yes. SWEEPR DeepBlock complements macOS Apple Silicon browsers with sub-50ms automatic Reject-All cookie handling, AI search result filtering, fake online shop alerts, and background tab hibernation.'
  },
  '/setup/librewolf-hardened-firefox': {
    title: 'LibreWolf Ad Blocker (2026): Hardened Privacy & RAM Tamer',
    desc: 'Configure SWEEPR DeepBlock on LibreWolf Hardened Firefox. Add <50ms automatic cookie banner rejection, AI search slop filtering, and 62% lower tab RAM.',
    h1: 'LibreWolf Ad Blocker Setup (2026): Hardened Anti-Detection & Cookie Auto-Reject',
    lead: 'LibreWolf strips telemetry and enforces strict privacy defaults, which causes many sites to bombard you with repeated GDPR cookie walls on every visit. SWEEPR DeepBlock automatically clicks Reject All in <50ms while blocking video ads and trackers.',
    faqQ1: 'Why is SWEEPR DeepBlock essential for LibreWolf users who clear cookies on exit?',
    faqA1: 'Because LibreWolf wipes cookies when closed, websites display GDPR consent banners every session. SWEEPR DeepBlock automatically rejects 150+ CMP cookie banners in under 50ms so you never have to click them manually.'
  },
  '/solutions/crunchyroll-anime-streams-block-video-ads': {
    title: 'How to Get No Ads on Crunchyroll PC (Best Crunchyroll AdBlock)',
    desc: 'Learn how to get no ads on Crunchyroll PC in 2026. Block unskippable Crunchyroll & Funimation pre-roll/mid-roll video commercials without black screens.',
    h1: 'How to Get No Ads on Crunchyroll PC (2026 Best AdBlocker for Crunchyroll)',
    lead: 'Tired of 4-in-a-row unskippable commercials when watching anime on Crunchyroll or Funimation on PC? Discover how SWEEPR DeepBlock neutralizes Crunchyroll VAST/VMAP pre-roll and mid-roll video ad pods in Chrome, Firefox, Edge, and Brave without black-screen freezes.',
    faqQ1: 'How do I get no ads on Crunchyroll PC in 2026 without playback errors?',
    faqA1: 'Install SWEEPR DeepBlock on your PC browser (Chrome, Firefox, Edge, Brave, Floorp, or Thorium) and open Crunchyroll. DeepBlock’s MV3 network rules and MAIN-world player hooks strip pre-roll and mid-roll ad segments automatically while keeping 1080p HLS streaming smooth.'
  },
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage': {
    title: 'Why Does Fandom Use So Much RAM? Fix Fandom Memory & Video Ads',
    desc: 'Why does Fandom use so much memory and RAM? Fandom loads autoplay videos and 60+ ad auction scripts. Cut Fandom RAM usage by 62% with SWEEPR DeepBlock.',
    h1: 'Why Does Fandom Use So Much Memory & RAM? (Fix Fandom Wiki Lag in 2026)',
    lead: 'Wondering why Fandom uses so much memory and freezes your browser when you open a few gaming wiki tabs? A single Fandom page executes 60+ real-time ad bidding scripts and sticky autoplay video players. SWEEPR DeepBlock blocks these scripts before execution and cuts Fandom tab RAM usage by up to 62%.',
    faqQ1: 'Why does Fandom use so much RAM and CPU on Chrome and Firefox?',
    faqA1: 'Fandom gaming wikis continuously run Prebid.js header auctions, sticky JWPlayer video streams, and cross-site telemetry loops in every open tab. SWEEPR DeepBlock terminates those network requests at the MV3 layer and hibernates inactive wiki tabs.'
  },
  '/solutions/fandom-game-wikis-block-video-ads': {
    title: 'Fandom Ad Block (2026): Stop Fandom Autoplay Videos & Popups',
    desc: 'Block intrusive Fandom wiki video ads, sticky sidebars, and Fandom anti-adblock nags automatically. Browse gaming wikis cleanly with SWEEPR DeepBlock.',
    h1: 'Fandom Ad Block: Stop Autoplay Sidebar Videos & Fandom Anti-Adblock Walls',
    lead: 'Fandom gaming wikis cover up to 45% of your screen with floating video players, expanding top banners, and anti-adblock warning bars. SWEEPR DeepBlock strips Fandom video ads and collapses empty ad containers in under 50ms.',
    faqQ1: 'How do I block autoplay video ads and anti-adblock banners on Fandom wikis?',
    faqA1: 'SWEEPR DeepBlock blocks Fandom’s video delivery endpoints via declarativeNetRequest and injects cosmetic DOM rules that remove floating video containers without breaking wiki tables or scroll position.'
  },
  '/solutions/webtoon-manhwa-readers-block-video-ads': {
    title: 'Webtoon Ad Blocker (2026): Block Popunders, Banners & Video Ads',
    desc: 'The fastest Webtoon ad blocker for desktop and mobile browsers. Stop full-screen manhwa redirect popunders, sticky banners, and video ads automatically.',
    h1: 'Webtoon Ad Blocker (2026): Stop Manhwa Redirect Pop-Unders & Sticky Banners',
    lead: 'Reading Webtoons or manhwa online shouldn’t trigger full-screen tab redirects or sticky banners that block vertical scrolling. SWEEPR DeepBlock intercepts click-jacking pop-under scripts and banner overlays across all Webtoon and manhwa reader portals.',
    faqQ1: 'What is the best Webtoon ad blocker for Chrome, Firefox, and Android?',
    faqA1: 'SWEEPR DeepBlock blocks both network-level banner auctions and JavaScript window.open / onclick pop-under traps on Webtoon and manhwa sites while preserving lazy-loaded comic panels.'
  },
  '/solutions/manga-comic-readers-block-video-ads': {
    title: 'How to Block Ads on Manga Sites (2026 Manga Reader AdBlocker)',
    desc: 'Learn how to block ads on manga sites without breaking chapter images. Stop click-jacking redirects, pop-unders, and sticky banners in <50ms.',
    h1: 'How to Block Ads on Manga Sites (Stop Pop-Unders & Redirects on Manga Readers)',
    lead: 'Searching for how to block ads on manga sites without breaking chapter image loaders? SWEEPR DeepBlock neutralizes deceptive overlay click-traps, new-tab pop-unders, and floating banners across manga and comic readers.',
    faqQ1: 'How do I block redirect ads on manga reader websites?',
    faqA1: 'Install SWEEPR DeepBlock to neutralize inline onclick hijackers, pop-under scripts, and malvertising ad domains before they can open unwanted tabs when you click next chapter.'
  },
  '/solutions/linkedin-feed-ads-block-video-ads': {
    title: 'LinkedIn Ad Blocker Chrome Extension: Block Promoted Feed Ads',
    desc: 'Need a Chrome extension that stops LinkedIn ads? Hide promoted posts, sponsored video ads, and tracking beacons in your LinkedIn feed with DeepBlock.',
    h1: 'LinkedIn Ad Blocker Extension for Chrome & Firefox: Hide Promoted Feed Ads',
    lead: 'Looking for a Chrome extension that stops LinkedIn ads and promoted posts from cluttering your professional feed? SWEEPR DeepBlock automatically hides disguised "Promoted" feed cards, autoplay video ads, and sidebar promotions on LinkedIn.',
    faqQ1: 'Is there a Chrome extension that stops LinkedIn promoted ads?',
    faqA1: 'Yes. SWEEPR DeepBlock detects and collapses LinkedIn "Promoted" feed posts, sponsored carousel cards, and outbound click-tracking wrappers in real time on Chrome, Edge, Brave, and Firefox.'
  },
  '/solutions/soundcloud-audio-player-block-video-ads': {
    title: 'SoundCloud Ad Blocker Extension: How to Block SoundCloud Ads',
    desc: 'Learn how to block ads on SoundCloud Web Player. Our SoundCloud ad blocker extension silences between-track audio commercials and banner clutter in <50ms.',
    h1: 'SoundCloud Ad Blocker Extension (2026): How to Block Audio Ads on SoundCloud',
    lead: 'Want to know how to block ads on SoundCloud without interruptions between tracks? SWEEPR DeepBlock functions as a zero-lag SoundCloud ad blocker extension, intercepting third-party audio ad streams, visual takeover banners, and telemetry beacons.',
    faqQ1: 'How do I block audio and banner ads on SoundCloud Web Player?',
    faqA1: 'Install the SWEEPR DeepBlock extension on Chrome, Firefox, Edge, or Brave. It blocks SoundCloud’s programmatic ad delivery endpoints and suppresses upgrade nag overlays automatically.'
  },
  '/solutions/soundcloud-audio-player-reduce-browser-ram-usage': {
    title: 'SoundCloud High RAM Fix & Ad Blocker: Cut Memory Usage by 62%',
    desc: 'Fix high browser memory usage on SoundCloud Web Player. Block background ad auction scripts, audio trackers, and memory leaks with SWEEPR DeepBlock.',
    h1: 'How to Fix SoundCloud Web Player High RAM Usage & Block Audio Ads',
    lead: 'Long SoundCloud listening sessions often bloat browser memory to 1.5GB+ due to continuous background ad bidding scripts and waveform telemetry. SWEEPR DeepBlock strips these ad scripts to keep SoundCloud lightweight.',
    faqQ1: 'Why does SoundCloud Web Player use so much browser memory over time?',
    faqA1: 'Background ad-refresh timers and tracker beacons accumulate in memory between tracks. SWEEPR DeepBlock blocks those ad endpoints at the network layer, cutting RAM overhead by up to 62%.'
  },
  '/solutions/dex-token-screeners-block-video-ads': {
    title: 'DEXScreener Ad Blocker: Block Token Banners & Scam Drain Ads',
    desc: 'Block intrusive DEXScreener ads, fake airdrop banners, and malicious wallet-drainer popups while keeping live crypto charts fast with SWEEPR DeepBlock.',
    h1: 'DEXScreener Ad Blocker (2026): Stop Malicious Crypto Banners & Chart Lag',
    lead: 'Trading on DEXScreener, Dextools, or token price trackers exposes your browser to high-CPU banner ads and deceptive phishing links. SWEEPR DeepBlock strips DEXScreener ad slots and blocks known scam domains in under 50ms.',
    faqQ1: 'How do I block DEXScreener ads and speed up live token charts?',
    faqA1: 'SWEEPR DeepBlock removes DEXScreener header/sidebar banner iframes and halts third-party ad trackers so WebSocket price charts render smoothly with lower CPU usage.'
  },
  '/solutions/geeksforgeeks-dev-portals-block-video-ads': {
    title: 'GeeksforGeeks Ad Blocker: Stop Login Popups & Video Banners',
    desc: 'Block intrusive GeeksforGeeks video ads, sticky course banners, and login wall overlays while reading coding tutorials with SWEEPR DeepBlock.',
    h1: 'GeeksforGeeks Ad Blocker (2026): Remove Floating Videos & Course Popups',
    lead: 'Reading algorithms and coding articles on GeeksforGeeks shouldn’t mean fighting floating video players, expanding header banners, and repetitive sign-in popups. SWEEPR DeepBlock cleans developer documentation portals automatically.',
    faqQ1: 'How do I stop floating video ads and popups on GeeksforGeeks?',
    faqA1: 'Install SWEEPR DeepBlock to block GeeksforGeeks video ad containers, promotional course modals, andOneTrust/Google sign-in prompts in under 50ms.'
  },
  '/solutions/roblox-web-community-filter-ai-slop-and-scams': {
    title: 'Roblox Web Ad & Scam Blocker: Stop Fake Robux & Phishing Links',
    desc: 'Protect Roblox web browsing with SWEEPR DeepBlock. Block deceptive fake Robux banners, trade phishing links, and malvertising redirects in <50ms.',
    h1: 'Roblox Web Community Ad & Scam Blocker (2026 Protection Guide)',
    lead: 'Roblox community wikis, value lists, and accessory portals are heavily targeted by fake Robux generator ads and account-stealing phishing links. SWEEPR DeepBlock blocks malicious ad networks and warns on scam storefronts.',
    faqQ1: 'How does SWEEPR DeepBlock protect Roblox players on web portals?',
    faqA1: 'SWEEPR DeepBlock combines network-level malvertising rules with a real-time heuristic scam detector that flags cloned domains, fake urgency timers, and deceptive download buttons.'
  },
  '/solutions/rumble-video-streams-block-video-ads': {
    title: 'Rumble Ad Blocker (2026): Block Pre-Roll & Mid-Roll Video Ads',
    desc: 'Block unskippable pre-roll and mid-roll commercials on Rumble video streams. SWEEPR DeepBlock stops Rumble ads at the network and player layer in <50ms.',
    h1: 'Rumble Ad Blocker (2026): Block Pre-Roll & Livestream Ads Without Playback Lag',
    lead: 'Watching videos or livestreams on Rumble? SWEEPR DeepBlock intercepts Rumble’s VAST pre-roll ad requests and collapses sidebar display banners so videos start immediately.',
    faqQ1: 'What is the best Rumble ad blocker for Chrome, Brave, and Firefox?',
    faqA1: 'SWEEPR DeepBlock blocks Rumble video commercials and display banners using Manifest V3 declarativeNetRequest rules paired with DeepStealth player hooks.'
  },
  '/solutions/tumblr-blog-feeds-block-video-ads': {
    title: 'Tumblr Ad Blocker (2026): Hide Sponsored Posts & Video Ads',
    desc: 'Clean up your Tumblr dashboard with SWEEPR DeepBlock. Block Tumblr sponsored posts, Blaze promotions, autoplay video ads, and affiliate trackers.',
    h1: 'Tumblr Ad Blocker: Hide Dashboard Sponsored Posts & Autoplay Video Ads',
    lead: 'Stop sponsored posts, Blaze promotions, and sticky video widgets from interrupting your Tumblr dashboard. SWEEPR DeepBlock hides Tumblr feed ads and strips outbound tracking parameters.',
    faqQ1: 'How do I block ads and sponsored posts on Tumblr Web?',
    faqA1: 'SWEEPR DeepBlock removes sponsored dashboard cards and blocks third-party ad auction scripts on Tumblr in under 50ms.'
  },
  '/guides/how-to-automatically-reject-cookie-banners-uk': {
    title: 'Automatically Reject Cookies (2026): Auto-Decline Popups <50ms',
    desc: 'Automatically reject cookies across UK, EU, and US websites in under 50ms. SWEEPR DeepBlock clicks "Reject All" on OneTrust, Cookiebot & 150+ CMPs.',
    h1: 'How to Automatically Reject Cookies & GDPR Pop-Ups in Under 50ms (2026)',
    lead: 'Tired of clicking "Manage Preferences" and "Reject All" on every website you visit? SWEEPR DeepBlock automatically rejects non-essential cookies across OneTrust, Quantcast, Didomi, Cookiebot, TrustArc, and 150+ CMP frameworks in under 50 milliseconds without breaking page scroll.',
    faqQ1: 'How can I automatically reject cookies on Chrome, Firefox, and Edge?',
    faqA1: 'Install SWEEPR DeepBlock and keep "Auto-Decline Cookie Pop-Ups" enabled. Instead of merely hiding the banner with CSS (which leaves tracking undecided or breaks page scroll), DeepBlock programmatically triggers the CMP’s official Reject All / Necessary Only signal in <50ms.'
  },
  '/guides/how-to-block-twitch-midroll-commercials-without-black-screen': {
    title: 'Blocking Mid-Roll Ads on Twitch & YouTube Without Black Screen',
    desc: 'Master blocking mid-roll ads on Twitch, YouTube, and Crunchyroll in 2026 without black screens or purple playback errors using SWEEPR DeepBlock MV3.',
    h1: 'Blocking Mid-Roll Ads on Twitch & YouTube Without Black Screens (2026 Guide)',
    lead: 'Legacy ad blockers frequently trigger black screens, infinite buffering spinners, or Twitch’s purple error screen when blocking mid-roll ads. Learn how SWEEPR DeepBlock’s MV3 DeepStealth engine neutralizes mid-roll video commercials cleanly.',
    faqQ1: 'Why do regular ad blockers cause black screens when blocking mid-roll ads?',
    faqA1: 'When a basic blocker drops an ad video request without neutralizing the player’s VAST state machine, the video player waits indefinitely for the missing segment. SWEEPR DeepBlock hooks the player state in the MAIN world so playback continues seamlessly.'
  },
  '/guides/how-to-block-sponsored-posts-and-crypto-bots-on-x-twitter': {
    title: 'How to Stop Spam Ads on Twitter / X (Block Promoted Tweets)',
    desc: 'Learn how to stop spam ads on Twitter (X) in 2026. Automatically hide promoted tweets, crypto scam replies, and tracking pixels with SWEEPR DeepBlock.',
    h1: 'How to Stop Spam Ads on Twitter / X (Block Promoted Posts & Crypto Scam Bots)',
    lead: 'Searching for how to stop spam ads on Twitter (X)? SWEEPR DeepBlock strips disguised "Ad" and "Promoted" posts from your For You timeline and comment threads while blocking malicious crypto drainer links.',
    faqQ1: 'How do I stop spam ads and promoted tweets on Twitter / X Web?',
    faqA1: 'SWEEPR DeepBlock inspects timeline DOM cells in real time, collapsing promoted tweet containers and stripping t.co outbound tracking parameters automatically.'
  },
  '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed': {
    title: 'Reddit Promoted Ad Blocker: Hide Sponsored Posts in Feed (2026)',
    desc: 'Looking for a Reddit promoted ad blocker? Automatically hide disguised "Promoted" posts in feeds and comment threads on Reddit Web with SWEEPR DeepBlock.',
    h1: 'Reddit Promoted Ad Blocker: How to Hide Sponsored Posts in Feeds & Comments',
    lead: 'Reddit disguises promoted advertisements as genuine user posts and top comments. SWEEPR DeepBlock acts as a surgical Reddit promoted ad blocker, hiding `<shreddit-ad-post>` and promoted comment units before they clutter your screen.',
    faqQ1: 'What is the best Reddit promoted ad blocker for Chrome and Firefox?',
    faqA1: 'SWEEPR DeepBlock strips both feed-level and comment-thread promoted ads on the modern Shreddit web interface while blocking Reddit pixel telemetry.'
  },
  '/vs/avast-secure-browser-guard': {
    title: 'Avast Secure Browser vs AdGuard vs SWEEPR DeepBlock (2026)',
    desc: 'Comparing Avast Secure Browser vs AdGuard vs SWEEPR DeepBlock? See 2026 benchmarks for YouTube MV3 ad blocking, cookie auto-rejection, and RAM usage.',
    h1: 'Avast Secure Browser Adblock vs AdGuard vs SWEEPR DeepBlock (2026 Benchmark)',
    lead: 'Comparing Avast Secure Browser’s built-in adblocker against AdGuard and SWEEPR DeepBlock? Review our 2026 head-to-head test covering YouTube Manifest V3 anti-detection, sub-50ms cookie consent rejection, and multi-tab memory consumption.',
    faqQ1: 'How does Avast Secure Browser compare to AdGuard and SWEEPR DeepBlock?',
    faqA1: 'While Avast Secure Browser and AdGuard provide network filtering, SWEEPR DeepBlock combines 8/8 MV3 video anti-detection with <50ms automatic cookie rejection, AI search slop cleansing, fake shop alerts, and a 62% Tab RAM Tamer in your existing browser.'
  },
  '/vs/total-adblock': {
    title: 'SWEEPR DeepBlock vs Total Adblock (2026 Pricing & Test Lab)',
    desc: 'Compare SWEEPR DeepBlock vs Total Adblock in 2026: 8/8 YouTube MV3 anti-detection, <50ms cookie auto-rejection, 62% RAM savings, and transparent pricing.',
    h1: 'SWEEPR DeepBlock vs Total Adblock: 2026 Feature, Renewal Pricing & Speed Audit'
  },
  '/solutions/1337x-torrent-indexer-block-video-ads': {
    title: '1337x Ads Blocker (2026): Stop 1337x Popunders & Fake Downloads',
    desc: 'Searching for how to block 1337x ads? SWEEPR DeepBlock stops 1337x pop-under redirects, fake download buttons, and VPN overlay banners in under 50ms.',
    h1: 'How to Block 1337x Ads, Pop-Under Redirects & Fake Download Overlays (2026)',
    lead: 'Tired of invisible click-jacking overlays, new-tab pop-unders, and deceptive download buttons when browsing 1337x? SWEEPR DeepBlock neutralizes 1337x ads at both the Manifest V3 network layer and the MAIN-world JavaScript layer in under 50ms.',
    faqQ1: 'How do I block 1337x ads and pop-under redirects on Chrome, Firefox, and Brave?',
    faqA1: 'Install SWEEPR DeepBlock to block 1337x ad-serving domains via declarativeNetRequest while neutralizing window.open click-jacking traps and fake download button overlays before they can trigger redirects.'
  },
  '/solutions/nyaa-si-anime-torrents-strip-tracking-parameters': {
    title: 'Nyaa.si AdBlock & Red Highlight Guide: Strip Tracker Links',
    desc: 'Understand Nyaa.si red highlight entries, block fake Nyaa mirror redirect ads, and automatically strip outbound tracking parameters with SWEEPR DeepBlock.',
    h1: 'Nyaa.si Red Highlight Guide, Fake Clone Protection & Tracker Blocker (2026)',
    lead: 'Wondering what a Nyaa.si red highlight torrent means or trying to stop malicious pop-under ads on unofficial Nyaa mirror clones? Learn how Nyaa.si color-codes remake/untrusted uploads and how SWEEPR DeepBlock blocks clone-site malvertising and tracking beacons.',
    faqQ1: 'What does a red highlight mean on Nyaa.si and how do I stay safe from clone ads?',
    faqA1: 'On Nyaa.si, a red/pink row highlight marks a Remake or re-encoded release (or an unverified upload without trusted status), whereas green rows indicate Trusted uploaders and blue rows indicate A+ batches. SWEEPR DeepBlock protects you on Nyaa and anime portals by blocking phishing mirror domains, pop-under scripts, and outbound URL trackers.'
  },
  '/solutions/soundgasm-audio-streaming-stop-malvertising-popunders': {
    title: 'Soundgasm Ad Blocker (2026): Stop Popunders & Cookie Banners',
    desc: 'Block intrusive pop-under redirects, fake audio player buttons, and repetitive cookie banners on Soundgasm and Reddit audio embeds with SWEEPR DeepBlock.',
    h1: 'Soundgasm Audio Streaming Ad & Pop-Under Blocker (2026 Privacy Guide)',
    lead: 'Listening to audio links on Soundgasm from Reddit or mobile browsers shouldn’t trigger unexpected redirect tabs or tracking cookies. SWEEPR DeepBlock keeps Soundgasm clean, private, and free of malvertising pop-unders.',
    faqQ1: 'Does SWEEPR DeepBlock stop redirect pop-ups and trackers on Soundgasm?',
    faqA1: 'Yes. SWEEPR DeepBlock blocks third-party ad scripts, strips Reddit out.reddit.com referral tracking tokens, and auto-declines cookie consent prompts in under 50ms.'
  },
  '/solutions/strava-fitness-activity-stop-malvertising-popunders': {
    title: 'Strava Web Ad & Tracker Blocker: Clean Up Feed & Route Maps',
    desc: 'Block sponsored challenges, third-party telemetry trackers, and cookie banners on Strava Web while keeping route maps fast with SWEEPR DeepBlock.',
    h1: 'Strava Web Ad, Promoted Challenge & Tracker Blocker (2026 Guide)',
    lead: 'Clean up your Strava Web activity feed and route builder. SWEEPR DeepBlock strips third-party marketing trackers, collapses promoted feed clutter, and reduces background tab RAM usage by up to 62%.',
    faqQ1: 'Can I use SWEEPR DeepBlock on Strava Web without breaking route maps?',
    faqA1: 'Yes. SWEEPR DeepBlock blocks third-party analytics and promotional clutter while whitelisting Mapbox/OpenStreetMap tile requests so Strava segments and GPX maps load at full speed.'
  },
  '/solutions/wattpad-web-novels-stop-malvertising-popunders': {
    title: 'Wattpad Ad Blocker (2026): Block Chapter Video Ads & Popups',
    desc: 'Read stories uninterrupted on Wattpad Web. SWEEPR DeepBlock blocks between-chapter video commercials, sticky banner ads, and cookie popups in <50ms.',
    h1: 'Wattpad Ad Blocker (2026): Read Web Novels Without Between-Chapter Ads',
    lead: 'Tired of video commercials, premium nag modals, and sticky banner ads interrupting chapters on Wattpad Web? SWEEPR DeepBlock strips Wattpad ad slots and auto-rejects cookie consent pop-ups in under 50ms.',
    faqQ1: 'How do I block ads between chapters on Wattpad Web?',
    faqA1: 'Install SWEEPR DeepBlock on Chrome, Firefox, Edge, or Brave. It blocks Wattpad’s programmatic banner and video ad auctions so you can scroll smoothly from chapter to chapter.'
  },
  '/vs/adblock-luna-vpn': {
    title: 'AdBlock Luna VPN vs SWEEPR DeepBlock (2026 Safety & Speed)',
    desc: 'Is AdBlock Luna VPN safe? Compare AdBlock Luna root certificate risks vs SWEEPR DeepBlock zero-telemetry MV3 browser & iOS DNS protection.',
    h1: 'AdBlock Luna VPN vs SWEEPR DeepBlock: 2026 Security, Privacy & YouTube Audit',
    lead: 'Evaluating AdBlock Luna VPN vs SWEEPR DeepBlock? Unlike AdBlock Luna—which routes traffic through a third-party VPN profile to monetize user browsing data—SWEEPR DeepBlock blocks YouTube ads, trackers, and cookie banners locally with zero traffic logging.',
    faqQ1: 'Why switch from AdBlock Luna VPN to SWEEPR DeepBlock in 2026?',
    faqA1: 'AdBlock Luna requires installing a VPN/profile that routes your traffic through third-party servers. SWEEPR DeepBlock executes 100% locally via Manifest V3 and encrypted DNS-over-HTTPS (DoH), delivering 8/8 YouTube anti-detection and <50ms cookie auto-rejection with zero data harvesting.'
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
const NON_CARTESIAN_CLUSTERS = new Set(['tools', 'glossary', 'campaigns', 'de', 'fr', 'stories', 'site']);

// Map every Cartesian/core HTML file to its clean URL path and metadata (excluding standalone non-Cartesian hubs)
const pageRecords = [];
for (const filePath of allHtmlFiles) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const cluster = rel.includes('/') ? rel.split('/')[0] : 'root';
  if (NON_CARTESIAN_CLUSTERS.has(cluster)) continue;
  const urlPath = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
  const isPillar = PILLAR_SET.has(urlPath);
  pageRecords.push({ filePath, rel, urlPath, isPillar, cluster });
}

// Sort deterministically
pageRecords.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

const pillarPages = pageRecords.filter((p) => p.isPillar);
const pseoPillarPages = pillarPages.filter((p) => p.cluster !== 'root');

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

const PROBLEM_FALLBACK_PILLAR = {
  '-block-video-ads': '/solutions/youtube-chrome-mv3-block-video-ads',
  '-auto-reject-cookie-popups': '/solutions/uk-news-websites-auto-reject-cookie-popups',
  '-filter-ai-slop-and-scams': '/solutions/google-search-results-filter-ai-slop-and-scams',
  '-protect-checkout-fake-shop-shield': '/solutions/facebook-marketplace-shops-filter-ai-slop-and-scams',
  '-remove-page-clutter-and-ram-bloat': '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '-reduce-browser-ram-usage': '/solutions/fandom-game-wikis-reduce-browser-ram-usage',
  '-stop-malvertising-popunders': '/solutions/dex-token-screeners-block-video-ads',
  '-strip-tracking-parameters': '/solutions/x-twitter-feed-ads-strip-tracking-parameters',
  '-bypass-anti-adblock-walls': '/guides/how-to-bypass-anti-adblock-inspect-element-blockers',
  '-stop-autoplay-floating-videos': '/solutions/fandom-game-wikis-block-video-ads',
  '-stop-notification-permission-spam': '/guides/how-to-stop-silent-web-push-notification-spam',
  '-encrypted-dns-doh-protection': '/guides/encrypted-dns-over-https-doh-browser-setup-guide',
  '-block-crypto-miners-cpu-drain': '/guides/how-to-block-tab-freeze-crypto-miner-scripts',
  '-block-sponsored-feed-carousels': '/solutions/reddit-promoted-posts-block-video-ads',
  '-clean-reader-distraction-free': '/solutions/recipe-food-blogs-reduce-browser-ram-usage',
  '-hibernate-idle-background-tabs': '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs',
  '-prevent-canvas-webrtc-fingerprinting': '/guides/how-to-stop-browser-canvas-fingerprinting-trackers'
};

const PLATFORM_PREFIX_ALIASES = {
  'fandom-game-lore-wikis': 'fandom-game-wikis',
  'kick-gambling-livestreams': 'kick-streaming-portals'
};

// Map platform prefix -> primary Pillar URL in /solutions/*
const platformToPillarUrl = new Map();
for (const p of pseoPillarPages) {
  if (p.cluster === 'solutions') {
    const slug = p.urlPath.replace(/^\/solutions\//, '');
    for (const suf of PROBLEM_SUFFIXES) {
      if (slug.endsWith(suf)) {
        const platPrefix = slug.slice(0, -suf.length);
        if (!platformToPillarUrl.has(platPrefix)) {
          platformToPillarUrl.set(platPrefix, p.urlPath);
        }
        break;
      }
    }
  }
}

function resolveConsolidatingPillarPath(rec) {
  if (rec.isPillar) return rec.urlPath;
  if (rec.cluster === 'solutions') {
    const slug = rec.urlPath.replace(/^\/solutions\//, '');
    for (const suf of PROBLEM_SUFFIXES) {
      if (slug.endsWith(suf)) {
        const rawPrefix = slug.slice(0, -suf.length);
        const platPrefix = PLATFORM_PREFIX_ALIASES[rawPrefix] || rawPrefix;
        if (platformToPillarUrl.has(platPrefix)) {
          return platformToPillarUrl.get(platPrefix);
        }
        if (PROBLEM_FALLBACK_PILLAR[suf] && PILLAR_SET.has(PROBLEM_FALLBACK_PILLAR[suf])) {
          return PROBLEM_FALLBACK_PILLAR[suf];
        }
      }
    }
    return '/solutions/youtube-chrome-mv3-block-video-ads';
  }
  if (rec.cluster === 'setup') return '/setup/google-chrome-manifest-v3';
  if (rec.cluster === 'vs') return '/vs/total-adblock';
  if (rec.cluster === 'guides') return '/guides/best-manifest-v3-adblockers-for-google-chrome-2026';
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
    ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/ \| SWEEPR DeepBlock.*$/i, '').replace(/ \| DeepBlock.*$/i, '').trim()
    : rec.urlPath;
  let badge = '2026 Verified Guide';
  if (rec.cluster === 'setup') badge = 'Browser Setup • MV3 & WebExtensions';
  else if (rec.cluster === 'solutions') badge = 'Platform Solution • Sub-50ms Protection';
  else if (rec.cluster === 'vs') badge = '2026 Head-to-Head Benchmark';
  else if (rec.cluster === 'guides') badge = 'Step-by-Step Privacy Guide';
  return { urlPath: rec.urlPath, badge, cardTitle: rawTitle };
}

const modifiedFilePaths = new Set();

function writeFileSafe(filePath, content) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedFilePaths.add(path.resolve(filePath));
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

  // 1. Update robots meta tag & canonical tag based on whether page is in the Authoritative Pillar Set
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
        `$1${escapeHtml(surgery.lead)}$2`
      );
    }

    // Update FAQ #1 in both visible HTML and FAQPage JSON-LD if provided
    if (surgery.faqQ1 && surgery.faqA1 && rec.urlPath !== '/vs/total-adblock') {
      html = html.replace(
        /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?)<\/script>/i,
        (fullMatch, jsonStr) => {
          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed.mainEntity) && parsed.mainEntity.length > 0) {
              parsed.mainEntity[0] = {
                '@type': 'Question',
                name: surgery.faqQ1,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: surgery.faqA1
                }
              };
            }
            return `<script type="application/ld+json">${JSON.stringify(parsed)}</script>`;
          } catch {
            return fullMatch;
          }
        }
      );

      // Update first visible FAQ box
      html = html.replace(
        /(<h2[^>]*>Frequently Asked Questions<\/h2>\s*<div[^>]*><h3[^>]*>)[\s\S]*?(<\/h3><p[^>]*>)[\s\S]*?(<\/p><\/div>)/i,
        `$1${escapeHtml(surgery.faqQ1)}$2${escapeHtml(surgery.faqA1)}$3`
      );
    }

    exactSurgeryApplied++;
  }

  if (html !== origHtml) {
    writeFileSafe(rec.filePath, html);
  }
}
console.log(`[CONSOLIDATE] Applied Exact-Query CTR Surgery to ${exactSurgeryApplied} top GSC pages.`);

// Precompute card metadata for all PSEO pillar pages (excluding custom /vs/total-adblock which has its own layout)
const pseoRingPages = pseoPillarPages.filter((rec) => rec.urlPath !== '/vs/total-adblock');
const pseoPillarCards = pseoRingPages.map((rec) => getPillarCardMeta(rec));
const pillarCardByPath = new Map(pseoPillarCards.map((c) => [c.urlPath, c]));

// Second pass: Rewire the 8-link internal link mesh on ALL PSEO pages (both the 285 Pillar pages AND the 1,293 noindex, follow secondary pages)
// so 100% of outgoing links across the entire site point EXCLUSIVELY to the 285 indexable Pillar Pages (zero links to noindex pages)
const M = pseoPillarCards.length;
const OFFSETS = [1, 2, 3, 5, 11, 23, 47, 89];
let meshUpdatedCount = 0;

const allPseoPages = pageRecords.filter((rec) => rec.cluster !== 'root' && rec.urlPath !== '/vs/total-adblock');
for (let i = 0; i < allPseoPages.length; i++) {
  const rec = allPseoPages[i];
  const origHtml = fs.readFileSync(rec.filePath, 'utf8');
  let html = origHtml;

  const relatedCards = [];
  const seen = new Set([rec.urlPath]);
  if (!rec.isPillar) {
    const parentPillarPath = resolveConsolidatingPillarPath(rec);
    const parentCard = pillarCardByPath.get(parentPillarPath);
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

  const newRelatedSection = `<section style="margin-top:36px;padding-top:24px;border-top:1px solid #1e293b;">
      <h2 style="font-size:1.3rem;margin:0 0 8px;">Related Browser Setups, Platform Solutions &amp; Guides</h2>
      <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 16px;">Explore verified 2026 SWEEPR DeepBlock configurations across popular platforms, browsers, and privacy benchmarks:</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        ${relatedCards.map((rc) => `<a href="${rc.urlPath}" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-bottom:4px;">${escapeHtml(rc.badge)}</div>
          <div style="font-size:0.92rem;font-weight:600;line-height:1.35;">${escapeHtml(rc.cardTitle)}</div>
        </a>`).join('\n        ')}
      </div>
    </section>`;

  if (/<section style="margin-top:36px;padding-top:24px;border-top:1px solid #1e293b;">[\s\S]*?<\/section>/i.test(html)) {
    html = html.replace(
      /<section style="margin-top:36px;padding-top:24px;border-top:1px solid #1e293b;">[\s\S]*?<\/section>/i,
      newRelatedSection
    );
    if (html !== origHtml) {
      writeFileSafe(rec.filePath, html);
    }
    meshUpdatedCount++;
  }
}
console.log(`[CONSOLIDATE] Rewired internal link mesh on ${meshUpdatedCount} pages to point exclusively to the ${M} PSEO Pillar Pages.`);

// Third pass: Rebuild website/sitemap.xml with ONLY the Authoritative Indexable Pillar Pages
// while preserving existing <lastmod> dates on unchanged pages (zero fake <lastmod> churn)
const todayStr = new Date().toISOString().slice(0, 10);
const existingLastModMap = new Map();
if (fs.existsSync(SITEMAP_PATH)) {
  const prevSm = fs.readFileSync(SITEMAP_PATH, 'utf8');
  for (const m of prevSm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    existingLastModMap.set(m[1].trim(), m[2].trim());
  }
}

const priorityMap = {
  '/': { changefreq: 'weekly', priority: '1.0' },
  '/pricing': { changefreq: 'weekly', priority: '0.9' },
  '/download': { changefreq: 'weekly', priority: '0.9' },
  '/test-lab': { changefreq: 'weekly', priority: '0.9' },
  '/vs/total-adblock': { changefreq: 'weekly', priority: '0.8' },
  '/support': { changefreq: 'monthly', priority: '0.6' },
  '/refund': { changefreq: 'monthly', priority: '0.5' },
  '/privacy': { changefreq: 'monthly', priority: '0.5' },
  '/terms': { changefreq: 'monthly', priority: '0.5' }
};

// Order root pages first, then setup, solutions, vs, guides
const orderedPillarPages = [...pillarPages].sort((a, b) => {
  const rank = (p) => {
    if (p.urlPath === '/') return 0;
    if (p.cluster === 'root') return 1;
    if (p.cluster === 'setup') return 2;
    if (p.cluster === 'solutions') return 3;
    if (p.cluster === 'vs') return 4;
    return 5;
  };
  const rDiff = rank(a) - rank(b);
  return rDiff !== 0 ? rDiff : a.urlPath.localeCompare(b.urlPath);
});

const sitemapEntries = orderedPillarPages.map((p) => {
  const meta = priorityMap[p.urlPath] || {
    changefreq: 'weekly',
    priority: GSC_PROVEN_PATHS.includes(p.urlPath) ? '0.85' : '0.8'
  };
  const loc = `https://sweeprdeepblock.com${p.urlPath}`;
  const wasModified = modifiedFilePaths.has(path.resolve(p.filePath));
  return {
    loc,
    lastmod: wasModified ? todayStr : (existingLastModMap.get(loc) || todayStr),
    changefreq: meta.changefreq,
    priority: meta.priority
  };
});

// Preserve all existing non-pruned hub URLs (/tools/*, /glossary/*, /stories/*, /de/*, /fr/*, /campaigns/*) in sitemap.xml
const seenSitemapLocs = new Set(sitemapEntries.map((e) => e.loc));
for (const [existingLoc, existingLastMod] of existingLastModMap.entries()) {
  if (seenSitemapLocs.has(existingLoc)) continue;
  const relPath = existingLoc.replace(/^https?:\/\/sweeprdeepblock\.com/i, '');
  if (/^\/(tools|glossary|stories|de|fr|campaigns)(\/|$)/i.test(relPath)) {
    seenSitemapLocs.add(existingLoc);
    sitemapEntries.push({
      loc: existingLoc,
      lastmod: existingLastMod || todayStr,
      changefreq: 'weekly',
      priority: '0.85'
    });
  }
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');
console.log(`[CONSOLIDATE] Wrote ${sitemapEntries.length} high-signal Pillar URLs to website/sitemap.xml.`);
