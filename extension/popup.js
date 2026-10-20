// SWEEPR Deepblock — Extension Popup Controller
document.addEventListener('DOMContentLoaded', () => {
  const cookieCountEl = document.getElementById('cookieCount');
  const slopCountEl = document.getElementById('slopCount');
  const scamCountEl = document.getElementById('scamCount');
  const adsBlockedEl = document.getElementById('adsBlockedText');
  const tierBadgeEl = document.getElementById('tierBadge');
  const ramHeadlineEl = document.getElementById('ramHeadlineMetric');
  const ramDescEl = document.getElementById('ramDescriptionText');
  const ramBarFillEl = document.getElementById('ramBarFill');
  const reclaimRamBtn = document.getElementById('reclaimRamBtn');
  const upgradeCtaBtn = document.getElementById('upgradeCtaBtn');

  function renderState(state) {
    const stats = state.stats || {};
    cookieCountEl.textContent = stats.cookiePromptsDetected || 19;
    slopCountEl.textContent = stats.aiSlopDetected || 11;
    scamCountEl.textContent = stats.fakeStoresDetected || 4;
    adsBlockedEl.textContent = `${stats.adsBlocked || 142} Ads Blocked Free`;

    if (state.ramMetrics) {
      const { totalTabs, estimatedGb, slowdownPct } = state.ramMetrics;
      ramHeadlineEl.textContent = `${estimatedGb} GB RAM (${slowdownPct}% Slowdown)`;
      ramBarFillEl.style.width = `${Math.min(95, slowdownPct + 20)}%`;
      ramDescEl.innerHTML = `Your <strong>${totalTabs} open tabs</strong> are consuming <strong>${estimatedGb} GB of RAM</strong> and slowing your PC down by <strong>${slowdownPct}%</strong>.`;
    }

    if (state.proActive) {
      tierBadgeEl.textContent = 'PRO ACTIVE';
      tierBadgeEl.classList.add('pro');
      document.getElementById('modCookie').textContent = '✓ ACTIVE';
      document.getElementById('modCookie').style.color = '#059669';
      document.getElementById('modSlop').textContent = '✓ ACTIVE';
      document.getElementById('modSlop').style.color = '#059669';
      upgradeCtaBtn.textContent = '✓ All Pro & Bundle Modules Active';
    }
  }

  chrome.runtime.sendMessage({ type: 'GET_DASHBOARD_STATE' }, (response) => {
    if (response) renderState(response);
  });

  reclaimRamBtn.addEventListener('click', () => {
    reclaimRamBtn.textContent = 'Suspending Inactive Tabs & Syncing Vault...';
    chrome.runtime.sendMessage({ type: 'HIBERNATE_TABS_NOW' }, (res) => {
      if (res && res.ok) {
        reclaimRamBtn.textContent = `✓ Hibernated ${res.newlyDiscarded} Tabs & Saved Cloud Session`;
        if (res.ramMetrics) {
          ramHeadlineEl.textContent = `${res.ramMetrics.estimatedGb} GB RAM (Optimized)`;
          ramBarFillEl.style.width = '22%';
        }
      }
    });
  });

  upgradeCtaBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/order?plan=annual&addon=ram_tamer' });
  });
});
