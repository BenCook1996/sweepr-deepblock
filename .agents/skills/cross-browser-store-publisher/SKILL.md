---
name: cross-browser-store-publisher
description: >-
  Use this skill when packaging, auditing, or submitting the extension to the Chrome Web Store,
  Microsoft Edge Add-ons, Mozilla Firefox AMO, or Apple Safari App Store.
---

# Cross-Browser Extension Store Publisher & Compliance Skill

## Store Review Compliance Rules (Zero-Rejection Checklist)

1. **Single-Purpose & Narrow Permissions Policy (Chrome Web Store & Edge)**
   - Declare only permissions strictly utilized by active code:
     - `declarativeNetRequest`, `declarativeNetRequestWithHostAccess` (Ad, tracker & URL param filtering)
     - `storage`, `alarms` (Settings, diagnostic counters, tab hibernation timers, session snapshots)
     - `tabs`, `system.memory` (Live RAM Speedometer & `chrome.tabs.discard` tab hibernation)
   - Never bundle remotely hosted executable JS (`eval`, remote `<script src="...">` inside extension pages) — all MV3 logic must reside in the package; only declarative JSON filter data and license status may be fetched via HTTPS.

2. **Cross-Browser Build Targets**
   - **Chromium (Chrome, Brave, Edge, Opera, Vivaldi):** Uses `background.service_worker` in `manifest.json`.
   - **Firefox (Mozilla AMO):** Add `browser_specific_settings.gecko.id` and `background.scripts` fallback for seamless Gecko compatibility.
   - **Safari (macOS & iOS App Store):** Run `xcrun safari-web-extension-converter ./extension` to generate the native Xcode wrapper project.
