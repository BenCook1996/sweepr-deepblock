// SWEEPR Deepblock — Full-Tab Dashboard & Options Controller (Option 1 Zero-Travel Ergonomics)
const WELCOME_VERIFY_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/license-verify'
];

const WELCOME_REDEEM_ENDPOINTS = [
  'https://sweeprdeepblock.com/api/device-link/redeem'
];

const FULL_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
const PAIRING_TOKEN_RE = /^ptk_[A-Za-z0-9_-]{12,64}$/;
const hasChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.storage.local);
const hasChromeRuntime = typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.sendMessage);

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

async function directVerifyAndPersistLicense(rawKey) {
  const key = String(rawKey || '').trim();
  const ptkMatch = key.match(/ptk_[A-Za-z0-9_-]{12,64}/);
  if (!ptkMatch && !FULL_LICENSE_KEY_RE.test(key)) {
    return { ok: false, valid: false, error: 'Please enter a full SWEEPR-DB-XXXX-XXXX-XXXX license key or ptk_ pairing token.' };
  }
  const stored = hasChromeStorage ? await chrome.storage.local.get(['deviceId']) : {};
  const deviceId =
    stored && typeof stored.deviceId === 'string' && stored.deviceId.startsWith('ext_db_')
      ? stored.deviceId
      : createExtDeviceId();
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
          const canonicalKey = d.licenseKey || d.license_key || '';
          if (!canonicalKey || canonicalKey.startsWith('ptk_')) continue;
          const settings = {
            cookieAutoClose: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true,
            autoRamTamer: true,
            cloudTabSyncEnabled: true
          };
          if (hasChromeStorage) {
            await chrome.storage.local.set({
              deviceId,
              proActive: true,
              ramTamerActive: true,
              licenseKey: canonicalKey,
              draftLicenseKey: '',
              licenseDrawerOpen: false,
              subscriptionStatus: 'active',
              plan: d.plan || 'annual',
              licenseExpiresAt: d.expiresAt || '',
              trialExpiresAt: 0,
              bonusProDaysEarned: Number(d.bonusProDaysEarned || 0),
              licenseVerifiedAt: Date.now(),
              settings
            });
          }
          if (hasChromeRuntime) {
            try {
              chrome.runtime.sendMessage({ type: 'VERIFY_LICENSE', key: canonicalKey }).catch(() => {});
            } catch (e) {}
          }
          return { ok: true, valid: true, licenseKey: canonicalKey, ramTamerActive: true, settings };
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
          const ramTamerActive = true;
          const canonicalKey = data.licenseKey || data.license_key || key;
          const settings = {
            cookieAutoClose: true,
            trackerProtection: true,
            adBlocking: true,
            silentMode: true,
            autoRamTamer: true,
            cloudTabSyncEnabled: true
          };
          const isTrialPlan = subStatus === 'trialing' || String(data.plan || '').toLowerCase() === 'trial_7d';
          const resolvedTrialExp = isTrialPlan ? Number(data.trialExpiresAt || 0) : 0;
          if (hasChromeStorage) {
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
              trialExpiresAt: resolvedTrialExp,
              ...(isTrialPlan && data.trialStartedAt ? { trialStartedAt: Number(data.trialStartedAt) } : {}),
              bonusProDaysEarned: Number(data.bonusProDaysEarned || 0),
              licenseVerifiedAt: Date.now(),
              settings
            });
          }
          try {
            if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
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
          return {
            ok: true,
            valid: true,
            licenseKey: canonicalKey,
            ramTamerActive: true,
            status: subStatus,
            plan: data.plan || 'annual',
            expiresAt: data.expiresAt || '',
            trialExpiresAt: resolvedTrialExp,
            bonusProDaysEarned: Number(data.bonusProDaysEarned || 0),
            settings
          };
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
  const pasteBtn = document.getElementById('welcomePasteBtn');
  const tabKeyBtn = document.getElementById('welcomeTabKey');
  const tabBuyBtn = document.getElementById('welcomeTabBuy');
  const panelKey = document.getElementById('welcomePanelKey');
  const panelBuy = document.getElementById('welcomePanelBuy');
  const inlineTrialBtn = document.getElementById('welcomeInlineTrialBtn');
  const feedback = document.getElementById('welcomeKeyFeedback');
  const badge = document.getElementById('welcomeStatusBadge');
  const welcomeTrialBanner = document.getElementById('welcomeTrialBanner');
  const welcomeTrialBannerTitle = document.getElementById('welcomeTrialBannerTitle');
  const welcomeTrialBannerDesc = document.getElementById('welcomeTrialBannerDesc');
  const welcomeBuyTitle = document.getElementById('welcomeBuyTitle');
  const welcomeBuyDesc = document.getElementById('welcomeBuyDesc');
  const welcomeBuyCtaText = document.getElementById('welcomeBuyCtaText');
  const welcomeHostPermBanner = document.getElementById('welcomeHostPermBanner');
  const welcomeGrantPermBtn = document.getElementById('welcomeGrantPermBtn');
  const welcomeShortcutsFooter = document.getElementById('welcomeShortcutsFooter');
  const welcomeChromeAutoBanner = document.getElementById('welcomeChromeAutoBanner');
  const welcomeChromeAutoBannerText = document.getElementById('welcomeChromeAutoBannerText');
  const welcomeChromeAutoPortalLink = document.getElementById('welcomeChromeAutoPortalLink');
  const welcomeChromeAutoVerifyBtn = document.getElementById('welcomeChromeAutoVerifyBtn');
  const hasChromeIdentity =
    typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function';

  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      try {
        const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
      } catch (e) {}
    });
  }

  const isTouchWelcome =
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));
  if (welcomeShortcutsFooter) {
    if (isTouchWelcome) {
      welcomeShortcutsFooter.style.display = 'none';
    } else if (typeof chrome !== 'undefined' && chrome.commands && typeof chrome.commands.getAll === 'function') {
      try {
        chrome.commands.getAll((cmds) => {
          if (!Array.isArray(cmds)) return;
          document.querySelectorAll('[data-kbd-cmd]').forEach((kbdEl) => {
            const name = kbdEl.getAttribute('data-kbd-cmd');
            const match = cmds.find((c) => c.name === name);
            if (match && match.shortcut) {
              kbdEl.textContent = match.shortcut;
            } else if (kbdEl.parentElement) {
              kbdEl.parentElement.style.display = 'none';
            }
          });
        });
      } catch (e) {}
    }
  }

  if (typeof chrome !== 'undefined' && chrome.permissions && typeof chrome.permissions.contains === 'function' && welcomeHostPermBanner) {
    try {
      chrome.permissions.contains({ origins: ['<all_urls>'] }, (granted) => {
        welcomeHostPermBanner.style.display = granted ? 'none' : 'flex';
      });
    } catch (e) {}
  }

  if (welcomeGrantPermBtn && typeof chrome !== 'undefined' && chrome.permissions && typeof chrome.permissions.request === 'function') {
    welcomeGrantPermBtn.addEventListener('click', () => {
      try {
        chrome.permissions.request({ origins: ['<all_urls>'] }, (granted) => {
          if (welcomeHostPermBanner) {
            welcomeHostPermBanner.style.display = granted ? 'none' : 'flex';
          }
          if (hasChromeRuntime) {
            try {
              chrome.runtime.sendMessage({ type: 'CHECK_HOST_PERMISSIONS', granted: Boolean(granted) }, () => {});
            } catch (e) {}
          }
        });
      } catch (e) {}
    });
  }

  function setActiveWelcomeTab(tab, focusInput = false) {
    if (!tabKeyBtn || !tabBuyBtn || !panelKey || !panelBuy) return;
    if (tab === 'key') {
      tabKeyBtn.classList.add('active');
      tabBuyBtn.classList.remove('active');
      panelKey.classList.remove('hidden');
      panelBuy.classList.add('hidden');
      if (focusInput && input) input.focus();
    } else {
      tabBuyBtn.classList.add('active');
      tabKeyBtn.classList.remove('active');
      panelBuy.classList.remove('hidden');
      panelKey.classList.add('hidden');
    }
  }

  if (tabKeyBtn && tabBuyBtn && panelKey && panelBuy) {
    tabKeyBtn.addEventListener('click', () => setActiveWelcomeTab('key', true));
    tabBuyBtn.addEventListener('click', () => setActiveWelcomeTab('buy', false));
  }

  let dashboardState = {
    proActive: false,
    subscriptionStatus: 'unactivated',
    plan: '',
    trialStartedAt: 0,
    trialExpiresAt: 0,
    settings: {}
  };

  if (!btn || !input || !feedback) return;

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

  function formatRemainingVerbose(expMs) {
    const diff = Number(expMs) - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) return '0 hours remaining';
    const totalHours = Math.floor(diff / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'} remaining`;
    }
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
    return 'Less than 1 hour remaining';
  }

  function deriveWelcomeTrialState(stored) {
    const st = stored || {};
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
    const remainingText = isActiveTrial && expMs > 0 ? formatRemainingVerbose(expMs) : '';
    return { isPro, isActiveTrial, isTrialExpired, expiresAtMs: expMs, remainingText };
  }

  function markProActivated(licenseKey, settings) {
    dashboardState.proActive = true;
    dashboardState.licenseKey = licenseKey || dashboardState.licenseKey || input.value.trim();
    if (settings) dashboardState.settings = settings;
    if (welcomeTrialBanner) welcomeTrialBanner.style.display = 'none';
    setActiveWelcomeTab('key', false);
    if (inlineTrialBtn && inlineTrialBtn.parentElement) {
      inlineTrialBtn.parentElement.style.display = 'none';
    }
    feedback.style.display = 'block';
    feedback.style.color = '#10b981';
    feedback.textContent =
      '✓ Paid Pro Subscription Verified! All protection features are now active across your browser.';
    btn.textContent = '✓ Pro Protection Active';
    btn.style.background = '#047857';
    if (badge) {
      badge.className = 'badge';
      badge.textContent = 'Pro subscription active — all modules unlocked';
    }
    if (licenseKey && !input.value) {
      input.value = licenseKey;
    }
    if (welcomeChromeAutoVerifyBtn) {
      welcomeChromeAutoVerifyBtn.style.display = 'none';
    }
  }

  function renderWelcomeState(stored) {
    dashboardState = { ...dashboardState, ...(stored || {}) };
    const info = deriveWelcomeTrialState(dashboardState);
    if (info.isActiveTrial && dashboardState.plan !== 'referral_trial_14d') {
      if (badge) {
        badge.className = 'badge';
        badge.textContent = info.remainingText
          ? `7-Day Pro Trial · ${info.remainingText}`
          : '7-Day Pro Trial Active';
      }
      if (welcomeTrialBanner && welcomeTrialBannerTitle && welcomeTrialBannerDesc) {
        welcomeTrialBanner.className = 'trial-banner';
        welcomeTrialBanner.style.display = 'block';
        welcomeTrialBannerTitle.textContent = info.remainingText
          ? `7-Day Full Pro Trial Active — ${info.remainingText}`
          : '7-Day Full Pro Trial Active';
        welcomeTrialBannerDesc.textContent =
          'No card required. YouTube Shield, 160+ CMP Cookie Auto-Reject + Scroll Unlock, OTA Delta, RAM Tamer, and 5-device sync are active now.';
      }
      if (welcomeBuyTitle) welcomeBuyTitle.textContent = 'Upgrade to Full Pro Anytime';
      if (welcomeBuyDesc) {
        welcomeBuyDesc.textContent =
          'Keep uninterrupted YouTube Shield, Cookie Auto-Reject, OTA filter updates, RAM Tamer, and 5-device sync after your 7-day trial.';
      }
      if (welcomeBuyCtaText) welcomeBuyCtaText.textContent = 'Upgrade to Pro Protection';
      if (inlineTrialBtn && inlineTrialBtn.parentElement) {
        inlineTrialBtn.parentElement.style.display = '';
      }
      btn.textContent = 'Activate Paid License Key';
      btn.style.background = '';
      setActiveWelcomeTab('buy', false);
      renderChromeAutoBanner(dashboardState.chromeAutoActivateResult, true);
      return;
    }

    if (info.isTrialExpired) {
      dashboardState.proActive = false;
      if (badge) {
        badge.className = 'badge expired';
        badge.textContent = 'Trial Expired — Upgrade to Pro';
      }
      if (welcomeTrialBanner && welcomeTrialBannerTitle && welcomeTrialBannerDesc) {
        welcomeTrialBanner.className = 'trial-banner expired';
        welcomeTrialBanner.style.display = 'block';
        welcomeTrialBannerTitle.textContent = 'Your 7-Day Pro Trial Has Expired';
        welcomeTrialBannerDesc.textContent =
          'Pro features (YouTube Shield, Cookie Auto-Reject + Scroll Unlock, OTA Delta, RAM Tamer & 5-device sync) are paused. Upgrade or enter a paid license key to restore full protection.';
      }
      if (welcomeBuyTitle) welcomeBuyTitle.textContent = 'Your 7-Day Pro Trial Has Expired';
      if (welcomeBuyDesc) {
        welcomeBuyDesc.textContent =
          'Upgrade now to immediately re-enable YouTube Shield, Cookie Auto-Reject + Scroll Unlock, OTA Delta, RAM Tamer, and 5-device sync.';
      }
      if (welcomeBuyCtaText) welcomeBuyCtaText.textContent = 'Upgrade to Restore Pro Protection';
      if (inlineTrialBtn && inlineTrialBtn.parentElement) {
        inlineTrialBtn.parentElement.style.display = '';
      }
      btn.textContent = 'Activate Pro Protection';
      btn.style.background = '';
      if (dashboardState.draftLicenseKey && !input.value) {
        input.value = dashboardState.draftLicenseKey;
      }
      setActiveWelcomeTab('buy', false);
      renderChromeAutoBanner(dashboardState.chromeAutoActivateResult, false);
      return;
    }

    if (dashboardState.proActive && dashboardState.licenseKey) {
      markProActivated(dashboardState.licenseKey, dashboardState.settings);
      renderChromeAutoBanner(dashboardState.chromeAutoActivateResult, true);
      return;
    }

    if (welcomeTrialBanner) welcomeTrialBanner.style.display = 'none';
    if (badge) {
      badge.className = 'badge';
      badge.textContent = 'Extension installed — activate Pro';
    }
    if (welcomeBuyTitle) welcomeBuyTitle.textContent = 'Unlock SWEEPR Deepblock Pro';
    if (welcomeBuyDesc) {
      welcomeBuyDesc.textContent =
        'Block YouTube and web ads, auto-reject cookie banners, strip URL trackers, and hibernate background tabs across up to 5 devices.';
    }
    if (welcomeBuyCtaText) welcomeBuyCtaText.textContent = 'Unlock Full Pro Protection';
    if (dashboardState.licenseKey || dashboardState.draftLicenseKey) {
      if (!input.value) {
        input.value = dashboardState.licenseKey || dashboardState.draftLicenseKey;
      }
      setActiveWelcomeTab('key', false);
    } else {
      setActiveWelcomeTab('buy', false);
    }
    renderChromeAutoBanner(dashboardState.chromeAutoActivateResult, false);
  }

  function renderChromeAutoBanner(autoRes, isProActive) {
    if (!welcomeChromeAutoBanner || !welcomeChromeAutoBannerText) return;
    if (!autoRes || typeof autoRes !== 'object') {
      welcomeChromeAutoBanner.style.display = 'none';
      return;
    }
    if (autoRes.status === 'activated' && isProActive) {
      const expText = autoRes.expiresAt
        ? ` · active until ${new Date(autoRes.expiresAt).toLocaleDateString()}`
        : '';
      const slotsText =
        autoRes.devicesUsed && autoRes.devicesMax
          ? ` (${autoRes.devicesUsed}/${autoRes.devicesMax} devices)`
          : '';
      const whoText = autoRes.emailMasked ? ` for ${autoRes.emailMasked}` : '';
      welcomeChromeAutoBanner.style.display = 'flex';
      welcomeChromeAutoBanner.style.background = '#ecfdf5';
      welcomeChromeAutoBanner.style.borderColor = '#a7f3d0';
      welcomeChromeAutoBanner.style.color = '#065f46';
      welcomeChromeAutoBannerText.textContent = `✓ Pro automatically verified${whoText}${slotsText}${expText}.`;
      if (welcomeChromeAutoPortalLink) welcomeChromeAutoPortalLink.style.display = 'none';
      return;
    }
    if (autoRes.status === 'device_limit_reached' && !isProActive) {
      const whoText = autoRes.emailMasked ? ` (${autoRes.emailMasked})` : '';
      const countText =
        autoRes.devicesUsed && autoRes.devicesMax ? ` (${autoRes.devicesUsed}/${autoRes.devicesMax} devices)` : '';
      welcomeChromeAutoBanner.style.display = 'flex';
      welcomeChromeAutoBanner.style.background = '#fffbeb';
      welcomeChromeAutoBanner.style.borderColor = '#f59e0b';
      welcomeChromeAutoBanner.style.color = '#92400e';
      welcomeChromeAutoBannerText.textContent = `Paid Pro subscription found${whoText}, but all device slots are in use${countText}. Remove an unused device to activate this Chrome profile.`;
      if (welcomeChromeAutoPortalLink) welcomeChromeAutoPortalLink.style.display = 'inline-block';
      return;
    }
    welcomeChromeAutoBanner.style.display = 'none';
  }

  if (welcomeChromeAutoVerifyBtn) {
    if (hasChromeIdentity) {
      welcomeChromeAutoVerifyBtn.style.display = 'flex';
    }
    welcomeChromeAutoVerifyBtn.addEventListener('click', () => {
      if (!hasChromeRuntime || welcomeActivationInFlight) return;
      welcomeActivationInFlight = true;
      welcomeChromeAutoVerifyBtn.disabled = true;
      const origText = welcomeChromeAutoVerifyBtn.textContent;
      welcomeChromeAutoVerifyBtn.textContent = 'Checking Chrome Google account...';
      feedback.style.display = 'block';
      feedback.style.color = '#9ca3af';
      feedback.textContent = 'Verifying paid subscription via Google account...';
      chrome.runtime.sendMessage({ type: 'CHROME_GOOGLE_AUTO_ACTIVATE', interactive: true }, async (res) => {
        try {
          welcomeChromeAutoVerifyBtn.disabled = false;
          welcomeChromeAutoVerifyBtn.textContent = origText;
          if (res && res.ok && res.valid) {
            markProActivated(res.licenseKey, res.settings);
            renderChromeAutoBanner({
              status: 'activated',
              emailMasked: res.emailMasked || '',
              expiresAt: res.expiresAt || '',
              devicesUsed: res.devicesUsed,
              devicesMax: res.devicesMax
            }, true);
          } else {
            if (res && res.reason === 'device_limit_reached') {
              renderChromeAutoBanner({
                status: 'device_limit_reached',
                emailMasked: res.emailMasked || '',
                devicesUsed: res.devicesUsed,
                devicesMax: res.devicesMax
              }, false);
            }
            feedback.style.display = 'block';
            feedback.style.color = res && res.reason === 'device_limit_reached' ? '#d97706' : '#ef4444';
            feedback.textContent =
              (res && res.error) || 'No active paid SWEEPR DeepBlock subscription found for this Chrome Google account.';
          }
        } finally {
          welcomeActivationInFlight = false;
        }
      });
    });
  }

  const WELCOME_STATE_KEYS = [
    'proActive',
    'licenseKey',
    'draftLicenseKey',
    'settings',
    'chromeAutoActivateResult',
    'subscriptionStatus',
    'plan',
    'trialStartedAt',
    'trialExpiresAt',
    'licenseExpiresAt'
  ];

  if (hasChromeStorage) {
    chrome.storage.local.get(WELCOME_STATE_KEYS, (stored) => {
      renderWelcomeState(stored || {});
    });

    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes) return;
        if (
          changes.proActive ||
          changes.subscriptionStatus ||
          changes.trialExpiresAt ||
          changes.licenseExpiresAt ||
          changes.plan ||
          changes.licenseKey
        ) {
          chrome.storage.local.get(WELCOME_STATE_KEYS, (s) => {
            renderWelcomeState(s || {});
          });
        } else if (changes.chromeAutoActivateResult && changes.chromeAutoActivateResult.newValue) {
          renderChromeAutoBanner(changes.chromeAutoActivateResult.newValue, Boolean(dashboardState.proActive));
        }
      });
    }
  } else {
    setActiveWelcomeTab('buy', false);
  }

  const welcomeTrialInterval = setInterval(() => {
    const info = deriveWelcomeTrialState(dashboardState);
    if (info.isActiveTrial || info.isTrialExpired) {
      renderWelcomeState(dashboardState);
    }
  }, 60000);
  const stopWelcomeInterval = () => clearInterval(welcomeTrialInterval);
  window.addEventListener('pagehide', stopWelcomeInterval);
  window.addEventListener('unload', stopWelcomeInterval);

  let welcomeActivationInFlight = false;

  async function applyActivationResult(finalRes, key) {
    btn.disabled = false;
    if (finalRes && finalRes.ok && finalRes.valid) {
      const planLower = String(finalRes.plan || 'annual').toLowerCase();
      const statusLower = String(finalRes.status || 'active').toLowerCase();
      if (planLower === 'trial_7d' || statusLower === 'trialing') {
        renderWelcomeState({
          ...dashboardState,
          proActive: true,
          licenseKey: finalRes.licenseKey || key,
          plan: finalRes.plan || 'trial_7d',
          subscriptionStatus: finalRes.status || 'trialing',
          trialExpiresAt: Number(finalRes.trialExpiresAt || dashboardState.trialExpiresAt || 0),
          licenseExpiresAt: finalRes.expiresAt || dashboardState.licenseExpiresAt || '',
          settings: finalRes.settings || dashboardState.settings
        });
        return;
      }
      dashboardState.plan = finalRes.plan || 'annual';
      dashboardState.subscriptionStatus = finalRes.status || 'active';
      dashboardState.trialExpiresAt = 0;
      markProActivated(finalRes.licenseKey || key, finalRes.settings || {
        cookieAutoClose: true,
        trackerProtection: true,
        adBlocking: true,
        silentMode: true,
        autoRamTamer: true,
        cloudTabSyncEnabled: true
      });
    } else {
      btn.textContent = 'Activate Pro Protection';
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent =
        (finalRes && finalRes.error) ||
        '✗ Invalid or unpaid license key. Please complete checkout first.';
    }
  }

  async function handleActivate() {
    if (welcomeActivationInFlight) return;
    const key = (input.value || '').trim();
    if (!key) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Please paste your SWEEPR-DB-... license key or ptk_ pairing token first.';
      return;
    }
    if (!FULL_LICENSE_KEY_RE.test(key) && !PAIRING_TOKEN_RE.test(key)) {
      feedback.style.display = 'block';
      feedback.style.color = '#ef4444';
      feedback.textContent = 'Enter your full SWEEPR-DB-XXXX-XXXX-XXXX license key or ptk_ pairing token.';
      return;
    }

    welcomeActivationInFlight = true;
    btn.textContent = 'Verifying...';
    btn.disabled = true;
    feedback.style.display = 'block';
    feedback.style.color = '#9ca3af';
    feedback.textContent = 'Checking active subscription status...';

    if (hasChromeRuntime) {
      chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, async (res) => {
        try {
          const finalRes =
            res && typeof res === 'object' ? res : await directVerifyAndPersistLicense(key);
          await applyActivationResult(finalRes, key);
        } finally {
          welcomeActivationInFlight = false;
        }
      });
    } else {
      try {
        const finalRes = await directVerifyAndPersistLicense(key);
        await applyActivationResult(finalRes, key);
      } finally {
        welcomeActivationInFlight = false;
      }
    }
  }

  if (pasteBtn && input) {
    pasteBtn.addEventListener('click', async () => {
      let pastedText = '';
      let clipboardFailed = false;
      try {
        pastedText = await navigator.clipboard.readText();
      } catch (err1) {
        clipboardFailed = true;
        if (typeof chrome !== 'undefined' && chrome.permissions && typeof chrome.permissions.request === 'function') {
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
        input.value = pastedText.trim();
        handleActivate();
        return;
      }
      if ((input.value || '').trim()) {
        handleActivate();
        return;
      }
      input.focus();
      if (clipboardFailed && feedback) {
        const isMac = typeof navigator !== 'undefined' && /Mac|Darwin/i.test(navigator.platform || '');
        feedback.style.display = 'block';
        feedback.style.color = '#d97706';
        feedback.textContent = isMac
          ? 'Clipboard blocked — click the field and press ⌘V to paste your key.'
          : 'Clipboard blocked — click the field and press Ctrl+V to paste your key.';
      }
    });
  }

  input.addEventListener('input', () => {
    const raw = (input.value || '').trim();
    if (hasChromeStorage) {
      chrome.storage.local.set({ draftLicenseKey: input.value });
    }
    if ((!dashboardState.proActive || dashboardState.plan === 'trial_7d') && raw !== dashboardState.licenseKey) {
      if (FULL_LICENSE_KEY_RE.test(raw) || PAIRING_TOKEN_RE.test(raw)) {
        feedback.style.display = 'block';
        feedback.style.color = '#059669';
        feedback.textContent = 'Verifying license key automatically...';
        handleActivate();
      } else if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#94a3b8';
        feedback.textContent = 'Found in your welcome email or Customer Portal.';
      }
    }
  });

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

  const SUPPORT_TOPIC_CONFIG = {
    'Ad Blocking Report': {
      category: 'ad_report',
      placeholder: 'Include the website URL where ads or popups appeared...'
    },
    'License Key Activation': {
      category: 'activation_key',
      placeholder: 'Include your checkout email or SWEEPR-DB-... license key...'
    },
    'Billing or Refund Request': {
      category: 'billing_refund',
      placeholder: 'Include your checkout email or invoice number...'
    },
    'General Question': {
      category: 'general',
      placeholder: 'Include website URL or details so our team can help...'
    }
  };
  let selectedSupportCategory = 'general';

  const welcomeSupportChipsWrap = document.getElementById('welcomeSupportChips');
  if (welcomeSupportChipsWrap) {
    const presetTopics = new Set();
    welcomeSupportChipsWrap.querySelectorAll('[data-support-topic]').forEach((chip) => {
      const val = chip.getAttribute('data-support-topic') || '';
      if (val) presetTopics.add(val);
    });
    welcomeSupportChipsWrap.querySelectorAll('[data-support-topic]').forEach((chip) => {
      chip.addEventListener('click', () => {
        welcomeSupportChipsWrap.querySelectorAll('[data-support-topic]').forEach((b) => {
          const isTarget = b === chip;
          b.classList.toggle('active', isTarget);
          b.setAttribute('aria-checked', isTarget ? 'true' : 'false');
        });
        const topic = chip.getAttribute('data-support-topic') || '';
        const topicCfg = SUPPORT_TOPIC_CONFIG[topic] || SUPPORT_TOPIC_CONFIG['General Question'];
        selectedSupportCategory = topicCfg.category;
        if (supportMessageEl && topicCfg.placeholder) {
          supportMessageEl.placeholder = topicCfg.placeholder;
        }
        if (supportSubjectEl && topic) {
          let customSuffix = (supportSubjectEl.value || '').trim();
          for (const preset of presetTopics) {
            if (customSuffix.toLowerCase() === preset.toLowerCase()) {
              customSuffix = '';
              break;
            }
            const prefix = `${preset}: `;
            if (customSuffix.toLowerCase().startsWith(prefix.toLowerCase())) {
              customSuffix = customSuffix.slice(prefix.length).trim();
              break;
            }
          }
          supportSubjectEl.value = customSuffix ? `${topic}: ${customSuffix}` : topic;
        }
      });
    });
  }

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
        category: selectedSupportCategory,
        os: 'browser_extension'
      };
      const supportUrls = [
        'https://sweeprdeepblock.com/api/support',
        'https://sweepr-crm-production.up.railway.app/api/support/contact'
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
          if (r.ok && d && (d.ok || d.ticket_number || d.ticket_id || d.id)) {
            sentOk = true;
            ticketId = d.ticket_id || d.ticket_number || d.id || '';
            break;
          }
        } catch (e) {}
      }

      supportSendBtn.disabled = false;
      supportSendBtn.textContent = 'Send Message to Support';
      if (sentOk) {
        supportMessageEl.value = '';
        if (supportSubjectEl) supportSubjectEl.value = '';
        selectedSupportCategory = 'general';
        if (welcomeSupportChipsWrap) {
          welcomeSupportChipsWrap.querySelectorAll('[data-support-topic]').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
        }
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
