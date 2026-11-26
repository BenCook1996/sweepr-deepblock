// SWEEPR Deepblock — Manifest V3 Background Service Worker (v1.4.0)
const LICENSE_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify',
  'https://sweepr-crm-production.up.railway.app/v1/license/verify-key?project=deepblock'
];
const CHROME_AUTO_ACTIVATE_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license/chrome-auto-activate',
  'https://sweepr-crm-production.up.railway.app/v1/license/chrome-auto-activate?project=deepblock'
];
const TRIAL_START_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/trial/start',
  'https://sweepr-crm-production.up.railway.app/v1/trial/start?project=deepblock'
];
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const ADS_RULESET_IDS = ['ads_and_trackers', 'regional_eu_filters'];
const TRACKER_RULESET_IDS = ['easyprivacy_trackers', 'tracker_param_stripping', 'cryptominers_and_heavy_scripts'];
const ALL_STATIC_RULESET_IDS = [...ADS_RULESET_IDS, ...TRACKER_RULESET_IDS];

const PRO_ONLY_SETTINGS = new Set([
  'adBlocking',
  'cookieAutoClose',
  'trackerProtection',
  'silentMode',
  'autoRamTamer',
  'cloudTabSyncEnabled'
]);

const tabLastActiveAt = new Map();
const AUTO_RAM_IDLE_MS = 10 * 60 * 1000; // 10 minutes idle threshold for automatic background snooze
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7-day offline verification grace window
const VERIFIED_SESSION_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12-hour cache TTL for cold service-worker wakeups
const FULL_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
const COMPACT_JWS_RE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const PAIRING_TOKEN_RE = /^ptk_[A-Za-z0-9_-]{12,64}$/;
const DEEPSTEALTH_SCRIPT_ID = 'deepstealth-main';
const tabsDiscardSupported = Boolean(typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.discard === 'function');

function isValidLicenseCredential(value) {
  const v = String(value || '').trim();
  return FULL_LICENSE_KEY_RE.test(v) || COMPACT_JWS_RE.test(v);
}

const isLocalTrialKey = (value) => /^SWEEPR-TRIAL-/i.test(String(value || '').trim());

function generateSecureDeviceHex(byteLen = 8) {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function' && byteLen === 8) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(byteLen);
      crypto.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  return Date.now().toString(16).padStart(16, '0');
}

let tabActivityHydrated = false;
let tabActivitySaveScheduled = false;

async function hydrateTabActivityMap() {
  if (tabActivityHydrated) return;
  tabActivityHydrated = true;
  try {
    if (chrome.storage && chrome.storage.session) {
      const s = await chrome.storage.session.get(['tabLastActiveAt']);
      const raw = (s && s.tabLastActiveAt) || {};
      for (const [k, ts] of Object.entries(raw)) {
        const idNum = Number(k);
        if (Number.isFinite(idNum) && typeof ts === 'number' && !tabLastActiveAt.has(idNum)) {
          tabLastActiveAt.set(idNum, ts);
        }
      }
    }
  } catch (e) {}
}

function schedulePersistTabActivityMap() {
  if (tabActivitySaveScheduled || !chrome.storage || !chrome.storage.session) return;
  tabActivitySaveScheduled = true;
  setTimeout(() => {
    tabActivitySaveScheduled = false;
    try {
      const serialized = {};
      for (const [k, v] of tabLastActiveAt.entries()) {
        serialized[k] = v;
      }
      chrome.storage.session.set({ tabLastActiveAt: serialized }).catch(() => {});
    } catch (e) {}
  }, 500);
}

function recordTabActivity(tabId, ts = Date.now()) {
  if (!tabId) return;
  tabLastActiveAt.set(tabId, ts);
  schedulePersistTabActivityMap();
}

function removeTabActivity(tabId) {
  if (!tabId) return;
  tabLastActiveAt.delete(tabId);
  schedulePersistTabActivityMap();
}

function sanitizeTabUrlForBackup(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''));
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (
        /^(token|access_token|id_token|refresh_token|code|auth|secret|key|license|license_key|session|session_id|password|pass|sig|signature|client_secret|state|nonce|otp|jwt)$/i.test(k) ||
        /token|secret|auth|session|password|key/i.test(k)
      ) {
        u.searchParams.delete(k);
      }
    }
    return u.toString();
  } catch (e) {
    return String(rawUrl || '').split('#')[0].split('?')[0];
  }
}

function isNewerSemverExt(latestVer, currentVer) {
  const parse = (v) =>
    String(v || '0.0.0')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const l = parse(latestVer);
  const c = parse(currentVer);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

let syncRemoteFilterDeltaInFlight = null;
let lastDnrSyncAt = 0;
const DNR_SYNC_COOLDOWN_MS = 30000;

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onUpdateAvailable) {
  chrome.runtime.onUpdateAvailable.addListener(() => {
    const pending = syncRemoteFilterDeltaInFlight;
    if (pending && typeof pending.then === 'function') {
      Promise.race([pending, new Promise((r) => setTimeout(r, 2000))])
        .catch(() => {})
        .finally(() => {
          try {
            chrome.runtime.reload();
          } catch (e) {}
        });
      return;
    }
    try {
      chrome.runtime.reload();
    } catch (e) {}
  });
}

async function syncRemoteFilterDelta(options = {}) {
  const force = Boolean(options && options.force);
  if (syncRemoteFilterDeltaInFlight) {
    return syncRemoteFilterDeltaInFlight;
  }
  if (!force && lastDnrSyncAt > 0 && Date.now() - lastDnrSyncAt < DNR_SYNC_COOLDOWN_MS) {
    return;
  }
  const runSync = (async () => {
    try {
      const currentVersion =
        (typeof chrome !== 'undefined' &&
          chrome.runtime &&
          chrome.runtime.getManifest &&
          chrome.runtime.getManifest().version) ||
        '1.4.0';
      const qs = `?current_version=${encodeURIComponent(currentVersion)}`;
      const endpoints = [
        `https://sweeprdeepblock.com/api/filters/delta${qs}`,
        ...(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
          ? [chrome.runtime.getURL('rules/dynamic_delta.json')]
          : [])
      ];
      let localData = null;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        try {
          const localRes = await fetch(chrome.runtime.getURL('rules/dynamic_delta.json'));
          if (localRes.ok) {
            localData = await localRes.json().catch(() => null);
          }
        } catch (err) {}
      }
      let data = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000)
          });
          if (res.ok) {
            const parsed = await res.json().catch(() => null);
            if (parsed && parsed.ok) {
              data = parsed;
              break;
            }
          }
        } catch (err) {}
      }
      if (!data && localData && localData.ok) {
        data = localData;
      }
      if (!data || !data.ok) return;
      if (localData && Array.isArray(localData.dynamicDnrRules)) {
        const ruleMap = new Map();
        if (Array.isArray(data.dynamicDnrRules)) {
          for (const r of data.dynamicDnrRules) {
            if (r && typeof r.id === 'number') ruleMap.set(r.id, r);
          }
        }
        for (const r of localData.dynamicDnrRules) {
          if (r && typeof r.id === 'number') ruleMap.set(r.id, r);
        }
        data.dynamicDnrRules = Array.from(ruleMap.values());
      }
      const updates = {};
      if (data.latestExtensionVersion || data.minExtensionVersion) {
        const latestVersion = String(data.latestExtensionVersion || currentVersion).trim();
        const minVersion = String(data.minExtensionVersion || '1.1.6').trim();
        const updateAvailable = Boolean(data.updateAvailable || isNewerSemverExt(latestVersion, currentVersion));
        const forceUpdate = Boolean(
          (data.forceUpdate && updateAvailable) || isNewerSemverExt(minVersion, currentVersion)
        );
        const rawUpdateUrl = String(data.storeUpdateUrl || '').trim();
        const safeUpdateUrl =
          /^https:\/\/(sweeprdeepblock\.com|chromewebstore\.google\.com|addons\.mozilla\.org|microsoftedge\.microsoft\.com|addons\.opera\.com)\//i.test(rawUpdateUrl)
            ? rawUpdateUrl
            : 'https://sweeprdeepblock.com/download';
        updates.extensionUpdateStatus = {
          currentVersion,
          latestVersion,
          minVersion,
          updateAvailable,
          forceUpdate,
          updateUrl: safeUpdateUrl,
          checkedAt: Date.now()
        };
      }
      if (data.featureFlags && typeof data.featureFlags === 'object') {
        updates.remoteFeatureFlags = data.featureFlags;
      }
      const sanitizeRemoteSelector = (sel, maxLen = 180) =>
        typeof sel === 'string' &&
        sel.length > 0 &&
        sel.length <= maxLen &&
        /^[a-zA-Z0-9#._:() >[\]="'*~$^|,/-]+$/.test(sel) &&
        !/[{}<\\@;]/.test(sel) &&
        !/url\(|@import|-moz-binding|expression\(|javascript:/i.test(sel);
      if (!verifiedSession.coldChecked || (verifiedSession.proActive && verifiedSession.trialExpiresAt > 0 && Date.now() >= verifiedSession.trialExpiresAt)) {
        await enforceStoredSubscriptionIntegrity({ force: verifiedSession.coldChecked });
      }
      const st = await chrome.storage.local.get(['settings']);
      const adBlockingEnabled = Boolean(
        verifiedSession.proActive &&
          verifiedSession.licenseKey &&
          (!st.settings || st.settings.adBlocking !== false)
      );
      if (adBlockingEnabled) {
        if (Array.isArray(data.extraCmpSelectors)) {
          updates.extraCmpSelectors = data.extraCmpSelectors.filter((s) => sanitizeRemoteSelector(s, 180)).slice(0, 100);
        }
        if (Array.isArray(data.extraAntiAdblockSelectors)) {
          updates.extraAntiAdblockSelectors = data.extraAntiAdblockSelectors.filter((s) => sanitizeRemoteSelector(s, 180)).slice(0, 100);
        }
        if (Array.isArray(data.extraCosmeticSelectors)) {
          updates.extraCosmeticSelectors = data.extraCosmeticSelectors.filter((s) => sanitizeRemoteSelector(s, 180)).slice(0, 200);
        }
        if (Array.isArray(data.extraSlopDomains)) {
          updates.extraSlopDomains = data.extraSlopDomains
            .map((d) => String(d || '').trim().toLowerCase())
            .filter((d) => /^[a-z0-9.-]{3,120}$/i.test(d))
            .slice(0, 500);
        }
      } else {
        updates.extraCmpSelectors = [];
        updates.extraAntiAdblockSelectors = [];
        updates.extraCosmeticSelectors = [];
        updates.extraSlopDomains = [];
      }
      if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
      }
      if (
        Array.isArray(data.dynamicDnrRules) &&
        chrome.declarativeNetRequest &&
        chrome.declarativeNetRequest.updateDynamicRules
      ) {
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existing.filter((r) => r.id >= 80000 && r.id < 81000).map((r) => r.id);
        const validRules = adBlockingEnabled
          ? data.dynamicDnrRules
                .filter((r) => {
                  if (!r || typeof r.id !== 'number' || r.id < 80000 || r.id >= 81000) return false;
                  if (!r.action || r.action.type !== 'block') return false;
                  if (!r.condition || typeof r.condition !== 'object') return false;
                  if (
                    typeof r.condition.urlFilter !== 'string' ||
                    r.condition.urlFilter.trim().length < 2 ||
                    r.condition.urlFilter.length > 250
                  ) {
                    return false;
                  }
                  if (Array.isArray(r.condition.resourceTypes) && r.condition.resourceTypes.includes('main_frame')) return false;
                  return true;
                })
                .slice(0, 500)
            : [];
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules: validRules
        });
      }
    } catch (e) {}
  })();

  syncRemoteFilterDeltaInFlight = runSync;
  try {
    return await runSync;
  } finally {
    lastDnrSyncAt = Date.now();
    if (syncRemoteFilterDeltaInFlight === runSync) {
      syncRemoteFilterDeltaInFlight = null;
    }
  }
}

function normalizePunycodeDomain(raw) {
  const cleaned = String(raw || '').trim().replace(/^www\./i, '').replace(/\.+$/, '').toLowerCase();
  if (!cleaned || cleaned.length > 253 || /[\s/\\@]/.test(cleaned)) return '';
  try {
    const host = new URL(`https://${cleaned}`).hostname.replace(/^www\./i, '').toLowerCase();
    return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(host) ? host : '';
  } catch (e) {
    return '';
  }
}

async function syncDeepStealthRegistration(enableAdBlocking, passedPausedSites) {
  try {
    if (
      typeof chrome === 'undefined' ||
      !chrome.scripting ||
      typeof chrome.scripting.registerContentScripts !== 'function'
    ) {
      return;
    }
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [DEEPSTEALTH_SCRIPT_ID] });
    } catch (e) {}

    if (!enableAdBlocking) {
      return;
    }

    let pausedSites = passedPausedSites;
    if (!Array.isArray(pausedSites)) {
      const stored = await chrome.storage.local.get(['pausedSites']);
      pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    }
    const cleanDomains = [...new Set(pausedSites.map(normalizePunycodeDomain).filter(Boolean))].slice(0, 200);
    const excludeMatches = [];
    for (const host of cleanDomains) {
      excludeMatches.push(`*://${host}/*`, `*://*.${host}/*`);
    }

    await chrome.scripting.registerContentScripts([
      {
        id: DEEPSTEALTH_SCRIPT_ID,
        matches: ['http://*/*', 'https://*/*'],
        ...(excludeMatches.length > 0 ? { excludeMatches } : {}),
        js: ['content/deepstealth-main.js'],
        runAt: 'document_start',
        allFrames: true,
        world: 'MAIN',
        persistAcrossSessions: true
      }
    ]);
  } catch (e) {}
}

