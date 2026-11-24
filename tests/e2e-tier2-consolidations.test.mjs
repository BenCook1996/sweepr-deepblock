import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_ORIGIN,
  WEBSITE_DIR,
  extractCanonical,
  extractMetaRobots,
  isDisallowedByRobots,
  normalizeUrlPath,
  parseRobotsTxt,
  parseSitemapIndex,
  parseSitemapUrls,
  resolveCniEnriched,
  resolveCutList94,
  runConcurrent,
  startEphemeralServer
} from './e2e-helpers.mjs';

const NON_INDEXABLE_ROUTES = [
  '/order',
  '/login',
  '/logos',
  '/mockups',
  '/popup-mockups',
  '/redesign-prototype',
  '/extension-ux-prototype',
  '/store-creatives',
  '/welcome-concepts',
  '/ios-app',
  '/sweepr-vpn-concepts',
  '/sweepr-vpn-mobile-redesign',
  '/icon-animations-mockup',
  '/ergonomic-mockup-1',
  '/ergonomic-mockup-2',
  '/ergonomic-mockup-3',
  '/ergonomic-mockup-4',
  '/ergonomic-mockup-5',
  '/memorisely-ui-audit'
];

const EXPLICIT_SERVER_301S = [
  { from: '/guides/block-youtube-ads', to: '/guides/how-to-block-youtube-ads-chrome-manifest-v3-2026' },
  { from: '/features/cookie-consent-blocker', to: '/guides/how-to-automatically-reject-cookie-banners-uk' },
  { from: '/cdn-cgi/l/email-protection', to: '/support' },
  { from: '/?home=1', to: '/' },
  { from: '/pricing/', to: '/pricing' },
  { from: '/pricing.html', to: '/pricing' },
  { from: '/index.html', to: '/' },
  { from: '/PRICING', to: '/pricing' },
  { from: '/campaigns/renewal-shock-switcher', to: '/vs/total-adblock' },
  { from: '/de/usercentrics-cookie-banner-blockieren', to: '/de' },
  { from: '/fr/bloquer-bandeau-cookie-didomi', to: '/fr' },
  { from: '/glossary/anti-adblock-bait-detection', to: '/test-lab' },
  { from: '/glossary/url-tracking-parameters-utm-fbclid-gclid', to: '/guides/strip-utm-fbclid-gclid-tracking-links' },
  { from: '/stories/switching-from-total-adblock-renewal-shock', to: '/vs/total-adblock' },
  { from: '/stories/youtube-mv3-zero-warning-playback', to: '/guides/how-to-fix-high-cpu-usage-from-youtube-anti-adblock' },
  { from: '/tools/is-my-adblocker-working', to: '/test-lab' }
];

function collectPseoNoindexCanonicals() {
  const dirs = ['solutions', 'setup', 'vs', 'guides', 'glossary'];
  const items = [];
  for (const dir of dirs) {
    const absDir = path.join(WEBSITE_DIR, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      const rel = `${dir}/${entry.name}`;
      const fromPath = `/${rel.slice(0, -5)}`;
      const headChunk = fs.readFileSync(path.join(absDir, entry.name), 'utf8').slice(0, 6144);
      const robots = extractMetaRobots(headChunk);
      const canonical = extractCanonical(headChunk);
      if (robots && /\bnoindex\b/i.test(robots) && canonical) {
        const targetPath = normalizeUrlPath(canonical);
        if (targetPath && targetPath !== fromPath) {
          items.push({ from: fromPath, to: targetPath, source: rel });
        }
      }
    }
  }
  return items;
}

let srv;

before(async () => {
  srv = await startEphemeralServer();
});

after(async () => {
  if (srv) await srv.stop();
});

