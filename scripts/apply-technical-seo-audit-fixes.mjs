#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Technical SEO & Search Quality Audit Remediation Script
 *
 * Applies deterministic, idempotent fixes across all HTML templates in `website/`:
 *  1. Replaces runtime `cdn.tailwindcss.com` scripts with static `/sweepr-tailwind.min.css?v=20261117`.
 *  2. Removes broken `/styles.css` & `/og-image.svg` refs and standardizes v1.2.9 / SWEEPR Global Limited / 5 Devices / pricing.
 *  3. Purges adult/explicit domains from all `#deepblock-live-rule-proof` tables, replacing with mainstream DNR rules.
 *  4. Strips all deprecated `FAQPage` and `HowTo` JSON-LD schemas, fixes broken `#anchor` breadcrumb URLs, and validates JSON-LD.
 *  5. Consolidates overlapping thin `/setup`, `/guides`, `/solutions`, and `/vs` permutations via `noindex, follow` + canonical.
 *  6. Rebuilds indexable `/setup/*` body sections with engine-accurate, differentiated technical prose (<40% boilerplate).
 *  7. Deduplicates repeated lead paragraphs in `/guides/*` & `/solutions/*`, adds AI Overview Direct Answer blocks & safe disclaimers.
 *  8. Generates clean `website/sitemap-index.xml` and `website/sitemap.xml` (`xmlns:xhtml`, reciprocal alternates, no `<changefreq>`/`<priority>`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logSeoChangesToCrm } from './log-seo-changes-to-crm.mjs';
import {
  ASSET_VERSION,
  PRODUCT_FACTS,
  escapeHtml,
  renderGlassCard,
  renderComparisonTable,
  renderCallout,
  renderCtaBanner,
  renderRelatedGrid
} from './lib/holographic-shell.mjs';
import {
  CONSOLIDATE_301_MAP,
  isNoIndexPrunePath,
  normalizeUrlPath
} from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const TODAY = new Date().toISOString().slice(0, 10);
const SETUP_ONLY = process.argv.includes('--setup-only');
const FLAGSHIP_SETUP_SLUGS = new Set(['google-chrome-manifest-v3', 'mozilla-firefox-desktop-android']);

const MANIFEST_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8')).version || PRODUCT_FACTS.version;
  } catch {
    return PRODUCT_FACTS.version;
  }
})();

const STATIC_RULE_COUNT = (() => {
  let total = 0;
  for (const rel of [
    'extension/rules/static_ads_and_trackers.json',
    'extension/rules/cryptominers.json',
    'extension/rules/tracker_params.json'
  ]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      const arr = Array.isArray(parsed) ? parsed : (parsed.rules || []);
      total += arr.length;
    } catch {}
  }
  return total || PRODUCT_FACTS.staticDnrRules;
})();

const BARE_AMP_RE = /&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);)/g;

function escapeBareAmpersands(raw) {
  return String(raw ?? '').replace(BARE_AMP_RE, '&amp;');
}

function escapeTextEntities(raw) {
  return escapeBareAmpersands(raw).replace(/<(?=\d)/g, '&lt;');
}

