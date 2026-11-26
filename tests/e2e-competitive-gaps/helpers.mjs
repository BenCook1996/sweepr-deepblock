import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import {
  ROOT,
  WEBSITE_DIR,
  CANONICAL_ORIGIN,
  startEphemeralServer,
  launchHeadlessBrowser,
  extractJsonLdBlocks,
  collectJsonLdFields,
  parseSitemapUrls,
  extractVisibleText,
  readExtensionManifest,
  removeDirSafe,
  decodeXmlEntities
} from '../e2e-helpers.mjs';

export {
  ROOT,
  WEBSITE_DIR,
  CANONICAL_ORIGIN,
  startEphemeralServer,
  launchHeadlessBrowser,
  extractJsonLdBlocks,
  collectJsonLdFields,
  parseSitemapUrls,
  extractVisibleText,
  readExtensionManifest,
  removeDirSafe,
  decodeXmlEntities
};

export const EXTENSION_DIR = path.join(ROOT, 'extension');
export const DIST_DIR = path.join(ROOT, 'dist');
export const SAFARI_DIR = path.join(ROOT, 'safari');
export const SCRIPTS_DIR = path.join(ROOT, 'scripts');
export const CRM_DB_PATH = path.join(ROOT, 'data', 'sweepr-crm.db');
export const EXPECTED_SETUP_EXE_SHA256 =
  '139D0CE926EE6A2F373D496594B48A25BEA8FF5AE384F5124764CE4243CD967D';

export const SWEEPR_FIRST_PARTY_DOMAINS = [
  'sweeprdeepblock.com',
  'www.sweeprdeepblock.com',
  'sweeprcleaner.com',
  'www.sweeprcleaner.com',
  'sweeprvpn.com',
  'www.sweeprvpn.com'
];

export const PRE_EXISTING_WORKSPACE_PATHS = [
  'chocolatey/tools/chocolateyinstall.ps1',
  'chocolatey/tools/VERIFICATION.txt',
  'installer/SWEEPRDeepblockSetup.cs',
  'installer/app.manifest',
  'winget-manifests/s/SWEEPR/Deepblock/1.3.1/SWEEPR.Deepblock.installer.yaml',
  'mobile/android/src/com/sweepr/deepblock/MainActivity.java',
  'store-creatives/README.md',
  'tests/e2e-p0',
  'tests/e2e-seo',
  'website/SWEEPRDeepblockSetup.exe',
  'website/SWEEPRDeepblock.apk',
  'README.md',
  'AD_FILTER_PIPELINE_LOG.md',
  'TECHNICAL_SEO_AUDIT_LOG.md',
  'content-effort-audit.html',
  'dist/sweepr-deepblock.1.3.0.nupkg',
  'dist/SWEEPR-CRM-v1.0.0.apk'
];

export function compareSemver(a, b) {
  const parse = (v) =>
    String(v || '')
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function isStrictGaSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(String(v || '').trim());
}

export function readZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset >= 0, `ZIP EOCD signature not found in ${zipPath}`);

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    assert.equal(buf.readUInt32LE(cursor), 0x02014b50, `Invalid ZIP central directory header in ${zipPath}`);
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');

    assert.equal(buf.readUInt32LE(localHeaderOffset), 0x04034b50, `Invalid ZIP local header for ${name}`);
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
    entries.push({ name, data, compressionMethod });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readManifestFromZip(zipPath) {
  const entries = readZipEntries(zipPath);
  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  assert.ok(manifestEntry, `Missing manifest.json inside ${zipPath}`);
  return {
    manifest: JSON.parse(manifestEntry.data.toString('utf8')),
    entries
  };
}

