// SWEEPR Deepblock — DeepStealth MAIN-World Anti-Adblock Cloaking Engine
// Runs at document_start in MAIN world before any page or anti-adblock script executes.
// Neutralizes Admiral, BlockAdBlock, FuckAdBlock, Google Funding Choices, IAB Adblock Detection, and YouTube/publisher bait probes.

(function () {
  'use strict';

  if (window.__sweeprDeepStealthActive) return;
  Object.defineProperty(window, '__sweeprDeepStealthActive', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  function notifyStealthBypass() {
    try {
      window.postMessage({ source: 'sweepr-deepstealth', type: 'STEALTH_BYPASS_TRIGGERED' }, '*');
    } catch (e) {}
  }

  // ============================================================================
  // LAYER 2: Global Ad SDK & Canary Variable Spoofing
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
  safeDefine(window, 'google_ad_status', 1);

  // Google AdSense (window.adsbygoogle) Surrogate Stub
  const adsbygoogleStub = {
    loaded: true,
    push: function () {
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
      setCategoryExclusion: () => slot,
      setCollapseEmptyDiv: () => slot,
      defineSizeMapping: () => slot,
      getSlotElementId: () => 'div-gpt-ad-stub',
      getAdUnitPath: () => '/stub'
    };
    return slot;
  };

  const pubadsStub = {
    addEventListener: function (event, cb) {
      if (event === 'slotRenderEnded' && typeof cb === 'function') {
        setTimeout(() => {
          try {
            cb({ isEmpty: false, size: [300, 250], slot: createSlotStub() });
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
    getSlots: () => []
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
      addSize: function () { return this; },
      build: () => []
    })
  };

  try {
    window.googletag = Object.assign(window.googletag || {}, googletagStub);
  } catch (e) {}

  // Neutralize BlockAdBlock / FuckAdBlock / SniffAdBlock classes & instances
  function FakeAdBlockDetector() {}
  FakeAdBlockDetector.prototype = {
    check: function () { return false; },
    clearEvent: function () {},
    emitEvent: function () { return this; },
    setOption: function () { return this; },
    on: function (detected, fn) {
      if (detected === false && typeof fn === 'function') {
        try { fn(); } catch (e) {}
      } else {
        notifyStealthBypass();
      }
      return this;
    },
    onDetected: function () {
      notifyStealthBypass();
      return this;
    },
    onNotDetected: function (fn) {
      if (typeof fn === 'function') {
        try { fn(); } catch (e) {}
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
  const BAIT_CLASS_REGEX = /\b(adsbox|pub_300x250|pub_300x250m|pub_728x90|text-ad|textAd|text_ad|text_ads|text-ads|text-ad-links|ad-tester|ad_tester|adblock-test|ad-banner-bait)\b/i;
  const BAIT_ID_REGEX = /^(ad-tester|ad_tester|adtester|adsbox|ad-bait|carbonads-test)$/i;

  function isBaitElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const cls = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    return BAIT_CLASS_REGEX.test(cls) || BAIT_ID_REGEX.test(id);
  }

  // Proxy offsetHeight / offsetWidth / clientHeight / clientWidth / offsetParent on HTMLElement.prototype
  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const origClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  const origClientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  const origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');

  if (origOffsetHeight && origOffsetHeight.get) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      get: function () {
        if (isBaitElement(this)) {
          notifyStealthBypass();
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
        if (isBaitElement(this)) {
          return 300;
        }
        return origOffsetWidth.get.call(this);
      },
      configurable: true
    });
  }

  if (origClientHeight && origClientHeight.get) {
    Object.defineProperty(Element.prototype, 'clientHeight', {
      get: function () {
        if (isBaitElement(this)) {
          return 250;
        }
        return origClientHeight.get.call(this);
      },
      configurable: true
    });
  }

  if (origClientWidth && origClientWidth.get) {
    Object.defineProperty(Element.prototype, 'clientWidth', {
      get: function () {
        if (isBaitElement(this)) {
          return 300;
        }
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
  const AD_PROBE_URL_REGEX = /(pagead2\.googlesyndication\.com|securepubads\.g\.doubleclick\.net|static\.doubleclick\.net\/instream\/ad_status|ad\.doubleclick\.net|static\.ads-twitter\.com\/uwt\.js|fundingchoicesmessages\.google\.com|\/ads\.js(\?|$)|\/adframe\.js(\?|$)|\/adblock-detect)/i;

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (AD_PROBE_URL_REGEX.test(url)) {
        notifyStealthBypass();
        return new Response('/* deepstealth ok */\nwindow.canRunAds=true;\n', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
        });
      }
      try {
        return await origFetch.apply(this, arguments);
      } catch (err) {
        if (AD_PROBE_URL_REGEX.test(url)) {
          notifyStealthBypass();
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
    if (this.__deepstealthUrl && AD_PROBE_URL_REGEX.test(this.__deepstealthUrl)) {
      notifyStealthBypass();
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
})();