function escapeHtmlInsideCode(raw) {
  return String(raw ?? '')
    .replace(/&(?!(?:amp|lt|gt|quot|#39|#x27|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function convertBackticksToCode(str) {
  return String(str ?? '')
    .split(/(`[^`\r\n]+`)/g)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return `<code>${escapeHtmlInsideCode(part.slice(1, -1))}</code>`;
      }
      return escapeTextEntities(part);
    })
    .join('');
}

const HTML_PROTECTED_OR_TAG_RE = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<code\b[\s\S]*?<\/code>|<pre\b[\s\S]*?<\/pre>|<!--[\s\S]*?-->|<(?:\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+(?:"[^"]*"|'[^']*'|[^>"'])*)?\/?|![^>]*)>|`[^`\r\n]+`/gi;

function convertHtmlTextBackticksToCode(html) {
  const input = String(html ?? '');
  let out = '';
  let lastIndex = 0;
  HTML_PROTECTED_OR_TAG_RE.lastIndex = 0;
  for (let m; (m = HTML_PROTECTED_OR_TAG_RE.exec(input)) !== null; ) {
    if (m.index > lastIndex) {
      out += escapeTextEntities(input.slice(lastIndex, m.index));
    }
    const token = m[0];
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      out += `<code>${escapeHtmlInsideCode(token.slice(1, -1))}</code>`;
    } else {
      out += token;
    }
    lastIndex = HTML_PROTECTED_OR_TAG_RE.lastIndex;
  }
  if (lastIndex < input.length) {
    out += escapeTextEntities(input.slice(lastIndex));
  }
  return out;
}

function renderSetupCopy(str) {
  return convertBackticksToCode(
    String(str ?? '')
      .replace(/\bv1\.[23]\.\d+\b/g, `v${MANIFEST_VERSION}`)
      .replace(/\b(?:242|271)(?=\+?\s+static\b|\+\s+priority\b)/gi, String(STATIC_RULE_COUNT))
  );
}

// Authoritative M1 consolidation map (relative to website/ -> target canonical path)
const CONSOLIDATE_MAP = Object.fromEntries(
  Array.from(CONSOLIDATE_301_MAP.entries()).map(([srcPath, targetPath]) => [
    `${srcPath.replace(/^\//, '')}.html`,
    targetPath
  ])
);

const ADULT_RULE_RE = /(eporner|pornoxo|pornoeggs|freeporn|hqporn|sxyprn|realxxx|hotxxx|hotadult|faphouse|tubecup|doublepimp|tophqcam|xlivrdr|doppiocdn|awmdelivery|camsoda|nuvid|nvdst|drtuber|txxx|rvmessage|rvrpush|fhgte|fh-wgt|qoqh|lxax|koxk|u5s5|ey43|ero-advertising|trafficjunky|traffichunt|adspyglass|juicyads|plugrush|exoclick|exosrv|magsrv|pemsrv|realsrv|adxpansion|adtng|tsyndicate|crakrevenue|jads\.co|xvideos|xnxx|xhamster|redtube|youporn|spankbang|chaturbate|stripchat|bongacams|livejasmin|onlyfans)/i;

const CLEAN_REPLACEMENT_RULES = [
  { id: 1, pattern: '||doubleclick.net^', action: 'block (priority 2)', types: 'script, sub_frame, xmlhttprequest', scope: 'Ad-exchange wrapper' },
  { id: 2, pattern: '||googlesyndication.com^', action: 'block (priority 2)', types: 'script, sub_frame', scope: 'Display ad network' },
  { id: 8, pattern: '||criteo.com^', action: 'block (priority 2)', types: 'script, xmlhttprequest, image', scope: 'Cross-site retargeting' },
  { id: 12, pattern: '||taboola.com^', action: 'block (priority 2)', types: 'script, xmlhttprequest, sub_frame', scope: 'Native widget bidder' },
  { id: 14, pattern: '||pubmatic.com^', action: 'block (priority 2)', types: 'script, xmlhttprequest', scope: 'OpenRTB header bidder' },
  { id: 18, pattern: '||rubiconproject.com^', action: 'block (priority 2)', types: 'script, xmlhttprequest', scope: 'Prebid SSP auction' }
];

const PIRACY_DISCLAIMER_FILES = new Set([
  'solutions/1337x-torrent-indexer-block-video-ads.html',
  'solutions/nyaa-si-anime-torrents-strip-tracking-parameters.html',
  'solutions/rapidgator-file-downloads-block-video-ads.html',
  'guides/how-to-block-torrent-site-fake-download-buttons.html'
]);

// Engine-accurate, distinct technical profiles for kept /setup/* pages (<38% boilerplate)
const SETUP_PROFILES = {
  'arc-browser-windows-mac': {
    engine: 'Blink / Chromium + Swift macOS / WinUI 3 Shell',
    installPath: 'Chrome Web Store (.crx)',
    answer: `Arc Browser executes Chromium MV3 extensions inside Space-scoped profiles. Installing SWEEPR Deepblock v${MANIFEST_VERSION} blocks OpenRTB auctions natively inside Chromium’s network layer with ${STATIC_RULE_COUNT} static rules and pairs with Total Tab & RAM Tamer tab hibernation.`,
    sections: [
      { h: 'How Arc Spaces & Boosts Interact with MV3 Rules', p: 'Because Arc maintains persistent background Spaces, Split Views, and Little Arc peek overlays simultaneously, unblocked Prebid timers continue allocating V8 memory even inside minimized folders. SWEEPR Deepblock attaches Chromium declarativeNetRequest rulesets across all Space profiles without altering custom Arc Boost CSS tweaks.' },
      { h: 'Recommended Arc Preferences (macOS & Windows 11)', p: 'After adding SWEEPR Deepblock from the Chrome Web Store, open arc://extensions -> Details and enable "Allow in Incognito" so ephemeral Guest/Incognito Little Arc windows enforce the same automated OneTrust and Sourcepoint rejection rules alongside tab sleep timers.' }
    ],
    compareLabel: `Unconfigured Arc vs. Arc + SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['Space Renderer Overhead', 'High (active iframes in pinned tabs)', 'Reduced via pre-socket DNR ad blocking'],
      ['Little Arc Popup Windows', 'Loads full cookie banners on hover', 'Auto-rejected cleanly without scroll lock'],
      ['MV3 Compliance & Static Rules', 'Built-in Chromium Blink stack', `${STATIC_RULE_COUNT} static DNR rules (264 + 18 + 1)`]
    ],
    steps: [
      'Open arc://extensions or visit the Chrome Web Store link via sweeprdeepblock.com/download.',
      `Click Add to Chrome to deploy SWEEPR Deepblock v${MANIFEST_VERSION} across every Space.`,
      'Verify Little Arc video playback and anti-adblock stealth on /test-lab.'
    ],
    peers: ['/setup/zen-browser-privacy-tabs', '/setup/thorium-chromium-browser', '/setup/google-chrome-manifest-v3']
  },
  'brave-browser-deepstealth': {
    engine: 'Chromium Blink + Native Rust adblock-rust Engine',
    installPath: 'Chrome Web Store (.crx)',
    answer: `While Brave Shields blocks standard banners natively via Rust lists, adding SWEEPR Deepblock v${MANIFEST_VERSION} adds automated Didomi/Usercentrics CMP auto-rejection, URL tracker parameter stripping, cryptominer blocking, and Total Tab & RAM Tamer hibernation.`,
    sections: [
      { h: `Coexistence Architecture: Brave Shields + DeepStealth v${MANIFEST_VERSION}`, p: 'Running two aggressive cosmetic scriptlet engines concurrently on YouTube can trigger duplicate MutationObserver callbacks. SWEEPR Deepblock detects Brave cleanly and pairs its 283 static DNR rules with CMP auto-rejection, URL tracking parameter stripping, and idle tab suspension.' },
      { h: 'Eliminating EU Cookie Walls That Brave Lists Hide Silently', p: 'European Usercentrics and Didomi overlays frequently inject overflow:hidden on documentElement before cosmetic hiding rules apply. SWEEPR Deepblock programmatically invokes non-essential TCF v2.2 opt-out callbacks so vertical scrolling remains instantaneous.' }
    ],
    compareLabel: 'Brave Shields Alone vs. Brave + SWEEPR Deepblock',
    rows: [
      ['URL Tracker Stripping & Miners', 'Basic tracker list defaults', 'Dedicated URL parameter & 18 cryptominer DNR rules'],
      ['EU CMP Scroll-Lock Remediation', 'CSS hide often leaves scroll frozen', 'Programmatic TCF v2.2 Reject-All (No Scroll Lock)'],
      ['Multi-Tab Hibernation', 'Basic Memory Saver', 'Total Tab & RAM Tamer + session crash recovery']
    ],
    steps: [
      'Confirm Brave is updated to a current Chromium MV3 build so dynamic rule quotas run smoothly.',
      'Install SWEEPR Deepblock from Chrome Web Store; set Brave Shields Trackers & Ads to Standard to prevent scriptlet races.',
      'Confirm live anti-detection status inside /test-lab.'
    ],
    peers: ['/vs/brave-shields', '/setup/brave-macos-apple-silicon', '/setup/ungoogled-chromium-mv3']
  },
  'brave-macos-apple-silicon': {
    engine: 'Native ARM64 Chromium Blink on Apple M1/M2/M3/M4',
    installPath: 'Chrome Web Store (.crx)',
    answer: `On Apple Silicon (M1–M4) Macs running macOS, Brave ARM64 unified-memory tabs still burn battery via WebRTC leaks and video bidder timers. SWEEPR Deepblock v${MANIFEST_VERSION} adds ${STATIC_RULE_COUNT} static DNR rules, Canvas/Metal fingerprint noise, and background tab suspension.`,
    sections: [
      { h: 'Preserving MacBook Unified Memory & Neural Engine Battery', p: 'macOS Activity Monitor shows unified memory pressure surging when ad-heavy Fandom wikis or UK news tabs poll header-bidding WebSockets every second. Halting RTB loops natively in ARM64 Chromium cuts E-core wake-ups and extends unplugged battery life.' },
      { h: 'Metal GPU WebGL & Canvas Fingerprint Entropy Defense', p: 'Ad-tech scripts query Apple M-series GPU renderer strings ("Apple M3 Pro") to track users across Incognito windows. SWEEPR DeepStealth injects per-session Canvas noise without breaking Metal-accelerated video playback.' }
    ],
    compareLabel: 'ARM64 Brave Standard vs. SWEEPR Enhanced',
    rows: [
      ['Apple Silicon E-Core Wakeups', 'Elevated on RTB polling tabs', 'Reduced via native DNR network rule termination'],
      ['Apple GPU WebGL Exposure', 'Unmasked M-series renderer ID', 'Randomized Canvas & DeepStealth entropy shield'],
      ['Cross-Browser Desktop License', 'Brave-only Sync Chain', 'Shared 5-device license covers Chrome, Edge, Brave, Firefox & Opera']
    ],
    steps: [
      'Verify "Apple Silicon" architecture inside brave://version on your MacBook or Mac Studio.',
      'Add SWEEPR Deepblock from the Chrome Web Store and pin the toolbar RAM speedometer.',
      'Verify Canvas/WebGL & live anti-detection protection via /test-lab.'
    ],
    peers: ['/setup/brave-browser-deepstealth', '/setup/orion-browser-macos-ios', '/setup/arc-browser-windows-mac']
  },
  'chromium-linux-ubuntu': {
    engine: 'Ubuntu / Fedora / Debian Chromium & Snap/Flatpak Builds',
    installPath: 'Chrome Web Store (.crx)',
    answer: `Ubuntu’s Snap-confined Chromium and Flatpak builds share WebExtension APIs inside Linux namespaces. SWEEPR Deepblock v${MANIFEST_VERSION} operates purely inside standard Chromium sandbox IPCs with ${STATIC_RULE_COUNT} static DNR rules and zero system root access.`,
    sections: [
      { h: 'Snap / Flatpak Sandbox Compatibility (Zero Native Host Needed)', p: 'Confined Linux packages often break extensions that depend on native messaging host binaries. SWEEPR Deepblock runs 100% inside the browser WebExtension sandbox—identical performance on Ubuntu Snap, Linux Mint .deb, and Fedora RPM.' },
      { h: 'Securing Linux Workstations Against Malvertising & Cryptominers', p: 'Heavy developer wikis and community portals often load hidden WebAssembly cryptominers and tracking redirects. SWEEPR pairs 18 dedicated cryptominer DNR rules with URL tracking parameter stripping (`fbclid`, `gclid`, `utm_*`).' }
    ],
    compareLabel: 'Default Linux Chromium vs. SWEEPR Protected',
    rows: [
      ['Snap/Flatpak AppArmor Friction', 'Native messaging blocked by confinement', '100% browser-sandboxed MV3 execution'],
      ['URL Tracking & Cryptominer Shield', 'Exposed to beacons & silent miners', '283 static DNR rules (264 ads + 18 miners + 1 URL rule)'],
      ['CPU Wakeups on Linux Laptops', 'Unthrottled OpenRTB iframes', 'Cuts background JavaScript heap churn']
    ],
    steps: [
      'Launch Ubuntu/Fedora Chromium and install SWEEPR Deepblock from the Chrome Web Store.',
      'Enable URL tracking parameter stripping and cookie consent auto-rejection in the extension popup.',
      'Audit all 8 vectors at /test-lab.'
    ],
    peers: ['/setup/thorium-chromium-browser', '/setup/ungoogled-chromium-mv3', '/setup/librewolf-hardened-firefox']
  },
  'floorp-browser-firefox-fork': {
    engine: 'Gecko / SpiderMonkey (Firefox ESR Base + Split/Workspace UI)',
    installPath: 'Mozilla Add-ons (.xpi)',
    answer: `Floorp builds on Firefox ESR’s Gecko engine with multi-panel Workspaces, Split View tiling, and a Web Sidebar. Installing SWEEPR Deepblock v${MANIFEST_VERSION} pairs Gecko declarativeNetRequest interception with Total Tab & RAM Tamer workspace hygiene.`,
    sections: [
      { h: 'Securing Floorp Dual Sidebars, Split Views & Persistent Workspaces', p: 'Power users run YouTube, X, or reference wikis docked inside Floorp’s left Web Panel sidebar while browsing primary Workspaces. Unblocked sidebar web apps continuously poll ad exchanges inside hidden Gecko frames. SWEEPR terminates those background auctions across every Workspace.' },
      { h: 'Gecko `webRequest` + `browser_specific_settings.gecko` Parity', p: 'Because Floorp preserves Firefox’s SpiderMonkey runtime alongside `declarativeNetRequest`, SWEEPR executes declarative rules and cosmetic cookie rejection cleanly on ESR builds without needing `about:config` overrides.' }
    ],
    compareLabel: 'Stock Floorp ESR vs. Floorp + SWEEPR XPI',
    rows: [
      ['Extension Engine Architecture', 'Mozilla Gecko ESR XPI API', 'Full Gecko DNR + `webRequest` compatibility'],
      ['Docked Web Sidebar Ad Loops', 'Runs full RTB auctions in panel', 'Intercepts sidebar trackers pre-paint'],
      ['Multi-Workspace RAM Pressure', 'High across 3+ Workspaces', 'Total Tab & RAM Tamer idle hibernation']
    ],
    steps: [
      'Open Floorp -> Menu -> Add-ons and Themes (`about:addons`), using your Mozilla Firefox ESR profile.',
      `Install SWEEPR Deepblock v${MANIFEST_VERSION} directly as a signed \`.xpi\` add-on.`,
      'Audit sidebar and split-pane protection in /test-lab.'
    ],
    peers: ['/setup/zen-browser-privacy-tabs', '/setup/mozilla-firefox-desktop-android', '/setup/librewolf-hardened-firefox']
  },
  'google-chrome-manifest-v3': {
    engine: 'Google Chrome Blink + declarativeNetRequest (MV3)',
    installPath: 'Chrome Web Store (.crx)',
    answer: `With Chrome enforcing Manifest V3 extensions, SWEEPR Deepblock v${MANIFEST_VERSION} delivers full-fidelity blocking built purely for MV3: ${STATIC_RULE_COUNT} static \`declarativeNetRequest\` rules (264 ads & trackers, 18 cryptominers, 1 URL parameter rule), DeepStealth anti-adblock bypasses, and automated cookie auto-rejection.`,
    sections: [
      { h: 'Zero MV2 Deprecation Warnings — Native Browser Rule Engine', p: 'Unlike legacy blockers forced to strip dynamic filtering during Manifest V3 migration, SWEEPR Deepblock compiles static and OTA delta rulesets straight into Chrome’s native `declarativeNetRequest` network stack without spinning up sluggish persistent background pages.' },
      { h: 'Countering YouTube’s Anti-Adblock Scripts Under Chrome MV3', p: 'Chrome strict CSP and isolated execution worlds prevent sloppy DOM tampering. SWEEPR pairs surgical ad-endpoint interception with DeepStealth cosmetic scriptlets so videos start smoothly without "Turn off your ad blocker" modals.' }
    ],
    compareLabel: `Legacy MV2 Extensions vs. Chrome MV3 SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['Chrome 2026 Store Policy Status', 'Disabled / Deprecation warning', '100% MV3 Compliant (`declarativeNetRequest`)'],
      ['YouTube Anti-Adblock Screen', 'Frequent playback block warnings', 'Verified in Live Test Lab'],
      ['GDPR Cookie Banners (Auto-Reject)', 'CSS hide leaves scroll frozen', 'Auto-rejects 150+ CMPs without scroll lock']
    ],
    steps: [
      'Install SWEEPR Deepblock directly from the official Google Chrome Web Store listing.',
      'Open the extension popup and verify Pro protections or run the RAM Speedometer.',
      'Test live anti-detection compliance in 5 seconds at /test-lab.'
    ],
    peers: ['/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026', '/vs/ublock-origin-lite', '/setup/thorium-chromium-browser']
  },
  'kiwi-browser-android': {
    engine: 'Android Mobile Browsing (Kiwi Archived Jan 2025 -> Firefox / Edge Android)',
    installPath: 'Firefox for Android (.xpi) or Edge Android Add-ons',
    answer: `Kiwi Browser for Android was officially archived in January 2025. For maintained mobile extension ad blocking on Android, install SWEEPR Deepblock v${MANIFEST_VERSION} on Mozilla Firefox for Android or Microsoft Edge Android for ${STATIC_RULE_COUNT} static rules and automated cookie consent auto-rejection.`,
    sections: [
      { h: 'Migrating Safely After Kiwi Browser’s January 2025 Archival', p: 'Continuing to run unpatched Chromium builds after Kiwi’s January 2025 discontinuation exposes Android devices to unpatched Blink security vulnerabilities. Mozilla Firefox for Android and Microsoft Edge Android both support signed extensions with active security updates.' },
      { h: 'Zero-Battery-Drain Mobile DNR Filtering & Cookie Dismissal', p: 'Instead of running battery-hungry local VPN TUN packet loops on Android, SWEEPR Deepblock filters ad networks, cryptominers, and tracking parameters (`fbclid`, `gclid`, `utm_*`) inside the browser extension pipeline while auto-rejecting fullscreen mobile CMP overlays.' }
    ],
    compareLabel: `Legacy Kiwi Android vs. Maintained Android + SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['Security Patch Status', 'Kiwi Browser archived Jan 2025', 'Actively patched Firefox / Edge Android engines'],
      ['Battery Impact vs. Local VPN Blockers', 'N/A on unpatched forks', 'Zero TUN packet loop overhead on Android battery'],
      ['Mobile Cookie Banner Freeze', 'Obstructs mobile viewports', 'Automated rejection preserving touch scroll']
    ],
    steps: [
      'Install Mozilla Firefox for Android (recommended) or Microsoft Edge Android from Google Play.',
      `Add SWEEPR Deepblock v${MANIFEST_VERSION} via the browser Extensions menu.`,
      'Confirm blocking score inside mobile Firefox/Edge by opening /test-lab.'
    ],
    peers: ['/setup/mozilla-firefox-desktop-android', '/setup/google-chrome-manifest-v3', '/tools/browser-ram-calculator']
  },
  'librewolf-hardened-firefox': {
    engine: 'Gecko Hardened Fork (Arkenfox / resistFingerprinting Defaults)',
    installPath: 'Mozilla Add-ons (.xpi)',
    answer: `LibreWolf ships hardened privacy prefs (\`privacy.resistFingerprinting\`, zero Pocket/telemetry), yet leaves CMP cookie walls and video anti-adblockers exposed. SWEEPR Deepblock v${MANIFEST_VERSION} installs cleanly via \`.xpi\` without relaxing LibreWolf’s fingerprint resistance.`,
    sections: [
      { h: 'Synergy with `privacy.resistFingerprinting` (RFP) & Zero Conflicts', p: 'LibreWolf enables Mozilla’s aggressive RFP window-size letterboxing and Canvas randomization by default. SWEEPR Deepblock detects active RFP Canvas guards in Gecko so it never double-noises graphics readbacks—focusing compute cleanly on TCF v2.2 cookie rejection and network blocking.' },
      { h: 'Preserving LibreWolf’s Ephemeral Container & Cookie Wipe Workflows', p: 'Clearing cookies on shutdown makes GDPR banners reappear on every single visit in LibreWolf. SWEEPR Deepblock auto-clicks "Reject All" automatically every session so clearing site storage on exit never costs annoying manual pop-up dismissals.' }
    ],
    compareLabel: 'LibreWolf Stock Defaults vs. LibreWolf + SWEEPR XPI',
    rows: [
      ['Session Cookie Clear -> Banner Loop', 'Must dismiss cookie walls every launch', 'Auto-rejected cleanly on every fresh launch'],
      ['RFP Canvas Fingerprint Defense', 'Already hardened in Gecko', 'Preserved cleanly without double-hooking'],
      ['URL Tracker Parameter Hygiene', 'Manual cleaning or add-on gaps', 'Strips fbclid, gclid, utm_*, msclkid automatically']
    ],
    steps: [
      'Confirm `xpinstall.signatures.required` remains enabled so signed `.xpi` packages install smoothly in LibreWolf.',
      `Add SWEEPR Deepblock v${MANIFEST_VERSION} from the official Mozilla Add-ons hub.`,
      'Verify anti-detection & WebRTC hygiene inside /test-lab.'
    ],
    peers: ['/setup/floorp-browser-firefox-fork', '/setup/waterfox-privacy-browser', '/setup/mozilla-firefox-desktop-android']
  },
  'microsoft-edge-windows-11': {
    engine: 'Windows 11 Edge Chromium + SmartScreen + Sleeping Tabs',
    installPath: 'Edge Add-ons / Chrome Web Store',
    answer: `Microsoft Edge on Windows 11 includes Strict Tracking Prevention, yet MSN/Start widgets, YouTube mid-rolls, and European GDPR banners still slip past. Adding SWEEPR Deepblock v${MANIFEST_VERSION} locks down Windows 11 Edge tabs with ${STATIC_RULE_COUNT} static DNR rules and instant cookie rejection.`,
    sections: [
      { h: 'Closing Gaps Left by Microsoft Edge Strict Tracking Prevention', p: 'Edge’s built-in Tracking Prevention relies on Disconnect.me lists intended primarily for known cross-site trackers—meaning YouTube pre-rolls, Outbrain/Taboola native ads, and OneTrust overlays render unhindered. SWEEPR closes every category cleanly.' },
      { h: 'Maximizing Windows 11 Laptop Battery with Sleeping Tabs + DNR', p: 'While Edge puts inactive background tabs to sleep after 30 minutes, active news and documentation pages keep spawning OpenRTB fetch retries. Stopping ad network scripts before execution saves GPU wakeups alongside Edge’s native efficiency scheduler.' }
    ],
    compareLabel: 'Edge Tracking Prevention Strict vs. SWEEPR Deepblock',
    rows: [
      ['YouTube & Twitch Video Pre-Rolls', 'Not blocked by Disconnect lists', 'Eliminated via MV3 rules + DeepStealth'],
      ['GDPR Banner Auto-Dismissal', 'Zero built-in CMP automation', 'Automated OneTrust/Sourcepoint auto-reject'],
      ['URL Trackers & Cryptominers', 'Partial tracker list only', `${STATIC_RULE_COUNT} static rules + URL parameter stripping`]
    ],
    steps: [
      'Open edge://extensions and click Get extensions for Microsoft Edge (or install via Chrome Web Store).',
      'Pin SWEEPR Deepblock next to the Windows 11 address bar to track blocked trackers.',
      'Verify live protection inside Edge at /test-lab.'
    ],
    peers: ['/setup/google-chrome-manifest-v3', '/setup/arc-browser-windows-mac', '/vs/total-adblock']
  },
  'mozilla-firefox-desktop-android': {
    engine: 'Mozilla Firefox Gecko / SpiderMonkey (Windows, macOS, Linux, Android)',
    installPath: 'Mozilla Add-ons (.xpi)',
    answer: `Firefox supports full Gecko \`declarativeNetRequest\` and \`webRequest\` APIs across desktop and Android. SWEEPR Deepblock v${MANIFEST_VERSION} leverages Firefox’s extension pipeline to block ${STATIC_RULE_COUNT} static ad/tracker/cryptominer patterns, strip URL tracking beacons, and auto-reject cookie banners.`,
    sections: [
      { h: 'Why Firefox Remains Unmatched for Network Request Hygiene', p: 'Whereas Chromium enforces hard limits on dynamic rulesets under MV3, Mozilla Firefox allows hybrid `webRequest` + `declarativeNetRequest` coordination inside `.xpi` add-ons. SWEEPR uses this flexibility to strip CNAME-cloaked trackers alongside URL tracking strings (`fbclid`, `gclid`, `utm_*`).' },
      { h: 'Syncing Protection Between Desktop Firefox and Android GeckoView', p: 'A single SWEEPR Deepblock license protects desktop Firefox across Windows, macOS, and Linux alongside Firefox for Android—keeping Total Cookie Protection reinforced with active cosmetic clutter removal and automated cookie consent refusal.' }
    ],
    compareLabel: 'Firefox Enhanced Tracking Protection vs. + SWEEPR Deepblock',
    rows: [
      ['Gecko Extension Permissions', 'ETP blocks known trackers only', 'Full DNR + webRequest blocking + anti-adblock'],
      ['Didomi / Usercentrics Scroll Lock', 'Visual banners remain on screen', 'Programmatic Refusal without freezing scroll'],
      ['Mobile Android Support', 'Syncs ETP only', 'Full `.xpi` DeepStealth support in Firefox Android']
    ],
    steps: [
      'Visit addons.mozilla.org or click Download on sweeprdeepblock.com inside Firefox.',
      'Approve optional host permissions so cookie consent automation runs at `document_start`.',
      'Benchmark live blocking score at /test-lab.'
    ],
    peers: ['/setup/floorp-browser-firefox-fork', '/setup/zen-browser-privacy-tabs', '/setup/librewolf-hardened-firefox']
  },
  'opera-gx-gaming-browser': {
    engine: 'Opera GX Gaming Chromium Blink + GX Control Limiter',
    installPath: 'Chrome Web Store (.crx)',
    answer: `Opera GX’s built-in ad blocker leaves Twitch mid-roll purple screens and YouTube anti-adblock modals exposed while GX Control throttles RAM externally. Pairing Opera GX with SWEEPR Deepblock v${MANIFEST_VERSION} blocks game wiki/streaming ads before allocation—preserving FPS in AAA titles.`,
    sections: [
      { h: 'Stopping Fandom, Wowhead & Twitch Ads From Stealing Game VRAM', p: 'Gamers frequently keep Fextralife, Fandom wikis, OP.GG, or Twitch streams open on a second monitor while gaming. Unblocked sticky video players and Prebid auctions consume GPU hardware decode slots even when GX Control caps total browser memory.' },
      { h: 'Avoiding Opera GX Built-In Adblocker Partner Exceptions', p: 'Disabling Opera’s built-in native ad blocker prevents double-hiding conflicts while delegating network rules to SWEEPR’s `declarativeNetRequest` engine—achieving full anti-detection parity across YouTube and Kick.' }
    ],
    compareLabel: `Opera Built-In Blocker vs. Opera GX + SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['Twitch Mid-Roll & Purple Screen', 'Frequent commercial interruptions', 'Silent stream protection without stutters'],
      ['Game Wiki Tab Overhead', 'Heavy GPU decoder + sticky player', 'Stops OpenRTB & cryptominer scripts pre-fetch'],
      ['Cookie Consent Auto-Rejection', 'Manual banner clicks', 'Automated Reject-All on 150+ CMPs']
    ],
    steps: [
      'In Opera GX Settings, toggle off "Block ads" (built-in) so SWEEPR handles all rules cleanly.',
      `Install SWEEPR Deepblock v${MANIFEST_VERSION} from the Chrome Web Store via Opera’s extension bridge.`,
      'Run the live audit on /test-lab.'
    ],
    peers: ['/solutions/fandom-game-wikis-reduce-browser-ram-usage', '/guides/how-to-block-twitch-midroll-commercials-without-black-screen', '/setup/vivaldi-power-user-browser']
  },
  'orion-browser-macos-ios': {
    engine: 'Kagi Orion on macOS (WebKit + Chrome/Firefox Extension Bridge)',
    installPath: 'Web Store / Mozilla AMO on macOS Desktop',
    answer: `Orion on macOS pairs native WebKit energy efficiency with support for Chrome \`.crx\` and Firefox \`.xpi\` add-ons. Installing SWEEPR Deepblock v${MANIFEST_VERSION} on Orion macOS adds automated CMP dismissal, URL tracker parameter stripping, and anti-detection rules (note: Safari/iOS App Store builds are not shipped).`,
    sections: [
      { h: 'macOS WebKit Memory Efficiency Paired with WebExtension Flexibility', p: 'Orion macOS users choose WebKit to slash MacBook Pro idle wattage. While Orion includes built-in Content Blockers, SWEEPR Deepblock adds interactive DOM scriptlets for Didomi, Usercentrics, and YouTube anti-adblock containers without Electron bloat.' },
      { h: 'Choosing Between Chrome Web Store vs. Firefox XPI Bridges on macOS', p: 'Inside Orion Settings -> Advanced on macOS, enable third-party Chrome/Firefox extension installation. Note that iOS Safari / Apple App Store builds are not currently shipped by SWEEPR—use Orion macOS, Brave, Chrome, or Firefox for full v1.3.1 coverage.' }
    ],
    compareLabel: 'Orion macOS Built-In Shield vs. Orion + SWEEPR Extension',
    rows: [
      ['Engine Footprint on macOS', 'Lean native macOS WebKit', 'Preserves WebKit battery & memory profile'],
      ['EU CMP Auto-Reject Logic', 'Hides static banners visually', 'Clicks official Reject-All inside shadow DOMs'],
      ['Supported Desktop Platforms', 'macOS WebKit desktop bridge', 'Shared 5-device license across macOS/Windows/Linux']
    ],
    steps: [
      'Open Orion Preferences on macOS -> General/Advanced and enable Chrome & Firefox Extensions support.',
      `Install SWEEPR Deepblock v${MANIFEST_VERSION} via the Chrome Web Store or Firefox AMO button.`,
      'Check Content Blocker + scriptlet pass rate at /test-lab.'
    ],
    peers: ['/setup/brave-macos-apple-silicon', '/setup/arc-browser-windows-mac', '/setup/mozilla-firefox-desktop-android']
  },
  'thorium-chromium-browser': {
    engine: 'Compiler-Optimized Chromium (AVX2 / AVX-512 / SSE4.2 + `--enable-quic`)',
    installPath: 'Chrome Web Store (.crx)',
    answer: `Thorium pushes raw desktop frame rates via AVX2, AES-NI, and LTO compiler flags—making third-party ad-auction JavaScript its primary remaining latency bottleneck. Installing SWEEPR Deepblock v${MANIFEST_VERSION} matches Thorium’s speed with ${STATIC_RULE_COUNT} static \`declarativeNetRequest\` rules.`,
    sections: [
      { h: 'Eliminating V8 Main-Thread Contention on AVX2 Desktop Builds', p: 'Compiler vectorization accelerates Blink layout passes dramatically, yet unblocked pages still force Thorium’s V8 isolate to compile megabytes of third-party Prebid, Taboola, and Criteo bidder scripts. Terminating those requests at the network socket lets Thorium stay responsive.' },
      { h: 'Configuring `chrome://flags` Without Breaking MV3 Rule Sync', p: 'Standard Thorium desktop releases seamlessly install signed Chrome Web Store `.crx` updates. Pair `--enable-quic` with Total Tab & RAM Tamer background hibernation (`Alt+Shift+Z`) for high-density multi-tab sessions.' }
    ],
    compareLabel: `Stock Thorium AVX2 vs. Thorium + SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['Third-Party Ad Auction Overhead', 'Full Prebid/RTB JS still parses', `${STATIC_RULE_COUNT} static MV3 DNR rules`],
      ['Multi-Tab Memory Hygiene', 'Fast layout, growing JS heap', 'Total Tab & RAM Tamer hibernation + session recovery'],
      ['EU Cookie Pop-Ups & Trackers', 'Not filtered out of the box', 'Automated CMP auto-reject & URL tracker stripping']
    ],
    steps: [
      'Launch Thorium Browser (`chrome://extensions`) and confirm MV3 support.',
      'Click Add to Chrome from the Web Store listing or load via sweeprdeepblock.com/download.',
      'Test live AVX2 browser speed & stealth at /test-lab.'
    ],
    peers: ['/setup/ungoogled-chromium-mv3', '/setup/arc-browser-windows-mac', '/setup/google-chrome-manifest-v3']
  },
  'ungoogled-chromium-mv3': {
    engine: 'Debloated Open-Source Chromium (Zero Google Binaries / `.crx` Manual)',
    installPath: 'Signed `.crx` / Unpacked `.zip` via Developer Flag',
    answer: `Ungoogled Chromium strips Google updater binaries and Chrome Web Store one-click downloads cleanly. Install SWEEPR Deepblock v${MANIFEST_VERSION} offline using our verified \`.zip\` bundle or \`--extension-mime-request-handling\` flag—gaining full offline DNR blocking with zero Google phone-home.`,
    sections: [
      { h: 'Installing Extensions Without Chrome Web Store API Calls', p: 'Because Ungoogled Chromium disables Web Store inline installation by design, visit `chrome://flags/#extension-mime-request-handling` (set to Always prompt) OR download `sweepr-deepblock-extension.zip` cleanly from `/download`, enable Developer Mode in `chrome://extensions`, and load the folder with zero cloud telemetry.' },
      { h: '100% Local-First Filter Execution Matches Ungoogled Threat Model', p: 'Security-focused users choose Ungoogled Chromium to cut Google network connections completely. SWEEPR Deepblock enforces zero browsing-history logging, local URL parameter stripping, and static DNR rules—keeping all traffic auditably clean.' }
    ],
    compareLabel: 'Bare Ungoogled Chromium vs. + SWEEPR Offline MV3',
    rows: [
      ['Extension Packaging Options', 'Web Store install button disabled', 'Clean Developer `.zip` + CRX mime prompt support'],
      ['Telemetry & Privacy Model', 'Zero Google sync/reporting', '100% on-device blocking & Zero History Logged'],
      ['URL Trackers & Cookie Consent Shield', 'None included out of the box', 'Strips fbclid/gclid & rejects 150+ CMPs']
    ],
    steps: [
      'Download the verified offline `sweepr-deepblock-extension.zip` archive on sweeprdeepblock.com/download.',
      'Open `chrome://extensions`, toggle Developer Mode ON, and select Load Unpacked.',
      'Confirm live checks offline/locally via /test-lab.'
    ],
    peers: ['/setup/thorium-chromium-browser', '/setup/chromium-linux-ubuntu', '/setup/google-chrome-manifest-v3']
  },
  'vivaldi-power-user-browser': {
    engine: 'Vivaldi Blink + React UI Shell (Tab Stacks, Workspaces, Mail/RSS)',
    installPath: 'Chrome Web Store (.crx)',
    answer: `Vivaldi’s built-in tracker blocker catches basic EasyList domains, yet fails modern YouTube anti-adblock checks, multi-layer TCF v2.2 cookie banners, and floating wiki video overlays. SWEEPR Deepblock v${MANIFEST_VERSION} shields stacked tabs and Web Panels natively inside Vivaldi.`,
    sections: [
      { h: 'Preventing Ad Auctions Inside Vivaldi Web Panels & Tab Stacks', p: 'Heavy Vivaldi multitaskers keep dozens of accordion-stacked tabs and left-edge Web Panels alive alongside Vivaldi Mail. Disabling Vivaldi’s partial built-in ad blocker (`vivaldi://settings/privacy`) lets SWEEPR’s unified DNR ruleset deduplicate blocking cleanly across tiled workspaces.' },
      { h: 'Fixing Vivaldi Workspace React Shell Jitter', p: 'Constant ad DOM mutations across four tiled tabs force Vivaldi’s React UI overlay to re-render tab title counters and favicons repeatedly. Blocking ad scripts pre-network keeps tab-tiling interactions crisp on 144Hz monitors.' }
    ],
    compareLabel: `Vivaldi Built-In Shield vs. Vivaldi + SWEEPR v${MANIFEST_VERSION}`,
    rows: [
      ['YouTube / Twitch Anti-Adblock', 'Built-in shield easily detected', 'Full stealth parity across tiled views'],
      ['Accordion Tab Stack Memory', 'Standard per-tab bidder bloat', 'DNR blocking + Total Tab & RAM Tamer hibernation'],
      ['Tiled Web Panel Cookie Modals', 'Obstructs narrow sidebars', 'Automated rejection clears panel scrollbars']
    ],
    steps: [
      'Open Settings -> Privacy and Security in Vivaldi and set Tracker & Ad Blocking to "No Blocking" (preventing duplicate checks).',
      `Install SWEEPR Deepblock v${MANIFEST_VERSION} directly from Chrome Web Store.`,
      'Verify live scorecard pass rate inside /test-lab.'
    ],
    peers: ['/setup/opera-gx-gaming-browser', '/setup/floorp-browser-firefox-fork', '/setup/arc-browser-windows-mac']
  },
  'waterfox-privacy-browser': {
    engine: 'Waterfox Gecko Fork (Firefox Base + Multi-Row / Classic UI)',
    installPath: 'Mozilla Add-ons (.xpi)',
    answer: `Waterfox strips Mozilla telemetry and Pocket integrations from the Gecko engine while retaining full \`.xpi\` extension freedom. Installing SWEEPR Deepblock v${MANIFEST_VERSION} activates automated cookie-wall rejection, video ad bypassing, and URL tracking parameter stripping without slowing Gecko.`,
    sections: [
      { h: 'Gecko `webRequest` + Oblivious Privacy Synergy', p: 'Pair Waterfox’s built-in tracking safeguards with SWEEPR’s Gecko filter table and isolated-world CMP rejector. Unlike legacy XUL extensions broken years ago, SWEEPR runs purely on modern maintained WebExtension APIs across Waterfox G6+.' },
      { h: 'Cutting Private Tab Scroll Locks & News Browsing Clutter', p: 'Waterfox private tabs wipe session cookies cleanly, causing recurring cookie walls on UK newspapers and developer forums. Automated TCF rejection eliminates repetitive modal clicks while preserving responsive reader formatting.' }
    ],
    compareLabel: 'Stock Waterfox G6+ vs. Waterfox + SWEEPR XPI',
    rows: [
      ['Extension API Model', 'Full Gecko WebExtension `.xpi`', 'Zero MV3 scriptlet throttling limits'],
      ['Automated Cookie Rejection', 'Requires manual dismissal', 'Automated rejection + overflow scroll fix'],
      ['URL Tracker & Miner Defense', 'Basic list only', '283 static rules + fbclid/gclid/utm_ stripping']
    ],
    steps: [
      'Open Waterfox `about:addons` and search or click Install via sweeprdeepblock.com/download.',
      'Verify extension permissions across Private Windows so private browsing tabs stay clean.',
      'Confirm live benchmark pass at /test-lab.'
    ],
    peers: ['/setup/mozilla-firefox-desktop-android', '/setup/librewolf-hardened-firefox', '/setup/floorp-browser-firefox-fork']
  },
  'zen-browser-privacy-tabs': {
    engine: 'Zen Browser Gecko Engine (Vertical Tabs, Zen Mods & Compact Split UI)',
    installPath: 'Mozilla Add-ons (.xpi)',
    answer: `Zen Browser delivers Arc-inspired vertical workspaces, Zen Mods UI themes, and Compact Mode on Mozilla’s fast Gecko core. Pairing Zen with SWEEPR Deepblock v${MANIFEST_VERSION} (\`.xpi\`) eliminates YouTube commercials, strips URL trackers, and stops background pinned-tab ad loops.`,
    sections: [
      { h: 'Protecting Zen Browser Compact Mode, Glance & Split Views', p: 'Zen users rely heavily on Zen Glance quick previews, Essentials pinned icons, and multi-column Split Views for side-by-side productivity. When unblocked sites trigger floating cookie curtains inside narrow split columns, half the viewport becomes unusable. SWEEPR dispatches official "Reject All" callbacks before Split View layout settles.' },
      { h: 'Gecko Unloader + Network-Layer Blocking = Minimal RAM Usage', p: 'While Zen includes aggressive Gecko tab unloading timers for background Workspaces, active foreground Essential tabs still leak memory through recurring Prebid header auctions. Stopping OpenRTB bid requests in Gecko’s WebRequest pipeline keeps Zen’s memory usage lean.' }
    ],
    compareLabel: 'Zen Browser Alone vs. Zen + SWEEPR Deepblock XPI',
    rows: [
      ['Split View & Zen Glance Popups', 'Overlays break narrow split panes', 'Auto-rejected cleanly inside Glance modals'],
      ['Gecko Extension Freedom', 'No Chromium MV2/MV3 deprecation', 'Full SpiderMonkey `webRequest` + DNR support'],
      ['Essentials / Pinned Tab Battery', 'Continuous RTB auction timers', 'Zero background ad polling when pinned']
    ],
    steps: [
      'Open Zen Browser (`about:addons`) and install SWEEPR Deepblock directly as a verified Mozilla `.xpi` package.',
      'Enable toolbar pin for quick toggle access while running Zen Compact Mode (`Ctrl+Alt+C`).',
      'Audit all 8 privacy vectors in Zen at /test-lab.'
    ],
    peers: ['/setup/floorp-browser-firefox-fork', '/setup/arc-browser-windows-mac', '/setup/mozilla-firefox-desktop-android']
  }
};

const ENGINE_INTRO_MAP = {
  gecko: 'Firefox / Gecko WebExtension (<code>declarativeNetRequest</code> + <code>webRequest</code> APIs) executed seamlessly inside SpiderMonkey without Chromium MV3 limits',
  webkit: 'macOS WebKit Extension Bridge (Orion Desktop) executed with minimal unified-memory footprint',
  chromium: 'Chromium C++ <code>declarativeNetRequest</code> rule tables paired with isolated-world DeepStealth scriptlets'
};

function detectBrowserEngine(filename) {
  if (/(firefox|floorp|zen|librewolf|waterfox|mullvad)/i.test(filename)) return 'gecko';
  if (/orion/i.test(filename)) return 'webkit';
  return 'chromium';
}

function getAllHtmlFiles(dir) {
  const results = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.html')) results.push(full);
    }
  }
  walk(dir);
  return results.sort();
}

