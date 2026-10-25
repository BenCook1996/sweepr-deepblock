export const DEEPBLOCK_ANDROID_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>SWEEPR Deepblock</title>
<style>
  :root[data-theme="light"] {
    --bg: #f8fafc;
    --card: #ffffff;
    --card-sub: #f1f5f9;
    --glass: rgba(255, 255, 255, 0.94);
    --text: #0f172a;
    --text-sub: #334155;
    --muted: #64748b;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --accent: #059669;
    --accent-bright: #10b981;
    --accent-soft: #d1fae5;
    --accent-fg: #065f46;
    --accent-border: #10b981;
    --orb-off-bg: linear-gradient(145deg, #ffffff, #f1f5f9);
    --orb-off-border: #cbd5e1;
    --orb-off-text: #0f172a;
    --orb-off-ring: rgba(148, 163, 184, 0.14);
    --orb-on-bg: radial-gradient(circle at 30% 30%, #10b981, #059669);
    --orb-on-border: #34d399;
    --orb-on-text: #ffffff;
    --orb-on-ring: rgba(16, 185, 129, 0.16);
    --shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    --input-bg: #ffffff;
  }

  :root[data-theme="dark"] {
    --bg: #070b14;
    --card: #0f172a;
    --card-sub: #1e293b;
    --glass: rgba(15, 23, 42, 0.94);
    --text: #f8fafc;
    --text-sub: #cbd5e1;
    --muted: #94a3b8;
    --border: rgba(148, 163, 184, 0.16);
    --border-strong: rgba(148, 163, 184, 0.32);
    --accent: #10b981;
    --accent-bright: #34d399;
    --accent-soft: rgba(16, 185, 129, 0.16);
    --accent-fg: #34d399;
    --accent-border: rgba(52, 211, 153, 0.45);
    --orb-off-bg: linear-gradient(145deg, #1e293b, #0f172a);
    --orb-off-border: #334155;
    --orb-off-text: #f8fafc;
    --orb-off-ring: rgba(148, 163, 184, 0.1);
    --orb-on-bg: radial-gradient(circle at 30% 30%, #34d399, #059669);
    --orb-on-border: #6ee7b7;
    --orb-on-text: #022c22;
    --orb-on-ring: rgba(16, 185, 129, 0.22);
    --shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    --input-bg: #090d16;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  body {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 66px 16px 86px;
    display: flex;
    flex-direction: column;
    transition: background 0.2s ease, color 0.2s ease;
    user-select: none;
  }

  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 58px;
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    z-index: 100;
  }
  .topbar-left { display: flex; align-items: center; gap: 10px; }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; letter-spacing: -0.02em; }
  .logo {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight: 900;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .topbar-right { display: flex; align-items: center; gap: 8px; }
  .badge {
    font-size: 11px;
    font-weight: 800;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-fg);
    border: 1px solid var(--accent-border);
  }

  .drawer-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 140; display: none; }
  .drawer-backdrop.open { display: block; }
  .drawer {
    position: fixed;
    top: 58px;
    left: 12px;
    right: 12px;
    background: var(--card);
    border: 1px solid var(--border-strong);
    border-radius: 20px;
    padding: 10px;
    z-index: 150;
    box-shadow: var(--shadow);
    display: none;
    flex-direction: column;
    gap: 4px;
  }
  .drawer.open { display: flex; }
  .drawer-item {
    border: none;
    background: transparent;
    color: var(--text);
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    text-align: left;
  }
  .drawer-item.active, .drawer-item:hover { background: var(--card-sub); }

  .view {
    display: none;
    flex-direction: column;
    flex: 1;
    max-width: 460px;
    width: 100%;
    margin: 0 auto;
    gap: 14px;
  }
  .view.active { display: flex; }

  /* Concept 3 Tactile Power Orb Home */
  .c3-status-header { text-align: center; padding-top: 10px; }
  .c3-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 900;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-fg);
    border: 1px solid var(--accent-border);
    letter-spacing: 0.04em;
  }
  .c3-headline { font-size: 22px; font-weight: 900; margin-top: 12px; letter-spacing: -0.02em; }
  .c3-subline { font-size: 13px; color: var(--muted); font-weight: 600; margin-top: 4px; }

  .c3-orb-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 18px 0;
  }
  .c3-power-orb {
    width: 156px;
    height: 156px;
    border-radius: 999px;
    border: 5px solid var(--orb-on-border);
    background: var(--orb-on-bg);
    color: var(--orb-on-text);
    box-shadow: 0 18px 44px rgba(16, 185, 129, 0.36), 0 0 0 14px var(--orb-on-ring);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .c3-power-orb:active { transform: scale(0.94); }
  .c3-orb-label { font-size: 11.5px; font-weight: 900; letter-spacing: 0.06em; }

  .c3-bottom-deck { display: flex; flex-direction: column; gap: 10px; margin-top: auto; }
  .c3-location-card {
    width: 100%;
    background: var(--card);
    border: 1.5px solid var(--border-strong);
    border-radius: 22px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    box-shadow: var(--shadow);
    text-align: left;
    color: var(--text);
  }
  .c3-change-pill {
    padding: 7px 12px;
    border-radius: 11px;
    background: var(--card-sub);
    color: var(--accent-fg);
    font-size: 12px;
    font-weight: 800;
  }
  .c3-metrics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .c3-metric-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
  }

  .card { background: var(--card); border: 1px solid var(--border); border-radius: 22px; padding: 18px; box-shadow: var(--shadow); }
  .input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 13px;
    border: 1px solid var(--border-strong);
    background: var(--input-bg);
    color: var(--text);
    font-size: 13.5px;
    margin-top: 8px;
  }
  .btn-primary {
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight: 900;
    font-size: 14px;
    margin-top: 12px;
    cursor: pointer;
  }

  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 68px;
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 6px 10px 10px;
    gap: 6px;
    z-index: 100;
  }
  .nav-tab {
    border: none;
    background: transparent;
    color: var(--muted);
    border-radius: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }
  .nav-tab.active { color: var(--accent-fg); background: var(--accent-soft); }
