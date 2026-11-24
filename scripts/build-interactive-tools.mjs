#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Interactive Diagnostic Tools (`/tools` + 5 tool routes)
 *
 * Holographic Pearl Light Shell + M1 Decision Compliant:
 *  - `/tools` (`KEEP_REWRITE`): showcases active kept tools & diagnostics (`/tools/browser-ram-calculator`, `/test-lab`, `/benchmarks`, `/guides/strip-utm-fbclid-gclid-tracking-links`)
 *  - `/tools/browser-ram-calculator` (`KEEP_REWRITE`): interactive Chromium RAM calculator + honest v1.3.1 methodology
 *  - `/tools/is-my-adblocker-working` (`CONSOLIDATE_301` -> `/test-lab`): `noindex, follow` + `/test-lab` canonical
 *  - 3 pruned tools (`NOINDEX_PRUNE`): `noindex, nofollow` + self-canonical
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_ORIGIN,
  PRODUCT_FACTS,
  escapeHtml,
  buildJsonLd,
  renderShellPage,
  renderBreadcrumbs,
  renderGlassCard,
  renderCallout,
  renderCtaBanner,
  renderRelatedGrid,
  getM1Decision
} from './lib/holographic-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIR = path.resolve(__dirname, '..', 'website');
const TOOLS_DIR = path.join(WEBSITE_DIR, 'tools');

fs.mkdirSync(TOOLS_DIR, { recursive: true });

const VERSION = PRODUCT_FACTS.version;
const STATIC_RULES = PRODUCT_FACTS.staticDnrRules;

const KEPT_RELATED_ITEMS = [
  { href: '/tools', badge: 'Tools Hub', label: 'Browser Privacy & RAM Tools' },
  { href: '/test-lab', badge: 'Live Diagnostic', label: 'Free Adblock Test Lab' },
  { href: '/benchmarks', badge: 'Architecture', label: `SWEEPR Deepblock v${VERSION} Benchmarks` },
  { href: '/guides/how-to-reduce-browser-ram-speed-up-slow-tabs', badge: 'Memory Guide', label: 'Reduce Browser RAM & Speed Up Tabs' }
];

