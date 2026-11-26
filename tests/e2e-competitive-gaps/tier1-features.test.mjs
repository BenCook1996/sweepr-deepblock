import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ROOT,
  WEBSITE_DIR,
  EXTENSION_DIR,
  DIST_DIR,
  SAFARI_DIR,
  SCRIPTS_DIR,
  SWEEPR_FIRST_PARTY_DOMAINS,
  PRE_EXISTING_WORKSPACE_PATHS,
  EXPECTED_SETUP_EXE_SHA256,
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
  getIndexableVsPaths,
  resolveWebsiteHtmlPath,
  findStaleDeepblockVersions,
  inspectCmpCoverage,
  extractClaimedCmpCounts,
  createBackgroundVmHarness,
  createContentScriptVmHarness,
  openCrmReadOnly,
  listFilesRecursive,
  findOssLicenseViolationsInDirectory,
  findOssLicenseViolationsInZip
} from './helpers.mjs';

let server;

before(async () => {
  server = await startEphemeralServer();
});

after(async () => {
  if (server) await server.stop();
});

describe('Tier 1 — F1: Website Benchmark Contradictions & Spec Sync', () => {
  test('F1.1: benchmarks.html lists AdGuard Extension Transparent Annual Price as Free matching vs/adguard-extension.html', () => {
    const benchmarksHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const adguardVsHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'vs', 'adguard-extension.html'), 'utf8');
    const benchTables = parseHtmlTables(benchmarksHtml);
    const adguardTables = parseHtmlTables(adguardVsHtml);

    const benchCell = findTableCell(benchTables, /AdGuard\s+Extension/i, /Transparent\s+Annual\s+Price/i);
    assert.ok(benchCell, 'benchmarks.html missing AdGuard Extension -> Transparent Annual Price cell');
    assert.match(benchCell.value, /\bfree\b/i, `Expected AdGuard Extension price to be Free, got: "${benchCell.value}"`);
    assert.doesNotMatch(benchCell.value, /(?:£|\$|€)\s*\d|\/mo|\/yr/i, `AdGuard Extension should not show paid price: "${benchCell.value}"`);

    const vsCell = findTableCell(adguardTables, /AdGuard.*Extension/i, /^Pricing$/i);
    assert.ok(vsCell, 'vs/adguard-extension.html missing AdGuard MV3 Extension Pricing cell');
    assert.match(vsCell.value, /\bfree\b/i);
  });

  test('F1.2: benchmarks.html Total Adblock Automated CMP Cookie Rejector aligns with vs/total-adblock.html', () => {
    const benchmarksHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const totalVsHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'vs', 'total-adblock.html'), 'utf8');
    const benchTables = parseHtmlTables(benchmarksHtml);
    const totalTables = parseHtmlTables(totalVsHtml);

    const benchCell = findTableCell(benchTables, /Total\s+Adblock/i, /Automated\s+CMP\s+Cookie\s+Rejector/i);
    assert.ok(benchCell, 'benchmarks.html missing Total Adblock -> Automated CMP Cookie Rejector cell');
    assert.notEqual(
      benchCell.value.trim().toLowerCase(),
      'no',
      'benchmarks.html must not claim "No" for Total Adblock cookie handling when vs/total-adblock.html documents Pro-tier banner hiding'
    );
    assert.doesNotMatch(
      benchCell.value,
      /^\s*(?:no\b|none\b|not\s+supported|does\s+not|without\b)/i,
      `benchmarks.html must not negate Total Adblock cookie handling: "${benchCell.value}"`
    );
    assert.match(
      benchCell.value,
      /(banner\s+hiding|pro\s+tier|partial|hide|cosmetic)/i,
      `Expected Total Adblock cookie cell to reflect Pro-tier banner hiding, got: "${benchCell.value}"`
    );

    const vsCell = findTableCell(totalTables, /^Total\s+Adblock$/i, /Cookie\s+Pop-Up\s+Handling/i);
    assert.ok(vsCell, 'vs/total-adblock.html missing Total Adblock Cookie Pop-Up Handling cell');
    assert.match(vsCell.value, /banner\s+hiding/i);
  });

  test('F1.3: benchmarks.html title, meta, JSON-LD, and tables match manifest.version and compiled static rule count', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'benchmarks.html'), 'utf8');
    const visible = extractVisibleText(html);

    assert.equal(findStaleDeepblockVersions(html, manifest.version).length, 0, 'benchmarks.html contains stale Deepblock versions');
    assert.ok(visible.includes(manifest.version), `benchmarks.html visible text must include ${manifest.version}`);
    assert.ok(!/\b283\s+static\b/i.test(visible), 'benchmarks.html must not contain stale "283 static" rule count');
    const formattedCount = compiled.enabledTotalRules.toLocaleString('en-US');
    assert.ok(
      visible.includes(String(compiled.enabledTotalRules)) || visible.includes(formattedCount),
      `benchmarks.html must display compiled static rule count (${compiled.enabledTotalRules} / ${formattedCount})`
    );

    const { blocks, errors } = extractJsonLdBlocks(html);
    assert.deepEqual(errors, []);
    const versions = collectJsonLdFields(blocks, ['softwareVersion', 'version']);
    assert.ok(versions.length >= 2, 'benchmarks.html must expose SoftwareApplication.softwareVersion and Dataset.version');
    for (const v of versions) {
      assert.equal(v.value, manifest.version, `JSON-LD ${v.key} should equal ${manifest.version}`);
    }
  });

  test('F1.4: pricing.html highlights no-card 7-day full Pro trial and removes stale paid-only install copy', () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'pricing.html'), 'utf8');
    const visible = extractVisibleText(html);
    assert.equal(/7[- ]day\b/i.test(visible), true, 'pricing.html must advertise 7-day trial');
    assert.equal(/(no\s+(credit\s+)?card|without\s+a?\s*card|card[- ]free)/i.test(visible), true, 'pricing.html must state no card required');
    assert.equal(/Live Detection Preview\s*\(No Account\)/i.test(visible), false, 'pricing.html must replace stale preview-only install table cell');
  });

  test('F1.5: download.html, vs/index.html, and vs/total-adblock.html reflect no-card 7-day full Pro trial instead of paid-only install copy', () => {
    for (const rel of ['download.html', 'vs/index.html', 'vs/total-adblock.html']) {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8');
      const visible = extractVisibleText(html);
      assert.equal(/7[- ]day\b/i.test(visible), true, `${rel} must mention 7-day full Pro trial`);
      assert.equal(/(no\s+(credit\s+)?card|without\s+a?\s*card|card[- ]free)/i.test(visible), true, `${rel} must state no card required`);
      assert.equal(
        /active\s+paid\s+Pro\s+subscription\s+is\s+required\s+to\s+unlock\s+protection\s+modules/i.test(visible),
        false,
        `${rel} still contains stale paid-only install contradiction`
      );
    }
  });
});

