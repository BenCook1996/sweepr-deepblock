import {
  KEPT_REWRITE_PATHS,
  KEPT_URLS_SET,
  CONSOLIDATE_301_MAP,
  NOINDEX_PRUNE_SET,
  EXPLICIT_CONSOLIDATION_MAP,
  PILLAR_CONSOLIDATION_MAP,
  normalizeUrlPath,
  isNoIndexPrunePath,
  resolveConsolidationTarget,
  getM1Decision
} from './m1-decisions.mjs';

export {
  KEPT_REWRITE_PATHS,
  KEPT_URLS_SET,
  CONSOLIDATE_301_MAP,
  NOINDEX_PRUNE_SET,
  EXPLICIT_CONSOLIDATION_MAP,
  PILLAR_CONSOLIDATION_MAP,
  isNoIndexPrunePath,
  resolveConsolidationTarget,
  getM1Decision
};

export const SITE_ORIGIN = 'https://sweeprdeepblock.com';
export const ASSET_VERSION = '20261122';

export const PRODUCT_FACTS = Object.freeze({
  name: 'SWEEPR Deepblock',
  version: '1.4.0',
  staticDnrRules: 36019,
  staticRuleBreakdown: Object.freeze({
    adsAndTrackers: 20000,
    easyPrivacy: 12000,
    regionalEu: 4000,
    cryptominers: 18,
    trackerParams: 1
  }),
  trackerParamsStripped: 229,
  cmpFrameworks: 160,
  operatingSystem: 'Chrome, Microsoft Edge, Firefox, Safari (macOS & iOS), Brave, Opera, Windows, macOS, Linux, iOS, Android (Firefox)',
  browsersLabel: 'Chrome, Edge, Firefox, Safari, Brave & Opera',
  devicesIncluded: 5,
  pricing: Object.freeze({
    introMonthlyGbp: 1.99,
    monthlyStandardGbp: 4.99,
    sixMonthProGbp: 19.99,
    annualProGbp: 29.99,
    completeSuiteAnnualGbp: 89.99
  })
});

