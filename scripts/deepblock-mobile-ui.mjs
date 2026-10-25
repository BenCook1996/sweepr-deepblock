export const DEEPBLOCK_ANDROID_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>SWEEPR Deepblock</title>
<style>
  :root[data-theme="light"] {
    --bg: #f8fafc;
    --bg-elevated: #ffffff;
    --bg-subtle: #f1f5f9;
    --bg-glass: rgba(255, 255, 255, 0.92);
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --accent: #059669;
    --accent-bright: #10b981;
    --accent-soft: rgba(16, 185, 129, 0.12);
    --accent-border: rgba(16, 185, 129, 0.32);
    --accent-text: #065f46;
    --btn-text: #ffffff;
    --shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.04);
    --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.07);
    --input-bg: #ffffff;
    --danger: #dc2626;
    --danger-soft: rgba(220, 38, 38, 0.1);
  }
  :root[data-theme="dark"] {
    --bg: #0b1220;
    --bg-elevated: #131c31;
    --bg-subtle: #1e293b;
    --bg-glass: rgba(19, 28, 49, 0.94);
    --text: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    --border: rgba(148, 163, 184, 0.16);
    --border-strong: rgba(148, 163, 184, 0.28);
    --accent: #10b981;
    --accent-bright: #34d399;
    --accent-soft: rgba(16, 185, 129, 0.16);
    --accent-border: rgba(16, 185, 129, 0.35);
    --accent-text: #6ee7b7;
    --btn-text: #022c22;
    --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.25);
    --shadow-md: 0 12px 28px rgba(0, 0, 0, 0.4);
    --input-bg: #0f172a;
    --danger: #f87171;
    --danger-soft: rgba(248, 113, 113, 0.15);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 70px 16px 96px;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--bg-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    z-index: 100;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 900;
    font-size: 16px;
    letter-spacing: -0.02em;
  }
  .logo {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, #10b981, #059669);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge {
    font-size: 11px;
    font-weight: 800;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-text);
    border: 1px solid var(--accent-border);
    white-space: nowrap;
  }

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 150;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .drawer-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }
  .drawer {
    position: fixed;
    top: 60px;
    left: 12px;
    right: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 12px;
    z-index: 160;
    box-shadow: var(--shadow-md);
    transform: translateY(-12px);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .drawer.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }
  .drawer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
  }
  .drawer-item:hover, .drawer-item.active {
    background: var(--bg-subtle);
  }
  .drawer-item-left {
    display: flex;
    align-items: center;
    gap: 11px;
  }
  .drawer-divider {
    height: 1px;
    background: var(--border);
    margin: 6px 0;
  }

  .container {
    max-width: 520px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .view-section {
    display: none;
    flex-direction: column;
    gap: 14px;
  }
  .view-section.active {
    display: flex;
  }
  .card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 18px;
    box-shadow: var(--shadow-sm);
  }
  .card-title {
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-sub {
    font-size: 12.5px;
    color: var(--text-muted);
    line-height: 1.5;
    margin-top: 4px;
  }

  .shield-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 22px 16px 18px;
  }
  .shield-orb {
    width: 84px;
    height: 84px;
    border-radius: 26px;
    background: var(--accent-soft);
    border: 2px solid var(--accent-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    margin-bottom: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13.5px;
    font-weight: 700;
  }
  .row:last-child {
    border-bottom: none;
  }

  .btn {
    width: 100%;
    padding: 13px 16px;
    border-radius: 13px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: var(--btn-text);
    font-weight: 800;
    font-size: 13.5px;
    margin-top: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
  }
  .btn-secondary {
    background: var(--bg-subtle);
    color: var(--text);
    border: 1px solid var(--border-strong);
    box-shadow: none;
  }

  .field-label {
    display: block;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--text-secondary);
    margin-top: 12px;
    margin-bottom: 5px;
  }
  input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border-strong);
    background: var(--input-bg);
    color: var(--text);
    font-size: 13.5px;
  }
  .msg-box {
    font-size: 12px;
    margin-top: 10px;
    line-height: 1.45;
    font-weight: 600;
  }

  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 68px;
    background: var(--bg-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 6px 8px 10px;
    z-index: 100;
  }
  .nav-tab {
    border: none;
    background: transparent;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 12px;
    cursor: pointer;
  }
  .nav-tab.active {
    color: var(--accent);
  }
