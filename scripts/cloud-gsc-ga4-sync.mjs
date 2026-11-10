#!/usr/bin/env node
/**
 * SWEEPR DeepBlock (sweeprdeepblock.com) — Headless Cloud GSC & GA4 Sync
 *
 * Pulls live 28d Search Analytics (`sc-domain:sweeprdeepblock.com`) and GA4 Funnel
 * metrics (`559863555`), updates `website/pillar-enrichment-state.json`, and submits
 * `https://sweeprdeepblock.com/sitemap.xml` when `GCP_SERVICE_ACCOUNT_JSON` is set.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasServiceAccountCredentials,
  getServiceAccountEmail,
  fetchGscSearchAnalytics,
  submitGscSitemap,
  inspectGscUrl,
  fetchGa4FunnelReport,
  formatIsoDateDaysAgo
} from './lib/google-cloud-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');

const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:sweeprdeepblock.com';
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '559863555';

async function runDeepBlockCloudSync() {
  if (!hasServiceAccountCredentials()) {
    console.log('ℹ️  [SWEEPR DeepBlock Cloud GSC/GA4 Sync] GCP_SERVICE_ACCOUNT_JSON not set — running with cached pillar-enrichment-state.json.');
    return;
  }

  console.log(`[SWEEPR DeepBlock Cloud GSC/GA4 Sync] Authenticated as ${getServiceAccountEmail()}`);
  const todayStr = new Date().toISOString().slice(0, 10);
  const endDate = formatIsoDateDaysAgo(2);
  const start28d = formatIsoDateDaysAgo(30);

  let state = { titleUpdatedAt: {}, customQuerySurgery: {}, discoveredGscPaths: [], gscRecoveryHistory: [], ga4FunnelHistory: [] };
  if (fs.existsSync(STATE_PATH)) {
    try {
      state = { ...state, ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) };
    } catch {}
  }

  try {
    const rows = await fetchGscSearchAnalytics({
      siteUrl: GSC_SITE_URL,
      startDate: start28d,
      endDate,
      dimensions: ['page'],
      rowLimit: 500
    });
    let impr = 0;
    let clicks = 0;
    const paths = new Set(state.discoveredGscPaths || []);
    for (const r of rows) {
      impr += Number(r.impressions || 0);
      clicks += Number(r.clicks || 0);
      try {
        paths.add(new URL(r.keys?.[0]).pathname);
      } catch {}
    }
    state.discoveredGscPaths = [...paths];
    state.gscRecoveryHistory = [
      ...(state.gscRecoveryHistory || []).filter((h) => h.date !== todayStr),
      { date: todayStr, impressions28d: impr, clicks28d: clicks, rankingPages: rows.length, source: 'gcp_service_account' }
    ].slice(-60);
    console.log(`✅ [SWEEPR DeepBlock Cloud GSC] ${impr} 28d impressions, ${clicks} clicks across ${rows.length} pages.`);
  } catch (err) {
    console.warn(`[SWEEPR DeepBlock Cloud GSC] Notice: ${err.message}`);
  }

  try {
    const ga4 = await fetchGa4FunnelReport({
      propertyId: GA4_PROPERTY_ID,
      keyEventNames: ['extension_install_started', 'test_lab_run', 'begin_checkout', 'order_payment_error', 'purchase']
    });
    state.ga4FunnelHistory = [
      ...(state.ga4FunnelHistory || []).filter((h) => h.date !== todayStr),
      {
        date: todayStr,
        activeUsers28d: ga4.summary.activeUsers,
        sessions28d: ga4.summary.sessions,
        engagementRate: ga4.summary.engagementRate,
        extensionInstallsStarted: ga4.events.extension_install_started?.count || 0,
        testLabRuns: ga4.events.test_lab_run?.count || 0,
        beginCheckout: ga4.events.begin_checkout?.count || 0,
        orderPaymentErrors: ga4.events.order_payment_error?.count || 0,
        purchases: ga4.events.purchase?.count || 0,
        source: 'gcp_service_account'
      }
    ].slice(-60);
    console.log(`✅ [SWEEPR DeepBlock Cloud GA4] ${ga4.summary.activeUsers} active users, ${ga4.summary.sessions} sessions.`);
  } catch (err) {
    console.warn(`[SWEEPR DeepBlock Cloud GA4] Notice: ${err.message}`);
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');

  try {
    await submitGscSitemap({ siteUrl: GSC_SITE_URL, feedpath: 'https://sweeprdeepblock.com/sitemap.xml' });
  } catch {}

  if (fs.existsSync(INDEXING_QUEUE_PATH)) {
    try {
      const q = JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8'));
      for (const u of (q.pending_urls || []).slice(0, 8)) {
        await inspectGscUrl({ siteUrl: GSC_SITE_URL, inspectionUrl: u });
      }
    } catch {}
  }
}

runDeepBlockCloudSync().catch((err) => {
  console.error(err);
  process.exit(1);
});
