import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_5_RULESETS = [
  'ads_and_trackers',
  'regional_eu_filters',
  'easyprivacy_trackers',
  'tracker_param_stripping',
  'cryptominers_and_heavy_scripts'
];
const FULL_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

function makeStorageArea(initial = {}, onChangedListeners = null, areaName = 'local') {
  const store = structuredClone(initial);
  const notifyChanges = (changes) => {
    if (!onChangedListeners || Object.keys(changes).length === 0) return;
    for (const fn of onChangedListeners) {
      try {
        fn(changes, areaName);
      } catch {}
    }
  };
  const get = (keys, cb) => {
    const result = {};
    const keyList = Array.isArray(keys)
      ? keys
      : keys && typeof keys === 'object'
      ? Object.keys(keys)
      : keys
      ? [String(keys)]
      : Object.keys(store);
    for (const k of keyList) {
      if (Object.prototype.hasOwnProperty.call(store, k)) {
        result[k] = store[k];
      } else if (keys && !Array.isArray(keys) && typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, k)) {
        result[k] = keys[k];
      }
    }
    if (typeof cb === 'function') {
      cb(result);
      return undefined;
    }
    return Promise.resolve(result);
  };
  const set = (obj, cb) => {
    const changes = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const oldValue = store[k];
      store[k] = v;
      changes[k] = { oldValue, newValue: v };
    }
    notifyChanges(changes);
    if (typeof cb === 'function') {
      cb();
      return undefined;
    }
    return Promise.resolve();
  };
  const remove = (keys, cb) => {
    const list = Array.isArray(keys) ? keys : [keys];
    const changes = {};
    for (const k of list) {
      if (Object.prototype.hasOwnProperty.call(store, k)) {
        changes[k] = { oldValue: store[k], newValue: undefined };
        delete store[k];
      }
    }
    notifyChanges(changes);
    if (typeof cb === 'function') {
      cb();
      return undefined;
    }
    return Promise.resolve();
  };
  return { store, area: { get, set, remove } };
}

function createBackgroundHarness({
  initialLocal = {},
  initialSync = {},
  initialNowMs = Date.UTC(2026, 10, 1, 12, 0, 0),
  tabs = [
    { id: 1, active: true, pinned: false, audible: false, discarded: false, url: 'https://example.com/' },
    { id: 2, active: false, pinned: false, audible: false, discarded: false, url: 'https://news.example.org/article?token=secret123' }
  ],
  fetchHandler
} = {}) {
  const bgSrc = fs.readFileSync(path.join(ROOT, 'extension/background.js'), 'utf8');
  let fakeNow = initialNowMs;
  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length === 0 ? [fakeNow] : args));
    }
    static now() {
      return fakeNow;
    }
  }

  const onChangedListeners = [];
  const localWrap = makeStorageArea(initialLocal, onChangedListeners, 'local');
  const syncWrap = makeStorageArea(initialSync, onChangedListeners, 'sync');
  const sessionWrap = makeStorageArea({}, onChangedListeners, 'session');

  const enabledRulesets = new Set(ALL_5_RULESETS);
  const rulesetCalls = [];
  const dynamicRules = new Map();
  const dnrDynamicCalls = [];
  const registeredScripts = new Map();
  const alarmsCreated = new Map();
  const alarmsCleared = [];
  const tabsDiscarded = [];
  const tabsCreated = [];
  const tabMessages = [];
  const fetchCalls = [];

  const listeners = {
    onInstalled: [],
    onStartup: [],
    onAlarm: [],
    onMessage: []
  };

  const chromeMock = {
    runtime: {
      id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
      lastError: null,
      getManifest: () => ({ version: '1.4.0' }),
      getURL: (p) => `chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc/${p}`,
      setUninstallURL() {},
      requestUpdateCheck() {},
      reload() {},
      onUpdateAvailable: { addListener() {} },
      onInstalled: { addListener: (fn) => listeners.onInstalled.push(fn) },
      onStartup: { addListener: (fn) => listeners.onStartup.push(fn) },
      onMessage: { addListener: (fn) => listeners.onMessage.push(fn) }
    },
    storage: {
      local: localWrap.area,
      sync: syncWrap.area,
      session: sessionWrap.area,
      onChanged: { addListener: (fn) => onChangedListeners.push(fn) }
    },
    declarativeNetRequest: {
      updateEnabledRulesets: async ({ enableRulesetIds = [], disableRulesetIds = [] } = {}) => {
        rulesetCalls.push({ enableRulesetIds: [...enableRulesetIds], disableRulesetIds: [...disableRulesetIds] });
        for (const id of disableRulesetIds) enabledRulesets.delete(id);
        for (const id of enableRulesetIds) enabledRulesets.add(id);
      },
      getEnabledRulesets: async () => [...enabledRulesets],
      updateDynamicRules: async ({ removeRuleIds = [], addRules = [] } = {}) => {
        dnrDynamicCalls.push({ removeRuleIds: [...removeRuleIds], addRules: [...addRules] });
        for (const id of removeRuleIds) dynamicRules.delete(id);
        for (const r of addRules) dynamicRules.set(r.id, r);
      },
      getDynamicRules: async () => [...dynamicRules.values()],
      setExtensionActionOptions: async () => {},
      onRuleMatchedDebug: { addListener() {} }
    },
    permissions: { contains: async () => true },
    scripting: {
      unregisterContentScripts: async ({ ids = [] } = {}) => {
        for (const id of ids) registeredScripts.delete(id);
      },
      registerContentScripts: async (scripts = []) => {
        for (const s of scripts) registeredScripts.set(s.id, s);
      },
      getRegisteredContentScripts: async () => [...registeredScripts.values()]
    },
    contextMenus: {
      removeAll: (cb) => { if (typeof cb === 'function') cb(); },
      create() {},
      onClicked: { addListener() {} }
    },
    commands: { onCommand: { addListener() {} } },
    tabs: {
      discard: async (tabId) => {
        tabsDiscarded.push(tabId);
        const t = tabs.find((x) => x.id === tabId);
        if (t) t.discarded = true;
      },
      create: async (opts) => {
        tabsCreated.push(opts);
        return { id: 100 + tabsCreated.length, ...opts };
      },
      query: async (q = {}) => tabs.filter((t) => (q.active === undefined ? true : Boolean(t.active) === Boolean(q.active))),
      sendMessage: async (tabId, msg) => {
        tabMessages.push({ tabId, msg });
      },
      onCreated: { addListener() {} },
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      onRemoved: { addListener() {} }
    },
    alarms: {
      create: (name, info) => {
        alarmsCreated.set(name, info || {});
      },
      clear: async (name) => {
        alarmsCreated.delete(name);
        alarmsCleared.push(name);
        return true;
      },
      onAlarm: { addListener: (fn) => listeners.onAlarm.push(fn) }
    },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    identity: {
      getProfileUserInfo: (_opts, cb) => cb({ email: '', id: '' }),
      getAuthToken: (_opts, cb) => cb(''),
      removeCachedAuthToken: (_opts, cb) => { if (typeof cb === 'function') cb(); }
    }
  };

  const customSetTimeout = (fn, delay) => {
    if (delay === 2500) return 0;
    return setTimeout(fn, 0);
  };

  const ctx = {
    chrome: chromeMock,
    Date: FakeDate,
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      userAgentData: { platform: 'Windows', brands: [{ brand: 'Google Chrome' }] },
      language: 'en-GB'
    },
    fetch: async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      if (fetchHandler) return fetchHandler(String(url), init, fakeNow);
      return { ok: false, status: 404, json: async () => ({ ok: false }) };
    },
    setTimeout: customSetTimeout,
    clearTimeout,
    AbortSignal,
    URL,
    URLSearchParams,
    Intl,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    console
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(bgSrc, ctx, { filename: 'extension/background.js' });

  const sendPopupMessage = (msg) =>
    new Promise((resolve) => {
      const sender = { url: 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc/popup.html' };
      let handled = false;
      for (const fn of listeners.onMessage) {
        const ret = fn(msg, sender, (resp) => {
          handled = true;
          resolve(resp);
        });
        if (ret === true) break;
      }
      if (!handled) {
        setTimeout(() => { if (!handled) resolve(undefined); }, 25);
      }
    });

  return {
    ctx,
    localStore: localWrap.store,
    syncStore: syncWrap.store,
    enabledRulesets,
    rulesetCalls,
    dynamicRules,
    dnrDynamicCalls,
    registeredScripts,
    alarmsCreated,
    alarmsCleared,
    tabsDiscarded,
    tabsCreated,
    tabMessages,
    fetchCalls,
    listeners,
    sendPopupMessage,
    getNow: () => fakeNow,
    setNow: (ms) => { fakeNow = ms; },
    advanceMs: (ms) => { fakeNow += ms; }
  };
}

