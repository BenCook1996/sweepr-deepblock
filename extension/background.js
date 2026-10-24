// SWEEPR Deepblock — Manifest V3 Background Service Worker (v1.2 UX & Architecture Audited)
const isDevExtension = typeof chrome !== 'undefined' && chrome.runtime && !('update_url' in chrome.runtime.getManifest());
const LICENSE_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify',
  ...(isDevExtension
    ? [
        'http://localhost:8787/v1/license/verify-key?project=deepblock',
        'http://localhost:3000/api/license-verify'
      ]
    : [])
];

const PRO_ONLY_SETTINGS = new Set([
  'adBlocking',
  'cookieAutoClose',
  'hideSearchSpam',
  'fakeShopAlerts',
  'trackerProtection',
  'silentMode'
]);

const scamDetectedTabs = new Set();
const scamReasonsByTab = new Map();

async function syncPausedSiteDnrAllowlist(passedPausedSites) {
  try {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
    let pausedSites = passedPausedSites;
    if (!Array.isArray(pausedSites)) {
      const stored = await chrome.storage.local.get(['pausedSites']);
      pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    }
    const cleanDomains = pausedSites
      .map((d) => String(d || '').replace(/^www\./i, '').trim().toLowerCase())
      .filter(Boolean);

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.filter((r) => r.id >= 90000 && r.id < 91000).map((r) => r.id);

    const addRules = [];
    if (cleanDomains.length > 0) {
      addRules.push({
        id: 90001,
        priority: 100000,
        action: { type: 'allow' },
        condition: {
          initiatorDomains: cleanDomains
        }
      });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } catch (e) {}
}

async function syncExtensionProtectionRules(enablePro) {
  try {
    if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateEnabledRulesets) return;
    if (enablePro) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ['ads_and_trackers', 'cryptominers_and_heavy_scripts'],
        disableRulesetIds: []
      });
      await syncPausedSiteDnrAllowlist();
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [],
        disableRulesetIds: ['ads_and_trackers', 'cryptominers_and_heavy_scripts']
      });
    }
  } catch (e) {}
}

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
  encryptedDnsEnabled: false,
  pausedSites: [],
  neverSnoozeSites: [],
  trustedShopSites: [],
  customHiddenSelectors: {},
  settings: {
    cookieAutoClose: false,
    hideSearchSpam: false,
    fakeShopAlerts: false,
    trackerProtection: false,
    adBlocking: false,
    silentMode: false
  },
  stats: {
    adsBlocked: 0,
    cookiePromptsDetected: 0,
    cookiePromptsRejected: 0,
    aiSlopDetected: 0,
    fakeStoresDetected: 0,
    clutterStripped: 0,
    antiAdblockBypassed: 0,
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
            draftLicenseKey: '',
            licenseDrawerOpen: false,
            licenseToken: data.token || data.license_token || '',
            crmAccountId: data.account_id || '',
            subscriptionStatus: subStatus,
            licenseVerifiedAt: Date.now(),
            entitlements,
            encryptedDnsEnabled: true,
            settings: {
              cookieAutoClose: true,
              hideSearchSpam: true,
              fakeShopAlerts: true,
              trackerProtection: true,
              adBlocking: true,
              silentMode: true
            }
          });
          verifiedSession.internalWriteInProgress = false;
          await syncExtensionProtectionRules(true);
          await updateActionBadge();
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
    entitlements: [],
    encryptedDnsEnabled: false,
    settings: {
      cookieAutoClose: false,
      hideSearchSpam: false,
      fakeShopAlerts: false,
      trackerProtection: false,
      adBlocking: false,
      silentMode: false
    }
  });
  verifiedSession.internalWriteInProgress = false;
  await syncExtensionProtectionRules(false);
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
    await revokeProState('free');
    verifiedSession.coldChecked = true;
    return { proActive: false, ramTamerActive: false };
  }
  const verified = await verifyLicenseWithServer(key);
  verifiedSession.coldChecked = true;
  if (verified.networkError) {
    verifiedSession.proActive = Boolean(store.proActive && key);
    verifiedSession.ramTamerActive = Boolean(store.proActive && store.ramTamerActive && key);
    verifiedSession.licenseKey = key;
    await syncExtensionProtectionRules(verifiedSession.proActive);
    return { proActive: verifiedSession.proActive, ramTamerActive: verifiedSession.ramTamerActive };
  }
  return {
    proActive: Boolean(verified.valid),
    ramTamerActive: Boolean(verified.valid && verified.ramTamerActive)
  };
}