describe('Tier 1 — F2: Extension Version Bump (> 1.3.2) & Cross-Page/Feed/API Sync', () => {
  test('F2.1: extension/manifest.json has a valid GA semver strictly greater than 1.3.2', () => {
    const manifest = readExtensionManifest();
    assert.ok(isStrictGaSemver(manifest.version), `manifest.version "${manifest.version}" must be X.Y.Z semver`);
    assert.equal(compareSemver(manifest.version, '1.3.2'), 1, `manifest.version (${manifest.version}) must be > 1.3.2`);
  });

  test('F2.2: all indexable /vs pages in sitemap.xml match manifest.version with zero stale versions', () => {
    const manifest = readExtensionManifest();
    const vsPaths = getIndexableVsPaths();
    assert.ok(vsPaths.length >= 9, `Expected >= 9 indexable /vs paths, got ${vsPaths.length}`);

    for (const urlPath of vsPaths) {
      const filePath = resolveWebsiteHtmlPath(urlPath);
      assert.ok(fs.existsSync(filePath), `Missing file for sitemap path ${urlPath}`);
      const html = fs.readFileSync(filePath, 'utf8');
      const stale = findStaleDeepblockVersions(html, manifest.version);
      assert.deepEqual(stale, [], `${urlPath} contains stale version references: ${stale.join(', ')}`);

      const { blocks, errors } = extractJsonLdBlocks(html);
      assert.deepEqual(errors, [], `JSON-LD parse error on ${urlPath}`);
      const swVersions = collectJsonLdFields(blocks, ['softwareVersion']);
      assert.ok(swVersions.length > 0, `${urlPath} missing JSON-LD softwareVersion`);
      for (const field of swVersions) {
        assert.equal(field.value, manifest.version, `${urlPath} JSON-LD softwareVersion mismatch`);
      }
    }
  });

  test('F2.3: pricing.html and download.html match manifest.version and static rule count with zero stale 1.3.1/1.3.2', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const formattedCount = compiled.enabledTotalRules.toLocaleString('en-US');

    for (const file of ['pricing.html', 'download.html']) {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, file), 'utf8');
      const visible = extractVisibleText(html);
      assert.deepEqual(findStaleDeepblockVersions(html, manifest.version), [], `${file} has stale version`);
      assert.ok(visible.includes(manifest.version), `${file} must display ${manifest.version}`);
      assert.ok(
        visible.includes(String(compiled.enabledTotalRules)) || visible.includes(formattedCount),
        `${file} must display compiled static rule count ${compiled.enabledTotalRules}`
      );
      assert.ok(!/\b283\s+(?:bundled\s+)?static\b/i.test(visible), `${file} has stale 283 static count`);
    }
  });

  test('F2.4: machine-readable feeds (geo-benchmark-feed.json, llms.txt, llms-full.txt, pad.xml) match manifest.version and static rule count', () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const formattedCount = compiled.enabledTotalRules.toLocaleString('en-US');

    const geoFeed = JSON.parse(fs.readFileSync(path.join(WEBSITE_DIR, 'geo-benchmark-feed.json'), 'utf8'));
    assert.equal(geoFeed.version, manifest.version);
    assert.equal(geoFeed.telemetrySummary?.extensionVersion, manifest.version);
    assert.equal(geoFeed.telemetrySummary?.staticDnrRules, compiled.enabledTotalRules);

    for (const textFeed of ['llms.txt', 'llms-full.txt', 'pad.xml']) {
      const raw = fs.readFileSync(path.join(WEBSITE_DIR, textFeed), 'utf8');
      assert.deepEqual(findStaleDeepblockVersions(raw, manifest.version), [], `${textFeed} has stale Deepblock version`);
      assert.ok(raw.includes(manifest.version), `${textFeed} must include ${manifest.version}`);
      assert.ok(
        raw.includes(String(compiled.enabledTotalRules)) || raw.includes(formattedCount),
        `${textFeed} must include static rule count ${compiled.enabledTotalRules}`
      );
    }
  });

  test('F2.5: live ephemeral server.js /api/version, /api/filters/delta, and /api/telemetry/live-proof match manifest.version and compiled static rules', async () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);

    const verRes = await fetch(`${server.baseUrl}/api/version?current_version=1.3.2`);
    assert.equal(verRes.status, 200);
    const verJson = await verRes.json();
    assert.equal(verJson.version, manifest.version);
    assert.equal(verJson.latest_version, manifest.version);
    assert.equal(verJson.update_available, true);

    const deltaRes = await fetch(`${server.baseUrl}/api/filters/delta?current_version=${manifest.version}`);
    assert.equal(deltaRes.status, 200);
    const deltaJson = await deltaRes.json();
    assert.equal(deltaJson.latestExtensionVersion, manifest.version);

    const proofRes = await fetch(`${server.baseUrl}/api/telemetry/live-proof`);
    assert.equal(proofRes.status, 200);
    const proofJson = await proofRes.json();
    assert.equal(proofJson.version, manifest.version);
    assert.equal(proofJson.activeMv3StaticRules, compiled.enabledTotalRules);
    assert.equal(proofJson.rulesetsActive, compiled.enabledResources.length);
  });
});