export const KEPT_DIRECTORY_95 = Object.freeze({
  core: [
    { href: '/', label: 'SWEEPR Deepblock Home' },
    { href: '/download', label: 'Browser Extension Downloads' },
    { href: '/pricing', label: 'Pricing & Pro Plans' },
    { href: '/benchmarks', label: 'v1.4.0 MV3 Benchmarks' },
    { href: '/test-lab', label: 'Free Adblock Test Lab' },
    { href: '/tools', label: 'Free Browser Privacy & RAM Tools' },
    { href: '/glossary', label: 'Manifest V3 & Privacy Glossary' },
    { href: '/support', label: 'Support & 1-Click Cancellation' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/refund', label: '14-Day Refund Policy' }
  ],
  locales: [
    { href: '/de', label: 'Deutsch (DE) Hub' },
    { href: '/fr', label: 'Français (FR) Hub' },
    { href: '/es', label: 'Español (ES) Hub' }
  ],
  tools: [
    { href: '/tools/browser-ram-calculator', label: 'Browser RAM & Tab Bloat Calculator' }
  ],
  vs: [
    { href: '/vs/total-adblock', label: 'vs Total Adblock (2026)' },
    { href: '/vs/ublock-origin-lite', label: 'vs uBlock Origin Lite (MV3)' },
    { href: '/vs/adguard-extension', label: 'vs AdGuard Extension' },
    { href: '/vs/adblock-plus', label: 'vs AdBlock Plus (ABP)' },
    { href: '/vs/ghostery-privacy-ad-blocker', label: 'vs Ghostery Tracker Blocker' },
    { href: '/vs/pie-adblock', label: 'vs Pie Adblock' },
    { href: '/vs/brave-shields', label: 'vs Brave Built-in Shields' },
    { href: '/vs/windscribe-robert-adblock', label: 'vs Windscribe R.O.B.E.R.T.' }
  ],
  setup: [
    { href: '/setup/arc-browser-windows-mac', label: 'Arc Browser Ad Blocker (Win & Mac)' },
    { href: '/setup/brave-browser-deepstealth', label: 'Brave Browser MV3 Setup' },
    { href: '/setup/brave-macos-apple-silicon', label: 'Brave Mac (Apple Silicon) Setup' },
    { href: '/setup/chromium-linux-ubuntu', label: 'Chromium Linux & Ubuntu Setup' },
    { href: '/setup/floorp-browser-firefox-fork', label: 'Floorp AdBlock & RAM Setup' },
    { href: '/setup/google-chrome-manifest-v3', label: 'Google Chrome Manifest V3 Setup' },
    { href: '/setup/kiwi-browser-android', label: 'Kiwi Browser Android Archive & Firefox Guide' },
    { href: '/setup/librewolf-hardened-firefox', label: 'LibreWolf Hardened Firefox Setup' },
    { href: '/setup/microsoft-edge-windows-11', label: 'Microsoft Edge Windows 11 Setup' },
    { href: '/setup/mozilla-firefox-desktop-android', label: 'Mozilla Firefox (Desktop & Android)' },
    { href: '/setup/opera-gx-gaming-browser', label: 'Opera & Opera GX Setup' },
    { href: '/setup/orion-browser-macos-ios', label: 'Orion Browser Ad Blocker (macOS)' },
    { href: '/setup/thorium-chromium-browser', label: 'Thorium AdBlock Setup' },
    { href: '/setup/ungoogled-chromium-mv3', label: 'Ungoogled Chromium MV3 Setup' },
    { href: '/setup/vivaldi-power-user-browser', label: 'Vivaldi Browser Setup' },
    { href: '/setup/waterfox-privacy-browser', label: 'Waterfox Privacy Browser Setup' },
    { href: '/setup/zen-browser-privacy-tabs', label: 'Zen Browser Privacy & RAM Setup' }
  ],
  guides: [
    { href: '/guides/how-to-automatically-reject-cookie-banners-uk', label: 'Auto-Reject Cookie Banners (UK & EU)' },
    { href: '/guides/how-to-block-reddit-sponsored-promoted-posts-in-feed', label: 'Block Reddit Promoted Posts' },
    { href: '/guides/how-to-block-sponsored-ads-on-google-search-2026', label: 'Block Google Sponsored Search Ads' },
    { href: '/guides/how-to-block-sponsored-ads-on-yahoo-finance', label: 'Block Yahoo Finance Video Ads' },
    { href: '/guides/how-to-block-sponsored-posts-and-crypto-bots-on-x-twitter', label: 'Block Promoted Posts on X / Twitter' },
    { href: '/guides/how-to-block-tab-freeze-crypto-miner-scripts', label: 'Block In-Browser Crypto Miners' },
    { href: '/guides/how-to-block-twitch-midroll-commercials-without-black-screen', label: 'Block Twitch Mid-Roll Ads Cleanly' },
    { href: '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026', label: 'Block YouTube Ads on Chrome MV3' },
    { href: '/guides/how-to-bypass-anti-adblock-inspect-element-blockers', label: 'Handle Anti-Adblock Overlays' },
    { href: '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock', label: 'Fix YouTube Anti-Adblock CPU Lag' },
    { href: '/guides/how-to-fix-high-ram-usage-on-vivaldi-browser', label: 'Fix High RAM Usage on Vivaldi' },
    { href: '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs', label: 'Reduce Browser RAM & Speed Up Tabs' },
    { href: '/guides/how-to-stop-facebook-meta-pixel-tracking', label: 'Block Meta Pixel Tracking Beacons' },
    { href: '/guides/how-to-stop-fake-robot-captcha-verification-popups', label: 'Stop Fake Robot Captcha Popups' },
    { href: '/guides/how-to-stop-malvertising-popunders-and-redirects', label: 'Stop Malvertising Popunders & Redirects' },
    { href: '/guides/how-to-stop-temu-shein-scam-popups-and-tracking', label: 'Stop Temu & Shein Popups & Trackers' },
    { href: '/guides/strip-utm-fbclid-gclid-tracking-links', label: 'Strip UTM, fbclid & gclid Trackers' }
  ],
  solutions: [
    { href: '/solutions/anilist-myanimelist-tracker-block-video-ads', label: 'AniList & MyAnimeList Ad Blocker' },
    { href: '/solutions/anime-streaming-portals-stop-malvertising-popunders', label: 'Anime Portals Pop-Under Blocker' },
    { href: '/solutions/automotive-car-classifieds-block-video-ads', label: 'Car Classifieds Video Ad Blocker' },
    { href: '/solutions/bilibili-anime-video-block-video-ads', label: 'Bilibili Web Video Ad Blocker' },
    { href: '/solutions/bing-copilot-search-reduce-browser-ram-usage', label: 'Bing Search Ad & RAM Optimization' },
    { href: '/solutions/coinmarketcap-crypto-prices-stop-malvertising-popunders', label: 'CoinMarketCap Pop-Under Shield' },
    { href: '/solutions/crunchyroll-anime-streams-block-video-ads', label: 'Crunchyroll Web Ad Blocker' },
    { href: '/solutions/curseforge-gaming-mods-stop-malvertising-popunders', label: 'CurseForge Mods Pop-Under Shield' },
    { href: '/solutions/dailymotion-vimeo-embeds-block-video-ads', label: 'Dailymotion & Vimeo Embed Ad Blocker' },
    { href: '/solutions/dex-token-screeners-block-video-ads', label: 'DEXScreener Ad & Banner Blocker' },
    { href: '/solutions/espn-sports-streaming-block-video-ads', label: 'ESPN Sports Web Ad Blocker' },
    { href: '/solutions/f1-motorsport-news-block-video-ads', label: 'Motorsport News Video Ad Blocker' },
    { href: '/solutions/fandom-game-wikis-reduce-browser-ram-usage', label: 'Fandom Wikis RAM & Ad Blocker' },
    { href: '/solutions/fextralife-game-wikis-stop-malvertising-popunders', label: 'Fextralife Wikis Embed & Pop-Under Shield' },
    { href: '/solutions/geeksforgeeks-dev-portals-block-video-ads', label: 'GeeksforGeeks Ad & Popup Blocker' },
    { href: '/solutions/github-copilot-dev-portals-block-video-ads', label: 'Developer Portals Ad & Tracker Shield' },
    { href: '/solutions/imdb-movie-database-block-video-ads', label: 'IMDb Video & Banner Ad Blocker' },
    { href: '/solutions/linkedin-feed-ads-block-video-ads', label: 'LinkedIn Promoted Feed Ad Blocker' },
    { href: '/solutions/lyrics-and-chords-tabs-block-video-ads', label: 'Lyrics & Guitar Tabs Ad Blocker' },
    { href: '/solutions/manga-comic-readers-block-video-ads', label: 'Manga Reader Sites Ad Blocker' },
    { href: '/solutions/mangadex-web-reader-block-video-ads', label: 'MangaDex Web Reader Clean Mode' },
    { href: '/solutions/nexus-mods-community-stop-malvertising-popunders', label: 'Nexus Mods Pop-Under & Banner Shield' },
    { href: '/solutions/online-chess-gaming-block-video-ads', label: 'Online Chess Sites Ad Blocker' },
    { href: '/solutions/quora-digest-answers-stop-malvertising-popunders', label: 'Quora Digest Popup & Ad Blocker' },
    { href: '/solutions/roblox-web-community-filter-ai-slop-and-scams', label: 'Roblox Web Ad & Popup Shield' },
    { href: '/solutions/rumble-video-streams-block-video-ads', label: 'Rumble Video Ad Blocker' },
    { href: '/solutions/smart-tv-web-browsers-block-video-ads', label: 'Streaming Web Browsers Ad Blocker' },
    { href: '/solutions/soundcloud-audio-player-block-video-ads', label: 'SoundCloud Web Ad Blocker' },
    { href: '/solutions/student-study-hubs-block-video-ads', label: 'Student Study Hubs Ad Blocker' },
    { href: '/solutions/substack-newsletter-blogs-auto-reject-cookie-popups', label: 'Substack Cookie Popup Auto-Reject' },
    { href: '/solutions/tech-gadget-review-blogs-auto-reject-cookie-popups', label: 'Tech Review Sites Cookie Auto-Reject' },
    { href: '/solutions/threads-web-feed-stop-malvertising-popunders', label: 'Threads Web Tracker & Ad Shield' },
    { href: '/solutions/tiktok-web-reels-reduce-browser-ram-usage', label: 'TikTok Web Ad & RAM Optimization' },
    { href: '/solutions/tradingview-charts-web-reduce-browser-ram-usage', label: 'TradingView Web Ad & RAM Optimization' },
    { href: '/solutions/tumblr-blog-feeds-block-video-ads', label: 'Tumblr Sponsored Post & Ad Blocker' },
    { href: '/solutions/uk-news-websites-auto-reject-cookie-popups', label: 'UK News Cookie Banner Auto-Reject' },
    { href: '/solutions/webtoon-manhwa-readers-block-video-ads', label: 'Webtoon & Manhwa Ad Blocker' },
    { href: '/solutions/x-twitter-feed-ads-block-video-ads', label: 'X (Twitter) Feed Ad Blocker' }
  ]
});

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isDeprecatedSchemaNode(node) {
  if (!node || typeof node !== 'object') return false;
  const t = node['@type'];
  if (t === 'FAQPage' || t === 'HowTo') return true;
  if (Array.isArray(t) && (t.includes('FAQPage') || t.includes('HowTo'))) return true;
  return false;
}

export function buildJsonLd({
  canonicalUrl,
  breadcrumbs = [],
  includeSoftwareApp = true,
  softwareName = 'SWEEPR Deepblock',
  article = null,
  extraGraph = []
} = {}) {
  const graph = [];

  if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: String(b.name || ''),
        item: b.item ? (String(b.item).startsWith('http') ? String(b.item) : `${SITE_ORIGIN}${b.item}`) : canonicalUrl
      }))
    });
  }

  if (includeSoftwareApp) {
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${SITE_ORIGIN}/#software`,
      name: softwareName,
      softwareVersion: PRODUCT_FACTS.version,
      url: canonicalUrl || `${SITE_ORIGIN}/`,
      downloadUrl: `${SITE_ORIGIN}/download`,
      operatingSystem: PRODUCT_FACTS.operatingSystem,
      applicationCategory: 'SecurityApplication',
      featureList: `${PRODUCT_FACTS.staticDnrRules.toLocaleString('en-US')} static Manifest V3 declarativeNetRequest rules across 5 rulesets, GDPR cookie consent auto-rejection across ${PRODUCT_FACTS.cmpFrameworks} CMP frameworks, ${PRODUCT_FACTS.trackerParamsStripped}-parameter URL tracking stripping, Element Zapper, Anti-Adblock stealth, Total Tab & RAM Tamer, and no-card 7-day full Pro trial`,
      author: {
        '@type': 'Organization',
        name: 'SWEEPR Global Limited',
        url: `${SITE_ORIGIN}/`
      },
      publisher: {
        '@type': 'Organization',
        name: 'SWEEPR Global Limited',
        url: `${SITE_ORIGIN}/`
      },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '1.99',
        highPrice: '89.99',
        priceCurrency: 'GBP',
        offerCount: '4',
        url: `${SITE_ORIGIN}/pricing`,
        priceValidUntil: '2027-12-31',
        validFrom: '2026-01-01',
        offers: [
          {
            '@type': 'Offer',
            name: 'Monthly Plan (1st Month Intro)',
            price: '1.99',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2027-12-31',
            validFrom: '2026-01-01',
            url: `${SITE_ORIGIN}/order?plan=monthly`
          },
          {
            '@type': 'Offer',
            name: '6-Month Plan',
            price: '19.99',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2027-12-31',
            validFrom: '2026-01-01',
            url: `${SITE_ORIGIN}/order?plan=six_month`
          },
          {
            '@type': 'Offer',
            name: 'Annual Pro Plan',
            price: '29.99',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2027-12-31',
            validFrom: '2026-01-01',
            url: `${SITE_ORIGIN}/order?plan=annual`
          },
          {
            '@type': 'Offer',
            name: 'Sweepr Complete Security Suite (Annual Bundle)',
            price: '89.99',
            priceCurrency: 'GBP',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2027-12-31',
            validFrom: '2026-01-01',
            url: `${SITE_ORIGIN}/order?plan=suite_annual`
          }
        ]
      }
    });
  }

  if (article && typeof article === 'object' && !isDeprecatedSchemaNode(article)) {
    graph.push({
      '@type': article['@type'] || 'TechArticle',
      headline: article.headline || '',
      description: article.description || '',
      url: article.url || canonicalUrl,
      datePublished: article.datePublished || '2026-11-22',
      dateModified: article.dateModified || new Date().toISOString().slice(0, 10),
      author: {
        '@type': 'Organization',
        name: 'SWEEPR Global Limited',
        url: `${SITE_ORIGIN}/`
      },
      publisher: {
        '@type': 'Organization',
        name: 'SWEEPR Global Limited',
        url: `${SITE_ORIGIN}/`
      }
    });
  }

  if (Array.isArray(extraGraph)) {
    for (const node of extraGraph) {
      if (node && typeof node === 'object' && !isDeprecatedSchemaNode(node)) {
        graph.push(node);
      }
    }
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

export function renderHead({
  title,
  description,
  canonicalUrl,
  lang = 'en',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogType = 'article',
  hreflangs = null,
  jsonLd = null,
  extraHead = '',
  assetVersion = ASSET_VERSION
} = {}) {
  const safeTitle = escapeHtml(title || 'SWEEPR Deepblock');
  const safeDesc = escapeHtml(description || 'Block video and banner ads, automatically reject GDPR cookie pop-ups, strip URL tracking parameters, and tame background tab RAM.');
  const safeCanonical = escapeHtml(canonicalUrl || `${SITE_ORIGIN}/`);
  const safeRobots = escapeHtml(robots);
  const safeOgType = escapeHtml(ogType);

  let hreflangLinks = '';
  if (Array.isArray(hreflangs) && hreflangs.length > 0) {
    hreflangLinks = hreflangs
      .map((h) => `  <link rel="alternate" hreflang="${escapeHtml(h.lang)}" href="${escapeHtml(h.href)}" />`)
      .join('\n') + '\n';
  }

  let jsonLdBlock = '';
  if (jsonLd) {
    let payload = jsonLd;
    if (typeof jsonLd === 'object') {
      if (Array.isArray(jsonLd['@graph'])) {
        payload = {
          ...jsonLd,
          '@graph': jsonLd['@graph'].filter((n) => !isDeprecatedSchemaNode(n))
        };
      } else if (isDeprecatedSchemaNode(jsonLd)) {
        payload = null;
      }
    }
    if (payload) {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
      jsonLdBlock = `  <script type="application/ld+json">${serialized.replace(/<\/script/gi, '<\\/script')}</script>\n`;
    }
  }

  const ogLocale = lang === 'de' ? 'de_DE' : lang === 'fr' ? 'fr_FR' : lang === 'es' ? 'es_ES' : 'en_GB';

  return `<head>
  <meta name="color-scheme" content="light">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <meta name="description" content="${safeDesc}">
  <meta name="robots" content="${safeRobots}" />
  <meta name="author" content="SWEEPR Global Limited">
  <meta name="theme-color" content="#ffffff">
  <link rel="canonical" href="${safeCanonical}" />
${hreflangLinks}  <meta property="og:type" content="${safeOgType}">
  <meta property="og:site_name" content="SWEEPR Deepblock">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safeCanonical}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png">
  <link rel="stylesheet" href="/sweepr-tailwind.min.css?v=${escapeHtml(assetVersion)}">
  <link rel="stylesheet" href="/style.css?v=${escapeHtml(assetVersion)}">
  <script src="/nav.js?v=${escapeHtml(assetVersion)}" defer></script>
  <script src="/i18n.js" defer></script>
${jsonLdBlock}  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', {
      transport_url: window.location.origin + '/metrics',
      first_party_collection: true
    });
    (function(){
      if (window.__sweeprMetricsScheduled) return;
      window.__sweeprMetricsScheduled = true;
      var loaded = false;
      function loadMetrics() {
        if (loaded || document.querySelector('script[src*="/metrics/js"]')) return;
        loaded = true;
        var s = document.createElement('script');
        s.async = true;
        s.src = '/metrics/js?id=G-01MNBQSL9K';
        document.head.appendChild(s);
      }
      ['pointerdown','keydown','scroll','touchstart'].forEach(function(ev){
        window.addEventListener(ev, loadMetrics, { once: true, passive: true });
      });
      window.addEventListener('load', function(){
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(loadMetrics, { timeout: 3500 });
        } else {
          setTimeout(loadMetrics, 3500);
        }
      }, { once: true });
    })();
  </script>
${extraHead ? extraHead + '\n' : ''}</head>`;
}

export function renderNav({ currentPath = '/', lang = 'en' } = {}) {
  const featuresHref = '/#features';
  const isPricing = currentPath === '/pricing';
  const isCompare = currentPath.startsWith('/vs') || currentPath.startsWith('/guides');
  const isLogin = currentPath === '/login';

  const pricingLink = isPricing
    ? '<a href="/pricing" class="btn text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">Pricing</a>'
    : '<a href="/pricing" class="btn btn-ghost text-sm">Pricing</a>';

  const compareBtn = isCompare
    ? '<button type="button" id="navDropdownBtn" class="btn text-sm flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200" aria-expanded="false" aria-haspopup="true">'
    : '<button type="button" id="navDropdownBtn" class="btn btn-ghost text-sm flex items-center gap-1.5 cursor-pointer font-medium" aria-expanded="false" aria-haspopup="true">';

  const loginLink = isLogin
    ? '<a rel="nofollow" href="/login" class="btn text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 !px-2.5 sm:!px-4 !h-9 sm:!h-11">Login</a>'
    : '<a rel="nofollow" href="/login" class="btn btn-ghost text-xs sm:text-sm !px-2.5 sm:!px-4 !h-9 sm:!h-11">Login</a>';

  const langMeta = lang === 'de'
    ? { flag: '🇩🇪', code: 'DE' }
    : lang === 'fr'
    ? { flag: '🇫🇷', code: 'FR' }
    : lang === 'es'
    ? { flag: '🇪🇸', code: 'ES' }
    : { flag: '🇬🇧', code: 'EN' };

  return `  <nav class="glass-nav px-3 sm:px-4 md:px-6 py-3 sm:py-3.5 md:py-4 flex items-center justify-between">
    <div class="flex items-center gap-2 md:gap-8 min-w-0">
      <a href="/" class="flex items-center gap-2 sm:gap-3 text-inherit no-underline min-w-0">
        <div class="logo-box !w-8 !h-8 sm:!w-10 sm:!h-10" aria-hidden="true"></div>
        <span class="font-extrabold text-sm sm:text-xl tracking-tight text-gray-900 truncate">SWEEPR <span class="text-emerald-600">Deepblock</span></span>
      </a>
      <div class="hidden md:flex items-center gap-2">
        <a href="${featuresHref}" class="btn btn-ghost text-sm">Features</a>
        ${pricingLink}
        <div class="relative inline-block text-left" id="navDropdownContainer">
          ${compareBtn}
            <span>Compare &amp; Guides</span>
            <svg id="navDropdownChevron" class="w-3.5 h-3.5 text-gray-500 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div id="navDropdownMenu" class="hidden absolute left-0 md:left-1/2 md:-translate-x-1/2 mt-2 w-[340px] sm:w-[430px] bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-2xl p-2.5 z-50 transition-all">
            <div class="grid grid-cols-1 gap-1.5">
              <a href="/vs/total-adblock" class="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/60 transition-all text-inherit no-underline group">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1 mb-0.5">
                    <span class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">SWEEPR Deepblock vs Total Adblock</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Comparison</span>
                  </div>
                  <p class="text-xs text-gray-500 leading-snug">See how SWEEPR Deepblock compares on YouTube ads, automatic cookie pop-up closing, URL tracker stripping, and honest pricing.</p>
                </div>
              </a>
              <a href="/pricing" class="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/60 transition-all text-inherit no-underline group">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1 mb-0.5">
                    <span class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">Total Tab &amp; RAM Tamer</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Included in Pro</span>
                  </div>
                  <p class="text-xs text-gray-500 leading-snug">Automatically hibernates inactive background tabs to reduce browser memory usage.</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-1.5 sm:gap-2 md:gap-3 items-center shrink-0">
      <div class="relative inline-block text-left" id="langDropdownContainer">
        <button type="button" id="langDropdownBtn" class="btn btn-ghost text-sm flex items-center gap-1 sm:gap-1.5 !px-2 sm:!px-2.5 !h-9 sm:!h-11 cursor-pointer font-medium text-gray-700 hover:text-emerald-600 transition-colors" aria-expanded="false" aria-label="Select Language">
          <span class="text-base" id="currentLangFlag">${langMeta.flag}</span>
          <span class="text-xs font-bold tracking-wide" id="currentLangCode">${langMeta.code}</span>
          <svg id="langDropdownChevron" class="w-3 h-3 text-gray-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="langDropdownMenu" class="hidden absolute right-0 mt-2 w-44 bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-xl p-1.5 z-50 transition-all">
          <div class="space-y-0.5 text-xs">
            <a href="/" hreflang="en" onclick="if(window.setLanguage)setLanguage('en',false)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium no-underline cursor-pointer"><span>🇬🇧 English</span><span class="text-[10px] text-gray-400 font-mono">EN</span></a>
            <a href="/de" hreflang="de" onclick="if(window.setLanguage)setLanguage('de',false)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium no-underline cursor-pointer"><span>🇩🇪 Deutsch</span><span class="text-[10px] text-gray-400 font-mono">DE</span></a>
            <a href="/fr" hreflang="fr" onclick="if(window.setLanguage)setLanguage('fr',false)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium no-underline cursor-pointer"><span>🇫🇷 Français</span><span class="text-[10px] text-gray-400 font-mono">FR</span></a>
            <a href="/es" hreflang="es" onclick="if(window.setLanguage)setLanguage('es',false)" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium no-underline cursor-pointer"><span>🇪🇸 Español</span><span class="text-[10px] text-gray-400 font-mono">ES</span></a>
          </div>
        </div>
      </div>
      ${loginLink}
      <a href="/download?install=1" class="hidden md:inline-flex btn btn-go gap-2">
        <span>Add to Browser</span>
        <svg class="arrow-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
    </div>
  </nav>`;
}

export function renderMainOpen({ maxWidth = 'max-w-5xl', extraClasses = 'space-y-8' } = {}) {
  const mw = ['max-w-3xl', 'max-w-4xl', 'max-w-5xl', 'max-w-6xl'].includes(maxWidth) ? maxWidth : 'max-w-5xl';
  const extra = String(extraClasses || '').trim();
  const suffix = extra ? ` ${extra}` : '';
  if (mw === 'max-w-3xl') {
    return `  <main class="flex-1 w-full min-w-0 pt-24 sm:pt-32 pb-16 px-4 sm:px-6 max-w-3xl mx-auto${suffix}">`;
  }
  if (mw === 'max-w-4xl') {
    return `  <main class="flex-1 w-full min-w-0 pt-24 sm:pt-32 pb-16 px-4 sm:px-6 max-w-4xl mx-auto${suffix}">`;
  }
  if (mw === 'max-w-6xl') {
    return `  <main class="flex-1 w-full min-w-0 pt-24 sm:pt-32 pb-16 px-4 sm:px-6 max-w-6xl mx-auto${suffix}">`;
  }
  return `  <main class="flex-1 w-full min-w-0 pt-24 sm:pt-32 pb-16 px-4 sm:px-6 max-w-5xl mx-auto${suffix}">`;
}

export function renderMainClose() {
  return '  </main>';
}

export function renderBreadcrumbs(items = []) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const parts = items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    const label = escapeHtml(item.name || item.label || '');
    const href = item.href || item.item;
    if (isLast || !href) {
      return `<span class="text-gray-700 font-semibold">${label}</span>`;
    }
    return `<a href="${escapeHtml(href)}" class="text-emerald-700 hover:underline font-medium">${label}</a>`;
  });
  return `<nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
      ${parts.join('<span aria-hidden="true" class="text-gray-400">/</span>')}
    </nav>`;
}

