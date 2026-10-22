// SWEEPR Deepblock — Welcome Screen Controller
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

  chrome.storage.local.get(['proActive', 'licenseKey'], async (stored) => {
    if (stored && stored.proActive && stored.licenseKey) {
      markProActivated(stored.licenseKey);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search || '');
      let autoKey = (params.get('key') || params.get('code') || '').trim();
      if (!autoKey) {
        const res = await fetch(chrome.runtime.getURL('preactivated-license.json'));
        if (res && res.ok) {
          const data = await res.json();
          autoKey = String((data && (data.licenseKey || data.activation_code || data.key)) || '').trim();
        }
      }
      if (autoKey && autoKey.length >= 6) {
        input.value = autoKey;
        handleActivate();
      }
    } catch (e) {}
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
      // Fallback to direct verification if the service worker was asleep or running an older listener
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