function makeFakeElement({ id = '', tagName = 'DIV', textContent = '', classes = [], attrs = {}, style = {} } = {}) {
  const classSet = new Set(classes);
  const children = [];
  const attrMap = { ...attrs };
  if (id) attrMap.id = id;
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    nodeType: 1,
    textContent,
    value: attrMap.value || '',
    disabled: Boolean(attrMap.disabled),
    dataset: {},
    shadowRoot: null,
    children,
    parentElement: null,
    style: {
      ...style,
      setProperty(prop, val) {
        this[prop] = val;
        if (prop === 'overflow-y') this.overflowY = val;
      },
      removeProperty(prop) {
        delete this[prop];
      }
    },
    classList: {
      add: (...c) => c.forEach((x) => classSet.add(x)),
      remove: (...c) => c.forEach((x) => classSet.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classSet.has(c)) classSet.delete(c);
          else classSet.add(c);
        } else if (force) classSet.add(c);
        else classSet.delete(c);
      },
      contains: (c) => classSet.has(c),
      get length() { return classSet.size; },
      [Symbol.iterator]: () => classSet[Symbol.iterator]()
    },
    get className() {
      return [...classSet].join(' ');
    },
    set className(val) {
      classSet.clear();
      for (const c of String(val || '').trim().split(/\s+/)) {
        if (c) classSet.add(c);
      }
    },
    _handlers: new Map(),
    addEventListener(ev, fn) {
      if (!this._handlers.has(ev)) this._handlers.set(ev, []);
      this._handlers.get(ev).push(fn);
    },
    removeEventListener() {},
    dispatchEvent(ev) {
      const list = this._handlers.get(ev.type) || [];
      for (const fn of list) fn(ev);
    },
    click() {
      this._clicked = (this._clicked || 0) + 1;
      const list = this._handlers.get('click') || [];
      for (const fn of list) fn({ preventDefault() {}, stopPropagation() {} });
    },
    focus() {},
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(attrMap, k) ? attrMap[k] : null;
    },
    setAttribute(k, v) {
      attrMap[k] = String(v);
    },
    appendChild(child) {
      child.parentElement = this;
      children.push(child);
      return child;
    },
    remove() {
      this._removed = true;
    },
    querySelectorAll: () => [],
    querySelector: () => null
  };
  return el;
}

function runUiHarness(fileRel, { dashboardState = {}, storageState = {}, nowMs = Date.UTC(2026, 10, 1, 12, 0, 0) } = {}) {
  const src = fs.readFileSync(path.join(ROOT, fileRel), 'utf8');
  let currentNowMs = nowMs;
  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length === 0 ? [currentNowMs] : args));
    }
    static now() {
      return currentNowMs;
    }
  }

  const elementIds = [
    // popup.html IDs
    'adsCount', 'adsMetricLabel', 'cookieCount', 'adsBlockedText', 'tierBadge',
    'hostPermBanner', 'grantHostPermBtn', 'ramHeadlineMetric', 'ramDescriptionText',
    'ramBarFill', 'reclaimRamBtn', 'keepSiteAwakeBtn', 'autoRamToggleBtn',
    'savedTabsCount', 'upgradeCtaBtn', 'upgradeCtaText', 'upgradeSubtitleText',
    'siteBar', 'siteBarClickRow', 'currentSiteLabel', 'currentSiteSub',
    'sitePauseBtn', 'pause5MinBtn', 'storeSafetyCard', 'storeSafetyTitle',
    'storeSafetySub', 'storeSafetyPill', 'toggleLicenseDrawerBtn', 'licenseDrawer',
    'licenseKeyInput', 'activateKeyBtn', 'licenseFeedback', 'openTestLabBtn',
    'openDashboardBtn', 'openFullSessionsBtn', 'openCustomModulesBtn', 'startZapperBtn',
    'popupChromeAutoVerifyBtn', 'pasteKeyBtn', 'popupAutoRamRow', 'popupMainView',
    'popupMenuView', 'popupMenuBackBtn', 'popupOpenWelcomeBtn', 'popupMenuTabEngines',
    'popupMenuTabLists', 'popupEnginesPane', 'popupListsPane', 'popupListTabsBar',
    'popupSessionsList', 'popupPausedList', 'popupPinnedList', 'popupHiddenList',
    // welcome.html IDs
    'welcomeLicenseInput', 'welcomeActivateBtn', 'welcomePasteBtn', 'welcomeTabKey',
    'welcomeTabBuy', 'welcomePanelKey', 'welcomePanelBuy', 'welcomeInlineTrialBtn',
    'welcomeKeyFeedback', 'welcomeStatusBadge', 'welcomeTrialBanner',
    'welcomeTrialBannerTitle', 'welcomeTrialBannerDesc', 'welcomeBuyTitle',
    'welcomeBuyDesc', 'welcomeBuyCtaText', 'welcomeHostPermBanner',
    'welcomeGrantPermBtn', 'welcomeShortcutsFooter', 'welcomeChromeAutoBanner',
    'welcomeChromeAutoBannerText', 'welcomeChromeAutoPortalLink', 'welcomeChromeAutoVerifyBtn'
  ];

  const byId = new Map();
  for (const id of elementIds) {
    byId.set(id, makeFakeElement({ id }));
  }
  const settingSwitches = ['adBlocking', 'cookieAutoClose', 'trackerProtection', 'silentMode', 'autoRamTamer', 'cloudTabSyncEnabled'].map((k) =>
    makeFakeElement({ tagName: 'SPAN', classes: ['switch-btn', 'pro-lock'], attrs: { 'data-setting': k } })
  );
  const settingRows = ['adBlocking', 'cookieAutoClose', 'trackerProtection', 'silentMode', 'autoRamTamer', 'cloudTabSyncEnabled'].map((k) =>
    makeFakeElement({ tagName: 'BUTTON', attrs: { 'data-popup-setting': k } })
  );
  const bodyEl = makeFakeElement({ tagName: 'BODY', classes: ['unactivated-mode'] });
  const docListeners = new Map();
  const winListeners = new Map();
  const intervals = [];

  const localWrap = makeStorageArea(storageState);

  const documentMock = {
    body: bodyEl,
    documentElement: makeFakeElement({ tagName: 'HTML' }),
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => makeFakeElement({ tagName: tag }),
    createElementNS: (_ns, tag) => makeFakeElement({ tagName: tag }),
    querySelector: (sel) => {
      if (sel.includes('siteBarClickRow')) return byId.get('siteBarClickRow');
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '#popupEnginesPane [data-setting]') return settingSwitches;
      if (sel === '#popupEnginesPane [data-popup-setting]') return settingRows;
      return [];
    },
    addEventListener: (ev, fn) => {
      if (!docListeners.has(ev)) docListeners.set(ev, []);
      docListeners.get(ev).push(fn);
    }
  };

  const sentMessages = [];
  let dashCalls = 0;
  const chromeMock = {
    runtime: {
      id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
      getURL: (p) => `chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc/${p}`,
      sendMessage: (msg, cb) => {
        sentMessages.push(msg);
        if (msg?.type === 'GET_DASHBOARD_STATE' && typeof cb === 'function') {
          dashCalls += 1;
          const payload = typeof dashboardState === 'function' ? dashboardState(dashCalls, currentNowMs) : dashboardState;
          cb(structuredClone(payload));
        } else if (typeof cb === 'function') {
          cb({ ok: false, requiresPro: true, error: 'Pro required' });
        }
      }
    },
    storage: {
      local: localWrap.area,
      onChanged: { addListener() {} }
    },
    tabs: {
      query: (_q, cb) => cb([{ id: 1, url: 'https://example.com/' }]),
      create: () => {}
    },
    i18n: { getMessage: () => '' },
    commands: { getAll: (cb) => cb([]) },
    permissions: { contains: (_opts, cb) => cb(true) }
  };

  const windowMock = {
    addEventListener: (ev, fn) => {
      if (!winListeners.has(ev)) winListeners.set(ev, []);
      winListeners.get(ev).push(fn);
    },
    matchMedia: () => ({ matches: false })
  };

  const intervalCallbacks = [];
  const ctx = {
    Date: FakeDate,
    document: documentMock,
    window: windowMock,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/131.0', platform: 'Win32' },
    chrome: chromeMock,
    URL,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    setInterval: (fn, ms) => {
      intervalCallbacks.push(fn);
      const id = setInterval(fn, ms);
      intervals.push(id);
      return id;
    },
    clearInterval,
    console
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: fileRel });
  for (const fn of docListeners.get('DOMContentLoaded') || []) fn();
  for (const id of intervals) clearInterval(id);
  return {
    byId,
    bodyEl,
    settingSwitches,
    settingRows,
    sentMessages,
    setNow: (ms) => {
      currentNowMs = ms;
    },
    tickIntervals: () => {
      for (const fn of intervalCallbacks) fn();
    }
  };
}

