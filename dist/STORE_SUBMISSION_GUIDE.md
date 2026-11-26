# SWEEPR DeepBlock v1.4.0 — Cross-Browser Store Submission Guide

Copyright (c) 2026 Benjamin Cook (SWEEPR DeepBlock). All rights reserved.
SWEEPR DeepBlock is strictly proprietary, closed-source commercial software. Do not publish client source code under any public distribution terms.

---

## 1. Release Artifacts & Verified v1.4.0 Specifications

- **Extension Version**: `1.4.0` (`CURRENT_PROJECT_VERSION = 140` for Apple platforms)
- **Static Declarative Net Request (DNR) Rules**: `36,019` total compiled static rules across `5` enabled rulesets (well within the 330,000 MV3 global limit and <= 20,000 rules per file):
  - `ads_and_trackers` (`rules/static_ads_and_trackers.json`): `20,000` rules (including surgical anti-breakage `allow` rules and local surrogate redirects)
  - `easyprivacy_trackers` (`rules/easyprivacy_trackers.json`): `12,000` rules
  - `regional_eu_filters` (`rules/regional_eu_filters.json`): `4,000` rules
  - `tracker_param_stripping` (`rules/tracker_params.json`): `1` rule stripping `229` URL tracking query parameters (excluding SWEEPR domains)
  - `cryptominers_and_heavy_scripts` (`rules/cryptominers.json`): `18` rules
- **CMP Cookie Auto-Reject Coverage**: `160` named CMP frameworks + Shadow-DOM aware auto-rejector + scroll unlock
- **Trial Model**: No-card 7-day full Pro trial auto-activated on install (`proActive: true`, `plan: "trial_7d"`); Pro features gate on expiry unless a paid license key is activated
- **Regenerate All Packages**:
  ```bash
  node scripts/build-store-packages.mjs
  ```

### Built Store Packages (`dist/` and `website/`)

| Target Store | Ready-to-Submit Package(s) | Key Manifest Constraints |
|---|---|---|
| **Chrome Web Store** | `dist/sweepr-deepblock-chrome-webstore-mv3.zip`<br>`dist/sweepr-deepblock-v1.4.0-chrome-webstore.zip`<br>`website/sweepr-deepblock-extension.zip` | `background.service_worker`, `minimum_chrome_version: "116"`, optional `oauth2` when `GOOGLE_CHROME_EXT_CLIENT_ID` is set |
| **Mozilla Firefox Add-ons (AMO)** | `dist/sweepr-deepblock-firefox-amo-mv3.zip`<br>`dist/sweepr-deepblock-v1.4.0-firefox-amo.zip`<br>`website/sweepr-deepblock-firefox.xpi`<br>`website/sweepr-deepblock.xpi` | `gecko.id: "extension@sweeprdeepblock.com"`, `gecko.strict_min_version: "128.0"`, `data_collection_permissions.required: ["none"]`, `background.scripts: ["background.js"]` |
| **Microsoft Edge Add-ons** | `dist/sweepr-deepblock-edge-chrome-mv3.zip` | `background.service_worker`, `minimum_chrome_version: "116"`, omits `oauth2`, `identity`, `identity.email` |
| **Apple App Store / Safari (macOS & iOS)** | `dist/sweepr-deepblock-safari-mv3.zip`<br>`dist/sweepr-deepblock-v1.4.0-safari-mv3.zip`<br>`safari/SWEEPR DeepBlock.xcodeproj` | `com.sweeprdeepblock.safari` & `com.sweeprdeepblock.safari.Extension`, `MACOSX_DEPLOYMENT_TARGET = 13.0`, `IPHONEOS_DEPLOYMENT_TARGET = 16.0`, omits `minimum_chrome_version`, `browser_specific_settings`, `oauth2`, `identity`, `clipboardRead` |
| **Opera Add-ons** | `dist/sweepr-deepblock-opera-mv3.zip`<br>`dist/sweepr-deepblock-v1.4.0-opera-addons.zip` | `background.service_worker`, omits `declarativeNetRequestWithHostAccess`, `minimum_chrome_version`, `browser_specific_settings` |

---

## 2. Shared ASO Copy, Media Assets & Privacy Disclosures