async function syncPausedSiteDnrAllowlist(passedPausedSites, options = {}) {
  try {
    let pausedSites = passedPausedSites;
    if (!Array.isArray(pausedSites)) {
      const stored = await chrome.storage.local.get(['pausedSites']);
      pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    }
    const cleanDomains = [...new Set(pausedSites.map(normalizePunycodeDomain).filter(Boolean))].slice(0, 500);

    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = existingRules.filter((r) => r.id >= 90000 && r.id < 91000).map((r) => r.id);

      const addRules = [];
      if (cleanDomains.length > 0) {
        addRules.push(
          {
            id: 90001,
            priority: 100000,
            action: { type: 'allow' },
            condition: {
              initiatorDomains: cleanDomains
            }
          },
          {
            id: 90002,
            priority: 100000,
            action: { type: 'allowAllRequests' },
            condition: {
              requestDomains: cleanDomains,
              resourceTypes: ['main_frame', 'sub_frame']
            }
          }
        );
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules
      });
    }

    if (!options.skipStealthSync) {
      const auth = await ensureVerifiedProSession();
      const st = await chrome.storage.local.get(['settings']);
      const adOn = Boolean(
        auth.proActive &&
          auth.licenseKey &&
          (!st.settings || st.settings.adBlocking !== false)
      );
      await syncDeepStealthRegistration(adOn, cleanDomains);
    }
  } catch (e) {}
}

async function syncExtensionProtectionRules(enableAdBlocking, enableTrackerProtection) {
  try {
    const adEnabled = Boolean(enableAdBlocking);
    let trackerEnabled;
    if (enableTrackerProtection !== undefined) {
      trackerEnabled = Boolean(enableTrackerProtection);
    } else if (!adEnabled) {
      trackerEnabled = false;
    } else {
      const st = await chrome.storage.local.get(['settings']);
      trackerEnabled = !st.settings || st.settings.trackerProtection !== false;
    }

    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
      const enableRulesetIds = [];
      const disableRulesetIds = [];
      if (adEnabled) {
        enableRulesetIds.push(...ADS_RULESET_IDS);
      } else {
        disableRulesetIds.push(...ADS_RULESET_IDS);
      }
      if (trackerEnabled) {
        enableRulesetIds.push(...TRACKER_RULESET_IDS);
      } else {
        disableRulesetIds.push(...TRACKER_RULESET_IDS);
      }
      try {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds,
          disableRulesetIds
        });
      } catch (rulesetErr) {
        const legacyIds = new Set(['ads_and_trackers', 'tracker_param_stripping', 'cryptominers_and_heavy_scripts']);
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enableRulesetIds.filter((id) => legacyIds.has(id)),
          disableRulesetIds: disableRulesetIds.filter((id) => legacyIds.has(id))
        });
      }
    }

    if (!adEnabled && chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      const existing = await chrome.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = existing.filter((r) => r.id >= 80000 && r.id < 81000).map((r) => r.id);
      if (removeRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules: []
        });
      }
    }

    const stored = await chrome.storage.local.get(['pausedSites']);
    const pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    if (adEnabled || trackerEnabled) {
      await syncPausedSiteDnrAllowlist(pausedSites, { skipStealthSync: true });
    }
    await syncDeepStealthRegistration(adEnabled, pausedSites);
  } catch (e) {}
}

// In-memory anti-tamper session guard inside service worker closure
let verifiedSession = {
  proActive: false,
  ramTamerActive: false,
  licenseKey: '',
  deviceId: '',
  plan: '',
  subscriptionStatus: 'unactivated',
  trialExpiresAt: 0,
  coldChecked: false,
  internalWriteInProgress: false
};
let integrityCheckInFlight = null;
const verifyInFlightByKey = new Map();

async function getOrCreateDeviceId() {
  if (verifiedSession.deviceId) return verifiedSession.deviceId;
  const stored = await chrome.storage.local.get(['deviceId']);
  if (stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')) {
    verifiedSession.deviceId = stored.deviceId;
    return stored.deviceId;
  }
  const newId = `ext_db_${generateSecureDeviceHex(8)}`;
  verifiedSession.deviceId = newId;
  await chrome.storage.local.set({ deviceId: newId });
  return newId;
}

const DEFAULT_STATE = {
  proActive: false,
  ramTamerActive: false,
  licenseKey: '',
  licenseToken: '',
  crmAccountId: '',
  subscriptionStatus: 'unactivated',
  plan: '',
  licenseExpiresAt: '',
  trialStartedAt: 0,
  trialExpiresAt: 0,
  trialSyncedWithServer: false,
  bonusProDaysEarned: 0,
  licenseVerifiedAt: 0,
  entitlements: [],
  pausedSites: [],
  neverSnoozeSites: [],
  customHiddenSelectors: {},
  settings: {
    cookieAutoClose: false,
    trackerProtection: false,
    adBlocking: false,
    silentMode: false,
    autoRamTamer: false,
    cloudTabSyncEnabled: false
  },
  stats: {
    adsBlocked: 0,
    adsSpotted: 0,
    cookiePromptsDetected: 0,
    cookiePromptsRejected: 0,
    antiAdblockBypassed: 0,
    tabsHibernated: 0
  },
  cloudTabSessions: []
};


// Strictly Anonymous Operational Telemetry (6 Non-Identifying Lifecycle Events — Zero URLs, Domains, Queries, or History)
const ALLOWED_TELEMETRY_EVENTS = new Set([
  'extension_installed',
  'protection_active',
  'first_value_seen',
  'welcome_tab_choice',
  'milestone_reached',
  'heartbeat'
]);

function detectExtensionEnvironment() {
  let browser = 'Chrome';
  let osPlatform = 'Windows';
  let locale = '';
  let countryHint = '';
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const ua = String(nav.userAgent || '');
    const uaLower = ua.toLowerCase();
    const brands = Array.isArray(nav.userAgentData && nav.userAgentData.brands)
      ? nav.userAgentData.brands.map((b) => String(b.brand || '').toLowerCase()).join(' ')
      : '';
    if (uaLower.includes('edg/') || brands.includes('edge')) browser = 'Edge';
    else if (uaLower.includes('opr/') || uaLower.includes('opera') || brands.includes('opera')) browser = 'Opera';
    else if (uaLower.includes('vivaldi')) browser = 'Vivaldi';
    else if (uaLower.includes('firefox/')) browser = 'Firefox';
    else if (Boolean(nav.brave) || brands.includes('brave')) browser = 'Brave';
    else if (uaLower.includes('safari/') && !uaLower.includes('chrome/') && !uaLower.includes('chromium/')) browser = 'Safari';
    else browser = 'Chrome';

    const platRaw = String((nav.userAgentData && nav.userAgentData.platform) || ua || '').toLowerCase();
    if (platRaw.includes('android')) osPlatform = 'Android';
    else if (platRaw.includes('cros')) osPlatform = 'ChromeOS';
    else if (platRaw.includes('iphone') || platRaw.includes('ipad') || platRaw.includes('ios')) osPlatform = 'iOS';
    else if (platRaw.includes('mac') || platRaw.includes('darwin')) osPlatform = 'macOS';
    else if (platRaw.includes('linux') || platRaw.includes('x11')) osPlatform = 'Linux';
    else osPlatform = 'Windows';

    locale = String(nav.language || '').trim().slice(0, 16);
    let tz = '';
    try {
      tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
    } catch {}
    const TZ_TO_COUNTRY = {
      'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
      'Europe/Bucharest': 'RO', 'Europe/Bratislava': 'SK', 'Europe/Prague': 'CZ', 'Europe/Warsaw': 'PL',
      'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE',
      'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
      'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR',
      'Europe/Istanbul': 'TR', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA',
      'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH',
      'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
      'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Dubai': 'AE',
      'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Montreal': 'CA', 'America/Edmonton': 'CA',
      'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
      'America/Phoenix': 'US', 'America/Detroit': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
      'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'America/Argentina/Buenos_Aires': 'AR',
      'Pacific/Auckland': 'NZ'
    };
    if (TZ_TO_COUNTRY[tz]) {
      countryHint = TZ_TO_COUNTRY[tz];
    } else if (tz.startsWith('Australia/')) {
      countryHint = 'AU';
    } else {
      const m = locale.match(/^[a-z]{2,3}[-_]([A-Z]{2})$/i);
      if (m && m[1]) countryHint = m[1].toUpperCase();
    }
  } catch {}
  return {
    browser,
    os_platform: osPlatform,
    ...(locale ? { locale } : {}),
    ...(countryHint ? { country_hint: countryHint } : {})
  };
}

async function sendAnonymousTelemetry(eventName, properties = {}, onceStorageKey = null) {
  try {
    if (!ALLOWED_TELEMETRY_EVENTS.has(eventName)) return { ok: false, error: 'unsupported_event' };
    if (onceStorageKey) {
      const check = await chrome.storage.local.get([onceStorageKey]);
      if (check && check[onceStorageKey]) return { ok: true, skippedDuplicate: true };
      await chrome.storage.local.set({ [onceStorageKey]: Date.now() });
    }
    const deviceId = await getOrCreateDeviceId();
    const manifest = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : { version: '1.4.0' };
    const envMeta = detectExtensionEnvironment();
    const safeProps = { ...envMeta };
    if (properties && typeof properties === 'object') {
      for (const [k, v] of Object.entries(properties)) {
        if (!['url', 'domain', 'hostname', 'query', 'path', 'referrer', 'history', 'title'].includes(k.toLowerCase())) {
          safeProps[k] = v;
        }
      }
    }
    await fetch('https://sweeprdeepblock.com/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        category: 'funnel',
        os: envMeta.os_platform ? envMeta.os_platform.toLowerCase() : 'browser_extension',
        browser: envMeta.browser,
        device_id: deviceId,
        app_version: manifest.version || '1.4.0',
        properties: safeProps
      })
    }).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}

// Automation A2: Host-Permission & Content-Blocker Activation Rescue Check
async function checkHostPermissionsAndProtection() {
  let granted = true;
  try {
    if (chrome.permissions && typeof chrome.permissions.contains === 'function') {
      granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    }
  } catch (e) {
    granted = true;
  }
  try {
    await chrome.storage.local.set({ hostPermissionsGranted: Boolean(granted) });
    if (granted) {
      await sendAnonymousTelemetry(
        'protection_active',
        { host_permissions: 'granted', dnr_enabled: true },
        'telemetrySent_protection_active'
      );
    }
  } catch (e) {}
  return Boolean(granted);
}

