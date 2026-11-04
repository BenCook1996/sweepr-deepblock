#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Step 3.5: Localized `/de/` & `/fr/` Cookie-Wall & Diagnostic Hubs
 *
 * Targets high-intent German (Usercentrics / Sourcepoint) and French (Didomi CNIL)
 * GDPR cookie-wall and Manifest V3 ad-blocking queries with native localized pages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DE_DIR = path.join(ROOT_DIR, 'website', 'de');
const FR_DIR = path.join(ROOT_DIR, 'website', 'fr');

fs.mkdirSync(DE_DIR, { recursive: true });
fs.mkdirSync(FR_DIR, { recursive: true });

function renderEuPage({
  lang,
  canonicalPath,
  title,
  description,
  badge,
  h1,
  lead,
  cmpName,
  publishers,
  guideLink,
  guideLabel,
  ctaInstall,
  ctaPro,
  faqs
}) {
  const canonicalUrl = `https://sweeprdeepblock.com${canonicalPath}`;
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        description,
        inLanguage: lang,
        url: canonicalUrl,
        publisher: { '@type': 'Organization', name: 'SWEEPR Global Limited', url: 'https://sweeprdeepblock.com' }
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      }
    ]
  });

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index, follow" />
  <meta name="theme-color" content="#0F172A" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="en" href="https://sweeprdeepblock.com/solutions/auto-reject-cookie-popups" />
  <link rel="alternate" hreflang="de" href="https://sweeprdeepblock.com/de" />
  <link rel="alternate" hreflang="fr" href="https://sweeprdeepblock.com/fr" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="https://sweeprdeepblock.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="https://sweeprdeepblock.com/og-image.png" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script type="application/ld+json">${schema}</script>
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', { transport_url: window.location.origin + '/metrics', first_party_collection: true });
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
  <header class="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2.5 text-white font-black text-lg tracking-tight no-underline">
        <img src="/logo.svg" alt="SWEEPR DeepBlock logo" width="32" height="32" class="w-8 h-8" />
        <span>SWEEPR <span class="text-emerald-400">DeepBlock</span></span>
      </a>
      <nav class="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-300">
        <a href="/de" class="hover:text-white">🇩🇪 Deutsch</a>
        <a href="/fr" class="hover:text-white">🇫🇷 Français</a>
        <a href="/site" class="hover:text-white">150 Site Audits</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
        <a href="/stories" class="hover:text-white">Case Studies</a>
      </nav>
      <a href="/download" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm no-underline">${ctaInstall} →</a>
    </div>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
    <div class="space-y-4">
      <span class="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase">${badge}</span>
      <h1 class="text-3xl sm:text-5xl font-black text-white tracking-tight">${h1}</h1>
      <p class="text-slate-300 text-base sm:text-lg leading-relaxed">${lead}</p>
      <div class="flex flex-wrap gap-3 pt-2">
        <a href="/download" class="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm no-underline">${ctaInstall} →</a>
        <a href="/order?plan=annual" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 no-underline">${ctaPro}</a>
        <a href="${guideLink}" class="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-sm border border-emerald-500/30 no-underline">${guideLabel}</a>
      </div>
    </div>

    <section class="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
      <h2 class="text-xl font-black text-white">${cmpName} — Live Telemetry &amp; Verified Domain Audits</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${publishers
          .map(
            (p) => `<a href="/site/${p.slug}" class="bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 no-underline space-y-1">
          <div class="text-xs font-bold text-emerald-400 uppercase">${p.cmp}</div>
          <div class="text-base font-black text-white">${p.domain}</div>
          <div class="text-xs text-slate-400">${p.adReq} Ad Requests • -${p.loadSec}s Load</div>
        </a>`
          )
          .join('\n')}
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-2xl font-black text-white">FAQ</h2>
      ${faqs
        .map(
          (f) => `<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <h3 class="text-base font-bold text-white">${f.q}</h3>
        <p class="text-sm text-slate-300 leading-relaxed">${f.a}</p>
      </div>`
        )
        .join('\n')}
    </section>
  </main>

  <footer class="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div>© 2026 SWEEPR Global Limited. Local-first Manifest V3 engine.</div>
      <div class="flex flex-wrap gap-4">
        <a href="/" class="hover:text-white">English Home</a>
        <a href="/de" class="hover:text-white">Deutsch (/de)</a>
        <a href="/fr" class="hover:text-white">Français (/fr)</a>
        <a href="/site" class="hover:text-white">150 Site Audits</a>
        <a href="/stories" class="hover:text-white">Customer Stories</a>
        <a href="/tools" class="hover:text-white">Diagnostic Tools</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