- **Validated Localized Listings (`9` locales)**: `dist/store-listings/aso-compliance-report.json` (`allPassed: true`, `version: "1.4.0"`) and per-locale files:
  - `dist/store-listings/en.md`
  - `dist/store-listings/de.md`
  - `dist/store-listings/fr.md`
  - `dist/store-listings/es.md`
  - `dist/store-listings/it.md`
  - `dist/store-listings/nl.md`
  - `dist/store-listings/pl.md`
  - `dist/store-listings/pt_BR.md`
  - `dist/store-listings/ja.md`
- **Store Creatives (`dist/store-assets/`)**:
  - `dist/store-assets/cws-icon-128x128.png` (`128x128` store icon)
  - `dist/store-assets/edge-logo-300x300.png` (`300x300` Edge Add-ons logo)
  - `dist/store-assets/cws-promo-small-440x280.png` / `.jpg` (`440x280` small promo tile)
  - `dist/store-assets/cws-promo-marquee-1400x560.png` / `.jpg` (`1400x560` marquee promo banner)
  - `dist/store-assets/cws-screenshot-1-popup-1280x800.png` (`1280x800`)
  - `dist/store-assets/cws-screenshot-2-inpage-1280x800.png` (`1280x800`)
  - `dist/store-assets/cws-screenshot-3-fakeshop-1280x800.png` (`1280x800`)
  - `dist/store-assets/cws-screenshot-4-welcome-1280x800.png` (`1280x800`)
  - `dist/store-assets/slide-1-hero-before-after.png` through `slide-5-ram-tamer-privacy.png`
- **Standard Store Review & Privacy Justification**:
  - **Single Purpose**: Blocks ads, trackers, cryptominers, URL tracking parameters, and GDPR/CCPA cookie consent popups while optimizing browser tab memory.
  - **Zero Remote Code**: All JavaScript executes strictly from within the signed bundle (`vm.Script` validated, no remote script tags or `eval`). Only declarative JSON filter delta updates and license/trial validation requests communicate with `https://sweeprdeepblock.com`.
  - **Data Collection**: Does not collect, log, or sell browsing history (`data_collection_permissions.required: ["none"]`).

---

## 3. Target 1 — Google Chrome Web Store

### Manual Developer Dashboard Steps
1. Sign in to the Chrome Web Store Developer Dashboard (`https://chrome.google.com/webstore/devconsole`).
2. Select the **SWEEPR DeepBlock** item (or create a new item).
3. Under **Package -> Upload new package**, upload `dist/sweepr-deepblock-v1.4.0-chrome-webstore.zip` (built with `GOOGLE_CHROME_EXT_CLIENT_ID` exported if Google Sign-In OAuth2 is enabled, or `dist/sweepr-deepblock-chrome-webstore-mv3.zip`).
4. Under **Store listing**, copy title, summary, and detailed description from `dist/store-listings/en.md` (and additional locales `de.md`, `fr.md`, `es.md`, `it.md`, `nl.md`, `pl.md`, `pt_BR.md`, `ja.md`).
5. Upload `dist/store-assets/cws-icon-128x128.png`, `dist/store-assets/cws-promo-small-440x280.png`, `dist/store-assets/cws-promo-marquee-1400x560.png`, and `dist/store-assets/cws-screenshot-1-popup-1280x800.png`..`4-welcome-1280x800.png`.
6. Under **Privacy practices**, justify `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`, `storage`, `alarms`, `tabs`, `contextMenus`, `scripting`, `identity`, `identity.email`, and `<all_urls>`, certify non-collection of browsing history, and click **Submit for review**.

### Automated API / CLI Upload
Required secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID`.

```bash
ACCESS_TOKEN=$(curl -sS -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${CWS_CLIENT_ID}" \
  -d "client_secret=${CWS_CLIENT_SECRET}" \
  -d "refresh_token=${CWS_REFRESH_TOKEN}" \
  -d "grant_type=refresh_token" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!d.access_token) process.exit(1); console.log(d.access_token);")

curl -f -X PUT \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -T dist/sweepr-deepblock-v1.4.0-chrome-webstore.zip \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}"

curl -f -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -H "Content-Length: 0" \
  "https://www.googleapis.com/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}/publish"
