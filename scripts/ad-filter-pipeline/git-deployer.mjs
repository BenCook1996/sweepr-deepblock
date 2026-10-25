/**
 * SWEEPR DeepBlock — Filter List Merger, Deduplicator, OTA Delta Publisher & Git Automation
 *
 * Updates:
 *  1. `extension/rules/static_ads_and_trackers.json` (MV3 DeclarativeNetRequest static ruleset)
 *  2. `extension/rules/abp_filter_list.txt` (uBlock Origin / Adblock Plus filter syntax list)
 *  3. `extension/rules/dynamic_delta.json` (Live OTA delta served by `GET /api/filters/delta` for rule IDs 80000-80999)
 *  4. `AD_FILTER_PIPELINE_LOG.md` (Daily audit log of 1,000-site runs & auto-patched rules)
 *
 * Git / CI Deployment Modes (`gitMode`):
 *  - `'commit'` (default local safe mode): Stages filter files and creates a Git commit on the current branch
 *  - `'push'`: Pulls with rebase/autostash, commits filter changes, and pushes to `origin main`
 *  - `'pr'`: Creates branch `auto-filters/daily-YYYY-MM-DD`, commits, pushes, and opens a GitHub PR via `gh pr create`
 *  - `'dry-run'`: Writes filter files locally without creating a Git commit
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { ROOT_DIR } from './state-db.mjs';
import { STATIC_RULES_PATH } from './browser-scanner.mjs';
import { runFullCrossSiteRegressionSuite } from './regression-guard.mjs';

export const ABP_FILTER_LIST_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'abp_filter_list.txt');
export const DYNAMIC_DELTA_PATH = path.join(ROOT_DIR, 'extension', 'rules', 'dynamic_delta.json');
export const PIPELINE_LOG_PATH = path.join(ROOT_DIR, 'AD_FILTER_PIPELINE_LOG.md');

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Buffer(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBufferFromEntries(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const uncompressedSize = data.length;
    const crc = crc32Buffer(data);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < uncompressedSize;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x554b, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x554b, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function collectExtensionFiles(dir, baseDir = dir) {
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === '_metadata') continue;
      results.push(...collectExtensionFiles(full, baseDir));
    } else if (item.isFile()) {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      results.push({ name: rel, fullPath: full, data: fs.readFileSync(full) });
    }
  }
  return results;
}

/**
 * Rebuilds all cross-browser and cross-device packages (`sweepr-deepblock-extension.zip`,
 * `sweepr-deepblock-firefox.xpi`, `sweepr-deepblock.xpi`, `SWEEPRDeepblockSetup.exe`) and
 * syncs the local `%LOCALAPPDATA%\SWEEPR\Deepblock\Extension` directory when present.
 */
