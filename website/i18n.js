// Multi-Language Switcher (EN, DE, FR, ES, IT, PT, NL, JA)
const LANG_FLAGS = {
  en: { flag: '🇬🇧', code: 'EN' },
  de: { flag: '🇩🇪', code: 'DE' },
  fr: { flag: '🇫🇷', code: 'FR' },
  es: { flag: '🇪🇸', code: 'ES' },
  it: { flag: '🇮🇹', code: 'IT' },
  pt: { flag: '🇵🇹', code: 'PT' },
  nl: { flag: '🇳🇱', code: 'NL' },
  ja: { flag: '🇯🇵', code: 'JA' }
};

function setLanguage(langCode) {
  const chosen = LANG_FLAGS[langCode] || LANG_FLAGS.en;
  try {
    localStorage.setItem('deepblock_lang', langCode);
  } catch (e) {}

  const flagEl = document.getElementById('currentLangFlag');
  const codeEl = document.getElementById('currentLangCode');
  const langMenu = document.getElementById('langDropdownMenu');

  if (flagEl) flagEl.textContent = chosen.flag;
  if (codeEl) codeEl.textContent = chosen.code;
  if (langMenu) langMenu.classList.add('hidden');
}

window.setLanguage = setLanguage;

document.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = localStorage.getItem('deepblock_lang');
    if (saved && LANG_FLAGS[saved]) {
      setLanguage(saved);
    }
  } catch (e) {}
});
