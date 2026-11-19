import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
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
      SWEEPR_CRM_API_KEY: 'test_crm_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      CRM_ADMIN_PASSWORD: 'test_admin_password',
      LATEST_EXTENSION_VERSION: '1.3.1',
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

test('E1: manifest.json bumped to 1.3.1 with scripting, optional clipboardRead, MacCtrl shortcuts, 3 rulesets, and valid surrogates WAR', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'));
  assert.equal(manifest.version, '1.3.1');
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
    /secondsSaved\s*:\s*42/
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

test('E5: built v1.3.1 store ZIPs exist and pass Opera/Chrome/Firefox compliance checks', () => {
  const zips = [
    'dist/sweepr-deepblock-v1.3.1-chrome-webstore.zip',
    'dist/sweepr-deepblock-v1.3.1-firefox-amo.zip',
    'dist/sweepr-deepblock-v1.3.1-opera-addons.zip',
    'dist/sweepr-deepblock-edge-chrome-mv3.zip'
  ];
  for (const z of zips) {
    const full = path.join(ROOT, z);
    assert.ok(fs.existsSync(full), `Missing store archive ${z}`);
    const entries = readZipEntries(full);
    const manifestEntry = entries.find((e) => e.name === 'manifest.json');
    assert.ok(manifestEntry, `${z} missing manifest.json`);
    const parsedManifest = JSON.parse(manifestEntry.data.toString('utf8'));
    assert.equal(parsedManifest.version, '1.3.1');
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

test('E7: deepblock-content.js isolates settings.adBlocking === false so cookie/search/scam stay active', () => {
  const src = fs.readFileSync(path.join(ROOT, 'extension/content/deepblock-content.js'), 'utf8');
  let calledCookie = false;
  let calledSearch = false;
  let calledScam = false;
  let calledAdHide = false;

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
              trustedShopSites: [],
              settings: {
                adBlocking: false,
                cookieAutoClose: true,
                hideSearchSpam: true,
                fakeShopAlerts: true,
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
            trustedShopSites: [],
            settings: {
              adBlocking: false,
              cookieAutoClose: true,
              hideSearchSpam: true,
              fakeShopAlerts: true,
              silentMode: true
            },
            remoteFeatureFlags: {}
          });
        }
      }
    }
  };

  // Run initProtection-equivalent check on real GET_PAGE_SETTINGS branch using extracted logic
  assert.ok(src.includes('const adBlockingEnabled = settings.adBlocking !== false;'));
  assert.ok(src.includes('if (adBlockingEnabled) {\n          injectUniversalAdCosmeticStyle();') || src.includes('if (adBlockingEnabled) {\r\n          injectUniversalAdCosmeticStyle();'));

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

  const instrumented = src.replace(
    /processCookieBanners\(true, extraCmpSelectors\);/,
    'processCookieBanners(true, extraCmpSelectors); __hooks.cookie();'
  ).replace(
    /processSearchResults\(true, extraSlopDomains\);/,
    'processSearchResults(true, extraSlopDomains); __hooks.search();'
  ).replace(
    /processEcommerceStore\(true, trustedShopSites\);/,
    'processEcommerceStore(true, trustedShopSites); __hooks.scam();'
  ).replace(
    /processRecipeAndNewsClutter\(true\);/,
    'processRecipeAndNewsClutter(true); __hooks.adHide();'
  );
  sandbox.__hooks = {
    cookie: () => { calledCookie = true; },
    search: () => { calledSearch = true; },
    scam: () => { calledScam = true; },
    adHide: () => { calledAdHide = true; }
  };

  vm.runInNewContext(instrumented, sandbox, { filename: 'deepblock-content.js' });
  assert.equal(calledCookie, true, 'cookieAutoClose must still run when adBlocking === false');
  assert.equal(calledSearch, true, 'hideSearchSpam must still run when adBlocking === false');
  assert.equal(calledScam, true, 'fakeShopAlerts must still run when adBlocking === false');
  assert.equal(calledAdHide, false, 'ad cleanup must not run when adBlocking === false');
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