```

---

## 4. Target 2 — Mozilla Firefox Add-ons (AMO)

### Manual Developer Hub Steps
1. Sign in to Mozilla Add-ons Developer Hub (`https://addons.mozilla.org/developers/`).
2. Select **SWEEPR DeepBlock** (`extension@sweeprdeepblock.com`) -> **Upload New Version**.
3. Upload `dist/sweepr-deepblock-v1.4.0-firefox-amo.zip` (identical bytes to `dist/sweepr-deepblock-firefox-amo-mv3.zip` and `website/sweepr-deepblock-firefox.xpi`).
4. Verify compatibility metadata detected by AMO:
   - `strict_min_version`: `128.0` (Firefox Desktop >= `128.0`)
   - `gecko_android.strict_min_version`: `142.0`
   - `data_collection_permissions.required`: `["none"]`
5. Confirm **Proprietary / All Rights Reserved** distribution (do NOT select a public sharing license). Note that all JavaScript in the XPI is unminified and directly inspectable by AMO reviewers without external build steps.
6. Update localized listing metadata from `dist/store-listings/*.md` and submit for review.

### Automated AMO API / `web-ext` Submission
Required secrets: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`.

```bash
# Unpacked staging or direct upload of dist/sweepr-deepblock-v1.4.0-firefox-amo.zip via AMO v5 API:
rm -rf dist/staging-firefox-check && mkdir -p dist/staging-firefox-check
unzip -q dist/sweepr-deepblock-v1.4.0-firefox-amo.zip -d dist/staging-firefox-check
npx --yes web-ext lint --source-dir dist/staging-firefox-check
rm -rf dist/staging-firefox-check
# Or sign/submit via AMO v5 API using JWT (HS256 signed with AMO_JWT_ISSUER & AMO_JWT_SECRET):
# POST https://addons.mozilla.org/api/v5/addons/upload/ (multipart form: upload=@dist/sweepr-deepblock-v1.4.0-firefox-amo.zip, channel=listed)
# PATCH https://addons.mozilla.org/api/v5/addons/addon/extension@sweeprdeepblock.com/versions/1.4.0/
```

---

## 5. Target 3 — Microsoft Edge Add-ons

### Manual Partner Center Steps
1. Sign in to Microsoft Partner Center (`https://partner.microsoft.com/dashboard/microsoftedge/`).
2. Open the **SWEEPR DeepBlock** extension listing -> **Packages** -> **Update package**.
3. Upload `dist/sweepr-deepblock-edge-chrome-mv3.zip` (which explicitly strips `oauth2`, `identity`, and `identity.email` per Edge Partner Center policy).
4. Under **Store listings** / **Properties**, upload `dist/store-assets/edge-logo-300x300.png`, screenshots from `dist/store-assets/cws-screenshot-1-popup-1280x800.png`..`4-welcome-1280x800.png`, and localized copy from `dist/store-listings/{locale}.md`.
5. Add **Notes for certification** explaining the 7-day no-card Pro trial activation flow and submit for certification.

### Automated Edge Publish API v1.1 Submission
Required secrets: `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`.

```bash
OPERATION_ID=$(curl -i -sS -X POST \
  -H "Authorization: ApiKey ${EDGE_API_KEY}" \
  -H "X-ClientID: ${EDGE_CLIENT_ID}" \
  -H "Content-Type: application/zip" \
  --data-binary "@dist/sweepr-deepblock-edge-chrome-mv3.zip" \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/${EDGE_PRODUCT_ID}/submissions/draft/package" \
  | grep -i '^location:' | awk '{print $2}' | tr -d '\r')

curl -f -X GET \
  -H "Authorization: ApiKey ${EDGE_API_KEY}" \
  -H "X-ClientID: ${EDGE_CLIENT_ID}" \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/${EDGE_PRODUCT_ID}/submissions/draft/package/operations/${OPERATION_ID}"

curl -f -X POST \
  -H "Authorization: ApiKey ${EDGE_API_KEY}" \
  -H "X-ClientID: ${EDGE_CLIENT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"notes":"v1.4.0 release: 36,019 static DNR rules, 229 stripped tracker parameters, 160 CMP auto-reject frameworks, and 7-day no-card Pro trial."}' \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/${EDGE_PRODUCT_ID}/submissions"
```

---

## 6. Target 4 — Apple App Store / Safari (macOS & iOS)

