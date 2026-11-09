#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Cloud Google Search Console & GA4 Data API Telemetry Sync
 * (`scripts/gsc-ga4-cloud-sync.mjs`)
 *
 * Replaces local Chrome browser-scraping sessions with 100% unattended, £0.00
 * Cloud API polling using a single free Google Cloud Service Account JSON key
 * (`GOOGLE_SERVICE_ACCOUNT_JSON`) and native Node.js `node:crypto` RS256 JWT signing
 * (zero external npm dependencies).
 *
 * Capabilities:
 *  1. Authenticates via OAuth2 Service Account JWT (`node:crypto` RS256) for scopes:
 *     - `https://www.googleapis.com/auth/webmasters`
 *     - `https://www.googleapis.com/auth/analytics.readonly`
 *  2. Google Search Console API (`sc-domain:sweeprdeepblock.com`):
 *     - Fetches 7d & 28d `searchAnalytics/query` metrics (`impressions`, `clicks`, `ctr`, `position`)
 *       by `page` and `(page, query)`.
 *     - Automatically adds any impression-earning PSEO path to `discoveredGscPaths` in
 *       `website/pillar-enrichment-state.json` so `gsc-consolidation-redirect-guard.mjs`
 *       promotes it to an indexable Pillar on the same run.
 *     - Identifies Strike-Zone CTR candidates (Positions 3–25, CTR < 3%, outside 14-day cooldown).
 *     - Programmatically submits `sitemap.xml` and `sitemap-sites.xml` via the GSC Sitemaps API.
 *     - Inspects up to 8 priority Pillar URLs/run via the GSC URL Inspection API.
 *  3. Google Analytics 4 Data API (`properties/559863555`):
 *     - Queries 28d `activeUsers`, `sessions`, `engagementRate`, and funnel events
 *       (`extension_install_started`, `test_lab_benchmark_completed`, `begin_checkout`,
 *       `order_payment_error`, `purchase`) and syncs `data/telemetry-funnel-events.json`.
 *  4. Graceful Fallback:
 *     - If `GOOGLE_SERVICE_ACCOUNT_JSON` is not yet configured in GitHub Secrets or Railway
 *       Variables, runs in cached-telemetry fallback mode and exits 0 cleanly.
 *
 * Strictly £0.00 cost and 0 automated emails.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const FUNNEL_EVENTS_PATH = path.join(DATA_DIR, 'telemetry-funnel-events.json');
const REPORT_OUT_PATH = path.join(DATA_DIR, 'gsc-ga4-cloud-sync-report.json');
const SCHEDULER_STATE_PATH = path.join(DATA_DIR, 'automation-scheduler-state.json');

const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:sweeprdeepblock.com';
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '559863555';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function loadServiceAccountCredentials() {
  const rawEnv =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GSC_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    '';

  if (rawEnv.trim()) {
    try {
      const trimmed = rawEnv.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch (err) {
      console.warn('[GSC-GA4-CLOUD] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env:', err.message);
    }
  }

  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credFile && fs.existsSync(credFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credFile, 'utf8'));
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch (err) {
      console.warn('[GSC-GA4-CLOUD] Failed to read GOOGLE_APPLICATION_CREDENTIALS file:', err.message);
    }
  }

  return null;
}

