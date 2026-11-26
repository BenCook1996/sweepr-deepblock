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
  SWEEPR_FIRST_PARTY_DOMAINS,
  PRE_EXISTING_WORKSPACE_PATHS,
  EXPECTED_SETUP_EXE_SHA256,
  startEphemeralServer,
  launchHeadlessBrowser,
  readExtensionManifest,
  extractVisibleText,
  compareSemver,
  readZipEntries,
  readManifestFromZip,
  computeCompiledStaticDnrRules,
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

describe('Tier 4 — Real-World End-to-End Application Scenarios (>= 5 scenarios)', () => {
  test('Scenario 1: Full no-card 7-day Pro trial lifecycle (install -> active protection -> day 6.99 -> day 7 lockout -> paid unlock)', async () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const startMs = Date.UTC(2026, 10, 25, 8, 0, 0);
    const paidKey = 'SWEEPR-DB-E2E4-2026-9991';
    const compiled = computeCompiledStaticDnrRules();

    const bg = createBackgroundVmHarness({
      nowMs: startMs,
      initialLocal: {
        cloudTabSessions: [{ id: 'saved_work', tabs: [{ url: 'https://sweeprdeepblock.com/pricing' }] }]
      },
      tabs: [
        { id: 10, active: true, pinned: false, audible: false, url: 'https://example.com/' },
        { id: 11, active: false, pinned: false, audible: false, url: 'https://news.example/' }
      ],
      fetchHandler: async (url, init) => {
        if (url.includes('/api/trial/start')) {
          throw new TypeError('offline install simulation');
        }
        if (url.includes('/api/license-verify')) {
          const parsed = new URL(url);
          const body = init?.body ? JSON.parse(init.body) : {};
          const key = parsed.searchParams.get('key') || parsed.searchParams.get('license_key') || body.license_key || body.licenseKey || '';
          if (key === paidKey) {
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
          return { ok: false, status: 403, json: async () => ({ valid: false, status: 'expired' }) };
        }
        return { ok: false, status: 404, json: async () => ({ ok: false }) };
      }
    });

    try {
      // 1. Fresh offline install starts 7-day trial automatically
      await bg.triggerInstall('install');
      const day0State = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(day0State.proActive, true);
      assert.equal(day0State.subscriptionStatus, 'trialing');
      assert.ok(bg.getEnabledRulesets().length >= compiled.ruleResources.length);
      assert.ok(bg.getRegisteredScripts().some((s) => s.id === 'deepstealth-main'));

      // 2. Content script actively rejects CMP banners and unlocks scroll during trial
      let rejectBtn;
      const csDay0 = createContentScriptVmHarness({
        bodyOverflow: 'hidden',
        storageState: day0State,
        setupDom: ({ bodyEl, createElement }) => {
          const banner = createElement('div', { id: 'onetrust-banner-sdk' });
          rejectBtn = createElement('button', { id: 'onetrust-reject-all-handler', textContent: 'Reject All' });
          banner.appendChild(rejectBtn);
          bodyEl.appendChild(banner);
        }
      });
      try {
        await csDay0.flush();
        assert.equal(csDay0.hasUniversalCosmeticStyle(), true);
        assert.equal(rejectBtn.clicked, true);
        assert.equal(csDay0.bodyEl.style.overflow, 'auto');
      } finally {
        csDay0.cleanup();
      }

      // 3. Day 6.99 remains active
      bg.setNow(startMs + SEVEN_DAYS_MS - 60000);
      await bg.triggerAlarm('licenseVerifyCheck');
      const day6State = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(day6State.proActive, true);
      const hibOk = await bg.sendPrivilegedMessage({ type: 'HIBERNATE_TABS_NOW' });
      assert.equal(hibOk.ok, true, 'HIBERNATE_TABS_NOW must succeed on day 6.99');
      assert.notEqual(hibOk.requiresPro, true);
      assert.ok(hibOk.newlyDiscarded >= 1, `Expected >= 1 idle tab discarded, got ${hibOk.newlyDiscarded}`);

      // 4. Day 7 triggers full 5-feature lockout
      bg.setNow(startMs + SEVEN_DAYS_MS + 1000);
      await bg.triggerAlarm('licenseVerifyCheck');
      const expiredState = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(expiredState.proActive, false);
      assert.equal(expiredState.subscriptionStatus, 'trial_expired');
      assert.deepEqual(bg.getEnabledRulesets(), []);
      assert.equal(bg.getRegisteredScripts().some((s) => s.id === 'deepstealth-main'), false);
      assert.equal((await bg.sendPrivilegedMessage({ type: 'HIBERNATE_TABS_NOW' })).requiresPro, true);
      assert.equal(
        (await bg.sendPrivilegedMessage({ type: 'TOGGLE_SETTING', settingKey: 'cookieAutoClose' })).requiresPro,
        true
      );
      assert.equal(
        (await bg.sendPrivilegedMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: 'saved_work' })).requiresPro,
        true
      );

      // 5. Paid upgrade restores Pro immediately
      const act = await bg.sendPrivilegedMessage({ type: 'ACTIVATE_LICENSE', licenseKey: paidKey });
      assert.equal(act.valid, true);
      const unlocked = await bg.sendPrivilegedMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(unlocked.proActive, true);
      assert.equal(unlocked.licenseKey, paidKey);
      assert.ok(bg.getEnabledRulesets().length >= compiled.ruleResources.length);
      assert.ok(bg.getRegisteredScripts().some((s) => s.id === 'deepstealth-main'));
    } finally {
      bg.cleanup();
    }
  });

  test('Scenario 2: Cross-browser store packaging & compatibility audit (Chrome, Edge, Firefox 128.0, Opera, Safari) + zero-OSS compliance', async () => {
    const rootManifest = readExtensionManifest();
    assert.equal(compareSemver(rootManifest.version, '1.3.2'), 1);

    const targets = [
      { file: path.join(DIST_DIR, 'sweepr-deepblock-chrome-webstore-mv3.zip'), browser: 'chrome' },
      { file: path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip'), browser: 'edge' },
      { file: path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip'), browser: 'firefox' },
      { file: path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip'), browser: 'opera' },
      { file: path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip'), browser: 'safari' },
      { file: path.join(WEBSITE_DIR, 'sweepr-deepblock-extension.zip'), browser: 'chrome' },
      { file: path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi'), browser: 'firefox' },
      { file: path.join(WEBSITE_DIR, 'sweepr-deepblock.xpi'), browser: 'firefox' }
    ];

    for (const t of targets) {
      assert.ok(fs.existsSync(t.file), `Missing package ${t.file}`);
      const { manifest, entries } = readManifestFromZip(t.file);
      assert.equal(manifest.version, rootManifest.version, `Version mismatch in ${t.file}`);
      assert.deepEqual(findOssLicenseViolationsInZip(t.file), []);

      for (const e of entries) {
        assert.equal(e.name.includes('\\'), false);
        assert.equal(e.name.includes('..'), false);
        if (e.name.endsWith('.js')) {
          assert.doesNotThrow(() => new vm.Script(e.data.toString('utf8'), { filename: `${t.browser}/${e.name}` }));
        }
      }

      if (t.browser === 'firefox') {
        assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
        assert.equal(manifest.background?.service_worker, undefined);
      } else if (t.browser === 'safari') {
        assert.equal('minimum_chrome_version' in manifest, false);
        assert.equal('browser_specific_settings' in manifest, false);
        assert.equal('oauth2' in manifest, false);
        assert.equal((manifest.permissions || []).includes('identity'), false);
      }
    }

    // Safari native Xcode scaffolding + CI + closed-source check
    assert.ok(fs.existsSync(SAFARI_DIR));
    const safariFiles = listFilesRecursive(SAFARI_DIR).map((f) => path.relative(SAFARI_DIR, f).replace(/\\/g, '/'));
    assert.ok(safariFiles.some((f) => f.endsWith('project.pbxproj')));
    assert.ok(safariFiles.some((f) => /SafariWebExtensionHandler\.swift$/i.test(f)));
    assert.ok(fs.existsSync(path.join(ROOT, '.github', 'workflows', 'safari-build.yml')));
    assert.deepEqual(findOssLicenseViolationsInDirectory(EXTENSION_DIR), []);
    assert.deepEqual(findOssLicenseViolationsInDirectory(SAFARI_DIR), []);
  });

  test('Scenario 3: Live website & headless Chrome rendering audit across benchmarks, pricing, download, /vs/*, machine feeds & APIs', async () => {
    const manifest = readExtensionManifest();
    const compiled = computeCompiledStaticDnrRules(manifest);
    const cmp = inspectCmpCoverage();
    const formattedCount = compiled.enabledTotalRules.toLocaleString('en-US');

    let browser;
    let page;
    try {
      browser = await launchHeadlessBrowser();
      page = await browser.newPage();

      const routes = [
        '/benchmarks',
        '/pricing',
        '/download',
        '/vs/total-adblock',
        '/vs/adguard-extension'
      ];

      for (const route of routes) {
        for (const vp of [
          { name: 'desktop', width: 1440, height: 900, mobile: false },
          { name: 'mobile', width: 390, height: 844, mobile: true }
        ]) {
          await page.setViewport(vp);
          const net = await page.navigateAndAudit(`${server.baseUrl}${route}`, server.baseUrl);
          assert.deepEqual(net.consoleErrors, [], `${route} [${vp.name}] console errors`);
          assert.deepEqual(net.pageExceptions, [], `${route} [${vp.name}] page exceptions`);
          assert.deepEqual(net.sameOriginBadResponses, [], `${route} [${vp.name}] HTTP errors`);
          assert.deepEqual(net.sameOriginFailures, [], `${route} [${vp.name}] network failures`);

          const dom = await page.evaluate(`(() => {
            const text = document.body ? document.body.innerText : '';
            const overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
            const tables = Array.from(document.querySelectorAll('table')).map(tbl => {
              const headers = Array.from(tbl.querySelectorAll('thead th')).map(th => th.innerText.trim());
              const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
                Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim())
              );
              return { headers, rows };
            });
            return { text, overflowPx, tables };
          })()`);

          assert.ok(dom.overflowPx <= 2, `${route} [${vp.name}] horizontal overflow ${dom.overflowPx}px`);
          assert.ok(dom.text.includes(manifest.version), `${route} rendered DOM missing ${manifest.version}`);
          for (const claimedCmp of extractClaimedCmpCounts(dom.text)) {
            assert.ok(claimedCmp <= cmp.frameworkCount, `${route} claimed ${claimedCmp} CMPs > ${cmp.frameworkCount}`);
          }

          if (route === '/benchmarks' && vp.name === 'desktop') {
            assert.ok(
              dom.text.includes(String(compiled.enabledTotalRules)) || dom.text.includes(formattedCount),
              'Rendered /benchmarks missing compiled static rule count'
            );
            const tbl = dom.tables[1] || dom.tables[0];
            assert.ok(tbl, '/benchmarks missing comparison table');
            const adguardCol = tbl.headers.findIndex((h) => /AdGuard/i.test(h));
            const totalCol = tbl.headers.findIndex((h) => /Total\s+Adblock/i.test(h));
            const priceRow = tbl.rows.find((r) => /Transparent\s+Annual\s+Price/i.test(r[0] || ''));
            const cmpRow = tbl.rows.find((r) => /Automated\s+CMP\s+Cookie\s+Rejector/i.test(r[0] || ''));
            assert.ok(adguardCol >= 0 && priceRow, 'Missing AdGuard price row in rendered DOM');
            assert.match(priceRow[adguardCol], /\bfree\b/i);
            assert.ok(totalCol >= 0 && cmpRow, 'Missing Total Adblock CMP row in rendered DOM');
            assert.match(cmpRow[totalCol], /banner\s+hiding|pro\s+tier|partial/i);
          }

          if (route === '/download' && vp.name === 'desktop') {
            assert.match(dom.text, /Gecko\s+128\.0\+/i);
            assert.match(dom.text, /7[- ]day/i);
          }
        }
      }
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }

    // Machine feeds & backend API parity
    const [verJson, proofJson, geoJson] = await Promise.all([
      fetch(`${server.baseUrl}/api/version`).then((r) => r.json()),
      fetch(`${server.baseUrl}/api/telemetry/live-proof`).then((r) => r.json()),
      fetch(`${server.baseUrl}/geo-benchmark-feed.json`).then((r) => r.json())
    ]);
    assert.equal(verJson.version, manifest.version);
    assert.equal(proofJson.version, manifest.version);
    assert.equal(geoJson.version, manifest.version);
    assert.equal(proofJson.activeMv3StaticRules, compiled.enabledTotalRules);
    assert.equal(geoJson.telemetrySummary?.staticDnrRules, compiled.enabledTotalRules);
  });

  test('Scenario 4: MV3 filter engine & parameter-stripping pipeline (25k–50k+ DNR rules, surgical allow, 150+ params, SWEEPR exclusions)', async () => {
    const compiled = computeCompiledStaticDnrRules();
    assert.ok(compiled.enabledTotalRules >= 25000 && compiled.enabledTotalRules <= 330000);

    const byId = new Map(compiled.rulesets.map((r) => [r.id, r]));
    assert.ok((byId.get('ads_and_trackers')?.count || 0) >= 10000);
    assert.ok((byId.get('easyprivacy_trackers')?.count || 0) >= 5000);
    assert.ok((byId.get('regional_eu_filters')?.count || 0) >= 1000);

    const allRules = compiled.rulesets.flatMap((r) => r.rules);
    const allowRules = allRules.filter((r) => r.action?.type === 'allow' || r.action?.type === 'allowAllRequests');
    assert.ok(allowRules.length >= 10);
    for (const a of allowRules) {
      assert.ok(a.priority >= 2);
    }

    const paramRules = byId.get('tracker_param_stripping')?.rules || [];
    const uniqueParams = new Set(paramRules.flatMap((r) => r.action?.redirect?.transform?.queryTransform?.removeParams || []));
    assert.ok(uniqueParams.size >= 150);
    for (const rule of paramRules) {
      for (const dom of SWEEPR_FIRST_PARTY_DOMAINS) {
        assert.ok((rule.condition?.excludedRequestDomains || []).includes(dom));
      }
    }

    // Surrogate JS files parse cleanly
    const surrogatesDir = path.join(EXTENSION_DIR, 'rules', 'surrogates');
    for (const f of fs.readdirSync(surrogatesDir).filter((n) => n.endsWith('.js'))) {
      assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(surrogatesDir, f), 'utf8'), { filename: f }));
    }

    // Background runtime activates & deactivates all rulesets cleanly
    const bg = createBackgroundVmHarness({ offline: true });
    try {
      await bg.triggerInstall('install');
      assert.equal(bg.getEnabledRulesets().length, compiled.enabledResources.length);
      await bg.ctx.syncExtensionProtectionRules(false, false);
      assert.deepEqual(bg.getEnabledRulesets(), []);
    } finally {
      bg.cleanup();
    }
  });

  test('Scenario 5: Store submission fallback, CRM pending/submitted outreach_logs & workspace preservation audit', () => {
    const manifest = readExtensionManifest();

    // 1. Submission guides exist covering all 4 stores
    const guides = listFilesRecursive(ROOT)
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
    assert.ok(guides.length > 0, 'Missing store submission guide');
    const guideText = guides.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const storeRe of [/Chrome\s+Web\s+Store/i, /Firefox\s+(?:AMO|Add-ons)/i, /Edge\s+Add-ons/i, /(?:Apple\s+App\s+Store|Safari)/i]) {
      assert.equal(storeRe.test(guideText), true, `Submission guide missing coverage for ${storeRe}`);
    }

    // 2. CRM outreach_logs records tasks for target stores
    const db = openCrmReadOnly();
    try {
      const rows = db
        .prepare("SELECT who, website, status, notes FROM outreach_logs WHERE project_id = 'deepblock'")
        .all();
      for (const storeRe of [/chrome/i, /firefox|amo/i, /edge/i, /safari|apple/i]) {
        const hit = rows.some(
          (r) =>
            (storeRe.test(r.who || '') || storeRe.test(r.website || '') || storeRe.test(r.notes || '')) &&
            ['pending', 'submitted', 'submitted_pending_review'].includes(String(r.status || '').toLowerCase()) &&
            String(r.notes || r.who || '').includes(manifest.version)
        );
        assert.equal(hit, true, `Missing CRM task for ${storeRe} v${manifest.version}`);
      }
    } finally {
      db.close();
    }

    // 3. Pre-existing uncommitted workspace files & EXE SHA-256 preserved
    for (const relPath of PRE_EXISTING_WORKSPACE_PATHS) {
      assert.ok(fs.existsSync(path.join(ROOT, relPath)), `Missing pre-existing file/dir: ${relPath}`);
    }
    const exeSha = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(WEBSITE_DIR, 'SWEEPRDeepblockSetup.exe')))
      .digest('hex')
      .toUpperCase();
    assert.equal(exeSha, EXPECTED_SETUP_EXE_SHA256);
    assert.equal(inspectCmpCoverage().hasShadowCommentMarker, true);
  });
});