function cleanAdultRowsInTable(html) {
  let ruleCursor = 0;
  const usedIds = new Set([...html.matchAll(/<td[^>]*>#(\d+)<\/td>/g)].map((m) => Number(m[1])));

  return html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (tr) => {
    if (!ADULT_RULE_RE.test(tr)) return tr;
    let pick = CLEAN_REPLACEMENT_RULES[ruleCursor % CLEAN_REPLACEMENT_RULES.length];
    let tries = 0;
    while (usedIds.has(pick.id) && tries < CLEAN_REPLACEMENT_RULES.length) {
      ruleCursor++;
      pick = CLEAN_REPLACEMENT_RULES[ruleCursor % CLEAN_REPLACEMENT_RULES.length];
      tries++;
    }
    usedIds.add(pick.id);
    ruleCursor++;
    return `<tr style="border-bottom:1px solid rgba(30,41,59,0.7);">
              <td style="padding:8px 10px;font-family:monospace;color:#34d399;font-weight:700;">#${pick.id}</td>
              <td style="padding:8px 10px;font-family:monospace;word-break:break-all;">${pick.pattern}</td>
              <td style="padding:8px 10px;color:#cbd5e1;">${pick.action}</td>
              <td style="padding:8px 10px;font-family:monospace;color:#94a3b8;">${pick.types}</td>
              <td style="padding:8px 10px;color:#94a3b8;">${pick.scope}</td>
            </tr>`;
  });
}

function fixBreadcrumbUrls(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) fixBreadcrumbUrls(item);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') {
      if (v === 'https://sweeprdeepblock.com/#setup') node[k] = 'https://sweeprdeepblock.com/setup/google-chrome-manifest-v3';
      else if (v === 'https://sweeprdeepblock.com/#guides') node[k] = 'https://sweeprdeepblock.com/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026';
      else if (v === 'https://sweeprdeepblock.com/#solutions') node[k] = 'https://sweeprdeepblock.com/solutions/youtube-chrome-mv3-block-video-ads';
      else if (v === 'https://sweeprdeepblock.com/#vs') node[k] = 'https://sweeprdeepblock.com/vs/total-adblock';
      else if (v === 'support@sweepr.uk') node[k] = 'support@sweeprdeepblock.com';
      else if (v === '1.2.7' || v === '1.2.2' || v === '1.2.9') node[k] = MANIFEST_VERSION;
    } else if (v && typeof v === 'object') {
      fixBreadcrumbUrls(v);
    }
  }
  const typeVal = node['@type'];
  const isType = (target) => typeVal === target || (Array.isArray(typeVal) && typeVal.includes(target));
  if ((isType('SoftwareApplication') || isType('WebApplication')) && (!node.softwareVersion || /^1\.2\.[2579]$/.test(String(node.softwareVersion)))) {
    node.softwareVersion = MANIFEST_VERSION;
  }
  if ((isType('SoftwareApplication') || isType('Product')) && node.offers) {
    const offersList = Array.isArray(node.offers) ? node.offers : [node.offers];
    for (const off of offersList) {
      if (off && typeof off === 'object') {
        if (!off.priceValidUntil) off.priceValidUntil = '2027-12-31';
        if (!off.validFrom) off.validFrom = '2026-01-01';
      }
    }
  }
}

