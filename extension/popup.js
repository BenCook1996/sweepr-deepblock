// SWEEPR Deepblock — Zero-Scroll 360x500px Unified Popup Controller (v2.0 UX Architect Refactored)
document.addEventListener('DOMContentLoaded', () => {
  const adsCountEl = document.getElementById('adsCount');
  const adsMetricLabelEl = document.getElementById('adsMetricLabel');
  const cookieCountEl = document.getElementById('cookieCount');
  const adsBlockedTextEl = document.getElementById('adsBlockedText');
  const tierBadgeEl = document.getElementById('tierBadge');
  const hostPermBannerEl = document.getElementById('hostPermBanner');
  const grantHostPermBtn = document.getElementById('grantHostPermBtn');
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
  const popupChromeAutoVerifyBtn = document.getElementById('popupChromeAutoVerifyBtn');
  const popupMainView = document.getElementById('popupMainView');
  const popupMenuView = document.getElementById('popupMenuView');
  const popupMenuBackBtn = document.getElementById('popupMenuBackBtn');
  const popupOpenWelcomeBtn = document.getElementById('popupOpenWelcomeBtn');
  const popupMenuTabEngines = document.getElementById('popupMenuTabEngines');
  const popupMenuTabLists = document.getElementById('popupMenuTabLists');
  const popupEnginesPane = document.getElementById('popupEnginesPane');
  const popupListsPane = document.getElementById('popupListsPane');
  const popupListTabsBar = document.getElementById('popupListTabsBar');
  const popupSessionsList = document.getElementById('popupSessionsList');
  const popupPausedList = document.getElementById('popupPausedList');
  const popupPinnedList = document.getElementById('popupPinnedList');
  const popupHiddenList = document.getElementById('popupHiddenList');
  const hasChromeIdentity =
    typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function';

  let currentHostname = '';
  let currentTabId = null;
  let currentState = {
    proActive: false,
    ramTamerActive: false,
    subscriptionStatus: 'unactivated',
    plan: '',
    trialStartedAt: 0,
    trialExpiresAt: 0,
    settings: {},
    pausedSites: [],
    neverSnoozeSites: [],
    cloudTabSessions: []
  };

  function parseEpochMs(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string' && v.trim()) {
      const num = Number(v);
      if (Number.isFinite(num) && num > 0) return num;
      const parsed = Date.parse(v);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  function formatRemainingDaysHours(expMs, { verbose = false } = {}) {
    const diff = Number(expMs) - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) return verbose ? '0 hours remaining' : '0h left';
    const totalHours = Math.floor(diff / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (verbose) {
      if (days > 0) {
        return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'} remaining`;
      }
      if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
      return 'Less than 1 hour remaining';
    }
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return '<1h left';
  }

  function deriveTrialState(state) {
    const st = state || {};
    const isPro = Boolean(st.proActive);
    const status = String(st.subscriptionStatus || '').toLowerCase();
    const plan = String(st.plan || '').toLowerCase();
    const expMs = parseEpochMs(st.trialExpiresAt || (status === 'trialing' ? st.licenseExpiresAt : 0));
    const expiredByClock = expMs > 0 && Date.now() >= expMs;
    const isActiveTrial = isPro && (status === 'trialing' || plan === 'trial_7d') && !expiredByClock;
    const isTrialExpired =
      status === 'trial_expired' ||
      (!isPro && status === 'expired' && plan === 'trial_7d') ||
      (!isPro && plan === 'trial_7d' && Boolean(st.trialStartedAt || expMs)) ||
      (status === 'trialing' && expiredByClock);
    const remainingShort = isActiveTrial && expMs > 0 ? formatRemainingDaysHours(expMs) : '';
    const remainingVerbose = isActiveTrial && expMs > 0 ? formatRemainingDaysHours(expMs, { verbose: true }) : '';
    return { isPro, isActiveTrial, isTrialExpired, expiresAtMs: expMs, remainingShort, remainingVerbose };
  }

  function isUiProActive(st = currentState) {
    return Boolean(st && st.proActive) && !deriveTrialState(st).isTrialExpired;
  }

  chrome.storage.local.get(['draftLicenseKey', 'licenseDrawerOpen', 'proActive'], (uiState) => {
    if (uiState && typeof uiState.draftLicenseKey === 'string' && uiState.draftLicenseKey && licenseKeyInput) {
      licenseKeyInput.value = uiState.draftLicenseKey;
    }
    if (uiState && !uiState.proActive && (uiState.licenseDrawerOpen || uiState.draftLicenseKey)) {
      licenseDrawerEl.classList.add('open');
    }
  });

  const FULL_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  const PAIRING_TOKEN_RE = /^ptk_[A-Za-z0-9_-]{12,64}$/;
  function createExtDeviceId() {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return `ext_db_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      }
      if (typeof crypto.getRandomValues === 'function') {
        const buf = new Uint8Array(8);
        crypto.getRandomValues(buf);
        return `ext_db_${Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')}`;
      }
    }
    return `ext_db_${Date.now().toString(16)}`;
  }

  if (licenseKeyInput) {
    licenseKeyInput.addEventListener('input', () => {
      const raw = (licenseKeyInput.value || '').trim();
      chrome.storage.local.set({
        draftLicenseKey: licenseKeyInput.value,
        licenseDrawerOpen: true
      });
      if (FULL_LICENSE_KEY_RE.test(raw) || PAIRING_TOKEN_RE.test(raw)) {
        if (licenseFeedbackEl) {
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = '#059669';
          licenseFeedbackEl.textContent = 'Verifying license key automatically...';
        }
        handlePopupActivate();
      } else if (!raw && licenseFeedbackEl) {
        licenseFeedbackEl.style.display = 'none';
      }
    });
  }

  const pasteKeyBtn = document.getElementById('pasteKeyBtn');
  const isTouchDevice =
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));
  let snoozeShortcutLabel = '';

  function getMsg(key, fallback) {
    try {
      const m = chrome.i18n && chrome.i18n.getMessage && chrome.i18n.getMessage(key);
      if (m) return m;
    } catch (e) {}
    return fallback;
  }

  function applyI18nStrings() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const translated = getMsg(key, '');
      if (translated) el.textContent = translated;
    });
  }

  function populateShortcutBadges() {
    if (isTouchDevice) {
      document.querySelectorAll('.kbd-badge, .kbd-tooltip').forEach((el) => {
        el.style.display = 'none';
      });
      return;
    }
    if (!chrome.commands || typeof chrome.commands.getAll !== 'function') return;
    try {
      chrome.commands.getAll((cmds) => {
        if (!Array.isArray(cmds)) return;
        const shieldCmd = cmds.find((c) => c.name === 'toggle-site-shield');
        const snoozeCmd = cmds.find((c) => c.name === 'snooze-inactive-tabs');
        const shieldBadge = document.querySelector('#siteBarClickRow .kbd-badge');
        const snoozeBadge = document.querySelector('#reclaimRamBtn .kbd-badge');
        if (shieldBadge) {
          if (shieldCmd && shieldCmd.shortcut) {
            shieldBadge.textContent = shieldCmd.shortcut;
          } else {
            shieldBadge.style.display = 'none';
          }
        }
        if (snoozeBadge) {
          if (snoozeCmd && snoozeCmd.shortcut) {
            snoozeBadge.textContent = snoozeCmd.shortcut;
            snoozeShortcutLabel = snoozeCmd.shortcut;
          } else {
            snoozeBadge.style.display = 'none';
          }
        } else if (snoozeCmd && snoozeCmd.shortcut) {
          snoozeShortcutLabel = snoozeCmd.shortcut;
        }
      });
    } catch (e) {}
  }

  applyI18nStrings();
  populateShortcutBadges();

  if (grantHostPermBtn) {
    grantHostPermBtn.addEventListener('click', () => {
      if (!chrome.permissions || typeof chrome.permissions.request !== 'function') return;
      try {
        chrome.permissions.request({ origins: ['<all_urls>'] }, (granted) => {
          chrome.runtime.sendMessage(
            { type: 'CHECK_HOST_PERMISSIONS', granted: Boolean(granted) },
            (res) => {
              if (res && typeof res.hostPermissionsGranted === 'boolean') {
                currentState.hostPermissionsGranted = res.hostPermissionsGranted;
              } else {
                currentState.hostPermissionsGranted = Boolean(granted);
              }
              renderState(currentState);
            }
          );
        });
      } catch (e) {}
    });
  }

  if (pasteKeyBtn && licenseKeyInput) {
    pasteKeyBtn.addEventListener('click', async () => {
      let pastedText = '';
      let clipboardFailed = false;
      try {
        pastedText = await navigator.clipboard.readText();
      } catch (err1) {
        clipboardFailed = true;
        if (chrome.permissions && typeof chrome.permissions.request === 'function') {
          try {
            const granted = await new Promise((resolve) => {
              chrome.permissions.request({ permissions: ['clipboardRead'] }, (ok) => resolve(Boolean(ok)));
            });
            if (granted) {
              pastedText = await navigator.clipboard.readText();
              clipboardFailed = false;
            }
          } catch (err2) {
            clipboardFailed = true;
          }
        }
      }
      if (pastedText && pastedText.trim()) {
        licenseKeyInput.value = pastedText.trim();
        handlePopupActivate();
        return;
      }
      if ((licenseKeyInput.value || '').trim()) {
        handlePopupActivate();
        return;
      }
      licenseKeyInput.focus();
      if (clipboardFailed && licenseFeedbackEl) {
        const isMac = typeof navigator !== 'undefined' && /Mac|Darwin/i.test(navigator.platform || '');
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#d97706';
        licenseFeedbackEl.textContent = isMac
          ? 'Clipboard blocked — click box and press ⌘V to paste your key.'
          : 'Clipboard blocked — click box and press Ctrl+V to paste your key.';
      }
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
    licenseFeedbackEl.style.color = '#d97706';
    const trialInfo = deriveTrialState(currentState);
    licenseFeedbackEl.textContent =
      customMsg ||
      (trialInfo.isTrialExpired
        ? '🔒 Your 7-day Pro trial has expired. Upgrade or enter a SWEEPR-DB-XXXX-XXXX-XXXX license key above.'
        : '🔒 Unlock Pro or enter your SWEEPR-DB-XXXX-XXXX-XXXX license key above.');
    licenseKeyInput.focus();
  }

  function updateSiteBarState() {
    const trialInfo = deriveTrialState(currentState);
    const isPro = Boolean(currentState.proActive) && !trialInfo.isTrialExpired;
    if (!isPro) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.className = 'switch-btn pro-lock';
      sitePauseBtn.textContent = 'PRO';
      currentSiteSubEl.textContent = trialInfo.isTrialExpired
        ? 'Trial expired — upgrade to restore Site Shield'
        : 'Unlock Pro below to enable full Site Shield';
      return;
    }
    sitePauseBtn.textContent = '';
    const isPaused =
      currentHostname &&
      Array.isArray(currentState.pausedSites) &&
      currentState.pausedSites.includes(currentHostname);
    const siteBarClickRow = document.getElementById('siteBarClickRow');
    if (siteBarClickRow) {
      siteBarClickRow.setAttribute('aria-checked', isPaused ? 'false' : 'true');
    }
    if (isPaused) {
      siteBarEl.classList.add('paused');
      sitePauseBtn.className = 'switch-btn off';
      currentSiteSubEl.textContent = 'Protection paused — click card to resume';
      if (pause5MinBtn) {
        pause5MinBtn.textContent = '';
        const sp = document.createElement('span');
        sp.textContent = 'Resume Protection';
        pause5MinBtn.appendChild(sp);
      }
    } else {
      siteBarEl.classList.remove('paused');
      sitePauseBtn.className = 'switch-btn';
      currentSiteSubEl.textContent = 'Click anywhere on card to pause site';
      if (pause5MinBtn) {
        pause5MinBtn.textContent = '';
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '15');
        svg.setAttribute('height', '15');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('viewBox', '0 0 24 24');
        const p = document.createElementNS(ns, 'path');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('d', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z');
        svg.appendChild(p);
        const sp = document.createElement('span');
        sp.textContent = 'Pause 5m (Fix)';
        pause5MinBtn.appendChild(svg);
        pause5MinBtn.appendChild(sp);
      }
    }

    if (keepSiteAwakeBtn) {
      const keptAwake =
        currentHostname &&
        Array.isArray(currentState.neverSnoozeSites) &&
        currentState.neverSnoozeSites.includes(currentHostname);
      keepSiteAwakeBtn.textContent = keptAwake ? '✓ Kept Awake' : 'Keep Site Awake';
      keepSiteAwakeBtn.style.borderColor = keptAwake ? '#10b981' : '';
      keepSiteAwakeBtn.style.color = keptAwake ? '#059669' : '';
    }
  }

  function renderStoreSafety(state) {
    if (!storeSafetyCard || !storeSafetyTitle || !storeSafetySub || !storeSafetyPill) return;
    storeSafetyCard.classList.remove('scam-alert');
    const trialInfo = deriveTrialState(state);
    const isPro = trialInfo.isPro;
    const hasBonus = Number(state && state.bonusProDaysEarned) > 0;
    if (isPro && state && state.plan === 'referral_trial_14d') {
      storeSafetyTitle.textContent = 'MV3 Shield Active';
      storeSafetySub.textContent = 'Ads, cookies, and URL trackers shielded';
      storeSafetyPill.textContent = '14d Trial';
      storeSafetyPill.className = 'store-pill';
      return;
    }
    if (trialInfo.isActiveTrial) {
      storeSafetyTitle.textContent = '7-Day Pro Trial Active';
      storeSafetySub.textContent = trialInfo.remainingShort
        ? `Full Pro protection active · ${trialInfo.remainingShort}`
        : 'Full Pro protection active';
      storeSafetyPill.textContent = trialInfo.remainingShort
        ? `Trial · ${trialInfo.remainingShort}`
        : '7-Day Pro Trial';
      storeSafetyPill.className = 'store-pill';
      return;
    }
    if (trialInfo.isTrialExpired) {
      storeSafetyTitle.textContent = 'Trial Expired';
      storeSafetySub.textContent = '7-day Pro trial ended — upgrade to restore protection';
      storeSafetyPill.textContent = 'Trial Expired';
      storeSafetyPill.className = 'store-pill expired';
      return;
    }
    storeSafetyTitle.textContent = isPro ? 'MV3 Shield Active' : 'Free Preview Mode';
    storeSafetySub.textContent = isPro
      ? hasBonus
        ? `Pro active · +${Number(state.bonusProDaysEarned)} bonus referral days`
        : 'Ads, cookies, and URL trackers shielded'
      : 'Activate Pro to unlock full MV3 protection';
    storeSafetyPill.textContent = isPro ? 'Shield Active' : 'Free Preview';
    storeSafetyPill.className = 'store-pill';
  }

  function renderState(state) {
    currentState = state || currentState;
    const trialInfo = deriveTrialState(currentState);
    if (trialInfo.isTrialExpired) {
      currentState.proActive = false;
    }
    const isPro = Boolean(currentState.proActive) && !trialInfo.isTrialExpired;
    const stats = currentState.stats || {};
    const ads = isPro
      ? Number(stats.adsBlocked) || 0
      : (Number(stats.adsSpotted) || 0) + (Number(stats.adsBlocked) || 0);
    const cookies = Number(stats.cookiePromptsDetected) || 0;

    if (hostPermBannerEl) {
      hostPermBannerEl.style.display = currentState.hostPermissionsGranted === false ? 'flex' : 'none';
    }

    if (adsCountEl) adsCountEl.textContent = String(ads);
    if (adsMetricLabelEl) adsMetricLabelEl.textContent = isPro ? 'Ads' : 'Spotted';
    if (cookieCountEl) cookieCountEl.textContent = String(cookies);
    if (adsBlockedTextEl) {
      adsBlockedTextEl.textContent = isPro
        ? `${ads + cookies} blocked ✓`
        : trialInfo.isTrialExpired
        ? `${ads + cookies} spotted · Trial Expired`
        : `${ads + cookies} spotted · Free Preview`;
    }

    const sessions = Array.isArray(currentState.cloudTabSessions) ? currentState.cloudTabSessions : [];
    if (savedTabsCountEl) savedTabsCountEl.textContent = String(sessions.length);

    const popupAutoRamRow = document.getElementById('popupAutoRamRow');
    if (currentState.ramMetrics) {
      const totalTabs = Number(currentState.ramMetrics.totalTabs) || 1;
      const discardedCount = Number(currentState.ramMetrics.discardedCount) || 0;
      const discardSupported = currentState.ramMetrics.tabsDiscardSupported !== false;
      if (reclaimRamBtn) {
        reclaimRamBtn.style.display = discardSupported ? '' : 'none';
      }
      if (popupAutoRamRow) {
        popupAutoRamRow.style.display = discardSupported ? '' : 'none';
      }
      ramHeadlineEl.textContent =
        discardSupported && discardedCount > 0 ? `${discardedCount} sleeping` : `${totalTabs} tabs`;
      const scaleRatio = isPro && discardSupported ? Math.min(0.85, Math.max(0.18, (totalTabs * 4) / 100)) : 0;
      ramBarFillEl.style.transform = `scaleX(${scaleRatio.toFixed(2)})`;
      const autoOn = !currentState.settings || currentState.settings.autoRamTamer !== false;
      if (autoRamToggleBtn) {
        if (!isPro) {
          autoRamToggleBtn.textContent = '🔒 Auto-Pilot';
          autoRamToggleBtn.className = 'store-pill';
        } else if (!discardSupported) {
          autoRamToggleBtn.textContent = 'Tab Hibernation Unavailable';
          autoRamToggleBtn.className = 'store-pill';
        } else if (autoOn) {
          autoRamToggleBtn.textContent = '● Auto-Pilot ON';
          autoRamToggleBtn.className = 'store-pill';
        } else {
          autoRamToggleBtn.textContent = '○ Auto-Pilot Paused';
          autoRamToggleBtn.className = 'store-pill risk';
        }
      }
      ramDescEl.textContent = !discardSupported
        ? `Tab hibernation is not supported in this browser · ${totalTabs} open tab${totalTabs === 1 ? '' : 's'}.`
        : !isPro
        ? trialInfo.isTrialExpired
          ? 'Trial expired — upgrade to restore automatic tab hibernation.'
          : 'Unlock Pro to automatically hibernate idle background tabs.'
        : !autoOn
        ? 'Auto-Pilot paused. Enable Auto-Hibernate or click Boost Browser Speed Now to snooze idle tabs.'
        : discardedCount > 0
        ? `Auto-Pilot active · ${discardedCount} background tab${discardedCount === 1 ? ' is' : 's are'} sleeping.`
        : `Auto-Pilot active · ${totalTabs} open tabs monitored in background.`;
    }

    const upgradeCtaTextEl = document.getElementById('upgradeCtaText');
    const upgradeSubtitleEl = document.getElementById('upgradeSubtitleText');
    if (isPro) {
      document.body.classList.add('pro-mode');
      document.body.classList.remove('unactivated-mode', 'trial-expired-mode');
      if (trialInfo.isActiveTrial && currentState.plan !== 'referral_trial_14d') {
        tierBadgeEl.textContent = trialInfo.remainingShort
          ? `7-Day Pro Trial · ${trialInfo.remainingShort}`
          : '7-Day Pro Trial';
      } else {
        tierBadgeEl.textContent = getMsg('uiProActive', 'Pro Active');
      }
      tierBadgeEl.className = 'status-pill pro';
      upgradeCtaBtn.style.display = 'none';
      toggleLicenseDrawerBtn.style.display = 'none';
      licenseDrawerEl.classList.remove('open');
      if (popupChromeAutoVerifyBtn) popupChromeAutoVerifyBtn.style.display = 'none';
    } else {
      document.body.classList.add('unactivated-mode');
      document.body.classList.remove('pro-mode');
      document.body.classList.toggle('trial-expired-mode', trialInfo.isTrialExpired);
      if (trialInfo.isTrialExpired) {
        tierBadgeEl.textContent = 'Trial Expired';
        tierBadgeEl.className = 'status-pill expired';
        if (upgradeCtaTextEl) upgradeCtaTextEl.textContent = 'Trial Expired — Upgrade to Pro';
      } else {
        tierBadgeEl.textContent = getMsg('uiFreePreview', 'Free Preview');
        tierBadgeEl.className = 'status-pill';
        if (upgradeCtaTextEl) upgradeCtaTextEl.textContent = getMsg('uiUnlockPro', 'Unlock Full Pro Protection');
      }
      upgradeCtaBtn.style.display = 'flex';
      toggleLicenseDrawerBtn.style.display = 'flex';
      if (popupChromeAutoVerifyBtn) {
        popupChromeAutoVerifyBtn.style.display = hasChromeIdentity ? 'block' : 'none';
      }
      if (currentState.chromeAutoActivateResult && currentState.chromeAutoActivateResult.status === 'device_limit_reached') {
        licenseDrawerEl.classList.add('open');
        licenseFeedbackEl.style.display = 'block';
        licenseFeedbackEl.style.color = '#d97706';
        const used = currentState.chromeAutoActivateResult.devicesUsed || '';
        const max = currentState.chromeAutoActivateResult.devicesMax || 5;
        licenseFeedbackEl.textContent = `Paid account found (${used}/${max} devices used). Remove an old device at sweeprdeepblock.com/login.`;
      }
      if (upgradeSubtitleEl) {
        if (trialInfo.isTrialExpired) {
          upgradeSubtitleEl.textContent =
            'Your 7-day Pro trial ended. Upgrade to restore YouTube Shield, Cookie Auto-Reject, OTA Delta, RAM Tamer & 5-device sync.';
        } else {
          upgradeSubtitleEl.textContent =
            currentState.abVariant === 'variant_b_risk_free_14d'
              ? '14-Day 100% Risk-Free Guarantee · 1-Click Portal Cancel'
              : 'One Subscription · Chrome, Edge, Firefox & Opera';
        }
      }
    }

    updateSiteBarState();
    renderStoreSafety(currentState);
    renderPopupMenu(currentState);

    const reviewMilestoneBanner = document.getElementById('reviewMilestoneBanner');
    const reviewMilestoneText = document.getElementById('reviewMilestoneText');
    const reviewRateBtn = document.getElementById('reviewRateBtn');
    const reviewDismissBtn = document.getElementById('reviewDismissBtn');
    if (reviewMilestoneBanner) {
      const totalBlocked = ads + cookies;
      chrome.storage.local.get(['reviewPromptDismissed'], (rStore) => {
        if (!rStore?.reviewPromptDismissed && isPro && totalBlocked >= 500) {
          if (reviewMilestoneText) {
            reviewMilestoneText.textContent = `🎉 ${totalBlocked.toLocaleString()} ads & pop-ups blocked! Enjoying DeepBlock?`;
          }
          reviewMilestoneBanner.style.display = 'flex';
          if (reviewRateBtn) {
            reviewRateBtn.onclick = () => {
              chrome.storage.local.set({ reviewPromptDismissed: true });
              reviewMilestoneBanner.style.display = 'none';
              const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
              let reviewUrl = 'https://chromewebstore.google.com/detail/bkdfhdgmglfancgpkcbdceinfdlccmpc/reviews';
              if (/Firefox\//i.test(ua)) {
                reviewUrl = 'https://addons.mozilla.org/en-US/firefox/addon/sweepr-deepblock/reviews/';
              } else if (/Edg\//i.test(ua)) {
                reviewUrl = 'https://microsoftedge.microsoft.com/addons/detail/pbidlabhfmaoghmofkaegcgjgmaajhop';
              } else if (/OPR\/|Opera\//i.test(ua)) {
                reviewUrl = 'https://addons.opera.com/en/extensions/details/sweepr-deepblock/';
              }
              chrome.tabs.create({ url: reviewUrl });
            };
          }
          if (reviewDismissBtn) {
            reviewDismissBtn.onclick = () => {
              chrome.storage.local.set({ reviewPromptDismissed: true });
              reviewMilestoneBanner.style.display = 'none';
            };
          }
        } else {
          reviewMilestoneBanner.style.display = 'none';
        }
      });
    }

    // Automation A3: Value Receipt & Milestone Upgrade Card (Free Users at 100 / 1,000 threats)
    const milestoneActionCard = document.getElementById('milestoneActionCard');
    const milestoneActionText = document.getElementById('milestoneActionText');
    const a3MilestoneUpgradeBtn = document.getElementById('a3MilestoneUpgradeBtn');
    const a3MilestoneDismissBtn = document.getElementById('a3MilestoneDismissBtn');
    const mState = state.milestoneState || {
      totalThreats:
        (Number(stats.adsBlocked) || 0) +
        (Number(stats.adsSpotted) || 0) +
        (Number(stats.cookiePromptsDetected) || 0)
    };
    if (milestoneActionCard) {
      chrome.storage.local.get(['a3MilestoneDismissedAt'], (a3Store) => {
        const dismissedRecent = a3Store && a3Store.a3MilestoneDismissedAt && Date.now() - Number(a3Store.a3MilestoneDismissedAt) < 7 * 86400 * 1000;
        if (!isPro && mState.totalThreats >= 100 && !dismissedRecent) {
          const isHighMilestone = mState.totalThreats >= 1000;
          if (milestoneActionText) {
            milestoneActionText.textContent = isHighMilestone
              ? `🔥 ${mState.totalThreats.toLocaleString()} threats spotted — unlock Annual Pro or Complete Security Suite`
              : `🛡️ ${mState.totalThreats.toLocaleString()} threats spotted — unlock Full Pro protection`;
          }
          if (a3MilestoneUpgradeBtn) {
            a3MilestoneUpgradeBtn.textContent = isHighMilestone ? 'Unlock Pro / Suite' : 'Unlock Pro';
            a3MilestoneUpgradeBtn.onclick = () => {
              const targetPlanUrl = isHighMilestone
                ? 'https://sweeprdeepblock.com/order?plan=annual&utm_source=extension_a3_1000'
                : 'https://sweeprdeepblock.com/order?plan=monthly&intro=1&utm_source=extension_a3_100';
              chrome.tabs.create({ url: targetPlanUrl });
            };
          }
          milestoneActionCard.style.display = 'flex';
          if (a3MilestoneDismissBtn) {
            a3MilestoneDismissBtn.onclick = () => {
              chrome.storage.local.set({ a3MilestoneDismissedAt: Date.now() });
              milestoneActionCard.style.display = 'none';
            };
          }
        } else {
          milestoneActionCard.style.display = 'none';
        }
      });
    }

    // Automation A4 + Phase 3 Step 3.3: Escalating D30 / D60 / D90 In-Extension Win-Back & Step-Up Banner (Zero Emails)
    const stepUpAndWinbackBanner = document.getElementById('stepUpAndWinbackBanner');
    const stepUpAndWinbackText = document.getElementById('stepUpAndWinbackText');
    const a4SwitchPlanBtn = document.getElementById('a4SwitchPlanBtn');
    const a4DismissBtn = document.getElementById('a4DismissBtn');
    if (stepUpAndWinbackBanner) {
      chrome.storage.local.get(['a4DismissedAt'], (a4Store) => {
        const dismissedRecent = a4Store && a4Store.a4DismissedAt && Date.now() - Number(a4Store.a4DismissedAt) < 7 * 86400 * 1000;
        if ((state.stepUpSaveEligible || state.winbackEligible) && !dismissedRecent) {
          const wbTier = state.winbackTier || 'tier_d30';
          const countVerb = isPro ? 'blocks' : 'threats spotted';
          let bannerCopy = `💡 Intro Month Ending (${mState.totalThreats.toLocaleString()} ${countVerb}, ${cookies} cookies) — Switch to Annual Pro`;
          let targetUrl = 'https://sweeprdeepblock.com/order?plan=annual&utm_source=extension_a4';
          if (state.winbackEligible) {
            if (wbTier === 'tier_d90') {
              bannerCopy = '🛡️ D90 Win-Back: Complete Security Suite (DeepBlock+VPN+Cleaner) — Save 45%';
              targetUrl = 'https://sweeprdeepblock.com/order?plan=suite_annual&winback=tier_d90&utm_source=extension_d90';
            } else if (wbTier === 'tier_d60') {
              bannerCopy = '⚡ D60 Win-Back: Annual Pro (£29.99/yr — 50% Savings Across 5 Devices)';
              targetUrl = 'https://sweeprdeepblock.com/order?plan=annual&winback=tier_d60&utm_source=extension_d60';
            } else {
              bannerCopy = `⚡ D30 Win-Back (${mState.totalThreats.toLocaleString()} ${countVerb}): 6-Month Plan — Save 25%`;
              targetUrl = 'https://sweeprdeepblock.com/order?plan=six_month&winback=tier_d30&utm_source=extension_d30';
            }
          }
          if (stepUpAndWinbackText) {
            stepUpAndWinbackText.textContent = bannerCopy;
          }
          stepUpAndWinbackBanner.style.display = 'flex';
          if (a4SwitchPlanBtn) {
            a4SwitchPlanBtn.onclick = () => {
              chrome.tabs.create({ url: targetUrl });
            };
          }
          if (a4DismissBtn) {
            a4DismissBtn.onclick = () => {
              chrome.storage.local.set({ a4DismissedAt: Date.now() });
              stepUpAndWinbackBanner.style.display = 'none';
            };
          }
        } else {
          stepUpAndWinbackBanner.style.display = 'none';
        }
      });
    }

    // Automation A5: Sweepr Ecosystem Cross-Sell Router (Sweepr Complete Security Suite / Cleaner / VPN)
    const ecosystemCrossSellCard = document.getElementById('ecosystemCrossSellCard');
    const ecosystemCrossSellText = document.getElementById('ecosystemCrossSellText');
    const a5CrossSellCtaBtn = document.getElementById('a5CrossSellCtaBtn');
    const a5CrossSellDismissBtn = document.getElementById('a5CrossSellDismissBtn');
    if (ecosystemCrossSellCard) {
      chrome.storage.local.get(['a5DismissedAt'], (a5Store) => {
        const dismissedRecent = a5Store && a5Store.a5DismissedAt && Date.now() - Number(a5Store.a5DismissedAt) < 14 * 86400 * 1000;
        const tabsHib = Number(stats.tabsHibernated) || 0;
        const totalProtected = ads + cookies;
        const triggerCleaner = state.plan !== 'suite_annual' && tabsHib >= 20;
        const triggerVpn = state.plan !== 'suite_annual' && isPro && totalProtected >= 150;
        if (!dismissedRecent && (triggerCleaner || triggerVpn)) {
          const targetUrl = triggerCleaner
            ? 'https://sweeprdeepblock.com/order?plan=suite_annual&utm_source=extension_a5&utm_medium=ram_trigger'
            : 'https://sweeprdeepblock.com/order?plan=suite_annual&utm_source=extension_a5&utm_medium=dns_trigger';
          if (ecosystemCrossSellText) {
            ecosystemCrossSellText.textContent = triggerCleaner
              ? `🧹 ${tabsHib} idle tabs snoozed — Bundle DeepBlock Pro + Cleaner + VPN`
              : '🔒 Protect up to 5 devices with the Sweepr Complete Security Suite';
          }
          if (a5CrossSellCtaBtn) {
            a5CrossSellCtaBtn.textContent = 'Bundle & Save ↗';
          }
          ecosystemCrossSellCard.style.display = 'flex';
          if (a5CrossSellCtaBtn) {
            a5CrossSellCtaBtn.onclick = () => {
              chrome.tabs.create({ url: targetUrl });
            };
          }
          if (a5CrossSellDismissBtn) {
            a5CrossSellDismissBtn.onclick = () => {
              chrome.storage.local.set({ a5DismissedAt: Date.now() });
              ecosystemCrossSellCard.style.display = 'none';
            };
          }
        } else {
          ecosystemCrossSellCard.style.display = 'none';
        }
      });
    }

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

  // 1-Click Toggle Site Shield on Full Card Row or Switch (and reload active tab so change takes effect immediately)
  function handleToggleSiteShield(e) {
    if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e && e.type === 'keydown') e.preventDefault();
    if (!isUiProActive()) {
      if (currentState.proActive) {
        currentState.proActive = false;
        renderState(currentState);
      }
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
  }

  const siteBarClickRow = document.getElementById('siteBarClickRow');
  if (siteBarClickRow) {
    siteBarClickRow.addEventListener('click', handleToggleSiteShield);
    siteBarClickRow.addEventListener('keydown', handleToggleSiteShield);
  } else if (sitePauseBtn) {
    sitePauseBtn.addEventListener('click', handleToggleSiteShield);
  }

  // 1-Click "Pause 5m (Fix Page)" Broken-Website Escape Hatch
  if (pause5MinBtn) {
    pause5MinBtn.addEventListener('click', () => {
      if (!isUiProActive()) {
        if (currentState.proActive) {
          currentState.proActive = false;
          renderState(currentState);
        }
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
      if (!isUiProActive()) {
        if (currentState.proActive) {
          currentState.proActive = false;
          renderState(currentState);
        }
        openProRequiredPrompt();
        return;
      }
      if (!currentHostname) return;
      chrome.runtime.sendMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: currentHostname }, (res) => {
        if (res && res.requiresPro) {
          currentState.proActive = false;
          renderState(currentState);
          openProRequiredPrompt(res.error);
          return;
        }
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
      if (!isUiProActive()) {
        if (currentState.proActive) {
          currentState.proActive = false;
          renderState(currentState);
        }
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
      chrome.tabs.create({ url: 'https://sweeprdeepblock.com/order?utm_source=extension&utm_medium=popup' });
    });
  }

  reclaimRamBtn.addEventListener('click', () => {
    if (!isUiProActive()) {
      if (currentState.proActive) {
        currentState.proActive = false;
        renderState(currentState);
      }
      openProRequiredPrompt('🔒 Tab & RAM Tamer requires an active Pro subscription.');
      return;
    }

    reclaimRamBtn.textContent = 'Snoozing idle tabs...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.requiresPro) {
        currentState.proActive = false;
        renderState(currentState);
        openProRequiredPrompt(res.error);
        return;
      }
      if (res && res.ok) {
        const count = Number(res.newlyDiscarded) || 0;
        const discardedTotal = Number(res.ramMetrics && res.ramMetrics.discardedCount);
        const tabsTotal = Number(res.ramMetrics && res.ramMetrics.totalTabs) || 0;
        reclaimRamBtn.textContent =
          count > 0 ? `✓ ${count} tab${count === 1 ? '' : 's'} snoozed` : '✓ No idle tabs';
        if (Number.isFinite(discardedTotal) && discardedTotal > 0) {
          ramHeadlineEl.textContent = `${discardedTotal} sleeping`;
        } else if (count > 0) {
          ramHeadlineEl.textContent = `${count} sleeping`;
        } else if (tabsTotal > 0) {
          ramHeadlineEl.textContent = `${tabsTotal} tabs`;
        }
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
      if (!isUiProActive()) {
        if (currentState.proActive) {
          currentState.proActive = false;
          renderState(currentState);
        }
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
    if (!FULL_LICENSE_KEY_RE.test(key) && !PAIRING_TOKEN_RE.test(key)) {
      return { ok: false, valid: false, error: 'Please enter a full SWEEPR-DB-XXXX-XXXX-XXXX license key or ptk_ pairing token.' };
    }
    const stored = await chrome.storage.local.get(['deviceId']);
    const deviceId =
      stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
        ? stored.deviceId
        : createExtDeviceId();
    if (key.startsWith('ptk_')) {
      for (const origin of ['https://sweeprdeepblock.com']) {
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
      'https://sweeprdeepblock.com/api/license-verify'
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
            const ramTamerActive = true;
            const canonicalKey = data.licenseKey || data.license_key || '';
            if (!canonicalKey || canonicalKey.startsWith('ptk_')) {
              return { ok: false, valid: false, error: 'Server did not return a valid license key.' };
            }
            const newSettings = {
              cookieAutoClose: true,
              trackerProtection: true,
              adBlocking: true,
              silentMode: true,
              autoRamTamer: true,
              cloudTabSyncEnabled: true
            };
            const isTrialPlan = subStatus === 'trialing' || String(data.plan || '').toLowerCase() === 'trial_7d';
            await chrome.storage.local.set({
              deviceId,
              proActive: true,
              ramTamerActive: true,
              licenseKey: canonicalKey,
              draftLicenseKey: '',
              licenseDrawerOpen: false,
              licenseToken: data.token || data.license_token || '',
              crmAccountId: data.account_id || '',
              subscriptionStatus: subStatus,
              plan: data.plan || 'annual',
              licenseExpiresAt: data.expiresAt || '',
              trialExpiresAt: isTrialPlan ? Number(data.trialExpiresAt || 0) : 0,
              ...(isTrialPlan && data.trialStartedAt ? { trialStartedAt: Number(data.trialStartedAt) } : {}),
              bonusProDaysEarned: Number(data.bonusProDaysEarned || 0),
              licenseVerifiedAt: Date.now(),
              settings: newSettings
            });
            try {
              if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
                await chrome.declarativeNetRequest.updateEnabledRulesets({
                  enableRulesetIds: [
                    'ads_and_trackers',
                    'regional_eu_filters',
                    'easyprivacy_trackers',
                    'tracker_param_stripping',
                    'cryptominers_and_heavy_scripts'
                  ],
                  disableRulesetIds: []
                });
              }
            } catch (e) {}
            try {
              chrome.runtime.sendMessage({ type: 'VERIFY_LICENSE', key: canonicalKey }).catch(() => {});
            } catch (e) {}
            return { ok: true, valid: true, licenseKey: canonicalKey, ramTamerActive: true, settings: newSettings };
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

  let popupActivationInFlight = false;

  async function handlePopupActivate() {
    if (popupActivationInFlight) return;
    const key = (licenseKeyInput.value || '').trim();
    if (!key) {
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#ef4444';
      licenseFeedbackEl.textContent = 'Please paste your SWEEPR-DB-... license key or ptk_ pairing token first.';
      return;
    }
    if (!FULL_LICENSE_KEY_RE.test(key) && !PAIRING_TOKEN_RE.test(key)) {
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#ef4444';
      licenseFeedbackEl.textContent = 'Enter your full SWEEPR-DB-XXXX-XXXX-XXXX license key or ptk_ pairing token.';
      return;
    }
    popupActivationInFlight = true;
    activateKeyBtn.textContent = '...';
    activateKeyBtn.disabled = true;
    licenseFeedbackEl.style.display = 'block';
    licenseFeedbackEl.style.color = '#9ca3af';
    licenseFeedbackEl.textContent = 'Verifying subscription...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, async (res) => {
      try {
        const finalRes =
          res && typeof res === 'object' ? res : await directVerifyFromPopup(key);
        activateKeyBtn.textContent = 'Unlock';
        activateKeyBtn.disabled = false;
        if (finalRes && finalRes.ok && finalRes.valid) {
          await chrome.storage.local.set({ draftLicenseKey: '', licenseDrawerOpen: false });
          currentState.proActive = true;
          currentState.ramTamerActive = true;
          currentState.settings =
            (finalRes && finalRes.settings) || {
              cookieAutoClose: true,
              trackerProtection: true,
              adBlocking: true,
              silentMode: true,
              autoRamTamer: true,
              cloudTabSyncEnabled: true
            };
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = '#10b981';
          licenseFeedbackEl.textContent = '✓ Pro Activated! All protection features are ON.';
          renderState(currentState);
          chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (freshState) => {
            if (freshState) renderState(freshState);
          });
        } else {
          if (!(finalRes && finalRes.networkError && currentState.proActive)) {
            currentState.proActive = false;
          }
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = '#ef4444';
          licenseFeedbackEl.textContent =
            (finalRes && finalRes.error) || '✗ Invalid or unpaid license key.';
          renderState(currentState);
        }
      } finally {
        popupActivationInFlight = false;
      }
    });
  }

  activateKeyBtn.addEventListener('click', handlePopupActivate);
  if (popupChromeAutoVerifyBtn && hasChromeIdentity) {
    popupChromeAutoVerifyBtn.addEventListener('click', () => {
      if (popupActivationInFlight) return;
      popupActivationInFlight = true;
      popupChromeAutoVerifyBtn.disabled = true;
      popupChromeAutoVerifyBtn.textContent = 'Checking Chrome account...';
      licenseFeedbackEl.style.display = 'block';
      licenseFeedbackEl.style.color = '#9ca3af';
      licenseFeedbackEl.textContent = 'Verifying paid subscription via Google account...';
      chrome.runtime.sendMessage({ type: 'CHROME_GOOGLE_AUTO_ACTIVATE', interactive: true }, (res) => {
        popupActivationInFlight = false;
        popupChromeAutoVerifyBtn.disabled = false;
        popupChromeAutoVerifyBtn.textContent = 'Verify with Chrome Google account';
        if (res && res.ok && res.valid) {
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = '#10b981';
          licenseFeedbackEl.textContent = '✓ Pro Activated via Chrome account!';
          chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (freshState) => {
            if (freshState) renderState(freshState);
          });
        } else {
          licenseFeedbackEl.style.display = 'block';
          licenseFeedbackEl.style.color = res && res.reason === 'device_limit_reached' ? '#d97706' : '#ef4444';
          licenseFeedbackEl.textContent =
            (res && res.error) || 'No active paid subscription matches this Chrome Google account.';
        }
      });
    });
  }
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
  let popupQrRunId = 0;

  function stopPopupQrPolling() {
    popupQrRunId += 1;
    if (popupQrPollTimer) {
      clearInterval(popupQrPollTimer);
      popupQrPollTimer = null;
    }
  }

  window.addEventListener('pagehide', stopPopupQrPolling);
  window.addEventListener('unload', stopPopupQrPolling);

  function setPopupQrPlaceholder(text, color) {
    if (!popupQrSvg) return;
    popupQrSvg.textContent = '';
    const span = document.createElement('span');
    span.style.fontSize = '10px';
    span.style.color = color;
    span.textContent = text;
    popupQrSvg.appendChild(span);
  }

  async function startPopupQrChallenge() {
    if (!popupQrBox || !popupQrSvg || !popupQrStatus) return;
    stopPopupQrPolling();
    const runId = popupQrRunId;
    popupQrBox.style.display = 'block';
    setPopupQrPlaceholder('Generating...', '#6b7280');
    popupQrStatus.textContent = 'Creating secure 120s QR challenge...';

    const stored = await chrome.storage.local.get(['deviceId']);
    const deviceId =
      stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
        ? stored.deviceId
        : createExtDeviceId();
    await chrome.storage.local.set({ deviceId });

    const baseOrigins = [
      'https://sweeprdeepblock.com'
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
      setPopupQrPlaceholder('Offline', '#ef4444');
      popupQrStatus.textContent = 'Could not reach server. Try again.';
      return;
    }

    popupQrSvg.textContent = '';
    if (
      typeof challengeData.qr_svg === 'string' &&
      challengeData.qr_svg.trim().startsWith('<svg') &&
      !/<script|foreignObject|\bon[a-z]+\s*=/i.test(challengeData.qr_svg)
    ) {
      const qrImg = document.createElement('img');
      qrImg.alt = 'SWEEPR Pairing QR Code';
      qrImg.style.width = '100%';
      qrImg.style.height = '100%';
      qrImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(challengeData.qr_svg);
      popupQrSvg.appendChild(qrImg);
    }
    let rem = Number(challengeData.expires_in) || 120;
    popupQrStatus.textContent = `Scan with phone • Expires in ${rem}s`;

    popupQrPollTimer = setInterval(async () => {
      if (runId !== popupQrRunId) {
        clearInterval(popupQrPollTimer);
        return;
      }
      rem = Math.max(0, rem - 2);
      if (rem <= 0) {
        stopPopupQrPolling();
        popupQrStatus.textContent = 'QR expired — click Refresh QR.';
        return;
      }
      popupQrStatus.textContent = `Scan with phone • Expires in ${rem}s`;
      try {
        const pollRes = await fetch(
          `${activeOrigin}/api/device-link/poll?challenge_id=${encodeURIComponent(challengeData.challenge_id)}&poll_secret=${encodeURIComponent(challengeData.poll_secret)}`
        );
        const pollData = await pollRes.json().catch(() => ({}));
        if (runId !== popupQrRunId) return;
        if (pollRes.ok && pollData && pollData.status === 'approved' && pollData.licenseKey) {
          stopPopupQrPolling();
          const newSettings = {
            cookieAutoClose: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true,
            autoRamTamer: true,
            cloudTabSyncEnabled: true
          };
          await chrome.storage.local.set({
            deviceId,
            proActive: true,
            ramTamerActive: true,
            licenseKey: pollData.licenseKey,
            draftLicenseKey: '',
            licenseDrawerOpen: false,
            crmAccountId: pollData.account_id || '',
            subscriptionStatus: 'active',
            plan: pollData.plan || 'annual',
            licenseExpiresAt: pollData.expiresAt || '',
            trialExpiresAt: 0,
            bonusProDaysEarned: Number(pollData.bonusProDaysEarned || 0),
            licenseVerifiedAt: Date.now(),
            settings: newSettings
          });
          try {
            if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
              await chrome.declarativeNetRequest.updateEnabledRulesets({
                enableRulesetIds: [
                  'ads_and_trackers',
                  'regional_eu_filters',
                  'easyprivacy_trackers',
                  'tracker_param_stripping',
                  'cryptominers_and_heavy_scripts'
                ],
                disableRulesetIds: []
              });
            }
          } catch (e) {}
          try {
            chrome.runtime.sendMessage({ type: 'VERIFY_LICENSE', key: pollData.licenseKey }).catch(() => {});
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

  // Slide-Over Popup Menu (Option 1): 6 Core Engines + Saved Sessions & Site Lists
  function setPopupMenuVisible(showMenu) {
    if (!popupMainView || !popupMenuView) return;
    popupMainView.style.display = showMenu ? 'none' : 'block';
    popupMenuView.style.display = showMenu ? 'block' : 'none';
    if (showMenu) renderPopupMenu(currentState);
  }

  function setPopupMenuTab(tabName) {
    const isEngines = tabName !== 'lists';
    if (popupMenuTabEngines) popupMenuTabEngines.classList.toggle('active', isEngines);
    if (popupMenuTabLists) popupMenuTabLists.classList.toggle('active', !isEngines);
    if (popupEnginesPane) popupEnginesPane.style.display = isEngines ? 'block' : 'none';
    if (popupListsPane) popupListsPane.style.display = isEngines ? 'none' : 'block';
  }

  function setPopupListSubTab(subTab) {
    if (popupListTabsBar) {
      popupListTabsBar.querySelectorAll('[data-popup-list-tab]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-popup-list-tab') === subTab);
      });
    }
    const map = {
      sessions: popupSessionsList,
      paused: popupPausedList,
      pinned: popupPinnedList,
      hidden: popupHiddenList
    };
    Object.entries(map).forEach(([id, el]) => {
      if (el) el.style.display = id === subTab ? 'block' : 'none';
    });
  }

  function makeEmptyRow(text) {
    const empty = document.createElement('div');
    empty.className = 'popup-list-empty';
    empty.textContent = text;
    return empty;
  }

  function renderPopupMenu(state) {
    const st = state || currentState || {};
    const isPro = Boolean(st.proActive) && !deriveTrialState(st).isTrialExpired;
    const settings = st.settings || {};

    document.querySelectorAll('#popupEnginesPane [data-setting]').forEach((sw) => {
      const key = sw.getAttribute('data-setting');
      if (!isPro) {
        sw.textContent = 'PRO';
        sw.className = 'switch-btn pro-lock';
        return;
      }
      sw.textContent = '';
      sw.className = settings[key] !== false ? 'switch-btn' : 'switch-btn off';
    });

    const sessions = Array.isArray(st.cloudTabSessions) ? st.cloudTabSessions : [];
    const pausedSites = Array.isArray(st.pausedSites) ? st.pausedSites : [];
    const pinnedSites = Array.isArray(st.neverSnoozeSites) ? st.neverSnoozeSites : [];
    const hiddenMap = (st.customHiddenSelectors && typeof st.customHiddenSelectors === 'object') ? st.customHiddenSelectors : {};
    const hiddenDomains = Object.keys(hiddenMap).filter((d) => Array.isArray(hiddenMap[d]) && hiddenMap[d].length > 0);

    if (popupSessionsList) {
      popupSessionsList.textContent = '';
      if (sessions.length === 0) {
        const emptyHint =
          !isTouchDevice && snoozeShortcutLabel
            ? `No saved sessions yet. Press ${snoozeShortcutLabel} to snooze idle tabs.`
            : 'No saved sessions yet. Click "Boost Browser Speed Now" to snooze idle tabs.';
        popupSessionsList.appendChild(makeEmptyRow(emptyHint));
      } else {
        sessions.forEach((sess) => {
          const row = document.createElement('div');
          row.className = 'popup-list-row';
          const lbl = document.createElement('span');
          lbl.textContent = `${sess.savedAt || 'Earlier'} (${Number(sess.tabCount) || 0} tabs)`;
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'popup-mini-btn';
          act.textContent = 'Reopen';
          act.addEventListener('click', () => {
            act.textContent = 'Opening...';
            chrome.runtime.sendMessage({ type: 'RESTORE_SAVED_SESSION', sessionId: sess.id }, (res) => {
              if (res && res.requiresPro) {
                act.textContent = 'Reopen';
                currentState.proActive = false;
                setPopupMenuVisible(false);
                renderState(currentState);
                openProRequiredPrompt(res.error);
                return;
              }
              act.textContent = 'Reopened';
            });
          });
          row.appendChild(lbl);
          row.appendChild(act);
          popupSessionsList.appendChild(row);
        });
      }
    }

    if (popupPausedList) {
      popupPausedList.textContent = '';
      if (pausedSites.length === 0) {
        popupPausedList.appendChild(makeEmptyRow('Protection is active on all websites.'));
      } else {
        pausedSites.forEach((domain) => {
          const row = document.createElement('div');
          row.className = 'popup-list-row';
          const lbl = document.createElement('span');
          lbl.textContent = domain;
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'popup-mini-btn';
          act.textContent = 'Resume';
          act.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'TOGGLE_SITE_PAUSE', hostname: domain }, (res) => {
              if (res && res.ok) {
                currentState.pausedSites = res.pausedSites;
                updateSiteBarState();
                renderPopupMenu(currentState);
              }
            });
          });
          row.appendChild(lbl);
          row.appendChild(act);
          popupPausedList.appendChild(row);
        });
      }
    }

    if (popupPinnedList) {
      popupPinnedList.textContent = '';
      if (currentHostname) {
        const currentPinned = pinnedSites.includes(currentHostname);
        const curRow = document.createElement('div');
        curRow.className = 'popup-list-row';
        const curLbl = document.createElement('span');
        curLbl.textContent = `Current: ${currentHostname}`;
        const curAct = document.createElement('button');
        curAct.type = 'button';
        curAct.className = 'popup-mini-btn';
        curAct.textContent = currentPinned ? 'Pinned Awake ✓' : 'Keep this site awake';
        curAct.addEventListener('click', () => {
          if (!isUiProActive()) {
            if (currentState.proActive) {
              currentState.proActive = false;
              renderState(currentState);
            }
            setPopupMenuVisible(false);
            openProRequiredPrompt();
            return;
          }
          chrome.runtime.sendMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: currentHostname }, (res) => {
            if (res && res.ok) {
              currentState.neverSnoozeSites = res.neverSnoozeSites;
              updateSiteBarState();
              renderPopupMenu(currentState);
            }
          });
        });
        curRow.appendChild(curLbl);
        curRow.appendChild(curAct);
        popupPinnedList.appendChild(curRow);
      }
      if (pinnedSites.length === 0 && !currentHostname) {
        popupPinnedList.appendChild(makeEmptyRow('No sites pinned awake yet.'));
      } else if (pinnedSites.length === 0) {
        popupPinnedList.appendChild(makeEmptyRow('No other sites pinned awake.'));
      } else {
        pinnedSites.forEach((domain) => {
          if (domain === currentHostname) return;
          const row = document.createElement('div');
          row.className = 'popup-list-row';
          const lbl = document.createElement('span');
          lbl.textContent = domain;
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'popup-mini-btn';
          act.textContent = 'Allow Snooze';
          act.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'TOGGLE_NEVER_SNOOZE_SITE', hostname: domain }, (res) => {
              if (res && res.ok) {
                currentState.neverSnoozeSites = res.neverSnoozeSites;
                updateSiteBarState();
                renderPopupMenu(currentState);
              }
            });
          });
          row.appendChild(lbl);
          row.appendChild(act);
          popupPinnedList.appendChild(row);
        });
      }
    }

    if (popupHiddenList) {
      popupHiddenList.textContent = '';
      if (hiddenDomains.length === 0) {
        popupHiddenList.appendChild(makeEmptyRow('No custom hidden elements yet.'));
      } else {
        hiddenDomains.forEach((domain) => {
          const cnt = hiddenMap[domain].length;
          const row = document.createElement('div');
          row.className = 'popup-list-row';
          const lbl = document.createElement('span');
          lbl.textContent = `${domain} (${cnt})`;
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'popup-mini-btn';
          act.textContent = 'Restore';
          act.addEventListener('click', () => {
            delete hiddenMap[domain];
            chrome.storage.local.set({ customHiddenSelectors: hiddenMap }, () => {
              currentState.customHiddenSelectors = hiddenMap;
              renderPopupMenu(currentState);
            });
          });
          row.appendChild(lbl);
          row.appendChild(act);
          popupHiddenList.appendChild(row);
        });
      }
    }
  }

  document.querySelectorAll('#popupEnginesPane [data-popup-setting]').forEach((row) => {
    row.addEventListener('click', () => {
      const settingKey = row.getAttribute('data-popup-setting');
      if (!settingKey) return;
      if (!isUiProActive()) {
        if (currentState.proActive) {
          currentState.proActive = false;
          renderState(currentState);
        }
        setPopupMenuVisible(false);
        openProRequiredPrompt();
        return;
      }
      chrome.runtime.sendMessage({ type: 'TOGGLE_SETTING', settingKey }, (res) => {
        if (res && res.requiresPro) {
          currentState.proActive = false;
          setPopupMenuVisible(false);
          renderState(currentState);
          openProRequiredPrompt(res.error);
          return;
        }
        if (res && res.ok && res.settings) {
          currentState.settings = res.settings;
          renderPopupMenu(currentState);
        }
      });
    });
  });

  if (popupMenuTabEngines) popupMenuTabEngines.addEventListener('click', () => setPopupMenuTab('engines'));
  if (popupMenuTabLists) popupMenuTabLists.addEventListener('click', () => setPopupMenuTab('lists'));
  if (popupMenuBackBtn) popupMenuBackBtn.addEventListener('click', () => setPopupMenuVisible(false));
  if (popupOpenWelcomeBtn) popupOpenWelcomeBtn.addEventListener('click', openFullDashboard);
  if (popupListTabsBar) {
    popupListTabsBar.querySelectorAll('[data-popup-list-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setPopupListSubTab(btn.getAttribute('data-popup-list-tab')));
    });
  }

  if (openDashboardBtn) openDashboardBtn.addEventListener('click', () => setPopupMenuVisible(true));
  if (openFullSessionsBtn) {
    openFullSessionsBtn.addEventListener('click', () => {
      setPopupMenuTab('lists');
      setPopupListSubTab('sessions');
      setPopupMenuVisible(true);
    });
  }
  if (openCustomModulesBtn) openCustomModulesBtn.addEventListener('click', () => setPopupMenuVisible(true));

  if (openTestLabBtn) {
    openTestLabBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://sweeprdeepblock.com/test-lab?utm_source=extension&utm_medium=popup' });
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes) return;
      if (changes.proActive || changes.subscriptionStatus || changes.trialExpiresAt || changes.licenseExpiresAt || changes.plan) {
        chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (freshState) => {
          if (freshState) renderState(freshState);
        });
      }
    });
  }

  const trialCountdownInterval = setInterval(() => {
    const info = deriveTrialState(currentState);
    if (info.isActiveTrial || info.isTrialExpired) {
      const liveExpired =
        Boolean(currentState.proActive) &&
        (info.isTrialExpired || (info.expiresAtMs > 0 && Date.now() >= info.expiresAtMs));
      if (liveExpired) {
        currentState.proActive = false;
        renderState(currentState);
        chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (freshState) => {
          if (freshState) renderState(freshState);
        });
      } else {
        renderState(currentState);
      }
    }
  }, 60000);
  const stopCountdownTimer = () => {
    clearInterval(trialCountdownInterval);
  };
  window.addEventListener('pagehide', stopCountdownTimer);
  window.addEventListener('unload', stopCountdownTimer);
});
