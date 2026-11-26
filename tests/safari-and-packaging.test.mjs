import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ROOT,
  DIST_DIR,
  EXTENSION_DIR,
  SAFARI_DIR,
  SCRIPTS_DIR,
  WEBSITE_DIR,
  EXPECTED_SETUP_EXE_SHA256,
  PRE_EXISTING_WORKSPACE_PATHS,
  readExtensionManifest,
  readZipEntries,
  readManifestFromZip,
  listFilesRecursive,
  findOssLicenseViolationsInDirectory,
  findOssLicenseViolationsInZip
} from './e2e-competitive-gaps/helpers.mjs';

function createSafariWebKitVmHarness(bgCode) {
  const localStore = {};
  const syncStore = {};
  const sessionStore = {};
  const enabledRulesets = new Set([
    'ads_and_trackers',
    'easyprivacy_trackers',
    'regional_eu_filters',
    'tracker_param_stripping',
    'cryptominers_and_heavy_scripts'
  ]);
  const onInstalledListeners = [];
  const onMessageListeners = [];
  const pendingTimers = new Set();

  const makeArea = (store) => ({
    get: async (keys) => {
      if (keys == null) return { ...store };
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
      const out = {};
      for (const k of list) {
        if (k in store) out[k] = store[k];
        else if (keys && typeof keys === 'object' && !Array.isArray(keys) && k in keys) out[k] = keys[k];
      }
      return out;
    },
    set: async (obj) => {
      Object.assign(store, obj);
    },
    remove: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    }
  });

  const extId = 'safari-ext-sweepr';
  const extOrigin = `safari-web-extension://${extId}/`;

  const chromeMock = {
    runtime: {
      id: extId,
      getManifest: () => ({ version: '1.4.0' }),
      getURL: (p) => `${extOrigin}${String(p || '').replace(/^\/+/, '')}`,
      onInstalled: { addListener: (fn) => onInstalledListeners.push(fn) },
      onStartup: { addListener() {} },
      onMessage: { addListener: (fn) => onMessageListeners.push(fn) },
      onMessageExternal: { addListener() {} },
      requestUpdateCheck: undefined,
      setUninstallURL: undefined
    },
    storage: {
      local: makeArea(localStore),
      sync: makeArea(syncStore),
      session: makeArea(sessionStore),
      onChanged: { addListener() {} }
    },
    declarativeNetRequest: {
      updateEnabledRulesets: async ({ enableRulesetIds = [], disableRulesetIds = [] } = {}) => {
        for (const id of disableRulesetIds) enabledRulesets.delete(id);
        for (const id of enableRulesetIds) enabledRulesets.add(id);
      },
      getEnabledRulesets: async () => [...enabledRulesets],
      updateDynamicRules: async () => {},
      getDynamicRules: async () => [],
      setExtensionActionOptions: undefined,
      onRuleMatchedDebug: undefined
    },
    permissions: { contains: async () => false },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: async () => {},
      getRegisteredContentScripts: async () => []
    },
    contextMenus: undefined,
    commands: undefined,
    tabs: {
      discard: undefined,
      create: async (opts) => ({ id: 1, ...opts }),
      query: async () => [],
      get: async () => null,
      update: async (id, props) => ({ id, ...props }),
      remove: async () => {},
      reload: async () => {},
      sendMessage: async () => {},
      onCreated: { addListener() {} },
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      onRemoved: { addListener() {} }
    },
    alarms: {
      create() {},
      clear: async () => true,
      onAlarm: { addListener() {} }
    },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    identity: undefined
  };

  const trackedSetTimeout = (fn, delay = 0) => {
    if (delay === 2500) return 0;
    const h = setTimeout(() => {
      pendingTimers.delete(h);
      fn();
    }, Math.min(Number(delay) || 0, 50));
    if (typeof h.unref === 'function') h.unref();
    pendingTimers.add(h);
    return h;
  };
  const trackedClearTimeout = (h) => {
    pendingTimers.delete(h);
    clearTimeout(h);
  };

  const ctx = {
    chrome: chromeMock,
    Date,
    navigator: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
      language: 'en-US'
    },
    fetch: async () => {
      throw new TypeError('offline');
    },
    setTimeout: trackedSetTimeout,
    clearTimeout: trackedClearTimeout,
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
  vm.runInContext(bgCode, ctx, { filename: 'safari-zip/background.js' });

  return {
    async triggerInstall() {
      for (const fn of onInstalledListeners) {
        await fn({ reason: 'install' });
      }
    },
    async sendMessage(msg) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve({ __timeout: true });
          }
        }, 3000);
        if (typeof timer.unref === 'function') timer.unref();
        const sendResponse = (resp) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(resp);
          }
        };
        let asyncPending = false;
        for (const fn of onMessageListeners) {
          if (fn(msg, { id: extId, url: `${extOrigin}popup.html`, frameId: 0 }, sendResponse) === true) {
            asyncPending = true;
          }
        }
        if (!asyncPending && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ __ignored: true });
        }
      });
    },
    cleanup() {
      for (const h of pendingTimers) clearTimeout(h);
      pendingTimers.clear();
    }
  };
}