function parseTrialExpiryMs(store) {
  if (!store || typeof store !== 'object') return 0;
  const subStatus = String(store.subscriptionStatus || '').toLowerCase();
  const rawExp = store.trialExpiresAt || (subStatus === 'trialing' ? store.licenseExpiresAt : 0);
  if (typeof rawExp === 'number') return Number.isFinite(rawExp) ? rawExp : 0;
  if (typeof rawExp === 'string' && rawExp) {
    const parsed = Date.parse(rawExp);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isLocalTrialExpired(store, now = Date.now()) {
  if (!store || typeof store !== 'object') return false;
  const subStatus = String(store.subscriptionStatus || '').toLowerCase();
  const plan = String(store.plan || '').toLowerCase();
  if (subStatus === 'active' && plan !== 'trial_7d') return false;
  if (subStatus === 'trial_expired') return true;
  if (plan === 'trial_7d' || subStatus === 'trialing') {
    const expMs = parseTrialExpiryMs(store);
    return expMs > 0 && now >= expMs;
  }
  return false;
}

function isValidStoredTrial7d(store, now = Date.now()) {
  if (!store || typeof store !== 'object') return false;
  const key = String(store.licenseKey || '').trim();
  if (!key || !isValidLicenseCredential(key)) return false;
  if (isLocalTrialKey(key)) {
    const subStatus = String(store.subscriptionStatus || '').toLowerCase();
    const planName = String(store.plan || '').toLowerCase();
    if (subStatus !== 'trialing' || planName !== 'trial_7d') return false;
  }

  const trialStartedAt = Number(store.trialStartedAt);
  if (!Number.isFinite(trialStartedAt) || trialStartedAt <= 0 || trialStartedAt > now + 60000) {
    return false;
  }

  const trialExpMs = parseTrialExpiryMs(store);
  if (
    !Number.isFinite(trialExpMs) ||
    trialExpMs <= trialStartedAt ||
    trialExpMs - trialStartedAt > TRIAL_DURATION_MS + 60000 ||
    trialExpMs <= now
  ) {
    return false;
  }

  if (store.licenseExpiresAt !== undefined && store.licenseExpiresAt !== null && store.licenseExpiresAt !== '') {
    const parsedLicExp =
      typeof store.licenseExpiresAt === 'number'
        ? store.licenseExpiresAt
        : Date.parse(String(store.licenseExpiresAt));
    if (!Number.isFinite(parsedLicExp) || parsedLicExp <= 0 || Math.abs(parsedLicExp - trialExpMs) > 60000) {
      return false;
    }
  }

  const lastVerifiedAt = Number(store.licenseVerifiedAt || 0);
  if (lastVerifiedAt > 0 && now + 60000 < lastVerifiedAt) {
    return false;
  }
  const lastClockSeenAt = Number(store.lastClockSeenAt || 0);
  if (lastClockSeenAt > 0 && now + 60000 < lastClockSeenAt) {
    return false;
  }

  return true;
}

function isValidStoredReferralTrial14d(store, now = Date.now()) {
  if (!store || typeof store !== 'object') return false;
  const key = String(store.licenseKey || '').trim();
  if (!key || isLocalTrialKey(key) || !isValidLicenseCredential(key)) return false;
  const subStatus = String(store.subscriptionStatus || '').toLowerCase();
  if (subStatus === 'trial_expired' || subStatus === 'active') return false;
  const trialExpMs = parseTrialExpiryMs(store);
  const max14dMs = 14 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(trialExpMs) || trialExpMs <= now) return false;
  const startedAt = Number(store.trialStartedAt || 0);
  if (
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    startedAt > now + 60000 ||
    trialExpMs <= startedAt ||
    trialExpMs - startedAt > max14dMs + 60000
  ) {
    return false;
  }
  const lastVerifiedAt = Number(store.licenseVerifiedAt || 0);
  if (lastVerifiedAt > 0 && now + 60000 < lastVerifiedAt) {
    return false;
  }
  const lastClockSeenAt = Number(store.lastClockSeenAt || 0);
  if (lastClockSeenAt > 0 && now + 60000 < lastClockSeenAt) {
    return false;
  }
  return true;
}

async function advanceMonotonicClockWatermark(now = Date.now()) {
  try {
    const res = await chrome.storage.local.get(['lastClockSeenAt']);
    const prev = Number((res && res.lastClockSeenAt) || 0);
    if (!Number.isFinite(prev) || now > prev) {
      await chrome.storage.local.set({ lastClockSeenAt: now });
    }
  } catch (e) {}
}

function buildFullProEntitlementsList() {
  return [
    'pro_ad_and_video_shield',
    'pro_cookie_autoreject',
    'pro_tracker_param_stripping',
    'pro_element_zapper',
    'pro_tab_and_ram_tamer',
    'addon_total_tab_and_ram_tamer'
  ];
}

function scheduleTrialExpiryAlarm(trialExpiresAt) {
  const expMs = Number(trialExpiresAt || 0);
  if (expMs > Date.now() && typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.create) {
    try {
      chrome.alarms.create('trialExpiryCheck', { when: expMs });
    } catch (e) {}
  }
}

async function registerTrialWithServer(deviceId, localStartedAt, localExpiresAt) {
  try {
    const currentVersion =
      (typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.getManifest &&
        chrome.runtime.getManifest().version) ||
      '1.4.0';
    const envMeta = detectExtensionEnvironment();
    const deviceFingerprint = `${deviceId}:${envMeta.browser}:${envMeta.os_platform}`;
    for (const url of TRIAL_START_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-sweepr-project': 'deepblock'
          },
          body: JSON.stringify({
            installId: deviceId,
            deviceId,
            deviceFingerprint,
            appVersion: currentVersion,
            localStartedAt,
            localExpiresAt
          }),
          signal: AbortSignal.timeout(4000)
        });
        if (!res.ok) continue;
        const data = await res.json().catch(() => ({}));
        if (!data || !data.ok) continue;
        const cur = await chrome.storage.local.get(['subscriptionStatus', 'plan', 'proActive']);
        const curPlan = String((cur && cur.plan) || '').toLowerCase();
        const curStatus = String((cur && cur.subscriptionStatus) || '').toLowerCase();
        // Do not overwrite an active paid upgrade
        if (curStatus === 'active' && curPlan && curPlan !== 'trial_7d') {
          return data;
        }
        const serverStatus = String(data.status || 'trialing').toLowerCase();
        const serverExpMs = Number(data.trialExpiresAt || 0) || (data.expiresAt ? Date.parse(data.expiresAt) : localExpiresAt);
        if (serverStatus === 'trial_expired' || (Number.isFinite(serverExpMs) && serverExpMs > 0 && Date.now() >= serverExpMs)) {
          await revokeProState('trial_expired', { preserveLicenseKey: true });
          return data;
        }
        const canonicalTrialKey = String(data.trialKey || data.licenseKey || '').trim();
        if (canonicalTrialKey && isValidLicenseCredential(canonicalTrialKey)) {
          const startedAt = Number(data.trialStartedAt || localStartedAt || Date.now());
          verifiedSession.licenseKey = canonicalTrialKey;
          verifiedSession.trialExpiresAt = serverExpMs;
          verifiedSession.internalWriteInProgress = true;
          try {
            await chrome.storage.local.set({
              licenseKey: canonicalTrialKey,
              trialStartedAt: startedAt,
              trialExpiresAt: serverExpMs,
              licenseExpiresAt: serverExpMs,
              trialSyncedWithServer: true
            });
          } finally {
            verifiedSession.internalWriteInProgress = false;
          }
          scheduleTrialExpiryAlarm(serverExpMs);
          await syncLicenseBackupToChromeSync({
            licenseKey: canonicalTrialKey,
            plan: 'trial_7d',
            licenseExpiresAt: serverExpMs
          });
        }
        return data;
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

async function startAutomatic7DayTrial(existingStore = {}) {
  if (
    existingStore &&
    (existingStore.trialStartedAt ||
      existingStore.subscriptionStatus === 'trial_expired' ||
      (existingStore.proActive && existingStore.licenseKey && String(existingStore.plan || '').toLowerCase() !== 'trial_7d'))
  ) {
    return null;
  }
  const deviceId = await getOrCreateDeviceId();
  const hex1 = generateSecureDeviceHex(2).toUpperCase();
  const hex2 = generateSecureDeviceHex(2).toUpperCase();
  const hex3 = generateSecureDeviceHex(2).toUpperCase();
  const localTrialKey = `SWEEPR-TRIAL-${hex1}-${hex2}-${hex3}`;
  const now = Date.now();
  const trialExpiresAt = now + TRIAL_DURATION_MS;
  const trialSettings = {
    adBlocking: true,
    cookieAutoClose: true,
    trackerProtection: true,
    silentMode: true,
    autoRamTamer: tabsDiscardSupported,
    cloudTabSyncEnabled: true
  };
  const entitlements = buildFullProEntitlementsList();

  verifiedSession.proActive = true;
  verifiedSession.ramTamerActive = true;
  verifiedSession.licenseKey = localTrialKey;
  verifiedSession.plan = 'trial_7d';
  verifiedSession.subscriptionStatus = 'trialing';
  verifiedSession.trialExpiresAt = trialExpiresAt;
  verifiedSession.coldChecked = true;
  verifiedSession.internalWriteInProgress = true;
  try {
    await chrome.storage.local.set({
      deviceId,
      proActive: true,
      ramTamerActive: true,
      licenseKey: localTrialKey,
      subscriptionStatus: 'trialing',
      plan: 'trial_7d',
      trialStartedAt: now,
      trialExpiresAt,
      licenseExpiresAt: trialExpiresAt,
      trialSyncedWithServer: false,
      licenseVerifiedAt: now,
      lastClockSeenAt: now,
      entitlements,
      settings: trialSettings
    });
  } finally {
    verifiedSession.internalWriteInProgress = false;
  }

  scheduleTrialExpiryAlarm(trialExpiresAt);
  if (tabsDiscardSupported) {
    try {
      chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
    } catch (e) {}
  }

  await syncExtensionProtectionRules(true, true);
  if (
    chrome.declarativeNetRequest &&
    typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function'
  ) {
    chrome.declarativeNetRequest
      .setExtensionActionOptions({ displayActionCountAsBadgeText: false })
      .catch(() => {});
  }
  await updateActionBadge(undefined, trialSettings);

  // Opportunistically register trial with server for 5-device portability without blocking offline installs
  await registerTrialWithServer(deviceId, now, trialExpiresAt);

  const postState = await chrome.storage.local.get(['proActive', 'licenseKey', 'subscriptionStatus', 'trialStartedAt', 'trialExpiresAt']);
  return {
    ok: Boolean(postState && postState.proActive),
    proActive: Boolean(postState && postState.proActive),
    licenseKey: (postState && postState.licenseKey) || localTrialKey,
    subscriptionStatus: (postState && postState.subscriptionStatus) || 'trialing',
    plan: 'trial_7d',
    trialStartedAt: (postState && postState.trialStartedAt) || now,
    trialExpiresAt: (postState && postState.trialExpiresAt) || trialExpiresAt
  };
}

async function preserveOfflineGraceSession() {
  const stored = await chrome.storage.local.get([
    'proActive',
    'licenseKey',
    'licenseVerifiedAt',
    'lastClockSeenAt',
    'entitlements',
    'settings',
    'plan',
    'subscriptionStatus',
    'trialStartedAt',
    'trialExpiresAt',
    'licenseExpiresAt',
    'bonusProDaysEarned'
  ]);
  if (isLocalTrialExpired(stored)) {
    return null;
  }
  const storedKey = String(stored.licenseKey || '').trim();
  const storedPlan = String(stored.plan || '').toLowerCase();
  const storedStatus = String(stored.subscriptionStatus || '').toLowerCase();
  if (isLocalTrialKey(storedKey)) {
    if (storedStatus !== 'trialing' || storedPlan !== 'trial_7d' || !isValidStoredTrial7d(stored)) {
      return null;
    }
  } else if (storedPlan === 'referral_trial_14d' && !isValidStoredReferralTrial14d(stored)) {
    return null;
  } else if ((storedPlan === 'trial_7d' || storedStatus === 'trialing') && !isValidStoredTrial7d(stored)) {
    return null;
  }
  const now = Date.now();
  const graceElapsed = now - Number(stored.licenseVerifiedAt);
  const lastClockSeenAt = Number(stored.lastClockSeenAt || 0);
  const clockRolledBack = lastClockSeenAt > 0 && now + 60000 < lastClockSeenAt;
  const withinOfflineGrace =
    Boolean(stored.proActive && storedKey && stored.licenseVerifiedAt) &&
    !clockRolledBack &&
    graceElapsed >= -60000 &&
    graceElapsed <= OFFLINE_GRACE_MS;
  if (!withinOfflineGrace) {
    return null;
  }
  const adBlockingOn = !stored.settings || stored.settings.adBlocking !== false;
  const trackerOn = !stored.settings || stored.settings.trackerProtection !== false;
  verifiedSession.proActive = true;
  verifiedSession.ramTamerActive = true;
  verifiedSession.licenseKey = String(stored.licenseKey).trim();
  verifiedSession.plan = String(stored.plan || 'annual');
  verifiedSession.subscriptionStatus = String(stored.subscriptionStatus || 'active');
  verifiedSession.trialExpiresAt = parseTrialExpiryMs(stored);
  verifiedSession.coldChecked = true;
  await syncExtensionProtectionRules(adBlockingOn, trackerOn);
  return {
    ok: true,
    valid: true,
    networkError: true,
    offlineGrace: true,
    licenseKey: verifiedSession.licenseKey,
    ramTamerActive: true,
    plan: stored.plan || 'annual',
    expiresAt: stored.licenseExpiresAt || '',
    bonusProDaysEarned: Number(stored.bonusProDaysEarned || 0),
    entitlements: Array.isArray(stored.entitlements) ? stored.entitlements : []
  };
}

async function redeemPairingToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!PAIRING_TOKEN_RE.test(token)) {
    return {
      ok: false,
      valid: false,
      error: 'Please enter a valid ptk_ pairing token or SWEEPR-DB-XXXX-XXXX-XXXX license key.'
    };
  }
  const deviceId = await getOrCreateDeviceId();
  try {
    const res = await fetch('https://sweeprdeepblock.com/api/device-link/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-sweepr-project': 'deepblock' },
      body: JSON.stringify({
        token,
        device_id: deviceId,
        device_name: 'SWEEPR Deepblock Extension',
        platform: 'browser_extension'
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json().catch(() => ({}));
    const canonicalKey = String(data?.licenseKey || data?.license_key || '').trim();
    if (res.ok && data && (data.ok || data.valid) && canonicalKey && !canonicalKey.startsWith('ptk_')) {
      return await verifyLicenseWithServer(canonicalKey);
    }
    return {
      ok: false,
      valid: false,
      error: (data && (data.message || data.error)) || 'Invalid or expired website QR pairing code.'
    };
  } catch (e) {
    return {
      ok: false,
      valid: false,
      networkError: true,
      error: 'Could not reach server to redeem pairing code. Please check your connection.'
    };
  }
}

const CHROME_AUTO_ACTIVATE_DEFAULT_EXPIRES = '';

function detectExtensionOs() {
  try {
    const platRaw = String(
      (typeof navigator !== 'undefined' && ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent)) ||
        ''
    ).toLowerCase();
    if (platRaw.includes('cros')) return 'chromeos';
    if (platRaw.includes('mac') || platRaw.includes('darwin')) return 'macos';
    if (platRaw.includes('linux') || platRaw.includes('x11')) return 'linux';
  } catch (e) {}
  return 'windows';
}

async function syncLicenseBackupToChromeSync({ licenseKey, plan, licenseExpiresAt } = {}) {
  try {
    if (!licenseKey || isLocalTrialKey(licenseKey) || !isValidLicenseCredential(licenseKey)) return;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      await chrome.storage.sync.set({
        sweeprLicenseBackup: {
          licenseKey: String(licenseKey).trim(),
          plan: plan || 'annual',
          licenseExpiresAt: licenseExpiresAt || '',
          updatedAt: Date.now()
        }
      });
    }
  } catch (e) {}
}