Because Xcode and `xcrun` require macOS hardware, the proprietary Xcode project (`safari/SWEEPR DeepBlock.xcodeproj`) and GitHub Actions workflow (`.github/workflows/safari-build.yml`) are preconfigured for macOS CI and local Xcode release builds.

### Manual macOS + Xcode Steps
1. On macOS with Xcode 15+, pull the repository and run `node scripts/build-store-packages.mjs` so `safari/SWEEPR DeepBlock/Shared (Extension)/Resources/` and `dist/sweepr-deepblock-v1.4.0-safari-mv3.zip` are freshly synced.
2. Open `safari/SWEEPR DeepBlock.xcodeproj` in Xcode.
3. Add a `1024x1024` non-alpha PNG icon (exported from `extension/icons/icon.svg`) into:
   - `safari/SWEEPR DeepBlock/macOS (App)/Assets.xcassets/AppIcon.appiconset`
   - `safari/SWEEPR DeepBlock/iOS (App)/Assets.xcassets/AppIcon.appiconset`
4. Under **Signing & Capabilities**, select your Apple Developer Team for all 4 targets:
   - `SWEEPR DeepBlock (macOS)` (`com.sweeprdeepblock.safari`)
   - `SWEEPR DeepBlock Extension (macOS)` (`com.sweeprdeepblock.safari.Extension`)
   - `SWEEPR DeepBlock (iOS)` (`com.sweeprdeepblock.safari`)
   - `SWEEPR DeepBlock Extension (iOS)` (`com.sweeprdeepblock.safari.Extension`)
5. Optionally validate the standalone Safari MV3 archive with Apple's converter:
   ```bash
   mkdir -p /tmp/safari-ext && unzip -q dist/sweepr-deepblock-v1.4.0-safari-mv3.zip -d /tmp/safari-ext
   xcrun safari-web-extension-converter /tmp/safari-ext --project-location /tmp/safari-check --app-name "SWEEPR DeepBlock" --bundle-identifier "com.sweeprdeepblock.safari" --swift --no-open --no-prompt --force
   ```
6. Archive both schemes (`Product -> Archive`) for **Any Mac** (`SWEEPR DeepBlock (macOS)`) and **Any iOS Device (arm64)** (`SWEEPR DeepBlock (iOS)`), then choose **Distribute App -> App Store Connect** (`https://appstoreconnect.apple.com`).

### Automated GitHub Actions CI & `xcodebuild` / `xcrun altool` Commands
1. Configure repository secrets in GitHub:
   - `APPLE_TEAM_ID`
   - `APPLE_CERT_BASE64`, `APPLE_CERT_PASSWORD`
   - `APPLE_APP_STORE_CONNECT_KEY_ID`, `APPLE_APP_STORE_CONNECT_ISSUER_ID`, `APPLE_APP_STORE_CONNECT_PRIVATE_KEY`
2. Trigger `.github/workflows/safari-build.yml` via `workflow_dispatch` with `submit_to_app_store: true`, or run locally on macOS:
   ```bash
   xcodebuild archive \
     -project "safari/SWEEPR DeepBlock.xcodeproj" \
     -scheme "SWEEPR DeepBlock (macOS)" \
     -configuration Release \
     -destination "generic/platform=macOS" \
     -archivePath ./build/SWEEPRDeepBlock-macOS.xcarchive

   xcodebuild archive \
     -project "safari/SWEEPR DeepBlock.xcodeproj" \
     -scheme "SWEEPR DeepBlock (iOS)" \
     -configuration Release \
     -destination "generic/platform=iOS" \
     -archivePath ./build/SWEEPRDeepBlock-iOS.xcarchive

   xcrun altool --upload-app \
     -f ./build/export-macOS/SWEEPR\ DeepBlock.pkg \
     -t macos \
     --apiKey "$APPLE_APP_STORE_CONNECT_KEY_ID" \
     --apiIssuer "$APPLE_APP_STORE_CONNECT_ISSUER_ID"

   xcrun altool --upload-app \
     -f ./build/export-iOS/SWEEPR\ DeepBlock.ipa \
     -t ios \
     --apiKey "$APPLE_APP_STORE_CONNECT_KEY_ID" \
     --apiIssuer "$APPLE_APP_STORE_CONNECT_ISSUER_ID"
   ```