export function renderGlassCard({ title = '', badge = '', bodyHtml = '', id = '', extraClasses = '' } = {}) {
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  const extra = extraClasses ? ` ${extraClasses}` : '';
  const badgeHtml = badge
    ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">${escapeHtml(badge)}</span>`
    : '';
  const headerHtml = title
    ? `<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(title)}</h2>
        ${badgeHtml}
      </div>`
    : '';
  return `<section${idAttr} class="glass-card p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl shadow-sm${extra}">
      ${headerHtml}
      ${bodyHtml}
    </section>`;
}

export function renderComparisonTable({ headers = [], rows = [], caption = '', id = '' } = {}) {
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  const capHtml = caption
    ? `<caption class="sr-only">${escapeHtml(caption)}</caption>`
    : '';
  const thHtml = headers
    .map((h) => `<th scope="col" class="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600">${escapeHtml(h)}</th>`)
    .join('');
  const trHtml = rows
    .map((row) => {
      const cells = Array.isArray(row) ? row : [];
      const tdHtml = cells
        .map((cell, idx) =>
          idx === 0
            ? `<td class="px-4 py-3.5 font-semibold text-gray-900">${escapeHtml(cell)}</td>`
            : `<td class="px-4 py-3.5 text-gray-700">${escapeHtml(cell)}</td>`
        )
        .join('');
      return `<tr class="hover:bg-emerald-50/30 transition-colors">${tdHtml}</tr>`;
    })
    .join('\n          ');

  return `<section${idAttr} class="glass-card bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse text-sm">
          ${capHtml}
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>${thHtml}</tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${trHtml}
          </tbody>
        </table>
      </div>
    </section>`;
}

