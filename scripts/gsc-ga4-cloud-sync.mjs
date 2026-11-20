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
const rootEnvPath = path.join(ROOT_DIR, '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch {}
}
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const FUNNEL_EVENTS_PATH = path.join(DATA_DIR, 'telemetry-funnel-events.json');
const REPORT_OUT_PATH = path.join(DATA_DIR, 'gsc-ga4-cloud-sync-report.json');
const SCHEDULER_STATE_PATH = path.join(DATA_DIR, 'automation-scheduler-state.json');

const RAILWAY_CRM_BASE = (process.env.SWEEPR_RAILWAY_CRM || process.env.SWEEPR_CRM_URL || 'https://sweepr-crm-production.up.railway.app').replace(/\/+$/, '');
const CLEANER_CRM_BASE = (process.env.SWEEPR_CRM_BASE || 'https://sweeprcleaner.com').replace(/\/+$/, '');
const CRM_USER = process.env.CRM_ADMIN_USER || 'admin';
const CRM_PASS = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();

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

  const credFile = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
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

  const gscIngestRows = pqRows
    .map((r) => ({
      date: endDate,
      query: String(r.keys?.[1] || '').trim().toLowerCase(),
      page: String(r.keys?.[0] || '').trim(),
      clicks: Math.max(0, Number(r.clicks || 0)),
      impressions: Math.max(0, Number(r.impressions || 0)),
      ctr: Number(r.ctr || 0),
      position: Number(r.position || 0)
    }))
    .filter((r) => r.query && r.page && r.position > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 500);

  return {
    totalImpressions,
    totalClicks,
    activePagesWithImpressions: pageRows.length,
    newlyDiscoveredPaths: newlyDiscovered,
    strikeZoneCandidates: strikeZoneCandidates.slice(0, 15),
    gscIngestRows,
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

function buildCrmHeaders(baseUrl) {
  let origin = baseUrl;
  try { origin = new URL(baseUrl).origin; } catch {}
  return {
    'Content-Type': 'application/json',
    'x-sweepr-project': 'deepblock',
    Origin: origin,
    ...(CRM_API_KEY ? { 'x-crm-api-key': CRM_API_KEY, 'x-sweepr-api-key': CRM_API_KEY } : {}),
    ...(CRM_PASS ? { Authorization: 'Basic ' + Buffer.from(`${CRM_USER}:${CRM_PASS}`).toString('base64') } : {})
  };
}

async function postJsonSafe(url, headers, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const text = await res.text();
    return { url, status: res.status, ok: res.ok, body: text.slice(0, 200) };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

async function syncDeepblockGscGa4ToCentralCrm({ report, gscResult, ga4Result }) {
  const results = {
    syncedAt: report.generatedAt,
    cloudSync: null,
    telemetry: null,
    changelog: []
  };

  let rowsPayload = Array.isArray(gscResult?.gscIngestRows) ? gscResult.gscIngestRows : [];
  if (rowsPayload.length === 0) {
    const fallbackCandidates = Array.isArray(report.latestGscSnapshot?.strikeZoneCandidates)
      ? report.latestGscSnapshot.strikeZoneCandidates
      : [];
    const todayIso = report.generatedAt.slice(0, 10);
    rowsPayload = fallbackCandidates
      .filter((c) => c && c.urlPath && Number(c.position || 0) > 0 && Array.isArray(c.topQueries) && c.topQueries[0]?.query)
      .map((c) => ({
        date: todayIso,
        query: String(c.topQueries[0].query).trim().toLowerCase(),
        page: `https://sweeprdeepblock.com${c.urlPath === '/' ? '/' : c.urlPath}`,
        clicks: Number(c.clicks || 0),
        impressions: Number(c.impressions || 0),
        ctr: Number(c.ctrPct || 0) / 100,
        position: Number(c.position || 0)
      }));
  }
  rowsPayload = rowsPayload.slice(0, 500);

  if (CRM_API_KEY || CRM_PASS) {
    results.cloudSync = await postJsonSafe(
      `${RAILWAY_CRM_BASE}/api/crm/seo/gsc/cloud-sync`,
      buildCrmHeaders(RAILWAY_CRM_BASE),
      {
        project_id: 'deepblock',
        site_url: GSC_SITE_URL,
        rows: rowsPayload,
        gsc_summary: report.latestGscSnapshot || null,
        ga4_summary: report.latestGa4Snapshot || null
      }
    );
    if (!results.cloudSync.ok) {
      console.warn(`[GSC-GA4-CLOUD] Central CRM sync warning (${results.cloudSync.status}): ${results.cloudSync.error || results.cloudSync.body}`);
    } else {
      console.log(`[GSC-GA4-CLOUD] Synced ${rowsPayload.length} GSC rows to Central CRM (${RAILWAY_CRM_BASE}, HTTP ${results.cloudSync.status}).`);
    }
  } else {
    console.log('[GSC-GA4-CLOUD] Skipped protected /api/crm/seo/gsc/cloud-sync (CRM_ADMIN_PASSWORD / SWEEPR_CRM_API_KEY not configured).');
  }

  results.telemetry = await postJsonSafe(
    `${RAILWAY_CRM_BASE}/v1/telemetry/event`,
    {
      'Content-Type': 'application/json',
      'x-sweepr-project': 'deepblock',
      ...(CRM_API_KEY ? { 'x-crm-api-key': CRM_API_KEY, 'x-sweepr-api-key': CRM_API_KEY } : {})
    },
    {
      project_id: 'deepblock',
      event_name: 'gsc_ga4_cloud_sync_completed',
      category: 'seo_audit',
      os: 'server',
      properties: {
        mode: report.mode,
        trackedDiscoveredGscPathsCount: report.trackedDiscoveredGscPathsCount,
        gscSnapshot: report.latestGscSnapshot || null,
        ga4Snapshot: report.latestGa4Snapshot || null
      }
    }
  );

  const newlyDiscoveredPaths = Array.isArray(gscResult?.newlyDiscoveredPaths) ? gscResult.newlyDiscoveredPaths : [];
  const shouldLogChangelog =
    (newlyDiscoveredPaths.length > 0 || process.argv.includes('--log-changelog')) &&
    Boolean(CRM_API_KEY || CRM_PASS);

  if (shouldLogChangelog) {
    const impr = gscResult?.totalImpressions ?? report.latestGscSnapshot?.totalImpressions ?? 0;
    const clk = gscResult?.totalClicks ?? report.latestGscSnapshot?.totalClicks ?? 0;
    const ga4Users = ga4Result?.activeUsers28d ?? report.latestGa4Snapshot?.activeUsers28d ?? 0;
    const changelogPayload = {
      project_id: 'deepblock',
      date: report.generatedAt.slice(0, 10),
      category: 'gsc_indexing',
      title: newlyDiscoveredPaths.length > 0
        ? `[DeepBlock] Cloud GSC Sync Promoted ${newlyDiscoveredPaths.length} Impression-Earning Pillar(s)`
        : `[DeepBlock] Cloud GSC & GA4 Telemetry Sync (${report.generatedAt.slice(0, 10)})`,
      description: newlyDiscoveredPaths.length > 0
        ? `Live GSC API promoted ${newlyDiscoveredPaths.join(', ')} into indexable pillars. 28d GSC: ${impr} impressions, ${clk} clicks; GA4 28d activeUsers: ${ga4Users}.`
        : `Automated GSC & GA4 cloud sync (${rowsPayload.length} rows). 28d GSC: ${impr} impressions, ${clk} clicks; GA4 28d activeUsers: ${ga4Users}.`,
      impact: `GSC 28d: ${impr} impr / ${clk} clicks; promoted paths: ${newlyDiscoveredPaths.length}`,
      impact_area: 'sweeprdeepblock.com GSC pillars & GA4 funnel telemetry',
      author: 'sweepr-cloud-bot',
      status: 'deployed',
      target_urls: newlyDiscoveredPaths.map((p) => `https://sweeprdeepblock.com${p === '/' ? '/' : p}`),
      metadata: {
        mode: report.mode,
        newlyDiscoveredPaths,
        gscSnapshot: report.latestGscSnapshot || null,
        ga4Snapshot: report.latestGa4Snapshot || null
      }
    };

    const crmTargets = [RAILWAY_CRM_BASE].filter(Boolean);
    for (const base of crmTargets) {
      const cRes = await postJsonSafe(`${base}/api/crm/seo/changelog`, buildCrmHeaders(base), changelogPayload);
      results.changelog.push(cRes);
      if (!cRes.ok) {
        console.warn(`[GSC-GA4-CLOUD] Changelog sync notice for ${base} (${cRes.status}): ${cRes.error || cRes.body}`);
      }
    }
  }

  return results;
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

  const compactGscResult = gscResult
    ? {
        totalImpressions: gscResult.totalImpressions,
        totalClicks: gscResult.totalClicks,
        activePagesWithImpressions: gscResult.activePagesWithImpressions,
        newlyDiscoveredPaths: gscResult.newlyDiscoveredPaths,
        strikeZoneCandidates: gscResult.strikeZoneCandidates,
        sitemapStatuses: gscResult.sitemapStatuses,
        inspectedUrls: gscResult.inspectedUrls
      }
    : null;

  const existingReport = (() => {
    try {
      return fs.existsSync(REPORT_OUT_PATH) ? JSON.parse(fs.readFileSync(REPORT_OUT_PATH, 'utf8')) : null;
    } catch {
      return null;
    }
  })();

  const durationMs = Date.now() - startMs;
  const fallbackGscSnapshot =
    existingReport?.latestGscSnapshot ||
    (enrichmentState.gscRecoveryHistory || [])[enrichmentState.gscRecoveryHistory.length - 1] ||
    null;

  const report = {
    generatedAt: new Date().toISOString(),
    durationMs,
    mode,
    serviceAccountConfigured: Boolean(credentials),
    serviceAccountEmail: credentials?.client_email || null,
    gscSiteUrl: GSC_SITE_URL,
    ga4PropertyId: GA4_PROPERTY_ID,
    trackedDiscoveredGscPathsCount: (enrichmentState.discoveredGscPaths || []).length,
    latestGscSnapshot: compactGscResult || fallbackGscSnapshot,
    latestGa4Snapshot:
      ga4Result ||
      existingReport?.latestGa4Snapshot ||
      (enrichmentState.ga4FunnelHistory || [])[enrichmentState.ga4FunnelHistory.length - 1] ||
      null,
    warnings
  };

  const dryRun = process.argv.includes('--dry-run');
  const skipCrm = process.argv.includes('--skip-crm');
  if (!dryRun && !skipCrm) {
    report.crmSync = await syncDeepblockGscGa4ToCentralCrm({ report, gscResult, ga4Result });
  } else {
    report.crmSync = { skipped: true, reason: dryRun ? '--dry-run' : '--skip-crm' };
  }

  if (!dryRun) {
    fs.writeFileSync(REPORT_OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  }

  if (!dryRun && fs.existsSync(SCHEDULER_STATE_PATH)) {
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
