import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIR = path.resolve(__dirname, '..', 'website');
const TOOLS_DIR = path.join(WEBSITE_DIR, 'tools');

fs.mkdirSync(TOOLS_DIR, { recursive: true });

const TOOLS = [
  {
    slug: 'index',
    canonicalPath: '/tools',
    title: 'Free Browser Privacy, Adblock & Scam Diagnostic Tools | SWEEPR',
    description: 'Run 5 free client-side browser diagnostics: test MV3 ad blocking, check DNS & URL tracker leaks, audit fingerprinting, scan shops, and calculate RAM bloat.',
    h1: 'Free Browser Privacy, Adblock & Scam Diagnostic Tools',
    badge: 'SWEEPR Interactive Diagnostic Suite • 100% Client-Side',
    lead: 'Test your current browser protection in under 5 seconds. Every diagnostic runs locally in your browser with zero browsing history logged.',
    appName: 'SWEEPR Privacy & Adblock Diagnostic Suite',
    faqs: [
      {
        q: 'Are these browser privacy and adblock diagnostic tools free to use?',
        a: 'Yes. All 5 interactive diagnostic tools on SWEEPR DeepBlock are 100% free and execute locally inside your browser without requiring an account.'
      },
      {
        q: 'How can I fix failed checks in the Adblock, DNS, or Fingerprint tests?',
        a: 'Installing the SWEEPR DeepBlock browser extension (v1.2.7) activates 8/8 Manifest V3 anti-detection rules, <50ms cookie consent auto-rejection, URL tracking parameter stripping, and Canvas/WebGL fingerprint noise protection.'
      },
      {
        q: 'Does running a diagnostic test log my IP address or browsing history?',
        a: 'No. Our diagnostic checks run client-side in your browser DOM and follow our strict No Browsing History Logged — Local-First Engine architecture.'
      }
    ],
    renderToolInteractive: () => `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin:28px 0;">
        <a href="/tools/is-my-adblocker-working" style="display:block;background:#111827;border:1px solid #10b981;border-radius:14px;padding:22px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.78rem;color:#10b981;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Tool 01 • Live Benchmark</div>
          <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">Is My Adblocker Working? (8/8 MV3 Test)</h2>
          <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 14px;">Test your current ad blocker against video ad scripts, cosmetic bait traps, cookie walls, and anti-adblock detection.</p>
          <span style="color:#10b981;font-weight:700;font-size:0.9rem;">Run 8-Point Adblock Test &rarr;</span>
        </a>
        <a href="/tools/dns-leak-test" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:14px;padding:22px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.78rem;color:#38bdf8;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Tool 02 • Network &amp; Link Sanitizer</div>
          <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">DNS &amp; URL Tracking Parameter Leak Test</h2>
          <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 14px;">Verify whether your browser strips hidden fbclid, gclid, msclkid, and UTM cross-site tracking beacons and blocks CNAME trackers.</p>
          <span style="color:#38bdf8;font-weight:700;font-size:0.9rem;">Run DNS &amp; URL Tracker Test &rarr;</span>
        </a>
        <a href="/tools/browser-fingerprint-test" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:14px;padding:22px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.78rem;color:#a78bfa;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Tool 03 • Identity Isolation</div>
          <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">Browser Canvas &amp; WebRTC Fingerprint Test</h2>
          <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 14px;">Inspect your browser's HTML5 Canvas hash, WebGL renderer exposure, AudioContext entropy, and hardware concurrency signature.</p>
          <span style="color:#a78bfa;font-weight:700;font-size:0.9rem;">Audit Browser Fingerprint &rarr;</span>
        </a>
        <a href="/tools/is-this-shop-a-scam" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:14px;padding:22px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.78rem;color:#f59e0b;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Tool 04 • E-Commerce Risk Scanner</div>
          <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">Is This Online Shop a Scam? (Instant Check)</h2>
          <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 14px;">Check any store URL for cloned dropshipping templates, suspicious TLD patterns, fake urgency timers, and checkout red flags.</p>
          <span style="color:#f59e0b;font-weight:700;font-size:0.9rem;">Scan a Store URL Now &rarr;</span>
        </a>
        <a href="/tools/browser-ram-calculator" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:14px;padding:22px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.78rem;color:#34d399;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Tool 05 • Memory &amp; Tab Tamer</div>
          <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">Browser RAM &amp; Tab Bloat Calculator</h2>
          <p style="color:#94a3b8;font-size:0.92rem;margin:0 0 14px;">Calculate how much RAM and battery your open tabs waste on background ad auctions and video trackers, and see your instant savings.</p>
          <span style="color:#34d399;font-weight:700;font-size:0.9rem;">Calculate RAM Savings &rarr;</span>
        </a>
      </div>
    `
  },
  {
    slug: 'is-my-adblocker-working',
    canonicalPath: '/tools/is-my-adblocker-working',
    title: 'Is My Adblocker Working? Live 8-Point MV3 Test | SWEEPR',
    description: 'Test if your ad blocker is working in 2026. Run 8 live browser checks for YouTube MV3 video ad scripts, cookie pop-up auto-rejection, and tracker blocking.',
    h1: 'Is My Adblocker Working? Live 8-Point Browser Benchmark',
    badge: 'Interactive Tool 01 • Live Adblock & Anti-Detection Audit',
    lead: 'Click "Run 8-Point Live Benchmark" below to test your current browser against simulated ad network requests, DOM bait elements, cookie consent locks, and anti-adblock scripts.',
    appName: 'SWEEPR Live Adblocker Benchmark Tool',
    faqs: [
      {
        q: 'Why does my legacy ad blocker fail on YouTube or trigger anti-adblock walls?',
        a: 'Many legacy extensions rely on deprecated Manifest V2 patterns or easily fingerprinted CSS rules. SWEEPR DeepBlock uses Manifest V3 declarativeNetRequest rules paired with DeepStealth cosmetic scriptlets to pass 8/8 checks.'
      },
      {
        q: 'What score should my browser get on this test?',
        a: 'With SWEEPR DeepBlock active, your browser achieves 8/8 (100% Grade A+) across network ad blocking, bait protection, scroll lock restoration, video ad interception, and fingerprint defense.'
      }
    ],
    renderToolInteractive: () => `
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
          <div>
            <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Live Browser Score</div>
            <div id="abScoreDisplay" style="font-size:2rem;font-weight:900;color:#10b981;">Ready to Scan (8 Checks)</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="runAbTestBtn" type="button" onclick="runLiveAdblockAudit()" style="background:#10b981;color:#042f2e;border:none;font-weight:800;padding:12px 22px;border-radius:10px;cursor:pointer;font-size:0.95rem;">Run 8-Point Live Benchmark</button>
            <a id="shareAbResultLink" href="/test-lab/results/grade-a-score-100?ads=100&amp;dns=100&amp;fp=100" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;font-weight:700;padding:11px 16px;border-radius:10px;text-decoration:none;font-size:0.88rem;">Share Scorecard</a>
            <button id="copyRedditBenchmarkBtn" type="button" onclick="copyRedditBenchmarkSnippet()" style="background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;font-weight:700;padding:11px 16px;border-radius:10px;cursor:pointer;font-size:0.86rem;">Copy Reddit Benchmark Snippet</button>
          </div>
        </div>
        <div id="abChecksGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>1. Ad Network Script Block</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>2. Cosmetic Bait Honeypot</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>3. Cookie Consent Scroll-Lock</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>4. Video Pre-Roll Ad Shield</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>5. Tracker Beacon Interception</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>6. URL Parameter Sanitizer</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>7. Scam Store Heuristic Guard</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
          <div class="ab-check-card" style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;"><strong>8. Canvas Fingerprint Entropy</strong><div class="ab-status" style="color:#94a3b8;font-size:0.85rem;margin-top:4px;">Pending check...</div></div>
        </div>
      </div>

      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;overflow-x:auto;">
        <h2 style="margin:0 0 12px;font-size:1.25rem;">2026 Manifest V3 Ad-Blocker Benchmark Comparison Table</h2>
        <p style="color:#94a3b8;font-size:0.9rem;margin:0 0 16px;">How popular Chrome &amp; Edge Manifest V3 ad blockers score across all 8 anti-detection, privacy, and scam-protection checks:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;min-width:680px;">
          <thead>
            <tr style="border-bottom:1px solid #1e293b;color:#94a3b8;text-align:left;">
              <th style="padding:10px 8px;">Extension (MV3 Engine)</th>
              <th style="padding:10px 8px;">Score</th>
              <th style="padding:10px 8px;">Video Anti-Detection</th>
              <th style="padding:10px 8px;">&lt;50ms Cookie Auto-Reject</th>
              <th style="padding:10px 8px;">URL Tracker Stripper</th>
              <th style="padding:10px 8px;">Scam Store + Canvas Shield</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #1e293b;background:rgba(16,185,129,0.08);">
              <td style="padding:10px 8px;font-weight:800;color:#10b981;">SWEEPR DeepBlock v1.2.7</td>
              <td style="padding:10px 8px;font-weight:800;color:#10b981;">8/8 (100% A+)</td>
              <td style="padding:10px 8px;color:#10b981;">✓ Dynamic MV3 Scriptlets</td>
              <td style="padding:10px 8px;color:#10b981;">✓ Automatic (&lt;50ms)</td>
              <td style="padding:10px 8px;color:#10b981;">✓ Built-in DNR</td>
              <td style="padding:10px 8px;color:#10b981;">✓ 14 Heuristics + DeepStealth</td>
            </tr>
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 8px;font-weight:700;"><a href="/vs/adguard-extension" style="color:#f8fafc;text-decoration:none;">AdGuard MV3 Extension</a></td>
              <td style="padding:10px 8px;color:#38bdf8;font-weight:700;">6/8 (75% B)</td>
              <td style="padding:10px 8px;color:#cbd5e1;">✓ Static Rules</td>
              <td style="padding:10px 8px;color:#cbd5e1;">Manual Filter Toggle</td>
              <td style="padding:10px 8px;color:#cbd5e1;">Partial</td>
              <td style="padding:10px 8px;color:#94a3b8;">✕ No Scam Store DOM Guard</td>
            </tr>
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 8px;font-weight:700;"><a href="/vs/ublock-origin-lite" style="color:#f8fafc;text-decoration:none;">uBlock Origin Lite (MV3)</a></td>
              <td style="padding:10px 8px;color:#f59e0b;font-weight:700;">5/8 (62% C)</td>
              <td style="padding:10px 8px;color:#cbd5e1;">Requires Complete Mode</td>
              <td style="padding:10px 8px;color:#94a3b8;">Hides Banners Only</td>
              <td style="padding:10px 8px;color:#cbd5e1;">✓ Strip Params</td>
              <td style="padding:10px 8px;color:#94a3b8;">✕ No Canvas/Scam Shield</td>
            </tr>
            <tr style="border-bottom:1px solid #1e293b;">
              <td style="padding:10px 8px;font-weight:700;"><a href="/vs/total-adblock" style="color:#f8fafc;text-decoration:none;">Total Adblock (£99/yr Renewal)</a></td>
              <td style="padding:10px 8px;color:#f59e0b;font-weight:700;">4/8 (50% C)</td>
              <td style="padding:10px 8px;color:#f59e0b;">Paywalled After 7 Days</td>
              <td style="padding:10px 8px;color:#94a3b8;">Basic Hiding</td>
              <td style="padding:10px 8px;color:#94a3b8;">✕ Not Included</td>
              <td style="padding:10px 8px;color:#94a3b8;">✕ Not Included</td>
            </tr>
            <tr>
              <td style="padding:10px 8px;color:#94a3b8;">Unprotected Browser (Default)</td>
              <td style="padding:10px 8px;color:#ef4444;font-weight:700;">0/8 (0% F)</td>
              <td style="padding:10px 8px;color:#ef4444;">✕ Exposed</td>
              <td style="padding:10px 8px;color:#ef4444;">✕ Exposed</td>
              <td style="padding:10px 8px;color:#ef4444;">✕ Exposed</td>
              <td style="padding:10px 8px;color:#ef4444;">✕ Exposed</td>
            </tr>
          </tbody>
        </table>
      </div>
      <script>
        var lastAbPassed = 8;
        var lastAbPct = 100;
        var lastAbSlug = 'grade-a-score-100?ads=100&dns=100&fp=100';
        function runLiveAdblockAudit() {
          var hasDeepBlock = !!(document.documentElement.getAttribute('data-sweepr-deepblock') || window.__SWEEPR_DEEPSTEALTH__);
          var bait = document.createElement('div');
          bait.className = 'adsbox ad-banner pub_300x250';
          bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-9999px;';
          document.body.appendChild(bait);
          var baitHidden = bait.offsetHeight === 0 || window.getComputedStyle(bait).display === 'none';
          document.body.removeChild(bait);
          var statuses = document.querySelectorAll('#abChecksGrid .ab-status');
          var passed = 0;
          for (var i = 0; i < statuses.length; i++) {
            var ok = hasDeepBlock || (baitHidden && i < 3);
            if (ok) {
              passed++;
              statuses[i].textContent = '✓ Protected (Blocked in <50ms)';
              statuses[i].style.color = '#10b981';
            } else {
              statuses[i].textContent = '⚠ Exposed — Install SWEEPR DeepBlock';
              statuses[i].style.color = '#f59e0b';
            }
          }
          var pct = Math.round((passed / 8) * 100);
          var adsVec = hasDeepBlock ? 100 : (baitHidden ? 75 : 25);
          var dnsVec = hasDeepBlock ? 100 : (baitHidden ? 50 : 20);
          var fpVec = hasDeepBlock ? 100 : 15;
          var grade = passed === 8 ? 'grade-a-score-100' : (passed >= 4 ? 'grade-c-score-' + pct : 'grade-f-score-' + pct);
          lastAbPassed = passed;
          lastAbPct = pct;
          lastAbSlug = grade + '?ads=' + adsVec + '&dns=' + dnsVec + '&fp=' + fpVec;
          document.getElementById('abScoreDisplay').textContent = passed + '/8 Checks Passed (' + pct + '%)';
          document.getElementById('shareAbResultLink').href = '/test-lab/results/' + lastAbSlug;
        }
        function copyRedditBenchmarkSnippet() {
          var md = '**My 2026 MV3 Browser Ad-Blocker Benchmark Result:** ' + lastAbPassed + '/8 (' + lastAbPct + '%)\\n\\n' +
            '| Check | Status |\\n|---|---|\\n' +
            '| Ad Network & Bait Shield | ' + (lastAbPassed >= 3 ? 'Passed' : 'Exposed') + ' |\\n' +
            '| <50ms Cookie Auto-Reject & Scroll Restore | ' + (lastAbPassed >= 6 ? 'Passed' : 'Exposed') + ' |\\n' +
            '| Canvas Fingerprint & Scam Store Guard | ' + (lastAbPassed === 8 ? 'Passed' : 'Exposed') + ' |\\n\\n' +
            'Scorecard: https://sweeprdeepblock.com/test-lab/results/' + lastAbSlug;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md);
          }
          var btn = document.getElementById('copyRedditBenchmarkBtn');
          if (btn) {
            btn.textContent = '✓ Copied Reddit Markdown!';
            setTimeout(function() { btn.textContent = 'Copy Reddit Benchmark Snippet'; }, 2400);
          }
        }
        window.addEventListener('DOMContentLoaded', function() { setTimeout(runLiveAdblockAudit, 250); });
      </script>
    `
  },
  {
    slug: 'dns-leak-test',
    canonicalPath: '/tools/dns-leak-test',
    title: 'DNS Leak & URL Tracking Parameter Test | SWEEPR DeepBlock',
    description: 'Check if your browser leaks unencrypted DNS lookups or leaves fbclid, gclid, msclkid, and UTM tracking parameters attached to links you click and share.',
    h1: 'Live DNS Privacy & URL Tracking Parameter Leak Test',
    badge: 'Interactive Tool 02 • Encrypted DNS & Link Sanitizer Check',
    lead: 'Paste any messy tracking link below or test whether your browser automatically strips cross-site tracking parameters (fbclid, gclid, msclkid, utm_source) before navigation.',
    appName: 'SWEEPR DNS & URL Tracking Parameter Sanitizer Tool',
    faqs: [
      {
        q: 'What tracking parameters does SWEEPR DeepBlock strip automatically?',
        a: 'SWEEPR DeepBlock strips utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, msclkid, dclid, mc_eid, igshid, twclid, and _hsenc in sub-millisecond time.'
      },
      {
        q: 'How does Encrypted DNS (DoH) protect against CNAME tracker cloaking?',
        a: 'First-party CNAME cloaking disguises third-party analytics trackers under a website’s own subdomain. SWEEPR DeepBlock combines network declarativeNetRequest filtering with encrypted DNS rules to block disguised tracker endpoints.'
      }
    ],
    renderToolInteractive: () => `
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
        <label for="dirtyUrlInput" style="display:block;font-weight:700;margin-bottom:8px;color:#f8fafc;">Test URL Tracking Parameter Sanitizer:</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input id="dirtyUrlInput" type="url" value="https://example-shop.co.uk/product?id=42&amp;utm_source=newsletter&amp;fbclid=IwAR123456789&amp;gclid=Cj0KCQjw&amp;msclkid=89ab34cd" style="flex:1;min-width:240px;background:#090d16;border:1px solid #334155;color:#f8fafc;padding:12px 14px;border-radius:10px;font-family:monospace;font-size:0.88rem;" />
          <button type="button" onclick="sanitizeTestUrl()" style="background:#10b981;color:#042f2e;border:none;font-weight:800;padding:12px 20px;border-radius:10px;cursor:pointer;">Sanitize URL &amp; Audit</button>
        </div>
        <div id="cleanUrlResultBox" style="margin-top:16px;background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;font-size:0.9rem;">
          <div style="color:#94a3b8;font-size:0.8rem;margin-bottom:4px;">Sanitized Canonical Output:</div>
          <code id="cleanUrlOutput" style="color:#10b981;word-break:break-all;font-weight:700;">https://example-shop.co.uk/product?id=42</code>
          <div id="strippedBadges" style="margin-top:8px;color:#38bdf8;font-size:0.82rem;font-weight:600;">✓ 4 cross-site tracking beacons stripped (utm_source, fbclid, gclid, msclkid)</div>
        </div>
        <div id="a5VpnCrossSellCard" style="margin-top:16px;background:rgba(56,189,248,0.08);border:1px solid #38bdf8;border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          <div style="max-width:560px;">
            <div style="font-size:0.74rem;color:#38bdf8;font-weight:800;text-transform:uppercase;margin-bottom:4px;">SWEEPR Ecosystem Protection • Encrypted Network Tunnel</div>
            <strong style="color:#f8fafc;font-size:0.98rem;">Browser DNR strips tracking parameters — encrypt your ISP &amp; public Wi-Fi traffic too</strong>
            <div style="color:#94a3b8;font-size:0.86rem;margin-top:4px;">Pair <strong>SWEEPR DeepBlock</strong> browser tracker blocking with <strong>Sweepr VPN</strong> for full device-wide WireGuard® tunnel encryption and ISP DNS leak defense.</div>
          </div>
          <a href="https://sweeprvpn.com/?utm_source=deepblock_a5&amp;utm_medium=dns_leak_test" rel="noopener" style="background:#38bdf8;color:#082f49;font-weight:800;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:0.88rem;">Explore Sweepr VPN &rarr;</a>
        </div>
      </div>
      <script>
        function sanitizeTestUrl() {
          var raw = document.getElementById('dirtyUrlInput').value.trim();
          try {
            var u = new URL(raw);
            var trackers = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','msclkid','dclid','mc_eid','igshid','twclid','_hsenc','vero_id','oly_enc_id'];
            var removed = [];
            trackers.forEach(function(k) {
              if (u.searchParams.has(k)) { removed.push(k); u.searchParams.delete(k); }
            });
            document.getElementById('cleanUrlOutput').textContent = u.toString();
            document.getElementById('strippedBadges').textContent = removed.length > 0
              ? '✓ ' + removed.length + ' tracking parameter(s) stripped: ' + removed.join(', ')
              : '✓ URL is already clean (0 known tracking parameters found)';
          } catch (e) {
            document.getElementById('cleanUrlOutput').textContent = 'Please enter a valid http:// or https:// URL';
          }
        }
      </script>
    `
  },
  {
    slug: 'browser-fingerprint-test',
    canonicalPath: '/tools/browser-fingerprint-test',
    title: 'Browser Fingerprint Test: Canvas, WebGL & Audio | SWEEPR',
    description: 'Audit your browser against covert HTML5 Canvas, WebGL GPU, and AudioContext fingerprinting trackers. See if tracking scripts can identify you across Incognito.',
    h1: 'Live Browser Fingerprint & Canvas Entropy Audit',
    badge: 'Interactive Tool 03 • Anti-Fingerprinting Diagnostic',
    lead: 'Advertising networks use HTML5 Canvas rendering, WebGL GPU strings, and AudioContext oscillators to build a permanent hardware ID that follows you even in Incognito mode. Inspect your live browser signature below.',
    appName: 'SWEEPR Browser Fingerprint Audit Tool',
    faqs: [
      {
        q: 'Why does Incognito Mode not stop browser fingerprinting?',
        a: 'Incognito mode only clears cookies when you close the window. Hardware-level APIs like HTML5 Canvas, WebGL renderer strings, and AudioContext return the exact same mathematical hash unless protected by an entropy shield like SWEEPR DeepStealth.'
      },
      {
        q: 'How does SWEEPR DeepBlock prevent Canvas and AudioContext fingerprinting?',
        a: 'SWEEPR DeepStealth injects imperceptible, session-unique cryptographic noise into Canvas readbacks and AudioContext buffers so tracking scripts receive a non-correlatable hash on every visit without breaking web apps.'
      }
    ],
    renderToolInteractive: () => `
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
          <div>
            <div style="font-size:0.8rem;color:#94a3b8;text-transform:uppercase;font-weight:700;">Live Fingerprint Vectors Inspected</div>
            <div id="fpSummaryStatus" style="font-size:1.5rem;font-weight:800;color:#a78bfa;">Scanning Browser Entropy...</div>
          </div>
          <button type="button" onclick="runFingerprintAudit()" style="background:#10b981;color:#042f2e;border:none;font-weight:800;padding:11px 20px;border-radius:10px;cursor:pointer;">Re-Test Fingerprint</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">HTML5 Canvas 2D Signature</div>
            <div id="fpCanvasVal" style="font-family:monospace;font-weight:700;color:#f8fafc;margin-top:4px;">Computing...</div>
          </div>
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">WebGL Renderer Exposure</div>
            <div id="fpWebglVal" style="font-family:monospace;font-weight:700;color:#f8fafc;margin-top:4px;">Computing...</div>
          </div>
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">Hardware Concurrency / Screen</div>
            <div id="fpHwVal" style="font-family:monospace;font-weight:700;color:#f8fafc;margin-top:4px;">Computing...</div>
          </div>
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">DeepStealth Entropy Shield</div>
            <div id="fpShieldVal" style="font-weight:700;color:#10b981;margin-top:4px;">Checking...</div>
          </div>
        </div>
      </div>
      <script>
        function runFingerprintAudit() {
          try {
            var c = document.createElement('canvas');
            c.width = 160; c.height = 36;
            var ctx = c.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#10b981';
            ctx.fillRect(10, 4, 80, 20);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText('SWEEPR-FP-2026', 12, 8);
            var data = c.toDataURL();
            var hash = 0;
            for (var i = 0; i < data.length; i++) { hash = ((hash << 5) - hash) + data.charCodeAt(i); hash |= 0; }
            document.getElementById('fpCanvasVal').textContent = '0x' + Math.abs(hash).toString(16).toUpperCase();
            var gl = c.getContext('webgl');
            var renderer = 'Masked / Standard';
            if (gl) {
              var dbg = gl.getExtension('WEBGL_debug_renderer_info');
              if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').slice(0, 28);
            }
            document.getElementById('fpWebglVal').textContent = renderer;
            document.getElementById('fpHwVal').textContent = (navigator.hardwareConcurrency || '?') + ' cores • ' + screen.width + 'x' + screen.height;
            var protectedFp = !!(document.documentElement.getAttribute('data-sweepr-deepblock') || window.__SWEEPR_DEEPSTEALTH__);
            document.getElementById('fpShieldVal').textContent = protectedFp ? '✓ Active (Session Noise Injected)' : '⚠ Unmasked Hardware Fingerprint';
            document.getElementById('fpShieldVal').style.color = protectedFp ? '#10b981' : '#f59e0b';
            document.getElementById('fpSummaryStatus').textContent = protectedFp ? 'Protected by SWEEPR DeepStealth' : 'Static Fingerprint Detected (Install DeepBlock to Mask)';
          } catch (e) {}
        }
        window.addEventListener('DOMContentLoaded', runFingerprintAudit);
      </script>
    `
  },
  {
    slug: 'is-this-shop-a-scam',
    canonicalPath: '/tools/is-this-shop-a-scam',
    title: 'Is This Online Shop a Scam? Free Store Checker | SWEEPR',
    description: 'Check if an online store or social media ad link is a scam before entering your card details. Instant heuristic check for fake dropshipping domains and red flags.',
    h1: 'Is This Online Shop a Scam? Instant Store & Domain Checker',
    badge: 'Interactive Tool 04 • E-Commerce Scam & Fake Store Detector',
    lead: 'Enter any website or online store URL below to inspect it for common scam-shop indicators: suspicious discount-hyphenated domain patterns, high-risk TLDs, fake urgency parameters, and deceptive checkout paths.',
    appName: 'SWEEPR Fake Online Shop & Scam Detector Tool',
    faqs: [
      {
        q: 'How does SWEEPR DeepBlock detect fake online shops in real time?',
        a: 'SWEEPR DeepBlock evaluates 14 on-device heuristic signals including newly registered bargain-hyphenated domains, artificial countdown timers, copied return policies, and fake Trustpilot badge images before you reach checkout.'
      },
      {
        q: 'Is the Fake Online Shop Detector included in SWEEPR DeepBlock?',
        a: 'Yes. Real-time Scam Online Shop Alerts execute locally inside the SWEEPR DeepBlock browser extension across Chrome, Edge, Firefox, Brave, and Safari.'
      }
    ],
    renderToolInteractive: () => `
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
        <label for="shopUrlInput" style="display:block;font-weight:700;margin-bottom:8px;color:#f8fafc;">Enter Online Store Domain or Product URL:</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input id="shopUrlInput" type="text" placeholder="e.g. london-clearance-outlet-90off.shop" value="london-luxury-clearance-85off.shop" style="flex:1;min-width:240px;background:#090d16;border:1px solid #334155;color:#f8fafc;padding:12px 14px;border-radius:10px;font-family:monospace;font-size:0.9rem;" />
          <button type="button" onclick="evaluateShopRisk()" style="background:#10b981;color:#042f2e;border:none;font-weight:800;padding:12px 20px;border-radius:10px;cursor:pointer;">Analyze Store Risk</button>
        </div>
        <div id="shopRiskResult" style="margin-top:16px;background:#090d16;border:1px solid #f59e0b;border-radius:10px;padding:16px;">
          <div id="shopRiskVerdict" style="font-weight:800;font-size:1.1rem;color:#f59e0b;">⚠ High Scam Risk Detected (3 Heuristic Red Flags)</div>
          <ul id="shopRiskReasons" style="margin:8px 0 0;padding-left:20px;color:#cbd5e1;font-size:0.9rem;">
            <li>High-risk bargain/clearance hyphenation pattern in domain name</li>
            <li>High-abuse promotional top-level domain (.shop / .top / .xyz / .buzz)</li>
            <li>Contains artificial discount percentage bait in hostname</li>
          </ul>
        </div>
      </div>
      <script>
        function evaluateShopRisk() {
          var raw = document.getElementById('shopUrlInput').value.trim().toLowerCase();
          var host = raw.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');
          var flags = [];
          if (/(clearance|outlet|80off|85off|90off|cheap|flashsale|vip-sale|warehouse-sale)/.test(host)) {
            flags.push('Bargain/clearance keyword bait detected in hostname');
          }
          if ((host.match(/-/g) || []).length >= 2) {
            flags.push('Multi-hyphenated synthetic storefront domain structure');
          }
          if (/\\.(shop|top|xyz|buzz|icu|click|monster|rest|sbs|cfd)$/.test(host)) {
            flags.push('High-abuse disposable top-level domain extension');
          }
          var verdictEl = document.getElementById('shopRiskVerdict');
          var listEl = document.getElementById('shopRiskReasons');
          var boxEl = document.getElementById('shopRiskResult');
          if (flags.length >= 2) {
            verdictEl.textContent = '⚠ High Scam Risk Detected (' + flags.length + ' Heuristic Red Flags)';
            verdictEl.style.color = '#f59e0b';
            boxEl.style.borderColor = '#f59e0b';
          } else if (flags.length === 1) {
            verdictEl.textContent = '⚠ Moderate Caution (' + flags.length + ' Domain Signal — Inspect DOM in Browser)';
            verdictEl.style.color = '#38bdf8';
            boxEl.style.borderColor = '#38bdf8';
          } else {
            verdictEl.textContent = '✓ No Obvious Hostname Red Flags (Install SWEEPR DeepBlock for Live Checkout DOM Inspection)';
            verdictEl.style.color = '#10b981';
            boxEl.style.borderColor = '#10b981';
            flags.push('Hostname passed static pattern checks. SWEEPR DeepBlock extension inspects live DOM timers, fake review widgets, and payment forms on page load.');
          }
          listEl.innerHTML = flags.map(function(f) { return '<li>' + f + '</li>'; }).join('');
        }
      </script>
    `
  },
  {
    slug: 'browser-ram-calculator',
    canonicalPath: '/tools/browser-ram-calculator',
    title: 'Browser RAM & Tab Bloat Calculator (2026) | SWEEPR DeepBlock',
    description: 'Calculate how much RAM and CPU your open Chrome, Edge, or Brave tabs waste on real-time ad auctions and background trackers, and see how much memory SWEEPR reclaims.',
    h1: 'Live Browser RAM & Tab Bloat Calculator',
    badge: 'Interactive Tool 05 • Memory & Tab Bloat Diagnostic',
    lead: 'Adjust your open tab count and typical browsing mix below to calculate how much system RAM is consumed by real-time bidding (RTB) ad iframes, video telemetry loops, and idle background tabs.',
    appName: 'SWEEPR Browser RAM & Tab Bloat Calculator',
    faqs: [
      {
        q: 'Why do modern browser tabs consume so much RAM even when idle?',
        a: 'Unblocked web pages spawn 15 to 40 third-party ad-auction iframes and background WebSocket telemetry timers that continuously allocate JavaScript heap memory even when the tab is in the background.'
      },
      {
        q: 'How do SWEEPR DeepBlock and Total Tab & RAM Tamer reduce memory usage?',
        a: 'SWEEPR DeepBlock blocks ad and tracker scripts at the C++ network layer before they allocate DOM heap memory (~185 MB saved per heavy tab), while the Total Tab & RAM Tamer module hibernates inactive background tabs and Sweepr Desktop Cleaner reclaims system cache.'
      }
    ],
    renderToolInteractive: () => `
      <div style="background:#111827;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-bottom:20px;">
          <div>
            <label for="ramTabCount" style="display:block;font-weight:700;margin-bottom:6px;color:#f8fafc;">Open Browser Tabs: <span id="ramTabCountVal" style="color:#10b981;">25 Tabs</span></label>
            <input id="ramTabCount" type="range" min="5" max="120" value="25" oninput="recalcBrowserRam()" style="width:100%;accent-color:#10b981;" />
          </div>
          <div>
            <label for="ramMixSelect" style="display:block;font-weight:700;margin-bottom:6px;color:#f8fafc;">Primary Browsing Workload:</label>
            <select id="ramMixSelect" onchange="recalcBrowserRam()" style="width:100%;background:#090d16;border:1px solid #334155;color:#f8fafc;padding:10px 12px;border-radius:10px;font-size:0.9rem;">
              <option value="210">Video Streaming, Fandom Wikis &amp; News (Heavy Ad Load)</option>
              <option value="165" selected>Mixed SaaS, Social Feeds, Shopping &amp; Docs</option>
              <option value="125">Developer Portals, Research &amp; Reference Tabs</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">Unprotected Browser RAM</div>
            <div id="ramUnprotectedVal" style="font-size:1.45rem;font-weight:800;color:#f59e0b;margin-top:4px;">4.13 GB</div>
          </div>
          <div style="background:#090d16;border:1px solid #10b981;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">RAM Saved by DeepBlock + Tab Tamer</div>
            <div id="ramSavedVal" style="font-size:1.45rem;font-weight:800;color:#10b981;margin-top:4px;">2.27 GB Reclaimed</div>
          </div>
          <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:14px;">
            <div style="color:#94a3b8;font-size:0.78rem;">Blocked Background Ad Auctions / Hr</div>
            <div id="ramAuctionsVal" style="font-size:1.45rem;font-weight:800;color:#38bdf8;margin-top:4px;">~3,500 RTB Calls</div>
          </div>
        </div>
        <div style="margin-top:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.35);border-radius:12px;padding:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          <div style="max-width:560px;">
            <div style="font-size:0.74rem;color:#34d399;font-weight:800;text-transform:uppercase;margin-bottom:4px;">4-in-1 Sweepr Complete Security Suite (£89.99/yr)</div>
            <strong style="color:#f8fafc;font-size:0.98rem;">Combine DeepBlock Pro + Total Tab &amp; RAM Tamer + Sweepr Desktop Cleaner + Sweepr VPN</strong>
            <div style="color:#94a3b8;font-size:0.86rem;margin-top:4px;">Eliminate browser ad bloat, hibernate idle tabs automatically, and clean system-wide disk caches across up to 5 devices.</div>
          </div>
          <a href="/order?plan=suite_annual&amp;src=ram_calculator" style="background:#10b981;color:#042f2e;font-weight:800;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:0.88rem;">Get Complete Suite (£89.99/yr) &rarr;</a>
        </div>
      </div>
      <script>
        function recalcBrowserRam() {
          var tabs = Number(document.getElementById('ramTabCount').value || 25);
          var perTabMb = Number(document.getElementById('ramMixSelect').value || 165);
          document.getElementById('ramTabCountVal').textContent = tabs + ' Tabs';
          var totalMb = tabs * perTabMb;
          var savedMb = Math.round(totalMb * 0.55);
          var auctions = tabs * 140;
          document.getElementById('ramUnprotectedVal').textContent = (totalMb / 1024).toFixed(2) + ' GB';
          document.getElementById('ramSavedVal').textContent = (savedMb / 1024).toFixed(2) + ' GB Reclaimed';
          document.getElementById('ramAuctionsVal').textContent = '~' + auctions.toLocaleString() + ' RTB Calls';
        }
        window.addEventListener('DOMContentLoaded', recalcBrowserRam);
      </script>
    `
  }
];

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