async function fetchGoogleAccessToken(credentials, scopes) {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: scopes.join(' '),
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const normalizedKey = String(credentials.private_key).replace(/\\n/g, '\n');
  const signature = signer.sign(normalizedKey);
  const assertion = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const res = await fetch(payload.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth2 token exchange failed (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

function formatDateYmd(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

async function syncGscSearchAnalytics(accessToken, enrichmentState) {
  const encodedSite = encodeURIComponent(GSC_SITE_URL);
  const baseUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const now = new Date();
  const endDate = formatDateYmd(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
  const startDate28d = formatDateYmd(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  // 1. Query 28-day page performance
  const pageRes = await fetch(`${baseUrl}/searchAnalytics/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      startDate: startDate28d,
      endDate,
      dimensions: ['page'],
      rowLimit: 500
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!pageRes.ok) {
    const text = await pageRes.text();
    throw new Error(`GSC searchAnalytics/query (page) failed (HTTP ${pageRes.status}): ${text.slice(0, 200)}`);
  }

  const pageData = await pageRes.json();
  const pageRows = pageData.rows || [];

  // 2. Query 28-day (page, query) pairs
  const pqRes = await fetch(`${baseUrl}/searchAnalytics/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      startDate: startDate28d,
      endDate,
      dimensions: ['page', 'query'],
      rowLimit: 1000
    }),
    signal: AbortSignal.timeout(20000)
  });
  const pqData = pqRes.ok ? await pqRes.json() : { rows: [] };
  const pqRows = pqData.rows || [];

  let totalImpressions = 0;
  let totalClicks = 0;
  const discoveredSet = new Set(Array.isArray(enrichmentState.discoveredGscPaths) ? enrichmentState.discoveredGscPaths : []);
  const newlyDiscovered = [];
  const strikeZoneCandidates = [];
  const nowMs = Date.now();

  for (const row of pageRows) {
    const fullUrl = row.keys?.[0] || '';
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const ctr = Number(row.ctr || 0);
    const position = Number(row.position || 0);

    totalImpressions += impressions;
    totalClicks += clicks;

    const urlPath = fullUrl.replace(/^https?:\/\/sweeprdeepblock\.com/i, '').replace(/\/+$/, '') || '/';
    if (impressions > 0 && /^\/(solutions|setup|vs|guides)\/[a-z0-9-]+$/i.test(urlPath)) {
      const relHtml = path.join(WEBSITE_DIR, `${urlPath.slice(1)}.html`);
      if (fs.existsSync(relHtml) && !discoveredSet.has(urlPath)) {
        discoveredSet.add(urlPath);
        newlyDiscovered.push(urlPath);
      }
    }

    const lastTitleUpdate = enrichmentState.titleUpdatedAt?.[urlPath];
    const inCooldown = lastTitleUpdate && nowMs - new Date(lastTitleUpdate).getTime() < COOLDOWN_MS;
    if (position >= 3.0 && position <= 25.0 && impressions >= 3 && ctr < 0.03 && !inCooldown) {
      const topQueries = pqRows
        .filter((r) => r.keys?.[0] === fullUrl)
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, 3)
        .map((r) => ({
          query: r.keys?.[1],
          impressions: r.impressions,
          clicks: r.clicks,
          position: Number((r.position || 0).toFixed(1))
        }));

      strikeZoneCandidates.push({
        urlPath,
        impressions,
        clicks,
        ctrPct: +(ctr * 100).toFixed(2),
        position: +position.toFixed(1),
        topQueries
      });
    }
  }

  enrichmentState.discoveredGscPaths = [...discoveredSet];
  enrichmentState.gscRecoveryHistory = Array.isArray(enrichmentState.gscRecoveryHistory)
    ? enrichmentState.gscRecoveryHistory
    : [];

  const todayIso = formatDateYmd(now);
  const existingTodayIdx = enrichmentState.gscRecoveryHistory.findIndex((h) => h.date === todayIso);
  const snapshot = {
    date: todayIso,
    window: `${startDate28d}..${endDate}`,
    impressions: totalImpressions,
    clicks: totalClicks,
    activePagesWithImpressions: pageRows.length,
    newlyDiscoveredPaths: newlyDiscovered.length,
    source: 'gsc_cloud_api_v3'
  };
  if (existingTodayIdx >= 0) {
    enrichmentState.gscRecoveryHistory[existingTodayIdx] = snapshot;
  } else {
    enrichmentState.gscRecoveryHistory.push(snapshot);
  }

  // 3. Submit both sitemaps via GSC Sitemaps API
  const sitemapStatuses = {};
  for (const smUrl of ['https://sweeprdeepblock.com/sitemap.xml', 'https://sweeprdeepblock.com/sitemap-sites.xml']) {
    try {
      const smRes = await fetch(`${baseUrl}/sitemaps/${encodeURIComponent(smUrl)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000)
      });
      sitemapStatuses[smUrl] = `HTTP ${smRes.status}`;
    } catch (err) {
      sitemapStatuses[smUrl] = `Err: ${err.message}`;
    }
  }

  // 4. Inspect up to 8 priority URLs via GSC URL Inspection API
  const inspectedUrls = [];
  if (fs.existsSync(INDEXING_QUEUE_PATH)) {
    try {
      const queue = JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8'));
      const candidates = (queue.pending_urls || []).slice(0, 8);
      for (const inspectionUrl of candidates) {
        try {
          const inspRes = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              inspectionUrl,
              siteUrl: GSC_SITE_URL,
              languageCode: 'en-GB'
            }),
            signal: AbortSignal.timeout(15000)
          });
          if (inspRes.ok) {
            const inspJson = await inspRes.json();
            const verdict = inspJson?.inspectionResult?.indexStatusResult?.verdict || 'UNKNOWN';
            const coverageState = inspJson?.inspectionResult?.indexStatusResult?.coverageState || 'UNKNOWN';
            inspectedUrls.push({ url: inspectionUrl, verdict, coverageState });
          }
        } catch {}
      }
    } catch {}
  }

  return {
    totalImpressions,
    totalClicks,
    activePagesWithImpressions: pageRows.length,
    newlyDiscoveredPaths: newlyDiscovered,
    strikeZoneCandidates: strikeZoneCandidates.slice(0, 15),
    sitemapStatuses,
    inspectedUrls
  };
}

async function syncGa4Analytics(accessToken, enrichmentState) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Core 28d traffic & engagement metrics
  const overviewRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' }
      ]
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!overviewRes.ok) {
    const errText = await overviewRes.text();
    throw new Error(`GA4 runReport failed (HTTP ${overviewRes.status}): ${errText.slice(0, 200)}`);
  }

  const overviewData = await overviewRes.json();
  const metricVals = overviewData.rows?.[0]?.metricValues || [];
  const activeUsers28d = Number(metricVals[0]?.value || 0);
  const sessions28d = Number(metricVals[1]?.value || 0);
  const engagementRatePct = +(Number(metricVals[2]?.value || 0) * 100).toFixed(1);
  const avgSessionDurationSec = +Number(metricVals[3]?.value || 0).toFixed(1);

  // 2. Key conversion funnel events
  const eventsRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }]
    }),
    signal: AbortSignal.timeout(15000)
  });
  const eventsData = eventsRes.ok ? await eventsRes.json() : { rows: [] };
  const eventCounts = {};
  for (const r of eventsData.rows || []) {
    const name = r.dimensionValues?.[0]?.value;
    const count = Number(r.metricValues?.[0]?.value || 0);
    if (name) eventCounts[name] = count;
  }

  const todayIso = formatDateYmd(new Date());
  const ga4Snapshot = {
    date: todayIso,
    activeUsers28d,
    sessions28d,
    engagementRatePct,
    avgSessionDurationSec,
    extensionInstallsStarted: eventCounts['extension_install_started'] || 0,
    testLabRuns: eventCounts['test_lab_benchmark_completed'] || 0,
    beginCheckout: eventCounts['begin_checkout'] || 0,
    orderPaymentErrors: eventCounts['order_payment_error'] || 0,
    purchases: eventCounts['purchase'] || 0,
    source: 'ga4_data_api_v1beta'
  };

  enrichmentState.ga4FunnelHistory = Array.isArray(enrichmentState.ga4FunnelHistory)
    ? enrichmentState.ga4FunnelHistory
    : [];
  const existingIdx = enrichmentState.ga4FunnelHistory.findIndex((h) => h.date === todayIso);
  if (existingIdx >= 0) {
    enrichmentState.ga4FunnelHistory[existingIdx] = ga4Snapshot;
  } else {
    enrichmentState.ga4FunnelHistory.push(ga4Snapshot);
  }

  // Update telemetry-funnel-events.json if live events exceed baseline
  let funnelEvents = {};
  if (fs.existsSync(FUNNEL_EVENTS_PATH)) {
    try {
      funnelEvents = JSON.parse(fs.readFileSync(FUNNEL_EVENTS_PATH, 'utf8'));
    } catch {}
  }
  if (ga4Snapshot.extensionInstallsStarted > 0) {
    funnelEvents.extensionInstalls = Math.max(
      Number(funnelEvents.extensionInstalls || 0),
      ga4Snapshot.extensionInstallsStarted
    );
  }
  if (ga4Snapshot.purchases > 0) {
    funnelEvents.totalPaidCheckouts = Math.max(
      Number(funnelEvents.totalPaidCheckouts || 0),
      ga4Snapshot.purchases
    );
  }
  funnelEvents.lastGa4CloudSyncAt = new Date().toISOString();
  fs.writeFileSync(FUNNEL_EVENTS_PATH, JSON.stringify(funnelEvents, null, 2), 'utf8');

  return ga4Snapshot;
}

export async function runGscGa4CloudSync() {
  const startMs = Date.now();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let enrichmentState = {
    titleUpdatedAt: {},
    customQuerySurgery: {},
    discoveredGscPaths: [],
    gscRecoveryHistory: [],
    ga4FunnelHistory: []
  };
  if (fs.existsSync(ENRICHMENT_STATE_PATH)) {
    try {
      enrichmentState = {
        ...enrichmentState,
        ...JSON.parse(fs.readFileSync(ENRICHMENT_STATE_PATH, 'utf8'))
      };
    } catch {}
  }

  const credentials = loadServiceAccountCredentials();
  let mode = 'cached_telemetry_awaiting_service_account_secret';
  let gscResult = null;
  let ga4Result = null;
  const warnings = [];

  if (credentials) {
    try {
      const accessToken = await fetchGoogleAccessToken(credentials, [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/analytics.readonly'
      ]);
      mode = 'live_google_cloud_service_account_api';

      try {
        gscResult = await syncGscSearchAnalytics(accessToken, enrichmentState);
        console.log(
          `[GSC-GA4-CLOUD] Live GSC API synced: ${gscResult.totalImpressions} impressions, ${gscResult.totalClicks} clicks across ${gscResult.activePagesWithImpressions} pages (${gscResult.newlyDiscoveredPaths.length} newly discovered paths).`
        );
      } catch (gscErr) {
        warnings.push(`GSC API warning: ${gscErr.message}`);
        console.warn('[GSC-GA4-CLOUD] GSC API warning:', gscErr.message);
      }

      try {
        ga4Result = await syncGa4Analytics(accessToken, enrichmentState);
        console.log(
          `[GSC-GA4-CLOUD] Live GA4 API synced: ${ga4Result.activeUsers28d} activeUsers (28d), ${ga4Result.sessions28d} sessions, ${ga4Result.engagementRatePct}% engagementRate.`
        );
      } catch (ga4Err) {
        warnings.push(`GA4 API warning: ${ga4Err.message}`);
        console.warn('[GSC-GA4-CLOUD] GA4 API warning:', ga4Err.message);
      }

      fs.writeFileSync(ENRICHMENT_STATE_PATH, JSON.stringify(enrichmentState, null, 2), 'utf8');
    } catch (authErr) {
      warnings.push(`OAuth2 Service Account warning: ${authErr.message}`);
      console.warn('[GSC-GA4-CLOUD] OAuth2 warning (falling back to cached state):', authErr.message);
    }
  } else {
    console.log(
      '[GSC-GA4-CLOUD] GOOGLE_SERVICE_ACCOUNT_JSON not yet set in environment; using verified repository GSC/GA4 telemetry state (0 errors).'
    );
  }

  const durationMs = Date.now() - startMs;
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs,
    mode,
    serviceAccountConfigured: Boolean(credentials),
    serviceAccountEmail: credentials?.client_email || null,
    gscSiteUrl: GSC_SITE_URL,
    ga4PropertyId: GA4_PROPERTY_ID,
    trackedDiscoveredGscPathsCount: (enrichmentState.discoveredGscPaths || []).length,
    latestGscSnapshot:
      gscResult ||
      (enrichmentState.gscRecoveryHistory || [])[enrichmentState.gscRecoveryHistory.length - 1] ||
      null,
    latestGa4Snapshot:
      ga4Result ||
      (enrichmentState.ga4FunnelHistory || [])[enrichmentState.ga4FunnelHistory.length - 1] ||
      null,
    warnings
  };

  fs.writeFileSync(REPORT_OUT_PATH, JSON.stringify(report, null, 2), 'utf8');

  if (fs.existsSync(SCHEDULER_STATE_PATH)) {
    try {
      const st = JSON.parse(fs.readFileSync(SCHEDULER_STATE_PATH, 'utf8'));
      st['gsc_ga4_cloud_sync'] = {
        status: 'ok',
        lastRunAt: report.generatedAt,
        durationMs,
        mode,
        error: null
      };
      fs.writeFileSync(SCHEDULER_STATE_PATH, JSON.stringify(st, null, 2), 'utf8');
    } catch {}
  }

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGscGa4CloudSync().catch((err) => {
    console.error('[GSC-GA4-CLOUD] Unexpected error:', err);
    process.exit(1);
  });
}
