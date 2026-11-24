import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  WEBSITE_DIR,
  launchHeadlessBrowser,
  parseSitemapUrls,
  startEphemeralServer
} from './e2e-helpers.mjs';

const CORE_ROUTES = [
  '/',
  '/vs/total-adblock',
  '/setup/arc-browser-windows-mac',
  '/pricing',
  '/download',
  '/de',
  '/fr',
  '/es'
];

const HUB_PREFIXES = [
  '/vs/',
  '/setup/',
  '/guides/',
  '/solutions/',
  '/site/',
  '/glossary/',
  '/tools/',
  '/stories/',
  '/campaigns/',
  '/de/',
  '/fr/',
  '/es/'
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
];

function buildSampledRoutes() {
  const mainPaths = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap.xml')).paths;
  const sitePaths = parseSitemapUrls(path.join(WEBSITE_DIR, 'sitemap-sites.xml')).paths;
  const allPaths = [...new Set([...mainPaths, ...sitePaths])];

  const selected = [...CORE_ROUTES];
  const seen = new Set(selected);

  for (const prefix of HUB_PREFIXES) {
    const matches = allPaths.filter((p) => p.startsWith(prefix));
    if (matches.length === 0) continue;
    const picks = matches.length === 1 ? [matches[0]] : [matches[0], matches[Math.floor(matches.length / 2)]];
    for (const pick of picks) {
      if (!seen.has(pick)) {
        seen.add(pick);
        selected.push(pick);
      }
    }
  }
  return selected;
}

