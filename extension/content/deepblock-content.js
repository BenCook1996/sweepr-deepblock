// SWEEPR Deepblock — Real-Time Content Script (v1.1 UX & Ergonomics Audited)
// 1. GDPR Cookie Banner Detector & Auto-Rejector (Safe Scroll-Unlock)
// 2. AI Slop & SEO Content-Farm SERP Purifier
// 3. Recipe & News Clutter Stripper (PureView)
// 4. Fake E-Commerce Store & Review Detector (Shadow-DOM Non-Blocking Corner Pill)
// 5. Throttled MutationObservers for Zero Main-Thread Jank

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

  function createThrottle(fn, waitMs) {
    let scheduled = false;
    return function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        try {
          fn();
        } catch (e) {}
      }, waitMs);
    };
  }

  function reportMetric(metric, amount = 1) {
    try {
      chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric, amount });
    } catch (e) {}
  }

  function unlockScrollIfFrozenByModal() {
    try {
      const htmlOverflow = window.getComputedStyle(document.documentElement).overflow;
      const bodyOverflow = document.body ? window.getComputedStyle(document.body).overflow : '';
      if (htmlOverflow === 'hidden') {
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
      if (bodyOverflow === 'hidden' && document.body) {
        document.body.style.setProperty('overflow', 'auto', 'important');
      }
    } catch (e) {}
  }

  // 1. GDPR Cookie Banner Handling (Silent <50ms Rejector + Safe Scroll Unlock)
  function processCookieBanners(proActive, silentMode = true) {
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

      if (clicked) {
        unlockScrollIfFrozenByModal();
        reportMetric('cookiePromptsRejected', 1);
      }

      if (clicked && !silentMode && !document.getElementById('deepblockCookieWhisper')) {
        const toast = document.createElement('div');
        toast.id = 'deepblockCookieWhisper';
        toast.textContent = '🍪 Cookie pop-up declined';
        Object.assign(toast.style, {
          position: 'fixed',
          bottom: '14px',
          left: '14px',
          zIndex: '2147483647',
          background: 'rgba(255, 255, 255, 0.96)',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          borderRadius: '999px',
          padding: '4px 11px',
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 4px 12px rgba(6, 78, 59, 0.08)',
          pointerEvents: 'none',
          transition: 'opacity 0.4s ease'
        });
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 1600);
        setTimeout(() => { toast.remove(); }, 2050);
      }
    }
  }

  // 2. AI Slop & SEO Content-Farm SERP Purifier (Google / Bing / DuckDuckGo)
  function processSearchResults(proActive, silentMode = true) {
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
        } else if (!silentMode) {
          const badge = document.createElement('div');
          badge.textContent = '⚠️ Low-quality spam result flagged';
          Object.assign(badge.style, {
            fontSize: '11px',
            fontWeight: '600',
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            padding: '2px 8px',
            borderRadius: '999px',
            marginBottom: '4px',
            display: 'inline-block'
          });
          item.prepend(badge);
        }
      }
    });

    if (slopCount > 0) {
      reportMetric('aiSlopDetected', slopCount);
      if (proActive && hiddenItems.length > 0 && !document.getElementById('deepblockSlopNotice')) {
        const notice = document.createElement('span');
        notice.id = 'deepblockSlopNotice';
        Object.assign(notice.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#ecfdf5',
          color: '#047857',
          border: '1px solid #a7f3d0',
          padding: '2px 9px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: '700',
          marginLeft: '8px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        });
        const label = document.createElement('span');
        label.textContent = `🛡️ ${hiddenItems.length} spam result${hiddenItems.length > 1 ? 's' : ''} hidden`;
        const showBtn = document.createElement('button');
        showBtn.type = 'button';
        showBtn.textContent = 'Undo';
        Object.assign(showBtn.style, {
          background: 'none',
          color: '#065f46',
          border: 'none',
          padding: '0',
          fontSize: '11px',
          fontWeight: '800',
          textDecoration: 'underline',
          cursor: 'pointer'
        });
        showBtn.onclick = () => {
          hiddenItems.forEach((el) => { el.style.display = ''; });
          notice.remove();
        };
        notice.appendChild(label);
        notice.appendChild(showBtn);

        const statsHost =
          document.querySelector('#result-stats, #b_tween, #react-layout') ||
          document.querySelector('#search, #b_results');
        if (statsHost && statsHost.parentNode) {
          if (statsHost.id === 'result-stats' || statsHost.id === 'b_tween') {
            statsHost.appendChild(notice);
          } else {
            statsHost.parentNode.insertBefore(notice, statsHost);
          }
        }
      }
    }
  }

  // 3. Recipe & News Clutter Helper (Subtle Native Inline Jump Pill Under Heading)
  function processRecipeAndNewsClutter(proActive, silentMode = true) {
    if (!proActive) return;
    const recipeEl = document.querySelector(
      '[itemtype*="schema.org/Recipe"], .wprm-recipe-container, .tasty-recipes, .mv-create-card'
    );
    if (recipeEl && !document.getElementById('deepblockPureViewBtn')) {
      reportMetric('clutterStripped', 1);
      const wrap = document.createElement('div');
      wrap.id = 'deepblockPureViewBtn';
      Object.assign(wrap.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        background: '#ecfdf5',
        color: '#065f46',
        border: '1px solid #a7f3d0',
        borderRadius: '999px',
        padding: '4px 11px',
        margin: '6px 0 12px',
        fontSize: '12px',
        fontWeight: '700',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      });

      const dot = document.createElement('span');
      Object.assign(dot.style, {
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: '#10b981',
        flexShrink: '0'
      });

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.textContent = 'Jump to Recipe ↓';
      Object.assign(jumpBtn.style, {
        background: 'none',
        border: 'none',
        color: '#065f46',
        fontWeight: '800',
        fontSize: '12px',
        cursor: 'pointer',
        padding: '0'
      });
      jumpBtn.onclick = () => recipeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Dismiss';
      Object.assign(closeBtn.style, {
        background: 'none',
        border: 'none',
        color: '#047857',
        fontSize: '11px',
        fontWeight: '800',
        cursor: 'pointer',
        padding: '0 2px'
      });
      closeBtn.onclick = () => wrap.remove();

      wrap.appendChild(dot);
      wrap.appendChild(jumpBtn);
      wrap.appendChild(closeBtn);

      const mainHeading = document.querySelector('article h1, main h1, h1');
      if (mainHeading && mainHeading.parentNode) {
        mainHeading.parentNode.insertBefore(wrap, mainHeading.nextSibling);
      } else if (!silentMode) {
        Object.assign(wrap.style, {
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: '2147483647',
          boxShadow: '0 4px 14px rgba(6, 78, 59, 0.14)'
        });
        document.body.appendChild(wrap);
      }
    }
  }

  // 4. Fake E-Commerce Store Detector (Non-Blocking Shadow-DOM Corner Pill — Never Covers Sticky Headers)
  function processEcommerceStore(proActive) {
    if (!proActive) return;
    if (/(^|\.)(amazon\.|ebay\.|argos\.co\.uk|johnlewis\.com|currys\.co\.uk|tesco\.com)/i.test(location.hostname)) {
      return;
    }

    const isShopifyOrStore =
      Boolean(window.Shopify) ||
      document.querySelector('meta[name="shopify-checkout-api-token"]');

    if (!isShopifyOrStore) return;

    const hasFakeUrgency = Boolean(
      document.querySelector('[class*="countdown" i], [id*="hurrify" i], [class*="scarcity" i]')
    );
    if (hasFakeUrgency) {
      reportMetric('fakeStoresDetected', 1);
      if (!document.getElementById('deepblockShopWarningBar')) {
        const host = document.createElement('div');
        host.id = 'deepblockShopWarningBar';
        Object.assign(host.style, {
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: '2147483647',
          maxWidth: '340px',
          width: 'calc(100vw - 32px)'
        });

        const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
        const card = document.createElement('div');
        Object.assign(card.style, {
          background: 'rgba(255, 251, 235, 0.98)',
          color: '#92400e',
          border: '1px solid #f59e0b',
          borderRadius: '14px',
          padding: '10px 12px',
          fontSize: '12px',
          fontWeight: '700',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        });

        const msg = document.createElement('div');
        msg.style.lineHeight = '1.35';
        msg.textContent =
          '⚠️ Caution: Fake urgency timer detected on this store.';

        const actions = document.createElement('div');
        Object.assign(actions.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px'
        });

        const leaveBtn = document.createElement('button');
        leaveBtn.type = 'button';
        leaveBtn.textContent = '← Leave Site';
        Object.assign(leaveBtn.style, {
          background: '#059669',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '5px 10px',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer'
        });
        leaveBtn.onclick = () => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'https://www.google.com';
          }
        };

        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = 'Dismiss';
        Object.assign(dismiss.style, {
          background: 'transparent',
          color: '#78350f',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '5px 9px',
          fontSize: '11px',
          fontWeight: '700',
          cursor: 'pointer'
        });
        dismiss.onclick = () => host.remove();

        actions.appendChild(dismiss);
        actions.appendChild(leaveBtn);
        card.appendChild(msg);
        card.appendChild(actions);
        root.appendChild(card);
        document.body.appendChild(host);
      }
    }
  }

  // 5. YouTube Ad-Pod Shield (Pre-Roll/Mid-Roll Instant Fast-Forward + Cosmetic Feed Cleanser)
  function initYouTubeAdShield() {
    if (!/(^|\.)youtube\.com$/i.test(location.hostname)) return;

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

        if (Number.isFinite(video.duration) && video.duration > 0.5 && video.currentTime < video.duration - 0.1) {
          try {
            video.currentTime = video.duration;
          } catch (e) {
            video.playbackRate = 16;
          }
        } else {
          video.playbackRate = 16;
        }

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
        video.muted = wasMutedBeforeAd;
        video.playbackRate = 1;
        delete video.dataset.deepblockAdMuted;
      }
    }

    neutralizeYouTubeVideoAd();
    const throttledYtCheck = createThrottle(neutralizeYouTubeVideoAd, 120);
    const obs = new MutationObserver(throttledYtCheck);
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
      unlockScrollIfFrozenByModal();
      if (document.body) {
        document.body.style.setProperty('pointer-events', 'auto', 'important');
      }
      reportMetric('antiAdblockBypassed', 1);
    }
  }

  let stealthBypassReported = false;
  window.addEventListener('message', (event) => {
    if (stealthBypassReported || event.source !== window) return;
    if (event.data && event.data.source === 'sweepr-deepstealth' && event.data.type === 'STEALTH_BYPASS_TRIGGERED') {
      stealthBypassReported = true;
      reportMetric('antiAdblockBypassed', 1);
    }
  });

  chrome.storage.local.get(['proActive', 'licenseKey', 'pausedSites', 'settings'], (res) => {
    const proActive = Boolean(res && res.proActive && res.licenseKey);
    if (!proActive) {
      try {
        delete document.documentElement.dataset.sweeprProActive;
      } catch (e) {}
      return;
    }

    const host = (location.hostname || '').replace(/^www\./i, '').toLowerCase();
    const pausedSites = Array.isArray(res && res.pausedSites) ? res.pausedSites : [];
    if (host && pausedSites.includes(host)) return;

    try {
      document.documentElement.dataset.sweeprProActive = '1';
    } catch (e) {}

    const settings = (res && res.settings) || {};
    const silentMode = settings.silentMode !== false;

    if (settings.cookieAutoClose !== false) processCookieBanners(true, silentMode);
    if (settings.hideSearchSpam !== false) processSearchResults(true, silentMode);
    processRecipeAndNewsClutter(true, silentMode);
    if (settings.fakeShopAlerts !== false) processEcommerceStore(true);
    if (settings.adBlocking !== false) {
      initYouTubeAdShield();
      processAntiAdblockStealth();
      const throttledStealth = createThrottle(processAntiAdblockStealth, 150);
      const stealthObs = new MutationObserver(throttledStealth);
      stealthObs.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
})();
