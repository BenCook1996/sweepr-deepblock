#!/usr/bin/env node
/**
 * SWEEPR DeepBlock v1.3.1 — Multi-Locale Extension Store ASO & CWS Compliance Packager
 *
 * 1. Normalizes all 9 `extension/_locales/{locale}/messages.json` files so every locale
 *    strictly satisfies Chrome Web Store & Edge Add-ons hard limits:
 *      - `extName.message.length <= 45`
 *      - `extShortName.message === "DeepBlock"` (<= 12 chars)
 *      - `extDescription.message.length <= 132`
 * 2. Generates localized, keyword-clustered Chrome Web Store, Firefox AMO, and Microsoft Edge
 *    Add-ons listing markdown packs in `dist/store-listings/{locale}.md`.
 * 3. Emits `dist/store-listings/aso-compliance-report.json` with 100% pass verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'extension');
const LOCALES_DIR = path.join(EXT_DIR, '_locales');
const OUT_DIR = path.join(ROOT_DIR, 'dist', 'store-listings');

const CANONICAL_LOCALES = {
  en: {
    extName: 'SWEEPR DeepBlock: Ad Blocker & Cookie Blocker', // 45 chars
    extShortName: 'DeepBlock',
    extDescription: 'Blocks video & banner ads, auto-rejects GDPR cookie popups, strips URL trackers, and frees browser RAM across 5 devices.', // 125 chars
    uiStrings: {
      uiUnlockPro: 'Unlock Full Pro Protection',
      uiFreePreview: 'Free Preview',
      uiProActive: 'Pro Active',
      uiBoostSpeed: 'Boost Browser Speed Now',
      uiPause5m: 'Pause 5m (Fix)',
      uiHideElement: 'Hide Element',
      uiSettingsTabs: 'Settings & Tabs',
      uiLiveTest: 'Live Shield Test',
      uiGrantPermissions: 'Grant Site Access to Activate Shield',
      uiHaveKey: 'Have a Pro License Key?'
    },
    languageLabel: 'English (UK / US)',
    storeCategory: 'Privacy & Security',
    primaryKeywords: [
      'manifest v3 adblocker chrome',
      'cookie banner auto reject',
      'youtube ad blocker chrome',
      'total adblock alternative',
      'browser ram optimizer'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock is a native Manifest V3 ad blocker, automated GDPR/CMP cookie consent responder, URL tracking parameter stripper, and browser RAM optimizer built for Chromium and Firefox.'
  },
  de: {
    extName: 'SWEEPR DeepBlock: Werbeblocker & Cookie-Stopp', // 45 chars
    extShortName: 'DeepBlock',
    extDescription: 'Video-Werbung, Pop-ups & Tracker blockieren, Cookie-Banner automatisch ablehnen und Browser-RAM sparen. Für 5 Geräte.', // 118 chars
    uiStrings: {
      uiUnlockPro: 'Pro-Schutz freischalten',
      uiFreePreview: 'Gratis-Vorschau',
      uiProActive: 'Pro Aktiv',
      uiBoostSpeed: 'Browser-RAM jetzt optimieren',
      uiPause5m: '5 Min pausieren',
      uiHideElement: 'Element ausblenden',
      uiSettingsTabs: 'Einstellungen & Tabs',
      uiLiveTest: 'Schutz-Live-Test',
      uiGrantPermissions: 'Seitenzugriff für Schutz erlauben',
      uiHaveKey: 'Pro-Lizenzschlüssel vorhanden?'
    },
    languageLabel: 'Deutsch (DE / AT / CH)',
    storeCategory: 'Datenschutz & Sicherheit',
    primaryKeywords: [
      'werbeblocker chrome manifest v3',
      'cookie banner automatisch ablehnen',
      'youtube werbung blockieren',
      'total adblock alternative',
      'browser ram optimieren'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock ist ein nativer Manifest-V3-Werbeblocker mit automatischer DSGVO-Cookie-Ablehnung, URL-Tracker-Bereinigung und Browser-RAM-Optimierung – 100 % lokal auf Ihrem Gerät.'
  },
  fr: {
    extName: 'SWEEPR DeepBlock : Bloqueur Pubs & Cookies', // 42 chars
    extShortName: 'DeepBlock',
    extDescription: 'Bloquez pubs vidéo, pop-ups et traqueurs, refusez les bannières cookies RGPD et économisez la RAM sur 5 appareils.', // 115 chars
    uiStrings: {
      uiUnlockPro: 'Débloquer la protection Pro',
      uiFreePreview: 'Aperçu gratuit',
      uiProActive: 'Pro Actif',
      uiBoostSpeed: 'Accélérer le navigateur',
      uiPause5m: 'Pause 5 min',
      uiHideElement: 'Masquer un élément',
      uiSettingsTabs: 'Réglages & Onglets',
      uiLiveTest: 'Test de protection',
      uiGrantPermissions: 'Autoriser l’accès aux sites',
      uiHaveKey: 'Vous avez une clé Pro ?'
    },
    languageLabel: 'Français (FR / BE / CH / CA)',
    storeCategory: 'Confidentialité et sécurité',
    primaryKeywords: [
      'bloqueur de pub chrome manifest v3',
      'refuser cookies automatiquement rgpd',
      'bloqueur pub youtube',
      'alternative total adblock',
      'économiser mémoire ram navigateur'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock est un bloqueur de publicités natif Manifest V3 avec refus automatique des bannières cookies RGPD/CNIL, suppression des paramètres de suivi URL et optimisation de la mémoire RAM.'
  },
  es: {
    extName: 'SWEEPR DeepBlock: Bloqueador Anuncios Cookies', // 45 chars
    extShortName: 'DeepBlock',
    extDescription: 'Bloquea anuncios de video, pop-ups y rastreadores, rechaza cookies automáticamente y ahorra RAM en hasta 5 dispositivos.', // 122 chars
    uiStrings: {
      uiUnlockPro: 'Desbloquear protección Pro',
      uiFreePreview: 'Vista gratuita',
      uiProActive: 'Pro Activo',
      uiBoostSpeed: 'Acelerar navegador ahora',
      uiPause5m: 'Pausar 5 min',
      uiHideElement: 'Ocultar elemento',
      uiSettingsTabs: 'Ajustes y Pestañas',
      uiLiveTest: 'Prueba en vivo',
      uiGrantPermissions: 'Permitir acceso a sitios',
      uiHaveKey: '¿Tienes una clave Pro?'
    },
    languageLabel: 'Español (ES / LATAM)',
    storeCategory: 'Privacidad y seguridad',
    primaryKeywords: [
      'bloqueador de anuncios chrome',
      'rechazar cookies automáticamente',
      'bloquear anuncios video',
      'alternativa total adblock',
      'optimizar ram navegador'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock bloquea anuncios de video, banners y rastreadores con motor nativo DeclarativeNetRequest, limpia parámetros de seguimiento URL, rechaza pop-ups de cookies y hiberna pestañas inactivas.'
  },
  it: {
    extName: 'SWEEPR DeepBlock: Blocco Pubblicità e Cookie', // 44 chars
    extShortName: 'DeepBlock',
    extDescription: 'Blocca annunci video, pop-up e tracker, rifiuta automaticamente i banner cookie e riduci il consumo RAM su 5 dispositivi.', // 123 chars
    uiStrings: {
      uiUnlockPro: 'Sblocca protezione Pro',
      uiFreePreview: 'Anteprima gratuita',
      uiProActive: 'Pro Attivo',
      uiBoostSpeed: 'Velocizza browser ora',
      uiPause5m: 'Pausa 5 min',
      uiHideElement: 'Nascondi elemento',
      uiSettingsTabs: 'Impostazioni e Schede',
      uiLiveTest: 'Test dal vivo',
      uiGrantPermissions: 'Consenti accesso ai siti',
      uiHaveKey: 'Hai una chiave Pro?'
    },
    languageLabel: 'Italiano (IT)',
    storeCategory: 'Privacy e sicurezza',
    primaryKeywords: [
      'blocco pubblicità chrome',
      'rifiuta cookie automaticamente',
      'bloccare pubblicità video',
      'alternativa ublock manifest v3',
      'risparmiare ram browser'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock blocca annunci video, pop-up e tracker con il motore nativo Manifest V3, rifiuta automaticamente i banner sui cookie GDPR e iberna le schede inattive su 5 dispositivi.'
  },
  nl: {
    extName: 'SWEEPR DeepBlock: Adblocker & Cookie-Blocker', // 44 chars
    extShortName: 'DeepBlock',
    extDescription: 'Blokkeer videoadvertenties, pop-ups en trackers, weiger cookiebanners automatisch en bespaar RAM op 5 apparaten.', // 116 chars
    uiStrings: {
      uiUnlockPro: 'Pro-bescherming ontgrendelen',
      uiFreePreview: 'Gratis voorbeeld',
      uiProActive: 'Pro Actief',
      uiBoostSpeed: 'Browser nu versnellen',
      uiPause5m: '5 min pauzeren',
      uiHideElement: 'Element verbergen',
      uiSettingsTabs: 'Instellingen & Tabbladen',
      uiLiveTest: 'Live schildtest',
      uiGrantPermissions: 'Geef sitetoegang voor schild',
      uiHaveKey: 'Heb je een Pro-licentie?'
    },
    languageLabel: 'Nederlands (NL / BE)',
    storeCategory: 'Privacy en beveiliging',
    primaryKeywords: [
      'adblocker chrome manifest v3',
      'cookiebanners automatisch weigeren',
      'videoadvertenties blokkeren',
      'url trackers strippen',
      'browser geheugen besparen'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock blokkeert videoadvertenties, pop-ups en trackers via Manifest V3 DeclarativeNetRequest, weigert AVG-cookiebanners automatisch en sluimert inactieve tabbladen op 5 apparaten.'
  },
  pl: {
    extName: 'SWEEPR DeepBlock: Blokowanie Reklam i Cookie', // 44 chars
    extShortName: 'DeepBlock',
    extDescription: 'Blokuj reklamy wideo, pop-upy i trackery, automatycznie odrzucaj banery cookie i oszczędzaj pamięć RAM na 5 urządzeniach.', // 122 chars
    uiStrings: {
      uiUnlockPro: 'Odblokuj ochronę Pro',
      uiFreePreview: 'Podgląd darmowy',
      uiProActive: 'Pro Aktywne',
      uiBoostSpeed: 'Przyspiesz przeglądarkę',
      uiPause5m: 'Wstrzymaj 5 min',
      uiHideElement: 'Ukryj element',
      uiSettingsTabs: 'Ustawienia i Karty',
      uiLiveTest: 'Test tarczy na żywo',
      uiGrantPermissions: 'Zezwól na dostęp do witryn',
      uiHaveKey: 'Masz klucz licencyjny Pro?'
    },
    languageLabel: 'Polski (PL)',
    storeCategory: 'Prywatność i bezpieczeństwo',
    primaryKeywords: [
      'blokowanie reklam chrome',
      'automatyczne odrzucanie cookies',
      'blokowanie reklam wideo',
      'usuwanie parametrów śledzących',
      'oszczędzanie ram przeglądarki'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock blokuje reklamy wideo, pop-upy oraz elementy śledzące w silniku Manifest V3, automatycznie odrzuca banery RODO/cookie i usypia nieaktywne karty na 5 urządzeniach.'
  },
  pt_BR: {
    extName: 'SWEEPR DeepBlock: Bloqueador Anúncios Cookies', // 45 chars
    extShortName: 'DeepBlock',
    extDescription: 'Bloqueie anúncios em vídeo, pop-ups e rastreadores, rejeite avisos de cookies automaticamente e poupe RAM em 5 dispositivos.', // 124 chars
    uiStrings: {
      uiUnlockPro: 'Desbloquear proteção Pro',
      uiFreePreview: 'Prévia grátis',
      uiProActive: 'Pro Ativo',
      uiBoostSpeed: 'Acelerar navegador agora',
      uiPause5m: 'Pausar 5 min',
      uiHideElement: 'Ocultar elemento',
      uiSettingsTabs: 'Ajustes e Abas',
      uiLiveTest: 'Teste ao vivo',
      uiGrantPermissions: 'Permitir acesso aos sites',
      uiHaveKey: 'Tem uma chave Pro?'
    },
    languageLabel: 'Português (BR / PT)',
    storeCategory: 'Privacidade e segurança',
    primaryKeywords: [
      'bloqueador de anúncios chrome',
      'rejeitar cookies automaticamente',
      'bloquear anúncios de vídeo',
      'limpar rastreadores url',
      'economizar ram navegador'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlock bloqueia anúncios em vídeo, pop-ups e rastreadores com motor Manifest V3, rejeita banners de cookies LGPD/GDPR automaticamente e hiberna abas ociosas em até 5 dispositivos.'
  },
  ja: {
    extName: 'SWEEPR DeepBlock: 広告ブロッカー & Cookie自動拒否', // 38 chars
    extShortName: 'DeepBlock',
    extDescription: '動画広告・ポップアップ・追跡をブロックし、Cookie同意バナーを自動拒否。URL追跡除去とタブ休止でメモリを節約（最大5台）。', // 69 chars
    uiStrings: {
      uiUnlockPro: 'Pro保護を有効化',
      uiFreePreview: '無料プレビュー',
      uiProActive: 'Pro 有効',
      uiBoostSpeed: 'ブラウザを高速化',
      uiPause5m: '5分間一時停止',
      uiHideElement: '要素を非表示',
      uiSettingsTabs: '設定とタブ',
      uiLiveTest: '保護テスト',
      uiGrantPermissions: 'サイトへのアクセスを許可',
      uiHaveKey: 'Proライセンスキーをお持ちですか？'
    },
    languageLabel: '日本語 (JP)',
    storeCategory: 'プライバシーとセキュリティ',
    primaryKeywords: [
      '広告ブロッカー chrome manifest v3',
      'cookieバナー 自動拒否',
      '動画広告 ブロック',
      'url トラッカー 除去',
      'ブラウザ メモリ 削減'
    ],
    longDescriptionIntro:
      'SWEEPR DeepBlockは、Manifest V3のDeclarativeNetRequestエンジンで動画広告・バナー広告・暗号通貨マイナー・URL追跡パラメータを遮断し、Cookie同意バナー自動拒否と非アクティブタブ休止を最大5台で利用できます。'
  }
};

export function runBuildAsoStoreListings() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));
  const version = manifest.version || '1.3.1';

  let matrixKeywords = [];
  const matrixPath = path.join(ROOT_DIR, 'data', 'keyword-opportunity-matrix.json');
  if (fs.existsSync(matrixPath)) {
    try {
      const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
      matrixKeywords = (matrix.approvedNewPageBlueprints || []).slice(0, 8).map((b) => b.primaryKeyword);
    } catch {
      // ignore
    }
  }

  const localeResults = [];

  for (const [locale, cfg] of Object.entries(CANONICAL_LOCALES)) {
    const localeDir = path.join(LOCALES_DIR, locale);
    fs.mkdirSync(localeDir, { recursive: true });
    const msgPath = path.join(localeDir, 'messages.json');

    if (cfg.extName.length > 45) {
      throw new Error(`[ASO] Locale ${locale} extName exceeds 45 chars (${cfg.extName.length}): ${cfg.extName}`);
    }
    if (cfg.extShortName.length > 12) {
      throw new Error(`[ASO] Locale ${locale} extShortName exceeds 12 chars (${cfg.extShortName.length}): ${cfg.extShortName}`);
    }
    if (cfg.extDescription.length > 132) {
      throw new Error(
        `[ASO] Locale ${locale} extDescription exceeds 132 chars (${cfg.extDescription.length}): ${cfg.extDescription}`
      );
    }

    const messagesJson = {
      extName: {
        message: cfg.extName,
        description: 'Extension title in store and browser toolbar (<=45 chars)'
      },
      extShortName: {
        message: cfg.extShortName,
        description: 'Short extension name'
      },
      extDescription: {
        message: cfg.extDescription,
        description: 'Store summary (<=132 chars)'
      },
      ...Object.fromEntries(
        Object.entries(cfg.uiStrings || {}).map(([k, v]) => [k, { message: v }])
      )
    };

    fs.writeFileSync(msgPath, JSON.stringify(messagesJson, null, 2) + '\n', 'utf8');

    const listingMd = `# SWEEPR DeepBlock v${version} — Store ASO Listing Pack (${cfg.languageLabel} [${locale}])

## 1. Validated Manifest Metadata
- **Locale Code**: \`${locale}\`
- **Extension Name (\`extName\`)**: \`${cfg.extName}\` (${cfg.extName.length}/45 chars ✅)
- **Short Name (\`extShortName\`)**: \`${cfg.extShortName}\` (${cfg.extShortName.length}/12 chars ✅)
- **Short Description (\`extDescription\`)**: \`${cfg.extDescription}\` (${cfg.extDescription.length}/132 chars ✅)
- **Primary Store Category**: ${cfg.storeCategory}

## 2. Target ASO Keyword Cluster
${cfg.primaryKeywords.map((k) => `- \`${k}\``).join('\n')}
${matrixKeywords.length ? `\n### High-Intent Low-KD Switcher Keywords (Synced from Opportunity Matrix)\n${matrixKeywords.map((k) => `- \`${k}\``).join('\n')}` : ''}

## 3. Store Description Copy (Chrome Web Store / Edge Add-ons / Firefox AMO)
${cfg.longDescriptionIntro}

### Core Protection Capabilities (v${version})
- **Native Manifest V3 DeclarativeNetRequest Rulesets**: Blocks video/banner ads, cryptominers, and tracking parameters directly inside the browser engine with zero browsing history logged.
- **Automated GDPR / CCPA Cookie Consent Responder**: Auto-clicks "Reject All" on OneTrust, Quantcast, TrustArc, Didomi, Sourcepoint, and Cookiebot while preserving page scroll locks.
- **Total Tab & RAM Tamer (Included in Pro)**: Automatically hibernates inactive background tabs to reduce browser memory usage and saves restorable tab sessions.
- **Transparent Flat Pricing**: Core MV3 preview is free to install. Upgrade to **SWEEPR DeepBlock Pro (£29.99/yr flat — £2.50/mo eq., 5 devices, Total Tab & RAM Tamer included)** or the **Sweepr Complete Security Suite (£89.99/yr — 5 devices: DeepBlock Pro + Sweepr VPN + Sweepr Desktop Cleaner)** with zero Year-2 renewal shock.

## 4. Reviewer Justification & Privacy Attestation
- **Zero Browsing History Logged**: All URL and DOM filtering executes 100% locally on the user's device.
- **Remote Code**: None. Compliant with Chrome Web Store MV3 Program Policies and Mozilla AMO \`data_collection_permissions: ["none"]\`.
`;

    fs.writeFileSync(path.join(OUT_DIR, `${locale}.md`), listingMd, 'utf8');

    localeResults.push({
      locale,
      extName: cfg.extName,
      extNameLength: cfg.extName.length,
      extShortName: cfg.extShortName,
      extShortNameLength: cfg.extShortName.length,
      extDescription: cfg.extDescription,
      extDescriptionLength: cfg.extDescription.length,
      status: 'PASS'
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    version,
    totalLocalesValidated: localeResults.length,
    allPassed: localeResults.every((r) => r.extNameLength <= 45 && r.extShortNameLength <= 12 && r.extDescriptionLength <= 132),
    locales: localeResults
  };

  fs.writeFileSync(path.join(OUT_DIR, 'aso-compliance-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(
    `[ASO Packager] Validated & generated ${localeResults.length} locale store packs in dist/store-listings/ (100% <=45 name / <=132 desc).`
  );
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runBuildAsoStoreListings();
}