export function renderCallout({ title = '', bodyHtml = '', tone = 'emerald' } = {}) {
  const titleHtml = title
    ? `<h3 class="text-base font-extrabold text-gray-900 mb-1.5">${escapeHtml(title)}</h3>`
    : '';
  if (tone === 'amber') {
    return `<div class="bg-amber-50 border border-amber-200 border-l-4 rounded-2xl p-5 text-sm text-amber-900 leading-relaxed" style="border-left-color:#f59e0b;">
      ${titleHtml}
      <div>${bodyHtml}</div>
    </div>`;
  }
  if (tone === 'slate') {
    return `<div class="bg-slate-50 border border-slate-200 border-l-4 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed" style="border-left-color:#64748b;">
      ${titleHtml}
      <div>${bodyHtml}</div>
    </div>`;
  }
  return `<div class="bg-emerald-50/70 border border-emerald-200 border-l-4 rounded-2xl p-5 text-sm text-gray-800 leading-relaxed" style="border-left-color:#059669;">
      ${titleHtml}
      <div>${bodyHtml}</div>
    </div>`;
}

export function renderCtaBanner({
  badge = `SWEEPR Deepblock v${PRODUCT_FACTS.version}`,
  heading = 'Block Ads, Cookie Pop-Ups & Trackers in Seconds',
  subtext = `${PRODUCT_FACTS.staticDnrRules} static Manifest V3 declarativeNetRequest rules, automated cookie banner rejection, URL tracker stripping, and Total Tab & RAM Tamer across ${PRODUCT_FACTS.devicesIncluded} devices.`,
  primaryLabel = 'Install Free Extension',
  primaryHref = '/download?install=1',
  secondaryLabel = 'Compare Pro Plans',
  secondaryHref = '/pricing'
} = {}) {
  const secRel = secondaryHref.startsWith('/order') || secondaryHref.startsWith('/login') ? ' rel="nofollow"' : '';
  const priRel = primaryHref.startsWith('/order') || primaryHref.startsWith('/login') ? ' rel="nofollow"' : '';
  return `<section class="glass-card p-6 sm:p-8 bg-white border border-emerald-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      <div class="space-y-2 max-w-2xl">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">${escapeHtml(badge)}</span>
        <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(heading)}</h2>
        <p class="text-sm text-gray-600 leading-relaxed">${escapeHtml(subtext)}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
        <a${priRel} href="${escapeHtml(primaryHref)}" class="btn btn-go px-5 py-3 rounded-xl font-bold text-sm justify-center no-underline">${escapeHtml(primaryLabel)}</a>
        <a${secRel} href="${escapeHtml(secondaryHref)}" class="btn px-5 py-3 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 justify-center no-underline">${escapeHtml(secondaryLabel)}</a>
      </div>
    </section>`;
}

