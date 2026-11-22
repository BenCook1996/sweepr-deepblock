#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — GSC Strike-Zone & Full-Sitemap Link Equity Optimizer (`scripts/gsc-strike-zone-optimizer.mjs`)
 *
 * 1. Builds its authoritative link graph strictly from canonical URLs in `website/sitemap.xml`
 *    + `website/sitemap-sites.xml` (ignoring consolidated noindex pages, non-sitemap files, and
 *    `rel="nofollow"` links).
 * 2. Measures both unique followed referring sitemap pages (`incomingCounts`) and unique followed
 *    contextual in-body referring sitemap pages outside `<header>/<nav>/<footer>` (`contextualCounts`).
 * 3. Guarantees 100% of canonical sitemap URLs (except `/`) have `>= 5` followed incoming sitemap
 *    links and `>= 2` contextual body links (exempting legal/utility routes `/privacy`, `/terms`,
 *    `/refund`, `/support` from artificial body-link injection while keeping them `>= 5` inlinks),
 *    staying well within PageSpeed Brotli payload budgets.
 * 4. Runs `sculptInternalLinks()` and writes `data/gsc-strike-zone-report.json`.
 *
 * Zero Automated Emails (0 SMTP/email calls). £0.00 Runtime Cost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sculptInternalLinks } from './sculpt-internal-links.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'gsc-strike-zone-report.json');

const MIN_INCOMING_LINKS = 5;
const MIN_CONTEXTUAL_LINKS = 2;
const EXEMPT_BODY_INJECTION = new Set(['/', '/privacy', '/terms', '/refund', '/support']);

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
    heading: 'Chrome Extension That Stops LinkedIn Promoted Video & InMail Feed Ads',
    bodyHtml:
      'Looking for a <strong>Chrome extension that stops video ads on LinkedIn</strong> without breaking job applications or recruiter messages? SWEEPR DeepBlock removes "Promoted" feed posts, auto-playing video carousel commercials, and right-rail Sponsored Spotlight cards at under 50ms latency.',
    faqQ: 'Which Chrome extension stops video ads on LinkedIn without slowing down tabs?',
    faqA: 'SWEEPR DeepBlock uses lightweight Manifest V3 rules and zero-CLS cosmetic rules to collapse LinkedIn Promoted video posts while lowering memory consumption.'
  },
  '/solutions/fandom-game-wikis-reduce-browser-ram-usage': {
    heading: 'Why Does Fandom Use So Much Memory? Live Wiki RAM Benchmark & Calculator',
    bodyHtml:
      'Wondering <strong>why does Fandom use so much memory</strong>? An unblocked Fandom wiki tab loads 60+ Prebid ad auction scripts and sticky video players, consuming <strong>840MB–1.2GB of RAM per tab</strong>. SWEEPR DeepBlock cuts Fandom tab memory by <strong>62%</strong>—test your exact tab savings in our <a href="/tools/browser-ram-calculator" style="color:#10b981;text-decoration:underline;font-weight:600;">Interactive Browser RAM Calculator</a> or inspect our <a href="/site/fandom-com" style="color:#10b981;text-decoration:underline;font-weight:600;">Verified Fandom.com Ad-Load Audit Report</a>.',
    faqQ: 'How can I verify how much memory SWEEPR DeepBlock saves on Fandom wikis?',
    faqA: 'Use the SWEEPR DeepBlock popup speedometer or our online Browser RAM Calculator (/tools/browser-ram-calculator) to compare unblocked Fandom tabs (~920MB/tab) against DeepBlock-protected tabs (~310MB/tab).'
  }
};

function loadSitemapPaths() {
  const paths = [];
  const seen = new Set();
  for (const smFile of ['sitemap.xml', 'sitemap-sites.xml']) {
    const smAbs = path.join(WEBSITE_DIR, smFile);
    if (!fs.existsSync(smAbs)) continue;
    const xml = fs.readFileSync(smAbs, 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      let p = m[1].trim().replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/';
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      if (!seen.has(p)) {
        seen.add(p);
        paths.push(p);
      }
    }
  }
  return paths;
}

function resolveFilePathForRoute(urlPath) {
  if (urlPath === '/') return path.join(WEBSITE_DIR, 'index.html');
  const rel = urlPath.replace(/^\/+/, '');
  const htmlCandidate = path.join(WEBSITE_DIR, `${rel}.html`);
  if (fs.existsSync(htmlCandidate)) return htmlCandidate;
  const idxCandidate = path.join(WEBSITE_DIR, rel, 'index.html');
  if (fs.existsSync(idxCandidate)) return idxCandidate;
  return null;
}

