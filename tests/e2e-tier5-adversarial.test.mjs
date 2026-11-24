import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import {
  CANONICAL_ORIGIN,
  M1_DEFAULT_CUT_LIST_94_PATH,
  ROOT,
  WEBSITE_DIR,
  decodeXmlEntities,
  extractCanonical,
  extractMetaRobots,
  extractVisibleText,
  launchHeadlessBrowser,
  parseRobotsTxt,
  parseSitemapIndex,
  parseSitemapUrls,
  readDynamicDeltaVersion,
  readExtensionManifest,
  removeDirSafe,
  resolveCutList94,
  runConcurrent,
  startEphemeralServer
} from './e2e-helpers.mjs';

import {
  ALL_INDEXABLE_SET,
  CONSOLIDATE_301_MAP,
  NOINDEX_PRUNE_PATHS,
  isNoIndexPrunePath
} from '../scripts/lib/m1-decisions.mjs';

const execFileAsync = promisify(execFile);

async function fetchWithRetry(url, opts = {}, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  throw lastErr;
}

const DEFAULT_URL_AUDIT_279_PATH = path.resolve(
  ROOT,
  '..',
  '..',
  '..',
  '.gemini',
  'antigravity',
  'brain',
  'e2144c4b-c077-4a53-85ee-75d6b49eb0e2',
  'scratch',
  '.agents',
  'teamwork',
  'worker_remediate_m1_iter4',
  'URL_AUDIT_279.json'
);

const KNOWN_URL_AUDIT_279_FALLBACK =
  'C:\\Users\\Benjamin\\.gemini\\antigravity\\brain\\e2144c4b-c077-4a53-85ee-75d6b49eb0e2\\scratch\\.agents\\teamwork\\worker_remediate_m1_iter4\\URL_AUDIT_279.json';

function resolveUrlAudit279() {
  const candidates = [
    process.env.URL_AUDIT_279_PATH,
    DEFAULT_URL_AUDIT_279_PATH,
    KNOWN_URL_AUDIT_279_FALLBACK
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { path: c, data: JSON.parse(fs.readFileSync(c, 'utf8')) };
    }
  }
  return null;
}

function listAllWebsiteHtmlRelPaths(rootDir = WEBSITE_DIR) {
  const out = [];
  function walk(dir, relPrefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(rel.replace(/\\/g, '/'));
      }
    }
  }
  walk(rootDir);
  return out.sort();
}

function relPathToUrlPath(relPath) {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (norm === 'index.html') return '/';
  if (norm.endsWith('/index.html')) return '/' + norm.slice(0, -'/index.html'.length);
  if (norm.endsWith('.html')) return '/' + norm.slice(0, -'.html'.length);
  return '/' + norm;
}

function resolveUrlPathToHtmlFile(urlPath, websiteDir = WEBSITE_DIR) {
  const clean = String(urlPath || '/').split('?')[0].split('#')[0];
  if (clean === '/') return path.join(websiteDir, 'index.html');
  const trimmed = clean.replace(/^\/+/, '').replace(/\/+$/, '');
  const asFile = path.join(websiteDir, `${trimmed}.html`);
  if (fs.existsSync(asFile)) return asFile;
  const asIndex = path.join(websiteDir, trimmed, 'index.html');
  if (fs.existsSync(asIndex)) return asIndex;
  return null;
}

function extractMainText(html) {
  const raw = String(html || '');
  const mainMatch = raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  let scope = mainMatch ? mainMatch[1] : null;
  if (!scope) {
    const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    scope = bodyMatch ? bodyMatch[1] : raw;
  }
  const stripped = scope
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ');
  return decodeXmlEntities(stripped.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function fiveGramShingles(text) {
  const normalizedWords = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const shingles = new Set();
  if (normalizedWords.length < 5) return shingles;
  for (let i = 0; i <= normalizedWords.length - 5; i += 1) {
    shingles.add(normalizedWords.slice(i, i + 5).join(' '));
  }
  return shingles;
}

function fiveGramJaccard(shinglesA, shinglesB) {
  const setA = shinglesA instanceof Set ? shinglesA : fiveGramShingles(shinglesA);
  const setB = shinglesB instanceof Set ? shinglesB : fiveGramShingles(shinglesB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function computeGroupJaccardStats(items) {
  if (!Array.isArray(items) || items.length < 2) {
    return { avg: 0, max: 0, maxPair: null, pairCount: 0 };
  }
  const prepared = items.map((item, idx) => ({
    id: item.relPath || item.urlPath || String(idx),
    shingles: fiveGramShingles(extractMainText(item.html))
  }));
  let sum = 0;
  let pairCount = 0;
  let max = 0;
  let maxPair = null;
  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      const score = fiveGramJaccard(prepared[i].shingles, prepared[j].shingles);
      sum += score;
      pairCount += 1;
      if (score >= max) {
        max = score;
        maxPair = [prepared[i].id, prepared[j].id];
      }
    }
  }
  return { avg: pairCount ? sum / pairCount : 0, max, maxPair, pairCount };
}

function validateDisavowFile(filePath) {
  const errors = [];
  const rawBuffer = fs.readFileSync(filePath);
  const sizeBytes = rawBuffer.length;
  if (sizeBytes > 2 * 1024 * 1024) {
    errors.push(`File size ${sizeBytes} bytes exceeds 2MB limit`);
  }
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(rawBuffer);
  } catch (err) {
    errors.push(`Invalid UTF-8 encoding: ${err.message}`);
    return { valid: false, sizeBytes, lineCount: 0, directives: [], domains: [], errors };
  }
  if (text.startsWith('\uFEFF')) errors.push('Contains UTF-8 BOM');
  if (/\r/.test(text)) errors.push('Contains CR/CRLF line endings');

  const lines = text.split('\n');
  const effectiveLines = lines.length > 0 && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
  const lineCount = effectiveLines.length;
  if (lineCount > 100000) errors.push(`Line count ${lineCount} exceeds 100,000 limit`);

  const directives = [];
  const domains = [];
  const domainRe = /^domain:[a-z0-9.-]+\.[a-z]{2,}$/;
  const urlRe = /^https?:\/\/\S+$/;

  effectiveLines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (/[ \t]+$/.test(line)) errors.push(`Line ${lineNo} has trailing whitespace`);
    if (line.trim() === '' || line.startsWith('#')) return;
    if (/\*/.test(line)) errors.push(`Line ${lineNo} contains wildcard`);
    if (domainRe.test(line)) {
      directives.push(line);
      domains.push(line.slice('domain:'.length));
    } else if (urlRe.test(line)) {
      directives.push(line);
    } else {
      errors.push(`Line ${lineNo} invalid disavow directive: ${line}`);
    }
  });
  return { valid: errors.length === 0, sizeBytes, lineCount, directives, domains, errors };
}