async function applyVerifiedLicenseActivation(data, fallbackKey = '') {
  const subStatus = String((data && data.status) || 'active').toLowerCase();
  const planName = String((data && data.plan) || 'annual');
  const isTrialPlan = subStatus === 'trialing' || planName === 'trial_7d' || planName === 'referral_trial_14d';
  const rawTrialExp = data && (data.trialExpiresAt || (isTrialPlan ? data.expiresAt : 0));
  const resolvedTrialExpMs = isTrialPlan
    ? (typeof rawTrialExp === 'number' ? rawTrialExp : (rawTrialExp ? Date.parse(rawTrialExp) : 0))
    : 0;
  const entitlements = Array.isArray(data && data.entitlements)
    ? data.entitlements
    : buildFullProEntitlementsList();
  const canonicalKey = String((data && (data.licenseKey || data.license_key)) || fallbackKey || '').trim();
  const priorState = await chrome.storage.local.get(['proActive', 'settings', 'subscriptionStatus', 'plan']);
  const priorSettings = (priorState && priorState.settings) || {};
  const nextSettings = priorState && priorState.proActive
    ? {
        ...DEFAULT_STATE.settings,
        ...priorSettings
      }
    : {
        cookieAutoClose: true,
        trackerProtection: true,
        adBlocking: true,
        silentMode: true,
        autoRamTamer: tabsDiscardSupported,
        cloudTabSyncEnabled:
          priorState && priorState.subscriptionStatus === 'trial_expired'
            ? true
            : Boolean(priorSettings.cloudTabSyncEnabled)
      };

  verifiedSession.proActive = true;
  verifiedSession.ramTamerActive = true;
  verifiedSession.licenseKey = canonicalKey;
  verifiedSession.plan = planName;
  verifiedSession.subscriptionStatus = subStatus;
  verifiedSession.trialExpiresAt = Number.isFinite(resolvedTrialExpMs) && resolvedTrialExpMs > 0 ? resolvedTrialExpMs : 0;
  verifiedSession.coldChecked = true;
  const resolvedTrialStart = isTrialPlan
    ? Number(
        (data && data.trialStartedAt) ||
          (planName === 'trial_7d' && resolvedTrialExpMs > TRIAL_DURATION_MS
            ? Math.min(Date.now(), resolvedTrialExpMs - TRIAL_DURATION_MS)
            : Date.now())
      )
    : 0;
  verifiedSession.internalWriteInProgress = true;
  try {
    await chrome.storage.local.set({
      proActive: true,
      ramTamerActive: true,
      licenseKey: canonicalKey,
      draftLicenseKey: '',
      licenseDrawerOpen: false,
      licenseToken: (data && (data.token || data.license_token)) || '',
      crmAccountId: (data && data.account_id) || '',
      subscriptionStatus: subStatus,
      plan: planName,
      licenseExpiresAt: (data && data.expiresAt) || CHROME_AUTO_ACTIVATE_DEFAULT_EXPIRES,
      trialExpiresAt: verifiedSession.trialExpiresAt,
      trialStartedAt: isTrialPlan && resolvedTrialStart > 0 ? resolvedTrialStart : 0,
      bonusProDaysEarned: Number((data && data.bonusProDaysEarned) || 0),
      stepUpSaveEligible: Boolean(data && (data.stepUpSaveEligible || planName === 'monthly_intro')),
      previousLicenseKey: canonicalKey,
      licenseVerifiedAt: Date.now(),
      lastClockSeenAt: Date.now(),
      entitlements,
      settings: nextSettings
    });
  } finally {
    verifiedSession.internalWriteInProgress = false;
  }

  if (!isTrialPlan && chrome.alarms && typeof chrome.alarms.clear === 'function') {
    Promise.resolve(chrome.alarms.clear('trialExpiryCheck')).catch(() => {});
  } else if (verifiedSession.trialExpiresAt > Date.now()) {
    scheduleTrialExpiryAlarm(verifiedSession.trialExpiresAt);
  }

  await syncLicenseBackupToChromeSync({
    licenseKey: canonicalKey,
    plan: planName,
    licenseExpiresAt: (data && data.expiresAt) || ''
  });

  if (tabsDiscardSupported && nextSettings.autoRamTamer !== false) {
    chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  } else {
    Promise.resolve(chrome.alarms.clear('ramTamerCheck')).catch(() => {});
  }
  await syncExtensionProtectionRules(
    nextSettings.adBlocking !== false,
    nextSettings.trackerProtection !== false
  );
  syncRemoteFilterDelta().catch(() => {});
  if (
    chrome.declarativeNetRequest &&
    typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function'
  ) {
    chrome.declarativeNetRequest
      .setExtensionActionOptions({ displayActionCountAsBadgeText: nextSettings.silentMode === false })
      .catch(() => {});
  }
  await updateActionBadge(undefined, nextSettings);
  return {
    ok: true,
    valid: true,
    status: subStatus,
    plan: planName,
    expiresAt: (data && data.expiresAt) || '',
    trialExpiresAt: verifiedSession.trialExpiresAt,
    bonusProDaysEarned: Number((data && data.bonusProDaysEarned) || 0),
    licenseKey: canonicalKey,
    ramTamerActive: true,
    entitlements,
    settings: nextSettings
  };
}

let chromeAutoActivateInFlight = null;

async function restoreLicenseFromChromeSync() {
  try {
    const localState = await chrome.storage.local.get(['proActive', 'licenseKey']);
    if (localState && localState.proActive && localState.licenseKey) {
      return { ok: true, valid: true, alreadyActive: true };
    }
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      return { ok: false, reason: 'sync_unavailable' };
    }
    const syncRes = await chrome.storage.sync.get(['sweeprLicenseBackup']);
    const backupKey = String(syncRes?.sweeprLicenseBackup?.licenseKey || '').trim();
    if (!backupKey || !isValidLicenseCredential(backupKey)) {
      return { ok: false, reason: 'no_sync_backup' };
    }
    const verified = await verifyLicenseWithServer(backupKey);
    if (verified && verified.ok && verified.valid) {
      return { ...verified, restoredFromSync: true };
    }
    return { ok: false, reason: verified?.status || 'sync_backup_invalid' };
  } catch (e) {
    return { ok: false, reason: 'sync_error' };
  }
}

function getIdentityProfileEmail() {
  return new Promise((resolve) => {
    try {
      if (!chrome.identity || typeof chrome.identity.getProfileUserInfo !== 'function') {
        resolve('');
        return;
      }
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve('');
          return;
        }
        resolve(String((info && info.email) || '').trim().toLowerCase());
      });
    } catch (e) {
      resolve('');
    }
  });
}

function getIdentityAuthToken(interactive) {
  return new Promise((resolve) => {
    try {
      if (!chrome.identity || typeof chrome.identity.getAuthToken !== 'function') {
        resolve('');
        return;
      }
      chrome.identity.getAuthToken({ interactive: Boolean(interactive) }, (token) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve('');
          return;
        }
        resolve(String(token || '').trim());
      });
    } catch (e) {
      resolve('');
    }
  });
}

function removeCachedIdentityToken(token) {
  return new Promise((resolve) => {
    try {
      if (!token || !chrome.identity || typeof chrome.identity.removeCachedAuthToken !== 'function') {
        resolve();
        return;
      }
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    } catch (e) {
      resolve();
    }
  });
}

async function attemptChromeProfileAutoActivation(options = {}) {
  const interactive = Boolean(options && options.interactive);
  if (chromeAutoActivateInFlight && !interactive) {
    return chromeAutoActivateInFlight;
  }

  const runAttempt = (async () => {
    const localState = await chrome.storage.local.get(['proActive', 'licenseKey']);
    if ((verifiedSession.proActive && verifiedSession.licenseKey) || (localState && localState.proActive && localState.licenseKey)) {
      return { ok: true, valid: true, alreadyActive: true };
    }

    const syncRestored = await restoreLicenseFromChromeSync();
    if (syncRestored && syncRestored.ok && syncRestored.valid) {
      return syncRestored;
    }

    if (typeof chrome === 'undefined' || !chrome.identity || typeof chrome.identity.getAuthToken !== 'function') {
      return { ok: false, skipped: true, reason: 'identity_unavailable' };
    }

    if (!interactive) {
      const profileEmail = await getIdentityProfileEmail();
      if (!profileEmail) {
        return { ok: false, skipped: true, reason: 'no_chrome_email' };
      }
    }

    const token = await getIdentityAuthToken(interactive);
    if (!token) {
      if (!interactive) {
        await chrome.storage.local.set({
          chromeAutoActivateResult: { status: 'needs_consent', checkedAt: Date.now() }
        }).catch(() => {});
        return { ok: false, valid: false, reason: 'needs_consent' };
      }
      return {
        ok: false,
        valid: false,
        reason: 'auth_cancelled',
        error: 'Chrome Google account verification was cancelled or declined.'
      };
    }

    const deviceId = await getOrCreateDeviceId();
    const manifestVersion =
      (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version) ||
      '1.4.0';
    let lastNetworkError = false;
    let sawAuthReject = false;

    for (const url of CHROME_AUTO_ACTIVATE_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-sweepr-project': 'deepblock'
          },
          body: JSON.stringify({
            google_access_token: token,
            device_id: deviceId,
            device_name: 'SWEEPR Deepblock Chrome Extension',
            os: detectExtensionOs(),
            app_version: manifestVersion
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (res.status >= 500 || res.status === 429) {
          lastNetworkError = true;
          continue;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.valid === true) {
          const activated = await applyVerifiedLicenseActivation(data, data.licenseKey || data.license_key);
          await chrome.storage.local.set({
            chromeAutoActivateResult: {
              status: 'activated',
              emailMasked: data.email_masked || data.email || '',
              expiresAt: data.expiresAt || '',
              devicesUsed: data.devices_used,
              devicesMax: data.devices_max,
              checkedAt: Date.now()
            }
          }).catch(() => {});
          return {
            ...activated,
            autoActivated: true,
            emailMasked: data.email_masked || data.email || '',
            devicesUsed: data.devices_used,
            devicesMax: data.devices_max
          };
        }

        if (res.status === 401 && data?.error === 'invalid_google_token' && !sawAuthReject) {
          sawAuthReject = true;
          await removeCachedIdentityToken(token);
          return {
            ok: false,
            valid: false,
            reason: 'invalid_google_token',
            error: data.message || 'Could not verify Chrome Google account token.'
          };
        }

        if (res.status === 403 && data?.error === 'device_limit_reached') {
          await chrome.storage.local.set({
            chromeAutoActivateResult: {
              status: 'device_limit_reached',
              emailMasked: data.email_masked || '',
              devicesUsed: data.devices_used,
              devicesMax: data.devices_max,
              message: data.message || '',
              checkedAt: Date.now()
            }
          }).catch(() => {});
          return {
            ok: false,
            valid: false,
            reason: 'device_limit_reached',
            emailMasked: data.email_masked || '',
            devicesUsed: data.devices_used,
            devicesMax: data.devices_max,
            error: data.message || 'Device limit reached. Remove an old device in your Customer Portal to activate this browser.'
          };
        }

        const errReason = String(data?.error || 'no_paid_subscription');
        await chrome.storage.local.set({
          chromeAutoActivateResult: { status: errReason, checkedAt: Date.now() }
        }).catch(() => {});
        return {
          ok: false,
          valid: false,
          reason: errReason,
          error: data?.message || 'No active paid SWEEPR DeepBlock subscription matches this Chrome Google account.'
        };
      } catch (e) {
        lastNetworkError = true;
      }
    }

    return {
      ok: false,
      valid: false,
      networkError: lastNetworkError,
      reason: 'network_error',
      error: 'Could not reach licensing server. Please check your internet connection.'
    };
  })();

  if (!interactive) {
    chromeAutoActivateInFlight = runAttempt;
  }
  try {
    return await runAttempt;
  } finally {
    if (chromeAutoActivateInFlight === runAttempt) {
      chromeAutoActivateInFlight = null;
    }
  }
}

// Verify license key against Central SWEEPR CRM & SWEEPR Deepblock Licensing API
async function verifyLicenseWithServer(rawKey, options = {}) {
  const revokeOnInvalid = Boolean(options && options.revokeOnInvalid);
  const key = String(rawKey || '').trim();
  if (!isValidLicenseCredential(key) || isLocalTrialKey(key) || key.length > 512) {
    if (revokeOnInvalid) {
      await revokeProState('invalid_key_format', { preserveLicenseKey: false });
    }
    return {
      ok: false,
      valid: false,
      error: 'Please enter a full SWEEPR-DB-XXXX-XXXX-XXXX license key.'
    };
  }

  if (verifyInFlightByKey.has(key)) {
    return verifyInFlightByKey.get(key);
  }

  const runVerification = (async () => {
    const deviceId = await getOrCreateDeviceId();
    let lastNetworkError = false;
    let sawTransientHttpError = false;
    let lastRejectedResult = null;

    for (const baseUrl of LICENSE_VERIFY_ENDPOINTS) {
      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          const sep = baseUrl.includes('?') ? '&' : '?';
          const res = await fetch(`${baseUrl}${sep}key=${encodeURIComponent(key)}&device_id=${encodeURIComponent(deviceId)}`, {
            method: 'GET',
            headers: { Accept: 'application/json', 'x-sweepr-project': 'deepblock' },
            signal: AbortSignal.timeout(10000)
          });
          if (res.status === 429 || res.status >= 500) {
            sawTransientHttpError = true;
            if (attempt === 0) {
              const delayMs = 250 + Math.floor(Math.random() * 150);
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }
            break;
          }
          const data = await res.json().catch(() => ({}));

          if (res.ok && data && data.valid === true) {
            const subStatus = String(data.status || 'active').toLowerCase();
            if (subStatus === 'active' || subStatus === 'trialing') {
              return await applyVerifiedLicenseActivation(data, key);
            }
          }

          if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404 || data?.valid === false) {
            const statusReason = String(data?.error || data?.status || 'inactive').toLowerCase() === 'trial_expired'
              ? 'trial_expired'
              : String(data?.status || data?.error || 'inactive').toLowerCase();
            const isExplicitlyInactive =
              res.status === 403 &&
              (statusReason === 'subscription_inactive' ||
                statusReason === 'canceled' ||
                statusReason === 'expired' ||
                statusReason === 'trial_expired' ||
                statusReason === 'unpaid');
            if (isExplicitlyInactive) {
              if (revokeOnInvalid || !verifiedSession.proActive || verifiedSession.licenseKey === key) {
                await revokeProState(statusReason, { preserveLicenseKey: true });
              }
              return {
                ok: false,
                valid: false,
                status: statusReason,
                error:
                  statusReason === 'trial_expired'
                    ? 'Your 7-day Pro trial has expired. Please upgrade to restore Pro features.'
                    : 'Your Pro subscription is no longer active. Please renew to unlock Pro features.'
              };
            }
            lastRejectedResult = {
              ok: false,
              valid: false,
              status: statusReason,
              error: 'License key not recognized or no active paid subscription found.'
            };
            break;
          }
          break;
        } catch (e) {
          lastNetworkError = true;
          if (attempt === 0) {
            const delayMs = 250 + Math.floor(Math.random() * 150);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
    }

    if (lastRejectedResult && !lastNetworkError && !sawTransientHttpError) {
      if (revokeOnInvalid) {
        await revokeProState(lastRejectedResult.status || 'inactive', { preserveLicenseKey: true });
      }
      return lastRejectedResult;
    }

    if (lastNetworkError || sawTransientHttpError) {
      const graced = await preserveOfflineGraceSession();
      if (graced) {
        return graced;
      }
    }

    return {
      ok: false,
      valid: false,
      networkError: true,
      error: 'Could not reach licensing server to verify subscription. Please check your connection.'
    };
  })();

  verifyInFlightByKey.set(key, runVerification);
  try {
    return await runVerification;
  } finally {
    verifyInFlightByKey.delete(key);
  }
}