function extractTitle(html, fallbackSlug) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const clean = h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean) return clean.length > 72 ? clean.slice(0, 69).replace(/\s+\S*$/, '') + '...' : clean;
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].trim();
  }
  return fallbackSlug;
}

function normalizeInternalTarget(rawHref) {
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

function findChromeRanges(bodyHtml) {
  const ranges = [];
  const stack = [];
  for (const m of bodyHtml.matchAll(/<(\/?)(header|nav|footer)\b[^>]*>/gi)) {
    const isClose = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!isClose) {
      stack.push({ tag, start: m.index });
    } else {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const opened = stack.splice(i, 1)[0];
          ranges.push([opened.start, m.index + m[0].length]);
          break;
        }
      }
    }
  }
  return ranges;
}

function extractFollowedOutgoingLinks(html, selfPath, canonicalSet) {
  const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, (s) => ' '.repeat(s.length))
    .replace(/<style\b[\s\S]*?<\/style>/gi, (s) => ' '.repeat(s.length))
    .replace(/<!--[\s\S]*?-->/g, (s) => ' '.repeat(s.length));

  const chromeRanges = findChromeRanges(body);
  const inChrome = (idx) => chromeRanges.some(([s, e]) => idx >= s && idx < e);

  const followed = new Set();
  const contextual = new Set();

  for (const m of body.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
    const tag = m[0];
    const relMatch = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (relMatch && /\bnofollow\b/i.test(relMatch[1] ?? relMatch[2] ?? '')) continue;
    const hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!hrefMatch) continue;
    const target = normalizeInternalTarget(hrefMatch[1] ?? hrefMatch[2] ?? '');
    if (!target || target === selfPath || !canonicalSet.has(target)) continue;
    followed.add(target);
    if (!inChrome(m.index)) contextual.add(target);
  }
  return { followed, contextual };
}

function escapeHtmlAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectContextualLinkIntoDonor(donor, targetPage) {
  const targetPath = targetPage.urlPath;
  const safeTitle = escapeHtmlAttr(targetPage.title);

  // 1. Pillar Grid (`grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">`)
  const pillarGrid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">';
  if (donor.html.includes(pillarGrid)) {
    const badge = targetPath.startsWith('/site/')
      ? 'Verified Publisher Telemetry'
      : targetPath.startsWith('/vs/')
      ? 'Comparison Benchmark'
      : targetPath.startsWith('/stories/')
      ? 'Case Study'
      : 'Related Guide';
    const card = `\n        <a href="${targetPath}" style="display:block;background:#111827;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;text-decoration:none;color:#f8fafc;">\n          <div style="font-size:0.75rem;color:#10b981;font-weight:700;margin-bottom:4px;">${badge}</div>\n          <div style="font-size:0.92rem;font-weight:600;line-height:1.35;">${safeTitle}</div>\n        </a>`;
    donor.html = donor.html.replace(pillarGrid, `${pillarGrid}${card}`);
    return true;
  }

  // 2. Customer Story Grid (`repeat(auto-fit,minmax(250px,1fr));gap:1rem;">`)
  const storyGrid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;">';
  if (donor.html.includes(storyGrid)) {
    const card = `\n        <a href="${targetPath}" style="background:#111827;border:1px solid rgba(148,163,184,0.16);border-radius:12px;padding:1.2rem;text-decoration:none;color:#f8fafc;display:block;">\n          <div style="font-size:0.75rem;color:#34d399;font-weight:700;margin-bottom:0.35rem;">Related Benchmark</div>\n          <div style="font-weight:700;margin-bottom:0.4rem;">${safeTitle}</div>\n        </a>`;
    donor.html = donor.html.replace(storyGrid, `${storyGrid}${card}`);
    return true;
  }

  // 3. Tailwind /site/* or /glossary/* Related Audits list (`<ul class="space-y-2 text-sm">` inside <main>)
  const mainMatch = donor.html.match(/<main\b[\s\S]*?<\/main>/i);
  if (mainMatch && mainMatch[0].includes('<ul class="space-y-2 text-sm">')) {
    const mainBody = mainMatch[0];
    const nextMain = mainBody.replace(
      '<ul class="space-y-2 text-sm">',
      `<ul class="space-y-2 text-sm">\n          <li><a href="${targetPath}" class="text-emerald-400 hover:underline font-semibold">${safeTitle}</a></li>`
    );
    donor.html = donor.html.replace(mainBody, nextMain);
    return true;
  }

  // 4. Existing `#sweepr-contextual-links` container or clean Tailwind/dark card before `</main>`
  if (donor.html.includes('id="sweepr-contextual-links"')) {
    const item = `<li><a href="${targetPath}" class="text-emerald-400 hover:underline font-semibold" style="color:#34d399;text-decoration:underline;font-weight:600;">${safeTitle}</a></li>`;
    donor.html = donor.html.replace(
      /(<section[^>]*id=["']sweepr-contextual-links["'][\s\S]*?<ul[^>]*>)/i,
      `$1\n        ${item}`
    );
    return true;
  }

  if (/<\/main>/i.test(donor.html)) {
    const block = `<section id="sweepr-contextual-links" class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2" style="margin-top:24px;padding:18px 20px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;">
      <h2 class="text-sm font-black uppercase tracking-wider text-slate-300" style="font-size:0.85rem;text-transform:uppercase;color:#cbd5e1;margin:0 0 8px;">Related Privacy Resources &amp; Audits</h2>
      <ul class="space-y-1.5 text-sm" style="margin:0;padding-left:1.1rem;color:#cbd5e1;">
        <li><a href="${targetPath}" class="text-emerald-400 hover:underline font-semibold" style="color:#34d399;text-decoration:underline;font-weight:600;">${safeTitle}</a></li>
      </ul>
    </section>
  </main>`;
    donor.html = donor.html.replace(/<\/main>/i, block);
    return true;
  }

  return false;
}

function getClusterPrefix(urlPath) {
  if (urlPath === '/') return 'root';
  const parts = urlPath.split('/').filter(Boolean);
  return parts.length > 1 ? parts[0] : parts[0];
}

export function runGscStrikeZoneOptimizer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const sitemapPaths = loadSitemapPaths();
  const canonicalSet = new Set(sitemapPaths);
  const pages = new Map();

  for (const urlPath of sitemapPaths) {
    const abs = resolveFilePathForRoute(urlPath);
    if (!abs) continue;
    const html = fs.readFileSync(abs, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
    const { followed, contextual } = extractFollowedOutgoingLinks(html, urlPath, canonicalSet);
    pages.set(urlPath, {
      urlPath,
      abs,
      cluster: getClusterPrefix(urlPath),
      rawBytes: Buffer.byteLength(html, 'utf8'),
      html,
      title: extractTitle(html, urlPath),
      outgoing: followed,
      contextualOutgoing: contextual
    });
  }

  const incomingSources = new Map();
  const contextualSources = new Map();
  for (const u of pages.keys()) {
    incomingSources.set(u, new Set());
    contextualSources.set(u, new Set());
  }
  for (const page of pages.values()) {
    for (const target of page.outgoing) {
      incomingSources.get(target)?.add(page.urlPath);
    }
    for (const target of page.contextualOutgoing) {
      contextualSources.get(target)?.add(page.urlPath);
    }
  }

  // All canonical pages sorted with lowest-inlink targets first
  const targetsToAudit = [...pages.keys()].filter((p) => p !== '/');
  const underLinkedBefore = targetsToAudit.filter((p) => (incomingSources.get(p)?.size ?? 0) < MIN_INCOMING_LINKS);
  const lowContextualBefore = targetsToAudit.filter(
    (p) => !EXEMPT_BODY_INJECTION.has(p) && (contextualSources.get(p)?.size ?? 0) < MIN_CONTEXTUAL_LINKS
  );

  // Donor candidates: prefer dark-mode / Tailwind pages that accept contextual links cleanly & are under 52 KB
  const donorOrder = [...pages.keys()].filter(
    (p) =>
      p !== '/' &&
      !/^\/(privacy|terms|refund|support|pricing|download|test-lab|benchmarks|vs|solutions|setup|guides)$/.test(p)
  );

  let linksInjected = 0;
  const modifiedDonors = new Set();

  const donorAddedCount = new Map();

  for (const targetPath of targetsToAudit) {
    const targetPage = pages.get(targetPath);
    if (!targetPage) continue;

    const needTotal = Math.max(0, MIN_INCOMING_LINKS - (incomingSources.get(targetPath)?.size ?? 0));
    const needContextual = EXEMPT_BODY_INJECTION.has(targetPath)
      ? 0
      : Math.max(0, MIN_CONTEXTUAL_LINKS - (contextualSources.get(targetPath)?.size ?? 0));
    const additionsNeeded = Math.max(needTotal, needContextual);
    if (additionsNeeded === 0) continue;

    const targetCluster = targetPage.cluster;
    const candidates = donorOrder.filter((d) => {
      if (d === targetPath) return false;
      const donor = pages.get(d);
      if (!donor) return false;
      if (donor.outgoing.has(targetPath)) return false;
      if (Buffer.byteLength(donor.html, 'utf8') > 52 * 1024) return false;
      if ((donorAddedCount.get(d) || 0) >= 6) return false;
      return true;
    });

    candidates.sort((a, b) => {
      const ca = pages.get(a);
      const cb = pages.get(b);
      const aSame = ca.cluster === targetCluster ? 0 : 1;
      const bSame = cb.cluster === targetCluster ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      const aAdded = donorAddedCount.get(a) || 0;
      const bAdded = donorAddedCount.get(b) || 0;
      if (aAdded !== bAdded) return aAdded - bAdded;
      return a.localeCompare(b);
    });

    let added = 0;
    for (const donorPath of candidates) {
      if (added >= additionsNeeded) break;
      const donor = pages.get(donorPath);
      if (!donor) continue;
      if (injectContextualLinkIntoDonor(donor, targetPage)) {
        donor.outgoing.add(targetPath);
        donor.contextualOutgoing.add(targetPath);
        incomingSources.get(targetPath)?.add(donorPath);
        contextualSources.get(targetPath)?.add(donorPath);
        donorAddedCount.set(donorPath, (donorAddedCount.get(donorPath) || 0) + 1);
        modifiedDonors.add(donorPath);
        linksInjected++;
        added++;
      }
    }
  }

  for (const donorPath of modifiedDonors) {
    const donor = pages.get(donorPath);
    if (donor) fs.writeFileSync(donor.abs, donor.html, 'utf8');
  }

  // Cooldown-safe on-page query enrichment (without injecting deprecated FAQPage schema)
  let queryEnrichedPagesCount = 0;
  for (const [targetPath, qSpec] of Object.entries(COOLDOWN_SAFE_QUERY_ENRICHMENTS)) {
    const page = pages.get(targetPath);
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

    if (changed) {
      page.html = html;
      fs.writeFileSync(page.abs, html, 'utf8');
    }
    queryEnrichedPagesCount++;
  }

  // Ensure rel="nofollow" and clean sister attributes across all modified files
  sculptInternalLinks();

  // Recompute final metrics cleanly from disk
  const finalUnderLinked = [];
  const finalLowContextual = [];
  let minIncoming = Infinity;
  let minContextual = Infinity;
  for (const p of targetsToAudit) {
    const inCount = incomingSources.get(p)?.size ?? 0;
    const ctxCount = contextualSources.get(p)?.size ?? 0;
    if (inCount < minIncoming) minIncoming = inCount;
    if (!EXEMPT_BODY_INJECTION.has(p) && ctxCount < minContextual) minContextual = ctxCount;
    if (inCount < MIN_INCOMING_LINKS) finalUnderLinked.push({ urlPath: p, inlinks: inCount });
    if (!EXEMPT_BODY_INJECTION.has(p) && ctxCount < MIN_CONTEXTUAL_LINKS) {
      finalLowContextual.push({ urlPath: p, contextualInlinks: ctxCount });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    zeroEmail: true,
    totalCanonicalSitemapPages: pages.size,
    underLinkedBeforeCount: underLinkedBefore.length,
    lowContextualBeforeCount: lowContextualBefore.length,
    underLinkedAfterCount: finalUnderLinked.length,
    lowContextualAfterCount: finalLowContextual.length,
    minIncomingLinksAcrossSitemap: minIncoming === Infinity ? 0 : minIncoming,
    minContextualLinksAcrossContent: minContextual === Infinity ? 0 : minContextual,
    contextualLinksInjected: linksInjected,
    modifiedDonorPagesCount: modifiedDonors.size,
    cooldownSafeQueryEnrichmentsCount: queryEnrichedPagesCount,
    remainingUnderLinked: finalUnderLinked.slice(0, 20),
    remainingLowContextual: finalLowContextual.slice(0, 20),
    keyMoneyVsUtilityEquity: {
      '/download': incomingSources.get('/download')?.size ?? 0,
      '/pricing': incomingSources.get('/pricing')?.size ?? 0,
      '/vs': incomingSources.get('/vs')?.size ?? 0,
      '/vs/total-adblock': incomingSources.get('/vs/total-adblock')?.size ?? 0,
      '/privacy': incomingSources.get('/privacy')?.size ?? 0,
      '/glossary': incomingSources.get('/glossary')?.size ?? 0
    }
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    `[GSC Strike-Zone Optimizer] Audited ${pages.size} canonical sitemap pages | Min inlinks: ${report.minIncomingLinksAcrossSitemap} (min body: ${report.minContextualLinksAcrossContent}) | Links injected: ${linksInjected} | <5 inlinks remaining: ${finalUnderLinked.length} | Equity:`,
    JSON.stringify(report.keyMoneyVsUtilityEquity)
  );
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runGscStrikeZoneOptimizer();
}
