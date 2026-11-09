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
      if (
        document.documentElement &&
        document.documentElement.dataset &&
        document.documentElement.dataset.sweeprPaused === '1'
      ) {
        return false;
      }
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__sweepr_unpaid') === '1') {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  let stealthBypassNotified = false;
  function notifyStealthBypass(detail) {
    if (stealthBypassNotified || !isProEntitled()) return;
    stealthBypassNotified = true;
    try {
      if (window.location && window.location.origin && window.location.origin !== 'null') {
        window.postMessage(
          { source: 'sweepr-deepstealth', type: 'STEALTH_BYPASS_TRIGGERED', detail: detail || '' },
          window.location.origin
        );
      }
    } catch (e) {}
  }

  // Preserve native Function.prototype.toString appearance on wrapped APIs to defeat Ad-Shield / integrity checks
  const nativeFnStrings = typeof WeakMap === 'function' ? new WeakMap() : null;
  const origFnToString = Function.prototype.toString;
  const markNative = (fn, name) => {
    try {
      if (typeof fn === 'function' && nativeFnStrings) {
        nativeFnStrings.set(fn, `function ${name || fn.name || ''}() { [native code] }`);
      }
    } catch (e) {}
    return fn;
  };
  try {
    const wrappedToString = function toString() {
      if (nativeFnStrings && nativeFnStrings.has(this)) {
        return nativeFnStrings.get(this);
      }
      return origFnToString.apply(this, arguments);
    };
    markNative(wrappedToString, 'toString');
    Function.prototype.toString = wrappedToString;
  } catch (e) {}

  // Preserve original unbound function reference across Function.prototype.bind so bound popunder listeners
  // (e.g. PopAds `this._onExecute.bind(this)`) cannot hide their source code behind `function () { [native code] }`
  const origFnBind = Function.prototype.bind;
  if (typeof origFnBind === 'function') {
    try {
      const wrappedFnBind = function bind(thisArg) {
        const bound = origFnBind.apply(this, arguments);
        try {
          if (typeof this === 'function') {
            Object.defineProperty(bound, '__deepstealthOrigFn', {
              value: this.__deepstealthOrigFn || this,
              enumerable: false,
              configurable: true
            });
          }
        } catch (e) {}
        return bound;
      };
      markNative(wrappedFnBind, 'bind');
      Function.prototype.bind = wrappedFnBind;
    } catch (e) {}
  }

  // Lock Event.prototype.stopImmediatePropagation and MouseEvent.prototype.stopImmediatePropagation
  // so Monetag/OnClick (`on.js` Nu.prototype.Wr) cannot overwrite it with a no-op to disarm capture-phase shields
  try {
    for (const EvtProto of [
      typeof Event !== 'undefined' ? Event.prototype : null,
      typeof MouseEvent !== 'undefined' ? MouseEvent.prototype : null
    ]) {
      if (EvtProto && typeof EvtProto.stopImmediatePropagation === 'function') {
        const origStopImm = EvtProto.stopImmediatePropagation;
        Object.defineProperty(EvtProto, 'stopImmediatePropagation', {
          value: origStopImm,
          writable: false,
          configurable: false
        });
      }
    }
  } catch (e) {}

  // Common ad/tracker domain & path patterns used by anti-adblock probes
  const AD_PROBE_URL_REGEX =
    /(googlesyndication\.com|doubleclick\.net|google-analytics\.com|googletagmanager\.com|imasdk\.googleapis\.com|adnxs\.com|adsrvr\.org|criteo\.(com|net)|rubiconproject\.com|pubmatic\.com|openx\.net|taboola\.com|outbrain\.com|amazon-adsystem\.com|moatads\.com|scorecardresearch\.com|quantserve\.com|ads-twitter\.com|connect\.facebook\.net\/.*\/fbevents|admiral\.com|getadmiral\.com|fundingchoicesmessages\.google\.com|pagefair\.com|applzr\.com|goadserver\.com|gsrv\.dev|aaaconnect\.info|onclckmn\.com|onclicka\.com|adsmediabox\.com|awmdelivery\.com|acquaintjokinglyscoring\.com|rmzsglng\.com|aivanta76\.com|bongacams2\.com|gotpd\.me|superwebhub\.cyou|fozekikikiminu\.com|janusaent\.com|growcdnssedge\.com|saawsedge\.com|doppiocdn\.com|sacdnssedge\.com|magsrv\.com|exoclick\.com|adtng\.com|dreamserve\.dev|velvetloom\.net|creepy-frame\.com|smartfloralab\.com|realxxx\.com|traffichunt\.com|camsoda\.ai|livemediahost\.com|statserv\.net|\/ads\/prebid-ads|s\.yimg\.com\/(aaq\/(vzm\/cs|prebid|f10d509c)|ss\/analytics|du\/)|opus\.analytics\.yahoo\.com|consent\.cmp\.oath\.com|pbs\.yahoo\.com|udc\.yahoo\.com|\/pagead\/gen_204|\/ads\.js(\?|$)|\/adframe\.js(\?|$)|\/adblock-detect|\/show_ads\.js|\/adsbygoogle\.js)/i;

  // ============================================================================
  // LAYER 1B: <script/img onerror> -> <script/img onload> Alchemist
  // When declarativeNetRequest blocks a <script src="..."> or <img src="..."> probe at the network layer,
  // Chrome fires an 'error' event on the element, which triggers anti-adblock walls (e.g. is_gen = true).
  // We intercept the error in the capture phase, suppress it, and fire a synthetic 'load' event.
  // ============================================================================
  window.addEventListener(
    'error',
    function (event) {
      const target = event.target;
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'IMG')) {
        const src = target.src || target.getAttribute('src') || '';
        if (
          target.tagName === 'SCRIPT' &&
          (target.hasAttribute('data-clocid') ||
            /(\/on\.js(\?|$)|\.min\.css(\?|$)|magnific-popup\.min\.js|holaraphraus\.com|earthspetti\.com|terschomonic\.com|enomotia\.com|janitorprecisiontrio\.com|pagerrentablespotlight\.com|displayvertising\.com|jusgrmawfbaqu\.com|bspyoibtwrrc\.com|cemhlobja\.com|d3mzokty951c5w\.cloudfront\.net|adsco\.re)/i.test(
              src
            ))
        ) {
          event.stopImmediatePropagation();
          event.stopPropagation();
          event.preventDefault();
          try {
            target.onerror = null;
            target.onload = null;
            target.removeAttribute('onerror');
            target.removeAttribute('onload');
          } catch (e) {}
          notifyStealthBypass('popunder-script-onerror-suppressed:' + src);
          return false;
        }
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

  // Also wrap HTMLScriptElement & HTMLImageElement .onerror setters so direct assignments never fire on ad probes
  const origScriptOnerror = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onerror');
  if (origScriptOnerror) {
    for (const Proto of [HTMLScriptElement.prototype, HTMLImageElement.prototype]) {
      try {
        Object.defineProperty(Proto, 'onerror', {
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
      } catch (e) {}
    }
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
  safeDefine(window, '__ads', true);
  safeDefine(window, 'hasAdblock', false);
  safeDefine(window, 'adBlocker', false);
  safeDefine(window, 'is_gen', false);
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
    setConfig: () => pubadsStub,
    getConfig: () => ({ targeting: {} }),
    getEventLog: () => ({ getAllEvents: () => [] }),
    getSlotIdMap: () => ({}),
    getAttributeKeys: () => [],
    get: () => null,
    set: () => pubadsStub,
    updateCorrelator: () => pubadsStub,
    isInitialLoadDisabled: () => false,
    isSRA: () => true,
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
    setConfig: () => {},
    getConfig: () => ({ targeting: {} }),
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
    /\b(adsbox|pub_300x250|pub_300x250m|pub_728x90|text-ad|textAd|text_ad|text_ads|text-ads|text-ad-links|ad-tester|ad_tester|adblock-test|ad-banner-bait|ad-banner|ad_banner|ad-unit|ad_unit|ad-zone|ad_zone|ad-space|adv-space|ad-placeholder|banner_ad|banner-ad|banner-ads|content_ad|content-ad|side_ad|ad01|google-ad|dfp-ad|adSlot|ad-300x250|ad-728x90|adsbygoogle|trc-content-sponsored|trc_related_container|jag8CityBio212023)\b/i;
  const BAIT_ID_REGEX =
    /^(ad-tester|ad_tester|adtester|adsbox|ad-bait|ad-unit|taboola-stream-1|carbonads-test|ad_iframe|ad-banner|google_ads_frame)$/i;

  function isBaitElement(el) {
    if (!isProEntitled()) return false;
    if (!el || el.nodeType !== 1) return false;
    if (
      el.parentElement &&
      el.parentElement.tagName === 'HEAD' &&
      !/^(SCRIPT|STYLE|LINK|META|TITLE|BASE|NOSCRIPT)$/i.test(el.tagName)
    ) {
      return true;
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    if (BAIT_CLASS_REGEX.test(cls) || BAIT_ID_REGEX.test(id)) return true;
    // Also detect classic 1x1 or &nbsp; empty bait divs with "ad" in class/id
    if (/\bad(s|vert|banner|box|slot|zone)?\b/i.test(cls + ' ' + id)) {
      if (el.children.length === 0 && (el.textContent || '').replace(/\u00a0/g, '').trim() === '') {
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
  const baitStyleProxyCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  window.getComputedStyle = function (el, pseudo) {
    const style = origGetComputedStyle.call(window, el, pseudo);
    if (!pseudo && isBaitElement(el)) {
      if (baitStyleProxyCache && baitStyleProxyCache.has(el)) {
        return baitStyleProxyCache.get(el);
      }
      const proxy = new Proxy(style, {
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
      if (baitStyleProxyCache) {
        baitStyleProxyCache.set(el, proxy);
      }
      return proxy;
    }
    return style;
  };

  // ============================================================================
  // LAYER 4: Fetch & XMLHttpRequest Anti-Adblock Probe Interceptor
  // ============================================================================
  const PROBE_SURROGATE_JS =
    '/* deepstealth ok */\nwindow.googletag=window.googletag||{cmd:[],apiReady:true,pubadsReady:true};window.canRunAds=true;window.google_ad_status=1;window.taboola_view_id=1;window._taboola=window._taboola||[];\n';

  function createSpoofedProbeResponse(url) {
    const resp = new Response(PROBE_SURROGATE_JS, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
    });
    try {
      Object.defineProperty(resp, 'redirected', { value: false, configurable: true });
      Object.defineProperty(resp, 'type', { value: 'basic', configurable: true });
      if (url) {
        Object.defineProperty(resp, 'url', { value: String(url), configurable: true });
      }
    } catch (e) {}
    return resp;
  }

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    const wrappedFetch = async function fetch(input, init) {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
      if (isProEntitled() && AD_PROBE_URL_REGEX.test(url)) {
        notifyStealthBypass('fetch-probe-spoofed:' + url);
        return createSpoofedProbeResponse(url);
      }
      try {
        return await origFetch.apply(this, arguments);
      } catch (err) {
        if (isProEntitled() && AD_PROBE_URL_REGEX.test(url)) {
          notifyStealthBypass('fetch-error-recovered:' + url);
          return createSpoofedProbeResponse(url);
        }
        throw err;
      }
    };
    markNative(wrappedFetch, 'fetch');
    window.fetch = wrappedFetch;
  }

  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  const wrappedXhrOpen = function open(method, url) {
    this.__deepstealthUrl = String(url || '');
    return origXhrOpen.apply(this, arguments);
  };
  markNative(wrappedXhrOpen, 'open');
  XMLHttpRequest.prototype.open = wrappedXhrOpen;

  const wrappedXhrSend = function send() {
    if (isProEntitled() && this.__deepstealthUrl && AD_PROBE_URL_REGEX.test(this.__deepstealthUrl)) {
      notifyStealthBypass('xhr-probe-spoofed:' + this.__deepstealthUrl);
      const xhr = this;
      setTimeout(() => {
        try {
          Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
          Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
          Object.defineProperty(xhr, 'responseText', { value: PROBE_SURROGATE_JS, configurable: true });
          Object.defineProperty(xhr, 'response', { value: PROBE_SURROGATE_JS, configurable: true });
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new ProgressEvent('load'));
          xhr.dispatchEvent(new ProgressEvent('loadend'));
        } catch (e) {}
      }, 4);
      return;
    }
    return origXhrSend.apply(this, arguments);
  };
  markNative(wrappedXhrSend, 'send');
  XMLHttpRequest.prototype.send = wrappedXhrSend;

  // ============================================================================
  // LAYER 5B: Yahoo / Ad-Shield BFA & Next.js ad-shield-container Neutralizer
  // Defeats Yahoo Sports / Finance / News `ad-shield-container`, `thamba` cookie,
  // `benji_as_bfa`, `wirozhoqsznqmjxs.js` / `noqkdrrzkmxaxhfx.js`, and `report.error-report.com`.
  // ============================================================================
  if (/(^|\.)yahoo\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'thamba=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'thamba=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + location.hostname + '; path=/;';
      document.cookie = 'thamba=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.yahoo.com; path=/;';
      sessionStorage.removeItem('benji_as_bfa');
      localStorage.removeItem('isTaboolaBlocked');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.includes('_fa_')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}

    // Prevent Yahoo scripts from setting or reading thamba=1 adblock detection cookie
    try {
      const cookieDesc =
        Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
        Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
      if (cookieDesc && cookieDesc.get && cookieDesc.set) {
        Object.defineProperty(document, 'cookie', {
          get: function () {
            const raw = cookieDesc.get.call(this);
            return String(raw || '').replace(/(?:^|;\s*)thamba=1(?=\s*;|$)/g, '');
          },
          set: function (val) {
            const str = String(val || '');
            if (/^\s*thamba=1\b/i.test(str)) {
              notifyStealthBypass('yahoo-thamba-cookie-suppressed');
              return;
            }
            return cookieDesc.set.call(this, val);
          },
          configurable: true
        });
      }
    } catch (e) {}
  }

  // Sanitize Yahoo `window.benjiSSRContext` & Next.js `self.__next_s` beforeInteractive script queue
  const sanitizeBenjiContext = (ctx) => {
    if (!ctx || typeof ctx !== 'object') return ctx;
    try {
      ctx.adBlockCookie = '';
      if (ctx.features && typeof ctx.features === 'object') {
        ctx.features.enableAdBlockDetection_ssr = false;
        ctx.features.enableAdShield_ssr = false;
      }
    } catch (e) {}
    return ctx;
  };

  try {
    let benjiStore = sanitizeBenjiContext(window.benjiSSRContext);
    Object.defineProperty(window, 'benjiSSRContext', {
      get: () => benjiStore,
      set: (val) => {
        benjiStore = isProEntitled() ? sanitizeBenjiContext(val) : val;
      },
      configurable: true
    });
  } catch (e) {}

  const sanitizeNextSEntry = (entry) => {
    try {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const meta = entry[1];
      if (!meta || typeof meta !== 'object') return;
      const code = String(meta.children || '');
      if (
        meta.id === 'ad-shield-container' ||
        code.includes('benji_as_bfa') ||
        code.includes('report.error-report.com') ||
        code.includes('[AdBlock] Error in ad block detection script')
      ) {
        meta.children = '/* deepstealth: ad-shield-container disarmed */';
        notifyStealthBypass('nextjs-ad-shield-container-disarmed');
      } else if (meta.id === 'benji-ssr-context' || code.includes('benjiSSRContext')) {
        meta.children = code
          .replace(/"enableAdBlockDetection_ssr"\s*:\s*true/g, '"enableAdBlockDetection_ssr":false')
          .replace(/"enableAdShield_ssr"\s*:\s*true/g, '"enableAdShield_ssr":false')
          .replace(/adBlockCookie\s*:\s*"[^"]*"/g, 'adBlockCookie: ""');
      }
    } catch (e) {}
  };

  try {
    const sanitizeNextSArray = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        sanitizeNextSEntry(arr[i]);
      }
      if (!arr.__deepstealthHooked) {
        const origPush = arr.push;
        Object.defineProperty(arr, 'push', {
          value: function (...items) {
            for (const item of items) {
              sanitizeNextSEntry(item);
            }
            return origPush.apply(this, items);
          },
          configurable: true,
          writable: true
        });
        Object.defineProperty(arr, '__deepstealthHooked', { value: true, enumerable: false });
      }
    };

    let nextSStore = window.__next_s;
    if (Array.isArray(nextSStore)) {
      sanitizeNextSArray(nextSStore);
    }
    Object.defineProperty(window, '__next_s', {
      get: () => nextSStore,
      set: (val) => {
        nextSStore = val;
        if (Array.isArray(val)) sanitizeNextSArray(val);
      },
      configurable: true
    });
  } catch (e) {}

  // ============================================================================
  // LAYER 5: YouTube Player JSON Ad-Placement Sanitizer (youtubei/v1/player)
  // Strips adPlacements, playerAds, and adSlots from YouTube player JSON payloads
  // BEFORE the player schedules pre-roll or mid-roll ads, avoiding enforcement triggers.
  // ============================================================================
  if (/(^|\.)youtube\.com$/i.test(location.hostname)) {
    function stripYtAdsFromObject(obj, depth = 0) {
      if (!isProEntitled() || depth > 8) return obj;
      if (!obj || typeof obj !== 'object') return obj;
      try {
        if (Array.isArray(obj.adPlacements) && obj.adPlacements.length > 0) {
          obj.adPlacements = [];
          notifyStealthBypass('yt-adPlacements-stripped');
        }
        if (Array.isArray(obj.playerAds) && obj.playerAds.length > 0) {
          obj.playerAds = [];
        }
        if (Array.isArray(obj.adSlots) && obj.adSlots.length > 0) {
          obj.adSlots = [];
        }
        if ('adBreakHeartbeatParams' in obj) {
          delete obj.adBreakHeartbeatParams;
        }
        if (obj.playerResponse && typeof obj.playerResponse === 'object') {
          stripYtAdsFromObject(obj.playerResponse, depth + 1);
        }
        if (Array.isArray(obj.onResponseReceivedEndpoints)) {
          obj.onResponseReceivedEndpoints.forEach((ep) => stripYtAdsFromObject(ep, depth + 1));
        }
      } catch (e) {}
      return obj;
    }

    // Intercept window.ytInitialPlayerResponse assignment
    let ytPlayerRespValue = stripYtAdsFromObject(window.ytInitialPlayerResponse);
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get: () => ytPlayerRespValue,
        set: (val) => {
          ytPlayerRespValue = stripYtAdsFromObject(val);
        },
        configurable: true
      });
    } catch (e) {}

    // Wrap JSON.parse so YouTube's internal text-based JSON parsing of player/next responses also strips ads
    const origJsonParse = JSON.parse;
    JSON.parse = function (text, reviver) {
      const parsed = origJsonParse.apply(this, arguments);
      try {
        if (
          parsed &&
          typeof parsed === 'object' &&
          ('adPlacements' in parsed || 'playerAds' in parsed || 'adSlots' in parsed || 'playerResponse' in parsed)
        ) {
          return stripYtAdsFromObject(parsed);
        }
      } catch (e) {}
      return parsed;
    };

    // Intercept Response.prototype.json() and Response.prototype.text() for /youtubei/v1/player & /youtubei/v1/next
    const origRespJson = Response.prototype.json;
    Response.prototype.json = async function () {
      const data = await origRespJson.apply(this, arguments);
      try {
        if (!this.url || /\/youtubei\/v1\/(player|next|browse|search)/i.test(this.url)) {
          return stripYtAdsFromObject(data);
        }
      } catch (e) {}
      return data;
    };

    const origRespText = Response.prototype.text;
    Response.prototype.text = async function () {
      const txt = await origRespText.apply(this, arguments);
      try {
        if (
          this.url &&
          /\/youtubei\/v1\/(player|next)/i.test(this.url) &&
          txt &&
          (txt.includes('"adPlacements"') || txt.includes('"playerAds"') || txt.includes('"adSlots"'))
        ) {
          const parsed = origJsonParse(txt);
          stripYtAdsFromObject(parsed);
          return JSON.stringify(parsed);
        }
      } catch (e) {}
      return txt;
    };
  }

  // ============================================================================
  // LAYER 6: Streaming Video VAST/In-Player JSON Sanitizer, Popunder Shield & Canary Guard
  // Defeats first-party ad loaders (/dot/dot.php, /js/fad.json), VAST pre-rolls (/xhr/video/, vast_urls),
  // ExoClick popMagic reverse tab-unders, Pornoxo __videoPlayerData.popunder & /link/out/ overlays,
  // PopAds/ClickAdu/AdSpyglass click-hijackers, and synthetic MouseEvent / <a target="_blank">.click() traps.
  // ============================================================================
  const noopFn = function () {
    return false;
  };

  try {
    Object.defineProperty(window, 'exo99HL3903jjdxtrnLoad', {
      value: true,
      writable: false,
      configurable: false
    });
  } catch (e) {
    window.exo99HL3903jjdxtrnLoad = true;
  }

  try {
    Object.defineProperty(window, 'initEPNB', {
      value: noopFn,
      writable: false,
      configurable: false
    });
  } catch (e) {}

  // Neutralize ExoClick popMagic v7.0.0 & PopAds / OnClick / AdSpyglass globals before inline scripts run
  try {
    Object.defineProperty(window, 'exoJsPop101', {
      value: Object.freeze({ add: noopFn }),
      writable: false,
      configurable: false
    });
  } catch (e) {}

  try {
    const popMagicStub = new Proxy(
      {
        version: 7,
        url: '',
        config: {},
        open_count: 999,
        top: window,
        init: noopFn,
        preparePop: noopFn,
        shouldShow: () => false,
        venorShouldShow: () => false,
        addEvent: noopFn,
        addEventToElement: noopFn,
        buildUrl: () => '',
        getunga: noopFn,
        setAsOpened: noopFn,
        isOpened: () => true,
        loadHosted: noopFn,
        findLinkToOpen: () => null,
        methods: {
          default: noopFn,
          chromeTab: noopFn,
          popup: noopFn
        }
      },
      {
        get(target, prop) {
          return prop in target ? target[prop] : noopFn;
        },
        set() {
          return true;
        }
      }
    );
    Object.defineProperty(window, 'popMagic', {
      get: () => popMagicStub,
      set: () => {},
      configurable: false
    });
  } catch (e) {}

  // Neutralize PopAds (_pop, popns, PopURL), OnClick Wasm loader (zomhphp), and AdSpyglass (__aaZoneid)
  const dummyPopArray = [];
  dummyPopArray.push = function () {
    return 0;
  };
  safeDefine(window, '_pop', dummyPopArray);
  safeDefine(window, 'popns', '0');
  safeDefine(window, 'PopURL', '');
  safeDefine(window, '__aaZoneid', undefined);
  safeDefine(window, 'zomhphp', noopFn);
  safeDefine(window, 'jlduc', noopFn);
  safeDefine(window, 'zfgloadedpopup', true);
  safeDefine(window, 'zfgloadedbanner', true);
  safeDefine(window, 'zfgloadedinpage', true);
  safeDefine(window, 'zfgloadedtag', true);
  safeDefine(window, 'zfgcodeloadedonclick', true);
  safeDefine(window, 'zfgcodeloadeddl', true);
  safeDefine(window, 'zfgcodeloadedbanner', true);
  safeDefine(window, 'zfgcodeloadedinpage', true);
  safeDefine(window, 'zfgcodeloadedtag', true);
  safeDefine(window, 'clkAISVShowing', true);
  safeDefine(window, 'd450e30498de14e8a86ba9b7ef35b856', true);
  safeDefine(window, 'd450e30498de14e8d450e30498de14e8', true);
  safeDefine(window, '_pao', Object.freeze({ parse: noopFn, fbparse: noopFn, bbrparse: noopFn }));
  safeDefine(window, 'AdscoreInit', noopFn);
  safeDefine(window, 'mergedPopups', Object.freeze([]));
  safeDefine(window, 'openPopunder', noopFn);
  safeDefine(window, 'loadBannerContent', noopFn);
  safeDefine(window, 'backgroundBanner', false);
  safeDefine(window, 'Popunder', noopFn);
  safeDefine(window, 'EPeventFire', noopFn);

  // Intercept window.atob to neutralize PopAds base64-encoded rotating domains (.min.css / magnific-popup.min.js)
  const origAtob = window.atob;
  if (typeof origAtob === 'function') {
    try {
      const wrappedAtob = function atob(encoded) {
        const decoded = origAtob.apply(this, arguments);
        if (
          isProEntitled() &&
          decoded &&
          /(\/[a-z]url\.min\.css|magnific-popup\.min\.js|displayvertising\.com|cemhlobja\.com|jusgrmawfbaqu\.com|bspyoibtwrrc\.com)/i.test(
            decoded
          )
        ) {
          notifyStealthBypass('popads-base64-domain-neutralized:' + decoded);
          return '';
        }
        return decoded;
      };
      markNative(wrappedAtob, 'atob');
      window.atob = wrappedAtob;
    } catch (e) {}
  }

  // Intercept Document/Element.prototype.querySelector for Monetag/OnClick `script[data-clocid]` lookup
  // so `on.js` (`Pu.prototype.nt`) and inline Wasm loader (`jlduc`) immediately abort with CTINSE
  for (const QsProto of [
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof Element !== 'undefined' ? Element.prototype : null
  ]) {
    if (QsProto && typeof QsProto.querySelector === 'function') {
      try {
        const origQs = QsProto.querySelector;
        const wrappedQs = function querySelector(selector) {
          if (isProEntitled() && typeof selector === 'string' && /data-cl(oc|ba|ip|pu|tg)id/i.test(selector)) {
            notifyStealthBypass('onclick-script-selector-hidden:' + selector);
            return null;
          }
          return origQs.apply(this, arguments);
        };
        markNative(wrappedQs, 'querySelector');
        QsProto.querySelector = wrappedQs;
      } catch (e) {}
    }
  }

  // Block PopAds / Galaksion polling & retry timers (`_userActivationHandler`, `_deployCatchAll`, `s[y.slice(0,16)]`, `clk$pop@`)
  const POPUNDER_TIMER_REGEX =
    /_userActivationHandler|_deployCatchAll|_adscoreDeploy|_waitForGoodWeather|_monitorLocation|s\[y\.slice\(0,\s*16\)|d450e30498de14e8|clk\$pop@/i;
  for (const timerName of ['setTimeout', 'setInterval']) {
    const origTimer = window[timerName];
    if (typeof origTimer === 'function') {
      try {
        const wrappedTimer = function (handler) {
          if (isProEntitled() && typeof handler === 'function') {
            try {
              const targetFn = handler.__deepstealthOrigFn || handler;
              const fnSrc = origFnToString.call(targetFn);
              if (fnSrc && POPUNDER_TIMER_REGEX.test(fnSrc)) {
                notifyStealthBypass('popunder-timer-blocked:' + timerName);
                return 0;
              }
            } catch (e) {}
          }
          return origTimer.apply(this, arguments);
        };
        markNative(wrappedTimer, timerName);
        window[timerName] = wrappedTimer;
      } catch (e) {}
    }
  }

  // Neutralize sxyprn.com VAST pre-roll globals (use_vast, vast_urls, vast_time, conf_on_end, fadm)
  safeDefine(window, 'use_vast', false);
  safeDefine(window, 'vast_urls', {});
  safeDefine(window, 'vast_time', []);
  safeDefine(window, 'conf_on_end', false);
  safeDefine(window, 'fadm', noopFn);

  // Neutralize Pornoxo & sister-network __videoPlayerData.clickFlow, .popunder & VAST properties
  function sanitizeVideoPlayerData(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      obj.popunder = undefined;
      Object.defineProperty(obj, 'popunder', {
        get: () => undefined,
        set: () => {},
        configurable: true
      });
      obj.clickFlow = undefined;
      Object.defineProperty(obj, 'clickFlow', {
        get: () => undefined,
        set: () => {},
        configurable: true
      });
      if ('vast' in obj) obj.vast = undefined;
      if ('vastURL' in obj) obj.vastURL = '';
      if ('ads' in obj) obj.ads = undefined;
      if ('preroll' in obj) obj.preroll = undefined;
    } catch (e) {}
    return obj;
  }

  let videoPlayerDataStore = sanitizeVideoPlayerData(window.__videoPlayerData);
  try {
    Object.defineProperty(window, '__videoPlayerData', {
      get: () => videoPlayerDataStore,
      set: (val) => {
        videoPlayerDataStore = sanitizeVideoPlayerData(val);
      },
      configurable: true
    });
  } catch (e) {}

  // Intercept window.renderVideoPlayerV3 to strip VAST pre-rolls (renderArgs.preRoll) and in-video text ads
  let realRenderVideoPlayerV3 = window.renderVideoPlayerV3;
  try {
    Object.defineProperty(window, 'renderVideoPlayerV3', {
      get: () => {
        if (typeof realRenderVideoPlayerV3 !== 'function') return realRenderVideoPlayerV3;
        return function (renderArgs) {
          try {
            if (isProEntitled() && renderArgs && typeof renderArgs === 'object') {
              renderArgs.preRoll = {};
              renderArgs.videoTextAd = undefined;
              renderArgs.nextVideoBannerUrl = null;
            }
          } catch (e) {}
          return realRenderVideoPlayerV3.apply(this, arguments);
        };
      },
      set: (fn) => {
        realRenderVideoPlayerV3 = fn;
      },
      configurable: true
    });
  } catch (e) {}

  // Neutralize adplsr video pause-banner SDK
  safeDefine(window, 'adplsr', Object.freeze({ cmd: Object.freeze({ push: noopFn }) }));

  // Neutralize TubeCorporate / txxx.me / hclips / upornia AdManager, VAST pre-roll (ad_preroll2),
  // in-player CPA banner (_playerBannerCPA / _plBtn), and bottom-right inpage skins (__inpageSkins)
  const adManagerStub = Object.freeze({
    push: function () {
      return 0;
    },
    runFormatSpot: noopFn,
    adFormats: [],
    Logger: { silentMode: true },
    getLocalConfig: () => ({}),
    getConfigHelpers: () => ({
      findFormat: () => ({ autostart: false }),
      findFormatSpot: () => null
    })
  });
  safeDefine(window, 'AdManager', adManagerStub);
  safeDefine(window, 'ad_preroll2', noopFn);
  safeDefine(window, 'canStartPreroll', 0);
  safeDefine(window, 'ignorePauseroll', true);
  safeDefine(window, 'ignoreInpage', true);
  safeDefine(window, 'ignorePopunder', true);
  safeDefine(window, 'ignoreVideoslider', true);
  safeDefine(window, 'ignoreOutstream', true);
  safeDefine(window, 'ignorePush', true);
  safeDefine(window, 'skPop', true);
  safeDefine(window, '_plBtnIgnore', true);
  safeDefine(window, '_plBtn', undefined);
  safeDefine(window, '_plBtnText', '');
  safeDefine(window, '_direct_player_btn', undefined);
  safeDefine(window, '_playerBannerCPA', undefined);
  safeDefine(window, '_playerBanner', false);
  safeDefine(window, '_promobar', undefined);
  safeDefine(window, '_direct_underplayer', []);
  safeDefine(window, 'cpa_undpItems', []);
  safeDefine(window, 'cpa_undpRandom', 0);
  safeDefine(window, '__inpageSkins', noopFn);
  safeDefine(window, 'blockBanner', noopFn);
  safeDefine(window, 'runDownloadBanner', noopFn);

  try {
    const dealProxy = new Proxy(
      {},
      {
        get: () => true,
        set: () => true
      }
    );
    safeDefine(window, '$deal', dealProxy);
  } catch (e) {}

  try {
    const emptyHlArray = [];
    emptyHlArray.push = function () {
      return 0;
    };
    safeDefine(window, '_hl', emptyHlArray);
  } catch (e) {}

  if (/(^|\.)pornoxo\.com$/i.test(location.hostname)) {
    try {
      sessionStorage.setItem('bnr_labadena1', 'true');
      sessionStorage.setItem('ivtas', '1');
      document.cookie = 'inVideoTabUnderSeenCookie=true; path=/';
    } catch (e) {}
  }

  // Neutralize Nuvid / DrTuber / Proporn / HD21 / Winporn / Iceporn ads:
  // 1. Bottom-right corner ad (rvp2p / p2p.init.js / rvmessage.online / rvrpushserv.com)
  // 2. In-player pause banner & VAST pre-roll (htmlVideoPlayer: doNotShowInPlayerBannerWhenPause=1, hide_spot=true, spot_url='')
  // 3. Popunders (TRAFF_TARGETS / jquery.shows2.min.js / _pnuvid.js / t.yequka.my)
  // 4. NeverBlock / ExoLoader (CustomEvent('getexoloader') & window.ExoLoader)
  safeDefine(window, 'rvp2p', function () {
    return { init: noopFn };
  });
  safeDefine(window, 'SuShow', noopFn);
  const liveCamsStub = function () {
    this.init = noopFn;
    this.isValidModel = () => false;
    this.mixRelatedLiveCams = noopFn;
  };
  liveCamsStub.prototype = {
    init: noopFn,
    isValidModel: () => false,
    mixRelatedLiveCams: noopFn
  };
  safeDefine(window, 'LiveCams', liveCamsStub);
  safeDefine(
    window,
    'ADX',
    Object.freeze({
      ads: {},
      utils: Object.freeze({
        loadJS: noopFn,
        cookie: Object.freeze({ write: noopFn, read: () => '1' })
      })
    })
  );
  safeDefine(window, 'BetterJsPop', Object.freeze({ add: noopFn, config: noopFn, init: noopFn }));
  safeDefine(window, 'hide_spot', true);
  safeDefine(window, 'TRAFF_TARGETS', Object.freeze({ urls: [], under: 0, shows: 0 }));
  safeDefine(window, 'TRAFF_TARGETS_SE', 0);
  safeDefine(window, 'initTraffTargets', noopFn);

  const exoLoaderStub = Object.freeze({
    getDetector: () => ({ domain_base: '', detectCensorship: noopFn }),
    addZone: noopFn,
    serve: noopFn,
    push: noopFn
  });
  safeDefine(window, 'ExoLoader', exoLoaderStub);

  let realHtmlVideoPlayer = window.htmlVideoPlayer;
  try {
    Object.defineProperty(window, 'htmlVideoPlayer', {
      get: () => {
        if (typeof realHtmlVideoPlayer !== 'function') return realHtmlVideoPlayer;
        return function (cfg) {
          try {
            if (isProEntitled() && cfg && typeof cfg === 'object') {
              cfg.doNotShowInPlayerBannerWhenPause = 1;
              cfg.hide_spot = true;
              cfg.spot_url = '';
              cfg.spot_bottom_url = '';
              cfg.show_bottom_spot = false;
              cfg.show_sponsored = false;
              cfg.video_preroll = false;
              cfg.video_preroll_data = null;
              cfg.popups = [];
            }
          } catch (e) {}
          return realHtmlVideoPlayer.apply(this, arguments);
        };
      },
      set: (fn) => {
        realHtmlVideoPlayer = fn;
      },
      configurable: true
    });
  } catch (e) {}

  if (/(^|\.)(nuvid|drtuber|proporn|hd21|winporn|iceporn|viptube)\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'no_ads=1; path=/';
      document.cookie = 'no_popups=1; path=/';
      document.cookie = 'no_push_notice=1; path=/';
      document.cookie = 'rvt_p2p_cnt=999; path=/';
    } catch (e) {}
  }

  // Neutralize AdSpyglass (ASG) popunders, VAST pre-rolls & interstitials on videosection.com and sister sites
  safeDefine(window, '__NA', Object.freeze({ renderSpot: noopFn, init: noopFn, push: noopFn }));
  safeDefine(window, 'AsgInterop', Object.freeze({ getHref: () => '', getReferrer: () => '' }));
  safeDefine(window, 'AsgAdsInventory', Object.freeze({ cdnHost: [] }));
  safeDefine(window, 'AsgLedger', Object.freeze({}));
  safeDefine(window, '_asg_was_tabunder', true);
  safeDefine(window, 'pop', Object.freeze({ disable: noopFn, enable: noopFn }));
  safeDefine(window, 'NativeAd', noopFn);

  let realFluidPlayer = window.fluidPlayer;
  try {
    Object.defineProperty(window, 'fluidPlayer', {
      get: () => {
        if (typeof realFluidPlayer !== 'function') return realFluidPlayer;
        return function (target, options) {
          try {
            if (isProEntitled() && options && typeof options === 'object') {
              options.vastOptions = { adList: [] };
              if (options.layoutControls && typeof options.layoutControls === 'object') {
                delete options.layoutControls.htmlOnPauseBlock;
                delete options.layoutControls.playerInitCallback;
                options.layoutControls.htmlOnPauseBlock = { html: null, height: null, width: null, impressUrl: null };
              }
            }
          } catch (e) {}
          return realFluidPlayer.apply(this, arguments);
        };
      },
      set: (fn) => {
        realFluidPlayer = fn;
      },
      configurable: true
    });
  } catch (e) {}

  // Neutralize pornoeggs.com & sister network ads:
  // 1. Bottom-right corner VAST player (#vast-ad-block / initVastAdPlayer / playAd / VASTPlayer)
  // 2. In-player pause banner (htmlOnPauseBlock / .invideoBlock / statserv.net / adsbox_ops)
  // 3. Click/pause popunder & reverse tab-under (makePopunder / doPopunder / pop_target / allow_chrome / pop_clicked / /away/pop)
  // 4. Age-gate & ad-release queue (__agGate / agWhenAdsAllowed)
  safeDefine(window, 'pop_target', '');
  safeDefine(window, 'allow_chrome', 0);
  safeDefine(window, 'pop_clicked', 1);
  safeDefine(window, 'makePopunder', noopFn);
  safeDefine(window, 'doPopunder', noopFn);
  safeDefine(window, 'initVastAdPlayer', noopFn);
  safeDefine(window, 'playAd', noopFn);
  safeDefine(window, 'playAdByIndex', noopFn);
  safeDefine(window, 'VASTPlayer', function () {
    this.once = noopFn;
    this.load = function () {
      return { then: function () { return { catch: noopFn }; } };
    };
  });
  safeDefine(window, '__agGate', undefined);
  safeDefine(window, 'agWhenAdsAllowed', noopFn);
  safeDefine(window, 'adsbox_ops', Object.freeze({ w: 0, h: 0, id: 0 }));

  if (/(^|\.)pornoeggs\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'rpuShownDesktop=9999999999999; path=/';
      document.cookie = 'rpuShownMobile=9999999999999; path=/';
      document.cookie = 'age_verified=1; path=/';
      document.cookie = 'cookie_consent=1; path=/';
    } catch (e) {}
  }

  if (/(^|\.)playvids\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'rpuShownDesktop=9999999999999; path=/';
      document.cookie = 'rpuShownMobile=9999999999999; path=/';
      document.cookie = 'age_verified=1; path=/';
      document.cookie = 'cookie_consent=1; path=/';
    } catch (e) {}
  }

  if (/(^|\.)videosection\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'already_played=1; path=/';
      document.cookie = 'vast_played=1; path=/';
      document.cookie = 'autoplayed=1; path=/';
    } catch (e) {}
  }

  // Neutralize adMoxyCtrl / live.applzr.com / eaPopn (popunder / tab-under & bottom-right videoslider on shooshtime.com and KVS sites)
  const adMoxyStub = Object.freeze({
    init: noopFn,
    add: noopFn,
    ad: noopFn,
    display: noopFn,
    load: noopFn,
    logImp: noopFn,
    getItem: () => '',
    getStorage: () => ({}),
    setStorage: noopFn,
    Tools: Object.freeze({ on: noopFn, append: noopFn, hide: noopFn, parents: () => [], dw: () => 1920 }),
    connectors: Object.freeze({}),
    videoslider: Object.freeze({ skipreload: true, display: noopFn, procs: [] }),
    pop: Object.freeze({ init: noopFn }),
    procs: [],
    c: [],
    an: [],
    ao: [],
    cr: [],
    aPlugins: [],
    bypassAb: false,
    abDetected: false
  });
  safeDefine(window, 'adMoxyCtrl', adMoxyStub);
  safeDefine(window, 'adMoxyCtrlRecs', dummyPopArray);
  safeDefine(window, 'AdProvider', dummyPopArray);
  safeDefine(window, '__spotSettings', Object.freeze({}));
  safeDefine(window, 'settingsBannersSpot', Object.freeze({}));
  safeDefine(window, 'eaPopn', function () {
    return {
      init: noopFn,
      canrun: () => false,
      genUrl: () => ''
    };
  });

  // Neutralize Kernel Team Video Sharing (kt_player) VAST pre-roll / post-roll / pause-roll & popunders in flashvars
  function sanitizeKtFlashvars(fv) {
    if (!fv || typeof fv !== 'object') return fv;
    try {
      for (const key of Object.keys(fv)) {
        if (/^(adv_|vast_|popunder|lrcv$)/i.test(key)) {
          delete fv[key];
        }
      }
    } catch (e) {}
    return fv;
  }

  let flashvarsStore = sanitizeKtFlashvars(window.flashvars);
  try {
    Object.defineProperty(window, 'flashvars', {
      get: () => flashvarsStore,
      set: (val) => {
        flashvarsStore = isProEntitled() ? sanitizeKtFlashvars(val) : val;
      },
      configurable: true
    });
  } catch (e) {}

  let realKtPlayer = window.kt_player;
  try {
    Object.defineProperty(window, 'kt_player', {
      get: () => {
        if (typeof realKtPlayer !== 'function') return realKtPlayer;
        return function (containerId, swfUrl, width, height, flashvarsObj, paramsObj) {
          try {
            if (isProEntitled() && flashvarsObj && typeof flashvarsObj === 'object') {
              sanitizeKtFlashvars(flashvarsObj);
            }
          } catch (e) {}
          return realKtPlayer.apply(this, arguments);
        };
      },
      set: (fn) => {
        realKtPlayer = fn;
      },
      configurable: true
    });
  } catch (e) {}

  // Neutralize SNSPAdManager (snspAdManager / snspAdManager2) anti-adblock link-hijacking popunder on porntrex.com & KVS sites
  const snspAdManagerStub = Object.freeze({
    config: {},
    isABP: false,
    popState: Object.freeze({ shown: true }),
    postitialState: Object.freeze({ shown: true }),
    initialize: noopFn,
    initializePop: noopFn,
    initializePostitial: noopFn,
    registerPopHandler: noopFn,
    registerPostitialHandler: noopFn,
    hasABPEnabled: () => false,
    shouldPop: () => false,
    shouldShowPostitial: () => false
  });
  safeDefine(window, 'SNSPAdManager', function () {
    return snspAdManagerStub;
  });
  safeDefine(window, 'snspAdManager', snspAdManagerStub);
  safeDefine(window, 'snspAdManager2', snspAdManagerStub);

  if (/(^|\.)porntrex\.com$/i.test(location.hostname)) {
    try {
      document.cookie = 'confirmed=true; path=/';
      document.cookie = '___trx1=c; path=/';
      document.cookie = '___trx2=c; path=/';
      document.cookie = '___trx3=c; path=/';
      document.cookie = '___trx4=c; path=/';
      document.cookie = 'kt_rt_adv_index=hidden; path=/';
      document.cookie = 'premium_popup=hidden; path=/';
    } catch (e) {}
  }

  // Wrap JSON.parse globally to strip VAST pre-roll/post-roll tags, inplayer pause ads, fad.json, and adCodes
  const baseJsonParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const parsed = baseJsonParse.apply(this, arguments);
    try {
      if (isProEntitled() && parsed && typeof parsed === 'object') {
        if (parsed.vast && typeof parsed.vast === 'object') {
          parsed.vast.active = false;
          parsed.vast.tag = '';
          parsed.vast.adTagUrl = '';
          if (parsed.vast.postroll && typeof parsed.vast.postroll === 'object') {
            parsed.vast.postroll.active = false;
            parsed.vast.postroll.tag = '';
            parsed.vast.postroll.adTagUrl = '';
          }
          notifyStealthBypass('vast-preroll-json-stripped');
        }
        if (parsed.inplayer && typeof parsed.inplayer === 'object') {
          parsed.inplayer.active = false;
          if (parsed.inplayer.desktop) parsed.inplayer.desktop.active = false;
          if (parsed.inplayer.mobile) parsed.inplayer.mobile.active = false;
        }
        if (parsed.inplayerLink && typeof parsed.inplayerLink === 'object') {
          parsed.inplayerLink.active = false;
        }
        if (Array.isArray(parsed.adCodes)) {
          parsed.adCodes = [];
          parsed.status = 0;
        }
        if ('use_v' in parsed && 'nvu' in parsed) {
          parsed.use_v = 'false';
          parsed.nvu = [];
        }
        if ('popunder' in parsed) {
          parsed.popunder = undefined;
        }
        if ('clickFlow' in parsed) {
          parsed.clickFlow = undefined;
        }
        if (Array.isArray(parsed.popups)) {
          parsed.popups = [];
        }
        if ('vast_ads' in parsed && parsed.vast_ads) {
          parsed.vast_ads = '';
          parsed.vast_provider = '';
        }
        if (
          parsed.limitKey === 'clk$pop@limit' ||
          'showTrkURL' in parsed ||
          (parsed.type === 'popup' && 'openTargetBlank' in parsed && 'limitPerPage' in parsed)
        ) {
          parsed.url = '';
          parsed.showTrkURL = '';
          parsed.limit = 0;
          parsed.limitPerPage = 0;
          parsed.limitPerSession = 0;
          parsed.frequency = 9999999;
          parsed.initDelay = 9999999;
          parsed.delay = 9999999;
          parsed.skipClicks = 9999999;
          notifyStealthBypass('clk-pop-config-neutralized');
        }
      }
    } catch (e) {}
    return parsed;
  };
  markNative(JSON.parse, 'parse');

  // Neutralize erothots.co & sister Plyr VAST waterfall pre-rolls (_showed, _vasts, runWaterfall),
  // floating bottom-right VAST video slider (openSlider / .eroslider), and Isotope .vid-ad grid tiles
  safeDefine(window, '_showed', true);
  safeDefine(window, '_vasts', []);
  safeDefine(window, 'openSlider', noopFn);
  safeDefine(window, 'runWaterfall', function (vastUrl, container, opts) {
    if (opts && typeof opts.onRunFinish === 'function') {
      try {
        opts.onRunFinish();
      } catch (e) {}
    }
    return noopFn;
  });

  if (/(^|\.)erothots[0-9a-z-]*\.(co|com|is|xyz|net|org)$/i.test(location.hostname)) {
    const scrubErothotsAdsAndReflow = () => {
      if (!isProEntitled()) return;
      try {
        let removedGridAd = false;
        const gridAds = document.querySelectorAll('a.video.vid-ad, .videos .vid-ad, .vid-ad');
        gridAds.forEach((node) => {
          node.remove();
          removedGridAd = true;
        });
        const topBars = document.querySelectorAll(
          'a.top-bar-xx-style, .magic-sites, .list-btn.bnr, .bnr, .bnrs, a.bartab, .video-player .caption.bottom-right, .odw, [data-odw], .ourdreamai-native, .eroslider, a.no-taps[href*="camsoda"], img.camsoda-logo'
        );
        topBars.forEach((node) => {
          const parent = node.parentElement;
          if (node.classList && node.classList.contains('top-bar-xx-style') && parent && parent.tagName === 'DIV' && parent.children.length === 1) {
            parent.remove();
          } else {
            node.remove();
          }
        });
        if (removedGridAd) {
          if (window.jQuery) {
            const $grid = window.jQuery('.videos');
            if ($grid.length && typeof $grid.isotope === 'function' && $grid.data('isotope')) {
              $grid.isotope('reloadItems').isotope('layout');
            }
          }
          window.dispatchEvent(new Event('resize'));
        }
      } catch (e) {}
    };
    scrubErothotsAdsAndReflow();
    document.addEventListener('readystatechange', scrubErothotsAdsAndReflow);
    document.addEventListener('DOMContentLoaded', scrubErothotsAdsAndReflow);
    window.addEventListener('load', () => {
      scrubErothotsAdsAndReflow();
      setTimeout(scrubErothotsAdsAndReflow, 250);
      setTimeout(scrubErothotsAdsAndReflow, 900);
    });
  }

  // Block popunders and ad-network URLs
  const POPUNDER_URL_REGEX =
    /(\/zv3\/(b|url|cam)|\/link\/out\/|\/linkout\/livecams\/|\/player_right_ntv_|\/adx_iframe_|\/away\/(pop|tab)|\/ads\/prebid-ads|\/getape\/|\/prepop\.php|\/getadb\/|\/venor\.php|\/v1\/link\.php|\/splash\.php\?idzone=|\/api\/spots\/|\/api\/click\/|\/agent\.php\?spot=|\/loadeactrl\.go|\/vast\.go|\/click\.go|\/pop\.go|\/banner\.go|banner-iframe|advertiserName=|tsyndicate\.com|contentsserved\.com|exoclick\.com|exosrv\.com|realsrv\.com|magsrv\.com|pemsrv\.com|orbsrv\.com|trafficjunky\.(net|com)|juicyads\.com|jads\.co|clickadu\.com|clickaine\.com|\/lv\/esnk\/|hilltopads\.net|adspyglass\.com|plugrush\.com|adxpansion\.com|crakrevenue\.com|ero-advertising\.com|twinrdsyn\.com|twinrdengine\.com|adtng\.com|dreamserve\.dev|velvetloom\.net|creepy-frame\.com|smartfloralab\.com|realxxx\.com|traffichunt\.com|camsoda\.ai|livemediahost\.com|statserv\.net|etahub\.com|bngpt\.com|xlivrdr\.com|popads\.net|popcash\.net|propellerads\.com|cdn-fc\.com|meteorpomposity\.com|glutenmuttsensuous\.com|cupbearergrowllurch\.com|hollowgoal\.com|u5s5\.com|adplsr\.com|nomarax\.com|fh-wgt\.com|yomeno\.xyz|ahw2lok\.txxx\.com|zog\.link|iloptrex\.com|nereserv\.com|vidvas3\.com|tubecup\.net|fhgte\.com|faphouse4k\.com|tikbblove\.com|directsle\.com|g2fame\.com|rvmessage\.online|rvrpushserv\.com|yequka\.my|tophqcam\.com|doublepimp\.com|advnet\.xyz|hotadultcontent\.com|hotxxxcontent\.com|qoqh\.com|hqpornpro\.com|lxax\.com|koxk\.com|applzr\.com|goadserver\.com|gsrv\.dev|aaaconnect\.info|onclckmn\.com|onclicka\.com|adsmediabox\.com|awmdelivery\.com|acquaintjokinglyscoring\.com|rmzsglng\.com|aivanta76\.com|bongacams2?\.com|gotpd\.me|superwebhub\.cyou|fozekikikiminu\.com|janusaent\.com|growcdnssedge\.com|saawsedge\.com|doppiocdn\.com|landing\.brazzersnetwork\.com|sacdnssedge\.com|kol88\.freeporn8\.com|Y1l0oxvJ\.js|nvdst\.com\/adx_|_pnuvid\.js|p2p\.init\.js|jquery\.shows2\.min\.js|pagerrentablespotlight\.com|holaraphraus\.com|terschomonic\.com|enomotia\.com|janitorprecisiontrio\.com|earthspetti\.com|displayvertising\.com|jusgrmawfbaqu\.com|bspyoibtwrrc\.com|cemhlobja\.com|d3mzokty951c5w\.cloudfront\.net|magnific-popup\.min\.js|\/[a-z]url\.min\.css|adsco\.re|ey43\.com)/i;

  const isEmbeddedPlayerFrame = () =>
    window !== window.top &&
    (/^\/(e|embed|player)\//i.test(location.pathname) ||
      Boolean(document.getElementById('jwplayer') || document.getElementById('jfkp')));

  // Guard Element.prototype.setAttribute & HTMLAnchorElement.prototype.href setter against link-hijacking scripts
  // (e.g. SNSPAdManager rewriting $(this).attr('href', config.pop.adblockURL) when a user clicks a video/page link)
  const origSetAttribute = Element.prototype.setAttribute;
  if (typeof origSetAttribute === 'function') {
    const wrappedSetAttribute = function setAttribute(name, value) {
      if (
        isProEntitled() &&
        this &&
        this.tagName === 'A' &&
        String(name || '').toLowerCase() === 'href' &&
        POPUNDER_URL_REGEX.test(String(value || ''))
      ) {
        notifyStealthBypass('anchor-setattribute-hijack-blocked:' + value);
        return;
      }
      return origSetAttribute.apply(this, arguments);
    };
    markNative(wrappedSetAttribute, 'setAttribute');
    Element.prototype.setAttribute = wrappedSetAttribute;
  }

  try {
    const origHrefDesc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
    if (origHrefDesc && origHrefDesc.set && origHrefDesc.get) {
      Object.defineProperty(HTMLAnchorElement.prototype, 'href', {
        get: function () {
          return origHrefDesc.get.call(this);
        },
        set: function (val) {
          if (isProEntitled() && POPUNDER_URL_REGEX.test(String(val || ''))) {
            notifyStealthBypass('anchor-href-setter-hijack-blocked:' + val);
            return;
          }
          return origHrefDesc.set.call(this, val);
        },
        configurable: true
      });
    }
  } catch (e) {}

  // Block dynamic popunder <script>, Ad-Shield BFA loaders/modals, and videoslider container injections via appendChild / insertBefore
  const isBlockedDynamicScript = (node) => {
    if (!isProEntitled() || !node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || '').toUpperCase();
    const id = String(node.id || '');
    if (
      tag === 'DIV' &&
      (/^vl_[0-9]+(_content)?$/i.test(id) ||
        id === 'vast-ad-block' ||
        id === 'vast-ad-block-button' ||
        id === 'ag-agegate' ||
        id === 'rvt-element' ||
        id === 'c_window_xEucqIjg' ||
        id === 'alink_overlay_EPXdyaUf' ||
        /^rvt-p2p/i.test(id) ||
        node['clk$pop@cover'] === true ||
        node.hasAttribute('data-cl-overlay') ||
        node.hasAttribute('alink') ||
        (node.style &&
          node.style.position === 'fixed' &&
          (node.style.zIndex === '300000' || node.style.zIndex === '2147483647') &&
          node.style.width === '100%' &&
          node.style.height === '100%') ||
        (typeof node.className === 'string' &&
          /^c[0-9]{12,24}$/.test(node.className.trim()) &&
          node.style &&
          node.style.zIndex === '2147483646') ||
        (node.style &&
          node.style.zIndex === '-1' &&
          node.style.opacity === '0' &&
          node.style.pointerEvents === 'none' &&
          typeof node.querySelector === 'function' &&
          node.querySelector('iframe:not([src])')) ||
        (node.classList &&
          (node.classList.contains('sldr_right_right') ||
            node.classList.contains('eroslider') ||
            node.classList.contains('ourdreamai-native') ||
            node.classList.contains('invideoBlock') ||
            node.classList.contains('fluid_html_on_pause_container'))))
    ) {
      return true;
    }
    if (tag === 'IFRAME') {
      const iframeSrc = String(node.src || node.getAttribute('src') || '');
      if (
        id === 'banner_iframe' ||
        id === 'a_iframe_DwTGCjTm' ||
        /^spot_video_ntv_/i.test(id) ||
        /(report\.error-report\.com|html-load\.com|adtng\.com|gsrv\.dev|aaaconnect\.info|awmdelivery\.com|onclckmn\.com|onclicka\.com|adsmediabox\.com|dreamserve\.dev|velvetloom\.net|smartfloralab\.com|realxxx\.com|traffichunt\.com|statserv\.net|\/ads\/prebid-ads|\/player_right_ntv_|\/adx_iframe_|superwebhub\.cyou|fozekikikiminu\.com|holaraphraus\.com|terschomonic\.com|janitorprecisiontrio\.com|pagerrentablespotlight\.com|cemhlobja\.com|displayvertising\.com)/i.test(
          iframeSrc
        )
      ) {
        return true;
      }
    }
    if (tag !== 'SCRIPT') return false;
    const src = String(node.src || node.getAttribute('src') || '');
    const sdk = String(node.getAttribute('data-sdk') || '');
    const inlineText = !src ? String(node.textContent || '') : '';
    if (
      id === 'popmagicldr' ||
      id === 'ad-shield-container' ||
      id === 'eTUMAOPX' ||
      id === 'PgufXNTTH' ||
      id === 'EyNGRRuNI' ||
      /^y-l\//i.test(sdk) ||
      node.hasAttribute('data-clocid') ||
      node.hasAttribute('data-spots') ||
      node.getAttribute('data-tag') === 'asg' ||
      (node.settings && node.settings.misc && node.settings.misc.ignoreTo) ||
      POPUNDER_URL_REGEX.test(src) ||
      /\.min\.css(\?|$)/i.test(src) ||
      /(s\.yimg\.com\/du\/(site|finance)\/|report\.error-report\.com|html-load\.com)/i.test(src) ||
      (inlineText &&
        (inlineText.includes('benji_as_bfa') ||
          inlineText.includes('report.error-report.com') ||
          inlineText.includes('xziysaahhzmq') ||
          inlineText.includes('creepy-frame.com') ||
          inlineText.includes('SNSPAdManager') ||
          inlineText.includes('snspAdManager') ||
          inlineText.includes('adblock-proxy-super-secret') ||
          inlineText.includes('mergedPopups') ||
          inlineText.includes('clk$pop@') ||
          inlineText.includes('window.mkp = function'))) ||
      id === 'aawscript' ||
      node.hasAttribute('data-admpid') ||
      /\/(UtsK7A9|RaNIDAd|rtoj6Ac)\.js/i.test(src) ||
      /\/pxo\/www\/js-v[0-9.]+\/[a-z0-9]{8}\.min\.js/i.test(src) ||
      /\/pxo\/www\/js.*\.min\.js\?url=/i.test(src) ||
      (/(^|\.)(txxx|hclips|upornia|voyeurhit|hotmovs|tubecup|vjav|shemalez)\.(me|com|tube)$/i.test(location.hostname) && /\/[0-9a-z]{8,12}\/[0-9a-z]{8,12}\.js(\?|$)/i.test(src)) ||
      /\/on\.js(\?|$)/i.test(src)
    ) {
      return true;
    }
    return false;
  };

  let patchIframeWinRef = null;

  const origAppendChild = Node.prototype.appendChild;
  const wrappedAppendChild = function appendChild(child) {
    if (isBlockedDynamicScript(child)) {
      try {
        child.onerror = null;
        child.onload = null;
      } catch (e) {}
      notifyStealthBypass('dynamic-popunder-script-blocked');
      return child;
    }
    const res = origAppendChild.apply(this, arguments);
    if (child && child.tagName === 'IFRAME' && typeof patchIframeWinRef === 'function') {
      try {
        patchIframeWinRef(child);
      } catch (e) {}
    }
    return res;
  };
  markNative(wrappedAppendChild, 'appendChild');
  Node.prototype.appendChild = wrappedAppendChild;

  const origInsertBefore = Node.prototype.insertBefore;
  const wrappedInsertBefore = function insertBefore(newNode, refNode) {
    if (isBlockedDynamicScript(newNode)) {
      try {
        newNode.onerror = null;
        newNode.onload = null;
      } catch (e) {}
      notifyStealthBypass('dynamic-popunder-script-blocked');
      return newNode;
    }
    const res = origInsertBefore.apply(this, arguments);
    if (newNode && newNode.tagName === 'IFRAME' && typeof patchIframeWinRef === 'function') {
      try {
        patchIframeWinRef(newNode);
      } catch (e) {}
    }
    return res;
  };
  markNative(wrappedInsertBefore, 'insertBefore');
  Node.prototype.insertBefore = wrappedInsertBefore;

  // Block click-hijacking addEventListener & .onclick registrations from popunder scripts
  const POPUNDER_LISTENER_REGEX =
    /popMagic|venorShouldShow|findLinkToOpen|executeOnRedirect|EPpopConfig|EPeventFire|openPopunder|makePopunder|doPopunder|isPopunderOpened|pop_isRightButtonClicked|rpuShownDesktop|pop_clicked|__videoPlayerData\.popunder|inVideoTabUnderSeenCookie|clickFlow|loadBannerContent|Popunder\b|adblockFallbackPending|syndication_host|exoJsPop101|zomhphp|TRAFF_TARGETS|initTraffTargets|__NA|renderSpot|asgtbndr|AsgInterop|_asg_was_tabunder|adMoxyCtrl|eaPopn|loadeactrl|creepy-frame|smartfloralab|SNSPAdManager|snspAdManager|registerPopHandler|registerPostitialHandler|adblockURL|___trx|adblock-proxy-super-secret|mergedPopups|popupIndex|popupWindow|pagerrentablespotlight|clk\$pop@|showTrkURL|terschomonic|enomotia|holaraphraus|janitorprecisiontrio|jlduc|zfgloaded|clicksSinceSessionStart|clicksSinceLastPpu|ppuCount|skipPopOnRightButtonClick|\.gn\.forEach\(|_onExecute|_onMouseDownHandler|_onMouseUpHandler|catchalldiv|punderminipop|crpopsemaphore|a_timer_oYvwGmQc|c_window_xEucqIjg/i;

  for (const ClickProto of [HTMLElement.prototype, Document.prototype]) {
    try {
      const origOnclickDesc = Object.getOwnPropertyDescriptor(ClickProto, 'onclick');
      if (origOnclickDesc && origOnclickDesc.set) {
        Object.defineProperty(ClickProto, 'onclick', {
          get: function () {
            return origOnclickDesc.get ? origOnclickDesc.get.call(this) : null;
          },
          set: function (fn) {
            if (isProEntitled() && typeof fn === 'function') {
              try {
                const targetFn = fn.__deepstealthOrigFn || fn;
                const fnSrc = origFnToString.call(targetFn);
                if (fnSrc && POPUNDER_LISTENER_REGEX.test(fnSrc)) {
                  notifyStealthBypass('popunder-onclick-setter-blocked');
                  return;
                }
              } catch (e) {}
            }
            return origOnclickDesc.set.call(this, fn);
          },
          configurable: true
        });
      }
    } catch (e) {}
  }

  const origAddEventListener = EventTarget.prototype.addEventListener;
  const wrappedAddEventListener = function addEventListener(type, listener, options) {
    if (isProEntitled() && String(type).toLowerCase() === 'getexoloader') {
      return;
    }
    if (
      isProEntitled() &&
      listener &&
      /^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|auxclick|keydown)$/i.test(String(type))
    ) {
      try {
        const targetFn = typeof listener === 'function' ? listener.__deepstealthOrigFn || listener : null;
        const fnSrc = typeof targetFn === 'function' ? origFnToString.call(targetFn) : '';
        if (fnSrc && POPUNDER_LISTENER_REGEX.test(fnSrc)) {
          notifyStealthBypass('popunder-listener-blocked:' + type);
          return;
        }
      } catch (e) {}
    }
    return origAddEventListener.apply(this, arguments);
  };
  markNative(wrappedAddEventListener, 'addEventListener');
  EventTarget.prototype.addEventListener = wrappedAddEventListener;

  // Track last trusted user click so we can block any window.open() triggered when clicking a video player or normal link
  let lastTrustedClickTarget = null;
  let lastTrustedClickTime = 0;

  const recordTrustedClick = function (e) {
    if (e && e.isTrusted) {
      lastTrustedClickTarget = e.target;
      lastTrustedClickTime = Date.now();
    }
  };
  for (const trustedEvt of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
    origAddEventListener.call(window, trustedEvt, recordTrustedClick, true);
  }

  // Capture-phase shield: prevent clicks on invisible video player ad overlays or /link/out/ popunder links
  const VIDEO_AD_OVERLAY_SELECTOR =
    '.player-click-layer, .new-videoplayer-overlay, .video-extra-overlay, #invideo_wrapper, .vast-overlay, .video-end-overlay, #movieplayer-box-adv, #divExoLayerWrapper, a.blinker, li.media-item.no-popup, .player-adv-link, .player__promo, [class*="-asg-vast-overlay"], .asg-container, .asg-vpaid-overlay, a.top-bar-xx-style, a.bartab, .video-player .caption.bottom-right, a.video.vid-ad, .vid-ad, .eroslider, .odw, #vast-ad-block, #vast-ad-block-button, .invideoBlock, .fluid_html_on_pause_container, .fluid_html_on_pause:not(.fluid_initial_play_button_container), [id*="_ad_html_on_pause"], [data-cl-overlay], #c_window_xEucqIjg, #alink_overlay_EPXdyaUf, [alink="alink"]';

  const blockOverlayClick = function (e) {
    if (!isProEntitled() || !e || !e.target || typeof e.target.closest !== 'function') return;
    if (
      e.target['clk$pop@cover'] === true ||
      (e.target.tagName === 'DIV' &&
        (e.target.hasAttribute('data-cl-overlay') ||
          (typeof e.target.className === 'string' &&
            /^c[0-9]{12,24}$/.test(e.target.className.trim()) &&
            e.target.style &&
            e.target.style.zIndex === '2147483646') ||
          (e.target.style &&
            e.target.style.position === 'fixed' &&
            (e.target.style.zIndex === '300000' || Number(e.target.style.zIndex) >= 300000) &&
            e.target.parentElement === document.body &&
            e.target.id !== 'jfkp' &&
            e.target.id !== 'player-report-consent')))
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        e.target.remove();
      } catch (err) {}
      notifyStealthBypass('clk-pop-cover-overlay-neutralized');
      return false;
    }
    const overlay = e.target.closest(VIDEO_AD_OVERLAY_SELECTOR);
    if (overlay) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        overlay.remove();
      } catch (err) {}
      notifyStealthBypass('video-ad-overlay-click-neutralized');
      return false;
    }
    const anchor = e.target.closest('a[href], a[target="_blank"]');
    if (anchor) {
      const href = String(anchor.getAttribute('href') || anchor.href || '');
      const isCrossOriginInPlayer =
        isEmbeddedPlayerFrame() &&
        (anchor.target === '_blank' ||
          (anchor.hostname && anchor.hostname !== location.hostname));
      if (POPUNDER_URL_REGEX.test(href) || isCrossOriginInPlayer) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isCrossOriginInPlayer) {
          try {
            anchor.remove();
          } catch (err) {}
        }
        notifyStealthBypass('popunder-anchor-click-blocked:' + href);
        return false;
      }
    }
  };

  for (const shieldEvt of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick', 'touchstart', 'touchend']) {
    origAddEventListener.call(window, shieldEvt, blockOverlayClick, true);
  }

  // Block synthetic MouseEvent('click', { ctrlKey: true, metaKey: true }) tab-unders (used by popMagic.methods.chromeTab)
  // and programmatic <a target="_blank">.click() popunders
  const origDispatchEvent = EventTarget.prototype.dispatchEvent;
  const wrappedDispatchEvent = function dispatchEvent(event) {
    if (isProEntitled() && event && String(event.type).toLowerCase() === 'getexoloader') {
      try {
        if (event.detail && typeof event.detail === 'object') {
          event.detail.el = exoLoaderStub;
        }
      } catch (e) {}
      notifyStealthBypass('exoloader-customevent-spoofed');
      return false;
    }
    if (
      isProEntitled() &&
      event &&
      !event.isTrusted &&
      /^(click|mousedown|mouseup|auxclick)$/i.test(String(event.type))
    ) {
      if (event.ctrlKey || event.metaKey || event.button === 1) {
        notifyStealthBypass('synthetic-ctrl-click-tabunder-blocked');
        return false;
      }
      if (this && this.tagName === 'A') {
        const href = String(this.href || this.getAttribute('href') || '');
        if (
          this.target === '_blank' ||
          POPUNDER_URL_REGEX.test(href) ||
          (this.hostname && this.hostname !== location.hostname)
        ) {
          notifyStealthBypass('synthetic-anchor-dispatch-blocked:' + href);
          return false;
        }
      }
    }
    return origDispatchEvent.apply(this, arguments);
  };
  markNative(wrappedDispatchEvent, 'dispatchEvent');
  EventTarget.prototype.dispatchEvent = wrappedDispatchEvent;

  const origHtmlElementClick = HTMLElement.prototype.click;
  if (typeof origHtmlElementClick === 'function') {
    const wrappedHtmlElementClick = function click() {
      if (isProEntitled() && this && this.tagName === 'A') {
        const href = String(this.href || this.getAttribute('href') || '');
        if (
          this.target === '_blank' ||
          POPUNDER_URL_REGEX.test(href) ||
          (this.hostname && this.hostname !== location.hostname && !this.hasAttribute('download'))
        ) {
          notifyStealthBypass('programmatic-anchor-click-blocked:' + href);
          return;
        }
      }
      return origHtmlElementClick.apply(this, arguments);
    };
    markNative(wrappedHtmlElementClick, 'click');
    HTMLElement.prototype.click = wrappedHtmlElementClick;
  }

  // Upgrade window.open interceptor to block ad URLs, cross-origin _self tab-unders, popup windows, and video-player click popunders
  const origWindowOpen = window.open;
  if (typeof origWindowOpen === 'function') {
    const wrappedWindowOpen = function open(url, target, features) {
      const urlStr = String(url || '');
      const targetStr = String(target || '');
      const featuresStr = String(features || '');
      if (isProEntitled()) {
        const isSafeAuthPopup =
          /(accounts\.google\.com|appleid\.apple\.com|github\.com\/login|facebook\.com\/v[0-9.]+\/dialog\/oauth|checkout\.stripe\.com|paypal\.com|sweeprdeepblock\.com)/i.test(
            urlStr
          );

        let shouldBlock =
          !urlStr ||
          urlStr === 'about:blank' ||
          POPUNDER_URL_REGEX.test(urlStr) ||
          /^(popupWindow|popup|popunder|ad|blank_pop)$/i.test(targetStr);

        // Block popup windows specifying explicit window dimensions (width=, height=, top=, left=, popup=) unless it is a legitimate OAuth/checkout popup
        if (
          !shouldBlock &&
          !isSafeAuthPopup &&
          /\b(width|height|left|top|menubar|toolbar|status|resizable|popup)\s*=/i.test(featuresStr)
        ) {
          shouldBlock = true;
        }

        // Block any window.open() originating from an embedded video player iframe (/e/..., /embed/..., or #jwplayer / #jfkp)
        if (!shouldBlock && !isSafeAuthPopup && isEmbeddedPlayerFrame()) {
          shouldBlock = true;
        }

        // Block reverse tab-unders that call window.open(adUrl, "_self") or cross-origin window.open
        if (!shouldBlock) {
          try {
            const parsedUrl = new URL(urlStr, location.href);
            if (
              (targetStr === '_self' || targetStr === '_top' || targetStr === 'top') &&
              parsedUrl.hostname !== location.hostname
            ) {
              shouldBlock = true;
            }
          } catch (e) {}
        }

        // Block any window.open() triggered within Chrome's 5-second transient userActivation window after clicking a video player or same-tab link
        if (!shouldBlock && lastTrustedClickTarget && Date.now() - lastTrustedClickTime < 6000) {
          try {
            if (typeof lastTrustedClickTarget.closest === 'function') {
              const clickedVideoOrLink = lastTrustedClickTarget.closest(
                'video, iframe, #jfkp, .jwplayer, [id*="player" i], [class*="player" i], [id*="video" i], [class*="video" i], .post_el_small, .js-pop, a:not([target="_blank"])'
              );
              if (clickedVideoOrLink) {
                shouldBlock = true;
              }
            }
          } catch (e) {}
        }

        if (shouldBlock) {
          notifyStealthBypass('popunder-window-open-blocked:' + urlStr);
          if (arguments.length === 0) {
            return null;
          }
          return {
            focus: noopFn,
            blur: noopFn,
            close: noopFn,
            closed: true,
            name: 'error',
            opener: null,
            document: {
              write: noopFn,
              open: noopFn,
              close: noopFn,
              createElement: () => ({ style: {}, setAttribute: noopFn, appendChild: noopFn }),
              getElementsByTagName: () => [],
              head: { appendChild: noopFn },
              documentElement: { appendChild: noopFn },
              body: { appendChild: noopFn }
            },
            location: { href: urlStr, assign: noopFn, replace: noopFn },
            postMessage: noopFn
          };
        }
      }
      return origWindowOpen.apply(this, arguments);
    };
    markNative(wrappedWindowOpen, 'open');
    window.open = wrappedWindowOpen;

    // Prevent synchronous about:blank / javascript:false iframe creation from stealing an unpatched contentWindow.open,
    // contentDocument.defaultView.open, or window.frames[i].open
    const patchCwInstance = (cw) => {
      if (!cw || !isProEntitled()) return cw;
      try {
        if (cw.open !== wrappedWindowOpen) {
          cw.open = wrappedWindowOpen;
        }
        if (cw.EventTarget && cw.EventTarget.prototype) {
          cw.EventTarget.prototype.addEventListener = wrappedAddEventListener;
          cw.EventTarget.prototype.dispatchEvent = wrappedDispatchEvent;
        }
        if (cw.HTMLElement && cw.HTMLElement.prototype) {
          cw.HTMLElement.prototype.click = wrappedHtmlElementClick;
        }
        if (cw.document && cw.document.open) {
          cw.document.open = noopFn;
        }
      } catch (e) {}
      return cw;
    };

    try {
      const cwDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      const cdDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');
      patchIframeWinRef = (iframeNode) => {
        if (!iframeNode || !cwDesc || typeof cwDesc.get !== 'function') return;
        const cw = cwDesc.get.call(iframeNode);
        if (cw) patchCwInstance(cw);
      };
      if (cwDesc && typeof cwDesc.get === 'function') {
        const wrappedCwGetter = function contentWindow() {
          return patchCwInstance(cwDesc.get.call(this));
        };
        markNative(wrappedCwGetter, 'get contentWindow');
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: wrappedCwGetter,
          configurable: true
        });
      }
      if (cdDesc && typeof cdDesc.get === 'function') {
        const wrappedCdGetter = function contentDocument() {
          const doc = cdDesc.get.call(this);
          if (doc && doc.defaultView) {
            patchCwInstance(doc.defaultView);
          }
          return doc;
        };
        markNative(wrappedCdGetter, 'get contentDocument');
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
          get: wrappedCdGetter,
          configurable: true
        });
      }
    } catch (e) {}
  }

  // Neutralize Eporner first-party EP.ads object & expand video player container
  if (/(^|\.)eporner\.com$/i.test(location.hostname)) {
    const sanitizeEpObj = (epObj) => {
      if (!epObj || typeof epObj !== 'object') return epObj;
      try {
        epObj.adblockFallbackPending = noopFn;
        const adsStub = {
          initialize: noopFn,
          show: noopFn,
          serve: noopFn,
          showAd: noopFn,
          showInplayerAds: noopFn,
          refreshVideoPauseAds: noopFn,
          ref: { check: noopFn, reload: noopFn }
        };
        if (epObj.ads && typeof epObj.ads === 'object') {
          Object.assign(epObj.ads, adsStub);
        } else {
          epObj.ads = adsStub;
        }
      } catch (e) {}
      return epObj;
    };
    let epStore = sanitizeEpObj(window.EP || { ads: {} });
    try {
      Object.defineProperty(window, 'EP', {
        get: () => epStore,
        set: (val) => {
          epStore = sanitizeEpObj(val);
        },
        configurable: true
      });
    } catch (e) {}
    const patchEpAds = () => sanitizeEpObj(window.EP);
    patchEpAds();
    origAddEventListener.call(document, 'readystatechange', patchEpAds);
    origAddEventListener.call(document, 'DOMContentLoaded', patchEpAds);
  }
})();
