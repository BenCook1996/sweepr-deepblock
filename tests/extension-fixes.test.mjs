import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function readZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset >= 0, `EOCD signature not found in ${zipPath}`);

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    assert.equal(buf.readUInt32LE(cursor), 0x02014b50, `Invalid CD header in ${zipPath}`);
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');

    assert.equal(buf.readUInt32LE(localHeaderOffset), 0x04034b50, `Invalid local header for ${name}`);
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawSlice = buf.subarray(dataStart, dataStart + compressedSize);

    let data = Buffer.alloc(0);
    if (!name.endsWith('/')) {
      if (compressionMethod === 0) {
        data = Buffer.from(rawSlice);
      } else if (compressionMethod === 8) {
        data = zlib.inflateRawSync(rawSlice);
      } else {
        assert.fail(`Unsupported ZIP compression method ${compressionMethod} for ${name}`);
      }
    }
    entries.push({ name, data });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

let appProc;
let baseUrl;
let tempDataDir;

before(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-db-extfixes-'));
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  appProc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_URL: 'https://sweeprdeepblock.com',
      NODE_ENV: 'production',
      DATA_DIR: tempDataDir,
      SESSION_SECRET: 'test_ext_fixes_' + crypto.randomBytes(16).toString('hex'),
      SWEEPR_CRM_URL: 'http://127.0.0.1:1',
      SWEEPR_CRM_API_KEY: 'test_crm_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      CRM_ADMIN_PASSWORD: 'test_admin_password',
      OWNER_EMAIL: 'owner@sweeprdeepblock.test',
      OWNER_LICENSE_KEY: 'SWEEPR-DB-OWNR-2026-9999',
      LATEST_EXTENSION_VERSION: '1.3.1',
      STRIPE_SECRET_KEY: '',
      DISABLE_CMO_AUTOPILOT: '1',
      TRUST_PROXY: '',
      TRUST_CLOUDFLARE: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrBuf = '';
  appProc.stderr.on('data', (d) => {
    stderrBuf += d.toString('utf8');
  });

  const deadline = Date.now() + 12000;
  let ready = false;
  while (Date.now() < deadline) {
    if (appProc.exitCode !== null) {
      throw new Error(`server.js exited early (${appProc.exitCode}): ${stderrBuf}`);
    }
    try {
      const probe = await fetch(`${baseUrl}/api/version?current_version=1.3.0`);
      if (probe.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.ok(ready, `Timed out waiting for server.js on ${baseUrl}: ${stderrBuf}`);
});

after(async () => {
  if (appProc && appProc.exitCode === null) {
    appProc.kill();
    await new Promise((r) => {
      appProc.once('exit', r);
      setTimeout(r, 2000);
    });
  }
  if (tempDataDir) {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});

test('E1: manifest.json bumped to 1.3.2 with scripting, optional clipboardRead, MacCtrl shortcuts, 3 rulesets, and valid surrogates WAR', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'));
  assert.equal(manifest.version, '1.3.2');
  assert.ok(manifest.permissions.includes('scripting'));
  assert.deepEqual(manifest.optional_permissions, ['clipboardRead']);

  for (const [cmdName, cmdSpec] of Object.entries(manifest.commands || {})) {
    assert.ok(cmdSpec.suggested_key?.mac?.startsWith('MacCtrl+'), `${cmdName} mac shortcut must use MacCtrl+`);
  }

  const rulesetIds = (manifest.declarative_net_request?.rule_resources || []).map((r) => r.id);
  assert.deepEqual(rulesetIds, ['ads_and_trackers', 'tracker_param_stripping', 'cryptominers_and_heavy_scripts']);

  const allContentScripts = (manifest.content_scripts || []).flatMap((cs) => cs.js || []);
  assert.ok(!allContentScripts.includes('content/deepstealth-main.js'), 'deepstealth-main.js must not be static in content_scripts');

  const warResources = (manifest.web_accessible_resources || []).flatMap((w) => w.resources || []);
  assert.ok(!warResources.includes('rules/empty.js') && !warResources.includes('rules/empty.txt'));
  for (const sur of ['ad_status.js', 'adsbygoogle.js', 'gpt.js', 'show_ads.js']) {
    assert.ok(warResources.includes(`rules/surrogates/${sur}`), `Missing WAR resource rules/surrogates/${sur}`);
  }
});

test('E2: extension rules have zero data: redirect URIs, surrogates parse as valid JS, and empty stubs deleted', () => {
  const ruleFiles = fs.readdirSync(path.join(ROOT, 'extension/rules')).filter((f) => f.endsWith('.json'));
  for (const rf of ruleFiles) {
    const raw = fs.readFileSync(path.join(ROOT, 'extension/rules', rf), 'utf8');
    assert.ok(!/"url"\s*:\s*"data:/i.test(raw), `${rf} contains disallowed data: redirect URL`);
    JSON.parse(raw);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, 'extension/rules/empty.js')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'extension/rules/empty.txt')));

  for (const sur of ['ad_status.js', 'adsbygoogle.js', 'gpt.js', 'show_ads.js']) {
    const fullPath = path.join(ROOT, 'extension/rules/surrogates', sur);
    assert.ok(fs.existsSync(fullPath), `Missing surrogate file ${sur}`);
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: sur });
  }
});

test('E3: removed fake metrics and flags from all extension JS files', () => {
  const jsFiles = [
    'extension/background.js',
    'extension/popup.js',
    'extension/welcome.js',
    'extension/content/deepblock-content.js',
    'extension/content/deepstealth-main.js'
  ];
  const bannedPatterns = [
    /encryptedDnsEnabled/,
    /SIMULATE_WINBACK_TIER/,
    /ramSavedGb/,
    /slowdownPct/,
    /estimatedGb/,
    /secondsSaved\s*:\s*42/,
    /processRecipeAndNewsClutter/,
    /processSearchResults/,
    /processEcommerceStore/,
    /fakeShopAlerts/,
    /hideSearchSpam/,
    /dns\.adguard-dns\.com/
  ];
  for (const rel of jsFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const pat of bannedPatterns) {
      assert.ok(!pat.test(src), `${rel} still contains removed fake symbol ${pat}`);
    }
  }
});