async function rawWireHttpRequest(port, rawRequestTarget, headers = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const chunks = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`rawWireHttpRequest timeout on ${rawRequestTarget}`));
    }, 8000);

    socket.on('connect', () => {
      const headerLines = [
        `GET ${rawRequestTarget} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        'Connection: close',
        ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)
      ];
      socket.write(headerLines.join('\r\n') + '\r\n\r\n');
    });
    socket.on('data', (d) => chunks.push(d));
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on('end', () => {
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString('utf8');
      const idx = raw.indexOf('\r\n\r\n');
      const head = idx >= 0 ? raw.slice(0, idx) : raw;
      const body = idx >= 0 ? raw.slice(idx + 4) : '';
      const headLines = head.split('\r\n');
      const statusMatch = (headLines[0] || '').match(/^HTTP\/\d\.\d\s+(\d{3})/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      const hdrs = {};
      for (const hl of headLines.slice(1)) {
        const col = hl.indexOf(':');
        if (col > 0) {
          hdrs[hl.slice(0, col).trim().toLowerCase()] = hl.slice(col + 1).trim();
        }
      }
      resolve({ status, headers: hdrs, body });
    });
  });
}

function createRepoSandboxCopy() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-t5-sandbox-'));
  const dirsToCopy = ['website', 'scripts', 'extension', 'data', 'dist'];
  const filesToCopy = ['package.json', 'server.js'];
  for (const d of dirsToCopy) {
    const src = path.join(ROOT, d);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(tmpRoot, d), { recursive: true });
    }
  }
  for (const f of filesToCopy) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tmpRoot, f));
    }
  }
  // Remove any sensitive files if accidentally inside data/
  for (const secretName of ['.env', '.gcp-service-account.json']) {
    const sp = path.join(tmpRoot, secretName);
    if (fs.existsSync(sp)) fs.rmSync(sp, { force: true });
  }
  return tmpRoot;
}

async function runNodeScriptInDir(cwdDir, scriptRel, args = [], { blockNetworkFetch = false } = {}) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const k of Object.keys(env)) {
    if (/^(GOOGLE_|GCP_|GSC_|GA4_|CRM_|SWEEPR_CRM|SWEEPR_RAILWAY|STRIPE_|DEEPBLOCK_STRIPE_|ADMIN_|DATAFORSEO)/i.test(k)) {
      env[k] = '';
    }
  }
  Object.assign(env, {
    NODE_ENV: 'test',
    SESSION_SECRET: 'e2e-tier5-sandbox-secret',
    DATA_DIR: path.join(cwdDir, 'data'),
    SWEEPR_CRM_URL: 'http://127.0.0.1:1'
  });

  const nodeArgs = [];
  let blockerFile = null;
  if (blockNetworkFetch) {
    blockerFile = path.join(cwdDir, `.fetch-blocker-${process.pid}-${Date.now()}.mjs`);
    fs.writeFileSync(
      blockerFile,
      `
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  throw new Error('Unexpected outbound fetch in Tier-5 sandbox: ' + url);
};
`,
      'utf8'
    );
    nodeArgs.push('--import', pathToFileURL(blockerFile).href);
  }
  nodeArgs.push(scriptRel, ...args);

  try {
    const res = await execFileAsync(process.execPath, nodeArgs, {
      cwd: cwdDir,
      env,
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024
    });
    return { code: 0, stdout: res.stdout, stderr: res.stderr };
  } catch (err) {
    const signalInfo =
      err.killed || err.signal ? ` [killed=${Boolean(err.killed)}, signal=${err.signal || 'none'}]` : '';
    return {
      code: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout || '',
      stderr: (err.stderr || err.message || '') + signalInfo
    };
  } finally {
    if (blockerFile && fs.existsSync(blockerFile)) {
      fs.rmSync(blockerFile, { force: true });
    }
  }
}

let server = null;
let browser = null;

before(async () => {
  server = await startEphemeralServer({ timeoutMs: 20000 });
  browser = await launchHeadlessBrowser({ timeoutMs: 30000 });
});

after(async () => {
  try {
    if (browser) {
      await browser.close().catch(() => {});
    }
  } finally {
    try {
      if (server) {
        await server.stop().catch(() => {});
      }
    } finally {
      try {
        if (browser?.userDataDir && fs.existsSync(browser.userDataDir)) {
          await removeDirSafe(browser.userDataDir, 20, 300);
        }
      } catch {}
    }
  }
});

// ============================================================================
// T5-01: Expanded Non-Sitemap Interactive, Checkout & Auth Routes (Headless Chrome)
// ============================================================================
describe('T5-01: Expanded non-sitemap interactive routes & CSP audit', { concurrency: 1 }, () => {
  const NON_SITEMAP_ROUTES = [
    '/test-lab',
    '/login',
    '/order',
    '/order?plan=annual',
    '/order?plan=suite_annual',
    '/order?country=US',
    '/benchmarks',
    '/privacy',
    '/terms',
    '/refund',
    '/support',
    '/tools',
    '/tools/browser-ram-calculator',
    '/site/bbcgoodfood-com'
  ];

  test('T5-01.1 All expanded non-sitemap routes render at desktop (1440x900) and mobile (390x844) with 0 console/CSP/network errors and 0 horizontal overflow', async () => {
    const viewports = [
      { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
    ];
    for (const vp of viewports) {
      for (const route of NON_SITEMAP_ROUTES) {
        const page = await browser.newPage();
        try {
          await page.setViewport(vp);
          const audit = await page.navigateAndAudit(`${server.baseUrl}${route}`, server.baseUrl);
          assert.equal(audit.consoleErrors.length, 0, `${route} (${vp.name}) consoleErrors: ${JSON.stringify(audit.consoleErrors)}`);
          assert.equal(audit.pageExceptions.length, 0, `${route} (${vp.name}) pageExceptions: ${JSON.stringify(audit.pageExceptions)}`);
          assert.equal(audit.logErrors.length, 0, `${route} (${vp.name}) logErrors: ${JSON.stringify(audit.logErrors)}`);
          assert.equal(audit.sameOriginBadResponses.length, 0, `${route} (${vp.name}) badResponses: ${JSON.stringify(audit.sameOriginBadResponses)}`);
          assert.equal(audit.sameOriginFailures.length, 0, `${route} (${vp.name}) failures: ${JSON.stringify(audit.sameOriginFailures)}`);

          const dom = await page.evaluate(`(() => {
            const overflow = document.documentElement.scrollWidth - window.innerWidth;
            const nav = document.querySelector('.glass-nav');
            const h1 = document.querySelector('h1');
            let h1UnderNav = false;
            if (nav && h1) {
              const nr = nav.getBoundingClientRect();
              const hr = h1.getBoundingClientRect();
              if (nr.height > 0 && hr.height > 0 && hr.top < nr.bottom - 1) {
                h1UnderNav = true;
              }
            }
            const navBrand = document.querySelector('.glass-nav a[href="/"] span');
            const navBrandClipped = navBrand ? (navBrand.scrollWidth > navBrand.clientWidth + 1) : false;
            const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.getAttribute('href') || '');
            return { overflow, h1UnderNav, navBrandClipped, cssLinks };
          })()`);
          assert.ok(dom.overflow <= 2, `${route} (${vp.name}) horizontal overflow: ${dom.overflow}px`);
          assert.equal(dom.h1UnderNav, false, `${route} (${vp.name}) h1 overlaps .glass-nav`);
          assert.equal(dom.navBrandClipped, false, `${route} (${vp.name}) brand text clipped in .glass-nav`);
          assert.equal(
            dom.cssLinks.some((h) => h.includes('/sweepr-ui.css')),
            false,
            `${route} (${vp.name}) still references deprecated /sweepr-ui.css`
          );
        } finally {
          await page.close();
        }
      }
    }
  });

  test('T5-01.2 /test-lab executes runAllFieldTests() cleanly with 0 CSP/console errors', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const audit = await page.navigateAndAudit(`${server.baseUrl}/test-lab`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0, `Initial /test-lab consoleErrors: ${JSON.stringify(audit.consoleErrors)}`);
      assert.equal(audit.logErrors.length, 0, `Initial /test-lab logErrors: ${JSON.stringify(audit.logErrors)}`);

      const res = await page.evaluate(`(async () => {
        if (typeof window.runAllFieldTests !== 'function') return { hasFn: false };
        let cspCount = 0;
        const onCsp = () => { cspCount += 1; };
        document.addEventListener('securitypolicyviolation', onCsp);
        try {
          await window.runAllFieldTests();
          await new Promise(r => setTimeout(r, 350));
          const passCount = document.getElementById('passCount')?.textContent?.trim() || '';
          const scoreBadge = document.getElementById('scorePercentBadge')?.textContent?.trim() || '';
          const cardCount = document.querySelectorAll('#testGrid > div').length;
          return { hasFn: true, passCount, scoreBadge, cardCount, cspCount };
        } finally {
          document.removeEventListener('securitypolicyviolation', onCsp);
        }
      })()`);
      assert.equal(res.hasFn, true, 'window.runAllFieldTests must exist on /test-lab');
      assert.equal(res.cspCount, 0, `Post-run /test-lab CSP violations: ${res.cspCount}`);
      assert.equal(res.cardCount, 8, `Expected 8 test cards in #testGrid, got ${res.cardCount}`);
      assert.match(res.passCount, /^\d+\s*\/\s*8$/, `Expected settled #passCount, got "${res.passCount}"`);
      assert.match(res.scoreBadge, /^\d+\s*\/\s*100$/, `Expected settled #scorePercentBadge, got "${res.scoreBadge}"`);
    } finally {
      await page.close();
    }
  });

  test('T5-01.3 /login uses deferred /metrics/js, Holographic Pearl shell, Live Test Lab copy, and devices_max || 5', () => {
    const loginHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'login.html'), 'utf8');
    assert.equal(/googletagmanager\.com\/gtag\/js/i.test(loginHtml), false, '/login must proxy via /metrics/js instead of direct GTM URL');
    assert.equal(/8\/8\s+Live\s+Test\s+Lab/i.test(loginHtml), false, '/login must not hardcode 8/8 Live Test Lab');
    assert.equal(/devices_max\s*\|\|\s*4\b/.test(loginHtml), false, '/login must not fall back to 4 devices');
    assert.match(loginHtml, /devices_max\s*\|\|\s*5\b/, '/login should fall back to 5 devices');
    assert.match(loginHtml, /\/sweepr-tailwind\.min\.css/, '/login must load /sweepr-tailwind.min.css');
  });

  test('T5-01.4 /order has non-blocking Stripe script tag, /sweepr-tailwind.min.css, and /checkout/success + /pair return 200', async () => {
    const orderHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'order.html'), 'utf8');
    assert.equal(
      /<head[\s\S]*?<script\b[^>]*src=["']https:\/\/js\.stripe\.com\/v3\/["'][^>]*>[\s\S]*?<\/head>/i.test(orderHtml),
      false,
      '/order <head> must not contain render-blocking js.stripe.com/v3/ script'
    );
    assert.match(orderHtml, /\/sweepr-tailwind\.min\.css/, '/order must load /sweepr-tailwind.min.css');

    for (const p of ['/checkout/success?session_id=test_t5', '/pair']) {
      const r = await fetch(`${server.baseUrl}${p}`);
      assert.equal(r.status, 200, `Expected 200 on ${p}, got ${r.status}`);
      const html = await r.text();
      assert.equal(html.includes('/sweepr-ui.css'), false, `${p} must not reference /sweepr-ui.css`);
      assert.match(html, /\/sweepr-tailwind\.min\.css/, `${p} must reference /sweepr-tailwind.min.css`);
    }
  });
});

// ============================================================================
// T5-02: Mobile Footer & Sticky CTA Overlap Audit (390x844)
// ============================================================================
describe('T5-02: Mobile footer vs sticky CTA overlap audit (390x844)', { concurrency: 1 }, () => {
  const MOBILE_PAGES = [
    '/',
    '/vs/total-adblock',
    '/setup/arc-browser-windows-mac',
    '/pricing',
    '/download',
    '/de',
    '/fr',
    '/es',
    '/benchmarks',
    '/support',
    '/solutions/crunchyroll-anime-streams-block-video-ads'
  ];

  test('T5-02.1 Scrolling to bottom at 390x844 leaves footer links accessible (collapsed & expanded) with zero sticky overlap', async () => {
    for (const route of MOBILE_PAGES) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        await page.navigateAndAudit(`${server.baseUrl}${route}`, server.baseUrl);
        const metrics = await page.evaluate(`(async () => {
          const measureState = async (openDetails) => {
            const details = document.querySelector('footer details');
            if (details) details.open = openDetails;
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            window.scrollTo(0, document.documentElement.scrollHeight);
            await new Promise(r => setTimeout(r, 150));
            const overflow = document.documentElement.scrollWidth - window.innerWidth;
            const footer = document.querySelector('footer');
            const footerEls = footer ? Array.from(footer.querySelectorAll('a[href], summary')).filter(el => {
              if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            }) : [];
            const stickyEls = Array.from(document.querySelectorAll('*')).filter(el => {
              const st = getComputedStyle(el);
              if (st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
              const r = el.getBoundingClientRect();
              return r.height > 10 && r.width > 50 && r.top > window.innerHeight * 0.5;
            });
            let overlapped = 0;
            for (const fl of footerEls) {
              const fr = fl.getBoundingClientRect();
              for (const se of stickyEls) {
                const sr = se.getBoundingClientRect();
                const xOverlap = fr.left < sr.right && fr.right > sr.left;
                const yOverlap = fr.top < sr.bottom && fr.bottom > sr.top;
                if (xOverlap && yOverlap) overlapped++;
              }
            }
            return { overflow, overlapped, count: footerEls.length };
          };
          const collapsed = await measureState(false);
          const expanded = await measureState(true);
          return { collapsed, expanded };
        })()`);
        assert.ok(metrics.collapsed.overflow <= 2, `${route} mobile collapsed overflow: ${metrics.collapsed.overflow}px`);
        assert.equal(
          metrics.collapsed.overlapped,
          0,
          `${route} mobile sticky bar overlaps ${metrics.collapsed.overlapped}/${metrics.collapsed.count} visible footer elements (collapsed)`
        );
        assert.ok(metrics.expanded.overflow <= 2, `${route} mobile expanded overflow: ${metrics.expanded.overflow}px`);
        assert.equal(
          metrics.expanded.overlapped,
          0,
          `${route} mobile sticky bar overlaps ${metrics.expanded.overlapped}/${metrics.expanded.count} visible footer elements (expanded)`
        );
      } finally {
        await page.close();
      }
    }
  });
});