</style>
</head>
<body>

  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn" onclick="toggleDrawer()" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="brand">
        <div class="logo">S</div>
        <span>SWEEPR <span style="color:var(--accent)">Deepblock</span></span>
      </div>
    </div>
    <div class="topbar-right">
      <span id="proBadge" class="badge">Ready</span>
      <button class="icon-btn" onclick="toggleTheme()" aria-label="Toggle Light/Dark Mode">
        <svg id="iconSun" style="display:none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg id="iconMoon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </header>

  <div id="drawerBackdrop" class="drawer-backdrop" onclick="closeDrawer()"></div>
  <nav id="drawerMenu" class="drawer">
    <button class="drawer-item active" data-drawer="home" onclick="switchTab('home')"><span>Power Orb Shield</span><span style="font-size:11px;color:var(--muted)">Home</span></button>
    <button class="drawer-item" data-drawer="filters" onclick="switchTab('filters')"><span>Protection Filters</span><span style="font-size:11px;color:var(--muted)">Active</span></button>
    <button class="drawer-item" data-drawer="dns" onclick="switchTab('dns')"><span>System Private DNS</span><span style="font-size:11px;color:var(--muted)">Setup</span></button>
    <button class="drawer-item" data-drawer="account" onclick="switchTab('account')"><span>Profile &amp; License</span><span style="font-size:11px;color:var(--muted)">3 Devices</span></button>
    <button class="drawer-item" onclick="toggleTheme(); closeDrawer();"><span>Appearance Mode</span><span id="drawerThemeText" style="font-size:11px;font-weight:800;color:var(--accent)">Light Mode</span></button>
  </nav>

  <!-- TAB 1: CONCEPT 3 TACTILE POWER ORB HOME -->
  <main id="view-home" class="view active">
    <div class="c3-status-header">
      <div id="statusPill" class="c3-status-pill">SHIELD ON &bull; AD &amp; TRACKER GUARD</div>
      <div id="statusHeadline" class="c3-headline">System Ad Shield Ready</div>
      <div id="statusSubline" class="c3-subline">Blocks video ads, cookie pop-ups &amp; app trackers</div>
    </div>

    <div class="c3-orb-stage">
      <button class="c3-power-orb" onclick="enableAndroidDnsShield()" aria-label="Enable Deepblock Shield">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        <span id="orbLabel" class="c3-orb-label mono">TAP TO ENABLE</span>
      </button>
      <div id="dnsMsg" style="font-size:12px;font-weight:700;text-align:center;margin-top:12px;max-width:320px"></div>
    </div>

    <div class="c3-bottom-deck">
      <button class="c3-location-card" onclick="switchTab('filters')">
        <div>
          <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Active Filter Engine</div>
          <div style="font-size:14.5px;font-weight:900;margin-top:2px">Video Ads, Trackers &amp; Scam Guard</div>
        </div>
        <span class="c3-change-pill">Filters</span>
      </button>

      <div class="c3-metrics-row">
        <div class="c3-metric-box">
          <span style="color:var(--muted)">Rules</span>
          <span class="mono">340,000+</span>
        </div>
        <div class="c3-metric-box">
          <span style="color:var(--muted)">Mode</span>
          <span class="mono" style="color:var(--accent-fg)">Zero-Latency</span>
        </div>
      </div>
    </div>
  </main>

  <section id="view-filters" class="view">
    <div class="card">
      <div style="font-size:17px;font-weight:900;margin-bottom:8px">Active Filter Modules</div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);font-size:13.5px;font-weight:700"><span>Video &amp; Pre-Roll Ad Blocker</span><span style="color:var(--accent-fg)">ACTIVE</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);font-size:13.5px;font-weight:700"><span>Cookie Consent Auto-Closer</span><span style="color:var(--accent-fg)">ACTIVE</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:13.5px;font-weight:700"><span>Fake Shop &amp; Phishing Guard</span><span style="color:var(--accent-fg)">ACTIVE</span></div>
    </div>
  </section>

  <section id="view-dns" class="view">
    <div class="card">
      <div style="font-size:17px;font-weight:900;margin-bottom:6px">Private DNS Shield Setup</div>
      <p style="font-size:12.5px;color:var(--muted);line-height:1.45">Tap below to copy the SWEEPR Deepblock Private DNS hostname and open system network settings.</p>
      <button class="btn-primary" onclick="enableAndroidDnsShield()">1-Tap Copy DNS &amp; Open Settings</button>
    </div>
  </section>

  <section id="view-account" class="view">
    <div class="card">
      <div style="font-size:16px;font-weight:900">Activate Pro Device</div>
      <p style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45">Sign in at <strong>sweeprdeepblock.com/login</strong> to scan your QR code or paste your <code>ptk_...</code> pairing code or license key below (up to 3 devices).</p>
      <input id="codeInput" class="input mono" placeholder="SWEEPR-DB-XXXX or ptk_..." autocomplete="off" />
      <input id="emailInput" class="input" type="email" placeholder="Account Email" autocomplete="email" />
      <button class="btn-primary" onclick="activateDeepblock()">Activate Pro on This Device</button>
      <div id="actMsg" style="font-size:12px;font-weight:700;margin-top:10px"></div>
    </div>
  </section>

  <nav class="bottom-nav">
    <button class="nav-tab active" id="tab-home" onclick="switchTab('home')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
      <span>Connect</span>
    </button>
    <button class="nav-tab" id="tab-filters" onclick="switchTab('filters')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      <span>Filters</span>
    </button>
    <button class="nav-tab" id="tab-dns" onclick="switchTab('dns')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Shields</span>
    </button>
    <button class="nav-tab" id="tab-account" onclick="switchTab('account')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
      <span>Profile</span>
    </button>
  </nav>

