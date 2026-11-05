#!/usr/bin/env node
/**
 * SWEEPR DeepBlock v1.2.7 — Cross-Browser Extension Store Packager
 * Generates store-ready MV3 ZIP archives with POSIX forward-slash entry paths:
 *   1. Google Chrome Web Store (`dist/sweepr-deepblock-chrome-webstore-mv3.zip` & `dist/sweepr-deepblock-edge-chrome-mv3.zip`)
 *   2. Mozilla Firefox Add-ons / AMO (`dist/sweepr-deepblock-firefox-amo-mv3.zip`)
 */
import fs from 'node:fs';
import path from 'node:path';
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

function copyDirSync(src, dest, isStoreProd = true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'abp_filter_list.txt' || entry.name === '_metadata' || entry.name.startsWith('.')) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d, isStoreProd);
    } else if (isStoreProd && entry.name.endsWith('.js')) {
      const raw = fs.readFileSync(s, 'utf8');
      fs.writeFileSync(d, sanitizeProdJs(raw), 'utf8');
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
    $zip = [System.IO.Compression.ZipFile]::Open('${outZip}', [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      }
    } finally {
      $zip.Dispose()
    }
  `;
  execFileSync('powershell', ['-NoProfile', '-Command', psScript]);
}

runBuildAsoStoreListings();

const baseManifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));

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

// 1. Build Google Chrome Web Store & Microsoft Edge MV3 Package
const chromeStaging = path.join(DIST_DIR, 'staging-chrome');
fs.rmSync(chromeStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, chromeStaging, true);

const chromeManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: '__MSG_extShortName__',
  description: '__MSG_extDescription__',
  minimum_chrome_version: '116',
  background: {
    service_worker: 'background.js'
  }
};
delete chromeManifest.browser_specific_settings;

fs.writeFileSync(path.join(chromeStaging, 'manifest.json'), JSON.stringify(chromeManifest, null, 2) + '\n', 'utf8');

const chromeZip = path.join(DIST_DIR, 'sweepr-deepblock-chrome-webstore-mv3.zip');
const edgeZip = path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip');
createPosixZip(chromeStaging, chromeZip);
fs.writeFileSync(edgeZip, fs.readFileSync(chromeZip));
fs.rmSync(chromeStaging, { recursive: true, force: true });

// 2. Build Mozilla Firefox AMO MV3 Package
const ffStaging = path.join(DIST_DIR, 'staging-firefox');
fs.rmSync(ffStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, ffStaging, true);

const ffManifest = {
  ...baseManifest,
  default_locale: 'en',
  name: '__MSG_extName__',
  short_name: '__MSG_extShortName__',
  description: '__MSG_extDescription__',
  background: {
    scripts: ['background.js'],
    service_worker: 'background.js'
  },
  browser_specific_settings: {
    gecko: {
      id: 'extension@sweeprdeepblock.com',
      strict_min_version: '128.0',
      data_collection_permissions: {
        required: ['none']
      }
    },
    gecko_android: {
      strict_min_version: '128.0'
    }
  }
};
delete ffManifest.minimum_chrome_version;
fs.writeFileSync(path.join(ffStaging, 'manifest.json'), JSON.stringify(ffManifest, null, 2) + '\n', 'utf8');

const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
createPosixZip(ffStaging, ffZip);
fs.rmSync(ffStaging, { recursive: true, force: true });

console.log('Built POSIX-compliant store packages:');
console.log(' - Chrome Web Store MV3:', chromeZip, fs.statSync(chromeZip).size, 'bytes');
console.log(' - Edge/Chrome MV3:     ', edgeZip, fs.statSync(edgeZip).size, 'bytes');
console.log(' - Firefox AMO MV3:     ', ffZip, fs.statSync(ffZip).size, 'bytes');

fs.writeFileSync(path.join(DIST_DIR, 'sweepr-deepblock-v1.2.7-chrome-webstore.zip'), fs.readFileSync(chromeZip));
fs.writeFileSync(path.join(DIST_DIR, 'sweepr-deepblock-v1.2.7-firefox-amo.zip'), fs.readFileSync(ffZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock-extension.zip'), fs.readFileSync(chromeZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock-firefox.xpi'), fs.readFileSync(ffZip));
fs.writeFileSync(path.join(ROOT_DIR, 'website', 'sweepr-deepblock.xpi'), fs.readFileSync(ffZip));
console.log(' - Synced v1.2.7 packages + website/sweepr-deepblock-extension.zip and .xpi');