const DOM_AUDIT_EXPR = `(() => {
  const issues = [];
  const vw = window.innerWidth;

  // 1. Light surface parity across html, body, main, and direct viewport wrappers (solid color + gradients)
  function parseRgb(str) {
    const m = String(str || '').match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([0-9.]+))?\\s*\\)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
  }
  function relLum({ r, g, b }) {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function checkGradientStops(bgImage, label) {
    if (!bgImage || bgImage === 'none') return;
    const rgbMatches = bgImage.match(/rgba?\\([^)]+\\)/gi) || [];
    for (const rgbStr of rgbMatches) {
      const c = parseRgb(rgbStr);
      if (c && c.a > 0.25 && relLum(c) < 0.40) {
        issues.push('dark_' + label + '_gradient:' + relLum(c).toFixed(3) + ' (' + rgbStr + ')');
        return;
      }
    }
    const okMatches = bgImage.match(/ok(?:lch|lab)\\([^)]+\\)/gi) || [];
    for (const okStr of okMatches) {
      const m = okStr.match(/ok(?:lch|lab)\\(\\s*([0-9.]+)(%?)\\s+[^/)]+(?:\\/\\s*([0-9.]+)(%?))?\\s*\\)/i);
      if (!m) continue;
      const rawL = Number(m[1]);
      const L = m[2] === '%' ? rawL / 100 : rawL;
      const alpha = m[3] === undefined ? 1 : (m[4] === '%' ? Number(m[3]) / 100 : Number(m[3]));
      if (alpha > 0.25 && L < 0.65) {
        issues.push('dark_' + label + '_gradient:okL=' + L.toFixed(3) + ' (' + okStr + ')');
        return;
      }
    }
  }

  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const parsedBodyBg = parseRgb(bodyBg);
  if (!parsedBodyBg || parsedBodyBg.a === 0) {
    const htmlBg = parseRgb(getComputedStyle(document.documentElement).backgroundColor);
    const lum = htmlBg && htmlBg.a > 0 ? relLum(htmlBg) : 1.0;
    if (lum < 0.70) issues.push('dark_surface_luminance:' + lum.toFixed(3));
  } else {
    const lum = relLum(parsedBodyBg);
    if (lum < 0.70) issues.push('dark_body_luminance:' + lum.toFixed(3) + ' (' + bodyBg + ')');
  }
  checkGradientStops(getComputedStyle(document.documentElement).backgroundImage, 'html');
  checkGradientStops(getComputedStyle(document.body).backgroundImage, 'body');

  // 2. Banned #deepblock-live-rule-proof
  if (document.getElementById('deepblock-live-rule-proof') !== null) {
    issues.push('banned_deepblock_live_rule_proof');
  }

  // 3. Horizontal overflow (anti-masking: check documentElement, <main>, AND all visible body > * containers)
  const docScrollW = document.documentElement.scrollWidth;
  if (docScrollW > vw) {
    issues.push('doc_horizontal_overflow:' + docScrollW + '>' + vw);
  }

  const main = document.querySelector('main');
  if (!main) {
    issues.push('missing_main_element');
  } else {
    const mainCs = getComputedStyle(main);
    const parsedMainBg = parseRgb(mainCs.backgroundColor);
    if (parsedMainBg && parsedMainBg.a > 0 && relLum(parsedMainBg) < 0.70) {
      issues.push('dark_main_luminance:' + relLum(parsedMainBg).toFixed(3) + ' (' + mainCs.backgroundColor + ')');
    }
    checkGradientStops(mainCs.backgroundImage, 'main');

    const mainRect = main.getBoundingClientRect();
    if (main.scrollWidth > vw + 1) {
      issues.push('main_scrollWidth_overflow:' + main.scrollWidth + '>' + vw);
    }
    if (mainRect.right > vw + 1) {
      issues.push('main_rect_right_overflow:' + Math.round(mainRect.right) + '>' + vw);
    }
  }

  const wrapperTargets = [
    ...[...document.body.children].filter((el) => el.tagName.toLowerCase() !== 'main').map((el) => ({ el, prefix: '' })),
    ...(main ? [...main.children].map((el) => ({ el, prefix: 'main_' })) : [])
  ];
  for (const { el: child, prefix } of wrapperTargets) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') continue;
    const cs = getComputedStyle(child);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = child.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (!child.classList.contains('suite-obsidian-card') && r.width >= vw * 0.8 && r.height >= window.innerHeight * 0.6) {
      const cbg = parseRgb(cs.backgroundColor);
      if (cbg && cbg.a > 0.25 && relLum(cbg) < 0.70) {
        issues.push('dark_wrapper_' + prefix + tag + '_luminance:' + relLum(cbg).toFixed(3));
      }
      checkGradientStops(cs.backgroundImage, prefix + tag + '_wrapper');
    }
    if (!prefix) {
      if (child.scrollWidth > vw + 1) {
        issues.push('child_' + tag + '_scrollWidth_overflow:' + child.scrollWidth + '>' + vw);
      }
      if (r.right > vw + 1) {
        issues.push('child_' + tag + '_rect_right_overflow:' + Math.round(r.right) + '>' + vw);
      }
    }
  }

  // 4. Fixed .glass-nav existence, brand clipping, nav overlap (interactive + sibling badges), and hero clearance
  const nav = document.querySelector('nav.glass-nav');
  if (!nav) {
    issues.push('missing_glass_nav');
  } else {
    const navRect = nav.getBoundingClientRect();
    if (navRect.height <= 0) {
      issues.push('glass_nav_zero_height');
    }

    // Brand text span clipping
    const brandSpan = nav.querySelector('a > span');
    if (!brandSpan) {
      issues.push('missing_nav_brand_span');
    } else if (brandSpan.scrollWidth > brandSpan.clientWidth + 1) {
      issues.push('nav_brand_clipped:' + brandSpan.scrollWidth + '>' + brandSpan.clientWidth);
    }

    // Visible interactive elements + visible non-interactive sibling text/badge elements inside nav.glass-nav
    const isVisibleInNav = (el) => {
      if (el.getClientRects().length === 0) return false;
      let cur = el;
      while (cur && cur !== nav.parentElement) {
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        cur = cur.parentElement;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const hasDirectText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const navInteractive = [...nav.querySelectorAll('a, button')].filter(isVisibleInNav);
    const navNonInteractiveBadges = [...nav.querySelectorAll('span, div, p, strong, small')].filter((el) => {
      if (el.closest('a, button')) return false;
      if (el.querySelector('a, button')) return false;
      if (!hasDirectText(el)) return false;
      return isVisibleInNav(el);
    });
    const navItems = [...navInteractive, ...navNonInteractiveBadges].map((el) => ({
      el,
      label: (el.textContent || '').trim().slice(0, 30),
      rect: el.getBoundingClientRect()
    }));

    for (const item of navItems) {
      if (item.rect.left < -1 || item.rect.right > vw + 1) {
        issues.push('nav_item_offscreen:' + item.label + ' (' + Math.round(item.rect.left) + '..' + Math.round(item.rect.right) + ' vs ' + vw + ')');
      }
    }
    for (let i = 0; i < navItems.length; i++) {
      for (let j = i + 1; j < navItems.length; j++) {
        const a = navItems[i].rect;
        const b = navItems[j].rect;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) {
          issues.push('nav_items_overlap:' + navItems[i].label + '<->' + navItems[j].label);
        }
      }
    }

    // Hero clearance below fixed .glass-nav (first visible leaf/badge/text element AND h1)
    if (main && navRect.height > 0) {
      const isVis = (el) => {
        if (el.getClientRects().length === 0) return false;
        let cur = el;
        while (cur && cur !== main.parentElement) {
          if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return false;
          const cs = getComputedStyle(cur);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
          cur = cur.parentElement;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const firstContentEl = [...main.querySelectorAll('*')].find((el) => {
        if (!isVis(el)) return false;
        if (hasDirectText(el)) return true;
        return el.matches('h1, h2, h3, p, a, button, [class*="rounded-full"], [data-ab-paywall-badge]') && (el.textContent || '').trim().length > 0;
      });
      if (firstContentEl) {
        const r = firstContentEl.getBoundingClientRect();
        if (r.top < navRect.bottom - 1) {
          issues.push(
            'hero_under_glass_nav:' + firstContentEl.tagName.toLowerCase() +
            '("' + (firstContentEl.textContent || '').trim().slice(0, 30) + '") top=' +
            Math.round(r.top) + '<navBottom=' + Math.round(navRect.bottom)
          );
        }
      }
      const h1 = main.querySelector('h1');
      if (h1 && isVis(h1)) {
        const hr = h1.getBoundingClientRect();
        if (hr.top < navRect.bottom - 1) {
          issues.push('h1_under_glass_nav:top=' + Math.round(hr.top) + '<navBottom=' + Math.round(navRect.bottom));
        }
      }
    }
  }

  return issues;
})()`;

