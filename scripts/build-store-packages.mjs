#!/usr/bin/env node
/**
 * SWEEPR Deepblock v1.3.1 — Cross-Browser Extension Store Packager
 * Generates store-ready MV3 ZIP archives with POSIX forward-slash entry paths:
 *   1. Google Chrome Web Store (`dist/sweepr-deepblock-chrome-webstore-mv3.zip` & `dist/sweepr-deepblock-edge-chrome-mv3.zip`)
 *   2. Mozilla Firefox Add-ons / AMO (`dist/sweepr-deepblock-firefox-amo-mv3.zip`)
 *   3. Opera Add-ons (`dist/sweepr-deepblock-opera-mv3.zip`)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runBuildAsoStoreListings } from './build-aso-store-listings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

fs.mkdirSync(DIST_DIR, { recursive: true });

function sanitizeProdJs(code) {
  return code
    .replace(
      /const isDevExtension\s*=\s*[^;]+;/g,
      'const isDevExtension = false;'
    )
    .replace(/['"`]http:\/\/(?:localhost|127\.0\.0\.1):\d+[^'"`]*['"`]\s*,?\s*/g, '')
    .replace(
      /\.\.\.\(isDevExtension\s*\?\s*\[[^\]]*\]\s*:\s*\[\]\)\s*,?\s*/g,
      ''
    );
}

/**
 * Strips Chromium-only feature-guarded API blocks so Firefox AMO static linting produces 0 warnings.
 */
function sanitizeFirefoxJs(code) {
  return sanitizeProdJs(code)
    .replace(
      /\r?\n[ \t]*if \(updateAvailable && chrome\.runtime && typeof chrome\.runtime\.requestUpdateCheck === 'function'\) \{\r?\n[ \t]*try \{\r?\n[ \t]*chrome\.runtime\.requestUpdateCheck\(\(\) => \{\}\);\r?\n[ \t]*\} catch \(e\) \{\}\r?\n[ \t]*\}/g,
      ''
    )
    .replace(
      /\r?\nif \(\r?\n[ \t]*typeof chrome !== 'undefined' &&\r?\n[ \t]*chrome\.declarativeNetRequest &&\r?\n[ \t]*chrome\.declarativeNetRequest\.onRuleMatchedDebug\r?\n\) \{\r?\n[ \t]*try \{\r?\n[ \t]*chrome\.declarativeNetRequest\.onRuleMatchedDebug\.addListener\(\(info\) => \{\r?\n[ \t]*if \(info && info\.rule && info\.rule\.rulesetId === 'ads_and_trackers'\) \{\r?\n[ \t]*queueDiagnosticStatIncrement\('adsBlocked', 1, \(\) => \{\}\);\r?\n[ \t]*\}\r?\n[ \t]*\}\);\r?\n[ \t]*\} catch \(e\) \{\}\r?\n\}/g,
      ''
    )
    .replace(
      /\r?\n[ \t]*if \(chrome\.runtime && typeof chrome\.runtime\.requestUpdateCheck === 'function'\) \{\r?\n[ \t]*try \{\r?\n[ \t]*chrome\.runtime\.requestUpdateCheck\(\(status\) => \{\r?\n[ \t]*if \(status === 'update_available'\) \{\r?\n[ \t]*chrome\.runtime\.reload\(\);\r?\n[ \t]*\} else \{\r?\n[ \t]*chrome\.tabs\.create\(\{ url: targetUrl \}\);\r?\n[ \t]*\}\r?\n[ \t]*\}\);\r?\n[ \t]*return;\r?\n[ \t]*\} catch \(e\) \{\}\r?\n[ \t]*\}/g,
      ''
    );
}

/**
 * Keeps Opera JS free of DOM script-tag MAIN-world injection; DeepStealth is registered via chrome.scripting.registerContentScripts.
 */
function sanitizeOperaJs(code) {
  return sanitizeProdJs(code);
}