describe('Milestone M2 — No-Card 7-Day Pro Trial, Pro Gating & 160-CMP Registry', () => {
  test('1. Fresh install starts 7-day trial automatically (online & offline) with all 5 DNR rulesets and deepstealth-main', async () => {
    // 1a. Online fresh install -> syncs with POST /api/trial/start
    let trialStartCalls = 0;
    const online = createBackgroundHarness({
      fetchHandler: async (url, init, nowMs) => {
        if (url.endsWith('/api/trial/start')) {
          trialStartCalls += 1;
          const reqBody = JSON.parse(init.body);
          assert.ok(reqBody.installId, 'must send installId');
          assert.equal(reqBody.cardNumber, undefined, 'no card required');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              requiresCard: false,
              trialKey: 'SWEEPR-DB-7D01-AAAA-BBBB',
              status: 'trialing',
              plan: 'trial_7d',
              trialStartedAt: nowMs,
              trialExpiresAt: nowMs + 7 * DAY_MS,
              maxDevices: 5
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });

    await online.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of online.listeners.onInstalled) {
      await fn({ reason: 'install' });
    }

    assert.equal(trialStartCalls, 1);
    assert.equal(online.localStore.proActive, true);
    assert.equal(online.localStore.subscriptionStatus, 'trialing');
    assert.equal(online.localStore.plan, 'trial_7d');
    assert.equal(online.localStore.licenseKey, 'SWEEPR-DB-7D01-AAAA-BBBB');
    assert.equal(online.localStore.trialSyncedWithServer, true);
    assert.equal(online.localStore.trialExpiresAt, online.localStore.trialStartedAt + 7 * DAY_MS);
    assert.equal(online.localStore.licenseExpiresAt, online.localStore.trialExpiresAt);
    assert.equal(online.localStore.settings.adBlocking, true);
    assert.equal(online.localStore.settings.cookieAutoClose, true);
    assert.equal(online.localStore.settings.trackerProtection, true);
    assert.equal(online.localStore.settings.silentMode, true);
    assert.equal(online.localStore.settings.autoRamTamer, true);
    assert.equal(online.localStore.settings.cloudTabSyncEnabled, true);
    for (const id of ALL_5_RULESETS) {
      assert.ok(online.enabledRulesets.has(id), `Expected ruleset ${id} enabled on trial install`);
    }
    assert.ok(online.registeredScripts.has('deepstealth-main'), 'deepstealth-main must be registered during active trial');
    assert.ok(online.alarmsCreated.has('trialExpiryCheck'), 'trialExpiryCheck alarm must be scheduled');

    // 1b. Offline fresh install -> local fallback trial still activates immediately
    const offline = createBackgroundHarness({
      fetchHandler: async () => {
        throw new Error('offline');
      }
    });
    await offline.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of offline.listeners.onInstalled) {
      await fn({ reason: 'install' });
    }
    assert.equal(offline.localStore.proActive, true);
    assert.equal(offline.localStore.subscriptionStatus, 'trialing');
    assert.equal(offline.localStore.plan, 'trial_7d');
    assert.match(offline.localStore.licenseKey, FULL_KEY_RE);
    assert.equal(offline.localStore.trialSyncedWithServer, false);
    for (const id of ALL_5_RULESETS) {
      assert.ok(offline.enabledRulesets.has(id), `Offline install must enable ${id}`);
    }
    assert.ok(offline.registeredScripts.has('deepstealth-main'));
  });

  test('2. Active trial allows RAM Tamer, 5-device sync, OTA delta, and gates all 5 Pro features on simulated 7-day expiry (immediate, alarm, and cold restart)', async () => {
    const startMs = Date.UTC(2026, 10, 1, 12, 0, 0);
    const h = createBackgroundHarness({
      initialNowMs: startMs,
      fetchHandler: async (url, _init, nowMs) => {
        if (url.endsWith('/api/trial/start')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              trialKey: 'SWEEPR-DB-7D02-CCCC-DDDD',
              status: 'trialing',
              plan: 'trial_7d',
              trialStartedAt: nowMs,
              trialExpiresAt: nowMs + 7 * DAY_MS,
              maxDevices: 5
            })
          };
        }
        if (url.includes('/api/filters/delta')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              extraCmpSelectors: ['#ota-cmp-banner'],
              extraCosmeticSelectors: ['.ota-ad-slot'],
              dynamicDnrRules: [
                {
                  id: 80001,
                  priority: 1,
                  action: { type: 'block' },
                  condition: { urlFilter: '||ota-ads.example^', resourceTypes: ['script'] }
                }
              ]
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });

    await h.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of h.listeners.onInstalled) {
      await fn({ reason: 'install' });
    }

    // Advance to Day 3 — trial still active
    h.advanceMs(3 * DAY_MS);
    const dashDay3 = await h.sendPopupMessage({ type: 'GET_DASHBOARD_STATE' });
    assert.equal(dashDay3.proActive, true);
    assert.equal(dashDay3.subscriptionStatus, 'trialing');
    assert.equal(dashDay3.trialDaysRemaining, 4);

    // RAM Tamer & 5-device sync active on Day 3
    const hibDay3 = await h.sendPopupMessage({ type: 'HIBERNATE_TABS_NOW' });
    assert.equal(hibDay3.ok, true);
    assert.equal(hibDay3.newlyDiscarded, 1);
    assert.ok(Array.isArray(h.syncStore.cloudTabSessions) && h.syncStore.cloudTabSessions.length === 1);

    // OTA Delta writes rules and selectors during active trial
    await h.ctx.syncRemoteFilterDelta({ force: true });
    assert.equal(h.dynamicRules.has(80001), true);
    assert.deepEqual(h.localStore.extraCmpSelectors, ['#ota-cmp-banner']);
    assert.deepEqual(h.localStore.extraCosmeticSelectors, ['.ota-ad-slot']);

    // Advance past 7-day expiry (Immediate enforcement via message boundary)
    h.setNow(startMs + 7 * DAY_MS + 1000);
    const dashExpired = await h.sendPopupMessage({ type: 'GET_DASHBOARD_STATE' });
    assert.equal(dashExpired.proActive, false);
    assert.equal(dashExpired.subscriptionStatus, 'trial_expired');
    assert.equal(dashExpired.settings.adBlocking, false);
    assert.equal(dashExpired.settings.cookieAutoClose, false);
    assert.equal(dashExpired.settings.trackerProtection, false);
    assert.equal(dashExpired.settings.autoRamTamer, false);
    assert.equal(dashExpired.settings.cloudTabSyncEnabled, false);

    // All 5 static rulesets disabled, deepstealth-main unregistered, OTA cleared, sync cleared, open tabs notified
    assert.equal(h.enabledRulesets.size, 0, 'All 5 static rulesets must be disabled on expiry');
    assert.equal(h.registeredScripts.has('deepstealth-main'), false, 'deepstealth-main must be unregistered');
    assert.equal(h.dynamicRules.size, 0, 'OTA dynamic rules must be cleared');
    assert.deepEqual([...h.localStore.extraCmpSelectors], []);
    assert.deepEqual([...h.localStore.extraCosmeticSelectors], []);
    assert.equal(h.syncStore.cloudTabSessions, undefined, '5-device cloudTabSessions sync must stop/clear');
    assert.ok(h.tabMessages.some((m) => m.msg?.type === 'PRO_ENTITLEMENT_CHANGED' && m.msg.proActive === false));

    // All Pro actions return requiresPro: true after expiry
    const hibExpired = await h.sendPopupMessage({ type: 'HIBERNATE_TABS_NOW' });
    assert.equal(hibExpired.ok, false);
    assert.equal(hibExpired.requiresPro, true);
    const toggleExpired = await h.sendPopupMessage({ type: 'TOGGLE_SETTING', settingKey: 'cookieAutoClose' });
    assert.equal(toggleExpired.ok, false);
    assert.equal(toggleExpired.requiresPro, true);
    const restoreExpired = await h.sendPopupMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: 'any' });
    assert.equal(restoreExpired.ok, false);
    assert.equal(restoreExpired.requiresPro, true);

    // Alarm path (`trialExpiryCheck` & `ramTamerCheck`) + cold restart offline grace boundary
    const hAlarm = createBackgroundHarness({ initialNowMs: startMs });
    await hAlarm.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of hAlarm.listeners.onInstalled) await fn({ reason: 'install' });
    assert.equal(hAlarm.localStore.proActive, true);
    hAlarm.setNow(startMs + 7 * DAY_MS + 5000);
    for (const fn of hAlarm.listeners.onAlarm) {
      await fn({ name: 'trialExpiryCheck' });
    }
    assert.equal(hAlarm.localStore.proActive, false);
    assert.equal(hAlarm.localStore.subscriptionStatus, 'trial_expired');
    assert.equal(hAlarm.enabledRulesets.size, 0);
    assert.equal(hAlarm.registeredScripts.has('deepstealth-main'), false);
    for (const fn of hAlarm.listeners.onAlarm) {
      await fn({ name: 'ramTamerCheck' });
    }
    assert.equal(hAlarm.tabsDiscarded.length, 0, 'ramTamerCheck must not discard tabs after trial expiry');

    // Cold restart with stale stored `proActive: true` but expired `trialExpiresAt` and offline network
    const coldExpired = createBackgroundHarness({
      initialNowMs: startMs + 7 * DAY_MS + 10000,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        licenseKey: 'SWEEPR-DB-7D02-CCCC-DDDD',
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 7 * DAY_MS,
        licenseVerifiedAt: startMs + 6 * DAY_MS,
        settings: { adBlocking: true, cookieAutoClose: true, trackerProtection: true, silentMode: true, autoRamTamer: true, cloudTabSyncEnabled: true }
      },
      fetchHandler: async () => {
        throw new Error('offline');
      }
    });
    const coldAuth = await coldExpired.ctx.enforceStoredSubscriptionIntegrity();
    assert.equal(coldAuth.proActive, false);
    assert.equal(coldExpired.localStore.proActive, false);
    assert.equal(coldExpired.localStore.subscriptionStatus, 'trial_expired');
    assert.equal(coldExpired.enabledRulesets.size, 0);
    assert.equal(coldExpired.registeredScripts.has('deepstealth-main'), false);
  });

  test('3. Paid license upgrade after trial expiry clears trialExpiresAt, restores Pro state, and re-enables all 5 DNR rulesets', async () => {
    const startMs = Date.UTC(2026, 10, 1, 12, 0, 0);
    const paidKey = 'SWEEPR-DB-PAID-2026-9999';
    const h = createBackgroundHarness({
      initialNowMs: startMs + 8 * DAY_MS,
      initialLocal: {
        proActive: false,
        ramTamerActive: false,
        licenseKey: 'SWEEPR-DB-7D02-CCCC-DDDD',
        subscriptionStatus: 'trial_expired',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 7 * DAY_MS,
        settings: { adBlocking: false, cookieAutoClose: false, trackerProtection: false, silentMode: false, autoRamTamer: false, cloudTabSyncEnabled: false }
      },
      fetchHandler: async (url) => {
        if (url.includes('/api/license-verify')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              status: 'active',
              plan: 'annual',
              licenseKey: paidKey,
              expiresAt: '2027-11-01T12:00:00.000Z'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }
    });

    await h.ctx.enforceStoredSubscriptionIntegrity();
    assert.equal(h.localStore.proActive, false);

    const actRes = await h.sendPopupMessage({ type: 'ACTIVATE_LICENSE', licenseKey: paidKey });
    assert.equal(actRes.ok, true);
    assert.equal(actRes.valid, true);
    assert.equal(h.localStore.proActive, true);
    assert.equal(h.localStore.subscriptionStatus, 'active');
    assert.equal(h.localStore.plan, 'annual');
    assert.equal(h.localStore.trialExpiresAt, 0);
    assert.equal(h.localStore.licenseKey, paidKey);
    assert.equal(h.localStore.settings.cloudTabSyncEnabled, true);
    for (const id of ALL_5_RULESETS) {
      assert.ok(h.enabledRulesets.has(id), `Paid upgrade must re-enable ${id}`);
    }
    assert.ok(h.registeredScripts.has('deepstealth-main'));
  });

  test('4. Popup & Welcome UI show active 7-day trial countdown and expired upgrade state', () => {
    const nowMs = Date.UTC(2026, 10, 5, 12, 0, 0);
    const expFuture = nowMs + (4 * 24 + 5) * 3600 * 1000;

    // 4a. Active trial in popup.js
    const popActive = runUiHarness('extension/popup.js', {
      nowMs,
      dashboardState: {
        proActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: nowMs - 3 * DAY_MS,
        trialExpiresAt: expFuture,
        stats: { adsBlocked: 42, cookiePromptsDetected: 7 },
        settings: { adBlocking: true, cookieAutoClose: true, trackerProtection: true, silentMode: true, autoRamTamer: true, cloudTabSyncEnabled: true },
        ramMetrics: { totalTabs: 5, discardedCount: 1, tabsDiscardSupported: true }
      }
    });
    assert.equal(popActive.bodyEl.classList.contains('pro-mode'), true);
    assert.match(popActive.byId.get('tierBadge').textContent, /7-Day Pro Trial/);
    assert.match(popActive.byId.get('tierBadge').textContent, /4d 5h left/);
    assert.match(popActive.byId.get('storeSafetyPill').textContent, /Trial · 4d 5h left/);
    assert.equal(popActive.settingSwitches.every((sw) => !sw.classList.contains('pro-lock')), true);

    // 4b. Expired trial in popup.js
    const popExpired = runUiHarness('extension/popup.js', {
      nowMs,
      dashboardState: {
        proActive: false,
        subscriptionStatus: 'trial_expired',
        plan: 'trial_7d',
        trialStartedAt: nowMs - 8 * DAY_MS,
        trialExpiresAt: nowMs - 1000,
        stats: { adsSpotted: 12, cookiePromptsDetected: 3 },
        settings: { adBlocking: false, cookieAutoClose: false, trackerProtection: false, silentMode: false, autoRamTamer: false, cloudTabSyncEnabled: false },
        ramMetrics: { totalTabs: 5, discardedCount: 0, tabsDiscardSupported: true }
      }
    });
    assert.equal(popExpired.bodyEl.classList.contains('unactivated-mode'), true);
    assert.equal(popExpired.byId.get('tierBadge').textContent, 'Trial Expired');
    assert.equal(popExpired.byId.get('storeSafetyPill').textContent, 'Trial Expired');
    assert.match(popExpired.byId.get('upgradeCtaText').textContent, /Trial Expired/);
    assert.equal(popExpired.settingSwitches.every((sw) => sw.classList.contains('pro-lock') && sw.textContent === 'PRO'), true);

    // 4c. Active trial in welcome.js (must NOT display "Paid Pro Subscription Verified!")
    const welActive = runUiHarness('extension/welcome.js', {
      nowMs,
      storageState: {
        proActive: true,
        licenseKey: 'SWEEPR-DB-7D01-AAAA-BBBB',
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: nowMs - 3 * DAY_MS,
        trialExpiresAt: expFuture
      }
    });
    assert.match(welActive.byId.get('welcomeStatusBadge').textContent, /7-Day Pro Trial/);
    assert.match(welActive.byId.get('welcomeTrialBannerTitle').textContent, /4 days, 5 hours remaining/);
    assert.equal(welActive.byId.get('welcomeKeyFeedback').textContent.includes('Paid Pro Subscription Verified'), false);

    // 4d. Expired trial in welcome.js (must NOT prefill expired trial key)
    const welExpired = runUiHarness('extension/welcome.js', {
      nowMs,
      storageState: {
        proActive: false,
        licenseKey: 'SWEEPR-DB-7D01-AAAA-BBBB',
        subscriptionStatus: 'trial_expired',
        plan: 'trial_7d',
        trialStartedAt: nowMs - 8 * DAY_MS,
        trialExpiresAt: nowMs - 1000
      }
    });
    assert.match(welExpired.byId.get('welcomeStatusBadge').textContent, /Trial Expired/);
    assert.match(welExpired.byId.get('welcomeTrialBannerTitle').textContent, /Expired/);
    assert.equal(welExpired.byId.get('welcomeLicenseInput').value || '', '');
  });

  describe('5. Server /api/trial/start, 5-device cap, /api/license/verify expiry, and v1.4.0 default', () => {
    let serverProc;
    let baseUrl;
    let tempDataDir;

    before(async () => {
      tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-m2-test-'));
      const port = 34000 + Math.floor(Math.random() * 5000);
      baseUrl = `http://127.0.0.1:${port}`;
      const env = {
        ...process.env,
        PORT: String(port),
        DATA_DIR: tempDataDir,
        NODE_ENV: 'production',
        SESSION_SECRET: 'test-session-secret-m2-trial-cmp',
        DISABLE_CMO_AUTOPILOT: '1'
      };
      delete env.LATEST_EXTENSION_VERSION;
      serverProc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
        cwd: ROOT,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stderrBuf = '';
      serverProc.stderr.on('data', (d) => { stderrBuf += d.toString('utf8'); });
      let ready = false;
      for (let i = 0; i < 60; i++) {
        if (serverProc.exitCode !== null) {
          throw new Error(`server.js exited early (${serverProc.exitCode}): ${stderrBuf}`);
        }
        try {
          const r = await fetch(`${baseUrl}/api/version`);
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!ready) {
        throw new Error(`server.js failed to become ready: ${stderrBuf}`);
      }
    });

    after(() => {
      if (serverProc && !serverProc.killed) serverProc.kill();
      if (tempDataDir) fs.rmSync(tempDataDir, { recursive: true, force: true });
    });

    test('GET /api/version and /api/filters/delta default to 1.4.0; POST /api/trial/start is idempotent and enforces 5-device cap + expiry', async () => {
      const verRes = await fetch(`${baseUrl}/api/version?current_version=1.3.2`);
      assert.equal(verRes.status, 200);
      const verJson = await verRes.json();
      assert.equal(verJson.version, '1.4.0');
      assert.equal(verJson.latest_version, '1.4.0');
      assert.equal(verJson.update_available, true);

      const deltaRes = await fetch(`${baseUrl}/api/filters/delta?current_version=1.3.2`);
      const deltaJson = await deltaRes.json();
      assert.equal(deltaJson.latestExtensionVersion, '1.4.0');

      const t1Res = await fetch(`${baseUrl}/api/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId: 'ext_db_inst_001', deviceFingerprint: 'fp-abc-1' })
      });
      assert.equal(t1Res.status, 200);
      const t1 = await t1Res.json();
      assert.equal(t1.ok, true);
      assert.equal(t1.requiresCard, false);
      assert.equal(t1.status, 'trialing');
      assert.equal(t1.plan, 'trial_7d');
      assert.equal(t1.maxDevices, 5);
      assert.match(t1.trialKey, FULL_KEY_RE);
      assert.equal(t1.trialExpiresAt - t1.trialStartedAt, 7 * DAY_MS);

      // Idempotent repeat call returns same trialKey without extending expiry
      const t2Res = await fetch(`${baseUrl}/api/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId: 'ext_db_inst_001', deviceFingerprint: 'fp-abc-1' })
      });
      const t2 = await t2Res.json();
      assert.equal(t2.idempotent, true);
      assert.equal(t2.trialKey, t1.trialKey);
      assert.equal(t2.trialExpiresAt, t1.trialExpiresAt);

      // 5-device cap across /api/license/verify
      for (const dev of ['ext_db_inst_002', 'ext_db_inst_003', 'ext_db_inst_004', 'ext_db_inst_005']) {
        const vRes = await fetch(`${baseUrl}/api/license/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: t1.trialKey, device_id: dev })
        });
        assert.equal(vRes.status, 200);
        const vJson = await vRes.json();
        assert.equal(vJson.valid, true);
        assert.equal(vJson.status, 'trialing');
      }
      const v6Res = await fetch(`${baseUrl}/api/license/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: t1.trialKey, device_id: 'ext_db_inst_006' })
      });
      assert.equal(v6Res.status, 403);
      const v6Json = await v6Res.json();
      assert.equal(v6Json.error, 'device_limit_reached');

      // Simulate trial expiry in trials.json -> verify returns 403 trial_expired
      const trialsPath = path.join(tempDataDir, 'trials.json');
      const rawTrials = JSON.parse(fs.readFileSync(trialsPath, 'utf8'));
      rawTrials.trials[t1.trialKey].trialExpiresAt = Date.now() - 1000;
      rawTrials.trials[t1.trialKey].expiresAt = new Date(Date.now() - 1000).toISOString();
      fs.writeFileSync(trialsPath, JSON.stringify(rawTrials, null, 2), 'utf8');

      const expRes = await fetch(`${baseUrl}/api/license-verify?key=${encodeURIComponent(t1.trialKey)}&device_id=ext_db_inst_001`);
      assert.equal(expRes.status, 403);
      const expJson = await expRes.json();
      assert.equal(expJson.valid, false);
      assert.equal(expJson.error, 'trial_expired');
      assert.equal(expJson.status, 'trial_expired');
    });

    test('GET /api/telemetry/live-proof counts all 5 declared enabled rulesets from extension/manifest.json', async () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'));
      const resources = manifest.declarative_net_request?.rule_resources || [];
      let expectedTotal = 0;
      let expectedActiveCount = 0;
      const expectedById = {};
      for (const rr of resources) {
        const arr = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', rr.path), 'utf8'));
        expectedById[rr.id] = arr.length;
        if (rr.enabled) {
          expectedTotal += arr.length;
          expectedActiveCount += 1;
        }
      }

      const proofRes = await fetch(`${baseUrl}/api/telemetry/live-proof`);
      assert.equal(proofRes.status, 200);
      const proof = await proofRes.json();
      assert.equal(proof.ok, true);
      assert.equal(proof.version, manifest.version);
      assert.equal(proof.rulesetsActive, expectedActiveCount);
      assert.equal(proof.rulesetsActive, 5);
      assert.equal(proof.activeMv3StaticRules, expectedTotal);
      assert.deepEqual(proof.staticRulesByRuleset, expectedById);
      assert.ok(proof.staticRulesByRuleset.easyprivacy_trackers > 0);
      assert.ok(proof.staticRulesByRuleset.regional_eu_filters > 0);
    });
  });

  test('6. deepblock-content.js exposes 160 deduplicated CMP frameworks, 9-locale reject matching, gated scroll unlock, and live expiry pause', () => {
    const contentSrc = fs.readFileSync(path.join(ROOT, 'extension/content/deepblock-content.js'), 'utf8');

    // 6a. Zero-stub VM inspection
    const metaCtx = {};
    vm.runInNewContext(contentSrc, metaCtx, { filename: 'deepblock-content.js' });
    assert.equal(metaCtx.getCmpFrameworkCount(), 160);
    assert.equal(metaCtx.__SWEEPR_CMP_REGISTRY__.count, 160);
    assert.ok(metaCtx.__SWEEPR_CMP_REGISTRY__.count >= 150);

    const ids = new Set();
    const names = new Set();
    for (const fw of metaCtx.__SWEEPR_CMP_REGISTRY__.frameworks) {
      assert.ok(fw.id && !ids.has(fw.id), `Duplicate or empty CMP id: ${fw.id}`);
      assert.ok(fw.name && !names.has(fw.name), `Duplicate or empty CMP name: ${fw.name}`);
      ids.add(fw.id);
      names.add(fw.name);
      assert.ok(fw.containers.length >= 1, `${fw.id} missing containers`);
      assert.ok(fw.rejectButtons.length >= 1, `${fw.id} missing rejectButtons`);
      for (const sel of fw.containers) {
        assert.equal(sel.includes(':has('), false, `CMP container selector must not use :has(): ${sel}`);
      }
    }

    // 6b. Active trial vs Expired trial behavior in simulated DOM (Shadow DOM + 9-locale + scroll unlock)
    function runContentDomTest({ storageData, bannerSetup }) {
      const dispatched = [];
      const createdStyles = new Map();
      const docEl = makeFakeElement({ tagName: 'HTML', classes: ['didomi-popup-open'], style: { overflow: 'hidden' } });
      const bodyEl = makeFakeElement({ tagName: 'BODY', classes: ['sp-message-open'], style: { overflow: 'hidden', overflowY: 'hidden', position: 'fixed', pointerEvents: 'none' } });
      const msgListeners = [];

      const { bannerEl, allButtons, matchedBySelector } = bannerSetup();
      const docMock = {
        readyState: 'complete',
        documentElement: docEl,
        head: makeFakeElement({ tagName: 'HEAD' }),
        body: bodyEl,
        getElementById: (id) => createdStyles.get(id) || null,
        createElement: (tag) => {
          const el = makeFakeElement({ tagName: tag });
          const origSetId = el;
          Object.defineProperty(origSetId, 'id', {
            get: () => el._id || '',
            set: (v) => {
              el._id = v;
              createdStyles.set(v, el);
            }
          });
          el.remove = () => {
            if (el._id) createdStyles.delete(el._id);
          };
          return el;
        },
        querySelector: (sel) => {
          if (sel.includes('div:invalid(((')) throw new SyntaxError('invalid selector');
          if (matchedBySelector(sel)) return bannerEl;
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel.includes('button') && !bannerEl.shadowRoot) return allButtons;
          return [];
        },
        addEventListener() {}
      };

      const sandbox = {
        location: { hostname: 'example.com', href: 'https://example.com/', protocol: 'https:' },
        chrome: {
          storage: {
            local: { get: (_keys, cb) => cb(storageData), set() {} },
            onChanged: { addListener() {} }
          },
          runtime: {
            id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
            onMessage: { addListener: (fn) => msgListeners.push(fn) },
            sendMessage() {}
          }
        },
        navigator: { userAgent: 'Mozilla/5.0 Chrome/131.0' },
        getComputedStyle: (el) => el.style || {},
        document: docMock,
        window: {
          top: null,
          self: null,
          addEventListener() {},
          dispatchEvent: (ev) => dispatched.push(ev)
        },
        MutationObserver: class { observe() {} disconnect() {} },
        CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d?.detail; } },
        Event: class { constructor(t) { this.type = t; } },
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
        console
      };
      sandbox.window.top = sandbox.window;
      sandbox.window.self = sandbox.window;
      vm.runInNewContext(contentSrc, sandbox, { filename: 'deepblock-content.js' });
      return { docEl, bodyEl, dispatched, createdStyles, msgListeners };
    }

    // Active trial with malformed OTA selector + Japanese reject button inside ShadowRoot
    const jaRejectBtn = makeFakeElement({ tagName: 'BUTTON', textContent: 'すべて拒否' });
    const shadowBanner = makeFakeElement({ id: 'usercentrics-root' });
    shadowBanner.shadowRoot = {
      querySelectorAll: (sel) => (sel.includes('button') ? [jaRejectBtn] : []),
      querySelector: () => null
    };
    const activeRes = runContentDomTest({
      storageData: {
        proActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialExpiresAt: Date.now() + 3 * DAY_MS,
        extraCmpSelectors: ['div:invalid((('],
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      bannerSetup: () => ({
        bannerEl: shadowBanner,
        allButtons: [],
        matchedBySelector: (s) => s.includes('#usercentrics-root')
      })
    });
    assert.equal(jaRejectBtn._clicked, 1, 'Shadow-DOM Japanese reject button must be clicked on active trial despite malformed OTA selector');
    assert.equal(activeRes.docEl.style.overflow, 'auto');
    assert.equal(activeRes.bodyEl.style.overflow, 'auto');
    assert.equal(activeRes.bodyEl.style.position, 'static');
    assert.equal(activeRes.docEl.classList.contains('didomi-popup-open'), false);
    assert.equal(activeRes.bodyEl.classList.contains('sp-message-open'), false);
    assert.ok(activeRes.dispatched.some((e) => e.type === '_ds_cfg' && e.detail?.p === false));

    // Live PRO_ENTITLEMENT_CHANGED expiry pauses DeepStealth and removes cosmetic styles
    for (const fn of activeRes.msgListeners) {
      fn({ type: 'PRO_ENTITLEMENT_CHANGED', proActive: false, subscriptionStatus: 'trial_expired' }, {}, () => {});
    }
    assert.ok(activeRes.dispatched.some((e) => e.type === '_ds_cfg' && e.detail?.p === true));
    assert.equal(activeRes.createdStyles.has('deepblock-universal-cosmetic'), false);

    // Expired trial does NOT click reject button and does NOT unlock scroll
    const deRejectBtn = makeFakeElement({ tagName: 'BUTTON', textContent: 'Alle ablehnen' });
    const deBanner = makeFakeElement({ id: 'didomi-host' });
    deBanner.querySelectorAll = (sel) => (sel.includes('button') ? [deRejectBtn] : []);
    const expiredRes = runContentDomTest({
      storageData: {
        proActive: true,
        licenseKey: 'SWEEPR-DB-7D01-AAAA-BBBB',
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialExpiresAt: Date.now() - 5000,
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      bannerSetup: () => ({
        bannerEl: deBanner,
        allButtons: [deRejectBtn],
        matchedBySelector: (s) => s.includes('#didomi-host')
      })
    });
    assert.equal(deRejectBtn._clicked || 0, 0, 'Expired trial must NOT auto-reject cookie banners');
    assert.equal(expiredRes.docEl.style.overflow, 'hidden', 'Expired trial must NOT unlock scroll');
    assert.ok(expiredRes.dispatched.some((e) => e.type === '_ds_cfg' && e.detail?.p === true));
    assert.equal(expiredRes.docEl.dataset.dsPaused, '1');
  });

  test('7. Regression tests: storage.onChanged anti-tamper, TOGGLE_NEVER_SNOOZE_SITE gating, popup live expiry, Shadow-DOM >600 nodes, disabled buttons, aria-label whitespace, and dsPaused world sync', async () => {
    const startMs = Date.UTC(2026, 10, 1, 12, 0, 0);
    const expMs = startMs + 7 * DAY_MS;

    // 7a. background.js: TOGGLE_NEVER_SNOOZE_SITE gating & storage.onChanged cannot revive an expired trial
    const h = createBackgroundHarness({
      initialNowMs: startMs + DAY_MS,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        licenseKey: 'SWEEPR-DB-7D07-AAAA-BBBB',
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: expMs,
        licenseVerifiedAt: startMs,
        settings: {
          adBlocking: true,
          cookieAutoClose: true,
          trackerProtection: true,
          silentMode: true,
          autoRamTamer: true,
          cloudTabSyncEnabled: true
        }
      }
    });
    await h.ctx.enforceStoredSubscriptionIntegrity();

    // Active trial permits TOGGLE_NEVER_SNOOZE_SITE
    const snoozeActive = await h.sendPopupMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: 'example.com' });
    assert.equal(snoozeActive.ok, true);
    assert.equal(snoozeActive.keptAwake, true);

    // Advance past trial expiry and trigger enforcement
    h.setNow(expMs + 1000);
    const dashExp = await h.sendPopupMessage({ type: 'GET_DASHBOARD_STATE' });
    assert.equal(dashExp.proActive, false);
    assert.equal(dashExp.subscriptionStatus, 'trial_expired');

    // Expired trial gates TOGGLE_NEVER_SNOOZE_SITE
    const snoozeExpired = await h.sendPopupMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: 'other.com' });
    assert.equal(snoozeExpired.ok, false);
    assert.equal(snoozeExpired.requiresPro, true);
    assert.deepEqual([...h.localStore.neverSnoozeSites], ['example.com']);

    // Attempt DevTools tamper via chrome.storage.local.set while trial_expired
    await h.ctx.chrome.storage.local.set({
      proActive: true,
      ramTamerActive: true,
      licenseVerifiedAt: h.getNow(),
      licenseKey: 'SWEEPR-DB-7D07-AAAA-BBBB'
    });
    await new Promise((r) => setTimeout(r, 25));
    const authAfterTamper = await h.ctx.ensureVerifiedProSession();
    assert.equal(authAfterTamper.proActive, false, 'storage.onChanged must NOT revive an expired trial');
    assert.equal(h.localStore.proActive, false);
    assert.equal(h.localStore.subscriptionStatus, 'trial_expired');
    assert.equal(h.enabledRulesets.size, 0);
    assert.equal(h.registeredScripts.has('deepstealth-main'), false);

    // Attempt DevTools tamper rewriting subscriptionStatus back to trialing with past trialExpiresAt
    await h.ctx.chrome.storage.local.set({
      proActive: true,
      ramTamerActive: true,
      subscriptionStatus: 'trialing',
      plan: 'trial_7d',
      trialExpiresAt: expMs,
      licenseVerifiedAt: h.getNow(),
      licenseKey: 'SWEEPR-DB-7D07-AAAA-BBBB'
    });
    await new Promise((r) => setTimeout(r, 25));
    const authAfterTamper2 = await h.ctx.ensureVerifiedProSession();
    assert.equal(authAfterTamper2.proActive, false);
    assert.equal(h.localStore.subscriptionStatus, 'trial_expired');
    assert.equal(h.enabledRulesets.size, 0);

    // 7b. popup.js: live clock crossing trialExpiresAt triggers GET_DASHBOARD_STATE, locks switches, and blocks keepSiteAwakeBtn
    const popLive = runUiHarness('extension/popup.js', {
      nowMs: expMs - 30000,
      dashboardState: (callNum) =>
        callNum === 1
          ? {
              proActive: true,
              subscriptionStatus: 'trialing',
              plan: 'trial_7d',
              trialStartedAt: startMs,
              trialExpiresAt: expMs,
              stats: { adsBlocked: 10, cookiePromptsDetected: 2 },
              settings: {
                adBlocking: true,
                cookieAutoClose: true,
                trackerProtection: true,
                silentMode: true,
                autoRamTamer: true,
                cloudTabSyncEnabled: true
              },
              ramMetrics: { totalTabs: 3, discardedCount: 0, tabsDiscardSupported: true }
            }
          : {
              proActive: false,
              subscriptionStatus: 'trial_expired',
              plan: 'trial_7d',
              trialStartedAt: startMs,
              trialExpiresAt: expMs,
              stats: { adsSpotted: 10, cookiePromptsDetected: 2 },
              settings: {
                adBlocking: false,
                cookieAutoClose: false,
                trackerProtection: false,
                silentMode: false,
                autoRamTamer: false,
                cloudTabSyncEnabled: false
              },
              ramMetrics: { totalTabs: 3, discardedCount: 0, tabsDiscardSupported: true }
            }
    });
    assert.equal(popLive.bodyEl.classList.contains('pro-mode'), true);
    assert.equal(popLive.settingSwitches.every((sw) => !sw.classList.contains('pro-lock')), true);

    const getDashBefore = popLive.sentMessages.filter((m) => m.type === 'GET_DASHBOARD_STATE').length;
    popLive.setNow(expMs + 1000);
    popLive.tickIntervals();
    const getDashAfter = popLive.sentMessages.filter((m) => m.type === 'GET_DASHBOARD_STATE').length;
    assert.ok(getDashAfter > getDashBefore, 'trialCountdownInterval must trigger GET_DASHBOARD_STATE on live expiry');
    assert.equal(popLive.bodyEl.classList.contains('unactivated-mode'), true);
    assert.equal(popLive.byId.get('tierBadge').textContent, 'Trial Expired');
    assert.equal(
      popLive.settingSwitches.every((sw) => sw.classList.contains('pro-lock') && sw.textContent === 'PRO'),
      true,
      'Engine switches must lock immediately on live trial expiry'
    );
    popLive.byId.get('keepSiteAwakeBtn').click();
    assert.equal(
      popLive.sentMessages.some((m) => m.type === 'TOGGLE_NEVER_SNOOZE_SITE'),
      false,
      'keepSiteAwakeBtn must NOT send TOGGLE_NEVER_SNOOZE_SITE after live trial expiry'
    );

    // 7c. deepblock-content.js: Shadow-DOM CMP host after 650+ divs, disabled CMP button skipping, whitespace aria-label, and dsPaused sync
    const contentSrc = fs.readFileSync(path.join(ROOT, 'extension/content/deepblock-content.js'), 'utf8');
    const stealthSrc = fs.readFileSync(path.join(ROOT, 'extension/content/deepstealth-main.js'), 'utf8');

    function runDeepDomProbe({ lightElements, querySelectorHandler, onReady }) {
      const dispatched = [];
      const docEl = makeFakeElement({ tagName: 'HTML', style: { overflow: 'hidden' } });
      const bodyEl = makeFakeElement({ tagName: 'BODY', style: { overflow: 'hidden', position: 'fixed' } });
      const docMock = {
        readyState: 'complete',
        documentElement: docEl,
        head: makeFakeElement({ tagName: 'HEAD' }),
        body: bodyEl,
        getElementById: () => null,
        createElement: (tag) => makeFakeElement({ tagName: tag }),
        querySelector: (sel) => (querySelectorHandler ? querySelectorHandler(sel) : null),
        querySelectorAll: (sel) => (sel === '*' ? lightElements : []),
        addEventListener() {}
      };
      const winListeners = new Map();
      const sandbox = {
        location: { hostname: 'example.com', href: 'https://example.com/', protocol: 'https:' },
        chrome: {
          storage: {
            local: {
              get: (_k, cb) =>
                cb({
                  proActive: true,
                  subscriptionStatus: 'trialing',
                  plan: 'trial_7d',
                  trialExpiresAt: Date.now() + DAY_MS,
                  settings: { adBlocking: true, cookieAutoClose: true }
                }),
              set() {}
            },
            onChanged: { addListener() {} }
          },
          runtime: { id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc', onMessage: { addListener() {} }, sendMessage() {} }
        },
        navigator: { userAgent: 'Mozilla/5.0 Chrome/131.0' },
        getComputedStyle: (el) => el.style || {},
        document: docMock,
        window: {
          top: null,
          self: null,
          addEventListener: (t, fn) => {
            if (!winListeners.has(t)) winListeners.set(t, []);
            winListeners.get(t).push(fn);
          },
          dispatchEvent: (ev) => {
            dispatched.push(ev);
            for (const fn of winListeners.get(ev.type) || []) fn(ev);
          }
        },
        MutationObserver: class {
          observe() {}
          disconnect() {}
        },
        CustomEvent: class {
          constructor(t, d) {
            this.type = t;
            this.detail = d?.detail;
          }
        },
        Event: class {
          constructor(t) {
            this.type = t;
          }
        },
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
        console
      };
      sandbox.window.top = sandbox.window;
      sandbox.window.self = sandbox.window;
      if (onReady) onReady(sandbox);
      vm.runInNewContext(contentSrc, sandbox, { filename: 'deepblock-content.js' });
      return { docEl, bodyEl, dispatched, sandbox };
    }

    // Case 1: 650 light-DOM divs before Shadow-DOM host containing #onetrust-banner-sdk + #onetrust-reject-all-handler
    const fillerDivs = Array.from({ length: 650 }, () => makeFakeElement({ tagName: 'DIV' }));
    const deepRejectBtn = makeFakeElement({ id: 'onetrust-reject-all-handler', tagName: 'BUTTON', textContent: 'Reject All' });
    const deepBanner = makeFakeElement({ id: 'onetrust-banner-sdk', tagName: 'DIV' });
    deepBanner.querySelectorAll = (sel) => (sel.includes('#onetrust-reject-all-handler') ? [deepRejectBtn] : []);
    const shadowHost = makeFakeElement({ tagName: 'APP-CONSENT-SHELL' });
    shadowHost.shadowRoot = {
      querySelector: (sel) => (sel.includes('#onetrust-banner-sdk') ? deepBanner : null),
      querySelectorAll: (sel) => {
        if (sel === '*') return [deepBanner, deepRejectBtn];
        if (sel.includes('#onetrust-banner-sdk')) return [deepBanner];
        if (sel.includes('#onetrust-reject-all-handler')) return [deepRejectBtn];
        return [];
      }
    };
    const deepRes = runDeepDomProbe({ lightElements: [...fillerDivs, shadowHost] });
    assert.equal(deepRejectBtn._clicked, 1, 'Shadow-DOM CMP host after 650+ nodes must be found and clicked');
    assert.equal(deepRes.docEl.dataset.dsPaused, '0');

    // Case 2: Disabled #onetrust-reject-all-handler (disabled & aria-disabled="true") skipped; enabled fallback clicked
    const disabledBtn1 = makeFakeElement({
      id: 'onetrust-reject-all-handler',
      tagName: 'BUTTON',
      textContent: 'Reject All',
      attrs: { disabled: '' }
    });
    disabledBtn1.disabled = true;
    const disabledBtn2 = makeFakeElement({
      id: 'onetrust-reject-all-handler',
      tagName: 'BUTTON',
      textContent: 'Reject All',
      attrs: { 'aria-disabled': 'true' }
    });
    const enabledFallback = makeFakeElement({ tagName: 'BUTTON', textContent: 'Necessary Only' });
    const otBanner = makeFakeElement({ id: 'onetrust-banner-sdk', tagName: 'DIV' });
    otBanner.querySelectorAll = (sel) => {
      if (sel.includes('#onetrust-reject-all-handler')) return [disabledBtn1, disabledBtn2];
      if (sel.includes('button')) return [disabledBtn1, disabledBtn2, enabledFallback];
      return [];
    };
    runDeepDomProbe({
      lightElements: [otBanner],
      querySelectorHandler: (sel) => (sel.includes('#onetrust-banner-sdk') ? otBanner : null)
    });
    assert.equal(disabledBtn1._clicked || 0, 0, 'disabled CMP-selector button must NOT be clicked');
    assert.equal(disabledBtn2._clicked || 0, 0, 'aria-disabled="true" CMP-selector button must NOT be clicked');
    assert.equal(enabledFallback._clicked, 1, 'Enabled fallback button must be clicked when CMP-selector button is disabled');

    // Case 3: Whitespace textContent masking aria-label="Rifiuta tutto"
    const wsAriaBtn = makeFakeElement({
      tagName: 'BUTTON',
      textContent: '\n  \t \n',
      attrs: { 'aria-label': 'Rifiuta tutto' }
    });
    const itBanner = makeFakeElement({ id: 'didomi-host', tagName: 'DIV' });
    itBanner.querySelectorAll = (sel) => (sel.includes('button') ? [wsAriaBtn] : []);
    runDeepDomProbe({
      lightElements: [itBanner],
      querySelectorHandler: (sel) => (sel.includes('#didomi-host') ? itBanner : null)
    });
    assert.equal(wsAriaBtn._clicked, 1, 'aria-label button with whitespace-only textContent must match and click');

    // Case 4: deepstealth-main.js respects documentElement.dataset.dsPaused even when CustomEvent.detail is stripped (null)
    const stealthDocEl = makeFakeElement({ tagName: 'HTML' });
    stealthDocEl.dataset.dsPaused = '1';
    class FakeXHR {
      open() {}
      send() {}
    }
    class FakeEventTarget {
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() {
        return true;
      }
    }
    class FakeNode extends FakeEventTarget {}
    class FakeElement extends FakeNode {}
    class FakeHTMLElement extends FakeElement {}
    class FakeDocument extends FakeNode {
      createElement() {
        return makeFakeElement({ tagName: 'DIV' });
      }
    }
    class FakeEvent {
      constructor(t) {
        this.type = t;
      }
    }
    class FakeResponse {}
    const stealthWinListeners = new Map();
    const stealthWin = {
      location: { hostname: 'www.youtube.com', origin: 'https://www.youtube.com' },
      addEventListener: (t, fn) => {
        if (!stealthWinListeners.has(t)) stealthWinListeners.set(t, []);
        stealthWinListeners.get(t).push(fn);
      },
      dispatchEvent: (ev) => {
        for (const fn of stealthWinListeners.get(ev.type) || []) fn(ev);
      },
      fetch: async () => ({ ok: true }),
      open: () => ({ closed: false }),
      XMLHttpRequest: FakeXHR
    };
    const stealthDoc = new FakeDocument();
    stealthDoc.documentElement = stealthDocEl;
    const stealthSandbox = {
      window: stealthWin,
      location: stealthWin.location,
      XMLHttpRequest: FakeXHR,
      fetch: stealthWin.fetch,
      document: stealthDoc,
      EventTarget: FakeEventTarget,
      Node: FakeNode,
      Element: FakeElement,
      HTMLElement: FakeHTMLElement,
      HTMLScriptElement: class extends FakeHTMLElement {},
      HTMLImageElement: class extends FakeHTMLElement {},
      HTMLAnchorElement: class extends FakeHTMLElement {},
      HTMLIFrameElement: class extends FakeHTMLElement {},
      Document: FakeDocument,
      HTMLDocument: FakeDocument,
      Event: FakeEvent,
      MouseEvent: class extends FakeEvent {},
      Response: FakeResponse,
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
      setTimeout,
      clearTimeout,
      URL,
      JSON,
      Object,
      Symbol,
      Function,
      WeakMap,
      Map,
      Set,
      Promise,
      console
    };
    stealthWin.window = stealthWin;
    stealthWin.top = stealthWin;
    stealthWin.self = stealthWin;
    stealthSandbox.self = stealthWin;
    stealthSandbox.globalThis = stealthSandbox;
    vm.runInNewContext(stealthSrc, stealthSandbox, { filename: 'deepstealth-main.js' });
    // Even if CustomEvent.detail is stripped to null across ISOLATED->MAIN world, dataset.dsPaused === '1' pauses stealth
    stealthWin.dispatchEvent({ type: '_ds_cfg', detail: null });
    const parsedPaused = stealthSandbox.JSON.parse('{"adPlacements":[{"x":1}]}');
    assert.equal(Array.isArray(parsedPaused.adPlacements), true, 'deepstealth-main must not strip ads when dataset.dsPaused === "1"');
    // When active again (dsPaused === '0'), adPlacements are stripped
    stealthDocEl.dataset.dsPaused = '0';
    const parsedActive = stealthSandbox.JSON.parse('{"adPlacements":[{"x":1}]}');
    assert.equal(parsedActive.adPlacements.length, 0, 'deepstealth-main must resume stripping when dataset.dsPaused === "0"');
  });

  test('8. Regression tests (F4.B4): enforceStoredSubscriptionIntegrity and storage.onChanged reject tampered trial storage without minting keys', async () => {
    const startMs = Date.UTC(2026, 10, 25, 12, 0, 0);

    // 8a. enforceStoredSubscriptionIntegrity rejects empty licenseKey + 365d expiry without minting SWEEPR-TRIAL-*
    const hEmptyKey = createBackgroundHarness({
      initialNowMs: startMs,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialExpiresAt: startMs + 365 * DAY_MS,
        licenseKey: ''
      }
    });
    const resEmpty = await hEmptyKey.ctx.enforceStoredSubscriptionIntegrity({ force: true });
    assert.equal(resEmpty.proActive, false);
    const authEmpty = await hEmptyKey.ctx.ensureVerifiedProSession();
    assert.equal(authEmpty.proActive, false);
    assert.equal(hEmptyKey.localStore.proActive, false);
    assert.equal(hEmptyKey.localStore.licenseKey, '', 'Must NOT mint a SWEEPR-TRIAL-* key on tampered storage');
    assert.equal(hEmptyKey.enabledRulesets.size, 0, 'Must disable all 5 static rulesets');
    assert.equal(hEmptyKey.registeredScripts.has('deepstealth-main'), false);

    // 8b. enforceStoredSubscriptionIntegrity rejects malformed key + 365d duration, valid-syntax key + 365d duration, future trialStartedAt, and mismatched licenseExpiresAt
    const tamperPayloads = [
      {
        label: 'malformed key + 365d',
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 365 * DAY_MS,
        licenseKey: 'SWEEPR-TRIAL-FAKE-1234'
      },
      {
        label: 'valid-syntax key + 365d duration',
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 365 * DAY_MS,
        licenseKey: 'SWEEPR-TRIAL-FAKE-1234-5678'
      },
      {
        label: 'future-dated trialStartedAt',
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs + 30 * DAY_MS,
        trialExpiresAt: startMs + 37 * DAY_MS,
        licenseKey: 'SWEEPR-TRIAL-FAKE-1234-5678'
      },
      {
        label: 'mismatched licenseExpiresAt',
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 7 * DAY_MS,
        licenseExpiresAt: startMs + 365 * DAY_MS,
        licenseKey: 'SWEEPR-TRIAL-FAKE-1234-5678'
      }
    ];

    for (const payload of tamperPayloads) {
      const h = createBackgroundHarness({ initialNowMs: startMs, initialLocal: payload });
      const res = await h.ctx.enforceStoredSubscriptionIntegrity({ force: true });
      assert.equal(res.proActive, false, `${payload.label}: must reject tampered trial`);
      const dash = await h.sendPopupMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(dash.proActive, false, `${payload.label}: dashboard must report proActive=false`);
      assert.equal(h.localStore.proActive, false, `${payload.label}: stored proActive must be false`);
      assert.equal(h.localStore.licenseKey, '', `${payload.label}: tampered key must be cleared`);
      assert.equal(h.enabledRulesets.size, 0, `${payload.label}: all 5 rulesets must be disabled`);
      assert.equal(h.registeredScripts.has('deepstealth-main'), false);
    }

    // 8c. chrome.storage.onChanged rejects both tampering payloads (even with fresh licenseVerifiedAt) and revokes active session tampering
    const hChanged = createBackgroundHarness({ initialNowMs: startMs });
    await hChanged.ctx.enforceStoredSubscriptionIntegrity();
    assert.equal((await hChanged.ctx.ensureVerifiedProSession()).proActive, false);

    // Payload 1 via storage.onChanged: empty licenseKey + 365d expiry
    await hChanged.ctx.chrome.storage.local.set({
      proActive: true,
      ramTamerActive: true,
      subscriptionStatus: 'trialing',
      plan: 'trial_7d',
      trialExpiresAt: startMs + 365 * DAY_MS,
      licenseKey: '',
      licenseVerifiedAt: startMs
    });
    await new Promise((r) => setTimeout(r, 25));
    assert.equal((await hChanged.ctx.ensureVerifiedProSession()).proActive, false);
    assert.equal(hChanged.localStore.proActive, false);
    assert.equal(hChanged.localStore.licenseKey, '');
    assert.equal(hChanged.enabledRulesets.size, 0);

    // Payload 2 via storage.onChanged: fake key + trialStartedAt + 365d expiry + fresh licenseVerifiedAt
    await hChanged.ctx.chrome.storage.local.set({
      proActive: true,
      ramTamerActive: true,
      subscriptionStatus: 'trialing',
      plan: 'trial_7d',
      trialStartedAt: startMs,
      trialExpiresAt: startMs + 365 * DAY_MS,
      licenseKey: 'SWEEPR-TRIAL-FAKE-1234',
      licenseVerifiedAt: startMs
    });
    await new Promise((r) => setTimeout(r, 25));
    assert.equal((await hChanged.ctx.ensureVerifiedProSession()).proActive, false);
    assert.equal(hChanged.localStore.proActive, false);
    assert.equal(hChanged.localStore.licenseKey, '');
    assert.equal(hChanged.enabledRulesets.size, 0);

    // Payload 3 via storage.onChanged: extending trialExpiresAt on an already-active trial revokes it immediately
    const hActiveExtend = createBackgroundHarness({ initialNowMs: startMs });
    await hActiveExtend.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of hActiveExtend.listeners.onInstalled) await fn({ reason: 'install' });
    assert.equal((await hActiveExtend.ctx.ensureVerifiedProSession()).proActive, true);
    assert.equal(hActiveExtend.enabledRulesets.size, 5);

    await hActiveExtend.ctx.chrome.storage.local.set({
      trialExpiresAt: startMs + 365 * DAY_MS
    });
    await new Promise((r) => setTimeout(r, 25));
    assert.equal((await hActiveExtend.ctx.ensureVerifiedProSession()).proActive, false);
    assert.equal(hActiveExtend.localStore.proActive, false);
    assert.equal(hActiveExtend.enabledRulesets.size, 0);
  });

  test('9. Regression tests (F4.B4): SWEEPR-TRIAL-* keys cannot unlock referral_trial_14d or active/paid plans, while genuine REDEEM_REFERRAL_CODE and 7d trial remain intact', async () => {
    const startMs = Date.UTC(2026, 10, 25, 12, 0, 0);
    const onlineMockFetch = async (url) => {
      if (url.includes('/api/license-verify')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ valid: true, status: 'active', plan: 'annual', licenseKey: 'SWEEPR-DB-FAKE-0000-0000' })
        };
      }
      return { ok: false, status: 404, json: async () => ({ ok: false }) };
    };

    // 9a. SWEEPR-TRIAL-* claiming plan: 'referral_trial_14d' rejected by storage.onChanged (online) and enforceStoredSubscriptionIntegrity (force: false & true)
    const refTamperPayload = {
      proActive: true,
      ramTamerActive: true,
      subscriptionStatus: 'trialing',
      plan: 'referral_trial_14d',
      trialStartedAt: 0,
      trialExpiresAt: startMs + 14 * DAY_MS,
      licenseKey: 'SWEEPR-TRIAL-AAAA-BBBB-CCCC',
      licenseVerifiedAt: startMs
    };

    const hRefChanged = createBackgroundHarness({ initialNowMs: startMs, fetchHandler: onlineMockFetch });
    await hRefChanged.ctx.enforceStoredSubscriptionIntegrity();
    await hRefChanged.ctx.chrome.storage.local.set(refTamperPayload);
    await new Promise((r) => setTimeout(r, 25));
    assert.equal((await hRefChanged.ctx.ensureVerifiedProSession()).proActive, false, 'onChanged must reject SWEEPR-TRIAL-* claiming referral_trial_14d');
    assert.equal(hRefChanged.localStore.proActive, false);
    assert.equal(hRefChanged.localStore.licenseKey, '');
    assert.equal(hRefChanged.enabledRulesets.size, 0);
    assert.equal(hRefChanged.registeredScripts.has('deepstealth-main'), false);

    for (const forceFlag of [false, true]) {
      const hRefCold = createBackgroundHarness({
        initialNowMs: startMs,
        initialLocal: { ...refTamperPayload },
        fetchHandler: onlineMockFetch
      });
      const res = await hRefCold.ctx.enforceStoredSubscriptionIntegrity({ force: forceFlag });
      assert.equal(res.proActive, false, `enforceStoredSubscriptionIntegrity(force=${forceFlag}) must reject SWEEPR-TRIAL-* claiming referral_trial_14d`);
      assert.equal(hRefCold.localStore.proActive, false);
      assert.equal(hRefCold.localStore.licenseKey, '');
      assert.equal(hRefCold.enabledRulesets.size, 0);
      assert.equal(hRefCold.registeredScripts.has('deepstealth-main'), false);
    }

    // 9b. Preserved SWEEPR-TRIAL-* after genuine 7-day local trial expiry claiming plan: 'annual', subscriptionStatus: 'active'
    const hExpired = createBackgroundHarness({ initialNowMs: startMs });
    await hExpired.ctx.enforceStoredSubscriptionIntegrity();
    for (const fn of hExpired.listeners.onInstalled) await fn({ reason: 'install' });
    const preservedTrialKey = hExpired.localStore.licenseKey;
    assert.match(preservedTrialKey, /^SWEEPR-TRIAL-/);
    assert.equal(hExpired.localStore.proActive, true);
    assert.equal(hExpired.enabledRulesets.size, 5);
    assert.equal(hExpired.registeredScripts.has('deepstealth-main'), true);

    const expNow = startMs + 7 * DAY_MS + 1000;
    hExpired.setNow(expNow);
    await hExpired.ctx.enforceStoredSubscriptionIntegrity({ force: true });
    assert.equal(hExpired.localStore.proActive, false);
    assert.equal(hExpired.localStore.subscriptionStatus, 'trial_expired');
    assert.equal(hExpired.localStore.licenseKey, preservedTrialKey);
    assert.equal(hExpired.enabledRulesets.size, 0);
    assert.equal(hExpired.registeredScripts.has('deepstealth-main'), false);

    const paidTamperPayload = {
      proActive: true,
      ramTamerActive: true,
      subscriptionStatus: 'active',
      plan: 'annual',
      licenseKey: preservedTrialKey,
      licenseVerifiedAt: expNow
    };
    await hExpired.ctx.chrome.storage.local.set(paidTamperPayload);
    await new Promise((r) => setTimeout(r, 25));
    assert.equal((await hExpired.ctx.ensureVerifiedProSession()).proActive, false, 'onChanged must reject preserved SWEEPR-TRIAL-* claiming active/annual');
    assert.equal(hExpired.localStore.proActive, false);
    assert.equal(hExpired.localStore.licenseKey, '');
    assert.equal(hExpired.enabledRulesets.size, 0);
    assert.equal(hExpired.registeredScripts.has('deepstealth-main'), false);

    for (const forceFlag of [false, true]) {
      const hPaidCold = createBackgroundHarness({
        initialNowMs: expNow,
        initialLocal: {
          ...paidTamperPayload,
          trialStartedAt: startMs,
          trialExpiresAt: startMs + 7 * DAY_MS,
          licenseExpiresAt: startMs + 7 * DAY_MS
        }
      });
      const res = await hPaidCold.ctx.enforceStoredSubscriptionIntegrity({ force: forceFlag });
      assert.equal(res.proActive, false, `enforceStoredSubscriptionIntegrity(force=${forceFlag}) must reject SWEEPR-TRIAL-* claiming active/annual`);
      assert.equal(hPaidCold.localStore.proActive, false);
      assert.equal(hPaidCold.localStore.licenseKey, '');
      assert.equal(hPaidCold.enabledRulesets.size, 0);
      assert.equal(hPaidCold.registeredScripts.has('deepstealth-main'), false);
    }

    // 9c. Genuine REDEEM_REFERRAL_CODE (server SWEEPR-DB-* 14-day referral trial) works even after an expired local 7-day trial
    const refNow = expNow + 1000;
    const refKey = 'SWEEPR-DB-REF1-AAAA-BBBB';
    const refExpIso = new Date(refNow + 14 * DAY_MS).toISOString();
    const hRefValid = createBackgroundHarness({
      initialNowMs: refNow,
      initialLocal: {
        proActive: false,
        ramTamerActive: false,
        subscriptionStatus: 'trial_expired',
        plan: 'trial_7d',
        trialStartedAt: startMs,
        trialExpiresAt: startMs + 7 * DAY_MS,
        licenseKey: preservedTrialKey
      },
      fetchHandler: async (url) => {
        if (url.includes('/api/referral/redeem')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, trialKey: refKey, trialExpiresAt: refExpIso })
          };
        }
        if (url.includes('/api/license-verify')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              status: 'trialing',
              plan: 'referral_trial_14d',
              licenseKey: refKey,
              expiresAt: refExpIso
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });
    await hRefValid.ctx.enforceStoredSubscriptionIntegrity();
    const redeemRes = await hRefValid.sendPopupMessage({ type: 'REDEEM_REFERRAL_CODE', code: 'FRIEND14' });
    assert.equal(redeemRes.ok, true);
    assert.equal(redeemRes.valid, true);
    assert.equal(hRefValid.localStore.proActive, true);
    assert.equal(hRefValid.localStore.plan, 'referral_trial_14d');
    assert.equal(hRefValid.localStore.licenseKey, refKey);
    assert.equal(hRefValid.enabledRulesets.size, 5);
    assert.equal(hRefValid.registeredScripts.has('deepstealth-main'), true);

    const refCheck = await hRefValid.ctx.enforceStoredSubscriptionIntegrity({ force: true });
    assert.equal(refCheck.proActive, true, 'Genuine SWEEPR-DB-* referral_trial_14d must survive enforceStoredSubscriptionIntegrity({ force: true })');
    assert.equal(hRefValid.enabledRulesets.size, 5);
  });
});
