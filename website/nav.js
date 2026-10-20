// Navigation & Dropdown Controller (Compare & Guides + Language Selector)
document.addEventListener('DOMContentLoaded', () => {
  const navBtn = document.getElementById('navDropdownBtn');
  const navMenu = document.getElementById('navDropdownMenu');
  const navChevron = document.getElementById('navDropdownChevron');
  const navContainer = document.getElementById('navDropdownContainer');

  const langBtn = document.getElementById('langDropdownBtn');
  const langMenu = document.getElementById('langDropdownMenu');
  const langChevron = document.getElementById('langDropdownChevron');
  const langContainer = document.getElementById('langDropdownContainer');

  function closeAllDropdowns() {
    if (navMenu) navMenu.classList.add('hidden');
    if (navChevron) navChevron.classList.remove('rotate-180');
    if (navBtn) navBtn.setAttribute('aria-expanded', 'false');

    if (langMenu) langMenu.classList.add('hidden');
    if (langChevron) langChevron.classList.remove('rotate-180');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
  }

  if (navBtn && navMenu) {
    navBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = navMenu.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        navMenu.classList.remove('hidden');
        if (navChevron) navChevron.classList.add('rotate-180');
        navBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = langMenu.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        langMenu.classList.remove('hidden');
        if (langChevron) langChevron.classList.add('rotate-180');
        langBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (navContainer && !navContainer.contains(e.target) && langContainer && !langContainer.contains(e.target)) {
      closeAllDropdowns();
    } else if (navContainer && !navContainer.contains(e.target)) {
      if (navMenu) navMenu.classList.add('hidden');
      if (navChevron) navChevron.classList.remove('rotate-180');
    } else if (langContainer && !langContainer.contains(e.target)) {
      if (langMenu) langMenu.classList.add('hidden');
      if (langChevron) langChevron.classList.remove('rotate-180');
    }
  });
});