test('E4: all 9 _locales/*/messages.json files define the 10 ui* i18n keys', () => {
  const localesDir = path.join(ROOT, 'extension/_locales');
  const localeDirs = fs.readdirSync(localesDir).filter((d) => fs.statSync(path.join(localesDir, d)).isDirectory());
  assert.equal(localeDirs.length, 9);
  const uiKeys = [
    'uiUnlockPro',
    'uiFreePreview',
    'uiProActive',
    'uiBoostSpeed',
    'uiPause5m',
    'uiHideElement',
    'uiSettingsTabs',
    'uiLiveTest',
    'uiGrantPermissions',
    'uiHaveKey'
  ];
  for (const loc of localeDirs) {
    const msgs = JSON.parse(fs.readFileSync(path.join(localesDir, loc, 'messages.json'), 'utf8'));
    for (const key of uiKeys) {
      assert.ok(msgs[key] && typeof msgs[key].message === 'string' && msgs[key].message.length > 0, `Locale ${loc} missing ${key}`);
    }
  }
});

test('E5: built v1.3.2 store ZIPs exist and pass Opera/Chrome/Firefox compliance checks', () => {
  const zips = [
    'dist/sweepr-deepblock-v1.3.2-chrome-webstore.zip',
    'dist/sweepr-deepblock-v1.3.2-firefox-amo.zip',
    'dist/sweepr-deepblock-v1.3.2-opera-addons.zip',
    'dist/sweepr-deepblock-edge-chrome-mv3.zip'
  ];
  for (const z of zips) {
    const full = path.join(ROOT, z);
    assert.ok(fs.existsSync(full), `Missing store archive ${z}`);
    const entries = readZipEntries(full);
    const manifestEntry = entries.find((e) => e.name === 'manifest.json');
    assert.ok(manifestEntry, `${z} missing manifest.json`);
    const parsedManifest = JSON.parse(manifestEntry.data.toString('utf8'));
    assert.equal(parsedManifest.version, '1.3.2');
    for (const e of entries) {
      if (e.name.startsWith('rules/') && e.name.endsWith('.json')) {
        assert.ok(!/"url"\s*:\s*"data:/i.test(e.data.toString('utf8')), `${z}:${e.name} contains data: URL`);
      }
    }
    if (z.endsWith('-opera-addons.zip')) {
      const contentJs = entries.find((e) => e.name === 'content/deepblock-content.js')?.data.toString('utf8') || '';
      assert.ok(!/createElement\(['"]script['"]\)/.test(contentJs), 'Opera ZIP must not inject <script> tags');
      const operaWar = (parsedManifest.web_accessible_resources || []).flatMap((w) => w.resources || []);
      assert.ok(!operaWar.includes('content/deepstealth-main.js'), 'Opera manifest must not expose deepstealth-main.js as web_accessible_resources');
    }
  }
});

test('E6: background.js sanitizeRemoteSelector permits CSS > and rejects dangerous tokens', () => {
  const bgSrc = fs.readFileSync(path.join(ROOT, 'extension/background.js'), 'utf8');
  const match = bgSrc.match(/const sanitizeRemoteSelector = [\s\S]*?!\/url\\\(\|@import\|-moz-binding\|expression\\\(\|javascript:\/i\.test\(sel\);/);
  assert.ok(match, 'Could not locate sanitizeRemoteSelector in extension/background.js');
  const fnExpr = match[0].replace(/^const sanitizeRemoteSelector = /, '').replace(/;\s*$/, '');
  const fn = vm.runInNewContext(`(${fnExpr})`);
  assert.equal(fn('div.banner > a.close[role="button"]'), true);
  assert.equal(fn('.ad-slot:not(.kept) > iframe'), true);
  assert.equal(fn('div { color: red; }'), false);
  assert.equal(fn('<script>alert(1)</script>'), false);
  assert.equal(fn('body;background:url(x)'), false);
});

test('E7: deepblock-content.js isolates settings.adBlocking === false so cookieAutoClose stays active without cosmetic ad hiding', () => {
  const src = fs.readFileSync(path.join(ROOT, 'extension/content/deepblock-content.js'), 'utf8');
  let calledCookie = false;
  let calledAdHide = false;
  let removedCosmetic = false;

  const docEl = {
    dataset: {},
    style: { setProperty() {} }
  };
  const chromeMock = {
    storage: {
      local: {
        get(_keys, cb) {
          if (typeof cb === 'function') {
            cb({
              proActive: true,
              licenseKey: 'SWEEPR-DB-TEST-2026-ABCD',
              pausedSites: [],
              settings: {
                adBlocking: false,
                cookieAutoClose: true,
                silentMode: true
              },
              remoteFeatureFlags: {}
            });
          }
        },
        set() {}
      }
    },
    runtime: {
      id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
      onMessage: { addListener() {} },
      sendMessage(msg, cb) {
        if (typeof cb === 'function' && msg?.type === 'GET_PAGE_SETTINGS') {
          cb({
            proActive: true,
            licenseKey: 'SWEEPR-DB-TEST-2026-ABCD',
            pausedSites: [],
            settings: {
              adBlocking: false,
              cookieAutoClose: true,
              silentMode: true
            },
            remoteFeatureFlags: {}
          });
        }
      }
    }
  };

  assert.ok(src.includes('const adBlockingEnabled = settings.adBlocking !== false;'));
  assert.ok(/if \(adBlockingEnabled\) \{\s*injectUniversalAdCosmeticStyle\(\);/.test(src));

  const sandbox = {
    location: { hostname: 'example.com', href: 'https://example.com/' },
    chrome: chromeMock,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/130.0' },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    document: {
      readyState: 'complete',
      documentElement: docEl,
      head: null,
      body: null,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {} }),
      addEventListener() {}
    },
    window: {
      top: null,
      self: null,
      addEventListener() {},
      dispatchEvent() {}
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

  const instrumented = src
    .replace(
      /processCookieBanners\(true, extraCmpSelectors\);/g,
      'processCookieBanners(true, extraCmpSelectors); __hooks.cookie();'
    )
    .replace(
      /countAndReportPageAds\('adsBlocked'\);/g,
      "countAndReportPageAds('adsBlocked'); __hooks.adHide();"
    )
    .replace(
      /\} else \{\r?\n\s*removeUniversalAdCosmeticStyle\(\);/,
      '} else {\n          removeUniversalAdCosmeticStyle(); __hooks.adRemoved();'
    );
  sandbox.__hooks = {
    cookie: () => { calledCookie = true; },
    adHide: () => { calledAdHide = true; },
    adRemoved: () => { removedCosmetic = true; }
  };

  vm.runInNewContext(instrumented, sandbox, { filename: 'deepblock-content.js' });
  assert.equal(calledCookie, true, 'cookieAutoClose must still run when adBlocking === false');
  assert.equal(calledAdHide, false, 'ad-blocking DOM pass must not run when adBlocking === false');
  assert.equal(removedCosmetic, true, 'removeUniversalAdCosmeticStyle must run when adBlocking === false');
});

test('E8: live server.js in production allows Chrome/Edge/Opera/Firefox/Safari origins, blocks unknown extension IDs with 403, and serves v1.3.1 delta', async () => {
  const allowedOrigins = [
    'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc',
    'chrome-extension://pbidlabhfmaoghmofkaegcgjgmaajhop',
    'chrome-extension://jgbgdcpdhknljbmddooepmkofbgiinci',
    'moz-extension://12345678-1234-4123-8123-1234567890ab',
    'safari-web-extension://6a2e0a52-406c-4a0d-b187-c7fb4c40ef11'
  ];

  for (const origin of allowedOrigins) {
    const optRes = await fetch(`${baseUrl}/api/device-link/redeem`, {
      method: 'OPTIONS',
      headers: { Origin: origin }
    });
    assert.equal(optRes.status, 204);
    assert.equal(optRes.headers.get('access-control-allow-origin'), origin, `Expected echoed CORS origin for ${origin}`);

    const postRes = await fetch(`${baseUrl}/api/device-link/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ token: 'ptk_nonexistent_token_12345', device_id: 'ext_db_testdevice' })
    });
    assert.notEqual(postRes.status, 403, `${origin} must pass production origin allowlist`);
    assert.equal(postRes.headers.get('access-control-allow-origin'), origin);
  }

  const badOrigin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const badRes = await fetch(`${baseUrl}/api/device-link/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: badOrigin },
    body: JSON.stringify({ token: 'ptk_nonexistent_token_12345', device_id: 'ext_db_testdevice' })
  });
  assert.equal(badRes.status, 403);
  const badJson = await badRes.json();
  assert.equal(badJson.error, 'cross_origin_forbidden');

  const deltaRes = await fetch(`${baseUrl}/api/filters/delta?current_version=1.3.0`);
  assert.equal(deltaRes.status, 200);
  const deltaJson = await deltaRes.json();
  assert.equal(deltaJson.latestExtensionVersion, '1.3.1');
  assert.equal(deltaJson.updateAvailable, true);
});

test('E9: website test-lab.html, order.html, download.html, and ios-app.html fixes are in place', () => {
  const testLab = fs.readFileSync(path.join(ROOT, 'website/test-lab.html'), 'utf8');
  assert.ok(!testLab.includes('/deepstealth-preview.js'), 'test-lab.html must not load /deepstealth-preview.js');
  assert.ok(!testLab.includes('playbackRate = 16'), 'test-lab.html must not self-pass YouTube video speed');
  assert.ok(!testLab.includes('if (wall) wall.remove()'), 'test-lab.html must not self-remove simulated wall');

  const downloadHtml = fs.readFileSync(path.join(ROOT, 'website/download.html'), 'utf8');
  assert.ok(downloadHtml.includes('https://microsoftedge.microsoft.com/addons/detail/pbidlabhfmaoghmofkaegcgjgmaajhop'));
  assert.ok(downloadHtml.includes('https://addons.opera.com/en/extensions/details/sweepr-deepblock/'));

  const iosHtml = fs.readFileSync(path.join(ROOT, 'website/ios-app.html'), 'utf8');
  assert.ok(!iosHtml.includes('/sweepr-deepblock-firefox.xpi'), 'ios-app.html must link AMO instead of unsigned XPI');
  assert.ok(!iosHtml.includes('340,000+'), 'ios-app.html must not contain hardcoded 340,000+ claim');

  const orderHtml = fs.readFileSync(path.join(ROOT, 'website/order.html'), 'utf8');
  assert.ok(orderHtml.includes("params.get('winback')") && orderHtml.includes('tier_d60'));
});

test('E10: /api/license-verify enforces 5-device cap, includes RAM Tamer in base Pro, and accepts license_key body field', async () => {
  const OWNER_KEY = 'SWEEPR-DB-OWNR-2026-9999';
  for (let i = 1; i <= 5; i += 1) {
    const res = await fetch(`${baseUrl}/api/license-verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: OWNER_KEY, device_id: `ext_owner_dev_${i}` })
    });
    assert.equal(res.status, 200, `Device ${i} should succeed`);
    const body = await res.json();
    assert.equal(body.valid, true);
    assert.equal(body.ramTamerAddon, true);
    assert.equal(body.devices_max, 5);
    assert.ok(Array.isArray(body.entitlements) && body.entitlements.includes('pro_tab_and_ram_tamer'));
    assert.ok(!body.entitlements.some((e) => /search_spam|fake_shop|ai_slop/i.test(e)));
  }

  const res6 = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: OWNER_KEY, device_id: 'ext_owner_dev_6' })
  });
  assert.equal(res6.status, 403);
  const body6 = await res6.json();
  assert.equal(body6.error, 'device_limit_reached');

  const lkRes = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ license_key: OWNER_KEY, device_id: 'ext_owner_dev_1' })
  });
  assert.equal(lkRes.status, 200);
  const lkBody = await lkRes.json();
  assert.equal(lkBody.valid, true);
});

test('E11: /api/telemetry/live-proof serves real rule counts and v1.3.2 without fabricated receipts', async () => {
  const blockedSitesRaw = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'deepblock-blocked-sites.json'), 'utf8')
  );
  const expectedBlockedCount =
    Number(blockedSitesRaw?.total) ||
    (Array.isArray(blockedSitesRaw?.sites)
      ? blockedSitesRaw.sites.length
      : Array.isArray(blockedSitesRaw)
      ? blockedSitesRaw.length
      : 0);
  assert.ok(expectedBlockedCount >= 16100, `Expected >= 16100 blocked domains, got ${expectedBlockedCount}`);

  const res = await fetch(`${baseUrl}/api/telemetry/live-proof`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.version, '1.3.2');
  assert.equal(body.activeMv3StaticRules, 283);
  assert.equal(body.activeOtaDeltaRules, 100);
  assert.equal(body.verifiedBlockedDomainsCount, expectedBlockedCount);
  assert.equal(body.maxDevicesPerLicense, 5);
  assert.equal(body.recentVerifiedReceipts, undefined);
  assert.ok(!JSON.stringify(body).includes('10218'));
});

test('E12: /api/ab/paywall initializes in exploration_uniform mode with zero conversions and revenue', async () => {
  const res = await fetch(`${baseUrl}/api/ab/paywall?device_id=ab_seed_probe_1`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.banditMode, 'exploration_uniform');
  const metricsList = Object.values(body.metrics || {});
  assert.ok(metricsList.length >= 3);
  for (const m of metricsList) {
    assert.equal(m.conversions, 0);
    assert.equal(m.totalRevenueGbp, 0);
  }
});

test('E13: /api/support queues failed CRM deliveries to tempDataDir support-dlq.json and returns 202', async () => {
  const res = await fetch(`${baseUrl}/api/support`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://sweeprdeepblock.com'
    },
    body: JSON.stringify({
      email: 'support-dlq-test@example.com',
      subject: 'DLQ persistence test',
      message: 'Verify support queue fallback'
    })
  });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.queued, true);
  assert.match(String(body.ticket_number || ''), /^DB-\d{6}$/);

  const dlqPath = path.join(tempDataDir, 'support-dlq.json');
  assert.ok(fs.existsSync(dlqPath), 'support-dlq.json must be written to DATA_DIR');
  const dlq = JSON.parse(fs.readFileSync(dlqPath, 'utf8'));
  assert.ok(Array.isArray(dlq) && dlq.some((entry) => entry.ticket_number === body.ticket_number));
});

test('E14: referral create/redeem blocks self-referrals (400) & duplicates (409), mints 14d trial, and credits +30d once without double-counting', async () => {
  const OWNER_KEY = 'SWEEPR-DB-OWNR-2026-9999';
  const beforeVerify = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ license_key: OWNER_KEY, device_id: 'ext_owner_dev_1' })
  });
  assert.equal(beforeVerify.status, 200);
  const beforeJson = await beforeVerify.json();
  const baseMs = beforeJson.expiresAt ? Date.parse(beforeJson.expiresAt) : Date.now();

  const createRes = await fetch(`${baseUrl}/api/referral/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ licenseKey: OWNER_KEY })
  });
  assert.equal(createRes.status, 200);
  const createJson = await createRes.json();
  assert.equal(createJson.ok, true);
  assert.ok(createJson.code);

  const selfRes = await fetch(`${baseUrl}/api/referral/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: createJson.code, licenseKey: OWNER_KEY, deviceId: 'owner_self_dev' })
  });
  assert.equal(selfRes.status, 400);
  const selfJson = await selfRes.json();
  assert.equal(selfJson.error, 'self_referral_not_allowed');

  const redeemRes = await fetch(`${baseUrl}/api/referral/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: createJson.code, deviceId: 'friend_browser_uuid_1' })
  });
  assert.equal(redeemRes.status, 200);
  const redeemJson = await redeemRes.json();
  assert.equal(redeemJson.ok, true);
  assert.match(String(redeemJson.trialKey || ''), /^SWEEPR-DB-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.equal(redeemJson.referrerBonusDaysTotal, 30);

  const dupRes = await fetch(`${baseUrl}/api/referral/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: createJson.code, deviceId: 'friend_browser_uuid_1' })
  });
  assert.equal(dupRes.status, 409);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.error, 'already_redeemed');

  const trialVerifyRes = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ license_key: redeemJson.trialKey, device_id: 'friend_dev_1' })
  });
  assert.equal(trialVerifyRes.status, 200);
  const trialVerifyJson = await trialVerifyRes.json();
  assert.equal(trialVerifyJson.valid, true);
  assert.equal(trialVerifyJson.status, 'trialing');
  assert.equal(trialVerifyJson.isReferralTrial, true);
  assert.equal(trialVerifyJson.ramTamerAddon, true);
  assert.equal(trialVerifyJson.devices_max, 5);

  const afterVerify1 = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ license_key: OWNER_KEY, device_id: 'ext_owner_dev_1' })
  });
  assert.equal(afterVerify1.status, 200);
  const afterJson1 = await afterVerify1.json();
  assert.equal(afterJson1.bonusProDaysEarned, 30);
  const afterMs1 = Date.parse(afterJson1.expiresAt);
  const deltaDays = (afterMs1 - baseMs) / 86400000;
  assert.ok(deltaDays > 25 && deltaDays < 35, `Expected ~30 bonus days once, got ${deltaDays}`);

  const afterVerify2 = await fetch(`${baseUrl}/api/license-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ license_key: OWNER_KEY, device_id: 'ext_owner_dev_1' })
  });
  const afterJson2 = await afterVerify2.json();
  assert.equal(afterJson2.expiresAt, afterJson1.expiresAt, 'Repeated license-verify must not re-add +30 days');
});