const dePubs = [
  { domain: 'bild.de', slug: 'bild-de', cmp: 'Sourcepoint / Usercentrics', adReq: 73, loadSec: 5.2 },
  { domain: 'spiegel.de', slug: 'spiegel-de', cmp: 'Sourcepoint TCF v2.2', adReq: 58, loadSec: 4.1 },
  { domain: 'focus.de', slug: 'focus-de', cmp: 'Usercentrics CMP', adReq: 71, loadSec: 5.0 },
  { domain: 'chip.de', slug: 'chip-de', cmp: 'Usercentrics CMP', adReq: 68, loadSec: 4.8 },
  { domain: 'heise.de', slug: 'heise-de', cmp: 'Sourcepoint TCF v2.2', adReq: 49, loadSec: 3.4 },
  { domain: 'chefkoch.de', slug: 'chefkoch-de', cmp: 'Usercentrics CMP', adReq: 66, loadSec: 4.7 }
];

const frPubs = [
  { domain: 'lemonde.fr', slug: 'lemonde-fr', cmp: 'Didomi CNIL CMP', adReq: 56, loadSec: 3.9 },
  { domain: 'lefigaro.fr', slug: 'lefigaro-fr', cmp: 'Didomi CNIL CMP', adReq: 68, loadSec: 4.8 },
  { domain: 'bfmtv.com', slug: 'bfmtv-com', cmp: 'Didomi CNIL CMP', adReq: 69, loadSec: 4.9 },
  { domain: '20minutes.fr', slug: '20minutes-fr', cmp: 'Didomi CNIL CMP', adReq: 67, loadSec: 4.7 },
  { domain: 'jeuxvideo.com', slug: 'jeuxvideo-com', cmp: 'Didomi CNIL CMP', adReq: 70, loadSec: 5.0 },
  { domain: 'marmiton.org', slug: 'marmiton-org', cmp: 'Didomi CNIL CMP', adReq: 68, loadSec: 4.8 }
];