export function renderRelatedGrid({ heading = 'Related Guides & Resources', items = [] } = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const cards = items
    .map(
      (it) => `<a href="${escapeHtml(it.href)}" class="glass-card p-4 bg-white border border-slate-200/90 hover:border-emerald-400 rounded-2xl no-underline transition-all block">
        <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">${escapeHtml(it.badge || 'Guide')}</div>
        <div class="text-sm font-bold text-slate-900 leading-snug">${escapeHtml(it.label)}</div>
      </a>`
    )
    .join('\n      ');
  return `<section data-sweepr-related="1" class="mt-10 pt-8 border-t border-slate-200 space-y-4">
      <h2 class="text-xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(heading)}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${cards}
      </div>
    </section>`;
}

const CORE_FOOTER_LEGAL_PATHS = new Set([
  '/',
  '/download',
  '/pricing',
  '/benchmarks',
  '/test-lab',
  '/support',
  '/terms',
  '/refund',
  '/privacy'
]);

export function renderFooter({ currentPath = '/', lang = 'en', includeMobileStickyCta = true } = {}) {
  const normPath = normalizeUrlPath(String(currentPath || '/').split('?')[0].split('#')[0]).toLowerCase();
  const includeLegalAndGlossary = CORE_FOOTER_LEGAL_PATHS.has(normPath);

  const renderList = (items) =>
    items
      .map(
        (it) =>
          `<li><a href="${escapeHtml(it.href)}" class="hover:text-emerald-600 transition-colors">${escapeHtml(it.label)}</a></li>`
      )
      .join('\n              ');

  const coreDrawerItems = includeLegalAndGlossary
    ? KEPT_DIRECTORY_95.core
    : KEPT_DIRECTORY_95.core.filter((it) => it.href !== '/privacy' && it.href !== '/glossary');

  const col1 = [...KEPT_DIRECTORY_95.setup, ...KEPT_DIRECTORY_95.vs];
  const col2 = KEPT_DIRECTORY_95.solutions.slice(0, 20);
  const col3 = KEPT_DIRECTORY_95.solutions.slice(20);
  const col4 = [
    ...KEPT_DIRECTORY_95.guides,
    ...KEPT_DIRECTORY_95.tools,
    ...coreDrawerItems,
    ...KEPT_DIRECTORY_95.locales
  ];

  const stickyCta = includeMobileStickyCta
    ? `
  <div class="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-200/90 px-4 py-2.5 flex items-center justify-between gap-3 md:hidden shadow-2xl" style="padding-bottom: max(0.625rem, env(safe-area-inset-bottom));">
    <div class="min-w-0">
      <div class="text-xs font-extrabold text-gray-900 truncate">SWEEPR Deepblock</div>
      <div class="text-[11px] font-semibold text-emerald-700 truncate">14-Day Money-Back Guarantee</div>
    </div>
    <a href="/download?install=1" id="mobileStickyDownloadBtn" class="btn btn-go !h-11 min-h-[44px] !px-4 !rounded-xl text-xs gap-1.5 shrink-0">
      <span>Install Now</span>
      <svg class="arrow-icon w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
    </a>
  </div>`
    : '';

  const yearLabel = lang === 'de' ? 'Alle Rechte vorbehalten.' : lang === 'fr' ? 'Tous droits réservés.' : lang === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.';
  const glossaryFooterLink = includeLegalAndGlossary
    ? '\n        <a href="/glossary" class="hover:text-emerald-600 transition-colors">Glossary</a>'
    : '';
  const privacyFooterLink = includeLegalAndGlossary
    ? '\n        <a href="/privacy" class="hover:text-emerald-600 transition-colors">Privacy Policy</a>'
    : '';

  return `  <footer class="mt-auto pt-8 pb-24 md:pb-8 text-center text-gray-500 text-xs sm:text-sm border-t border-gray-200/70">
    <div class="max-w-5xl mx-auto px-4">
      <div class="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-3 font-medium text-gray-600">
        <a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>
        <a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>
        <a href="/solutions" class="hover:text-emerald-600 transition-colors">Solutions</a>
        <a href="/setup" class="hover:text-emerald-600 transition-colors">Setups</a>
        <a href="/guides" class="hover:text-emerald-600 transition-colors">Guides</a>
        <a href="/tools" class="hover:text-emerald-600 transition-colors">Diagnostic Tools</a>
        <a href="/test-lab" class="hover:text-emerald-600 transition-colors">Free Adblock Test Lab</a>
        <a href="/benchmarks" class="hover:text-emerald-600 transition-colors">Benchmarks</a>${glossaryFooterLink}
        <a href="/vs/total-adblock" class="hover:text-emerald-600 transition-colors">vs Total Adblock</a>
        <a href="/download" class="hover:text-emerald-600 transition-colors">Browser Extension</a>
        <a href="/de" hreflang="de" class="hover:text-emerald-600 transition-colors">Deutsch (DE)</a>
        <a href="/fr" hreflang="fr" class="hover:text-emerald-600 transition-colors">Français (FR)</a>
        <a href="/es" hreflang="es" class="hover:text-emerald-600 transition-colors">Español (ES)</a>
        <a rel="nofollow" href="/login" class="hover:text-emerald-600 transition-colors">Customer Portal</a>
        <a href="/support" class="hover:text-emerald-600 transition-colors">Support &amp; Help</a>${privacyFooterLink}
        <a href="/terms" class="hover:text-emerald-600 transition-colors">Terms of Service</a>
        <a href="/refund" class="hover:text-emerald-600 transition-colors">Refund Policy</a>
      </div>

      <details class="group text-center">
        <summary class="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer list-none select-none py-1">
          <span>&copy; 2026 SWEEPR Global Limited. ${escapeHtml(yearLabel)}</span>
          <span aria-hidden="true">&middot;</span>
          <span class="font-semibold text-gray-500 group-hover:text-emerald-700 inline-flex items-center gap-1 transition-colors">
            <span>All 95 Setup Guides, Comparisons &amp; Tools</span>
            <span class="text-emerald-600 transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div class="mt-4 p-5 rounded-2xl border border-gray-200/80 bg-white text-left grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs text-gray-500 shadow-xs">
          <div>
            <div class="font-bold text-gray-800 uppercase tracking-wider mb-2 text-[11px]">Setup Guides &amp; Comparisons</div>
            <ul class="space-y-1.5">
              ${renderList(col1)}
            </ul>
          </div>
          <div>
            <div class="font-bold text-gray-800 uppercase tracking-wider mb-2 text-[11px]">Platform Ad Solutions</div>
            <ul class="space-y-1.5">
              ${renderList(col2)}
            </ul>
          </div>
          <div>
            <div class="font-bold text-gray-800 uppercase tracking-wider mb-2 text-[11px]">Streaming, Wikis &amp; Feeds</div>
            <ul class="space-y-1.5">
              ${renderList(col3)}
            </ul>
          </div>
          <div>
            <div class="font-bold text-gray-800 uppercase tracking-wider mb-2 text-[11px]">Guides, Tools &amp; Core</div>
            <ul class="space-y-1.5">
              ${renderList(col4)}
            </ul>
          </div>
        </div>
      </details>
    </div>
  </footer>${stickyCta}`;
}