test('E15: .mobileconfig routes redirect cleanly and mobile UI contains no fake AdGuard shield claims', async () => {
  for (const mcPath of ['/download/sweepr-deepblock.mobileconfig', '/sweepr-deepblock.mobileconfig']) {
    const res = await fetch(`${baseUrl}${mcPath}`, { redirect: 'manual' });
    assert.equal(res.status, 302, `${mcPath} should redirect 302`);
    assert.equal(res.headers.get('location'), '/download?ios=coming-soon');
  }
  const mobileUi = fs.readFileSync(path.join(ROOT, 'scripts/deepblock-mobile-ui.mjs'), 'utf8');
  const iosHtml = fs.readFileSync(path.join(ROOT, 'website/ios-app.html'), 'utf8');
  for (const text of [mobileUi, iosHtml]) {
    assert.ok(!text.includes('dns.adguard-dns.com'), 'Must not contain third-party dns.adguard-dns.com');
    assert.ok(!text.includes('enableAndroidDnsShield'), 'Must not contain removed enableAndroidDnsShield');
  }
});

test('E16: /download serves 200 text/html with Vary: User-Agent to bots and unparameterized mobile browsers (GET and HEAD)', async () => {
  const SMARTPHONE_GOOGLEBOT =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const DESKTOP_GOOGLEBOT =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.6778.69 Safari/537.36';
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const IOS_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  const htmlCases = [
    ['/download', SMARTPHONE_GOOGLEBOT],
    ['/download?install=1', SMARTPHONE_GOOGLEBOT],
    ['/download?platform=android&direct=1', SMARTPHONE_GOOGLEBOT],
    ['/download', DESKTOP_GOOGLEBOT],
    ['/download?install=1', DESKTOP_GOOGLEBOT],
    ['/download', ANDROID_CHROME],
    ['/download?install=1', ANDROID_CHROME],
    ['/download?platform=ios', IOS_SAFARI]
  ];

  for (const [reqPath, ua] of htmlCases) {
    for (const method of ['GET', 'HEAD']) {
      const res = await fetch(`${baseUrl}${reqPath}`, {
        method,
        headers: { 'user-agent': ua },
        redirect: 'manual'
      });
      assert.equal(res.status, 200, `${method} ${reqPath} for ${ua.slice(0, 32)} expected 200, got ${res.status}`);
      assert.match(String(res.headers.get('content-type') || ''), /text\/html/i, `${method} ${reqPath} must be text/html`);
      assert.match(String(res.headers.get('vary') || ''), /user-agent/i, `${method} ${reqPath} Vary must contain User-Agent`);
      assert.equal(res.headers.get('content-disposition'), null, `${method} ${reqPath} must not set attachment disposition`);
      if (method === 'GET') {
        const body = await res.text();
        assert.ok(!body.startsWith('PK'), `${reqPath} body must not be binary APK/ZIP`);
        assert.ok(/<html/i.test(body) && body.includes('SWEEPR Deepblock'), `${reqPath} body must be download.html`);
      }
    }
  }
});

