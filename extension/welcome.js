// SWEEPR Deepblock — Full-Tab Dashboard & Options Controller (v1.3 UX Audited)
const WELCOME_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify',
  'http://localhost:3000/api/license-verify'
];

const WELCOME_REDEEM_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/device-link/redeem-token',
  'http://localhost:3000/api/device-link/redeem-token'
];

async function directVerifyAndPersistLicense(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key || key.length < 6) {
    return { ok: false, valid: false, error: 'Please enter a valid license key, ptk_ pairing code, or 6-digit code.' };
  }
  const stored = await chrome.storage.local.get(['deviceId']);
  const deviceId =
    stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
      ? stored.deviceId
      : `ext_db_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  const ptkMatch = key.match(/ptk_[A-Za-z0-9_-]{12,64}/);
  if (ptkMatch) {
    for (const redeemUrl of WELCOME_REDEEM_ENDPOINTS) {
      try {
        const r = await fetch(redeemUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            token: ptkMatch[0],
            device_id: deviceId,
            device_name: 'SWEEPR Deepblock Browser Extension',
            platform: 'browser_extension'
          })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d && (d.ok || d.valid)) {
          const canonicalKey = d.licenseKey || d.license_key || ptkMatch[0];
          const settings = {
            cookieAutoClose: true,
            hideSearchSpam: true,
            fakeShopAlerts: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true
          };
          await chrome.storage.local.set({
            deviceId,
            proActive: true,
            ramTamerActive: Boolean(d.ramTamerAddon),
            licenseKey: canonicalKey,
            draftLicenseKey: '',
            licenseDrawerOpen: false,
            subscriptionStatus: 'active',
            licenseVerifiedAt: Date.now(),
            encryptedDnsEnabled: true,
            settings
          });
          return { ok: true, valid: true, licenseKey: canonicalKey, settings };
        }
      } catch (e) {}
    }
    return { ok: false, valid: false, error: 'This QR pairing code has expired or already been used.' };
  }

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
          const settings = {
            cookieAutoClose: true,
            hideSearchSpam: true,
            fakeShopAlerts: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true
          };
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
            settings
          });
          try {
            if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
              await chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds: ['ads_and_trackers', 'cryptominers_and_heavy_scripts'],
                disableRulesetIds: []
              });
            }
          } catch (e) {}
          return { ok: true, valid: true, licenseKey: canonicalKey, ramTamerActive, settings };
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
  const neverSnoozeCount = document.getElementById('neverSnoozeCount');
  const neverSnoozeList = document.getElementById('neverSnoozeList');
  const customZappedCount = document.getElementById('customZappedCount');
  const customZappedList = document.getElementById('customZappedList');

  let dashboardState = {
    proActive: false,
    settings: {},
    cloudTabSessions: [],
    pausedSites: [],
    neverSnoozeSites: [],
    customHiddenSelectors: {}
  };

  if (!btn || !input || !feedback) return;

  function renderModuleSwitches(proActive, settings) {
    const s = settings || {};
    document.querySelectorAll('[data-setting]').forEach((sw) => {
      const key = sw.getAttribute('data-setting');
      if (!proActive) {
        sw.textContent = '🔒 PRO';
        sw.className = 'switch-btn pro-lock';
        return;
      }
      sw.textContent = '';
      const isOn = s[key] !== false;
      sw.className = isOn ? 'switch-btn' : 'switch-btn off';
    });
  }

  function markProActivated(licenseKey, settings) {
    dashboardState.proActive = true;
    dashboardState.licenseKey = licenseKey || dashboardState.licenseKey || input.value.trim();
    if (settings) dashboardState.settings = settings;
    feedback.style.display = 'block';
    feedback.style.color = '#10b981';
    feedback.textContent =
      '✓ Paid Pro Subscription Verified! All protection features are now active across your browser (up to 3 devices).';
    btn.textContent = '✓ Activated';
    btn.style.background = '#047857';
    if (badge) {
      badge.textContent = '✓ Pro Subscription Active — All Protection Modules Unlocked';
    }
    if (licenseKey && !input.value) {
      input.value = licenseKey;
    }
    renderModuleSwitches(true, dashboardState.settings);
  }

  function renderOffloadedPanels(stored) {
    const sessions = Array.isArray(stored && stored.cloudTabSessions) ? stored.cloudTabSessions : [];
    const pausedSites = Array.isArray(stored && stored.pausedSites) ? stored.pausedSites : [];
    const neverSnoozeSites = Array.isArray(stored && stored.neverSnoozeSites) ? stored.neverSnoozeSites : [];
    const customMap = (stored && stored.customHiddenSelectors) || {};

    if (fullSavedSessionsCount) {
      fullSavedSessionsCount.textContent = `${sessions.length} snapshot${sessions.length === 1 ? '' : 's'}`;
    }
    if (fullSavedSessionsList) {
      fullSavedSessionsList.textContent = '';
      if (sessions.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12.5px;color:var(--muted);';
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
        empty.style.cssText = 'font-size:12.5px;color:var(--muted);';
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
                dashboardState.pausedSites = res.pausedSites;
                renderOffloadedPanels(dashboardState);
              }
            });
          });
          row.appendChild(label);
          row.appendChild(resumeBtn);
          pausedSitesList.appendChild(row);
        });
      }
    }

    if (neverSnoozeCount) {
      neverSnoozeCount.textContent = `${neverSnoozeSites.length} site${neverSnoozeSites.length === 1 ? '' : 's'}`;
    }
    if (neverSnoozeList) {
      neverSnoozeList.textContent = '';
      if (neverSnoozeSites.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12.5px;color:var(--muted);';
        empty.textContent = 'No sites pinned awake yet. Use "📌 Keep Site Awake" in the popup.';
        neverSnoozeList.appendChild(empty);
      } else {
        neverSnoozeSites.forEach((domain) => {
          const row = document.createElement('div');
          row.className = 'list-item';
          const label = document.createElement('span');
          label.textContent = domain;
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'mini-btn';
          removeBtn.textContent = 'Allow Snooze';
          removeBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: domain }, (res) => {
              if (res && res.ok) {
                dashboardState.neverSnoozeSites = res.neverSnoozeSites;
                renderOffloadedPanels(dashboardState);
              }
            });
          });
          row.appendChild(label);
          row.appendChild(removeBtn);
          neverSnoozeList.appendChild(row);
        });
      }
    }

    const zappedDomains = Object.keys(customMap).filter(
      (d) => Array.isArray(customMap[d]) && customMap[d].length > 0
    );
    if (customZappedCount) {
      customZappedCount.textContent = `${zappedDomains.length} site${zappedDomains.length === 1 ? '' : 's'}`;
    }
    if (customZappedList) {
      customZappedList.textContent = '';
      if (zappedDomains.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12.5px;color:var(--muted);';
        empty.textContent = 'No custom hidden elements yet. Right-click any page to hide distracting elements.';
        customZappedList.appendChild(empty);
      } else {
        zappedDomains.forEach((domain) => {
          const count = customMap[domain].length;
          const row = document.createElement('div');
          row.className = 'list-item';
          const label = document.createElement('span');
          label.textContent = `${domain} (${count} hidden element${count === 1 ? '' : 's'})`;
          const resetBtn = document.createElement('button');
          resetBtn.type = 'button';
          resetBtn.className = 'mini-btn';
          resetBtn.textContent = 'Restore Elements';
          resetBtn.addEventListener('click', () => {
            delete customMap[domain];
            chrome.storage.local.set({ customHiddenSelectors: customMap }, () => {
              dashboardState.customHiddenSelectors = customMap;
              renderOffloadedPanels(dashboardState);
            });
          });
          row.appendChild(label);
          row.appendChild(resetBtn);
          customZappedList.appendChild(row);
        });
      }
    }
  }

  chrome.storage.local.get(
    ['proActive', 'licenseKey', 'draftLicenseKey', 'settings', 'cloudTabSessions', 'pausedSites', 'neverSnoozeSites', 'customHiddenSelectors'],
    (stored) => {
      dashboardState = { ...dashboardState, ...(stored || {}) };
      if (stored && stored.proActive && stored.licenseKey) {
        markProActivated(stored.licenseKey, stored.settings);
      } else {
        if (stored && stored.draftLicenseKey && !input.value) {
          input.value = stored.draftLicenseKey;
        }
        renderModuleSwitches(false, {});
      }
      renderOffloadedPanels(dashboardState);
    }
  );

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.proActive && changes.proActive.newValue === true) {
        chrome.storage.local.get(['licenseKey', 'settings'], (s) => {
          markProActivated(s.licenseKey, s.settings);
        });
      }
    });
  }

  // Module toggle switches inside full-tab dashboard
  document.querySelectorAll('[data-setting]').forEach((sw) => {
    sw.addEventListener('click', () => {
      if (!dashboardState.proActive) {
        input.focus();
        feedback.style.display = 'block';
        feedback.style.color = '#f59e0b';
        feedback.textContent = '🔒 Enter your Pro license key or 6-digit code above to unlock module controls.';
        return;
      }
      const settingKey = sw.getAttribute('data-setting');
      chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey }, (res) => {
        if (res && res.ok) {
          dashboardState.settings = res.settings;
          renderModuleSwitches(true, dashboardState.settings);
        }
      });
    });
  });

  input.addEventListener('input', () => {
    chrome.storage.local.set({ draftLicenseKey: input.value });
  });

  async function handleActivate() {
    const key = (input.value || '').trim();
    if (!key) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Please paste your license key, ptk_ pairing code, or 6-digit code first.';
      return;
    }

    btn.textContent = 'Verifying...';
    btn.disabled = true;
    feedback.style.display = 'block';
    feedback.style.color = '#9ca3af';
    feedback.textContent = 'Checking active subscription status...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, async (res) => {
      const finalRes =
        res && typeof res === 'object' ? res : await directVerifyAndPersistLicense(key);
      btn.disabled = false;
      if (finalRes && finalRes.ok && finalRes.valid) {
        markProActivated(finalRes.licenseKey || key, finalRes.settings || {
          cookieAutoClose: true,
          hideSearchSpam: true,
          fakeShopAlerts: true,
          trackerProtection: true,
          adBlocking: true,
          silentMode: true
        });
      } else {
        btn.textContent = 'Activate Pro';
        feedback.style.display = 'block';
        feedback.style.color = '#ef4444';
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

  // Support Ticket Submission Handler -> Central CRM + Owner Email
  const supportEmailEl = document.getElementById('welcomeSupportEmail');
  const supportSubjectEl = document.getElementById('welcomeSupportSubject');
  const supportMessageEl = document.getElementById('welcomeSupportMessage');
  const supportSendBtn = document.getElementById('welcomeSupportSendBtn');
  const supportFeedback = document.getElementById('welcomeSupportFeedback');

  if (supportSendBtn && supportEmailEl && supportMessageEl && supportFeedback) {
    supportSendBtn.addEventListener('click', async () => {
      const email = (supportEmailEl.value || '').trim().toLowerCase();
      const subject = ((supportSubjectEl && supportSubjectEl.value) || 'SWEEPR Deepblock Extension Support').trim();
      const message = (supportMessageEl.value || '').trim();
      if (!email || !email.includes('@')) {
        supportFeedback.style.display = 'inline';
        supportFeedback.style.color = '#ef4444';
        supportFeedback.textContent = 'Please enter a valid email address so we can reply.';
        supportEmailEl.focus();
        return;
      }
      if (!message) {
        supportFeedback.style.display = 'inline';
        supportFeedback.style.color = '#ef4444';
        supportFeedback.textContent = 'Please enter a message before sending.';
        supportMessageEl.focus();
        return;
      }
      supportSendBtn.disabled = true;
      supportSendBtn.textContent = 'Sending...';
      supportFeedback.style.display = 'inline';
      supportFeedback.style.color = '#6b7280';
      supportFeedback.textContent = 'Sending to SWEEPR Support...';

      const payload = {
        project_id: 'deepblock',
        email,
        subject,
        message,
        os: 'browser_extension'
      };
      const supportUrls = [
        'http://127.0.0.1:8788/api/support/contact',
        'http://localhost:8788/api/support/contact',
        'http://localhost:3000/api/support',
        'https://sweeprdeepblock.com/api/support'
      ];
      let sentOk = false;
      let ticketId = '';
      for (const url of supportUrls) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-sweepr-project': 'deepblock' },
            body: JSON.stringify(payload)
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d && d.ok) {
            sentOk = true;
            ticketId = d.ticket_id || d.ticket_number || '';
            break;
          }
        } catch (e) {}
      }

      supportSendBtn.disabled = false;
      supportSendBtn.textContent = 'Send Message to Support';
      if (sentOk) {
        supportMessageEl.value = '';
        if (supportSubjectEl) supportSubjectEl.value = '';
        supportFeedback.style.color = '#10b981';
        supportFeedback.textContent =
          `✓ Sent to SWEEPR Support${ticketId ? ` (Ticket #${ticketId})` : ''} — we'll reply by email.`;
      } else {
        supportFeedback.style.color = '#ef4444';
        supportFeedback.textContent = 'Could not reach support server — please check your internet connection.';
      }
    });
  }
});
