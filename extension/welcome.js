// SWEEPR Deepblock — Welcome Screen Controller
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('welcomeLicenseInput');
  const btn = document.getElementById('welcomeActivateBtn');
  const feedback = document.getElementById('welcomeKeyFeedback');

  if (!btn || !input || !feedback) return;

  btn.addEventListener('click', () => {
    const key = (input.value || '').trim();
    if (!key) {
      feedback.style.display = 'block';
      feedback.style.color = '#dc2626';
      feedback.textContent = 'Please paste your license key first.';
      return;
    }

    btn.textContent = 'Verifying...';
    btn.disabled = true;
    feedback.style.display = 'block';
    feedback.style.color = '#6b7280';
    feedback.textContent = 'Checking active subscription status...';

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key }, (res) => {
      btn.disabled = false;
      if (res && res.ok && res.valid) {
        feedback.style.display = 'block';
        feedback.style.color = '#059669';
        feedback.textContent = '✓ Paid Pro Subscription Verified! All features are now active across your browser.';
        btn.textContent = '✓ Activated';
      } else {
        btn.textContent = 'Unlock Pro Now';
        feedback.style.display = 'block';
        feedback.style.color = '#dc2626';
        feedback.textContent =
          (res && res.error) || '✗ Invalid or unpaid license key. Please complete checkout first.';
      }
    });
  });
});
