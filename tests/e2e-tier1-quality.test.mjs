import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_ORIGIN,
  WEBSITE_DIR,
  collectJsonLdFields,
  collectJsonLdTypes,
  extractAllCanonicals,
  extractAllMetaRobots,
  extractAllMetaTags,
  extractJsonLdBlocks,
  extractVisibleText,
  parseHtmlAttrs,
  parseSitemapUrls,
  readDynamicDeltaVersion,
  readExtensionManifest,
  runConcurrent,
  startEphemeralServer,
  stripNonProseForBacktickCheck
} from './e2e-helpers.mjs';

const REMOVED_FEATURE_RULES = [
  {
    name: 'fake_shop_or_review_detector',
    re: /\b(?:fake\s+(?:online\s+)?(?:shop|store|website)s?\s+(?:and\s+(?:fake\s+)?(?:amazon|trustpilot)\s+reviews?\s+)?(?:detector|checker|warning|alerts?)|fake\s+(?:online\s+)?shop\s+(?:alerts?|detector)|warns?\s+you\s+about\s+(?:suspicious\s+scam\s+shopping|fake\s+online\s+shops?)|scam\s+(?:online\s+)?shop\s+(?:alerts?|detector)|fake\s+(?:amazon|trustpilot)\s+reviews?\s+(?:detector|checker))/gi
  },
  {
    name: 'ai_slop_search_cleanser',
    re: /\b(?:ai\s+slop\s+(?:search\s+)?(?:cleanser|filter|blocker)|hide(?:s|ing)?\s+(?:spam\s+websites|search\s+engine\s+spam)\s+in\s+search|hide\s+search\s+engine\s+spam|search\s+(?:result|engine)\s+spam\s+(?:cleanser|filter|hiding))/gi
  },
  {
    name: 'recipe_clutter_stripper',
    re: /\b(?:recipe\s+(?:clutter|stripper|cleaner)|messy\s+news\s+(?:&|and)\s+recipe\s+websites?)/gi
  },
  {
    name: 'encrypted_dns_proxy',
    re: /\b(?:encrypted\s+dns\s+proxy|dns-over-https\s*\(?doh\)?\s+proxy|sweepr\s+doh\s+dns|built-in\s+doh\s+dns)\b/gi
  },
  {
    name: 'ios_safari_orion_support',
    re: /\b(?:ios\s+safari|orion\s*\(?macos\s*(?:&|and)\s*ios\)?|safari\s*\(?macos\s*(?:&|and)\s*ios\)?|(?:works?|supports?)\s+(?:on\s+|in\s+)?(?:(?!\b(?:vs\.?|versus|unlike|compared\s+(?:to|with)|instead\s+of)\b)[^.!?\n]){0,120}(?<!\b(?:1blocker|adguard|wipr|ublock(?:\s+origin)?|ghostery|total\s+adblock|adblock\s+plus|better\s+blocker)\s+for\s+)\bsafari(?!-only\b)|(?:chrome|edge|firefox|brave|opera)(?:(?!\b(?:vs\.?|versus|unlike|compared\s+(?:to|with)|instead\s+of)\b)[^.!?\n]){0,100}(?<!\b(?:1blocker|adguard|wipr|ublock(?:\s+origin)?|ghostery|total\s+adblock|adblock\s+plus|better\s+blocker)\s+for\s+)\bsafari(?!-only\b)|\bsafari\s*(?:&|and|,)\s*(?:brave|edge|chrome|firefox|opera))/gi
  }
];

const DISCLAIMER_RE =
  /\b(?:coming soon|planned|not yet supported|not yet available|not supported|not available|unsupported|unavailable|no longer|(?:was|were|been|is)\s+removed|removed\s+(?:in|from)\b|discontinued|(?:does not|doesn't|do not|don't)\s+(?:include|support|ship|offer|provide|cover)|not\s+(?:currently\s+)?ship(?:ped)?|in\s+(?:final\s+)?development|when\s+launched|upon\s+release|retired|sunset)\b/i;

