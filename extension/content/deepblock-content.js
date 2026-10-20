// SWEEPR Deepblock — Real-Time Content Script
// 1. GDPR Cookie Banner Detector & Auto-Rejector
// 2. AI Slop & SEO Content-Farm SERP Purifier
// 3. Recipe & News Clutter Stripper (PureView)
// 4. Fake E-Commerce Store & Amazon Review Authenticity Detector

(function () {
  const CMP_SELECTORS = [
    '#onetrust-banner-sdk',
    '#CybotCookiebotDialog',
    '.qc-cmp2-container',
    '#didomi-host',
    '#usercentrics-root',
    '[id*="cookie-banner" i]',
    '[class*="cookie-consent" i]'
  ];

  const CMP_REJECT_BUTTONS = [
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '.qc-cmp2-summary-buttons button[mode="secondary"]',
    '.didomi-continue-without-agreeing',
    'button[aria-label*="reject" i]',
    'button[aria-label*="decline" i]'
  ];

  const AI_SLOP_PATTERNS = [
    /best-.*-reviews-\d{4}/i,
    /ai-generated-guide/i,
    /content-farm/i,
    /top10-affiliate-spam/i
  ];

  function reportMetric(metric, amount = 1) {
    try {
      chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric, amount });
    } catch (e) {}
  }

  // 1. GDPR Cookie Banner Handling
  function processCookieBanners(proActive) {
    const foundBanner = document.querySelector(CMP_SELECTORS.join(','));
    if (!foundBanner) return;

    reportMetric('cookiePromptsDetected', 1);

    if (proActive) {
      let clicked = false;
      for (const sel of CMP_REJECT_BUTTONS) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
        const rejectBtn = buttons.find((b) =>
          /^(reject all|decline all|necessary only|essential only|refuse all|continue without accepting)$/i.test(
            (b.textContent || '').trim()
          )
        );
        if (rejectBtn) {
          rejectBtn.click();
          clicked = true;
        }
      }

      // Unlock page scroll if frozen by CMP modal
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
      reportMetric('cookiePromptsRejected', 1);
    }
  }

  // 2. AI Slop & SEO Content-Farm SERP Purifier (Google / Bing / DuckDuckGo)
  function processSearchResults(proActive) {
    if (!/(google\.|bing\.com|duckduckgo\.com)/i.test(location.hostname)) return;

    const results = document.querySelectorAll('div.g, li.b_algo, article[data-testid="result"]');
    let slopCount = 0;

    results.forEach((item) => {
      const text = (item.textContent || '').toLowerCase();
      const link = item.querySelector('a[href]');
      const href = link ? link.href : '';

      const isSlop =
        AI_SLOP_PATTERNS.some((rx) => rx.test(href)) ||
        text.includes('delve into the tapestry') ||
        text.includes('in conclusion, when choosing the best');

      if (isSlop && !item.dataset.deepblockProcessed) {
        item.dataset.deepblockProcessed = '1';
        slopCount++;
        if (proActive) {
          item.style.display = 'none';
        } else {
          item.style.border = '1px solid #f59e0b';
          item.style.borderRadius = '8px';
          item.style.padding = '6px';
        }
      }
    });

    if (slopCount > 0) {
      reportMetric('aiSlopDetected', slopCount);
    }
  }

  // 3. Recipe & News Clutter Stripper
  function processRecipeAndNewsClutter(proActive) {
    const recipeEl = document.querySelector(
      '[itemtype*="schema.org/Recipe"], .wprm-recipe-container, .tasty-recipes, .mv-create-card'
    );
    if (recipeEl && !document.getElementById('deepblockPureViewBtn')) {
      reportMetric('clutterStripped', 1);
      const pill = document.createElement('button');
      pill.id = 'deepblockPureViewBtn';
      pill.textContent = proActive
        ? '⚡ Jump to Clean Recipe (Deepblock PureView)'
        : '⚡ Recipe Clutter Detected — Click to Jump';
      Object.assign(pill.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '999px',
        padding: '10px 18px',
        fontWeight: '700',
        fontSize: '13px',
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)'
      });
      pill.onclick = () => recipeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.body.appendChild(pill);
    }
  }

  // 4. Fake E-Commerce Store & Review Detector (Bundle Module #1)
  function processEcommerceStore(proActive) {
    const isShopifyOrStore =
      Boolean(window.Shopify) ||
      document.querySelector('meta[name="shopify-checkout-api-token"]') ||
      /amazon\./i.test(location.hostname);

    if (!isShopifyOrStore) return;

    const hasFakeUrgency = Boolean(
      document.querySelector('[class*="countdown" i], [id*="hurrify" i], [class*="scarcity" i]')
    );
    if (hasFakeUrgency) {
      reportMetric('fakeStoresDetected', 1);
    }
  }

  // 5. YouTube Ad-Pod Shield (Pre-Roll/Mid-Roll Instant Fast-Forward + Cosmetic Feed Cleanser)
  function initYouTubeAdShield() {
    if (!/(^|\.)youtube\.com$/i.test(location.hostname)) return;

    // Inject cosmetic rules to hide home-feed, sidebar, masthead & overlay ad slots
    if (!document.getElementById('deepblock-yt-cosmetic')) {
      const style = document.createElement('style');
      style.id = 'deepblock-yt-cosmetic';
      style.textContent = `
        ytd-ad-slot-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-banner-promo-renderer,
        ytd-statement-banner-renderer,
        ytd-Display-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-compact-promoted-video-renderer,
        #masthead-ad,
        #player-ads,
        .ytp-ad-overlay-container,
        .ytp-ad-message-container,
        ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    let wasMutedBeforeAd = false;

    function neutralizeYouTubeVideoAd() {
      const player = document.querySelector('#movie_player, .html5-video-player');
      if (!player) return;

      const isAdShowing =
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting');

      const video = player.querySelector('video.html5-main-video');

      if (isAdShowing && video) {
        if (!video.dataset.deepblockAdMuted) {
          wasMutedBeforeAd = video.muted;
          video.muted = true;
          video.dataset.deepblockAdMuted = '1';
          reportMetric('adsBlocked', 1);
        }

        // Fast-forward ad stream to final millisecond to bypass anti-adblock detection
        if (Number.isFinite(video.duration) && video.duration > 0.5 && video.currentTime < video.duration - 0.1) {
          try {
            video.currentTime = video.duration;
          } catch (e) {
            video.playbackRate = 16;
          }
        } else {
          video.playbackRate = 16;
        }

        // Click any visible Skip Ad button immediately
        const skipSelectors = [
          '.ytp-skip-ad-button',
          '.ytp-ad-skip-button',
          '.ytp-ad-skip-button-modern',
          '.ytp-ad-skip-button-slot button',
          '.ytp-ad-overlay-close-button'
        ];
        for (const sel of skipSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
          }
        }
      } else if (video && video.dataset.deepblockAdMuted) {
        // Restore user's original mute & playback rate once main video resumes
        video.muted = wasMutedBeforeAd;
        video.playbackRate = 1;
        delete video.dataset.deepblockAdMuted;
      }
    }

    neutralizeYouTubeVideoAd();
    const obs = new MutationObserver(neutralizeYouTubeVideoAd);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });
  }

  chrome.storage.local.get(['proActive'], (res) => {
    const proActive = Boolean(res && res.proActive);
    processCookieBanners(proActive);
    processSearchResults(proActive);
    processRecipeAndNewsClutter(proActive);
    processEcommerceStore(proActive);
    initYouTubeAdShield();
  });
})();
