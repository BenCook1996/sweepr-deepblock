// SWEEPR Deepblock — Real-Time Content Script (v1.3)
// 1. Zero-Copy Website Auto-Activation Bridge (sweeprdeepblock.com)
// 2. GDPR Cookie Banner Detector & Auto-Rejector (Safe Scroll-Unlock)
// 3. YouTube & Anti-Adblock Stealth DOM Shield
// 4. Interactive Page Element Zapper ("Hide Distracting Element")
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

  function queryAllDeep(root, selector, depth = 0, out = []) {
    if (!root || depth > 4 || typeof root.querySelectorAll !== 'function') return out;
    try {
      const matched = root.querySelectorAll(selector);
      for (let i = 0; i < matched.length; i++) out.push(matched[i]);
      const allEls = root.querySelectorAll('*');
      for (let i = 0; i < allEls.length && i < 600; i++) {
        if (allEls[i].shadowRoot) {
          queryAllDeep(allEls[i].shadowRoot, selector, depth + 1, out);
        }
      }
    } catch (e) {}
    return out;
  }

  function queryDeep(root, selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const found = queryAllDeep(root, sel, 0, []);
      if (found.length > 0) return found[0];
    }
    return null;
  }

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
    if (!isProdHost || location.protocol !== 'https:') {
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

    const FULL_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    function trySyncKey(candidate) {
      const clean = String(candidate || '').trim();
      if (!FULL_LICENSE_KEY_RE.test(clean) || clean === lastSyncedKey) return;
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
      if (checkoutKeyEl && checkoutKeyEl.textContent) trySyncKey(checkoutKeyEl.textContent);
      else if (portalKeyEl && portalKeyEl.textContent) trySyncKey(portalKeyEl.textContent);
    }

    scanPageForLicenseKey();

    window.addEventListener('message', (e) => {
      if (
        e.source !== window ||
        e.origin !== window.location.origin ||
        !e.data ||
        e.data.source !== 'sweepr-web-portal'
      ) {
        return;
      }
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
    const safeSelectors = list.filter((sel) => {
      return (
        typeof sel === 'string' &&
        sel.length > 0 &&
        sel.length <= 250 &&
        /^[a-zA-Z0-9#._:() >[\]="'*~$^|,/-]+$/.test(sel) &&
        !/[{};\\@]/.test(sel) &&
        !/url\(/i.test(sel)
      );
    });
    if (safeSelectors.length === 0) {
      if (styleEl) styleEl.remove();
      return;
    }
    styleEl.textContent = `${safeSelectors.join(',\n')} { display: none !important; }`;
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

    const isTouchDevice = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
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
      padding: '6px 10px 6px 16px',
      fontSize: '12px',
      fontWeight: '800',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      pointerEvents: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '94vw'
    });
    const bannerLabel = document.createElement('span');
    bannerLabel.textContent = isTouchDevice
      ? 'Tap any element to select it'
      : 'Click any distracting element to hide it on this site';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'deepblockZapperCancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      background: '#10b981',
      color: '#022c22',
      border: 'none',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '900',
      cursor: 'pointer'
    });
    banner.appendChild(bannerLabel);
    banner.appendChild(cancelBtn);
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

    cancelBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      stopZapper();
    }, true);

    function onMouseOver(e) {
      if (isTouchDevice) return;
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement || banner.contains(target)) return;
      if (hoveredEl !== target) {
        clearHighlight();
        hoveredEl = target;
        prevOutline = hoveredEl.style.outline || '';
        hoveredEl.style.outline = '2.5px solid #10b981';
      }
    }

    function onClick(e) {
      if (banner.contains(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement) {
        stopZapper();
        return;
      }
      if (isTouchDevice && hoveredEl !== target) {
        clearHighlight();
        hoveredEl = target;
        prevOutline = hoveredEl.style.outline || '';
        hoveredEl.style.outline = '2.5px solid #10b981';
        bannerLabel.textContent = 'Tap highlighted element again to hide';
        return;
      }
      const hideTarget = hoveredEl || target;
      stopZapper();

      const selector = buildUniqueSelector(hideTarget);
      hideTarget.style.setProperty('display', 'none', 'important');
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
      reportMetric('adsBlocked', 1);
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

  // 1. GDPR Cookie Banner Handling (Shadow-DOM Aware <50ms Rejector + Deduped Counter)
  function processCookieBanners(proActive, extraCmpSelectors = []) {
    const allCmpSelectors = Array.isArray(extraCmpSelectors) && extraCmpSelectors.length > 0
      ? [...CMP_SELECTORS, ...extraCmpSelectors]
      : CMP_SELECTORS;
    const foundBanner = document.querySelector(allCmpSelectors.join(','));
    if (!foundBanner) return;
    if (foundBanner.dataset && foundBanner.dataset.deepblockRejected === '1') return;

    if (!foundBanner.dataset || foundBanner.dataset.deepblockCounted !== '1') {
      if (foundBanner.dataset) foundBanner.dataset.deepblockCounted = '1';
      reportMetric('cookiePromptsDetected', 1);
    }

    if (proActive) {
      let clicked = false;
      const rejectBtn = queryDeep(document, CMP_REJECT_BUTTONS);
      if (rejectBtn) {
        rejectBtn.click();
        clicked = true;
      }

      if (!clicked) {
        const searchRoot = foundBanner.shadowRoot || foundBanner;
        const buttons = queryAllDeep(searchRoot, 'button, a[role="button"]');
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
        if (foundBanner.dataset) foundBanner.dataset.deepblockRejected = '1';
        unlockScrollIfFrozenByModal();
        reportMetric('cookiePromptsRejected', 1);
      }
    }
  }

  // 2. YouTube Ad-Pod Shield
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
    'iframe[src*="error-report.com"]',
    'iframe[src*="html-load.com"]',
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
    '#ad_tester',
    '#ad-unit',
    '#taboola-stream-1',
    '.jag8CityBio212023'
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

    // Actively scrub disguised in-grid video ad tiles (.vid-ad) and sticky bars on erothots & streaming grids,
    // then dispatch resize so Isotope/Masonry grids reflow cleanly with zero empty gaps.
    try {
      let removedGridAd = false;
      const gridAdNodes = document.querySelectorAll('a.video.vid-ad, .videos .vid-ad, .vid-ad');
      gridAdNodes.forEach((node) => {
        node.remove();
        removedGridAd = true;
      });
      const promoNodes = document.querySelectorAll(
        'a.top-bar-xx-style, .magic-sites, .list-btn.bnr, .bnr, .bnrs, a.bartab, .video-player .caption.bottom-right, .odw, [data-odw], .ourdreamai-native, .eroslider, a.no-taps[href*="camsoda"], img.camsoda-logo, #vast-ad-block, #vast-ad-block-button, .invideoBlock, .fluid_html_on_pause_container, .fluid_html_on_pause:not(.fluid_initial_play_button_container), [id*="_ad_html_on_pause"], .block-advert, .m-l-ntvb, .card-promotion, .card-deck-promotion, a.add_href_jsclick, .ib-300-250, #banner_iframe, #ag-agegate, #ag-cookiebar, .block-video#block-chat > .table, .block-video > .table:has(.opt), .block-video .opt, .bottom-adv, .pop-adv, .pop-premium, .index-link, .exclusive-link-href, .index-link-href, iframe[src*="gsrv.dev"], iframe[src*="aaaconnect.info"], iframe[src*="awmdelivery.com"], iframe.ipp, iframe[src*="ajscdn.com"], iframe[src*="inppcdn.com"], iframe[src*="tapioni.com"], iframe[src*="boannre.com"], #outstream, #outstream_pb, .outstream-wrapper, .outstream, .upkeep > .promotion, #spot_video_ntv_a, #spot_video_ntv_b, #spot_video_ntv_c, #spot_video_underplayer_livecams, #spot_video_livecams, .stem:has(#spot_video_livecams), .spot-live-cam, .ID_live_cam_wrapper, .ID-viptube-before-ad-video, .download_adv_text_video, .button-under-video:has(.download_adv_text_video), #rvt-element, [id^="rvt-p2p"], a[data-model-item], a[href*="/linkout/livecams/"], li:has(> div.item2 > a[href*="/linkout/livecams/"]), div:has(> a[href*="ey43.com"]), a[href*="ey43.com"], div[style*="z-index: 2147483646"][style*="position: absolute"], [data-cl-overlay], #c_window_xEucqIjg, #alink_overlay_EPXdyaUf, div[style*="z-index: 300000"][style*="position: fixed"]'
      );
      promoNodes.forEach((node) => {
        const parent = node.parentElement;
        if (
          node.classList &&
          node.classList.contains('top-bar-xx-style') &&
          parent &&
          parent.tagName === 'DIV' &&
          parent.children.length === 1
        ) {
          parent.remove();
        } else {
          node.remove();
        }
      });
      if (/(^|\.)porntrex\.com$/i.test(location.hostname)) {
        const overlayEl = document.getElementById('overlay');
        if (overlayEl) overlayEl.remove();
        document.querySelectorAll('div[style*="border:1px solid"]').forEach((box) => {
          if (box.querySelector('iframe[src*="gsrv.dev"]') || box.children.length === 0 || !box.querySelector('video, img, a')) {
            box.remove();
          }
        });
      }
      if (removedGridAd) {
        window.dispatchEvent(new Event('resize'));
        reportMetric('adsBlocked', gridAdNodes.length);
      }
    } catch (e) {}
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
    [id^="taboola-"]:not(#taboola-stream-1),
    .trc_rbox_container,
    body .trc_related_container,
    .OUTBRAIN,
    [data-widget-id^="outbrain"],
    [id*="ScriptRoot"],
    .mgbox,
    amp-ad,
    amp-embed[type="taboola"],
    /* Yahoo Sports / News / Finance SDA Ad Slots */
    .sda-ssr-placeholder,
    [data-ad-config],
    [id^="sda-"],
    .sda-ad,
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
    [data-cl-spot],
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
    #ntv_a,
    #ntv_b,
    #ntv_c,
    .upkeep > .promotion,
    #spot_video_ntv_a,
    #spot_video_ntv_b,
    #spot_video_ntv_c,
    .stem:has(#spot_video_livecams),
    .ID_live_cam_wrapper,
    .ID-viptube-before-ad-video,
    .download_adv_text_video,
    .button-under-video:has(.download_adv_text_video),
    a[data-model-item],
    a[href*="/linkout/livecams/"],
    li:has(> div.item2 > a[href*="/linkout/livecams/"]),
    iframe[src*="/player_right_ntv_"],
    iframe[src*="/adx_iframe_"],
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
    .ivn-k3d8p1,
    [class^="ivn-"],
    app-invideo-native-adv,
    .invideo-native-adv,
    .fh-iafjhn,
    .faphouse-promo-btn,
    .player-adv-link,
    .player__promo,
    .player-detail__yhy8t5,
    .outstream-adv,
    app-outstream-adv,
    app-native-item,
    .iframe-a[data-title="Advertisement"],
    [class*="-asg-vast-overlay"],
    .asg-container,
    .asg-vpaid-overlay,
    [id^="ts_ad_native_"],
    .under_video_ad,
    .under_video_ss,
    .avd-title,
    .avd-item,
    .video-page-aside:has(.avd-item),
    #ad_5454652,
    #ad_5454654,
    #im_video,
    #im_video_content,
    #vl_1,
    #vl_2,
    [id^="vl_"],
    [id^="wrapper_vl_"],
    [id^="click_vl_"],
    [id^="btn_close_videoslider_"],
    [id^="close_videoslider_"],
    [id^="lbl_advertise_slider_"],
    .sldr_right_right,
    .exc-pp,
    .lbl_advertise_slider,
    video[src*="sacdnssedge.com"],
    #fpa_layer,
    .invideo_banner,
    [id^="F8-"],
    [id^="F8m-"],
    [data-spot^="F8-"],
    a[href*="/link/cams/"],
    iframe[src*="applzr.com"],
    iframe[src*="goadserver.com"],
    iframe[src*="/agent.php?spot="],
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
    iframe[src*="jads.co"],
    /* Erothots & Plyr / OurDream / DreamServe / SmartFlora / RealXXX / TrafficHunt Ad Slots */
    a.top-bar-xx-style,
    div:has(> a.top-bar-xx-style),
    .magic-sites,
    .list-btn.bnr,
    .bnr,
    .bnrs,
    a.bartab,
    .video-player .caption.bottom-right,
    a.video.vid-ad,
    .vid-ad,
    .odw,
    [data-odw],
    .ourdreamai-native,
    .section.fh-videos:has(.odw),
    .eroslider,
    img.camsoda-logo,
    a.no-taps[href*="camsoda"],
    a[href*="smartfloralab.com"],
    a[href*="adtng.com"],
    a[href*="traffichunt.com"],
    a[href*="realxxx.com"],
    .section.text-center:has(iframe[src*="adtng.com"]),
    iframe[src*="adtng.com"],
    iframe[src*="dreamserve.dev"],
    iframe[src*="velvetloom.net"],
    iframe[src*="smartfloralab.com"],
    iframe[src*="realxxx.com"],
    iframe[src*="traffichunt.com"],
    /* Pornoeggs / FluidPlayer Pause Banner / VAST Corner Slider / StatServ Ad Slots */
    #vast-ad-block,
    #vast-ad-block-button,
    .invideoBlock,
    .invideoBlockLabel,
    .fluid_html_on_pause_container,
    .fluid_html_on_pause:not(.fluid_initial_play_button_container),
    [id*="_ad_html_on_pause"],
    .block-advert,
    .col-12.col-lg-auto:has(.block-advert),
    .m-l-ntvb,
    .card-promotion,
    .card-deck-promotion,
    a.add_href_jsclick,
    li:has(> a.add_href_jsclick),
    .ib-300-250,
    #banner_iframe,
    #ag-agegate,
    #ag-cookiebar,
    a[href*="/away/pop"],
    a[href*="/away/tab"],
    li:has(> a[href*="/away/tab"]),
    iframe[src*="statserv.net"],
    iframe[src*="/ads/prebid-ads"],
    /* Porntrex & KVS GoAdServer (gsrv.dev / aaaconnect.info / awmdelivery.com) Ad Slots */
    .block-video#block-chat > .table,
    .block-video > .table:has(.opt),
    .block-video > .table:has(iframe[src*="gsrv.dev"]),
    .block-video .opt,
    .bottom-adv,
    .pop-adv,
    .pop-premium,
    .index-link,
    .exclusive-link-href,
    .index-link-href,
    div[style*="border:1px solid #ccc"][style*="text-align:center"],
    div[style*="border:1px solid #ccc"]:has(iframe[src*="gsrv.dev"]),
    div:has(> iframe[src*="gsrv.dev"]),
    div:has(> div > iframe[src*="gsrv.dev"]),
    iframe[src*="gsrv.dev"],
    iframe[src*="aaaconnect.info"],
    iframe[src*="awmdelivery.com"],
    a[href*="rmzsglng.com"],
    li:has(> a[href*="rmzsglng.com"]),
    a[href*="aivanta76.com"],
    li:has(> a[href*="aivanta76.com"]),
    a[href*="gotpd.me"],
    li:has(> a[href*="gotpd.me"]),
    div:has(> a[href*="ey43.com"]),
    a[href*="ey43.com"],
    div[style*="z-index: 2147483646"][style*="position: absolute"],
    [data-cl-overlay],
    #c_window_xEucqIjg,
    #alink_overlay_EPXdyaUf,
    iframe.ipp,
    iframe[src*="ajscdn.com"],
    iframe[src*="inppcdn.com"],
    iframe[src*="tapioni.com"],
    iframe[src*="boannre.com"],
    #outstream,
    #outstream_pb,
    .outstream-wrapper,
    .outstream,
    div[style*="z-index: 300000"][style*="position: fixed"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      pointer-events: none !important;
    }
    .block-video .video-holder {
      width: 100% !important;
      float: none !important;
    }
    /* Ensure anti-adblock bait probes in <head> (#ad-unit, #taboola-stream-1) always report visible geometry */
    head > ins,
    head > div,
    #ad-unit,
    #taboola-stream-1,
    .jag8CityBio212023 {
      display: inline-block !important;
      visibility: visible !important;
      height: 250px !important;
      min-height: 250px !important;
      width: 300px !important;
      opacity: 1 !important;
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
      const otaEl = document.getElementById('deepblock-ota-cosmetic');
      if (otaEl) otaEl.remove();
    } catch (e) {}
  }

  function injectIsolatedOtaCosmeticStyles(selectors) {
    try {
      if (!Array.isArray(selectors) || selectors.length === 0) return;
      let style = document.getElementById('deepblock-ota-cosmetic');
      if (!style) {
        style = document.createElement('style');
        style.id = 'deepblock-ota-cosmetic';
        (document.head || document.documentElement).appendChild(style);
      }
      // Each selector is written as an independent CSS rule block so CSSOM error recovery
      // isolates each rule and can never invalidate UNIVERSAL_AD_COSMETIC_CSS or peer rules.
      const rulesCss = selectors
        .filter((s) => {
          if (typeof s !== 'string') return false;
          const clean = s.trim();
          return (
            clean.length > 2 &&
            clean.length <= 250 &&
            /^[a-zA-Z0-9#._:() >[\]="'*~$^|,/-]+$/.test(clean) &&
            !/[{};\\@]/.test(clean) &&
            !/url\(/i.test(clean)
          );
        })
        .map(
          (s) =>
            `${s.trim()} { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; pointer-events: none !important; }`
        )
        .join('\n');
      style.textContent = rulesCss;
    } catch (e) {}
  }

  // Inject cosmetic ad shield immediately at document_start to prevent any flash of ad slots
  injectUniversalAdCosmeticStyle();

  function syncStealthPausedSignal(paused) {
    try {
      window.dispatchEvent(new CustomEvent('_ds_cfg', { detail: { p: Boolean(paused) } }));
    } catch (e) {}
  }

  chrome.storage.local.get(
    [
      'proActive',
      'licenseKey',
      'pausedSites',
      'settings',
      'customHiddenSelectors',
      'remoteFeatureFlags',
      'extraCmpSelectors',
      'extraAntiAdblockSelectors',
      'extraCosmeticSelectors'
    ],
    (res) => {
      const pausedSites = Array.isArray(res && res.pausedSites) ? res.pausedSites : [];
      const settings = (res && res.settings) || {};

      function countAndReportPageAds(metricName = 'adsBlocked') {
        try {
          const adSlotSelector = [
            'ins.adsbygoogle',
            '[id^="google_ads_iframe"]',
            '[data-ad-slot]',
            '[data-ad-client]',
            '[data-google-query-id]',
            '.adsbox',
            '.ad-banner',
            '.ad-slot',
            '.advertisement',
            'ytd-ad-slot-renderer',
            'ytd-in-feed-ad-layout-renderer',
            'iframe[src*="doubleclick.net"]',
            'iframe[src*="googlesyndication.com"]',
            '[id*="taboola"]',
            '[id*="outbrain"]'
          ].join(',');
          const nodes = document.querySelectorAll(adSlotSelector);
          let newlyCounted = 0;
          for (const el of nodes) {
            if (!el.dataset || el.dataset.deepblockAdCounted === '1') continue;
            el.dataset.deepblockAdCounted = '1';
            newlyCounted++;
          }
          if (newlyCounted > 0) {
            reportMetric(metricName, Math.min(newlyCounted, 25));
          }
        } catch (e) {}
      }

      const extraCmpSelectors = Array.isArray(res && res.extraCmpSelectors) ? res.extraCmpSelectors : [];
      const isPaidEntitled = Boolean(res && res.proActive && res.licenseKey);
      const isPausedSite = Boolean(currentHost && pausedSites.includes(currentHost));
      if (!isPaidEntitled || isPausedSite) {
        removeUniversalAdCosmeticStyle();
        syncStealthPausedSignal(true);
        if (!isPaidEntitled && !isPausedSite) {
          const runFreeDiagnosticPass = () => {
            countAndReportPageAds('adsSpotted');
            processCookieBanners(false, extraCmpSelectors);
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runFreeDiagnosticPass, { once: true });
          } else {
            runFreeDiagnosticPass();
          }
        }
        return;
      }

      const adBlockingEnabled = settings.adBlocking !== false;
      syncStealthPausedSignal(!adBlockingEnabled);

      if (adBlockingEnabled) {
        if (/(^|\.)sweeprdeepblock\.com$/i.test(currentHost)) {
          try {
            document.documentElement.dataset.sweeprExtensionActive = '1';
          } catch (e) {}
        }
        injectUniversalAdCosmeticStyle();
        if (Array.isArray(res && res.extraCosmeticSelectors)) {
          injectIsolatedOtaCosmeticStyles(res.extraCosmeticSelectors);
        }
      } else {
        removeUniversalAdCosmeticStyle();
      }

      const flags = (res && res.remoteFeatureFlags) || {};
      const extraAntiAdblockSelectors = Array.isArray(res && res.extraAntiAdblockSelectors)
        ? res.extraAntiAdblockSelectors
        : [];
      for (const extraSel of extraAntiAdblockSelectors) {
        if (typeof extraSel === 'string' && extraSel && !ANTI_ADBLOCK_WALL_SELECTORS.includes(extraSel)) {
          ANTI_ADBLOCK_WALL_SELECTORS.push(extraSel);
        }
      }

      function runDomProtectionPass() {
        if (adBlockingEnabled) {
          injectUniversalAdCosmeticStyle();
          countAndReportPageAds('adsBlocked');
          if (Array.isArray(res && res.extraCosmeticSelectors)) {
            injectIsolatedOtaCosmeticStyles(res.extraCosmeticSelectors);
          }
          if (flags.youtubeAdShield !== false) {
            initYouTubeAdShield();
          }
          if (flags.antiAdblockStealth !== false) {
            processAntiAdblockStealth();
          }
        }
        if (res && res.customHiddenSelectors) {
          applySavedCustomHiddenSelectors(res.customHiddenSelectors);
        }
        if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
          processCookieBanners(true, extraCmpSelectors);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runDomProtectionPass, { once: true });
      } else {
        runDomProtectionPass();
      }

      const throttledDomPass = createThrottle(() => {
        if (adBlockingEnabled) {
          countAndReportPageAds('adsBlocked');
          if (flags.antiAdblockStealth !== false) {
            processAntiAdblockStealth();
          }
        }
        if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
          processCookieBanners(true, extraCmpSelectors);
        }
      }, 200);
      const domObs = new MutationObserver(throttledDomPass);
      domObs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => domObs.disconnect(), 20000);
    }
  );
})();