</style>
</head>
<body>

  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn" onclick="toggleDrawer()" aria-label="Open Navigation Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="brand">
        <div class="logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div>SWEEPR <span style="color:var(--accent)">Deepblock</span></div>
      </div>
    </div>
    <div class="topbar-right">
      <span id="proBadge" class="badge">Locked</span>
      <button class="icon-btn" onclick="toggleTheme()" id="themeBtn" aria-label="Toggle Light/Dark Mode">
        <svg id="themeIconSun" style="display:none" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg id="themeIconMoon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </header>

  <div id="drawerBackdrop" class="drawer-backdrop" onclick="closeDrawer()"></div>
  <nav id="drawerMenu" class="drawer">
    <button class="drawer-item active" data-nav="shield" onclick="switchTab('shield')">
      <span class="drawer-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Ad &amp; Tracker Shield
      </span>
      <span style="font-size:11px;color:var(--text-muted)">Home</span>
    </button>
    <button class="drawer-item" data-nav="filters" onclick="switchTab('filters')">
      <span class="drawer-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Protection Filters
      </span>
      <span style="font-size:11px;color:var(--text-muted)">Active</span>
    </button>
    <button class="drawer-item" data-nav="dns" onclick="switchTab('dns')">
      <span class="drawer-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
        Android Private DNS Setup
      </span>
      <span style="font-size:11px;color:var(--text-muted)">System</span>
    </button>
    <button class="drawer-item" data-nav="account" onclick="switchTab('account')">
      <span class="drawer-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Account &amp; License Activation
      </span>
      <span style="font-size:11px;color:var(--text-muted)">3 Devices</span>
    </button>
    <div class="drawer-divider"></div>
    <button class="drawer-item" onclick="toggleTheme(); closeDrawer();">
      <span class="drawer-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2"/></svg>
        Appearance Mode
      </span>
      <span id="drawerThemeLabel" style="font-size:11px;font-weight:800;color:var(--accent)">Light Mode</span>
    </button>
  </nav>

  <main class="container">
    <section id="view-shield" class="view-section active">
      <div class="card shield-hero">
        <div class="shield-orb">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div style="font-size:17px;font-weight:900">Android System-Wide Ad &amp; Tracker Shield</div>
        <p class="card-sub" style="max-width:340px">Blocks video ads, in-app tracking pixels, cookie pop-ups, and fake scam shops across all Android browsers and apps.</p>
        <button class="btn" onclick="enableAndroidDnsShield()">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          1-Tap Enable Android Private DNS Shield
        </button>
        <div id="dnsMsg" class="msg-box"></div>
      </div>

      <div class="card">
        <div class="card-title">Live Shield Modules</div>
        <div style="margin-top:8px">
          <div class="row"><span>Video &amp; Banner Ad Blocker</span><span style="color:var(--accent)">Active</span></div>
          <div class="row"><span>Cookie Consent Auto-Closer</span><span style="color:var(--accent)">Active</span></div>
          <div class="row"><span>Fake Store &amp; Phishing Guard</span><span style="color:var(--accent)">Active</span></div>
        </div>
      </div>
    </section>

    <section id="view-filters" class="view-section">
      <div class="card">
        <div class="card-title">Protection Filter Lists</div>
        <p class="card-sub">Updated automatically to block intrusive trackers, pre-roll video ads, and malicious domains.</p>
        <div style="margin-top:10px">
          <div class="row"><span>SWEEPR Core Ad &amp; Script Shield</span><span style="color:var(--accent)">Enabled</span></div>
          <div class="row"><span>In-App Telemetry &amp; SDK Blocker</span><span style="color:var(--accent)">Enabled</span></div>
          <div class="row"><span>GDPR / Cookie Banner Annoyances</span><span style="color:var(--accent)">Enabled</span></div>
          <div class="row"><span>Malware, Scam &amp; Phishing Domains</span><span style="color:var(--accent)">Enabled</span></div>
        </div>
      </div>
    </section>

    <section id="view-dns" class="view-section">
      <div class="card">
        <div class="card-title">Android Private DNS Configuration</div>
        <p class="card-sub">Tap below to copy the SWEEPR Deepblock Private DNS hostname and open Android Network settings.</p>
        <button class="btn" onclick="enableAndroidDnsShield()">Copy DNS Hostname &amp; Open Settings</button>
        <button class="btn btn-secondary" onclick="if(window.SweeprAndroid){window.SweeprAndroid.openWirelessSettings();}">Open Android Network Settings</button>
      </div>
    </section>

    <section id="view-account" class="view-section">
      <div class="card">
        <div class="card-title">Activate Device</div>
        <p class="card-sub">Purchased on desktop first? Log in at <strong>sweeprdeepblock.com/login</strong> to scan your QR code or paste your <code>ptk_...</code> pairing code or 6-digit code below (up to 3 devices).</p>
        <label class="field-label" for="codeInput">License Key or Pairing Code</label>
        <input id="codeInput" placeholder="SWEEPR-DB-XXXX or ptk_... or 6-digit code" autocomplete="off" />
        <label class="field-label" for="emailInput">Account Email</label>
        <input id="emailInput" type="email" placeholder="you@example.com" autocomplete="email" />
        <button class="btn" onclick="activateDeepblock()">Activate Pro on This Android Device</button>
        <div id="actMsg" class="msg-box"></div>
      </div>

      <div class="card">
        <div class="card-title">Appearance</div>
        <p class="card-sub">Light mode is enabled by default. Switch between Light Mode and Dark Mode anytime.</p>
        <button class="btn btn-secondary" onclick="toggleTheme()">
          <span id="accountThemeBtnText">Switch to Dark Mode</span>
        </button>
      </div>
    </section>
  </main>

  <nav class="bottom-nav">
    <button class="nav-tab active" data-tab="shield" onclick="switchTab('shield')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Shield</span>
    </button>
    <button class="nav-tab" data-tab="filters" onclick="switchTab('filters')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      <span>Filters</span>
    </button>
    <button class="nav-tab" data-tab="dns" onclick="switchTab('dns')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <span>Private DNS</span>
    </button>
    <button class="nav-tab" data-tab="account" onclick="switchTab('account')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Account</span>
    </button>
  </nav>