describe('Tier 1 — F3: CMP Coverage Expansion (150+ Frameworks) & Website Claim Alignment', () => {
  test('F3.1: deepblock-content.js implements >= 150 documented CMP frameworks/selectors and preserves Shadow-DOM marker', () => {
    const cmp = inspectCmpCoverage();
    assert.equal(cmp.hasShadowCommentMarker, true, 'Pre-existing Shadow-DOM comment marker must be preserved');
    assert.ok(
      cmp.frameworkCount >= 150,
      `Expected >= 150 documented CMP frameworks/selectors in deepblock-content.js, found ${cmp.frameworkCount}`
    );
  });

  test('F3.2: website CMP claims on benchmarks.html, pricing.html, download.html, and vs/*.html match implemented CMP count', () => {
    const cmp = inspectCmpCoverage();
    assert.ok(cmp.frameworkCount >= 150, `Implemented CMP count (${cmp.frameworkCount}) must be >= 150`);

    const requiredClaimPages = new Set(['benchmarks.html', 'pricing.html', 'download.html']);
    for (const rel of ['benchmarks.html', 'pricing.html', 'download.html', 'vs/index.html', 'vs/total-adblock.html', 'vs/adguard-extension.html']) {
      const visible = extractVisibleText(fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8'));
      const claimed = extractClaimedCmpCounts(visible);
      if (requiredClaimPages.has(rel)) {
        assert.ok(claimed.length > 0, `${rel} should state verified CMP framework count`);
      }
      for (const n of claimed) {
        assert.ok(
          n <= cmp.frameworkCount,
          `${rel} claims ${n}+ CMPs which exceeds implemented count (${cmp.frameworkCount})`
        );
        if (requiredClaimPages.has(rel)) {
          assert.ok(n >= 150, `${rel} CMP count ${n} should reflect 150+ expansion`);
        }
      }
    }
  });

  test('F3.3: deepblock-content.js auto-rejects OneTrust / Cookiebot banners during active trial/Pro in VM DOM harness', async () => {
    let rejectBtn;
    const h = createContentScriptVmHarness({
      storageState: {
        proActive: true,
        subscriptionStatus: 'trialing',
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0001',
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
      assert.equal(rejectBtn.clicked, true, 'OneTrust Reject All button should be clicked during active trial/Pro');
      assert.ok(h.metrics.some((m) => m.metric === 'cookiePromptsRejected'));
    } finally {
      h.cleanup();
    }
  });

  test('F3.4: deepblock-content.js traverses Shadow DOM to reject Usercentrics banner', async () => {
    let shadowRejectBtn;
    const h = createContentScriptVmHarness({
      storageState: {
        proActive: true,
        subscriptionStatus: 'trialing',
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0002',
        pausedSites: [],
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      setupDom: ({ bodyEl, createElement }) => {
        const host = createElement('div', { id: 'usercentrics-root' });
        const shadow = host.attachShadow({ mode: 'open' });
        shadowRejectBtn = createElement('button', {
          attributes: { 'aria-label': 'Reject All' },
          textContent: 'Reject All'
        });
        shadow.appendChild(shadowRejectBtn);
        bodyEl.appendChild(host);
      }
    });
    try {
      await h.flush();
      assert.equal(shadowRejectBtn.clicked, true, 'Shadow-DOM CMP reject button must be clicked');
    } finally {
      h.cleanup();
    }
  });

  test('F3.5: deepblock-content.js restores overflow: auto scroll lock on body and html after rejecting CMP banner', async () => {
    const h = createContentScriptVmHarness({
      bodyOverflow: 'hidden',
      htmlOverflow: 'hidden',
      storageState: {
        proActive: true,
        subscriptionStatus: 'trialing',
        licenseKey: 'SWEEPR-DB-TRIAL-2026-0003',
        pausedSites: [],
        settings: { adBlocking: true, cookieAutoClose: true }
      },
      setupDom: ({ bodyEl, createElement }) => {
        const banner = createElement('div', { id: 'CybotCookiebotDialog' });
        const btn = createElement('button', { id: 'CybotCookiebotDialogBodyButtonDecline', textContent: 'Decline' });
        banner.appendChild(btn);
        bodyEl.appendChild(banner);
      }
    });
    try {
      await h.flush();
      assert.equal(h.bodyEl.style.overflow, 'auto', 'Body overflow: hidden must be unlocked to auto');
      assert.equal(h.htmlEl.style.overflow, 'auto', 'HTML overflow: hidden must be unlocked to auto');
    } finally {
      h.cleanup();
    }
  });
});

describe('Tier 1 — F4: No-Card 7-Day Full Pro Trial Lifecycle & Expiry Gating', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  test('F4.1: fresh install auto-starts no-card 7-day full Pro trial immediately', async () => {
    const startMs = Date.UTC(2026, 10, 25, 10, 0, 0);
    const h = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await h.triggerInstall('install');
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true, 'Fresh install must activate Pro immediately without payment');
      assert.equal(state.subscriptionStatus, 'trialing');
      assert.equal(Number(state.trialStartedAt), startMs);
      assert.equal(Number(state.trialExpiresAt), startMs + SEVEN_DAYS_MS);
    } finally {
      h.cleanup();
    }
  });

  test('F4.2: active 7-day trial enables all static DNR rulesets, YouTube Shield, Cookie Auto-Reject, RAM Tamer, and 5-device sync', async () => {
    const manifest = readExtensionManifest();
    const expectedRulesetIds = (manifest.declarative_net_request?.rule_resources || []).map((r) => r.id);
    const h = createBackgroundVmHarness({ offline: true });
    try {
      await h.triggerInstall('install');
      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
      assert.equal(state.settings.adBlocking, true);
      assert.equal(state.settings.cookieAutoClose, true);
      assert.equal(state.settings.trackerProtection, true);
      assert.equal(state.settings.autoRamTamer, true);
      assert.equal(state.settings.cloudTabSyncEnabled, true);

      const enabled = h.getEnabledRulesets();
      for (const id of expectedRulesetIds) {
        assert.ok(enabled.includes(id), `Expected ruleset ${id} enabled during active trial, got [${enabled.join(', ')}]`);
      }

      const scripts = h.getRegisteredScripts();
      assert.ok(scripts.some((s) => s.id === 'deepstealth-main'), 'YouTube/anti-adblock deepstealth-main must be registered during trial');
    } finally {
      h.cleanup();
    }
  });

  test('F4.3: HIBERNATE_TABS_NOW, TOGGLE_SETTING, and RESTORE_SAVED_SESSION succeed during active 7-day trial', async () => {
    const h = createBackgroundVmHarness({
      offline: true,
      tabs: [
        { id: 1, active: true, pinned: false, audible: false, discarded: false, url: 'https://example.com/' },
        { id: 2, active: false, pinned: false, audible: false, discarded: false, url: 'https://news.example.org/article' }
      ],
      initialLocal: {
        cloudTabSessions: [{ id: 'sess_1', tabs: [{ url: 'https://example.org/article' }] }]
      }
    });
    try {
      await h.triggerInstall('install');
      const hibRes = await h.sendPrivilegedMessage({ type: 'HIBERNATE_TABS_NOW' });
      assert.equal(hibRes.ok, true, 'HIBERNATE_TABS_NOW must succeed during active 7-day trial');
      assert.notEqual(hibRes.requiresPro, true, 'HIBERNATE_TABS_NOW must not be gated during active 7-day trial');
      assert.ok(hibRes.newlyDiscarded >= 1, `Expected >= 1 idle tab discarded, got ${hibRes.newlyDiscarded}`);

      const toggleRes = await h.sendPrivilegedMessage({ type: 'TOGGLE_SETTING', settingKey: 'cookieAutoClose' });
      assert.equal(toggleRes.ok, true);
      await h.sendPrivilegedMessage({ type: 'TOGGLE_SETTING', settingKey: 'cookieAutoClose' });

      const restoreRes = await h.sendPrivilegedMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: 'sess_1' });
      assert.equal(restoreRes.ok, true);
      assert.equal(restoreRes.restoredCount, 1);
    } finally {
      h.cleanup();
    }
  });

  test('F4.4: reaching 7-day expiry disables Pro, gates all 5 Pro features, disables static DNR rulesets, and unregisters YouTube Shield', async () => {
    const startMs = Date.UTC(2026, 10, 25, 10, 0, 0);
    const h = createBackgroundVmHarness({ nowMs: startMs, offline: true });
    try {
      await h.triggerInstall('install');
      h.advanceMs(SEVEN_DAYS_MS + 1000);
      await h.triggerAlarm('licenseVerifyCheck');

      const state = await h.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, false, 'Trial must expire after 7 days');
      assert.equal(state.subscriptionStatus, 'trial_expired');
      assert.deepEqual(h.getEnabledRulesets(), [], 'All static DNR rulesets must disable after trial expiry');
      assert.equal(
        h.getRegisteredScripts().some((s) => s.id === 'deepstealth-main'),
        false,
        'deepstealth-main must unregister after trial expiry'
      );

      const hibRes = await h.sendPrivilegedMessage({ type: 'HIBERNATE_TABS_NOW' });
      assert.equal(hibRes.ok, false);
      assert.equal(hibRes.requiresPro, true);

      const toggleRes = await h.sendPrivilegedMessage({ type: 'TOGGLE_SETTING', settingKey: 'cookieAutoClose' });
      assert.equal(toggleRes.ok, false);
      assert.equal(toggleRes.requiresPro, true);

      const restoreRes = await h.sendPrivilegedMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: 'none' });
      assert.equal(restoreRes.ok, false);
      assert.equal(restoreRes.requiresPro, true);
    } finally {
      h.cleanup();
    }
  });

  test('F4.5: deepblock-content.js removes cosmetic ad style, pauses stealth, and skips cookie auto-reject when trial is expired', async () => {
    let rejectBtn;
    const h = createContentScriptVmHarness({
      hostname: 'www.youtube.com',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
      assert.equal(h.hasUniversalCosmeticStyle(), false, 'Universal ad cosmetic CSS must be removed after expiry');
      assert.equal(h.hasYtCosmeticStyle(), false, 'YouTube ad cosmetic CSS must not inject after expiry');
      assert.ok(h.stealthSignals.some((s) => s && s.p === true), 'Stealth paused signal must fire when expired');
      assert.equal(rejectBtn.clicked, false, 'Cookie reject button must NOT be clicked after trial expiry');
    } finally {
      h.cleanup();
    }
  });

  test('F4.6: ephemeral server.js POST /api/trial/start issues 7-day no-card trial key verified by POST /api/license-verify', async () => {
    const manifest = readExtensionManifest();
    const startRes = await fetch(`${server.baseUrl}/api/trial/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: `inst_${crypto.randomUUID()}`, version: manifest.version })
    });
    assert.equal(startRes.status, 200, `Expected 200 from POST /api/trial/start, got ${startRes.status}`);
    const trialJson = await startRes.json();
    assert.equal(trialJson.ok, true);
    assert.ok(typeof trialJson.trialKey === 'string' && trialJson.trialKey.startsWith('SWEEPR-'));
    assert.equal(trialJson.status, 'trialing');
    assert.equal(trialJson.maxDevices, 5);
    assert.ok(Number(trialJson.trialExpiresAt) > Number(trialJson.trialStartedAt));

    const verifyRes = await fetch(`${server.baseUrl}/api/license-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: trialJson.trialKey,
        device_id: 'dev_trial_1',
        device_name: 'Chrome Test',
        platform: 'windows'
      })
    });
    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.valid, true);
    assert.equal(verifyJson.status, 'trialing');
    assert.equal(verifyJson.devices_max, 5);
  });
});

