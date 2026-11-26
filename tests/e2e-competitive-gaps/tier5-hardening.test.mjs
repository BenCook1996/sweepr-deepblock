import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ROOT,
  WEBSITE_DIR,
  DIST_DIR,
  EXTENSION_DIR,
  SAFARI_DIR,
  SCRIPTS_DIR,
  PRE_EXISTING_WORKSPACE_PATHS,
  EXPECTED_SETUP_EXE_SHA256,
  startEphemeralServer,
  readExtensionManifest,
  readZipEntries,
  extractVisibleText,
  computeCompiledStaticDnrRules,
  getIndexableVsPaths,
  resolveWebsiteHtmlPath,
  inspectCmpCoverage,
  extractClaimedCmpCounts,
  openCrmReadOnly,
  createBackgroundVmHarness
} from './helpers.mjs';
import { launchHeadlessBrowser } from '../e2e-helpers.mjs';
import {
  evaluateDnrRulesForRequest,
  GOLDEN_NETWORK_CANARIES,
  PROTECTED_LEGITIMATE_NETWORK_CANARIES
} from '../../scripts/ad-filter-pipeline/regression-guard.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Tier 5 — White-Box Adversarial Hardening (R2, R3, R4)', () => {
  test('T5.1 (GAP-01): Entering invalid or SWEEPR-TRIAL-* key in ACTIVATE_LICENSE does NOT revoke an active trial or paid subscription', async () => {
    const startMs = Date.UTC(2026, 10, 25, 10, 0, 0);
    const hTrial = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await hTrial.triggerInstall('install');
      const before = await hTrial.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(before.proActive, true);
      assert.equal(before.subscriptionStatus, 'trialing');

      for (const badInput of ['INVALID-KEY', before.licenseKey]) {
        const res = await hTrial.sendPrivilegedMessage({ type: 'ACTIVATE_LICENSE', licenseKey: badInput });
        assert.equal(res.valid, false);
        const after = await hTrial.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
        assert.equal(after.proActive, true, `Active trial must survive invalid/trial input "${badInput}"`);
        assert.equal(after.subscriptionStatus, 'trialing');
        assert.equal(hTrial.getEnabledRulesets().length, 5);
      }
    } finally {
      hTrial.cleanup();
    }

    const paidKey = 'SWEEPR-DB-PAID-2026-5555';
    const hPaid = createBackgroundVmHarness({
      nowMs: startMs,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        licenseKey: paidKey,
        subscriptionStatus: 'active',
        plan: 'annual',
        licenseVerifiedAt: startMs
      },
      fetchHandler: async (url) => {
        if (url.includes('/api/license-verify') && url.includes(paidKey)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valid: true,
              status: 'active',
              plan: 'annual',
              licenseKey: paidKey,
              expiresAt: '2027-11-25T10:00:00.000Z'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });
    try {
      const res = await hPaid.sendPrivilegedMessage({ type: 'ACTIVATE_LICENSE', licenseKey: 'TYPO' });
      assert.equal(res.valid, false);
      const after = await hPaid.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(after.proActive, true, 'Active paid subscription must survive typo in ACTIVATE_LICENSE');
      assert.equal(after.subscriptionStatus, 'active');
    } finally {
      hPaid.cleanup();
    }
  });

  test('T5.2 (GAP-02): DevTools storage.local spoof & cold-start SWEEPR-DB-* + fresh licenseVerifiedAt trigger server verification and reject invalid/403 keys', async () => {
    const startMs = Date.UTC(2026, 10, 1, 12, 0, 0);
    const h = createBackgroundVmHarness({
      nowMs: startMs,
      fetchHandler: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ valid: false, status: 'subscription_inactive' })
      })
    });
    try {
      await h.triggerInstall('install');
      h.setNow(startMs + 8 * DAY_MS);
      await h.triggerAlarm('trialExpiryCheck');
      assert.equal((await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' })).proActive, false);

      await h.ctx.chrome.storage.local.set({
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'active',
        plan: 'annual',
        licenseKey: 'SWEEPR-DB-FAKE-1234-5678',
        licenseVerifiedAt: h.getNow(),
        settings: { adBlocking: true, trackerProtection: true, cookieAutoClose: true }
      });
      await new Promise((r) => setTimeout(r, 60));

      const after = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(after.proActive, false, 'Unverified storage spoof of SWEEPR-DB-* must not unlock Pro');
      assert.deepEqual(h.getEnabledRulesets(), []);
    } finally {
      h.cleanup();
    }

    // Cold-start spoofed paid key with fresh licenseVerifiedAt must verify against server and reject on 401/403
    const hCold = createBackgroundVmHarness({
      nowMs: startMs,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'active',
        plan: 'annual',
        licenseKey: 'SWEEPR-DB-FAKE-9999-8888',
        licenseVerifiedAt: startMs - 60000
      },
      fetchHandler: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ valid: false, error: 'unauthorized' })
      })
    });
    try {
      const coldRes = await hCold.ctx.enforceStoredSubscriptionIntegrity({ force: false });
      assert.equal(coldRes.proActive, false, 'Cold-start spoofed SWEEPR-DB-* must not bypass server verification');
      assert.equal(hCold.localStore.proActive, false);
      assert.deepEqual(hCold.getEnabledRulesets(), []);
    } finally {
      hCold.cleanup();
    }

    // Spoofed referral_trial_14d with trialStartedAt <= 0 must be rejected even with fresh licenseVerifiedAt
    const hRefZero = createBackgroundVmHarness({
      nowMs: startMs,
      offline: true,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'trialing',
        plan: 'referral_trial_14d',
        trialStartedAt: 0,
        trialExpiresAt: startMs + 14 * DAY_MS,
        licenseKey: 'SWEEPR-DB-FAKE-REF1-0000',
        licenseVerifiedAt: startMs - 60000
      }
    });
    try {
      const refRes = await hRefZero.ctx.enforceStoredSubscriptionIntegrity({ force: false });
      assert.equal(refRes.proActive, false, 'referral_trial_14d with trialStartedAt <= 0 must be rejected');
      assert.equal(hRefZero.localStore.proActive, false);
      assert.deepEqual(hRefZero.getEnabledRulesets(), []);
    } finally {
      hRefZero.cleanup();
    }
  });

  test('T5.3 (GAP-03): Clock rollback before licenseVerifiedAt cannot extend offline grace or 7-day trial', async () => {
    const startMs = Date.UTC(2026, 10, 10, 12, 0, 0);

    // Paid offline grace rollback (now = licenseVerifiedAt - 30d)
    const hPaid = createBackgroundVmHarness({
      nowMs: startMs - 30 * DAY_MS,
      offline: true,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        licenseKey: 'SWEEPR-DB-PAID-2026-1111',
        subscriptionStatus: 'active',
        plan: 'annual',
        licenseVerifiedAt: startMs
      }
    });
    try {
      const res = await hPaid.ctx.enforceStoredSubscriptionIntegrity({ force: true });
      assert.equal(res.proActive, false, 'Negative clock delta from licenseVerifiedAt must not grant offline grace');
    } finally {
      hPaid.cleanup();
    }

    // 7-day trial rollback (last verified on Day 6, clock rolled back to Day 2)
    const trialStart = Date.UTC(2026, 10, 1, 12, 0, 0);
    const hTrial = createBackgroundVmHarness({
      nowMs: trialStart + 2 * DAY_MS,
      offline: true,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        licenseKey: 'SWEEPR-TRIAL-AAAA-BBBB-CCCC',
        subscriptionStatus: 'trialing',
        plan: 'trial_7d',
        trialStartedAt: trialStart,
        trialExpiresAt: trialStart + 7 * DAY_MS,
        licenseExpiresAt: trialStart + 7 * DAY_MS,
        licenseVerifiedAt: trialStart + 6 * DAY_MS
      }
    });
    try {
      const res = await hTrial.ctx.enforceStoredSubscriptionIntegrity({ force: true });
      assert.equal(res.proActive, false, 'Trial clock rollback before licenseVerifiedAt must be rejected');
      assert.deepEqual(hTrial.getEnabledRulesets(), []);
    } finally {
      hTrial.cleanup();
    }
  });

  test('T5.4 (GAP-05 & GAP-07): Expired offline grace syncs chrome.storage.local.proActive=false and gates checkAndClosePopunderTab', async () => {
    const startMs = Date.UTC(2026, 10, 1, 12, 0, 0);
    let removedTabId = null;
    const h = createBackgroundVmHarness({
      nowMs: startMs + 10 * DAY_MS,
      offline: true,
      initialLocal: {
        proActive: true,
        ramTamerActive: true,
        subscriptionStatus: 'active',
        plan: 'annual',
        licenseKey: 'SWEEPR-DB-PAID-2026-2222',
        licenseVerifiedAt: startMs,
        settings: { adBlocking: true, cookieAutoClose: true, trackerProtection: true }
      }
    });
    try {
      h.ctx.chrome.tabs.remove = async (id) => {
        removedTabId = id;
      };
      const res = await h.ctx.enforceStoredSubscriptionIntegrity({ force: false });
      assert.equal(res.proActive, false);
      assert.equal(h.localStore.proActive, false, 'chrome.storage.local.proActive must sync to false when offline grace expires');
      assert.deepEqual(h.getEnabledRulesets(), []);

      const closed = await h.ctx.checkAndClosePopunderTab(99, 'https://popads.net/pop', null);
      assert.equal(closed, false, 'checkAndClosePopunderTab must stay gated when proActive is false');
      assert.equal(removedTabId, null);
    } finally {
      h.cleanup();
    }
  });

  test('T5.5 (GAP-06 & GAP-08): deepblock-content.js MutationObserver stops at trialExpiresAt and deepstealth-main.js skips canary globals when dsPaused=1', async () => {
    const contentSrc = fs.readFileSync(path.join(EXTENSION_DIR, 'content/deepblock-content.js'), 'utf8');
    let fakeNow = Date.UTC(2026, 10, 1, 12, 0, 0);
    const expMs = fakeNow + 50;
    class FakeDate extends Date {
      constructor(...a) {
        super(...(a.length === 0 ? [fakeNow] : a));
      }
      static now() {
        return fakeNow;
      }
    }
    let mutationCb = null;
    const elements = [];
    const docEl = { dataset: {}, style: { setProperty() {} }, classList: { remove() {} } };
    const bodyEl = {
      dataset: {},
      style: { overflow: 'hidden', setProperty(p, v) { this[p] = v; } },
      classList: { remove() {} }
    };
    const sandbox = {
      Date: FakeDate,
      location: { hostname: 'example.com', href: 'https://example.com/', protocol: 'https:' },
      chrome: {
        storage: {
          local: {
            get: (_k, cb) =>
              cb({
                proActive: true,
                subscriptionStatus: 'trialing',
                plan: 'trial_7d',
                trialExpiresAt: expMs,
                licenseKey: 'SWEEPR-TRIAL-AAAA-BBBB-CCCC',
                pausedSites: [],
                settings: { adBlocking: true, cookieAutoClose: true }
              }),
            set() {}
          },
          onChanged: { addListener() {} }
        },
        runtime: { id: 'ext', onMessage: { addListener() {} }, sendMessage() {} }
      },
      navigator: { userAgent: 'Mozilla/5.0' },
      getComputedStyle: (el) => el.style || {},
      document: {
        readyState: 'complete',
        documentElement: docEl,
        head: { appendChild() {} },
        body: bodyEl,
        getElementById: () => null,
        createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {} }),
        querySelector: (sel) => (sel.includes('#onetrust-banner-sdk') ? elements[0] || null : null),
        querySelectorAll: () => [],
        addEventListener() {}
      },
      window: { top: null, self: null, addEventListener() {}, dispatchEvent() {} },
      MutationObserver: class {
        constructor(cb) {
          mutationCb = cb;
        }
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
    vm.runInNewContext(contentSrc, sandbox, { filename: 'deepblock-content.js' });

    fakeNow = expMs + 5000;
    const rejectBtn = {
      tagName: 'BUTTON',
      textContent: 'Reject All',
      disabled: false,
      getAttribute: () => null,
      clicked: false,
      click() {
        this.clicked = true;
      }
    };
    elements.push({
      id: 'onetrust-banner-sdk',
      dataset: {},
      shadowRoot: null,
      querySelectorAll: (sel) => (sel.includes('#onetrust-reject-all-handler') || sel.includes('button') ? [rejectBtn] : []),
      querySelector: () => null
    });
    if (mutationCb) mutationCb([]);
    await new Promise((r) => setTimeout(r, 250));

    assert.equal(rejectBtn.clicked, false, 'MutationObserver must stop clicking CMP reject after trialExpiresAt');

    // GAP-08: deepstealth-main.js with dsPaused='1' must NOT define window.canRunAds / popMagic / adsbygoogle
    const stealthSrc = fs.readFileSync(path.join(EXTENSION_DIR, 'content/deepstealth-main.js'), 'utf8');
    const stealthWin = {
      location: { hostname: 'example.com', href: 'https://example.com/', origin: 'https://example.com' },
      addEventListener() {},
      dispatchEvent() {},
      localStorage: { removeItem() {} }
    };
    const stealthCtx = {
      window: stealthWin,
      self: stealthWin,
      location: stealthWin.location,
      localStorage: stealthWin.localStorage,
      document: {
        documentElement: { dataset: { dsPaused: '1' } },
        cookie: '',
        createElement: () => ({}),
        addEventListener() {}
      },
      HTMLElement: class {},
      HTMLScriptElement: class {},
      HTMLImageElement: class {},
      HTMLAnchorElement: class {},
      HTMLIFrameElement: class {},
      Document: class {},
      EventTarget: class { addEventListener() {} dispatchEvent() {} },
      Element: class {},
      Node: class {},
      XMLHttpRequest: class { open() {} send() {} },
      Request: class {},
      Response: class {},
      Headers: class {},
      fetch: async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) }),
      getComputedStyle: () => ({}),
      Event: class { constructor(t) { this.type = t; } },
      CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d?.detail; } },
      navigator: { userAgent: 'Mozilla/5.0' },
      Object,
      Function,
      Symbol,
      Proxy,
      WeakMap,
      Map,
      Set,
      Promise,
      JSON,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      console
    };
    stealthWin.window = stealthWin;
    stealthWin.top = stealthWin;
    stealthWin.self = stealthWin;
    vm.runInNewContext(stealthSrc, stealthCtx, { filename: 'deepstealth-main.js' });
    assert.equal(stealthWin.canRunAds, undefined, 'canRunAds must not be defined when dsPaused=1');
    assert.equal(stealthWin.adsbygoogle, undefined, 'adsbygoogle must not be defined when dsPaused=1');
    assert.equal(stealthWin.popMagic, undefined, 'popMagic must not be defined when dsPaused=1');
  });

  test('T5.6 (Area 2): All 160 CMP selectors and UNIVERSAL_AD_COSMETIC_CSS parse cleanly in Chromium with zero CMP hiding', async () => {
    const contentSrc = fs.readFileSync(path.join(EXTENSION_DIR, 'content/deepblock-content.js'), 'utf8');
    const metaCtx = {};
    vm.runInNewContext(contentSrc, metaCtx, { filename: 'deepblock-content.js' });
    const frameworks = metaCtx.__SWEEPR_CMP_REGISTRY__.frameworks;
    assert.equal(frameworks.length, 160);

    const cssMatch = contentSrc.match(/const\s+UNIVERSAL_AD_COSMETIC_CSS\s*=\s*`([\s\S]*?)`;/);
    const universalCss = cssMatch ? cssMatch[1] : '';
    const universalRuleSelectors = universalCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('{')[0]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const allCmpSelectors = frameworks.flatMap((f) => [
      ...f.containers.map((s) => ({ fw: f.id, kind: 'container', s })),
      ...f.rejectButtons.map((s) => ({ fw: f.id, kind: 'reject', s }))
    ]);

    const browser = await launchHeadlessBrowser();
    const page = await browser.newPage();
    try {
      await page.navigateAndAudit('about:blank', 'about:blank');
      const res = await page.evaluate(`(() => {
        const badCmp = [];
        for (const item of ${JSON.stringify(allCmpSelectors)}) {
          try { document.querySelectorAll(item.s); } catch (e) { badCmp.push({ ...item, err: e.message }); }
        }
        const badCosmetic = [];
        for (const s of ${JSON.stringify(universalRuleSelectors)}) {
          try { document.querySelectorAll(s); } catch (e) { badCosmetic.push({ s, err: e.message }); }
        }
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(universalCss)};
        document.head.appendChild(style);
        const hiddenCmp = [];
        for (const item of ${JSON.stringify(allCmpSelectors)}) {
          const mId = item.s.match(/^#([a-zA-Z0-9_-]+)$/);
          const mCls = item.s.match(/^\\.([a-zA-Z0-9_-]+)$/);
          if (!mId && !mCls) continue;
          const el = document.createElement(item.kind === 'reject' ? 'button' : 'div');
          if (mId) el.id = mId[1];
          if (mCls) el.className = mCls[1];
          document.body.appendChild(el);
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') hiddenCmp.push(item);
          el.remove();
        }
        style.remove();
        return { badCmp, badCosmetic, hiddenCmp };
      })()`);
      assert.deepEqual(res.badCmp, []);
      assert.deepEqual(res.badCosmetic, []);
      assert.deepEqual(res.hiddenCmp, []);
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  });

  test('T5.7 (Area 3 & GAP-04): All 36,019 DNR rules pass strict MV3 schema checks and tracker-only mode never blocks SWEEPR GA/GTM', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    assert.equal(compiled.enabledTotalRules, 36019);

    const VALID_TYPES = new Set([
      'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
      'object', 'xmlhttprequest', 'ping', 'csp_report', 'media',
      'websocket', 'webtransport', 'webbundle', 'other'
    ]);
    const warSet = new Set(
      (manifest.web_accessible_resources || []).flatMap((w) => w.resources || []).map((r) => '/' + r.replace(/^\/+/, ''))
    );

    for (const rs of compiled.rulesets) {
      assert.ok(rs.count <= 30000, `${rs.id} exceeds 30,000 rules`);
      for (const r of rs.rules) {
        const c = r.condition || {};
        assert.equal(c.urlFilter !== undefined && c.regexFilter !== undefined, false, `${rs.id}#${r.id} has both urlFilter & regexFilter`);
        assert.equal(Boolean(c.initiatorDomains && c.excludedInitiatorDomains), false, `${rs.id}#${r.id} has both initiatorDomains & excludedInitiatorDomains`);
        assert.equal(Boolean(c.requestDomains && c.excludedRequestDomains), false, `${rs.id}#${r.id} has both requestDomains & excludedRequestDomains`);
        for (const rt of c.resourceTypes || []) assert.ok(VALID_TYPES.has(rt), `${rs.id}#${r.id} invalid resourceType ${rt}`);
        if (c.urlFilter !== undefined) assert.match(c.urlFilter, /^[\x20-\x7E]+$/, `${rs.id}#${r.id} non-ASCII urlFilter`);
        if (r.action?.type === 'redirect' && r.action.redirect?.extensionPath) {
          assert.ok(warSet.has(r.action.redirect.extensionPath), `${rs.id}#${r.id} extensionPath missing from WAR`);
        }
        if (r.action?.type === 'block') {
          assert.equal((c.resourceTypes || []).includes('main_frame'), false, `${rs.id}#${r.id} blocks main_frame`);
          assert.ok((r.priority || 1) < 10, `${rs.id}#${r.id} block priority >= 10`);
        }
      }
    }

    const trackerOnly = compiled.rulesets
      .filter((rs) => ['easyprivacy_trackers', 'tracker_param_stripping', 'cryptominers_and_heavy_scripts'].includes(rs.id))
      .flatMap((rs) => rs.rules);
    for (const req of [
      ...PROTECTED_LEGITIMATE_NETWORK_CANARIES,
      { name: 'SWEEPR GA script', url: 'https://www.google-analytics.com/analytics.js', resourceType: 'script', initiator: 'sweeprdeepblock.com' },
      { name: 'SWEEPR GA xhr', url: 'https://www.google-analytics.com/g/collect?v=2', resourceType: 'xmlhttprequest', initiator: 'sweeprdeepblock.com' }
    ]) {
      const winner = evaluateDnrRulesForRequest(trackerOnly, req);
      assert.notEqual(winner?.action?.type, 'block', `Tracker-only rules blocked ${req.name} via rule #${winner?.id}`);
    }

    const allCombined = compiled.rulesets.flatMap((rs) => rs.rules);
    for (const c of GOLDEN_NETWORK_CANARIES) {
      const w = evaluateDnrRulesForRequest(allCombined, c);
      assert.equal(w?.action?.type, c.expectedAction, `Golden canary failed: ${c.name}`);
    }
    const oauthWinner = evaluateDnrRulesForRequest(allCombined, {
      url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123&state=xyz&utm_source=test',
      resourceType: 'main_frame',
      initiator: 'sweeprdeepblock.com'
    });
    assert.equal(oauthWinner?.action?.type, 'allow');
  });

  test('T5.8 (Area 4, GAP-09 & iOS Info.plist): Safari ZIP matches safari/ Resources byte-for-byte, iOS Info.plist declares ITSAppUsesNonExemptEncryption, and git-deployer strips Chromium/ABP artifacts', () => {
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    const safariResDir = path.join(SAFARI_DIR, 'SWEEPR DeepBlock/Shared (Extension)/Resources');
    const entries = readZipEntries(safariZip);
    for (const e of entries) {
      const onDisk = path.join(safariResDir, e.name);
      assert.ok(fs.existsSync(onDisk), `Missing synced Safari resource ${e.name}`);
      assert.equal(Buffer.compare(fs.readFileSync(onDisk), e.data), 0, `Safari resource drift on ${e.name}`);
    }

    const iosInfoPlist = fs.readFileSync(path.join(SAFARI_DIR, 'SWEEPR DeepBlock/iOS (App)/Info.plist'), 'utf8');
    assert.match(iosInfoPlist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);

    const gitDeployerSrc = fs.readFileSync(path.join(ROOT, 'scripts/ad-filter-pipeline/git-deployer.mjs'), 'utf8');
    assert.match(gitDeployerSrc, /abp_filter_list\.txt[\s\S]{0,120}continue|collectExtensionFiles[\s\S]*?abp_filter_list\.txt/, 'git-deployer.mjs collectExtensionFiles must skip abp_filter_list.txt');
    assert.match(gitDeployerSrc, /sanitizeProdJs/, 'git-deployer.mjs must sanitize production JS');
  });
});