test('E17: /download explicit binary and desktop ?install=1 redirects work for non-bot UAs with Vary: User-Agent and GET/HEAD parity', async () => {
  const DESKTOP_CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const DESKTOP_FIREFOX =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

  for (const [reqPath, method] of [
    ['/download?platform=android&direct=1', 'GET'],
    ['/download?platform=android&direct=1', 'HEAD'],
    ['/download?platform=apk', 'GET'],
    ['/download?platform=android', 'GET']
  ]) {
    const res = await fetch(`${baseUrl}${reqPath}`, {
      method,
      headers: { 'user-agent': ANDROID_CHROME },
      redirect: 'manual'
    });
    assert.equal(res.status, 200, `${method} ${reqPath} should return 200`);
    assert.match(String(res.headers.get('content-type') || ''), /application\/vnd\.android\.package-archive/i);
    assert.match(String(res.headers.get('content-disposition') || ''), /SWEEPRDeepblock\.apk/);
    assert.match(String(res.headers.get('vary') || ''), /user-agent/i);
    if (method === 'GET') {
      const buf = Buffer.from(await res.arrayBuffer());
      assert.equal(buf[0], 0x50);
      assert.equal(buf[1], 0x4b);
    }
  }

  for (const method of ['GET', 'HEAD']) {
    const chromeRes = await fetch(`${baseUrl}/download?install=1`, {
      method,
      headers: { 'user-agent': DESKTOP_CHROME },
      redirect: 'manual'
    });
    assert.equal(chromeRes.status, 302, `${method} Desktop Chrome /download?install=1 should 302`);
    assert.ok(String(chromeRes.headers.get('location') || '').startsWith('https://chromewebstore.google.com/'));
    assert.match(String(chromeRes.headers.get('vary') || ''), /user-agent/i);

    const ffRes = await fetch(`${baseUrl}/download?install=1`, {
      method,
      headers: { 'user-agent': DESKTOP_FIREFOX },
      redirect: 'manual'
    });
    assert.equal(ffRes.status, 302, `${method} Desktop Firefox /download?install=1 should 302`);
    assert.ok(String(ffRes.headers.get('location') || '').startsWith('https://addons.mozilla.org/'));
    assert.match(String(ffRes.headers.get('vary') || ''), /user-agent/i);
  }
});