describe('Tier 1 — F5: MV3 Static DNR Rulesets (25k–50k+ within 330k Limit)', () => {
  test('F5.1: manifest.json declares and enables EasyList, EasyPrivacy, Regional DE/FR/ES, Tracker Params, and Cryptominers rulesets', () => {
    const compiled = computeCompiledStaticDnrRules();
    const byId = new Map(compiled.rulesets.map((r) => [r.id, r]));

    for (const reqId of ['ads_and_trackers', 'easyprivacy_trackers', 'regional_eu_filters', 'tracker_param_stripping', 'cryptominers_and_heavy_scripts']) {
      const rs = byId.get(reqId);
      assert.ok(rs, `manifest.json missing static ruleset "${reqId}"`);
      assert.equal(rs.enabled, true, `Ruleset "${reqId}" must be enabled in manifest.json`);
      assert.equal(rs.error, null, `Ruleset "${reqId}" failed load: ${rs.error}`);
      assert.ok(rs.count > 0, `Ruleset "${reqId}" must be non-empty`);
    }
  });

  test('F5.2: compiled static DNR rules total >= 25,000 and <= 330,000 MV3 global limit', () => {
    const compiled = computeCompiledStaticDnrRules();
    assert.ok(
      compiled.enabledTotalRules >= 25000,
      `Expected >= 25,000 enabled static DNR rules, got ${compiled.enabledTotalRules}`
    );
    assert.ok(
      compiled.enabledTotalRules <= 330000,
      `Static DNR rules (${compiled.enabledTotalRules}) exceed MV3 330,000 limit`
    );
  });

  test('F5.3: EasyList, EasyPrivacy, and Regional DE/FR/ES rulesets each contribute substantial curated network rules', () => {
    const compiled = computeCompiledStaticDnrRules();
    const byId = new Map(compiled.rulesets.map((r) => [r.id, r]));

    assert.ok((byId.get('ads_and_trackers')?.count || 0) >= 10000, 'ads_and_trackers (EasyList) should contain >= 10,000 rules');
    assert.ok((byId.get('easyprivacy_trackers')?.count || 0) >= 5000, 'easyprivacy_trackers should contain >= 5,000 rules');
    assert.ok((byId.get('regional_eu_filters')?.count || 0) >= 1000, 'regional_eu_filters (DE/FR/ES) should contain >= 1,000 rules');
  });

  test('F5.4: compiled static rules include surgical anti-breakage allow/allowAllRequests rules with priority > block rules', () => {
    const compiled = computeCompiledStaticDnrRules();
    const allRules = compiled.rulesets.flatMap((r) => r.rules);
    const blockPriorities = allRules.filter((r) => r.action?.type === 'block').map((r) => Number(r.priority || 1));
    const maxStandardBlockPriority = Math.max(1, ...blockPriorities.filter((p) => p < 10));
    const surgicalAllows = (compiled.rulesets.find((r) => r.id === 'ads_and_trackers')?.rules || []).filter(
      (r) => (r.action?.type === 'allow' || r.action?.type === 'allowAllRequests') && Number(r.priority) > maxStandardBlockPriority
    );
    assert.ok(
      surgicalAllows.length >= 10,
      `Expected >= 10 surgical anti-breakage allow rules with priority > ${maxStandardBlockPriority}, got ${surgicalAllows.length}`
    );

    for (const rs of compiled.rulesets) {
      const rsBlockMax = Math.max(
        1,
        ...rs.rules.filter((r) => r.action?.type === 'block').map((r) => Number(r.priority || 1))
      );
      for (const rule of rs.rules.filter((r) => r.action?.type === 'allow' || r.action?.type === 'allowAllRequests')) {
        assert.ok(
          Number(rule.priority) > rsBlockMax,
          `Allow rule ID ${rule.id} in ${rs.id} priority (${rule.priority}) must exceed ruleset block priority (${rsBlockMax})`
        );
      }
    }
  });

  test('F5.5: every static rule has unique positive integer ID, zero data: redirects, and SWEEPR domains excluded from analytics blocking', () => {
    const compiled = computeCompiledStaticDnrRules();
    for (const rs of compiled.rulesets) {
      const seenIds = new Set();
      for (const rule of rs.rules) {
        assert.ok(Number.isInteger(rule.id) && rule.id > 0, `Invalid rule ID ${rule.id} in ${rs.id}`);
        assert.equal(seenIds.has(rule.id), false, `Duplicate rule ID ${rule.id} in ${rs.id}`);
        seenIds.add(rule.id);
        const redirectUrl = rule.action?.redirect?.url || '';
        assert.ok(!/^data:/i.test(redirectUrl), `Disallowed data: redirect URL in ${rs.id} rule ${rule.id}`);
      }
    }

    const adsRules = compiled.rulesets.find((r) => r.id === 'ads_and_trackers')?.rules || [];
    const gaBlockRules = adsRules.filter(
      (r) =>
        r.action?.type === 'block' &&
        /(google-analytics\.com|googletagmanager\.com)/i.test(String(r.condition?.urlFilter || ''))
    );
    assert.ok(gaBlockRules.length > 0, 'Expected Google Analytics/GTM block rules in ads_and_trackers');
    for (const r of gaBlockRules) {
      const excl = r.condition?.excludedInitiatorDomains || [];
      assert.ok(excl.includes('sweeprdeepblock.com'), `GA/GTM block rule ${r.id} must exclude sweeprdeepblock.com`);
    }
    const gaAllowRules = adsRules.filter(
      (r) =>
        r.action?.type === 'allow' &&
        /(google-analytics\.com|googletagmanager\.com)/i.test(String(r.condition?.urlFilter || ''))
    );
    assert.ok(gaAllowRules.length >= 2, 'Expected surgical GA/GTM allow rules for SWEEPR domains');
    for (const r of gaAllowRules) {
      assert.ok(
        (r.condition?.initiatorDomains || []).includes('sweeprdeepblock.com'),
        `GA/GTM allow rule ${r.id} must include sweeprdeepblock.com in initiatorDomains`
      );
    }
  });
});