// ============================================================================
// T5-03: Interactive UI Components Regression (Headless Chrome)
// ============================================================================
describe('T5-03: Interactive UI components work cleanly in headless Chrome', { concurrency: 1 }, () => {
  test('T5-03.1 /tools/browser-ram-calculator dynamically updates memory output on control change', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      const audit = await page.navigateAndAudit(`${server.baseUrl}/tools/browser-ram-calculator`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const changed = await page.evaluate(`(() => {
        const range = document.querySelector('input[type="range"], input[type="number"]');
        if (!range) return { found: false };
        const beforeText = document.body.innerText;
        const nextVal = range.type === 'range' ? (range.max || '60') : String(Number(range.value || 10) + 25);
        range.value = nextVal;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
        const afterText = document.body.innerText;
        return { found: true, updated: beforeText !== afterText };
      })()`);
      assert.equal(changed.found, true, 'Expected numeric/range control on RAM calculator');
      assert.equal(changed.updated, true, 'RAM calculator DOM output did not change on input update');
      assert.equal(audit.pageExceptions.length, 0);
    } finally {
      await page.close();
    }
  });

  test('T5-03.2 /pricing plan & FAQ controls respond and update #tableProCtaBtn href with 0 JS exceptions', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
      const audit = await page.navigateAndAudit(`${server.baseUrl}/pricing`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const stats = await page.evaluate(`(() => {
        const details = Array.from(document.querySelectorAll('details'));
        details.slice(0, 3).forEach(d => { d.open = !d.open; });
        const cta = document.getElementById('tableProCtaBtn');
        const hrefs = {};
        for (const [id, planKey] of [
          ['compareCardSixMonth', 'six_month'],
          ['compareCardMonthly', 'monthly'],
          ['compareCardAnnual', 'annual']
        ]) {
          const el = document.getElementById(id);
          if (el) el.click();
          hrefs[planKey] = cta ? cta.getAttribute('href') : null;
        }
        if (typeof window.selectComparePlan === 'function') {
          window.selectComparePlan('suite_annual');
          hrefs.suite_annual = cta ? cta.getAttribute('href') : null;
          window.selectComparePlan('annual');
        }
        return { detailsCount: details.length, hrefs };
      })()`);
      assert.ok(stats.detailsCount >= 1, 'Expected interactive FAQ details elements on /pricing');
      assert.equal(stats.hrefs.six_month, '/order?plan=six_month');
      assert.equal(stats.hrefs.monthly, '/order?plan=monthly');
      assert.equal(stats.hrefs.annual, '/order?plan=annual');
      assert.equal(stats.hrefs.suite_annual, '/order?plan=suite_annual');
      assert.equal(audit.pageExceptions.length, 0);
    } finally {
      await page.close();
    }
  });

  test('T5-03.3 / desktop nav dropdowns + hero before/after slider and mobile drawer work cleanly', async () => {
    const desk = await browser.newPage();
    try {
      await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const audit = await desk.navigateAndAudit(`${server.baseUrl}/`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const res = await desk.evaluate(`(async () => {
        const navBtn = document.getElementById('navDropdownBtn');
        const navMenu = document.getElementById('navDropdownMenu');
        navBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const navOpen = !navMenu.classList.contains('hidden');
        const navRect = navMenu.getBoundingClientRect().toJSON();
        document.body.click();
        await new Promise(r => setTimeout(r, 50));
        const navClosed = navMenu.classList.contains('hidden');

        const langBtn = document.getElementById('langDropdownBtn');
        const langMenu = document.getElementById('langDropdownMenu');
        langBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const langOpen = !langMenu.classList.contains('hidden');
        document.body.click();
        await new Promise(r => setTimeout(r, 50));
        const langClosed = langMenu.classList.contains('hidden');

        const range = document.getElementById('heroCompareRange');
        const clip = document.getElementById('heroBeforeClip');
        const handle = document.getElementById('heroSliderHandle');
        range.value = '80';
        range.dispatchEvent(new Event('input', { bubbles: true }));
        const clipAfterRange = clip.style.clipPath;
        const handleAfterRange = handle.style.left;

        const stage = document.getElementById('heroSliderStage');
        const sr = stage.getBoundingClientRect();
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: sr.left + sr.width * 0.2, clientY: sr.top + sr.height * 0.5 }));
        stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: sr.left + sr.width * 0.2, clientY: sr.top + sr.height * 0.5 }));
        return {
          navOpen,
          navInViewport: navRect.left >= 0 && navRect.right <= window.innerWidth,
          navClosed,
          langOpen,
          langClosed,
          clipAfterRange,
          handleAfterRange,
          clipAfterDrag: clip.style.clipPath,
          handleAfterDrag: handle.style.left
        };
      })()`);
      assert.equal(res.navOpen, true);
      assert.equal(res.navInViewport, true);
      assert.equal(res.navClosed, true);
      assert.equal(res.langOpen, true);
      assert.equal(res.langClosed, true);
      assert.match(res.clipAfterRange, /20%/);
      assert.equal(res.handleAfterRange, '80%');
      assert.notEqual(res.clipAfterDrag, res.clipAfterRange);
    } finally {
      await desk.close();
    }

    const mob = await browser.newPage();
    try {
      await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      const audit = await mob.navigateAndAudit(`${server.baseUrl}/`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const mobRes = await mob.evaluate(`(async () => {
        const btn = document.getElementById('mobileMenuBtn');
        const drawer = document.getElementById('mobileNavDrawer');
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        const openDisplay = getComputedStyle(drawer).display;
        const openBg = getComputedStyle(drawer).backgroundColor;
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        const closedHidden = drawer.classList.contains('hidden');
        return { openDisplay, openBg, overflow, closedHidden };
      })()`);
      assert.notEqual(mobRes.openDisplay, 'none');
      assert.ok(mobRes.overflow <= 2);
      assert.equal(mobRes.closedHidden, true);
    } finally {
      await mob.close();
    }
  });

  test('T5-03.4 /order payment logo tabs and mobile summary accordion toggle cleanly', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      const audit = await page.navigateAndAudit(`${server.baseUrl}/order`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const res = await page.evaluate(`(async () => {
        const revBtn = document.querySelector('button[data-logo-method="revolut_pay"]');
        revBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const cardHiddenOnRev = document.getElementById('cardOnlyFields').classList.contains('hidden');
        const calloutVisibleOnRev = !document.getElementById('localMethodCallout').classList.contains('hidden');
        const submitTextRev = document.getElementById('submitBtnText').textContent.trim();
        document.querySelector('button[data-logo-method="card"]').click();
        await new Promise(r => setTimeout(r, 50));
        const cardVisibleBack = !document.getElementById('cardOnlyFields').classList.contains('hidden');

        const toggleBtn = document.getElementById('mobileSummaryToggleBtn');
        toggleBtn.click();
        await new Promise(r => setTimeout(r, 50));
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        return { cardHiddenOnRev, calloutVisibleOnRev, submitTextRev, cardVisibleBack, overflow };
      })()`);
      assert.equal(res.cardHiddenOnRev, true);
      assert.equal(res.calloutVisibleOnRev, true);
      assert.match(res.submitTextRev, /REVOLUT PAY/i);
      assert.equal(res.cardVisibleBack, true);
      assert.ok(res.overflow <= 2);
    } finally {
      await page.close();
    }
  });
});

