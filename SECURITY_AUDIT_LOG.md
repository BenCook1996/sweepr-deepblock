# SWEEPR DeepBlock (`sweeprdeepblock.com`) — Daily White-Hat Security Audit & Auto-Remediation Log

## 2026-10-31 — Daily White-Hat Security Audit & Auto-Remediation Pass
- **Component Scope**:
  1. Website & Node.js HTTP Server (`server.js` & `website/`)
  2. Browser Extension Manifest V3 (`extension/`)
  3. Shared Multi-Project CRM & Licensing Hub (`sweepr_crm/`)
- **Findings & Auto-Remediations**:
  - **Finding 1 (DeclarativeNetRequest Dynamic Delta Rule Validation Deficiency & Arbitrary Action/Redirect Injection)**:
    - *Mechanics*: In `extension/background.js`, `syncRemoteFilterDelta` fetched dynamic rules from the remote delta server and installed them via `chrome.declarativeNetRequest.updateDynamicRules` checking only `typeof r.id === 'number' && r.id >= 80000 && r.id < 81000`. It omitted validation of `r.action.type`, meaning tampered delta payloads could inject `redirect` actions or arbitrary header manipulations. Furthermore, rules were not validated for non-empty string `urlFilter` and failed to disallow `main_frame` blocks.
    - *Remediation*: Implemented strict DNR rule schema enforcement: verified `r.action && r.action.type === 'block'` (rejecting `redirect` and `modifyHeaders`), required string `r.condition?.urlFilter` with length >= 2, disallowed `main_frame` from `resourceTypes`, and cleaned up dead code in `background.js`.
  - **Finding 2 (Extension Dashboard State & License Key Exposure to Webpage Content Scripts)**:
    - *Mechanics*: In `extension/background.js`, `GET_DASHBOARD_STATE` was positioned before the `isPrivilegedExtensionPage` check in `chrome.runtime.onMessage`. Because content scripts running on arbitrary web pages (`<all_urls>`) share `sender.id === chrome.runtime.id`, any content script could query `GET_DASHBOARD_STATE` and obtain the user's secret `licenseKey`, active settings, and RAM speedometer data. Additionally, the privilege guard checked `!sender || !sender.tab`, which could allow arbitrary contexts without tabs.
    - *Remediation*: Moved `GET_DASHBOARD_STATE` below `isPrivilegedExtensionPage`, and hardened `isPrivilegedExtensionPage` to strictly require `extBaseUrl && senderUrl.startsWith(extBaseUrl)` matching official extension pages (`popup.html`, `welcome.html`).
  - **Finding 3 (Attribute-to-Script XSS & Incomplete Single-Quote Escaping in CRM Partner Portal)**:
    - *Mechanics*: In `sweepr_crm/src/app.ts` (`GET /partner/:token`), tracking links featured a copy button using direct string interpolation within an inline event handler: `<button onclick="navigator.clipboard.writeText('${esc(p.tracking_url)}');...">`. The local `esc()` helper escaped `& < > "` but omitted single quotes (`'`). If `p.tracking_url` contained a single quote, it broke out of the JavaScript literal inside `onclick`, executing arbitrary JavaScript.
    - *Remediation*: Attached tracking URLs safely via `data-copy="${esc(p.tracking_url)}"` with `navigator.clipboard.writeText(this.getAttribute('data-copy') || '')`, and added `.replace(/'/g, "&#39;")` to `esc()`.
  - **Finding 4 (Unrestricted Extension Origin & Cross-Origin CSRF on Device Pairing Approval)**:
    - *Mechanics*: `POST /api/device-link/approve` in `server.js` was configured with `isSameOriginWriteRequest(req, { allowExtension: true })`. This endpoint is designed for the authenticated user visiting `/pair?mode=approve` on their phone or browser, where ambient `sweepr_session` cookies authorize the pairing. Allowing `{ allowExtension: true }` enabled any rogue third-party extension in the customer's browser to send cross-origin POSTs with ambient cookies and silently approve pairing challenges.
    - *Remediation*: Removed `{ allowExtension: true }` from `POST /api/device-link/approve`, enforcing strict same-origin/same-site web requests with CSRF validation.
  - **Finding 5 (Founder Session CSRF Vulnerability on DeepBlock Blocked Sites Registry)**:
    - *Mechanics*: In `server.js`, `POST` and `DELETE` on `/api/deepblock/blocked-sites` accepted authenticated founder session cookies (`verifySessionCookie(req)`) via `hasBlockedSitesAdminAuth(req)`, but omitted `isSameOriginWriteRequest(req)`. An external malicious webpage could issue cross-origin requests with ambient cookies to inject or delete verified adblocking rules.
    - *Remediation*: Enforced `isSameOriginWriteRequest(req)` on all state-changing methods (`POST`, `DELETE`, `PUT`) in `hasBlockedSitesAdminAuth(req)` whenever session cookie authentication is utilized.
  - **Finding 6 (DOM XSS via Unescaped Server Error Message in Website Login Portal)**:
    - *Mechanics*: In `website/login.html`'s device pairing QR generator, error responses concatenated raw server messages directly into `svgBox.innerHTML` (`'<span class="text-xs text-red-600 font-semibold px-2">' + (data.message || data.error || 'Could not create QR') + '</span>'`), creating a DOM XSS vulnerability if error strings contained markup.
    - *Remediation*: Replaced `innerHTML` concatenation with safe DOM element creation and `textContent` assignment.
  - **Finding 7 (Web Portal Authentication & OTP Endpoints Missing Same-Origin CSRF Protection in CRM)**:
    - *Mechanics*: In `sweepr_crm/src/app.ts`, `POST /api/auth/send-otp` and `POST /api/auth/verify-otp` lacked `requireSameOrigin(c)`, leaving them exposed to cross-origin form CSRF, automated OTP spamming, and account enumeration.
    - *Remediation*: Enforced `const csrfErr = requireSameOrigin(c); if (csrfErr) return csrfErr;` on both endpoints.
  - **Finding 8 (CORS Credential Exposure for Browser Extensions on Sensitive CRM Checkout Endpoints)**:
    - *Mechanics*: `allowedCorsOrigin` in `sweepr_crm/src/app.ts` unconditionally allowed `chrome-extension://` and `moz-extension://`. Because `/api/checkout*` and `/api/payment-intent*` were configured with `credentials: true`, any installed browser extension could issue credentialed cross-origin requests to payment and checkout endpoints.
    - *Remediation*: Parameterized `allowedCorsOrigin(o, { allowExtension: false })` on `/api/checkout*` and `/api/payment-intent*`, restricting credentialed CORS strictly to verified product web domains and desktop apps (`tauri://localhost`).
  - **Finding 9 (Unrestricted Production Demo Seeding Endpoint Abuse)**:
    - *Mechanics*: In `sweepr_crm/src/crm.ts`, `POST /api/crm/seed-demo` lacked an environment guard, allowing administrators or compromised credentials to inject demo accounts and dummy invoices into live production databases.
    - *Remediation*: Added `if (process.env.NODE_ENV === "production") return c.json({ ok: false, error: "seed_demo_disabled_in_production" }, 403);`.
  - **Finding 10 (Insufficient OTA Cosmetic Selector Sanitization in Extension Content Script)**:
    - *Mechanics*: In `extension/content/deepblock-content.js`, `applyOtaCosmeticStyle` filtered OTA cosmetic selectors using only `!/[{};]/.test(s)`, failing to reject CSS escape backslashes (`\`), at-rules (`@`), or `url(...)` functions.
    - *Remediation*: Hardened validation to strictly enforce `/^[a-zA-Z0-9#._:() >[\]="'-]+$/`, max length <= 250, and reject `[/{};\\@]` and `url(`.
  - **Finding 11 (Static File Server Extension Denial Gaps in Website Server)**:
    - *Mechanics*: `BLOCKED_EXTENSIONS` in `server.js` lacked explicit entries for SQLite databases (`.sqlite`, `.sqlite3`), certificate/key vaults (`.pem`, `.crt`, `.key`, `.pfx`), and config files (`.cfg`, `.ini`).
    - *Remediation*: Added `.sqlite`, `.sqlite3`, `.pem`, `.crt`, `.key`, `.pfx`, `.cfg`, and `.ini` to `BLOCKED_EXTENSIONS`.
  - **Finding 12 (Production Localhost Dynamic Origin Acceptance in Server.js)**:
    - *Mechanics*: In `server.js`, `resolveTrustedOrigin` unconditionally added `http://localhost:${PORT}` and parsed `Host: localhost` headers into allowed origins even when running in production.
    - *Remediation*: Restricted localhost origin allowance strictly to `process.env.NODE_ENV !== 'production'`.

- **Verification Results**:
  - `adblocker` & `sweepr_crm`: 7/7 automated security test suites (12 security findings) passed cleanly (`scratch/verify-audit-2026-10-31.cjs`).
  - `sweepr_crm`: TypeScript typecheck passed cleanly (`npm run typecheck`).
  - `sweepr_crm`: All 25 suite unit and integration tests passed cleanly (`npm test`).
  - `server.js`: Node.js syntax verification check passed cleanly (`node -c server.js`).

## 2026-10-29 — Daily White-Hat Security Audit & Auto-Remediation Pass
- **Component Scope**:
  1. Website & Node.js HTTP Server (`server.js` & `website/`)
  2. Browser Extension Manifest V3 (`extension/`)
  3. Shared Multi-Project CRM & Licensing Hub (`sweepr_crm/`)
- **Findings & Auto-Remediations**:
  - **Finding 1 (Universal Extension Origin Acceptance on Sensitive Web CSRF Endpoints)**:
    - *Mechanics*: `isSameOriginRequest` in `sweepr_crm/src/security.ts` and `isSameOriginWriteRequest` in `server.js` unconditionally accepted any origin starting with `chrome-extension://` or `moz-extension://`. Any rogue or malicious third-party extension installed in a customer's browser could issue cross-origin POST requests with ambient session cookies or stored credentials to sensitive web-only endpoints (`/api/create-subscription`, `/api/portal/cancel`, `/api/portal-login`, `/api/auth/send-otp`, `/v1/account/cancel`, `/v1/account/devices/:deviceId/revoke`).
    - *Remediation*: Parameterized `isSameOriginRequest(c, publicUrl, trustProxy, { allowExtension = false })` in `sweepr_crm` and `isSameOriginWriteRequest(req, { allowExtension = false } = {})` in `server.js`. Web-only checkout, login, OTP, and cancellation routes reject extension origins by default. Extension-specific endpoints (`/api/portal/devices/remove`, `/api/device-link/create-token`, `/api/telemetry`, `/api/support`) explicitly opt in via `{ allowExtension: true }`. In addition, simple HTML form posts (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) are strictly rejected unless `sec-fetch-site` matches `same-origin` or `same-site`.
  - **Finding 2 (Unauthenticated Registry Poisoning on DeepBlock Blocked Sites Registry)**:
    - *Mechanics*: `POST /v1/deepblock/blocked-sites` (`sweepr_crm`) and `POST`/`DELETE` `/api/deepblock/blocked-sites` (`server.js`) lacked administrative authentication checks. Any unauthenticated caller could overwrite verified blocked sites, inject arbitrary spoofed domains, or delete verified entries, subverting automated adblocking registries and bot deduplication systems.
    - *Remediation*: In `sweepr_crm/src/app.ts`, enforced `hasValidServiceApiKey(c)` returning `401 Unauthorized` on `POST /v1/deepblock/blocked-sites`. In `server.js`, implemented `hasBlockedSitesAdminAuth(req)` supporting timing-safe comparison against `SWEEPR_CRM_API_KEY`, HTTP Basic Authentication (`CRM_ADMIN_PASSWORD`), and authenticated founder session cookies (`FOUNDER_EMAIL`), returning `401 Unauthorized` with rate limiting (`blocked_sites_write`, 30/min).
  - **Finding 3 (Sensitive Customer Email Correspondence and Deduplication State Exfiltration)**:
    - *Mechanics*: `GET /v1/email-actions`, `GET /v1/email-actions/check`, and `POST /v1/email-actions` in `sweepr_crm/src/app.ts` were accessible to unauthenticated callers. An external party could query `GET /v1/email-actions` to harvest sensitive customer email correspondence logs, thread IDs, customer email addresses, and subject lines.
    - *Remediation*: Enforced `hasValidServiceApiKey(c)` across `GET /v1/email-actions`, `GET /v1/email-actions/check`, and `POST /v1/email-actions`, returning `401 Unauthorized` without the verified service API key.
  - **Finding 4 (Extension Options & Popup Clickjacking Surface)**:
    - *Mechanics*: In `extension/manifest.json`, `content_security_policy.extension_pages` lacked the `frame-ancestors` directive (`script-src 'self'; object-src 'none'; base-uri 'none';`). An attacker's web page could attempt to embed extension pages (such as options or custom dialogs) inside hidden `<iframe>` elements to perform clickjacking attacks on extension toggles.
    - *Remediation*: Appended `frame-ancestors 'none';` to `content_security_policy.extension_pages` in `manifest.json`, preventing extension pages from being embedded in any framing context.
  - **Finding 5 (CSS Injection & Stylesheet Breakout in Custom Element Zapper)**:
    - *Mechanics*: In `extension/content/deepblock-content.js`, `applySavedCustomHiddenSelectors` read custom CSS selectors stored in `chrome.storage.sync` and interpolated them directly into a `<style>` element (`style.textContent = selectors.join(', ') + ' { display: none !important; }'`). If a malicious sync value or tampered selector contained `}` or `@import` or `url(...)`, it could break out of the selector block and inject arbitrary CSS to leak keystrokes or exfiltrate DOM content.
    - *Remediation*: Implemented strict regex selector character validation (`/^[a-zA-Z0-9#._:() >[\]="'-]+$/` rejecting `{`, `}`, `;`, `\`, `@`, `url(`) before applying stored custom selectors, and discarded any invalid entries.
  - **Finding 6 (Untrusted Remote Selector Injection in Dynamic Filter Delta Sync)**:
    - *Mechanics*: In `extension/background.js`, `syncRemoteFilterDelta` fetched remote filter updates (`extraCmpSelectors`, `extraAntiAdblockSelectors`, `extraCosmeticSelectors`) from `dynamic_delta.json` and saved them into `chrome.storage.local` without validating the contents or length of the selectors. A compromised upstream delta server or malicious proxy response could push arbitrary CSS rules into the extension.
    - *Remediation*: Implemented `sanitizeRemoteSelector(sel, maxLen)` which verifies type, length bounds, regex syntax (`/^[a-zA-Z0-9#._:() >[\]="'-]+$/`), and rejects `{`, `}`, `;`, `\`, `@`, and `url(`, sanitizing all dynamic delta selectors before persisting to extension storage.
  - **Finding 7 (Sub-frame Hijacking in Website Auto-Activation Bridge)**:
    - *Mechanics*: `chrome.runtime.onMessage` handled `AUTO_SYNC_WEBSITE_LICENSE` by inspecting `(sender && sender.url) || (sender && sender.tab && sender.tab.url)`. If an attacker embedded an iframe from `sweeprdeepblock.com` within a malicious page, or triggered message passing from an embedded frame, the origin check could be confused. Furthermore, license key format had only a minimal `length >= 6` check.
    - *Remediation*: Enforced `sender.frameId === 0` (top-level frame only), verified that both `sender.url` and `sender.tab.url` independently match verified HTTPS `sweeprdeepblock.com` domains, and validated license key string bounds (`6 <= key.length <= 128` without email `@` characters).
  - **Finding 8 (Synchronous Disk I/O Bottleneck & Rate-Limit Absence on Version & Delta Endpoints)**:
    - *Mechanics*: `GET /api/filters/delta` in `server.js` executed `fs.readFileSync(deltaPath)` on every incoming request, exposing the server event loop to synchronous disk read saturation during traffic spikes. Additionally, `/api/version` and `/api/filters/delta` lacked rate limits.
    - *Remediation*: Implemented `getCachedDynamicDelta()` using memory caching with file mtime stat checking (`cachedDynamicDelta = { mtimeMs, data }`), eliminating repeated disk reads. Added rate limiting (`checkRateLimit(req, 'filters_delta', 120, 60000)` and `checkRateLimit(req, 'version_check', 120, 60000)`) returning `429 rate_limit_exceeded`.
  - **Finding 9 (CRM Device Revocation Desynchronization on Device Removal)**:
    - *Mechanics*: When a user removed a device slot via `POST /api/portal/devices/remove`, `server.js` removed the device from local memory (`removeLocalDeviceForAccount`) but did not propagate the revocation to the central CRM licensing service (`sweepr_crm`). As a result, the device remained active in CRM records until the full subscription re-synced.
    - *Remediation*: Added `revokeDevice(accountId, deviceId)` to `SweeprCrmClient` in `sweepr-client.js`, and hooked it into `POST /api/portal/devices/remove` to immediately trigger `crm.revokeDevice(acc.crm_account_id, deviceIdToRemove)` and sync the subscription state.
  - **Finding 10 (Insecure HTTP Protocol Transport in CRM VPN Peer Revocation)**:
    - *Mechanics*: In `sweepr_crm/src/app.ts`, `notifyVpnPeerRevocation` accepted any URL matching `isPublicHttpUrl(remoteUrl)`, including plain unencrypted `http://` URLs in production environments, potentially leaking revocation payloads in transit across untrusted networks.
    - *Remediation*: Enforced that in production (`process.env.NODE_ENV === "production"`), peer revocation targets must strictly use `https://`.

- **Verification Results**:
  - `adblocker` & `sweepr_crm`: 9/9 automated defensive security audit test cases passed cleanly (`scratch/verify-audit-2026-10-29.cjs`).
  - `sweepr_crm`: TypeScript typecheck passed cleanly (`npm run typecheck`).
  - `sweepr_crm`: All 23 suite unit and integration tests passed cleanly (`npm test`).
  - `server.js`: Node.js syntax verification check passed cleanly (`node -c server.js`).

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

---

## [Cloud Automated Security & Trust-Boundary Audit] — 2026-11-09

- **Timestamp**: `2026-11-09T22:50:42.362Z`
- **Engine**: `scripts/cloud-security-audit.mjs`
- **Scorecard**: **8/10 Trust-Boundary Checks Passed (2 Vulnerabilities)**
- **Verified Domains**: Stripe/PayPal HMAC Webhooks, Single-Use OTP & `HttpOnly; SameSite=Lax` Sessions, 5-Device License Cap, Path-Traversal & Dotfile Blocking, Manifest V3 Least-Privilege, Own-Domain GA4/UTM DNR Exclusions, and Zero-Dependency Supply Chain.

---

## [Cloud Automated Security & Trust-Boundary Audit] — 2026-11-10

- **Timestamp**: `2026-11-10T20:59:52.670Z`
- **Engine**: `scripts/cloud-security-audit.mjs`
- **Scorecard**: **10/10 Trust-Boundary Checks Passed (0 Vulnerabilities)**
- **Verified Domains**: Stripe/PayPal HMAC Webhooks, Single-Use OTP & `HttpOnly; SameSite=Lax` Sessions, 5-Device License Cap, Path-Traversal & Dotfile Blocking, Manifest V3 Least-Privilege, Own-Domain GA4/UTM DNR Exclusions, and Zero-Dependency Supply Chain.
