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
    const hiddenItems = [];

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
          hiddenItems.push(item);
        } else {
          item.style.border = '1px solid #f59e0b';
          item.style.borderRadius = '10px';
          item.style.padding = '8px';
          const badge = document.createElement('div');
          badge.textContent = '⚠️ Flagged by SWEEPR: Likely low-quality or spam article';
          Object.assign(badge.style, {
            fontSize: '11px',
            fontWeight: '700',
            color: '#92400e',
            background: '#fef3c7',
            padding: '3px 8px',
            borderRadius: '6px',
            marginBottom: '6px',
            display: 'inline-block'
          });
          item.prepend(badge);
        }
      }
    });

    if (slopCount > 0) {
      reportMetric('aiSlopDetected', slopCount);
      if (proActive && hiddenItems.length > 0 && !document.getElementById('deepblockSlopNotice')) {
        const notice = document.createElement('div');
        notice.id = 'deepblockSlopNotice';
        Object.assign(notice.style, {
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: '2147483647',
          background: '#064e3b',
          color: '#ffffff',
          padding: '8px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '700',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        });
        const label = document.createElement('span');
        label.textContent = `🛡️ SWEEPR hid ${hiddenItems.length} junk search result${hiddenItems.length > 1 ? 's' : ''}`;
        const showBtn = document.createElement('button');
        showBtn.type = 'button';
        showBtn.textContent = 'Show them';
        Object.assign(showBtn.style, {
          background: 'rgba(255,255,255,0.16)',
          color: '#a7f3d0',
          border: 'none',
          borderRadius: '999px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer'
        });
        showBtn.onclick = () => {
          hiddenItems.forEach((el) => { el.style.display = ''; });
          notice.remove();
        };
        notice.appendChild(label);
        notice.appendChild(showBtn);
        document.body.appendChild(notice);
      }
    }
  }

  // 3. Recipe & News Clutter Stripper
  function processRecipeAndNewsClutter(proActive) {
    const recipeEl = document.querySelector(
      '[itemtype*="schema.org/Recipe"], .wprm-recipe-container, .tasty-recipes, .mv-create-card'
    );
    if (recipeEl && !document.getElementById('deepblockPureViewBtn')) {
      reportMetric('clutterStripped', 1);
      const wrap = document.createElement('div');
      wrap.id = 'deepblockPureViewBtn';
      Object.assign(wrap.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#fff',
        borderRadius: '999px',
        padding: '6px 10px 6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      });

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.textContent = '📖 Skip Story & Jump to Recipe';
      Object.assign(jumpBtn.style, {
        background: 'none',
        border: 'none',
        color: '#fff',
        fontWeight: '800',
        fontSize: '13px',
        cursor: 'pointer',
        padding: '4px 0'
      });
      jumpBtn.onclick = () => recipeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Hide button';
      Object.assign(closeBtn.style, {
        background: 'rgba(0,0,0,0.18)',
        border: 'none',
        color: '#fff',
        borderRadius: '999px',
        width: '22px',
        height: '22px',
        fontSize: '11px',
        fontWeight: '800',
        cursor: 'pointer'
      });
      closeBtn.onclick = () => wrap.remove();

      wrap.appendChild(jumpBtn);
      wrap.appendChild(closeBtn);
      document.body.appendChild(wrap);
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
      if (!document.getElementById('deepblockShopWarningBar')) {
        const bar = document.createElement('div');
        bar.id = 'deepblockShopWarningBar';
        Object.assign(bar.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          zIndex: '2147483647',
          background: '#fef3c7',
          color: '#78350f',
          borderBottom: '2px solid #f59e0b',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        });
        const msg = document.createElement('span');
        msg.textContent =
          '⚠️ Heads Up from SWEEPR Deepblock: This shop uses "Hurry! Time Running Out" countdown timers often used by scam stores. Double-check reviews before buying.';
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = 'Got It, Hide ✕';
        Object.assign(dismiss.style, {
          background: '#d97706',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '5px 10px',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        });
        dismiss.onclick = () => bar.remove();
        bar.appendChild(msg);
        bar.appendChild(dismiss);
        document.body.appendChild(bar);
      }
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

  // 6. DeepStealth Layer 5: Active Anti-Adblock Wall Neutralizer & Bait Visual Cloaker
  const ANTI_ADBLOCK_WALL_SELECTORS = [
    '.fc-ab-root',
    '.fc-dialog-container',
    '[id*="admiral" i]',
    '[class*="admiral" i]',
    '#babasbmsgx',
    '[id*="blockadblock" i]',
    '[class*="adblock-modal" i]',
    '[class*="adblock-overlay" i]',
    '[id*="adblock-notice" i]',
    '[class*="adblocker-modal" i]',
    'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    'ytd-enforcement-message-view-model'
  ];

  const BAIT_SELECTORS = [
    '.adsbox',
    '.pub_300x250',
    '.pub_300x250m',
    '.pub_728x90',
    '.text-ad',
    '.textAd',
    '.text_ad',
    '.text_ads',
    '.text-ads',
    '.text-ad-links',
    '#ad-tester',
    '#ad_tester'
  ];

  function processAntiAdblockStealth() {
    // Visually cloak bait elements WITHOUT setting display:none so offsetHeight stays > 0
    const baits = document.querySelectorAll(BAIT_SELECTORS.join(','));
    baits.forEach((bait) => {
      if (!bait.dataset.deepstealthCloaked) {
        bait.dataset.deepstealthCloaked = '1';
        Object.assign(bait.style, {
          opacity: '0.001',
          pointerEvents: 'none',
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '300px',
          height: '250px',
          display: 'block',
          visibility: 'visible'
        });
      }
    });

    // Strip active anti-adblock walls & restore document scrolling
    let wallRemoved = false;
    for (const sel of ANTI_ADBLOCK_WALL_SELECTORS) {
      try {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach((node) => {
          node.remove();
          wallRemoved = true;
        });
      } catch (e) {}
    }

    if (wallRemoved) {
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('pointer-events', 'auto', 'important');
      reportMetric('antiAdblockBypassed', 1);
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'sweepr-deepstealth' && event.data.type === 'STEALTH_BYPASS_TRIGGERED') {
      reportMetric('antiAdblockBypassed', 1);
    }
  });

  chrome.storage.local.get(['proActive', 'pausedSites', 'settings'], (res) => {
    const host = (location.hostname || '').replace(/^www\./i, '').toLowerCase();
    const pausedSites = Array.isArray(res && res.pausedSites) ? res.pausedSites : [];
    if (host && pausedSites.includes(host)) return;

    const proActive = Boolean(res && res.proActive);
    const settings = (res && res.settings) || {};

    if (settings.cookieAutoClose !== false) processCookieBanners(proActive);
    if (settings.hideSearchSpam !== false) processSearchResults(proActive);
    processRecipeAndNewsClutter(proActive);
    if (settings.fakeShopAlerts !== false) processEcommerceStore(proActive);
    if (settings.adBlocking !== false) {
      initYouTubeAdShield();
      processAntiAdblockStealth();
      const stealthObs = new MutationObserver(() => processAntiAdblockStealth());
      stealthObs.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
})();