function assertBalancedDelimiters(text, label) {
  let curly = 0;
  let paren = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') curly += 1;
    else if (ch === '}') curly -= 1;
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    assert.ok(curly >= 0, `${label}: unmatched closing brace at index ${i}`);
    assert.ok(paren >= 0, `${label}: unmatched closing paren at index ${i}`);
  }
  assert.equal(curly, 0, `${label}: unbalanced curly braces`);
  assert.equal(paren, 0, `${label}: unbalanced parentheses`);
}

describe('M3 Safari Web Extension & Cross-Browser Packaging Suite', () => {
  test('T1: safari/ Xcode scaffolding defines macOS & iOS targets, Swift handler, plists, entitlements & synced Resources', () => {
    const rootManifest = readExtensionManifest();
    const pbxPath = path.join(SAFARI_DIR, 'SWEEPR DeepBlock.xcodeproj', 'project.pbxproj');
    const workspacePath = path.join(SAFARI_DIR, 'SWEEPR DeepBlock.xcodeproj', 'project.xcworkspace', 'contents.xcworkspacedata');
    assert.ok(fs.existsSync(pbxPath), 'Missing safari/SWEEPR DeepBlock.xcodeproj/project.pbxproj');
    assert.ok(fs.existsSync(workspacePath), 'Missing project.xcworkspace/contents.xcworkspacedata');

    const pbx = fs.readFileSync(pbxPath, 'utf8');
    assertBalancedDelimiters(pbx, 'project.pbxproj');

    const definedPbxIds = new Set();
    const defRegex = /^\t\t([0-9A-Za-z]{24})(?:\s+\/\*[^*]*\*\/)?\s*=\s*\{/gm;
    let defMatch;
    while ((defMatch = defRegex.exec(pbx)) !== null) {
      const id = defMatch[1];
      assert.match(id, /^[0-9A-Fa-f]{24}$/, `Non-hex PBX object ID in project.pbxproj: ${id}`);
      assert.equal(definedPbxIds.has(id), false, `Duplicate PBX object ID in project.pbxproj: ${id}`);
      definedPbxIds.add(id);
    }
    assert.ok(definedPbxIds.size >= 60, `Expected >= 60 PBX object definitions, found ${definedPbxIds.size}`);

    const singleRefRegex = /\b(?:mainGroup|productRefGroup|rootObject|fileRef|containerPortal|remoteGlobalIDString|buildConfigurationList|productReference|target|targetProxy)\s*=\s*([0-9A-Za-z]{24})\b/g;
    let refMatch;
    while ((refMatch = singleRefRegex.exec(pbx)) !== null) {
      const refId = refMatch[1];
      assert.match(refId, /^[0-9A-Fa-f]{24}$/, `Non-hex PBX reference ID: ${refId}`);
      assert.ok(definedPbxIds.has(refId), `Unresolved PBX reference ID: ${refId}`);
    }

    const listRefRegex = /\b(?:children|files|buildPhases|dependencies|buildConfigurations|targets)\s*=\s*\(([^)]*)\)/g;
    let listMatch;
    while ((listMatch = listRefRegex.exec(pbx)) !== null) {
      const itemRegex = /^\s*([0-9A-Za-z]{24})(?:\s+\/\*[^*]*\*\/)?,/gm;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(listMatch[1])) !== null) {
        const refId = itemMatch[1];
        assert.match(refId, /^[0-9A-Fa-f]{24}$/, `Non-hex PBX list item ID: ${refId}`);
        assert.ok(definedPbxIds.has(refId), `Unresolved PBX list item ID: ${refId}`);
      }
    }

    const targetAttrMatch = pbx.match(/TargetAttributes\s*=\s*\{([\s\S]*?)\n\t\t\t\t\};/);
    assert.ok(targetAttrMatch, 'Missing TargetAttributes in project.pbxproj');
    const targetAttrIdRegex = /^\t{5}([0-9A-Za-z]{24})\s*=\s*\{/gm;
    let attrMatch;
    while ((attrMatch = targetAttrIdRegex.exec(targetAttrMatch[1])) !== null) {
      const refId = attrMatch[1];
      assert.match(refId, /^[0-9A-Fa-f]{24}$/, `Non-hex TargetAttributes ID: ${refId}`);
      assert.ok(definedPbxIds.has(refId), `Unresolved TargetAttributes ID: ${refId}`);
    }

    assert.match(pbx, /MACOSX_DEPLOYMENT_TARGET\s*=\s*13\.0;/);
    assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET\s*=\s*16\.0;/);
    assert.match(pbx, new RegExp(`MARKETING_VERSION\\s*=\\s*${rootManifest.version.replace(/\./g, '\\.')};`));
    assert.match(pbx, /CURRENT_PROJECT_VERSION\s*=\s*140;/);
    assert.match(pbx, /SWEEPR DeepBlock \(macOS\)/);
    assert.match(pbx, /SWEEPR DeepBlock Extension \(macOS\)/);
    assert.match(pbx, /SWEEPR DeepBlock \(iOS\)/);
    assert.match(pbx, /SWEEPR DeepBlock Extension \(iOS\)/);
    assert.match(pbx, /com\.sweeprdeepblock\.safari\.Extension/);
    assert.match(pbx, /Copyright \(c\) 2026 Benjamin Cook \(SWEEPR DeepBlock\)\. All rights reserved\./);

    const requiredFiles = [
      'SWEEPR DeepBlock.xcodeproj/xcshareddata/xcschemes/SWEEPR DeepBlock (macOS).xcscheme',
      'SWEEPR DeepBlock.xcodeproj/xcshareddata/xcschemes/SWEEPR DeepBlock (iOS).xcscheme',
      'SWEEPR DeepBlock/Shared (Extension)/SafariWebExtensionHandler.swift',
      'SWEEPR DeepBlock/Shared (Extension)/Resources/manifest.json',
      'SWEEPR DeepBlock/Shared (App)/ViewController.swift',
      'SWEEPR DeepBlock/Shared (App)/Resources/Base.lproj/Main.html',
      'SWEEPR DeepBlock/Shared (App)/Resources/Style.css',
      'SWEEPR DeepBlock/Shared (App)/Resources/Script.js',
      'SWEEPR DeepBlock/macOS (App)/AppDelegate.swift',
      'SWEEPR DeepBlock/macOS (App)/Info.plist',
      'SWEEPR DeepBlock/macOS (App)/SWEEPR DeepBlock.entitlements',
      'SWEEPR DeepBlock/macOS (App)/Assets.xcassets/Contents.json',
      'SWEEPR DeepBlock/macOS (App)/Assets.xcassets/AppIcon.appiconset/Contents.json',
      'SWEEPR DeepBlock/macOS (Extension)/Info.plist',
      'SWEEPR DeepBlock/macOS (Extension)/SWEEPR DeepBlock Extension.entitlements',
      'SWEEPR DeepBlock/iOS (App)/AppDelegate.swift',
      'SWEEPR DeepBlock/iOS (App)/SceneDelegate.swift',
      'SWEEPR DeepBlock/iOS (App)/Info.plist',
      'SWEEPR DeepBlock/iOS (App)/SWEEPR DeepBlock.entitlements',
      'SWEEPR DeepBlock/iOS (App)/Assets.xcassets/Contents.json',
      'SWEEPR DeepBlock/iOS (App)/Assets.xcassets/AppIcon.appiconset/Contents.json',
      'SWEEPR DeepBlock/iOS (Extension)/Info.plist',
      'SWEEPR DeepBlock/iOS (Extension)/SWEEPR DeepBlock Extension.entitlements'
    ];
    for (const rel of requiredFiles) {
      assert.ok(fs.existsSync(path.join(SAFARI_DIR, rel)), `Missing Safari project file: ${rel}`);
    }

    const handler = fs.readFileSync(path.join(SAFARI_DIR, 'SWEEPR DeepBlock/Shared (Extension)/SafariWebExtensionHandler.swift'), 'utf8');
    assert.match(handler, /import SafariServices/);
    assert.match(handler, /NSExtensionRequestHandling/);
    assert.match(handler, /SFExtensionMessageKey/);
    assert.match(handler, /1\.4\.0/);

    const viewController = fs.readFileSync(path.join(SAFARI_DIR, 'SWEEPR DeepBlock/Shared (App)/ViewController.swift'), 'utf8');
    assert.match(
      viewController,
      /allowingReadAccessTo:\s*(?:Bundle\.main\.resourceURL|url\.deletingLastPathComponent\(\)\.deletingLastPathComponent\(\))/,
      'ViewController.swift must grant WKWebView read access to Resources root so ../Style.css and ../Script.js load'
    );
    assert.doesNotMatch(
      viewController,
      /allowingReadAccessTo:\s*url\.deletingLastPathComponent\(\)\s*\)/,
      'ViewController.swift must not restrict WKWebView read access to Base.lproj/ alone'
    );

    for (const extPlistRel of [
      'SWEEPR DeepBlock/macOS (Extension)/Info.plist',
      'SWEEPR DeepBlock/iOS (Extension)/Info.plist'
    ]) {
      const plist = fs.readFileSync(path.join(SAFARI_DIR, extPlistRel), 'utf8');
      assert.match(plist, /com\.apple\.Safari\.web-extension/);
      assert.match(plist, /\$\(PRODUCT_MODULE_NAME\)\.SafariWebExtensionHandler/);
    }

    const syncedManifest = JSON.parse(
      fs.readFileSync(path.join(SAFARI_DIR, 'SWEEPR DeepBlock/Shared (Extension)/Resources/manifest.json'), 'utf8')
    );
    assert.equal(syncedManifest.version, rootManifest.version);
    assert.equal('minimum_chrome_version' in syncedManifest, false);
  });

  test('T2: .github/workflows/safari-build.yml configures macOS runner, converter check, xcodebuild & gated App Store Connect upload', () => {
    const wfPath = path.join(ROOT, '.github', 'workflows', 'safari-build.yml');
    assert.ok(fs.existsSync(wfPath), 'Missing .github/workflows/safari-build.yml');
    const yml = fs.readFileSync(wfPath, 'utf8');
    assert.match(yml, /runs-on:\s*macos-latest/i);
    assert.match(yml, /node scripts\/build-store-packages\.mjs/);
    assert.match(yml, /xcrun safari-web-extension-converter/);
    assert.match(yml, /generic\/platform=macOS/);
    assert.match(yml, /generic\/platform=iOS/);
    assert.match(yml, /CODE_SIGNING_ALLOWED=NO/);
    assert.match(yml, /-allowProvisioningUpdates/);
    assert.match(yml, /-authenticationKeyID/);
    assert.match(yml, /xcrun altool --upload-app/);
    assert.match(yml, /secrets\.APPLE_APP_STORE_CONNECT_KEY_ID/);
    assert.doesNotMatch(yml, /BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY/);
  });

  test('T3: Safari MV3 ZIPs match v1.4.0, omit unsupported keys, use service_worker, and bundle all 5 DNR rulesets', () => {
    const rootManifest = readExtensionManifest();
    const unversioned = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    const versioned = path.join(DIST_DIR, `sweepr-deepblock-v${rootManifest.version}-safari-mv3.zip`);
    assert.ok(fs.existsSync(unversioned), `Missing ${unversioned}`);
    assert.ok(fs.existsSync(versioned), `Missing ${versioned}`);
    assert.equal(
      Buffer.compare(fs.readFileSync(unversioned), fs.readFileSync(versioned)),
      0,
      'Versioned and unversioned Safari MV3 ZIPs must be identical'
    );

    const { manifest, entries } = readManifestFromZip(unversioned);
    assert.equal(manifest.version, rootManifest.version);
    assert.equal('minimum_chrome_version' in manifest, false);
    assert.equal('browser_specific_settings' in manifest, false);
    assert.equal('oauth2' in manifest, false);
    assert.equal(manifest.background?.service_worker, 'background.js');
    assert.equal('scripts' in (manifest.background || {}), false);

    const perms = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])];
    assert.equal(perms.includes('identity'), false);
    assert.equal(perms.includes('identity.email'), false);
    assert.equal(perms.includes('clipboardRead'), false);
    for (const reqPerm of ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess', 'storage', 'alarms', 'tabs', 'contextMenus', 'scripting']) {
      assert.ok((manifest.permissions || []).includes(reqPerm), `Safari manifest missing ${reqPerm}`);
    }
    for (const cs of manifest.content_scripts || []) {
      assert.equal('world' in cs, false);
    }

    const resources = manifest.declarative_net_request?.rule_resources || [];
    assert.equal(resources.length, 5);
    let totalRules = 0;
    for (const rr of resources) {
      const entry = entries.find((e) => e.name === rr.path);
      assert.ok(entry, `Missing DNR ruleset ${rr.path} in Safari ZIP`);
      const text = entry.data.toString('utf8');
      assert.doesNotMatch(text, /"url"\s*:\s*"data:/i);
      const parsed = JSON.parse(text);
      assert.ok(Array.isArray(parsed) && parsed.length <= 30000);
      totalRules += parsed.length;
    }
    assert.ok(totalRules >= 25000 && totalRules <= 330000, `Unexpected Safari DNR count: ${totalRules}`);
  });

  test('T4: Safari JS passes vm.Script syntax, strips requestUpdateCheck/onRuleMatchedDebug, and executes in WebKit VM mock', async () => {
    const safariZip = path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip');
    const entries = readZipEntries(safariZip);
    const jsEntries = entries.filter((e) => e.name.endsWith('.js'));
    assert.ok(jsEntries.length >= 4);

    let bgCode = '';
    for (const e of jsEntries) {
      const code = e.data.toString('utf8');
      assert.doesNotThrow(() => new vm.Script(code, { filename: `safari-zip/${e.name}` }));
      assert.doesNotMatch(code, /\b(requestUpdateCheck|onRuleMatchedDebug)\b/, `Unsupported API in Safari ${e.name}`);
      if (e.name === 'background.js') bgCode = code;
    }
    assert.ok(bgCode.length > 0);
    assert.match(bgCode, /tabsDiscardSupported|typeof\s+chrome\.tabs\.discard/);

    for (const file of listFilesRecursive(path.join(SAFARI_DIR, 'SWEEPR DeepBlock/Shared (Extension)/Resources'))) {
      if (!file.endsWith('.js')) continue;
      const code = fs.readFileSync(file, 'utf8');
      assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
      assert.doesNotMatch(code, /\b(requestUpdateCheck|onRuleMatchedDebug)\b/);
    }

    const vmHarness = createSafariWebKitVmHarness(bgCode);
    try {
      await vmHarness.triggerInstall();
      const state = await vmHarness.sendMessage({ type: 'GET_DASHBOARD_STATE' });
      assert.equal(state.proActive, true);
      assert.equal(state.subscriptionStatus, 'trialing');
    } finally {
      vmHarness.cleanup();
    }
  });

  test('T5: All 12 store and website archives share v1.4.0, POSIX forward slashes, and zero localhost/127.0.0.1/817797', () => {
    const ver = readExtensionManifest().version;
    const archives = [
      path.join(DIST_DIR, 'sweepr-deepblock-chrome-webstore-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip'),
      path.join(DIST_DIR, 'sweepr-deepblock-safari-mv3.zip'),
      path.join(DIST_DIR, `sweepr-deepblock-v${ver}-chrome-webstore.zip`),
      path.join(DIST_DIR, `sweepr-deepblock-v${ver}-firefox-amo.zip`),
      path.join(DIST_DIR, `sweepr-deepblock-v${ver}-opera-addons.zip`),
      path.join(DIST_DIR, `sweepr-deepblock-v${ver}-safari-mv3.zip`),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-extension.zip'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock.xpi')
    ];

    for (const zipPath of archives) {
      assert.ok(fs.existsSync(zipPath), `Missing archive: ${zipPath}`);
      const { manifest, entries } = readManifestFromZip(zipPath);
      assert.equal(manifest.version, ver, `Version mismatch in ${zipPath}`);
      for (const e of entries) {
        assert.equal(e.name.includes('\\'), false, `Backslash in ${zipPath}: ${e.name}`);
        assert.equal(e.name.includes('..'), false, `Traversal in ${zipPath}: ${e.name}`);
        if (/\.(?:js|json|html|css)$/i.test(e.name)) {
          const text = e.data.toString('utf8');
          assert.doesNotMatch(text, /http:\/\/(?:localhost|127\.0\.0\.1):\d+/i, `Localhost URL in ${zipPath}:${e.name}`);
          assert.equal(text.includes('817797'), false, `Dev code 817797 in ${zipPath}:${e.name}`);
        }
      }
    }
  });

  test('T6: Firefox 128.0 AMO compliance across manifest, ZIP, XPIs, and packaging scripts', () => {
    const extManifest = readExtensionManifest();
    assert.equal(extManifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');

    for (const rel of ['build-store-packages.mjs', 'ad-filter-pipeline/git-deployer.mjs']) {
      const src = fs.readFileSync(path.join(SCRIPTS_DIR, rel), 'utf8');
      assert.ok(src.includes("'128.0'") || src.includes('"128.0"'));
      assert.doesNotMatch(src, /strict_min_version:\s*['"]140\.0['"]/);
    }

    for (const file of [
      path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock-firefox.xpi'),
      path.join(WEBSITE_DIR, 'sweepr-deepblock.xpi')
    ]) {
      const { manifest, entries } = readManifestFromZip(file);
      assert.equal(manifest.browser_specific_settings?.gecko?.id, 'extension@sweeprdeepblock.com');
      assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version, '128.0');
      assert.deepEqual(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required, ['none']);
      assert.deepEqual(manifest.background?.scripts, ['background.js']);
      assert.equal(manifest.background?.service_worker, undefined);
      for (const e of entries) {
        if (e.name.endsWith('.js')) {
          assert.doesNotMatch(e.data.toString('utf8'), /\b(requestUpdateCheck|onRuleMatchedDebug)\b/);
        }
      }
    }
  });

  test('T7: Edge and Opera manifest isolation preserves store-specific permission and schema limits', () => {
    const edgeM = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip')).manifest;
    assert.equal('oauth2' in edgeM, false);
    assert.equal((edgeM.permissions || []).includes('identity'), false);
    assert.equal((edgeM.permissions || []).includes('identity.email'), false);

    const operaM = readManifestFromZip(path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip')).manifest;
    assert.equal('minimum_chrome_version' in operaM, false);
    assert.equal('browser_specific_settings' in operaM, false);
    assert.equal((operaM.permissions || []).includes('declarativeNetRequestWithHostAccess'), false);
    assert.equal((operaM.permissions || []).includes('identity'), false);
    for (const cs of operaM.content_scripts || []) {
      assert.equal('world' in cs, false);
    }
    assert.ok(typeof operaM.short_name === 'string' && operaM.short_name.length <= 12);
    assert.ok(typeof operaM.description === 'string' && operaM.description.length <= 132);
  });

  test('T8: Strictly closed-source / zero-OSS audit across package.json, root, extension/, safari/, dist/ & archives', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.license, undefined);
    assert.equal(pkg.licenses, undefined);

    for (const dir of [ROOT, DIST_DIR]) {
      for (const entry of fs.readdirSync(dir)) {
        assert.doesNotMatch(entry, /^(?:LICENSE|COPYING|UNLICENSE|NOTICE)(?:[-.][a-z0-9._-]+)?$/i);
      }
    }
    assert.deepEqual(findOssLicenseViolationsInDirectory(EXTENSION_DIR), []);
    assert.deepEqual(findOssLicenseViolationsInDirectory(SAFARI_DIR), []);

    for (const name of [
      'sweepr-deepblock-chrome-webstore-mv3.zip',
      'sweepr-deepblock-edge-chrome-mv3.zip',
      'sweepr-deepblock-firefox-amo-mv3.zip',
      'sweepr-deepblock-opera-mv3.zip',
      'sweepr-deepblock-safari-mv3.zip'
    ]) {
      assert.deepEqual(findOssLicenseViolationsInZip(path.join(DIST_DIR, name)), []);
    }

    const guide = fs.readFileSync(path.join(DIST_DIR, 'STORE_SUBMISSION_GUIDE.md'), 'utf8');
    assert.match(guide, /Copyright \(c\) 2026 Benjamin Cook \(SWEEPR DeepBlock\)\. All rights reserved\./);
  });

  test('T9: dist/STORE_SUBMISSION_GUIDE.md documents all 4 store targets, exact v1.4.0 archives & CI/CLI commands', () => {
    const guidePath = path.join(DIST_DIR, 'STORE_SUBMISSION_GUIDE.md');
    assert.ok(fs.existsSync(guidePath), 'Missing dist/STORE_SUBMISSION_GUIDE.md');
    const guide = fs.readFileSync(guidePath, 'utf8');

    for (const requiredSnippet of [
      '1.4.0',
      '36,019',
      'Chrome Web Store',
      'Firefox Add-ons',
      'Microsoft Edge Add-ons',
      'Apple App Store / Safari',
      'sweepr-deepblock-chrome-webstore-mv3.zip',
      'sweepr-deepblock-v1.4.0-chrome-webstore.zip',
      'sweepr-deepblock-firefox-amo-mv3.zip',
      'sweepr-deepblock-v1.4.0-firefox-amo.zip',
      'sweepr-deepblock-edge-chrome-mv3.zip',
      'sweepr-deepblock-safari-mv3.zip',
      'sweepr-deepblock-v1.4.0-safari-mv3.zip',
      'safari/SWEEPR DeepBlock.xcodeproj',
      'xcrun safari-web-extension-converter',
      'xcrun altool --upload-app'
    ]) {
      assert.ok(guide.includes(requiredSnippet), `STORE_SUBMISSION_GUIDE.md missing "${requiredSnippet}"`);
    }
  });

  test('T10: Pre-existing uncommitted workspace files, SWEEPRDeepblockSetup.exe SHA-256 & Shadow-DOM marker remain intact', () => {
    for (const relPath of PRE_EXISTING_WORKSPACE_PATHS) {
      assert.ok(fs.existsSync(path.join(ROOT, relPath)), `Missing pre-existing path: ${relPath}`);
    }
    const exeBytes = fs.readFileSync(path.join(WEBSITE_DIR, 'SWEEPRDeepblockSetup.exe'));
    const actualSha = crypto.createHash('sha256').update(exeBytes).digest('hex').toUpperCase();
    assert.equal(actualSha, EXPECTED_SETUP_EXE_SHA256);

    const contentJs = fs.readFileSync(path.join(EXTENSION_DIR, 'content', 'deepblock-content.js'), 'utf8');
    assert.ok(contentJs.includes('GDPR Cookie Banner Handling (Shadow-DOM Aware Auto-Rejector + Deduped Counter)'));
  });
});