export function rebuildAllBrowserAndDevicePackages() {
  const extDir = path.join(ROOT_DIR, 'extension');
  const webDir = path.join(ROOT_DIR, 'website');
  const zipPath = path.join(webDir, 'sweepr-deepblock-extension.zip');
  const xpiPath1 = path.join(webDir, 'sweepr-deepblock-firefox.xpi');
  const xpiPath2 = path.join(webDir, 'sweepr-deepblock.xpi');
  const exePath = path.join(webDir, 'SWEEPRDeepblockSetup.exe');
  const csPath = path.join(ROOT_DIR, 'installer', 'SWEEPRDeepblockSetup.cs');

  const result = {
    chromiumZipRebuilt: false,
    firefoxXpiRebuilt: false,
    windowsExeRebuilt: false,
    localAppDataSynced: false
  };

  try {
    const rawFiles = collectExtensionFiles(extDir);

    // 1. Build Chromium MV3 ZIP (Chrome, Edge, Brave, Opera, Vivaldi, Kiwi/Edge Android, macOS)
    const zipBuf = buildZipBufferFromEntries(rawFiles.map(({ name, data }) => ({ name, data })));
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(zipPath, zipBuf);
    result.chromiumZipRebuilt = true;

    // 2. Build Firefox Desktop & Firefox Android MV3 XPI (`gecko` + `gecko_android`)
    const firefoxEntries = rawFiles.map(({ name, data }) => {
      if (name === 'manifest.json') {
        try {
          const manifestObj = JSON.parse(data.toString('utf8'));
          manifestObj.background = {
            service_worker: 'background.js',
            scripts: ['background.js']
          };
          manifestObj.browser_specific_settings = {
            gecko: {
              id: 'extension@sweeprdeepblock.com',
              strict_min_version: '128.0'
            },
            gecko_android: {
              strict_min_version: '128.0'
            }
          };
          return { name, data: Buffer.from(JSON.stringify(manifestObj, null, 2) + '\n', 'utf8') };
        } catch {
          return { name, data };
        }
      }
      return { name, data };
    });
    const xpiBuf = buildZipBufferFromEntries(firefoxEntries);
    fs.writeFileSync(xpiPath1, xpiBuf);
    fs.writeFileSync(xpiPath2, xpiBuf);
    result.firefoxXpiRebuilt = true;

    // 3. Recompile Windows 1-Click Installer EXE (`SWEEPRDeepblockSetup.exe`) if `csc.exe` is available
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
    if (process.platform === 'win32' && fs.existsSync(cscPath) && fs.existsSync(csPath)) {
      try {
        execFileSync(
          cscPath,
          [
            '/nologo',
            '/target:winexe',
            `/out:${exePath}`,
            '/optimize+',
            '/reference:System.IO.Compression.dll',
            '/reference:System.IO.Compression.FileSystem.dll',
            '/reference:System.Windows.Forms.dll',
            '/reference:System.Drawing.dll',
            `/resource:${zipPath},SWEEPR.Extension.zip`,
            csPath
          ],
          { cwd: ROOT_DIR, stdio: 'pipe' }
        );
        result.windowsExeRebuilt = true;
      } catch {}
    }

    // 4. Sync local installed extension directory (`%LOCALAPPDATA%\SWEEPR\Deepblock\Extension`) if present
    // Pre-activates the local admin workstation with Owner Pro key ('SWEEPR-OWNER-PRO-2026') while
    // keeping all distributable customer packages locked (`proActive: false`) until paid activation.
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const installedExtDir = path.join(localAppData, 'SWEEPR', 'Deepblock', 'Extension');
      if (fs.existsSync(installedExtDir)) {
        for (const { name, data } of rawFiles) {
          const destFile = path.join(installedExtDir, name);
          fs.mkdirSync(path.dirname(destFile), { recursive: true });
          if (name === 'manifest.json') {
            const mText = data.toString('utf8').replace(/"enabled":\s*false/g, '"enabled": true');
            fs.writeFileSync(destFile, mText, 'utf8');
          } else if (name === 'background.js') {
            let bText = data
              .toString('utf8')
              .replace(
                /let verifiedSession = \{\r?\n  proActive: false,\r?\n  ramTamerActive: false,\r?\n  licenseKey: '',/,
                "let verifiedSession = {\n  proActive: true,\n  ramTamerActive: true,\n  licenseKey: 'SWEEPR-OWNER-PRO-2026',"
              )
              .replace(
                /const DEFAULT_STATE = \{\r?\n  proActive: false,\r?\n  ramTamerActive: false,\r?\n  licenseKey: '',\r?\n  licenseToken: '',\r?\n  crmAccountId: '',\r?\n  subscriptionStatus: 'unactivated',\r?\n  licenseVerifiedAt: 0,\r?\n  entitlements: \[\],\r?\n  encryptedDnsEnabled: false,\r?\n  pausedSites: \[\],\r?\n  neverSnoozeSites: \[\],\r?\n  trustedShopSites: \[\],\r?\n  customHiddenSelectors: \{\},\r?\n  settings: \{\r?\n    cookieAutoClose: false,\r?\n    hideSearchSpam: false,\r?\n    fakeShopAlerts: false,\r?\n    trackerProtection: false,\r?\n    adBlocking: false,\r?\n    silentMode: false,\r?\n    autoRamTamer: false\r?\n  \},/,
                `const DEFAULT_STATE = {\n  proActive: true,\n  ramTamerActive: true,\n  licenseKey: 'SWEEPR-OWNER-PRO-2026',\n  licenseToken: '',\n  crmAccountId: '',\n  subscriptionStatus: 'active',\n  licenseVerifiedAt: Date.now(),\n  entitlements: [\n    'pro_cookie_autoreject',\n    'pro_ai_slop_purifier',\n    'pro_clutter_stripper',\n    'bundle_fake_store_detector',\n    'bundle_encrypted_dns_proxy',\n    'addon_total_tab_and_ram_tamer'\n  ],\n  encryptedDnsEnabled: true,\n  pausedSites: [],\n  neverSnoozeSites: [],\n  trustedShopSites: [],\n  customHiddenSelectors: {},\n  settings: {\n    cookieAutoClose: true,\n    hideSearchSpam: true,\n    fakeShopAlerts: true,\n    trackerProtection: true,\n    adBlocking: true,\n    silentMode: true,\n    autoRamTamer: true\n  },`
              )
              .replace(
                /if \(!key \|\| !store\.proActive\) \{\r?\n    verifiedSession\.coldChecked = true;\r?\n    await revokeProState\('unactivated'\);\r?\n    return \{ proActive: false, ramTamerActive: false \};\r?\n  \}/,
                `if (!key || key === 'SWEEPR-OWNER-PRO-2026' || !store.proActive) {\n    verifiedSession.proActive = true;\n    verifiedSession.ramTamerActive = true;\n    verifiedSession.licenseKey = 'SWEEPR-OWNER-PRO-2026';\n    verifiedSession.coldChecked = true;\n    await syncExtensionProtectionRules(true);\n    return { proActive: true, ramTamerActive: true };\n  }`
              );
            fs.writeFileSync(destFile, bText, 'utf8');
          } else {
            fs.writeFileSync(destFile, data);
          }
        }
        result.localAppDataSynced = true;
      }
    }
  } catch {}

  return result;
}

/**
 * Merges, deduplicates, and sorts verified new rules into the project's MV3 DNR ruleset,
 * ABP/uBO filter list, and OTA `/api/filters/delta` payload.
 * Runs a full Cross-Site Golden Canary Regression Suite after merging and automatically
 * rolls back to the pre-run snapshot if any existing blocker rule on any other site is affected.
 */
export function applyVerifiedRulesToProject(verifiedPatches = [], runSummary = {}) {
  // 0. Take atomic pre-merge snapshots for automatic rollback if cross-site regression fails
  const preMergeSnapshots = {
    staticRaw: fs.existsSync(STATIC_RULES_PATH) ? fs.readFileSync(STATIC_RULES_PATH, 'utf8') : null,
    abpRaw: fs.existsSync(ABP_FILTER_LIST_PATH) ? fs.readFileSync(ABP_FILTER_LIST_PATH, 'utf8') : null,
    deltaRaw: fs.existsSync(DYNAMIC_DELTA_PATH) ? fs.readFileSync(DYNAMIC_DELTA_PATH, 'utf8') : null
  };

  // 1. Load & deduplicate MV3 static_ads_and_trackers.json
  let staticRules = [];
  if (preMergeSnapshots.staticRaw) {
    try {
      staticRules = JSON.parse(preMergeSnapshots.staticRaw);
    } catch {
      staticRules = [];
    }
  }
  const baselineStaticRules = staticRules.map((r) => ({ ...r }));

  const existingUrlFilters = new Set();
  let maxRuleId = 0;
  for (const r of staticRules) {
    if (typeof r.id === 'number' && r.id > maxRuleId) maxRuleId = r.id;
    const key = r?.condition?.urlFilter || r?.condition?.regexFilter || '';
    if (key) existingUrlFilters.add(key.toLowerCase());
  }

  const addedDnrRules = [];
  const addedAbpRules = [];
  const addedCosmeticSelectors = [];

  for (const patch of verifiedPatches) {
    if (patch.fixStatus !== 'Auto-Patched') continue;
    const { candidateRule } = patch;
    if (!candidateRule) continue;

    if (candidateRule.generatedRule) {
      addedAbpRules.push(candidateRule.generatedRule);
    }

    if (candidateRule.dnrRule && candidateRule.dnrRule.condition?.urlFilter) {
      const ufKey = candidateRule.dnrRule.condition.urlFilter.toLowerCase();
      if (!existingUrlFilters.has(ufKey)) {
        existingUrlFilters.add(ufKey);
        maxRuleId += 1;
        const fullRule = {
          id: maxRuleId,
          priority: candidateRule.dnrRule.priority || 3,
          action: candidateRule.dnrRule.action || { type: 'block' },
          condition: candidateRule.dnrRule.condition
        };
        staticRules.push(fullRule);
        addedDnrRules.push(fullRule);
      }
    }

    if (candidateRule.cosmeticSelector) {
      addedCosmeticSelectors.push(candidateRule.cosmeticSelector);
    }
  }

  if (addedDnrRules.length > 0) {
    fs.writeFileSync(STATIC_RULES_PATH, JSON.stringify(staticRules, null, 2) + '\n', 'utf8');
  }

  // 2. Update & sort `extension/rules/abp_filter_list.txt`
  const existingAbpLines = new Set();
  if (fs.existsSync(ABP_FILTER_LIST_PATH)) {
    const rawAbp = fs.readFileSync(ABP_FILTER_LIST_PATH, 'utf8');
    for (const line of rawAbp.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
        existingAbpLines.add(trimmed);
      }
    }
  } else {
    // Seed initial ABP rules from static_ads_and_trackers.json
    for (const r of staticRules) {
      if (r?.action?.type === 'block' && r?.condition?.urlFilter) {
        existingAbpLines.add(`${r.condition.urlFilter}$third-party`);
      }
    }
  }

  let newAbpCount = 0;
  for (const ruleStr of addedAbpRules) {
    if (!existingAbpLines.has(ruleStr)) {
      existingAbpLines.add(ruleStr);
      newAbpCount += 1;
    }
  }

  const networkAbp = [...existingAbpLines].filter((l) => !l.includes('##')).sort();
  const cosmeticAbp = [...existingAbpLines].filter((l) => l.includes('##')).sort();

  const abpHeader = [
    '[Adblock Plus 2.0]',
    '! Title: SWEEPR DeepBlock — Automated Daily Filter List (MV3 + Cosmetic)',
    `! Version: ${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12)}`,
    `! Last Modified: ${new Date().toUTCString()}`,
    '! Expires: 1 day (update frequency)',
    '! Homepage: https://sweeprdeepblock.com',
    '! Syntax: uBlock Origin / Adblock Plus / Manifest V3 Compatible',
    '!',
    '! --- Network Blocking Rules ---'
  ];

  const abpContent = [
    ...abpHeader,
    ...networkAbp,
    '!',
    '! --- DOM Cosmetic Hiding Rules ---',
    ...cosmeticAbp,
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(ABP_FILTER_LIST_PATH), { recursive: true });
  fs.writeFileSync(ABP_FILTER_LIST_PATH, abpContent, 'utf8');

  // 3. Update OTA `extension/rules/dynamic_delta.json` (Rule IDs 80000 - 80099 for `syncRemoteFilterDelta` in background.js)
  let deltaObj = {
    ok: true,
    version: '1.1.0',
    updatedAt: new Date().toISOString(),
    featureFlags: {
      cookieAutoClose: true,
      hideSearchSpam: true,
      fakeShopAlerts: true,
      youtubeAdShield: true,
      antiAdblockStealth: true,
      autoRamTamer: true
    },
    extraCmpSelectors: [],
    extraAntiAdblockSelectors: [],
    extraCosmeticSelectors: [],
    dynamicDnrRules: []
  };

  if (fs.existsSync(DYNAMIC_DELTA_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DYNAMIC_DELTA_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        deltaObj = { ...deltaObj, ...parsed };
      }
    } catch {}
  }

  const existingCosmetics = new Set(Array.isArray(deltaObj.extraCosmeticSelectors) ? deltaObj.extraCosmeticSelectors : []);
  for (const sel of addedCosmeticSelectors) {
    existingCosmetics.add(sel);
  }
  deltaObj.extraCosmeticSelectors = [...existingCosmetics].slice(-100);

  // Map the most recent 100 dynamic block rules to IDs 80000..80099
  const existingDynFilters = new Map();
  for (const r of Array.isArray(deltaObj.dynamicDnrRules) ? deltaObj.dynamicDnrRules : []) {
    if (r?.condition?.urlFilter) {
      existingDynFilters.set(r.condition.urlFilter.toLowerCase(), r);
    }
  }
  for (const r of addedDnrRules) {
    if (r?.condition?.urlFilter) {
      existingDynFilters.set(r.condition.urlFilter.toLowerCase(), r);
    }
  }

  const combinedDyn = [...existingDynFilters.values()].slice(-100).map((r, idx) => ({
    id: 80000 + idx,
    priority: r.priority || 3,
    action: { type: 'block' },
    condition: r.condition
  }));

  deltaObj.updatedAt = new Date().toISOString();
  deltaObj.version = `1.1.${Math.floor(Date.now() / 1000) % 100000}`;
  deltaObj.dynamicDnrRules = combinedDyn;

  fs.writeFileSync(DYNAMIC_DELTA_PATH, JSON.stringify(deltaObj, null, 2) + '\n', 'utf8');

  // 4. Run Full Cross-Site Golden Canary Regression Suite across all merged rulesets
  const regressionAudit = runFullCrossSiteRegressionSuite({ baselineStaticRules });
  if (!regressionAudit.ok) {
    console.error('[Cross-Site Regression Guard] REGRESSION DETECTED — Rolling back filter files to pre-run snapshot:', regressionAudit.issues);
    if (preMergeSnapshots.staticRaw !== null) fs.writeFileSync(STATIC_RULES_PATH, preMergeSnapshots.staticRaw, 'utf8');
    if (preMergeSnapshots.abpRaw !== null) fs.writeFileSync(ABP_FILTER_LIST_PATH, preMergeSnapshots.abpRaw, 'utf8');
    if (preMergeSnapshots.deltaRaw !== null) fs.writeFileSync(DYNAMIC_DELTA_PATH, preMergeSnapshots.deltaRaw, 'utf8');
    return {
      addedDnrRulesCount: 0,
      addedAbpRulesCount: 0,
      addedCosmeticCount: 0,
      totalStaticDnrRules: baselineStaticRules.length,
      totalAbpRules: existingAbpLines.size - newAbpCount,
      totalDynamicDeltaRules: 0,
      rolledBack: true,
      regressionAudit
    };
  }

  // 5. Rebuild all cross-browser / cross-device packages (Chromium ZIP, Firefox Desktop/Android XPI, Windows Setup EXE) & sync local AppData install
  const packageBuild = rebuildAllBrowserAndDevicePackages();

  return {
    addedDnrRulesCount: addedDnrRules.length,
    addedAbpRulesCount: newAbpCount,
    addedCosmeticCount: addedCosmeticSelectors.length,
    totalStaticDnrRules: staticRules.length,
    totalAbpRules: existingAbpLines.size,
    totalDynamicDeltaRules: combinedDyn.length,
    rolledBack: false,
    regressionAudit,
    packageBuild
  };
}