async function revokeProState(reason = 'inactive', options = {}) {
  const reasonStr = String(reason);
  verifiedSession.proActive = false;
  verifiedSession.ramTamerActive = false;
  verifiedSession.licenseKey = '';
  verifiedSession.plan = '';
  verifiedSession.subscriptionStatus = reasonStr;
  verifiedSession.trialExpiresAt = 0;
  verifiedSession.coldChecked = true;
  verifiedSession.internalWriteInProgress = true;
  try {
    const existing = await chrome.storage.local.get(['churnedAt', 'licenseKey', 'previousLicenseKey', 'plan']);
    const preservedKey = options.clearLicenseKey ? '' : (existing?.licenseKey || '');
    const isTrialReason = reasonStr === 'trial_expired' || String(existing?.plan || '').toLowerCase() === 'trial_7d';
    await chrome.storage.local.set({
      proActive: false,
      ramTamerActive: false,
      licenseKey: preservedKey,
      previousLicenseKey: isTrialReason
        ? (existing?.previousLicenseKey || '')
        : (existing?.previousLicenseKey || existing?.licenseKey || ''),
      subscriptionStatus: reasonStr,
      churnedAt: existing?.churnedAt || Date.now(),
      licenseVerifiedAt: Date.now(),
      ...(options.resetTrialWindow
        ? { trialStartedAt: 0, trialExpiresAt: 0, licenseExpiresAt: '', plan: '' }
        : {}),
      entitlements: [],
      extraCmpSelectors: [],
      extraAntiAdblockSelectors: [],
      extraCosmeticSelectors: [],
      settings: {
        cookieAutoClose: false,
        trackerProtection: false,
        adBlocking: false,
        silentMode: false,
        autoRamTamer: false,
        cloudTabSyncEnabled: false
      }
    });
  } finally {
    verifiedSession.internalWriteInProgress = false;
  }
  if (options.clearLicenseKey && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.remove(['sweeprLicenseBackup']).catch(() => {});
  }
  syncSessionsToChromeSync([], false);
  if (typeof chrome !== 'undefined' && chrome.alarms && typeof chrome.alarms.clear === 'function') {
    Promise.resolve(chrome.alarms.clear('ramTamerCheck')).catch(() => {});
    Promise.resolve(chrome.alarms.clear('trialExpiryCheck')).catch(() => {});
  }
  await syncExtensionProtectionRules(false, false);
  await updateActionBadge();
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs &&
      typeof chrome.tabs.query === 'function' &&
      typeof chrome.tabs.sendMessage === 'function'
    ) {
      const tabs = await chrome.tabs.query({});
      if (Array.isArray(tabs)) {
        for (const tab of tabs) {
          if (tab && tab.id) {
            Promise.resolve(
              chrome.tabs.sendMessage(tab.id, {
                type: 'PRO_ENTITLEMENT_CHANGED',
                proActive: false,
                subscriptionStatus: reasonStr
              })
            ).catch(() => {});
          }
        }
      }
    }
  } catch (e) {}
}

// Guard against manual DevTools tampering with chrome.storage.local while honoring legitimate popup/welcome activations
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || verifiedSession.internalWriteInProgress) return;
    const newVerifiedAt = Number(changes.licenseVerifiedAt?.newValue || 0);
    const freshKey = String(changes.licenseKey?.newValue || verifiedSession.licenseKey || '').trim();
    const changedStatus = String(changes.subscriptionStatus?.newValue || '').toLowerCase();
    if (
      changes.proActive?.newValue === true &&
      changedStatus !== 'trial_expired' &&
      freshKey &&
      !freshKey.startsWith('ptk_') &&
      newVerifiedAt > 0 &&
      Date.now() - newVerifiedAt < 15000
    ) {
      chrome.storage.local.get(
        [
          'proActive',
          'licenseKey',
          'licenseVerifiedAt',
          'subscriptionStatus',
          'plan',
          'trialStartedAt',
          'trialExpiresAt',
          'licenseExpiresAt',
          'settings'
        ],
        (s) => {
          const store = s || {};
          const subStatus = String(store.subscriptionStatus || '').toLowerCase();
          const planName = String(store.plan || '').toLowerCase();
          if (subStatus === 'trial_expired' || isLocalTrialExpired(store)) {
            verifiedSession.proActive = false;
            verifiedSession.ramTamerActive = false;
            verifiedSession.licenseKey = '';
            verifiedSession.plan = '';
            verifiedSession.subscriptionStatus = 'trial_expired';
            verifiedSession.trialExpiresAt = 0;
            verifiedSession.coldChecked = false;
            enforceStoredSubscriptionIntegrity({ force: true }).catch(() => {});
            return;
          }
          const resolvedKey = String(store.licenseKey || freshKey).trim();
          const trialExpMs = parseTrialExpiryMs(store);
          const isLocalKey = isLocalTrialKey(resolvedKey);
          const isReferralTrial = planName === 'referral_trial_14d';
          const isTrial7d = planName === 'trial_7d' || (subStatus === 'trialing' && !isReferralTrial);
          const isTrial = isTrial7d || isReferralTrial || subStatus === 'trialing';
          const localKeyValid = !isLocalKey || (subStatus === 'trialing' && planName === 'trial_7d' && isValidStoredTrial7d(store));
          const trialStateValid = isTrial7d
            ? isValidStoredTrial7d(store)
            : isReferralTrial
            ? isValidStoredReferralTrial14d(store)
            : !isLocalKey;
          if (!store.proActive || !resolvedKey || !isValidLicenseCredential(resolvedKey) || !localKeyValid || !trialStateValid) {
            verifiedSession.proActive = false;
            verifiedSession.ramTamerActive = false;
            verifiedSession.licenseKey = '';
            verifiedSession.plan = '';
            verifiedSession.subscriptionStatus = (isTrial || isLocalKey) ? 'trial_expired' : (subStatus || 'unactivated');
            verifiedSession.trialExpiresAt = 0;
            verifiedSession.coldChecked = false;
            enforceStoredSubscriptionIntegrity({ force: true }).catch(() => {});
            return;
          }
          if (!isLocalKey) {
            verifiedSession.proActive = false;
            verifiedSession.ramTamerActive = false;
            verifiedSession.coldChecked = false;
            verifyLicenseWithServer(resolvedKey, { revokeOnInvalid: true }).catch(() => {});
            return;
          }
          verifiedSession.proActive = true;
          verifiedSession.ramTamerActive = true;
          verifiedSession.licenseKey = resolvedKey;
          verifiedSession.plan = store.plan || (isTrial ? 'trial_7d' : 'annual');
          verifiedSession.subscriptionStatus = subStatus || (isTrial ? 'trialing' : 'active');
          verifiedSession.trialExpiresAt = isTrial ? trialExpMs : 0;
          verifiedSession.coldChecked = true;
          const st = store.settings || {};
          syncExtensionProtectionRules(st.adBlocking !== false, st.trackerProtection !== false).catch(() => {});
          syncRemoteFilterDelta().catch(() => {});
        }
      );
      return;
    }
    const tamperedPro = Boolean(changes.proActive && changes.proActive.newValue === true);
    const tamperedRam = Boolean(changes.ramTamerActive && changes.ramTamerActive.newValue === true);
    const tamperedTrialField = Boolean(
      changes.trialStartedAt ||
      changes.trialExpiresAt ||
      changes.licenseExpiresAt ||
      changes.subscriptionStatus ||
      changes.plan ||
      changes.licenseKey
    );
    if (tamperedPro || tamperedRam || tamperedTrialField) {
      enforceStoredSubscriptionIntegrity({ force: true }).catch(() => {});
    }
  });
}

async function enforceStoredSubscriptionIntegrity(options = {}) {
  const force = Boolean(options && options.force);
  if (integrityCheckInFlight && !force) {
    return integrityCheckInFlight;
  }

  const runIntegrityCheck = (async () => {
    const store = await chrome.storage.local.get([
      'proActive',
      'ramTamerActive',
      'licenseKey',
      'licenseVerifiedAt',
      'lastClockSeenAt',
      'settings',
      'subscriptionStatus',
      'plan',
      'trialStartedAt',
      'trialExpiresAt',
      'licenseExpiresAt',
      'trialSyncedWithServer',
      'entitlements'
    ]);
    const key = String(store.licenseKey || '').trim();
    const subStatus = String(store.subscriptionStatus || '').toLowerCase();
    const planName = String(store.plan || '').toLowerCase();

    // Immediate trial expiry check (beats cache TTL and offline grace)
    if (isLocalTrialExpired(store)) {
      if (store.proActive || store.ramTamerActive || subStatus !== 'trial_expired') {
        await revokeProState('trial_expired', { preserveLicenseKey: true });
      } else {
        verifiedSession.coldChecked = true;
        verifiedSession.proActive = false;
        verifiedSession.ramTamerActive = false;
        verifiedSession.licenseKey = '';
        verifiedSession.plan = '';
        verifiedSession.subscriptionStatus = 'trial_expired';
        verifiedSession.trialExpiresAt = 0;
        await syncExtensionProtectionRules(false, false);
      }
      return { proActive: false, ramTamerActive: false };
    }

    // Local SWEEPR-TRIAL-* keys may ONLY exist for an active, un-expired trial_7d trial
    const isLocalKey = isLocalTrialKey(key);
    if (isLocalKey && (subStatus !== 'trialing' || planName !== 'trial_7d')) {
      await revokeProState('trial_expired', { clearLicenseKey: true, resetTrialWindow: true });
      return { proActive: false, ramTamerActive: false };
    }

    // Active 7-day local/server trial branch (strict invariant validation — never mint a trial key here)
    const isReferralTrial = planName === 'referral_trial_14d';
    const isTrial7d = planName === 'trial_7d' || (subStatus === 'trialing' && !isReferralTrial);
    if (isTrial7d && (store.proActive || store.ramTamerActive)) {
      if (!isValidStoredTrial7d(store)) {
        await revokeProState('trial_expired', { clearLicenseKey: true, resetTrialWindow: true });
        return { proActive: false, ramTamerActive: false };
      }

      const trialExpMs = parseTrialExpiryMs(store);
      verifiedSession.proActive = true;
      verifiedSession.ramTamerActive = true;
      verifiedSession.licenseKey = key;
      verifiedSession.plan = store.plan || 'trial_7d';
      verifiedSession.subscriptionStatus = 'trialing';
      verifiedSession.trialExpiresAt = trialExpMs;
      verifiedSession.coldChecked = true;

      scheduleTrialExpiryAlarm(trialExpMs);
      const adBlockingOn = !store.settings || store.settings.adBlocking !== false;
      const trackerOn = !store.settings || store.settings.trackerProtection !== false;
      await syncExtensionProtectionRules(adBlockingOn, trackerOn);

      if (planName === 'trial_7d' && !store.trialSyncedWithServer) {
        const deviceId = await getOrCreateDeviceId();
        registerTrialWithServer(deviceId, Number(store.trialStartedAt), trialExpMs).catch(() => {});
      }
      return { proActive: true, ramTamerActive: true };
    }

    if (isReferralTrial && (store.proActive || store.ramTamerActive) && !isValidStoredReferralTrial14d(store)) {
      await revokeProState('trial_expired', { clearLicenseKey: true, resetTrialWindow: true });
      return { proActive: false, ramTamerActive: false };
    }

    if (!key || !store.proActive || !isValidLicenseCredential(key)) {
      if (store.proActive || store.ramTamerActive) {
        await revokeProState(subStatus && subStatus !== 'trialing' ? subStatus : 'unactivated', {
          clearLicenseKey: !isValidLicenseCredential(key)
        });
      } else {
        verifiedSession.coldChecked = true;
        verifiedSession.proActive = false;
        verifiedSession.ramTamerActive = false;
        verifiedSession.licenseKey = '';
        verifiedSession.plan = '';
        verifiedSession.subscriptionStatus = subStatus || 'unactivated';
        verifiedSession.trialExpiresAt = 0;
        await syncExtensionProtectionRules(false, false);
      }
      return { proActive: false, ramTamerActive: false };
    }

    const verifiedAt = Number(store.licenseVerifiedAt || 0);
    const ageMs = Date.now() - verifiedAt;
    if (!force && verifiedSession.coldChecked && verifiedAt > 0 && ageMs >= 0 && ageMs < VERIFIED_SESSION_CACHE_TTL_MS) {
      verifiedSession.proActive = true;
      verifiedSession.ramTamerActive = true;
      verifiedSession.licenseKey = key;
      verifiedSession.plan = store.plan || 'annual';
      verifiedSession.subscriptionStatus = subStatus || 'active';
      verifiedSession.trialExpiresAt = isReferralTrial ? parseTrialExpiryMs(store) : 0;
      verifiedSession.coldChecked = true;
      const adBlockingOn = !store.settings || store.settings.adBlocking !== false;
      const trackerOn = !store.settings || store.settings.trackerProtection !== false;
      await syncExtensionProtectionRules(adBlockingOn, trackerOn);
      return { proActive: true, ramTamerActive: true };
    }

    const verified = await verifyLicenseWithServer(key, { revokeOnInvalid: true });
    verifiedSession.coldChecked = true;
    if (verified.networkError || verified.offlineGrace) {
      const now = Date.now();
      const graceElapsed = now - Number(store.licenseVerifiedAt);
      const lastClockSeenAt = Number(store.lastClockSeenAt || 0);
      const clockRolledBack = lastClockSeenAt > 0 && now + 60000 < lastClockSeenAt;
      const withinOfflineGrace =
        Boolean(store.licenseVerifiedAt) &&
        !clockRolledBack &&
        graceElapsed >= -60000 &&
        graceElapsed <= OFFLINE_GRACE_MS &&
        !isLocalTrialExpired(store);
      if (!withinOfflineGrace || !store.proActive || !key) {
        await revokeProState(clockRolledBack ? 'clock_tampered' : 'offline_grace_expired', { preserveLicenseKey: true });
        return { proActive: false, ramTamerActive: false };
      }
      verifiedSession.proActive = true;
      verifiedSession.ramTamerActive = true;
      verifiedSession.licenseKey = key;
      verifiedSession.plan = store.plan || 'annual';
      verifiedSession.subscriptionStatus = subStatus || 'active';
      verifiedSession.trialExpiresAt = isReferralTrial ? parseTrialExpiryMs(store) : 0;
      const adBlockingOn = !store.settings || store.settings.adBlocking !== false;
      const trackerOn = !store.settings || store.settings.trackerProtection !== false;
      await syncExtensionProtectionRules(adBlockingOn, trackerOn);
      return { proActive: true, ramTamerActive: true };
    }
    const isValid = Boolean(verified.valid);
    return {
      proActive: isValid,
      ramTamerActive: isValid
    };
  })();

  integrityCheckInFlight = runIntegrityCheck;
  try {
    return await runIntegrityCheck;
  } finally {
    if (integrityCheckInFlight === runIntegrityCheck) {
      integrityCheckInFlight = null;
    }
  }
}

