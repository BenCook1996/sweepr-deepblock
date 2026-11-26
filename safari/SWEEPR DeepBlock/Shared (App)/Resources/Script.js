/* Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved. */
function show(platform, enabled, useSettingsInsteadOfPreferences) {
  document.body.classList.remove('platform-mac', 'platform-ios', 'is-enabled', 'is-disabled');
  document.body.classList.add(`platform-${platform}`);

  if (typeof enabled === 'boolean') {
    document.body.classList.add(enabled ? 'is-enabled' : 'is-disabled');
  }

  if (platform === 'mac') {
    const button = document.querySelector('button.open-preferences');
    if (button) {
      button.textContent = useSettingsInsteadOfPreferences
        ? 'Quit and Open Safari Settings...'
        : 'Quit and Open Safari Extensions Preferences...';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('button.open-preferences');
  if (button) {
    button.addEventListener('click', () => {
      if (window.webkit?.messageHandlers?.controller) {
        window.webkit.messageHandlers.controller.postMessage('open-preferences');
      }
    });
  }
});
