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

    chrome.runtime.sendMessage({ type: 'ACTIVATE_LICENSE', licenseKey: key, ramTamerActive: true }, (res) => {
      if (res && res.ok) {
        feedback.style.display = 'block';
        feedback.style.color = '#059669';
        feedback.textContent = '✓ Pro Protection Unlocked! All features are now active across your browser.';
        btn.textContent = '✓ Activated';
      }
    });
  });
});
