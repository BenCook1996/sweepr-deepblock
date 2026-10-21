// SWEEPR Deepblock — DeepStealth MAIN-World Anti-Adblock & YouTube/IMA Cloaking Engine (v2 Field-Hardened)
// Runs at document_start in MAIN world before any page or anti-adblock script executes.
// Defeats:
// 1. Dynamic <script onerror> network-block traps (Admiral, CanYouBlockIt, d3ward, Google Funding Choices)
// 2. Global SDK canary checks (window.adsbygoogle, window.googletag, window.google.ima, BlockAdBlock/FuckAdBlock)
// 3. DOM Bait / Honeypot geometry & getComputedStyle traps (offsetHeight === 0 / display === 'none')
// 4. fetch() & XMLHttpRequest ad-server probe traps
// 5. YouTube /youtubei/v1/player adPlacements / adSlots JSON payload injection + IMA SDK pre-roll video traps

(function () {
  'use strict';

  if (window.__sweeprDeepStealthActive) return;
  Object.defineProperty(window, '__sweeprDeepStealthActive', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  function isProEntitled() {
    try {
      return Boolean(
        document.documentElement &&
          document.documentElement.dataset &&
          document.documentElement.dataset.sweeprProActive === '1'
      );
    } catch (e) {
      return false;
    }
  }

  function notifyStealthBypass(detail) {
    if (!isProEntitled()) return;
    try {
      const targetOrigin =
        window.location && window.location.origin && window.location.origin !== 'null'
          ? window.location.origin
          : '*';
      window.postMessage(
        { source: 'sweepr-deepstealth', type: 'STEALTH_BYPASS_TRIGGERED', detail: detail || '' },
        targetOrigin
      );
    } catch (e) {}
  }

  // Common ad/tracker domain & path patterns used by anti-adblock probes
  const AD_PROBE_URL_REGEX =
    /(googlesyndication\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|imasdk\.googleapis\.com|adnxs\.com|adsrvr\.org|criteo\.(com|net)|rubiconproject\.com|pubmatic\.com|openx\.net|taboola\.com|outbrain\.com|amazon-adsystem\.com|moatads\.com|scorecardresearch\.com|quantserve\.com|ads-twitter\.com|connect\.facebook\.net\/.*\/fbevents|admiral\.com|getadmiral\.com|fundingchoicesmessages\.google\.com|pagefair\.com|\/ads\.js(\?|$)|\/adframe\.js(\?|$)|\/adblock-detect|\/show_ads\.js|\/adsbygoogle\.js)/i;

  // ============================================================================
  // LAYER 1B: <script onerror> -> <script onload> Alchemist
  // When declarativeNetRequest blocks a <script src="..."> at the network layer,
  // Chrome fires an 'error' event on the <script> element, which triggers anti-adblock walls.
  // We intercept the error in the capture phase, suppress it, and fire a synthetic 'load' event.
  // ============================================================================
  window.addEventListener(
    'error',
    function (event) {
      const target = event.target;
      if (target && target.tagName === 'SCRIPT') {
        const src = target.src || target.getAttribute('src') || '';
        if (AD_PROBE_URL_REGEX.test(src)) {
          event.stopImmediatePropagation();
          event.stopPropagation();
          event.preventDefault();
          notifyStealthBypass('script-onerror-suppressed:' + src);
          setTimeout(() => {
            try {
              const loadEvt = new Event('load', { bubbles: false, cancelable: false });
              target.dispatchEvent(loadEvt);
              if (typeof target.onload === 'function') {
                target.onload(loadEvt);
              }
            } catch (e) {}
          }, 1);
          return false;
        }
      }
    },
    true // capture phase before any inline or attached onerror handler runs
  );

  // Also wrap HTMLScriptElement.prototype.onerror setter so direct assignments never fire on ad scripts
  const origScriptOnerror = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onerror');
  if (origScriptOnerror) {
    Object.defineProperty(HTMLScriptElement.prototype, 'onerror', {
      get: function () {
        return this.__deepstealthOnerror || null;
      },
      set: function (fn) {
        this.__deepstealthOnerror = fn;
        const self = this;
        origScriptOnerror.set.call(this, function (evt) {
          const src = self.src || self.getAttribute('src') || '';
          if (AD_PROBE_URL_REGEX.test(src)) {
            notifyStealthBypass('script-onerror-setter-intercepted');
            if (typeof self.onload === 'function') {
              try {
                self.onload(new Event('load'));
              } catch (e) {}
            }
            return;
          }
          if (typeof fn === 'function') {
            return fn.apply(this, arguments);
          }
        });
      },
      configurable: true
    });
  }

  // ============================================================================
  // LAYER 2: Global Ad SDK & Canary Variable Spoofing (AdSense, GPT, IMA, Admiral, FuckAdBlock)
  // ============================================================================
  const safeDefine = (obj, prop, value) => {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        set: () => {},
        configurable: true
      });
    } catch (e) {}
  };

  safeDefine(window, 'canRunAds', true);
  safeDefine(window, 'isAdBlockActive', false);
  safeDefine(window, 'adblock', false);
  safeDefine(window, '__adblock', false);
  safeDefine(window, 'hasAdblock', false);
  safeDefine(window, 'adBlocker', false);
  safeDefine(window, 'google_ad_status', 1);
  safeDefine(window, 'google_ad_loaded', true);

  // Google AdSense (window.adsbygoogle) Surrogate Stub
  const adsbygoogleStub = {
    loaded: true,
    push: function (obj) {
      if (obj && typeof obj.callback === 'function') {
        try {
          obj.callback();
        } catch (e) {}
      }
      return 1;
    }
  };
  try {
    window.adsbygoogle = window.adsbygoogle || adsbygoogleStub;
    window.adsbygoogle.loaded = true;
    window.adsbygoogle.push = adsbygoogleStub.push;
  } catch (e) {}

  // Google Publisher Tag (window.googletag) Surrogate Stub
  const createSlotStub = () => {
    const slot = {
      addService: () => slot,
      setTargeting: () => slot,
      getTargeting: () => [],
      getTargetingKeys: () => [],
      clearTargeting: () => slot,
      setCategoryExclusion: () => slot,
      setCollapseEmptyDiv: () => slot,
      defineSizeMapping: () => slot,
      getSlotElementId: () => 'div-gpt-ad-stub',
      getAdUnitPath: () => '/stub',
      getServices: () => [],
      getSizes: () => [{ getWidth: () => 300, getHeight: () => 250 }]
    };
    return slot;
  };

  const pubadsStub = {
    addEventListener: function (event, cb) {
      if (event === 'slotRenderEnded' && typeof cb === 'function') {
        setTimeout(() => {
          try {
            cb({
              isEmpty: false,
              size: [300, 250],
              slot: createSlotStub(),
              advertiserId: 1,
              campaignId: 1,
              creativeId: 1,
              lineItemId: 1
            });
          } catch (e) {}
        }, 5);
      }
      return pubadsStub;
    },
    removeEventListener: () => pubadsStub,
    enableSingleRequest: () => {},
    enableAsyncRendering: () => {},
    enableSyncRendering: () => {},
    enableVideoAds: () => {},
    collapseEmptyDivs: () => {},
    disableInitialLoad: () => {},
    setTargeting: () => pubadsStub,
    clearTargeting: () => pubadsStub,
    setCentering: () => {},
    setCookieOptions: () => pubadsStub,
    setLocation: () => pubadsStub,
    setPublisherProvidedId: () => pubadsStub,
    refresh: () => {},
    clear: () => true,
    getSlots: () => [createSlotStub()]
  };

  const cmdQueue = [];
  cmdQueue.push = function (...fns) {
    for (const fn of fns) {
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (e) {}
      }
    }
    return cmdQueue.length;
  };

  const googletagStub = {
    cmd: cmdQueue,
    apiReady: true,
    pubadsReady: true,
    version: '2026010101',
    companionAds: () => ({ addEventListener: () => {}, setRefreshUnfilledSlots: () => {} }),
    content: () => ({ setContent: () => {} }),
    defineSlot: () => createSlotStub(),
    defineOutOfPageSlot: () => createSlotStub(),
    defineUnit: () => createSlotStub(),
    destroySlots: () => true,
    disablePublisherConsole: () => {},
    display: () => {},
    enableServices: () => {},
    getVersion: () => '2026010101',
    openConsole: () => {},
    pubads: () => pubadsStub,
    setAdIframeTitle: () => {},
    sizeMapping: () => ({
      addSize: function () {
        return this;
      },
      build: () => []
    })
  };

  try {
    window.googletag = Object.assign(window.googletag || {}, googletagStub);
  } catch (e) {}

  // Google IMA HTML5 Video SDK (window.google.ima) Surrogate Stub
  // Prevents video players on news/streaming sites from hanging when IMA pre-roll ads are blocked
  try {
    window.google = window.google || {};
    if (!window.google.ima) {
      const AdEvent = {
        Type: {
          ALL_ADS_COMPLETED: 'allAdsCompleted',
          CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
          CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
          LOADED: 'loaded',
          STARTED: 'started',
          COMPLETE: 'complete',
          SKIPPED: 'skipped'
        }
      };
      const AdErrorEvent = { Type: { AD_ERROR: 'adError' } };
      const AdsManagerLoadedEvent = { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } };

      const createAdsManagerStub = () => {
        const listeners = {};
        return {
          addEventListener: (type, fn) => {
            listeners[type] = listeners[type] || [];
            listeners[type].push(fn);
          },
          removeEventListener: () => {},
          init: () => {},
          start: () => {
            // Immediately signal that ads finished so main video plays right away
            const resumeFns = listeners[AdEvent.Type.CONTENT_RESUME_REQUESTED] || [];
            const doneFns = listeners[AdEvent.Type.ALL_ADS_COMPLETED] || [];
            setTimeout(() => {
              resumeFns.forEach((f) => { try { f({ type: AdEvent.Type.CONTENT_RESUME_REQUESTED }); } catch (e) {} });
              doneFns.forEach((f) => { try { f({ type: AdEvent.Type.ALL_ADS_COMPLETED }); } catch (e) {} });
            }, 5);
          },
          resize: () => {},
          destroy: () => {},
          setVolume: () => {},
          getVolume: () => 0,
          pause: () => {},
          resume: () => {},
          skip: () => {},
          getRemainingTime: () => 0
        };
      };

      window.google.ima = {
        AdDisplayContainer: function () {
          this.initialize = function () {};
          this.destroy = function () {};
        },
        AdsLoader: function () {
          const loaderListeners = {};
          this.addEventListener = function (type, fn) {
            loaderListeners[type] = loaderListeners[type] || [];
            loaderListeners[type].push(fn);
          };
          this.removeEventListener = function () {};
          this.contentComplete = function () {};
          this.destroy = function () {};
          this.getSettings = function () {
            return {
              setPlayerType: () => {},
              setPlayerVersion: () => {},
              setVpaidMode: () => {},
              setLocale: () => {},
              setAutoPlayAdBreaks: () => {}
            };
          };
          this.requestAds = function () {
            const loadedFns = loaderListeners[AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED] || [];
            setTimeout(() => {
              loadedFns.forEach((f) => {
                try {
                  f({
                    getAdsManager: () => createAdsManagerStub()
                  });
                } catch (e) {}
              });
            }, 5);
          };
        },
        AdsRequest: function () {},
        AdsRenderingSettings: function () {},
        ImaSdkSettings: { VpaidMode: { ENABLED: 1, INSECURE: 2, DISABLED: 0 } },
        ViewMode: { NORMAL: 'normal', FULLSCREEN: 'fullscreen' },
        AdEvent,
        AdErrorEvent,
        AdsManagerLoadedEvent,
        settings: { setLocale: () => {}, setVpaidMode: () => {}, setDisableCustomPlaybackForIOS10Plus: () => {} }
      };
    }
  } catch (e) {}

  // Neutralize BlockAdBlock / FuckAdBlock / SniffAdBlock classes & instances
  function FakeAdBlockDetector() {}
  FakeAdBlockDetector.prototype = {
    check: function ( loop ) {
      return false;
    },
    clearEvent: function () {},
    emitEvent: function (detected) {
      return this;
    },
    setOption: function () {
      return this;
    },
    on: function (detected, fn) {
      if (detected === false && typeof fn === 'function') {
        try {
          fn();
        } catch (e) {}
      } else {
        notifyStealthBypass('fuckadblock-on-detected-suppressed');
      }
      return this;
    },
    onDetected: function () {
      notifyStealthBypass('fuckadblock-onDetected-suppressed');
      return this;
    },
    onNotDetected: function (fn) {
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (e) {}
      }
      return this;
    }
  };

  const fakeDetectorInstance = new FakeAdBlockDetector();
  for (const name of ['BlockAdBlock', 'FuckAdBlock', 'SniffAdBlock']) {
    safeDefine(window, name, FakeAdBlockDetector);
  }
  for (const inst of ['blockAdBlock', 'fuckAdBlock', 'sniffAdBlock']) {
    safeDefine(window, inst, fakeDetectorInstance);
  }

  // ============================================================================
  // LAYER 3: DOM Bait / Honeypot Geometry & Computed-Style Cloaking
  // ============================================================================
  const BAIT_CLASS_REGEX =
    /\b(adsbox|pub_300x250|pub_300x250m|pub_728x90|text-ad|textAd|text_ad|text_ads|text-ads|text-ad-links|ad-tester|ad_tester|adblock-test|ad-banner-bait|ad-banner|ad_banner|ad-unit|ad_unit|ad-zone|ad_zone|ad-space|ad-placeholder|banner_ad|banner-ads|google-ad|dfp-ad|adSlot|ad-300x250|ad-728x90|adsbygoogle)\b/i;
  const BAIT_ID_REGEX =
    /^(ad-tester|ad_tester|adtester|adsbox|ad-bait|carbonads-test|ad_iframe|ad-banner|google_ads_frame)$/i;

  function isBaitElement(el) {
    if (!isProEntitled()) return false;
    if (!el || el.nodeType !== 1) return false;
    const cls = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    if (BAIT_CLASS_REGEX.test(cls) || BAIT_ID_REGEX.test(id)) return true;
    // Also detect classic 1x1 or &nbsp; empty bait divs with "ad" in class/id
    if (/\bad(s|vert|banner|box|slot|zone)?\b/i.test(cls + ' ' + id)) {
      if (el.children.length === 0 && (el.innerHTML === '&nbsp;' || el.innerHTML.trim() === '')) {
        return true;
      }
    }
    return false;
  }

  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const origClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  const origClientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  const origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');

  if (origOffsetHeight && origOffsetHeight.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      get: function () {
        if (isBaitElement(this)) {
          notifyStealthBypass('bait-offsetHeight-spoofed');
          return 250;
        }
        return origOffsetHeight.get.call(this);
      },
      configurable: true
    });
  }

  if (origOffsetWidth && origOffsetWidth.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      get: function () {
        if (isBaitElement(this)) return 300;
        return origOffsetWidth.get.call(this);
      },
      configurable: true
    });
  }

  if (origClientHeight && origClientHeight.get) {
    Object.defineProperty(Element.prototype, 'clientHeight', {
      get: function () {
        if (isBaitElement(this)) return 250;
        return origClientHeight.get.call(this);
      },
      configurable: true
    });
  }

  if (origClientWidth && origClientWidth.get) {
    Object.defineProperty(Element.prototype, 'clientWidth', {
      get: function () {
        if (isBaitElement(this)) return 300;
        return origClientWidth.get.call(this);
      },
      configurable: true
    });
  }

  if (origOffsetParent && origOffsetParent.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      get: function () {
        if (isBaitElement(this)) {
          return document.body || document.documentElement;
        }
        return origOffsetParent.get.call(this);
      },
      configurable: true
    });
  }

  const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if (isBaitElement(this)) {
      return new DOMRect(10, 10, 300, 250);
    }
    return origGetBoundingClientRect.apply(this, arguments);
  };

  const origGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (el, pseudo) {
    const style = origGetComputedStyle.call(window, el, pseudo);
    if (!pseudo && isBaitElement(el)) {
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'display') return 'block';
          if (prop === 'visibility') return 'visible';
          if (prop === 'opacity') return '1';
          if (prop === 'height') return '250px';
          if (prop === 'width') return '300px';
          if (prop === 'getPropertyValue') {
            return (name) => {
              if (name === 'display') return 'block';
              if (name === 'visibility') return 'visible';
              if (name === 'opacity') return '1';
              if (name === 'height') return '250px';
              if (name === 'width') return '300px';
              return target.getPropertyValue(name);
            };
          }
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    }
    return style;
  };

  // ============================================================================
  // LAYER 4: Fetch & XMLHttpRequest Anti-Adblock Probe Interceptor
  // ============================================================================
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
      if (isProEntitled() && AD_PROBE_URL_REGEX.test(url)) {
        notifyStealthBypass('fetch-probe-spoofed:' + url);
        return new Response('/* deepstealth ok */\nwindow.canRunAds=true;window.google_ad_status=1;\n', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
        });
      }
      try {
        return await origFetch.apply(this, arguments);
      } catch (err) {
        if (isProEntitled() && AD_PROBE_URL_REGEX.test(url)) {
          notifyStealthBypass('fetch-error-recovered:' + url);
          return new Response('/* deepstealth fallback ok */', { status: 200, statusText: 'OK' });
        }
        throw err;
      }
    };
  }

  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__deepstealthUrl = String(url || '');
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (isProEntitled() && this.__deepstealthUrl && AD_PROBE_URL_REGEX.test(this.__deepstealthUrl)) {
      notifyStealthBypass('xhr-probe-spoofed:' + this.__deepstealthUrl);
      const xhr = this;
      setTimeout(() => {
        try {
          Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
          Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
          Object.defineProperty(xhr, 'responseText', { value: '/* ok */', configurable: true });
          Object.defineProperty(xhr, 'response', { value: '/* ok */', configurable: true });
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new ProgressEvent('load'));
          xhr.dispatchEvent(new ProgressEvent('loadend'));
        } catch (e) {}
      }, 4);
      return;
    }
    return origXhrSend.apply(this, arguments);
  };

  // ============================================================================
  // LAYER 5: YouTube Player JSON Ad-Placement Sanitizer (youtubei/v1/player)
  // Strips adPlacements, playerAds, and adSlots from YouTube player JSON payloads
  // BEFORE the player schedules pre-roll or mid-roll ads, avoiding enforcement triggers.
  // ============================================================================
  if (/(^|\.)youtube\.com$/i.test(location.hostname)) {
    function stripYtAdsFromObject(obj) {
      if (!isProEntitled()) return obj;
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj.adPlacements)) {
        obj.adPlacements = [];
        notifyStealthBypass('yt-adPlacements-stripped');
      }
      if (Array.isArray(obj.playerAds)) {
        obj.playerAds = [];
      }
      if (Array.isArray(obj.adSlots)) {
        obj.adSlots = [];
      }
      if (obj.playerResponse && typeof obj.playerResponse === 'object') {
        stripYtAdsFromObject(obj.playerResponse);
      }
      return obj;
    };

    // Intercept window.ytInitialPlayerResponse assignment
    let ytPlayerRespValue = window.ytInitialPlayerResponse;
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get: () => ytPlayerRespValue,
        set: (val) => {
          ytPlayerRespValue = stripYtAdsFromObject(val);
        },
        configurable: true
      });
    } catch (e) {}

    // Intercept Response.prototype.json() for /youtubei/v1/player & /youtubei/v1/next
    const origRespJson = Response.prototype.json;
    Response.prototype.json = async function () {
      const data = await origRespJson.apply(this, arguments);
      try {
        if (this.url && /\/youtubei\/v1\/(player|next)/i.test(this.url)) {
          return stripYtAdsFromObject(data);
        }
      } catch (e) {}
      return data;
    };
  }
})();
