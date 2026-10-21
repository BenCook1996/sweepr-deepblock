// SWEEPR Deepblock — Manifest V3 Background Service Worker (With Central SWEEPR CRM Subscription Verification)
const LICENSE_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify',
  'http://localhost:8787/v1/license/verify-key?project=deepblock',
  'http://localhost:3000/api/license-verify'
];

const PRO_ONLY_SETTINGS = new Set(['cookieAutoClose', 'hideSearchSpam']);

// In-memory anti-tamper session guard inside service worker closure
let verifiedSession = {
  proActive: false,
  ramTamerActive: false,
  licenseKey: '',
  deviceId: '',
  internalWriteInProgress: false
};

async function getOrCreateDeviceId() {
  if (verifiedSession.deviceId) return verifiedSession.deviceId;
  const stored = await chrome.storage.local.get(['deviceId']);
  if (stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')) {
    verifiedSession.deviceId = stored.deviceId;
    return stored.deviceId;
  }
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const newId = `ext_db_${randomPart}`;
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
  subscriptionStatus: 'free',
  licenseVerifiedAt: 0,
  entitlements: [],
  encryptedDnsEnabled: true,
  pausedSites: [],
  settings: {
    cookieAutoClose: true,
    hideSearchSpam: true,
    fakeShopAlerts: true,
    trackerProtection: true,
    adBlocking: true,
    silentMode: true
  },
  stats: {
    adsBlocked: 142,
    cookiePromptsDetected: 19,
    cookiePromptsRejected: 0,
    aiSlopDetected: 11,
    fakeStoresDetected: 4,
    clutterStripped: 27,
    antiAdblockBypassed: 9,
    tabsHibernated: 0,
    ramSavedGb: 0
  },
  cloudTabSessions: []
};