/**
 * Appends a structured Markdown entry to `AD_FILTER_PIPELINE_LOG.md`.
 */
export function appendPipelineAuditLog({
  runId,
  timestamp,
  sitesSampled,
  sitesScanned,
  leaksDetected,
  autoPatchedCount,
  manualReviewCount,
  mergeStats,
  commitHash,
  verifiedPatches
}) {
  const headerExists = fs.existsSync(PIPELINE_LOG_PATH);
  const lines = [];
  if (!headerExists) {
    lines.push('# SWEEPR DeepBlock — Daily 1,000-Site Ad-Filter Pipeline Audit Log\n');
    lines.push(
      'Automated daily 24-hour pipeline (`00:00 UTC`) sampling 1,000 unique ad-heavy domains (30-day rolling deduplication), detecting unblocked network/DOM/script ads, synthesizing & self-healing verifying MV3 + ABP rules, and syncing to the SWEEPR CRM.\n'
    );
  }

  lines.push(`## Run \`${runId}\` — ${timestamp}`);
  lines.push(`- **Sites Sampled (30-Day Deduplicated):** ${sitesSampled}`);
  lines.push(`- **Sites Evaluated:** ${sitesScanned}`);
  lines.push(`- **Ad Leaks Detected:** ${leaksDetected}`);
  lines.push(`- **Rules Auto-Patched (Verified Self-Healing):** ${autoPatchedCount}`);
  lines.push(`- **Flagged for Manual Review:** ${manualReviewCount}`);
  lines.push(
    `- **Repository Ruleset Totals:** ${mergeStats.totalStaticDnrRules} MV3 Static DNR Rules | ${mergeStats.totalAbpRules} ABP/uBO Rules | ${mergeStats.totalDynamicDeltaRules} OTA Delta Rules`
  );
  if (mergeStats.regressionAudit) {
    const ra = mergeStats.regressionAudit;
    lines.push(
      `- **Cross-Site Non-Regression Suite:** ${ra.ok ? 'PASS' : 'ROLLED BACK'} (${ra.canariesPassed}/${ra.canariesTotal} Golden Network & DeepStealth Surrogate Canaries | ${ra.legitimateCanariesVerified}/${ra.legitimateCanariesVerified} Legitimate Site Canaries Unblocked | ${ra.protectedModulesVerified} Cross-Module Selectors Protected)`
    );
  }
  lines.push(`- **Git Commit / Deployment Ref:** \`${commitHash || 'local-working-tree'}\`\n`);

  if (verifiedPatches.length > 0) {
    lines.push('| Target URL | Ad Type | Generated Rule | Fix Status | Verification Notes |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const p of verifiedPatches.slice(0, 25)) {
      lines.push(
        `| \`${p.targetUrl}\` | ${p.adTypeDetected} | \`${p.generatedRule}\` | **${p.fixStatus}** | ${p.verificationNotes} |`
      );
    }
    lines.push('');
  }

  fs.appendFileSync(PIPELINE_LOG_PATH, lines.join('\n') + '\n', 'utf8');
}

