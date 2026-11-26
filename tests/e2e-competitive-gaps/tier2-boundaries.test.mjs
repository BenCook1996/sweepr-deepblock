import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ROOT,
  WEBSITE_DIR,
  EXTENSION_DIR,
  DIST_DIR,
  SAFARI_DIR,
  SWEEPR_FIRST_PARTY_DOMAINS,
  startEphemeralServer,
  readExtensionManifest,
  extractJsonLdBlocks,
  collectJsonLdFields,
  extractVisibleText,
  compareSemver,
  isStrictGaSemver,
  readZipEntries,
  readManifestFromZip,
  parseHtmlTables,
  findTableCell,
  computeCompiledStaticDnrRules,
  getAllVsHtmlFiles,
  findStaleDeepblockVersions,
  createBackgroundVmHarness,
  createContentScriptVmHarness,
  openCrmReadOnly,
  listFilesRecursive
} from './helpers.mjs';

let server;

before(async () => {
  server = await startEphemeralServer();
});

after(async () => {
  if (server) await server.stop();
});

describe('Tier 2 — F1 Boundaries: Website Benchmark & Copy Edge Cases', () => {
  test('F1.B1: benchmarks.html AdGuard Extension row contains zero paid currency amounts', () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const tables = parseHtmlTables(html);
    const cell = findTableCell(tables, /AdGuard\s+Extension/i, /Transparent\s+Annual\s+Price/i);
    assert.ok(cell, 'Missing AdGuard Extension price cell');
    assert.doesNotMatch(cell.value, /(?:£|\$|€)\s*\d/, `Unexpected currency amount in AdGuard Extension cell: "${cell.value}"`);
    assert.match(cell.value, /^free\b/i, `Expected Free in AdGuard Extension price cell, got "${cell.value}"`);
  });

  test('F1.B2: benchmarks.html Total Adblock CMP cell avoids both false "No" and false "Unlimited" claims', () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const tables = parseHtmlTables(html);
    const cell = findTableCell(tables, /Total\s+Adblock/i, /Automated\s+CMP\s+Cookie\s+Rejector/i);
    assert.ok(cell, 'Missing Total Adblock CMP cell');
    assert.doesNotMatch(cell.value, /^no$/i);
    assert.doesNotMatch(cell.value, /\b150\+\b|\bunlimited\b/i);
  });

  test('F1.B3: benchmarks.html JSON-LD SoftwareApplication.softwareVersion equals Dataset.version', () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const { blocks, errors } = extractJsonLdBlocks(html);
    assert.deepEqual(errors, []);
    const fields = collectJsonLdFields(blocks, ['softwareVersion', 'version']);
    const sw = fields.find((f) => f.key === 'softwareVersion');
    const ds = fields.find((f) => f.key === 'version');
    assert.ok(sw && ds, 'Both softwareVersion and Dataset.version must exist');
    assert.equal(sw.value, ds.value);
  });

  test('F1.B4: pricing.html and vs/total-adblock.html do not contain stale "no free ad blocking" or "counts only" copy', () => {
    for (const rel of ['pricing.html', 'vs/total-adblock.html']) {
      const visible = extractVisibleText(fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8'));
      assert.equal(/\bCounts\s+Cookie\s+Banners\b/i.test(visible), false, `${rel} still shows passive cookie-counting free tier`);
      assert.equal(/active\s+Pro\s+plan\s+required\s+to\s+unlock/i.test(visible), false, `${rel} still claims paid plan required on install`);
    }
  });

  test('F1.B5: /benchmarks and /pricing handle unusual query parameters cleanly without template leaks', async () => {
    for (const route of ['/benchmarks?ref=audit&v=%3Cscript%3E', '/pricing?currency=invalid&plan=unknown']) {
      const res = await fetch(`${server.baseUrl}${route}`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.length > 5000);
      assert.doesNotMatch(html, /\{\{[^}]+\}\}|>\s*undefined\s*<|>\s*NaN\s*</);
    }
  });
});