function isDeprecatedFaqOrHowTo(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj['@type'];
  if (typeof t === 'string') return t === 'FAQPage' || t === 'HowTo';
  if (Array.isArray(t)) return t.includes('FAQPage') || t.includes('HowTo');
  return false;
}

function sanitizeJsonLdBlocks(html) {
  return html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (fullMatch, jsonText) => {
    const trimmed = jsonText.trim();
    if (!trimmed) return '';
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return fullMatch;
    }

    if (isDeprecatedFaqOrHowTo(data)) {
      return '';
    }
    if (Array.isArray(data['@graph'])) {
      data['@graph'] = data['@graph'].filter((item) => !isDeprecatedFaqOrHowTo(item));
      if (data['@graph'].length === 0) return '';
    }
    fixBreadcrumbUrls(data);
    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });
}

function setRobotsMeta(html, robotsContent) {
  if (/<meta\s+name=["']robots["']\s+content=["'][^"']*["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["'][^>]*>/i, `<meta name="robots" content="${robotsContent}" />`);
  }
  return html.replace(/<\/head>/i, `  <meta name="robots" content="${robotsContent}" />\n</head>`);
}

function setCanonicalHref(html, canonicalUrl) {
  if (/<link\s+rel=["']canonical["']\s+href=["'][^"']*["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["']\s+href=["'][^"']*["'][^>]*>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
  }
  return html.replace(/<\/head>/i, `  <link rel="canonical" href="${canonicalUrl}" />\n</head>`);
}

function buildCustomSetupBody(slugKey, profile, h1Text, badgeText, leadText) {
  const stepsHtml = profile.steps
    .map((s) => `<li>${renderSetupCopy(s)}</li>`)
    .join('\n      ');

  const sectionsHtml = profile.sections
    .map((sec) =>
      renderGlassCard({
        title: sec.h.replace(/`([^`]+)`/g, '$1'),
        bodyHtml: `<p class="text-sm text-gray-700 leading-relaxed">${renderSetupCopy(sec.p)}</p>`
      })
    )
    .join('\n\n    ');

  const peerItems = (profile.peers || [])
    .filter((p) => {
      const norm = normalizeUrlPath(p);
      return !isNoIndexPrunePath(norm) && !CONSOLIDATE_301_MAP.has(norm);
    })
    .map((p) => ({
      href: p,
      badge: 'Engine Peer Guide',
      label: p
        .replace('/setup/', '')
        .replace('/vs/', 'vs ')
        .replace('/tools/', '')
        .replace('/guides/', '')
        .replace('/solutions/', '')
        .replace(/-/g, ' ')
    }));

  const tableRows = (profile.rows || []).map(([metric, beforeVal, afterVal]) => [
    String(metric || '').replace(/`([^`]+)`/g, '$1'),
    String(beforeVal || '').replace(/`([^`]+)`/g, '$1'),
    String(afterVal || '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\bv1\.[23]\.\d+\b/g, `v${MANIFEST_VERSION}`)
  ]);

  return `<header class="space-y-4">
      <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${renderSetupCopy(badgeText)} • ${renderSetupCopy(profile.engine)}</div>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">${convertHtmlTextBackticksToCode(h1Text)}</h1>
      <p class="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl">${convertHtmlTextBackticksToCode(leadText)}</p>
    </header>

    <section aria-label="Direct Answer Summary">
      ${renderCallout({
        title: `Install Package: ${profile.installPath.replace(/`([^`]+)`/g, '$1')}`,
        tone: 'emerald',
        bodyHtml: `<p class="mb-2"><strong>Quick Engineering Verdict:</strong> ${renderSetupCopy(profile.answer)}</p>
        <div class="flex flex-wrap gap-4 text-xs font-bold">
          <a href="/test-lab" class="text-emerald-700 underline">Run Live Anti-Detection Test Lab →</a>
          <a href="/tools/browser-ram-calculator" class="text-sky-700 underline">Estimate Multi-Tab RAM Savings →</a>
        </div>`
      })}
    </section>

    ${sectionsHtml}

    <div class="space-y-3">
      <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Performance Matrix: ${renderSetupCopy(profile.compareLabel)}</h2>
      ${renderComparisonTable({
        headers: ['Browser Layer', 'Default Configuration', `SWEEPR Deepblock v${MANIFEST_VERSION}`],
        rows: tableRows
      })}
    </div>

    ${renderGlassCard({
      title: `Deployment Steps (${profile.installPath.replace(/`([^`]+)`/g, '$1')})`,
      bodyHtml: `<ol class="space-y-2 text-sm text-gray-700 list-decimal pl-5">${stepsHtml}</ol>`
    })}

    ${renderCtaBanner({
      badge: `SWEEPR Deepblock v${MANIFEST_VERSION}`,
      heading: '5-Device Unified Protection Across Chrome, Edge, Firefox, Brave & Opera',
      subtext: '£1.99 1st month intro (then £4.99/mo), £19.99/6mo, or £29.99/yr Pro (£2.50/mo eq.). Backed by 1-click portal cancellation & 14-day refund guarantee.',
      primaryLabel: 'Unlock Pro (£2.50/mo Annual)',
      primaryHref: '/order?plan=annual',
      secondaryLabel: 'Download Extension',
      secondaryHref: '/download'
    })}

    ${renderRelatedGrid({
      heading: 'Related Browser Engine Guides',
      items: peerItems
    })}`;
}

let stats = {
  filesProcessed: 0,
  filesModified: 0,
  consolidatedCount: 0,
  setupDifferentiated: 0,
  guidesUpgraded: 0,
  adultTablesCleaned: 0,
  jsonLdFailures: []
};

for (const filePath of getAllHtmlFiles(WEBSITE_DIR)) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  if (SETUP_ONLY && !rel.startsWith('setup/')) continue;
  stats.filesProcessed++;
  const orig = fs.readFileSync(filePath, 'utf8');
  let html = orig;

  // 1. Replace Tailwind JIT runtime + all preconnect/dns-prefetch hints + broken CSS/OG assets globally
  html = html.replace(/\s*<link\b[^>]*href=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*/gi, '\n');
  html = html.replace(/<script\b[^>]*src=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi, `<link rel="stylesheet" href="/sweepr-tailwind.min.css?v=${ASSET_VERSION}" />`);
  html = html.replace(/href=["']\/styles\.css["']/gi, 'href="/style.css"');
  html = html.replace(/https:\/\/sweeprdeepblock\.com\/og-image\.svg/gi, 'https://sweeprdeepblock.com/og-image.png');
  html = html.replace(/\/favicon\.svg/gi, '/logo.svg');

  // 2. Purge adult domain filter rows from rule proof tables
  if (ADULT_RULE_RE.test(html)) {
    const cleaned = cleanAdultRowsInTable(html);
    if (cleaned !== html) {
      html = cleaned;
      stats.adultTablesCleaned++;
    }
  }

  // 3. Global entity/version/pricing normalization across SEO, legal, and programmatic pages
  const isCheckoutOrMockup = /^(order|login|success|account|cancel|mockups|popup-mockups|ios-app)\.html$/i.test(rel) || rel.startsWith('checkout/');
  html = html
    .replace(/SWEEPR Simple Storage Ltd\.?/g, 'SWEEPR Global Limited')
    .replace(/support@sweepr\.uk/gi, 'support@sweeprdeepblock.com')
    .replace(/v1\.2\.[2579]/g, `v${MANIFEST_VERSION}`)
    .replace(/Version 1\.2\.[2579]/g, `Version ${MANIFEST_VERSION}`);

  if (!isCheckoutOrMockup) {
    html = html
      .replace(/£9\.99\/mo,\s*£44\.99\/6mo,\s*(?:or\s*)?£59\.99\/yr/gi, '£1.99 1st mo (then £4.99/mo), £19.99/6mo, or £29.99/yr (£2.50/mo eq.)')
      .replace(/£9\.99\/mo\s+or\s+£59\.99\/yr/gi, '£1.99 1st mo (£4.99/mo) or £29.99/yr (£2.50/mo eq.)')
      .replace(/Unlock Pro \(£4\.99\/mo Annual\)/g, 'Unlock Pro (£2.50/mo Annual)')
      .replace(/Unlock Pro \(£4\.99\/mo\)/g, 'Unlock Pro (£2.50/mo Annual)')
      .replace(/£7\.49\/mo/g, '£7.50/mo')
      .replace(/\b4 Devices\b/g, '5 Devices')
      .replace(/\b4 devices\b/g, '5 devices')
      .replace(/\(4 devices\)/gi, '(5 devices)');
  }

  // 4. Add Español (/es) link to legacy footers that have /fr but lack /es (light Holographic Pearl class)
  if (html.includes('href="/fr"') && !html.includes('href="/es"') && /<\/footer>/i.test(html)) {
    html = html.replace(
      /(<a\s+href="\/fr"[^>]*>Français[^<]*<\/a>)/i,
      '$1\n        <a href="/es" hreflang="es" class="hover:text-emerald-600 transition-colors">Español (/es)</a>'
    );
  }

  // 5. Consolidate canonical & noindex on overlapping permutations + NOINDEX_PRUNE protection
  const routeFromRel =
    rel === 'index.html'
      ? '/'
      : rel.endsWith('/index.html')
        ? '/' + rel.replace(/\/index\.html$/, '')
        : '/' + rel.replace(/\.html$/, '');

  if (!SETUP_ONLY && CONSOLIDATE_MAP[rel]) {
    html = setRobotsMeta(html, 'noindex, follow');
    html = setCanonicalHref(html, `https://sweeprdeepblock.com${CONSOLIDATE_MAP[rel]}`);
    stats.consolidatedCount++;
  } else if (!SETUP_ONLY && isNoIndexPrunePath(routeFromRel)) {
    html = setRobotsMeta(html, 'noindex, nofollow');
    html = setCanonicalHref(html, `https://sweeprdeepblock.com${routeFromRel}`);
  }

  // 6. Strip legacy #deepblock-live-rule-proof, #deepblock-ctr-*, and dark #gsc-exact-query-enrichment slop blocks across all 4 PSEO clusters
  if (!SETUP_ONLY && /^(setup|guides|solutions|vs)\//i.test(rel)) {
    html = html
      .replace(/\s*<section\b[^>]*\bid=["']deepblock-live-rule-proof["'][^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/\s*<section\b[^>]*\bid=["']deepblock-ctr-(?:intent-)?enrichment["'][^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/\s*<section\b[^>]*\bid=["']gsc-exact-query-enrichment["'][^>]*>[\s\S]*?<\/section>/gi, (block) =>
        /(?:#0f172a|#1e293b|bg-slate-900)/i.test(block) ? '' : block
      );
  }

  // Differentiate indexable /setup/*.html guides
  if (rel.startsWith('setup/') && (SETUP_ONLY || (!CONSOLIDATE_MAP[rel] && !isNoIndexPrunePath(routeFromRel)))) {
    const slugKey = rel.replace(/^setup\//, '').replace(/\.html$/, '');
    const profile = SETUP_PROFILES[slugKey];
    const isIndexable = !/<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
    if (isIndexable) {
      html = html
        .replace(/(<title>)([\s\S]*?)(<\/title>)/gi, (_, a, b, c) => `${a}${escapeTextEntities(b)}${c}`)
        .replace(
          /(<meta\b[^>]*\b(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/gi,
          (_, a, b, c) => `${a}${escapeTextEntities(b)}${c}`
        );
    }
    if (SETUP_ONLY) {
      html = html
        .replace(/\s*<section\b[^>]*\bid=["']deepblock-live-rule-proof["'][^>]*>[\s\S]*?<\/section>/gi, '')
        .replace(/\s*<section\b[^>]*\bid=["']deepblock-ctr-(?:intent-)?enrichment["'][^>]*>[\s\S]*?<\/section>/gi, '')
        .replace(/\s*<section\b[^>]*\bid=["']gsc-exact-query-enrichment["'][^>]*>[\s\S]*?<\/section>/gi, (block) =>
          /(?:#0f172a|#1e293b|bg-slate-900)/i.test(block) ? '' : block
        );
    }

    if (FLAGSHIP_SETUP_SLUGS.has(slugKey) && isIndexable) {
      // Preserve custom v1.3.1 flagship sections while converting any literal backticks and bare & in <main>
      html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, (mainBlock) => convertHtmlTextBackticksToCode(mainBlock));
      stats.setupDifferentiated++;
    } else if (profile && isIndexable) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const leadMatch = html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
      const mainStartIdx = html.indexOf('<main');
      const mainTagEnd = mainStartIdx !== -1 ? html.indexOf('>', mainStartIdx) + 1 : -1;
      const footerIdx = html.search(/<footer\b|<\/main>/i);
      if (h1Match && leadMatch && mainTagEnd !== -1 && footerIdx !== -1 && footerIdx > mainTagEnd) {
        const prefix = html.slice(0, mainTagEnd);
        const suffix = html.slice(footerIdx);
        const h1Clean = h1Match[1].trim();
        const leadClean = leadMatch[1].trim();
        const customSection = buildCustomSetupBody(slugKey, profile, h1Clean, `SWEEPR Deepblock v${MANIFEST_VERSION} Setup`, leadClean);

        html = `${prefix}\n    ${customSection}\n\n    ${suffix}`;
        html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, (mainBlock) => convertHtmlTextBackticksToCode(mainBlock));
        stats.setupDifferentiated++;
      }
    } else if (isIndexable) {
      html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, (mainBlock) => convertHtmlTextBackticksToCode(mainBlock));
    }
  }

  // 7. Upgrade indexable /guides/* and /solutions/* (deduplicate lead paragraph + add AI Overview Answer Box)
  if ((rel.startsWith('guides/') || rel.startsWith('solutions/')) && !CONSOLIDATE_MAP[rel] && !isNoIndexPrunePath(routeFromRel)) {
    const isIndexable = !/<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
    if (isIndexable) {
      // Remove duplicate lead <p> appearing immediately after <h2>How SWEEPR DeepBlock Solves This Automatically</h2>
      const leadM = html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
      if (leadM) {
        const leadNorm = leadM[1].replace(/\s+/g, ' ').trim();
        html = html.replace(
          /(<h2>How SWEEPR Deep[Bb]lock Solves This Automatically<\/h2>\s*)<p>([\s\S]*?)<\/p>/i,
          (m, h2Tag, pInner) => {
            if (pInner.replace(/\s+/g, ' ').trim() === leadNorm) {
              return h2Tag;
            }
            return m;
          }
        );

        // Inject AI Overview Direct Answer Summary if not already present and no #gsc-exact-query-enrichment block exists
        if (!html.includes('aria-label="Direct Answer Summary"') && !html.includes('id="gsc-exact-query-enrichment"')) {
          const cleanAnswer = leadNorm.replace(/<[^>]+>/g, '').slice(0, 260);
          const aiBox = `\n    <section aria-label="Direct Answer Summary" class="bg-emerald-50/70 border border-emerald-200 border-l-4 rounded-2xl p-5 my-5 text-sm text-gray-800 leading-relaxed" style="border-left-color:#059669;">
      <p class="mb-2"><strong>Summary Answer:</strong> ${escapeTextEntities(cleanAnswer)}</p>
      <div class="flex flex-wrap gap-4 text-xs font-bold">
        <a href="/test-lab" class="text-emerald-700 underline">Run Live Anti-Detection Test Lab →</a>
        <a href="/tools/browser-ram-calculator" class="text-sky-700 underline">Browser RAM Calculator →</a>
      </div>
    </section>`;
          html = html.replace(/(<\/h1>\s*<p[^>]*>[\s\S]*?<\/p>)/i, `$1${aiBox}`);
          stats.guidesUpgraded++;
        }
      }

      // Safe Browsing & Educational Security Disclaimers for piracy-adjacent guides
      if (PIRACY_DISCLAIMER_FILES.has(rel)) {
        html = html.replace(/over magnet links/gi, 'over file metadata pages and navigation buttons');
        if (!html.includes('Educational Cybersecurity Notice')) {
          const disclaimer = `\n    <aside aria-label="Security Advisory Disclaimer" class="bg-amber-50 border border-amber-200 border-l-4 rounded-2xl p-4 my-4 text-sm text-amber-900" style="border-left-color:#f59e0b;">
      <strong>Educational Cybersecurity Notice:</strong> SWEEPR Global Limited does not host, index, endorse, or facilitate copyright infringement or third-party file distribution. This security advisory documents how to mitigate malvertising pop-unders, fake executable download buttons, and phishing redirects when inspecting high-risk web domains.
    </aside>`;
          html = html.replace(/(<\/h1>\s*<p[^>]*>[\s\S]*?<\/p>)/i, `$1${disclaimer}`);
        }
      }
    }
  }

  // 8. Update remaining links pointing directly at consolidated /solutions/* or /tools/is-my-adblocker-working
  if (!SETUP_ONLY) {
    for (const [oldRel, newCanon] of Object.entries(CONSOLIDATE_MAP)) {
      const oldHref = '/' + oldRel.replace(/\.html$/, '');
      if (html.includes(`href="${oldHref}"`) && !html.includes(`href="${newCanon}"`)) {
        html = html.split(`href="${oldHref}"`).join(`href="${newCanon}"`);
      }
    }
    html = html.split('href="/tools/is-my-adblocker-working"').join('href="/test-lab"');
  }

  // 9. Sanitize & Validate all JSON-LD blocks (zero FAQPage/HowTo, valid breadcrumb URLs)
  html = sanitizeJsonLdBlocks(html);
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch (err) {
      stats.jsonLdFailures.push(`${rel}: ${err.message}`);
    }
  }

  if (html !== orig) {
    fs.writeFileSync(filePath, html, 'utf8');
    stats.filesModified++;
  }
}

let mainUrls = [];
if (!SETUP_ONLY) {
// Pass 2: Flatten all transitive noindex canonical chains, rewrite internal links pointing at noindex URLs, and sync GSC state files
const CLUSTER_DEFAULT_PILLARS = {
  solutions: '/solutions/uk-news-websites-auto-reject-cookie-popups',
  setup: '/setup/google-chrome-manifest-v3',
  vs: '/vs/total-adblock',
  guides: '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026'
};

function resolveClusterFallback(route) {
  const cluster = route.split('/').filter(Boolean)[0] || 'guides';
  return CLUSTER_DEFAULT_PILLARS[cluster] || '/';
}

const routeStatusMap = new Map();
const allHtmlPass2 = getAllHtmlFiles(WEBSITE_DIR);
for (const filePath of allHtmlPass2) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const cleanRoute =
    rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? '/' + rel.replace(/\/index\.html$/, '') : '/' + rel.replace(/\.html$/, '');
  const raw = fs.readFileSync(filePath, 'utf8');
  const isNoIndex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw);
  const isNoFollow = /<meta\s+name=["']robots["']\s+content=["'][^"']*nofollow/i.test(raw);
  const canMatch =
    raw.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) ||
    raw.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i);
  const canonicalPath = canMatch
    ? canMatch[1].trim().replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/'
    : null;
  routeStatusMap.set(cleanRoute, { filePath, rel, cleanRoute, isNoIndex, isNoFollow, canonicalPath });
}

const noIndexToFinalPillar = new Map();
for (const [cleanRoute, rec] of routeStatusMap.entries()) {
  // Never remap NOINDEX_PRUNE (noindex, nofollow) routes to pillar canonicals — they keep self-canonical + noindex, nofollow
  if (isNoIndexPrunePath(cleanRoute) || rec.isNoFollow) continue;
  if (!rec.isNoIndex || !/^\/(?:solutions|setup|vs|guides)\//i.test(cleanRoute)) continue;
  let cur = CONSOLIDATE_301_MAP.get(cleanRoute) || rec.canonicalPath;
  const visited = new Set([cleanRoute]);
  while (cur && routeStatusMap.has(cur) && routeStatusMap.get(cur).isNoIndex && !isNoIndexPrunePath(cur) && !visited.has(cur)) {
    visited.add(cur);
    cur = CONSOLIDATE_301_MAP.get(cur) || routeStatusMap.get(cur).canonicalPath;
  }
  if (!cur || !routeStatusMap.has(cur) || routeStatusMap.get(cur).isNoIndex || isNoIndexPrunePath(cur) || cur === cleanRoute) {
    cur = resolveClusterFallback(cleanRoute);
  }
  noIndexToFinalPillar.set(cleanRoute, cur);
}

stats.canonicalChainsFlattened = 0;
stats.noindexLinksRewritten = 0;

for (const filePath of allHtmlPass2) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const cleanRoute =
    rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? '/' + rel.replace(/\/index\.html$/, '') : '/' + rel.replace(/\.html$/, '');
  const orig = fs.readFileSync(filePath, 'utf8');
  let html = orig;

  const finalPillar = noIndexToFinalPillar.get(cleanRoute);
  if (finalPillar) {
    const expectedCanonUrl = `https://sweeprdeepblock.com${finalPillar}`;
    const prevRec = routeStatusMap.get(cleanRoute);
    if (prevRec?.canonicalPath !== finalPillar) {
      html = setCanonicalHref(html, expectedCanonUrl);
      stats.canonicalChainsFlattened++;
    }
  }

  html = html.replace(
    /(<a\b[^>]*?\bhref=(["']))((?:https:\/\/sweeprdeepblock\.com)?)(\/(?:solutions|setup|vs|guides)\/[a-z0-9-]+)((?:[?#][^"']*)?)(\2)/gi,
    (full, prefixTag, q, originPrefix, routePart, suffixPart, qEnd) => {
      const targetPillar = CONSOLIDATE_301_MAP.get(routePart) || noIndexToFinalPillar.get(routePart);
      if (!targetPillar || isNoIndexPrunePath(targetPillar)) return full;
      stats.noindexLinksRewritten++;
      const dest = targetPillar === cleanRoute ? resolveClusterFallback(cleanRoute) : targetPillar;
      return `${prefixTag}${originPrefix}${dest}${suffixPart}${qEnd}`;
    }
  );

  if (html !== orig) {
    fs.writeFileSync(filePath, html, 'utf8');
    stats.filesModified++;
  }
}

// Keep pillar-enrichment-state.json & keyword-opportunity-matrix.json in 100% sync with consolidated noindex routes
const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
if (fs.existsSync(ENRICHMENT_STATE_PATH)) {
  try {
    const st = JSON.parse(fs.readFileSync(ENRICHMENT_STATE_PATH, 'utf8'));
    if (Array.isArray(st.discoveredGscPaths)) {
      const syncedPaths = [];
      const seenPaths = new Set();
      for (const rawPath of st.discoveredGscPaths) {
        if (isNoIndexPrunePath(rawPath)) continue;
        const mapped = CONSOLIDATE_301_MAP.get(rawPath) || noIndexToFinalPillar.get(rawPath) || rawPath;
        const rec = routeStatusMap.get(mapped);
        if (rec && !rec.isNoIndex && !isNoIndexPrunePath(mapped) && !seenPaths.has(mapped)) {
          seenPaths.add(mapped);
          syncedPaths.push(mapped);
        }
      }
      st.discoveredGscPaths = syncedPaths;
      fs.writeFileSync(ENRICHMENT_STATE_PATH, JSON.stringify(st, null, 2), 'utf8');
    }
  } catch {}
}

const KEYWORD_MATRIX_PATH = path.join(ROOT, 'data', 'keyword-opportunity-matrix.json');
if (fs.existsSync(KEYWORD_MATRIX_PATH)) {
  try {
    const kw = JSON.parse(fs.readFileSync(KEYWORD_MATRIX_PATH, 'utf8'));
    let kwChanged = false;
    for (const opp of kw.opportunities || []) {
      const route = opp.targetRoute || opp.recommendedUrlPath;
      if (opp.isPublishedOnDisk && (!route || !routeStatusMap.has(route) || routeStatusMap.get(route).isNoIndex || isNoIndexPrunePath(route))) {
        opp.isPublishedOnDisk = false;
        kwChanged = true;
      }
    }
    if (kwChanged) {
      fs.writeFileSync(KEYWORD_MATRIX_PATH, JSON.stringify(kw, null, 2), 'utf8');
    }
  } catch {}
}

// 10. Build Clean `website/sitemap-index.xml` and `website/sitemap.xml` (zero pruned or 301-consolidated URLs)
const EXCLUDE_ROOT_SLUGS = new Set(['404.html', 'order.html', 'login.html', 'success.html', 'account.html', 'cancel.html']);
const MULTILINGUAL_HUBS = new Set(['https://sweeprdeepblock.com/', 'https://sweeprdeepblock.com/de', 'https://sweeprdeepblock.com/fr', 'https://sweeprdeepblock.com/es']);

for (const filePath of getAllHtmlFiles(WEBSITE_DIR)) {
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  if (rel.startsWith('site/')) continue;
  if (rel.startsWith('stories/')) continue;
  if (rel.startsWith('checkout/')) continue;
  if (EXCLUDE_ROOT_SLUGS.has(rel)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  const robots = (content.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i) || [])[1] || '';
  if (/noindex/i.test(robots)) continue;

  let routePath;
  if (rel === 'index.html') routePath = '/';
  else if (rel.endsWith('/index.html')) routePath = '/' + rel.replace(/\/index\.html$/, '');
  else routePath = '/' + rel.replace(/\.html$/, '');

  const normRoute = normalizeUrlPath(routePath);
  if (isNoIndexPrunePath(normRoute) || CONSOLIDATE_301_MAP.has(normRoute)) continue;

  const expectedLoc = `https://sweeprdeepblock.com${routePath}`;
  const canonicalMatch = (content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1] || '';
  if (canonicalMatch && canonicalMatch !== expectedLoc) continue;

  mainUrls.push(expectedLoc);
}

mainUrls.sort((a, b) => {
  if (a === 'https://sweeprdeepblock.com/') return -1;
  if (b === 'https://sweeprdeepblock.com/') return 1;
  return a.localeCompare(b);
});

const altTags = `    <xhtml:link rel="alternate" hreflang="en" href="https://sweeprdeepblock.com/" />
    <xhtml:link rel="alternate" hreflang="de" href="https://sweeprdeepblock.com/de" />
    <xhtml:link rel="alternate" hreflang="fr" href="https://sweeprdeepblock.com/fr" />
    <xhtml:link rel="alternate" hreflang="es" href="https://sweeprdeepblock.com/es" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://sweeprdeepblock.com/" />`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${mainUrls
  .map((loc) =>
    MULTILINGUAL_HUBS.has(loc)
      ? `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n${altTags}\n  </url>`
      : `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </url>`
  )
  .join('\n')}
</urlset>
`;

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://sweeprdeepblock.com/sitemap.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>
`;

fs.writeFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
fs.writeFileSync(path.join(WEBSITE_DIR, 'sitemap-index.xml'), sitemapIndexXml, 'utf8');
}

console.log(JSON.stringify({ ...stats, setupOnly: SETUP_ONLY, mainSitemapUrls: mainUrls.length }, null, 2));
if (stats.jsonLdFailures.length > 0) {
  process.exitCode = 1;
}

if (!process.argv.includes('--no-crm')) {
  const skipRemote = process.argv.includes('--local-only');
  try {
    await logSeoChangesToCrm({ skipRemote });
  } catch (err) {
    console.warn('[CRM Sync Hook Warning]', err?.message || err);
  }
}