describe('Tier 1 — F6: Tracker Query Parameter Stripping (150+ Params & SWEEPR Exclusions)', () => {
  function readTrackerRules() {
    const p = path.join(EXTENSION_DIR, 'rules', 'tracker_params.json');
    const rules = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(Array.isArray(rules) && rules.length > 0);
    return rules;
  }

  test('F6.1: tracker_params.json strips >= 150 unique query tracking parameters', () => {
    const rules = readTrackerRules();
    const allParams = rules.flatMap((r) => r.action?.redirect?.transform?.queryTransform?.removeParams || []);
    const unique = new Set(allParams.filter((p) => typeof p === 'string' && p.trim().length > 0));
    assert.ok(unique.size >= 150, `Expected >= 150 unique stripped parameters, got ${unique.size}`);
  });

  test('F6.2: tracker_params.json covers core cross-network tracking parameters', () => {
    const rules = readTrackerRules();
    const paramSet = new Set(rules.flatMap((r) => r.action?.redirect?.transform?.queryTransform?.removeParams || []));
    for (const required of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'ttclid', 'twclid', 'mc_eid', '_hsenc', 'yclid', 'igshid']) {
      assert.ok(paramSet.has(required), `Missing required tracking parameter: ${required}`);
    }
  });

  test('F6.3: tracker_params.json excludes all SWEEPR first-party domains', () => {
    const rules = readTrackerRules();
    for (const rule of rules) {
      const excluded = rule.condition?.excludedRequestDomains || [];
      for (const dom of SWEEPR_FIRST_PARTY_DOMAINS) {
        assert.ok(excluded.includes(dom), `tracker_params rule ${rule.id} must exclude ${dom}`);
      }
    }
  });

  test('F6.4: tracker_params.json uses DNR redirect queryTransform on main_frame and sub_frame', () => {
    const rules = readTrackerRules();
    for (const rule of rules) {
      assert.equal(rule.action?.type, 'redirect');
      assert.ok(Array.isArray(rule.action?.redirect?.transform?.queryTransform?.removeParams));
      assert.ok(rule.condition?.resourceTypes?.includes('main_frame'));
      assert.ok(rule.condition?.resourceTypes?.includes('sub_frame'));
    }
  });

  test('F6.5: website pricing.html, download.html, and vs/index.html reflect 150+ stripped URL parameters', () => {
    const rules = readTrackerRules();
    const paramCount = new Set(rules.flatMap((r) => r.action?.redirect?.transform?.queryTransform?.removeParams || [])).size;
    for (const rel of ['pricing.html', 'download.html', 'vs/index.html']) {
      const visible = extractVisibleText(fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8'));
      assert.equal(/\b20(?:-param|\s+(?:URL\s+)?(?:tracking\s+)?parameters)\b/i.test(visible), false, `${rel} still contains stale 20-param claim`);
      const m = visible.match(/\b(\d+)\+?\s+(?:URL\s+)?(?:tracking\s+)?param/i);
      assert.ok(m, `${rel} should state stripped parameter count`);
      assert.ok(Number.parseInt(m[1], 10) <= paramCount, `${rel} parameter count ${m[1]} exceeds implemented ${paramCount}`);
      assert.ok(Number.parseInt(m[1], 10) >= 150, `${rel} parameter count ${m[1]} should reflect 150+ expansion`);
    }
  });
});

