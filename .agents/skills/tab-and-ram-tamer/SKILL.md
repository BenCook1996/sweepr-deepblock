---
name: tab-and-ram-tamer
description: >-
  Use this skill when building or optimizing the "Total Tab & RAM Tamer" Browser Memory Optimizer
  paid add-on, including the live RAM Speedometer diagnostic hook, smart background tab hibernation,
  crypto-miner blocking, and cloud tab session crash recovery.
---

# Total Tab & RAM Tamer — Browser Memory Optimizer Skill

## 1. The Free Diagnostic Hook: Live RAM Speedometer Gauge
- Query `chrome.tabs.query({})` and `chrome.system.memory.getInfo()` (with realistic per-tab memory footprint estimation based on tab count, media state, and heavy domains when `chrome.processes` is unavailable in stable channels).
- Display a live visual **Speedometer Gauge** in the extension popup and `welcome.html`:
  - *"Your [N] open tabs are currently consuming [X.X] GB of RAM and slowing your PC down by [Y]%. Click here to reclaim memory without losing your tabs."*
- Color-code the gauge: Emerald (`< 3.0 GB`), Amber (`3.0–5.5 GB`), Red (`> 5.5 GB`).

## 2. Smart Background Tab Suspension (`chrome.tabs.discard`)
- **Zero-Loss Hibernation:** When the **Total Tab & RAM Tamer** add-on is active (or triggered via 1-Click "Reclaim RAM Now"), iterate through background tabs (`!tab.active`) that have been inactive beyond the user's threshold (default: 15 minutes).
- **Safety Exclusions (Never Suspend):**
  - Active tab (`tab.active === true`)
  - Pinned tabs (`tab.pinned === true`)
  - Tabs currently playing audio or video (`tab.audible === true`)
  - Whitelisted domains or tabs with unsaved form input
- Call `chrome.tabs.discard(tab.id)` to release 85%–95% of each background tab's memory footprint while keeping the tab title and favicon intact in the browser strip.

## 3. Crypto-Miner & Runaway Script Blocker
- Block WebAssembly/WebWorker crypto-mining scripts and runaway background ad-refresh loops that spike CPU usage and laptop fan noise.

## 4. Automated Cloud Tab Session Vault & Crash Recovery
- Periodically snapshot open tab groups (`title`, `url`, `favIconUrl`, `windowId`, `timestamp`) into `chrome.storage.local` and `chrome.storage.sync` (up to quota limits) so users can restore any crashed or closed workspace in 1 click.