async function ensureVerifiedProSession() {
  if (!verifiedSession.coldChecked) {
    await enforceStoredSubscriptionIntegrity();
  }
  return {
    proActive: Boolean(verifiedSession.proActive && verifiedSession.licenseKey),
    ramTamerActive: Boolean(verifiedSession.proActive && verifiedSession.ramTamerActive && verifiedSession.licenseKey),
    licenseKey: verifiedSession.licenseKey
  };
}

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
  const merged = {
    ...DEFAULT_STATE,
    ...existing,
    settings: { ...DEFAULT_STATE.settings, ...(existing.settings || {}) },
    stats: { ...DEFAULT_STATE.stats, ...(existing.stats || {}) }
  };
  await chrome.storage.local.set(merged);
  await enforceStoredSubscriptionIntegrity();
  await updateActionBadge(merged.stats, merged.settings);
  registerContextMenus();

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    try {
      const manifest = chrome.runtime.getManifest ? chrome.runtime.getManifest() : { version: '1.0.0' };
      fetch('https://sweeprdeepblock.com/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_name: 'extension_installed',
          category: 'funnel',
          os: 'extension',
          app_version: manifest.version || '1.0.0'
        })
      }).catch(() => {});
    } catch {}
  }

  chrome.alarms.create('ramTamerCheck', { periodInMinutes: 5 });
  chrome.alarms.create('licenseVerifyCheck', { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  registerContextMenus();
  await enforceStoredSubscriptionIntegrity();
});