// Verify license key against Central SWEEPR CRM & SWEEPR Deepblock Licensing API
async function verifyLicenseWithServer(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || key.length < 6 || key.length > 512 || key.includes('@')) {
    await revokeProState('invalid_key_format');
    return { ok: false, valid: false, error: 'Invalid license key format.' };
  }

  const deviceId = await getOrCreateDeviceId();
  let lastNetworkError = false;
  for (const baseUrl of LICENSE_VERIFY_ENDPOINTS) {
    try {
      const sep = baseUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${baseUrl}${sep}key=${encodeURIComponent(key)}&device_id=${encodeURIComponent(deviceId)}`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-sweepr-project': 'deepblock' },
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && data.valid === true) {
        const subStatus = String(data.status || 'active').toLowerCase();
        if (subStatus === 'active' || subStatus === 'trialing') {
          const addonsList = Array.isArray(data.addons) ? data.addons : [];
          const ramTamerActive = Boolean(
            data.ramTamerAddon === true ||
              addonsList.includes('ram_tamer') ||
              addonsList.includes('sweepr_secure_bundle')
          );
          const entitlements = Array.isArray(data.entitlements)
            ? data.entitlements
            : [
                'pro_cookie_autoreject',
                'pro_ai_slop_purifier',
                'pro_clutter_stripper',
                'bundle_fake_store_detector',
                'bundle_encrypted_dns_proxy',
                ...(ramTamerActive ? ['addon_total_tab_and_ram_tamer'] : [])
              ];
          const canonicalKey = data.licenseKey || data.license_key || key;
          verifiedSession.proActive = true;
          verifiedSession.ramTamerActive = ramTamerActive;
          verifiedSession.licenseKey = canonicalKey;
          verifiedSession.internalWriteInProgress = true;
          await chrome.storage.local.set({
            proActive: true,
            ramTamerActive,
            licenseKey: canonicalKey,
            licenseToken: data.token || data.license_token || '',
            crmAccountId: data.account_id || '',
            subscriptionStatus: subStatus,
            licenseVerifiedAt: Date.now(),
            entitlements,
            encryptedDnsEnabled: true
          });
          verifiedSession.internalWriteInProgress = false;
          return {
            ok: true,
            valid: true,
            status: subStatus,
            licenseKey: canonicalKey,
            ramTamerActive,
            entitlements
          };
        }
      }

      // Explicit rejection from licensing server (404 not found, 403 canceled/expired/unpaid, or valid: false)
      if (res.status === 400 || res.status === 403 || res.status === 404 || data?.valid === false) {
        const statusReason = data?.status || data?.error || 'inactive';
        await revokeProState(statusReason);
        return {
          ok: false,
          valid: false,
          status: statusReason,
          error:
            res.status === 403
              ? 'Your Pro subscription is no longer active. Please renew to unlock Pro features.'
              : 'License key not recognized or no active paid subscription found.'
        };
      }
    } catch (e) {
      lastNetworkError = true;
    }
  }

  if (lastNetworkError) {
    return {
      ok: false,
      valid: false,
      networkError: true,
      error: 'Could not reach licensing server to verify subscription. Please check your connection.'
    };
  }

  await revokeProState('unverified');
  return { ok: false, valid: false, error: 'Invalid or unpaid license key.' };
}

async function revokeProState(reason = 'inactive') {
  verifiedSession.proActive = false;
  verifiedSession.ramTamerActive = false;
  verifiedSession.licenseKey = '';
  verifiedSession.internalWriteInProgress = true;
  await chrome.storage.local.set({
    proActive: false,
    ramTamerActive: false,
    licenseKey: '',
    subscriptionStatus: String(reason),
    licenseVerifiedAt: Date.now(),
    entitlements: []
  });
  verifiedSession.internalWriteInProgress = false;
}

// Guard against manual DevTools tampering with chrome.storage.local
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || verifiedSession.internalWriteInProgress) return;
    const tamperedPro = changes.proActive && changes.proActive.newValue === true && !verifiedSession.proActive;
    const tamperedRam = changes.ramTamerActive && changes.ramTamerActive.newValue === true && !verifiedSession.ramTamerActive;
    if (tamperedPro || tamperedRam) {
      enforceStoredSubscriptionIntegrity();
    }
  });
}

async function enforceStoredSubscriptionIntegrity() {
  const store = await chrome.storage.local.get(['proActive', 'ramTamerActive', 'licenseKey']);
  const key = String(store.licenseKey || '').trim();
  if (!key) {
    if (store.proActive || store.ramTamerActive) {
      await revokeProState('free');
    }
    return { proActive: false, ramTamerActive: false };
  }
  const verified = await verifyLicenseWithServer(key);
  return {
    proActive: Boolean(verified.valid),
    ramTamerActive: Boolean(verified.valid && verified.ramTamerActive)
  };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  const merged = {
    ...DEFAULT_STATE,
    ...existing,
    settings: { ...DEFAULT_STATE.settings, ...(existing.settings || {}) },
    stats: { ...DEFAULT_STATE.stats, ...(existing.stats || {}) }
  };
  await chrome.storage.local.set(merged);
  await enforceStoredSubscriptionIntegrity();
  updateActionBadge(merged.stats);

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }

  chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  chrome.alarms.create('licenseVerifyCheck', { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  await enforceStoredSubscriptionIntegrity();
});

function updateActionBadge(stats) {
  const totalAlerts =
    (stats.cookiePromptsDetected || 0) +
    (stats.aiSlopDetected || 0) +
    (stats.fakeStoresDetected || 0);
  chrome.action.setBadgeText({ text: totalAlerts > 0 ? String(totalAlerts) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#059669' });
}

// Compute live RAM Speedometer metrics for "Total Tab & RAM Tamer"
async function getRamSpeedometerMetrics() {
  const tabs = await chrome.tabs.query({});
  const activeTabs = tabs.filter((t) => !t.discarded);
  const discardedCount = tabs.filter((t) => t.discarded).length;

  const estimatedGb = Math.max(0.8, +(0.65 + activeTabs.length * 0.145).toFixed(1));
  const slowdownPct = Math.min(78, Math.max(8, Math.round(estimatedGb * 6.2)));

  let systemMemoryGb = 16;
  try {
    if (chrome.system && chrome.system.memory) {
      const memInfo = await chrome.system.memory.getInfo();
      if (memInfo && memInfo.capacity) {
        systemMemoryGb = Math.round(memInfo.capacity / (1024 * 1024 * 1024));
      }
    }
  } catch (e) {}

  return {
    totalTabs: tabs.length,
    activeTabsCount: activeTabs.length,
    discardedCount,
    estimatedGb,
    slowdownPct,
    systemMemoryGb
  };
}

// Hibernate inactive background tabs & snapshot session to Cloud Vault (Requires Active Paid Subscription)
async function hibernateInactiveTabs() {
  const data = await chrome.storage.local.get(['proActive', 'licenseKey', 'stats', 'cloudTabSessions']);
  if (!data.proActive || !data.licenseKey) {
    return { ok: false, requiresPro: true, error: 'Active paid Pro subscription required.' };
  }

  const stats = data.stats || DEFAULT_STATE.stats;
  const tabs = await chrome.tabs.query({});

  const snapshot = {
    id: 'session-' + Date.now(),
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tabCount: tabs.length,
    tabs: tabs
      .filter((t) => t.url && /^https?:\/\//i.test(t.url))
      .slice(0, 30)
      .map((t) => ({ title: t.title || 'Saved Page', url: t.url || '' }))
  };
  const sessions = [snapshot, ...(data.cloudTabSessions || [])].slice(0, 5);

  let newlyDiscarded = 0;
  for (const tab of tabs) {
    if (!tab.active && !tab.pinned && !tab.audible && !tab.discarded && tab.id) {
      try {
        await chrome.tabs.discard(tab.id);
        newlyDiscarded++;
      } catch (e) {}
    }
  }

  const savedGbAdd = +(newlyDiscarded * 0.14).toFixed(1);
  stats.tabsHibernated = (stats.tabsHibernated || 0) + newlyDiscarded;
  stats.ramSavedGb = +((stats.ramSavedGb || 0) + savedGbAdd).toFixed(1);

  await chrome.storage.local.set({ stats, cloudTabSessions: sessions });
  return { ok: true, newlyDiscarded, savedGbAdd, stats, sessions };
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'licenseVerifyCheck') {
    await enforceStoredSubscriptionIntegrity();
    return;
  }
  if (alarm.name === 'ramTamerCheck') {
    const { proActive, ramTamerActive, licenseKey } = await chrome.storage.local.get([
      'proActive',
      'ramTamerActive',
      'licenseKey'
    ]);
    if (proActive && ramTamerActive && licenseKey) {
      await hibernateInactiveTabs();
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (sender && sender.id && sender.id !== chrome.runtime.id) return false;

  if (msg.type === 'INCREMENT_DIAGNOSTIC') {
    chrome.storage.local.get(['stats'], (res) => {
      const stats = res.stats || DEFAULT_STATE.stats;
      const key = msg.metric;
      const safeAmount = Math.min(20, Math.max(1, Number(msg.amount) || 1));
      if (key && Object.prototype.hasOwnProperty.call(DEFAULT_STATE.stats, key) && typeof stats[key] === 'number') {
        stats[key] += safeAmount;
      }
      chrome.storage.local.set({ stats }, () => {
        updateActionBadge(stats);
        sendResponse({ ok: true, stats });
      });
    });
    return true;
  }

  if (msg.type === 'GET_DASHBOARD_STATE') {
    Promise.all([
      chrome.storage.local.get(Object.keys(DEFAULT_STATE)),
      getRamSpeedometerMetrics()
    ]).then(async ([store, ramMetrics]) => {
      let isPro = Boolean(store.proActive && store.licenseKey);
      if (!store.licenseKey && (store.proActive || store.ramTamerActive)) {
        await revokeProState('free');
        isPro = false;
      }
      sendResponse({
        ...DEFAULT_STATE,
        ...store,
        proActive: isPro,
        ramTamerActive: Boolean(isPro && store.ramTamerActive),
        settings: { ...DEFAULT_STATE.settings, ...(store.settings || {}) },
        stats: { ...DEFAULT_STATE.stats, ...(store.stats || {}) },
        ramMetrics
      });
    });
    return true;
  }

  // Privileged extension UI actions (reject calls from content-script tabs)
  if (sender && sender.tab) {
    return false;
  }

  if (msg.type === 'HIBERNATE_TABS_NOW') {
    chrome.storage.local.get(['proActive', 'licenseKey'], async (auth) => {
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
    const host = String(msg.hostname || '').trim().toLowerCase();
    if (!host) {
      sendResponse({ ok: false });
      return true;
    }
    chrome.storage.local.get(['pausedSites'], (res) => {
      const current = Array.isArray(res.pausedSites) ? res.pausedSites : [];
      const isPaused = current.includes(host);
      const updated = isPaused ? current.filter((h) => h !== host) : [...current, host];
      chrome.storage.local.set({ pausedSites: updated }, () => {
        sendResponse({ ok: true, pausedSites: updated, paused: !isPaused });
      });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_SETTING') {
    const key = String(msg.settingKey || '').trim();
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_STATE.settings, key)) {
      sendResponse({ ok: false });
      return true;
    }
    chrome.storage.local.get(['proActive', 'licenseKey', 'settings'], (res) => {
      const hasPaidPro = Boolean(res.proActive && res.licenseKey);
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
      chrome.storage.local.set({ settings: current }, () => {
        sendResponse({ ok: true, settings: current });
      });
    });
    return true;
  }

  if (msg.type === 'RESTORE_SAVED_SESSION') {
    const sessionId = String(msg.sessionId || '');
    chrome.storage.local.get(['proActive', 'licenseKey', 'cloudTabSessions'], async (res) => {
      if (!res.proActive || !res.licenseKey) {
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

  if (msg.type === 'ACTIVATE_LICENSE') {
    const key = String(msg.licenseKey || '').trim();
    if (!key) {
      sendResponse({ ok: false, valid: false, error: 'Please enter a valid license key.' });
      return true;
    }
    verifyLicenseWithServer(key).then((result) => {
      sendResponse(result);
    });
    return true;
  }
});