const TOOLS = [
  {
    slug: 'index',
    canonicalPath: '/tools',
    title: 'Free Browser Privacy, Adblock & RAM Diagnostic Tools | SWEEPR',
    description: `Run client-side browser diagnostics: estimate Chromium tab RAM bloat, launch the Live Anti-Detection Test Lab, and verify v${VERSION} MV3 rules.`,
    h1: 'Free Browser Privacy, Adblock & RAM Diagnostic Tools',
    badge: `SWEEPR Interactive Diagnostics · v${VERSION} · 100% Client-Side`,
    lead: 'Inspect your browser protection and memory footprint locally. All diagnostics run inside your browser with zero browsing history logged.',
    appName: 'SWEEPR Privacy & RAM Diagnostic Suite',
    faqs: [
      {
        q: 'Are these browser privacy and RAM diagnostic tools free to use?',
        a: 'Yes. Both the Browser RAM & Tab Bloat Calculator and the Live Anti-Detection Test Lab are free and execute locally inside your browser without requiring an account.'
      },
      {
        q: 'How can I fix failed checks in the Live Anti-Detection Test Lab?',
        a: `Installing the SWEEPR Deepblock browser extension (v${VERSION}) enables ${STATIC_RULES} static Manifest V3 declarativeNetRequest rulesets for ads, trackers, cryptominers, and 20 URL tracking parameters alongside automatic GDPR cookie banner rejection.`
      },
      {
        q: 'Does running a diagnostic test log my IP address or browsing history?',
        a: 'No. Our diagnostic checks run client-side in your browser DOM and never log browsing history or personal URLs.'
      }
    ],
    renderToolInteractive: () => `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <a href="/tools/browser-ram-calculator" class="glass-card bg-white border border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 shadow-sm no-underline flex flex-col justify-between gap-4 transition-all">
          <div class="space-y-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Interactive Calculator</span>
            <h2 class="text-xl font-extrabold text-gray-900">Browser RAM &amp; Tab Bloat Calculator</h2>
            <p class="text-sm text-gray-600 leading-relaxed">Model Chromium multi-process renderer memory across 5–120 open tabs and see how blocking Prebid/OpenRTB auctions plus 10-minute idle tab discarding reduces RAM pressure.</p>
          </div>
          <span class="text-sm font-bold text-emerald-700">Open RAM Calculator &rarr;</span>
        </a>

        <a href="/test-lab" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-6 shadow-sm no-underline flex flex-col justify-between gap-4 transition-all">
          <div class="space-y-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900">Live Browser Probes</span>
            <h2 class="text-xl font-extrabold text-gray-900">Free Adblock Test Lab</h2>
            <p class="text-sm text-gray-600 leading-relaxed">Test your active browser extension against real network ad/tracker requests, cryptominer hosts, and cosmetic DOM bait elements in seconds.</p>
          </div>
          <span class="text-sm font-bold text-emerald-700">Launch Live Test Lab &rarr;</span>
        </a>

        <a href="/benchmarks" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-6 shadow-sm no-underline flex flex-col justify-between gap-4 transition-all">
          <div class="space-y-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Engine Transparency</span>
            <h2 class="text-xl font-extrabold text-gray-900">SWEEPR Deepblock v${escapeHtml(VERSION)} MV3 Benchmarks</h2>
            <p class="text-sm text-gray-600 leading-relaxed">Inspect our Manifest V3 declarativeNetRequest rule breakdown (${STATIC_RULES} static rules + 100 OTA delta rules) and compare memory footprint against legacy blockers.</p>
          </div>
          <span class="text-sm font-bold text-emerald-700">Inspect Benchmarks &rarr;</span>
        </a>

        <a href="/guides/strip-utm-fbclid-gclid-tracking-links" class="glass-card bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-6 shadow-sm no-underline flex flex-col justify-between gap-4 transition-all">
          <div class="space-y-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">URL Hygiene</span>
            <h2 class="text-xl font-extrabold text-gray-900">URL Tracking Parameter Stripping (20 Tokens)</h2>
            <p class="text-sm text-gray-600 leading-relaxed">Learn how SWEEPR Deepblock automatically strips fbclid, gclid, msclkid, ttclid, and utm_* click identifiers before outbound requests leave your browser.</p>
          </div>
          <span class="text-sm font-bold text-emerald-700">Read Parameter Stripping Guide &rarr;</span>
        </a>
      </div>
      <p class="text-sm text-gray-600 pt-2">Need engineering definitions for Manifest V3 <code>declarativeNetRequest</code> rules, CMP signals, or tab discarding? Browse our <a href="/glossary" class="text-emerald-700 font-semibold hover:underline">Manifest V3 &amp; Privacy Glossary</a>.</p>
    `
  },
  {
    slug: 'browser-ram-calculator',
    canonicalPath: '/tools/browser-ram-calculator',
    title: 'Browser RAM & Tab Bloat Calculator (2026) | SWEEPR Deepblock',
    description: `Estimate Chrome, Edge, or Brave tab RAM usage on ad auctions and background scripts, and see how SWEEPR Deepblock v${VERSION} Tab & RAM Tamer helps.`,
    h1: 'Live Browser RAM & Tab Bloat Calculator',
    badge: `Interactive Tool · Chromium Memory & Tab Tamer v${VERSION}`,
    lead: 'Adjust your open tab count and typical browsing mix below to estimate system RAM consumed by Chromium per-site renderer processes, Prebid/OpenRTB ad iframes, and idle background tabs.',
    appName: 'SWEEPR Browser RAM & Tab Bloat Calculator',
    faqs: [
      {
        q: 'Why do modern browser tabs consume so much RAM even when idle?',
        a: 'Chromium assigns separate site-instance renderer processes per domain and iframe origin. Unblocked publisher tabs spawn third-party Prebid/OpenRTB ad-auction iframes and polling timers that keep renderer heaps active in the background.'
      },
      {
        q: `How do SWEEPR Deepblock v${VERSION} and Total Tab & RAM Tamer reduce memory usage?`,
        a: `SWEEPR Deepblock blocks ad and tracker endpoints via ${STATIC_RULES} static Manifest V3 declarativeNetRequest rules before third-party frames load, and autoRamTamer discards inactive background tabs after 10 minutes via chrome.tabs.discard (skipping active, pinned, audible, and allowlisted sites; manual shortcut Alt+Shift+Z).`
      }
    ],
    renderToolInteractive: () => `
      <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label for="ramTabCount" class="block text-sm font-bold text-gray-900">
              Open Browser Tabs: <span id="ramTabCountVal" class="text-emerald-700 font-extrabold tabular-nums">25 Tabs</span>
            </label>
            <input id="ramTabCount" type="range" min="5" max="120" value="25" oninput="recalcBrowserRam()" class="w-full accent-emerald-600 cursor-pointer" />
            <div class="flex justify-between text-xs text-gray-500 font-mono">
              <span>5 tabs</span>
              <span>60 tabs</span>
              <span>120 tabs</span>
            </div>
          </div>

          <div class="space-y-2">
            <label for="ramMixSelect" class="block text-sm font-bold text-gray-900">Primary Browsing Workload:</label>
            <select id="ramMixSelect" onchange="recalcBrowserRam()" class="w-full bg-slate-50 border border-slate-300 text-gray-900 px-3 py-2.5 rounded-xl text-sm font-medium">
              <option value="210">Video Streaming, Game Wikis &amp; News (Heavy Ad Load)</option>
              <option value="165" selected>Mixed SaaS, Social Feeds, Shopping &amp; Docs</option>
              <option value="125">Developer Portals, Research &amp; Reference Tabs</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-semibold text-gray-600">Estimated Unshielded RAM</div>
            <div id="ramUnprotectedVal" class="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">4.03 GB</div>
          </div>
          <div class="bg-emerald-50 border border-emerald-300 rounded-xl p-4">
            <div class="text-xs font-semibold text-emerald-900">Estimated RAM Reclaimed (v${escapeHtml(VERSION)})</div>
            <div id="ramSavedVal" class="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">2.22 GB Reclaimed</div>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-semibold text-gray-600">Estimated Background Ad Calls / Hr</div>
            <div id="ramAuctionsVal" class="text-2xl font-extrabold text-sky-700 mt-1 tabular-nums">~3,500 RTB Calls</div>
          </div>
        </div>

        ${renderCallout({
          tone: 'slate',
          title: 'Estimation Methodology & v1.3.1 Tab Tamer Mechanics',
          bodyHtml: `Estimates model Chromium’s multi-process per-site-instance memory overhead (baseline 125–210 MB per active tab depending on Prebid/OpenRTB iframe density). Actual savings vary by OS, active web apps, and media playback. In <strong>SWEEPR Deepblock v${escapeHtml(VERSION)}</strong>, ${STATIC_RULES} static DNR rules prevent ad-auction iframes from spawning, while <code>autoRamTamer</code> calls native <code>chrome.tabs.discard</code> after <strong>10 minutes</strong> of inactivity—automatically protecting active, pinned, audible, and <code>neverSnoozeSites</code> tabs (manual trigger: <code>Alt+Shift+Z</code>).`
        })}

        <div class="bg-[#071712] text-white border border-emerald-700/40 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div class="space-y-1 max-w-xl">
            <div class="text-xs font-bold uppercase tracking-wider text-emerald-300">Sweepr Complete Security Suite (£89.99/yr)</div>
            <div class="text-base font-extrabold text-white">Deepblock Pro (Total Tab &amp; RAM Tamer Included) + Sweepr Cleaner + Sweepr VPN</div>
            <p class="text-xs text-emerald-100 leading-relaxed m-0">Block ad-tech bloat, discard idle background tabs automatically, and protect up to 5 devices.</p>
          </div>
          <a href="/order?plan=suite_annual&amp;src=ram_calculator" rel="nofollow" class="btn btn-go px-5 py-3 rounded-xl font-bold text-sm no-underline shrink-0">Get Complete Suite (£89.99/yr) &rarr;</a>
        </div>
      </section>
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
  },
  {
    slug: 'is-my-adblocker-working',
    canonicalPath: '/tools/is-my-adblocker-working',
    title: 'Is My Adblocker Working? Live 8-Point MV3 Test | SWEEPR',
    description: 'Test if your ad blocker is working in 2026. Run 8 live client-side probes against ad networks, tracker scripts, cryptominers, and cosmetic bait elements.',
    h1: 'Is My Adblocker Working? Live 8-Point Browser Benchmark',
    badge: 'Consolidated Diagnostic · Redirects to /test-lab',
    lead: 'This diagnostic has moved to our primary Live Anti-Detection Test Lab (/test-lab). You can still run the 8 client-side probes below or open the updated Test Lab.',
    appName: 'SWEEPR Live Adblocker Benchmark Tool',
    faqs: [
      {
        q: 'How does this test verify whether my ad blocker is working?',
        a: 'Each card runs an independent client-side probe: real no-cors requests against well-known ad, tracker, and cryptominer endpoints plus hidden CSS/DOM bait slot visibility checks.'
      },
      {
        q: `What does SWEEPR Deepblock v${VERSION} protect automatically?`,
        a: `SWEEPR Deepblock v${VERSION} runs ${STATIC_RULES} static Manifest V3 declarativeNetRequest rulesets for ads, URL tracking parameters, and cryptominers, alongside GDPR cookie auto-rejection and Total Tab & RAM Tamer.`
      }
    ],
    renderToolInteractive: () => `
      ${renderCallout({
        tone: 'emerald',
        title: 'Updated Location: Live Anti-Detection Test Lab',
        bodyHtml: 'For the canonical diagnostic suite, visit <a href="/test-lab" class="text-emerald-700 font-semibold underline">/test-lab</a>.'
      })}
      <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div class="flex flex-wrap justify-between items-center gap-4">
          <div>
            <div class="text-xs font-bold uppercase text-gray-500">Live Browser Score</div>
            <div id="abScoreDisplay" class="text-2xl font-extrabold text-emerald-700">Ready to Scan (8 Probes)</div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button id="runAbTestBtn" type="button" onclick="runLiveAdblockAudit()" class="btn btn-go px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer">Run 8-Point Live Benchmark</button>
            <a href="/test-lab" class="btn px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm no-underline">Open Main Test Lab &rarr;</a>
          </div>
        </div>
        <div id="abChecksGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">1. Google AdSense Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">2. DoubleClick GPT Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">3. Google Analytics Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">4. Video Ad Status Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">5. Outbrain Native Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">6. Cryptominer Host Probe</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">7. Cosmetic Banner Bait</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
          <div class="ab-check-card bg-slate-50 border border-slate-200 rounded-xl p-3.5"><strong class="text-sm text-gray-900">8. AdSense Slot Bait</strong><div class="ab-status text-xs text-gray-600 mt-1">Pending probe...</div></div>
        </div>
      </section>
      <script>
        async function probeNetworkBlocked(url) {
          var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 2500) : null;
          try {
            await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
            if (timer) clearTimeout(timer);
            return { blocked: false, reason: 'Request succeeded (unblocked)' };
          } catch (err) {
            if (timer) clearTimeout(timer);
            if (err && err.name === 'AbortError') return { blocked: false, reason: 'Request timed out (inconclusive)' };
            return { blocked: true, reason: 'Blocked by browser/extension' };
          }
        }
        function probeCosmeticHidden(buildEl) {
          var el = buildEl();
          el.style.position = 'fixed';
          el.style.left = '-9999px';
          el.style.width = '300px';
          el.style.height = '250px';
          document.body.appendChild(el);
          var cs = window.getComputedStyle(el);
          var hidden = el.offsetHeight === 0 || cs.display === 'none' || cs.visibility === 'hidden';
          document.body.removeChild(el);
          return hidden ? { blocked: true, reason: 'Collapsed by cosmetic rule' } : { blocked: false, reason: 'Bait element visible (unblocked)' };
        }
        async function runLiveAdblockAudit() {
          var statuses = document.querySelectorAll('#abChecksGrid .ab-status');
          for (var j = 0; j < statuses.length; j++) { statuses[j].textContent = 'Running probe...'; }
          var results = await Promise.all([
            probeNetworkBlocked('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'),
            probeNetworkBlocked('https://securepubads.g.doubleclick.net/tag/js/gpt.js'),
            probeNetworkBlocked('https://www.google-analytics.com/analytics.js'),
            probeNetworkBlocked('https://static.doubleclick.net/instream/ad_status.js'),
            probeNetworkBlocked('https://widgets.outbrain.com/outbrain.js'),
            probeNetworkBlocked('https://coinhive.com/lib/coinhive.min.js'),
            Promise.resolve(probeCosmeticHidden(function() { var d = document.createElement('div'); d.className = 'adsbox ad-banner'; return d; })),
            Promise.resolve(probeCosmeticHidden(function() { var ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.setAttribute('data-ad-slot', '1234567890'); return ins; }))
          ]);
          var passed = 0;
          for (var i = 0; i < statuses.length && i < results.length; i++) {
            if (results[i].blocked) { passed++; statuses[i].textContent = results[i].reason; statuses[i].style.color = '#047857'; }
            else { statuses[i].textContent = results[i].reason; statuses[i].style.color = '#b45309'; }
          }
          var pct = Math.round((passed / 8) * 100);
          document.getElementById('abScoreDisplay').textContent = passed + '/8 Probes Blocked (' + pct + '%)';
        }
        window.addEventListener('DOMContentLoaded', function() { setTimeout(runLiveAdblockAudit, 250); });
      </script>
    `
  },
  {
    slug: 'dns-leak-test',
    canonicalPath: '/tools/dns-leak-test',
    title: 'URL Tracking Parameter Sanitizer | SWEEPR Deepblock',
    description: 'Strip fbclid, gclid, msclkid, and UTM cross-site tracking parameters from shared URLs client-side.',
    h1: 'URL Tracking Parameter Sanitizer',
    badge: 'Client-Side Link Hygiene Utility',
    lead: 'Paste any messy tracking link below to inspect and strip common cross-site tracking parameters (fbclid, gclid, msclkid, utm_source) locally in your browser.',
    appName: 'SWEEPR URL Tracking Parameter Sanitizer Tool',
    faqs: [
      {
        q: 'What tracking parameters does SWEEPR Deepblock strip automatically?',
        a: 'SWEEPR Deepblock strips 20 tracking parameters via tracker_params.json including gclid, gclsrc, fbclid, msclkid, twclid, ttclid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, mc_eid, oly_enc_id, oly_anon_id, _hsenc, _hsmi, vero_id, igshid, yclid, and rb_clickid.'
      },
      {
        q: 'Does SWEEPR Deepblock include a VPN or DoH DNS proxy?',
        a: 'No. SWEEPR Deepblock filters ads, trackers, cryptominers, cookie banners, and URL parameters at the browser Manifest V3 layer. For device-wide VPN encryption, see Sweepr VPN.'
      }
    ],
    renderToolInteractive: () => `
      <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <label for="dirtyUrlInput" class="block text-sm font-bold text-gray-900">Test URL Tracking Parameter Sanitizer:</label>
        <div class="flex flex-col sm:flex-row gap-3">
          <input id="dirtyUrlInput" type="url" value="https://example-shop.co.uk/product?id=42&amp;utm_source=newsletter&amp;fbclid=IwAR123456789&amp;gclid=Cj0KCQjw&amp;msclkid=89ab34cd" class="flex-1 bg-slate-50 border border-slate-300 text-gray-900 px-3.5 py-2.5 rounded-xl font-mono text-xs sm:text-sm" />
          <button type="button" onclick="sanitizeTestUrl()" class="btn btn-go px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer shrink-0">Sanitize URL</button>
        </div>
        <div id="cleanUrlResultBox" class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div class="text-xs font-semibold text-gray-600">Sanitized Canonical Output:</div>
          <code id="cleanUrlOutput" class="block text-sm font-bold text-emerald-700 font-mono" style="word-break:break-all;">https://example-shop.co.uk/product?id=42</code>
          <div id="strippedBadges" class="text-xs font-semibold text-sky-700">4 cross-site tracking parameters stripped (utm_source, fbclid, gclid, msclkid)</div>
        </div>
      </section>
      <script>
        function sanitizeTestUrl() {
          var raw = document.getElementById('dirtyUrlInput').value.trim();
          try {
            var u = new URL(raw);
            var trackers = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','gclsrc','msclkid','mc_eid','igshid','twclid','ttclid','_hsenc','_hsmi','vero_id','oly_enc_id','oly_anon_id','yclid','rb_clickid'];
            var removed = [];
            trackers.forEach(function(k) { if (u.searchParams.has(k)) { removed.push(k); u.searchParams.delete(k); } });
            document.getElementById('cleanUrlOutput').textContent = u.toString();
            document.getElementById('strippedBadges').textContent = removed.length > 0
              ? removed.length + ' tracking parameter(s) stripped: ' + removed.join(', ')
              : 'URL is already clean (0 known tracking parameters found)';
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
    title: 'Browser Fingerprint Viewer: Canvas & WebGL | SWEEPR',
    description: 'Inspect your browser HTML5 Canvas 2D hash, WebGL renderer string, and hardware concurrency attributes locally.',
    h1: 'Browser Fingerprint & Canvas Entropy Viewer',
    badge: 'Client-Side Browser Entropy Viewer',
    lead: 'Inspect the HTML5 Canvas, WebGL renderer, and hardware attributes exposed to page scripts in your current browser.',
    appName: 'SWEEPR Browser Fingerprint Audit Tool',
    faqs: [
      {
        q: 'Why does Incognito Mode not hide browser hardware attributes?',
        a: 'Incognito mode clears cookies on close, but JavaScript APIs like HTML5 Canvas, WebGL renderer strings, and hardwareConcurrency still report hardware properties unless blocked or constrained by the browser.'
      },
      {
        q: 'How does SWEEPR Deepblock help limit cross-site tracking?',
        a: `SWEEPR Deepblock v${VERSION} blocks known third-party analytics and tracking scripts at the MV3 declarativeNetRequest network layer before they execute and strips 20 cross-site URL click IDs.`
      }
    ],
    renderToolInteractive: () => `
      <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div>
            <div class="text-xs font-bold uppercase text-gray-500">Local Fingerprint Vectors Inspected</div>
            <div id="fpSummaryStatus" class="text-xl font-extrabold text-gray-900">Scanning Browser Attributes...</div>
          </div>
          <button type="button" onclick="runFingerprintAudit()" class="btn btn-go px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer">Re-Run Viewer</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5"><div class="text-xs text-gray-600">HTML5 Canvas 2D Hash</div><div id="fpCanvasVal" class="font-mono font-bold text-gray-900 mt-1 text-sm">Computing...</div></div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5"><div class="text-xs text-gray-600">WebGL Renderer</div><div id="fpWebglVal" class="font-mono font-bold text-gray-900 mt-1 text-sm">Computing...</div></div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5"><div class="text-xs text-gray-600">Hardware / Screen</div><div id="fpHwVal" class="font-mono font-bold text-gray-900 mt-1 text-sm">Computing...</div></div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5"><div class="text-xs text-gray-600">Script Visibility</div><div id="fpShieldVal" class="font-bold text-amber-700 mt-1 text-sm">Checking...</div></div>
        </div>
      </section>
      <script>
        function runFingerprintAudit() {
          try {
            var c = document.createElement('canvas');
            c.width = 160; c.height = 36;
            var ctx = c.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#059669';
            ctx.fillRect(10, 4, 80, 20);
            ctx.fillStyle = '#111827';
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
            document.getElementById('fpHwVal').textContent = (navigator.hardwareConcurrency || '?') + ' cores / ' + screen.width + 'x' + screen.height;
            document.getElementById('fpShieldVal').textContent = 'Readable by Page Scripts';
            document.getElementById('fpSummaryStatus').textContent = 'Browser Entropy Values Measured Locally';
          } catch (e) {}
        }
        window.addEventListener('DOMContentLoaded', runFingerprintAudit);
      </script>
    `
  },
  {
    slug: 'is-this-shop-a-scam',
    canonicalPath: '/tools/is-this-shop-a-scam',
    title: 'Online Shop Hostname Pattern Checker | SWEEPR',
    description: 'Inspect any online store hostname locally for common discount-hyphenation patterns and high-abuse promotional TLDs before shopping.',
    h1: 'Online Shop Hostname Pattern Checker',
    badge: 'Client-Side Hostname Heuristic Utility',
    lead: 'Enter a store domain below to check for basic hostname red flags such as multi-hyphenated clearance strings or high-abuse promotional TLDs.',
    appName: 'SWEEPR Store Hostname Pattern Checker',
    faqs: [
      {
        q: 'What does this Store Hostname Pattern Checker inspect?',
        a: 'This client-side utility checks domain strings for discount-bait tokens, multi-hyphenated structures, and disposable TLDs.'
      },
      {
        q: `Does the SWEEPR Deepblock v${VERSION} extension include an in-extension store scanner?`,
        a: `No. SWEEPR Deepblock v${VERSION} focuses on Manifest V3 ad, tracker, and cryptominer blocking, automated GDPR cookie rejection, URL parameter stripping, and Total Tab & RAM Tamer.`
      }
    ],
    renderToolInteractive: () => `
      <section class="glass-card bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <label for="shopUrlInput" class="block text-sm font-bold text-gray-900">Enter Online Store Domain or URL:</label>
        <div class="flex flex-col sm:flex-row gap-3">
          <input id="shopUrlInput" type="text" placeholder="e.g. london-clearance-outlet-90off.shop" value="london-luxury-clearance-85off.shop" class="flex-1 bg-slate-50 border border-slate-300 text-gray-900 px-3.5 py-2.5 rounded-xl font-mono text-sm" />
          <button type="button" onclick="evaluateShopRisk()" class="btn btn-go px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer shrink-0">Check Hostname</button>
        </div>
        <div id="shopRiskResult" class="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
          <div id="shopRiskVerdict" class="font-bold text-base text-amber-900">Caution: 3 Hostname Pattern Signals Found</div>
          <ul id="shopRiskReasons" class="list-disc pl-5 text-sm text-amber-900 space-y-1 m-0">
            <li>Bargain/clearance keyword bait detected in hostname</li>
            <li>Multi-hyphenated storefront domain structure</li>
            <li>Disposable or high-abuse top-level domain extension</li>
          </ul>
        </div>
      </section>
      <script>
        function evaluateShopRisk() {
          var raw = document.getElementById('shopUrlInput').value.trim().toLowerCase();
          var host = raw.replace(/^https?:\\/\\//, '').split('/')[0].replace(/^www\\./, '');
          var flags = [];
          if (/(clearance|outlet|80off|85off|90off|cheap|flashsale|vip-sale|warehouse-sale)/.test(host)) {
            flags.push('Bargain/clearance keyword bait detected in hostname');
          }
          if ((host.match(/-/g) || []).length >= 2) {
            flags.push('Multi-hyphenated storefront domain structure');
          }
          if (/\\.(shop|top|xyz|buzz|icu|click|monster|rest|sbs|cfd)$/.test(host)) {
            flags.push('Disposable or high-abuse top-level domain extension');
          }
          var verdictEl = document.getElementById('shopRiskVerdict');
          var listEl = document.getElementById('shopRiskReasons');
          if (flags.length >= 2) {
            verdictEl.textContent = 'Caution: ' + flags.length + ' Hostname Pattern Signals Found';
            verdictEl.style.color = '#92400e';
          } else if (flags.length === 1) {
            verdictEl.textContent = 'Moderate Caution: 1 Hostname Signal Found';
            verdictEl.style.color = '#0369a1';
          } else {
            verdictEl.textContent = 'No Static Hostname Red Flags Detected';
            verdictEl.style.color = '#047857';
            flags.push('Always verify company registration and independent reviews before purchasing.');
          }
          listEl.innerHTML = flags.map(function(f) { return '<li>' + f + '</li>'; }).join('');
        }
      </script>
    `
  }
];

for (const tool of TOOLS) {
  const selfPath = tool.canonicalPath;
  const decision = getM1Decision(selfPath);
  const isKept = decision?.action === 'KEEP_REWRITE';
  const isConsolidate = decision?.action === 'CONSOLIDATE_301' && decision.redirectTarget;

  const robots = isKept
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : isConsolidate
      ? 'noindex, follow'
      : 'noindex, nofollow';

  const canonicalUrl = isConsolidate
    ? `${SITE_ORIGIN}${decision.redirectTarget}`
    : `${SITE_ORIGIN}${selfPath}`;

  const breadcrumbs = tool.slug === 'index'
    ? [
        { name: 'Home', item: '/' },
        { name: 'Free Browser Privacy & RAM Tools', item: '/tools' }
      ]
    : [
        { name: 'Home', item: '/' },
        { name: 'Free Browser Privacy & RAM Tools', item: '/tools' },
        { name: tool.h1, item: selfPath }
      ];

  const jsonLd = buildJsonLd({
    canonicalUrl,
    breadcrumbs,
    includeSoftwareApp: true,
    extraGraph: [
      {
        '@type': 'WebApplication',
        name: tool.appName,
        url: canonicalUrl,
        applicationCategory: 'SecurityApplication',
        applicationSubCategory: 'Browser Privacy Diagnostic',
        operatingSystem: PRODUCT_FACTS.operatingSystem,
        browserRequirements: 'Requires JavaScript enabled in any modern desktop or mobile browser',
        softwareVersion: VERSION,
        isAccessibleForFree: true,
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          name: 'SWEEPR Global Limited',
          url: `${SITE_ORIGIN}/`
        },
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
      }
    ]
  });

  const faqsHtml = `<section class="space-y-4">
    <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">Frequently Asked Questions</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${tool.faqs
        .map(
          (f) => `<div class="glass-card bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
        <h3 class="text-base font-bold text-gray-900">${escapeHtml(f.q)}</h3>
        <p class="text-sm text-gray-600 leading-relaxed m-0">${escapeHtml(f.a)}</p>
      </div>`
        )
        .join('\n      ')}
    </div>
  </section>`;

  const contentHtml = `
    ${renderBreadcrumbs(breadcrumbs)}
    <header class="space-y-3">
      <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">${escapeHtml(tool.badge)}</span>
      <h1 class="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(tool.h1)}</h1>
      <p class="text-gray-600 max-w-3xl text-base leading-relaxed">${escapeHtml(tool.lead)}</p>
    </header>

    ${tool.renderToolInteractive()}

    ${renderCtaBanner({
      badge: `${PRODUCT_FACTS.name} v${VERSION}`,
      heading: 'Block Ads, Trackers & Idle Tab Bloat Automatically',
      subtext: `${STATIC_RULES} static Manifest V3 declarativeNetRequest rules, automated GDPR cookie rejection, 20-parameter URL stripping, and Total Tab & RAM Tamer across ${PRODUCT_FACTS.devicesIncluded} devices.`,
      primaryLabel: 'Install Free Extension',
      primaryHref: '/download?install=1',
      secondaryLabel: 'Compare Pro Plans',
      secondaryHref: '/pricing'
    })}

    ${faqsHtml}

    ${renderRelatedGrid({
      heading: 'More Browser Diagnostics & Guides',
      items: KEPT_RELATED_ITEMS.filter((item) => item.href !== selfPath)
    })}
  `;

  const html = renderShellPage({
    title: tool.title,
    description: tool.description,
    canonicalUrl,
    currentPath: isKept ? selfPath : '/tools',
    lang: 'en',
    htmlLang: 'en-GB',
    robots,
    ogType: 'website',
    maxWidth: 'max-w-5xl',
    jsonLd,
    contentHtml
  });

  fs.writeFileSync(path.join(TOOLS_DIR, `${tool.slug}.html`), html, 'utf8');
}

console.log(`[TOOLS] Generated ${TOOLS.length} Holographic Pearl tool pages in website/tools/`);