function copyDirSync(src, dest, isStoreProd = true, targetBrowser = 'chromium') {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'abp_filter_list.txt' || entry.name === '_metadata' || entry.name.startsWith('.')) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d, isStoreProd, targetBrowser);
    } else if (isStoreProd && entry.name.endsWith('.js')) {
      const raw = fs.readFileSync(s, 'utf8');
      let transformed;
      if (targetBrowser === 'firefox') {
        transformed = sanitizeFirefoxJs(raw);
      } else if (targetBrowser === 'opera') {
        transformed = sanitizeOperaJs(raw);
      } else {
        transformed = sanitizeProdJs(raw);
      }
      fs.writeFileSync(d, transformed, 'utf8');
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function createPosixZip(sourceDir, outZip) {
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
  const psScript = `
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $src = (Resolve-Path '${sourceDir}').Path
    $fixedTime = [DateTimeOffset]::new(2026, 11, 24, 0, 0, 0, [TimeSpan]::Zero)
    $files = Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
      [PSCustomObject]@{
        FullName = $_.FullName
        Rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/')
      }
    } | Sort-Object -Property @{ Expression = { $_.Rel }; Ascending = $true }
    $zip = [System.IO.Compression.ZipFile]::Open('${outZip}', [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($f in $files) {
        $entry = $zip.CreateEntry($f.Rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $fixedTime
        $inStream = [System.IO.File]::OpenRead($f.FullName)
        try {
          $outStream = $entry.Open()
          try {
            $inStream.CopyTo($outStream)
          } finally {
            $outStream.Dispose()
          }
        } finally {
          $inStream.Dispose()
        }
      }
    } finally {
      $zip.Dispose()
    }
  `;
  execFileSync('powershell', ['-NoProfile', '-Command', psScript]);
}

runBuildAsoStoreListings();

function sanitizeProdManifest(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  const isLocalPattern = (p) => /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(String(p || ''));
  if (Array.isArray(clone.host_permissions)) {
    clone.host_permissions = clone.host_permissions.filter((p) => !isLocalPattern(p));
  }
  if (clone.externally_connectable && Array.isArray(clone.externally_connectable.matches)) {
    clone.externally_connectable.matches = clone.externally_connectable.matches.filter((p) => !isLocalPattern(p));
  }
  return clone;
}

const baseManifest = sanitizeProdManifest(
  JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'))
);

function validateManifestAssets(manifest, extDir) {
  const requiredPaths = new Set();
  for (const p of Object.values(manifest.icons || {})) requiredPaths.add(p);
  if (manifest.action?.default_popup) requiredPaths.add(manifest.action.default_popup);
  for (const p of Object.values(manifest.action?.default_icon || {})) requiredPaths.add(p);
  if (manifest.options_ui?.page) requiredPaths.add(manifest.options_ui.page);
  if (manifest.background?.service_worker) requiredPaths.add(manifest.background.service_worker);
  for (const s of manifest.background?.scripts || []) requiredPaths.add(s);
  for (const r of manifest.declarative_net_request?.rule_resources || []) {
    if (r.path) requiredPaths.add(r.path);
  }
  for (const cs of manifest.content_scripts || []) {
    for (const jsFile of cs.js || []) requiredPaths.add(jsFile);
    for (const cssFile of cs.css || []) requiredPaths.add(cssFile);
  }
  for (const war of manifest.web_accessible_resources || []) {
    for (const res of war.resources || []) requiredPaths.add(res);
  }

  for (const relPath of requiredPaths) {
    const absPath = path.join(extDir, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`[Store Packager] Missing asset referenced in manifest.json: ${relPath}`);
    }
  }
  console.log(`[Store Packager] Verified all ${requiredPaths.size} manifest asset paths exist on disk.`);
}

validateManifestAssets(baseManifest, EXT_DIR);

// 1. Build Google Chrome Web Store MV3 Package
const chromeStaging = path.join(DIST_DIR, 'staging-chrome');
fs.rmSync(chromeStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, chromeStaging, true);

const chromeOAuthClientId = String(process.env.GOOGLE_CHROME_EXT_CLIENT_ID || '').trim();
const chromeManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: 'DeepBlock',
  description: '__MSG_extDescription__',
  minimum_chrome_version: '116',
  permissions: Array.from(new Set([...(baseManifest.permissions || []), 'identity', 'identity.email'])),
  background: {
    service_worker: 'background.js'
  }
};
if (chromeOAuthClientId) {
  chromeManifest.oauth2 = {
    client_id: chromeOAuthClientId,
    scopes: ['https://www.googleapis.com/auth/userinfo.email']
  };
} else {
  console.warn('[Store Packager] WARNING: GOOGLE_CHROME_EXT_CLIENT_ID not set — chrome manifest built without oauth2 block.');
}
delete chromeManifest.browser_specific_settings;

if (typeof chromeManifest.short_name !== 'string' || chromeManifest.short_name.length > 12) {
  throw new Error(`[Store Packager] Chrome short_name exceeds 12 chars: ${chromeManifest.short_name}`);
}