// Dynamic Per-Tab Toolbar Action Badge:
// - Shows "OFF" (slate #64748b) when the active tab's domain is in pausedSites
// - Shows "!" (amber #d97706) when the active tab triggered a fake-shop alert
// - Otherwise stays completely empty in 100% Silent Mode, or shows counter in Visual Mode
async function updateActionBadge(passedStats, passedSettings) {
  try {
    const [stored, tabs] = await Promise.all([
      chrome.storage.local.get(['stats', 'settings', 'pausedSites', 'proActive']),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]);
    const stats = passedStats || (stored && stored.stats) || DEFAULT_STATE.stats;
    const settings = passedSettings || (stored && stored.settings) || DEFAULT_STATE.settings;
    const pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    const activeTab = tabs && tabs[0];

    if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
      try {
        const host = new URL(activeTab.url).hostname.replace(/^www\./i, '').toLowerCase();
        if (host && pausedSites.includes(host)) {
          chrome.action.setBadgeText({ text: 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
          return;
        }
        if (activeTab.id && scamDetectedTabs.has(activeTab.id)) {
          chrome.action.setBadgeText({ text: '!' });
          chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
          return;
        }
      } catch (e) {}
    }

    const silentMode = settings.silentMode !== false;
    if (silentMode) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    const totalAlerts =
      (stats.cookiePromptsDetected || 0) +
      (stats.aiSlopDetected || 0) +
      (stats.fakeStoresDetected || 0);
    chrome.action.setBadgeText({ text: totalAlerts > 0 ? String(totalAlerts) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#059669' });
  } catch (e) {}
}

// Refresh toolbar badge whenever user switches tabs or navigates
if (chrome.tabs) {
  if (chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      updateActionBadge();
    });
  }
  if (chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'loading') {
        scamDetectedTabs.delete(tabId);
        scamReasonsByTab.delete(tabId);
      }
      if (changeInfo.status === 'complete' || changeInfo.url) {
        updateActionBadge();
      }
    });
  }
  if (chrome.tabs.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      scamDetectedTabs.delete(tabId);
      scamReasonsByTab.delete(tabId);
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

// Compute live RAM Speedometer metrics (Zero-permission tab heuristic)
async function getRamSpeedometerMetrics() {
  const tabs = await chrome.tabs.query({});
  const activeTabs = tabs.filter((t) => !t.discarded);
  const discardedCount = tabs.filter((t) => t.discarded).length;

  const estimatedGb = Math.max(0.8, +(0.65 + activeTabs.length * 0.145).toFixed(1));
  const slowdownPct = Math.min(78, Math.max(8, Math.round(estimatedGb * 6.2)));

  return {
    totalTabs: tabs.length,
    activeTabsCount: activeTabs.length,
    discardedCount,
    estimatedGb,
    slowdownPct
  };
}

// Hibernate inactive background tabs & snapshot session to Cloud Vault
async function hibernateInactiveTabs() {
  const verified = await ensureVerifiedProSession();
  if (!verified.proActive || !verified.licenseKey) {
    return { ok: false, requiresPro: true, error: 'Active paid Pro subscription required.' };
  }
  const data = await chrome.storage.local.get(['stats', 'cloudTabSessions', 'neverSnoozeSites']);

  const stats = data.stats || DEFAULT_STATE.stats;
  const neverSnoozeSites = Array.isArray(data.neverSnoozeSites) ? data.neverSnoozeSites : [];
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
      let tabHost = '';
      try {
        if (tab.url && /^https?:\/\//i.test(tab.url)) {
          tabHost = new URL(tab.url).hostname.replace(/^www\./i, '').toLowerCase();
        }
      } catch (e) {}
      if (tabHost && neverSnoozeSites.includes(tabHost)) {
        continue;
      }
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

  // Allow Zero-Copy Website Auto-Activation Bridge from sweeprdeepblock.com
  if (msg.type === 'AUTO_SYNC_WEBSITE_LICENSE') {
    const senderUrl = String((sender && sender.url) || (sender && sender.tab && sender.tab.url) || '');
    const isOfficialPortal =
      /^https:\/\/([a-z0-9-]+\.)?sweeprdeepblock\.com(\/|$)/i.test(senderUrl) ||
      (isDevExtension && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(senderUrl));
    if (!isOfficialPortal) {
      sendResponse({ ok: false });
      return true;
    }
    const key = String(msg.licenseKey || '').trim();
    if (!key || key.length < 6) {
      sendResponse({ ok: false });
      return true;
    }
    verifyLicenseWithServer(key).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'INCREMENT_DIAGNOSTIC') {
    if (msg.metric === 'fakeStoresDetected' && sender && sender.tab && sender.tab.id) {
      scamDetectedTabs.add(sender.tab.id);
      if (Array.isArray(msg.reasons) && msg.reasons.length > 0) {
        scamReasonsByTab.set(sender.tab.id, msg.reasons);
      }
    }
    chrome.storage.local.get(['stats', 'settings'], (res) => {
      const stats = res.stats || DEFAULT_STATE.stats;
      const key = msg.metric;
      const safeAmount = Math.min(20, Math.max(1, Number(msg.amount) || 1));
      if (key && Object.prototype.hasOwnProperty.call(DEFAULT_STATE.stats, key) && typeof stats[key] === 'number') {
        stats[key] += safeAmount;
      }
      chrome.storage.local.set({ stats }, () => {
        updateActionBadge(stats, res.settings);
        sendResponse({ ok: true, stats });
      });
    });
    return true;
  }

  if (msg.type === 'GET_DASHBOARD_STATE') {
    Promise.all([
      chrome.storage.local.get(Object.keys(DEFAULT_STATE)),
      getRamSpeedometerMetrics(),
      chrome.tabs.query({ active: true, currentWindow: true })
    ]).then(async ([store, ramMetrics, activeTabs]) => {
      let isPro = Boolean(store.proActive && store.licenseKey);
      if (!store.licenseKey && (store.proActive || store.ramTamerActive)) {
        await revokeProState('free');
        isPro = false;
      }
      const activeTab = activeTabs && activeTabs[0];
      const activeTabId = activeTab ? activeTab.id : null;
      const currentTabScamDetected = Boolean(activeTabId && scamDetectedTabs.has(activeTabId));
      const currentTabScamReasons = (activeTabId && scamReasonsByTab.get(activeTabId)) || [];
      sendResponse({
        ...DEFAULT_STATE,
        ...store,
        proActive: isPro,
        ramTamerActive: Boolean(isPro && store.ramTamerActive),
        settings: { ...DEFAULT_STATE.settings, ...(store.settings || {}) },
        stats: { ...DEFAULT_STATE.stats, ...(store.stats || {}) },
        ramMetrics,
        currentTabScamDetected,
        currentTabScamReasons
      });
    });
    return true;
  }

  // Privileged extension UI actions
  const extBaseUrl = chrome.runtime.getURL('');
  const senderUrl = String((sender && sender.url) || (sender && sender.tab && sender.tab.url) || '');
  const isPrivilegedExtensionPage = !sender || !sender.tab || (extBaseUrl && senderUrl.startsWith(extBaseUrl));
  if (!isPrivilegedExtensionPage) {
    return false;
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
    chrome.storage.local.get(['neverSnoozeSites'], async (res) => {
      if (!host) {
        sendResponse({ ok: false });
        return;
      }
      const current = Array.isArray(res.neverSnoozeSites) ? res.neverSnoozeSites : [];
      const keptAwake = !current.includes(host);
      const updated = keptAwake ? [...current, host] : current.filter((h) => h !== host);
      await chrome.storage.local.set({ neverSnoozeSites: updated });
      sendResponse({ ok: true, neverSnoozeSites: updated, keptAwake, hostname: host });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_SETTING') {
    const key = String(msg.settingKey || '').trim();
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_STATE.settings, key)) {
      sendResponse({ ok: false });
      return true;
    }
    Promise.all([ensureVerifiedProSession(), chrome.storage.local.get(['settings', 'stats'])]).then(async ([auth, res]) => {
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
      if (key === 'adBlocking') {
        await syncExtensionProtectionRules(Boolean(current.adBlocking));
      }
      if (key === 'silentMode') {
        await updateActionBadge(res.stats || DEFAULT_STATE.stats, current);
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
