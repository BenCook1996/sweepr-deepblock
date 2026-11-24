import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import {
  CANONICAL_ORIGIN,
  ROOT,
  WEBSITE_DIR,
  decodeXmlEntities,
  parseSitemapUrls,
  runConcurrent,
  startEphemeralServer
} from './e2e-helpers.mjs';

const STORE_OR_IOS_REDIRECT_PATHS = new Set(['/chrome', '/cws', '/firefox', '/amo']);

function runChildProcess(args, { timeoutMs = 60000, envOverrides = {} } = {}) {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, ...envOverrides };
    delete childEnv.NODE_TEST_CONTEXT;
    const proc = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGTERM');
      } catch {}
      if (process.platform === 'win32' && proc.pid) {
        try {
          execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {}
      }
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut, stdout, stderr });
    });
  });
}

function extractTagReferences(html, pagePath) {
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  const refs = [];

  const pushRef = (rawVal, kind) => {
    if (!rawVal) return;
    const val = decodeXmlEntities(rawVal.trim());
    if (!val || val.startsWith('#')) return;
    if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(val)) return;

    let resolved;
    try {
      resolved = new URL(val, `${CANONICAL_ORIGIN}${pagePath}`);
    } catch {
      refs.push({ kind, raw: val, invalidUrl: true });
      return;
    }

    if (resolved.origin !== CANONICAL_ORIGIN) return; // external link
    if (resolved.pathname.startsWith('/api/')) return; // runtime API endpoint

    const localTarget = resolved.pathname + resolved.search;
    refs.push({ kind, raw: val, target: localTarget, pathname: resolved.pathname });
  };

  // <a href=...> (quoted or unquoted, excluding data-href= etc.)
  for (const m of cleanHtml.matchAll(/<a\b[^>]*(?<![-\w])href=(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/gi)) {
    pushRef(m[1] ?? m[2] ?? m[3], 'link');
  }

  // <link rel="..." href="..."> (skip canonical, alternate, preconnect, dns-prefetch)
  for (const m of cleanHtml.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = m[1];
    const relMatch = attrs.match(/(?<![-\w])rel=(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const hrefMatch = attrs.match(/(?<![-\w])href=(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    if (!hrefMatch) continue;
    const rel = ((relMatch && (relMatch[1] ?? relMatch[2] ?? relMatch[3])) || '').toLowerCase();
    if (/\b(canonical|alternate|preconnect|dns-prefetch)\b/.test(rel)) continue;
    pushRef(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3], 'asset');
  }

  // <script src=...>
  for (const m of cleanHtml.matchAll(/<script\b[^>]*(?<![-\w])src=(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/gi)) {
    pushRef(m[1] ?? m[2] ?? m[3], 'asset');
  }

  // <img src=...>
  for (const m of cleanHtml.matchAll(/<img\b[^>]*(?<![-\w])src=(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/gi)) {
    pushRef(m[1] ?? m[2] ?? m[3], 'asset');
  }

  return refs;
}

let srv;

before(async () => {
  srv = await startEphemeralServer();
});

after(async () => {
  if (srv) await srv.stop();
});

test('Tier 3A: All internal links and local CSS/JS/image assets across active sitemap pages resolve without 404/5xx or empty bodies', async () => {
  const mainPaths = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml')).paths;
  const sitePaths = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml')).paths;
  const activePages = [...new Set([...mainPaths, ...sitePaths])];

  const targetRegistry = new Map(); // key: `${kind}:${target}` -> { kind, target, pathname, sources: Set }
  const invalidUrls = [];

  await runConcurrent(activePages, 16, async (pagePath) => {
    const res = await fetch(`${srv.baseUrl}${pagePath}`, { redirect: 'manual' });
    if (res.status !== 200) return;
    const html = await res.text();
    const refs = extractTagReferences(html, pagePath);
    for (const ref of refs) {
      if (ref.invalidUrl) {
        invalidUrls.push(`${pagePath} -> invalid URL "${ref.raw}"`);
        continue;
      }
      const key = `${ref.kind}:${ref.target}`;
      if (!targetRegistry.has(key)) {
        targetRegistry.set(key, {
          kind: ref.kind,
          target: ref.target,
          pathname: ref.pathname,
          sources: new Set()
        });
      }
      targetRegistry.get(key).sources.add(pagePath);
    }
  });

  assert.equal(invalidUrls.length, 0, `Malformed URLs found:\n  - ${invalidUrls.join('\n  - ')}`);

  const failures = [];
  const targets = [...targetRegistry.values()];

  await runConcurrent(targets, 20, async (item) => {
    const sampleSources = [...item.sources].slice(0, 3).join(', ');
    const isStoreRedirect =
      item.pathname === '/download' && item.target.includes('?')
        ? true
        : STORE_OR_IOS_REDIRECT_PATHS.has(item.pathname);

    if (item.kind === 'asset') {
      const res = await fetch(`${srv.baseUrl}${item.target}`, { redirect: 'manual' });
      if (res.status !== 200) {
        failures.push(`[ASSET ${res.status}] ${item.target} (referenced by ${sampleSources})`);
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0) {
        failures.push(`[ASSET EMPTY] ${item.target} (referenced by ${sampleSources})`);
      }
      return;
    }

    // Internal <a href> link
    const res = await fetch(`${srv.baseUrl}${item.target}`, { redirect: 'manual' });
    if (isStoreRedirect) {
      if (res.status !== 200 && res.status !== 302) {
        failures.push(`[LINK ${res.status}] ${item.target} (expected 200/302 store redirect; from ${sampleSources})`);
      }
      return;
    }

    if (res.status === 301 || res.status === 302) {
      await res.body?.cancel().catch(() => {});
      const loc = (res.headers.get('location') || '').trim();
      if (!loc) {
        failures.push(`[BROKEN REDIRECT ${res.status}] ${item.target}: missing/empty Location header (from ${sampleSources})`);
        return;
      }
      let dest;
      try {
        dest = new URL(loc, srv.baseUrl);
      } catch {
        failures.push(
          `[BROKEN REDIRECT ${res.status}] ${item.target}: invalid Location "${loc}" (from ${sampleSources})`
        );
        return;
      }
      if (dest.origin !== srv.baseUrl && dest.origin !== CANONICAL_ORIGIN) {
        failures.push(
          `[OFF-ORIGIN REDIRECT ${res.status}] ${item.target} -> ${loc} (from ${sampleSources})`
        );
        return;
      }
      const localFetchUrl = `${srv.baseUrl}${dest.pathname}${dest.search}`;
      const destRes = await fetch(localFetchUrl, { redirect: 'manual' });
      await destRes.body?.cancel().catch(() => {});
      if (destRes.status !== 200) {
        failures.push(
          `[BROKEN REDIRECT ${res.status}->${destRes.status}] ${item.target} -> ${dest.pathname} (from ${sampleSources})`
        );
      }
      return;
    }

    if (res.status !== 200) {
      failures.push(`[BROKEN LINK ${res.status}] ${item.target} (referenced by ${sampleSources})`);
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length} broken internal link/asset(s) across ${targets.length} unique targets:\n  - ${failures
      .slice(0, 40)
      .join('\n  - ')}${failures.length > 40 ? `\n  ... and ${failures.length - 40} more` : ''}`
  );
});

test('Tier 3B: Existing unit & security suites (extension-fixes & security-20-pentest) pass with exit code 0', async () => {
  const res = await runChildProcess(
    ['--test', 'tests/extension-fixes.test.mjs', 'tests/security-20-pentest.test.mjs'],
    { timeoutMs: 180000, envOverrides: { STRIPE_SECRET_KEY: '' } }
  );
  assert.equal(res.timedOut, false, `Existing test suite timed out after 180s.\n${res.stdout}\n${res.stderr}`);
  assert.equal(
    res.code,
    0,
    `Existing test suite exited with code ${res.code}:\n${res.stdout}\n${res.stderr}`
  );
});

test('Tier 3C: Read-only scripts/technical-seo-audit.mjs completes within 300s with exit code 0', async () => {
  const res = await runChildProcess(['scripts/technical-seo-audit.mjs'], { timeoutMs: 300000 });
  assert.equal(
    res.timedOut,
    false,
    `scripts/technical-seo-audit.mjs stalled and timed out after 300000ms (last output: ${res.stdout.slice(-400)})`
  );
  const summaryIdx = res.stdout.indexOf('=== AUDIT SUMMARY ===');
  const diag = summaryIdx >= 0 ? res.stdout.slice(summaryIdx, summaryIdx + 1600) : res.stdout.slice(-1200);
  assert.equal(
    res.code,
    0,
    `scripts/technical-seo-audit.mjs exited with code ${res.code}:\n${diag}\n${res.stderr.slice(-600)}`
  );
});