const TAB_RECYCLE_INTERVAL = 15;

let srv;
let browser;
let page;
let navCount = 0;

async function recyclePage() {
  if (page) {
    await page.close().catch(() => {});
  }
  page = await browser.newPage();
}

async function auditRouteInBrowser(baseUrl, route, viewport) {
  if (navCount > 0 && navCount % TAB_RECYCLE_INTERVAL === 0) {
    await recyclePage();
  }
  navCount += 1;

  let netState;
  try {
    await page.setViewport(viewport);
    netState = await page.navigateAndAudit(`${baseUrl}${route}`, baseUrl);
  } catch (err) {
    if (err?.message?.includes('readyState=unknown')) {
      await recyclePage();
      await page.setViewport(viewport);
      netState = await page.navigateAndAudit(`${baseUrl}${route}`, baseUrl);
    } else {
      throw err;
    }
  }
  const domIssues = await page.evaluate(DOM_AUDIT_EXPR);

  const issues = [];
  for (const err of netState.consoleErrors) issues.push(`console.error: ${err}`);
  for (const exc of netState.pageExceptions) issues.push(`exceptionThrown: ${exc}`);
  for (const log of netState.logErrors) issues.push(`log.error: ${log}`);
  for (const r of netState.sameOriginBadResponses) issues.push(`http_${r.status}: ${r.url}`);
  for (const f of netState.sameOriginFailures) issues.push(`network_failed(${f.errorText}): ${f.url}`);
  for (const d of domIssues) issues.push(d);
  return issues;
}

before(async () => {
  srv = await startEphemeralServer();
  browser = await launchHeadlessBrowser();
  page = await browser.newPage();
});

after(async () => {
  try {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close();
  } finally {
    if (srv) await srv.stop();
  }
});

test('Tier 4 Baseline Control: homepage / passes 100% of desktop (1440x900) and mobile (390x844) CDP visual & runtime checks', async () => {
  const failures = [];
  for (const vp of VIEWPORTS) {
    const issues = await auditRouteInBrowser(srv.baseUrl, '/', vp);
    if (issues.length > 0) {
      failures.push(`/ [${vp.name} ${vp.width}x${vp.height}]: ${issues.join('; ')}`);
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('Tier 4: Headless browser desktop (1440x900) & mobile (390x844) runtime, overflow, nav, and surface parity across active hubs', async () => {
  const routes = buildSampledRoutes();
  assert.ok(routes.length >= 8, `Expected at least 8 core+hub routes, got ${routes.length}`);

  const failures = [];
  for (const route of routes) {
    for (const vp of VIEWPORTS) {
      const issues = await auditRouteInBrowser(srv.baseUrl, route, vp);
      if (issues.length > 0) {
        failures.push(`${route} [${vp.name} ${vp.width}x${vp.height}]: ${issues.join('; ')}`);
      }
    }
  }

  assert.equal(
    failures.length,
    0,
    `${failures.length} route/viewport check(s) failed Tier 4 browser verification:\n  - ${failures.join('\n  - ')}`
  );
});