describe('Tier 1 — F7: Firefox strict_min_version 128.0 Compatibility', () => {
  test('F7.1: extension/manifest.json specifies gecko.strict_min_version === "128.0"', () => {
    const manifest = readExtensionManifest();
    assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
  });

  test('F7.2: dist/sweepr-deepblock-firefox-amo-mv3.zip manifest specifies gecko.strict_min_version === "128.0" and matching version', () => {
    const rootManifest = readExtensionManifest();
    const zipPath = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
    assert.ok(fs.existsSync(zipPath), `Missing Firefox AMO ZIP at ${zipPath}`);
    const { manifest } = readManifestFromZip(zipPath);
    assert.equal(manifest.version, rootManifest.version);
    assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
  });

  test('F7.3: website/sweepr-deepblock-firefox.xpi and website/sweepr-deepblock.xpi specify gecko 128.0 and background.scripts', () => {
    const rootManifest = readExtensionManifest();
    for (const name of ['sweepr-deepblock-firefox.xpi', 'sweepr-deepblock.xpi']) {
      const xpiPath = path.join(WEBSITE_DIR, name);
      assert.ok(fs.existsSync(xpiPath), `Missing ${xpiPath}`);
      const { manifest } = readManifestFromZip(xpiPath);
      assert.equal(manifest.version, rootManifest.version);
      assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
      assert.ok(Array.isArray(manifest.background?.scripts) && manifest.background.scripts.includes('background.js'));
      assert.equal(manifest.background?.service_worker, undefined);
    }
  });

  test('F7.4: build-store-packages.mjs and git-deployer.mjs configure Gecko 128.0 without stale 140.0', () => {
    for (const rel of ['build-store-packages.mjs', 'ad-filter-pipeline/git-deployer.mjs']) {
      const src = fs.readFileSync(path.join(SCRIPTS_DIR, rel), 'utf8');
      assert.ok(src.includes("'128.0'") || src.includes('"128.0"'), `${rel} must specify 128.0`);
      assert.doesNotMatch(src, /strict_min_version:\s*['"]140\.0['"]/, `${rel} still hardcodes 140.0`);
    }
  });

  test('F7.5: website/download.html Firefox row displays Gecko 128.0+ without stale Gecko 140.0+', () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'download.html'), 'utf8');
    const visible = extractVisibleText(html);
    assert.equal(/Gecko\s+128\.0\+/i.test(visible), true, 'download.html must display Gecko 128.0+');
    assert.equal(/Gecko\s+140\.0\+/i.test(visible), false, 'download.html must not contain stale Gecko 140.0+');
  });
});