test('E18: index.html inline scripts + nav.js preserve /download?install=1 and footer links for bots while rewriting human CTAs', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'website', 'index.html'), 'utf8');
  const navJs = fs.readFileSync(path.join(ROOT, 'website', 'nav.js'), 'utf8');
  const downloadHtml = fs.readFileSync(path.join(ROOT, 'website', 'download.html'), 'utf8');

  function extractInlineScripts(html) {
    const scripts = [];
    const re = /<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[1] && m[1].trim()) scripts.push(m[1]);
    }
    return scripts;
  }

  function makeEl(tagName, attrs = {}, textContent = '') {
    const attrMap = new Map(Object.entries(attrs));
    const el = {
      tagName: tagName.toUpperCase(),
      id: attrs.id || '',
      textContent,
      innerHTML: textContent,
      value: attrs.value || '',
      style: {},
      dataset: {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      },
      getAttribute(k) {
        if (k === 'href' && attrMap.has('href')) return attrMap.get('href');
        return attrMap.has(k) ? attrMap.get(k) : null;
      },
      setAttribute(k, v) {
        attrMap.set(k, String(v));
        if (k === 'href') el.href = String(v);
        if (k === 'id') el.id = String(v);
      },
      removeAttribute(k) {
        attrMap.delete(k);
      },
      addEventListener() {},
      contains() { return false; },
      querySelectorAll() { return []; },
      focus() {}
    };
    if (attrMap.has('href')) el.href = attrMap.get('href');
    Object.defineProperty(el, 'href', {
      get() { return attrMap.get('href') || ''; },
      set(v) { attrMap.set('href', String(v)); },
      configurable: true
    });
    return el;
  }

  function decodeBasicEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }

  function parseAnchors(html) {
    const anchors = [];
    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const rawAttrs = m[1];
      const innerText = decodeBasicEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const attrs = {};
      const attrRe = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRe.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2] ?? am[3] ?? am[4] ?? '';
      }
      anchors.push(makeEl('a', attrs, innerText));
    }
    return anchors;
  }

  function runPageScripts(html, { userAgent, pathname = '/', search = '', extraScripts = [] }) {
    const anchors = parseAnchors(html);
    const byId = new Map();
    for (const a of anchors) {
      if (a.id) byId.set(a.id, a);
    }
    const idOpenRe = /<([a-z0-9]+)\b([^>]*\bid=["']([^"']+)["'][^>]*)>/gi;
    let im;
    while ((im = idOpenRe.exec(html)) !== null) {
      const tag = im[1].toLowerCase();
      const id = im[3];
      if (!byId.has(id)) {
        const afterStart = im.index + im[0].length;
        const closeIdx = html.indexOf(`</${tag}>`, afterStart);
        const rawInner = closeIdx !== -1 ? html.slice(afterStart, closeIdx) : '';
        const inner = decodeBasicEntities(rawInner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        const el = makeEl(tag, { id }, inner);
        el.innerHTML = rawInner;
        byId.set(id, el);
      }
    }

    const windowListeners = new Map();
    const docListeners = new Map();
    const documentElement = makeEl('html');
    const head = { appendChild() {} };

    function matchesSingleSelector(el, sel) {
      const s = sel.trim();
      if (s === 'a[href="/download?install=1"]') return el.tagName === 'A' && el.getAttribute('href') === '/download?install=1';
      if (s === 'a#downloadBtn') return el.tagName === 'A' && el.id === 'downloadBtn';
      if (s === 'a#mobileStickyDownloadBtn') return el.tagName === 'A' && el.id === 'mobileStickyDownloadBtn';
      if (s === 'a[href^="/download"]') return el.tagName === 'A' && String(el.getAttribute('href') || '').startsWith('/download');
      return false;
    }

    const document = {
      cookie: '',
      title: 'SWEEPR Deepblock',
      referrer: '',
      documentElement,
      head,
      getElementById(id) {
        return byId.get(id) || null;
      },
      querySelector(sel) {
        if (sel === 'nav.glass-nav') return null;
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(selectorList) {
        const parts = selectorList.split(',').map((s) => s.trim()).filter(Boolean);
        return anchors.filter((el) => parts.some((p) => matchesSingleSelector(el, p)));
      },
      createElement(tag) {
        return makeEl(tag);
      },
      addEventListener(type, fn) {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type).push(fn);
      }
    };

    const location = {
      origin: 'https://sweeprdeepblock.com',
      pathname,
      search,
      href: `https://sweeprdeepblock.com${pathname}${search}`
    };
    const context = {
      document,
      navigator: {
        userAgent,
        platform: userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iPhone' : 'Linux armv8l',
        maxTouchPoints: userAgent.includes('Mobile') || userAgent.includes('Android') ? 5 : 0
      },
      location,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      sessionStorage: { getItem: () => null, setItem() {} },
      URLSearchParams,
      URL,
      Blob: class { constructor(parts) { this.parts = parts; } },
      fetch: () => Promise.resolve({ ok: false, json: async () => null }),
      performance: { now: () => 0 },
      requestAnimationFrame: () => 0,
      setTimeout: () => 0,
      clearTimeout() {},
      crypto: { getRandomValues: (arr) => arr.fill(123456789) },
      addEventListener(type, fn) {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(fn);
      },
      matchMedia: () => ({ matches: true })
    };
    context.window = context;
    context.self = context;
    context.globalThis = context;
    vm.createContext(context);

    for (const src of [...extraScripts, ...extractInlineScripts(html)]) {
      vm.runInContext(src, context);
    }
    for (const fn of windowListeners.get('DOMContentLoaded') || []) fn();
    for (const fn of docListeners.get('DOMContentLoaded') || []) fn();

    return { anchors, byId };
  }

  const SMARTPHONE_GOOGLEBOT =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.108 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const DESKTOP_GOOGLEBOT =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.6778.108 Safari/537.36';
  const ANDROID_CHROME =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const DESKTOP_CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const DESKTOP_FIREFOX =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';

  for (const botUa of [SMARTPHONE_GOOGLEBOT, DESKTOP_GOOGLEBOT]) {
    const { anchors, byId } = runPageScripts(indexHtml, { userAgent: botUa, extraScripts: [navJs] });
    assert.equal(byId.get('downloadBtn').getAttribute('href'), '/download?install=1', `Bot UA must keep #downloadBtn href`);
    assert.equal(byId.get('osDownloadText').textContent, 'Install Free Extension', `Bot UA must keep #osDownloadText`);
    assert.match(byId.get('heroDeviceBadgeText').textContent, /Works on Chrome, Edge, Firefox, Brave & Opera/);
    assert.equal(byId.get('mobileStickyDownloadBtn').getAttribute('href'), '/download?install=1');
    const footerDownload = anchors.find((a) => !a.id && a.textContent === 'Browser Extension');
    assert.ok(footerDownload, 'Footer Browser Extension link must exist');
    assert.equal(footerDownload.getAttribute('href'), '/download', 'Footer /download link must remain unmutated for bots');
  }

  {
    const { anchors, byId } = runPageScripts(indexHtml, { userAgent: ANDROID_CHROME, extraScripts: [navJs] });
    assert.equal(byId.get('downloadBtn').getAttribute('href'), '/download?platform=android&direct=1');
    assert.equal(byId.get('mobileStickyDownloadBtn').getAttribute('href'), '/download?platform=android&direct=1');
    const footerDownload = anchors.find((a) => !a.id && a.textContent === 'Browser Extension');
    assert.equal(footerDownload.getAttribute('href'), '/download', 'Footer /download link must remain unmutated on mobile');
  }

  {
    const { anchors, byId } = runPageScripts(indexHtml, { userAgent: DESKTOP_CHROME, extraScripts: [navJs] });
    assert.ok(byId.get('downloadBtn').getAttribute('href').startsWith('https://chromewebstore.google.com/'));
    assert.equal(byId.get('osDownloadText').textContent, 'Add to Chrome — Free');
    const footerDownload = anchors.find((a) => !a.id && a.textContent === 'Browser Extension');
    assert.equal(footerDownload.getAttribute('href'), '/download');
  }

  {
    const { anchors, byId } = runPageScripts(indexHtml, { userAgent: DESKTOP_FIREFOX, extraScripts: [navJs] });
    assert.equal(byId.get('downloadBtn').getAttribute('href'), 'https://addons.mozilla.org/firefox/addon/sweepr-deepblock/');
    assert.equal(byId.get('osDownloadText').textContent, 'Add to Firefox — Free');
    const footerDownload = anchors.find((a) => !a.id && a.textContent === 'Browser Extension');
    assert.equal(footerDownload.getAttribute('href'), '/download');
  }

  {
    const botDl = runPageScripts(downloadHtml, { userAgent: SMARTPHONE_GOOGLEBOT, pathname: '/download' });
    assert.ok(botDl.byId.get('addToBrowserBtn').getAttribute('href').startsWith('https://chromewebstore.google.com/'));
    assert.ok(!botDl.byId.get('downloadSubtitle').innerHTML.includes('.apk'), 'Bot /download must not render Android .apk copy');

    const botIosDl = runPageScripts(downloadHtml, { userAgent: SMARTPHONE_GOOGLEBOT, pathname: '/download', search: '?platform=ios' });
    assert.equal(botIosDl.byId.get('addToBrowserBtn').getAttribute('href'), '/pricing');

    const androidDl = runPageScripts(downloadHtml, { userAgent: ANDROID_CHROME, pathname: '/download' });
    assert.equal(androidDl.byId.get('addToBrowserBtn').getAttribute('href'), 'https://addons.mozilla.org/firefox/addon/sweepr-deepblock/');
  }
});

