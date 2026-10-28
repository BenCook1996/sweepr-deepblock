/**
 * SWEEPR DeepBlock — CRM Webhook & Telemetry Integration (`crm-reporter.mjs`)
 *
 * Dispatches structured leak records and daily pipeline summary payloads to:
 *  1. Central SWEEPR CRM (`SWEEPR_CRM_URL` & `https://sweepr-crm-production.up.railway.app`)
 *     under `project=deepblock` (`/v1/telemetry/event` & `/api/crm/outreach?project=deepblock`)
 *  2. Custom CRM Webhook endpoint (`CRM_WEBHOOK_URL` for HubSpot / Salesforce / Airtable / Webhook)
 *  3. Local Dead-Letter Queue (`data/crm-dlq.json`) for zero data loss if endpoints are offline
 *
 * Schema per Leak Record:
 *  - `Timestamp` (ISO-8601)
 *  - `Target_URL`
 *  - `Ad_Type_Detected` ('Network' | 'DOM' | 'Script')
 *  - `Generated_Rule`
 *  - `Fix_Status` ('Auto-Patched' | 'Failed Verification - Needs Manual Review')
 *  - `Commit_Hash` (or `PR_Link`)
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, CRM_DLQ_PATH } from './state-db.mjs';

const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

export class CrmPipelineReporter {
  constructor(options = {}) {
    this.projectId = 'deepblock';
    this.primaryCrmUrl = String(
      options.crmUrl || process.env.SWEEPR_RAILWAY_CRM || 'https://sweepr-crm-production.up.railway.app'
    ).replace(/\/+$/, '');
    this.localCrmUrl = String(process.env.SWEEPR_CRM_URL || 'http://localhost:8788').replace(/\/+$/, '');
    this.customWebhookUrl = String(options.webhookUrl || process.env.CRM_WEBHOOK_URL || '').trim();
    this.adminUser = process.env.CRM_ADMIN_USER || 'admin';
    this.adminPassword = process.env.CRM_ADMIN_PASSWORD || 'B3njamin123!';
    this.apiKey =
      process.env.SWEEPR_CRM_API_KEY ||
      'sweepr_crm_live_9f4b8e2c7a1d6f305b8e41c92a70d3e8f61429b50c3a8d7e';
  }

  _headers() {
    const h = {
      'Content-Type': 'application/json',
      'X-Sweepr-Project': this.projectId
    };
    if (this.apiKey) {
      h['X-Crm-Api-Key'] = this.apiKey;
      h['X-Sweepr-Api-Key'] = this.apiKey;
    }
    if (this.adminPassword) {
      h.Authorization = 'Basic ' + Buffer.from(`${this.adminUser}:${this.adminPassword}`).toString('base64');
    }
    return h;
  }

  /**
   * Formats a detected leak record into the exact required CRM schema.
   */
  formatLeakCrmPayload(leakRecord, commitRef = 'local') {
    return {
      Timestamp: leakRecord.timestamp || new Date().toISOString(),
      Target_URL: leakRecord.targetUrl,
      Ad_Type_Detected: leakRecord.adTypeDetected,
      Generated_Rule: leakRecord.generatedRule,
      Fix_Status: leakRecord.fixStatus,
      Commit_Hash: leakRecord.prLink || commitRef || leakRecord.commitHash || 'local',
      PR_Link: leakRecord.prLink || null
    };
  }

  /**
   * Sends all individual leak records + verified blocked sites + the daily summary record
   * to the CRM API (including the new Deepblock Blocked Sites Registry `/api/crm/deepblock/blocked-sites`
   * and `/v1/deepblock/blocked-sites`) with exponential backoff retry and dead-letter queue persistence.
   */
  async reportRunResultsToCrm({ runId, leakRecords = [], scannedSites = [], summary = {}, commitRef = 'local' }) {
    await this._flushDlqIfAny();

    const formattedRecords = leakRecords.map((r) => this.formatLeakCrmPayload(r, commitRef));
    let syncedCount = 0;

    // 1. Report each leak record to CRM
    for (const payload of formattedRecords) {
      const ok = await this._sendSingleLeakPayload(runId, payload);
      if (ok) syncedCount += 1;
      else this._enqueueDlq({ type: 'leak_record', runId, payload });
    }

    // 2. Register all verified blocked & auto-patched sites into the CRM Deepblock Blocked Sites Registry
    const blockedRegistryBatch = this._buildBlockedRegistryBatch(scannedSites, leakRecords, commitRef);
    let registrySyncedCount = 0;
    if (blockedRegistryBatch.length > 0) {
      const regOk = await this.registerBlockedSitesBatch(blockedRegistryBatch);
      if (regOk) {
        registrySyncedCount = blockedRegistryBatch.length;
      } else {
        this._enqueueDlq({ type: 'blocked_sites_batch', runId, payload: { sites: blockedRegistryBatch } });
      }
    }

    // 3. Send Daily Summary Record to CRM
    const dailySummaryPayload = {
      Timestamp: new Date().toISOString(),
      Record_Type: 'Daily_Pipeline_Summary',
      Run_ID: runId,
      Target_URL: 'https://sweeprdeepblock.com/api/filters/delta',
      Ad_Type_Detected: 'Summary (Network / DOM / Script)',
      Generated_Rule: `${summary.rulesAutoPatched || 0} rules auto-patched across ${summary.sitesScanned || 0} sites`,
      Fix_Status:
        (summary.manualReviewCount || 0) > 0
          ? `Auto-Patched (${summary.rulesAutoPatched || 0}) / Manual Review (${summary.manualReviewCount})`
          : 'Auto-Patched',
      Commit_Hash: commitRef,
      Metrics: {
        sitesSampled: summary.sitesSampled || 0,
        sitesScanned: summary.sitesScanned || 0,
        leaksDetected: summary.leaksDetected || 0,
        rulesAutoPatched: summary.rulesAutoPatched || 0,
        manualReviewCount: summary.manualReviewCount || 0
      }
    };

    const summaryOk = await this._sendSummaryPayload(runId, dailySummaryPayload);
    if (!summaryOk) {
      this._enqueueDlq({ type: 'daily_summary', runId, payload: dailySummaryPayload });
    }

    return {
      totalRecords: formattedRecords.length,
      syncedCount,
      registrySyncedCount,
      summarySynced: summaryOk,
      samplePayloads: formattedRecords.slice(0, 5),
      dailySummaryPayload
    };
  }

  /**
   * Builds a normalized batch of site records for `/api/crm/deepblock/blocked-sites`
   * so the CRM records every site whose ads were verified blocked or auto-patched.
   */
  _buildBlockedRegistryBatch(scannedSites = [], leakRecords = [], commitRef = 'local') {
    const byDomain = new Map();

    for (const s of scannedSites) {
      if (!s || !s.domain) continue;
      const domain = String(s.domain).trim().toLowerCase().replace(/^www\./, '');
      const leaksFound = Array.isArray(s.leaks) ? s.leaks.length : Number(s.leaksFound || 0);
      byDomain.set(domain, {
        domain,
        target_url: s.targetUrl || `https://${domain}/`,
        category: s.category || 'general',
        status: leaksFound > 0 ? 'auto_patched' : 'clean',
        fix_status: leaksFound > 0 ? 'Auto-Patched' : 'Clean (No Leaks)',
        ad_types_blocked: leaksFound > 0 ? 'Network / DOM / Script' : 'MV3 Static DNR + Cosmetic Engine (0 Leaks)',
        generated_rules: 'Covered by Baseline MV3 Ruleset',
        rules_applied: 'Baseline MV3 DNR + Cosmetic Engine',
        rules_count: 1,
        leaks_found: leaksFound,
        leaks_patched: leaksFound,
        offending_artifacts: '',
        notes: `Verified by Headless Ad-Filter Scanner (${s.status || 'clean'})`,
        verification_notes: `Verified by Headless Ad-Filter Scanner (${s.status || 'clean'})`,
        commit_hash: commitRef,
        source: 'Ad-Filter Pipeline'
      });
    }

    for (const leak of leakRecords) {
      const domain = String(leak.domain || leak.targetUrl || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
      if (!domain) continue;
      const existing = byDomain.get(domain);
      const isPatched = leak.fixStatus === 'Auto-Patched';
      if (existing) {
        existing.status = isPatched ? 'auto_patched' : 'manual_review';
        existing.fix_status = leak.fixStatus || 'Auto-Patched';
        existing.ad_types_blocked = leak.adTypeDetected || existing.ad_types_blocked;
        const nextRules =
          existing.generated_rules && existing.generated_rules !== 'Covered by Baseline MV3 Ruleset'
            ? `${existing.generated_rules} | ${leak.generatedRule}`
            : leak.generatedRule;
        existing.generated_rules = nextRules;
        existing.rules_applied = nextRules;
        existing.rules_count = (existing.rules_count || 0) + 1;
        existing.leaks_patched = isPatched ? existing.leaks_found : 0;
        existing.offending_artifacts = existing.offending_artifacts
          ? `${existing.offending_artifacts}, ${leak.offendingArtifact || ''}`
          : String(leak.offendingArtifact || '');
        existing.notes = leak.verificationNotes || existing.notes;
        existing.verification_notes = leak.verificationNotes || existing.verification_notes;
        existing.commit_hash = leak.commitHash || commitRef;
      } else {
        byDomain.set(domain, {
          domain,
          target_url: leak.targetUrl || `https://${domain}/`,
          category: 'ad_heavy',
          status: isPatched ? 'auto_patched' : 'manual_review',
          fix_status: leak.fixStatus || 'Auto-Patched',
          ad_types_blocked: leak.adTypeDetected || 'Network / DOM',
          generated_rules: leak.generatedRule || '',
          rules_applied: leak.generatedRule || '',
          rules_count: 1,
          leaks_found: 1,
          leaks_patched: isPatched ? 1 : 0,
          offending_artifacts: leak.offendingArtifact || '',
          notes: leak.verificationNotes || 'Auto-patched by Daily Ad-Filter Pipeline',
          verification_notes: leak.verificationNotes || 'Auto-patched by Daily Ad-Filter Pipeline',
          commit_hash: leak.commitHash || commitRef,
          source: 'Ad-Filter Pipeline'
        });
      }
    }

    return Array.from(byDomain.values());
  }

  /**
   * Registers a batch of verified blocked sites in the CRM Deepblock Blocked Sites Registry
   * across Local SWEEPR CRM (:8787), Local Deepblock Server (:3000), and Production Railway CRM.
   */
  async registerBlockedSitesBatch(sites = []) {
    if (!Array.isArray(sites) || sites.length === 0) return true;
    const CHUNK_SIZE = 100;
    if (sites.length > CHUNK_SIZE) {
      let allOk = true;
      for (let i = 0; i < sites.length; i += CHUNK_SIZE) {
        const slice = sites.slice(i, i + CHUNK_SIZE);
        const ok = await this.registerBlockedSitesBatch(slice);
        if (!ok) allOk = false;
      }
      return allOk;
    }

    const body = { sites };
    const urls = [
      `${this.localCrmUrl}/v1/deepblock/blocked-sites`,
      `${this.localCrmUrl}/api/crm/deepblock/blocked-sites`,
      `http://localhost:8788/v1/deepblock/blocked-sites`,
      `http://localhost:3000/api/crm/deepblock/blocked-sites`,
      `${this.primaryCrmUrl}/v1/deepblock/blocked-sites`,
      `${this.primaryCrmUrl}/api/crm/deepblock/blocked-sites`
    ];
    const results = await Promise.all(urls.map((u) => this._postJsonWithRetry(u, body, 1)));
    return results.some(Boolean);
  }

  /**
   * Queries the CRM Deepblock Blocked Sites Registry to check if a site is already blocked.
   */
  async checkSiteBlocked(domainOrUrl) {
    const clean = String(domainOrUrl || '').trim();
    if (!clean) return { blocked: false, already_blocked: false, skip_scan: false };
    const urls = [
      `${this.localCrmUrl}/api/crm/deepblock/blocked-sites?domain=${encodeURIComponent(clean)}`,
      `http://localhost:8787/api/crm/deepblock/blocked-sites?domain=${encodeURIComponent(clean)}`,
      `http://localhost:3000/api/crm/deepblock/blocked-sites?domain=${encodeURIComponent(clean)}`,
      `${this.primaryCrmUrl}/v1/deepblock/blocked-sites?domain=${encodeURIComponent(clean)}`
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u, {
          headers: this._headers(),
          signal: AbortSignal.timeout(3500)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (typeof data.already_blocked === 'boolean' || typeof data.blocked === 'boolean')) {
            const isBlocked = Boolean(data.already_blocked ?? data.alreadyBlocked ?? data.skip_scan ?? data.blocked);
            return { ...data, blocked: isBlocked, already_blocked: isBlocked, skip_scan: isBlocked };
          }
        }
      } catch {}
    }
    return { blocked: false, already_blocked: false, skip_scan: false };
  }

  async _sendSingleLeakPayload(runId, payload) {
    const telemetryBody = {
      project_id: this.projectId,
      event_name: payload.Fix_Status === 'Auto-Patched' ? 'ad_filter_leak_patched' : 'ad_filter_manual_review',
      category: 'ad_filter_pipeline',
      os: 'headless_scanner',
      app_version: '1.1.5',
      properties: {
        run_id: runId,
        ...payload
      }
    };

    const outreachBody = {
      project_id: this.projectId,
      url: payload.Target_URL,
      website: (() => {
        try {
          return new URL(payload.Target_URL).hostname;
        } catch {
          return payload.Target_URL;
        }
      })(),
      who: `SWEEPR Ad-Filter Pipeline [${payload.Ad_Type_Detected}] — ${payload.Fix_Status}`,
      how: `Rule: ${payload.Generated_Rule} (${payload.Commit_Hash})`,
      category: `[AdFilterPipeline] ${payload.Ad_Type_Detected} -> ${payload.Generated_Rule} [${payload.Fix_Status}]`
    };

    const requests = [
      this._postJsonWithRetry(`${this.primaryCrmUrl}/v1/telemetry/event`, telemetryBody),
      this._postJsonWithRetry(`${this.primaryCrmUrl}/api/crm/outreach?project=deepblock`, outreachBody)
    ];

    if (this.customWebhookUrl) {
      requests.push(this._postJsonWithRetry(this.customWebhookUrl, payload));
    }

    const results = await Promise.all(requests);
    return results.some(Boolean);
  }

  async _sendSummaryPayload(runId, summaryPayload) {
    const telemetryBody = {
      project_id: this.projectId,
      event_name: 'ad_filter_daily_summary',
      category: 'ad_filter_pipeline',
      os: 'headless_scanner',
      app_version: '1.1.5',
      properties: summaryPayload
    };

    const requests = [this._postJsonWithRetry(`${this.primaryCrmUrl}/v1/telemetry/event`, telemetryBody)];
    if (this.customWebhookUrl) {
      requests.push(this._postJsonWithRetry(this.customWebhookUrl, summaryPayload));
    }
    const results = await Promise.all(requests);
    return results.some(Boolean);
  }

  async _postJsonWithRetry(url, bodyObj, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify(bodyObj),
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) return true;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) return false;
      } catch {}
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }
    return false;
  }

  _enqueueDlq(item) {
    try {
      let queue = [];
      if (fs.existsSync(CRM_DLQ_PATH)) {
        queue = JSON.parse(fs.readFileSync(CRM_DLQ_PATH, 'utf8'));
        if (!Array.isArray(queue)) queue = [];
      }
      queue.push({ ...item, queuedAt: new Date().toISOString() });
      if (queue.length > 500) queue = queue.slice(-500);
      fs.mkdirSync(path.dirname(CRM_DLQ_PATH), { recursive: true });
      fs.writeFileSync(CRM_DLQ_PATH, JSON.stringify(queue, null, 2), 'utf8');
    } catch {}
  }

  async _flushDlqIfAny() {
    if (!fs.existsSync(CRM_DLQ_PATH)) return;
    try {
      const queue = JSON.parse(fs.readFileSync(CRM_DLQ_PATH, 'utf8'));
      if (!Array.isArray(queue) || queue.length === 0) return;
      const remaining = [];
      for (const item of queue.slice(0, 25)) {
        const ok =
          item.type === 'daily_summary'
            ? await this._sendSummaryPayload(item.runId, item.payload)
            : item.type === 'blocked_sites_batch'
              ? await this.registerBlockedSitesBatch(item.payload?.sites || [])
              : await this._sendSingleLeakPayload(item.runId, item.payload);
        if (!ok) remaining.push(item);
      }
      fs.writeFileSync(CRM_DLQ_PATH, JSON.stringify([...remaining, ...queue.slice(25)], null, 2), 'utf8');
    } catch {}
  }
}
