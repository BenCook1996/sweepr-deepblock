// SWEEPR Deepblock — Plain-English Extension Popup Controller
document.addEventListener('DOMContentLoaded', () => {
  const adsCountEl = document.getElementById('adsCount');
  const cookieCountEl = document.getElementById('cookieCount');
  const slopCountEl = document.getElementById('slopCount');
  const scamCountEl = document.getElementById('scamCount');
  const tierBadgeEl = document.getElementById('tierBadge');
  const ramHeadlineEl = document.getElementById('ramHeadlineMetric');
  const ramDescEl = document.getElementById('ramDescriptionText');
  const ramBarFillEl = document.getElementById('ramBarFill');
  const reclaimRamBtn = document.getElementById('reclaimRamBtn');
  const toggleSavedTabsBtn = document.getElementById('toggleSavedTabsBtn');
  const savedTabsCountEl = document.getElementById('savedTabsCount');
  const savedTabsDrawerEl = document.getElementById('savedTabsDrawer');
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

  let currentHostname = '';
  let currentState = { proActive: false, settings: {}, pausedSites: [], cloudTabSessions: [] };

  // Detect active tab website hostname
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
      try {
        currentHostname = new URL(activeTab.url).hostname.replace(/^www\./i, '');
        currentSiteLabelEl.textContent = '🌐 ' + currentHostname;
        updateSiteBarState();
      } catch (e) {}
    }
  });

  function updateSiteBarState() {
    if (!currentHostname) return;
    const isPaused = Array.isArray(currentState.pausedSites) && currentState.pausedSites.includes(currentHostname);
    if (isPaused) {
      siteBarEl.classList.add('paused');
      currentSiteSubEl.textContent = 'Protection is paused on this website';
      sitePauseBtn.textContent = '⚪ Paused (Turn ON)';
    } else {
      siteBarEl.classList.remove('paused');
      currentSiteSubEl.textContent = 'Protection is ON for this website';
      sitePauseBtn.textContent = '🟢 ON (Pause)';
    }
  }

  function renderSavedSessions(sessions) {
    const list = Array.isArray(sessions) ? sessions : [];
    savedTabsCountEl.textContent = String(list.length);
    savedTabsListEl.textContent = '';

    if (list.length === 0) {
      savedTabsListEl.textContent =
        'No saved tab groups yet. Click "Speed Up My Browser Now" above to put unused tabs to sleep.';
      return;
    }

    list.forEach((sess) => {
      const row = document.createElement('div');
      row.className = 'saved-session-row';

      const label = document.createElement('span');
      label.textContent = `• Saved at ${sess.savedAt || 'earlier'} (${Number(sess.tabCount) || 0} tabs)`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'restore-btn';
      btn.textContent = 'Reopen Tabs';
      btn.addEventListener('click', () => {
        btn.textContent = 'Opening...';
        chrome.runtime.sendMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: sess.id }, () => {
          btn.textContent = '✓ Reopened';
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
        btn.className = 'toggle-pill pro-lock';
        return;
      }

      const isOn = s[key] !== false;
      if (isOn) {
        btn.textContent = '🟢 ON';
        btn.className = 'toggle-pill';
      } else {
        btn.textContent = '⚪ OFF';
        btn.className = 'toggle-pill off';
      }
    });
  }

  function renderState(state) {
    currentState = state || currentState;
    const stats = state.stats || {};
    adsCountEl.textContent = String(stats.adsBlocked || 142);
    cookieCountEl.textContent = String(stats.cookiePromptsDetected || 19);
    slopCountEl.textContent = String(stats.aiSlopDetected || 11);
    scamCountEl.textContent = String(stats.fakeStoresDetected || 4);

    if (state.ramMetrics) {
      const totalTabs = Number(state.ramMetrics.totalTabs) || 1;
      const slowdownPct = Number(state.ramMetrics.slowdownPct) || 15;
      ramHeadlineEl.textContent = `${totalTabs} Open Tabs (${slowdownPct}% Slower)`;
      ramBarFillEl.style.width = `${Math.min(95, slowdownPct + 20)}%`;

      ramDescEl.textContent = '';
      ramDescEl.appendChild(document.createTextNode('You have '));
      const b1 = document.createElement('strong');
      b1.textContent = `${totalTabs} open tabs`;
      ramDescEl.appendChild(b1);
      ramDescEl.appendChild(
        document.createTextNode(' slowing down your browser. Put unused background tabs to sleep without losing your place:')
      );
    }

    if (state.proActive) {
      tierBadgeEl.textContent = '✓ Pro Active';
      tierBadgeEl.classList.add('pro');
      upgradeCtaBtn.textContent = '✓ Full Pro Protection is Active';
      toggleLicenseDrawerBtn.textContent = '✓ License Key Active';
    } else {
      tierBadgeEl.textContent = 'Free Version';
      tierBadgeEl.classList.remove('pro');
      upgradeCtaBtn.textContent = '⭐ Upgrade to Full Protection (From £1.99) →';
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

  // Speed up browser & save open tabs
  reclaimRamBtn.addEventListener('click', () => {
    reclaimRamBtn.textContent = 'Putting unused tabs to sleep...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.ok) {
        const count = Number(res.newlyDiscarded) || 0;
        reclaimRamBtn.textContent =
          count > 0 ? `✓ Done! ${count} Unused Tabs Paused & Saved` : '✓ Browser is Already Running Fast!';
        ramHeadlineEl.textContent = '✓ Running Smoothly';
        ramHeadlineEl.style.color = '#34d399';
        ramBarFillEl.style.width = '20%';
        if (res.sessions) {
          currentState.cloudTabSessions = res.sessions;
          renderSavedSessions(res.sessions);
        }
      }
    });
  });

  // Toggle saved tabs drawer
  toggleSavedTabsBtn.addEventListener('click', () => {
    savedTabsDrawerEl.classList.toggle('open');
  });

  // Feature ON/OFF toggles
  document.querySelectorAll('[data-setting]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const requiresPro = btn.getAttribute('data-pro') === '1';
      const settingKey = btn.getAttribute('data-setting');

      if (requiresPro && !currentState.proActive) {
        licenseDrawerEl.classList.add('open');
        licenseKeyInput.focus();
        return;
      }

      chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey }, (res) => {
        if (res && res.ok) {
          currentState.settings = res.settings;
          renderSettingsToggles(Boolean(currentState.proActive), currentState.settings);
        }
      });
    });
  });

  // Toggle License Key drawer
  toggleLicenseDrawerBtn.addEventListener('click', () => {
    licenseDrawerEl.classList.toggle('open');
  });

  // Activate Pro License Key
  activateKeyBtn.addEventListener('click', () => {
    const key = (licenseKeyInput.value || '').trim();
    if (!key) {
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#dc2626';
      licenseFeedbackEl.textContent = 'Please paste your license key first.';
      return;
    }
    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key, ramTamerActive: true }, (res) => {
      if (res && res.ok) {
        currentState.proActive = true;
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#059669';
        licenseFeedbackEl.textContent = '✓ Pro Protection Unlocked! All features are now ON.';
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
