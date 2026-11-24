#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Internal Link Equity Rebalancer & Nofollow Sculptor (`scripts/sculpt-internal-links.mjs`)
 *
 * Idempotently:
 *  1. Rebalances footer/nav equity across `/site/*`, `/glossary/*`, `/stories/*`, `/de/*`, `/fr/*`,
 *     `/es`, `/tools/*`, `/campaigns/*`, and indexable Pillars so commercial money pages (`/download`,
 *     `/pricing`, `/vs`) strictly out-link utility/legal/reference routes (`/privacy`, `/glossary`).
 *  2. Connects indexable Pillar clusters back to `/vs`, `/solutions`, `/setup`, and `/guides` hubs.
 *  3. Adds `rel="nofollow"` to every internal `<a>` targeting robots.txt-disallowed routes (`/order*`,
 *     `/login*`, `/checkout*`, `/download/*.(exe|apk|xpi|zip|command|mobileconfig|idsig)` and root binaries).
 *  4. Strips `rel="nofollow"` if mistakenly attached to any indexable canonical sitemap URL.
 *  5. Strips `?utm_*` query parameters from sister ecosystem cross-links (`sweeprcleaner.com`, `sweeprvpn.com`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATE_301_MAP, isNoIndexPrunePath, normalizeUrlPath } from './lib/m1-decisions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');

