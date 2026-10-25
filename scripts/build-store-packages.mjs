#!/usr/bin/env node
/**
 * SWEEPR Deepblock v1.1.6 — Cross-Browser Extension Store Packager
 * Generates store-ready MV3 ZIP archives with POSIX forward-slash entry paths:
 *   1. Microsoft Edge Add-ons & Chrome Web Store (`dist/sweepr-deepblock-edge-chrome-mv3.zip`)
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

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'abp_filter_list.txt') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
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

// 1. Build Chromium / Microsoft Edge MV3 Package
const edgeStaging = path.join(DIST_DIR, 'staging-edge');
fs.rmSync(edgeStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, edgeStaging);

const edgeManifest = { ...baseManifest };
delete edgeManifest.browser_specific_settings;
edgeManifest.background = {
  service_worker: 'background.js'
};
fs.writeFileSync(path.join(edgeStaging, 'manifest.json'), JSON.stringify(edgeManifest, null, 2) + '\n', 'utf8');

const edgeZip = path.join(DIST_DIR, 'sweepr-deepblock-edge-chrome-mv3.zip');
createPosixZip(edgeStaging, edgeZip);
fs.rmSync(edgeStaging, { recursive: true, force: true });

// 2. Build Mozilla Firefox AMO MV3 Package
const ffStaging = path.join(DIST_DIR, 'staging-firefox');
fs.rmSync(ffStaging, { recursive: true, force: true });
copyDirSync(EXT_DIR, ffStaging);

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
fs.writeFileSync(path.join(ffStaging, 'manifest.json'), JSON.stringify(ffManifest, null, 2) + '\n', 'utf8');

const ffZip = path.join(DIST_DIR, 'sweepr-deepblock-firefox-amo-mv3.zip');
createPosixZip(ffStaging, ffZip);
fs.rmSync(ffStaging, { recursive: true, force: true });

console.log('Built POSIX-compliant store packages:');
console.log(' - Edge/Chrome MV3:', edgeZip, fs.statSync(edgeZip).size, 'bytes');
console.log(' - Firefox AMO MV3:', ffZip, fs.statSync(ffZip).size, 'bytes');