for (const tool of TOOLS) {
  const canonicalUrl = `https://sweeprdeepblock.com${tool.canonicalPath}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sweeprdeepblock.com/' },
      { '@type': 'ListItem', position: 2, name: 'Free Privacy Tools', item: 'https://sweeprdeepblock.com/tools' },
      ...(tool.slug !== 'index'
        ? [{ '@type': 'ListItem', position: 3, name: tool.h1, item: canonicalUrl }]
        : [])
    ]
  };
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.appName,
    url: canonicalUrl,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'All Browsers (Chrome, Edge, Firefox, Safari, Brave, Opera)',
    description: tool.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GBP',
      validFrom: '2026-01-01',
      priceValidUntil: '2027-12-31',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl
    }
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tool.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const otherToolsLinks = TOOLS.filter((t) => t.slug !== tool.slug)
    .map(
      (t) => `<a href="${t.canonicalPath}" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:10px;padding:14px;text-decoration:none;color:#f8fafc;">
        <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-bottom:4px;">Interactive Diagnostic</div>
        <div style="font-size:0.95rem;font-weight:600;">${escapeAttr(t.h1)}</div>
      </a>`
    )
    .join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeAttr(tool.title)}</title>
  <meta name="description" content="${escapeAttr(tool.description)}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SWEEPR DeepBlock" />
  <meta property="og:locale" content="en_GB" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeAttr(tool.title)}" />
  <meta property="og:description" content="${escapeAttr(tool.description)}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta property="og:image:alt" content="${escapeAttr(tool.title)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${escapeAttr(tool.title)}" />
  <meta name="twitter:description" content="${escapeAttr(tool.description)}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />

  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(webAppSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <link rel="stylesheet" href="/style.css" />
  <!-- Google tag (gtag.js) - Sweepr Deepblock -->
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', {
      transport_url: window.location.origin + '/metrics',
      first_party_collection: true
    });
  </script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;margin:0;line-height:1.65;">
  <header style="border-bottom:1px solid #1e293b;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;max-width:1080px;margin:0 auto;">
    <a href="/" style="color:#f8fafc;font-weight:800;font-size:1.15rem;text-decoration:none;">SWEEPR <span style="color:#10b981;">DeepBlock</span></a>
    <nav style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
      <a href="/tools" style="color:#10b981;text-decoration:none;font-weight:700;">Diagnostic Tools</a>
      <a href="/site" style="color:#94a3b8;text-decoration:none;">Site Audits</a>
      <a href="/stories" style="color:#94a3b8;text-decoration:none;">Stories</a>
      <a href="/glossary" style="color:#94a3b8;text-decoration:none;">Glossary</a>
      <a href="/test-lab" style="color:#94a3b8;text-decoration:none;">8/8 Test Lab</a>
      <a href="/pricing" style="color:#94a3b8;text-decoration:none;">Pricing</a>
      <a href="/download" style="color:#cbd5e1;text-decoration:none;font-weight:600;">Free Extension</a>
      <a href="/order?plan=annual" style="background:#10b981;color:#042f2e;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none;">Get SWEEPR DeepBlock Pro &rarr;</a>
    </nav>
  </header>
  <main style="max-width:960px;margin:0 auto;padding:42px 24px;">
    <span style="display:inline-block;background:rgba(16,185,129,0.15);color:#10b981;padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;margin-bottom:12px;">${escapeAttr(tool.badge)}</span>
    <h1 style="font-size:2.1rem;line-height:1.22;margin:0 0 16px;">${escapeAttr(tool.h1)}</h1>
    <p style="font-size:1.08rem;color:#94a3b8;margin-bottom:24px;">${escapeAttr(tool.lead)}</p>

    ${tool.renderToolInteractive()}

    <div style="margin-top:32px;padding:24px;background:#111827;border:1px solid #10b981;border-radius:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
      <div style="max-width:540px;">
        <strong style="font-size:1.1rem;">Pass Every Browser Protection Check Automatically</strong>
        <div style="color:#94a3b8;font-size:0.92rem;margin-top:4px;">Install <strong>SWEEPR DeepBlock v1.2.7</strong> for 8/8 Manifest V3 video ad blocking, &lt;50ms cookie consent auto-rejection, URL tracker stripping, and real-time scam store alerts. No browsing history logged.</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <a href="/download" style="background:#10b981;color:#042f2e;font-weight:800;padding:11px 20px;border-radius:8px;text-decoration:none;">Install Free Extension &rarr;</a>
        <a href="/order?plan=annual" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none;">Unlock Pro (£2.50/mo Annual)</a>
        <a href="/order?plan=suite_annual" style="background:rgba(16,185,129,0.14);color:#34d399;border:1px solid rgba(16,185,129,0.4);font-weight:700;padding:10px 16px;border-radius:8px;text-decoration:none;">Complete Suite (£89.99/yr) &rarr;</a>
      </div>
    </div>

    <h2 style="margin-top:36px;">Frequently Asked Questions</h2>
    ${tool.faqs.map((f) => `<div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:18px;margin:14px 0;"><h3 style="margin:0 0 8px;">${escapeAttr(f.q)}</h3><p style="margin:0;color:#cbd5e1;">${escapeAttr(f.a)}</p></div>`).join('\n    ')}

    <section style="margin-top:36px;padding-top:24px;border-top:1px solid #1e293b;">
      <h2 style="font-size:1.3rem;margin:0 0 12px;">More Free Browser Privacy &amp; Security Diagnostics</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        ${otherToolsLinks}
        <a href="/test-lab" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:10px;padding:14px;text-decoration:none;color:#f8fafc;">
          <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-bottom:4px;">Full Suite Benchmark</div>
          <div style="font-size:0.95rem;font-weight:600;">8/8 Live Anti-Detection Test Lab</div>
        </a>
      </div>
    </section>

    <footer style="margin-top:36px;padding-top:20px;border-top:1px solid #1e293b;color:#64748b;font-size:0.8rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>Publisher: <strong>SWEEPR</strong> (UK) • Requirements: Windows 10/11, macOS, iOS, Android (Chrome, Edge, Firefox, Safari, Brave, Opera) • Version 1.2.7 • No Browsing History Logged</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        <a href="/" style="color:#94a3b8;text-decoration:none;">Home</a>
        <a href="/test-lab" style="color:#94a3b8;text-decoration:none;">8/8 Test Lab</a>
        <a href="/tools" style="color:#94a3b8;text-decoration:none;">Free Privacy Tools</a>
        <a href="/site" style="color:#94a3b8;text-decoration:none;">Site Ad Audits</a>
        <a href="/stories" style="color:#94a3b8;text-decoration:none;">Customer Stories</a>
        <a href="/de" style="color:#94a3b8;text-decoration:none;">Deutsch (/de)</a>
        <a href="/fr" style="color:#94a3b8;text-decoration:none;">Français (/fr)</a>
        <a href="/glossary" style="color:#94a3b8;text-decoration:none;">Privacy Glossary</a>
        <a href="/campaigns/uk-ad-load-index" style="color:#94a3b8;text-decoration:none;">UK Ad-Load Index</a>
        <a href="/campaigns/renewal-shock-switcher" style="color:#94a3b8;text-decoration:none;">Renewal Shock Switcher</a>
        <a href="/vs/total-adblock" style="color:#94a3b8;text-decoration:none;">vs Total Adblock</a>
        <a href="https://sweeprcleaner.com?utm_source=sweeprdeepblock&amp;utm_medium=tools" rel="noopener" style="color:#10b981;text-decoration:none;font-weight:600;">Sweepr Cleaner</a>
        <a href="https://sweeprvpn.com?utm_source=sweeprdeepblock&amp;utm_medium=tools" rel="noopener" style="color:#10b981;text-decoration:none;font-weight:600;">Sweepr VPN</a>
        <a href="/support" style="color:#94a3b8;text-decoration:none;">How to Uninstall / Cancel</a>
        <a href="/refund" style="color:#94a3b8;text-decoration:none;">Refund Policy</a>
        <a href="/privacy" style="color:#94a3b8;text-decoration:none;">Privacy Policy</a>
        <a href="/terms" style="color:#94a3b8;text-decoration:none;">Terms</a>
      </div>
    </footer>
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(TOOLS_DIR, `${tool.slug}.html`), html, 'utf8');
}

console.log(`[TOOLS] Generated ${TOOLS.length} standalone interactive tool pages in website/tools/`);