test('Tier 2A: Sitemaps & robots.txt have zero duplicates, zero consolidation overlap, and 200 indexable responses', async () => {
  const mainSitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
  const siteSitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml'));
  const consolidationSitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-consolidations.xml'));
  const indexSitemap = parseSitemapIndex(path.join(WEBSITE_DIR, 'sitemap-index.xml'));
  const robots = parseRobotsTxt(path.join(WEBSITE_DIR, 'robots.txt'));

  assert.equal(mainSitemap.duplicates.length, 0, `Duplicate URLs in sitemap.xml: ${mainSitemap.duplicates.join(', ')}`);
  assert.equal(siteSitemap.duplicates.length, 0, `Duplicate URLs in sitemap-sites.xml: ${siteSitemap.duplicates.join(', ')}`);
  assert.match(siteSitemap.raw, /<urlset\b/i, 'website/sitemap-sites.xml must contain a valid <urlset> root');

  const indexPaths = new Set(indexSitemap.paths);
  assert.ok(indexPaths.has('/sitemap.xml'), 'sitemap-index.xml must include /sitemap.xml');
  if (siteSitemap.paths.length > 0) {
    assert.ok(indexPaths.has('/sitemap-sites.xml'), 'sitemap-index.xml must include /sitemap-sites.xml when sitemap-sites.xml is non-empty');
  } else {
    assert.ok(!indexPaths.has('/sitemap-sites.xml'), 'sitemap-index.xml must NOT include /sitemap-sites.xml when sitemap-sites.xml is empty');
    const leakedSitePaths = mainSitemap.paths.filter((p) => p === '/site' || p.startsWith('/site/'));
    assert.equal(
      leakedSitePaths.length,
      0,
      `sitemap.xml must not contain /site* URLs when sitemap-sites.xml is empty: ${leakedSitePaths.join(', ')}`
    );
    const siteRes = await fetch(`${srv.baseUrl}/site`, { redirect: 'manual' });
    if (siteRes.status === 200) {
      const siteXRobots = siteRes.headers.get('x-robots-tag') || '';
      const siteHtml = await siteRes.text();
      const siteMetaRobots = extractMetaRobots(siteHtml) || '';
      assert.match(siteXRobots, /\bnoindex\b/i, '/site (HTTP 200) must serve X-Robots-Tag: noindex when excluded from sitemaps');
      assert.match(siteMetaRobots, /\bnoindex\b/i, '/site (HTTP 200) must include <meta name="robots" content="noindex..."> when excluded from sitemaps');
    } else {
      await siteRes.body?.cancel().catch(() => {});
      assert.ok(
        siteRes.status === 404 || siteRes.status === 410,
        `/site must return HTTP 200+noindex or 404/410 when excluded from sitemaps, got ${siteRes.status}`
      );
    }
  }
  assert.ok(!indexPaths.has('/sitemap-consolidations.xml'), 'sitemap-index.xml must NOT include /sitemap-consolidations.xml');

  const mainSet = new Set(mainSitemap.paths);
  const siteSet = new Set(siteSitemap.paths);
  const consolidationSet = new Set(consolidationSitemap.paths);

  const mainSiteOverlap = mainSitemap.paths.filter((p) => siteSet.has(p));
  assert.equal(mainSiteOverlap.length, 0, `Overlap between sitemap.xml and sitemap-sites.xml: ${mainSiteOverlap.join(', ')}`);

  const mainConsolOverlap = mainSitemap.paths.filter((p) => consolidationSet.has(p));
  assert.equal(
    mainConsolOverlap.length,
    0,
    `Overlap between sitemap.xml and sitemap-consolidations.xml: ${mainConsolOverlap.join(', ')}`
  );

  const siteConsolOverlap = siteSitemap.paths.filter((p) => consolidationSet.has(p));
  assert.equal(
    siteConsolOverlap.length,
    0,
    `Overlap between sitemap-sites.xml and sitemap-consolidations.xml: ${siteConsolOverlap.join(', ')}`
  );

  const robotsBlocked = [...mainSitemap.paths, ...siteSitemap.paths].filter((p) =>
    isDisallowedByRobots(p, robots, '*')
  );
  assert.equal(
    robotsBlocked.length,
    0,
    `Sitemap URLs blocked by robots.txt: ${robotsBlocked.join(', ')}`
  );

  const allIndexablePaths = [...mainSitemap.paths, ...siteSitemap.paths];
  const failures = [];
  await runConcurrent(allIndexablePaths, 16, async (urlPath) => {
    const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
    if (res.status !== 200) {
      failures.push(`${urlPath}: HTTP ${res.status} (expected 200)`);
      return;
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (/\bnoindex\b/i.test(xRobots)) {
      failures.push(`${urlPath}: X-Robots-Tag contains noindex`);
    }
    const html = await res.text();
    const robotsMeta = extractMetaRobots(html);
    if (robotsMeta && /\bnoindex\b/i.test(robotsMeta)) {
      failures.push(`${urlPath}: meta robots contains noindex`);
    }
    const canonical = extractCanonical(html);
    const expectedCanonical = `${CANONICAL_ORIGIN}${urlPath === '/' ? '/' : urlPath}`;
    if (canonical !== expectedCanonical) {
      failures.push(`${urlPath}: canonical "${canonical}" !== "${expectedCanonical}"`);
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length} sitemap URL(s) failed indexability/200 check:\n  - ${failures.slice(0, 30).join('\n  - ')}`
  );
});

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

test('Tier 2B: Consolidation 301 routes (sitemap-consolidations, noindex+canonical HTML, server.js rules) resolve single-hop to 200 canonicals', async () => {
  const mainSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml')).paths);
  const siteSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml')).paths);
  const consolidationSitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-consolidations.xml'));
  const htmlConsolidations = collectPseoNoindexCanonicals();

  const expectedTargets = new Map();
  for (const p of consolidationSitemap.paths) {
    expectedTargets.set(p, null);
  }
  for (const item of htmlConsolidations) {
    expectedTargets.set(item.from, item.to);
  }
  for (const rule of EXPLICIT_SERVER_301S) {
    expectedTargets.set(rule.from, rule.to);
  }

  const routeEntries = [...expectedTargets.entries()];
  const failures = [];
  const verifiedTargets = new Map();

  await runConcurrent(routeEntries, 10, async ([fromPath, expectedTo]) => {
    if (mainSet.has(fromPath) || siteSet.has(fromPath)) {
      failures.push(`${fromPath}: consolidated 301 URL is still listed in sitemap.xml / sitemap-sites.xml`);
    }

    const res = await fetchWithRetry(`${srv.baseUrl}${fromPath}`, { redirect: 'manual' });
    await res.body?.cancel().catch(() => {});
    if (res.status !== 301) {
      failures.push(`${fromPath}: expected HTTP 301, got ${res.status}`);
      return;
    }
    const loc = (res.headers.get('location') || '').trim();
    if (!loc) {
      failures.push(`${fromPath}: 301 missing/empty Location header`);
      return;
    }
    let resolvedTarget;
    try {
      resolvedTarget = new URL(loc, srv.baseUrl);
    } catch {
      failures.push(`${fromPath}: 301 invalid Location "${loc}"`);
      return;
    }
    if (resolvedTarget.origin !== srv.baseUrl && resolvedTarget.origin !== CANONICAL_ORIGIN) {
      failures.push(`${fromPath}: 301 off-origin Location "${loc}" (origin=${resolvedTarget.origin})`);
      return;
    }
    const targetPath = resolvedTarget.pathname + resolvedTarget.search;
    if (expectedTo && targetPath !== expectedTo && resolvedTarget.pathname !== expectedTo) {
      failures.push(`${fromPath}: 301 Location "${targetPath}" !== expected "${expectedTo}"`);
      return;
    }
    if (targetPath === fromPath) {
      failures.push(`${fromPath}: 301 self-redirect loop`);
      return;
    }
    verifiedTargets.set(fromPath, resolvedTarget.pathname);
  });

  // Verify every unique 301 target returns HTTP 200 (no redirect chains!) and is indexable
  const uniqueTargetPaths = [...new Set(verifiedTargets.values())];
  await runConcurrent(uniqueTargetPaths, 10, async (targetPath) => {
    const res = await fetchWithRetry(`${srv.baseUrl}${targetPath}`, { redirect: 'manual' });
    if (res.status !== 200) {
      failures.push(`301 target ${targetPath}: expected HTTP 200 (zero chains), got ${res.status}`);
      return;
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (/\bnoindex\b/i.test(xRobots)) {
      failures.push(`301 target ${targetPath}: X-Robots-Tag contains noindex`);
    }
    const html = await res.text();
    const robotsMeta = extractMetaRobots(html);
    if (robotsMeta && /\bnoindex\b/i.test(robotsMeta)) {
      failures.push(`301 target ${targetPath}: target HTML contains noindex`);
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length} consolidation 301 issue(s):\n  - ${failures.slice(0, 40).join('\n  - ')}`
  );
});

test('Tier 2C: NON_INDEXABLE_PAGES return X-Robots-Tag noindex, nofollow and are absent from sitemaps', async () => {
  const mainSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml')).paths);
  const siteSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml')).paths);
  const failures = [];

  for (const route of NON_INDEXABLE_ROUTES) {
    if (mainSet.has(route) || siteSet.has(route)) {
      failures.push(`${route}: listed in sitemap despite being NON_INDEXABLE_PAGES`);
    }
    const res = await fetch(`${srv.baseUrl}${route}`, { redirect: 'manual' });
    if (res.status === 404) continue; // Only check existing files
    if (res.status !== 200) {
      failures.push(`${route}: expected HTTP 200 (or 404 if removed), got ${res.status}`);
      continue;
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (!/noindex/i.test(xRobots) || !/nofollow/i.test(xRobots)) {
      failures.push(`${route}: expected X-Robots-Tag: noindex, nofollow, got "${xRobots}"`);
    }
  }

  assert.equal(failures.length, 0, failures.join('\n'));
});

function normalizeLinkPath(pathname) {
  let p = String(pathname || '/').trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '/index.html') return '/';
  if (p.endsWith('.html')) p = p.slice(0, -5) || '/';
  return p;
}

test('Tier 2D: Dynamic CUT_LIST_94.json enforcement (KEEP_REWRITE, CONSOLIDATE_301, NOINDEX_PRUNE)', async (t) => {
  const cutList = resolveCutList94();
  if (!cutList) {
    t.skip('CUT_LIST_94.json not present yet (pending M1 completion); skipping 94-URL cut-list verification.');
    return;
  }

  const cniEnriched = resolveCniEnriched();
  const entries = cutList.entries;
  assert.ok(entries.length >= 94, `Expected at least 94 entries in ${cutList.path}, got ${entries.length}`);

  if (cniEnriched) {
    const expectedPaths = new Set(cniEnriched.entries.map((e) => normalizeUrlPath(e?.url || e?.path)).filter(Boolean));
    const actualPaths = new Set(
      entries
        .map((e) => {
          const raw =
            typeof e?.path === 'string' && e.path.trim()
              ? e.path
              : typeof e?.url === 'string' && e.url.trim()
              ? e.url
              : '';
          return raw ? normalizeUrlPath(raw) : '';
        })
        .filter(Boolean)
    );
    const missing = [...expectedPaths].filter((p) => !actualPaths.has(p));
    assert.equal(missing.length, 0, `CUT_LIST_94.json missing CNI URL(s): ${missing.join(', ')}`);
  }

  const mainSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml')).paths);
  const siteSet = new Set(parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml')).paths);
  const validActions = new Set(['KEEP_REWRITE', 'CONSOLIDATE_301', 'NOINDEX_PRUNE']);

  // Build inbound internal link map from all active sitemap pages for NOINDEX_PRUNE deletion checks
  const inboundLinks = new Map();
  const activeSitemapPaths = [...mainSet, ...siteSet];
  await runConcurrent(activeSitemapPaths, 16, async (srcPath) => {
    const res = await fetch(`${srv.baseUrl}${srcPath}`, { redirect: 'manual' });
    if (res.status !== 200) return;
    const html = await res.text();
    const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '');
    for (const m of cleanHtml.matchAll(/<a\b[^>]*(?<![-\w])href=(?:"([^"#]+)(?:#[^"]*)?"|'([^'#]+)(?:#[^']*)?'|([^\s"'=<>`#]+)(?:#[^\s"'=<>`]*)?)/gi)) {
      const rawHref = m[1] ?? m[2] ?? m[3] ?? '';
      const href = rawHref.trim();
      if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      try {
        const u = new URL(href, `${CANONICAL_ORIGIN}${srcPath}`);
        if (u.origin === CANONICAL_ORIGIN) {
          const normPath = normalizeLinkPath(u.pathname);
          if (!inboundLinks.has(normPath)) inboundLinks.set(normPath, []);
          inboundLinks.get(normPath).push(srcPath);
        }
      } catch {}
    }
  });

  const failures = [];
  await runConcurrent(entries, 16, async (entry, idx) => {
    const rawTarget =
      typeof entry?.path === 'string' && entry.path.trim()
        ? entry.path
        : typeof entry?.url === 'string' && entry.url.trim()
        ? entry.url
        : null;
    if (!rawTarget) {
      failures.push(`entry[${idx}]: missing or non-string path/url (${JSON.stringify(entry?.path ?? entry?.url)})`);
      return;
    }
    const urlPath = normalizeUrlPath(rawTarget);
    const action = entry.action;
    if (!validActions.has(action)) {
      failures.push(`${urlPath}: invalid action "${action}"`);
      return;
    }

    if (action === 'KEEP_REWRITE') {
      if (!mainSet.has(urlPath) && !siteSet.has(urlPath)) {
        failures.push(`${urlPath} (KEEP_REWRITE): missing from sitemap.xml`);
      }
      const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
      if (res.status !== 200) {
        failures.push(`${urlPath} (KEEP_REWRITE): expected HTTP 200, got ${res.status}`);
        return;
      }
      const xRobots = res.headers.get('x-robots-tag') || '';
      if (/\bnoindex\b/i.test(xRobots)) {
        failures.push(`${urlPath} (KEEP_REWRITE): X-Robots-Tag contains noindex ("${xRobots}")`);
      }
      const html = await res.text();
      const robots = extractMetaRobots(html);
      if (robots && /\bnoindex\b/i.test(robots)) {
        failures.push(`${urlPath} (KEEP_REWRITE): still marked noindex`);
      }
      const canonical = extractCanonical(html);
      const expected = `${CANONICAL_ORIGIN}${urlPath}`;
      if (canonical !== expected) {
        failures.push(`${urlPath} (KEEP_REWRITE): canonical "${canonical}" !== "${expected}"`);
      }
    } else if (action === 'CONSOLIDATE_301') {
      if (mainSet.has(urlPath) || siteSet.has(urlPath)) {
        failures.push(`${urlPath} (CONSOLIDATE_301): still present in sitemap`);
      }
      if (typeof entry.redirectTarget !== 'string' || !entry.redirectTarget.trim()) {
        failures.push(`${urlPath} (CONSOLIDATE_301): missing or non-string redirectTarget`);
        return;
      }
      const expectedTarget = normalizeUrlPath(entry.redirectTarget);
      const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
      await res.body?.cancel().catch(() => {});
      if (res.status !== 301) {
        failures.push(`${urlPath} (CONSOLIDATE_301): expected HTTP 301, got ${res.status}`);
        return;
      }
      const rawLoc = (res.headers.get('location') || '').trim();
      if (!rawLoc) {
        failures.push(`${urlPath} (CONSOLIDATE_301): 301 missing/empty Location header`);
        return;
      }
      let resolvedLoc;
      try {
        resolvedLoc = new URL(rawLoc, srv.baseUrl);
      } catch {
        failures.push(`${urlPath} (CONSOLIDATE_301): 301 invalid Location "${rawLoc}"`);
        return;
      }
      if (resolvedLoc.origin !== srv.baseUrl && resolvedLoc.origin !== CANONICAL_ORIGIN) {
        failures.push(`${urlPath} (CONSOLIDATE_301): 301 off-origin Location "${rawLoc}" (origin=${resolvedLoc.origin})`);
        return;
      }
      const locWithSearch = normalizeUrlPath(resolvedLoc.pathname + resolvedLoc.search);
      const destPath = normalizeUrlPath(resolvedLoc.pathname);
      if (locWithSearch !== expectedTarget) {
        failures.push(`${urlPath} (CONSOLIDATE_301): Location "${locWithSearch}" !== "${expectedTarget}"`);
        return;
      }
      const destRes = await fetch(`${srv.baseUrl}${locWithSearch}`, { redirect: 'manual' });
      if (destRes.status !== 200) {
        failures.push(`${urlPath} (CONSOLIDATE_301): destination ${locWithSearch} returned HTTP ${destRes.status} (expected 200)`);
        return;
      }
      const destXRobots = destRes.headers.get('x-robots-tag') || '';
      if (/\bnoindex\b/i.test(destXRobots)) {
        failures.push(`${urlPath} (CONSOLIDATE_301): destination ${locWithSearch} X-Robots-Tag contains noindex ("${destXRobots}")`);
      }
      const destHtml = await destRes.text();
      const destRobots = extractMetaRobots(destHtml);
      if (destRobots && /\bnoindex\b/i.test(destRobots)) {
        failures.push(`${urlPath} (CONSOLIDATE_301): destination ${locWithSearch} is noindex`);
      }
      const destCanonical = extractCanonical(destHtml);
      const expectedDestCanonical = `${CANONICAL_ORIGIN}${destPath}`;
      if (destCanonical !== expectedDestCanonical) {
        failures.push(
          `${urlPath} (CONSOLIDATE_301): destination ${destPath} canonical "${destCanonical}" !== "${expectedDestCanonical}"`
        );
      }
    } else if (action === 'NOINDEX_PRUNE') {
      if (mainSet.has(urlPath) || siteSet.has(urlPath)) {
        failures.push(`${urlPath} (NOINDEX_PRUNE): still present in sitemap`);
      }
      const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
      if (res.status === 404 || res.status === 410) {
        const callers = inboundLinks.get(normalizeLinkPath(urlPath)) || [];
        if (callers.length > 0) {
          failures.push(
            `${urlPath} (NOINDEX_PRUNE, ${res.status}): still has ${callers.length} inbound internal link(s) from ${callers.slice(0, 3).join(', ')}`
          );
        }
      } else if (res.status === 200) {
        const xRobots = res.headers.get('x-robots-tag') || '';
        const html = await res.text();
        const metaRobots = extractMetaRobots(html) || '';
        if (!/\bnoindex\b/i.test(xRobots) && !/\bnoindex\b/i.test(metaRobots)) {
          failures.push(`${urlPath} (NOINDEX_PRUNE, 200): missing noindex directive in X-Robots-Tag or meta robots`);
        }
        const canonical = extractCanonical(html);
        const expectedSelf = `${CANONICAL_ORIGIN}${urlPath}`;
        if (!canonical || canonical !== expectedSelf) {
          failures.push(`${urlPath} (NOINDEX_PRUNE, 200): canonical "${canonical || '(missing)'}" must be self "${expectedSelf}"`);
        }
      } else {
        failures.push(`${urlPath} (NOINDEX_PRUNE): unexpected HTTP ${res.status} (expected 200+noindex or 404/410; must not 301)`);
      }
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length}/${entries.length} CUT_LIST_94.json assertion(s) failed:\n  - ${failures.slice(0, 40).join('\n  - ')}`
  );
});