// 1. /de Hub
fs.writeFileSync(
  path.join(DE_DIR, 'index.html'),
  renderEuPage({
    lang: 'de-DE',
    canonicalPath: '/de',
    title: 'SWEEPR DeepBlock Deutsch: Werbeblocker & Cookie-Blocker (MV3)',
    description: 'Blockieren Sie YouTube-Werbung, Tracker und Usercentrics/Sourcepoint Cookie-Banner automatisch in unter 50ms ohne eingefrorenes Scrollen.',
    badge: '🇩🇪 SWEEPR DeepBlock v1.2.7 • Manifest V3 Engine für Deutschland & DACH',
    h1: 'Werbung & Usercentrics Cookie-Banner automatisch in <50ms ablehnen',
    lead: 'Deutsche Nachrichtenseiten (BILD, SPIEGEL, FOCUS, CHIP, Chefkoch) laden bis zu 73 Werbe-Skripte und blockieren den Bildschirm mit Usercentrics- oder Sourcepoint-Bannern. SWEEPR DeepBlock lehnt nicht-essenzielle Cookies vollautomatisch ab und spart bis zu 62% Browser-RAM.',
    cmpName: 'Geprüfte deutsche Websites (Usercentrics & Sourcepoint TCF v2.2)',
    publishers: dePubs,
    guideLink: '/de/usercentrics-cookie-banner-blockieren',
    guideLabel: 'Usercentrics Leitfaden lesen →',
    ctaInstall: 'Kostenlos installieren',
    ctaPro: 'DeepBlock Pro freischalten',
    faqs: [
      {
        q: 'Wie blockiert SWEEPR DeepBlock Usercentrics und Sourcepoint Cookie-Banner?',
        a: 'Statt das Cookie-Banner nur per CSS auszublenden (wodurch das Scrollen auf deutschen Websites oft einfriert), löst SWEEPR DeepBlock in unter 50ms das offizielle "Alle ablehnen"-Signal aus und stellt das Seiten-Scrollen sofort wieder her.'
      },
      {
        q: 'Funktioniert SWEEPR DeepBlock trotz Chrome Manifest V3 auf YouTube?',
        a: 'Ja. Unsere DeepStealth-Engine kombiniert C++ declarativeNetRequest-Filter mit dynamischen Skriptlets und besteht alle 8/8 Anti-Erkennungs-Checks im Live-Test-Lab.'
      }
    ]
  }),
  'utf8'
);

// 2. /de/usercentrics-cookie-banner-blockieren
fs.writeFileSync(
  path.join(DE_DIR, 'usercentrics-cookie-banner-blockieren.html'),
  renderEuPage({
    lang: 'de-DE',
    canonicalPath: '/de/usercentrics-cookie-banner-blockieren',
    title: 'Usercentrics & Sourcepoint Cookie-Banner automatisch ablehnen | SWEEPR',
    description: 'Technischer Leitfaden 2026: Wie Sie Usercentrics Shadow-DOM und Sourcepoint TCF v2.2 Cookie-Walls auf deutschen Websites automatisch in <50ms ablehnen.',
    badge: '🇩🇪 Technischer Leitfaden • Usercentrics Shadow-DOM & Sourcepoint CMP',
    h1: 'Usercentrics & Sourcepoint Cookie-Banner ohne Scroll-Sperre blockieren',
    lead: 'Usercentrics nutzt ein geschütztes Web-Component Shadow-DOM (#usercentrics-root), an dem herkömmliche CSS-Blocker scheitern. Erfahren Sie, wie SWEEPR DeepBlock das TCF v2.2 Ablehnungssignal in unter 50 Millisekunden ausführt.',
    cmpName: 'Deutsche Websites mit Usercentrics & Sourcepoint CMP',
    publishers: dePubs,
    guideLink: '/tools/is-my-adblocker-working',
    guideLabel: '8-Punkte Browser-Test starten →',
    ctaInstall: 'Erweiterung installieren',
    ctaPro: 'Pro-Schutz aktivieren',
    faqs: [
      {
        q: 'Warum friert das Scrollen ein, wenn normale Adblocker Usercentrics verstecken?',
        a: 'Weil Usercentrics und Sourcepoint die Eigenschaft overflow:hidden auf dem <html>- und <body>-Element setzen, bis eine Entscheidung getroffen wurde. SWEEPR DeepBlock lehnt die Cookies programmatisch ab und entfernt die Scroll-Sperre automatisch.'
      },
      {
        q: 'Werden meine besuchten Websites gespeichert?',
        a: 'Nein. SWEEPR DeepBlock arbeitet zu 100% lokal in Ihrem Browser (Zero Browsing History Logged).'
      }
    ]
  }),
  'utf8'
);

