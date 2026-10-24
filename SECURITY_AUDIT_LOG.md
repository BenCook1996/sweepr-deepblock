# SWEEPR DeepBlock (`sweeprdeepblock.com`) — Daily White-Hat Security Audit & Auto-Remediation Log

## 2026-10-24 — Daily White-Hat Security Audit & Auto-Remediation Pass
- **Component Scope**:
  1. Website & Node.js HTTP Server (`server.js` & `website/`)
  2. Browser Extension Manifest V3 (`extension/`)
  3. Shared Multi-Project CRM & Licensing Hub (`sweepr_crm/`)
- **Findings & Auto-Remediations**:
  - **Finding 1 (HTTP OPTIONS Preflight Handling on API & Licensing Endpoints)**:
    - *Mechanics*: When modern browsers or extension pages make cross-origin requests with custom headers (`Content-Type: application/json`, `x-sweepr-project`), browsers issue an HTTP `OPTIONS` preflight. Previously, `server.js` had no `req.method === 'OPTIONS'` handler, allowing preflight requests to fall through to the static file server and return 403 or 404 without CORS response headers, causing client-side network failures.
    - *Remediation*: Added an explicit preflight `OPTIONS` handler at the entry of `http.createServer` that validates incoming origins against trusted origins and browser extension schemes (`chrome-extension://...`, `moz-extension://...`), sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD`, `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Origin, Accept, x-sweepr-project, x-sweepr-api-key`, `Access-Control-Max-Age: 86400`, `Vary: Origin`, and security headers before responding with `204 No Content`.
  - **Finding 2 (`sendJson` Request Context Auto-Detection & CORS Header Resilience)**:
    - *Mechanics*: `sendJson(res, statusCode, payload, extraHeaders, req)` defaulted `corsOrigin` to `PUBLIC_URL` whenever the caller omitted `req`. Over 40 API response handlers and error paths in `server.js` called `sendJson` without `req`, preventing browser extensions from reading error messages (`429 rate_limit_exceeded`, `400 invalid_key_format`, `403 device_limit_reached`).
    - *Remediation*: Updated `sendJson` to inspect `const incomingReq = req || res.req;`. In Node.js, `res.req` points to the underlying `http.IncomingMessage`, ensuring all API responses automatically inspect the caller's origin and set `Access-Control-Allow-Origin` for extension and trusted origins.
  - **Finding 3 (CSRF & Abuse Hardening on `/api/create-subscription` and `/api/lead`)**:
    - *Mechanics*: `POST /api/create-subscription` and `POST /api/lead` lacked origin/CSRF validation. Untrusted third-party websites could trigger automated POSTs to `/api/create-subscription` to flood Stripe with incomplete customer and subscription objects, or abuse `/api/lead` to pollute CRM lead databases.
    - *Remediation*: Enforced `isSameOriginWriteRequest(req)` on both endpoints, returning `403 Forbidden` (`cross_origin_forbidden`) for untrusted cross-origin requests while preserving access for trusted origins and extension scripts.
  - **Finding 4 (Credential Invalidation on Key & Code Rotation in Local Memory Maps)**:
    - *Mechanics*: When an account's activation code or license key was updated or rotated (via Stripe re-sync or CRM admin key reset), `upsertLocalAccount` and `syncSubscriptionWithSweeprCrm` assigned the new values without purging the retired entries from the `licenses` Map. Retired credentials remained valid for offline verification.
    - *Remediation*: Updated both functions to track previous keys and explicitly delete `oldLicenseKey`, `oldCode`, `SWEEPR-DB-${oldCode}`, and `DEEPBLOCK-${oldCode}` from `licenses` upon rotation.
  - **Finding 5 (Defensive Prototype Pollution Guard in Stripe Parameter Serializer)**:
    - *Mechanics*: `flattenStripeParams` recursively serialized nested objects into URL search params without filtering special prototype attributes.
    - *Remediation*: Added explicit guards skipping `__proto__`, `constructor`, and `prototype` keys during serialization.
  - **Finding 6 (Unified Security Headers on Static Error & Fallback Responses)**:
    - *Mechanics*: Static 400 (null byte rejection), 403 (blocked static files/extensions), 404 (file not found), and 500 (uncaught error) responses were emitted via raw `res.writeHead(...)` without security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Cache-Control: no-store`, `Strict-Transport-Security`).
    - *Remediation*: Created `sendErrorResponse(res, statusCode, message)` that attaches strict security and anti-caching headers across all error responses.
  - **Finding 7 (Extension Origin Whitelist & Referer Match in `sweepr_crm`)**:
    - *Mechanics*: `sweepr_crm/src/app.ts`'s `allowedCorsOrigin` required `u.protocol === 'https:'`, blocking `chrome-extension://` and `moz-extension://` requests with `credentials: true`. Additionally, in `isSameOriginRequest`, a matching `Referer` did not return `true` immediately when `Origin` was omitted.
    - *Remediation*: Allowed `chrome-extension://` and `moz-extension://` origins in `allowedCorsOrigin` and `isSameOriginRequest`, and returned `true` immediately when `Referer` matches the trusted host.
  - **Finding 8 (Extension Background Memory Leak Prevention on Tab Closure)**:
    - *Mechanics*: `scamDetectedTabs` in `extension/background.js` tracked tab IDs triggering fake-shop alerts, but lacked a `chrome.tabs.onRemoved` listener, leaking tab IDs when tabs were closed without navigating.
    - *Remediation*: Added `chrome.tabs.onRemoved.addListener((tabId) => scamDetectedTabs.delete(tabId));` to ensure proper garbage collection.