<script>
const API_BASE = 'https://sweeprdeepblock.com';

function applyTheme(theme) {
  const clean = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', clean);
  localStorage.setItem('sweepr_db_theme', clean);
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  const drawerLbl = document.getElementById('drawerThemeLabel');
  const accBtn = document.getElementById('accountThemeBtnText');
  if (clean === 'dark') {
    if (sun) sun.style.display = 'block';
    if (moon) moon.style.display = 'none';
    if (drawerLbl) drawerLbl.textContent = 'Dark Mode';
    if (accBtn) accBtn.textContent = 'Switch to Light Mode';
  } else {
    if (sun) sun.style.display = 'none';
    if (moon) moon.style.display = 'block';
    if (drawerLbl) drawerLbl.textContent = 'Light Mode';
    if (accBtn) accBtn.textContent = 'Switch to Dark Mode';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

function toggleDrawer() {
  document.getElementById('drawerMenu').classList.toggle('open');
  document.getElementById('drawerBackdrop').classList.toggle('open');
}

function closeDrawer() {
  document.getElementById('drawerMenu').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

function switchTab(tabId) {
  closeDrawer();
  document.querySelectorAll('.view-section').forEach(el => {
    el.classList.toggle('active', el.id === 'view-' + tabId);
  });
  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.drawer-item[data-nav]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-nav') === tabId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getDeviceId() {
  let id = localStorage.getItem('sweepr_db_and_id');
  if (!id) {
    id = 'db_and_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('sweepr_db_and_id', id);
  }
  return id;
}

function enableAndroidDnsShield() {
  const key = localStorage.getItem('sweepr_db_key');
  const msg = document.getElementById('dnsMsg');
  if (!key) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Please activate your Pro subscription in the Account tab first to unlock the Android DNS Shield.';
    switchTab('account');
    return;
  }
  if (window.SweeprAndroid) {
    window.SweeprAndroid.copyText('dns.adguard-dns.com');
    window.SweeprAndroid.openWirelessSettings();
  }
  msg.style.color = 'var(--accent)';
  msg.textContent = 'Copied dns.adguard-dns.com to clipboard! In Network & Internet -> Private DNS, paste it and tap Save.';
}

async function activateDeepblock() {
  const raw = (document.getElementById('codeInput').value || '').trim();
  const email = (document.getElementById('emailInput').value || '').trim();
  const msg = document.getElementById('actMsg');
  if (!raw) { msg.style.color='var(--danger)'; msg.textContent='Enter your license key, 6-digit code, or ptk_ pairing code.'; return; }
  msg.style.color='var(--text-muted)'; msg.textContent='Verifying subscription...';
  try {
    const ptkMatch = raw.match(/ptk_[A-Za-z0-9_-]{12,64}/);
    let res, data;
    if (ptkMatch) {
      res = await fetch(API_BASE + '/api/device-link/redeem-token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ token: ptkMatch[0], device_id: getDeviceId(), device_name: 'Android Phone', platform: 'android' })
      });
      data = await res.json();
    } else {
      res = await fetch(API_BASE + '/api/verify-key', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ key: raw, email, device_id: getDeviceId(), device_name: 'Android Phone', os: 'android' })
      });
      data = await res.json();
    }
    if (res.ok && (data.ok || data.valid)) {
      const k = data.license_key || data.licenseKey || raw;
      localStorage.setItem('sweepr_db_key', k);
      document.getElementById('proBadge').textContent = 'PRO ACTIVE';
      msg.style.color='var(--accent)';
      msg.textContent='Pro Activated! Returning to Shield...';
      setTimeout(() => switchTab('shield'), 900);
    } else {
      msg.style.color='var(--danger)';
      msg.textContent = data.message || data.error || 'Invalid activation code.';
    }
  } catch (e) {
    msg.style.color='var(--danger)';
    msg.textContent = 'Network error connecting to sweeprdeepblock.com.';
  }
}

(function init() {
  const savedTheme = localStorage.getItem('sweepr_db_theme') || 'light';
  applyTheme(savedTheme);
  if (localStorage.getItem('sweepr_db_key')) {
    document.getElementById('codeInput').value = localStorage.getItem('sweepr_db_key');
    document.getElementById('proBadge').textContent = 'PRO ACTIVE';
  }
})();
</script>
</body>
</html>`;