describe('Tier 1 — F8: Safari Web Extension (macOS/iOS) & Strictly Closed-Source Constraint', () => {
  test('F8.1: safari/ contains macOS & iOS Xcode project scaffolding and Swift SafariWebExtensionHandler', () => {
    assert.ok(fs.existsSync(SAFARI_DIR), `Missing safari/ directory at ${SAFARI_DIR}`);
    const files = listFilesRecursive(SAFARI_DIR).map((f) => path.relative(SAFARI_DIR, f).replace(/\\/g, '/'));
    assert.ok(files.some((f) => f.endsWith('project.pbxproj')), 'safari/ missing Xcode project.pbxproj');
    assert.ok(files.some((f) => /SafariWebExtensionHandler\.swift$/i.test(f)), 'safari/ missing Swift SafariWebExtensionHandler.swift');
    assert.ok(files.some((f) => /Info\.plist$/i.test(f)), 'safari/ missing Info.plist');
    assert.ok(files.some((f) => /\.entitlements$/i.test(f)), 'safari/ missing .entitlements');
  });

  test('F8.2: .github/workflows/safari-build.yml configures macOS Xcode Safari build pipeline', () => {
    const wfPath = path.join(ROOT, '.github', 'workflows', 'safari-build.yml');
    assert.ok(fs.existsSync(wfPath), 'Missing .github/workflows/safari-build.yml');
    const yml = fs.readFileSync(wfPath, 'utf8');
    assert.match(yml, /macos-/i, 'safari-build.yml must run on macOS runner');
    assert.match(yml, /(xcodebuild|safari-web-extension-converter)/i, 'safari-build.yml must invoke Xcode / Safari converter');
  });

  test('F8.3: dist/sweepr-deepblock-safari-mv3.zip exists with Safari-compatible manifest matching manifest.version', () => {
    const rootManifest = readExtensionManifest();
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    assert.ok(fs.existsSync(safariZip), `Missing Safari MV3 archive at ${safariZip}`);
    const { manifest } = readManifestFromZip(safariZip);
    assert.equal(manifest.version, rootManifest.version);
    assert.equal('minimum_chrome_version' in manifest, false, 'Safari manifest must omit minimum_chrome_version');
    assert.equal('browser_specific_settings' in manifest, false, 'Safari manifest must omit browser_specific_settings');
    assert.equal('oauth2' in manifest, false, 'Safari manifest must omit oauth2');
    const perms = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])];
    assert.equal(perms.includes('identity'), false, 'Safari manifest must omit identity');
    assert.equal(perms.includes('clipboardRead'), false, 'Safari manifest must omit clipboardRead');
  });

  test('F8.4: all JavaScript files in Safari ZIP and safari/ parse cleanly via vm.Script and guard Chromium-only APIs', () => {
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    assert.ok(fs.existsSync(safariZip), `Missing ${safariZip}`);
    const entries = readZipEntries(safariZip);
    const jsEntries = entries.filter((e) => e.name.endsWith('.js'));
    assert.ok(jsEntries.length >= 4, 'Safari ZIP must contain extension JS files');
    for (const e of jsEntries) {
      const code = e.data.toString('utf8');
      assert.doesNotThrow(() => new vm.Script(code, { filename: `safari-zip/${e.name}` }));
    }
    const bgEntry = jsEntries.find((e) => e.name === 'background.js');
    assert.ok(bgEntry, 'Safari ZIP missing background.js');
    const bgCode = bgEntry.data.toString('utf8');
    assert.match(bgCode, /tabsDiscardSupported|typeof\s+chrome\.tabs\.discard/, 'Safari background.js must guard chrome.tabs.discard');
  });

  test('F8.5: zero LICENSE/COPYING files exist in repo root, extension/, safari/, or dist/, and package.json has no OSS license field', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.license, undefined, 'package.json must NOT declare an OSS "license" field');
    assert.equal(pkg.licenses, undefined, 'package.json must NOT declare "licenses"');

    const rootEntries = fs.readdirSync(ROOT);
    for (const entry of rootEntries) {
      assert.doesNotMatch(entry, /^(?:LICENSE|COPYING|UNLICENSE)(?:\.[a-z0-9]+)?$/i, `Disallowed root license file: ${entry}`);
    }
    assert.deepEqual(findOssLicenseViolationsInDirectory(EXTENSION_DIR), []);
    assert.deepEqual(findOssLicenseViolationsInDirectory(SAFARI_DIR), []);
  });

  test('F8.6: zero OSS license headers or OSS documentation exist inside built store ZIP/XPI archives', () => {
    const pkgNames = [
      'sweepr-deepblock-chrome-webstore-mv3.zip',
      'sweepr-deepblock-edge-chrome-mv3.zip',
      'sweepr-deepblock-firefox-amo-mv3.zip',
      'sweepr-deepblock-opera-mv3.zip',
      'sweepr-deepblock-safari-mv3.zip'
    ];
    for (const name of pkgNames) {
      const zipPath = path.join(DIST_DIR, name);
      assert.ok(fs.existsSync(zipPath), `Missing store archive ${zipPath}`);
      assert.deepEqual(findOssLicenseViolationsInZip(zipPath), []);
    }
  });
});

