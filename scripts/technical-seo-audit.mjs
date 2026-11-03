import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const SERVER_PATH = path.join(ROOT_DIR, 'server.js');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const htmlFiles = walk(WEBSITE_DIR);
console.log(`[AUDIT] Found ${htmlFiles.length} HTML files in website/`);

const results = {
  htmlIssues: [],
  htmlWarnings: [],
  pagesAnalyzed: htmlFiles.length,
  indexablePages: 0,
  nonIndexablePages: 0,
  serverAudit: {},
  scriptsAudit: {}
};

// Build index of clean routes & track noindex PSEO routes
const existingCleanRoutes = new Set();
const noIndexPseoRoutes = new Set();
const incomingInternalLinks = new Map();
for (const f of htmlFiles) {
  const rel = path.relative(WEBSITE_DIR, f).replace(/\\/g, '/');
  const clean = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
  existingCleanRoutes.add(clean);
  if (/^(solutions|setup|vs|guides)\//i.test(rel)) {
    const raw = fs.readFileSync(f, 'utf8');
    if (/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw)) {
      noIndexPseoRoutes.add(clean);
    }
  }
}
// Add website static assets & download files
const websiteRootFiles = fs.readdirSync(WEBSITE_DIR);
for (const rf of websiteRootFiles) {
  existingCleanRoutes.add('/' + rf);
  existingCleanRoutes.add('/download/' + rf);
}