fs.writeFileSync(path.join(chromeStaging, 'manifest.json'), JSON.stringify(chromeManifest, null, 2) + '\n', 'utf8');
verifyRulesCompliance(chromeStaging);

const chromeZip = path.join(DIST_DIR, 'sweepr-deepblock-chrome-webstore-mv3.zip');
createPosixZip(chromeStaging, chromeZip);
fs.rmSync(chromeStaging, { recursive: true, force: true });

// 1b. Build Microsoft Edge Add-ons MV3 Package (without Chrome-only oauth2 / identity.email)
const edgeStaging = path.join(DIST_DIR, 'staging-edge');
fs.rmSync(edgeStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, edgeStaging, true);

const edgeManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: 'DeepBlock',
  description: '__MSG_extDescription__',
  minimum_chrome_version: '116',
  permissions: (baseManifest.permissions || []).filter((p) => p !== 'identity' && p !== 'identity.email'),
  background: {
    service_worker: 'background.js'
  }
};
delete edgeManifest.browser_specific_settings;
delete edgeManifest.oauth2;

fs.writeFileSync(path.join(edgeStaging, 'manifest.json'), JSON.stringify(edgeManifest, null, 2) + '\n', 'utf8');
verifyRulesCompliance(edgeStaging);

const edgeZip = path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip');
createPosixZip(edgeStaging, edgeZip);
fs.rmSync(edgeStaging, { recursive: true, force: true });

function verifyRulesCompliance(stagingDir) {
  const rulesDir = path.join(stagingDir, 'rules');
  for (const entry of fs.readdirSync(rulesDir)) {
    if (!entry.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(rulesDir, entry), 'utf8');
    if (/"url"\s*:\s*"data:/i.test(raw)) {
      throw new Error(`[Store Packager] Disallowed data: redirect URL found in ${entry}`);
    }
  }
  const surrogatePath = path.join(rulesDir, 'surrogates', 'adsbygoogle.js');
  if (!fs.existsSync(surrogatePath)) {
    throw new Error('[Store Packager] Missing surrogate rules/surrogates/adsbygoogle.js in staging.');
  }
}

function walkJsStagingFiles(stagingDir, onJsFile) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js')) {
        const jsCode = fs.readFileSync(fullPath, 'utf8');
        const relPath = path.relative(stagingDir, fullPath).replace(/\\/g, '/');
        new vm.Script(jsCode, { filename: relPath });
        if (onJsFile) onJsFile(jsCode, relPath);
      }
    }
  };
  walk(stagingDir);
}

function verifyFirefoxZeroWarnings(ffStagingDir, ffManifest) {
  if (ffManifest.background?.service_worker) {
    throw new Error('[Store Packager] Firefox manifest must not declare background.service_worker.');
  }
  if ('oauth2' in ffManifest || (ffManifest.permissions || []).some((p) => p === 'identity' || p === 'identity.email')) {
    throw new Error('[Store Packager] Firefox manifest must not declare Chrome identity/oauth2 keys.');
  }
  verifyRulesCompliance(ffStagingDir);
  walkJsStagingFiles(ffStagingDir, (jsCode, relPath) => {
    if (/\b(requestUpdateCheck|onRuleMatchedDebug)\b/.test(jsCode)) {
      throw new Error(`[Store Packager] Unsupported Chromium API left in Firefox staging: ${relPath}`);
    }
  });
  console.log('[Store Packager] Verified Firefox AMO staging: valid ES6 syntax & 0 unsupported API/manifest keys.');
}

function verifyOperaSchemaCompliance(operaStagingDir, operaManifest) {
  if (
    typeof operaManifest.short_name !== 'string' ||
    operaManifest.short_name.length > 12 ||
    operaManifest.short_name.startsWith('__MSG_')
  ) {
    throw new Error(`[Store Packager] Invalid Opera short_name: ${operaManifest.short_name}`);
  }
  if (operaManifest.name.length > 45 || operaManifest.description.length > 132) {
    throw new Error('[Store Packager] Opera manifest name/description exceeds schema length limits.');
  }
  if ('minimum_chrome_version' in operaManifest || 'browser_specific_settings' in operaManifest) {
    throw new Error('[Store Packager] Opera manifest must omit minimum_chrome_version and browser_specific_settings.');
  }
  const perms = operaManifest.permissions || [];
  if (!perms.includes('declarativeNetRequest') || perms.includes('declarativeNetRequestWithHostAccess')) {
    throw new Error('[Store Packager] Opera manifest permissions must include declarativeNetRequest and omit declarativeNetRequestWithHostAccess.');
  }
  if ('oauth2' in operaManifest || perms.includes('identity') || perms.includes('identity.email')) {
    throw new Error('[Store Packager] Opera manifest must omit Chrome identity and oauth2 keys.');
  }
  for (const cs of operaManifest.content_scripts || []) {
    if ('world' in cs) {
      throw new Error('[Store Packager] Opera manifest content_scripts must omit "world" property.');
    }
  }
  verifyRulesCompliance(operaStagingDir);
  validateManifestAssets(operaManifest, operaStagingDir);
  walkJsStagingFiles(operaStagingDir, (jsCode, relPath) => {
    if (relPath === 'content/deepblock-content.js' && jsCode.includes('content/deepstealth-main.js')) {
      throw new Error('[Store Packager] Opera deepblock-content.js must not inject deepstealth-main.js via DOM script tag.');
    }
  });
  console.log('[Store Packager] Verified Opera Add-ons staging: valid ES6 syntax & strict MV3 jsonschema compliance.');
}