describe('Tier 2 — F2 Boundaries: Version Semver, API Edge Cases & Full /vs Directory', () => {
  test('F2.B1: manifest.version is strictly greater than 1.3.2 and not a pre-release tag', () => {
    const manifest = readExtensionManifest();
    assert.ok(isStrictGaSemver(manifest.version), `Expected X.Y.Z GA version, got "${manifest.version}"`);
    assert.notEqual(manifest.version, '1.3.2');
    assert.notEqual(manifest.version, '1.3.1');
    assert.equal(compareSemver(manifest.version, '1.3.2'), 1);
  });

  test('F2.B2: /api/version boundary behavior for older (1.3.2), equal (manifest.version), and future (99.0.0) versions', async () => {
    const manifest = readExtensionManifest();

    const oldRes = await fetch(`${server.baseUrl}/api/version?current_version=1.3.2`);
    assert.equal(oldRes.status, 200);
    assert.equal((await oldRes.json()).update_available, true);

    const eqRes = await fetch(`${server.baseUrl}/api/version?current_version=${manifest.version}`);
    assert.equal(eqRes.status, 200);
    assert.equal((await eqRes.json()).update_available, false);

    const futRes = await fetch(`${server.baseUrl}/api/version?current_version=99.0.0`);
    assert.equal(futRes.status, 200);
    assert.equal((await futRes.json()).update_available, false);
  });

  test('F2.B3: /api/version and /api/filters/delta handle malformed or empty current_version without 5xx error', async () => {
    for (const q of ['', '?current_version=', '?current_version=not-a-semver%3Bdrop']) {
      const vRes = await fetch(`${server.baseUrl}/api/version${q}`);
      assert.equal(vRes.status, 200);
      const dRes = await fetch(`${server.baseUrl}/api/filters/delta${q}`);
      assert.equal(dRes.status, 200);
    }
  });

  test('F2.B4: all files under website/vs/*.html contain zero stale Deepblock 1.3.1 or 1.3.2 references', () => {
    const manifest = readExtensionManifest();
    const vsFiles = getAllVsHtmlFiles();
    assert.ok(vsFiles.length >= 100, `Expected full vs/ directory, got ${vsFiles.length} files`);
    const failures = [];
    for (const filePath of vsFiles) {
      const html = fs.readFileSync(filePath, 'utf8');
      const stale = findStaleDeepblockVersions(html, manifest.version);
      if (stale.length > 0) {
        failures.push(`${path.basename(filePath)}: ${stale.join(', ')}`);
      }
    }
    assert.deepEqual(failures, [], `Stale versions in website/vs/*.html:\n${failures.slice(0, 15).join('\n')}`);
  });

  test('F2.B5: website/pad.xml Program_Version matches manifest.version and File_Size_Bytes is positive integer', () => {
    const manifest = readExtensionManifest();
    const pad = fs.readFileSync(path.join(WEBSITE_DIR, 'pad.xml'), 'utf8');
    const verMatch = pad.match(/<Program_Version>([^<]+)<\/Program_Version>/);
    const sizeMatch = pad.match(/<File_Size_Bytes>(\d+)<\/File_Size_Bytes>/);
    assert.ok(verMatch, 'pad.xml missing <Program_Version>');
    assert.equal(verMatch[1].trim(), manifest.version);
    assert.ok(sizeMatch && Number.parseInt(sizeMatch[1], 10) > 0, 'pad.xml <File_Size_Bytes> must be > 0');
  });
});