<script>
const API_BASE = 'https://sweeprdeepblock.com';

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('iconSun').style.display = isDark ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = isDark ? 'none' : 'block';
  document.getElementById('drawerThemeText').textContent = isDark ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('sweepr_db_theme', isDark ? 'dark' : 'light');
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function toggleDrawer() {
  document.getElementById('drawerMenu').classList.toggle('open');
  document.getElementById('drawerBackdrop').classList.toggle('open');
}

function closeDrawer() {
  document.getElementById('drawerMenu').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

function switchTab(tab) {
  closeDrawer();
  ['home', 'filters', 'dns', 'account'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('active', v === tab);
    document.getElementById('tab-' + v).classList.toggle('active', v === tab);
    const d = document.querySelector('[data-drawer="' + v + '"]');
    if (d) d.classList.toggle('active', v === tab);
  });
}

function getDeviceId() {
  let id = localStorage.getItem('sweepr_db_and_id');
  if (!id) {
    id = 'db_mob_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('sweepr_db_and_id', id);
  }
  return id;
}

function enableAndroidDnsShield() {
  const key = localStorage.getItem('sweepr_db_key');
  const msg = document.getElementById('dnsMsg');
  if (!key) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Activate your Pro key in Profile first to unlock the DNS Shield.';
    switchTab('account');
    return;
  }
  if (window.SweeprAndroid) {
    window.SweeprAndroid.copyText('dns.adguard-dns.com');
    window.SweeprAndroid.openWirelessSettings();
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText('dns.adguard-dns.com');
  }
  document.getElementById('orbLabel').textContent = 'PROTECTED';
  document.getElementById('statusHeadline').textContent = 'Your Browsing is Ad-Free';
  msg.style.color = 'var(--accent-fg)';
  msg.textContent = 'Copied dns.adguard-dns.com! Paste in Network -> Private DNS and Save.';
}

async function activateDeepblock() {
  const raw = (document.getElementById('codeInput').value || '').trim();
  const email = (document.getElementById('emailInput').value || '').trim();
  const msg = document.getElementById('actMsg');
  if (!raw) { msg.style.color='#ef4444'; msg.textContent='Enter your license key or ptk_ pairing code.'; return; }
  msg.style.color='var(--muted)'; msg.textContent='Verifying subscription...';
  try {
    const ptkMatch = raw.match(/ptk_[A-Za-z0-9_-]{12,64}/);
    const url = ptkMatch ? (API_BASE + '/api/device-link/redeem-token') : (API_BASE + '/api/verify-key');
    const payload = ptkMatch
      ? { token: ptkMatch[0], device_id: getDeviceId(), device_name: 'Mobile Phone', platform: 'android' }
      : { key: raw, email, device_id: getDeviceId(), device_name: 'Mobile Phone', os: 'android' };
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok && (data.ok || data.valid)) {
      const k = data.license_key || data.licenseKey || raw;
      localStorage.setItem('sweepr_db_key', k);
      document.getElementById('proBadge').textContent = 'PRO ACTIVE';
      msg.style.color='var(--accent-fg)';
      msg.textContent='Pro Activated! Returning to Power Orb...';
      setTimeout(() => switchTab('home'), 700);
    } else {
      msg.style.color='#ef4444';
      msg.textContent = data.message || data.error || 'Invalid activation code.';
    }
  } catch (e) {
    msg.style.color='#ef4444';
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