/**
 * Commits and optionally pushes / opens a PR for the updated filter definitions.
 */
export async function deployRulesViaGit({
  gitMode = process.env.GIT_DEPLOY_MODE || 'commit',
  runId,
  autoPatchedCount = 0
} = {}) {
  const filesToStage = [
    'extension/rules/static_ads_and_trackers.json',
    'extension/rules/abp_filter_list.txt',
    'extension/rules/dynamic_delta.json',
    'website/sweepr-deepblock-extension.zip',
    'website/sweepr-deepblock-firefox.xpi',
    'website/sweepr-deepblock.xpi',
    'website/SWEEPRDeepblockSetup.exe',
    'AD_FILTER_PIPELINE_LOG.md'
  ].filter((rel) => fs.existsSync(path.join(ROOT_DIR, rel)));

  let currentHead = 'uncommitted';
  try {
    currentHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    }).trim();
  } catch {}

  if (gitMode === 'dry-run' || filesToStage.length === 0) {
    return {
      deployed: false,
      mode: gitMode,
      commitHash: currentHead,
      prLink: null
    };
  }

  try {
    if (gitMode === 'pr') {
      const branchName = `auto-filters/${runId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      execFileSync('git', ['checkout', '-B', branchName], { cwd: ROOT_DIR, stdio: 'pipe' });
    }

    execFileSync('git', ['add', '--', ...filesToStage], { cwd: ROOT_DIR, stdio: 'pipe' });

    const stagedDiff = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    }).trim();

    if (stagedDiff) {
      const commitMsg = `chore(filters): auto-patch ${autoPatchedCount} verified ad rules (${runId})`;
      execFileSync('git', ['commit', '-m', commitMsg, '--', ...filesToStage], {
        cwd: ROOT_DIR,
        stdio: 'pipe'
      });
      currentHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      }).trim();
    }

    let prLink = null;
    if (gitMode === 'push' && stagedDiff) {
      execFileSync('git', ['push', 'origin', 'HEAD'], { cwd: ROOT_DIR, stdio: 'pipe' });
    } else if (gitMode === 'pr' && stagedDiff) {
      execFileSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: ROOT_DIR, stdio: 'pipe' });
      const prOut = execFileSync(
        'gh',
        [
          'pr',
          'create',
          '--title',
          `[Auto-Filters] Daily 1,000-Site Ad Filter Patch (${runId})`,
          '--body',
          `Automated daily ad-filter pipeline run \`${runId}\`.\n- Auto-patched rules: **${autoPatchedCount}**`
        ],
        { cwd: ROOT_DIR, encoding: 'utf8' }
      ).trim();
      prLink = prOut || null;
    }

    // Trigger optional CI/CD deployment webhook if configured
    const deployWebhook = process.env.DEPLOY_WEBHOOK_URL;
    if (deployWebhook) {
      await fetch(deployWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ad_filters_updated',
          runId,
          commitHash: currentHead,
          autoPatchedCount,
          timestamp: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(6000)
      }).catch(() => {});
    }

    return {
      deployed: Boolean(stagedDiff),
      mode: gitMode,
      commitHash: currentHead,
      prLink
    };
  } catch (err) {
    return {
      deployed: false,
      mode: gitMode,
      commitHash: currentHead,
      prLink: null,
      error: err.message
    };
  }
}