function cleanCellHtml(raw) {
  return decodeXmlEntities(
    String(raw || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function parseHtmlTables(html) {
  const tables = [];
  for (const tableMatch of String(html || '').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableHtml = tableMatch[1];
    const headers = [];
    const theadMatch = tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
    if (theadMatch) {
      for (const th of theadMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)) {
        headers.push(cleanCellHtml(th[1]));
      }
    } else {
      for (const tr of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const ths = [...tr[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)];
        if (ths.length > 0) {
          for (const th of ths) {
            headers.push(cleanCellHtml(th[1]));
          }
          break;
        }
      }
    }
    const rows = [];
    const tbodyHtml = (tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i) || [null, tableHtml])[1];
    for (const tr of tbodyHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [];
      for (const cell of tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
        cells.push(cleanCellHtml(cell[1]));
      }
      if (cells.length > 0) {
        rows.push({ label: cells[0], cells });
      }
    }
    tables.push({ headers, rows });
  }
  return tables;
}

export function findTableCell(tables, columnHeaderRe, rowLabelRe) {
  for (const table of tables) {
    const colIdx = table.headers.findIndex((h) => columnHeaderRe.test(h));
    if (colIdx === -1) continue;
    const row = table.rows.find((r) => rowLabelRe.test(r.label));
    if (!row || colIdx >= row.cells.length) continue;
    return { header: table.headers[colIdx], rowLabel: row.label, value: row.cells[colIdx] };
  }
  return null;
}

export function computeCompiledStaticDnrRules(manifestOverride = null) {
  const manifest = manifestOverride || readExtensionManifest();
  const resources = manifest?.declarative_net_request?.rule_resources || [];
  const rulesets = [];
  let totalRules = 0;
  let enabledTotalRules = 0;

  for (const res of resources) {
    const absPath = path.join(EXTENSION_DIR, res.path || '');
    const exists = fs.existsSync(absPath);
    let rules = [];
    let error = null;
    if (!exists) {
      error = `Missing ruleset file: ${res.path}`;
    } else {
      try {
        const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        if (!Array.isArray(parsed)) {
          error = `Ruleset ${res.path} is not a JSON array`;
        } else {
          rules = parsed;
        }
      } catch (err) {
        error = `Invalid JSON in ${res.path}: ${err.message}`;
      }
    }
    totalRules += rules.length;
    if (res.enabled) enabledTotalRules += rules.length;
    rulesets.push({
      id: res.id,
      path: res.path,
      enabled: Boolean(res.enabled),
      exists,
      count: rules.length,
      rules,
      error
    });
  }

  return {
    manifest,
    ruleResources: resources,
    enabledResources: resources.filter((r) => r.enabled),
    rulesets,
    totalRules,
    enabledTotalRules
  };
}

export function getIndexableVsPaths() {
  const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
  const { paths } = parseSitemapUrls(sitemapPath);
  return paths.filter((p) => p === '/vs' || p.startsWith('/vs/'));
}

export function resolveWebsiteHtmlPath(urlPath) {
  const clean = String(urlPath || '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return path.join(WEBSITE_DIR, 'index.html');
  const directHtml = path.join(WEBSITE_DIR, `${clean}.html`);
  if (fs.existsSync(directHtml)) return directHtml;
  const indexHtml = path.join(WEBSITE_DIR, clean, 'index.html');
  if (fs.existsSync(indexHtml)) return indexHtml;
  return directHtml;
}

export function getAllVsHtmlFiles() {
  const vsDir = path.join(WEBSITE_DIR, 'vs');
  return fs
    .readdirSync(vsDir)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => path.join(vsDir, f));
}

export function findStaleDeepblockVersions(text, currentVersion) {
  const stale = [];
  const matches = String(text || '').matchAll(
    /(?:SWEEPR\s+Deepblock(?:\s+[A-Za-z0-9-]+){0,2}\s*v?|softwareVersion["']?\s*[:=]\s*["']?|Program_Version>|"version"\s*:\s*"|Version\s+|extensionVersion["']?\s*:\s*["']?|\bv)(1\.3\.[012])\b/gi
  );
  for (const m of matches) {
    if (m[1] !== currentVersion) stale.push(m[0]);
  }
  return stale;
}

export function inspectCmpCoverage() {
  const contentPath = path.join(EXTENSION_DIR, 'content', 'deepblock-content.js');
  const src = fs.readFileSync(contentPath, 'utf8');
  const hasShadowCommentMarker = src.includes(
    'GDPR Cookie Banner Handling (Shadow-DOM Aware Auto-Rejector + Deduped Counter)'
  );

  // Evaluate in minimal safe harness to inspect any exposed registry or top-level constants
  let runtimeMeta = null;
  const instrumented = src.replace(
    /\}\)\(\);\s*$/,
    `  try {
      globalThis.__CMP_INSPECT__ = {
        CMP_SELECTORS: typeof CMP_SELECTORS !== 'undefined' ? CMP_SELECTORS : null,
        CMP_REJECT_BUTTONS: typeof CMP_REJECT_BUTTONS !== 'undefined' ? CMP_REJECT_BUTTONS : null,
        CMP_FRAMEWORKS: typeof CMP_FRAMEWORKS !== 'undefined' ? CMP_FRAMEWORKS : null,
        CMP_REGISTRY: typeof CMP_REGISTRY !== 'undefined' ? CMP_REGISTRY : null,
        CMP_PROVIDERS: typeof CMP_PROVIDERS !== 'undefined' ? CMP_PROVIDERS : null,
        CMP_DEFINITIONS: typeof CMP_DEFINITIONS !== 'undefined' ? CMP_DEFINITIONS : null,
        meta:
          (typeof window !== 'undefined' &&
            (window.__deepblockCmpMeta || window.__SWEEPR_CMP_META__ || window.__SWEEPR_CMP_REGISTRY__)) ||
          globalThis.__DEEPBLOCK_CMP_META__ ||
          globalThis.__SWEEPR_CMP_REGISTRY__ ||
          null
      };
    } catch (_) {}
  })();`
  );

  const win = {
    top: null,
    self: null,
    addEventListener() {},
    dispatchEvent() {}
  };
  win.top = win;
  win.self = win;

  try {
    const sandbox = {
      location: { hostname: 'example.com', href: 'https://example.com/' },
      chrome: {
        storage: { local: { get() {}, set() {} } },
        runtime: { id: 'test', onMessage: { addListener() {} }, sendMessage() {} }
      },
      navigator: { userAgent: 'Mozilla/5.0' },
      getComputedStyle: () => ({ overflow: 'visible', display: 'block' }),
      document: {
        readyState: 'complete',
        documentElement: { dataset: {}, style: { setProperty() {} } },
        head: null,
        body: null,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {} }),
        addEventListener() {}
      },
      window: win,
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
      setTimeout: () => 0,
      clearTimeout() {},
      URL,
      URLSearchParams,
      console
    };
    vm.runInNewContext(instrumented, sandbox, { filename: 'deepblock-content-inspect.js' });
    runtimeMeta = sandbox.__CMP_INSPECT__ || null;
  } catch {
    runtimeMeta = null;
  }

  const selectors = Array.isArray(runtimeMeta?.CMP_SELECTORS) ? runtimeMeta.CMP_SELECTORS : [];
  const rejectButtons = Array.isArray(runtimeMeta?.CMP_REJECT_BUTTONS) ? runtimeMeta.CMP_REJECT_BUTTONS : [];
  const registryCandidates = [
    runtimeMeta?.CMP_FRAMEWORKS,
    runtimeMeta?.CMP_REGISTRY,
    runtimeMeta?.CMP_PROVIDERS,
    runtimeMeta?.CMP_DEFINITIONS
  ].filter(Boolean);

  let namedFrameworks = [];
  for (const reg of registryCandidates) {
    if (Array.isArray(reg)) {
      namedFrameworks = reg.map((item) =>
        typeof item === 'string' ? item : item?.name || item?.id || item?.framework || JSON.stringify(item)
      );
      break;
    } else if (reg && typeof reg === 'object') {
      namedFrameworks = Object.keys(reg);
      break;
    }
  }

  const metaCount = Number(
    runtimeMeta?.meta?.frameworkCount ||
      runtimeMeta?.meta?.count ||
      (Array.isArray(runtimeMeta?.meta?.frameworks) ? runtimeMeta.meta.frameworks.length : 0) ||
      0
  );
  const uniqueFrameworkNames = new Set(namedFrameworks.filter(Boolean));
  const uniqueSelectors = new Set(selectors.filter((s) => typeof s === 'string' && s.trim()));

  const frameworkCount = Math.max(metaCount, uniqueFrameworkNames.size) || uniqueSelectors.size;

  return {
    frameworkCount,
    selectorCount: uniqueSelectors.size,
    rejectButtonCount: rejectButtons.length,
    frameworks: [...uniqueFrameworkNames],
    selectors: [...uniqueSelectors],
    hasShadowCommentMarker
  };
}