for (const filePath of htmlFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const isNoIndex = /meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content);

  if (isNoIndex) {
    results.nonIndexablePages++;
    if (/^(solutions|setup|vs|guides)\//i.test(rel)) {
      const canMatchNoIdx = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
      const selfUrl = `https://sweeprdeepblock.com/${rel.replace(/\.html$/, '')}`;
      if (!canMatchNoIdx || canMatchNoIdx[1].trim() === selfUrl) {
        results.htmlWarnings.push({
          file: rel,
          type: 'noindex_self_canonical',
          msg: 'Consolidated noindex PSEO page should canonicalize to its parent Pillar URL'
        });
      }
      for (const m of content.matchAll(/<a\s+[^>]*href=["'](\/(?:solutions|setup|vs|guides)\/[a-z0-9-]+)["']/gi)) {
        if (noIndexPseoRoutes.has(m[1])) {
          results.htmlWarnings.push({
            file: rel,
            type: 'link_to_noindex_page',
            msg: `Consolidated page links to another noindex URL: ${m[1]}`
          });
          break;
        }
      }
    }
    continue;
  }
  results.indexablePages++;

  // Title tag
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title) {
    results.htmlIssues.push({ file: rel, type: 'missing_title', msg: 'Missing <title> tag' });
  } else {
    const decodedTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (title.length > 70) {
      results.htmlWarnings.push({ file: rel, type: 'long_title', msg: `Title exceeds 70 chars (${title.length} chars): "${title}"` });
    }
    if (decodedTitle.length < 25) {
      results.htmlWarnings.push({ file: rel, type: 'short_title', msg: `Title under 25 chars (${decodedTitle.length} chars): "${decodedTitle}"` });
    }
    if (decodedTitle.endsWith('...') || decodedTitle.endsWith('…')) {
      results.htmlWarnings.push({ file: rel, type: 'truncated_title', msg: `Title contains trailing ellipses: "${decodedTitle}"` });
    }
  }

  // Meta description
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/i) ||
                    content.match(/<meta\s+name=["']description["']\s+content='([^']*)'/i) ||
                    content.match(/<meta\s+content="([^"]*)"\s+name=["']description["']/i) ||
                    content.match(/<meta\s+content='([^']*)'\s+name=["']description["']/i);
  const desc = descMatch ? descMatch[1].trim() : null;
  if (!desc) {
    results.htmlIssues.push({ file: rel, type: 'missing_description', msg: 'Missing meta description' });
  } else {
    if (desc.length > 170) {
      results.htmlWarnings.push({ file: rel, type: 'long_description', msg: `Description exceeds 170 chars (${desc.length} chars)` });
    }
    if (desc.length < 50) {
      results.htmlWarnings.push({ file: rel, type: 'short_description', msg: `Description under 50 chars (${desc.length} chars)` });
    }
    if (desc.endsWith('...') || desc.endsWith('…')) {
      results.htmlWarnings.push({ file: rel, type: 'truncated_description', msg: `Description contains trailing ellipses: "${desc}"` });
    }
  }

  // Canonical tag
  const canMatch = content.match(/<link\s+rel=["']canonical["']\s+href="([^"]*)"/i) ||
                   content.match(/<link\s+rel=["']canonical["']\s+href='([^']*)'/i) ||
                   content.match(/<link\s+href="([^"]*)"\s+rel=["']canonical["']/i) ||
                   content.match(/<link\s+href='([^']*)'\s+rel=["']canonical["']/i);
  if (!canMatch) {
    results.htmlIssues.push({ file: rel, type: 'missing_canonical', msg: 'Missing canonical link tag' });
  } else {
    const canHref = canMatch[1].trim();
    if (canHref.endsWith('.html')) {
      results.htmlIssues.push({ file: rel, type: 'canonical_has_html', msg: `Canonical link has .html extension: "${canHref}"` });
    }
    if (!canHref.startsWith('https://sweeprdeepblock.com')) {
      results.htmlIssues.push({ file: rel, type: 'non_production_canonical', msg: `Canonical link does not start with https://sweeprdeepblock.com: "${canHref}"` });
    }
    const expectedSlug = rel === 'index.html' ? '' : rel.replace(/\.html$/, '');
    const expectedUrl = `https://sweeprdeepblock.com/${expectedSlug}`;
    if (canHref !== expectedUrl) {
      results.htmlIssues.push({ file: rel, type: 'canonical_mismatch', msg: `Canonical href "${canHref}" does not match expected "${expectedUrl}"` });
    }
  }

  // Viewport
  if (!content.includes('name="viewport"') && !content.includes("name='viewport'")) {
    results.htmlIssues.push({ file: rel, type: 'missing_viewport', msg: 'Missing viewport meta tag' });
  }

  // Charset
  if (!content.includes('charset=') && !content.includes('charset =')) {
    results.htmlIssues.push({ file: rel, type: 'missing_charset', msg: 'Missing charset meta tag' });
  }

  // Lang attribute
  const langMatch = content.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (!langMatch) {
    results.htmlIssues.push({ file: rel, type: 'missing_lang', msg: 'Missing lang attribute on <html>' });
  }

  // Theme color & Webmanifest
  if (!content.includes('name="theme-color"')) {
    results.htmlWarnings.push({ file: rel, type: 'missing_theme_color', msg: 'Missing theme-color meta tag' });
  }
  if (!content.includes('rel="manifest"') && !content.includes("rel='manifest'")) {
    results.htmlWarnings.push({ file: rel, type: 'missing_manifest_link', msg: 'Missing link to site.webmanifest' });
  }
  if (!content.includes('rel="icon"') && !content.includes("rel='icon'")) {
    results.htmlWarnings.push({ file: rel, type: 'missing_favicon', msg: 'Missing favicon link tag' });
  }

  // Resource hints
  if (!content.includes('rel="preconnect"')) {
    results.htmlWarnings.push({ file: rel, type: 'missing_preconnect', msg: 'Missing preconnect resource hints for PageSpeed' });
  }

  // H1 tag
  const h1Matches = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  if (h1Matches.length === 0) {
    results.htmlIssues.push({ file: rel, type: 'missing_h1', msg: 'Missing <h1> tag' });
  } else if (h1Matches.length > 1) {
    results.htmlWarnings.push({ file: rel, type: 'multiple_h1', msg: `Contains ${h1Matches.length} <h1> tags` });
  }

  // Live MV3 Rule Proof check on indexable PSEO Pillar pages
  if (/^(solutions|setup|vs|guides)\//i.test(rel) && rel !== 'vs/total-adblock.html') {
    if (!content.includes('id="deepblock-live-rule-proof"')) {
      results.htmlWarnings.push({
        file: rel,
        type: 'missing_live_rule_proof',
        msg: 'Indexable PSEO Pillar page is missing #deepblock-live-rule-proof telemetry section'
      });
    }
  }

  // Open Graph
  const hasOgTitle = /property=["']og:title["']/i.test(content);
  const hasOgDesc = /property=["']og:description["']/i.test(content);
  const hasOgImage = /property=["']og:image["']/i.test(content);
  const hasOgUrl = /property=["']og:url["']/i.test(content);
  if (!hasOgTitle || !hasOgDesc || !hasOgImage || !hasOgUrl) {
    results.htmlWarnings.push({
      file: rel,
      type: 'incomplete_og',
      msg: `Incomplete Open Graph tags (title:${hasOgTitle}, desc:${hasOgDesc}, image:${hasOgImage}, url:${hasOgUrl})`
    });
  }

  // Twitter Cards
  const hasTwCard = /name=["']twitter:card["']/i.test(content);
  const hasTwImage = /name=["']twitter:image["']/i.test(content);
  if (!hasTwCard || !hasTwImage) {
    results.htmlWarnings.push({
      file: rel,
      type: 'incomplete_twitter_card',
      msg: `Incomplete Twitter card tags (card:${hasTwCard}, image:${hasTwImage})`
    });
  }

  // JSON-LD structured data (Merchant Listings / Product / SoftwareApplication)
  const jsonLdMatches = content.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
  if (!jsonLdMatches || jsonLdMatches.length === 0) {
    results.htmlWarnings.push({ file: rel, type: 'missing_json_ld', msg: 'Missing JSON-LD structured data' });
  } else {
    for (const tag of jsonLdMatches) {
      const raw = tag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
        for (const item of items) {
          if (item['@type'] === 'SoftwareApplication' || item['@type'] === 'Product') {
            if (!item.offers) {
              results.htmlWarnings.push({ file: rel, type: 'json_ld_missing_offers', msg: 'Schema missing offers field' });
            } else {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              for (const off of offers) {
                if (!off.priceValidUntil) {
                  results.htmlWarnings.push({ file: rel, type: 'offers_missing_priceValidUntil', msg: 'Offer missing priceValidUntil for Merchant Listings' });
                }
                if (!off.validFrom) {
                  results.htmlWarnings.push({ file: rel, type: 'offers_missing_validFrom', msg: 'Offer missing validFrom for Merchant Listings' });
                }
              }
            }
            if (!item.aggregateRating) {
              results.htmlWarnings.push({ file: rel, type: 'missing_aggregateRating', msg: 'Schema missing aggregateRating for rich snippets' });
            }
          }
        }
      } catch (err) {
        results.htmlIssues.push({ file: rel, type: 'invalid_json_ld', msg: `Invalid JSON-LD syntax: ${err.message}` });
      }
    }
  }

  // Internal Links check
  const aMatches = content.matchAll(/<a\s+[^>]*href=["']([^"'#]+)(?:#[^"']*)?["'][^>]*>/gi);
  for (const m of aMatches) {
    const href = m[1].trim();
    if (href.startsWith('http://') || href.startsWith('https://')) {
      if (href.startsWith('https://sweeprdeepblock.com')) {
        const urlObj = new URL(href);
        const p = urlObj.pathname;
        if (p.endsWith('.html')) {
          results.htmlIssues.push({ file: rel, type: 'link_has_html', msg: `Internal link with .html extension: ${href}` });
        }
        if (p.length > 1 && p.endsWith('/')) {
          results.htmlIssues.push({ file: rel, type: 'link_has_trailing_slash', msg: `Internal link with trailing slash: ${href}` });
        }
      }
    } else if (href.startsWith('/')) {
      if (href.endsWith('.html')) {
        results.htmlIssues.push({ file: rel, type: 'link_has_html', msg: `Internal link with .html extension: ${href}` });
      }
      if (href.length > 1 && href.endsWith('/')) {
        results.htmlIssues.push({ file: rel, type: 'link_has_trailing_slash', msg: `Internal link with trailing slash: ${href}` });
      }
      const cleanPath = href.split('?')[0];
      incomingInternalLinks.set(cleanPath, (incomingInternalLinks.get(cleanPath) || 0) + 1);
      if (cleanPath !== '/' && !existingCleanRoutes.has(cleanPath)) {
        if (!cleanPath.startsWith('/api/') && !cleanPath.startsWith('/checkout') && !cleanPath.startsWith('/cdn-cgi')) {
          results.htmlIssues.push({ file: rel, type: 'broken_internal_link', msg: `Internal link to non-existent route: ${href}` });
        }
      }
    }
  }

  // Images without alt, width/height
  const imgMatches = content.match(/<img[^>]+>/gi) || [];
  for (const img of imgMatches) {
    if (!/alt=["'][^"']*["']/i.test(img)) {
      results.htmlWarnings.push({ file: rel, type: 'img_missing_alt', msg: `Image missing alt attribute: ${img.slice(0, 80)}` });
    }
    if (!/width=["'][^"']+["']/i.test(img) || !/height=["'][^"']+["']/i.test(img)) {
      results.htmlWarnings.push({ file: rel, type: 'img_missing_dims', msg: `Image missing explicit width/height: ${img.slice(0, 80)}` });
    }
  }
}

// Check for orphan indexable pages (0 incoming internal links)
let orphanPagesCount = 0;
for (const filePath of htmlFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content)) continue;
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
  const clean = rel === 'index.html' ? '/' : '/' + rel.replace(/\.html$/, '');
  if (clean !== '/' && (incomingInternalLinks.get(clean) || 0) === 0) {
    orphanPagesCount++;
    results.htmlWarnings.push({ file: rel, type: 'orphan_page', msg: `Indexable page has 0 incoming internal links: ${clean}` });
  }
}
console.log(`[AUDIT] Orphan indexable pages (0 incoming internal links): ${orphanPagesCount}`);

// Check sitemap.xml
const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
let sitemapUrls = [];
if (fs.existsSync(sitemapPath)) {
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  const locMatches = sitemapXml.match(/<loc>([^<]+)<\/loc>/g) || [];
  sitemapUrls = locMatches.map(m => m.replace(/<\/?loc>/g, '').trim());
  console.log(`[AUDIT] Found ${sitemapUrls.length} URLs in sitemap.xml`);

  for (const u of sitemapUrls) {
    if (u.endsWith('.html') && !u.endsWith('pad.xml')) {
      results.htmlIssues.push({ file: 'sitemap.xml', type: 'sitemap_url_with_html', msg: `Sitemap contains .html extension: ${u}` });
    }
  }

  if (sitemapUrls.length !== results.indexablePages) {
    results.htmlIssues.push({
      file: 'sitemap.xml',
      type: 'sitemap_count_mismatch',
      msg: `Sitemap URL count (${sitemapUrls.length}) does not match indexable HTML pages (${results.indexablePages})`
    });
  }
} else {
  results.htmlIssues.push({ file: 'sitemap.xml', type: 'missing_sitemap', msg: 'sitemap.xml not found!' });
}

// Check robots.txt
const robotsPath = path.join(WEBSITE_DIR, 'robots.txt');
if (fs.existsSync(robotsPath)) {
  const robotsTxt = fs.readFileSync(robotsPath, 'utf8');
  if (!robotsTxt.includes('Sitemap: https://sweeprdeepblock.com/sitemap.xml')) {
    results.htmlIssues.push({ file: 'robots.txt', type: 'missing_sitemap_directive', msg: 'robots.txt missing standard Sitemap URL' });
  }
  for (const [idx, rawLine] of robotsTxt.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (!/^(User-agent|Allow|Disallow|Sitemap|Crawl-delay):/i.test(line)) {
      results.htmlIssues.push({ file: 'robots.txt', type: 'invalid_rfc9309_directive', msg: `Line ${idx + 1} invalid RFC 9309 directive: "${line}"` });
    }
  }
  if (!robotsTxt.includes('Disallow: /extension-ux-prototype')) {
    results.htmlWarnings.push({ file: 'robots.txt', type: 'missing_prototype_disallow', msg: 'robots.txt missing Disallow: /extension-ux-prototype' });
  }
  if (!robotsTxt.includes('Disallow: /sweepr-vpn-concepts')) {
    results.htmlWarnings.push({ file: 'robots.txt', type: 'missing_vpn_concepts_disallow', msg: 'robots.txt missing Disallow: /sweepr-vpn-concepts' });
  }
  if (!robotsTxt.includes('User-agent: ClaudeBot') || !robotsTxt.includes('User-agent: GPTBot') || !robotsTxt.includes('User-agent: PerplexityBot')) {
    results.htmlWarnings.push({ file: 'robots.txt', type: 'missing_ai_crawlers', msg: 'robots.txt missing explicit directives for ClaudeBot, GPTBot, or PerplexityBot' });
  }
} else {
  results.htmlIssues.push({ file: 'robots.txt', type: 'missing_robots', msg: 'robots.txt not found!' });
}

// Check site.webmanifest
const manifestPath = path.join(WEBSITE_DIR, 'site.webmanifest');
if (fs.existsSync(manifestPath)) {
  try {
    const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifestJson.name || !manifestJson.short_name || !manifestJson.icons) {
      results.htmlWarnings.push({ file: 'site.webmanifest', type: 'incomplete_manifest', msg: 'site.webmanifest missing name, short_name or icons' });
    }
  } catch (err) {
    results.htmlIssues.push({ file: 'site.webmanifest', type: 'invalid_manifest_json', msg: `site.webmanifest JSON error: ${err.message}` });
  }
} else {
  results.htmlWarnings.push({ file: 'site.webmanifest', type: 'missing_webmanifest', msg: 'site.webmanifest not found!' });
}

// Check pad.xml
const padPath = path.join(WEBSITE_DIR, 'pad.xml');
if (fs.existsSync(padPath)) {
  const padXml = fs.readFileSync(padPath, 'utf8');
  if (!padXml.includes('<Program_Name>') || !padXml.includes('<Program_Version>') || !padXml.includes('<Program_Cost_Other>')) {
    results.htmlIssues.push({ file: 'pad.xml', type: 'incomplete_pad_xml', msg: 'pad.xml missing standard PAD metadata fields' });
  }
} else {
  results.htmlIssues.push({ file: 'pad.xml', type: 'missing_pad_xml', msg: 'pad.xml not found!' });
}

// Check llms.txt
const llmsPath = path.join(WEBSITE_DIR, 'llms.txt');
if (fs.existsSync(llmsPath)) {
  const llmsTxt = fs.readFileSync(llmsPath, 'utf8');
  if (!llmsTxt.includes('## Verified Guides & Platform Solutions')) {
    results.htmlWarnings.push({ file: 'llms.txt', type: 'incomplete_llms_txt', msg: 'llms.txt missing Verified Guides section' });
  }
} else {
  results.htmlWarnings.push({ file: 'llms.txt', type: 'missing_llms_txt', msg: 'llms.txt not found!' });
}

// Check llms-full.txt
const llmsFullPath = path.join(WEBSITE_DIR, 'llms-full.txt');
if (fs.existsSync(llmsFullPath)) {
  const llmsFullTxt = fs.readFileSync(llmsFullPath, 'utf8');
  if (!llmsFullTxt.includes('## 1. Executive Summary') || !llmsFullTxt.includes('## 3. Public Anti-Detection Test Lab')) {
    results.htmlWarnings.push({ file: 'llms-full.txt', type: 'incomplete_llms_full_txt', msg: 'llms-full.txt missing critical technical architecture sections' });
  }
} else {
  results.htmlIssues.push({ file: 'llms-full.txt', type: 'missing_llms_full_txt', msg: 'llms-full.txt not found for GEO/AEO optimization!' });
}

// Check indexing-queue.json
const queuePath = path.join(WEBSITE_DIR, 'indexing-queue.json');
if (fs.existsSync(queuePath)) {
  try {
    const queueJson = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    if (!queueJson.indexnow_key || !Array.isArray(queueJson.pending_urls)) {
      results.htmlWarnings.push({ file: 'indexing-queue.json', type: 'incomplete_indexing_queue', msg: 'indexing-queue.json missing indexnow_key or pending_urls array' });
    }
  } catch (err) {
    results.htmlIssues.push({ file: 'indexing-queue.json', type: 'invalid_queue_json', msg: `indexing-queue.json JSON error: ${err.message}` });
  }
} else {
  results.htmlWarnings.push({ file: 'indexing-queue.json', type: 'missing_indexing_queue', msg: 'indexing-queue.json not found!' });
}

// Server.js audit
const serverCode = fs.readFileSync(SERVER_PATH, 'utf8');
results.serverAudit = {
  hasBrotliCompression: serverCode.includes('createBrotliCompress') && serverCode.includes("'br'"),
  hasGzipCompression: serverCode.includes('createGzip') || serverCode.includes('zlib'),
  hasBrotliStreamErrorHandling: serverCode.includes("brotliStream.on('error'"),
  hasETagSupport: /etag/i.test(serverCode),
  hasIfNoneMatch: /if-none-match/i.test(serverCode),
  hasTrailingSlashRedirect: serverCode.includes('endsWith(\'/\')') || serverCode.includes('endsWith("/")'),
  hasHtmlExtensionRedirect: serverCode.includes('.html'),
  hasDynamicHtmlFallback: serverCode.includes('htmlCandidate') || serverCode.includes('directHtmlCandidate'),
  hasSecurityHeaders: serverCode.includes('Strict-Transport-Security') && serverCode.includes('X-Content-Type-Options'),
  hasXRobotsTagSupport: serverCode.includes('X-Robots-Tag'),
  hasExtendedStaticCaching: serverCode.includes('max-age=604800'),
  hasBotHitTelemetry: serverCode.includes('BOT_UA_RE') && serverCode.includes('bot-hit'),
  hasPreconnectHeaders: serverCode.includes('rel=preconnect'),
  hasPreloadHeaders: serverCode.includes('rel=preload'),
  hasPrototypeNoIndex: serverCode.includes("'extension-ux-prototype.html'"),
  hasInstallerCleanAliases: serverCode.includes('SWEEPRDeepblockSetup.command') && serverCode.includes('sweepr-deepblock-extension.zip'),
  hasSecurityTxtRfc9116: serverCode.includes('security.txt') && serverCode.includes('/.well-known/security.txt'),
  hasVaryPreservation: serverCode.includes("headers['Vary']") && serverCode.includes('Accept-Encoding'),
  hasIdSigSupport: serverCode.includes('.idsig') && serverCode.includes('application/octet-stream'),
  hasLowercaseRedirect: serverCode.includes('pathname.toLowerCase()') && serverCode.includes('/[A-Z]/.test'),
  hasPageSpeedLighthouseTelemetry: serverCode.includes('chrome-lighthouse') && serverCode.includes('pagespeed'),
  hasConsolidatedNoIndexHeaderParity: serverCode.includes('isConsolidatedNoIndex') && serverCode.includes('__deepblockHtmlSeoCache')
};

if (!results.serverAudit.hasConsolidatedNoIndexHeaderParity) {
  results.htmlIssues.push({
    file: 'server.js',
    type: 'missing_consolidated_noindex_header_parity',
    msg: 'server.js must sync X-Robots-Tag and Link canonical headers with HTML <meta name="robots"> on consolidated noindex pages'
  });
}

console.log('\n=== AUDIT SUMMARY ===');
console.log(`Total HTML files scanned: ${results.pagesAnalyzed}`);
console.log(`Indexable pages: ${results.indexablePages}`);
console.log(`Non-indexable pages: ${results.nonIndexablePages}`);
console.log(`Total Errors / Issues: ${results.htmlIssues.length}`);
console.log(`Total Warnings / Non-Optimized: ${results.htmlWarnings.length}`);

console.log('\n--- Server Capabilities ---');
console.log(JSON.stringify(results.serverAudit, null, 2));

console.log('\n--- Issues Breakdown ---');
const issueTypes = {};
for (const i of results.htmlIssues) {
  issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
}
console.log('Issues by type:', issueTypes);

const warningTypes = {};
for (const w of results.htmlWarnings) {
  warningTypes[w.type] = (warningTypes[w.type] || 0) + 1;
}
console.log('Warnings by type:', warningTypes);

if (results.htmlIssues.length > 0) {
  console.log('\nSample Issues (first 10):');
  console.log(JSON.stringify(results.htmlIssues.slice(0, 10), null, 2));
}

if (results.htmlWarnings.length > 0) {
  console.log('\nSample Warnings (first 10):');
  console.log(JSON.stringify(results.htmlWarnings.slice(0, 10), null, 2));
}

if (results.htmlIssues.length > 0) {
  process.exit(1);
} else {
  console.log('\n[PASS] All Technical SEO, Crawlability, and PageSpeed checks passed with 100% compliance.');
}