- **Verification Results**:
  - `adblocker`: 16/16 automated defensive security audit test cases passed cleanly (`scratch/verify-audit-2026-10-24.cjs`).
  - `sweepr_crm`: TypeScript typecheck passed cleanly (`npm run typecheck`).
  - `sweepr_crm`: All 18 suite unit and integration tests passed cleanly (`npm test`).

## 2026-10-23 — Daily White-Hat Security Audit & Auto-Remediation Pass
- **Component Scope**:
  1. Website & Node.js HTTP Server (`server.js` & `website/`)
  2. Browser Extension Manifest V3 (`extension/`)
  3. Shared Multi-Project CRM & Licensing Hub (`sweepr_crm/`)
- **Findings & Auto-Remediations**:
  - **Finding 1 (Static File Server Directory Traversal, Null Byte & Top-Level Exception Resilience)**:
    - *Mechanics*: In Node.js, `fs.stat` synchronously throws `TypeError` on paths containing null bytes (`\0` or URL-encoded `%00`). Furthermore, `server.js` lacked an outer `try/catch` wrapping `new URL(req.url)` and request processing, risking process termination on malformed HTTP inputs. Additionally, hidden files (`.*`) and sensitive backend extensions (`.mjs`, `.ts`, `.sh`, `.yml`, `.env*`, `.bak`, `.log`) lacked blanket static denial.
    - *Remediation*:
      - Wrapped `http.createServer` in top-level `try/catch` with safe fallback to 500 error, and guarded URL parsing with 400 Bad Request fallback.
      - Added explicit rejection for null bytes (`req.url.includes('%00') || pathname.includes('\0') || safePath.includes('\0')`) returning `400 Bad Request`.
      - Expanded `BLOCKED_STATIC_FILES` and added `BLOCKED_EXTENSIONS` (`.env`, `.bak`, `.conf`, `.log`, `.md`, `.ts`, `.mjs`, `.sh`, `.yml`, `.yaml`, `.sql`, `.db`, `.lock`) plus blanket rejection of hidden path segments (`seg.startsWith('.') && seg !== '.well-known'`) and arbitrary `.json` files, returning `403 Forbidden`.
  - **Finding 2 (CSRF & Cross-Site Probing Origin Hardening on Portal/Auth/Confirm Endpoints)**:
    - *Mechanics*: `POST /api/confirm-subscription`, `POST /api/portal-login`, `POST /api/verify-otp`, and `POST /api/portal/lookup` did not enforce same-origin verification, allowing third-party sites to submit requests or probe accounts. Furthermore, `isSameOriginWriteRequest` in `server.js` and `isSameOriginRequest` in `sweepr_crm/src/security.ts` did not check the `Referer` header when `Origin` was omitted.
    - *Remediation*:
      - Added `isSameOriginWriteRequest(req)` enforcement returning `403 Forbidden` (`cross_origin_forbidden`) across `POST /api/confirm-subscription`, `POST /api/portal-login`, `POST /api/verify-otp`, and `POST /api/portal/lookup`.
      - Hardened `isSameOriginWriteRequest` (`server.js`) and `isSameOriginRequest` (`sweepr_crm/src/security.ts`) to validate `req.headers.referer` against allowed origins whenever `origin` is omitted on state-changing requests.
  - **Finding 3 (Global Rate Limiting for OTP & Account Verification)**:
    - *Mechanics*: `checkRateLimit` in `server.js` appended the client IP to the bucket key (`${bucketName}:${ip}`), meaning target-specific buckets like `portal_login_email:${email}`, `verify_otp_email:${email}`, and `portal_target:${lookup}` were scoped per-IP rather than globally across rotating botnet/proxy IPs.
    - *Remediation*: Updated `checkRateLimit` so that target-specific keys (`portal_target:`, `verify_otp_email:`, `portal_login_email:`) are rate-limited globally per target identifier, thwarting distributed brute-force attempts.
  - **Finding 4 (Missing Security Headers & API Cache-Control Hardening)**:
    - *Mechanics*: `sendHtml` in `server.js` lacked `Strict-Transport-Security` (HSTS), `Permissions-Policy`, and `Cross-Origin-Opener-Policy` (COOP). `sendJson` did not explicitly enforce `Cache-Control: no-store` on sensitive licensing and account endpoints, leaving responses vulnerable to caching by intermediary proxies.
    - *Remediation*:
      - Added HSTS, COOP, and Permissions-Policy headers to all responses in `sendHtml`.
      - Added `Cache-Control: no-store, no-cache, must-revalidate, private` and `Pragma: no-cache` as standard headers in `sendJson`.
  - **Finding 5 (Attribute-to-Script XSS Mitigation in Checkout Success HTML)**:
    - *Mechanics*: In `renderCheckoutSuccessPage`, the copy button used inline string interpolation (`<button onclick="navigator.clipboard.writeText('${licenseKey}'); ...">`), which in HTML attribute event handlers can lead to attribute-to-script injection discrepancies.
    - *Remediation*: Replaced direct string interpolation with safe DOM reading: `navigator.clipboard.writeText(document.getElementById('licenseKeyText').textContent.trim())`.
  - **Finding 6 (RFC 9116 `security.txt` Standardization Across DeepBlock & CRM)**:
    - *Mechanics*: Neither `sweeprdeepblock.com` nor `sweepr_crm` served `/.well-known/security.txt` or `/security.txt`.
    - *Remediation*: Created RFC 9116 compliant `security.txt` files and endpoints on both `sweeprdeepblock.com` and `sweepr_crm` specifying security disclosure contacts, policies, canonical URLs, and expiration date (2027-12-31).
  - **Finding 7 (Extension Development Fallback Endpoint Hardening & CSP)**:
    - *Mechanics*: `extension/background.js` unconditionally fell back to querying unencrypted local ports `http://localhost:8787` and `http://localhost:3000` when verifying licenses. In `manifest.json`, `content_security_policy` was not explicitly restricted.
    - *Remediation*:
      - Restricted `http://localhost:...` verification endpoints in `background.js` to developer/unpacked mode (`!('update_url' in chrome.runtime.getManifest())`).
      - Enforced HTTPS for official portal auto-sync in `AUTO_SYNC_WEBSITE_LICENSE`.
      - Enforced HTTPS check in `deepblock-content.js`'s website activation bridge.
      - Explicitly defined `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none';" }` in `manifest.json`.
  - **Finding 8 (Inter-Service Secret & Key Synchronization)**:
    - *Mechanics*: `adblocker/.env` was missing `SWEEPR_CRM_API_KEY` and `SWEEPR_LICENSE_PUBLIC_KEY`. `sweepr_crm/.env` was missing `DEEPBLOCK_STRIPE_WEBHOOK_SECRET`, causing forwarded Stripe webhooks to fail signature validation.
    - *Remediation*: Configured `SWEEPR_CRM_API_KEY` and `SWEEPR_LICENSE_PUBLIC_KEY` in `adblocker/.env`, and configured `DEEPBLOCK_STRIPE_WEBHOOK_SECRET` in `sweepr_crm/.env`.

