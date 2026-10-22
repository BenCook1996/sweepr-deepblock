# SWEEPR DeepBlock (`sweeprdeepblock.com`) — Daily White-Hat Security Audit & Auto-Remediation Log

## 2026-10-21 — Initial Baseline Audit & Hardening Pass
- **Finding 1 (CSRF Origin Validation on `POST /api/support`)**: Unlike `POST /api/portal/cancel`, `POST /api/support` in `server.js` did not enforce `isSameOriginWriteRequest(req)` before forwarding support tickets to the CRM.
  - **Remediation Implemented**: Added `if (!isSameOriginWriteRequest(req)) return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });` to `POST /api/support` in `server.js`.
- **Finding 2 (Static File Blocklist for Internal JSON State Files)**: `website/indexing-queue.json` and `website/daily-seo-pages-state.json` inside `website/` were accessible via static file serving.
  - **Remediation Implemented**: Added `BLOCKED_STATIC_FILES` (`server.js`, `sweepr-client.js`, `package.json`, `indexing-queue.json`, `daily-seo-pages-state.json`, `outreach-seed-deepblock.json`) to `server.js` returning `403 Forbidden`.
- **Finding 3 (CSP, HSTS, COOP & Permissions-Policy Headers)**: Static responses in `server.js` only set `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.
  - **Remediation Implemented**: Added `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'`.