export function renderShellPage({
  title,
  description,
  canonicalUrl,
  currentPath = '/',
  lang = 'en',
  htmlLang = '',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogType = 'article',
  hreflangs = null,
  jsonLd = null,
  breadcrumbs = [],
  includeSoftwareApp = true,
  article = null,
  extraGraph = [],
  extraHead = '',
  maxWidth = 'max-w-5xl',
  mainExtraClasses = 'space-y-8',
  contentHtml = '',
  includeMobileStickyCta = true,
  assetVersion = ASSET_VERSION
} = {}) {
  const effectiveLangAttr = htmlLang || (lang === 'en' ? 'en-GB' : lang);
  const resolvedJsonLd = jsonLd || buildJsonLd({
    canonicalUrl,
    breadcrumbs,
    includeSoftwareApp,
    article,
    extraGraph
  });

  const headHtml = renderHead({
    title,
    description,
    canonicalUrl,
    lang,
    robots,
    ogType,
    hreflangs,
    jsonLd: resolvedJsonLd,
    extraHead,
    assetVersion
  });

  const navHtml = renderNav({ currentPath, lang });
  const mainOpen = renderMainOpen({ maxWidth, extraClasses: mainExtraClasses });
  const mainClose = renderMainClose();
  const footerHtml = renderFooter({ currentPath, lang, includeMobileStickyCta });

  return `<!DOCTYPE html>
<html lang="${escapeHtml(effectiveLangAttr)}">
${headHtml}
<body class="text-gray-800">
${navHtml}
${mainOpen}
${contentHtml}
${mainClose}
${footerHtml}
</body>
</html>
`;
}