- **Verification Results**:
  - `adblocker`: 14/14 automated defensive security audit test cases passed cleanly (`scratch/verify-audit.cjs`).
  - `sweepr_crm`: TypeScript typecheck passed cleanly (`npm run typecheck`).
  - `sweepr_crm`: All 18 suite unit and integration tests passed cleanly (`npm test`).

## 2026-10-21 — Initial Baseline Audit & Hardening Pass
- **Finding 1 (CSRF Origin Validation on `POST /api/support`)**: Unlike `POST /api/portal/cancel`, `POST /api/support` in `server.js` did not enforce `isSameOriginWriteRequest(req)` before forwarding support tickets to the CRM.
  - **Remediation Implemented**: Added `if (!isSameOriginWriteRequest(req)) return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });` to `POST /api/support` in `server.js`.
- **Finding 2 (Static File Blocklist for Internal JSON State Files)**: `website/indexing-queue.json` and `website/daily-seo-pages-state.json` inside `website/` were accessible via static file serving.
  - **Remediation Implemented**: Added `BLOCKED_STATIC_FILES` (`server.js`, `sweepr-client.js`, `package.json`, `indexing-queue.json`, `daily-seo-pages-state.json`, `outreach-seed-deepblock.json`) to `server.js` returning `403 Forbidden`.
- **Finding 3 (CSP, HSTS, COOP & Permissions-Policy Headers)**: Static responses in `server.js` only set `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.
  - **Remediation Implemented**: Added `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'`.