// ============================================================================
// T5-04: Multi-Currency & Paywall Bandit Integrity
// ============================================================================
describe('T5-04: Multi-currency & Paywall Bandit integrity', { concurrency: 1 }, () => {
  test('T5-04.1 /api/checkout-config localizes GBP, USD (?country=US & CF-IPCountry: US), and EUR (CF-IPCountry: DE)', async () => {
    const gbp = await (await fetch(`${server.baseUrl}/api/checkout-config`)).json();
    assert.equal(gbp.currency, 'gbp');
    assert.equal(gbp.currencyCode, 'GBP');
    assert.match(gbp.pricing.annualFormatted, /^£/);
    assert.match(gbp.pricing.suiteSavingsFormatted, /^£/);

    const usQuery = await (await fetch(`${server.baseUrl}/api/checkout-config?country=US`)).json();
    assert.equal(usQuery.currency, 'usd');
    assert.equal(usQuery.currencyCode, 'USD');
    assert.match(usQuery.pricing.annualFormatted, /^\$/);
    assert.match(usQuery.pricing.suiteAnnualFormatted, /^\$/);
    assert.match(usQuery.pricing.suiteSavingsFormatted, /^\$/);
    assert.equal(usQuery.pricing.introMonthlyFormatted.includes('£'), false);

    const usHeader = await (await fetch(`${server.baseUrl}/api/checkout-config`, {
      headers: { 'CF-IPCountry': 'US' }
    })).json();
    assert.equal(usHeader.currency, 'usd');
    assert.equal(usHeader.currencyCode, 'USD');

    const deHeader = await (await fetch(`${server.baseUrl}/api/checkout-config`, {
      headers: { 'CF-IPCountry': 'DE' }
    })).json();
    assert.equal(deHeader.currency, 'eur');
    assert.equal(deHeader.currencyCode, 'EUR');
    assert.match(deHeader.pricing.annualFormatted, /^€/);
  });

  test('T5-04.2 /api/ab/paywall has zero Save 58%, zero DeepBlock casing error, and zero GBP currency leakage on US/DE requests', async () => {
    for (let i = 0; i < 6; i += 1) {
      for (const reqOpts of [
        { url: '/api/ab/paywall?country=US&visitor_id=t5us_' + i, headers: {}, expectNoPound: true },
        { url: '/api/ab/paywall?visitor_id=t5de_' + i, headers: { 'CF-IPCountry': 'DE' }, expectNoPound: true },
        { url: '/api/ab/paywall?visitor_id=t5gb_' + i, headers: {}, expectNoPound: false }
      ]) {
        const res = await fetch(`${server.baseUrl}${reqOpts.url}`, { headers: reqOpts.headers });
        assert.equal(res.status, 200);
        const body = await res.json();
        const combined = JSON.stringify(body);
        assert.equal(/Save\s+58%/i.test(combined), false, `Stale Save 58% in paywall bandit: ${combined}`);
        assert.equal(/\bDeepBlock\b/.test(combined), false, `Wrong casing DeepBlock in paywall bandit: ${combined}`);
        if (reqOpts.expectNoPound) {
          assert.equal(combined.includes('£'), false, `Currency leak (£) in non-GBP paywall bandit: ${combined}`);
        }
      }
    }
  });

  test('T5-04.3 /order?plan=suite_annual&country=US and ?offer=intro / activateDiscountOffer() render USD with zero GBP leaks', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const audit = await page.navigateAndAudit(`${server.baseUrl}/order?plan=suite_annual&country=US`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const rendered = await page.evaluate(`(async () => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const lbl = document.getElementById('totalTodayLabel')?.textContent || '';
          const txt = document.getElementById('totalTodayText')?.textContent?.trim() || '';
          if (lbl.includes('USD') && txt.startsWith('$')) break;
          await new Promise(r => setTimeout(r, 50));
        }

        const tabs = ['planTabSuite', 'planTabAnnual', 'planTabSixMonth', 'planTabMonthly'];
        const tabSnapshots = [];
        for (const id of tabs) {
          const btn = document.getElementById(id);
          if (btn) btn.click();
          await new Promise(r => setTimeout(r, 40));
          const sub = document.querySelector('[data-ab-paywall-subheadline]')?.textContent || '';
          const total = document.getElementById('totalTodayText')?.textContent || '';
          const savings = document.getElementById('savingsSummaryAmount')?.textContent || '';
          const note = document.getElementById('savingsSummaryNote')?.textContent || '';
          tabSnapshots.push({ id, total, savings, note, sub });
        }

        if (typeof window.activateDiscountOffer === 'function') {
          window.activateDiscountOffer();
          await new Promise(r => setTimeout(r, 50));
        }
        const discountRowVisible = !document.getElementById('discountSummaryRow')?.classList.contains('hidden');
        const discountRowText = document.getElementById('discountSummaryRow')?.textContent || '';
        const discountSaveStrong = document.getElementById('discountSaveStrong')?.textContent || '';
        const discountAmountMinus = document.getElementById('discountAmountMinus')?.textContent || '';
        const discountNoteText = document.getElementById('discountNoteText')?.textContent || '';
        const discountModalText = document.getElementById('discountModal')?.textContent || '';

        const text = document.body.innerText || '';
        return {
          totalLabel: document.getElementById('totalTodayLabel')?.textContent || '',
          hasDollar: /\\$\\d/.test(text),
          hasPoundLeak: tabSnapshots.some(s => (s.total + s.savings + s.note + s.sub).includes('£')) ||
            text.includes('£74.98') || text.includes('£29.99') || text.includes('£44.98') || text.includes('£89.99') || text.includes('£1.99') || text.includes('£4.99') || text.includes('£3.00'),
          discountRowVisible,
          discountRowHasPound: (discountRowText + discountModalText).includes('£'),
          discountSaveStrong,
          discountAmountMinus,
          discountNoteText,
          hasDeepBlockCasing: /\\bDeepBlock\\b/.test(text),
          tabSnapshots
        };
      })()`);
      assert.match(rendered.totalLabel, /USD/);
      assert.equal(rendered.hasDollar, true, '/order?plan=suite_annual&country=US must display $ pricing');
      assert.equal(rendered.hasPoundLeak, false, `/order?plan=suite_annual&country=US leaked GBP amounts: ${JSON.stringify(rendered.tabSnapshots)}`);
      assert.equal(rendered.discountRowVisible, true, 'activateDiscountOffer() must reveal #discountSummaryRow');
      assert.equal(rendered.discountRowHasPound, false, `activateDiscountOffer() leaked £ in discount row/modal: ${JSON.stringify(rendered)}`);
      assert.match(rendered.discountSaveStrong, /\$/);
      assert.match(rendered.discountAmountMinus, /\$/);
      assert.match(rendered.discountNoteText, /\$/);
      assert.equal(rendered.hasDeepBlockCasing, false, '/order leaked wrong DeepBlock casing');
    } finally {
      await page.close();
    }

    const introPage = await browser.newPage();
    try {
      await introPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      const audit = await introPage.navigateAndAudit(`${server.baseUrl}/order?country=US&offer=intro`, server.baseUrl);
      assert.equal(audit.consoleErrors.length, 0);
      const introState = await introPage.evaluate(`(async () => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const lbl = document.getElementById('totalTodayLabel')?.textContent || '';
          const txt = document.getElementById('totalTodayText')?.textContent?.trim() || '';
          const row = document.getElementById('discountSummaryRow');
          if (lbl.includes('USD') && txt.startsWith('$') && row && !row.classList.contains('hidden')) break;
          await new Promise(r => setTimeout(r, 50));
        }
        return {
          totalLabel: document.getElementById('totalTodayLabel')?.textContent || '',
          totalText: document.getElementById('totalTodayText')?.textContent?.trim() || '',
          rowVisible: !document.getElementById('discountSummaryRow')?.classList.contains('hidden'),
          saveStrong: document.getElementById('discountSaveStrong')?.textContent || '',
          amountMinus: document.getElementById('discountAmountMinus')?.textContent || '',
          noteText: document.getElementById('discountNoteText')?.textContent || ''
        };
      })()`);
      assert.match(introState.totalLabel, /USD/);
      assert.match(introState.totalText, /^\$/);
      assert.equal(introState.rowVisible, true, '/order?country=US&offer=intro must show #discountSummaryRow');
      assert.equal((introState.saveStrong + introState.amountMinus + introState.noteText).includes('£'), false, `US ?offer=intro leaked £: ${JSON.stringify(introState)}`);
      assert.match(introState.saveStrong, /\$/);
      assert.match(introState.amountMinus, /\$/);
      assert.match(introState.noteText, /\$/);
    } finally {
      await introPage.close();
    }
  });
});

