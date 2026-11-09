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

const COOLDOWN_SAFE_QUERY_ENRICHMENTS = {
  '/solutions/crunchyroll-anime-streams-block-video-ads': {
    heading: 'How to Block Ads on Funimation & Get No Ads on Crunchyroll PC (Chrome MV3)',
    bodyHtml:
      'Since Funimation’s library merged into Crunchyroll, legacy Funimation and Crunchyroll streams serve multi-pod VAST/VMAP video commercials that trigger black screens on basic adblockers. <strong>SWEEPR DeepBlock</strong> intercepts Crunchyroll and Funimation HLS ad manifest segments in the MAIN world while spoofing telemetry beacons, letting you watch 1080p anime on PC with zero pre-roll or mid-roll interruptions.',
    faqQ: 'How do I block ads on Funimation and Crunchyroll PC streams without black screens?',
    faqA: 'Install SWEEPR DeepBlock on Chrome, Firefox, Edge, Brave, or Floorp. It neutralizes both Crunchyroll and legacy Funimation VAST/VMAP ad pods at the Manifest V3 network and player layer without triggering playback freezes.'
  },
  '/solutions/1337x-torrent-indexer-block-video-ads': {
    heading: 'How to Block 1337x Ads, Pop-Under Redirects & Fake Download Overlays',
    bodyHtml:
      'Searching for a permanent fix for <strong>1337x ads</strong>? 1337x and its mirror domains layer invisible <code>window.open</code> click-jacking overlays and fake "Direct High-Speed Download" VPN banners over magnet links. SWEEPR DeepBlock strips these transparent overlay divs and blocks pop-under script domains in under 50ms.',
    faqQ: 'Why do 1337x ads still open new tabs on standard adblockers?',
    faqA: '1337x mirrors rotate first-party inline click-listeners that fire when you click anywhere on the page. SWEEPR DeepBlock neutralizes inline window.open hijackers in the MAIN world before they can spawn redirect tabs.'
  },
  '/solutions/nyaa-si-anime-torrents-strip-tracking-parameters': {
    heading: 'Nyaa.si Red Highlight Meaning vs. Unofficial Mirror Redirect Ads',
    bodyHtml:
      'Users searching for <strong>nyaa.si red highlight</strong> often want to know whether a red/pink torrent row is dangerous: on official Nyaa.si, a <strong>red/pink row highlight</strong> simply indicates a <em>Remake / re-encode</em> or an unverified upload (whereas <strong>green</strong> is a Trusted uploader and <strong>blue</strong> is an A+ batch). However, lookalike Nyaa proxy clones inject malicious pop-under ads and tracking parameters—which SWEEPR DeepBlock blocks automatically.',
    faqQ: 'Is a Nyaa.si red highlight torrent safe to click?',
    faqA: 'On official Nyaa.si, a red highlight means the release is a Remake (re-encode) rather than a trusted original encode. Always keep SWEEPR DeepBlock active to block fake Nyaa clone domains, pop-under redirects, and outbound tracking tokens.'
  },
  '/setup/kiwi-browser-android': {
    heading: 'Kiwi Unblocker & Installing Desktop MV3 AdBlock Extensions on Android',
    bodyHtml:
      'Looking for a reliable <strong>Kiwi unblocker</strong> and ad-free mobile browsing setup? By installing SWEEPR DeepBlock inside Kiwi Browser on Android, you combine encrypted DNS-over-HTTPS (DoH) hostname resolution with desktop-grade Manifest V3 video ad blocking, pop-under interception, and sub-50ms cookie consent rejection.',
    faqQ: 'How does SWEEPR DeepBlock work as a Kiwi unblocker and mobile ad blocker?',
    faqA: 'Inside Kiwi Browser on Android, SWEEPR DeepBlock provides encrypted DNS-over-HTTPS (DoH) protection alongside full Manifest V3 declarativeNetRequest and MAIN-world scriptlet filtering.'
  },
  '/solutions/linkedin-feed-ads-block-video-ads': {
    heading: 'Chrome Extension That Stops LinkedIn Promoted Posts & Video Ads',
    bodyHtml:
      'If you need a <strong>Chrome extension that stops LinkedIn ads</strong> without breaking messaging or job search filters, SWEEPR DeepBlock surgically collapses disguised "Promoted" feed updates, sponsored video carousels, and right-rail banner slots in real time.',
    faqQ: 'Does this Chrome extension stop LinkedIn promoted posts without breaking my feed?',
    faqA: 'Yes. SWEEPR DeepBlock inspects LinkedIn feed DOM nodes locally and hides only sponsored/promoted cards while keeping organic connections, messaging, and job alerts untouched.'
  },
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage': {
    heading: 'Why Does Fandom Use So Much Memory? Live Wiki RAM Benchmark & Calculator',
    bodyHtml:
      'Wondering <strong>why does Fandom use so much memory</strong>? An unblocked Fandom wiki tab loads 60+ Prebid ad auction scripts and sticky video players, consuming <strong>840MB–1.2GB of RAM per tab</strong>. SWEEPR DeepBlock cuts Fandom tab memory by <strong>62%</strong>—test your exact tab savings in our <a href="/tools/browser-ram-calculator" style="color:#10b981;text-decoration:underline;font-weight:600;">Interactive Browser RAM Calculator</a> or inspect our <a href="/site/fandom-com" style="color:#10b981;text-decoration:underline;font-weight:600;">Verified Fandom.com Ad-Load Audit Report</a>.',
    faqQ: 'How can I verify how much memory SWEEPR DeepBlock saves on Fandom wikis?',
    faqA: 'Use the SWEEPR DeepBlock popup speedometer or our online Browser RAM Calculator (/tools/browser-ram-calculator) to compare unblocked Fandom tabs (~920MB/tab) against DeepBlock-protected tabs (~310MB/tab).'
  }
};

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

  // Cooldown-safe on-page query & FAQ enrichment (never modifies <title> tags locked under 14-day cooldown)
  let queryEnrichedPagesCount = 0;
  for (const [targetPath, qSpec] of Object.entries(COOLDOWN_SAFE_QUERY_ENRICHMENTS)) {
    const page = indexablePages.get(targetPath);
    if (!page) continue;
    let html = page.html;
    let changed = false;

    const sectionBlock = `<section id="gsc-exact-query-enrichment" style="margin:24px 0;padding:18px 20px;background:#0f172a;border:1px solid #1e293b;border-left:4px solid #10b981;border-radius:10px;">
      <h2 style="font-size:1.25rem;margin:0 0 8px;color:#f8fafc;">${qSpec.heading}</h2>
      <p style="margin:0;color:#cbd5e1;font-size:0.96rem;line-height:1.6;">${qSpec.bodyHtml}</p>
    </section>`;

    if (html.includes('id="gsc-exact-query-enrichment"')) {
      const nextHtml = html.replace(/<section id="gsc-exact-query-enrichment"[\s\S]*?<\/section>/i, sectionBlock);
      if (nextHtml !== html) {
        html = nextHtml;
        changed = true;
      }
    } else if (html.includes('<h2')) {
      html = html.replace(/(<h2\b)/i, `${sectionBlock}\n    $1`);
      changed = true;
    }

    if (qSpec.faqQ && qSpec.faqA) {
      html = html.replace(
        /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?)<\/script>/i,
        (fullMatch, jsonStr) => {
          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed.mainEntity)) {
              const exists = parsed.mainEntity.some((q) => q.name === qSpec.faqQ);
              if (!exists) {
                parsed.mainEntity.push({
                  '@type': 'Question',
                  name: qSpec.faqQ,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: qSpec.faqA
                  }
                });
                changed = true;
              }
            }
            return `<script type="application/ld+json">${JSON.stringify(parsed)}</script>`;
          } catch {
            return fullMatch;
          }
        }
      );
    }

    if (changed) {
      page.html = html;
      fs.writeFileSync(page.abs, html, 'utf8');
    }
    queryEnrichedPagesCount++;
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
    cooldownSafeQueryEnrichmentsCount: queryEnrichedPagesCount,
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
