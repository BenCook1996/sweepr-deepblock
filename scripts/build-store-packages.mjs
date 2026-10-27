#!/usr/bin/env node
/**
 * SWEEPR Deepblock v1.1.6 — Cross-Browser Extension Store Packager
 * Generates store-ready MV3 ZIP archives with POSIX forward-slash entry paths:
 *   1. Google Chrome Web Store (`dist/sweepr-deepblock-chrome-webstore-mv3.zip` & `dist/sweepr-deepblock-edge-chrome-mv3.zip`)
 *   2. Mozilla Firefox Add-ons / AMO (`dist/sweepr-deepblock-firefox-amo-mv3.zip`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
    .replace(/['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+[^'"]*['"]\s*,?\s*/g, '')
    .replace(
      /\.\.\.\(isDevExtension\s*\?\s*\[[^\]]*\]\s*:\s*\[\]\)\s*,?\s*/g,
      ''
    );
}

function copyDirSync(src, dest, isStoreProd = true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'abp_filter_list.txt') continue;
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

const baseManifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));

// 1. Build Google Chrome Web Store & Microsoft Edge MV3 Package
const chromeStaging = path.join(DIST_DIR, 'staging-chrome');
fs.rmSync(chromeStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, chromeStaging, true);

const chromeManifest = {
  ...baseManifest,
  name: 'SWEEPR Deepblock: Ad & Cookie Blocker',
  short_name: 'SWEEPR Deepblock',
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
fs.copyFileSync(chromeZip, edgeZip);
fs.rmSync(chromeStaging, { recursive: true, force: true });

// 2. Build Mozilla Firefox AMO MV3 Package
const ffStaging = path.join(DIST_DIR, 'staging-firefox');
fs.rmSync(ffStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, ffStaging, true);

const ffManifest = {
  ...baseManifest,
  name: 'SWEEPR Deepblock: Ad & Cookie Blocker',
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

fs.copyFileSync(chromeZip, path.join(ROOT_DIR, 'website', 'sweepr-deepblock-extension.zip'));
fs.copyFileSync(ffZip, path.join(ROOT_DIR, 'website', 'sweepr-deepblock-firefox.xpi'));
fs.copyFileSync(ffZip, path.join(ROOT_DIR, 'website', 'sweepr-deepblock.xpi'));
console.log(' - Synced website/sweepr-deepblock-extension.zip and .xpi');