// 2. Build Mozilla Firefox AMO MV3 Package
const ffStaging = path.join(DIST_DIR, 'staging-firefox');
fs.rmSync(ffStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, ffStaging, true, 'firefox');

const ffManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: 'DeepBlock',
  description: '__MSG_extDescription__',
  background: {
    scripts: ['background.js']
  },
  browser_specific_settings: {
    gecko: {
      id: 'extension@sweeprdeepblock.com',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: ['none']
      }
    },
    gecko_android: {
      strict_min_version: '142.0'
    }
  }
};
delete ffManifest.minimum_chrome_version;
if (typeof ffManifest.short_name !== 'string' || ffManifest.short_name.length > 12) {
  throw new Error(`[Store Packager] Firefox short_name exceeds 12 chars: ${ffManifest.short_name}`);
}
fs.writeFileSync(path.join(ffStaging, 'manifest.json'), JSON.stringify(ffManifest, null, 2) + '\n', 'utf8');
verifyFirefoxZeroWarnings(ffStaging, ffManifest);

const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
createPosixZip(ffStaging, ffZip);
fs.rmSync(ffStaging, { recursive: true, force: true });

// 3. Build Opera Add-ons MV3 Package
const operaStaging = path.join(DIST_DIR, 'staging-opera');
fs.rmSync(operaStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, operaStaging, true, 'opera');

const operaManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: 'DeepBlock',
  description: '__MSG_extDescription__',
  permissions: (baseManifest.permissions || []).filter(
    (p) => p !== 'declarativeNetRequestWithHostAccess'
  ),
  background: {
    service_worker: 'background.js'
  }
};
delete operaManifest.minimum_chrome_version;
delete operaManifest.browser_specific_settings;

fs.writeFileSync(path.join(operaStaging, 'manifest.json'), JSON.stringify(operaManifest, null, 2) + '\n', 'utf8');
verifyOperaSchemaCompliance(operaStaging, operaManifest);

const operaZip = path.join(DIST_DIR, 'sweepr-deepblock-opera-mv3.zip');
createPosixZip(operaStaging, operaZip);
fs.rmSync(operaStaging, { recursive: true, force: true });

console.log('Built POSIX-compliant store packages:');
console.log(' - Chrome Web Store MV3:', chromeZip, fs.statSync(chromeZip).size, 'bytes');
console.log(' - Edge/Chrome MV3:     ', edgeZip, fs.statSync(edgeZip).size, 'bytes');
console.log(' - Firefox AMO MV3:     ', ffZip, fs.statSync(ffZip).size, 'bytes');
console.log(' - Opera Add-ons MV3:   ', operaZip, fs.statSync(operaZip).size, 'bytes');

fs.writeFileSync(path.join(DIST_DIR, `sweepr-deepblock-v${baseManifest.version}-chrome-webstore.zip`), fs.readFileSync(chromeZip));
fs.writeFileSync(path.join(DIST_DIR, `sweepr-deepblock-v${baseManifest.version}-firefox-amo.zip`), fs.readFileSync(ffZip));
fs.writeFileSync(path.join(DIST_DIR, `sweepr-deepblock-v${baseManifest.version}-opera-addons.zip`), fs.readFileSync(operaZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock-extension.zip'), fs.readFileSync(chromeZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock-firefox.xpi'), fs.readFileSync(ffZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock.xpi'), fs.readFileSync(ffZip));
console.log(` - Synced v${baseManifest.version} packages + website/sweepr-deepblock-extension.zip and .xpi`);
