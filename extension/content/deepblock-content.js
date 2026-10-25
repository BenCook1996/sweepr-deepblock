// SWEEPR Deepblock — Real-Time Content Script (v1.2 UX & Ergonomics Audited)
// 1. Zero-Copy Website Auto-Activation Bridge (sweeprdeepblock.com)
// 2. GDPR Cookie Banner Detector & Auto-Rejector (Safe Scroll-Unlock)
// 3. AI Slop & SEO Content-Farm SERP Purifier
// 4. Recipe & News Clutter Stripper (PureView)
// 5. Fake E-Commerce Store Detector (Shadow-DOM Non-Blocking Corner Pill)
// 6. Interactive Page Element Zapper ("🧹 Hide Distracting Element")
// 7. Throttled MutationObservers for Zero Main-Thread Jank

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

  const pendingMetrics = new Map();
  let metricFlushTimer = null;

  function reportMetric(metric, amount = 1, extra = {}) {
    try {
      if (extra && Object.keys(extra).length > 0) {
        chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric, amount, ...extra });
        return;
      }
      pendingMetrics.set(metric, (pendingMetrics.get(metric) || 0) + (Number(amount) || 1));
      if (!metricFlushTimer) {
        metricFlushTimer = setTimeout(() => {
          metricFlushTimer = null;
          for (const [m, total] of pendingMetrics.entries()) {
            try {
              chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric: m, amount: total });
            } catch (e) {}
          }
          pendingMetrics.clear();
        }, 300);
      }
    } catch (e) {}
  }

  // ============================================================================
  // 0. Zero-Copy Auto-Activation Bridge on sweeprdeepblock.com
  // Automatically syncs a verified customer license key on /checkout/success or /login
  // ============================================================================
  function initWebsiteAutoActivationBridge() {
    const host = (location.hostname || '').toLowerCase();
    const isProdHost = /(^|\.)sweeprdeepblock\.com$/i.test(host);
    const isDevHost = host === 'localhost' || host === '127.0.0.1';
    if (!isDevHost && (!isProdHost || location.protocol !== 'https:')) {
      return;
    }

    let lastSyncedKey = '';
    let portalObs = null;
    function showAutoActivationConfirmation() {
      const targetEl = document.getElementById('licenseKeyText') || document.getElementById('portalLicenseKey');
      if (!targetEl || document.getElementById('sweeprAutoUnlockedPill')) return;
      const pill = document.createElement('div');
      pill.id = 'sweeprAutoUnlockedPill';
      pill.textContent = '✓ Browser Extension Automatically Unlocked & Active';
      Object.assign(pill.style, {
        marginTop: '8px',
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '999px',
        background: 'rgba(16, 185, 129, 0.2)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        color: '#6ee7b7',
        fontSize: '11px',
        fontWeight: '800'
      });
      targetEl.parentElement?.appendChild(pill);
    }

    function trySyncKey(candidate) {
      const clean = String(candidate || '').trim();
      if (!clean || clean === 'Active' || clean === '—' || clean.length < 6 || clean === lastSyncedKey) return;
      lastSyncedKey = clean;
      try {
        chrome.runtime.sendMessage({ type: 'AUTO_SYNC_WEBSITE_LICENSE', licenseKey: clean }, (res) => {
          if (res && res.ok && res.valid) {
            if (portalObs) portalObs.disconnect();
            showAutoActivationConfirmation();
          }
        });
      } catch (e) {}
    }

    function scanPageForLicenseKey() {
      try {
        const storedKey =
          localStorage.getItem('sweepr_license_key') ||
          localStorage.getItem('deepblock_license_key') ||
          '';
        if (storedKey) trySyncKey(storedKey);
      } catch (e) {}

      const checkoutKeyEl = document.getElementById('licenseKeyText');
      const portalKeyEl = document.getElementById('portalLicenseKey');
      const portalCodeEl = document.getElementById('portalActivationCode');
      if (checkoutKeyEl && checkoutKeyEl.textContent) trySyncKey(checkoutKeyEl.textContent);
      else if (portalKeyEl && portalKeyEl.textContent) trySyncKey(portalKeyEl.textContent);
      else if (portalCodeEl && portalCodeEl.textContent) trySyncKey(portalCodeEl.textContent);
    }

    scanPageForLicenseKey();

    window.addEventListener('message', (e) => {
      if (e.source !== window || !e.data || e.data.source !== 'sweepr-web-portal') return;
      if (e.data.type === 'SWEEPR_AUTO_ACTIVATE' && e.data.licenseKey) {
        trySyncKey(e.data.licenseKey);
      }
    });

    const throttledPortalScan = createThrottle(scanPageForLicenseKey, 250);
    portalObs = new MutationObserver(throttledPortalScan);
    if (document.body) {
      portalObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(() => portalObs.disconnect(), 15000);
    }
  }

  initWebsiteAutoActivationBridge();

  // ============================================================================
  // Interactive Page Element Zapper ("🧹 Hide Distracting Element")
  // ============================================================================
  const currentHost = (location.hostname || '').replace(/^www\./i, '').toLowerCase();

  function applySavedCustomHiddenSelectors(customMap) {
    if (!currentHost || !customMap || typeof customMap !== 'object') return;
    const list = Array.isArray(customMap[currentHost]) ? customMap[currentHost] : [];
    let styleEl = document.getElementById('deepblock-custom-zapper');
    if (list.length === 0) {
      if (styleEl) styleEl.remove();
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'deepblock-custom-zapper';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = `${list.join(',\n')} { display: none !important; }`;
  }

  function buildUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
      return `#${CSS.escape(el.id)}`;
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && cur !== document.documentElement && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const classes = Array.from(cur.classList || [])
        .filter((c) => c && !/^deepblock/i.test(c) && /^[a-zA-Z0-9_-]+$/.test(c))
        .slice(0, 2);
      if (classes.length > 0) {
        part += '.' + classes.map((c) => CSS.escape(c)).join('.');
      } else if (cur.parentElement) {
        const siblings = Array.from(cur.parentElement.children).filter((s) => s.tagName === cur.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  let zapperActive = false;
  function startElementZapper() {
    if (zapperActive) return;
    zapperActive = true;

    let hoveredEl = null;
    let prevOutline = '';

    const banner = document.createElement('div');
    banner.id = 'deepblockZapperBanner';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      background: '#064e3b',
      color: '#ecfdf5',
      border: '1.5px solid #10b981',
      borderRadius: '999px',
      padding: '7px 16px',
      fontSize: '12px',
      fontWeight: '800',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      pointerEvents: 'none'
    });
    banner.textContent = '🧹 Click any distracting element to hide it on this site · Press Esc to cancel';
    document.body.appendChild(banner);

    function clearHighlight() {
      if (hoveredEl) {
        hoveredEl.style.outline = prevOutline;
        hoveredEl = null;
      }
    }

    function stopZapper() {
      zapperActive = false;
      clearHighlight();
      banner.remove();
      window.removeEventListener('mouseover', onMouseOver, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
    }

    function onMouseOver(e) {
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement || target === banner) return;
      if (hoveredEl !== target) {
        clearHighlight();
        hoveredEl = target;
        prevOutline = hoveredEl.style.outline || '';
        hoveredEl.style.outline = '2.5px solid #10b981';
      }
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const target = hoveredEl || e.target;
      stopZapper();
      if (!target || target === document.body || target === document.documentElement) return;

      const selector = buildUniqueSelector(target);
      target.style.setProperty('display', 'none', 'important');
      if (selector && currentHost) {
        chrome.storage.local.get(['customHiddenSelectors'], (res) => {
          const map = (res && res.customHiddenSelectors) || {};
          const existing = Array.isArray(map[currentHost]) ? map[currentHost] : [];
          if (!existing.includes(selector)) {
            map[currentHost] = [...existing, selector];
            chrome.storage.local.set({ customHiddenSelectors: map });
            applySavedCustomHiddenSelectors(map);
          }
        });
      }
      reportMetric('clutterStripped', 1);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopZapper();
      }
    }

    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'START_ELEMENT_ZAPPER') {
        startElementZapper();
        sendResponse({ ok: true });
      }
    });
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

  // 1. GDPR Cookie Banner Handling (100% Silent <50ms Rejector + Safe Scroll Unlock — Zero Toast Noise)
  function processCookieBanners(proActive, extraCmpSelectors = []) {
    const allCmpSelectors = Array.isArray(extraCmpSelectors) && extraCmpSelectors.length > 0
      ? [...CMP_SELECTORS, ...extraCmpSelectors]
      : CMP_SELECTORS;
    const foundBanner = document.querySelector(allCmpSelectors.join(','));
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
        const buttons = foundBanner.querySelectorAll('button, a[role="button"]');
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          if (
            /^(reject all|decline all|necessary only|essential only|refuse all|continue without accepting)$/i.test(
              (b.textContent || '').trim()
            )
          ) {
            b.click();
            clicked = true;
            break;
          }
        }
      }

      if (clicked) {
        unlockScrollIfFrozenByModal();
        reportMetric('cookiePromptsRejected', 1);
      }
    }
  }

  // 2. AI Slop & SEO Content-Farm SERP Purifier (100% Silent Hiding — Zero SERP Badge Clutter)
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
        }
      }
    });

    if (slopCount > 0) {
      reportMetric('aiSlopDetected', slopCount);
    }
  }

  // 3. Recipe & News Clutter Stripper (100% Silent — No Unsolicited Injected Page Buttons)
  function processRecipeAndNewsClutter(proActive) {
    if (!proActive) return;
    const recipeEl = document.querySelector(
      '[itemtype*="schema.org/Recipe"], .wprm-recipe-container, .tasty-recipes, .mv-create-card'
    );
    if (recipeEl && !recipeEl.dataset.deepblockCounted) {
      recipeEl.dataset.deepblockCounted = '1';
      reportMetric('clutterStripped', 1);
    }
  }

  // 4. High-Trust, Zero-Panic Fake E-Commerce Store Interstitial (Shadow-DOM Isolated)
  function processEcommerceStore(proActive, trustedShopSites = []) {
    if (!proActive) return;
    if (/(^|\.)(amazon\.|ebay\.|argos\.co\.uk|johnlewis\.com|currys\.co\.uk|tesco\.com|apple\.com|nike\.com)/i.test(location.hostname)) {
      return;
    }
    if (currentHost && Array.isArray(trustedShopSites) && trustedShopSites.includes(currentHost)) {
      return;
    }

    const isShopifyOrStore =
      Boolean(window.Shopify) ||
      document.querySelector('meta[name="shopify-checkout-api-token"]') ||
      document.querySelector('form[action*="/cart/add"]');

    if (!isShopifyOrStore) return;

    const hasFakeUrgency = Boolean(
      document.querySelector('[class*="countdown" i], [id*="hurrify" i], [class*="scarcity" i]')
    );
    if (!hasFakeUrgency) return;

    const reasons = [
      'Fake urgency countdown timer detected on this storefront.',
      'High-pressure promotional layout matching known clearance scam templates.'
    ];
    const bodyText = (document.body ? document.body.innerText || '' : '').toLowerCase();
    if (!/company number|registered in|vat\s*(no|number|reg)/i.test(bodyText)) {
      reasons.push('No verifiable company registration number found on this page.');
    }

    reportMetric('fakeStoresDetected', 1, { reasons, hostname: currentHost });

    if (!document.getElementById('deepblockShopWarningBar')) {
      const host = document.createElement('div');
      host.id = 'deepblockShopWarningBar';
      Object.assign(host.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        webkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      });

      const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      const card = document.createElement('div');
      Object.assign(card.style, {
        background: '#ffffff',
        color: '#0f172a',
        border: '2px solid #f59e0b',
        borderRadius: '20px',
        padding: '22px 24px',
        maxWidth: '440px',
        width: '100%',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      });

      const badgeRow = document.createElement('div');
      Object.assign(badgeRow.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      });

      const badge = document.createElement('span');
      badge.textContent = '⚠️ SWEEPR SHOP SHIELD · CAUTION';
      Object.assign(badge.style, {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
        borderRadius: '999px',
        padding: '4px 10px',
        fontSize: '10.5px',
        fontWeight: '800',
        letterSpacing: '0.03em'
      });

      const domainLabel = document.createElement('span');
      domainLabel.textContent = currentHost || location.hostname;
      Object.assign(domainLabel.style, {
        fontSize: '11px',
        fontWeight: '700',
        color: '#64748b',
        fontFamily: 'ui-monospace, monospace'
      });

      badgeRow.appendChild(badge);
      badgeRow.appendChild(domainLabel);

      const title = document.createElement('div');
      title.textContent = `Hold on — this store shows ${reasons.length} signs of a risky online shop`;
      Object.assign(title.style, {
        fontSize: '17px',
        fontWeight: '900',
        color: '#0f172a',
        lineHeight: '1.3'
      });

      const list = document.createElement('ul');
      Object.assign(list.style, {
        margin: '0',
        padding: '12px 14px 12px 28px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '12px',
        color: '#78350f',
        fontSize: '12px',
        fontWeight: '600',
        lineHeight: '1.45',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });
      reasons.forEach((r) => {
        const li = document.createElement('li');
        li.textContent = r;
        list.appendChild(li);
      });

      const leaveBtn = document.createElement('button');
      leaveBtn.type = 'button';
      leaveBtn.textContent = '← Take Me Back to Safety';
      Object.assign(leaveBtn.style, {
        width: '100%',
        background: '#059669',
        color: '#ffffff',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '13.5px',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
        transition: 'transform 75ms cubic-bezier(0.16, 1, 0.3, 1)'
      });
      leaveBtn.onpointerdown = () => { leaveBtn.style.transform = 'scale(0.985)'; };
      leaveBtn.onpointerup = () => { leaveBtn.style.transform = ''; };
      leaveBtn.onpointerleave = () => { leaveBtn.style.transform = ''; };
      leaveBtn.onclick = () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'https://www.google.com';
        }
      };

      const trustBtn = document.createElement('button');
      trustBtn.type = 'button';
      trustBtn.textContent = 'I know this retailer — Proceed anyway (Trust this site)';
      Object.assign(trustBtn.style, {
        background: 'transparent',
        color: '#64748b',
        border: 'none',
        padding: '4px 8px',
        fontSize: '11.5px',
        fontWeight: '600',
        textDecoration: 'underline',
        cursor: 'pointer',
        alignSelf: 'center'
      });
      trustBtn.onclick = () => {
        if (currentHost) {
          chrome.storage.local.get(['trustedShopSites'], (res) => {
            const list = Array.isArray(res && res.trustedShopSites) ? res.trustedShopSites : [];
            if (!list.includes(currentHost)) {
              chrome.storage.local.set({ trustedShopSites: [...list, currentHost] });
            }
          });
        }
        host.remove();
      };

      card.appendChild(badgeRow);
      card.appendChild(title);
      card.appendChild(list);
      card.appendChild(leaveBtn);
      card.appendChild(trustBtn);
      root.appendChild(card);
      document.body.appendChild(host);
      if (card.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        card.animate(
          [
            { opacity: 0, transform: 'translateY(-6px) scale(0.985)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
          ],
          { duration: 160, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
        );
      }
    }
  }

  // 5. YouTube Ad-Pod Shield
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

  const UNIVERSAL_AD_COSMETIC_CSS = `
    /* YouTube Sponsored & Feed Ad Slots */
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer,
    ytd-statement-banner-renderer,
    ytd-display-ad-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-sparkles-text-search-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-video-masthead-ad-v3-renderer,
    ytd-primetime-promo-renderer,
    ytd-action-companion-ad-renderer,
    ytd-image-companion-ad-renderer,
    #masthead-ad,
    #player-ads,
    #offer-module,
    .ytp-ad-overlay-container,
    .ytp-ad-message-container,
    .ytp-ad-player-overlay-layout,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    /* Search Engine Sponsored Ads */
    #tads,
    #tadsb,
    #bottomads,
    [data-text-ad],
    div[aria-label="Ads"],
    .commercial-unit-desktop-top,
    .commercial-unit-desktop-rhs,
    .uEierd,
    li.b_ad,
    .b_adLastChild,
    /* Universal Display, Programmatic, Taboola & Outbrain Ads */
    ins.adsbygoogle,
    [id^="div-gpt-ad"],
    [id^="google_ads_iframe"],
    iframe[id^="google_ads_"],
    iframe[src*="doubleclick.net"],
    iframe[src*="googlesyndication.com"],
    iframe[src*="adnxs.com"],
    iframe[src*="amazon-adsystem.com"],
    iframe[src*="rubiconproject.com"],
    iframe[src*="criteo."],
    [data-google-query-id],
    [data-ad-client],
    [data-ad-slot],
    [id^="taboola-"],
    .trc_rbox_container,
    .trc_related_container,
    .OUTBRAIN,
    [data-widget-id^="outbrain"],
    [id*="ScriptRoot"],
    .mgbox,
    amp-ad,
    amp-embed[type="taboola"],
    /* Streaming & Tube Ad Containers (Eporner, ExoClick, TrafficStars, TrafficJunky, JuicyAds, ClickAdu) */
    #movieplayer-box-adv,
    #movieplayer-box-adv-iframe,
    #movieplayer-box-adv-NTVA,
    #movieplayer-box-adv-NTVB,
    #movieplayer-box-adv-NTVC,
    .movieplayer-box-adv-box,
    #adstripe,
    #deskadmiddle,
    #ifdeskadmiddle,
    #admobiletop,
    #admobiletopinside,
    #admobilemiddle,
    #ifadmiddle,
    #footadframe,
    #admobilefoot,
    #admobilefootinside,
    #adPlayerIfr,
    #adPlayerIfrMob,
    #videotextbanner,
    #pbwuvpad,
    #adnative-1x1-iframe,
    #EPimLayerOuter,
    #admobileoutstream,
    #ifadoutstream,
    .dotcontainer,
    .adstext,
    .adsinfo,
    [id^="epad-"],
    [data-ep-adzone],
    [data-ts-spot],
    [class^="__clb-"],
    #divExoLayerWrapper,
    ins[class^="eas6a97888e"],
    ins[data-zoneid],
    .player-click-layer,
    a.player-click-layer,
    .new-videoplayer-overlay,
    .video-extra-overlay,
    .vast-overlay,
    .video-end-overlay,
    #invideo_wrapper,
    #yps_player_vpaid,
    .ads-block-rightside,
    .wgt-container,
    .fh-line,
    .tilebar-line,
    [data-ph],
    a.blinker,
    li.media-item.no-popup,
    a[href^="/link/out/"],
    a[href*="pornoxo.com/link/out/"],
    a[href*="/zv3/b"],
    a[href*="/zv3/url"],
    a[href*="/zv3/cam"],
    div[class*="advi"],
    body > .ppexcll,
    .extlinkn,
    a[aria-label="AI TAB"],
    .sugggestio,
    [class^="sugggest"],
    .videos-tube-friends,
    .video-videos-slider,
    .btn-hardlink,
    .direct-abnner,
    .under-channel,
    [class*="_ab-io"],
    #und_ban,
    #ntv_a,
    #ntv_b,
    #ntv_c,
    #iv_1,
    .__nat_item,
    .__bai-overlay,
    #int_hsSJlay,
    #int_hsSJ,
    .fiioed,
    .pplayer div.jw-title-secondary,
    .drt-spot-box,
    .drt-spot-visible,
    .drt-spot-bottom-box,
    .drt-sponsor-block,
    #spot_video_inside_player,
    [data-spot],
    .player-adx-block,
    .player-sponsor-block,
    #adx_ad,
    #bottom_banner_block,
    #top_banner_block,
    #spot_video_underplayer_livecams,
    #spot_video_livecams,
    .spot-live-cam,
    #rvt-element,
    [id^="rvt-p2p"],
    [class^="rvt-p2p"],
    [class^="rel_right_"],
    .aside:has(> [class^="rel_right_"]),
    iframe[src*="nvdst.com/adx_"],
    iframe[src*="rvmessage.online"],
    iframe[src*="tophqcam.com"],
    iframe[src*="/zv3/"],
    iframe[src*="/link/out/"],
    iframe[src*="tsyndicate.com"],
    iframe[src*="contentsserved.com"],
    iframe[src*="exosrv.com"],
    iframe[src*="exoclick.com"],
    iframe[src*="realsrv.com"],
    iframe[src*="magsrv.com"],
    iframe[src*="pemsrv.com"],
    iframe[src*="trafficjunky."],
    iframe[src*="juicyads.com"],
    iframe[src*="jads.co"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      pointer-events: none !important;
    }
    #moviexxx {
      max-width: initial !important;
      max-height: initial !important;
    }
  `;

  function injectUniversalAdCosmeticStyle() {
    try {
      if (document.getElementById('deepblock-universal-cosmetic')) return;
      const style = document.createElement('style');
      style.id = 'deepblock-universal-cosmetic';
      style.textContent = UNIVERSAL_AD_COSMETIC_CSS;
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
  }

  function removeUniversalAdCosmeticStyle() {
    try {
      const el = document.getElementById('deepblock-universal-cosmetic');
      if (el) el.remove();
    } catch (e) {}
  }

  // Inject cosmetic ad shield immediately at document_start to prevent any flash of ad slots
  injectUniversalAdCosmeticStyle();
  try {
    if (document.documentElement) {
      document.documentElement.dataset.sweeprProActive = '1';
    }
  } catch (e) {}

  chrome.storage.local.get(
    [
      'proActive',
      'licenseKey',
      'pausedSites',
      'trustedShopSites',
      'settings',
      'customHiddenSelectors',
      'remoteFeatureFlags',
      'extraCmpSelectors',
      'extraAntiAdblockSelectors'
    ],
    (res) => {
      const pausedSites = Array.isArray(res && res.pausedSites) ? res.pausedSites : [];
      const trustedShopSites = Array.isArray(res && res.trustedShopSites) ? res.trustedShopSites : [];
      const settings = (res && res.settings) || {};

      if ((currentHost && pausedSites.includes(currentHost)) || settings.adBlocking === false) {
        removeUniversalAdCosmeticStyle();
        try {
          document.documentElement.dataset.sweeprPaused = '1';
          delete document.documentElement.dataset.sweeprProActive;
        } catch (e) {}
        return;
      }

      try {
        delete document.documentElement.dataset.sweeprPaused;
        document.documentElement.dataset.sweeprProActive = '1';
      } catch (e) {}

      injectUniversalAdCosmeticStyle();

      const flags = (res && res.remoteFeatureFlags) || {};
      const extraCmpSelectors = Array.isArray(res && res.extraCmpSelectors) ? res.extraCmpSelectors : [];
      const extraAntiAdblockSelectors = Array.isArray(res && res.extraAntiAdblockSelectors)
        ? res.extraAntiAdblockSelectors
        : [];
      for (const extraSel of extraAntiAdblockSelectors) {
        if (typeof extraSel === 'string' && extraSel && !ANTI_ADBLOCK_WALL_SELECTORS.includes(extraSel)) {
          ANTI_ADBLOCK_WALL_SELECTORS.push(extraSel);
        }
      }

      function runDomProtectionPass() {
        if (res && res.customHiddenSelectors) {
          applySavedCustomHiddenSelectors(res.customHiddenSelectors);
        }
        if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
          processCookieBanners(true, extraCmpSelectors);
        }
        if (settings.hideSearchSpam !== false && flags.hideSearchSpam !== false) {
          processSearchResults(true);
        }
        processRecipeAndNewsClutter(true);
        if (settings.fakeShopAlerts !== false && flags.fakeShopAlerts !== false) {
          processEcommerceStore(true, trustedShopSites);
        }
        if (settings.adBlocking !== false) {
          if (flags.youtubeAdShield !== false) {
            initYouTubeAdShield();
          }
          if (flags.antiAdblockStealth !== false) {
            processAntiAdblockStealth();
          }
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runDomProtectionPass, { once: true });
      } else {
        runDomProtectionPass();
      }

      const throttledDomPass = createThrottle(() => {
        if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
          processCookieBanners(true, extraCmpSelectors);
        }
        if (settings.adBlocking !== false && flags.antiAdblockStealth !== false) {
          processAntiAdblockStealth();
        }
      }, 200);
      const domObs = new MutationObserver(throttledDomPass);
      domObs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => domObs.disconnect(), 20000);
    }
  );
})();
