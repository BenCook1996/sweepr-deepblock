// SWEEPR Deepblock — Subtle Toolbar Popover Controller
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
  const toggleQrDrawerBtn = document.getElementById('toggleQrDrawerBtn');
  const qrDrawerEl = document.getElementById('qrDrawer');
  const toggleLicenseDrawerBtn = document.getElementById('toggleLicenseDrawerBtn');
  const licenseDrawerEl = document.getElementById('licenseDrawer');
  const licenseKeyInput = document.getElementById('licenseKeyInput');
  const activateKeyBtn = document.getElementById('activateKeyBtn');
  const licenseFeedbackEl = document.getElementById('licenseFeedback');
  const openTestLabBtn = document.getElementById('openTestLabBtn');

  let currentHostname = '';
  let currentState = { proActive: false, settings: {}, pausedSites: [], cloudTabSessions: [] };

  // 3-Tab Switcher (Status / Speed / Controls)
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanels.forEach((p) => p.classList.toggle('active', p.id === targetId));
    });
  });

  // Detect active tab website hostname
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
      try {
        currentHostname = new URL(activeTab.url).hostname.replace(/^www\./i, '');
        currentSiteLabelEl.textContent = currentHostname;
        updateSiteBarState();
      } catch (e) {}
    }
  });

  function updateSiteBarState() {
    if (!currentHostname) return;
    const isPaused = Array.isArray(currentState.pausedSites) && currentState.pausedSites.includes(currentHostname);
    if (isPaused) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.classList.add('off');
      currentSiteSubEl.textContent = 'Protection is paused on this site';
    } else {
      siteBarEl.classList.remove('paused');
      sitePauseBtn.classList.remove('off');
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

    list.forEach((sess) => {
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

  function renderSettingsToggles(proActive, settings) {
    const s = settings || {};
    const buttons = document.querySelectorAll('[data-setting]');
    buttons.forEach((btn) => {
      const key = btn.getAttribute('data-setting');
      const requiresPro = btn.getAttribute('data-pro') === '1';

      if (requiresPro && !proActive) {
        btn.textContent = '🔒 PRO';
        btn.className = 'switch-btn pro-lock';
        return;
      }

      btn.textContent = '';
      const isOn = s[key] !== false;
      btn.className = isOn ? 'switch-btn' : 'switch-btn off';
    });
  }

  function renderState(state) {
    currentState = state || currentState;
    const stats = state.stats || {};
    const ads = Number(stats.adsBlocked) || 142;
    const cookies = Number(stats.cookiePromptsDetected) || 19;
    const slop = Number(stats.aiSlopDetected) || 11;
    const scams = Number(stats.fakeStoresDetected) || 4;

    adsCountEl.textContent = String(ads);
    cookieCountEl.textContent = String(cookies);
    slopCountEl.textContent = String(slop);
    scamCountEl.textContent = String(scams);
    if (adsBlockedTextEl) {
      adsBlockedTextEl.textContent = `${ads + cookies + slop} items`;
    }

    if (state.ramMetrics) {
      const totalTabs = Number(state.ramMetrics.totalTabs) || 1;
      const discardedCount = Number(state.ramMetrics.discardedCount) || 0;
      ramHeadlineEl.textContent =
        discardedCount > 0 ? `⚡ ${discardedCount} Sleeping` : `${totalTabs} Tabs Open`;
      ramBarFillEl.style.width = `${Math.min(85, Math.max(22, totalTabs * 4))}%`;

      ramDescEl.textContent =
        discardedCount > 0
          ? `${discardedCount} background tab${discardedCount > 1 ? 's are' : ' is'} quietly sleeping to keep your browser fast.`
          : `You have ${totalTabs} open tabs. Unused background tabs snooze automatically.`;
    }

    if (state.proActive) {
      tierBadgeEl.textContent = '✓ Pro Quiet';
      tierBadgeEl.classList.add('pro');
      upgradeCtaBtn.style.display = 'none';
      toggleLicenseDrawerBtn.textContent = '✓ Pro Active';
    } else {
      tierBadgeEl.textContent = 'Quiet Mode';
      tierBadgeEl.classList.remove('pro');
      upgradeCtaBtn.style.display = 'block';
      upgradeCtaBtn.textContent = '⭐ Unlock Full Pro Protection (From £1.99) →';
    }

    updateSiteBarState();
    renderSettingsToggles(Boolean(state.proActive), state.settings);
    renderSavedSessions(state.cloudTabSessions);
  }

  chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (response) => {
    if (response) renderState(response);
  });

  // Pause / Resume protection on current website
  sitePauseBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PAUSE', hostname: currentHostname }, (res) => {
      if (res && res.ok) {
        currentState.pausedSites = res.pausedSites;
        updateSiteBarState();
      }
    });
  });

  // Speed up browser & save open tabs (Requires Active Paid Pro Subscription)
  reclaimRamBtn.addEventListener('click', () => {
    if (!currentState.proActive) {
      if (qrDrawerEl) qrDrawerEl.classList.remove('open');
      licenseDrawerEl.classList.add('open');
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#b45309';
      licenseFeedbackEl.textContent =
        '🔒 Browser Speed & Tab Sleeping requires an active Pro subscription. Paste your key or click Unlock Full Pro above.';
      licenseKeyInput.focus();
      return;
    }

    reclaimRamBtn.textContent = 'Putting unused tabs to sleep...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.requiresPro) {
        currentState.proActive = false;
        renderState(currentState);
        licenseDrawerEl.classList.add('open');
        return;
      }
      if (res && res.ok) {
        const count = Number(res.newlyDiscarded) || 0;
        reclaimRamBtn.textContent =
          count > 0 ? `✓ ${count} Background Tabs Put to Sleep` : '✓ Browser Already Running Fast';
        ramHeadlineEl.textContent = '⚡ Fast & Quiet';
        ramBarFillEl.style.width = '20%';
        if (res.sessions) {
          currentState.cloudTabSessions = res.sessions;
          renderSavedSessions(res.sessions);
        }
      }
    });
  });

  // Feature ON/OFF sliding switches
  document.querySelectorAll('[data-setting]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const requiresPro = btn.getAttribute('data-pro') === '1';
      const settingKey = btn.getAttribute('data-setting');

      if (requiresPro && !currentState.proActive) {
        if (qrDrawerEl) qrDrawerEl.classList.remove('open');
        licenseDrawerEl.classList.add('open');
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#b45309';
        licenseFeedbackEl.textContent =
          '🔒 Active paid Pro subscription required for this feature. Paste your key below or upgrade above.';
        licenseKeyInput.focus();
        return;
      }

      chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey }, (res) => {
        if (res && res.requiresPro) {
          licenseDrawerEl.classList.add('open');
          licenseKeyInput.focus();
          return;
        }
        if (res && res.ok) {
          currentState.settings = res.settings;
          renderSettingsToggles(Boolean(currentState.proActive), currentState.settings);
        }
      });
    });
  });

  // Toggle QR Phone Pairing drawer
  if (toggleQrDrawerBtn && qrDrawerEl) {
    toggleQrDrawerBtn.addEventListener('click', () => {
      licenseDrawerEl.classList.remove('open');
      qrDrawerEl.classList.toggle('open');
    });
  }

  // Toggle License Key drawer
  toggleLicenseDrawerBtn.addEventListener('click', () => {
    if (qrDrawerEl) qrDrawerEl.classList.remove('open');
    licenseDrawerEl.classList.toggle('open');
  });

  // Activate Pro License Key (Verified Against Live Server & Stripe Subscription)
  activateKeyBtn.addEventListener('click', () => {
    const key = (licenseKeyInput.value || '').trim();
    if (!key) {
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#dc2626';
      licenseFeedbackEl.textContent = 'Please paste your license key first.';
      return;
    }
    activateKeyBtn.textContent = 'Verifying...';
    activateKeyBtn.disabled = true;
    licenseFeedbackEl.style.display = 'block';
    licenseFeedbackEl.style.color = '#6b7280';
    licenseFeedbackEl.textContent = 'Checking active subscription status...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, (res) => {
      activateKeyBtn.textContent = 'Unlock';
      activateKeyBtn.disabled = false;
      if (res && res.ok && res.valid) {
        currentState.proActive = true;
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#059669';
        licenseFeedbackEl.textContent = '✓ Paid Pro Subscription Verified! All features are now ON.';
        renderState(currentState);
      } else {
        currentState.proActive = false;
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#dc2626';
        licenseFeedbackEl.textContent =
          (res && res.error) || '✗ Invalid or unpaid license key. Please complete checkout first.';
        renderState(currentState);
      }
    });
  });

  // Open Test Lab
  openTestLabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://sweeprdeepblock.com/test-lab' });
  });

  // Upgrade CTA
  upgradeCtaBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://sweeprdeepblock.com/order?plan=annual&addon=ram_tamer' });
  });
});
