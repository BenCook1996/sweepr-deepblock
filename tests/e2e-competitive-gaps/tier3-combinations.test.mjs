import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  WEBSITE_DIR,
  EXTENSION_DIR,
  DIST_DIR,
  SWEEPR_FIRST_PARTY_DOMAINS,
  startEphemeralServer,
  readExtensionManifest,
  extractVisibleText,
  readZipEntries,
  readManifestFromZip,
  computeCompiledStaticDnrRules,
  inspectCmpCoverage,
  extractClaimedCmpCounts,
  createBackgroundVmHarness,
  createContentScriptVmHarness,
  findOssLicenseViolationsInZip
} from './helpers.mjs';

let server;

before(async () => {
  server = await startEphemeralServer();
});

after(async () => {
  if (server) await server.stop();
});

describe('Tier 3 — Pairwise Cross-Feature Combinations (>= 9 tests)', () => {
  test('C1 (F4 × F5): fresh 7-day Pro trial activates all 5 static DNR rulesets and day-7 expiry disables all 5', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const compiled = computeCompiledStaticDnrRules();
    const expectedIds = compiled.rulesets.map((r) => r.id);
    assert.ok(expectedIds.length >= 5, 'Expected >= 5 static DNR rulesets in manifest.json');

    const h = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await h.triggerInstall('install');
      const activeIds = h.getEnabledRulesets();
      for (const id of expectedIds) {
        assert.ok(activeIds.includes(id), `Ruleset ${id} must be enabled during active trial`);
      }

      h.advanceMs(7 * 86400000);
      await h.triggerAlarm('licenseVerifyCheck');
      assert.deepEqual(h.getEnabledRulesets(), [], 'All static DNR rulesets must disable when trial expires');
    } finally {
      h.cleanup();
    }
  });

  test('C2 (F4 × F3): active trial auto-rejects CMP banner & unlocks scroll, while expired trial leaves banner & scroll lock untouched', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const bg = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await bg.triggerInstall('install');
      const activeState = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(activeState.proActive, true);

      let btn1;
      const cs1 = createContentScriptVmHarness({
        bodyOverflow: 'hidden',
        storageState: activeState,
        setupDom: ({ bodyEl, createElement }) => {
          const banner = createElement('div', { id: 'onetrust-banner-sdk' });
          btn1 = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
          banner.appendChild(btn1);
          bodyEl.appendChild(banner);
        }
      });
      try {
        await cs1.flush();
        assert.equal(btn1.clicked, true);
        assert.equal(cs1.bodyEl.style.overflow, 'auto');
      } finally {
        cs1.cleanup();
      }

      bg.advanceMs(7 * 86400000 + 1000);
      await bg.triggerAlarm('licenseVerifyCheck');
      const expiredState = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(expiredState.proActive, false);

      let btn2;
      const cs2 = createContentScriptVmHarness({
        bodyOverflow: 'hidden',
        storageState: expiredState,
        setupDom: ({ bodyEl, createElement }) => {
          const banner = createElement('div', { id: 'onetrust-banner-sdk' });
          btn2 = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
          banner.appendChild(btn2);
          bodyEl.appendChild(banner);
        }
      });
      try {
        await cs2.flush();
        assert.equal(btn2.clicked, false);
        assert.equal(cs2.bodyEl.style.overflow, 'hidden');
      } finally {
        cs2.cleanup();
      }
    } finally {
      bg.cleanup();
    }
  });

  test('C3 (F4 × F2): active trial syncs OTA dynamic rules from live ephemeral server and clears them upon expiry', async () => {
    const startMs = Date.now();
    const h = createBackgroundVmHarness({ nowMs: startMs, serverBaseUrl: server.baseUrl });
    try {
      await h.triggerInstall('install');
      await h.ctx.syncRemoteFilterDelta();
      const activeDynamic = h.getDynamicRules().filter((r) => r.id >= 80000 && r.id < 81000);
      assert.ok(activeDynamic.length > 0, 'Active trial must load OTA delta rules from /api/filters/delta');

      h.advanceMs(7 * 86400000 + 5000);
      await h.triggerAlarm('licenseVerifyCheck');
      const postExpiryDynamic = h.getDynamicRules().filter((r) => r.id >= 80000 && r.id < 81000);
      assert.equal(postExpiryDynamic.length, 0, 'OTA dynamic rules must be cleared on trial expiry');
    } finally {
      h.cleanup();
    }
  });

  test('C4 (F5 × F6): static DNR rulesets and tracker_params.json mutually protect SWEEPR first-party domains', () => {
    const compiled = computeCompiledStaticDnrRules();
    const adsRules = compiled.rulesets.find((r) => r.id === 'ads_and_trackers')?.rules || [];
    const paramRules = compiled.rulesets.find((r) => r.id === 'tracker_param_stripping')?.rules || [];
    assert.ok(adsRules.length >= 10000);
    assert.ok(paramRules.length > 0);

    for (const gaRule of adsRules.filter(
      (r) => r.action?.type === 'block' && /google-analytics|googletagmanager/i.test(r.condition?.urlFilter || '')
    )) {
      for (const dom of ['sweeprdeepblock.com', 'sweeprcleaner.com', 'sweeprvpn.com']) {
        assert.ok((gaRule.condition?.excludedInitiatorDomains || []).includes(dom));
      }
    }
    for (const pRule of paramRules) {
      for (const dom of SWEEPR_FIRST_PARTY_DOMAINS) {
        assert.ok((pRule.condition?.excludedRequestDomains || []).includes(dom));
      }
    }
  });

  test('C5 (F1 × F2 × F3): website pages and machine feeds consistently reflect manifest.version, static rule count, and verified CMP count', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const cmp = inspectCmpCoverage();
    const formattedRules = compiled.enabledTotalRules.toLocaleString('en-US');

    assert.ok(cmp.frameworkCount >= 150);
    assert.ok(compiled.enabledTotalRules >= 25000);

    for (const rel of ['benchmarks.html', 'pricing.html', 'download.html', 'vs/total-adblock.html', 'vs/adguard-extension.html']) {
      const visible = extractVisibleText(fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8'));
      assert.ok(visible.includes(manifest.version), `${rel} missing ${manifest.version}`);
      assert.ok(
        visible.includes(String(compiled.enabledTotalRules)) || visible.includes(formattedRules),
        `${rel} missing static rule count ${compiled.enabledTotalRules}`
      );
      for (const claimedCmp of extractClaimedCmpCounts(visible)) {
        assert.ok(claimedCmp <= cmp.frameworkCount, `${rel} CMP claim ${claimedCmp} > implemented ${cmp.frameworkCount}`);
      }
    }

    const geo = JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'geo-benchmark-feed.json'), 'utf8'));
    assert.equal(geo.version, manifest.version);
    assert.equal(geo.telemetrySummary?.staticDnrRules, compiled.enabledTotalRules);
  });

  test('C6 (F2 × F7 × F9): version bump and Firefox 128.0 propagate across manifest, dist ZIP, website XPI, and download.html', () => {
    const rootManifest = readExtensionManifest();
    assert.equal(rootManifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');

    const ffDist = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip')).manifest;
    const ffSite = readManifestFromZip(path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi')).manifest;
    assert.equal(ffDist.version, rootManifest.version);
    assert.equal(ffSite.version, rootManifest.version);
    assert.equal(ffDist.browser_specific_settings?.gecko?.strict_min_version, '128.0');
    assert.equal(ffSite.browser_specific_settings?.gecko?.strict_min_version, '128.0');

    const dlText = extractVisibleText(fs.readFileSync(path.join(WEBSITE_DIR, 'download.html'), 'utf8'));
    assert.ok(dlText.includes(rootManifest.version));
    assert.match(dlText, /Gecko\s+128\.0\+/i);
  });

  test('C7 (F2 × F8 × F9): Safari MV3 bundle matches manifest.version, passes vm.Script, strips unsupported keys, and has zero OSS leaks', () => {
    const rootManifest = readExtensionManifest();
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    assert.ok(fs.existsSync(safariZip));
    const { manifest, entries } = readManifestFromZip(safariZip);
    assert.equal(manifest.version, rootManifest.version);
    assert.equal('minimum_chrome_version' in manifest, false);
    assert.equal('browser_specific_settings' in manifest, false);
    assert.equal('oauth2' in manifest, false);

    for (const e of entries) {
      if (e.name.endsWith('.js')) {
        assert.doesNotThrow(() => new vm.Script(e.data.toString('utf8'), { filename: e.name }));
      }
    }
    assert.deepEqual(findOssLicenseViolationsInZip(safariZip), []);
  });

  test('C8 (F4 × F9): live ephemeral server /api/trial/start -> background.js state -> 5-device cap enforcement on /api/license-verify', async () => {
    const h = createBackgroundVmHarness({ serverBaseUrl: server.baseUrl });
    try {
      await h.triggerInstall('install');
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
      assert.equal(state.subscriptionStatus, 'trialing');
      const trialKey = state.licenseKey;
      assert.ok(trialKey && trialKey.startsWith('SWEEPR-'), `Expected server-issued trialKey, got "${trialKey}"`);

      const devices = [state.deviceId || 'sync_dev_1', 'sync_dev_2', 'sync_dev_3', 'sync_dev_4', 'sync_dev_5'];
      for (let i = 0; i < devices.length; i += 1) {
        const res = await fetch(`${server.baseUrl}/api/license-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: trialKey, device_id: devices[i] })
        });
        assert.equal(res.status, 200, `Device ${i + 1}/5 should succeed`);
      }

      const overCap = await fetch(`${server.baseUrl}/api/license-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: trialKey, device_id: 'sync_dev_6' })
      });
      assert.equal(overCap.status, 403);
      assert.equal((await overCap.json()).error, 'device_limit_reached');
    } finally {
      h.cleanup();
    }
  });

  test('C9 (F4 × F9): expired trial unlocks immediately when user activates a valid paid license via ACTIVATE_LICENSE', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const paidKey = 'SWEEPR-DB-PAID-2026-8888';
    const h = createBackgroundVmHarness({
      nowMs: startMs,
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
              expiresAt: new Date(startMs + 365 * 86400000).toISOString(),
              token: 'hdr.pay.sig'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });
    try {
      await h.triggerInstall('install');
      h.advanceMs(7 * 86400000 + 1000);
      await h.triggerAlarm('licenseVerifyCheck');

      const expiredState = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(expiredState.proActive, false);
      assert.deepEqual(h.getEnabledRulesets(), []);

      const actRes = await h.sendPrivilegedMessage({ type: 'ACTIVATE_LICENSE', licenseKey: paidKey });
      assert.equal(actRes.valid, true);

      const unlockedState = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(unlockedState.proActive, true);
      assert.equal(unlockedState.licenseKey, paidKey);
      assert.ok(h.getEnabledRulesets().length >= 5);
      assert.ok(h.getRegisteredScripts().some((s) => s.id === 'deepstealth-main'));
    } finally {
      h.cleanup();
    }
  });

  test('C10 (F3 × F5): toggling adBlocking off during active trial disables ad DNR & stealth while keeping cookieAutoClose & trackerProtection active', async () => {
    const bg = createBackgroundVmHarness({ offline: true });
    try {
      await bg.triggerInstall('install');
      const toggleRes = await bg.sendPrivilegedMessage({ type: 'TOGGLE_SETTING', settingKey: 'adBlocking' });
      assert.equal(toggleRes.ok, true);
      assert.equal(toggleRes.settings.adBlocking, false);
      assert.equal(toggleRes.settings.cookieAutoClose, true);
      assert.equal(toggleRes.settings.trackerProtection, true);

      const enabled = bg.getEnabledRulesets();
      assert.equal(enabled.includes('ads_and_trackers'), false);
      assert.equal(enabled.includes('tracker_param_stripping'), true);

      const state = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      let rejectBtn;
      const cs = createContentScriptVmHarness({
        storageState: state,
        setupDom: ({ bodyEl, createElement }) => {
          const banner = createElement('div', { id: 'onetrust-banner-sdk' });
          rejectBtn = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
          banner.appendChild(rejectBtn);
          bodyEl.appendChild(banner);
        }
      });
      try {
        await cs.flush();
        assert.equal(cs.hasUniversalCosmeticStyle(), false);
        assert.equal(rejectBtn.clicked, true);
      } finally {
        cs.cleanup();
      }
    } finally {
      bg.cleanup();
    }
  });

  test('C11 (F7 × F8): Firefox and Safari packages enforce distinct store constraints while bundling full >= 25,000 DNR rulesets', () => {
    const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    assert.ok(fs.existsSync(ffZip), `Missing Firefox ZIP at ${ffZip}`);
    assert.ok(fs.existsSync(safariZip), `Missing Safari ZIP at ${safariZip}`);
    const ff = readManifestFromZip(ffZip);
    const saf = readManifestFromZip(safariZip);

    assert.equal(ff.manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
    assert.equal('browser_specific_settings' in saf.manifest, false);

    const countRulesInEntries = (entries, manifest) => {
      let sum = 0;
      for (const rr of manifest.declarative_net_request?.rule_resources || []) {
        const entry = entries.find((e) => e.name === rr.path);
        assert.ok(entry, `Archive missing ruleset ${rr.path}`);
        sum += JSON.parse(entry.data.toString('utf8')).length;
      }
      return sum;
    };

    const ffCount = countRulesInEntries(ff.entries, ff.manifest);
    const safCount = countRulesInEntries(saf.entries, saf.manifest);
    assert.ok(ffCount >= 25000 && ffCount <= 330000);
    assert.equal(ffCount, safCount);
  });

  test('C12 (F1 × F9): live ephemeral server serves synced HTML pages, machine feeds, and API endpoints in full agreement', async () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);

    const fetchText = (p) =>
      fetch(`${server.baseUrl}${p}`, { headers: { Connection: 'close' } }).then((r) => r.text());
    const fetchJson = (p) =>
      fetch(`${server.baseUrl}${p}`, { headers: { Connection: 'close' } }).then((r) => r.json());

    const benchHtml = await fetchText('/benchmarks');
    const pricingHtml = await fetchText('/pricing');
    const proofJson = await fetchJson('/api/telemetry/live-proof');
    const verJson = await fetchJson('/api/version');
    const geoJson = await fetchJson('/geo-benchmark-feed.json');

    assert.equal(verJson.version, manifest.version);
    assert.equal(proofJson.version, manifest.version);
    assert.equal(geoJson.version, manifest.version);
    assert.equal(proofJson.activeMv3StaticRules, compiled.enabledTotalRules);
    assert.equal(geoJson.telemetrySummary?.staticDnrRules, compiled.enabledTotalRules);
    assert.ok(extractVisibleText(benchHtml).includes(manifest.version));
    assert.ok(extractVisibleText(pricingHtml).includes(manifest.version));
  });
});
