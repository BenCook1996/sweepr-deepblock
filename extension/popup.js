// SWEEPR Deepblock — Subtle Toolbar Popover Controller (v1.2 UX & Ergonomics Audited)
document.addEventListener('DOMContentLoaded', () => {
  const adsCountEl = document.getElementById('adsCount');
  const cookieCountEl = document.getElementById('cookieCount');
  const slopCountEl = document.getElementById('slopCount');
  const scamCountEl = document.getElementById('scamCount');
  const adsBlockedTextEl = document.getElementById('adsBlockedText');
  const tierBadgeEl = document.getElementById('tierBadge');
  const ramHeadlineEl = document.getElementById('ramHeadlineMetric');
  const ramDescEl = document.getElementById('ramDescriptionText');
  const ramBarFillEl = document.getElementById('ramBarFill');
  const reclaimRamBtn = document.getElementById('reclaimRamBtn');
  const savedTabsCountEl = document.getElementById('savedTabsCount');
  const savedTabsListEl = document.getElementById('savedTabsList');
  const upgradeCtaBtn = document.getElementById('upgradeCtaBtn');
  const siteBarEl = document.getElementById('siteBar');
  const currentSiteLabelEl = document.getElementById('currentSiteLabel');
  const currentSiteSubEl = document.getElementById('currentSiteSub');
  const sitePauseBtn = document.getElementById('sitePauseBtn');
  const toggleLicenseDrawerBtn = document.getElementById('toggleLicenseDrawerBtn');
  const licenseDrawerEl = document.getElementById('licenseDrawer');
  const licenseKeyInput = document.getElementById('licenseKeyInput');
  const activateKeyBtn = document.getElementById('activateKeyBtn');
  const licenseFeedbackEl = document.getElementById('licenseFeedback');
  const openTestLabBtn = document.getElementById('openTestLabBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const openFullSessionsBtn = document.getElementById('openFullSessionsBtn');
  const openCustomModulesBtn = document.getElementById('openCustomModulesBtn');
  const startZapperBtn = document.getElementById('startZapperBtn');
  const presetQuietBtn = document.getElementById('presetQuietBtn');
  const presetVisualBtn = document.getElementById('presetVisualBtn');
  const presetQuietPill = document.getElementById('presetQuietPill');
  const presetVisualPill = document.getElementById('presetVisualPill');

  let currentHostname = '';
  let currentTabId = null;
  let currentState = { proActive: false, settings: {}, pausedSites: [], cloudTabSessions: [] };

  // 3-Tab Switcher with State Persistence (Status / Speed / Controls)
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function activateTab(targetId, persist = true) {
    if (!targetId) return;
    tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === targetId));
    tabPanels.forEach((p) => p.classList.toggle('active', p.id === targetId));
    if (persist) {
      chrome.storage.local.set({ lastActivePopupTab: targetId });
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.getAttribute('data-tab'), true);
    });
  });

  // Restore persisted popup UI state (active tab, draft license key, open drawer)
  chrome.storage.local.get(['lastActivePopupTab', 'draftLicenseKey', 'licenseDrawerOpen', 'proActive'], (uiState) => {
    if (uiState && uiState.lastActivePopupTab) {
      activateTab(uiState.lastActivePopupTab, false);
    }
    if (uiState && typeof uiState.draftLicenseKey === 'string' && uiState.draftLicenseKey && licenseKeyInput) {
      licenseKeyInput.value = uiState.draftLicenseKey;
    }
    if (uiState && !uiState.proActive && (uiState.licenseDrawerOpen || uiState.draftLicenseKey)) {
      licenseDrawerEl.classList.add('open');
    }
  });

  if (licenseKeyInput) {
    licenseKeyInput.addEventListener('input', () => {
      chrome.storage.local.set({
        draftLicenseKey: licenseKeyInput.value,
        licenseDrawerOpen: true
      });
    });
  }

  // Detect active tab website hostname
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab) {
      currentTabId = activeTab.id || null;
      if (activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
        try {
          currentHostname = new URL(activeTab.url).hostname.replace(/^www\./i, '');
          currentSiteLabelEl.textContent = currentHostname;
          updateSiteBarState();
        } catch (e) {}
      }
    }
  });

  function openProRequiredPrompt(customMsg) {
    licenseDrawerEl.classList.add('open');
    chrome.storage.local.set({ licenseDrawerOpen: true });
    licenseFeedbackEl.style.display = 'block';
    licenseFeedbackEl.style.color = '#f59e0b';
    licenseFeedbackEl.textContent =
      customMsg ||
      '🔒 Active Pro subscription required. Paste your key or 6-digit code below.';
    licenseKeyInput.focus();
  }

  function updateSiteBarState() {
    if (!currentState.proActive) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.className = 'switch-btn pro-lock';
      sitePauseBtn.textContent = '🔒 PRO';
      currentSiteSubEl.textContent = 'Activate Pro key below to enable protection';
      return;
    }
    sitePauseBtn.textContent = '';
    const isPaused =
      currentHostname &&
      Array.isArray(currentState.pausedSites) &&
      currentState.pausedSites.includes(currentHostname);
    if (isPaused) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.className = 'switch-btn off';
      currentSiteSubEl.textContent = 'Protection paused on this site';
    } else {
      siteBarEl.classList.remove('paused');
      sitePauseBtn.className = 'switch-btn';
      currentSiteSubEl.textContent = 'Protection is ON for this site';
    }
  }

  function renderSavedSessions(sessions) {
    const list = Array.isArray(sessions) ? sessions : [];
    savedTabsCountEl.textContent = String(list.length);
    savedTabsListEl.textContent = '';

    if (list.length === 0) {
      savedTabsListEl.textContent =
        'No paused tab groups yet. Unused tabs automatically snooze in the background.';
      return;
    }

    list.slice(0, 2).forEach((sess) => {
      const row = document.createElement('div');
      row.className = 'saved-session-row';

      const label = document.createElement('span');
      label.textContent = `Saved ${sess.savedAt || 'earlier'} (${Number(sess.tabCount) || 0} tabs)`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'restore-btn';
      btn.textContent = 'Reopen';
      btn.addEventListener('click', () => {
        btn.textContent = 'Opening...';
        chrome.runtime.sendMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: sess.id }, () => {
          btn.textContent = '✓ Opened';
        });
      });

      row.appendChild(label);
      row.appendChild(btn);
      savedTabsListEl.appendChild(row);
    });
  }

  function renderPresets(proActive, settings) {
    const s = settings || {};
    const isQuiet = s.silentMode !== false;
    if (!proActive) {
      if (presetQuietBtn) presetQuietBtn.classList.remove('active');
      if (presetVisualBtn) presetVisualBtn.classList.remove('active');
      if (presetQuietPill) presetQuietPill.textContent = '🔒 PRO';
      if (presetVisualPill) presetVisualPill.textContent = '🔒 PRO';
      return;
    }
    if (presetQuietBtn) presetQuietBtn.classList.toggle('active', isQuiet);
    if (presetVisualBtn) presetVisualBtn.classList.toggle('active', !isQuiet);
    if (presetQuietPill) presetQuietPill.textContent = isQuiet ? 'Active ✓' : 'Select';
    if (presetVisualPill) presetVisualPill.textContent = !isQuiet ? 'Active ✓' : 'Select';
  }

  function renderState(state) {
    currentState = state || currentState;
    const isPro = Boolean(state.proActive);
    const stats = state.stats || {};
    const ads = isPro ? Number(stats.adsBlocked) || 0 : 0;
    const cookies = isPro ? Number(stats.cookiePromptsDetected) || 0 : 0;
    const slop = isPro ? Number(stats.aiSlopDetected) || 0 : 0;
    const scams = isPro ? Number(stats.fakeStoresDetected) || 0 : 0;

    adsCountEl.textContent = String(ads);
    cookieCountEl.textContent = String(cookies);
    slopCountEl.textContent = String(slop);
    scamCountEl.textContent = String(scams);
    if (adsBlockedTextEl) {
      adsBlockedTextEl.textContent = isPro ? `${ads + cookies + slop} blocked ✓` : '🔒 Locked';
      adsBlockedTextEl.style.color = isPro ? '#10b981' : '#f59e0b';
    }

    if (state.ramMetrics) {
      const totalTabs = Number(state.ramMetrics.totalTabs) || 1;
      const discardedCount = Number(state.ramMetrics.discardedCount) || 0;
      ramHeadlineEl.textContent = !isPro
        ? '🔒 Locked'
        : discardedCount > 0
        ? `⚡ ${discardedCount} Sleeping`
        : `${totalTabs} Tabs Open`;
      ramBarFillEl.style.width = isPro ? `${Math.min(85, Math.max(20, totalTabs * 4))}%` : '0%';

      ramDescEl.textContent = !isPro
        ? 'Activate Pro to snooze inactive background tabs and speed up your browser.'
        : discardedCount > 0
        ? `${discardedCount} background tab${discardedCount > 1 ? 's are' : ' is'} quietly sleeping.`
        : `${totalTabs} open tabs. Unused background tabs snooze automatically.`;
    }

    if (isPro) {
      tierBadgeEl.textContent = 'Active';
      tierBadgeEl.classList.add('pro');
      upgradeCtaBtn.style.display = 'none';
      toggleLicenseDrawerBtn.style.display = 'none';
      licenseDrawerEl.classList.remove('open');
    } else {
      tierBadgeEl.textContent = 'Locked';
      tierBadgeEl.classList.remove('pro');
      upgradeCtaBtn.style.display = 'block';
      toggleLicenseDrawerBtn.style.display = 'inline-flex';
      toggleLicenseDrawerBtn.textContent = '🔑 Enter Pro Key';
    }

    updateSiteBarState();
    renderPresets(isPro, state.settings);
    renderSavedSessions(state.cloudTabSessions);
  }

  chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (response) => {
    if (response) renderState(response);
  });

  // Pause / Resume protection on current website
  sitePauseBtn.addEventListener('click', () => {
    if (!currentState.proActive) {
      openProRequiredPrompt();
      return;
    }
    if (!currentHostname) return;
    chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PAUSE', hostname: currentHostname }, (res) => {
      if (res && res.requiresPro) {
        currentState.proActive = false;
        renderState(currentState);
        openProRequiredPrompt(res.error);
        return;
      }
      if (res && res.ok) {
        currentState.pausedSites = res.pausedSites;
        updateSiteBarState();
      }
    });
  });

  if (upgradeCtaBtn) {
    upgradeCtaBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://sweeprdeepblock.com/order?plan=annual' });
    });
  }

  // Snooze inactive background tabs
  reclaimRamBtn.addEventListener('click', () => {
    if (!currentState.proActive) {
      openProRequiredPrompt('🔒 Tab Memory Saver requires an active Pro subscription.');
      return;
    }

    reclaimRamBtn.textContent = 'Snoozing inactive tabs...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.requiresPro) {
        currentState.proActive = false;
        renderState(currentState);
        openProRequiredPrompt(res.error);
        return;
      }
      if (res && res.ok) {
        const count = Number(res.newlyDiscarded) || 0;
        reclaimRamBtn.textContent =
          count > 0 ? `✓ ${count} Tabs Put to Sleep` : '✓ Already Running Fast';
        ramHeadlineEl.textContent = '⚡ Fast & Quiet';
        ramBarFillEl.style.width = '20%';
        if (res.sessions) {
          currentState.cloudTabSessions = res.sessions;
          renderSavedSessions(res.sessions);
        }
      }
    });
  });

  // 1-Click Protection Presets (Quiet Default vs. Visual Feedback Mode)
  function selectPreset(presetMode) {
    if (!currentState.proActive) {
      openProRequiredPrompt();
      return;
    }
    const wantSilent = presetMode === 'quiet';
    const currentSilent = currentState.settings && currentState.settings.silentMode !== false;
    if (wantSilent === currentSilent) return;

    chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey: 'silentMode' }, (res) => {
      if (res && res.requiresPro) {
        openProRequiredPrompt(res.error);
        return;
      }
      if (res && res.ok) {
        currentState.settings = res.settings;
        renderPresets(Boolean(currentState.proActive), currentState.settings);
      }
    });
  }

  if (presetQuietBtn) presetQuietBtn.addEventListener('click', () => selectPreset('quiet'));
  if (presetVisualBtn) presetVisualBtn.addEventListener('click', () => selectPreset('visual'));

  // 1-Click Interactive Page Element Zapper
  if (startZapperBtn) {
    startZapperBtn.addEventListener('click', () => {
      if (!currentState.proActive) {
        openProRequiredPrompt('🔒 Element Hider requires an active Pro subscription.');
        return;
      }
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { type: 'START_ELEMENT_ZAPPER' }, () => {
          window.close();
        });
      }
    });
  }

  // Toggle License Key drawer and persist open state
  if (toggleLicenseDrawerBtn) {
    toggleLicenseDrawerBtn.addEventListener('click', () => {
      const isOpen = licenseDrawerEl.classList.toggle('open');
      chrome.storage.local.set({ licenseDrawerOpen: isOpen });
      if (isOpen) licenseKeyInput.focus();
    });
  }

  async function directVerifyFromPopup(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key || key.length < 6) {
      return { ok: false, valid: false, error: 'Please enter a valid license key or 6-digit code.' };
    }
    const stored = await chrome.storage.local.get(['deviceId']);
    const deviceId =
      stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
        ? stored.deviceId
        : `ext_db_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const endpoints = [
      'https://sweeprdeepblock.com/api/license-verify',
      'http://localhost:3000/api/license-verify'
    ];
    for (const baseUrl of endpoints) {
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
            const newSettings = {
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
              settings: newSettings
            });
            try {
              if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
                await chrome.declarativeNetRequest.updateEnabledRulesets({
                  enableRulesetIds: ['ads_and_trackers', 'cryptominers_and_heavy_scripts'],
                  disableRulesetIds: []
                });
              }
            } catch (e) {}
            return { ok: true, valid: true, licenseKey: canonicalKey, ramTamerActive, settings: newSettings };
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

  // Activate Pro License Key
  async function handlePopupActivate() {
    const key = (licenseKeyInput.value || '').trim();
    if (!key) {
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#ef4444';
      licenseFeedbackEl.textContent = 'Please paste your license key or 6-digit code first.';
      return;
    }
    activateKeyBtn.textContent = '...';
    activateKeyBtn.disabled = true;
    licenseFeedbackEl.style.display = 'block';
    licenseFeedbackEl.style.color = '#9ca3af';
    licenseFeedbackEl.textContent = 'Verifying subscription...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, async (res) => {
      const finalRes =
        res && typeof res === 'object' ? res : await directVerifyFromPopup(key);
      activateKeyBtn.textContent = 'Unlock';
      activateKeyBtn.disabled = false;
      if (finalRes && finalRes.ok && finalRes.valid) {
        await chrome.storage.local.set({ draftLicenseKey: '', licenseDrawerOpen: false });
        currentState.proActive = true;
        currentState.settings = {
          cookieAutoClose: true,
          hideSearchSpam: true,
          fakeShopAlerts: true,
          trackerProtection: true,
          adBlocking: true,
          silentMode: true
        };
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#10b981';
        licenseFeedbackEl.textContent = '✓ Pro Activated! All protection features are ON.';
        renderState(currentState);
      } else {
        currentState.proActive = false;
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#ef4444';
        licenseFeedbackEl.textContent =
          (finalRes && finalRes.error) || '✗ Invalid or unpaid license key.';
        renderState(currentState);
      }
    });
  }

  activateKeyBtn.addEventListener('click', handlePopupActivate);
  licenseKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePopupActivate();
    }
  });

  function openFullDashboard() {
    if (chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    }
  }

  if (openDashboardBtn) openDashboardBtn.addEventListener('click', openFullDashboard);
  if (openFullSessionsBtn) openFullSessionsBtn.addEventListener('click', openFullDashboard);
  if (openCustomModulesBtn) openCustomModulesBtn.addEventListener('click', openFullDashboard);

  if (openTestLabBtn) {
    openTestLabBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://sweeprdeepblock.com/test-lab' });
    });
  }
});
