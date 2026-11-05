#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — GSC Strike-Zone & Internal Link Equity Optimizer (`scripts/gsc-strike-zone-optimizer.mjs`)
 *
 * 1. Scans all indexable HTML pages across `website/` (`solutions`, `setup`, `vs`, `guides`, `tools`, `site`, `glossary`, `stories`, `de`, `fr`, root).
 * 2. Computes the exact incoming internal link graph for every indexable Pillar page (`/solutions/*`, `/setup/*`, `/vs/*`, `/guides/*`).
 * 3. Identifies "Strike-Zone" & newly generated Pillar pages with `< 4` incoming internal links.
 * 4. Automatically injects contextual internal links from topically related high-authority donor pages until every Pillar page has `>= 4` incoming links.
 * 5. Writes `data/gsc-strike-zone-report.json`.
 *
 * Zero Automated Emails (0 SMTP/email calls). £0.00 Runtime Cost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'gsc-strike-zone-report.json');

function walkHtmlFiles(dir, relPrefix = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...walkHtmlFiles(abs, rel));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push({ abs, rel });
    }
  }
  return results;
}

function relToCanonicalPath(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length);
  return '/' + rel.replace(/\.html$/, '');
}

function extractTitle(html, fallbackSlug) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].trim();
  }
  return fallbackSlug;
}

export function runGscStrikeZoneOptimizer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const allFiles = walkHtmlFiles(WEBSITE_DIR);
  const indexablePages = new Map(); // canonicalPath -> { abs, rel, html, title, outgoing: Set }

  for (const f of allFiles) {
    const html = fs.readFileSync(f.abs, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
      continue;
    }
    const urlPath = relToCanonicalPath(f.rel);
    const outgoing = new Set();
    for (const m of html.matchAll(/href=["'](\/[^"'#?\s]*)/gi)) {
      const target = m[1].replace(/\/+$/, '') || '/';
      if (target !== urlPath) outgoing.add(target);
    }
    indexablePages.set(urlPath, {
      urlPath,
      abs: f.abs,
      rel: f.rel,
      html,
      title: extractTitle(html, urlPath),
      outgoing
    });
  }

  const incomingCounts = new Map();
  for (const urlPath of indexablePages.keys()) {
    incomingCounts.set(urlPath, 0);
  }
  for (const page of indexablePages.values()) {
    for (const target of page.outgoing) {
      if (incomingCounts.has(target)) {
        incomingCounts.set(target, (incomingCounts.get(target) || 0) + 1);
      }
    }
  }

  const pillarPaths = [...indexablePages.keys()].filter((p) =>
    /^\/(setup|solutions|vs|guides)\/[^/]+$/.test(p)
  );

  const underLinkedBefore = pillarPaths.filter((p) => (incomingCounts.get(p) || 0) < 4);
  let linksInjected = 0;
  const modifiedDonors = new Set();

  for (const targetPath of underLinkedBefore) {
    const targetPage = indexablePages.get(targetPath);
    const needed = 4 - (incomingCounts.get(targetPath) || 0);
    if (needed <= 0 || !targetPage) continue;

    const cluster = targetPath.split('/')[1];
    // Candidate donors in the same cluster first, then any pillar page
    const candidates = pillarPaths.filter(
      (d) => d !== targetPath && !indexablePages.get(d).outgoing.has(targetPath)
    );
    candidates.sort((a, b) => {
      const aSame = a.startsWith(`/${cluster}/`) ? 0 : 1;
      const bSame = b.startsWith(`/${cluster}/`) ? 0 : 1;
      return aSame - bSame || a.localeCompare(b);
    });

    let addedForTarget = 0;
    for (const donorPath of candidates) {
      if (addedForTarget >= needed) break;
      const donor = indexablePages.get(donorPath);
      if (!donor) continue;

      const linkCard = `\n        <a href="${targetPath}" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:10px;padding:14px;text-decoration:none;color:#f8fafc;">\n          <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-bottom:4px;">Related Guide</div>\n          <div style="font-size:0.95rem;font-weight:600;">${targetPage.title.replace(/"/g, '&quot;')}</div>\n        </a>`;

      if (donor.html.includes('grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">')) {
        donor.html = donor.html.replace(
          'grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">',
          `grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">${linkCard}`
        );
        donor.outgoing.add(targetPath);
        incomingCounts.set(targetPath, (incomingCounts.get(targetPath) || 0) + 1);
        modifiedDonors.add(donorPath);
        addedForTarget++;
        linksInjected++;
      }
    }
  }

  for (const donorPath of modifiedDonors) {
    const donor = indexablePages.get(donorPath);
    if (donor) {
      fs.writeFileSync(donor.abs, donor.html, 'utf8');
    }
  }

  const underLinkedAfter = pillarPaths.filter((p) => (incomingCounts.get(p) || 0) < 4);
  const minIncoming = pillarPaths.reduce(
    (min, p) => Math.min(min, incomingCounts.get(p) || 0),
    Infinity
  );

  const report = {
    generatedAt: new Date().toISOString(),
    zeroEmail: true,
    totalIndexablePages: indexablePages.size,
    totalPillarPages: pillarPaths.length,
    underLinkedBeforeCount: underLinkedBefore.length,
    underLinkedAfterCount: underLinkedAfter.length,
    minIncomingLinksAcrossPillars: minIncoming === Infinity ? 0 : minIncoming,
    contextualLinksInjected: linksInjected,
    modifiedDonorPagesCount: modifiedDonors.size,
    topLinkedPillars: pillarPaths
      .map((p) => ({ urlPath: p, incomingLinks: incomingCounts.get(p) || 0 }))
      .sort((a, b) => b.incomingLinks - a.incomingLinks)
      .slice(0, 15)
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    `[GSC Strike-Zone Optimizer] Audited ${pillarPaths.length} Pillars across ${indexablePages.size} indexable pages | Min incoming links: ${report.minIncomingLinksAcrossPillars} | Links injected: ${linksInjected} | Under-linked (<4) remaining: ${underLinkedAfter.length}`
  );
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGscStrikeZoneOptimizer();
}