describe('Tier 5 Hardening — Backend Trial, Licensing, Website Spec Sync & Generator Drift', () => {
  let server;

  before(async () => {
    server = await startEphemeralServer();
  });

  after(async () => {
    if (server) await server.stop();
  });

  test('T5H-1: POST /api/trial/start rejects missing, whitespace, malformed JSON, and >64KB payloads cleanly', async () => {
    const emptyRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(emptyRes.status, 400);
    assert.equal((await emptyRes.json()).ok, false);

    const wsRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: '   ', deviceFingerprint: '\t\n' })
    });
    assert.equal(wsRes.status, 400);

    const malRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad_json'
    });
    assert.equal(malRes.status, 400);
    const malJson = await malRes.json();
    assert.equal(malJson.ok, false);
    assert.equal(malJson.error, 'invalid_json');

    const bigRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: 'oversized_test', pad: 'x'.repeat(70000) })
    });
    assert.equal(bigRes.status, 413);
    assert.equal((await bigRes.json()).error, 'payload_too_large');
  });

  test('T5H-2: POST /api/trial/start enforces origin allowlist and echoes CORS for valid extension origins', async () => {
    for (const badOrigin of ['null', 'https://evil.example']) {
      const res = await fetch(`${server.baseUrl}/api/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: badOrigin },
        body: JSON.stringify({ installId: `origin_bad_${crypto.randomUUID()}` })
      });
      assert.equal(res.status, 403, `Expected 403 for Origin=${badOrigin}`);
      assert.equal((await res.json()).error, 'cross_origin_forbidden');
    }

    const allowedExt = 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc';
    const okRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: allowedExt },
      body: JSON.stringify({ installId: `origin_ok_${crypto.randomUUID()}` })
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get('access-control-allow-origin'), allowedExt);
  });

  test('T5H-3: POST /api/trial/start is idempotent across distinct installId sharing the same deviceFingerprint', async () => {
    const fp = `fp_shared_${crypto.randomUUID()}`;
    const r1 = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: `inst_1_${crypto.randomUUID()}`, deviceFingerprint: fp })
    });
    assert.equal(r1.status, 200);
    const j1 = await r1.json();
    assert.equal(j1.idempotent, false);
    assert.equal(j1.requiresCard, false);
    assert.equal(j1.maxDevices, 5);
    assert.equal(j1.devicesUsed, 1);

    const r2 = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: `inst_2_${crypto.randomUUID()}`, deviceFingerprint: fp })
    });
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.idempotent, true);
    assert.equal(j2.trialKey, j1.trialKey);
    assert.equal(j2.trialExpiresAt, j1.trialExpiresAt);
    assert.equal(j2.devicesUsed, 2);
  });

  test('T5H-4: GET /api/license-verify (client path) supports lowercase trialKey & /v1/trial/start alias, and rejects expired trials without reset', async () => {
    const instId = `inst_v1_${crypto.randomUUID()}`;
    const startRes = await fetch(`${server.baseUrl}/v1/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: instId })
    });
    assert.equal(startRes.status, 200);
    const { trialKey } = await startRes.json();

    const getVerify = await fetch(
      `${server.baseUrl}/api/license-verify?key=${encodeURIComponent(trialKey.toLowerCase())}&device_id=dev_get_1`
    );
    assert.equal(getVerify.status, 200);
    const vj = await getVerify.json();
    assert.equal(vj.valid, true);
    assert.equal(vj.status, 'trialing');
    assert.equal(vj.plan, 'trial_7d');

    const trialsPath = path.join(server.tempDataDir, 'trials.json');
    const store = JSON.parse(fs.readFileSync(trialsPath, 'utf8'));
    store.trials[trialKey].trialExpiresAt = Date.now() - 1000;
    store.trials[trialKey].expiresAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(trialsPath, JSON.stringify(store, null, 2));

    const expVerify = await fetch(
      `${server.baseUrl}/api/license-verify?key=${encodeURIComponent(trialKey)}&device_id=dev_get_1`
    );
    assert.equal(expVerify.status, 403);
    assert.equal((await expVerify.json()).error, 'trial_expired');

    const expStart = await (
      await fetch(`${server.baseUrl}/api/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId: instId })
      })
    ).json();
    assert.equal(expStart.status, 'trial_expired');
    assert.equal(expStart.trialKey, trialKey);
  });

  test('T5H-5: GET /api/version, /v1/updates/latest.json, and /api/telemetry/live-proof match manifest & compiled rulesets', async () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);

    for (const ep of ['/api/version', '/v1/updates/latest.json']) {
      const r = await fetch(`${server.baseUrl}${ep}?current_version=1.3.2`);
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j.ok, true);
      assert.equal(j.version, manifest.version);
      assert.equal(j.latest_version, manifest.version);
      assert.equal(j.update_available, true);
    }

    const proof = await (await fetch(`${server.baseUrl}/api/telemetry/live-proof`)).json();
    assert.equal(proof.version, manifest.version);
    assert.equal(proof.activeMv3StaticRules, compiled.enabledTotalRules);
    assert.equal(proof.rulesetsActive, compiled.enabledResources.length);
    for (const rs of compiled.enabledResources) {
      const expectedLen = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', rs.path), 'utf8')).length;
      assert.equal(proof.staticRulesByRuleset[rs.id], expectedLen);
    }
  });

  test('T5H-6: POST /api/trial/start enforces 20 req/min rate limit returning 429 on burst (isolated server)', async () => {
    const rlServer = await startEphemeralServer();
    try {
      let saw429 = false;
      for (let i = 0; i < 25; i += 1) {
        const r = await fetch(`${rlServer.baseUrl}/api/trial/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installId: `rl_burst_${i}_${crypto.randomUUID()}` })
        });
        if (r.status === 429) {
          saw429 = true;
          assert.equal((await r.json()).error, 'rate_limit_exceeded');
          break;
        }
      }
      assert.equal(saw429, true, 'Expected 429 rate_limit_exceeded after >20 /api/trial/start requests/min');
    } finally {
      await rlServer.stop();
    }
  });

  test('T5H-7: R5 CRM v1.4.0 pending tasks & workspace preservation', () => {
    const db = openCrmReadOnly();
    try {
      const rows = db
        .prepare("SELECT id, who, website, status, notes FROM outreach_logs WHERE project_id = 'deepblock' AND notes LIKE '%1.4.0%'")
        .all();
      assert.ok(rows.length >= 4, `Expected >= 4 v1.4.0 CRM rows, got ${rows.length}`);
      for (const storeRe of [/chrome\.google\.com/i, /addons\.mozilla\.org/i, /microsoft\.com/i, /apple\.com/i]) {
        const hit = rows.find((r) => storeRe.test(r.website || ''));
        assert.ok(hit, `Missing CRM row for ${storeRe}`);
        assert.equal(hit.status, 'pending');
      }
    } finally {
      db.close();
    }

    for (const rel of PRE_EXISTING_WORKSPACE_PATHS) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `Missing preserved workspace path ${rel}`);
    }
    const exeSha = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(WEBSITE_DIR, 'SWEEPRDeepblockSetup.exe')))
      .digest('hex')
      .toUpperCase();
    assert.equal(exeSha, EXPECTED_SETUP_EXE_SHA256);
    assert.ok(fs.existsSync(path.join(DIST_DIR, 'STORE_SUBMISSION_GUIDE.md')));
  });

  test('T5H-8 [G1]: active 7-day trialKey supports 5-device QR pairing, portal lookup, and device removal (while blocking switch-plan)', async () => {
    const instId = `inst_qr_trial_${crypto.randomUUID()}`;
    const startRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: instId })
    });
    assert.equal(startRes.status, 200);
    const { trialKey } = await startRes.json();

    const lookupRes = await fetch(`${server.baseUrl}/api/portal/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: trialKey })
    });
    assert.equal(lookupRes.status, 200, 'Active 7-day trial must succeed on /api/portal/lookup');
    const lookupJson = await lookupRes.json();
    assert.equal(lookupJson.status, 'trialing');
    assert.equal(lookupJson.plan, 'trial_7d');

    const switchRes = await fetch(`${server.baseUrl}/api/portal/switch-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc'
      },
      body: JSON.stringify({ licenseKey: trialKey, plan: 'annual' })
    });
    assert.equal(switchRes.status, 401, '7-day trial must not self-promote to active paid plan via switch-plan');

    const createTokenRes = await fetch(`${server.baseUrl}/api/device-link/create-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc'
      },
      body: JSON.stringify({ licenseKey: trialKey, device_id: instId })
    });
    assert.equal(createTokenRes.status, 200, 'Active 7-day trial must allow creating QR pairing token for 5-device sync');
    const tokJson = await createTokenRes.json();
    assert.equal(tokJson.ok, true);
    assert.match(String(tokJson.token || ''), /^ptk_/);

    const removeRes = await fetch(`${server.baseUrl}/api/portal/devices/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc'
      },
      body: JSON.stringify({ licenseKey: trialKey, device_id: instId })
    });
    assert.equal(removeRes.status, 200, 'Active 7-day trial must allow removing a device slot');
    const removeJson = await removeRes.json();
    assert.equal(removeJson.ok, true);
    assert.equal(removeJson.devices_used, 0);
  });

  test('T5H-9 [G2]: POST /api/trial/start rejects non-string object/array identifiers and cross-site Sec-Fetch-Site/Referer without Origin', async () => {
    const objRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: { evil: true } })
    });
    assert.equal(objRes.status, 400, 'Non-string object installId must be rejected with 400 rather than coerced to [object Object]');
    assert.equal((await objRes.json()).error, 'invalid_identifier_type');

    const arrRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFingerprint: ['bad'] })
    });
    assert.equal(arrRes.status, 400);
    assert.equal((await arrRes.json()).error, 'invalid_identifier_type');

    const crossSiteRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'cross-site',
        Referer: 'https://evil.example/'
      },
      body: JSON.stringify({ installId: `cs_${crypto.randomUUID()}` })
    });
    assert.equal(crossSiteRes.status, 403, 'Sec-Fetch-Site: cross-site without Origin must return 403');
  });

  test('T5H-10 [G3]: all indexable /vs pages, support.html, and llms*.txt display exact v1.4.0, 36,019 rules, and 160 CMPs (zero 150+)', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const cmp = inspectCmpCoverage();
    const fmtRules = compiled.enabledTotalRules.toLocaleString('en-US');

    for (const urlPath of getIndexableVsPaths()) {
      const visible = extractVisibleText(fs.readFileSync(resolveWebsiteHtmlPath(urlPath), 'utf8'));
      assert.ok(visible.includes(manifest.version), `${urlPath} visible text missing ${manifest.version}`);
      assert.ok(
        visible.includes(String(compiled.enabledTotalRules)) || visible.includes(fmtRules),
        `${urlPath} visible text missing static rule count ${fmtRules}`
      );
      assert.match(visible, /7[- ]day/i, `${urlPath} missing 7-day trial`);
      for (const n of extractClaimedCmpCounts(visible)) {
        assert.equal(n, cmp.frameworkCount, `${urlPath} CMP count ${n} != ${cmp.frameworkCount}`);
      }
    }

    for (const file of ['support.html', 'llms.txt', 'llms-full.txt']) {
      const text = fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8');
      assert.doesNotMatch(text, /\b150\+\s*(?:CMP|regional|additional|consent)/i, `${file} contains stale 150+ CMP claim`);
    }
  });

  test('T5H-11 [G4]: website/SEO generator scripts do not hardcode stale 1.3.1, 283/264 rules, 20 params, or Gecko 140.0+', () => {
    for (const rel of [
      'build-localized-eu-hubs.mjs',
      'gsc-strike-zone-optimizer.mjs',
      'consolidate-and-optimize-gsc.mjs',
      'daily-50-seo-pages.mjs',
      'competitor-review-miner.mjs',
      'enrich-pillars-with-live-proof.mjs',
      'keyword-research-engine.mjs',
      'log-seo-changes-to-crm.mjs'
    ]) {
      const src = fs.readFileSync(path.join(SCRIPTS_DIR, rel), 'utf8');
      assert.doesNotMatch(src, /Gecko\s+140\.0\+/i, `${rel} hardcodes Gecko 140.0+`);
      assert.doesNotMatch(src, /\b(?:283|264)\s+(?:static|Ad\/Tracker|ads|pub|anuncios)/i, `${rel} hardcodes stale 283/264 rule count`);
      assert.doesNotMatch(src, /20[-\s]+(?:Parameter|paramètres|parámetros)/i, `${rel} hardcodes stale 20-param count`);
      assert.doesNotMatch(src, /\b150\+\s*CMP/i, `${rel} hardcodes stale 150+ CMP`);
      assert.doesNotMatch(src, /v1\.3\.1\b/, `${rel} hardcodes stale v1.3.1`);
    }
  });

  if (process.env.VERIFY_LIVE_PROD === '1') {
    test('T5H-12 [LIVE PROD PARITY]: https://sweeprdeepblock.com matches v1.4.0, 36,019 rules, 160 CMPs across pages & feeds', async () => {
      const ver = await (await fetch('https://sweeprdeepblock.com/api/version')).json();
      assert.equal(ver.version, '1.4.0');
      const proof = await (await fetch('https://sweeprdeepblock.com/api/telemetry/live-proof')).json();
      assert.equal(proof.version, '1.4.0');
      assert.equal(proof.activeMv3StaticRules, 36019);
      assert.equal(proof.rulesetsActive, 5);

      for (const p of ['/support', '/llms.txt', '/llms-full.txt', '/vs/windscribe-robert-adblock']) {
        const res = await fetch(`https://sweeprdeepblock.com${p}`);
        assert.equal(res.status, 200, `${p} returned ${res.status}`);
        const body = await res.text();
        assert.doesNotMatch(body, /\b150\+\s*(?:CMP|regional|additional|consent)/i, `Live ${p} still has 150+ CMP`);
        assert.ok(body.includes('36,019'), `Live ${p} missing 36,019`);
      }
    });
  }

  test('T5H-13 [R2 REGRESSION]: hydrated trial_7d key expires naturally without restart across license-verify, portal, and device-link endpoints', async () => {
    const mkKey = () => {
      const h = crypto.randomBytes(6).toString('hex').toUpperCase();
      return `SWEEPR-DB-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
    };
    const shortKey = mkKey();
    const shortKey2 = mkKey();
    const nowMs = Date.now();
    const expMs = nowMs + 2500;
    const trialsPath = path.join(server.tempDataDir, 'trials.json');
    const existingStore = fs.existsSync(trialsPath)
      ? JSON.parse(fs.readFileSync(trialsPath, 'utf8'))
      : { byIdentityHash: {}, trials: {} };
    for (const k of [shortKey, shortKey2]) {
      existingStore.trials[k] = {
        trialKey: k,
        status: 'trialing',
        plan: 'trial_7d',
        ramTamerAddon: true,
        maxDevices: 5,
        devices: ['ext_dev_1'],
        trialStartedAt: nowMs,
        trialExpiresAt: expMs,
        expiresAt: new Date(expMs).toISOString(),
        createdAt: new Date(nowMs).toISOString()
      };
    }
    fs.writeFileSync(trialsPath, JSON.stringify(existingStore, null, 2));

    const extOrigin = 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc';
    const preCreate = await fetch(`${server.baseUrl}/api/device-link/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ licenseKey: shortKey, device_id: 'ext_dev_1' })
    });
    assert.equal(preCreate.status, 200, 'Pre-expiry create-token must succeed and hydrate account');
    const preTokenJson = await preCreate.json();
    assert.equal(preTokenJson.ok, true);
    assert.match(String(preTokenJson.token || ''), /^ptk_/);

    const preCreate2 = await fetch(`${server.baseUrl}/api/device-link/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ licenseKey: shortKey2, device_id: 'ext_dev_1' })
    });
    assert.equal(preCreate2.status, 200);
    const preTokenJson2 = await preCreate2.json();

    const preLookup = await fetch(`${server.baseUrl}/api/portal/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: shortKey })
    });
    assert.equal(preLookup.status, 200, 'Pre-expiry portal lookup must succeed');
    const setCookie = preLookup.headers.get('set-cookie') || '';
    const sessionCookie = setCookie.split(';')[0];
    assert.match(sessionCookie, /^sweepr_session=/);

    const waitMs = Math.max(100, expMs - Date.now() + 150);
    await new Promise((r) => setTimeout(r, waitMs));
    assert.ok(Date.now() > expMs);

    // Redeem-first on shortKey2 proves /api/device-link/redeem itself evicts un-evicted hydrated trial_7d
    const postRedeemFirst2 = await fetch(`${server.baseUrl}/api/device-link/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ token: preTokenJson2.token, device_id: 'ext_dev_2' })
    });
    assert.equal(postRedeemFirst2.status, 403, 'Redeem-first on expired hydrated trial_7d must return 403');
    assert.equal((await postRedeemFirst2.json()).error, 'subscription_inactive');

    const getVerify = await fetch(
      `${server.baseUrl}/api/license-verify?key=${encodeURIComponent(shortKey)}&device_id=ext_dev_1`
    );
    assert.equal(getVerify.status, 403, 'Hydrated trial_7d must return 403 after expiry on GET /api/license-verify');
    const getVerifyJson = await getVerify.json();
    assert.equal(getVerifyJson.valid, false);
    assert.equal(getVerifyJson.status, 'trial_expired');
    assert.equal(getVerifyJson.error, 'trial_expired');

    const postVerify = await fetch(`${server.baseUrl}/api/license-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: shortKey, device_id: 'ext_dev_1' })
    });
    assert.equal(postVerify.status, 403, 'Hydrated trial_7d must return 403 after expiry on POST /api/license-verify');
    assert.equal((await postVerify.json()).error, 'trial_expired');

    const postLookup = await fetch(`${server.baseUrl}/api/portal/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: shortKey })
    });
    assert.equal(postLookup.status, 404, 'Expired hydrated trial_7d must return 404 on /api/portal/lookup');

    const postCancel = await fetch(`${server.baseUrl}/api/portal/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookup: shortKey })
    });
    assert.equal(postCancel.status, 404, 'Expired hydrated trial_7d must return 404 on /api/portal/cancel');

    const postCreateAfter = await fetch(`${server.baseUrl}/api/device-link/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ licenseKey: shortKey, device_id: 'ext_dev_1' })
    });
    assert.equal(postCreateAfter.status, 401, 'Expired hydrated trial_7d must return 401 on /api/device-link/create-token (key)');

    const postCreateCookieAfter = await fetch(`${server.baseUrl}/api/device-link/create-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ device_id: 'ext_dev_1' })
    });
    assert.equal(postCreateCookieAfter.status, 401, 'Expired hydrated trial_7d must return 401 on /api/device-link/create-token (session)');

    const postRemoveAfter = await fetch(`${server.baseUrl}/api/portal/devices/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ licenseKey: shortKey, device_id: 'ext_dev_1' })
    });
    assert.equal(postRemoveAfter.status, 401, 'Expired hydrated trial_7d must return 401 on /api/portal/devices/remove');

    const postRedeemAfter = await fetch(`${server.baseUrl}/api/device-link/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: extOrigin },
      body: JSON.stringify({ token: preTokenJson.token, device_id: 'ext_dev_2' })
    });
    assert.equal(postRedeemAfter.status, 403, 'Expired hydrated trial_7d must return 403 on /api/device-link/redeem');
    assert.equal((await postRedeemAfter.json()).error, 'subscription_inactive');
  });
});
