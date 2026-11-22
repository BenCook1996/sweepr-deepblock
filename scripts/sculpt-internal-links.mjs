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
  for (const sm of ['sitemap.xml', 'sitemap-sites.xml']) {
    const fp = path.join(WEBSITE_DIR, sm);
    if (!fs.existsSync(fp)) continue;
    const xml = fs.readFileSync(fp, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      let p = m[1].trim().replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/';
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      set.add(p);
    }
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
  let out = html;

  // 1. 150 programmatic /site/{slug}.html report sub-pages: shift footer equity from privacy/glossary/eu-lang bloat -> /download, /pricing, /vs
  if (/^site\/[^/]+\.html$/i.test(rel) && rel !== 'site/index.html') {
    const newFooterLinks = `<div class="flex flex-wrap gap-4">
        <a href="/download" class="hover:text-white">Free Install</a>
        <a href="/pricing" class="hover:text-white">Pricing</a>
        <a href="/vs" class="hover:text-white">Comparisons</a>
        <a href="/vs/total-adblock" class="hover:text-white">vs Total Adblock</a>
        <a href="/site" class="hover:text-white">Site Reports</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
        <a href="/test-lab" class="hover:text-white">8/8 Test Lab</a>
      </div>`;
    out = out.replace(
      /(<footer\b[\s\S]*?)(<div class="flex flex-wrap gap-4">[\s\S]*?<\/div>)([\s\S]*?<\/footer>)/i,
      `$1${newFooterLinks}$3`
    );
  }

  // 2. Glossary sub-pages (`website/glossary/{term}.html`): add /download, /pricing, /vs; omit /privacy from glossary term sub-pages
  if (/^glossary\/[^/]+\.html$/i.test(rel) && rel !== 'glossary/index.html') {
    out = out.replace(/<a\s+href="\/privacy"[^>]*>Privacy Policy<\/a>\s*/gi, '');
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-white">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-white">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-white">Comparisons</a>' }
    ]);
  }
  if (rel === 'glossary/index.html') {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-white">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-white">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-white">Comparisons</a>' }
    ]);
  }

  // 3. Site hub (`website/site/index.html`) and Campaign pages: add /vs (plus /download and /pricing on renewal switcher)
  if (rel === 'site/index.html' || /^campaigns\/[^/]+\.html$/i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-white">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-white">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-white">Comparisons</a>' }
    ]);
  }

  // 4. Customer Stories (`/stories/*`): add /download, /vs to footer
  if (/^stories\/[^/]+\.html$/i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" style="color:#cbd5e1;">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" style="color:#cbd5e1;">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" style="color:#cbd5e1;">Comparisons</a>' }
    ]);
  }

  // 5. Localized EU hubs (`/de/*`, `/fr/*`, `/es`): add /download, /pricing, /vs & cross-link sibling EU guides
  if (/^(de|fr|es)\//i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" class="hover:text-white">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" class="hover:text-white">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" class="hover:text-white">Comparisons</a>' },
      { href: '/de/usercentrics-cookie-banner-blockieren', tag: '<a href="/de/usercentrics-cookie-banner-blockieren" class="hover:text-white">Usercentrics (DE)</a>' },
      { href: '/fr/bloquer-bandeau-cookie-didomi', tag: '<a href="/fr/bloquer-bandeau-cookie-didomi" class="hover:text-white">Didomi (FR)</a>' }
    ]);
  }

  // 6. Diagnostic Tools (`website/tools/*.html`): ensure /download, /pricing, /vs
  if (/^tools\/[^/]+\.html$/i.test(rel)) {
    out = injectLinksIntoFooter(out, [
      { href: '/download', tag: '<a href="/download" style="color:#94a3b8;text-decoration:none;">Download</a>' },
      { href: '/pricing', tag: '<a href="/pricing" style="color:#94a3b8;text-decoration:none;">Pricing</a>' },
      { href: '/vs', tag: '<a href="/vs" style="color:#94a3b8;text-decoration:none;">Comparisons</a>' }
    ]);
  }

  // 7. Indexable Pillar pages (`/solutions/*`, `/setup/*`, `/vs/*`, `/guides/*`, excluding `index.html`):
  //    Link to the 4 Category Directory Hubs + /download + /pricing (using Tailwind class if Tailwind page, or inline dark style if Pillar page)
  if (/^(solutions|setup|vs|guides)\/[^/]+\.html$/i.test(rel) && !rel.endsWith('/index.html')) {
    const usesTailwind = /sweepr-tailwind\.min\.css/i.test(out);
    if (usesTailwind) {
      out = injectLinksIntoFooter(out, [
        { href: '/download', tag: '<a href="/download" class="hover:text-white">Download</a>' },
        { href: '/pricing', tag: '<a href="/pricing" class="hover:text-white">Pricing</a>' },
        { href: '/vs', tag: '<a href="/vs" class="hover:text-white">Comparisons</a>' },
        { href: '/solutions', tag: '<a href="/solutions" class="hover:text-white">Solutions</a>' },
        { href: '/setup', tag: '<a href="/setup" class="hover:text-white">Browser Setups</a>' },
        { href: '/guides', tag: '<a href="/guides" class="hover:text-white">Guides</a>' }
      ]);
    } else {
      out = injectLinksIntoFooter(out, [
        { href: '/download', tag: '<a href="/download" style="color:#94a3b8;text-decoration:none;">Download</a>' },
        { href: '/pricing', tag: '<a href="/pricing" style="color:#94a3b8;text-decoration:none;">Pricing</a>' },
        { href: '/vs', tag: '<a href="/vs" style="color:#94a3b8;text-decoration:none;">Comparisons</a>' },
        { href: '/solutions', tag: '<a href="/solutions" style="color:#94a3b8;text-decoration:none;">Solutions</a>' },
        { href: '/setup', tag: '<a href="/setup" style="color:#94a3b8;text-decoration:none;">Browser Setups</a>' },
        { href: '/guides', tag: '<a href="/guides" style="color:#94a3b8;text-decoration:none;">Guides</a>' }
      ]);
    }
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
