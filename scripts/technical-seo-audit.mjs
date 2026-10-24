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
  serverAudit: {},
  scriptsAudit: {}
};

for (const filePath of htmlFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');

  // Title tag
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title) {
    results.htmlIssues.push({ file: rel, type: 'missing_title', msg: 'Missing <title> tag' });
  } else {
    const decodedTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (decodedTitle.length > 70) {
      results.htmlWarnings.push({ file: rel, type: 'long_title', msg: `Title exceeds 70 chars (${decodedTitle.length} chars): "${decodedTitle}"` });
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

  // H1 tag
  const h1Matches = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  if (h1Matches.length === 0) {
    results.htmlIssues.push({ file: rel, type: 'missing_h1', msg: 'Missing <h1> tag' });
  } else if (h1Matches.length > 1) {
    results.htmlWarnings.push({ file: rel, type: 'multiple_h1', msg: `Contains ${h1Matches.length} <h1> tags` });
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

  // JSON-LD structured data
  const jsonLdMatches = content.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
  if (!jsonLdMatches || jsonLdMatches.length === 0) {
    results.htmlWarnings.push({ file: rel, type: 'missing_json_ld', msg: 'Missing JSON-LD structured data' });
  } else {
    for (const tag of jsonLdMatches) {
      const raw = tag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
      try {
        JSON.parse(raw);
      } catch (err) {
        results.htmlIssues.push({ file: rel, type: 'invalid_json_ld', msg: `Invalid JSON-LD syntax: ${err.message}` });
      }
    }
  }

  // Images without alt, width/height, or loading="lazy"
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

// Check sitemap.xml
const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
let sitemapUrls = [];
if (fs.existsSync(sitemapPath)) {
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  const locMatches = sitemapXml.match(/<loc>([^<]+)<\/loc>/g) || [];
  sitemapUrls = locMatches.map(m => m.replace(/<\/?loc>/g, '').trim());
  console.log(`[AUDIT] Found ${sitemapUrls.length} URLs in sitemap.xml`);

  // Check if any sitemap URLs 404 or have .html
  for (const u of sitemapUrls) {
    if (u.endsWith('.html') && !u.endsWith('pad.xml')) {
      results.htmlIssues.push({ file: 'sitemap.xml', type: 'sitemap_url_with_html', msg: `Sitemap contains .html extension: ${u}` });
    }
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
  hasPreloadHeaders: serverCode.includes('rel=preload')
};

console.log('\n=== AUDIT SUMMARY ===');
console.log(`Total HTML files scanned: ${results.pagesAnalyzed}`);
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