async function ensureVerifiedProSession() {
  const trialExpiredInMemory =
    verifiedSession.proActive &&
    verifiedSession.trialExpiresAt > 0 &&
    Date.now() >= verifiedSession.trialExpiresAt;
  if (!verifiedSession.coldChecked || trialExpiredInMemory) {
    await enforceStoredSubscriptionIntegrity({ force: trialExpiredInMemory });
  }
  const proActive = Boolean(verifiedSession.proActive && verifiedSession.licenseKey);
  return {
    proActive,
    ramTamerActive: proActive,
    licenseKey: verifiedSession.licenseKey || '',
    subscriptionStatus: verifiedSession.subscriptionStatus || 'unactivated',
    plan: verifiedSession.plan || '',
    trialExpiresAt: verifiedSession.trialExpiresAt || 0
  };
}

// Ensure DNR rulesets and protection state are active on service worker wakeup, yielding briefly before rewriting dynamic rules
enforceStoredSubscriptionIntegrity()
  .then(() => new Promise((r) => setTimeout(r, 2500)))
  .then(() => syncRemoteFilterDelta())
  .catch(() => {});


// Register Desktop Right-Click Context Menus
function registerContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'sweepr-zap-element',
      title: '🧹 Hide distracting element on this page',
      contexts: ['page', 'selection', 'image', 'link']
    });
    chrome.contextMenus.create({
      id: 'sweepr-toggle-site',
      title: 'Pause / Resume SWEEPR Deepblock on this site',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'sweepr-snooze-tabs',
      title: '⚡ Snooze Inactive Background Tabs Now',
      contexts: ['page', 'action']
    });
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  const mergedSettings = { ...DEFAULT_STATE.settings, ...(existing.settings || {}) };
  let syncedSessions = [];
  if (
    mergedSettings.cloudTabSyncEnabled === true &&
    chrome.storage &&
    chrome.storage.sync &&
    (!Array.isArray(existing.cloudTabSessions) || existing.cloudTabSessions.length === 0)
  ) {
    try {
      const syncData = await chrome.storage.sync.get(['cloudTabSessions']);
      if (syncData && Array.isArray(syncData.cloudTabSessions)) {
        syncedSessions = syncData.cloudTabSessions;
      }
    } catch (e) {}
  }
  const merged = {
    ...DEFAULT_STATE,
    ...existing,
    cloudTabSessions:
      Array.isArray(existing.cloudTabSessions) && existing.cloudTabSessions.length > 0
        ? existing.cloudTabSessions
        : syncedSessions,
    settings: mergedSettings,
    stats: { ...DEFAULT_STATE.stats, ...(existing.stats || {}) }
  };
  verifiedSession.internalWriteInProgress = true;
  try {
    await chrome.storage.local.set(merged);
  } finally {
    verifiedSession.internalWriteInProgress = false;
  }
  await hydrateTabActivityMap();
  const authSession = await enforceStoredSubscriptionIntegrity();
  if (!authSession || !authSession.proActive) {
    const autoRes = await attemptChromeProfileAutoActivation({ interactive: false });
    const latestOnInstall = await chrome.storage.local.get(['trialStartedAt', 'subscriptionStatus', 'proActive']);
    if (
      details &&
      details.reason === 'install' &&
      (!autoRes || !autoRes.valid) &&
      !latestOnInstall?.proActive &&
      !latestOnInstall?.trialStartedAt &&
      latestOnInstall?.subscriptionStatus !== 'trial_expired'
    ) {
      await startAutomatic7DayTrial(merged);
    }
  }
  const refreshedState = await chrome.storage.local.get(['stats', 'settings']);
  await updateActionBadge(refreshedState.stats || merged.stats, refreshedState.settings || merged.settings);
  if (
    chrome.declarativeNetRequest &&
    typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function'
  ) {
    const latestSettings = (refreshedState && refreshedState.settings) || merged.settings;
    chrome.declarativeNetRequest
      .setExtensionActionOptions({ displayActionCountAsBadgeText: latestSettings?.silentMode === false })
      .catch(() => {});
  }
  registerContextMenus();
  setTimeout(() => { syncRemoteFilterDelta(); }, 2500);
  try {
    if (chrome.runtime && typeof chrome.runtime.setUninstallURL === 'function') {
      chrome.runtime.setUninstallURL('https://sweeprdeepblock.com/support?feedback=uninstall');
    }
  } catch (e) {}

  const hostPermOk = await checkHostPermissionsAndProtection();
  if (details.reason === 'install') {
    if (chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html'), active: false });
    }
    chrome.alarms.create('activationRescueCheck', { delayInMinutes: 1440 });
  }
  if (details.reason === 'install' || details.reason === 'update') {
    await sendAnonymousTelemetry(
      'extension_installed',
      {
        install_reason: details.reason,
        ...(details.previousVersion ? { previous_version: String(details.previousVersion).slice(0, 32) } : {}),
        host_permissions: hostPermOk ? 'granted' : 'missing'
      },
      'telemetrySent_extension_installed'
    );
  }

  chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  chrome.alarms.create('licenseVerifyCheck', { periodInMinutes: 720 });
  chrome.alarms.create('filterDeltaSync', { periodInMinutes: 720 });
  chrome.alarms.create('weeklyHeartbeat', { periodInMinutes: 10080 });
});

chrome.runtime.onStartup.addListener(async () => {
  await advanceMonotonicClockWatermark();
  registerContextMenus();
  chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  chrome.alarms.create('licenseVerifyCheck', { periodInMinutes: 720 });
  chrome.alarms.create('filterDeltaSync', { periodInMinutes: 720 });
  chrome.alarms.create('weeklyHeartbeat', { periodInMinutes: 10080 });
  await checkHostPermissionsAndProtection();
  await hydrateTabActivityMap();
  const authSession = await enforceStoredSubscriptionIntegrity();
  if (!authSession || !authSession.proActive) {
    await attemptChromeProfileAutoActivation({ interactive: false });
  }
  const st = await chrome.storage.local.get(['settings']);
  if (
    chrome.declarativeNetRequest &&
    typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function'
  ) {
    chrome.declarativeNetRequest
      .setExtensionActionOptions({ displayActionCountAsBadgeText: Boolean(st?.settings && st.settings.silentMode === false) })
      .catch(() => {});
  }
  setTimeout(() => { syncRemoteFilterDelta(); }, 2500);
});

// Dynamic Per-Tab Toolbar Action Badge:
// - Shows "OFF" (slate #64748b) when the active tab's domain is in pausedSites
// - Otherwise stays completely empty in 100% Silent Mode, or shows counter in Visual Mode
async function updateActionBadge(passedStats, passedSettings) {
  try {
    const [stored, tabs] = await Promise.all([
      chrome.storage.local.get(['stats', 'settings', 'pausedSites', 'proActive', 'hostPermissionsGranted', 'activationRescueBadge']),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]);
    const stats = passedStats || (stored && stored.stats) || DEFAULT_STATE.stats;
    const settings = passedSettings || (stored && stored.settings) || DEFAULT_STATE.settings;
    const pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    const activeTab = tabs && tabs[0];

    if (stored && (stored.hostPermissionsGranted === false || stored.activationRescueBadge === true)) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      return;
    }

    if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
      try {
        const host = new URL(activeTab.url).hostname.replace(/^www\./i, '').toLowerCase();
        if (host && pausedSites.includes(host)) {
          chrome.action.setBadgeText({ text: 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
          return;
        }
      } catch (e) {}
    }

    const silentMode = settings.silentMode !== false;
    if (silentMode) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    const totalAlerts = (stats.adsBlocked || 0) + (stats.cookiePromptsDetected || 0);
    chrome.action.setBadgeText({ text: totalAlerts > 0 ? String(totalAlerts) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });
  } catch (e) {}
}

const POPUNDER_TAB_URL_REGEX =
  /(\/zv3\/(b|url|cam)|\/link\/out\/|\/getape\/|\/prepop\.php|\/getadb\/|\/venor\.php|\/v1\/link\.php|\/splash\.php\?idzone=|\/api\/click\/|\/click\.go|\/loadeactrl\.go|tsyndicate\.com|contentsserved\.com|exoclick\.com|exosrv\.com|realsrv\.com|magsrv\.com|pemsrv\.com|orbsrv\.com|trafficjunky\.(net|com)|juicyads\.com|jads\.co|clickadu\.com|clickaine\.com|hilltopads\.net|adspyglass\.com|plugrush\.com|adxpansion\.com|crakrevenue\.com|twinrdsyn\.com|twinrdengine\.com|adtng\.com|etahub\.com|bngpt\.com|xlivrdr\.com|popads\.net|popcash\.net|propellerads\.com|u5s5\.com|fh-wgt\.com|cupbearergrowllurch\.com|hollowgoal\.com|fhgte\.com|directsle\.com|qoqh\.com|lxax\.com|koxk\.com|applzr\.com|goadserver\.com|yequka\.my|rvmessage\.online|rvrpushserv\.com|advnet\.xyz|zog\.link|iloptrex\.com|vidvas3\.com|pagerrentablespotlight\.com|holaraphraus\.com|terschomonic\.com|enomotia\.com|janitorprecisiontrio\.com|earthspetti\.com|displayvertising\.com|jusgrmawfbaqu\.com|bspyoibtwrrc\.com|cemhlobja\.com|d3mzokty951c5w\.cloudfront\.net|ey43\.com|adsco\.re)/i;

const STRICT_POPUNDER_OPENER_HOSTS = new Set(['vidara.to', 'vidara.so', 'as9u7bgh9.com']);

const newlySpawnedChildTabs = new Map();
let lastActiveHttpTabId = null;

function normalizeHost(rawUrl) {
  try {
    return new URL(String(rawUrl || '')).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

async function checkAndClosePopunderTab(tabId, candidateUrl, openerTabId) {
  if (!tabId || !candidateUrl || /^(chrome(-extension)?|edge|about|moz-extension):\/\//i.test(candidateUrl)) return false;
  try {
    const auth = await ensureVerifiedProSession();
    if (!auth.proActive || !auth.licenseKey) return false;
    const store = await chrome.storage.local.get(['settings', 'pausedSites']);
    const settings = store.settings || DEFAULT_STATE.settings;
    if (settings.adBlocking === false) return false;
    const pausedSites = Array.isArray(store.pausedSites) ? store.pausedSites : [];

    let openerHost = '';
    const effectiveOpenerId = openerTabId || (lastActiveHttpTabId !== tabId ? lastActiveHttpTabId : null);
    if (effectiveOpenerId) {
      try {
        const openerTab = await chrome.tabs.get(effectiveOpenerId);
        openerHost = normalizeHost(openerTab && openerTab.url);
      } catch (e) {}
    }
    if (openerHost && pausedSites.includes(openerHost)) return false;

    const childHost = normalizeHost(candidateUrl);
    const isAdUrl = POPUNDER_TAB_URL_REGEX.test(candidateUrl);
    const isCrossOriginFromStrictTube =
      Boolean(openerHost && STRICT_POPUNDER_OPENER_HOSTS.has(openerHost)) &&
      Boolean(childHost && childHost !== openerHost && !childHost.endsWith('.' + openerHost));

    if (isAdUrl || isCrossOriginFromStrictTube) {
      newlySpawnedChildTabs.delete(tabId);
      await chrome.tabs.remove(tabId);
      if (effectiveOpenerId) {
        try {
          await chrome.tabs.update(effectiveOpenerId, { active: true });
        } catch (e) {}
      }
      queueDiagnosticStatIncrement('adsBlocked', 1);
      return true;
    }
  } catch (e) {}
  return false;
}

// Refresh toolbar badge whenever user switches tabs or navigates, and kill popunder ad tabs
if (chrome.tabs) {
  if (chrome.tabs.onCreated) {
    chrome.tabs.onCreated.addListener((tab) => {
      if (!tab || !tab.id) return;
      const initialUrl = tab.pendingUrl || tab.url || '';
      if (/^(chrome|edge|about):\/\/newtab/i.test(initialUrl) || initialUrl === 'about:newtab') return;
      const effectiveOpenerId = tab.openerTabId || (lastActiveHttpTabId !== tab.id ? lastActiveHttpTabId : undefined);
      if (!effectiveOpenerId && !POPUNDER_TAB_URL_REGEX.test(initialUrl)) return;
      newlySpawnedChildTabs.set(tab.id, {
        openerTabId: effectiveOpenerId,
        createdAt: Date.now()
      });
      if (initialUrl && initialUrl !== 'about:blank') {
        checkAndClosePopunderTab(tab.id, initialUrl, effectiveOpenerId);
      }
    });
  }
  if (chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (activeInfo && activeInfo.tabId) {
        recordTabActivity(activeInfo.tabId, Date.now());
        if (!newlySpawnedChildTabs.has(activeInfo.tabId)) {
          chrome.tabs.get(activeInfo.tabId, (t) => {
            if (!chrome.runtime.lastError && t && /^https?:\/\//i.test(t.url || '')) {
              lastActiveHttpTabId = t.id;
            }
          });
        }
      }
      updateActionBadge();
    });
  }
  if (chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const childMeta = newlySpawnedChildTabs.get(tabId);
      if (childMeta) {
        if (Date.now() - childMeta.createdAt > 4000) {
          newlySpawnedChildTabs.delete(tabId);
        } else {
          const nextUrl = changeInfo.url || (tab && (tab.pendingUrl || tab.url)) || '';
          if (nextUrl && nextUrl !== 'about:blank') {
            checkAndClosePopunderTab(tabId, nextUrl, childMeta.openerTabId);
          }
          if (changeInfo.status === 'complete' && nextUrl && nextUrl !== 'about:blank') {
            newlySpawnedChildTabs.delete(tabId);
          }
        }
      } else if (tab && tab.active && /^https?:\/\//i.test(tab.url || '')) {
        lastActiveHttpTabId = tabId;
      }
      if (tab && tab.active) {
        recordTabActivity(tabId, Date.now());
      }
      if (changeInfo.status === 'complete' || changeInfo.url) {
        updateActionBadge();
      }
    });
  }
  if (chrome.tabs.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      newlySpawnedChildTabs.delete(tabId);
      removeTabActivity(tabId);
    });
  }
}

