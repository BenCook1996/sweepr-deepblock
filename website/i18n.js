// Multi-Language Switcher (EN, DE, FR, ES, IT, PT, NL, JA)
const LANG_FLAGS = {
  en: { flag: '🇬🇧', code: 'EN', path: '/' },
  de: { flag: '🇩🇪', code: 'DE', path: '/de' },
  fr: { flag: '🇫🇷', code: 'FR', path: '/fr' },
  es: { flag: '🇪🇸', code: 'ES', path: '/es' },
  it: { flag: '🇮🇹', code: 'IT' },
  pt: { flag: '🇵🇹', code: 'PT' },
  nl: { flag: '🇳🇱', code: 'NL' },
  ja: { flag: '🇯🇵', code: 'JA' }
};

function getPathLanguage() {
  try {
    const p = (window.location && window.location.pathname) || '/';
    if (p === '/de' || p.startsWith('/de/')) return 'de';
    if (p === '/fr' || p.startsWith('/fr/')) return 'fr';
    if (p === '/es' || p.startsWith('/es/')) return 'es';
  } catch (e) {}
  return 'en';
}

function syncLangBadge(langCode) {
  const chosen = LANG_FLAGS[langCode] || LANG_FLAGS.en;
  const flagEl = document.getElementById('currentLangFlag');
  const codeEl = document.getElementById('currentLangCode');
  const langMenu = document.getElementById('langDropdownMenu');

  if (flagEl) flagEl.textContent = chosen.flag;
  if (codeEl) codeEl.textContent = chosen.code;
  if (langMenu) langMenu.classList.add('hidden');
}

function setLanguage(langCode, shouldNavigate = true) {
  const code = String(langCode || 'en').toLowerCase();
  const chosen = LANG_FLAGS[code] || LANG_FLAGS.en;
  try {
    localStorage.setItem('deepblock_lang', code);
  } catch (e) {}

  syncLangBadge(code);

  if (shouldNavigate && chosen.path) {
    try {
      const current = (window.location.pathname || '/').replace(/\/$/, '') || '/';
      if (current !== chosen.path) {
        window.location.href = chosen.path;
      }
    } catch (e) {}
  }
}

window.setLanguage = setLanguage;

document.addEventListener('DOMContentLoaded', () => {
  const activeLang = getPathLanguage();
  syncLangBadge(activeLang);
});
