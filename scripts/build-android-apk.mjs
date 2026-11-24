import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEEPBLOCK_ANDROID_HTML } from './deepblock-mobile-ui.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'mobile', 'android');
const BUILD_DIR = path.join(ANDROID_DIR, 'build');
const OUTPUT_APK = path.join(ROOT, 'website', 'SWEEPRDeepblock.apk');

function resolveFirstExisting(candidates, label) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(`Missing required tool/file for Android build: ${label}`);
}

function walkFiles(dir, suffix, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, suffix, out);
    } else if (!suffix || entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

function parsePropertiesFile(filePath, outMap) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/\\\\/g, '\\');
    outMap.set(key, val);
  }
}

function readDeepblockSigningConfig() {
  const map = new Map();
  parsePropertiesFile(path.join(os.homedir(), '.gradle', 'gradle.properties'), map);
  parsePropertiesFile(path.join(ANDROID_DIR, 'local.properties'), map);

  const keystorePath = map.get('DEEPBLOCK_KEYSTORE_PATH') || path.join(os.homedir(), '.android', 'sweepr-deepblock-release.jks');
  const storePassword = map.get('DEEPBLOCK_KEYSTORE_PASSWORD') || '';
  const keyAlias = map.get('DEEPBLOCK_KEY_ALIAS') || 'sweeprdeepblock';
  const keyPassword = map.get('DEEPBLOCK_KEY_PASSWORD') || storePassword;
  if (!storePassword || !keyAlias || !keyPassword) {
    throw new Error('Missing DEEPBLOCK_KEYSTORE_PASSWORD, DEEPBLOCK_KEY_ALIAS, or DEEPBLOCK_KEY_PASSWORD in mobile/android/local.properties or ~/.gradle/gradle.properties');
  }
  return { keystorePath, storePassword, keyAlias, keyPassword };
}

function main() {
  const sdkRoot = resolveFirstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
  ], 'Android SDK');

  const buildToolsDir = resolveFirstExisting([
    path.join(sdkRoot, 'build-tools', '35.0.0'),
    path.join(sdkRoot, 'build-tools', '34.0.0')
  ], 'Android build-tools');

  const androidJar = resolveFirstExisting([
    path.join(sdkRoot, 'platforms', 'android-35', 'android.jar'),
    path.join(sdkRoot, 'platforms', 'android-34', 'android.jar')
  ], 'android.jar');

  const jbrBinCandidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin'
  ];
  const javaExe = resolveFirstExisting(jbrBinCandidates.map((d) => path.join(d, 'java.exe')), 'java.exe');
  const javacExe = resolveFirstExisting(jbrBinCandidates.map((d) => path.join(d, 'javac.exe')), 'javac.exe');
  const jarExe = resolveFirstExisting(jbrBinCandidates.map((d) => path.join(d, 'jar.exe')), 'jar.exe');

  const aapt2Exe = resolveFirstExisting([path.join(buildToolsDir, 'aapt2.exe')], 'aapt2.exe');
  const zipalignExe = resolveFirstExisting([path.join(buildToolsDir, 'zipalign.exe')], 'zipalign.exe');
  const d8Jar = resolveFirstExisting([path.join(buildToolsDir, 'lib', 'd8.jar')], 'd8.jar');
  const apksignerJar = resolveFirstExisting([path.join(buildToolsDir, 'lib', 'apksigner.jar')], 'apksigner.jar');
  const signing = readDeepblockSigningConfig();
  const keystorePath = resolveFirstExisting([signing.keystorePath], 'sweepr-deepblock-release.jks');

  const assetsDir = path.join(ANDROID_DIR, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'index.html'), DEEPBLOCK_ANDROID_HTML, 'utf8');

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  const genDir = path.join(BUILD_DIR, 'gen');
  const classesDir = path.join(BUILD_DIR, 'classes');
  const dexDir = path.join(BUILD_DIR, 'dex');
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(classesDir, { recursive: true });
  fs.mkdirSync(dexDir, { recursive: true });

  const compiledResZip = path.join(BUILD_DIR, 'compiled_res.zip');
  const unsignedApk = path.join(BUILD_DIR, 'unsigned.apk');
  const alignedApk = path.join(BUILD_DIR, 'aligned.apk');

  console.log('[Android Build] 1/6 Compiling resources with aapt2...');
  execFileSync(aapt2Exe, ['compile', '--dir', path.join(ANDROID_DIR, 'res'), '-o', compiledResZip], { stdio: 'inherit' });

  console.log('[Android Build] 2/6 Linking AndroidManifest & assets with aapt2...');
  execFileSync(aapt2Exe, [
    'link',
    '-o', unsignedApk,
    '--manifest', path.join(ANDROID_DIR, 'AndroidManifest.xml'),
    '-I', androidJar,
    '-A', assetsDir,
    '--java', genDir,
    '-R', compiledResZip,
    '--auto-add-overlay'
  ], { stdio: 'inherit' });

  const javaSources = [
    ...walkFiles(path.join(ANDROID_DIR, 'src'), '.java'),
    ...walkFiles(genDir, '.java')
  ];
  console.log(`[Android Build] 3/6 Compiling ${javaSources.length} Java source file(s)...`);
  execFileSync(javacExe, [
    '-source', '8',
    '-target', '8',
    '-Xlint:-options',
    '-classpath', androidJar,
    '-d', classesDir,
    ...javaSources
  ], { stdio: 'inherit' });

  const classFiles = walkFiles(classesDir, '.class');
  console.log(`[Android Build] 4/6 Converting ${classFiles.length} class file(s) to --release classes.dex with D8...`);
  execFileSync(javaExe, [
    '-cp', d8Jar,
    'com.android.tools.r8.D8',
    '--release',
    '--min-api', '24',
    '--lib', androidJar,
    '--output', dexDir,
    ...classFiles
  ], { stdio: 'inherit' });

  console.log('[Android Build] 5/6 Packaging classes.dex & zipaligning APK...');
  execFileSync(jarExe, ['u0f', unsignedApk, '-C', dexDir, 'classes.dex'], { stdio: 'inherit' });
  execFileSync(zipalignExe, ['-f', '-p', '4', unsignedApk, alignedApk], { stdio: 'inherit' });

  console.log('[Android Build] 6/6 Signing release APK with apksigner...');
  execFileSync(javaExe, [
    '-jar', apksignerJar,
    'sign',
    '--ks', keystorePath,
    '--ks-key-alias', signing.keyAlias,
    '--ks-pass', 'env:SWEEPR_KS_PASS',
    '--key-pass', 'env:SWEEPR_KEY_PASS',
    '--v4-signing-enabled', 'true',
    '--out', OUTPUT_APK,
    alignedApk
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SWEEPR_KS_PASS: signing.storePassword,
      SWEEPR_KEY_PASS: signing.keyPassword
    }
  });

  execFileSync(javaExe, [
    '-jar', apksignerJar,
    'verify',
    '--print-certs',
    OUTPUT_APK
  ], { stdio: 'inherit' });

  const apkBytes = fs.readFileSync(OUTPUT_APK);
  const sha256 = crypto.createHash('sha256').update(apkBytes).digest('hex').toUpperCase();
  console.log(`[Android Build] Signed release APK ready: ${OUTPUT_APK} (${apkBytes.length} bytes, SHA-256: ${sha256})`);
}

main();