// Helper to toggle site pause by hostname
async function toggleSitePauseByHostname(rawHostname) {
  const host = String(rawHostname || '').replace(/^www\./i, '').trim().toLowerCase();
  if (!host) return { ok: false };
  const [auth, res] = await Promise.all([
    ensureVerifiedProSession(),
    chrome.storage.local.get(['pausedSites'])
  ]);
  if (!auth.proActive || !auth.licenseKey) {
    return {
      ok: false,
      requiresPro: true,
      error: 'Active paid Pro subscription required to enable website protection.'
    };
  }
  const current = Array.isArray(res.pausedSites) ? res.pausedSites : [];
  const isPaused = current.includes(host);
  const updated = isPaused ? current.filter((h) => h !== host) : [...current, host];
  await chrome.storage.local.set({ pausedSites: updated });
  await syncPausedSiteDnrAllowlist(updated);
  await updateActionBadge();
  return { ok: true, pausedSites: updated, paused: !isPaused, hostname: host };
}

// Right-Click Context Menu Handler
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'sweepr-zap-element' && tab && tab.id) {
      const auth = await ensureVerifiedProSession();
      if (!auth.proActive || !auth.licenseKey) return;
      chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_ZAPPER' });
    } else if (info.menuItemId === 'sweepr-toggle-site' && tab && tab.url && /^https?:\/\//i.test(tab.url)) {
      try {
        const hostname = new URL(tab.url).hostname;
        const res = await toggleSitePauseByHostname(hostname);
        if (res.ok && tab.id) {
          chrome.tabs.reload(tab.id);
        }
      } catch (e) {}
    } else if (info.menuItemId === 'sweepr-snooze-tabs') {
      await hibernateInactiveTabs();
    }
  });
}

// Keyboard-First Shortcuts (Alt+Shift+S / Alt+Shift+Z)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-site-protection') {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
        try {
          const hostname = new URL(activeTab.url).hostname;
          const res = await toggleSitePauseByHostname(hostname);
          if (res.ok && activeTab.id) {
            chrome.tabs.reload(activeTab.id);
          }
        } catch (e) {}
      }
    } else if (command === 'snooze-inactive-tabs') {
      await hibernateInactiveTabs();
    }
  });
}

// Compute real tab & hibernation state (zero synthetic GB/percentage estimates)
async function getRamSpeedometerMetrics() {
  const tabs = await chrome.tabs.query({});
  const activeTabs = tabs.filter((t) => !t.discarded);
  const discardedCount = tabs.filter((t) => t.discarded).length;

  return {
    totalTabs: tabs.length,
    activeTabsCount: activeTabs.length,
    discardedCount,
    tabsDiscardSupported
  };
}

function syncSessionsToChromeSync(sessions, enabled) {
  if (!chrome.storage || !chrome.storage.sync) return;
  try {
    if (!enabled) {
      chrome.storage.sync.remove(['cloudTabSessions']).catch(() => {});
      return;
    }
    if (!Array.isArray(sessions) || sessions.length === 0) return;
    const compactSyncSessions = sessions.slice(0, 2).map((s) => ({
      id: s.id,
      savedAt: s.savedAt,
      tabCount: s.tabCount,
      tabs: (s.tabs || []).slice(0, 15).map((t) => ({
        title: String(t.title || '').slice(0, 60),
        url: sanitizeTabUrlForBackup(t.url || '').slice(0, 200)
      }))
    }));
    chrome.storage.sync.set({ cloudTabSessions: compactSyncSessions }).catch(() => {});
  } catch (e) {}
}

// Hibernate inactive background tabs & snapshot session
async function hibernateInactiveTabs(options = {}) {
  const isAutoBackground = Boolean(options && options.isAutoBackground);
  const verified = await ensureVerifiedProSession();
  if (!verified.proActive || !verified.licenseKey) {
    return { ok: false, requiresPro: true, error: 'Active paid Pro subscription required.' };
  }
  if (!tabsDiscardSupported) {
    return {
      ok: false,
      unsupported: true,
      error: 'Tab hibernation is not supported on this mobile browser.'
    };
  }
  await hydrateTabActivityMap();
  const data = await chrome.storage.local.get(['stats', 'cloudTabSessions', 'neverSnoozeSites', 'settings']);

  const stats = data.stats || DEFAULT_STATE.stats;
  const neverSnoozeSites = Array.isArray(data.neverSnoozeSites) ? data.neverSnoozeSites : [];
  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  let newlyDiscarded = 0;
  for (const tab of tabs) {
    if (tab.active && tab.id) {
      recordTabActivity(tab.id, now);
      continue;
    }
    if (!tab.active && !tab.pinned && !tab.audible && !tab.discarded && tab.id) {
      let tabHost = '';
      try {
        if (tab.url && /^https?:\/\//i.test(tab.url)) {
          tabHost = new URL(tab.url).hostname.replace(/^www\./i, '').toLowerCase();
        }
      } catch (e) {}
      if (tabHost && neverSnoozeSites.includes(tabHost)) {
        continue;
      }
      if (isAutoBackground) {
        const lastActive = tabLastActiveAt.get(tab.id);
        if (!lastActive) {
          recordTabActivity(tab.id, now);
          continue;
        }
        if (now - lastActive < AUTO_RAM_IDLE_MS) {
          continue;
        }
      }
      try {
        await chrome.tabs.discard(tab.id);
        newlyDiscarded++;
      } catch (e) {}
    }
  }

  let sessions = Array.isArray(data.cloudTabSessions) ? data.cloudTabSessions : [];
  if (!isAutoBackground || newlyDiscarded > 0) {
    const sanitizedTabs = tabs
      .filter((t) => t.url && /^https?:\/\//i.test(t.url))
      .slice(0, 30)
      .map((t) => ({
        title: String(t.title || 'Saved Page').slice(0, 120),
        url: sanitizeTabUrlForBackup(t.url || '')
      }));
    const newSignature = sanitizedTabs.map((t) => t.url).join('|');
    const prevSignature =
      sessions[0] && Array.isArray(sessions[0].tabs)
        ? sessions[0].tabs.map((t) => t.url).join('|')
        : '';

    const snapshot = {
      id: prevSignature && prevSignature === newSignature ? sessions[0].id : 'session-' + now,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tabCount: tabs.length,
      tabs: sanitizedTabs
    };
    if (prevSignature && prevSignature === newSignature) {
      sessions = [snapshot, ...sessions.slice(1)].slice(0, 5);
    } else {
      sessions = [snapshot, ...sessions].slice(0, 5);
    }
  }

  stats.tabsHibernated = (stats.tabsHibernated || 0) + newlyDiscarded;

  const updatedSettings = { ...DEFAULT_STATE.settings, ...(data.settings || {}) };
  if (!isAutoBackground) {
    updatedSettings.autoRamTamer = true;
    chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  }

  await chrome.storage.local.set({ stats, cloudTabSessions: sessions, settings: updatedSettings });
  syncSessionsToChromeSync(sessions, updatedSettings.cloudTabSyncEnabled === true);
  return { ok: true, newlyDiscarded, stats, sessions, settings: updatedSettings };
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name && alarm.name.startsWith('resumeSite:')) {
    const hostToResume = alarm.name.slice('resumeSite:'.length).trim().toLowerCase();
    if (hostToResume) {
      const res = await chrome.storage.local.get(['pausedSites']);
      const current = Array.isArray(res.pausedSites) ? res.pausedSites : [];
      const updated = current.filter((h) => h !== hostToResume);
      await chrome.storage.local.set({ pausedSites: updated });
      await syncPausedSiteDnrAllowlist(updated);
      await updateActionBadge();
    }
    return;
  }
  if (alarm.name === 'trialExpiryCheck') {
    await advanceMonotonicClockWatermark();
    await enforceStoredSubscriptionIntegrity({ force: true });
    return;
  }
  if (alarm.name === 'licenseVerifyCheck') {
    await advanceMonotonicClockWatermark();
    await enforceStoredSubscriptionIntegrity({ force: true });
    return;
  }
  if (alarm.name === 'filterDeltaSync') {
    await syncRemoteFilterDelta();
    return;
  }
  if (alarm.name === 'weeklyHeartbeat') {
    const store = await chrome.storage.local.get(['proActive', 'hostPermissionsGranted']);
    await sendAnonymousTelemetry('heartbeat', {
      tier: store && store.proActive ? 'pro' : 'free',
      host_permissions: store && store.hostPermissionsGranted === false ? 'missing' : 'granted'
    });
    return;
  }
  if (alarm.name === 'activationRescueCheck') {
    const hostOk = await checkHostPermissionsAndProtection();
    const store = await chrome.storage.local.get(['stats']);
    const st = (store && store.stats) || DEFAULT_STATE.stats;
    const totalBlocks = (st.adsBlocked || 0) + (st.cookiePromptsDetected || 0);
    if (!hostOk || totalBlocks === 0) {
      await chrome.storage.local.set({ activationRescueBadge: true });
      await updateActionBadge();
    }
    return;
  }
  if (alarm.name === 'ramTamerCheck') {
    const auth = await ensureVerifiedProSession();
    if (!auth.proActive || !auth.licenseKey) return;
    const { settings, remoteFeatureFlags } = await chrome.storage.local.get([
      'settings',
      'remoteFeatureFlags'
    ]);
    const autoEnabled =
      (!settings || settings.autoRamTamer !== false) &&
      (!remoteFeatureFlags || remoteFeatureFlags.autoRamTamer !== false);
    if (autoEnabled) {
      await hibernateInactiveTabs({ isAutoBackground: true });
    }
  }
});

const pendingStatIncrements = new Map();
let statFlushInFlight = false;
let statFlushCallbacks = [];