describe('Tier 1 — F9: Store Packages, Guides, CRM To-Do Fallback & Workspace Preservation', () => {
  test('F9.1: ready-to-submit manifest.version packages exist for Chrome, Edge, Firefox, Opera, and Safari plus website downloads', () => {
    const rootManifest = readExtensionManifest();
    const expectedPackages = [
      path.join(DIST_DIR, 'sweepr-deepblock-chrome-webstore-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip'),
      path.join(DIST_DIR, `sweepr-deepblock-v${rootManifest.version}-chrome-webstore.zip`),
      path.join(DIST_DIR, `sweepr-deepblock-v${rootManifest.version}-firefox-amo.zip`),
      path.join(DIST_DIR, `sweepr-deepblock-v${rootManifest.version}-opera-addons.zip`),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-extension.zip'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock.xpi')
    ];

    for (const pkgPath of expectedPackages) {
      assert.ok(fs.existsSync(pkgPath), `Missing store/download package: ${pkgPath}`);
      const { manifest } = readManifestFromZip(pkgPath);
      assert.equal(manifest.version, rootManifest.version, `${pkgPath} version mismatch`);
    }
  });

  test('F9.2: exact manual/CI store submission guide documents Chrome Web Store, Firefox AMO, Microsoft Edge Add-ons, and Apple App Store / Safari', () => {
    const candidateFiles = listFilesRecursive(ROOT)
      .filter((f) => /\.(?:md|txt)$/i.test(f))
      .filter((f) => {
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        return (
          !rel.startsWith('website/') &&
          !rel.startsWith('.agents/') &&
          !rel.startsWith('.worktrees/') &&
          /(?:submit|submission|store|safari|publish)/i.test(path.basename(f))
        );
      });
    assert.ok(candidateFiles.length > 0, 'Expected store submission guide markdown/text file in repository');

    const combinedText = candidateFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const checks = [
      { name: 'Chrome Web Store', re: /Chrome\s+Web\s+Store/i },
      { name: 'Firefox AMO', re: /Firefox\s+(?:AMO|Add-ons)/i },
      { name: 'Microsoft Edge Add-ons', re: /(?:Microsoft\s+)?Edge\s+Add-ons/i },
      { name: 'Apple App Store / Safari', re: /(?:Apple\s+App\s+Store|App\s+Store\s+Connect|Safari)/i }
    ];
    for (const c of checks) {
      assert.equal(c.re.test(combinedText), true, `Submission guide (${candidateFiles.map((f) => path.relative(ROOT, f)).join(', ')}) must cover ${c.name}`);
    }
  });

  test('F9.3: data/sweepr-crm.db outreach_logs (deepblock) records pending/submitted tasks for all 4 browser stores', () => {
    const manifest = readExtensionManifest();
    const db = openCrmReadOnly();
    try {
      const rows = db
        .prepare("SELECT who, website, status, notes FROM outreach_logs WHERE project_id = 'deepblock'")
        .all();
      const targetStores = [
        { label: 'Chrome Web Store', re: /chrome\s*web\s*store|chromewebstore/i },
        { label: 'Firefox AMO', re: /firefox|addons\.mozilla\.org|\bamo\b/i },
        { label: 'Microsoft Edge Add-ons', re: /edge\s*add-?ons|microsoftedge/i },
        { label: 'Apple App Store / Safari', re: /safari|apple\s*app\s*store|appstoreconnect/i }
      ];
      for (const store of targetStores) {
        const matched = rows.filter(
          (r) =>
            (store.re.test(r.who || '') || store.re.test(r.website || '') || store.re.test(r.notes || '')) &&
            ['pending', 'submitted', 'submitted_pending_review'].includes(String(r.status || '').toLowerCase()) &&
            String(r.notes || r.who || '').includes(manifest.version)
        );
        assert.ok(
          matched.length > 0,
          `CRM outreach_logs missing v${manifest.version} pending/submitted task for ${store.label}`
        );
      }
    } finally {
      db.close();
    }
  });

  test('F9.4: unrelated pre-existing uncommitted local workspace files and directories remain intact', () => {
    for (const relPath of PRE_EXISTING_WORKSPACE_PATHS) {
      const absPath = path.join(ROOT, relPath);
      assert.ok(fs.existsSync(absPath), `Pre-existing local path was deleted or moved: ${relPath}`);
    }
  });

  test('F9.5: SWEEPRDeepblockSetup.exe retains exact signed SHA-256 and deepblock-content.js preserves Shadow-DOM comment marker', () => {
    const exeBytes = fs.readFileSync(path.join(WEBSITE_DIR, 'SWEEPRDeepblockSetup.exe'));
    const actualSha256 = crypto.createHash('sha256').update(exeBytes).digest('hex').toUpperCase();
    assert.equal(actualSha256, EXPECTED_SETUP_EXE_SHA256);

    const cmp = inspectCmpCoverage();
    assert.equal(cmp.hasShadowCommentMarker, true);
  });
});
