// Navigation & Dropdown Controller (Compare & Guides + Language Selector + Mobile Hamburger Drawer)
document.addEventListener('DOMContentLoaded', () => {
  const navBtn = document.getElementById('navDropdownBtn');
  const navMenu = document.getElementById('navDropdownMenu');
  const navChevron = document.getElementById('navDropdownChevron');
  const navContainer = document.getElementById('navDropdownContainer');

  const langBtn = document.getElementById('langDropdownBtn');
  const langMenu = document.getElementById('langDropdownMenu');
  const langChevron = document.getElementById('langDropdownChevron');
  const langContainer = document.getElementById('langDropdownContainer');

  // Auto-inject mobile hamburger button & slide-down drawer into .glass-nav if not already present
  const glassNav = document.querySelector('nav.glass-nav');
  if (glassNav && !document.getElementById('mobileMenuBtn')) {
    const rightGroup = glassNav.children[glassNav.children.length - 1];
    if (rightGroup) {
      const mobileBtn = document.createElement('button');
      mobileBtn.type = 'button';
      mobileBtn.id = 'mobileMenuBtn';
      mobileBtn.className = 'md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200/80 bg-white/80 text-gray-700 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer shrink-0';
      mobileBtn.setAttribute('aria-label', 'Toggle navigation menu');
      mobileBtn.setAttribute('aria-expanded', 'false');
      mobileBtn.innerHTML = `
        <svg id="mobileMenuIconOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
        <svg id="mobileMenuIconClose" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `;
      rightGroup.appendChild(mobileBtn);
    }

    if (!document.getElementById('mobileNavDrawer')) {
      const drawer = document.createElement('div');
      drawer.id = 'mobileNavDrawer';
      drawer.className = 'hidden md:hidden fixed top-[72px] left-0 right-0 z-40 mx-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-gray-200/90 shadow-2xl p-4 space-y-2';
      drawer.innerHTML = `
        <div class="grid grid-cols-1 gap-1 text-sm font-semibold text-gray-800">
          <a href="/?home=1#features" class="mobile-nav-link flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline text-gray-800">
            <span>🛡️ Features &amp; Protection</span>
            <span class="text-xs text-gray-400">&rarr;</span>
          </a>
          <a href="/?home=1#ram-tamer" class="mobile-nav-link flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline text-gray-800">
            <span>⚡ Tab &amp; RAM Tamer</span>
            <span class="text-xs text-emerald-600 font-bold">Speed Add-On</span>
          </a>
          <a href="/pricing" class="mobile-nav-link flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline text-gray-800">
            <span>💎 Pricing &amp; Plans</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Save 50%</span>
          </a>
          <a href="/vs/total-adblock" class="mobile-nav-link flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline text-gray-800">
            <span>⚖️ SWEEPR vs Total Adblock</span>
            <span class="text-xs text-gray-400">&rarr;</span>
          </a>
          <a href="/login" class="mobile-nav-link flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline text-gray-800">
            <span>🔑 Customer Portal (1-Click Cancel)</span>
            <span class="text-xs text-gray-400">&rarr;</span>
          </a>
        </div>
        <div class="pt-2 border-t border-gray-100 flex flex-col gap-2">
          <a href="/download" class="btn btn-go w-full justify-center gap-2 text-sm">
            <span>Add to Browser</span>
            <svg class="arrow-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </a>
          <a href="/order?plan=annual" class="btn w-full justify-center text-sm font-bold bg-white border border-gray-300 text-gray-800">
            Get Deepblock Pro Now
          </a>
        </div>
      `;
      glassNav.insertAdjacentElement('afterend', drawer);
    }
  }

  const mobileBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const mobileIconOpen = document.getElementById('mobileMenuIconOpen');
  const mobileIconClose = document.getElementById('mobileMenuIconClose');

  function closeMobileDrawer() {
    if (mobileDrawer) mobileDrawer.classList.add('hidden');
    if (mobileIconOpen) mobileIconOpen.classList.remove('hidden');
    if (mobileIconClose) mobileIconClose.classList.add('hidden');
    if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
  }

  function closeAllDropdowns() {
    if (navMenu) navMenu.classList.add('hidden');
    if (navChevron) navChevron.classList.remove('rotate-180');
    if (navBtn) navBtn.setAttribute('aria-expanded', 'false');

    if (langMenu) langMenu.classList.add('hidden');
    if (langChevron) langChevron.classList.remove('rotate-180');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
  }

  if (mobileBtn && mobileDrawer) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = mobileDrawer.classList.contains('hidden');
      closeAllDropdowns();
      if (isHidden) {
        mobileDrawer.classList.remove('hidden');
        if (mobileIconOpen) mobileIconOpen.classList.add('hidden');
        if (mobileIconClose) mobileIconClose.classList.remove('hidden');
        mobileBtn.setAttribute('aria-expanded', 'true');
      } else {
        closeMobileDrawer();
      }
    });

    mobileDrawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => closeMobileDrawer());
    });
  }

  if (navBtn && navMenu) {
    navBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = navMenu.classList.contains('hidden');
      closeAllDropdowns();
      closeMobileDrawer();
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
      closeMobileDrawer();
      if (isHidden) {
        langMenu.classList.remove('hidden');
        if (langChevron) langChevron.classList.add('rotate-180');
        langBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (mobileDrawer && !mobileDrawer.contains(e.target) && (!mobileBtn || !mobileBtn.contains(e.target))) {
      closeMobileDrawer();
    }
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