// ============================================================================
// T5-05: Internal Fragment (#hash) Validation Across All 99 Sitemap Pages
// ============================================================================
describe('T5-05: Internal #hash fragment validation across all sitemap pages', { concurrency: 1 }, () => {
  test('T5-05.1 Every internal #fragment link across all 99 sitemap pages resolves to a valid id/name on disk', () => {
    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    const broken = [];
    const htmlCache = new Map();

    const readHtml = (filePath) => {
      if (!htmlCache.has(filePath)) htmlCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
      return htmlCache.get(filePath);
    };

    for (const urlPath of sitemap.paths) {
      const fp = resolveUrlPathToHtmlFile(urlPath);
      assert.ok(fp, `Missing HTML file for sitemap URL ${urlPath}`);
      const html = readHtml(fp);
      for (const m of html.matchAll(/href=["']([^"']*#[^"']+)["']/gi)) {
        const href = m[1];
        if (/^https?:\/\//i.test(href) && !href.startsWith(CANONICAL_ORIGIN)) continue;
        const relHref = href.startsWith(CANONICAL_ORIGIN) ? href.slice(CANONICAL_ORIGIN.length) || '/' : href;
        const [rawPathPart, frag] = relHref.split('#');
        if (!frag) continue;
        const targetPath = rawPathPart ? rawPathPart.split('?')[0] : urlPath;
        const targetFile = resolveUrlPathToHtmlFile(targetPath);
        if (!targetFile) {
          broken.push({ from: urlPath, href, reason: 'missing_target' });
          continue;
        }
        const targetHtml = readHtml(targetFile);
        const idRe = new RegExp(`(?:id|name)=["']${frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
        if (!idRe.test(targetHtml)) {
          broken.push({ from: urlPath, href, reason: 'missing_fragment_target' });
        }
      }
    }
    assert.deepEqual(broken, [], `Broken internal #hash links: ${JSON.stringify(broken.slice(0, 10))}`);
  });
});

// ============================================================================
// T5-06: CSS Utility Completeness & Zero Unverified <50ms / (Suite) RAM Claims
// ============================================================================
describe('T5-06: CSS utility completeness and clean unverified-claim checks', { concurrency: 1 }, () => {
  test('T5-06.1 Zero <50ms, sub-50ms, 50 milliseconds, or <15us claims in any sitemap HTML, llms*.txt, or dist/*.csv', () => {
    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    const hits = [];
    for (const u of sitemap.paths) {
      const fp = resolveUrlPathToHtmlFile(u);
      const html = fs.readFileSync(fp, 'utf8');
      if (/(?:<\s*50\s*ms|sub-50\s*ms|50\s*milliseconds|<\s*15\s*[uμ]s|<15us)/i.test(html)) {
        hits.push(u);
      }
    }
    for (const extra of [
      'website/login.html',
      'website/order.html',
      'website/test-lab.html',
      'website/llms.txt',
      'website/llms-full.txt',
      'dist/chatgpt-search-ads-stage3-export.csv',
      'dist/eu-de-fr-microsoft-ads-stage3.csv'
    ]) {
      const txt = fs.readFileSync(path.join(ROOT, extra), 'utf8');
      if (/(?:<\s*50\s*ms|sub-50\s*ms|50\s*milliseconds|<\s*15\s*[uμ]s|<15us)/i.test(txt)) {
        hits.push(extra);
      }
    }
    assert.deepEqual(hits, [], `Unverified sub-50ms / <15us timing claims found in: ${JSON.stringify(hits)}`);
  });

  test('T5-06.2 Zero (Suite)-only RAM Tamer claims on core pages/daily-50 script and compiled sweepr-tailwind.min.css covers all site utility tokens', () => {
    for (const rel of ['index.html', 'pricing.html', 'download.html', 'benchmarks.html']) {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8');
      for (const m of html.matchAll(/.{0,60}RAM Tamer.{0,60}/gi)) {
        assert.equal(/\(Suite\)|Suite-only/i.test(m[0]), false, `Stale (Suite)-only RAM Tamer claim in ${rel}: ${m[0]}`);
      }
    }
    const daily50 = fs.readFileSync(path.join(ROOT, 'scripts', 'daily-50-seo-pages.mjs'), 'utf8');
    assert.equal(/RAM\s*Tamer\s*\(Suite\)/i.test(daily50), false, 'daily-50-seo-pages.mjs still contains RAM Tamer (Suite)');
    assert.equal(/automated automatic|automatically automatically|Auto-Rejected automatically/i.test(daily50), false, 'daily-50-seo-pages.mjs contains duplicated adverbs');
    const twCss = fs.readFileSync(path.join(WEBSITE_DIR, 'sweepr-tailwind.min.css'), 'utf8');
    const styleCss = fs.readFileSync(path.join(WEBSITE_DIR, 'style.css'), 'utf8');
    for (const cls of ['max-w-2xl', 'bg-amber-50', 'text-amber-800', 'border-amber-200', 'px-3', 'rounded-2xl']) {
      assert.ok(twCss.includes(cls), `sweepr-tailwind.min.css missing utility class "${cls}"`);
    }

    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    const filesToScan = [
      ...sitemap.paths.map((u) => resolveUrlPathToHtmlFile(u)).filter(Boolean),
      path.join(WEBSITE_DIR, 'nav.js'),
      path.join(WEBSITE_DIR, 'order.html'),
      path.join(WEBSITE_DIR, 'login.html'),
      path.join(WEBSITE_DIR, 'test-lab.html')
    ];
    const cssEsc = (c) => '.' + c.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    const twUtilRe = /^(?:(?:sm|md|lg|xl|hover|focus|focus-visible|disabled|group-hover|group-open):)*(?:!|-)?(?:bg|text|border|px|py|pt|pr|pb|pl|p|mx|my|mt|mr|mb|ml|m|w|h|min-h|min-w|max-w|max-h|grid-cols|col-span|gap|space-y|divide|rounded|shadow|font|leading|tracking|z|opacity|backdrop-blur)-/;
    const customClasses = new Set(['text-ad', 'font-sans', 'hidden-modal']);
    const missingTokens = new Set();
    const emptyLiFiles = [];
    for (const fp of filesToScan) {
      const content = fs.readFileSync(fp, 'utf8');
      if (/<li>\s*<\/li>/i.test(content)) {
        emptyLiFiles.push(path.relative(ROOT, fp));
      }
      for (const m of content.matchAll(/(?:class|className)\s*=\s*["'`]([^"'`]+)["'`]/g)) {
        for (const tok of m[1].split(/\s+/)) {
          if (!tok || tok.includes('${') || tok.includes('{{') || customClasses.has(tok) || !twUtilRe.test(tok)) continue;
          if (!twCss.includes(cssEsc(tok)) && !styleCss.includes('.' + tok)) {
            missingTokens.add(`${tok} (${path.relative(ROOT, fp)})`);
          }
        }
      }
    }
    assert.deepEqual(emptyLiFiles, [], `Empty <li></li> elements found in indexable pages/assets: ${JSON.stringify(emptyLiFiles.slice(0, 15))}`);
    assert.deepEqual([...missingTokens], [], `Missing compiled Tailwind utility tokens: ${JSON.stringify([...missingTokens].slice(0, 15))}`);
  });
});

// ============================================================================
// T5-07: Branded Holographic Pearl 404 & Unknown Route Audit
// ============================================================================
describe('T5-07: Styled HTML 404 & API JSON 404 audit', { concurrency: 1 }, () => {
  test('T5-07.1 Unknown HTML routes return 404 Holographic Pearl HTML with noindex, nofollow, home link, and zero 390x844 nav brand clipping', async () => {
    for (const p of ['/this-route-does-not-exist-t5', '/vs/nonexistent-tier5-route', '/guides/nonexistent-guide-t5', '/solutions/nonexistent-solution-t5']) {
      const res = await fetchWithRetry(`${server.baseUrl}${p}`);
      assert.equal(res.status, 404, `Expected 404 on ${p}, got ${res.status}`);
      assert.match(res.headers.get('content-type') || '', /text\/html/i);
      const xRobots = res.headers.get('x-robots-tag') || '';
      assert.ok(/noindex/i.test(xRobots) && /nofollow/i.test(xRobots), `Expected X-Robots-Tag noindex, nofollow on 404 for ${p}`);
      const html = await res.text();
      assert.match(html, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex,\s*nofollow/i);
      assert.match(html, /href=["']\/["']/);
      assert.match(html, /SWEEPR\s*<span[^>]*>Deepblock<\/span>/i);
    }

    for (const p of ['/nonexistent-tier5-route', '/vs/nonexistent-tier5-route']) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        await page.navigateAndAudit(`${server.baseUrl}${p}`, server.baseUrl);
        const dom = await page.evaluate(`(() => {
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const navBrand = document.querySelector('.glass-nav a[href="/"] span');
          const navBrandClipped = navBrand ? (navBrand.scrollWidth > navBrand.clientWidth + 1) : false;
          return { overflow, navBrandClipped, scrollW: navBrand?.scrollWidth || 0, clientW: navBrand?.clientWidth || 0 };
        })()`);
        assert.ok(dom.overflow <= 2, `404 ${p} mobile horizontal overflow: ${dom.overflow}px`);
        assert.equal(dom.navBrandClipped, false, `404 ${p} mobile .glass-nav brand clipped: ${JSON.stringify(dom)}`);
      } finally {
        await page.close();
      }
    }
  });

  test('T5-07.2 Unknown /api/* routes return 404 JSON', async () => {
    const res = await fetchWithRetry(`${server.baseUrl}/api/nonexistent-t5-endpoint`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/i);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'not_found');
  });
});

// ============================================================================
// Tier 5A: Disk Inventory, URL_AUDIT_279, 351 NOINDEX_PRUNE & X-Robots-Tag
// ============================================================================
describe('Tier 5A: Disk HTML inventory, URL_AUDIT_279, NOINDEX_PRUNE & X-Robots-Tag headers', { concurrency: 1 }, () => {
  test('5A.1 Disk HTML files (1,813), sitemap (99), CUT_LIST_94 (94), and all NOINDEX_PRUNE/site pages have self-canonicals + noindex, nofollow + HTTP X-Robots-Tag', async () => {
    const allRel = listAllWebsiteHtmlRelPaths();
    assert.equal(allRel.length, 1813, `Expected 1,813 HTML files on disk, found ${allRel.length}`);

    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    assert.equal(sitemap.paths.length, 99, `Expected 99 sitemap.xml URLs, found ${sitemap.paths.length}`);
    assert.deepEqual([...new Set(sitemap.paths)].sort(), [...ALL_INDEXABLE_SET].sort(), 'sitemap.xml diverges from ALL_INDEXABLE_SET');

    const cutData = resolveCutList94();
    assert.ok(Array.isArray(cutData?.entries) && cutData.entries.length === 94, 'CUT_LIST_94.json must resolve 94 entries');
    const cutFailures = [];
    await runConcurrent(cutData.entries, 8, async (entry) => {
      const p = entry.path;
      const res = await fetchWithRetry(`${server.baseUrl}${p}`, { redirect: 'manual' });
      await res.body?.cancel().catch(() => {});
      if (entry.action === 'CONSOLIDATE_301') {
        const loc = res.headers.get('location') || '';
        if (res.status !== 301 || !loc) cutFailures.push({ p, action: entry.action, status: res.status, loc });
      } else if (entry.action === 'NOINDEX_PRUNE') {
        const xr = res.headers.get('x-robots-tag') || '';
        if (res.status !== 200 || !/noindex/i.test(xr)) cutFailures.push({ p, action: entry.action, status: res.status, xr });
      } else if (entry.action === 'KEEP_REWRITE') {
        if (res.status !== 200) cutFailures.push({ p, action: entry.action, status: res.status });
      }
    });
    assert.deepEqual(cutFailures, [], `CUT_LIST_94 live parity failures: ${JSON.stringify(cutFailures.slice(0, 10))}`);

    const siteHtmlPaths = allRel
      .filter((r) => r === 'site/index.html' || r.startsWith('site/'))
      .map((r) => relPathToUrlPath(r));
    const allPruneTargets = [...new Set([...NOINDEX_PRUNE_PATHS, ...siteHtmlPaths])];
    assert.ok(allPruneTargets.length >= 250, `Expected >=250 NOINDEX_PRUNE + /site paths, got ${allPruneTargets.length}`);

    let noindexNofollowOnDisk = 0;
    for (const rel of allRel) {
      const robots = extractMetaRobots(fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8')) || '';
      if (/noindex/i.test(robots) && /nofollow/i.test(robots)) noindexNofollowOnDisk += 1;
    }
    assert.equal(noindexNofollowOnDisk, 370, `Expected 370 noindex, nofollow HTML files on disk, found ${noindexNofollowOnDisk}`);

    const brokenPrune = [];
    for (const u of allPruneTargets) {
      const fp = resolveUrlPathToHtmlFile(u);
      if (!fp) {
        brokenPrune.push({ u, reason: 'missing_file' });
        continue;
      }
      const html = fs.readFileSync(fp, 'utf8');
      const robots = extractMetaRobots(html) || '';
      const canon = extractCanonical(html) || '';
      if (!/noindex/i.test(robots) || !/nofollow/i.test(robots)) {
        brokenPrune.push({ u, reason: `bad_robots:${robots}` });
      }
      const expectedCanon = `${CANONICAL_ORIGIN}${u === '/' ? '/' : u}`;
      if (canon !== expectedCanon) {
        brokenPrune.push({ u, reason: `non_self_canonical:${canon}!=${expectedCanon}` });
      }
    }
    assert.deepEqual(brokenPrune, [], `NOINDEX_PRUNE invariant violations: ${JSON.stringify(brokenPrune.slice(0, 10))}`);

    // Exhaustive HTTP check across all 121 M1 NOINDEX_PRUNE_PATHS + sampled /site/* for HTTP 200 + X-Robots-Tag: noindex, nofollow
    const liveChecks = [...new Set([...NOINDEX_PRUNE_PATHS, ...siteHtmlPaths.slice(0, 15)])];
    await runConcurrent(liveChecks, 8, async (u) => {
      const res = await fetchWithRetry(`${server.baseUrl}${u}`, { redirect: 'manual' });
      await res.body?.cancel().catch(() => {});
      assert.equal(res.status, 200, `Expected 200 for NOINDEX_PRUNE ${u}, got ${res.status}`);
      const xr = res.headers.get('x-robots-tag') || '';
      assert.ok(/noindex/i.test(xr) && /nofollow/i.test(xr), `${u} missing X-Robots-Tag: noindex, nofollow (got "${xr}")`);
    });
  });

  test('5A.2 URL_AUDIT_279 entries satisfy KEEP_REWRITE / CONSOLIDATE_301 / NOINDEX_PRUNE live HTTP parity', async () => {
    const audit = resolveUrlAudit279();
    assert.ok(audit?.data?.urls, 'URL_AUDIT_279.json must resolve for Tier 5A parity');
    assert.equal(audit.data.urls.length, 279);
    const failures = [];

    await runConcurrent(audit.data.urls, 8, async (entry) => {
      const p = entry.path;
      const res = await fetchWithRetry(`${server.baseUrl}${p}`, { redirect: 'manual' });
      await res.body?.cancel().catch(() => {});
      if (entry.finalAction === 'CONSOLIDATE_301') {
        const loc = res.headers.get('location') || '';
        const expectedTarget = entry.redirectTarget ? new URL(entry.redirectTarget, CANONICAL_ORIGIN).pathname : null;
        const actualTarget = loc ? new URL(loc, CANONICAL_ORIGIN).pathname : '';
        if (res.status !== 301 || !loc || (expectedTarget && actualTarget !== expectedTarget)) {
          failures.push({ p, expected: `301 -> ${expectedTarget}`, got: `${res.status} -> ${actualTarget}` });
        }
      } else if (entry.finalAction === 'NOINDEX_PRUNE') {
        const xr = res.headers.get('x-robots-tag') || '';
        if (res.status !== 200 || !/noindex/i.test(xr)) {
          failures.push({ p, expected: '200 noindex', got: `${res.status} (${xr})` });
        }
      } else if (entry.finalAction === 'KEEP_REWRITE') {
        if (res.status !== 200) {
          failures.push({ p, expected: 200, got: res.status });
        }
      }
    });
    assert.deepEqual(failures, [], `URL_AUDIT_279 live parity failures: ${JSON.stringify(failures.slice(0, 10))}`);
  });

  test('5A.3 .idsig binary, /pair, and /test-lab/results/* emit X-Robots-Tag: noindex, nofollow', async () => {
    for (const p of ['/SWEEPRDeepblock.apk.idsig', '/download/SWEEPRDeepblock.apk.idsig', '/pair', '/test-lab/results/t5-sample-token']) {
      const res = await fetchWithRetry(`${server.baseUrl}${p}`, { redirect: 'manual' });
      await res.body?.cancel().catch(() => {});
      assert.equal(res.status, 200, `Expected 200 on ${p}, got ${res.status}`);
      const xr = res.headers.get('x-robots-tag') || '';
      assert.ok(/noindex/i.test(xr) && /nofollow/i.test(xr), `${p} missing X-Robots-Tag: noindex, nofollow (got "${xr}")`);
    }
  });
});

// ============================================================================
// Tier 5B: Single-Hop Canonical Normalization, %00 400, /<dir>/index, Open Redirect & Traversal
// ============================================================================
describe('Tier 5B: Single-hop canonical redirects, pre-redirect 400s, and security guards', { concurrency: 1 }, () => {
  test('5B.1 Combined canonical variants (case, slash, .html, punctuation, R1 SWEEPR*, R3 /<dir>/index) resolve in strictly 1 hop (301 -> 200)', async () => {
    const cases = [
      ['/PRICING/', '/pricing'],
      ['/pricing.html/', '/pricing'],
      ['/PRICING.html', '/pricing'],
      ['/PRICING.html/', '/pricing'],
      ['/PRICING)', '/pricing'],
      ['/pricing.', '/pricing'],
      ['/pricing,', '/pricing'],
      ['/pricing]', '/pricing'],
      ['/guides/block-youtube-ads.html', '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026'],
      ['/GUIDES/BLOCK-YOUTUBE-ADS.html/', '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026'],
      ['/features/cookie-consent-blocker.html', '/guides/how-to-automatically-reject-cookie-banners-uk'],
      ['/FEATURES/cookie-consent-blocker', '/guides/how-to-automatically-reject-cookie-banners-uk'],
      ['/cdn-cgi/l/email-protection/foo', '/support'],
      ['/CDN-CGI/l/email-protection/foo', '/support'],
      ['/SWEEPR-VPN-CONCEPTS', '/sweepr-vpn-concepts'],
      ['/SWEEPR-VPN-MOBILE-REDESIGN', '/sweepr-vpn-mobile-redesign'],
      ['/de/index', '/de'],
      ['/de/index.html', '/de'],
      ['/fr/index', '/fr'],
      ['/es/index.html', '/es'],
      ['/vs/index', '/vs'],
      ['/guides/index.html', '/guides'],
      ['/solutions/index', '/solutions'],
      ['/setup/index.html', '/setup'],
      ['/tools/index', '/tools'],
      ['/glossary/index.html', '/glossary'],
      ['/site/index', '/site'],
      ['/stories/index.html', '/stories']
    ];

    for (const [input, expectedTarget] of cases) {
      const hop1 = await fetchWithRetry(`${server.baseUrl}${input}`, { redirect: 'manual' });
      await hop1.body?.cancel().catch(() => {});
      assert.equal(hop1.status, 301, `${input} must return 301 in 1 hop, got ${hop1.status}`);
      const loc = hop1.headers.get('location') || '';
      assert.equal(loc, expectedTarget, `${input} Location expected "${expectedTarget}", got "${loc}"`);

      const hop2 = await fetchWithRetry(`${server.baseUrl}${loc}`, { redirect: 'manual' });
      await hop2.body?.cancel().catch(() => {});
      assert.equal(hop2.status, 200, `Final canonical target ${loc} (from ${input}) must return 200, got ${hop2.status}`);
    }
  });

  test('5B.2 Null-byte & malformed URLs return 400 immediately before any .html/slash/case 301 redirect', async () => {
    for (const p of ['/pricing%00.html', '/%00', '/guides/block-youtube-ads%00/', '/%E0%A4%A']) {
      const res = await fetch(`${server.baseUrl}${p}`, { redirect: 'manual' });
      assert.equal(res.status, 400, `Expected immediate 400 on "${p}", got ${res.status}`);
    }
  });

  test('5B.3 Raw wire //evil.com/ never emits an off-origin Location and traversal never leaks secrets', async () => {
    for (const rawTarget of ['//evil.com/', '//evil.com/pricing', '//evil.com/%2e%2e']) {
      const wire = await rawWireHttpRequest(server.port, rawTarget);
      const loc = wire.headers.location || '';
      assert.equal(/evil\.com/i.test(loc), false, `Open redirect on raw "${rawTarget}": Location="${loc}"`);
      assert.ok([301, 400, 403, 404].includes(wire.status), `Unexpected status ${wire.status} on "${rawTarget}"`);
    }
    for (const trav of ['/../../../etc/passwd', '/..%2f.env', '/.env', '/.gcp-service-account.json']) {
      const res = await fetch(`${server.baseUrl}${trav}`, { redirect: 'manual' });
      assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404 on ${trav}, got ${res.status}`);
      const txt = await res.text();
      assert.equal(/PRIVATE KEY|STRIPE_SECRET|SESSION_SECRET|root:x:0:0/i.test(txt), false, `Secret leak on ${trav}`);
    }
  });
});

// ============================================================================
// Tier 5C: /download UA Matrix, Live APIs & Migrated SEO Quality/Disavow/Security Guards
// ============================================================================
describe('Tier 5C: /download UA matrix, live APIs & migrated F8/F9.5/F10/F11.4 checks', { concurrency: 1 }, () => {
  test('5C.1 /download UA matrix, HEAD /download, ?direct=1, ?platform=ios, ?store=, .mobileconfig, security.txt, AASA & /api/healthz', async () => {
    const gBot = await fetch(`${server.baseUrl}/download`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    });
    await gBot.body?.cancel().catch(() => {});
    assert.equal(gBot.status, 200);
    assert.match(gBot.headers.get('content-type') || '', /text\/html/i);
    assert.match(gBot.headers.get('vary') || '', /User-Agent/i);

    const headDl = await fetch(`${server.baseUrl}/download`, { method: 'HEAD' });
    await headDl.body?.cancel().catch(() => {});
    assert.equal(headDl.status, 200);
    assert.match(headDl.headers.get('content-type') || '', /text\/html/i);

    const bingBot = await fetch(`${server.baseUrl}/download`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }
    });
    await bingBot.body?.cancel().catch(() => {});
    assert.equal(bingBot.status, 200);
    assert.match(bingBot.headers.get('content-type') || '', /text\/html/i);

    const androidDl = await fetch(`${server.baseUrl}/download?platform=android`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' }
    });
    await androidDl.body?.cancel().catch(() => {});
    assert.equal(androidDl.status, 200);
    assert.match(androidDl.headers.get('content-type') || '', /application\/vnd\.android\.package-archive/i);

    const iosDl = await fetch(`${server.baseUrl}/download?platform=ios`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
    });
    await iosDl.body?.cancel().catch(() => {});
    assert.equal(iosDl.status, 200);
    assert.match(iosDl.headers.get('content-type') || '', /text\/html/i);

    const chromeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    for (const q of ['?install=1', '?direct=1', '?store=chrome']) {
      const chromeStore = await fetch(`${server.baseUrl}/download${q}`, {
        redirect: 'manual',
        headers: { 'User-Agent': chromeUa }
      });
      await chromeStore.body?.cancel().catch(() => {});
      assert.equal(chromeStore.status, 302, `Expected 302 on /download${q}`);
      assert.match(chromeStore.headers.get('location') || '', /^https:\/\/chromewebstore\.google\.com\//i);
    }

    const firefoxUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';
    for (const [q, ua] of [['?install=1', firefoxUa], ['?store=firefox', chromeUa]]) {
      const firefoxStore = await fetch(`${server.baseUrl}/download${q}`, {
        redirect: 'manual',
        headers: { 'User-Agent': ua }
      });
      await firefoxStore.body?.cancel().catch(() => {});
      assert.equal(firefoxStore.status, 302, `Expected 302 on /download${q}`);
      assert.match(firefoxStore.headers.get('location') || '', /^https:\/\/addons\.mozilla\.org\//i);
    }

    const mobileConfig = await fetch(`${server.baseUrl}/download/sweepr-deepblock.mobileconfig`, { redirect: 'manual' });
    await mobileConfig.body?.cancel().catch(() => {});
    assert.equal(mobileConfig.status, 302);
    assert.equal(mobileConfig.headers.get('location'), '/download?ios=coming-soon');

    const secTxt = await fetch(`${server.baseUrl}/.well-known/security.txt`);
    assert.equal(secTxt.status, 200);
    assert.match(secTxt.headers.get('content-type') || '', /text\/plain/i);
    assert.match(await secTxt.text(), /Contact:/i);

    const aasa = await fetch(`${server.baseUrl}/.well-known/apple-app-site-association`);
    assert.equal(aasa.status, 200);
    assert.match(aasa.headers.get('content-type') || '', /application\/json/i);
    const aasaJson = await aasa.json();
    assert.ok(aasaJson && aasaJson.applinks);

    const healthz = await fetch(`${server.baseUrl}/api/healthz`);
    assert.equal(healthz.status, 200);
    const healthJson = await healthz.json();
    assert.equal(healthJson.ok, true);
  });

  test('5C.2 /api/version, /api/telemetry/live-proof, and /api/filters/delta match manifest & rule truth', async () => {
    const manifest = readExtensionManifest();
    const deltaVersion = readDynamicDeltaVersion();

    const verRes = await (await fetch(`${server.baseUrl}/api/version`)).json();
    assert.equal(verRes.version, manifest.version);

    const proofRes = await (await fetch(`${server.baseUrl}/api/telemetry/live-proof`)).json();
    assert.equal(proofRes.activeMv3StaticRules, 283);
    assert.equal(proofRes.activeOtaDeltaRules, 100);

    const deltaRes = await (await fetch(`${server.baseUrl}/api/filters/delta`)).json();
    assert.equal(deltaRes.version, deltaVersion);
    assert.ok(Array.isArray(deltaRes.dynamicDnrRules) && deltaRes.dynamicDnrRules.length === 100);
    const ids = new Set(deltaRes.dynamicDnrRules.map((r) => r.id));
    assert.equal(ids.size, 100);
    assert.ok([...ids].every((id) => id >= 80000));
  });

  test('5C.3 (Migrated F8.2-F8.4) Surviving /guides, /solutions, and /vs 5-gram Jaccard similarity stays within anti-doorway caps', () => {
    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    const loadGroup = (prefix) =>
      sitemap.paths
        .filter((u) => u.startsWith(`/${prefix}/`) && u !== `/${prefix}`)
        .map((u) => ({ urlPath: u, html: fs.readFileSync(resolveUrlPathToHtmlFile(u), 'utf8') }));

    const guides = loadGroup('guides');
    assert.ok(guides.length >= 2);
    const gStats = computeGroupJaccardStats(guides);
    assert.ok(gStats.avg <= 0.22, `/guides avg Jaccard ${gStats.avg.toFixed(3)} > 0.22`);
    assert.ok(gStats.max <= 0.35, `/guides max Jaccard ${gStats.max.toFixed(3)} > 0.35 (${JSON.stringify(gStats.maxPair)})`);

    const solutions = loadGroup('solutions');
    assert.ok(solutions.length >= 2);
    const sStats = computeGroupJaccardStats(solutions);
    assert.ok(sStats.avg <= 0.22, `/solutions avg Jaccard ${sStats.avg.toFixed(3)} > 0.22`);
    assert.ok(sStats.max <= 0.35, `/solutions max Jaccard ${sStats.max.toFixed(3)} > 0.35 (${JSON.stringify(sStats.maxPair)})`);

    const vs = loadGroup('vs');
    assert.ok(vs.length >= 2);
    const vStats = computeGroupJaccardStats(vs);
    assert.ok(vStats.avg <= 0.20, `/vs avg Jaccard ${vStats.avg.toFixed(3)} > 0.20`);
    assert.ok(vStats.max <= 0.32, `/vs max Jaccard ${vStats.max.toFixed(3)} > 0.32 (${JSON.stringify(vStats.maxPair)})`);
  });

  test('5C.4 (Migrated F8.5) Surviving PSEO pages stay <= 14 KB Brotli / <= 65 KB raw and have complete Summary Answers', () => {
    const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
    const pseo = sitemap.paths
      .filter((u) => /^\/(guides|solutions|vs|setup)\//.test(u))
      .map((u) => ({ urlPath: u, html: fs.readFileSync(resolveUrlPathToHtmlFile(u), 'utf8') }));
    assert.ok(pseo.length >= 10);

    for (const p of pseo) {
      const rawBuf = Buffer.from(p.html, 'utf8');
      assert.ok(rawBuf.length <= 65 * 1024, `${p.urlPath} raw HTML ${rawBuf.length} > 65 KB`);
      const brBuf = zlib.brotliCompressSync(rawBuf);
      assert.ok(brBuf.length <= 14 * 1024, `${p.urlPath} Brotli ${brBuf.length} > 14 KB`);

      const m = p.html.match(/<strong>\s*Summary Answer:\s*<\/strong>([\s\S]*?)<\/p>/i);
      if (m) {
        const txt = decodeXmlEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        assert.equal(/auto-rejects\s+c$/i.test(txt) || !/[.!?)"']$/.test(txt), false, `${p.urlPath} truncated Summary Answer`);
      }
    }
  });

  test('5C.5 (Migrated F9.5, F10, F11.4) Sitemap/robots retirement atomicity, disavow validation, and script secret safety', () => {
    // F9.5
    const robotsRaw = fs.readFileSync(path.join(WEBSITE_DIR, 'robots.txt'), 'utf8');
    const consolSitemapPath = path.join(WEBSITE_DIR, 'sitemap-consolidations.xml');
    const consolHasUrls = fs.existsSync(consolSitemapPath) && parseSitemapUrls(consolSitemapPath).paths.length > 0;
    assert.equal(/sitemap-consolidations\.xml/i.test(robotsRaw), consolHasUrls, 'robots.txt sitemap-consolidations.xml drift');
    assert.equal(/sitemap-sites\.xml/i.test(robotsRaw), false, 'robots.txt must not reference retired sitemap-sites.xml');
    const idx = parseSitemapIndex(path.join(WEBSITE_DIR, 'sitemap-index.xml'));
    assert.equal(idx.locs.some((loc) => /sitemap-sites\.xml/i.test(loc || '')), false);

    // F10.1-F10.5
    const tmpUnit = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-t5-disavow-'));
    try {
      const badCases = ['# c\ndomain:*.foo.com\n', 'domain:https://foo.com\n', 'domain:Foo.COM\n', 'domain:foo.com  \n', 'domain:foo.com\r\n'];
      badCases.forEach((c, idxNum) => {
        const bp = path.join(tmpUnit, `bad_${idxNum}.txt`);
        fs.writeFileSync(bp, c, 'utf8');
        assert.equal(validateDisavowFile(bp).valid, false);
      });
    } finally {
      fs.rmSync(tmpUnit, { recursive: true, force: true });
    }

    const realDisavow = path.join(ROOT, 'dist', 'disavow-sweeprdeepblock.txt');
    const rawBuf = fs.readFileSync(realDisavow);
    assert.equal(rawBuf.includes(0x0d), false);
    assert.ok(rawBuf.toString('utf8').endsWith('\n'));
    const v = validateDisavowFile(realDisavow);
    assert.equal(v.valid, true, `Disavow invalid: ${JSON.stringify(v.errors)}`);
    assert.equal(new Set(v.directives).size, v.directives.length);
    for (const d of v.directives) assert.equal(/sweeprdeepblock\.com/i.test(d), false);
    for (const toxic of ['otorented.com', 'sitewiki.org', 'rankvance.com']) {
      assert.ok(v.domains.includes(toxic), `Missing toxic domain ${toxic}`);
    }

    // F11.4
    for (const f of fs.readdirSync(path.join(ROOT, 'scripts')).filter((x) => x.endsWith('.mjs'))) {
      const src = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
      assert.equal(/api\.dataforseo\.com|dataforseo\.com\/v3/i.test(src), false, `DataForSEO endpoint in ${f}`);
      assert.equal(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(src), false, `Private key in ${f}`);
      assert.equal(/console\.(?:log|info|warn|error)\s*\([^)]*(?:process\.env\b|\.gcp-service-account\.json|readFileSync\([^)]*\.env\b)/i.test(src), false, `.env printing in ${f}`);
    }
  });
});

// ============================================================================
// Tier 5D: Isolated Temp-Sandbox CI Pipeline Invariants
// ============================================================================
describe('Tier 5D: Isolated temp-sandbox CI pipeline invariants', { concurrency: 1 }, () => {
  test('5D.1 Strict guard scripts exit 0 in live repo', async () => {
    const g1 = await runNodeScriptInDir(ROOT, 'scripts/gsc-consolidation-redirect-guard.mjs', ['--check', '--strict']);
    assert.equal(g1.code, 0, `gsc-consolidation-redirect-guard --strict failed: ${g1.stderr || g1.stdout}`);

    const g2 = await runNodeScriptInDir(ROOT, 'scripts/technical-seo-audit.mjs', ['--strict']);
    assert.equal(g2.code, 0, `technical-seo-audit --strict failed: ${g2.stderr || g2.stdout}`);
  });

  test('5D.2 CI pipeline scripts preserve canonical ordering, clean copy, and zero NOINDEX_PRUNE hijacks in isolated sandbox', { timeout: 360000 }, async () => {
    const sandbox = createRepoSandboxCopy();
    try {
      const beforeSitemap = fs.readFileSync(path.join(sandbox, 'website', 'sitemap.xml'), 'utf8');

      // 1. daily-seo-pagespeed-audit.mjs 0 --skip-keywords --no-crm
      const auditRun = await runNodeScriptInDir(sandbox, 'scripts/daily-seo-pagespeed-audit.mjs', ['0', '--skip-keywords', '--no-crm'], { blockNetworkFetch: true });
      assert.equal(auditRun.code, 0, `daily-seo-pagespeed-audit failed: ${auditRun.stderr || auditRun.stdout}`);

      // 2. daily-50-seo-pages.mjs 0 --force must preserve sitemap order and clean template strings
      const pseoRun = await runNodeScriptInDir(sandbox, 'scripts/daily-50-seo-pages.mjs', ['0', '--force'], { blockNetworkFetch: true });
      assert.equal(pseoRun.code, 0, `daily-50-seo-pages failed: ${pseoRun.stderr || pseoRun.stdout}`);
      const afterSitemap = fs.readFileSync(path.join(sandbox, 'website', 'sitemap.xml'), 'utf8');
      const locsOf = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      assert.equal(locsOf(afterSitemap).length, 99, 'daily-50-seo-pages 0 changed sitemap.xml count');
      assert.deepEqual(locsOf(afterSitemap), locsOf(beforeSitemap), 'daily-50-seo-pages 0 reordered sitemap.xml');
      const dirtyForceHits = [];
      for (const loc of locsOf(afterSitemap)) {
        const u = new URL(loc).pathname;
        if (!/^\/(solutions|guides|vs|setup)\//.test(u)) continue;
        const fp = resolveUrlPathToHtmlFile(u, path.join(sandbox, 'website'));
        if (!fp) continue;
        const html = fs.readFileSync(fp, 'utf8');
        if (
          /\bSWEEPR DeepBlock\b/.test(html) ||
          /automated automatic|automatically automatically|Auto-Rejected automatically|RAM Tamer \(Suite\)|8\/8\s+Live\s+Test\s+Lab|<\s*50\s*ms|sub-50\s*ms|<\s*15\s*[uμ]s|1\.2\.9/i.test(html)
        ) {
          dirtyForceHits.push(u);
        }
      }
      assert.deepEqual(dirtyForceHits, [], `daily-50-seo-pages 0 --force injected dirty copy in: ${JSON.stringify(dirtyForceHits.slice(0, 10))}`);

      // 3. apply-technical-seo-audit-fixes.mjs --no-crm followed by technical-seo-audit.mjs --strict
      const fixRun = await runNodeScriptInDir(sandbox, 'scripts/apply-technical-seo-audit-fixes.mjs', ['--no-crm'], { blockNetworkFetch: true });
      assert.equal(fixRun.code, 0, `apply-technical-seo-audit-fixes failed: ${fixRun.stderr || fixRun.stdout}`);
      const strictRun = await runNodeScriptInDir(sandbox, 'scripts/technical-seo-audit.mjs', ['--strict'], { blockNetworkFetch: true });
      assert.equal(strictRun.code, 0, `technical-seo-audit --strict after fixes failed: ${strictRun.stderr || strictRun.stdout}`);

      // 4. build-stage3-expansion-ads.mjs + competitor-review-miner.mjs write clean CSVs & never emit 404/consolidated/pruned URLs
      const adsRun = await runNodeScriptInDir(sandbox, 'scripts/build-stage3-expansion-ads.mjs', [], { blockNetworkFetch: true });
      assert.equal(adsRun.code, 0, `build-stage3-expansion-ads failed: ${adsRun.stderr || adsRun.stdout}`);
      for (const csvName of ['chatgpt-search-ads-stage3-export.csv', 'eu-de-fr-microsoft-ads-stage3.csv']) {
        const csvTxt = fs.readFileSync(path.join(sandbox, 'dist', csvName), 'utf8');
        assert.match(csvTxt, /283/);
        if (csvName === 'chatgpt-search-ads-stage3-export.csv') {
          assert.match(csvTxt, /1\.3\.1/);
        }
        assert.equal(
          /\b242\b|1\.2\.9|<15us|<50ms|scam stores|anti-estafas|8\/8|4 Devices/i.test(csvTxt),
          false,
          `Stale copy in sandbox ${csvName}`
        );
      }

      // Inject a synthetic missing-on-disk opportunity into sandbox keyword matrix and confirm competitor-review-miner.mjs skips it
      const kwPath = path.join(sandbox, 'data', 'keyword-opportunity-matrix.json');
      const kwData = fs.existsSync(kwPath) ? JSON.parse(fs.readFileSync(kwPath, 'utf8')) : { opportunities: [] };
      kwData.opportunities = [
        ...(Array.isArray(kwData.opportunities) ? kwData.opportunities : []),
        {
          keyword: 'synthetic missing tier5 route test',
          cluster: 'solutions',
          targetRoute: '/solutions/nonexistent-tier5-ad-landing-url',
          metrics: { estimatedKD: 10 },
          pageBlueprint: { h1: 'Missing Test', shortLinkTitle: 'Missing Test' }
        }
      ];
      fs.writeFileSync(kwPath, JSON.stringify(kwData, null, 2), 'utf8');
      const minerRun = await runNodeScriptInDir(sandbox, 'scripts/competitor-review-miner.mjs', [], { blockNetworkFetch: true });
      assert.equal(minerRun.code, 0, `competitor-review-miner failed: ${minerRun.stderr || minerRun.stdout}`);
      for (const a6Csv of ['microsoft-ads-a6-rsa-refresh.csv', 'reddit-ads-a6-refresh.csv']) {
        const csvTxt = fs.readFileSync(path.join(sandbox, 'dist', a6Csv), 'utf8');
        assert.equal(csvTxt.includes('/solutions/nonexistent-tier5-ad-landing-url'), false, `competitor-review-miner emitted 404 route in ${a6Csv}`);
        assert.equal(/8\/8|<50ms|scam stores|4 Devices|\b242\b|1\.2\.9|<15us/i.test(csvTxt), false, `Stale copy in sandbox ${a6Csv}`);
      }

      // Verify ALL live dist/*.csv files have zero stale claims and zero 404/consolidated/pruned landing URLs
      const liveDistDir = path.join(ROOT, 'dist');
      for (const csvFile of fs.readdirSync(liveDistDir).filter((f) => f.endsWith('.csv'))) {
        const csvTxt = fs.readFileSync(path.join(liveDistDir, csvFile), 'utf8');
        assert.equal(
          /\b242\b|1\.2\.9|<15us|<50ms|scam stores|anti-estafas|8\/8|4 Devices/i.test(csvTxt),
          false,
          `Stale/invalid copy found in dist/${csvFile}`
        );
        for (const uMatch of csvTxt.matchAll(/https:\/\/sweeprdeepblock\.com(\/[^\s,"']*)/gi)) {
          const urlPath = uMatch[1].split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
          assert.equal(CONSOLIDATE_301_MAP.has(urlPath), false, `Consolidated 301 landing URL ${urlPath} in dist/${csvFile}`);
          assert.equal(isNoIndexPrunePath(urlPath), false, `Noindex/pruned landing URL ${urlPath} in dist/${csvFile}`);
          assert.ok(resolveUrlPathToHtmlFile(urlPath), `Missing on-disk 404 landing URL ${urlPath} in dist/${csvFile}`);
        }
      }

      // 5. Verify M3/M4 pages with data-sweepr-related="1" were NOT polluted with #gsc-exact-query-enrichment
      const gscRun = await runNodeScriptInDir(sandbox, 'scripts/gsc-strike-zone-optimizer.mjs', [], { blockNetworkFetch: true });
      assert.equal(gscRun.code, 0, `gsc-strike-zone-optimizer failed: ${gscRun.stderr || gscRun.stdout}`);
      for (const m4File of [
        'website/setup/kiwi-browser-android.html',
        'website/solutions/crunchyroll-anime-streams-block-video-ads.html',
        'website/solutions/fandom-game-wikis-reduce-browser-ram-usage.html',
        'website/solutions/linkedin-feed-ads-block-video-ads.html',
        'website/vs/adguard-extension.html',
        'website/vs/pi-hole-dns-sinkhole.html'
      ]) {
        const html = fs.readFileSync(path.join(sandbox, m4File), 'utf8');
        assert.equal(html.includes('id="gsc-exact-query-enrichment"'), false, `gsc-strike-zone-optimizer polluted ${m4File}`);
      }
    } finally {
      await removeDirSafe(sandbox, 20, 200).catch(() => {});
    }
  });
});
