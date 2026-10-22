// SWEEPR Deepblock — Full-Tab Dashboard & Options Controller
const WELCOME_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify',
  'http://localhost:3000/api/license-verify'
];

async function directVerifyAndPersistLicense(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || key.length < 6) {
    return { ok: false, valid: false, error: 'Please enter a valid license key or 6-digit code.' };
  }
  const stored = await chrome.storage.local.get(['deviceId']);
  const deviceId =
    stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
      ? stored.deviceId
      : `ext_db_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  for (const baseUrl of WELCOME_VERIFY_ENDPOINTS) {
    try {
      const res = await fetch(
        `${baseUrl}?key=${encodeURIComponent(key)}&device_id=${encodeURIComponent(deviceId)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json', 'x-sweepr-project': 'deepblock' }
        }
      );
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
          const canonicalKey = data.licenseKey || data.license_key || key;
          await chrome.storage.local.set({
            deviceId,
            proActive: true,
            ramTamerActive,
            licenseKey: canonicalKey,
            draftLicenseKey: '',
            licenseDrawerOpen: false,
            licenseToken: data.token || data.license_token || '',
            crmAccountId: data.account_id || '',
            subscriptionStatus: subStatus,
            licenseVerifiedAt: Date.now(),
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
          try {
            if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
              await chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds: ['ads_and_trackers', 'cryptominers_and_heavy_scripts'],
                disableRulesetIds: []
              });
            }
          } catch (e) {}
          return { ok: true, valid: true, licenseKey: canonicalKey, ramTamerActive };
        }
      }
      if (res.status === 400 || res.status === 403 || res.status === 404 || data?.valid === false) {
        return {
          ok: false,
          valid: false,
          error: '✗ Invalid or unpaid license key. Please complete checkout first.'
        };
      }
    } catch (e) {}
  }
  return {
    ok: false,
    valid: false,
    error: 'Could not reach licensing server. Please check your internet connection.'
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('welcomeLicenseInput');
  const btn = document.getElementById('welcomeActivateBtn');
  const feedback = document.getElementById('welcomeKeyFeedback');
  const badge = document.getElementById('welcomeStatusBadge');
  const fullSavedSessionsCount = document.getElementById('fullSavedSessionsCount');
  const fullSavedSessionsList = document.getElementById('fullSavedSessionsList');
  const pausedSitesCount = document.getElementById('pausedSitesCount');
  const pausedSitesList = document.getElementById('pausedSitesList');

  if (!btn || !input || !feedback) return;

  function markProActivated(licenseKey) {
    feedback.style.display = 'block';
    feedback.style.color = '#059669';
    feedback.textContent =
      '✓ Paid Pro Subscription Verified! All protection features are now active across your browser.';
    btn.textContent = '✓ Activated';
    btn.style.background = '#047857';
    if (badge) {
      badge.textContent = '✓ Pro Subscription Active — All Protection Modules Unlocked';
    }
    if (licenseKey && !input.value) {
      input.value = licenseKey;
    }
  }

  function renderOffloadedPanels(stored) {
    const sessions = Array.isArray(stored && stored.cloudTabSessions) ? stored.cloudTabSessions : [];
    const pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];

    if (fullSavedSessionsCount) {
      fullSavedSessionsCount.textContent = `${sessions.length} snapshot${sessions.length === 1 ? '' : 's'}`;
    }
    if (fullSavedSessionsList) {
      fullSavedSessionsList.textContent = '';
      if (sessions.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12.5px;color:#6b7280;';
        empty.textContent = 'No saved tab groups yet. Press Alt+Shift+Z to snooze inactive tabs.';
        fullSavedSessionsList.appendChild(empty);
      } else {
        sessions.forEach((sess) => {
          const row = document.createElement('div');
          row.className = 'list-item';
          const label = document.createElement('span');
          label.textContent = `Saved at ${sess.savedAt || 'earlier'} (${Number(sess.tabCount) || 0} tabs)`;
          const restoreBtn = document.createElement('button');
          restoreBtn.type = 'button';
          restoreBtn.className = 'mini-btn';
          restoreBtn.textContent = 'Reopen Tabs';
          restoreBtn.addEventListener('click', () => {
            restoreBtn.textContent = 'Opening...';
            chrome.runtime.sendMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: sess.id }, () => {
              restoreBtn.textContent = '✓ Reopened';
            });
          });
          row.appendChild(label);
          row.appendChild(restoreBtn);
          fullSavedSessionsList.appendChild(row);
        });
      }
    }

    if (pausedSitesCount) {
      pausedSitesCount.textContent = `${pausedSites.length} site${pausedSites.length === 1 ? '' : 's'}`;
    }
    if (pausedSitesList) {
      pausedSitesList.textContent = '';
      if (pausedSites.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12.5px;color:#6b7280;';
        empty.textContent = 'Protection is active on all websites.';
        pausedSitesList.appendChild(empty);
      } else {
        pausedSites.forEach((domain) => {
          const row = document.createElement('div');
          row.className = 'list-item';
          const label = document.createElement('span');
          label.textContent = domain;
          const resumeBtn = document.createElement('button');
          resumeBtn.type = 'button';
          resumeBtn.className = 'mini-btn';
          resumeBtn.textContent = 'Resume Protection';
          resumeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PAUSE', hostname: domain }, (res) => {
              if (res && res.ok) {
                renderOffloadedPanels({ cloudTabSessions: sessions, pausedSites: res.pausedSites });
              }
            });
          });
          row.appendChild(label);
          row.appendChild(resumeBtn);
          pausedSitesList.appendChild(row);
        });
      }
    }
  }

  chrome.storage.local.get(['proActive', 'licenseKey', 'draftLicenseKey', 'cloudTabSessions', 'pausedSites'], (stored) => {
    if (stored && stored.proActive && stored.licenseKey) {
      markProActivated(stored.licenseKey);
    } else if (stored && stored.draftLicenseKey && !input.value) {
      input.value = stored.draftLicenseKey;
    }
    renderOffloadedPanels(stored || {});
  });

  input.addEventListener('input', () => {
    chrome.storage.local.set({ draftLicenseKey: input.value });
  });

  async function handleActivate() {
    const key = (input.value || '').trim();
    if (!key) {
      feedback.style.display = 'block';
      feedback.style.color = '#dc2626';
      feedback.textContent = 'Please paste your license key or 6-digit code first.';
      return;
    }

    btn.textContent = 'Verifying...';
    btn.disabled = true;
    feedback.style.display = 'block';
    feedback.style.color = '#6b7280';
    feedback.textContent = 'Checking active subscription status...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, async (res) => {
      const finalRes =
        res && typeof res === 'object' ? res : await directVerifyAndPersistLicense(key);
      btn.disabled = false;
      if (finalRes && finalRes.ok && finalRes.valid) {
        markProActivated(finalRes.licenseKey || key);
      } else {
        btn.textContent = 'Activate Pro';
        feedback.style.display = 'block';
        feedback.style.color = '#dc2626';
        feedback.textContent =
          (finalRes && finalRes.error) ||
          '✗ Invalid or unpaid license key. Please complete checkout first.';
      }
    });
  }

  btn.addEventListener('click', handleActivate);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleActivate();
    }
  });
});