const DARK_SHELL_PATTERNS = [
  { name: '#090d16', re: /#090d16/i },
  { name: '#0b0f19', re: /#0b0f19/i },
  { name: '#0f172a', re: /#0f172a/i },
  { name: '#020617', re: /#020617/i },
  { name: 'bg-slate-950', re: /\bbg-slate-950\b/ },
  { name: 'bg-slate-900', re: /\bbg-slate-900\b/ },
  { name: 'bg-gray-950', re: /\bbg-gray-950\b/ },
  { name: 'bg-zinc-950', re: /\bbg-zinc-950\b/ },
  { name: 'bg-neutral-950', re: /\bbg-neutral-950\b/ },
  { name: 'bg-black', re: /\bbg-black\b/ },
  { name: 'from-slate-950', re: /\bfrom-slate-950\b/ },
  { name: 'from-slate-900', re: /\bfrom-slate-900\b/ },
  { name: 'bg-[#...]', re: /bg-\[#(?:090d16|0b0f19|0f172a|020617)\]/i },
  { name: 'inline-dark-background', re: /background(?:-color|-image)?\s*:[^;"]*(?:#090d16|#0b0f19|#0f172a|#020617)/i }
];

function getWrapperSurfaceFragments(htmlNoComments) {
  const fragments = [];
  for (const m of htmlNoComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = m[1];
    for (const rule of css.matchAll(/(?:html|body|main)\s*\{[^}]*\}/gi)) {
      fragments.push(rule[0]);
    }
  }
  const strippedTagsSource = htmlNoComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  for (const m of strippedTagsSource.matchAll(/<(html|body|header|main|footer|section|div)\b([^>]*)>/gi)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const fullTag = m[0];
    if (tag === 'html' || tag === 'body' || tag === 'header' || tag === 'main' || tag === 'footer') {
      fragments.push(fullTag);
      continue;
    }
    const parsedAttrs = parseHtmlAttrs(attrs);
    const classAttr = parsedAttrs.class || '';
    const idAttr = parsedAttrs.id || '';
    const isFullHeightAttr =
      /\bmin-h-(?:screen|full|\[100(?:vh|dvh|svh)\])\b/i.test(attrs) ||
      /min-height\s*:\s*100(?:vh|%)/i.test(attrs);
    // Preserve clean exemptions for non-full-height .suite-obsidian-card, hero browser preview mockup, and div.aspect-video mockups
    if (
      !isFullHeightAttr &&
      (/\bsuite-obsidian-card\b/i.test(classAttr) ||
        idAttr.toLowerCase() === 'herosliderstage' ||
        (tag === 'div' && /\baspect-video\b/i.test(classAttr)))
    ) {
      continue;
    }
    const isFullPageWrapper =
      tag === 'section' ||
      isFullHeightAttr;
    if (isFullPageWrapper) {
      fragments.push(fullTag);
    }
  }
  const bodyFirstChild = strippedTagsSource.match(/<body\b[^>]*>\s*(<(?:div|section)\b[^>]*>)/i);
  if (bodyFirstChild) {
    fragments.push(bodyFirstChild[1]);
  }
  return fragments.join('\n');
}

function hasStylesheetRef(htmlNoComments, assetPath) {
  for (const m of htmlNoComments.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = parseHtmlAttrs(m[1]);
    const relTokens = (attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!relTokens.includes('stylesheet')) continue;
    const hrefPath = (attrs.href || '').split('?')[0].trim();
    if (hrefPath.toLowerCase() === assetPath.toLowerCase()) return true;
  }
  return false;
}

function hasScriptRef(htmlNoComments, assetPath) {
  for (const m of htmlNoComments.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = parseHtmlAttrs(m[1]);
    if (!attrs.src) continue;
    const srcPath = attrs.src.split('?')[0].trim();
    if (srcPath.toLowerCase() === assetPath.toLowerCase()) return true;
  }
  return false;
}

function compareSemver(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function findStaleVersion(text, manifestVersion, allowBare = false, exemptVersions = []) {
  const str = String(text || '');
  const exemptSet = new Set((exemptVersions || []).filter(Boolean));
  const re = allowBare
    ? /(?<!\d\.)\b(?:v|version(?::\s*|\s+)|release\s+|build\s+|update\s+)?(1\.\d+\.\d+)\b(?!\.\d)/gi
    : /(?<!\d\.)\b(?:v|version(?::\s*|\s+)|deepblock\s+|release\s+|build\s+|update\s+)(1\.\d+\.\d+)\b(?!\.\d)|(?<!\d\.)\b(1\.[0-2]\.\d+)\b(?!\.\d)/gi;
  let m;
  while ((m = re.exec(str)) !== null) {
    const ver = m[1] || m[2];
    if (ver && !exemptSet.has(ver) && compareSemver(ver, manifestVersion) < 0) {
      return m[0];
    }
  }
  return null;
}

function getSentenceSlice(text, matchStart, matchEnd) {
  let start = 0;
  for (let i = matchStart - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '\n') {
      start = i + 1;
      break;
    }
    if ((ch === '.' || ch === '!' || ch === '?') && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = matchEnd; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') {
      end = i;
      break;
    }
    if ((ch === '.' || ch === '!' || ch === '?') && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      end = i + 1;
      break;
    }
  }
  return text.slice(start, end);
}

function findUnexemptedRemovedClaims(proseText) {
  const hits = [];
  for (const rule of REMOVED_FEATURE_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(proseText)) !== null) {
      const ctx = getSentenceSlice(proseText, m.index, m.index + m[0].length);
      if (!DISCLAIMER_RE.test(ctx)) {
        hits.push(`${rule.name}: "${m[0]}"`);
        break;
      }
    }
  }
  return hits;
}

function auditHtmlPage(urlPath, resStatus, headers, html, manifestVersion, { expectNoindex = false, exemptVersions = [] } = {}) {
  const issues = [];

  if (resStatus !== 200) {
    issues.push(`HTTP ${resStatus} (expected 200)`);
    return issues;
  }

  const htmlNoComments = String(html || '').replace(/<!--[\s\S]*?-->/g, '');

  // 1. Indexability & Canonical (including duplicate checks)
  const xRobots = headers.get('x-robots-tag') || '';
  const robotsTags = extractAllMetaRobots(htmlNoComments);
  if (expectNoindex) {
    if (!/\bnoindex\b/i.test(xRobots)) {
      issues.push(`X-Robots-Tag missing noindex ("${xRobots || '(absent)'}")`);
    }
    if (robotsTags.length === 0) {
      issues.push('missing <meta name="robots"> (expected noindex)');
    } else if (robotsTags.length > 1) {
      issues.push(`duplicate <meta name="robots"> (${robotsTags.length} tags)`);
    } else if (!/\bnoindex\b/i.test(robotsTags[0])) {
      issues.push(`<meta name="robots"> missing noindex ("${robotsTags[0]}")`);
    }
  } else {
    if (/\bnoindex\b/i.test(xRobots)) {
      issues.push(`X-Robots-Tag contains noindex ("${xRobots}")`);
    }
    if (robotsTags.length > 1) {
      issues.push(`duplicate <meta name="robots"> (${robotsTags.length} tags)`);
    }
    if (robotsTags.some((r) => /\bnoindex\b/i.test(r))) {
      issues.push(`<meta name="robots"> contains noindex ("${robotsTags.join(', ')}")`);
    }
  }
  const canonicals = extractAllCanonicals(htmlNoComments);
  const expectedCanonical = `${CANONICAL_ORIGIN}${urlPath === '/' ? '/' : urlPath}`;
  if (canonicals.length === 0) {
    issues.push('missing <link rel="canonical">');
  } else if (canonicals.length > 1) {
    issues.push(`duplicate <link rel="canonical"> (${canonicals.length} tags)`);
  } else if (canonicals[0] !== expectedCanonical) {
    issues.push(`canonical mismatch: got "${canonicals[0]}", expected "${expectedCanonical}"`);
  }

  // 2. Holographic Pearl Light Design Parity (comments already stripped!)
  if (!hasStylesheetRef(htmlNoComments, '/sweepr-tailwind.min.css')) {
    issues.push('missing <link rel="stylesheet" href="/sweepr-tailwind.min.css">');
  }
  if (!hasStylesheetRef(htmlNoComments, '/style.css')) {
    issues.push('missing <link rel="stylesheet" href="/style.css">');
  }
  if (!hasScriptRef(htmlNoComments, '/nav.js')) {
    issues.push('missing <script src="/nav.js">');
  }
  if (!/<nav\b[^>]*class=["'][^"']*\bglass-nav\b/i.test(htmlNoComments)) {
    issues.push('missing .glass-nav');
  }
  if (/\bid=["']deepblock-live-rule-proof["']/i.test(htmlNoComments)) {
    issues.push('contains banned #deepblock-live-rule-proof');
  }

  const surfaceCheckHtml = getWrapperSurfaceFragments(htmlNoComments);
  for (const pat of DARK_SHELL_PATTERNS) {
    if (pat.re.test(surfaceCheckHtml)) {
      issues.push(`dark surface token detected on body/wrapper (${pat.name})`);
    }
  }

  // 3. Content & Version Hygiene
  const proseWithoutCode = stripNonProseForBacktickCheck(html);
  if (/(?:`|&#0*96;|&#x0*60;|&grave;)/i.test(proseWithoutCode)) {
    issues.push('raw markdown backtick (`) in visible prose');
  }

  const visibleText = extractVisibleText(html);
  const titleMatch = htmlNoComments.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1] : '';
  const allMetaTags = extractAllMetaTags(htmlNoComments);
  const metaContents = allMetaTags.map((t) => t.content).filter(Boolean);
  const descMetaContents = allMetaTags
    .filter((t) => ['description', 'og:description', 'twitter:description', 'og:title', 'twitter:title'].includes((t.name || t.property || '').toLowerCase()))
    .map((t) => t.content)
    .filter(Boolean);
  const imgAlts = [...htmlNoComments.matchAll(/<img\b([^>]*)>/gi)]
    .map((m) => parseHtmlAttrs(m[1]).alt || '')
    .filter(Boolean);

  const textToCheckCasing = [titleText, ...metaContents, ...imgAlts, visibleText].join(' ');
  if (/\bSWEEPR\s+DeepBlock\b/.test(textToCheckCasing)) {
    issues.push('inconsistent brand casing "SWEEPR DeepBlock" (expected "SWEEPR Deepblock")');
  }

  const staleVer = findStaleVersion([titleText, ...descMetaContents, visibleText].join(' '), manifestVersion, false, exemptVersions);
  if (staleVer) {
    issues.push(`stale version "${staleVer}" (manifest is ${manifestVersion})`);
  }

  const removedClaims = findUnexemptedRemovedClaims([proseWithoutCode, ...descMetaContents].join(' . '));
  for (const claim of removedClaims) {
    issues.push(`removed/unshipped feature claim (${claim})`);
  }

  // 4. JSON-LD Syntax, Types & Metadata
  const { blocks, errors } = extractJsonLdBlocks(htmlNoComments);
  for (const err of errors) {
    issues.push(err);
  }
  for (const block of blocks) {
    const types = collectJsonLdTypes(block);
    if (types.includes('FAQPage') || types.includes('HowTo')) {
      issues.push(`deprecated JSON-LD @type detected (${types.filter((t) => t === 'FAQPage' || t === 'HowTo').join(', ')})`);
    }
    const fields = collectJsonLdFields(block, [
      'softwareVersion',
      'operatingSystem',
      'featureList',
      'dependencies',
      'description',
      'name',
      'headline',
      'alternateName'
    ]);
    for (const f of fields) {
      const valStr = Array.isArray(f.value) ? f.value.join(', ') : String(f.value || '');
      if (!valStr) continue;
      if (/\bSWEEPR\s+DeepBlock\b/.test(valStr)) {
        issues.push(`JSON-LD ${f.key} inconsistent brand casing "SWEEPR DeepBlock"`);
      }
      if (f.key === 'softwareVersion' && valStr !== manifestVersion) {
        issues.push(`JSON-LD softwareVersion="${valStr}" !== "${manifestVersion}"`);
      }
      if (f.key === 'dependencies') {
        const staleDep = findStaleVersion(valStr, manifestVersion, true);
        if (staleDep) {
          issues.push(`JSON-LD dependencies stale version "${staleDep}" (manifest is ${manifestVersion})`);
        }
      }
      if (['description', 'name', 'headline', 'alternateName', 'featureList'].includes(f.key)) {
        const staleFieldVer = findStaleVersion(valStr, manifestVersion, false, exemptVersions);
        if (staleFieldVer) {
          issues.push(`JSON-LD ${f.key} stale version "${staleFieldVer}" (manifest is ${manifestVersion})`);
        }
      }
      if (f.key === 'operatingSystem' && /\b(safari|ios|orion)\b/i.test(valStr)) {
        issues.push(`JSON-LD operatingSystem claims unsupported platform ("${valStr}")`);
      }
      if (['featureList', 'description', 'name', 'headline'].includes(f.key)) {
        const jsonLdClaims = findUnexemptedRemovedClaims(valStr);
        for (const claim of jsonLdClaims) {
          issues.push(`JSON-LD ${f.key} claims removed feature (${claim})`);
        }
      }
    }
  }

  return issues;
}

let srv;
let manifest;
let deltaVersion = null;

before(async () => {
  manifest = readExtensionManifest();
  deltaVersion = readDynamicDeltaVersion();
  srv = await startEphemeralServer();
});

after(async () => {
  if (srv) await srv.stop();
});

test('Tier 1 Baseline Control: homepage / passes 100% of design parity, hygiene, and JSON-LD checks', async () => {
  const exemptVersions = deltaVersion ? [deltaVersion] : [];
  const res = await fetch(`${srv.baseUrl}/`, { redirect: 'manual' });
  const html = await res.text();
  const issues = auditHtmlPage('/', res.status, res.headers, html, manifest.version, { exemptVersions });
  assert.deepEqual(issues, [], `Homepage / failed Tier 1 quality checks:\n - ${issues.join('\n - ')}`);
});

test('Tier 1A: all URLs in website/sitemap.xml return 200 and pass Holographic Pearl parity, hygiene, and JSON-LD checks', async () => {
  const sitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
  assert.ok(sitemap.paths.length > 0, 'website/sitemap.xml must contain at least 1 URL');
  const exemptVersions = deltaVersion ? [deltaVersion] : [];

  const failures = [];
  await runConcurrent(sitemap.paths, 16, async (urlPath) => {
    const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
    const html = await res.text();
    const issues = auditHtmlPage(urlPath, res.status, res.headers, html, manifest.version, { exemptVersions });
    if (issues.length > 0) {
      failures.push(`${urlPath}: ${issues.join('; ')}`);
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length}/${sitemap.paths.length} sitemap.xml URL(s) failed Tier 1 quality checks:\n${failures
      .slice(0, 40)
      .map((f) => '  - ' + f)
      .join('\n')}${failures.length > 40 ? `\n  ... and ${failures.length - 40} more` : ''}`
  );
});

test('Tier 1B: /site and /site/* (via sitemap-sites.xml or NOINDEX_PRUNE website/site/*.html) pass design parity, hygiene, and JSON-LD checks', async () => {
  const siteMap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml'));
  const mainSitemap = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml'));
  const exemptVersions = deltaVersion ? [deltaVersion] : [];

  if (siteMap.paths.length > 0) {
    const failures = [];
    await runConcurrent(siteMap.paths, 16, async (urlPath) => {
      const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
      const html = await res.text();
      const issues = auditHtmlPage(urlPath, res.status, res.headers, html, manifest.version, {
        expectNoindex: false,
        exemptVersions
      });
      if (issues.length > 0) {
        failures.push(`${urlPath}: ${issues.join('; ')}`);
      }
    });

    assert.equal(
      failures.length,
      0,
      `${failures.length}/${siteMap.paths.length} sitemap-sites.xml URL(s) failed Tier 1 quality checks:\n${failures
        .slice(0, 30)
        .map((f) => '  - ' + f)
        .join('\n')}${failures.length > 30 ? `\n  ... and ${failures.length - 30} more` : ''}`
    );
    return;
  }

  const leakedSitePaths = mainSitemap.paths.filter((p) => p === '/site' || p.startsWith('/site/'));
  assert.equal(
    leakedSitePaths.length,
    0,
    `sitemap.xml must not contain NOINDEX_PRUNE /site* URLs when sitemap-sites.xml is empty: ${leakedSitePaths.join(', ')}`
  );

  const siteDir = path.join(WEBSITE_DIR, 'site');
  const siteFiles = fs.existsSync(siteDir)
    ? fs
        .readdirSync(siteDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.html'))
        .map((e) => (e.name === 'index.html' ? '/site' : `/site/${e.name.slice(0, -5)}`))
    : [];

  if (siteFiles.length === 0) {
    const res = await fetch(`${srv.baseUrl}/site`, { redirect: 'manual' });
    await res.body?.cancel().catch(() => {});
    assert.ok(
      res.status === 404 || res.status === 410,
      `/site must return 404 or 410 when website/site/*.html is absent, got HTTP ${res.status}`
    );
    return;
  }

  const failures = [];
  await runConcurrent(siteFiles, 16, async (urlPath) => {
    const res = await fetch(`${srv.baseUrl}${urlPath}`, { redirect: 'manual' });
    const html = await res.text();
    const issues = auditHtmlPage(urlPath, res.status, res.headers, html, manifest.version, {
      expectNoindex: true,
      exemptVersions
    });
    if (issues.length > 0) {
      failures.push(`${urlPath}: ${issues.join('; ')}`);
    }
  });

  assert.equal(
    failures.length,
    0,
    `${failures.length}/${siteFiles.length} NOINDEX_PRUNE /site* page(s) failed Tier 1B checks:\n${failures
      .slice(0, 30)
      .map((f) => '  - ' + f)
      .join('\n')}${failures.length > 30 ? `\n  ... and ${failures.length - 30} more` : ''}`
  );
});