test('E19: background.js deduplicates DNR startup sync, restores storage.sync license backup, and runs Chrome auto-activation state machine', async () => {
  const bgSrc = fs.readFileSync(path.join(ROOT, 'extension/background.js'), 'utf8');

  function makeStorageArea(initial = {}) {
    const store = { ...initial };
    const get = (keys, cb) => {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : keys && typeof keys === 'object' ? Object.keys(keys) : keys ? [String(keys)] : Object.keys(store);
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
      Object.assign(store, obj || {});
      if (typeof cb === 'function') {
        cb();
        return undefined;
      }
      return Promise.resolve();
    };
    const remove = (keys, cb) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) delete store[k];
      if (typeof cb === 'function') {
        cb();
        return undefined;
      }
      return Promise.resolve();
    };
    return { store, area: { get, set, remove } };
  }

  function loadBackgroundHarness({ initialLocal = {}, initialSync = {}, profileEmail = '', authToken = '', fetchHandler } = {}) {
    const localWrap = makeStorageArea(initialLocal);
    const syncWrap = makeStorageArea(initialSync);
    const sessionWrap = makeStorageArea({});
    const dnrDynamicCalls = [];
    const fetchCalls = [];

    const chromeMock = {
      runtime: {
        id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
        lastError: null,
        getManifest: () => ({ version: '1.3.2' }),
        getURL: (p) => `chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc/${p}`,
        setUninstallURL() {},
        requestUpdateCheck() {},
        reload() {},
        onUpdateAvailable: { addListener() {} },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      storage: {
        local: localWrap.area,
        sync: syncWrap.area,
        session: sessionWrap.area,
        onChanged: { addListener() {} }
      },
      declarativeNetRequest: {
        updateEnabledRulesets: async () => {},
        updateDynamicRules: async (args) => {
          dnrDynamicCalls.push(args);
        },
        getDynamicRules: async () => [],
        setExtensionActionOptions: async () => {},
        onRuleMatchedDebug: { addListener() {} }
      },
      permissions: { contains: async () => true },
      scripting: {
        unregisterContentScripts: async () => {},
        registerContentScripts: async () => {}
      },
      contextMenus: {
        removeAll: (cb) => { if (typeof cb === 'function') cb(); },
        create() {},
        onClicked: { addListener() {} }
      },
      commands: { onCommand: { addListener() {} } },
      tabs: {
        discard: async () => {},
        query: async () => [],
        onCreated: { addListener() {} },
        onActivated: { addListener() {} },
        onUpdated: { addListener() {} },
        onRemoved: { addListener() {} }
      },
      alarms: {
        create() {},
        clear: async () => {},
        onAlarm: { addListener() {} }
      },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      identity: {
        getProfileUserInfo: (_opts, cb) => cb({ email: profileEmail, id: profileEmail ? 'g_123' : '' }),
        getAuthToken: (_opts, cb) => cb(authToken),
        removeCachedAuthToken: (_opts, cb) => { if (typeof cb === 'function') cb(); }
      }
    };

    const customSetTimeout = (fn, delay) => {
      if (delay === 2500) return 0; // suppress auto wakeup delay so test invokes syncRemoteFilterDelta deterministically
      return setTimeout(fn, 0);
    };

    const ctx = {
      chrome: chromeMock,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
        userAgentData: { platform: 'Windows', brands: [{ brand: 'Google Chrome' }] },
        language: 'en-GB'
      },
      fetch: async (url, init) => {
        fetchCalls.push({ url: String(url), init });
        if (fetchHandler) return fetchHandler(String(url), init);
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
    return { ctx, localStore: localWrap.store, syncStore: syncWrap.store, dnrDynamicCalls, fetchCalls };
  }

  // 1. Concurrent syncRemoteFilterDelta() calls coalesce into 1 updateDynamicRules write
  {
    let deltaFetchCount = 0;
    const h = loadBackgroundHarness({
      fetchHandler: async (url) => {
        if (url.includes('/api/filters/delta')) {
          deltaFetchCount += 1;
          await new Promise((r) => setTimeout(r, 15));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              dynamicDnrRules: [
                {
                  id: 80001,
                  priority: 1,
                  action: { type: 'block' },
                  condition: { urlFilter: '||ads.example.test^', resourceTypes: ['script'] }
                }
              ]
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }
    });
    await Promise.all([
      h.ctx.syncRemoteFilterDelta(),
      h.ctx.syncRemoteFilterDelta(),
      h.ctx.syncRemoteFilterDelta()
    ]);
    assert.equal(deltaFetchCount, 1, '3 concurrent syncRemoteFilterDelta calls should coalesce into 1 fetch');
    assert.equal(h.dnrDynamicCalls.length, 1, '3 concurrent syncRemoteFilterDelta calls should execute 1 updateDynamicRules write');
    // Immediate subsequent call within cooldown should be skipped
    await h.ctx.syncRemoteFilterDelta();
    assert.equal(deltaFetchCount, 1, 'Subsequent call within 30s cooldown should skip');
  }

  // 2. chrome.storage.sync backup restore activates Pro when local storage is empty
  {
    const syncedKey = 'SWEEPR-DB-SYNC-2026-ABCD';
    const h = loadBackgroundHarness({
      initialSync: {
        sweeprLicenseBackup: { licenseKey: syncedKey, plan: 'annual', licenseExpiresAt: '2027-01-01T00:00:00.000Z' }
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
              licenseKey: syncedKey,
              expiresAt: '2027-01-01T00:00:00.000Z',
              token: 'hdr.pay.sig'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }
    });
    const res = await h.ctx.restoreLicenseFromChromeSync();
    assert.equal(res.ok, true);
    assert.equal(res.restoredFromSync, true);
    assert.equal(h.localStore.proActive, true);
    assert.equal(h.localStore.licenseKey, syncedKey);
  }

  // 3a. attemptChromeProfileAutoActivation() exits silently when no Chrome profile email exists
  {
    const h = loadBackgroundHarness({ profileEmail: '' });
    const res = await h.ctx.attemptChromeProfileAutoActivation({ interactive: false });
    assert.equal(res.ok, false);
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'no_chrome_email');
    assert.equal(h.fetchCalls.filter((c) => c.url.includes('chrome-auto-activate')).length, 0);
  }

  // 3b. attemptChromeProfileAutoActivation() activates Pro cleanly on mocked 200 preserving expiresAt
  {
    const expectedExp = '2027-06-15T12:00:00.000Z';
    const h = loadBackgroundHarness({
      profileEmail: 'paid@gmail.com',
      authToken: 'ya29.valid_google_token',
      fetchHandler: async (url) => {
        if (url.includes('chrome-auto-activate')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              valid: true,
              auto_activated: true,
              licenseKey: 'SWEEPR-DB-AUTO-2026-1111',
              status: 'active',
              plan: 'annual',
              expiresAt: expectedExp,
              email_masked: 'p**d@gmail.com',
              devices_used: 2,
              devices_max: 5,
              token: 'hdr.pay.sig'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }
    });
    const res = await h.ctx.attemptChromeProfileAutoActivation({ interactive: false });
    assert.equal(res.ok, true);
    assert.equal(res.valid, true);
    assert.equal(res.autoActivated, true);
    assert.equal(h.localStore.proActive, true);
    assert.equal(h.localStore.licenseExpiresAt, expectedExp);
    assert.equal(h.localStore.chromeAutoActivateResult.status, 'activated');
    assert.equal(h.syncStore.sweeprLicenseBackup.licenseKey, 'SWEEPR-DB-AUTO-2026-1111');
  }

  // 3c. attemptChromeProfileAutoActivation() records device_limit_reached without activating on mocked 403
  {
    const h = loadBackgroundHarness({
      profileEmail: 'full5@gmail.com',
      authToken: 'ya29.valid_google_token',
      fetchHandler: async (url) => {
        if (url.includes('chrome-auto-activate')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              ok: false,
              valid: false,
              error: 'device_limit_reached',
              email_masked: 'f***5@gmail.com',
              devices_used: 5,
              devices_max: 5,
              message: 'Device limit reached (5/5 devices).'
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }
    });
    const res = await h.ctx.attemptChromeProfileAutoActivation({ interactive: false });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'device_limit_reached');
    assert.notEqual(h.localStore.proActive, true);
    assert.equal(h.localStore.chromeAutoActivateResult.status, 'device_limit_reached');
    assert.equal(h.localStore.chromeAutoActivateResult.devicesUsed, 5);
    assert.equal(h.localStore.chromeAutoActivateResult.devicesMax, 5);
  }
});

test('E20: build-store-packages.mjs injects identity + conditional oauth2 only in Chrome ZIP and excludes from Edge/Firefox/Opera', () => {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-store-packages.mjs')], {
      cwd: ROOT,
      env: { ...process.env, GOOGLE_CHROME_EXT_CLIENT_ID: 'test-client.apps.googleusercontent.com' },
      stdio: 'pipe'
    });

    const readManifest = (relZip) => {
      const entries = readZipEntries(path.join(ROOT, relZip));
      const m = entries.find((e) => e.name === 'manifest.json');
      assert.ok(m, `${relZip} missing manifest.json`);
      return JSON.parse(m.data.toString('utf8'));
    };

    const chromeM = readManifest('dist/sweepr-deepblock-v1.3.2-chrome-webstore.zip');
    assert.ok(chromeM.permissions.includes('identity'));
    assert.ok(chromeM.permissions.includes('identity.email'));
    assert.equal(chromeM.oauth2?.client_id, 'test-client.apps.googleusercontent.com');
    assert.deepEqual(chromeM.oauth2?.scopes, ['https://www.googleapis.com/auth/userinfo.email']);

    for (const rel of [
      'dist/sweepr-deepblock-edge-chrome-mv3.zip',
      'dist/sweepr-deepblock-v1.3.2-firefox-amo.zip',
      'dist/sweepr-deepblock-v1.3.2-opera-addons.zip'
    ]) {
      const otherM = readManifest(rel);
      assert.equal(otherM.oauth2, undefined, `${rel} must omit oauth2`);
      assert.ok(!otherM.permissions.includes('identity'), `${rel} must omit identity permission`);
      assert.ok(!otherM.permissions.includes('identity.email'), `${rel} must omit identity.email permission`);
    }
  } finally {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-store-packages.mjs')], {
      cwd: ROOT,
      env: { ...process.env, GOOGLE_CHROME_EXT_CLIENT_ID: '' },
      stdio: 'pipe'
    });
  }
});

test('E21: POST /api/license/chrome-auto-activate rejects missing google_access_token with 400 and echoes allowed extension CORS', async () => {
  const res = await fetch(`${baseUrl}/api/license/chrome-auto-activate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc'
    },
    body: JSON.stringify({ email: 'victim@gmail.com', device_id: 'ext_db_spoof' })
  });
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('access-control-allow-origin'), 'chrome-extension://bkdfhdgmglfancgpkcbdceinfdlccmpc');
  const data = await res.json();
  assert.equal(data.valid, false);
  assert.equal(data.error, 'missing_google_token');
});
