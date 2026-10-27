// SWEEPR Deepblock — Zero-Scroll 360x500px Unified Popup Controller (v2.0 UX Architect Refactored)
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
  const keepSiteAwakeBtn = document.getElementById('keepSiteAwakeBtn');
  const autoRamToggleBtn = document.getElementById('autoRamToggleBtn');
  const savedTabsCountEl = document.getElementById('savedTabsCount');
  const upgradeCtaBtn = document.getElementById('upgradeCtaBtn');
  const siteBarEl = document.getElementById('siteBar');
  const currentSiteLabelEl = document.getElementById('currentSiteLabel');
  const currentSiteSubEl = document.getElementById('currentSiteSub');
  const sitePauseBtn = document.getElementById('sitePauseBtn');
  const pause5MinBtn = document.getElementById('pause5MinBtn');
  const storeSafetyCard = document.getElementById('storeSafetyCard');
  const storeSafetyTitle = document.getElementById('storeSafetyTitle');
  const storeSafetySub = document.getElementById('storeSafetySub');
  const storeSafetyPill = document.getElementById('storeSafetyPill');
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

  let currentHostname = '';
  let currentTabId = null;
  let currentState = {
    proActive: false,
    settings: {},
    pausedSites: [],
    neverSnoozeSites: [],
    trustedShopSites: [],
    cloudTabSessions: [],
    currentTabScamDetected: false,
    currentTabScamReasons: []
  };

  chrome.storage.local.get(['draftLicenseKey', 'licenseDrawerOpen', 'proActive'], (uiState) => {
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

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab) {
      currentTabId = activeTab.id || null;
      if (activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
        try {
          currentHostname = new URL(activeTab.url).hostname.replace(/^www\./i, '').toLowerCase();
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
      '🔒 Unlock Pro (£1.99 1st mo) or enter your 6-digit code below.';
    licenseKeyInput.focus();
  }

  function updateSiteBarState() {
    if (!currentState.proActive) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.className = 'switch-btn pro-lock';
      sitePauseBtn.textContent = '🔒 PRO';
      currentSiteSubEl.textContent = 'Unlock Pro below to enable full Site Shield';
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
      if (pause5MinBtn) pause5MinBtn.textContent = '▶️ Resume Protection';
    } else {
      siteBarEl.classList.remove('paused');
      sitePauseBtn.className = 'switch-btn';
      currentSiteSubEl.textContent = 'Site Shield ON · Ads & Cookies Blocked';
      if (pause5MinBtn) pause5MinBtn.textContent = '🔧 Pause 5m (Fix Page)';
    }

    if (keepSiteAwakeBtn) {
      const keptAwake =
        currentHostname &&
        Array.isArray(currentState.neverSnoozeSites) &&
        currentState.neverSnoozeSites.includes(currentHostname);
      keepSiteAwakeBtn.textContent = keptAwake ? '✓ Kept Awake' : '📌 Keep Site Awake';
      keepSiteAwakeBtn.style.borderColor = keptAwake ? '#10b981' : '';
      keepSiteAwakeBtn.style.color = keptAwake ? '#059669' : '';
    }
  }

  function renderStoreSafety(state) {
    if (!storeSafetyCard || !storeSafetyTitle || !storeSafetySub || !storeSafetyPill) return;
    if (state.currentTabScamDetected) {
      storeSafetyCard.classList.add('scam-alert');
      storeSafetyTitle.textContent = '⚠️ Suspicious Store Signals Found';
      const firstReason = (state.currentTabScamReasons && state.currentTabScamReasons[0]) || 'Fake urgency countdown timer detected on store';
      storeSafetySub.textContent = firstReason;
      storeSafetyPill.textContent = 'RISK';
      storeSafetyPill.className = 'store-pill risk';
    } else {
      storeSafetyCard.classList.remove('scam-alert');
      storeSafetyTitle.textContent = '🛡️ Store & Site Check: Verified Safe';
      storeSafetySub.textContent = '0 phishing or fake-urgency scam signals on this page';
      storeSafetyPill.textContent = 'SAFE';
      storeSafetyPill.className = 'store-pill';
    }
  }

  function renderState(state) {
    currentState = state || currentState;
    const isPro = Boolean(state.proActive);
    const stats = state.stats || {};
    const ads = isPro ? (Number(stats.adsBlocked) || 0) + (Number(stats.aiSlopDetected) || 0) : 0;
    const cookies = isPro ? Number(stats.cookiePromptsDetected) || 0 : 0;
    const slop = isPro ? Number(stats.aiSlopDetected) || 0 : 0;
    const scams = isPro ? Number(stats.fakeStoresDetected) || 0 : 0;

    if (adsCountEl) adsCountEl.textContent = String(ads);
    if (cookieCountEl) cookieCountEl.textContent = String(cookies);
    if (slopCountEl) slopCountEl.textContent = String(slop);
    if (scamCountEl) scamCountEl.textContent = String(scams);
    if (adsBlockedTextEl) {
      adsBlockedTextEl.textContent = isPro ? `${ads + cookies} blocked ✓` : '🔒 Locked';
    }

    const sessions = Array.isArray(state.cloudTabSessions) ? state.cloudTabSessions : [];
    if (savedTabsCountEl) savedTabsCountEl.textContent = String(sessions.length);

    if (state.ramMetrics) {
      const totalTabs = Number(state.ramMetrics.totalTabs) || 1;
      const discardedCount = Number(state.ramMetrics.discardedCount) || 0;
      const savedGb = Number(stats.ramSavedGb) || +(discardedCount * 0.14).toFixed(1);
      ramHeadlineEl.textContent = !isPro
        ? '🔒 Pro Add-On'
        : savedGb > 0
        ? `⚡ ${savedGb} GB Saved · ${discardedCount} Sleeping`
        : `${totalTabs} Tabs Open`;
      const scaleRatio = isPro ? Math.min(0.85, Math.max(0.18, (totalTabs * 4) / 100)) : 0;
      ramBarFillEl.style.transform = `scaleX(${scaleRatio.toFixed(2)})`;
      const autoOn = !state.settings || state.settings.autoRamTamer !== false;
      if (autoRamToggleBtn) {
        if (!isPro) {
          autoRamToggleBtn.textContent = '🔒 Auto-Pilot';
          autoRamToggleBtn.className = 'store-pill';
        } else if (autoOn) {
          autoRamToggleBtn.textContent = '● Auto-Pilot ON';
          autoRamToggleBtn.className = 'store-pill';
        } else {
          autoRamToggleBtn.textContent = '○ Auto-Pilot Paused';
          autoRamToggleBtn.className = 'store-pill risk';
        }
      }
      ramDescEl.textContent = !isPro
        ? 'Unlock Pro to snooze inactive background tabs automatically and save up to 5.9 GB RAM.'
        : !autoOn
        ? 'Auto-Pilot paused. Click "● Auto-Pilot" or "Free Up RAM Now" to resume automatic background snoozing.'
        : discardedCount > 0
        ? `Auto-Pilot active · ${discardedCount} background tab${discardedCount === 1 ? ' is' : 's are'} sleeping quietly.`
        : `Auto-Pilot active · ${totalTabs} open tabs monitored automatically in background.`;
    }

    if (isPro) {
      tierBadgeEl.textContent = 'Pro Active';
      tierBadgeEl.classList.add('pro');
      upgradeCtaBtn.style.display = 'none';
      toggleLicenseDrawerBtn.style.display = 'none';
      licenseDrawerEl.classList.remove('open');
    } else {
      tierBadgeEl.textContent = 'Free Preview';
      tierBadgeEl.classList.remove('pro');
      upgradeCtaBtn.style.display = 'block';
      toggleLicenseDrawerBtn.style.display = 'inline-flex';
    }

    updateSiteBarState();
    renderStoreSafety(currentState);

    const upd = state.extensionUpdateStatus;
    const extUpdateBanner = document.getElementById('extUpdateBanner');
    const extUpdateBannerText = document.getElementById('extUpdateBannerText');
    const extUpdateBannerBtn = document.getElementById('extUpdateBannerBtn');
    const extForceUpdateOverlay = document.getElementById('extForceUpdateOverlay');
    const extForceUpdateDesc = document.getElementById('extForceUpdateDesc');
    const extForceUpdateBtn = document.getElementById('extForceUpdateBtn');
    const triggerExtUpdate = () => {
      const targetUrl = (upd && upd.updateUrl) || 'https://sweeprdeepblock.com/download';
      if (chrome.runtime && typeof chrome.runtime.requestUpdateCheck === 'function') {
        try {
          chrome.runtime.requestUpdateCheck((status) => {
            if (status === 'update_available') {
              chrome.runtime.reload();
            } else {
              chrome.tabs.create({ url: targetUrl });
            }
          });
          return;
        } catch (e) {}
      }
      chrome.tabs.create({ url: targetUrl });
    };
    if (upd && upd.forceUpdate && upd.updateAvailable) {
      if (extForceUpdateOverlay) {
        extForceUpdateOverlay.style.display = 'flex';
        if (extForceUpdateDesc) {
          extForceUpdateDesc.textContent = `Version v${upd.latestVersion} is required to continue using SWEEPR Deepblock (current: v${upd.currentVersion}).`;
        }
        if (extForceUpdateBtn) {
          extForceUpdateBtn.onclick = triggerExtUpdate;
        }
      }
    } else if (upd && upd.updateAvailable) {
      if (extForceUpdateOverlay) extForceUpdateOverlay.style.display = 'none';
      if (extUpdateBanner) {
        extUpdateBanner.style.display = 'flex';
        if (extUpdateBannerText) {
          extUpdateBannerText.textContent = `Update v${upd.latestVersion} available`;
        }
        if (extUpdateBannerBtn) {
          extUpdateBannerBtn.onclick = triggerExtUpdate;
        }
      }
    } else {
      if (extForceUpdateOverlay) extForceUpdateOverlay.style.display = 'none';
      if (extUpdateBanner) extUpdateBanner.style.display = 'none';
    }
  }

  chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (response) => {
    if (response) renderState(response);
  });

  // 1-Click Toggle Site Shield (and reload active tab so change takes effect immediately)
  sitePauseBtn.addEventListener('click', () => {
    if (!currentState.proActive) {
      openProRequiredPrompt();
      return;
    }
    if (!currentHostname) return;
    chrome.runtime.sendMessage(
      { type: 'TOGGLE_SITE_PAUSE', hostname: currentHostname, reloadTabId: currentTabId },
      (res) => {
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
      }
    );
  });

  // 1-Click "Pause 5m (Fix Page)" Broken-Website Escape Hatch
  if (pause5MinBtn) {
    pause5MinBtn.addEventListener('click', () => {
      if (!currentState.proActive) {
        openProRequiredPrompt();
        return;
      }
      if (!currentHostname) return;
      const isAlreadyPaused =
        Array.isArray(currentState.pausedSites) && currentState.pausedSites.includes(currentHostname);
      if (isAlreadyPaused) {
        chrome.runtime.sendMessage(
          { type: 'TOGGLE_SITE_PAUSE', hostname: currentHostname, reloadTabId: currentTabId },
          (res) => {
            if (res && res.ok) {
              currentState.pausedSites = res.pausedSites;
              updateSiteBarState();
            }
          }
        );
        return;
      }
      pause5MinBtn.textContent = '✓ Paused 5m · Reloading...';
      chrome.runtime.sendMessage(
        { type: 'PAUSE_SITE_5_MIN', hostname: currentHostname, reloadTabId: currentTabId },
        (res) => {
          if (res && res.ok) {
            currentState.pausedSites = res.pausedSites;
            updateSiteBarState();
            currentSiteSubEl.textContent = 'Paused for 5 mins (Auto-resumes protection)';
          }
        }
      );
    });
  }

  // 1-Click "Keep Site Awake" Whitelist Toggle for Tab & RAM Tamer
  if (keepSiteAwakeBtn) {
    keepSiteAwakeBtn.addEventListener('click', () => {
      if (!currentHostname) return;
      chrome.runtime.sendMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: currentHostname }, (res) => {
        if (res && res.ok) {
          currentState.neverSnoozeSites = res.neverSnoozeSites;
          updateSiteBarState();
        }
      });
    });
  }

  // 1-Click Auto-Pilot Background RAM Tamer Toggle
  if (autoRamToggleBtn) {
    autoRamToggleBtn.addEventListener('click', () => {
      if (!currentState.proActive) {
        openProRequiredPrompt('🔒 Tab & RAM Tamer Auto-Pilot requires an active Pro subscription.');
        return;
      }
      chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey: 'autoRamTamer' }, (res) => {
        if (res && res.ok && res.settings) {
          currentState.settings = res.settings;
          renderState(currentState);
        }
      });
    });
  }

  if (upgradeCtaBtn) {
    upgradeCtaBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://sweeprdeepblock.com/order?discount=intro&addon=ram_tamer' });
    });
  }

  reclaimRamBtn.addEventListener('click', () => {
    if (!currentState.proActive) {
      openProRequiredPrompt('🔒 Tab & RAM Tamer requires an active Pro subscription.');
      return;
    }

    reclaimRamBtn.textContent = 'Freeing RAM...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.requiresPro) {
        currentState.proActive = false;
        renderState(currentState);
        openProRequiredPrompt(res.error);
        return;
      }
      if (res && res.ok) {
        const count = Number(res.newlyDiscarded) || 0;
        const savedGb = (res.stats && res.stats.ramSavedGb) || 0.4;
        reclaimRamBtn.textContent =
          count > 0 ? `✓ ${count} Tabs Snoozed` : '✓ Already Fast';
        ramHeadlineEl.textContent = `⚡ ${savedGb} GB Saved`;
        ramBarFillEl.style.transform = 'scaleX(0.18)';
        if (ramHeadlineEl.animate) {
          ramHeadlineEl.animate(
            [
              { transform: 'scale(1.06)', opacity: 0.7 },
              { transform: 'scale(1)', opacity: 1 }
            ],
            { duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
          );
        }
        if (res.settings) {
          currentState.settings = res.settings;
        } else {
          currentState.settings = { ...(currentState.settings || {}), autoRamTamer: true };
        }
        if (autoRamToggleBtn) {
          autoRamToggleBtn.textContent = '● Auto-Pilot ON';
          autoRamToggleBtn.className = 'store-pill';
        }
        if (res.sessions && savedTabsCountEl) {
          currentState.cloudTabSessions = res.sessions;
          savedTabsCountEl.textContent = String(res.sessions.length);
        }
      }
    });
  });

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
    if (key.startsWith('ptk_')) {
      for (const origin of ['https://sweeprdeepblock.com', 'http://localhost:3000']) {
        try {
          const r = await fetch(`${origin}/api/device-link/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ token: key, device_id: deviceId, device_name: 'SWEEPR Deepblock Extension', platform: 'browser_extension' })
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d && d.ok && d.licenseKey) {
            return directVerifyFromPopup(d.licenseKey);
          }
          if (d && (d.message || d.error)) {
            return { ok: false, valid: false, error: d.message || d.error };
          }
        } catch (e) {}
      }
      return { ok: false, valid: false, error: 'Invalid or expired website QR pairing code.' };
    }
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
              silentMode: true,
              autoRamTamer: true
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
          silentMode: true,
          autoRamTamer: true
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

  // Flow B: QR Challenge & Phone Approval Polling in Extension Popup
  const popupShowQrBtn = document.getElementById('popupShowQrBtn');
  const popupQrBox = document.getElementById('popupQrBox');
  const popupQrSvg = document.getElementById('popupQrSvg');
  const popupQrStatus = document.getElementById('popupQrStatus');
  const popupRefreshQrBtn = document.getElementById('popupRefreshQrBtn');
  let popupQrPollTimer = null;

  async function startPopupQrChallenge() {
    if (!popupQrBox || !popupQrSvg || !popupQrStatus) return;
    popupQrBox.style.display = 'block';
    popupQrSvg.innerHTML = '<span style="font-size:10px;color:#6b7280;">Generating...</span>';
    popupQrStatus.textContent = 'Creating secure 120s QR challenge...';
    if (popupQrPollTimer) clearInterval(popupQrPollTimer);

    const stored = await chrome.storage.local.get(['deviceId']);
    const deviceId =
      stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
        ? stored.deviceId
        : `ext_db_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await chrome.storage.local.set({ deviceId });

    const baseOrigins = [
      'https://sweeprdeepblock.com',
      ...(isDevExtension ? ['http://localhost:3000'] : [])
    ];
    let challengeData = null;
    let activeOrigin = baseOrigins[0];

    for (const origin of baseOrigins) {
      try {
        const res = await fetch(`${origin}/api/device-link/challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            device_name: 'SWEEPR Deepblock Extension',
            platform: 'browser_extension'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok && data.challenge_id) {
          challengeData = data;
          activeOrigin = origin;
          break;
        }
      } catch (e) {}
    }

    if (!challengeData) {
      popupQrSvg.innerHTML = '<span style="font-size:10px;color:#ef4444;">Offline</span>';
      popupQrStatus.textContent = 'Could not reach server. Try again.';
      return;
    }

    popupQrSvg.innerHTML = challengeData.qr_svg || '';
    const svgEl = popupQrSvg.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
    }
    let rem = Number(challengeData.expires_in) || 120;
    popupQrStatus.textContent = `Scan with phone • Expires in ${rem}s`;

    popupQrPollTimer = setInterval(async () => {
      rem = Math.max(0, rem - 2);
      if (rem <= 0) {
        clearInterval(popupQrPollTimer);
        popupQrStatus.textContent = 'QR expired — click Refresh QR.';
        return;
      }
      popupQrStatus.textContent = `Scan with phone • Expires in ${rem}s`;
      try {
        const pollRes = await fetch(
          `${activeOrigin}/api/device-link/poll?challenge_id=${encodeURIComponent(challengeData.challenge_id)}&poll_secret=${encodeURIComponent(challengeData.poll_secret)}`
        );
        const pollData = await pollRes.json().catch(() => ({}));
        if (pollRes.ok && pollData && pollData.status === 'approved' && pollData.licenseKey) {
          clearInterval(popupQrPollTimer);
          const newSettings = {
            cookieAutoClose: true,
            hideSearchSpam: true,
            fakeShopAlerts: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true,
            autoRamTamer: true
          };
          await chrome.storage.local.set({
            deviceId,
            proActive: true,
            ramTamerActive: Boolean(pollData.ramTamerAddon),
            licenseKey: pollData.licenseKey,
            draftLicenseKey: '',
            licenseDrawerOpen: false,
            crmAccountId: pollData.account_id || '',
            subscriptionStatus: 'active',
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
          currentState.proActive = true;
          currentState.settings = newSettings;
          popupQrBox.style.display = 'none';
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = '#10b981';
          licenseFeedbackEl.textContent = '✓ Linked via QR! Pro Protection Unlocked.';
          renderState(currentState);
        }
      } catch (e) {}
    }, 2000);
  }

  if (popupShowQrBtn) popupShowQrBtn.addEventListener('click', startPopupQrChallenge);
  if (popupRefreshQrBtn) popupRefreshQrBtn.addEventListener('click', startPopupQrChallenge);

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