export function extractClaimedCmpCounts(text) {
  const counts = [];
  for (const m of String(text || '').matchAll(/(\d+)\+?\s*(?:CMP(?:\s+frameworks?)?|consent\s+(?:frameworks?|platforms?))/gi)) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n)) counts.push(n);
  }
  return counts;
}

export function createBackgroundVmHarness({
  initialLocal = {},
  initialSync = {},
  nowMs = Date.UTC(2026, 10, 25, 0, 0, 0),
  fetchHandler = null,
  serverBaseUrl = null,
  offline = false,
  tabs = [],
  permissionsGranted = true,
  tabsDiscardSupported = true,
  profileEmail = '',
  authToken = ''
} = {}) {
  const bgSrc = fs.readFileSync(path.join(EXTENSION_DIR, 'background.js'), 'utf8');
  const manifest = readExtensionManifest();

  const RealDate = Date;
  let currentNow = nowMs;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(currentNow);
      else super(...args);
    }
    static now() {
      return currentNow;
    }
    static parse(s) {
      return RealDate.parse(s);
    }
    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  }

  const storageListeners = [];
  function makeStorageArea(areaName, initial = {}) {
    const store = structuredClone(initial);
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
          result[k] = structuredClone(store[k]);
        } else if (
          keys &&
          !Array.isArray(keys) &&
          typeof keys === 'object' &&
          Object.prototype.hasOwnProperty.call(keys, k)
        ) {
          result[k] = structuredClone(keys[k]);
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
        const oldValue = Object.prototype.hasOwnProperty.call(store, k) ? structuredClone(store[k]) : undefined;
        store[k] = structuredClone(v);
        changes[k] = { oldValue, newValue: structuredClone(v) };
      }
      for (const listener of storageListeners) {
        try {
          listener(changes, areaName);
        } catch {}
      }
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
          changes[k] = { oldValue: structuredClone(store[k]), newValue: undefined };
          delete store[k];
        }
      }
      for (const listener of storageListeners) {
        try {
          listener(changes, areaName);
        } catch {}
      }
      if (typeof cb === 'function') {
        cb();
        return undefined;
      }
      return Promise.resolve();
    };
    return { store, area: { get, set, remove } };
  }

  const localWrap = makeStorageArea('local', initialLocal);
  const syncWrap = makeStorageArea('sync', initialSync);
  const sessionWrap = makeStorageArea('session', {});

  const initialEnabledIds = (manifest?.declarative_net_request?.rule_resources || [])
    .filter((r) => r.enabled)
    .map((r) => r.id);
  const enabledRulesets = new Set(initialEnabledIds);
  const dnrRulesetCalls = [];
  const dnrDynamicRules = new Map();
  const dnrDynamicCalls = [];
  const registeredScripts = new Map();
  const createdTabs = [];
  const discardedTabIds = [];
  const alarms = new Map();
  const fetchCalls = [];
  const pendingTimers = new Set();

  const onInstalledListeners = [];
  const onStartupListeners = [];
  const onMessageListeners = [];
  const onAlarmListeners = [];

  const extId = 'bkdfhdgmglfancgpkcbdceinfdlccmpc';
  const extOrigin = `chrome-extension://${extId}/`;

  const chromeMock = {
    runtime: {
      id: extId,
      lastError: null,
      getManifest: () => structuredClone(manifest),
      getURL: (p = '') => `${extOrigin}${String(p).replace(/^\/+/, '')}`,
      setUninstallURL() {},
      requestUpdateCheck() {},
      reload() {},
      onUpdateAvailable: { addListener() {} },
      onInstalled: {
        addListener(fn) {
          onInstalledListeners.push(fn);
        }
      },
      onStartup: {
        addListener(fn) {
          onStartupListeners.push(fn);
        }
      },
      onMessage: {
        addListener(fn) {
          onMessageListeners.push(fn);
        }
      }
    },
    storage: {
      local: localWrap.area,
      sync: syncWrap.area,
      session: sessionWrap.area,
      onChanged: {
        addListener(fn) {
          storageListeners.push(fn);
        }
      }
    },
    declarativeNetRequest: {
      updateEnabledRulesets: async ({ enableRulesetIds = [], disableRulesetIds = [] } = {}) => {
        for (const id of disableRulesetIds) enabledRulesets.delete(id);
        for (const id of enableRulesetIds) enabledRulesets.add(id);
        dnrRulesetCalls.push({
          enableRulesetIds: [...enableRulesetIds],
          disableRulesetIds: [...disableRulesetIds],
          snapshot: [...enabledRulesets]
        });
      },
      getEnabledRulesets: async () => [...enabledRulesets],
      updateDynamicRules: async ({ removeRuleIds = [], addRules = [] } = {}) => {
        for (const id of removeRuleIds) dnrDynamicRules.delete(id);
        for (const r of addRules) dnrDynamicRules.set(r.id, r);
        dnrDynamicCalls.push({ removeRuleIds: [...removeRuleIds], addRules: [...addRules] });
      },
      getDynamicRules: async () => [...dnrDynamicRules.values()],
      setExtensionActionOptions: async () => {},
      onRuleMatchedDebug: { addListener() {} }
    },
    permissions: { contains: async () => Boolean(permissionsGranted) },
    scripting: {
      unregisterContentScripts: async ({ ids } = {}) => {
        if (!ids || ids.length === 0) {
          registeredScripts.clear();
        } else {
          for (const id of ids) registeredScripts.delete(id);
        }
      },
      registerContentScripts: async (scripts = []) => {
        for (const s of scripts) registeredScripts.set(s.id, s);
      },
      getRegisteredContentScripts: async () => [...registeredScripts.values()]
    },
    contextMenus: {
      removeAll: (cb) => {
        if (typeof cb === 'function') cb();
      },
      create() {},
      onClicked: { addListener() {} }
    },
    commands: { onCommand: { addListener() {} } },
    tabs: {
      ...(tabsDiscardSupported
        ? {
            discard: async (tabId) => {
              discardedTabIds.push(tabId);
              const t = tabs.find((x) => x.id === tabId);
              if (t) t.discarded = true;
              return t;
            }
          }
        : {}),
      create: async (opts) => {
        const created = { id: 1000 + createdTabs.length, ...opts };
        createdTabs.push(created);
        return created;
      },
      query: async (q = {}) => {
        return tabs.filter((t) => {
          if (q.active !== undefined && Boolean(t.active) !== Boolean(q.active)) return false;
          if (q.currentWindow !== undefined && Boolean(t.currentWindow ?? true) !== Boolean(q.currentWindow))
            return false;
          return true;
        });
      },
      get: async (id) => tabs.find((t) => t.id === id) || null,
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
      create(name, info) {
        alarms.set(name, info || {});
      },
      clear: async (name) => {
        alarms.delete(name);
        return true;
      },
      onAlarm: {
        addListener(fn) {
          onAlarmListeners.push(fn);
        }
      }
    },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    identity: {
      getProfileUserInfo: (_opts, cb) => cb({ email: profileEmail, id: profileEmail ? 'g_123' : '' }),
      getAuthToken: (_opts, cb) => cb(authToken),
      removeCachedAuthToken: (_opts, cb) => {
        if (typeof cb === 'function') cb();
      }
    }
  };

  const trackedSetTimeout = (fn, delay = 0) => {
    if (delay === 2500) return 0;
    const handle = setTimeout(() => {
      pendingTimers.delete(handle);
      fn();
    }, Math.min(Number(delay) || 0, 50));
    if (typeof handle.unref === 'function') handle.unref();
    pendingTimers.add(handle);
    return handle;
  };
  const trackedClearTimeout = (handle) => {
    pendingTimers.delete(handle);
    clearTimeout(handle);
  };

  const wrappedFetch = async (url, init = {}) => {
    const urlStr = String(url);
    fetchCalls.push({ url: urlStr, init });
    if (offline) {
      throw new TypeError('fetch failed: ECONNREFUSED (simulated offline)');
    }
    if (fetchHandler) {
      return fetchHandler(urlStr, init);
    }
    if (serverBaseUrl && /^https:\/\/(?:www\.)?sweeprdeepblock\.com(\/|$)/i.test(urlStr)) {
      const targetUrl = urlStr.replace(/^https:\/\/(?:www\.)?sweeprdeepblock\.com/i, serverBaseUrl);
      const headers = new Headers(init.headers || {});
      if (!headers.has('Origin')) headers.set('Origin', `chrome-extension://${extId}`);
      return globalThis.fetch(targetUrl, { ...init, headers });
    }
    return { ok: false, status: 404, json: async () => ({ ok: false }) };
  };

  const ctx = {
    chrome: chromeMock,
    Date: MockDate,
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      userAgentData: { platform: 'Windows', brands: [{ brand: 'Google Chrome' }] },
      language: 'en-GB'
    },
    fetch: wrappedFetch,
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
  vm.runInContext(bgSrc, ctx, { filename: 'extension/background.js' });

  async function dispatchMessage(msg, sender) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ __unhandledOrTimeout: true });
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
      let anyAsync = false;
      for (const listener of onMessageListeners) {
        const ret = listener(msg, sender, sendResponse);
        if (ret === true) anyAsync = true;
      }
      if (!anyAsync && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ __ignored: true });
      }
    });
  }

  return {
    ctx,
    localStore: localWrap.store,
    syncStore: syncWrap.store,
    sessionStore: sessionWrap.store,
    dnrRulesetCalls,
    dnrDynamicCalls,
    createdTabs,
    discardedTabIds,
    alarms,
    fetchCalls,
    getEnabledRulesets: () => [...enabledRulesets],
    getDynamicRules: () => [...dnrDynamicRules.values()],
    getRegisteredScripts: () => [...registeredScripts.values()],
    setNow(ms) {
      currentNow = ms;
    },
    advanceMs(ms) {
      currentNow += ms;
      return currentNow;
    },
    getNow() {
      return currentNow;
    },
    async triggerInstall(reason = 'install', previousVersion = undefined) {
      for (const fn of onInstalledListeners) {
        await fn(previousVersion ? { reason, previousVersion } : { reason });
      }
    },
    async triggerStartup() {
      for (const fn of onStartupListeners) {
        await fn();
      }
    },
    async triggerAlarm(name) {
      for (const fn of onAlarmListeners) {
        await fn({ name });
      }
    },
    async sendPrivilegedMessage(msg) {
      return dispatchMessage(msg, { id: extId, url: `${extOrigin}popup.html`, frameId: 0 });
    },
    async sendUntrustedMessage(msg, senderUrl = 'https://evil.example/page.html') {
      return dispatchMessage(msg, { id: 'evil_other_id', url: senderUrl, frameId: 0 });
    },
    cleanup() {
      for (const h of pendingTimers) clearTimeout(h);
      pendingTimers.clear();
    }
  };
}

