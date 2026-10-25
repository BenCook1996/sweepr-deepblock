// Navigation & Dropdown Controller (Compare & Guides + Language Selector + Mobile Hamburger Drawer)
(function checkActiveOrderDraftRedirect() {
  function runOrderDraftCheck() {
    try {
      const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      if (path === '/order' || path === '/order.html' || path === '/checkout' || path.startsWith('/checkout/')) {
        return;
      }
      const raw = localStorage.getItem('sweepr_order_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      const ttlMs = 30 * 60 * 1000;
      if (draft && draft.hasDetails && draft.updatedAt && (Date.now() - Number(draft.updatedAt) <= ttlMs)) {
        window.location.replace('/order');
      } else {
        localStorage.removeItem('sweepr_order_draft');
        document.cookie = 'sweepr_order_draft_active=; path=/; max-age=0; SameSite=Lax';
      }
    } catch (e) {}
  }
  runOrderDraftCheck();
  window.addEventListener('pageshow', runOrderDraftCheck);
})();

document.addEventListener('DOMContentLoaded', () => {
  const glassNav = document.querySelector('nav.glass-nav');
  const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  const isSpecialNav = Boolean(document.getElementById('liveNavLogo') || document.getElementById('overallStatusBadge'));

  // Ensure every page with nav.glass-nav stays 100% synced with the canonical Homepage menu
  if (glassNav && !isSpecialNav && (!document.getElementById('navDropdownContainer') || !document.getElementById('langDropdownContainer'))) {
    const isPricing = currentPath === '/pricing' || currentPath === '/pricing.html';
    const isCompare = currentPath.startsWith('/vs/') || currentPath.startsWith('/guides/');
    const isLogin = currentPath === '/login' || currentPath === '/login.html';
    const featuresHref = (currentPath === '/' || currentPath === '/index.html') ? '/#features' : '/?home=1#features';

    glassNav.className = 'glass-nav px-4 md:px-6 py-3.5 md:py-4 flex items-center justify-between';
    glassNav.innerHTML = `
      <div class="flex items-center gap-2.5 md:gap-8 min-w-0">
        <a href="/?home=1" class="flex items-center gap-2.5 sm:gap-3 text-inherit no-underline min-w-0">
          <div class="logo-box !w-9 !h-9 sm:!w-10 sm:!h-10" aria-hidden="true"></div>
          <span class="font-extrabold text-base sm:text-xl tracking-tight text-gray-900 truncate">SWEEPR <span class="text-emerald-600">Deepblock</span></span>
        </a>
        <div class="hidden md:flex items-center gap-2">
          <a href="${featuresHref}" class="btn btn-ghost text-sm">Features</a>
          <a href="/pricing" class="${isPricing ? 'btn text-sm font-semibold text-emerald-700 bg-emerald-50/60 border border-emerald-200/50' : 'btn btn-ghost text-sm'}">Pricing</a>
          <div class="relative inline-block text-left" id="navDropdownContainer">
            <button type="button" id="navDropdownBtn" class="${isCompare ? 'btn text-sm font-semibold text-emerald-700 bg-emerald-50/60 border border-emerald-200/50' : 'btn btn-ghost text-sm font-medium'} flex items-center gap-1.5 cursor-pointer" aria-expanded="false" aria-haspopup="true">
              <span>Compare &amp; Guides</span>
              <svg id="navDropdownChevron" class="w-3.5 h-3.5 text-gray-500 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <div id="navDropdownMenu" class="hidden absolute left-0 md:left-1/2 md:-translate-x-1/2 mt-2 w-[340px] sm:w-[430px] bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-2xl p-2.5 z-50 transition-all">
              <div class="grid grid-cols-1 gap-1.5">
                <a href="/vs/total-adblock" class="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/60 transition-all text-inherit no-underline group">
                  <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1 mb-0.5">
                      <span class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">SWEEPR Deepblock vs Total Adblock</span>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Comparison</span>
                    </div>
                    <p class="text-xs text-gray-500 leading-snug">See how SWEEPR Deepblock compares on YouTube ads, automatic cookie pop-up closing, fake shop alerts, and honest pricing.</p>
                  </div>
                </a>
                <a href="/vs/total-adblock#fakespot" class="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/60 transition-all text-inherit no-underline group">
                  <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1 mb-0.5">
                      <span class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">Fake Online Shop Detector</span>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">2026 Guide</span>
                    </div>
                    <p class="text-xs text-gray-500 leading-snug">How SWEEPR warns you about suspicious scam shopping websites before you buy.</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex gap-2 md:gap-3 items-center">
        <div class="relative inline-block text-left" id="langDropdownContainer">
          <button type="button" id="langDropdownBtn" class="btn btn-ghost text-sm flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer font-medium text-gray-700 hover:text-emerald-600 transition-colors" aria-expanded="false" aria-label="Select Language">
            <span class="text-base" id="currentLangFlag">🇬🇧</span>
            <span class="text-xs font-bold tracking-wide" id="currentLangCode">EN</span>
            <svg id="langDropdownChevron" class="w-3 h-3 text-gray-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="langDropdownMenu" class="hidden absolute right-0 mt-2 w-44 bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-xl p-1.5 z-50 transition-all">
            <div class="space-y-0.5 text-xs">
              <button type="button" onclick="setLanguage('en')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium cursor-pointer"><span>🇬🇧 English</span><span class="text-[10px] text-gray-400 font-mono">EN</span></button>
              <button type="button" onclick="setLanguage('de')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium cursor-pointer"><span>🇩🇪 Deutsch</span><span class="text-[10px] text-gray-400 font-mono">DE</span></button>
              <button type="button" onclick="setLanguage('fr')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium cursor-pointer"><span>🇫🇷 Français</span><span class="text-[10px] text-gray-400 font-mono">FR</span></button>
              <button type="button" onclick="setLanguage('es')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 font-medium cursor-pointer"><span>🇪🇸 Español</span><span class="text-[10px] text-gray-400 font-mono">ES</span></button>
            </div>
          </div>
        </div>
        <a href="/login" class="${isLogin ? 'btn text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50/60 border border-emerald-200/50 !px-2.5 sm:!px-4' : 'btn btn-ghost text-xs sm:text-sm !px-2.5 sm:!px-4'}">Login</a>
        <a href="/download?install=1" class="hidden md:inline-flex btn btn-go gap-2">
          <span>Add to Browser</span>
          <svg class="arrow-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </a>
      </div>
    `;
  }

  const navBtn = document.getElementById('navDropdownBtn');
  const navMenu = document.getElementById('navDropdownMenu');
  const navChevron = document.getElementById('navDropdownChevron');
  const navContainer = document.getElementById('navDropdownContainer');

  const langBtn = document.getElementById('langDropdownBtn');
  const langMenu = document.getElementById('langDropdownMenu');
  const langChevron = document.getElementById('langDropdownChevron');
  const langContainer = document.getElementById('langDropdownContainer');

  // Auto-inject mobile hamburger button & slide-down drawer into .glass-nav if not already present
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
          <a href="/download?install=1" class="btn btn-go w-full justify-center gap-2 text-sm">
            <span>Install Now</span>
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

  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIos = /iphone|ipad|ipod/.test(ua) || isIpadOs;
    const isAndroid = ua.includes('android') || (ua.includes('linux') && navigator.maxTouchPoints > 0);
    const isMobile = isIos || isAndroid || /mobile|iemobile|opera mini/.test(ua);
    if (isMobile) {
      const targetHref = isIos ? '/download?platform=ios&direct=1' : '/download?platform=android&direct=1';
      document.querySelectorAll('a[href^="/download"]').forEach((a) => {
        a.setAttribute('href', targetHref);
      });
      const osBtnLbl = document.getElementById('osDownloadText') || document.getElementById('downloadBtnLabel');
      if (osBtnLbl) {
        osBtnLbl.textContent = 'Install Now';
      }
    }
  } catch {}
});