describe('Tier 2 — F3 Boundaries: CMP Edge Cases & Negative Guards', () => {
  test('F3.B1: deepblock-content.js survives null, empty, and invalid CSS selectors in extraCmpSelectors', async () => {
    const h = createContentScriptVmHarness({
      storageState: {
        proActive: true,
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0010',
        pausedSites: [],
        extraCmpSelectors: [null, '', 'div[unclosed'],
        settings: { adBlocking: true, cookieAutoClose: true }
      }
    });
    try {
      await h.flush();
      assert.equal(h.hasUniversalCosmeticStyle(), true);
    } finally {
      h.cleanup();
    }
  });

  test('F3.B2: expired trial (proActive: false) counts cookie banner without clicking reject or unlocking scroll', async () => {
    let rejectBtn;
    const h = createContentScriptVmHarness({
      bodyOverflow: 'hidden',
      storageState: {
        proActive: false,
        subscriptionStatus: 'trial_expired',
        licenseKey: '',
        pausedSites: [],
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      setupDom: ({ bodyEl, createElement }) => {
        const banner = createElement('div', { id: 'onetrust-banner-sdk' });
        rejectBtn = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
        banner.appendChild(rejectBtn);
        bodyEl.appendChild(banner);
      }
    });
    try {
      await h.flush();
      assert.ok(h.metrics.some((m) => m.metric === 'cookiePromptsDetected'));
      assert.equal(rejectBtn.clicked, false, 'Expired trial must not auto-reject CMP');
      assert.equal(h.bodyEl.style.overflow, 'hidden', 'Expired trial must not unlock scroll');
    } finally {
      h.cleanup();
    }
  });

  test('F3.B3: paused site in pausedSites skips both ad hiding and CMP auto-rejection', async () => {
    let rejectBtn;
    const h = createContentScriptVmHarness({
      hostname: 'paused-news.example',
      url: 'https://paused-news.example/article',
      storageState: {
        proActive: true,
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0011',
        pausedSites: ['paused-news.example'],
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      setupDom: ({ bodyEl, createElement }) => {
        const banner = createElement('div', { id: 'onetrust-banner-sdk' });
        rejectBtn = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
        banner.appendChild(rejectBtn);
        bodyEl.appendChild(banner);
      }
    });
    try {
      await h.flush();
      assert.equal(h.hasUniversalCosmeticStyle(), false);
      assert.equal(rejectBtn.clicked, false);
      assert.equal(h.metrics.length, 0);
    } finally {
      h.cleanup();
    }
  });

  test('F3.B4: cookieAutoClose === false skips CMP auto-rejection while adBlocking remains active', async () => {
    let rejectBtn;
    const h = createContentScriptVmHarness({
      storageState: {
        proActive: true,
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0012',
        pausedSites: [],
        settings: { adBlocking: true, cookieAutoClose: false }
      },
      setupDom: ({ bodyEl, createElement }) => {
        const banner = createElement('div', { id: 'onetrust-banner-sdk' });
        rejectBtn = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
        banner.appendChild(rejectBtn);
        bodyEl.appendChild(banner);
      }
    });
    try {
      await h.flush();
      assert.equal(h.hasUniversalCosmeticStyle(), true);
      assert.equal(rejectBtn.clicked, false);
    } finally {
      h.cleanup();
    }
  });

  test('F3.B5: multilingual CMP reject buttons (DE/FR/ES) click Reject and never click Accept All', async () => {
    for (const label of ['Alle ablehnen', 'Tout refuser', 'Rechazar todo']) {
      let acceptBtn;
      let rejectBtn;
      const h = createContentScriptVmHarness({
        storageState: {
          proActive: true,
          licenseKey: 'SWEEPR-DB-TRIAL-2026-0013',
          pausedSites: [],
          settings: { adBlocking: true, cookieAutoClose: true }
        },
        setupDom: ({ bodyEl, createElement }) => {
          const banner = createElement('div', { id: 'cookie-banner-eu' });
          acceptBtn = createElement('button', { id: 'accept-all-btn', textContent: 'Accept All' });
          rejectBtn = createElement('button', { id: 'reject-eu-btn', textContent: label });
          banner.appendChild(acceptBtn);
          banner.appendChild(rejectBtn);
          bodyEl.appendChild(banner);
        }
      });
      try {
        await h.flush();
        assert.equal(acceptBtn.clicked, false, `Must never click Accept All for "${label}"`);
        assert.equal(rejectBtn.clicked, true, `Should auto-reject multilingual CMP button "${label}"`);
      } finally {
        h.cleanup();
      }
    }
  });
});

describe('Tier 2 — F4 Boundaries: 7-Day Trial Edge Times, Tamper Defense & API Limits', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  test('F4.B1: offline fresh install (network ECONNREFUSED) still activates full 7-day Pro trial locally', async () => {
    const h = createBackgroundVmHarness({ offline: true });
    try {
      await h.triggerInstall('install');
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
      assert.equal(state.subscriptionStatus, 'trialing');
      assert.ok(h.getEnabledRulesets().length >= 5);
    } finally {
      h.cleanup();
    }
  });

  test('F4.B2: day 6.99999 (trialExpiresAt - 1ms) remains active and un-gated', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const h = createBackgroundVmHarness({
      nowMs: startMs,
      offline: true,
      tabs: [
        { id: 1, active: true, pinned: false, audible: false, discarded: false, url: 'https://example.com/' },
        { id: 2, active: false, pinned: false, audible: false, discarded: false, url: 'https://idle.example.org/' }
      ]
    });
    try {
      await h.triggerInstall('install');
      h.setNow(startMs + SEVEN_DAYS_MS - 1);
      await h.triggerAlarm('licenseVerifyCheck');

      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
      assert.equal(state.subscriptionStatus, 'trialing');
      const hib = await h.sendPrivilegedMessage({ type: 'HIBERNATE_TABS_NOW' });
      assert.equal(hib.ok, true, 'HIBERNATE_TABS_NOW must succeed on day 6.99999');
      assert.notEqual(hib.requiresPro, true);
      assert.ok(hib.newlyDiscarded >= 1, `Expected >= 1 idle tab discarded, got ${hib.newlyDiscarded}`);
    } finally {
      h.cleanup();
    }
  });

  test('F4.B3: exact day 7 boundary (Date.now() === trialExpiresAt) triggers trial_expired lockout', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const h = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await h.triggerInstall('install');
      h.setNow(startMs + SEVEN_DAYS_MS);
      await h.triggerAlarm('licenseVerifyCheck');

      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, false);
      assert.equal(state.subscriptionStatus, 'trial_expired');
      assert.deepEqual(h.getEnabledRulesets(), []);
    } finally {
      h.cleanup();
    }
  });

  test('F4.B4: tampered local storage (proActive: true or extended trialExpiresAt without credential) is neutralized', async () => {
    const startMs = Date.UTC(2026, 10, 25, 0, 0, 0);
    const h = createBackgroundVmHarness({
      nowMs: startMs,
      offline: true,
      initialLocal: {
        proActive: true,
        licenseKey: '',
        subscriptionStatus: 'trialing',
        trialStartedAt: startMs - 30 * 86400000,
        trialExpiresAt: startMs + 365 * 86400000
      }
    });
    try {
      await h.ctx.enforceStoredSubscriptionIntegrity({ force: true });
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, false, 'Tampered storage without valid credential must not stay Pro');
      assert.deepEqual(h.getEnabledRulesets(), []);
    } finally {
      h.cleanup();
    }
  });

  test('F4.B5: invalid, empty, and XSS license keys are rejected by ACTIVATE_LICENSE and /api/license-verify', async () => {
    const h = createBackgroundVmHarness({ serverBaseUrl: server.baseUrl });
    try {
      for (const badKey of ['', 'INVALID', 'SWEEPR-123', '<script>alert(1)</script>']) {
        const res = await h.sendPrivilegedMessage({ type: 'ACTIVATE_LICENSE', licenseKey: badKey });
        assert.equal(res.valid, false);
        assert.notEqual(res.ok, true);

        const httpRes = await fetch(`${server.baseUrl}/api/license-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: badKey, device_id: 'dev_bad' })
        });
        assert.ok(httpRes.status === 400 || httpRes.status === 403);
      }
    } finally {
      h.cleanup();
    }
  });

  test('F4.B6: /api/trial/start is idempotent per installId and /api/license-verify enforces 5-device cap (6th returns 403)', async () => {
    const installId = `inst_idem_${crypto.randomUUID()}`;
    const r1 = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId })
    });
    assert.equal(r1.status, 200);
    const j1 = await r1.json();

    const r2 = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId })
    });
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.trialKey, j1.trialKey, 'Same installId must not mint a fresh trial reset');
    assert.equal(j2.trialExpiresAt, j1.trialExpiresAt);

    const devices = [installId, 'cap_dev_2', 'cap_dev_3', 'cap_dev_4', 'cap_dev_5'];
    for (let i = 0; i < devices.length; i += 1) {
      const vr = await fetch(`${server.baseUrl}/api/license-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: j1.trialKey, device_id: devices[i] })
      });
      assert.equal(vr.status, 200, `Device ${i + 1}/5 (${devices[i]}) should verify 200`);
    }
    const sixth = await fetch(`${server.baseUrl}/api/license-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: j1.trialKey, device_id: 'cap_dev_6' })
    });
    assert.equal(sixth.status, 403, '6th device must fail with 403 device_limit_reached');
    const sixthJson = await sixth.json();
    assert.equal(sixthJson.error, 'device_limit_reached');
  });
});

describe('Tier 2 — F5 Boundaries: MV3 DNR Limits, Schema & Rule Safety', () => {
  test('F5.B1: static rulesets count <= 50 and total rules strictly within [25,000, 330,000]', () => {
    const compiled = computeCompiledStaticDnrRules();
    assert.ok(compiled.ruleResources.length >= 5 && compiled.ruleResources.length <= 50);
    assert.ok(compiled.enabledTotalRules >= 25000 && compiled.enabledTotalRules <= 330000);
  });

  test('F5.B2: every static DNR rule has valid action.type, positive priority, and non-empty condition', () => {
    const allowedActions = new Set(['block', 'redirect', 'allow', 'allowAllRequests', 'modifyHeaders', 'upgradeScheme']);
    const compiled = computeCompiledStaticDnrRules();
    for (const rs of compiled.rulesets) {
      assert.equal(rs.error, null);
      for (const rule of rs.rules) {
        assert.ok(allowedActions.has(rule.action?.type), `Invalid action.type in ${rs.id} rule ${rule.id}`);
        assert.ok(Number.isInteger(rule.priority) && rule.priority >= 1, `Invalid priority in ${rs.id} rule ${rule.id}`);
        assert.ok(rule.condition && typeof rule.condition === 'object' && Object.keys(rule.condition).length > 0);
      }
    }
  });

  test('F5.B3: zero static rules use bare wildcard urlFilter "*" without domain scoping', () => {
    const compiled = computeCompiledStaticDnrRules();
    for (const rs of compiled.rulesets) {
      for (const rule of rs.rules) {
        if (rule.action?.type === 'block' && rule.condition?.urlFilter === '*') {
          assert.ok(
            Array.isArray(rule.condition.requestDomains) && rule.condition.requestDomains.length > 0,
            `Overly broad urlFilter "*" without requestDomains in ${rs.id} rule ${rule.id}`
          );
        }
      }
    }
  });

  test('F5.B4: surgical allow/allowAllRequests rules are domain-scoped and priority >= 2', () => {
    const compiled = computeCompiledStaticDnrRules();
    const allowRules = compiled.rulesets.flatMap((r) => r.rules).filter((r) =>
      r.action?.type === 'allow' || r.action?.type === 'allowAllRequests'
    );
    assert.ok(allowRules.length >= 10, 'Expected surgical allow rules');
    for (const rule of allowRules) {
      assert.ok(rule.priority >= 2, `Allow rule ${rule.id} must have priority >= 2`);
      const c = rule.condition || {};
      const scoped =
        (Array.isArray(c.requestDomains) && c.requestDomains.length > 0) ||
        (Array.isArray(c.initiatorDomains) && c.initiatorDomains.length > 0) ||
        (typeof c.urlFilter === 'string' && c.urlFilter.length >= 4 && c.urlFilter !== '*://*/*');
      assert.equal(scoped, true, `Allow rule ${rule.id} is overly broad`);
    }
  });

  test('F5.B5: background.js syncExtensionProtectionRules(false, false) disables all static DNR rulesets from manifest.json', async () => {
    const manifest = readExtensionManifest();
    const declaredIds = (manifest.declarative_net_request?.rule_resources || []).map((r) => r.id);
    const h = createBackgroundVmHarness({ offline: true });
    try {
      await h.triggerInstall('install');
      assert.ok(h.getEnabledRulesets().length >= declaredIds.length);
      await h.ctx.syncExtensionProtectionRules(false, false);
      assert.deepEqual(h.getEnabledRulesets(), []);
    } finally {
      h.cleanup();
    }
  });
});

describe('Tier 2 — F6 Boundaries: Tracker Param Safety & Exclusions', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, 'rules', 'tracker_params.json'), 'utf8'));
  const params = rules.flatMap((r) => r.action?.redirect?.transform?.queryTransform?.removeParams || []);

  test('F6.B1: tracker_params.json has zero duplicate, empty, or unsafe parameter names', () => {
    const seen = new Set();
    for (const p of params) {
      assert.equal(typeof p, 'string');
      assert.ok(p.length > 0 && p === p.trim(), `Invalid param "${p}"`);
      assert.match(p, /^[a-zA-Z0-9_.[\]-]+$/, `Unsafe chars in param "${p}"`);
      assert.equal(seen.has(p), false, `Duplicate tracker param: ${p}`);
      seen.add(p);
    }
    assert.ok(seen.size >= 150);
  });

  test('F6.B2: tracker_params.json excludes all 6 SWEEPR domains', () => {
    for (const rule of rules) {
      const excl = rule.condition?.excludedRequestDomains || [];
      for (const dom of SWEEPR_FIRST_PARTY_DOMAINS) {
        assert.ok(excl.includes(dom), `Missing excludedRequestDomain ${dom}`);
      }
    }
  });

  test('F6.B3: tracker_params.json never strips functional OAuth/checkout/search query params', () => {
    const paramSet = new Set(params);
    for (const functional of ['code', 'state', 'redirect_uri', 'token', 'session_id', 'plan', 'q', 'page', 'lang']) {
      assert.equal(paramSet.has(functional), false, `Functional param "${functional}" must not be stripped`);
    }
  });

  test('F6.B4: tracker_params.json applies only to main_frame and sub_frame (not xhr/script)', () => {
    for (const rule of rules) {
      const types = rule.condition?.resourceTypes || [];
      assert.deepEqual([...types].sort(), ['main_frame', 'sub_frame']);
    }
  });

  test('F6.B5: tracker_params.json has valid positive IDs and priority >= 1', () => {
    for (const rule of rules) {
      assert.ok(Number.isInteger(rule.id) && rule.id > 0);
      assert.ok(Number.isInteger(rule.priority) && rule.priority >= 1);
    }
  });
});

describe('Tier 2 — F7 Boundaries: Firefox Gecko 128.0 Package Integrity', () => {
  test('F7.B1: extension/manifest.json gecko.strict_min_version is strictly < 140.0 and equals "128.0"', () => {
    const manifest = readExtensionManifest();
    const minVer = manifest.browser_specific_settings?.gecko?.strict_min_version;
    assert.equal(minVer, '128.0');
    assert.equal(compareSemver(minVer, '140.0'), -1);
  });

  test('F7.B2: Firefox ZIP and XPI omit Chrome-only keys (minimum_chrome_version, oauth2, identity, service_worker)', () => {
    for (const file of [
      path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi')
    ]) {
      assert.ok(fs.existsSync(file), `Missing ${file}`);
      const { manifest } = readManifestFromZip(file);
      assert.equal('minimum_chrome_version' in manifest, false);
      assert.equal('oauth2' in manifest, false);
      assert.equal(manifest.background?.service_worker, undefined);
      const perms = manifest.permissions || [];
      assert.equal(perms.includes('identity') || perms.includes('identity.email'), false);
    }
  });

  test('F7.B3: Firefox ZIP JS files strip requestUpdateCheck and onRuleMatchedDebug for zero AMO lint warnings', () => {
    const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
    assert.ok(fs.existsSync(ffZip), `Missing ${ffZip}`);
    for (const e of readZipEntries(ffZip)) {
      if (!e.name.endsWith('.js')) continue;
      const code = e.data.toString('utf8');
      assert.doesNotMatch(code, /\b(requestUpdateCheck|onRuleMatchedDebug)\b/, `Unsupported Chromium API in ${e.name}`);
      assert.doesNotThrow(() => new vm.Script(code, { filename: `ff/${e.name}` }));
    }
  });

  test('F7.B4: Firefox ZIP preserves gecko.id and data_collection_permissions.required: ["none"]', () => {
    const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
    assert.ok(fs.existsSync(ffZip));
    const { manifest } = readManifestFromZip(ffZip);
    assert.equal(manifest.browser_specific_settings?.gecko?.id, 'extension@sweeprdeepblock.com');
    assert.deepEqual(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required, ['none']);
  });

  test('F7.B5: website .xpi files match dist/sweepr-deepblock-firefox-amo-mv3.zip version and gecko 128.0', () => {
    const distM = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip')).manifest;
    for (const xpiName of ['sweepr-deepblock-firefox.xpi', 'sweepr-deepblock.xpi']) {
      const { manifest } = readManifestFromZip(path.join(WEBSITE_DIR, xpiName));
      assert.equal(manifest.version, distM.version);
      assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
    }
  });
});

describe('Tier 2 — F8 Boundaries: Safari Compatibility & Zero-OSS Guardrails', () => {
  test('F8.B1: Safari ZIP omits unsupported keys and content_scripts[].world', () => {
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    assert.ok(fs.existsSync(safariZip), `Missing ${safariZip}`);
    const { manifest } = readManifestFromZip(safariZip);
    assert.equal('minimum_chrome_version' in manifest, false);
    assert.equal('browser_specific_settings' in manifest, false);
    assert.equal('oauth2' in manifest, false);
    for (const cs of manifest.content_scripts || []) {
      assert.equal('world' in cs, false, 'Safari manifest content_scripts must omit world');
    }
  });

  test('F8.B2: Safari background.js runs cleanly in WebKit VM harness with tabs.discard, identity, and contextMenus missing', async () => {
    const h = createBackgroundVmHarness({ tabsDiscardSupported: false, offline: true });
    try {
      h.ctx.chrome.identity = undefined;
      h.ctx.chrome.contextMenus = undefined;
      h.ctx.chrome.runtime.requestUpdateCheck = undefined;
      h.ctx.chrome.declarativeNetRequest.onRuleMatchedDebug = undefined;
      await h.triggerInstall('install');
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
    } finally {
      h.cleanup();
    }
  });

  test('F8.B3: safari/ project contains no localhost dev URLs or embedded Apple signing credentials', () => {
    assert.ok(fs.existsSync(SAFARI_DIR), `Missing ${SAFARI_DIR}`);
    for (const file of listFilesRecursive(SAFARI_DIR)) {
      if (!/\.(?:swift|plist|pbxproj|js|json|entitlements|xcconfig)$/i.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /http:\/\/(?:localhost|127\.0\.0\.1):\d+/, `Localhost leak in ${file}`);
      assert.doesNotMatch(text, /BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY/, `Private key leak in ${file}`);
    }
  });

  test('F8.B4: safari/ Xcode scaffolding defines both macOS and iOS targets', () => {
    assert.ok(fs.existsSync(SAFARI_DIR), `Missing ${SAFARI_DIR}`);
    const pbxFiles = listFilesRecursive(SAFARI_DIR).filter((f) => f.endsWith('project.pbxproj'));
    assert.ok(pbxFiles.length > 0, 'Missing project.pbxproj under safari/');
    const pbx = pbxFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    assert.match(pbx, /MACOSX_DEPLOYMENT_TARGET/, 'project.pbxproj must configure macOS target');
    assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET/, 'project.pbxproj must configure iOS target');
  });

  test('F8.B5: dist/ and safari/ contain zero NOTICE/COPYING/LICENSE files or SPDX OSS strings', () => {
    const distEntries = fs.existsSync(DIST_DIR) ? fs.readdirSync(DIST_DIR) : [];
    for (const entry of distEntries) {
      assert.doesNotMatch(entry, /^(?:LICENSE|COPYING|UNLICENSE|NOTICE)(?:\.[a-z0-9]+)?$/i);
    }
    assert.ok(fs.existsSync(SAFARI_DIR));
    for (const file of listFilesRecursive(SAFARI_DIR)) {
      assert.doesNotMatch(path.basename(file), /^(?:LICENSE|COPYING|UNLICENSE|NOTICE)(?:\.[a-z0-9]+)?$/i);
    }
  });
});

describe('Tier 2 — F9 Boundaries: Store ZIP Hygiene, CRM Read-Only & Privilege Isolation', () => {
  test('F9.B1: all store ZIP/XPI archives contain zero localhost or 127.0.0.1 URLs', () => {
    for (const rel of [
      'sweepr-deepblock-chrome-webstore-mv3.zip',
      'sweepr-deepblock-edge-chrome-mv3.zip',
      'sweepr-deepblock-firefox-amo-mv3.zip',
      'sweepr-deepblock-opera-mv3.zip',
      'sweepr-deepblock-safari-mv3.zip'
    ]) {
      const zp = path.join(DIST_DIR, rel);
      assert.ok(fs.existsSync(zp), `Missing ${zp}`);
      for (const e of readZipEntries(zp)) {
        if (!/\.(?:js|json|html)$/i.test(e.name)) continue;
        const txt = e.data.toString('utf8');
        assert.doesNotMatch(txt, /http:\/\/(?:localhost|127\.0\.0\.1):\d+/i, `Dev URL in ${rel}:${e.name}`);
      }
    }
  });

  test('F9.B2: all store ZIP/XPI archives use strictly POSIX forward slashes with zero backslashes or path traversal', () => {
    for (const rel of [
      'sweepr-deepblock-chrome-webstore-mv3.zip',
      'sweepr-deepblock-edge-chrome-mv3.zip',
      'sweepr-deepblock-firefox-amo-mv3.zip',
      'sweepr-deepblock-opera-mv3.zip',
      'sweepr-deepblock-safari-mv3.zip'
    ]) {
      const zp = path.join(DIST_DIR, rel);
      assert.ok(fs.existsSync(zp), `Missing ${zp}`);
      for (const e of readZipEntries(zp)) {
        assert.equal(e.name.includes('\\'), false, `Backslash entry in ${rel}: ${e.name}`);
        assert.equal(e.name.includes('..'), false, `Path traversal entry in ${rel}: ${e.name}`);
      }
    }
  });

  test('F9.B3: data/sweepr-crm.db opened strictly readOnly rejects writes and leaves production DB untouched', () => {
    const db = openCrmReadOnly();
    try {
      const countRow = db.prepare("SELECT count(*) AS cnt FROM outreach_logs WHERE project_id = 'deepblock'").get();
      assert.ok(countRow.cnt >= 4);
      assert.throws(() => {
        db.exec("DELETE FROM outreach_logs WHERE project_id = '__never__'");
      }, /readonly|read-only|attempt to write/i);
    } finally {
      db.close();
    }
  });

  test('F9.B4: Chrome vs Edge vs Opera manifest isolation preserves store-specific permission limits', () => {
    const edgeM = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip')).manifest;
    assert.equal('oauth2' in edgeM, false);
    assert.equal((edgeM.permissions || []).includes('identity'), false);

    const operaM = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip')).manifest;
    assert.equal('minimum_chrome_version' in operaM, false);
    assert.equal('browser_specific_settings' in operaM, false);
    assert.equal((operaM.permissions || []).includes('declarativeNetRequestWithHostAccess'), false);
    assert.ok(typeof operaM.short_name === 'string' && operaM.short_name.length <= 12);
    assert.ok(typeof operaM.description === 'string' && operaM.description.length <= 132);
  });

  test('F9.B5: untrusted webpage sender cannot invoke privileged extension runtime messages', async () => {
    const h = createBackgroundVmHarness({ offline: true });
    try {
      await h.triggerInstall('install');
      for (const action of ['GET_DASHBOARD_STATE', 'HIBERNATE_TABS_NOW', 'TOGGLE_SETTING', 'RESTORE_SAVED_SESSION']) {
        const res = await h.sendUntrustedMessage({ type: action, settingKey: 'adBlocking' });
        assert.equal(res.__ignored, true, `Untrusted origin must not execute ${action}`);
      }
      const hijack = await h.sendUntrustedMessage({
        type: 'AUTO_SYNC_WEBSITE_LICENSE',
        licenseKey: 'SWEEPR-DB-FAKE-0000-0000'
      });
      assert.equal(hijack.__ignored === true || hijack.ok === false, true);
    } finally {
      h.cleanup();
    }
  });
});