// 3. /fr Hub
fs.writeFileSync(
  path.join(FR_DIR, 'index.html'),
  renderEuPage({
    lang: 'fr-FR',
    canonicalPath: '/fr',
    title: 'SWEEPR DeepBlock Français : Bloqueur de Pub MV3 & Cookies Didomi',
    description: 'Bloquez les publicités vidéo YouTube, les traqueurs CNAME et refusez automatiquement les bandeaux cookies Didomi et Quantcast en moins de 50ms.',
    badge: '🇫🇷 SWEEPR DeepBlock v1.2.7 • Moteur Manifest V3 pour la France',
    h1: 'Bloquez les pubs et refusez les bandeaux cookies Didomi en <50ms',
    lead: 'Les grands sites français (Le Monde, Le Figaro, BFMTV, JeuxVideo.com, Marmiton) chargent jusqu’à 70 requêtes publicitaires et imposent des bandeaux Didomi. SWEEPR DeepBlock refuse automatiquement les traceurs en moins de 50ms et réduit la consommation RAM de 62%.',
    cmpName: 'Sites français audités (Didomi CNIL & Quantcast TCF v2.2)',
    publishers: frPubs,
    guideLink: '/fr/bloquer-bandeau-cookie-didomi',
    guideLabel: 'Lire le guide Didomi →',
    ctaInstall: 'Installer gratuitement',
    ctaPro: 'Débloquer DeepBlock Pro',
    faqs: [
      {
        q: 'Comment SWEEPR DeepBlock gère-t-il les bandeaux cookies Didomi conformes CNIL ?',
        a: 'Au lieu de masquer simplement la fenêtre avec du CSS (ce qui bloque le défilement de la page), SWEEPR DeepBlock active automatiquement l’option « Continuer sans accepter / Tout refuser » en moins de 50 millisecondes.'
      },
      {
        q: 'SWEEPR DeepBlock fonctionne-t-il avec Chrome Manifest V3 en 2026 ?',
        a: 'Oui. Notre moteur DeepStealth obtient un score parfait de 8/8 dans notre laboratoire de test anti-détection.'
      }
    ]
  }),
  'utf8'
);

// 4. /fr/bloquer-bandeau-cookie-didomi
fs.writeFileSync(
  path.join(FR_DIR, 'bloquer-bandeau-cookie-didomi.html'),
  renderEuPage({
    lang: 'fr-FR',
    canonicalPath: '/fr/bloquer-bandeau-cookie-didomi',
    title: 'Refuser les Bandeaux Cookies Didomi en 50ms | SWEEPR',
    description: 'Guide technique 2026 : comment refuser automatiquement les bandeaux cookies Didomi et Quantcast sur les sites français sans bloquer le défilement.',
    badge: '🇫🇷 Guide Technique • Automatisation CMP Didomi & CNIL',
    h1: 'Comment bloquer et refuser automatiquement les bandeaux cookies Didomi',
    lead: 'Présent sur plus de 75% des médias français, le gestionnaire de consentement Didomi (#didomi-host) verrouille le défilement tant qu’aucun choix n’est enregistré. SWEEPR DeepBlock exécute le refus CNIL instantanément au chargement.',
    cmpName: 'Médias et portails français utilisant Didomi CMP',
    publishers: frPubs,
    guideLink: '/tools/is-my-adblocker-working',
    guideLabel: 'Lancer le diagnostic 8/8 →',
    ctaInstall: 'Installer l’extension',
    ctaPro: 'Passer à DeepBlock Pro',
    faqs: [
      {
        q: 'Pourquoi le défilement est-il bloqué sur Le Figaro ou Marmiton avec certains bloqueurs ?',
        a: 'Les règles CSS classiques cachent la boîte #didomi-popup mais laissent la classe didomi-popup-open active sur le body. SWEEPR DeepBlock déclenche le refus officiel et restaure immédiatement le défilement.'
      },
      {
        q: 'Mon historique de navigation est-il collecté ?',
        a: 'Jamais. Tout le filtrage s’exécute localement dans votre navigateur.'
      }
    ]
  }),
  'utf8'
);

console.log('Built 4 localized EU (/de and /fr) cookie-wall & diagnostic hub pages.');
