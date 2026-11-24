#!/usr/bin/env node
/**
 * SWEEPR Deepblock — Localized `/de`, `/fr`, & `/es` Cookie-Wall & MV3 Hubs
 *
 * Holographic Pearl Light Shell + M1 Decision Compliant:
 *  - `/de`, `/fr`, `/es` (`KEEP_REWRITE`): authoritative EUR pricing (€34,99/yr, €22,99/6mo, €1,99->€5,99/mo, €99,99/yr Suite),
 *    native Usercentrics/Didomi/AEPD guidance, zero Safari/iOS, zero synthetic telemetry, 5 reciprocal hreflangs,
 *    links strictly to KEPT_URLS_SET routes (+ rel="nofollow" on /order*).
 *  - `/de/usercentrics-cookie-banner-blockieren` -> `/de` (`CONSOLIDATE_301`, noindex, follow)
 *  - `/fr/bloquer-bandeau-cookie-didomi` -> `/fr` (`CONSOLIDATE_301`, noindex, follow)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_ORIGIN,
  PRODUCT_FACTS,
  escapeHtml,
  renderShellPage,
  renderBreadcrumbs,
  renderGlassCard,
  renderComparisonTable,
  renderCallout,
  renderCtaBanner,
  renderRelatedGrid,
  getM1Decision
} from './lib/holographic-shell.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DE_DIR = path.join(ROOT_DIR, 'website', 'de');
const FR_DIR = path.join(ROOT_DIR, 'website', 'fr');
const ES_DIR = path.join(ROOT_DIR, 'website', 'es');

fs.mkdirSync(DE_DIR, { recursive: true });
fs.mkdirSync(FR_DIR, { recursive: true });
fs.mkdirSync(ES_DIR, { recursive: true });

const VERSION = PRODUCT_FACTS.version;
const STATIC_RULES = PRODUCT_FACTS.staticDnrRules;

const RECIPROCAL_HUB_HREFLANGS = [
  { lang: 'en', href: `${SITE_ORIGIN}/` },
  { lang: 'de', href: `${SITE_ORIGIN}/de` },
  { lang: 'fr', href: `${SITE_ORIGIN}/fr` },
  { lang: 'es', href: `${SITE_ORIGIN}/es` },
  { lang: 'x-default', href: `${SITE_ORIGIN}/` }
];

const I18N_CHROME = {
  'de-DE': {
    shortLang: 'de',
    homeLabel: 'Startseite',
    ctaProPrice: '€34,99/Jahr',
    suiteBtn: 'Komplett-Paket (€99,99/Jahr)',
    matrixTitle: `Browser-Kompatibilität & Architektur-Matrix (v${VERSION})`,
    matrixSubtitle: 'Alle Filterregeln, Cookie-Ablehnungen und URL-Parameter-Bereinigungen laufen lokal in Ihrer nativen Browser-Engine ohne Verlaufsspeicherung.',
    matrixCols: ['Browser / Plattform', 'Mindestversion', 'Verteilung', `Funktionen in v${VERSION}`],
    matrixRows: [
      ['Google Chrome & Brave', 'Chromium 116+', 'Chrome Web Store', `${STATIC_RULES} statische C++ DNR-Regeln (264 Ad/Tracker, 18 Miner, 1 URL-Stripper), 100 OTA-Regeln, YouTube-Schutz, CMP-Ablehnung, Tab & RAM Tamer`],
      ['Microsoft Edge', 'Edge 116+ (MV3)', 'Edge Add-ons', 'Volle MV3-Parität, 20-Parameter URL-Stripper, Element-Zapper, 5-Geräte-Lizenzsync'],
      ['Mozilla Firefox (Desktop & Android)', 'Gecko 140.0+', 'Mozilla Add-ons (AMO)', 'Signiertes XPI-Paket für Desktop & Android; blockiert Video-Ads, Usercentrics/Sourcepoint & Miner'],
      ['Opera Desktop', 'Chromium 116+', 'Opera Add-ons', 'Natives MV3-Paket ohne Telemetrie, Cryptominer-Schutz & 10-Min.-Tab-Ruhezustand (chrome.tabs.discard)']
    ],
    plansTitle: 'Transparente EUR-Preise, 5-Geräte-Schutz & 14-Tage-Garantie',
    plansLead: 'Jeder Pro-Tarif schützt bis zu 5 Desktop- oder Mobilbrowser gleichzeitig (inklusive Total Tab & RAM Tamer, 20-Parameter URL-Stripper und 7 Tage Offline-Kulanzzeit) mit 1-Klick-Kündigung und 14-tägiger Geld-zurück-Garantie.',
    plansCards: [
      { name: 'Jahrestarif (-51% vs. Monat)', price: '€34,99/Jahr', eq: '€2,92/Monat äquiv. · Flache Verlängerung', href: '/order?plan=annual', cta: 'Jahrestarif wählen' },
      { name: '6-Monats-Tarif', price: '€22,99 / 6 Mon.', eq: '€3,83/Monat äquiv. · 5 Geräte', href: '/order?plan=six_month', cta: '6-Monats-Tarif wählen' },
      { name: 'Monatstarif (€1,99 Start)', price: '€1,99 1. Mon.', eq: 'Danach €5,99/Monat · Jederzeit kündbar', href: '/order?plan=monthly', cta: 'Monatstarif wählen' },
      { name: 'Komplett-Schutzpaket (-45%)', price: '€99,99/Jahr', eq: '€8,33/Mo. äquiv. (Einzeln €184,97) · 5 Geräte', href: '/order?plan=suite_annual', cta: 'Komplett-Paket wählen' }
    ],
    purAboNoteTitle: 'Hinweis zu strikten Pay-or-Consent („Pur-Abo“)-Wänden',
    purAboNoteBody: 'Serverseitige Bezahl- oder Einwilligungsschranken („Pur-Abo“) prüfen Abo-Cookies auf Verlagsservern und lassen sich durch clientseitige Browser-Erweiterungen nicht umgehen. SWEEPR Deepblock konzentriert sich auf automatisches „Alle ablehnen“ bei regulären Usercentrics-, Sourcepoint- und OneTrust-Bannern sowie Scroll-Wiederherstellung.',
    faqHeading: 'Häufig gestellte Fragen (FAQ)',
    relatedHeading: 'Diagnose-Tools & Weiterführende Leitfäden',
    relatedItems: [
      { href: '/test-lab', badge: 'Live-Test', label: 'Anti-Detection Test Lab starten' },
      { href: '/tools/browser-ram-calculator', badge: 'Rechner', label: 'Browser-RAM & Tab-Bloat-Rechner' },
      { href: '/guides/how-to-automatically-reject-cookie-banners-uk', badge: 'CMP-Ratgeber', label: 'Cookie-Banner automatisch ablehnen' },
      { href: '/vs/total-adblock', badge: 'Vergleich', label: 'SWEEPR Deepblock vs. Total Adblock' }
    ]
  },
  'fr-FR': {
    shortLang: 'fr',
    homeLabel: 'Accueil',
    ctaProPrice: '34,99 €/an',
    suiteBtn: 'Suite Complète (99,99 €/an)',
    matrixTitle: `Compatibilité Navigateurs & Matrice d’Architecture (v${VERSION})`,
    matrixSubtitle: 'Toutes les règles réseau, refus de cookies et suppressions de traceurs URL s’exécutent localement sans jamais enregistrer votre historique.',
    matrixCols: ['Navigateur / Plateforme', 'Moteur Minimum', 'Canal Officiel', `Capacités v${VERSION}`],
    matrixRows: [
      ['Google Chrome & Brave', 'Chromium 116+', 'Chrome Web Store', `${STATIC_RULES} règles DNR C++ statiques (264 pub/traceur, 18 mineurs, 1 nettoyage URL), 100 règles OTA, bouclier YouTube, refus CMP, RAM Tamer`],
      ['Microsoft Edge', 'Edge 116+ (MV3)', 'Edge Add-ons', 'Parité MV3 complète, suppression de 20 paramètres URL, Element Zapper, synchro 5 appareils'],
      ['Mozilla Firefox (Bureau & Android)', 'Gecko 140.0+', 'Mozilla Add-ons (AMO)', 'Extension XPI signée sur bureau & Android ; bloque pubs vidéo, Didomi/Quantcast & mineurs'],
      ['Opera Desktop', 'Chromium 116+', 'Opera Add-ons', 'Package MV3 natif zéro télémétrie, blocage cryptomineurs & mise en veille à 10 min (chrome.tabs.discard)']
    ],
    plansTitle: 'Tarifs EUR Transparents, 5 Appareils & Garantie 14 Jours',
    plansLead: 'Chaque licence Pro protège jusqu’à 5 navigateurs simultanément (avec Total Tab & RAM Tamer, nettoyeur de 20 paramètres URL et grâce hors-ligne de 7 jours), annulation en 1 clic et remboursement intégral sous 14 jours.',
    plansCards: [
      { name: 'Offre Annuelle (-51% vs mensuel)', price: '34,99 €/an', eq: '2,92 €/mois éq. · Renouvellement fixe', href: '/order?plan=annual', cta: 'Choisir l’offre annuelle' },
      { name: 'Offre 6 Mois', price: '22,99 € / 6 mois', eq: '3,83 €/mois éq. · 5 appareils', href: '/order?plan=six_month', cta: 'Choisir 6 mois' },
      { name: 'Offre Mensuelle (1,99 € 1er mois)', price: '1,99 € 1er mois', eq: 'Puis 5,99 €/mois · Sans engagement', href: '/order?plan=monthly', cta: 'Choisir mensuel' },
      { name: 'Suite Sécurité Complète (-45%)', price: '99,99 €/an', eq: '8,33 €/mois éq. (184,97 € séparément) · 5 appareils', href: '/order?plan=suite_annual', cta: 'Choisir la Suite Complète' }
    ],
    purAboNoteTitle: 'Précision sur les murs stricts Pay-or-Consent (« Pur Abo »)',
    purAboNoteBody: 'Les murs d’abonnement vérifiés côté serveur (« Pay or Consent ») ne peuvent pas être contournés par une extension locale. SWEEPR Deepblock automatise le bouton CNIL « Continuer sans accepter » sur les bannières Didomi, Quantcast et OneTrust tout en déverrouillant le défilement.',
    faqHeading: 'Questions Fréquentes (FAQ)',
    relatedHeading: 'Outils de Diagnostic & Guides Associés',
    relatedItems: [
      { href: '/test-lab', badge: 'Test en Direct', label: 'Lancer le Test Lab Anti-Détection' },
      { href: '/tools/browser-ram-calculator', badge: 'Calculateur', label: 'Calculateur RAM & Onglets' },
      { href: '/guides/how-to-automatically-reject-cookie-banners-uk', badge: 'Guide CMP', label: 'Refus automatique des cookies' },
      { href: '/vs/total-adblock', badge: 'Comparatif', label: 'SWEEPR Deepblock vs Total Adblock' }
    ]
  },
  'es-ES': {
    shortLang: 'es',
    homeLabel: 'Inicio',
    ctaProPrice: '34,99 €/año',
    suiteBtn: 'Suite Completa (99,99 €/año)',
    matrixTitle: `Matriz de Compatibilidad y Arquitectura (v${VERSION})`,
    matrixSubtitle: 'Todas las reglas de red, rechazos de cookies y limpieza de parámetros URL se ejecutan localmente sin registrar tu historial.',
    matrixCols: ['Navegador / Plataforma', 'Motor Mínimo', 'Canal Oficial', `Capacidades v${VERSION}`],
    matrixRows: [
      ['Google Chrome & Brave', 'Chromium 116+', 'Chrome Web Store', `${STATIC_RULES} reglas DNR C++ estáticas (264 anuncios/rastreadores, 18 mineros, 1 limpiador URL), 100 reglas OTA, escudo YouTube, rechazo CMP, RAM Tamer`],
      ['Microsoft Edge', 'Edge 116+ (MV3)', 'Edge Add-ons', 'Paridad MV3 completa, limpieza de 20 parámetros URL, Element Zapper, 5 dispositivos'],
      ['Mozilla Firefox (Escritorio y Android)', 'Gecko 140.0+', 'Mozilla Add-ons (AMO)', 'Extensión XPI firmada para PC y Android; bloquea vídeo-anuncios, Didomi/OneTrust y mineros'],
      ['Opera Desktop', 'Chromium 116+', 'Opera Add-ons', 'Paquete MV3 nativo sin telemetría, bloqueo criptominero e hibernación a los 10 min (chrome.tabs.discard)']
    ],
    plansTitle: 'Precios Transparentes en EUR, 5 Dispositivos y Garantía de 14 Días',
    plansLead: 'Cada licencia Pro protege hasta 5 navegadores a la vez (incluye Total Tab & RAM Tamer, limpiador de 20 parámetros URL y 7 días de margen sin conexión), con cancelación en 1 clic y garantía de devolución de 14 días.',
    plansCards: [
      { name: 'Plan Anual (-51% vs mensual)', price: '34,99 €/año', eq: '2,92 €/mes equiv. · Renovación plana', href: '/order?plan=annual', cta: 'Elegir Plan Anual' },
      { name: 'Plan 6 Meses', price: '22,99 € / 6 meses', eq: '3,83 €/mes equiv. · 5 dispositivos', href: '/order?plan=six_month', cta: 'Elegir 6 Meses' },
      { name: 'Plan Mensual (1,99 € 1er mes)', price: '1,99 € 1er mes', eq: 'Luego 5,99 €/mes · Cancela cuando quieras', href: '/order?plan=monthly', cta: 'Elegir Mensual' },
      { name: 'Suite de Seguridad Completa (-45%)', price: '99,99 €/año', eq: '8,33 €/mes equiv. (184,97 € por separado) · 5 dispositivos', href: '/order?plan=suite_annual', cta: 'Elegir Suite Completa' }
    ],
    purAboNoteTitle: 'Nota sobre muros estrictos Pay-or-Consent',
    purAboNoteBody: 'Los muros de suscripción validados en servidor no pueden omitirse mediante extensiones locales. SWEEPR Deepblock automatiza el botón «Rechazar todo» conforme a la AEPD en banners de OneTrust, Didomi, Sourcepoint y Quantcast y restaura el desplazamiento.',
    faqHeading: 'Preguntas Frecuentes (FAQ)',
    relatedHeading: 'Herramientas de Diagnóstico y Guías',
    relatedItems: [
      { href: '/test-lab', badge: 'Test en Vivo', label: 'Ejecutar Test Lab Anti-Detección' },
      { href: '/tools/browser-ram-calculator', badge: 'Calculadora', label: 'Calculadora de RAM y Pestañas' },
      { href: '/guides/strip-utm-fbclid-gclid-tracking-links', badge: 'Guía URL', label: 'Limpiar rastreadores UTM, fbclid y gclid' },
      { href: '/vs/total-adblock', badge: 'Comparativa', label: 'SWEEPR Deepblock vs Total Adblock' }
    ]
  }
};

function buildEuJsonLd({ lang, title, description, canonicalUrl, breadcrumbs }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        description,
        inLanguage: lang,
        url: canonicalUrl,
        datePublished: '2026-10-15',
        dateModified: new Date().toISOString().slice(0, 10),
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          name: PRODUCT_FACTS.name,
          legalName: 'SWEEPR Global Limited',
          url: `${SITE_ORIGIN}/`
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: b.item.startsWith('http') ? b.item : `${SITE_ORIGIN}${b.item}`
        }))
      },
      {
        '@type': 'SoftwareApplication',
        name: PRODUCT_FACTS.name,
        softwareVersion: VERSION,
        applicationCategory: 'SecurityApplication',
        operatingSystem: PRODUCT_FACTS.operatingSystem,
        url: canonicalUrl,
        downloadUrl: `${SITE_ORIGIN}/download`,
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '1.99',
          highPrice: '99.99',
          priceCurrency: 'EUR',
          offerCount: '4',
          priceValidUntil: '2027-12-31',
          validFrom: '2026-01-01',
          url: `${SITE_ORIGIN}/pricing`
        }
      }
    ]
  };
}

function renderEuPage({
  lang,
  isMainHub = false,
  canonicalPath,
  title,
  description,
  badge,
  h1,
  lead,
  guideLink,
  guideLabel,
  ctaInstall,
  ctaPro,
  regulatoryTitle,
  regulatoryLead,
  regulatoryCards,
  cmpTechnicalTitle,
  cmpTechnicalBodyHtml,
  faqs
}) {
  const t = I18N_CHROME[lang];
  const decision = getM1Decision(canonicalPath);
  const isConsolidate = decision?.action === 'CONSOLIDATE_301' && decision.redirectTarget;
  const robots = isConsolidate
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const effectiveCanonicalPath = isConsolidate ? decision.redirectTarget : canonicalPath;
  const canonicalUrl = `${SITE_ORIGIN}${effectiveCanonicalPath}`;

  const breadcrumbs = [
    { name: t.homeLabel, item: '/' },
    { name: lang === 'de-DE' ? 'Deutsch (DE) Hub' : lang === 'fr-FR' ? 'Français (FR) Hub' : 'Español (ES) Hub', item: effectiveCanonicalPath }
  ];

  const jsonLd = buildEuJsonLd({
    lang,
    title,
    description,
    canonicalUrl,
    breadcrumbs
  });

  const matrixHtml = renderComparisonTable({
    id: 'eu-browser-matrix',
    caption: t.matrixTitle,
    headers: t.matrixCols,
    rows: t.matrixRows
  });

  const plansHtml = `
    <section class="glass-card bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
      <div class="space-y-2">
        <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(t.plansTitle)}</h2>
        <p class="text-sm text-gray-600 leading-relaxed m-0">${escapeHtml(t.plansLead)}</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${t.plansCards
          .map(
            (card) => `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-4">
          <div class="space-y-1">
            <div class="text-xs font-bold text-emerald-700 uppercase">${escapeHtml(card.name)}</div>
            <div class="text-xl font-extrabold text-gray-900 tabular-nums">${escapeHtml(card.price)}</div>
            <div class="text-xs text-gray-600">${escapeHtml(card.eq)}</div>
          </div>
          <a href="${escapeHtml(card.href)}" rel="nofollow" class="btn btn-go px-3 py-2.5 rounded-xl font-bold text-xs text-center no-underline justify-center">${escapeHtml(card.cta)} &rarr;</a>
        </div>`
          )
          .join('\n        ')}
      </div>
    </section>
  `;

  const faqsHtml = `
    <section class="space-y-4">
      <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(t.faqHeading)}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${faqs
          .map(
            (f) => `<div class="glass-card bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <h3 class="text-base font-bold text-gray-900">${escapeHtml(f.q)}</h3>
          <p class="text-sm text-gray-600 leading-relaxed m-0">${f.a}</p>
        </div>`
          )
          .join('\n        ')}
      </div>
    </section>
  `;

  const contentHtml = `
    ${renderBreadcrumbs(breadcrumbs)}
    <header class="space-y-4">
      <span class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">${escapeHtml(badge)}</span>
      <h1 class="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(h1)}</h1>
      <p class="text-gray-600 text-base sm:text-lg leading-relaxed max-w-3xl">${lead}</p>
      <div class="flex flex-wrap gap-3 pt-1">
        <a href="/download?install=1" class="btn btn-go px-5 py-3 rounded-xl font-bold text-sm no-underline">${escapeHtml(ctaInstall)} &rarr;</a>
        <a href="/order?plan=annual" rel="nofollow" class="btn px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold text-sm no-underline">${escapeHtml(ctaPro)} (${escapeHtml(t.ctaProPrice)})</a>
        <a href="/order?plan=suite_annual" rel="nofollow" class="btn px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-sm no-underline">${escapeHtml(t.suiteBtn)} &rarr;</a>
        <a href="${escapeHtml(guideLink)}" class="btn px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-emerald-700 border border-gray-200 font-bold text-sm no-underline">${escapeHtml(guideLabel)}</a>
      </div>
    </header>

    ${renderGlassCard({
      title: regulatoryTitle,
      badge: `v${VERSION} · ${STATIC_RULES} Static Rules`,
      bodyHtml: `<div class="space-y-5">
        <p class="text-sm sm:text-base text-gray-700 leading-relaxed m-0">${regulatoryLead}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${regulatoryCards
            .map(
              (c) => `<div class="bg-slate-50 border border-slate-200 border-l-4 rounded-2xl p-5 space-y-2" style="border-left-color:#059669;">
            <div class="text-xs font-bold uppercase tracking-wider text-emerald-700">${escapeHtml(c.tag)}</div>
            <h3 class="text-base font-extrabold text-gray-900">${escapeHtml(c.title)}</h3>
            <p class="text-xs sm:text-sm text-gray-600 leading-relaxed m-0">${c.body}</p>
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>`
    })}

    ${renderGlassCard({
      title: cmpTechnicalTitle,
      badge: 'Shadow-DOM & TCF v2.2',
      bodyHtml: cmpTechnicalBodyHtml
    })}

    ${renderCallout({
      tone: 'amber',
      title: t.purAboNoteTitle,
      bodyHtml: escapeHtml(t.purAboNoteBody)
    })}

    <div class="space-y-3">
      <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">${escapeHtml(t.matrixTitle)}</h2>
      <p class="text-sm text-gray-600">${escapeHtml(t.matrixSubtitle)}</p>
      ${matrixHtml}
    </div>

    ${plansHtml}
    ${faqsHtml}

    ${renderRelatedGrid({
      heading: t.relatedHeading,
      items: t.relatedItems
    })}
  `;

  return renderShellPage({
    title,
    description,
    canonicalUrl,
    currentPath: isMainHub ? canonicalPath : '/de',
    lang: t.shortLang,
    htmlLang: lang,
    robots,
    ogType: 'website',
    hreflangs: isMainHub ? RECIPROCAL_HUB_HREFLANGS : null,
    jsonLd,
    contentHtml
  });
}

// 1. /de Hub (KEEP_REWRITE — includes Usercentrics + TDDDG § 25 technical guidance)
fs.writeFileSync(
  path.join(DE_DIR, 'index.html'),
  renderEuPage({
    lang: 'de-DE',
    isMainHub: true,
    canonicalPath: '/de',
    title: 'SWEEPR Deepblock Deutsch: Werbeblocker & Cookie-Blocker (MV3)',
    description: 'Blockieren Sie Werbung, Tracker und Usercentrics/Sourcepoint Cookie-Banner nach TDDDG § 25 automatisch ohne eingefrorenes Scrollen.',
    badge: `SWEEPR Deepblock v${VERSION} · Manifest V3 Engine für Deutschland & DACH`,
    h1: 'Werbung & Usercentrics Cookie-Banner automatisch ablehnen',
    lead: `Deutsche Nachrichtenseiten und Portale laden komplexe Header-Bidding-Skripte sowie Usercentrics- oder Sourcepoint-Einwilligungsdialoge. ${PRODUCT_FACTS.name} v${VERSION} lehnt nicht-essenzielle Cookies nach TDDDG § 25 automatisch ab, blockiert ${STATIC_RULES} statische Ad-/Tracker-Muster im C++-Netzwerklayer und schützt bis zu ${PRODUCT_FACTS.devicesIncluded} Geräte.`,
    guideLink: '/test-lab',
    guideLabel: 'Live Test Lab starten →',
    ctaInstall: 'Kostenlos installieren',
    ctaPro: 'Deepblock Pro freischalten',
    regulatoryTitle: 'TDDDG § 25 & DACH-Medienarchitektur: Warum reine CSS-Blocker scheitern',
    regulatoryLead: 'Im deutschen Web-Ökosystem kombinieren Verlage und Portale Einwilligungsabfragen nach <strong>TDDDG § 25</strong> und den Leitlinien der Datenschutzkonferenz (DSK) mit geschlossenen Shadow-DOM-Containern von Usercentrics oder Edge-gerouteten Sourcepoint-Dialogen.',
    regulatoryCards: [
      {
        tag: 'C++ DNR Pipeline',
        title: `${STATIC_RULES} statische + 100 OTA-Regeln vor Socket-Aufbau`,
        body: `SWEEPR Deepblock v${VERSION} blockiert 264 Ad- und Tracker-Regeln, 18 Krypto-Miner-Regeln und bereinigt 20 URL-Tracking-Parameter (<code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">fbclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">gclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">utm_*</code>) direkt in der C++-Engine von Manifest V3.`
      },
      {
        tag: 'Usercentrics Shadow-DOM',
        title: 'Echtes „Alle ablehnen“ statt eingefrorener Seiten',
        body: 'Herkömmliche Blocker verstecken <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">#usercentrics-root</code> oft nur visuell und hinterlassen <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">overflow: hidden</code> auf der Seite. Deepblock durchläuft Shadow-DOMs per <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">queryAllDeep</code>, löst die Ablehnung aus und entsperrt das Scrollen sofort.'
      },
      {
        tag: 'Steuerung & Ausnahmen',
        title: 'Tastenkürzel Alt+Shift+S & lokale Listen',
        body: 'Alle Filterregeln arbeiten zu 100% lokal ohne Verlaufsspeicherung. Einzelne Domains pausieren Sie bei Bedarf sofort mit <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+S</code>; <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+D</code> öffnet das Kontrollpanel.'
      },
      {
        tag: 'Tab & RAM Tamer',
        title: 'Automatischer Ruhezustand nach 10 Minuten',
        body: 'Inaktive Hintergrund-Tabs werden nach 10 Minuten über <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">chrome.tabs.discard</code> entladen — aktive, angepinnte, Audio- oder Ausnahmeseiten (<code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">neverSnoozeSites</code>) bleiben geschützt. Manuell: <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+Z</code>.'
      }
    ],
    cmpTechnicalTitle: 'Technische Analyse: Usercentrics Shadow-DOM & Sourcepoint Scroll-Entsperrung',
    cmpTechnicalBodyHtml: `<div class="space-y-3 text-sm text-gray-700 leading-relaxed">
      <p class="m-0">Standard-CSS-Regeln wie <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">document.querySelector</code> enden an der Web-Component-Grenze von <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#usercentrics-root</code>. SWEEPR Deepblock v${escapeHtml(VERSION)} traversiert verschachtelte Shadow-Roots bis Tiefe 4, klickt programmatisch auf „Nur Essenzielle“ bzw. „Alle ablehnen“ und setzt anschließend <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: auto</code> auf <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">&lt;html&gt;</code> und <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">&lt;body&gt;</code> wiederher.</p>
      <p class="m-0">Für Sourcepoint- und Quantcast-Dialoge sendet die Erweiterung negative TCF-v2.2-Signale vor dem Aufbau nachgelagerter Header-Bidding-Skripte. Weitere englischsprachige Details finden Sie im <a href="/guides/how-to-automatically-reject-cookie-banners-uk" class="text-emerald-700 font-semibold underline">Cookie Auto-Reject Guide</a>.</p>
    </div>`,
    faqs: [
      {
        q: 'Wie blockiert SWEEPR Deepblock Usercentrics und Sourcepoint Cookie-Banner?',
        a: `Statt das Banner nur per CSS auszublenden, durchsucht SWEEPR Deepblock v${VERSION} Shadow-DOM-Container (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#usercentrics-root</code>) über <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">queryAllDeep</code>, löst die Ablehnung aus und setzt <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: auto</code> wiederher.`
      },
      {
        q: 'Funktioniert SWEEPR Deepblock mit Chrome Manifest V3 auf YouTube?',
        a: `Ja. Die Engine kombiniert ${STATIC_RULES} statische C++ <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">declarativeNetRequest</code>-Filter mit 100 OTA-Delta-Regeln und domänenbezogener Video-Ad-Bereinigung. Prüfen Sie Ihren Browser direkt im <a href="/test-lab" class="text-emerald-700 underline font-semibold">Live-Test-Lab</a>.`
      },
      {
        q: 'Wie viele Geräte deckt eine Pro-Lizenz ab und läuft sie unter Firefox Android?',
        a: `Eine Lizenz deckt bis zu ${PRODUCT_FACTS.devicesIncluded} Browser oder Geräte gleichzeitig unter Windows, macOS, Linux und Firefox für Android ab.`
      },
      {
        q: 'Wie verhindert der Tab & RAM Tamer Datenverlust in offenen Tabs?',
        a: 'Aktive Tabs, angepinnte Tabs, Tabs mit Audiowiedergabe sowie Domains in Ihrer Ausnahmeliste werden vor dem automatischen 10-Minuten-Ruhezustand über <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">chrome.tabs.discard</code> ausgeschlossen.'
      }
    ]
  }),
  'utf8'
);

// 2. /de/usercentrics-cookie-banner-blockieren (CONSOLIDATE_301 -> /de)
fs.writeFileSync(
  path.join(DE_DIR, 'usercentrics-cookie-banner-blockieren.html'),
  renderEuPage({
    lang: 'de-DE',
    isMainHub: false,
    canonicalPath: '/de/usercentrics-cookie-banner-blockieren',
    title: 'Usercentrics & Sourcepoint Cookie-Banner automatisch ablehnen | SWEEPR',
    description: 'Technischer Leitfaden: Usercentrics Shadow-DOM und Sourcepoint TCF v2.2 Cookie-Banner auf deutschen Websites nach TDDDG § 25 automatisch ablehnen.',
    badge: 'Technischer Leitfaden · Konsolidiert auf /de',
    h1: 'Usercentrics & Sourcepoint Cookie-Banner ohne Scroll-Sperre blockieren',
    lead: 'Dieser technische Leitfaden wurde auf unseren deutschen Haupthub (<a href="/de" class="text-emerald-700 font-semibold underline">/de</a>) konsolidiert. Erfahren Sie dort alles über <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#usercentrics-root</code>, <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">queryAllDeep</code> und TDDDG § 25.',
    guideLink: '/de',
    guideLabel: 'Zum Deutsch (/de) Hub →',
    ctaInstall: 'Erweiterung installieren',
    ctaPro: 'Pro-Schutz aktivieren',
    regulatoryTitle: 'Shadow-DOM-Durchquerung & Scroll-Wiederherstellung',
    regulatoryLead: 'Alle technischen Hinweise zu Usercentrics (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#usercentrics-root</code>), Sourcepoint und der automatischen Freigabe von <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: auto</code> sind jetzt direkt auf <a href="/de" class="text-emerald-700 font-semibold underline">/de</a> gebündelt.',
    regulatoryCards: [
      {
        tag: 'Shadow-DOM Tiefensuche',
        title: 'queryAllDeep bis Tiefe 4 für #usercentrics-root',
        body: `Deepblock v${VERSION} traversiert verschachtelte Shadow-Roots und löst „Alle ablehnen“ programmatisch aus.`
      },
      {
        tag: 'Scroll-Wiederherstellung',
        title: 'Entfernung von overflow:hidden auf html/body',
        body: 'Blockierende Modal-Klassen werden bereinigt und <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">overflow: auto</code> sofort wiederhergestellt.'
      }
    ],
    cmpTechnicalTitle: 'Parameter-Hygiene & OTA-Regeln',
    cmpTechnicalBodyHtml: `<p class="text-sm text-gray-700 m-0">Neben ${STATIC_RULES} statischen DNR-Regeln (inklusive 20-Parameter URL-Stripper) stehen 100 dynamische OTA-Regeln bereit. Besuchen Sie den <a href="/de" class="text-emerald-700 font-semibold underline">Deutsch (/de) Hub</a> oder das <a href="/test-lab" class="text-emerald-700 font-semibold underline">Test-Labor</a>.</p>`,
    faqs: [
      {
        q: 'Warum friert das Scrollen bei einfachen CSS-Regeln ein?',
        a: 'Weil Usercentrics <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow:hidden</code> auf dem Dokument setzt, bis eine Auswahl gespeichert wird. Deepblock löst die Ablehnung aus und stellt das Scrollen wieder her.'
      },
      {
        q: 'Wo finde ich die vollständige deutsche Dokumentation?',
        a: 'Alle Informationen, EUR-Tarife und Browser-Tabellen finden Sie auf <a href="/de" class="text-emerald-700 underline font-semibold">/de</a>.'
      }
    ]
  }),
  'utf8'
);

// 3. /fr Hub (KEEP_REWRITE — includes Didomi + Quantcast + CNIL Art. 82 technical guidance)
fs.writeFileSync(
  path.join(FR_DIR, 'index.html'),
  renderEuPage({
    lang: 'fr-FR',
    isMainHub: true,
    canonicalPath: '/fr',
    title: 'SWEEPR Deepblock Français : Bloqueur de Pub MV3 & Cookies Didomi',
    description: 'Bloquez les pubs, traqueurs et refusez les bandeaux cookies Didomi et Quantcast conformément à la CNIL sans figer le défilement.',
    badge: `SWEEPR Deepblock v${VERSION} · Moteur Manifest V3 pour la France`,
    h1: 'Bloquez les pubs et refusez les bandeaux cookies Didomi automatiquement',
    lead: `Les éditeurs français s’appuient massivement sur les bandeaux Didomi et Quantcast ainsi que sur des enchères publicitaires multipartenaires. ${PRODUCT_FACTS.name} v${VERSION} automatise le refus conforme à l’Article 82 de la CNIL, applique ${STATIC_RULES} règles statiques C++ et protège jusqu’à ${PRODUCT_FACTS.devicesIncluded} appareils.`,
    guideLink: '/test-lab',
    guideLabel: 'Lancer le Test Lab →',
    ctaInstall: 'Installer gratuitement',
    ctaPro: 'Débloquer Deepblock Pro',
    regulatoryTitle: 'Conformité CNIL Article 82 & Maîtrise de l’écosystème Didomi / Quantcast',
    regulatoryLead: 'Les recommandations de la <strong>CNIL (Article 82)</strong> exigent une option « Continuer sans accepter » équivalente à l’acceptation. Sans automatisation du refus réel, les scripts publicitaires continuent de charger et les fenêtres modales figent le défilement.',
    regulatoryCards: [
      {
        tag: 'Filtrage C++ DNR',
        title: `${STATIC_RULES} règles statiques + 100 règles OTA instantanées`,
        body: `Deepblock v${VERSION} bloque 264 règles pub/traceurs, 18 règles anticryptominage et supprime 20 paramètres de pistage (<code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">fbclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">gclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">utm_*</code>) directement dans la couche réseau Manifest V3.`
      },
      {
        tag: 'Didomi & Quantcast CNIL',
        title: 'Activation de .didomi-continue-without-agreeing',
        body: 'Au lieu de masquer visuellement <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">#didomi-host</code>, le moteur cible le contrôle officiel « Continuer sans accepter » et supprime la classe bloquante <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">didomi-popup-open</code>.'
      },
      {
        tag: 'Contrôle Local & Raccourcis',
        title: 'Zéro journalisation d’historique (Alt+Shift+S)',
        body: 'Tout le filtrage reste local sur votre appareil. Mettez un site en pause instantanément avec <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+S</code> ou ouvrez le tableau de bord avec <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+D</code>.'
      },
      {
        tag: 'Total Tab & RAM Tamer',
        title: 'Mise en veille intelligente après 10 minutes',
        body: 'Les onglets inactifs depuis 10 minutes sont libérés via <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">chrome.tabs.discard</code> (onglets actifs, épinglés, audio et liste blanche protégés). Raccourci manuel : <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+Z</code>.'
      }
    ],
    cmpTechnicalTitle: 'Ingénierie Didomi (#didomi-host) & Quantcast (.qc-cmp2-container)',
    cmpTechnicalBodyHtml: `<div class="space-y-3 text-sm text-gray-700 leading-relaxed">
      <p class="m-0">Lorsqu’un bandeau Didomi apparaît dans <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#didomi-host</code> ou Quantcast dans <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">.qc-cmp2-container</code>, un simple masquage CSS laisse la classe <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">didomi-popup-open</code> et <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: hidden</code> actives. SWEEPR Deepblock v${escapeHtml(VERSION)} déclenche le refus non essentiel dans le DOM ou Shadow DOM et restaure <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: auto</code> immédiatement.</p>
      <p class="m-0">Consultez également notre guide complet sur les bannières TCF v2.2 : <a href="/guides/how-to-automatically-reject-cookie-banners-uk" class="text-emerald-700 font-semibold underline">Auto-Reject Cookie Banners Guide</a>.</p>
    </div>`,
    faqs: [
      {
        q: 'Comment SWEEPR Deepblock gère-t-il les bandeaux Didomi conformes CNIL ?',
        a: `Au lieu de masquer la fenêtre en CSS, SWEEPR Deepblock v${VERSION} déclenche automatiquement l’action « Continuer sans accepter / Tout refuser » dans <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#didomi-host</code> et supprime le verrouillage <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">didomi-popup-open</code>.`
      },
      {
        q: 'SWEEPR Deepblock fonctionne-t-il avec Chrome Manifest V3 sur YouTube ?',
        a: `Oui. Le moteur associe ${STATIC_RULES} règles C++ statiques à 100 règles dynamiques OTA et au nettoyage cosmétique du lecteur. Testez votre navigateur dans le <a href="/test-lab" class="text-emerald-700 underline font-semibold">Live Test Lab</a>.`
      },
      {
        q: 'Combien d’appareils couvre une licence Pro et fonctionne-t-elle sur Firefox Android ?',
        a: `Une seule clé couvre jusqu’à ${PRODUCT_FACTS.devicesIncluded} navigateurs simultanément (Chrome, Edge, Firefox Desktop &amp; Android, Brave, Opera).`
      },
      {
        q: 'Le nettoyeur d’URL et Total Tab & RAM Tamer sont-ils inclus ?',
        a: 'Oui. Le retrait de 20 paramètres de suivi d’URL et la mise en veille des onglets après 10 minutes d’inactivité sont inclus sans surcoût.'
      }
    ]
  }),
  'utf8'
);

// 4. /fr/bloquer-bandeau-cookie-didomi (CONSOLIDATE_301 -> /fr)
fs.writeFileSync(
  path.join(FR_DIR, 'bloquer-bandeau-cookie-didomi.html'),
  renderEuPage({
    lang: 'fr-FR',
    isMainHub: false,
    canonicalPath: '/fr/bloquer-bandeau-cookie-didomi',
    title: 'Refuser les Bandeaux Cookies Didomi automatiquement | SWEEPR',
    description: 'Guide technique consolidé vers /fr : comment refuser automatiquement les bandeaux cookies Didomi et Quantcast sur les sites français sans bloquer le défilement.',
    badge: 'Guide Technique · Consolidé vers /fr',
    h1: 'Comment bloquer et refuser automatiquement les bandeaux cookies Didomi',
    lead: 'Ce guide technique a été consolidé sur notre hub principal français (<a href="/fr" class="text-emerald-700 font-semibold underline">/fr</a>) afin de regrouper toute la documentation Didomi, Quantcast et CNIL Article 82.',
    guideLink: '/fr',
    guideLabel: 'Ouvrir le Hub Français (/fr) →',
    ctaInstall: 'Installer l’extension',
    ctaPro: 'Passer à Deepblock Pro',
    regulatoryTitle: 'Ingénierie Didomi & Quantcast : Déverrouiller le DOM',
    regulatoryLead: 'Retrouvez les détails complets sur <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#didomi-host</code>, <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">.didomi-continue-without-agreeing</code> et la suppression de <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">didomi-popup-open</code> sur <a href="/fr" class="text-emerald-700 font-semibold underline">/fr</a>.',
    regulatoryCards: [
      {
        tag: 'Sélecteurs Didomi',
        title: 'Invocation de .didomi-continue-without-agreeing',
        body: `Deepblock v${VERSION} déclenche le refus CNIL natif et restaure <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">overflow: auto</code>.`
      },
      {
        tag: 'Quantcast TCF v2.2',
        title: 'Prise en charge de .qc-cmp2-container',
        body: 'Le moteur cible le refus non essentiel sans bloquer les articles ni les lecteurs vidéo.'
      }
    ],
    cmpTechnicalTitle: 'Documentation Principale',
    cmpTechnicalBodyHtml: `<p class="text-sm text-gray-700 m-0">Consultez la page principale <a href="/fr" class="text-emerald-700 font-semibold underline">SWEEPR Deepblock Français (/fr)</a> pour la matrice complète des navigateurs et les tarifs en EUR.</p>`,
    faqs: [
      {
        q: 'Pourquoi le défilement se fige-t-il quand un bloqueur masque Didomi en CSS ?',
        a: 'Le masquage CSS laisse la classe <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">didomi-popup-open</code> active sur le document. SWEEPR Deepblock déclenche le refus officiel et débloque le défilement.'
      },
      {
        q: 'Où trouver le guide complet en français ?',
        a: 'Toute la documentation en français est disponible sur <a href="/fr" class="text-emerald-700 underline font-semibold">/fr</a>.'
      }
    ]
  }),
  'utf8'
);

// 5. /es Hub (KEEP_REWRITE — AEPD & TCF v2.2 technical guidance + EUR pricing)
fs.writeFileSync(
  path.join(ES_DIR, 'index.html'),
  renderEuPage({
    lang: 'es-ES',
    isMainHub: true,
    canonicalPath: '/es',
    title: 'SWEEPR Deepblock Español: Bloqueador de Anuncios MV3 y Cookies',
    description: 'Bloquea anuncios, rastreadores y rechaza avisos de cookies TCF v2.2 (Didomi, OneTrust, Quantcast) conforme a la AEPD sin congelar el scroll.',
    badge: `SWEEPR Deepblock v${VERSION} · Motor Manifest V3 para España y LATAM`,
    h1: 'Bloquea anuncios y rechaza banners de cookies sin congelar el scroll',
    lead: `Los portales de noticias y medios digitales cargan múltiples subastas publicitarias y avisos TCF v2.2 (Didomi, OneTrust, Sourcepoint y Quantcast). ${PRODUCT_FACTS.name} v${VERSION} automatiza el rechazo no esencial conforme a los criterios de la AEPD, aplica ${STATIC_RULES} reglas estáticas C++ y protege hasta ${PRODUCT_FACTS.devicesIncluded} dispositivos.`,
    guideLink: '/test-lab',
    guideLabel: 'Ejecutar Test Lab →',
    ctaInstall: 'Instalar gratis',
    ctaPro: 'Activar Deepblock Pro',
    regulatoryTitle: 'Guía AEPD, Estándar TCF v2.2 y Eliminación de Bloqueos de Desplazamiento',
    regulatoryLead: 'La guía de la <strong>AEPD</strong> exige un rechazo tan accesible como la aceptación, pero muchos portales siguen aplicando bloqueos <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow: hidden</code> sobre el documento si un bloqueador solo oculta el banner con CSS.',
    regulatoryCards: [
      {
        tag: 'Motor Nativo C++',
        title: `${STATIC_RULES} reglas estáticas + 100 reglas OTA dinámicas`,
        body: `Compilado sobre Manifest V3 con 264 reglas de anuncios/rastreadores, 18 reglas anticriptominería y 1 regla de limpieza de 20 parámetros URL (<code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">utm_*</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">fbclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">gclid</code>, <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">ttclid</code>).`
      },
      {
        tag: 'Rechazo CMP TCF v2.2',
        title: 'OneTrust, Didomi, Sourcepoint y Quantcast sin congelar',
        body: 'Mediante inspección profunda del Shadow-DOM (<code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">queryAllDeep</code>), Deepblock pulsa el rechazo oficial no esencial y restaura <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">overflow: auto</code> al instante.'
      },
      {
        tag: 'Privacidad Local',
        title: 'Cero historial registrado y pausado por dominio',
        body: 'Todo el filtrado ocurre en tu navegador. Pulsa <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+S</code> para pausar un dominio al instante o <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+D</code> para abrir el panel.'
      },
      {
        tag: 'Total Tab & RAM Tamer',
        title: 'Hibernación inteligente a los 10 minutos',
        body: 'Libera memoria de pestañas inactivas mediante <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">chrome.tabs.discard</code> protegiendo pestañas activas, fijadas, con audio o en tu lista de exclusión. Atajo manual: <code class="px-1 py-0.5 rounded bg-slate-200 text-emerald-900 font-mono text-xs">Alt+Shift+Z</code>.'
      }
    ],
    cmpTechnicalTitle: 'Compatibilidad AEPD & TCF v2.2 en España',
    cmpTechnicalBodyHtml: `<div class="space-y-3 text-sm text-gray-700 leading-relaxed">
      <p class="m-0">SWEEPR Deepblock v${escapeHtml(VERSION)} detecta contenedores OneTrust (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#onetrust-consent-sdk</code>), Didomi (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">#didomi-host</code>), Sourcepoint (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">.sp-message-open</code>) y Quantcast (<code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">.qc-cmp2-container</code>), ejecuta el rechazo no esencial y limpia las clases que bloquean el desplazamiento.</p>
      <p class="m-0">Evalúa el impacto de subastas publicitarias en la memoria de tu navegador con la <a href="/tools/browser-ram-calculator" class="text-emerald-700 font-semibold underline">Calculadora de RAM</a> o ejecuta pruebas reales en el <a href="/test-lab" class="text-emerald-700 font-semibold underline">Test Lab</a>.</p>
    </div>`,
    faqs: [
      {
        q: '¿Cómo rechaza SWEEPR Deepblock las cookies sin congelar el desplazamiento?',
        a: `A diferencia de los bloqueadores que solo ocultan visualmente el banner con CSS (dejando la página bloqueada con <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">overflow:hidden</code>), SWEEPR Deepblock v${VERSION} ejecuta la acción oficial de rechazo en OneTrust, Didomi, Sourcepoint y Quantcast y libera el scroll automáticamente.`
      },
      {
        q: '¿Funciona en Google Chrome con Manifest V3 en YouTube?',
        a: `Sí. El motor combina ${STATIC_RULES} reglas nativas <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">declarativeNetRequest</code> en C++ con 100 reglas OTA y limpieza cosmética. Puedes comprobar tu navegador en el <a href="/test-lab" class="text-emerald-700 underline font-semibold">Test Lab</a>.`
      },
      {
        q: '¿Cuántos dispositivos incluye una licencia y sirve para Android?',
        a: `Cada suscripción Pro protege hasta ${PRODUCT_FACTS.devicesIncluded} navegadores o dispositivos simultáneos en Windows, macOS, Linux y Firefox para Android.`
      },
      {
        q: '¿Qué atajos de teclado incluye para pausar un sitio o ahorrar RAM?',
        a: 'Pulsa <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">Alt+Shift+D</code> para abrir el panel, <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">Alt+Shift+S</code> para pausar un dominio concreto y <code class="px-1 py-0.5 rounded bg-slate-100 text-emerald-800 font-mono text-xs">Alt+Shift+Z</code> para hibernar pestañas inactivas al instante.'
      }
    ]
  }),
  'utf8'
);

console.log('Built 5 Holographic Pearl localized EU pages (/de, /de/usercentrics, /fr, /fr/didomi, /es) with EUR pricing & reciprocal 5-tag hreflang.');