function splitTopLevelSelectors(selectorText) {
  const parts = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
  for (let i = 0; i < selectorText.length; i += 1) {
    const ch = selectorText[i];
    if (quote) {
      current += ch;
      if (ch === quote && selectorText[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '[') {
      bracketDepth += 1;
      current += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
    } else if (ch === '(') {
      parenDepth += 1;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (ch === ',' && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function matchesSimpleSelector(el, simple) {
  if (!el || !simple) return false;
  let rest = simple.trim();
  if (!rest) return false;
  if (rest === '*') return true;

  const tagMatch = rest.match(/^([a-zA-Z][a-zA-Z0-9_-]*)/);
  if (tagMatch) {
    if (String(el.tagName || '').toLowerCase() !== tagMatch[1].toLowerCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }

  const attrPattern = /\[([^\]]+)\]/g;
  const attrs = [];
  rest = rest.replace(attrPattern, (_, inner) => {
    attrs.push(inner.trim());
    return '';
  });

  const idMatches = [...rest.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  const classMatches = [...rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  const leftover = rest.replace(/#[a-zA-Z0-9_-]+/g, '').replace(/\.[a-zA-Z0-9_-]+/g, '');
  if (leftover.trim()) return false;

  for (const id of idMatches) {
    if (el.id !== id) return false;
  }
  const elClasses = String(el.className || '')
    .split(/\s+/)
    .filter(Boolean);
  for (const cls of classMatches) {
    if (!elClasses.includes(cls)) return false;
  }

  for (const attrExpr of attrs) {
    const m = attrExpr.match(/^([a-zA-Z0-9_:-]+)\s*(?:(\*=|\^=|\$=|=)\s*["']?([^"']*?)["']?(?:\s+([iI]))?)?$/);
    if (!m) return false;
    const attrName = m[1];
    const op = m[2];
    const expected = m[3];
    const ci = Boolean(m[4]);
    const rawVal =
      attrName === 'id'
        ? el.id
        : attrName === 'class'
        ? el.className
        : el.attributes?.[attrName];
    if (rawVal === undefined || rawVal === null) return false;
    if (!op) continue;
    const a = ci ? String(rawVal).toLowerCase() : String(rawVal);
    const b = ci ? String(expected).toLowerCase() : String(expected);
    if (op === '=' && a !== b) return false;
    if (op === '*=' && !a.includes(b)) return false;
    if (op === '^=' && !a.startsWith(b)) return false;
    if (op === '$=' && !a.endsWith(b)) return false;
  }
  return true;
}

export function createMockDomElement(tagName = 'div', props = {}) {
  const styleStore = { ...(props.style || {}) };
  const el = {
    tagName: String(tagName).toUpperCase(),
    id: props.id || '',
    className: props.className || '',
    textContent: props.textContent || '',
    attributes: { ...(props.attributes || {}) },
    dataset: { ...(props.dataset || {}) },
    children: [],
    parentNode: null,
    shadowRoot: null,
    clicked: false,
    clickCount: 0,
    style: Object.assign(styleStore, {
      setProperty(k, v) {
        styleStore[k] = v;
      },
      getPropertyValue(k) {
        return styleStore[k] || '';
      }
    }),
    classList: {
      contains(c) {
        return String(el.className || '')
          .split(/\s+/)
          .includes(c);
      },
      add(c) {
        const list = String(el.className || '')
          .split(/\s+/)
          .filter(Boolean);
        if (!list.includes(c)) list.push(c);
        el.className = list.join(' ');
      },
      remove(c) {
        el.className = String(el.className || '')
          .split(/\s+/)
          .filter((x) => x && x !== c)
          .join(' ');
      }
    },
    setAttribute(k, v) {
      el.attributes[k] = String(v);
      if (k === 'id') el.id = String(v);
      if (k === 'class') el.className = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(el.attributes, k) ? el.attributes[k] : null;
    },
    appendChild(child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    remove() {
      if (el.parentNode) {
        el.parentNode.children = el.parentNode.children.filter((c) => c !== el);
        el.parentNode = null;
      }
    },
    click() {
      el.clicked = true;
      el.clickCount += 1;
      if (typeof props.onClick === 'function') props.onClick(el);
    },
    attachShadow() {
      const root = createMockDomRoot();
      el.shadowRoot = root;
      return root;
    },
    querySelector(sel) {
      return el.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const allNodes = [];
      const walk = (node) => {
        for (const child of node.children || []) {
          allNodes.push(child);
          walk(child);
        }
      };
      walk(el);
      return matchSelectorList(allNodes, sel, el);
    }
  };
  if (Array.isArray(props.children)) {
    for (const c of props.children) el.appendChild(c);
  }
  return el;
}

function createMockDomRoot() {
  const root = createMockDomElement('shadow-root');
  root.getElementById = (id) => root.querySelectorAll(`#${id}`)[0] || null;
  return root;
}

function tokenizeSelector(selector) {
  const tokens = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
  const s = String(selector || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      current += ch;
      if (ch === quote && s[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '[') {
      bracketDepth += 1;
      current += ch;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
    } else if (ch === '(') {
      parenDepth += 1;
      current += ch;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
    } else if (bracketDepth === 0 && parenDepth === 0 && ch === '>') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push('>');
      current = '';
    } else if (bracketDepth === 0 && parenDepth === 0 && /\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function matchSingleSelector(el, selector, rootScope) {
  const tokens = tokenizeSelector(selector);
  if (tokens.length === 0) return false;
  const last = tokens[tokens.length - 1];
  if (!matchesSimpleSelector(el, last)) return false;
  if (tokens.length === 1) return true;

  let cur = el;
  for (let i = tokens.length - 2; i >= 0; i -= 1) {
    const tok = tokens[i];
    if (tok === '>') {
      const parentSel = tokens[i - 1];
      if (!cur.parentNode || !matchesSimpleSelector(cur.parentNode, parentSel)) return false;
      cur = cur.parentNode;
      i -= 1;
    } else {
      let ancestor = cur.parentNode;
      let matched = false;
      while (ancestor && ancestor !== rootScope?.parentNode) {
        if (matchesSimpleSelector(ancestor, tok)) {
          matched = true;
          cur = ancestor;
          break;
        }
        ancestor = ancestor.parentNode;
      }
      if (!matched) return false;
    }
  }
  return true;
}

function matchSelectorList(nodes, selectorText, rootScope) {
  const parts = splitTopLevelSelectors(String(selectorText || ''));
  const results = [];
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node)) continue;
    for (const part of parts) {
      if (matchSingleSelector(node, part, rootScope)) {
        seen.add(node);
        results.push(node);
        break;
      }
    }
  }
  return results;
}

export function createContentScriptVmHarness({
  storageState = {},
  hostname = 'example.com',
  url = 'https://example.com/',
  bodyOverflow = 'visible',
  htmlOverflow = 'visible',
  setupDom = null
} = {}) {
  const src = fs.readFileSync(path.join(EXTENSION_DIR, 'content', 'deepblock-content.js'), 'utf8');
  const htmlEl = createMockDomElement('html', { style: { overflow: htmlOverflow } });
  const headEl = createMockDomElement('head');
  const bodyEl = createMockDomElement('body', { style: { overflow: bodyOverflow } });
  htmlEl.appendChild(headEl);
  htmlEl.appendChild(bodyEl);

  if (typeof setupDom === 'function') {
    setupDom({ htmlEl, headEl, bodyEl, createElement: createMockDomElement });
  }

  const stealthSignals = [];
  const metrics = [];
  const pendingTimers = new Set();

  const documentMock = {
    readyState: 'complete',
    documentElement: htmlEl,
    head: headEl,
    body: bodyEl,
    getElementById: (id) => htmlEl.querySelector(`#${id}`),
    querySelector: (sel) => htmlEl.querySelector(sel),
    querySelectorAll: (sel) => htmlEl.querySelectorAll(sel),
    createElement: (tag) => createMockDomElement(tag),
    addEventListener() {}
  };

  const getComputedStyleMock = (el) => ({
    overflow: el?.style?.overflow || 'visible',
    display: el?.style?.display || 'block',
    visibility: el?.style?.visibility || 'visible'
  });

  const windowMock = {
    top: null,
    self: null,
    getComputedStyle: getComputedStyleMock,
    addEventListener() {},
    dispatchEvent(ev) {
      if (ev && ev.type === '_ds_cfg') stealthSignals.push(ev.detail);
    }
  };
  windowMock.top = windowMock;
  windowMock.self = windowMock;

  const chromeMock = {
    storage: {
      local: {
        get(_keys, cb) {
          if (typeof cb === 'function') cb(structuredClone(storageState));
          return Promise.resolve(structuredClone(storageState));
        },
        set() {
          return Promise.resolve();
        }
      }
    },
    runtime: {
      id: 'bkdfhdgmglfancgpkcbdceinfdlccmpc',
      onMessage: { addListener() {} },
      sendMessage(msg, cb) {
        if (msg?.type === 'INCREMENT_DIAGNOSTIC') {
          metrics.push({ metric: msg.metric, amount: msg.amount });
          if (typeof cb === 'function') cb({ ok: true });
        } else if (msg?.type === 'GET_PAGE_SETTINGS') {
          if (typeof cb === 'function') cb(structuredClone(storageState));
        }
      }
    }
  };

  const trackedSetTimeout = (fn, delay = 0) => {
    const handle = setTimeout(() => {
      pendingTimers.delete(handle);
      fn();
    }, Math.min(Number(delay) || 0, 10));
    if (typeof handle.unref === 'function') handle.unref();
    pendingTimers.add(handle);
    return handle;
  };
  const trackedClearTimeout = (handle) => {
    pendingTimers.delete(handle);
    clearTimeout(handle);
  };

  const sandbox = {
    location: { hostname, href: url },
    chrome: chromeMock,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/131.0.0.0' },
    getComputedStyle: getComputedStyleMock,
    document: documentMock,
    window: windowMock,
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
    setTimeout: trackedSetTimeout,
    clearTimeout: trackedClearTimeout,
    URL,
    URLSearchParams,
    console
  };

  vm.runInNewContext(src, sandbox, { filename: 'deepblock-content.js' });

  return {
    htmlEl,
    headEl,
    bodyEl,
    document: documentMock,
    window: windowMock,
    stealthSignals,
    metrics,
    hasUniversalCosmeticStyle: () => Boolean(documentMock.getElementById('deepblock-universal-cosmetic')),
    hasYtCosmeticStyle: () => Boolean(documentMock.getElementById('deepblock-yt-cosmetic')),
    async flush(waitMs = 40) {
      await new Promise((r) => setTimeout(r, waitMs));
    },
    cleanup() {
      for (const h of pendingTimers) clearTimeout(h);
      pendingTimers.clear();
    }
  };
}

export function openCrmReadOnly() {
  assert.ok(fs.existsSync(CRM_DB_PATH), `CRM SQLite DB missing at ${CRM_DB_PATH}`);
  return new DatabaseSync(CRM_DB_PATH, { readOnly: true });
}

export function listFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  const walk = (cur) => {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(full);
      }
    }
  };
  walk(dirPath);
  return results;
}

const OSS_LICENSE_FILE_RE =
  /^(?:LICENSE|COPYING|UNLICENSE|NOTICE|MIT-LICENSE|APACHE-LICENSE)(?:[-.][a-z0-9._-]+)?$/i;
const OSS_SPDX_OR_NAME_RE =
  /\b(?:MIT|ISC|GPL(?:v[23])?|AGPL(?:v3)?|LGPL(?:v[23])?|Apache(?:[- ]2\.0)?|BSD(?:-[23]-Clause)?|MPL(?:[- ]2\.0)?|Unlicense|CC0-1\.0)\b/i;
const OSS_LICENSE_TEXT_RE =
  /(?:SPDX-License-Identifier\s*:\s*(?:MIT|ISC|GPL|AGPL|LGPL|Apache|BSD|MPL)|@license\s+(?:MIT|ISC|GPL(?:v[23])?|AGPL(?:v3)?|LGPL(?:v[23])?|Apache(?:-2\.0)?|BSD(?:-[23]-Clause)?|MPL(?:-2\.0)?|Unlicense)\b|Permission is hereby granted, free of charge, to any person obtaining a copy|GNU GENERAL PUBLIC LICENSE|GNU LESSER GENERAL PUBLIC LICENSE|GNU AFFERO GENERAL PUBLIC LICENSE|Apache License,?\s*Version 2\.0|Redistribution and use in source and binary forms, with or without modification|Mozilla Public License Version 2\.0|\b(?:MIT|ISC|GPLv[23]|AGPLv3|LGPLv[23]|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0)\s+License\b)/i;

function findPackageJsonOssViolation(text, locationLabel) {
  try {
    const pkg = JSON.parse(text);
    const candidates = [];
    if (pkg && pkg.license !== undefined) {
      candidates.push(typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || JSON.stringify(pkg.license));
    }
    if (pkg && Array.isArray(pkg.licenses)) {
      for (const item of pkg.licenses) {
        candidates.push(typeof item === 'string' ? item : item?.type || JSON.stringify(item));
      }
    }
    for (const val of candidates) {
      const str = String(val || '').trim();
      if (str && OSS_SPDX_OR_NAME_RE.test(str)) {
        return `OSS package.json license field ("${str}") in ${locationLabel}`;
      }
    }
  } catch {
    if (/"licenses?"\s*:\s*"[^"]*\b(?:MIT|ISC|GPL|AGPL|LGPL|Apache|BSD|MPL|Unlicense)\b/i.test(text)) {
      return `OSS package.json license declaration in ${locationLabel}`;
    }
  }
  return null;
}

export function findOssLicenseViolationsInDirectory(dirPath) {
  const violations = [];
  for (const file of listFilesRecursive(dirPath)) {
    const base = path.basename(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (OSS_LICENSE_FILE_RE.test(base)) {
      violations.push(`OSS license file present: ${rel}`);
      continue;
    }
    if (/\.(?:js|mjs|cjs|ts|swift|json|html|md|txt|xml|plist|yml|yaml|xcconfig)$/i.test(base)) {
      const content = fs.readFileSync(file, 'utf8');
      if (base.toLowerCase() === 'package.json') {
        const pkgViolation = findPackageJsonOssViolation(content, rel);
        if (pkgViolation) violations.push(pkgViolation);
      }
      if (OSS_LICENSE_TEXT_RE.test(content)) {
        violations.push(`OSS license header/text found in ${rel}`);
      }
    }
  }
  return violations;
}

export function findOssLicenseViolationsInZip(zipPath) {
  const violations = [];
  const entries = readZipEntries(zipPath);
  for (const e of entries) {
    const base = path.posix.basename(e.name);
    if (OSS_LICENSE_FILE_RE.test(base)) {
      violations.push(`OSS license file in archive ${path.basename(zipPath)}: ${e.name}`);
      continue;
    }
    if (/\.(?:js|mjs|cjs|json|html|txt|md)$/i.test(base)) {
      const text = e.data.toString('utf8');
      if (base.toLowerCase() === 'package.json') {
        const pkgViolation = findPackageJsonOssViolation(text, `${path.basename(zipPath)} -> ${e.name}`);
        if (pkgViolation) violations.push(pkgViolation);
      }
      if (OSS_LICENSE_TEXT_RE.test(text)) {
        violations.push(`OSS license text in ${path.basename(zipPath)} -> ${e.name}`);
      }
    }
  }
  return violations;
}
