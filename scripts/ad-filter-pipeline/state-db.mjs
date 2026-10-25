/**
 * SWEEPR DeepBlock — Ad-Filter Pipeline State & 30-Day Deduplication Database
 * Uses Node.js built-in `node:sqlite` (DatabaseSync) with WAL mode + JSON mirror fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const SQLITE_PATH = path.join(DATA_DIR, 'ad-filter-pipeline.sqlite');
export const JSON_STATE_PATH = path.join(ROOT_DIR, 'website', 'ad-filter-pipeline-state.json');
export const MANUAL_REVIEW_PATH = path.join(DATA_DIR, 'manual-review-queue.json');
export const CRM_DLQ_PATH = path.join(DATA_DIR, 'crm-dlq.json');

let DatabaseSync = null;
try {
  const sqliteMod = await import('node:sqlite');
  DatabaseSync = sqliteMod.DatabaseSync;
} catch {
  DatabaseSync = null;
}

export class PipelineStateDB {
  constructor(options = {}) {
    this.sqlitePath = options.sqlitePath || SQLITE_PATH;
    this.jsonStatePath = options.jsonStatePath || JSON_STATE_PATH;
    this.dedupWindowDays = Number(options.dedupWindowDays || 30);
    this.db = null;
    this.memoryState = {
      scannedDomains: {},
      recentRuns: [],
      detectedLeaks: []
    };
    this._init();
  }

  _init() {
    fs.mkdirSync(path.dirname(this.sqlitePath), { recursive: true });
    fs.mkdirSync(path.dirname(this.jsonStatePath), { recursive: true });

    if (fs.existsSync(this.jsonStatePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.jsonStatePath, 'utf8'));
        if (raw && typeof raw === 'object') {
          this.memoryState.scannedDomains = raw.scannedDomains || {};
          this.memoryState.recentRuns = Array.isArray(raw.recentRuns) ? raw.recentRuns : [];
          this.memoryState.detectedLeaks = Array.isArray(raw.detectedLeaks) ? raw.detectedLeaks : [];
        }
      } catch {}
    }

    if (DatabaseSync) {
      try {
        this.db = new DatabaseSync(this.sqlitePath);
        this.db.exec(`
          PRAGMA journal_mode = WAL;
          PRAGMA synchronous = NORMAL;

          CREATE TABLE IF NOT EXISTS scanned_domains (
            domain TEXT PRIMARY KEY,
            category TEXT NOT NULL DEFAULT 'general',
            last_scanned_at INTEGER NOT NULL,
            scan_count INTEGER NOT NULL DEFAULT 1,
            last_status TEXT NOT NULL DEFAULT 'clean',
            leaks_found INTEGER NOT NULL DEFAULT 0
          );

          CREATE INDEX IF NOT EXISTS idx_scanned_domains_last_scanned
            ON scanned_domains(last_scanned_at);

          CREATE TABLE IF NOT EXISTS detected_leaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            target_url TEXT NOT NULL,
            domain TEXT NOT NULL,
            ad_type_detected TEXT NOT NULL,
            offending_artifact TEXT NOT NULL,
            generated_rule TEXT NOT NULL,
            dnr_rule_json TEXT,
            fix_status TEXT NOT NULL,
            verification_notes TEXT,
            commit_hash TEXT,
            crm_synced INTEGER NOT NULL DEFAULT 0
          );

          CREATE INDEX IF NOT EXISTS idx_detected_leaks_run_id
            ON detected_leaks(run_id);

          CREATE TABLE IF NOT EXISTS pipeline_runs (
            run_id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            sites_sampled INTEGER NOT NULL DEFAULT 0,
            sites_scanned INTEGER NOT NULL DEFAULT 0,
            leaks_detected INTEGER NOT NULL DEFAULT 0,
            rules_auto_patched INTEGER NOT NULL DEFAULT 0,
            manual_review_count INTEGER NOT NULL DEFAULT 0,
            commit_hash TEXT,
            crm_synced INTEGER NOT NULL DEFAULT 0
          );
        `);
      } catch (err) {
        console.warn('[StateDB] SQLite init fallback to JSON state:', err.message);
        this.db = null;
      }
    }
  }

  /**
   * Returns a Set of domains scanned within the last `dedupWindowDays` (default 30 days).
   */
  getRecentlyScannedDomains(windowDays = this.dedupWindowDays) {
    const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recent = new Set();

    if (this.db) {
      try {
        const stmt = this.db.prepare('SELECT domain FROM scanned_domains WHERE last_scanned_at >= ?');
        const rows = stmt.all(cutoffMs);
        for (const r of rows) {
          if (r && r.domain) recent.add(String(r.domain).toLowerCase());
        }
      } catch {}
    }

    for (const [domain, meta] of Object.entries(this.memoryState.scannedDomains)) {
      const ts = typeof meta === 'number' ? meta : Number(meta?.lastScannedAt || 0);
      if (ts >= cutoffMs) {
        recent.add(domain.toLowerCase());
      }
    }

    return recent;
  }

  /**
   * Marks a batch of domains as scanned at the current timestamp.
   */
  recordScannedDomains(entries = []) {
    const now = Date.now();
    if (this.db) {
      try {
        const upsert = this.db.prepare(`
          INSERT INTO scanned_domains (domain, category, last_scanned_at, scan_count, last_status, leaks_found)
          VALUES (?, ?, ?, 1, ?, ?)
          ON CONFLICT(domain) DO UPDATE SET
            category = excluded.category,
            last_scanned_at = excluded.last_scanned_at,
            scan_count = scanned_domains.scan_count + 1,
            last_status = excluded.last_status,
            leaks_found = scanned_domains.leaks_found + excluded.leaks_found
        `);
        this.db.exec('BEGIN TRANSACTION');
        try {
          for (const item of entries) {
            const domain = String(item.domain || '').trim().toLowerCase();
            if (!domain) continue;
            upsert.run(
              domain,
              String(item.category || 'general'),
              now,
              String(item.status || 'clean'),
              Number(item.leaksFound || 0)
            );
          }
          this.db.exec('COMMIT');
        } catch (txErr) {
          this.db.exec('ROLLBACK');
          throw txErr;
        }
      } catch (err) {
        console.warn('[StateDB] SQLite batch domain write warning:', err.message);
      }
    }

    for (const item of entries) {
      const domain = String(item.domain || '').trim().toLowerCase();
      if (!domain) continue;
      const prev = this.memoryState.scannedDomains[domain] || {};
      this.memoryState.scannedDomains[domain] = {
        category: item.category || prev.category || 'general',
        lastScannedAt: now,
        scanCount: (Number(prev.scanCount) || 0) + 1,
        lastStatus: item.status || 'clean',
        leaksFound: (Number(prev.leaksFound) || 0) + (Number(item.leaksFound) || 0)
      };
    }

    this._pruneAndFlushJson(now);
  }

  /**
   * Records a detected ad leak and its rule generation / verification outcome.
   */
  recordLeak(leak) {
    const entry = {
      run_id: String(leak.runId || 'manual'),
      timestamp: leak.timestamp || new Date().toISOString(),
      target_url: String(leak.targetUrl || ''),
      domain: String(leak.domain || ''),
      ad_type_detected: String(leak.adTypeDetected || 'DOM'),
      offending_artifact: String(leak.offendingArtifact || ''),
      generated_rule: String(leak.generatedRule || ''),
      dnr_rule_json: leak.dnrRule ? JSON.stringify(leak.dnrRule) : null,
      fix_status: String(leak.fixStatus || 'Auto-Patched'),
      verification_notes: String(leak.verificationNotes || ''),
      commit_hash: String(leak.commitHash || 'pending'),
      crm_synced: leak.crmSynced ? 1 : 0
    };

    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO detected_leaks (
            run_id, timestamp, target_url, domain, ad_type_detected,
            offending_artifact, generated_rule, dnr_rule_json, fix_status,
            verification_notes, commit_hash, crm_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          entry.run_id,
          entry.timestamp,
          entry.target_url,
          entry.domain,
          entry.ad_type_detected,
          entry.offending_artifact,
          entry.generated_rule,
          entry.dnr_rule_json,
          entry.fix_status,
          entry.verification_notes,
          entry.commit_hash,
          entry.crm_synced
        );
      } catch (err) {
        console.warn('[StateDB] SQLite leak write warning:', err.message);
      }
    }

    this.memoryState.detectedLeaks.unshift(entry);
    if (this.memoryState.detectedLeaks.length > 500) {
      this.memoryState.detectedLeaks.length = 500;
    }

    if (entry.fix_status !== 'Auto-Patched') {
      this._appendManualReviewQueue(entry);
    }
  }

  recordRunSummary(summary) {
    const row = {
      run_id: String(summary.runId),
      started_at: String(summary.startedAt),
      completed_at: String(summary.completedAt || new Date().toISOString()),
      sites_sampled: Number(summary.sitesSampled || 0),
      sites_scanned: Number(summary.sitesScanned || 0),
      leaks_detected: Number(summary.leaksDetected || 0),
      rules_auto_patched: Number(summary.rulesAutoPatched || 0),
      manual_review_count: Number(summary.manualReviewCount || 0),
      commit_hash: String(summary.commitHash || 'none'),
      crm_synced: summary.crmSynced ? 1 : 0
    };

    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO pipeline_runs (
            run_id, started_at, completed_at, sites_sampled, sites_scanned,
            leaks_detected, rules_auto_patched, manual_review_count, commit_hash, crm_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          row.run_id,
          row.started_at,
          row.completed_at,
          row.sites_sampled,
          row.sites_scanned,
          row.leaks_detected,
          row.rules_auto_patched,
          row.manual_review_count,
          row.commit_hash,
          row.crm_synced
        );
      } catch (err) {
        console.warn('[StateDB] SQLite run summary warning:', err.message);
      }
    }

    this.memoryState.recentRuns.unshift(row);
    if (this.memoryState.recentRuns.length > 60) {
      this.memoryState.recentRuns.length = 60;
    }
    this._pruneAndFlushJson(Date.now());
  }

  updateRunCommitHash(runId, commitHash) {
    if (this.db) {
      try {
        this.db.prepare('UPDATE detected_leaks SET commit_hash = ? WHERE run_id = ?').run(commitHash, runId);
        this.db.prepare('UPDATE pipeline_runs SET commit_hash = ? WHERE run_id = ?').run(commitHash, runId);
      } catch {}
    }
    for (const leak of this.memoryState.detectedLeaks) {
      if (leak.run_id === runId) leak.commit_hash = commitHash;
    }
    for (const run of this.memoryState.recentRuns) {
      if (run.run_id === runId) run.commit_hash = commitHash;
    }
    this._pruneAndFlushJson(Date.now());
  }

  _appendManualReviewQueue(entry) {
    let queue = [];
    if (fs.existsSync(MANUAL_REVIEW_PATH)) {
      try {
        queue = JSON.parse(fs.readFileSync(MANUAL_REVIEW_PATH, 'utf8'));
        if (!Array.isArray(queue)) queue = [];
      } catch {
        queue = [];
      }
    }
    queue.unshift(entry);
    if (queue.length > 500) queue.length = 500;
    fs.writeFileSync(MANUAL_REVIEW_PATH, JSON.stringify(queue, null, 2), 'utf8');
  }

  _pruneAndFlushJson(nowMs) {
    const retentionMs = (this.dedupWindowDays + 5) * 24 * 60 * 60 * 1000;
    const cutoff = nowMs - retentionMs;

    if (this.db) {
      try {
        this.db.prepare('DELETE FROM scanned_domains WHERE last_scanned_at < ?').run(cutoff);
      } catch {}
    }

    for (const [domain, meta] of Object.entries(this.memoryState.scannedDomains)) {
      const ts = typeof meta === 'number' ? meta : Number(meta?.lastScannedAt || 0);
      if (ts < cutoff) {
        delete this.memoryState.scannedDomains[domain];
      }
    }

    try {
      fs.writeFileSync(
        this.jsonStatePath,
        JSON.stringify(
          {
            updatedAt: new Date(nowMs).toISOString(),
            dedupWindowDays: this.dedupWindowDays,
            totalTrackedDomains: Object.keys(this.memoryState.scannedDomains).length,
            recentRuns: this.memoryState.recentRuns,
            detectedLeaks: this.memoryState.detectedLeaks.slice(0, 100),
            scannedDomains: this.memoryState.scannedDomains
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {}
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
  }
}