function queueDiagnosticStatIncrement(metric, amount, callback) {
  if (metric && Object.hasOwn(DEFAULT_STATE.stats, metric)) {
    const safeAmount = Math.min(20, Math.max(1, Number(amount) || 1));
    pendingStatIncrements.set(metric, (pendingStatIncrements.get(metric) || 0) + safeAmount);
  }
  if (typeof callback === 'function') {
    statFlushCallbacks.push(callback);
  }
  if (statFlushInFlight) return;
  statFlushInFlight = true;
  setTimeout(async () => {
    const batch = new Map(pendingStatIncrements);
    const callbacks = statFlushCallbacks.splice(0, statFlushCallbacks.length);
    pendingStatIncrements.clear();
    try {
      const res = await chrome.storage.local.get(['stats', 'settings']);
      const stats = { ...DEFAULT_STATE.stats, ...(res.stats || {}) };
      for (const [k, delta] of batch.entries()) {
        if (typeof stats[k] === 'number') {
          stats[k] += delta;
        }
      }
      await chrome.storage.local.set({ stats, activationRescueBadge: false });
      await updateActionBadge(stats, res.settings);
      const totalBlocks =
        (stats.adsBlocked || 0) +
        (stats.cookiePromptsDetected || 0);
      if (totalBlocks >= 1) {
        sendAnonymousTelemetry('first_value_seen', { total_blocks: totalBlocks }, 'telemetrySent_first_value_seen').catch(() => {});
      }
      for (const m of [100, 500, 1000, 10000]) {
        if (totalBlocks >= m) {
          sendAnonymousTelemetry('milestone_reached', { milestone: m }, `telemetrySent_milestone_${m}`).catch(() => {});
        }
      }
      for (const cb of callbacks) {
        try {
          cb({ ok: true, stats });
        } catch (e) {}
      }
    } catch (e) {
      for (const cb of callbacks) {
        try {
          cb({ ok: false });
        } catch (err) {}
      }
    } finally {
      statFlushInFlight = false;
      if (pendingStatIncrements.size > 0) {
        queueDiagnosticStatIncrement(null, 0);
      }
    }
  }, 120);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (sender && sender.id && sender.id !== chrome.runtime.id) return false;

  // Allow Zero-Copy Website Auto-Activation Bridge from sweeprdeepblock.com
  if (msg.type === 'AUTO_SYNC_WEBSITE_LICENSE') {
    const senderUrl = String((sender && sender.url) || '');
    const tabUrl = String((sender && sender.tab && sender.tab.url) || '');
    const isFrameZero = !sender || sender.frameId === 0;
    const isOfficialUrl = (u) =>
      /^https:\/\/([a-z0-9-]+\.)?sweeprdeepblock\.com(\/|$)/i.test(u);

    if (!isFrameZero || !isOfficialUrl(senderUrl) || (tabUrl && !isOfficialUrl(tabUrl))) {
      sendResponse({ ok: false, error: 'untrusted_origin' });
      return true;
    }

    const key = String(msg.licenseKey || '').trim();
    if (!isValidLicenseCredential(key) || key.length > 512) {
      sendResponse({ ok: false });
      return true;
    }
    verifyLicenseWithServer(key).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'INCREMENT_DIAGNOSTIC') {
    queueDiagnosticStatIncrement(msg.metric, msg.amount, sendResponse);
    return true;
  }

  // Privileged extension UI actions (popup & options pages)
  const extBaseUrl = chrome.runtime.getURL('');
  const senderUrl = String((sender && sender.url) || '');
  const isPrivilegedExtensionPage = Boolean(extBaseUrl && senderUrl.startsWith(extBaseUrl));
  if (!isPrivilegedExtensionPage) {
    return false;
  }

  if (msg.type === 'GET_DASHBOARD_STATE') {
    (async () => {
      const auth = await ensureVerifiedProSession();
      const [store, ramMetrics] = await Promise.all([
        chrome.storage.local.get([
          ...Object.keys(DEFAULT_STATE),
          'extensionUpdateStatus',
          'chromeAutoActivateResult',
          'hostPermissionsGranted',
          'stepUpSaveEligible',
          'previousLicenseKey',
          'churnedAt',
          'abVariantOverride',
          'deviceId'
        ]),
        getRamSpeedometerMetrics(),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);
      const deviceId = store.deviceId || (await getOrCreateDeviceId());
      const mergedStats = { ...DEFAULT_STATE.stats, ...(store.stats || {}) };
      const adStatCount = auth.proActive
        ? Number(mergedStats.adsBlocked) || 0
        : Number(mergedStats.adsSpotted) || Number(mergedStats.adsBlocked) || 0;
      const totalThreats =
        adStatCount + (Number(mergedStats.cookiePromptsDetected) || 0);
      const milestoneState = {
        totalThreats,
        reached100: totalThreats >= 100,
        reached500: totalThreats >= 500,
        reached1000: totalThreats >= 1000
      };
      const stepUpSaveEligible = Boolean(store.stepUpSaveEligible);
      const winbackEligible = Boolean(
        !auth.proActive &&
          store.previousLicenseKey &&
          ['canceled', 'expired', 'inactive', 'unverified'].includes(String(store.subscriptionStatus || ''))
      );
      const daysSinceChurn = Math.max(0, Math.floor((Date.now() - Number(store.churnedAt || Date.now())) / 86400000));
      const winbackTier =
        daysSinceChurn >= 90 ? 'tier_d90' : daysSinceChurn >= 60 ? 'tier_d60' : 'tier_d30';
      const charSum = String(deviceId)
        .split('')
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const abVariant =
        store.abVariantOverride ||
        store.abVariantServer ||
        (charSum % 2 === 0 ? 'variant_a_breadth' : 'variant_b_risk_free_14d');
      if (!store.abVariantFetchedAt || Date.now() - Number(store.abVariantFetchedAt) > 6 * 3600 * 1000) {
        fetch('https://sweeprdeepblock.com/api/ab/paywall?vid=' + encodeURIComponent(deviceId))
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data && data.variant) {
              chrome.storage.local.set({ abVariantServer: data.variant, abVariantFetchedAt: Date.now() });
            }
          })
          .catch(() => {});
      }

      const trialExpMs = parseTrialExpiryMs(store);
      const remainingMs = trialExpMs > Date.now() ? trialExpMs - Date.now() : 0;
      const trialDaysRemaining = Math.floor(remainingMs / 86400000);
      const trialHoursRemaining = Math.floor((remainingMs % 86400000) / 3600000);

      sendResponse({
        ...DEFAULT_STATE,
        ...store,
        proActive: Boolean(auth.proActive),
        ramTamerActive: Boolean(auth.proActive),
        licenseKey: auth.licenseKey || '',
        subscriptionStatus: auth.proActive
          ? store.subscriptionStatus || auth.subscriptionStatus || 'active'
          : store.subscriptionStatus || 'unactivated',
        plan: store.plan || '',
        licenseExpiresAt: store.licenseExpiresAt || '',
        trialStartedAt: Number(store.trialStartedAt || 0),
        trialExpiresAt: Number(store.trialExpiresAt || 0),
        trialSyncedWithServer: Boolean(store.trialSyncedWithServer),
        trialDaysRemaining,
        trialHoursRemaining,
        bonusProDaysEarned: Number(store.bonusProDaysEarned || 0),
        settings: { ...DEFAULT_STATE.settings, ...(store.settings || {}) },
        stats: mergedStats,
        milestoneState,
        stepUpSaveEligible,
        winbackEligible,
        winbackTier,
        daysSinceChurn,
        abVariant,
        ramMetrics,
        hostPermissionsGranted: store.hostPermissionsGranted !== false,
        extensionUpdateStatus: store.extensionUpdateStatus || null
      });
    })();
    return true;
  }

  if (msg.type === 'HIBERNATE_TABS_NOW') {
    ensureVerifiedProSession().then(async (auth) => {
      if (!auth.proActive || !auth.licenseKey) {
        sendResponse({
          ok: false,
          requiresPro: true,
          error: 'Active paid Pro subscription required for Browser Speed & Tab Hibernation.'
        });
        return;
      }
      const result = await hibernateInactiveTabs();
      const ramMetrics = await getRamSpeedometerMetrics();
      sendResponse({ ...result, ramMetrics });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_SITE_PAUSE') {
    toggleSitePauseByHostname(msg.hostname).then(async (res) => {
      if (res && res.ok && msg.reloadTabId) {
        try {
          await chrome.tabs.reload(msg.reloadTabId);
        } catch (e) {}
      }
      sendResponse(res);
    });
    return true;
  }

  if (msg.type === 'PAUSE_SITE_5_MIN') {
    const host = String(msg.hostname || '').replace(/^www\./i, '').trim().toLowerCase();
    Promise.all([ensureVerifiedProSession(), chrome.storage.local.get(['pausedSites'])]).then(async ([auth, res]) => {
      if (!auth.proActive || !auth.licenseKey) {
        sendResponse({
          ok: false,
          requiresPro: true,
          error: 'Active paid Pro subscription required.'
        });
        return;
      }
      if (!host) {
        sendResponse({ ok: false });
        return;
      }
      const current = Array.isArray(res.pausedSites) ? res.pausedSites : [];
      const updated = current.includes(host) ? current : [...current, host];
      await chrome.storage.local.set({ pausedSites: updated });
      await syncPausedSiteDnrAllowlist(updated);
      chrome.alarms.create(`resumeSite:${host}`, { delayInMinutes: 5 });
      await updateActionBadge();
      if (msg.reloadTabId) {
        try {
          await chrome.tabs.reload(msg.reloadTabId);
        } catch (e) {}
      }
      sendResponse({ ok: true, pausedSites: updated, paused: true, hostname: host, resumesInMinutes: 5 });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_NEVER_SNOOZE_SITE') {
    const host = String(msg.hostname || '').replace(/^www\./i, '').trim().toLowerCase();
    Promise.all([ensureVerifiedProSession(), chrome.storage.local.get(['neverSnoozeSites'])]).then(
      async ([auth, res]) => {
        if (!auth.proActive || !auth.licenseKey) {
          sendResponse({
            ok: false,
            requiresPro: true,
            error: 'Active paid Pro subscription required.'
          });
          return;
        }
        if (!host) {
          sendResponse({ ok: false });
          return;
        }
        const current = Array.isArray(res?.neverSnoozeSites) ? res.neverSnoozeSites : [];
        const keptAwake = !current.includes(host);
        const updated = keptAwake ? [...current, host] : current.filter((h) => h !== host);
        await chrome.storage.local.set({ neverSnoozeSites: updated });
        sendResponse({ ok: true, neverSnoozeSites: updated, keptAwake, hostname: host });
      }
    );
    return true;
  }

  if (msg.type === 'TOGGLE_SETTING') {
    const key = String(msg.settingKey || '').trim();
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype' || !Object.hasOwn(DEFAULT_STATE.settings, key)) {
      sendResponse({ ok: false });
      return true;
    }
    Promise.all([ensureVerifiedProSession(), chrome.storage.local.get(['settings', 'stats', 'cloudTabSessions'])]).then(async ([auth, res]) => {
      const hasPaidPro = Boolean(auth.proActive && auth.licenseKey);
      if (PRO_ONLY_SETTINGS.has(key) && !hasPaidPro) {
        sendResponse({
          ok: false,
          requiresPro: true,
          error: 'Active paid Pro subscription required to toggle this feature.'
        });
        return;
      }
      const current = { ...DEFAULT_STATE.settings, ...(res.settings || {}) };
      current[key] = !current[key];
      await chrome.storage.local.set({ settings: current });
      if (key === 'adBlocking' || key === 'trackerProtection') {
        await syncExtensionProtectionRules(Boolean(current.adBlocking), Boolean(current.trackerProtection));
        if (key === 'adBlocking' && current.adBlocking) {
          syncRemoteFilterDelta().catch(() => {});
        }
      }
      if (key === 'silentMode') {
        await updateActionBadge(res.stats || DEFAULT_STATE.stats, current);
        if (
          chrome.declarativeNetRequest &&
          typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function'
        ) {
          chrome.declarativeNetRequest
            .setExtensionActionOptions({ displayActionCountAsBadgeText: !current.silentMode })
            .catch(() => {});
        }
      }
      if (key === 'cloudTabSyncEnabled') {
        syncSessionsToChromeSync(res.cloudTabSessions || [], Boolean(current.cloudTabSyncEnabled));
      }
      if (key === 'autoRamTamer') {
        if (tabsDiscardSupported && current.autoRamTamer) {
          chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
        } else {
          chrome.alarms.clear('ramTamerCheck').catch(() => {});
        }
      }
      sendResponse({ ok: true, settings: current });
    });
    return true;
  }

  if (msg.type === 'RESTORE_SAVED_SESSION') {
    const sessionId = String(msg.sessionId || '');
    Promise.all([ensureVerifiedProSession(), chrome.storage.local.get(['cloudTabSessions'])]).then(async ([auth, res]) => {
      if (!auth.proActive || !auth.licenseKey) {
        sendResponse({ ok: false, requiresPro: true, error: 'Active paid Pro subscription required.' });
        return;
      }
      const sessions = Array.isArray(res.cloudTabSessions) ? res.cloudTabSessions : [];
      const found = sessions.find((s) => s.id === sessionId) || sessions[0];
      let restoredCount = 0;
      if (found && Array.isArray(found.tabs)) {
        for (const t of found.tabs.slice(0, 15)) {
          if (t.url && /^https?:\/\//i.test(t.url)) {
            try {
              await chrome.tabs.create({ url: t.url, active: false });
              restoredCount++;
            } catch (e) {}
          }
        }
      }
      sendResponse({ ok: true, restoredCount });
    });
    return true;
  }

  if (msg.type === 'SEND_TELEMETRY_EVENT') {
    const evName = String(msg.eventName || '').trim();
    const props = msg.properties && typeof msg.properties === 'object' ? msg.properties : {};
    const onceKey = msg.onceKey ? String(msg.onceKey) : null;
    sendAnonymousTelemetry(evName, props, onceKey).then((res) => sendResponse(res));
    return true;
  }

  if (msg.type === 'CHECK_HOST_PERMISSIONS') {
    checkHostPermissionsAndProtection().then(async (granted) => {
      if (granted) {
        await chrome.storage.local.set({ activationRescueBadge: false });
        const auth = await ensureVerifiedProSession();
        if (auth.proActive) {
          const st = await chrome.storage.local.get(['settings']);
          const s = (st && st.settings) || DEFAULT_STATE.settings;
          await syncExtensionProtectionRules(s.adBlocking !== false, s.trackerProtection !== false);
        }
        await updateActionBadge();
      }
      sendResponse({ ok: true, hostPermissionsGranted: granted });
    });
    return true;
  }

  if (msg.type === 'CHROME_GOOGLE_AUTO_ACTIVATE') {
    attemptChromeProfileAutoActivation({ interactive: msg.interactive !== false }).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'ACTIVATE_LICENSE' || msg.type === 'VERIFY_LICENSE') {
    const key = String(msg.licenseKey || msg.key || '').trim();
    if (!key) {
      sendResponse({ ok: false, valid: false, error: 'Please enter a valid license key.' });
      return true;
    }
    const runner = PAIRING_TOKEN_RE.test(key) ? redeemPairingToken(key) : verifyLicenseWithServer(key);
    runner.then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'REDEEM_REFERRAL_CODE') {
    const code = String(msg.code || msg.ref || '').trim();
    if (!code) {
      sendResponse({ ok: false, valid: false, error: 'Please enter a referral code.' });
      return true;
    }
    (async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        const stored = await chrome.storage.local.get(['licenseKey']);
        const res = await fetch('https://sweeprdeepblock.com/api/referral/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            code,
            deviceId,
            licenseKey: (stored && stored.licenseKey) || ''
          }),
          signal: AbortSignal.timeout(10000)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok && data.trialKey) {
          const verifyRes = await verifyLicenseWithServer(data.trialKey);
          return {
            ...verifyRes,
            trialKey: data.trialKey,
            trialExpiresAt: data.trialExpiresAt || ''
          };
        }
        return {
          ok: false,
          valid: false,
          error: (data && (data.message || data.error)) || 'Could not redeem referral code.'
        };
      } catch (e) {
        return {
          ok: false,
          valid: false,
          networkError: true,
          error: 'Could not reach server to redeem referral code.'
        };
      }
    })().then((result) => {
      sendResponse(result);
    });
    return true;
  }
});