function walkHtml(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walkHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function loadCanonicalSitemapSet() {
  const set = new Set();
  const fp = path.join(WEBSITE_DIR, 'sitemap.xml');
  if (!fs.existsSync(fp)) return set;
  const xml = fs.readFileSync(fp, 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const p = normalizeUrlPath(m[1].trim().replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/');
    if (isNoIndexPrunePath(p) || CONSOLIDATE_301_MAP.has(p)) continue;
    set.add(p);
  }
  return set;
}

function getInternalPath(rawHref) {
  const href = String(rawHref || '').trim();
  if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  let p = null;
  if (href.startsWith('/') && !href.startsWith('//')) {
    p = href.split('#')[0].split('?')[0];
  } else if (/^https?:\/\/(?:www\.)?sweeprdeepblock\.com(?:\/|$|\?|#)/i.test(href)) {
    try {
      p = new URL(href).pathname || '/';
    } catch {
      return null;
    }
  }
  if (!p) return null;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

export function isDisallowedUtilityPath(internalPath) {
  if (!internalPath) return false;
  if (/^\/(order|login|checkout)(\/|$|\.html$)/i.test(internalPath)) return true;
  if (/^\/(?:download\/)?[^/]+\.(exe|apk|xpi|zip|command|mobileconfig|idsig)$/i.test(internalPath)) {
    return true;
  }
  return false;
}

function setRelNofollow(tag, shouldBeNofollow) {
  const relRe = /\srel\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
  const relMatch = tag.match(relRe);
  if (relMatch) {
    const existingTokens = (relMatch[1] ?? relMatch[2] ?? '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const hasNofollow = existingTokens.some((t) => t.toLowerCase() === 'nofollow');
    if (shouldBeNofollow && !hasNofollow) {
      const nextRel = ` rel="${[...existingTokens, 'nofollow'].join(' ')}"`;
      return tag.replace(relRe, nextRel);
    }
    if (!shouldBeNofollow && hasNofollow) {
      const kept = existingTokens.filter((t) => t.toLowerCase() !== 'nofollow');
      return tag.replace(relRe, kept.length > 0 ? ` rel="${kept.join(' ')}"` : '');
    }
    return tag;
  }
  if (shouldBeNofollow) {
    return tag.replace(/^<a\b/i, '<a rel="nofollow"');
  }
  return tag;
}

function cleanEcosystemUtms(html) {
  return html.replace(
    /\bhref=(["'])(https?:\/\/(?:www\.)?sweepr(?:cleaner|vpn)\.com)(\/[^"'\s?#]*)?\?[^"']*\1/gi,
    (_, quote, origin, subPath = '') => `href=${quote}${origin}${subPath || ''}${quote}`
  );
}

function injectLinksIntoFooter(html, linksToEnsure) {
  const missing = linksToEnsure.filter((l) => !new RegExp(`href=["']${l.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html));
  if (missing.length === 0) return html;
  const footerMatch = html.match(/<footer\b[\s\S]*?<\/footer>/i);
  if (!footerMatch) return html;
  const origFooter = footerMatch[0];
  let updatedFooter = origFooter;
  const htmlToInsert = missing.map((l) => l.tag).join('\n        ');
  // Insert right before closing </div></div></footer> or </div>\n  </footer>
  if (/<\/div>\s*<\/div>\s*<\/footer>/i.test(origFooter)) {
    updatedFooter = origFooter.replace(/(<\/div>\s*<\/div>\s*<\/footer>)/i, `\n        ${htmlToInsert}\n      $1`);
  } else if (/<\/div>\s*<\/footer>/i.test(origFooter)) {
    updatedFooter = origFooter.replace(/(<\/div>\s*<\/footer>)/i, `\n        ${htmlToInsert}\n      $1`);
  }
  return updatedFooter === origFooter ? html : html.replace(origFooter, updatedFooter);
}

function rebalanceHtmlByRoute(rel, html) {
  const isNoIndex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html);
  if (isNoIndex) return html;
  const routePath = normalizeUrlPath(
    rel === 'index.html'
      ? '/'
      : rel.endsWith('/index.html')
        ? '/' + rel.replace(/\/index\.html$/, '')
        : '/' + rel.replace(/\.html$/, '')
  );
  if (isNoIndexPrunePath(routePath) || CONSOLIDATE_301_MAP.has(routePath)) return html;
  // Preserve Holographic Pearl shell footers (they already render the exact 95 kept URLs cleanly)
  if (html.includes('All 95 Setup Guides, Comparisons &amp; Tools') || html.includes('All 95 Setup Guides, Comparisons & Tools')) {
    return html;
  }
  let out = html;

  // 1. Glossary sub-pages (`website/glossary/{term}.html`): add /download, /pricing, /vs; omit /privacy from glossary term sub-pages
  if (/^glossary\/[^/]+\.html$/i.test(rel) && rel !== 'glossary/index.html') {
    out = out.replace(/<a\s+href="\/privacy"[^>]*>Privacy Policy<\/a>\s*/gi, '');
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-emerald-600 transition-colors">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>' }
    ]);
  }
  if (rel === 'glossary/index.html') {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-emerald-600 transition-colors">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>' }
    ]);
  }

  // 2. Localized EU hubs (`/de`, `/fr`, `/es`): add /download, /pricing, /vs
  if (/^(de|fr|es)(?:\.html|\/)/i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-emerald-600 transition-colors">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>' }
    ]);
  }

  // 3. Diagnostic Tools (`website/tools/*.html`): ensure /download, /pricing, /vs
  if (/^tools\/[^/]+\.html$/i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-emerald-600 transition-colors">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>' }
    ]);
  }

  // 4. Legacy Indexable Pillar pages (`/solutions/*`, `/setup/*`, `/vs/*`, `/guides/*`, excluding `index.html`):
  //    Link to the 4 Category Directory Hubs + /download + /pricing using light Holographic Pearl classes
  if (/^(solutions|setup|vs|guides)\/[^/]+\.html$/i.test(rel) && !rel.endsWith('/index.html')) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-emerald-600 transition-colors">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-emerald-600 transition-colors">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-emerald-600 transition-colors">Comparisons</a>' },
      { href: '/solutions', tag: '<a href="/solutions" class="hover:text-emerald-600 transition-colors">Solutions</a>' },
      { href: '/setup', tag: '<a href="/setup" class="hover:text-emerald-600 transition-colors">Browser Setups</a>' },
      { href: '/guides', tag: '<a href="/guides" class="hover:text-emerald-600 transition-colors">Guides</a>' }
    ]);
  }

  return out;
}

export function sculptInternalLinks() {
  const sitemapSet = loadCanonicalSitemapSet();
  const files = walkHtml(WEBSITE_DIR);
  let filesModified = 0;
  let nofollowAdded = 0;
  let nofollowRemovedFromSitemap = 0;
  let utmCleaned = 0;

  for (const filePath of files) {
    const rel = path.relative(WEBSITE_DIR, filePath).replace(/\\/g, '/');
    const orig = fs.readFileSync(filePath, 'utf8');
    let next = rebalanceHtmlByRoute(rel, orig);

    const beforeUtm = next;
    next = cleanEcosystemUtms(next);
    if (next !== beforeUtm) utmCleaned++;

    next = next.replace(/<a\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => {
      const hm = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      if (!hm) return tag;
      const internalPath = getInternalPath(hm[1] ?? hm[2] ?? '');
      if (!internalPath) return tag;

      if (isDisallowedUtilityPath(internalPath)) {
        const updated = setRelNofollow(tag, true);
        if (updated !== tag) nofollowAdded++;
        return updated;
      }
      if (sitemapSet.has(internalPath)) {
        const updated = setRelNofollow(tag, false);
        if (updated !== tag) nofollowRemovedFromSitemap++;
        return updated;
      }
      return tag;
    });

    if (next !== orig) {
      fs.writeFileSync(filePath, next, 'utf8');
      filesModified++;
    }
  }

  console.log(
    `[SCULPT-LINKS] Scanned ${files.length} HTML files | Modified: ${filesModified} | Added rel="nofollow": ${nofollowAdded} | Removed accidental nofollow on sitemap URLs: ${nofollowRemovedFromSitemap} | Cleaned sister UTMs in ${utmCleaned} files.`
  );
  return { filesScanned: files.length, filesModified, nofollowAdded, nofollowRemovedFromSitemap, utmCleaned };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  sculptInternalLinks();
}
