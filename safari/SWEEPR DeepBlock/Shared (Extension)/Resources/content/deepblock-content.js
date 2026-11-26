// SWEEPR Deepblock — Real-Time Content Script (v1.4)
// 1. Zero-Copy Website Auto-Activation Bridge (sweeprdeepblock.com)
// 2. GDPR Cookie Banner Detector & Auto-Rejector (160 CMPs + Safe Scroll-Unlock)
// 3. YouTube & Anti-Adblock Stealth DOM Shield
// 4. Interactive Page Element Zapper ("Hide Distracting Element")
// 5. Throttled MutationObservers for Zero Main-Thread Jank

(function () {
  const CMP_FRAMEWORKS = [
    { id: 'onetrust', name: 'OneTrust', containers: ['#onetrust-banner-sdk', '#onetrust-consent-sdk'], rejectButtons: ['#onetrust-reject-all-handler', '.ot-pc-refuse-all-handler', '.onetrust-close-btn-handler'] },
    { id: 'cookiebot', name: 'Cookiebot', containers: ['#CybotCookiebotDialog', '#CybotCookiebotDialogBody'], rejectButtons: ['#CybotCookiebotDialogBodyButtonDecline', '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll', '#CybotCookiebotDialogBodyLevelButtonDecline'] },
    { id: 'quantcast-choice', name: 'Quantcast Choice', containers: ['.qc-cmp2-container', '#qc-cmp2-container'], rejectButtons: ['.qc-cmp2-summary-buttons button[mode="secondary"]', 'button.qc-cmp2-summary-buttons__button--reject'] },
    { id: 'didomi', name: 'Didomi', containers: ['#didomi-host', '#didomi-popup', '.didomi-popup-container'], rejectButtons: ['.didomi-continue-without-agreeing', '#didomi-notice-disagree-button', 'button.didomi-components-button--secondary'] },
    { id: 'usercentrics', name: 'Usercentrics', containers: ['#usercentrics-root', '#uc-center-container', '[data-testid="uc-app-container"]'], rejectButtons: ['[data-testid="uc-deny-all-button"]', 'button[data-testid="uc-reject-all-button"]', '#uc-btn-deny-banner'] },
    { id: 'sourcepoint', name: 'Sourcepoint', containers: ['[id^="sp_message_container_"]', '.sp_message_container'], rejectButtons: ['button.sp_choice_type_13', 'button.sp_choice_type_REJECT_ALL', '.sp_message_container button[title*="Reject" i]'] },
    { id: 'trustarc', name: 'TrustArc', containers: ['#truste-consent-track', '#truste-consent-content', '.truste_box_overlay'], rejectButtons: ['#truste-consent-required', '.truste-declined-button', '#truste-consent-close'] },
    { id: 'cookieyes', name: 'CookieYes', containers: ['.cky-consent-container', '#cky-consent-banner', '.cky-modal'], rejectButtons: ['[data-cky-tag="reject-button"]', '.cky-btn-reject'] },
    { id: 'osano', name: 'Osano', containers: ['.osano-cm-window', '.osano-cm-dialog'], rejectButtons: ['.osano-cm-denyAll', '.osano-cm-deny', '.osano-cm-dialog__close'] },
    { id: 'iubenda', name: 'Iubenda', containers: ['#iubenda-cs-banner', '.iubenda-cs-container'], rejectButtons: ['.iubenda-cs-reject-btn'] },
    { id: 'termly', name: 'Termly', containers: ['#termly-code-snippet-support', '[data-termly-banner]', '.t-consentPrompt'], rejectButtons: ['[data-tid="banner-decline"]'] },
    { id: 'consentmanager', name: 'Consentmanager', containers: ['#cmpbox', '#cmpwrapper', '.cmpboxBG'], rejectButtons: ['.cmpboxbtnno', '#cmpbntnotxt'] },
    { id: 'axeptio', name: 'Axeptio', containers: ['#axeptio_overlay', '.axeptio_mount', '#axeptio_main'], rejectButtons: ['#axeptio_btn_dismiss', 'button[data-axeptio-action="refuse"]', '[data-testid="axeptio-btn-dismiss"]'] },
    { id: 'sirdata', name: 'Sirdata CMP', containers: ['#sd-cmp', '.sd-cmp-container'], rejectButtons: ['.sd-cmp-reject-all', '#sd-cmp-reject-all-button', 'button[data-sd-cmp-action="reject"]'] },
    { id: 'admiral', name: 'Admiral CMP', containers: ['#admiral-consent-banner', '[class*="admiral-consent"]', '.admiral-cmp'], rejectButtons: ['[class*="admiral-reject"]', 'button[data-admiral-action="reject"]'] },
    { id: 'civic-cookie-control', name: 'Civic Cookie Control', containers: ['#ccc', '#ccc-notify', '#ccc-module'], rejectButtons: ['#ccc-reject-settings', '#ccc-notify-reject', 'button.ccc-reject-button'] },
    { id: 'cookie-information', name: 'Cookie Information', containers: ['#cookie-information-template-wrapper', '#coiOverlay'], rejectButtons: ['#declineButton', '.coi-banner__decline'] },
    { id: 'cookiescript', name: 'CookieScript', containers: ['#cookiescript_injected', '#cookiescript_wrapper'], rejectButtons: ['#cookiescript_reject'] },
    { id: 'cookiehub', name: 'CookieHub', containers: ['.ch2-container', '#ch2-dialog', '.ch2'], rejectButtons: ['.ch2-deny-all-btn'] },
    { id: 'ketch', name: 'Ketch', containers: ['#lanyard_root', '#ketch-banner', '.ketch-banner'], rejectButtons: ['[data-testid="ketch-banner-reject"]', '#ketch-reject-all'] },
    { id: 'transcend', name: 'Transcend Airgap', containers: ['#transcend-consent-manager', 'transcend-consent-manager'], rejectButtons: ['[data-transcend-action="reject-all"]', 'button.transcend-reject-all'] },
    { id: 'securiti', name: 'Securiti Privacy Center', containers: ['.securiti-cmp-banner', '#securiti-cookie-banner'], rejectButtons: ['.securiti-reject-btn', 'button[data-securiti-reject]'] },
    { id: 'evidon', name: 'Evidon / Crownpeak', containers: ['#_evidon_banner', '#_evidon-background', '.evidon-banner'], rejectButtons: ['#_evidon-decline-button', '.evidon-banner-declinebutton'] },
    { id: 'tealium-consent', name: 'Tealium Consent Manager', containers: ['#__tealium_consent_prompt', '#tealium-consent-banner', '.utag-consent-banner'], rejectButtons: ['#tealium-consent-decline', '.utag-consent-decline'] },
    { id: 'ensighten', name: 'Ensighten Privacy', containers: ['#ensNotifyBanner', '.ensNotifyBanner'], rejectButtons: ['#ensRejectAll', '#ensCloseBanner', '.ens-reject-all'] },
    { id: 'adobe-optin', name: 'Adobe Experience Consent', containers: ['#adobe-privacy-banner', '.adobe-consent-banner'], rejectButtons: ['.adobe-consent-reject', '#adobe-privacy-decline'] },
    { id: 'oracle-consent', name: 'Oracle Consent Manager', containers: ['#oracle-consent-banner', '.ora-consent-banner'], rejectButtons: ['.ora-consent-decline', '#oracle-consent-reject'] },
    { id: 'sfbx-appconsent', name: 'SFBX AppConsent', containers: ['#appconsent_nativ', '.appconsent-container', '#appconsent'], rejectButtons: ['.appconsent-refuse-all', 'button[data-ac-action="refuse"]'] },
    { id: 'commanders-act', name: 'Commanders Act (TrustCommander)', containers: ['#tc-privacy-wrapper', '#popin_tc_privacy', '#tc_privacy_banner'], rejectButtons: ['#popin_tc_privacy_button_2', '#tc_privacy_button_reject', 'button[id*="tc_privacy_reject"]'] },
    { id: 'sibbo', name: 'Sibbo CMP', containers: ['#sibbo-cmp', '.sibbo-cmp-banner'], rejectButtons: ['#sibbo-cmp-reject', '.sibbo-cmp-btn-reject'] },
    { id: 'liveramp-privacymanager', name: 'LiveRamp Privacy Manager', containers: ['#lr-privacy-manager', '.lr-pm-container', '[id^="factor-cmp"]'], rejectButtons: ['.lr-pm-reject-all', 'button[data-lr-reject]'] },
    { id: 'gravito', name: 'Gravito CMP', containers: ['#gravitoCMP', '.gravitoCMP-wrapper'], rejectButtons: ['#gravitoCMP-reject-all', '.gravitoCMP-reject-btn'] },
    { id: 'piwik-pro', name: 'Piwik PRO Consent Manager', containers: ['#ppms_cm_consent_popup', '.ppms_cm_popup_container'], rejectButtons: ['#ppms_cm_reject-all'] },
    { id: 'matomo-consent', name: 'Matomo Consent Manager', containers: ['#matomo-consent-banner', '.matomo-cookie-consent'], rejectButtons: ['#matomo-consent-decline', '.matomo-cookie-decline'] },
    { id: 'trusted-shops-consent', name: 'Trusted Shops Consent', containers: ['#ts-consent-banner', '.ts-consent-modal'], rejectButtons: ['#ts-consent-reject', '.ts-consent-btn-reject'] },
    { id: 'complianz', name: 'Complianz GDPR/CCPA', containers: ['#cmplz-cookiebanner-container', '.cmplz-cookiebanner'], rejectButtons: ['.cmplz-deny'] },
    { id: 'borlabs-cookie', name: 'Borlabs Cookie', containers: ['#BorlabsCookieBox', '.BorlabsCookie', '#BorlabsCookieBoxWrap'], rejectButtons: ['a[data-cookie-refuse]', '#BorlabsCookieBtnRefuse', '._brlbs-refuse-btn', 'button[data-borlabs-cookie-refuse]'] },
    { id: 'real-cookie-banner', name: 'Real Cookie Banner', containers: ['.rcb-banner', '#devowl-real-cookie-banner'], rejectButtons: ['.rcb-btn-reject', 'button[data-rcb-action="reject"]', '.rcb-reject-all'] },
    { id: 'cookienotice', name: 'Cookie Notice & Compliance', containers: ['#cookie-notice', '.cookie-notice-container'], rejectButtons: ['#cn-refuse-cookie', '.cn-refuse-cookie'] },
    { id: 'gdpr-cookie-compliance', name: 'GDPR Cookie Compliance (Moove)', containers: ['#moove_gdpr_cookie_info_bar', '.moove-gdpr-info-bar-container'], rejectButtons: ['.moove-gdpr-infobar-reject-btn'] },
    { id: 'cookie-law-info', name: 'Cookie Law Info', containers: ['#cookie-law-info-bar', '.cli-bar-container'], rejectButtons: ['#cookie_action_close_header_reject', '.cli_action_button[data-cli_action="reject"]'] },
    { id: 'pandectes', name: 'Pandectes GDPR Compliance', containers: ['#pandectes-banner', '.pandectes-banner'], rejectButtons: ['.pd-cp-decline-btn', '#pd-cp-decline'] },
    { id: 'cookiefirst', name: 'CookieFirst', containers: ['#cookiefirst-root', '.cf-banner', '[data-cookiefirst-widget]'], rejectButtons: ['[data-cookiefirst-action="reject"]'] },
    { id: 'shopify-privacy-banner', name: 'Shopify Customer Privacy Banner', containers: ['#shopify-pc__banner', '.shopify-pc__banner'], rejectButtons: ['#shopify-pc__banner__btn-decline'] },
    { id: 'wix-cookie-banner', name: 'Wix Cookie Consent', containers: ['[data-hook="consent-banner"]', '.cookie-banner-wix', '#wix-cookie-banner'], rejectButtons: ['[data-hook="consent-banner-decline-button"]', 'button[data-hook="decline-all-button"]'] },
    { id: 'squarespace-cookie-banner', name: 'Squarespace Cookie Banner', containers: ['.sqs-cookie-banner-v2', '.sqs-cookie-banner'], rejectButtons: ['.sqs-cookie-banner-v2-deny'] },
    { id: 'finsweet-cookie-consent', name: 'Finsweet Cookie Consent', containers: ['[fs-cc="banner"]', '.fs-cc-banner_component'], rejectButtons: ['[fs-cc="deny"]'] },
    { id: 'hubspot-cookie-banner', name: 'HubSpot Cookie Banner', containers: ['#hs-eu-cookie-confirmation', '#hs-banner-parent'], rejectButtons: ['#hs-eu-decline-button'] },
    { id: 'bigcommerce-cookie', name: 'BigCommerce Cookie Consent', containers: ['[data-consent-manager-dialog]', '#bc-consent-banner'], rejectButtons: ['[data-consent-manager-reject]', 'button.bc-consent-reject'] },
    { id: 'magento-cookie-notice', name: 'Magento Cookie Notice', containers: ['#notice-cookie-block', '.message.global.cookie'], rejectButtons: ['#btn-cookie-deny', '.cookie-deny', '#btn-cookie-decline'] },
    { id: 'prestashop-lgcookieslaw', name: 'PrestaShop LGCookiesLaw', containers: ['#lgcookieslaw_banner', '.lgcookieslaw-banner'], rejectButtons: ['#lgcookieslaw_reject', '.lgcookieslaw-btn-reject'] },
    { id: 'prestashop-ets-cookie', name: 'PrestaShop Cookie Banner (ETS)', containers: ['#ets_cb_banner', '.kb-cookie-bar'], rejectButtons: ['.ets_cb_reject', '.kb-cookie-reject'] },
    { id: 'drupal-eu-cookie-compliance', name: 'Drupal EU Cookie Compliance', containers: ['#sliding-popup', '.eu-cookie-compliance-banner'], rejectButtons: ['.eu-cookie-compliance-decline-button', '.eu-cookie-compliance-banner .decline-button'] },
    { id: 'joomla-cookiehint', name: 'Joomla CookieHint', containers: ['#redim-cookiehint', '.cookiehint'], rejectButtons: ['#cookiehintsubmitno', '.cookiehint_decline'] },
    { id: 'typo3-mindshape', name: 'TYPO3 Mindshape Cookie Consent', containers: ['.mindshape-cookie-consent', '#mindshape-cookie-consent'], rejectButtons: ['.mindshape-cookie-consent-deny'] },
    { id: 'typo3-sg-cookie-optin', name: 'TYPO3 sg_cookie_optin', containers: ['#sg-cookie-optin', '.sg-cookie-optin-box'], rejectButtons: ['.sg-cookie-optin-reject', 'button[data-sg-cookie-reject]'] },
    { id: 'shopware-cookie-permission', name: 'Shopware Cookie Permission', containers: ['.cookie-permission-container', '#cookie-permission-bar'], rejectButtons: ['.js-cookie-permission-deny', 'button.cookie-permission-deny'] },
    { id: 'wp-cookie-consent', name: 'WP Cookie Consent (WPEka)', containers: ['#wpl-cookie-consent', '.wpl-cookie-consent-bar'], rejectButtons: ['#cookie_action_reject', '.wpl-reject-btn'] },
    { id: 'wp-autoterms', name: 'WP AutoTerms Cookie Banner', containers: ['#wpautoterms-cookie-banner', '.wpautoterms-consent'], rejectButtons: ['.wpautoterms-cookie-reject'] },
    { id: 'beautiful-cookie-banner', name: 'Beautiful Cookie Consent Banner', containers: ['.nsc_bar_container', '#nsc_bar'], rejectButtons: ['.nsc_bar_decline'] },
    { id: 'data443-gdpr-framework', name: 'The GDPR Framework (Data443)', containers: ['#gdpr-cookie-consent-bar', '.gdpr-consent-bar'], rejectButtons: ['.gdpr-decline-btn', '#gdpr-cookie-decline'] },
    { id: 'ct-ultimate-gdpr', name: 'CT Ultimate GDPR', containers: ['#ct-ultimate-gdpr-cookie-popup', '.ct-ultimate-gdpr-cookie-modal'], rejectButtons: ['#ct-ultimate-gdpr-cookie-reject', '.ct-ultimate-gdpr-cookie-decline'] },
    { id: 'ginger-eu-cookie', name: 'Ginger EU Cookie Law', containers: ['#ginger_banner', '.ginger-banner'], rejectButtons: ['.ginger_btn_refuse', '.ginger-reject'] },
    { id: 'weepie-cookie-allow', name: 'WeePie Cookie Allow', containers: ['#wpca_banner', '.wpca-cookie-bar'], rejectButtons: ['.wpca-decline-btn', '#wpca_decline'] },
    { id: 'webtoffee-gdpr', name: 'WebToffee GDPR Cookie Consent', containers: ['#wt-cli-cookie-consent-bar', '.wt-cli-cookie-bar'], rejectButtons: ['#wt-cli-reject-btn'] },
    { id: 'eu-cookie-law-wp', name: 'EU Cookie Law (WP)', containers: ['.pea_cook_wrapper', '#pea_cook_wrapper'], rejectButtons: ['.pea_cook_btn_refuse', '#pea_cook_refuse'] },
    { id: 'seers-cookie', name: 'Seers Consent Management', containers: ['#seers-cookie-banner', '.seers-cookie-consent'], rejectButtons: ['#seers-reject-all', '.seers-cmp-reject-btn'] },
    { id: 'consentik', name: 'Consentik GDPR Cookies', containers: ['#consentik-banner', '.consentik-cookie-banner'], rejectButtons: ['.consentik-decline-btn', '#consentik-reject-all'] },
    { id: 'avada-gdpr-cookies', name: 'Avada GDPR Cookies', containers: ['#avada-cookie-bar', '.avada-cookies-banner'], rejectButtons: ['.avada-cookies-decline', '#avada-cookie-decline'] },
    { id: 'booster-eu-cookie', name: 'Booster EU Cookie Bar', containers: ['#ba-cookie-bar', '.ba-cookie-banner'], rejectButtons: ['.ba-cookie-decline', '#ba-cookie-reject'] },
    { id: 'consentmo', name: 'Consentmo (iSenseLabs) GDPR', containers: ['#gdpr-cc-banner', '.consentmo-banner', '.cc-m-banner'], rejectButtons: ['.cc-m-decline', '#gdpr-cc-decline-btn', '.consentmo-decline-btn'] },
    { id: 'wpconsent', name: 'WPConsent', containers: ['#wpconsent-container', '.wpconsent-banner'], rejectButtons: ['#wpconsent-cancel-all', '.wpconsent-cancel-cookies'] },
    { id: 'ghost-cookie-banner', name: 'Ghost Portal Cookie Banner', containers: ['.gh-cookie-banner', '#gh-cookie-consent'], rejectButtons: ['.gh-cookie-decline', '#gh-cookie-reject'] },
    { id: 'pressidium-cookie-consent', name: 'Pressidium Cookie Consent', containers: ['.pressidium-cookie-consent', '#pressidium-cc'], rejectButtons: ['.pressidium-cc-deny', 'button[data-pressidium-cc="reject"]'] },
    { id: 'consentmagic', name: 'ConsentMagic', containers: ['.cs-consent-banner', '#consentmagic-banner'], rejectButtons: ['.cs-reject-all', '#consentmagic-reject-all'] },
    { id: 'osano-cookieconsent-oss', name: 'CookieConsent v3 (Insites OSS)', containers: ['.cc-window', '.cc-banner'], rejectButtons: ['.cc-deny', '.cc-btn.cc-deny'] },
    { id: 'orestbida-cookieconsent', name: 'Orestbida CookieConsent', containers: ['#cc--main', '#cc-main', '.cm-wrapper'], rejectButtons: ['#c-s-bn', '.cm__btn[data-role="necessary"]', 'button[data-role="necessary"]', '#s-rall-bn'] },
    { id: 'klaro', name: 'Klaro! Consent Manager', containers: ['.klaro', '#klaro'], rejectButtons: ['.klaro .cm-btn-decline', '.klaro button.cn-decline', '.klaro .cm-btn-danger'] },
    { id: 'tarteaucitron', name: 'TarteAuCitron.js', containers: ['#tarteaucitronRoot', '#tarteaucitronAlertBig'], rejectButtons: ['#tarteaucitronAllDenied', '#tarteaucitronAllDenied2', '.tarteaucitronDeny'] },
    { id: 'orejime', name: 'Orejime', containers: ['.orejime-ModalWrapper', '.orejime-Notice', '#orejime'], rejectButtons: ['.orejime-Notice-declineButton'] },
    { id: 'silktide-cookie-banner', name: 'Silktide Cookie Banner', containers: ['#silktide-cookie-banner', '.silktide-cookie-banner'], rejectButtons: ['.silktide-reject-button', 'button[data-silktide-reject]'] },
    { id: 'cookie-bar-eu', name: 'CookieBAR (cookie-bar.eu)', containers: ['#cookie-bar', '#cookie-bar-prompt'], rejectButtons: ['#cookie-bar-button-no', '.cb-disable'] },
    { id: 'cookiecuttr', name: 'jQuery CookieCuttr', containers: ['.cc-cookies-cuttr', '#cookie-cuttr'], rejectButtons: ['.cc-cookie-decline-cuttr', 'a.cc-cookie-decline'] },
    { id: 'gdpr-cookie-notice', name: 'gdpr-cookie-notice', containers: ['.gdpr-cookie-notice', '#gdpr-cookie-notice'], rejectButtons: ['.gdpr-cookie-notice-nav-item-btn-reject', '.gdpr-cookie-notice-reject'] },
    { id: 'react-cookie-consent', name: 'react-cookie-consent', containers: ['.CookieConsent'], rejectButtons: ['#rcc-decline-button'] },
    { id: 'vanilla-cookieconsent', name: 'vanilla-cookieconsent', containers: ['#cm-container', '.cm-container'], rejectButtons: ['.cm-btn-reject-all', 'button[data-cc="reject-all"]'] },
    { id: 'c15t', name: 'c15t Consent', containers: ['[data-c15t-dialog]', '#c15t-banner'], rejectButtons: ['[data-c15t-reject-all]', 'button[data-c15t-action="reject"]'] },
    { id: 'govuk-cookie-banner', name: 'GOV.UK Cookie Banner', containers: ['.govuk-cookie-banner', '#govuk-cookie-banner'], rejectButtons: ['.govuk-cookie-banner button[value="reject"]', 'button[data-cookie-action="reject"]'] },
    { id: 'nhsuk-cookie-banner', name: 'NHS UK Cookie Banner', containers: ['#nhsuk-cookie-banner', '.nhsuk-cookie-banner'], rejectButtons: ['#nhsuk-cookie-banner__link_reject', 'button[data-nhs-cookie-reject]'] },
    { id: 'europa-cck', name: 'European Commission CCK', containers: ['#cookie-consent-toolkit', '.wt-cck-banner', '.cck-banner'], rejectButtons: ['.wt-cck-btn-refuse', '.cck-actions-button-refuse', 'a[href="#refuse"]'] },
    { id: 'grt-cookie-consent', name: 'GRT Cookie Consent', containers: ['.grt-cookie', '#grt-cookie'], rejectButtons: ['.grt-cookie-decline'] },
    { id: 'glowcookies', name: 'GlowCookies', containers: ['#glowCookies-banner', '.glowCookies__banner'], rejectButtons: ['#rejectCookies', '.glowCookies__btn--reject'] },
    { id: 'bootstrap-cookie-alert', name: 'Bootstrap Cookie Alert', containers: ['.cookiealert', '#cookiealert'], rejectButtons: ['.declinecookies'] },
    { id: 'vue-cookie-accept-decline', name: 'vue-cookie-accept-decline', containers: ['.cookie__bar', '.cookie__floating'], rejectButtons: ['.cookie__bar__buttons__button--decline', '.cookie__floating__buttons__button--decline'] },
    { id: 'ngx-cookieconsent', name: 'ngx-cookieconsent', containers: ['#ngx-cc-window', '.ngx-cc-window'], rejectButtons: ['.ngx-cc-deny'] },
    { id: 'svelte-cookie-consent', name: 'svelte-cookie-consent', containers: ['.cookieConsent', '.cookieConsentToggle'], rejectButtons: ['.cookieConsent__Button--Decline', 'button[data-gdpr-reject]'] },
    { id: 'cookie-though', name: 'cookie-though', containers: ['.ct-container', '#cookie-though'], rejectButtons: ['.ct-button-reject', 'button[data-ct-reject]'] },
    { id: 'oil-js', name: 'OIL.js', containers: ['.as-oil', '#as-oil-dialog'], rejectButtons: ['.as-oil__btn-optout', '[data-qa="oil-NoCookieButton"]'] },
    { id: 'google-funding-choices', name: 'Google Funding Choices', containers: ['.fc-consent-root', '.fc-dialog-container'], rejectButtons: ['.fc-cta-do-not-consent'] },
    { id: 'freeprivacypolicy-cc', name: 'FreePrivacyPolicy Cookie Consent', containers: ['.freeprivacypolicy-com---nb', '#freeprivacypolicy-com---nb'], rejectButtons: ['.freeprivacypolicy-com---nb .cc-nb-reject'] },
    { id: 'termsfeed-cookie-consent', name: 'TermsFeed Cookie Consent', containers: ['#termsfeed-com---nb', '.termsfeed-com---nb'], rejectButtons: ['.termsfeed-com---nb .cc-nb-reject', '#termsfeed-reject-btn'] },
    { id: 'privacypolicies-cc', name: 'PrivacyPolicies.com Cookie Consent', containers: ['#privacypolicies-com---nb', '.privacypolicies-com---nb'], rejectButtons: ['.privacypolicies-com---nb .cc-nb-reject'] },
    { id: 'cookie-confirm', name: 'Cookie Confirm', containers: ['#cookie-confirm-banner', '.cookie-confirm-dialog'], rejectButtons: ['.cookie-confirm-reject'] },
    { id: 'enzuzo', name: 'Enzuzo', containers: ['#enzuzo-cookie-banner', '.enzuzo-cookie-banner'], rejectButtons: ['#enzuzo-reject-all', '.enzuzo-decline-btn'] },
    { id: 'termageddon', name: 'Termageddon', containers: ['#termageddon-consent', '.termageddon-cookie-banner'], rejectButtons: ['.termageddon-decline-btn', '#termageddon-reject'] },
    { id: 'google-consent', name: 'Google Consent Banner', containers: ['#CXQnmb', 'form[action*="consent.google"]'], rejectButtons: ['form[action*="consent.google"] button[aria-label*="Reject" i]', '#W0wltc'] },
    { id: 'youtube-consent', name: 'YouTube Consent Dialog', containers: ['ytd-consent-bump-v2-lightbox', 'tp-yt-paper-dialog.ytd-consent-bump-v2-lightbox'], rejectButtons: ['ytd-consent-bump-v2-lightbox button[aria-label*="Reject" i]'] },
    { id: 'microsoft-bnp', name: 'Microsoft / Bing Cookie Banner', containers: ['#bnp_container', '#msccBanner', '.ms-cookie-banner'], rejectButtons: ['#bnp_btn_reject', '#msccRejectBtn'] },
    { id: 'amazon-sp-cc', name: 'Amazon Cookie Preferences', containers: ['#sp-cc', '#sp-cc-form'], rejectButtons: ['#sp-cc-rejectall-link', 'input#sp-cc-rejectall-link', 'button#sp-cc-rejectall-link'] },
    { id: 'meta-cookie-dialog', name: 'Meta / Facebook Cookie Dialog', containers: ['[data-testid="cookie-policy-manage-dialog"]', '[data-testid="cookie-policy-dialog"]'], rejectButtons: ['[data-testid="cookie-policy-manage-dialog-decline-button"]', '[data-cookiebanner="decline_button"]'] },
    { id: 'linkedin-cookie-consent', name: 'LinkedIn Cookie Consent', containers: ['#artdeco-global-alert-container', '.artdeco-global-alert[type="COOKIE_CONSENT"]'], rejectButtons: ['.artdeco-global-alert button[action-type="DENY"]'] },
    { id: 'reddit-cookie-banner', name: 'Reddit Cookie Banner', containers: ['shreddit-cookie-banner', '#reddit-cookie-banner'], rejectButtons: ['button[data-testid="reject-nonessential-cookies"]'] },
    { id: 'tiktok-cookie-banner', name: 'TikTok Cookie Banner', containers: ['tiktok-cookie-banner', '#tiktok-cookie-banner'], rejectButtons: ['button[data-e2e="cookie-banner-decline"]'] },
    { id: 'clickio', name: 'Clickio Consent', containers: ['#clickio-consent-container', '.cl-consent-node', '#cl-consent'], rejectButtons: ['.cl-consent__btn--reject', '#cl-consent-reject'] },
    { id: 'inmobi-choice', name: 'InMobi Choice CMP', containers: ['#inmobi-cmp-container', '.inmobi-choice-banner'], rejectButtons: ['.inmobi-choice-reject', 'button[data-inmobi-reject]'] },
    { id: 'ezoic-consent', name: 'Ezoic Consent Management', containers: ['#ez-cookie-dialog-wrapper', '#ez-cookie-dialog'], rejectButtons: ['#ez-reject-all', '#ez-decline-all', 'button.ez-cmp-reject'] },
    { id: 'mediavine-cmp', name: 'Mediavine CMP', containers: ['#mediavine-cmp-container', '.mv-cmp-banner', '[data-name="mediavine-cmp"]'], rejectButtons: ['.mv-cmp-reject-all', 'button[data-mv-cmp="reject"]'] },
    { id: 'raptive-cmp', name: 'Raptive / AdThrive CMP', containers: ['#adthrive-cmp-container', '.raptive-cmp-banner'], rejectButtons: ['.raptive-cmp-reject-all', '.adthrive-cmp-reject'] },
    { id: 'freestar-cmp', name: 'Freestar CMP', containers: ['#fs-cmp-banner', '.freestar-cmp-container'], rejectButtons: ['.fs-cmp-reject', '.freestar-cmp-reject'] },
    { id: 'nitropay-cmp', name: 'NitroPay CMP', containers: ['#ncmp__container', '.ncmp__banner'], rejectButtons: ['.ncmp__btn--reject', 'button.ncmp__btn-reject'] },
    { id: 'monumetric-cmp', name: 'Monumetric CMP', containers: ['#mm-cmp-banner', '.monumetric-cmp'], rejectButtons: ['.mm-cmp-reject'] },
    { id: 'snigel-adconsent', name: 'Snigel AdConsent', containers: ['#snigel-cmp-framework', '.adconsent-banner', '#adconsent-popup'], rejectButtons: ['#adconsent-reject-all', '.adconsent-decline'] },
    { id: 'venatus-cmp', name: 'Venatus CMP', containers: ['#vnt-cmp-banner', '.venatus-cmp'], rejectButtons: ['.vnt-cmp-reject-all'] },
    { id: 'playwire-cmp', name: 'Playwire Ramp CMP', containers: ['#pw-cmp-banner', '.pw-cmp-container'], rejectButtons: ['.pw-cmp-reject-all'] },
    { id: 'ogury-cmp', name: 'Ogury Choice Manager', containers: ['#ogury-cmp-container', '.ogury-consent-modal'], rejectButtons: ['.ogury-cmp-refuse-all'] },
    { id: 'uniconsent', name: 'UniConsent CMP', containers: ['#uniccmp', '.unic-modal-container'], rejectButtons: ['#unic-reject-all', '.unic-btn-reject'] },
    { id: 'consent-studio', name: 'Consent Studio', containers: ['#consent-studio-banner', '.consent-studio-dialog'], rejectButtons: ['#consent-studio-reject', '.consent-studio-decline'] },
    { id: 'cassie-syrenis', name: 'Cassie (Syrenis)', containers: ['#cassie-cookie-module', '.cassie-cookie-banner'], rejectButtons: ['#cassie_reject_all_banner', '.cassie-reject-all'] },
    { id: 'datagrail', name: 'DataGrail Consent', containers: ['#datagrail-consent-banner', '.dg-consent-banner'], rejectButtons: ['.dg-consent-reject', '[data-dg-action="reject"]'] },
    { id: 'ethyca-fides', name: 'Ethyca Fides', containers: ['#fides-banner', '#fides-overlay', '.fides-modal-container'], rejectButtons: ['#fides-reject-all-button', '.fides-reject-all-button', 'button[data-testid="Reject all-btn"]'] },
    { id: 'mineos', name: 'MineOS Consent', containers: ['#mineos-consent-banner', '.mineos-cmp'], rejectButtons: ['.mineos-reject-all'] },
    { id: 'privado', name: 'Privado Consent', containers: ['#privado-cookie-banner', '.privado-cmp'], rejectButtons: ['.privado-reject-btn'] },
    { id: 'ebay-gdpr-banner', name: 'eBay GDPR Banner', containers: ['#gdpr-banner', '.gdpr-banner-container'], rejectButtons: ['#gdpr-banner-decline', 'button#gdpr-banner-decline'] },
    { id: 'poool-consent', name: 'Poool Consent', containers: ['#poool-consent-banner', '.poool-cmp'], rejectButtons: ['.poool-cmp-reject'] },
    { id: 'contentpass', name: 'Contentpass CMP', containers: ['#cp-consent-banner', '.contentpass-cmp'], rejectButtons: ['.contentpass-reject'] },
    { id: 'stackoverflow-consent', name: 'Stack Overflow Consent Banner', containers: ['.js-consent-banner', '#onetrust-consent-sdk .js-consent-banner'], rejectButtons: ['.js-reject-cookies', 'button.js-reject-cookies'] },
    { id: 'ccm19', name: 'CCM19', containers: ['#ccm-widget', '.ccm-modal', '#ccm-control-panel'], rejectButtons: ['.ccm--decline-cookies', '#ccm-decline-all'] },
    { id: 'bbc-cookies', name: 'BBC Cookies Banner', containers: ['#bbccookies', '.bbc-cookie-banner'], rejectButtons: ['#bbccookies-reject-button', 'button[data-bbc-cookie-reject]'] },
    { id: 'cloudflare-zaraz', name: 'Cloudflare Zaraz Consent', containers: ['#cf-zaraz-consent', '.zaraz-consent-modal'], rejectButtons: ['.zaraz-reject-all', '#cf-zaraz-reject'] },
    { id: 'etracker-consent', name: 'etracker Consent', containers: ['#etracker-consent-banner', '.etracker-cookie-notice'], rejectButtons: ['#etracker-consent-reject', '.etracker-decline'] },
    { id: 'clym', name: 'Clym Privacy Widget', containers: ['#clym-widget', '.clym-privacy-widget'], rejectButtons: ['.clym-reject-all', '#clym-decline-btn'] },
    { id: 'secure-privacy', name: 'Secure Privacy', containers: ['#sp-cc-banner', '.secureprivacy-banner'], rejectButtons: ['#sp-cc-decline', '.secureprivacy-decline'] },
    { id: 'metomic', name: 'Metomic Consent', containers: ['#metomic-consent-banner', '.mtm-consent-bar'], rejectButtons: ['.mtm-reject-all', '#metomic-reject'] },
    { id: 'illow', name: 'Illow Cookie Banner', containers: ['.illow-cookie-banner', '#illow-cookie-banner'], rejectButtons: ['.illow-reject-all', '#illow-decline-btn'] },
    { id: 'cookieguard', name: 'CookieGuard', containers: ['#cookieguard-banner', '.cookieguard-container'], rejectButtons: ['.cookieguard-decline'] },
    { id: 'adopt-lgpd', name: 'AdOpt (LGPD)', containers: ['#adopt-cookie-banner', '.adopt-c-banner'], rejectButtons: ['#adopt-reject-all-button', '.adopt-reject-btn'] },
    { id: 'dponet-lgpd', name: 'DPOnet (LGPD)', containers: ['#dponet-cookie-banner', '.dponet-cmp'], rejectButtons: ['.dponet-reject-all'] },
    { id: 'privacytools-br', name: 'PrivacyTools (LGPD)', containers: ['#privacytools-banner', '.pt-cookie-banner'], rejectButtons: ['.pt-cookie-reject', '#privacytools-reject'] },
    { id: 'privtech-jp', name: 'PrivTech Trust 360', containers: ['#privtech-consent-banner', '.privtech-cmp'], rejectButtons: ['.privtech-reject-all'] },
    { id: 'datasign-webtru', name: 'DataSign webtru', containers: ['#webtru-banner', '.webtru-consent-dialog'], rejectButtons: ['.webtru-reject-all', '#webtru-decline'] },
    { id: 'shinystat-cmp', name: 'ShinyStat CMP', containers: ['#shinystat-cookie-banner', '.shinystat-cmp'], rejectButtons: ['.shinystat-cmp-reject'] },
    { id: 'yahoo-oath-cmp', name: 'Yahoo / Oath CMP', containers: ['#consent-page', '.consent-wizard'], rejectButtons: ['.consent-wizard button[name="reject"]', '.consent-wizard button.reject-all'] },
    { id: 'umbraco-cookie-consent', name: 'Umbraco Cookie Consent', containers: ['#umbraco-cookie-consent', '.umb-cookie-banner'], rejectButtons: ['.umb-cookie-reject', '#umbraco-cookie-reject'] },
    { id: 'craft-cookie-consent', name: 'Craft CMS Cookie Consent', containers: ['.craft-cookie-banner', '#craft-cookie-consent'], rejectButtons: ['.craft-cookie-decline', '#craft-cookie-reject'] },
    { id: 'brevo-cookie-consent', name: 'Brevo Cookie Consent', containers: ['#brevo-cookie-banner', '.sib-cookie-consent'], rejectButtons: ['.sib-cookie-decline'] },
    { id: 'zoho-cookie-consent', name: 'Zoho Cookie Consent', containers: ['#zoho-cookie-banner', '.zoho-cookie-bar'], rejectButtons: ['.zoho-cookie-reject'] },
    { id: 'salesforce-cookie-consent', name: 'Salesforce Cookie Consent', containers: ['c-cookie-consent', '.sfdc-cookie-consent', '#salesforce-cookie-banner'], rejectButtons: ['.sfdc-cookie-reject', 'button[data-sfdc-cookie-reject]'] },
    { id: 'sap-cdc-consent', name: 'SAP Customer Data Cloud Consent', containers: ['#gigya-consent-banner', '.gigya-cookie-consent'], rejectButtons: ['.gigya-consent-reject', '#gigya-cookie-reject'] },
    { id: 'truendo', name: 'Truendo CMP', containers: ['#truendo-cookie-banner', '#truendo-widget', '.truendo-banner'], rejectButtons: ['#truendo-reject-all', '.truendo-decline-btn', 'button[data-tr-action="deny"]'] },
    { id: 'monsido', name: 'Monsido / CivicPlus Consent', containers: ['#monsido-cookie-banner', '.monsido-consent-dialog'], rejectButtons: ['.monsido-reject-all', '#monsido-decline'] }
  ];

  const CMP_SELECTORS = [
    ...new Set([
      ...CMP_FRAMEWORKS.flatMap((f) => f.containers),
      '[id*="cookie-banner" i]',
      '[class*="cookie-consent" i]',
      '[id*="cookie-consent" i]',
      '[class*="cookie-banner" i]',
      '[role="dialog"][aria-label*="cookie" i]'
    ])
  ];

  const CMP_REJECT_BUTTONS = [
    ...new Set([
      ...CMP_FRAMEWORKS.flatMap((f) => f.rejectButtons || []),
      'button[aria-label*="reject" i]',
      'button[aria-label*="decline" i]',
      'button[aria-label*="refuse" i]',
      'button[aria-label*="ablehnen" i]',
      'button[aria-label*="refuser" i]',
      'button[aria-label*="rechazar" i]',
      'button[aria-label*="rifiuta" i]',
      'button[aria-label*="weigeren" i]',
      'button[aria-label*="rejeitar" i]',
      'button[aria-label*="odrzuć" i]'
    ])
  ];

  const CMP_REJECT_TEXT_PATTERNS = [
    // English (en)
    /^(reject|reject all|decline|decline all|deny|deny all|refuse|refuse all|necessary only|only necessary|essential only|only essential|only required|use necessary cookies only|allow necessary only|reject non-essential|decline optional|continue without accepting|disagree|no thanks)$/i,
    // German (de)
    /^(alle ablehnen|ablehnen|alles ablehnen|nur notwendige|nur erforderliche|nur essenzielle|nur funktionale|ohne einwilligung fortfahren|weiter ohne zustimmung|einwilligung ablehnen|nicht zustimmen)$/i,
    // French (fr)
    /^(tout refuser|refuser|refuser tout|tout rejeter|rejeter|continuer sans accepter|uniquement les essentiels|seulement les nécessaires|cookies nécessaires uniquement|ne pas accepter)$/i,
    // Spanish (es)
    /^(rechazar todo|rechazar todas|rechazar|denegar todo|denegar|solo necesarias|sólo necesarias|solo esenciales|únicamente necesarias|continuar sin aceptar|no aceptar)$/i,
    // Italian (it)
    /^(rifiuta tutto|rifiuta tutti|rifiuta|nega tutto|solo necessari|solo essenziali|continua senza accettare|rifiuta e continua|non accetto)$/i,
    // Dutch (nl)
    /^(alles weigeren|weigeren|alles afwijzen|afwijzen|alleen noodzakelijk|alleen essentiële|enkel noodzakelijke|doorgaan zonder accepteren|niet akkoord)$/i,
    // Portuguese (pt_BR)
    /^(rejeitar tudo|rejeitar todos|rejeitar|recusar tudo|recusar|apenas necessários|apenas essenciais|somente necessários|continuar sem aceitar|não aceitar)$/i,
    // Polish (pl)
    /^(odrzuć wszystko|odrzuć wszystkie|odrzuć|odmów|tylko niezbędne|tylko konieczne|kontynuuj bez akceptacji|nie wyrażam zgody)$/i,
    // Japanese (ja)
    /^(すべて拒否|全て拒否|拒否する|拒否|同意しない|必須のみ|必要なCookieのみ|必須Cookieのみ|承諾せずに続行)$/i
  ];

  function getCmpFrameworkCount() {
    return CMP_FRAMEWORKS.length;
  }

  const cmpRegistryMeta = Object.freeze({
    count: CMP_FRAMEWORKS.length,
    frameworks: Object.freeze(
      CMP_FRAMEWORKS.map((f) =>
        Object.freeze({
          id: f.id,
          name: f.name,
          containers: Object.freeze([...f.containers]),
          rejectButtons: Object.freeze([...(f.rejectButtons || [])])
        })
      )
    ),
    containerSelectorCount: CMP_SELECTORS.length,
    rejectSelectorCount: CMP_REJECT_BUTTONS.length,
    supportedLocales: Object.freeze(['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt_BR', 'ja'])
  });

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.__SWEEPR_CMP_REGISTRY__ = cmpRegistryMeta;
      globalThis.getCmpFrameworkCount = getCmpFrameworkCount;
    }
    if (typeof window !== 'undefined' && window !== (typeof globalThis !== 'undefined' ? globalThis : null)) {
      window.__SWEEPR_CMP_REGISTRY__ = cmpRegistryMeta;
      window.getCmpFrameworkCount = getCmpFrameworkCount;
    }
  } catch (e) {}

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  function collectShadowRoots(root, depth = 0, out = []) {
    if (!root || depth > 4) return out;
    try {
      if (typeof root.querySelectorAll === 'function') {
        const allEls = root.querySelectorAll('*');
        for (let i = 0; i < allEls.length; i++) {
          const el = allEls[i];
          if (el && el.shadowRoot) {
            out.push(el.shadowRoot);
            collectShadowRoots(el.shadowRoot, depth + 1, out);
          }
        }
      }
    } catch (e) {}
    return out;
  }

  function queryAllDeep(root, selector, depth = 0, out = [], shadowRoots = null) {
    if (!root || depth > 4 || typeof root.querySelectorAll !== 'function') return out;
    try {
      const matched = root.querySelectorAll(selector);
      for (let i = 0; i < matched.length; i++) out.push(matched[i]);
      const roots = Array.isArray(shadowRoots) ? shadowRoots : collectShadowRoots(root, depth);
      for (let i = 0; i < roots.length; i++) {
        try {
          const subMatched = roots[i].querySelectorAll(selector);
          for (let j = 0; j < subMatched.length; j++) out.push(subMatched[j]);
        } catch (err) {}
      }
    } catch (e) {}
    return out;
  }

  function queryDeep(root, selectors, filterFn = null, shadowRoots = null) {
    if (!root) return null;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const roots = Array.isArray(shadowRoots) ? shadowRoots : collectShadowRoots(root, 0);
    for (const sel of list) {
      const found = queryAllDeep(root, sel, 0, [], roots);
      for (let i = 0; i < found.length; i++) {
        if (!filterFn || filterFn(found[i])) {
          return found[i];
        }
      }
    }
    return null;
  }

  function createThrottle(fn, waitMs) {
    let scheduled = false;
    return function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        try {
          fn();
        } catch (e) {}
      }, waitMs);
    };
  }

  const pendingMetrics = new Map();
  let metricFlushTimer = null;

  function reportMetric(metric, amount = 1, extra = {}) {
    try {
      if (extra && Object.keys(extra).length > 0) {
        chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric, amount, ...extra });
        return;
      }
      pendingMetrics.set(metric, (pendingMetrics.get(metric) || 0) + (Number(amount) || 1));
      if (!metricFlushTimer) {
        metricFlushTimer = setTimeout(() => {
          metricFlushTimer = null;
          for (const [m, total] of pendingMetrics.entries()) {
            try {
              chrome.runtime.sendMessage({ type: 'INCREMENT_DIAGNOSTIC', metric: m, amount: total });
            } catch (e) {}
          }
          pendingMetrics.clear();
        }, 300);
      }
    } catch (e) {}
  }

  // ============================================================================
  // 0. Zero-Copy Auto-Activation Bridge on sweeprdeepblock.com
  // Automatically syncs a verified customer license key on /checkout/success or /login
  // ============================================================================
  function initWebsiteAutoActivationBridge() {
    const host = (location.hostname || '').toLowerCase();
    const isProdHost = /(^|\.)sweeprdeepblock\.com$/i.test(host);
    if (!isProdHost || location.protocol !== 'https:') {
      return;
    }

    let lastSyncedKey = '';
    let portalObs = null;
    function showAutoActivationConfirmation() {
      const targetEl = document.getElementById('licenseKeyText') || document.getElementById('portalLicenseKey');
      if (!targetEl || document.getElementById('sweeprAutoUnlockedPill')) return;
      const pill = document.createElement('div');
      pill.id = 'sweeprAutoUnlockedPill';
      pill.textContent = '✓ Browser Extension Automatically Unlocked & Active';
      Object.assign(pill.style, {
        marginTop: '8px',
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '999px',
        background: 'rgba(16, 185, 129, 0.2)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        color: '#6ee7b7',
        fontSize: '11px',
        fontWeight: '800'
      });
      targetEl.parentElement?.appendChild(pill);
    }

    const FULL_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    function trySyncKey(candidate) {
      const clean = String(candidate || '').trim();
      if (!FULL_LICENSE_KEY_RE.test(clean) || clean === lastSyncedKey) return;
      lastSyncedKey = clean;
      try {
        chrome.runtime.sendMessage({ type: 'AUTO_SYNC_WEBSITE_LICENSE', licenseKey: clean }, (res) => {
          if (res && res.ok && res.valid) {
            if (portalObs) portalObs.disconnect();
            showAutoActivationConfirmation();
          }
        });
      } catch (e) {}
    }

    function scanPageForLicenseKey() {
      try {
        const storedKey =
          localStorage.getItem('sweepr_license_key') ||
          localStorage.getItem('deepblock_license_key') ||
          '';
        if (storedKey) trySyncKey(storedKey);
      } catch (e) {}

      const checkoutKeyEl = document.getElementById('licenseKeyText');
      const portalKeyEl = document.getElementById('portalLicenseKey');
      if (checkoutKeyEl && checkoutKeyEl.textContent) trySyncKey(checkoutKeyEl.textContent);
      else if (portalKeyEl && portalKeyEl.textContent) trySyncKey(portalKeyEl.textContent);
    }

    scanPageForLicenseKey();

    window.addEventListener('message', (e) => {
      if (
        e.source !== window ||
        e.origin !== window.location.origin ||
        !e.data ||
        e.data.source !== 'sweepr-web-portal'
      ) {
        return;
      }
      if (e.data.type === 'SWEEPR_AUTO_ACTIVATE' && e.data.licenseKey) {
        trySyncKey(e.data.licenseKey);
      }
    });

    const throttledPortalScan = createThrottle(scanPageForLicenseKey, 250);
    portalObs = new MutationObserver(throttledPortalScan);
    if (document.body) {
      portalObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(() => portalObs.disconnect(), 15000);
    }
  }

  initWebsiteAutoActivationBridge();

  // ============================================================================
  // Interactive Page Element Zapper ("🧹 Hide Distracting Element")
  // ============================================================================
  const currentHost = (location.hostname || '').replace(/^www\./i, '').toLowerCase();

  function applySavedCustomHiddenSelectors(customMap) {
    if (!currentHost || !customMap || typeof customMap !== 'object') return;
    const list = Array.isArray(customMap[currentHost]) ? customMap[currentHost] : [];
    let styleEl = document.getElementById('deepblock-custom-zapper');
    if (list.length === 0) {
      if (styleEl) styleEl.remove();
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'deepblock-custom-zapper';
      (document.head || document.documentElement).appendChild(styleEl);
    }
    const safeSelectors = list.filter((sel) => {
      return (
        typeof sel === 'string' &&
        sel.length > 0 &&
        sel.length <= 250 &&
        /^[a-zA-Z0-9#._:() >[\]="'*~$^|,/-]+$/.test(sel) &&
        !/[{};\\@]/.test(sel) &&
        !/url\(/i.test(sel)
      );
    });
    if (safeSelectors.length === 0) {
      if (styleEl) styleEl.remove();
      return;
    }
    styleEl.textContent = `${safeSelectors.join(',\n')} { display: none !important; }`;
  }

  function buildUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) {
      return `#${CSS.escape(el.id)}`;
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && cur !== document.documentElement && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const classes = Array.from(cur.classList || [])
        .filter((c) => c && !/^deepblock/i.test(c) && /^[a-zA-Z0-9_-]+$/.test(c))
        .slice(0, 2);
      if (classes.length > 0) {
        part += '.' + classes.map((c) => CSS.escape(c)).join('.');
      } else if (cur.parentElement) {
        const siblings = Array.from(cur.parentElement.children).filter((s) => s.tagName === cur.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  let zapperActive = false;
  function startElementZapper() {
    if (zapperActive) return;
    zapperActive = true;

    const isTouchDevice = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let hoveredEl = null;
    let prevOutline = '';

    const banner = document.createElement('div');
    banner.id = 'deepblockZapperBanner';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      background: '#064e3b',
      color: '#ecfdf5',
      border: '1.5px solid #10b981',
      borderRadius: '999px',
      padding: '6px 10px 6px 16px',
      fontSize: '12px',
      fontWeight: '800',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      pointerEvents: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: '94vw'
    });
    const bannerLabel = document.createElement('span');
    bannerLabel.textContent = isTouchDevice
      ? 'Tap any element to select it'
      : 'Click any distracting element to hide it on this site';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'deepblockZapperCancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      background: '#10b981',
      color: '#022c22',
      border: 'none',
      borderRadius: '999px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '900',
      cursor: 'pointer'
    });
    banner.appendChild(bannerLabel);
    banner.appendChild(cancelBtn);
    document.body.appendChild(banner);

    function clearHighlight() {
      if (hoveredEl) {
        hoveredEl.style.outline = prevOutline;
        hoveredEl = null;
      }
    }

    function stopZapper() {
      zapperActive = false;
      clearHighlight();
      banner.remove();
      window.removeEventListener('mouseover', onMouseOver, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
    }

    cancelBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      stopZapper();
    }, true);

    function onMouseOver(e) {
      if (isTouchDevice) return;
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement || banner.contains(target)) return;
      if (hoveredEl !== target) {
        clearHighlight();
        hoveredEl = target;
        prevOutline = hoveredEl.style.outline || '';
        hoveredEl.style.outline = '2.5px solid #10b981';
      }
    }

    function onClick(e) {
      if (banner.contains(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement) {
        stopZapper();
        return;
      }
      if (isTouchDevice && hoveredEl !== target) {
        clearHighlight();
        hoveredEl = target;
        prevOutline = hoveredEl.style.outline || '';
        hoveredEl.style.outline = '2.5px solid #10b981';
        bannerLabel.textContent = 'Tap highlighted element again to hide';
        return;
      }
      const hideTarget = hoveredEl || target;
      stopZapper();

      const selector = buildUniqueSelector(hideTarget);
      hideTarget.style.setProperty('display', 'none', 'important');
      if (selector && currentHost) {
        chrome.storage.local.get(['customHiddenSelectors'], (res) => {
          const map = (res && res.customHiddenSelectors) || {};
          const existing = Array.isArray(map[currentHost]) ? map[currentHost] : [];
          if (!existing.includes(selector)) {
            map[currentHost] = [...existing, selector];
            chrome.storage.local.set({ customHiddenSelectors: map });
            applySavedCustomHiddenSelectors(map);
          }
        });
      }
      reportMetric('adsBlocked', 1);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopZapper();
      }
    }

    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'START_ELEMENT_ZAPPER') {
        startElementZapper();
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      } else if (msg && msg.type === 'PRO_ENTITLEMENT_CHANGED' && msg.proActive === false) {
        disableContentProtectionsOnExpiry();
        if (typeof sendResponse === 'function') sendResponse({ ok: true });
      }
    });
  }

  const CMP_SCROLL_LOCK_CLASSES = [
    'didomi-popup-open',
    'sp-message-open',
    'qc-cmp2-showing-ui',
    'cmplz-blocked',
    'onetrust-pc-dark-filter',
    'cookie-modal-open',
    'cookies-modal-open',
    'no-scroll',
    'noscroll',
    'overflow-hidden',
    'modal-open',
    'has-cookie-banner',
    'cc--anim'
  ];

  function unlockScrollIfFrozenByModal(isEntitled = true) {
    if (isEntitled === false) return;
    try {
      const targets = [document.documentElement, document.body].filter(Boolean);
      for (const el of targets) {
        if (el.classList && typeof el.classList.remove === 'function') {
          for (const cls of CMP_SCROLL_LOCK_CLASSES) {
            el.classList.remove(cls);
          }
        }
        const computed = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
        const ov = computed ? computed.overflow : '';
        const ovY = computed ? computed.overflowY : '';
        const pos = computed ? computed.position : '';
        if (ov === 'hidden' || ov === 'clip' || ovY === 'hidden' || ovY === 'clip') {
          if (el.style && typeof el.style.setProperty === 'function') {
            el.style.setProperty('overflow', 'auto', 'important');
            el.style.setProperty('overflow-y', 'auto', 'important');
          }
        }
        if (pos === 'fixed' && (ov === 'hidden' || ov === 'clip' || ovY === 'hidden' || ovY === 'clip')) {
          if (el.style && typeof el.style.setProperty === 'function') {
            el.style.setProperty('position', 'static', 'important');
          }
        }
      }
      if (document.body && document.body.style && typeof document.body.style.setProperty === 'function') {
        const bodyComputed = typeof getComputedStyle === 'function' ? getComputedStyle(document.body) : null;
        if (bodyComputed && bodyComputed.pointerEvents === 'none') {
          document.body.style.setProperty('pointer-events', 'auto', 'important');
        }
      }
    } catch (e) {}
  }

  function findFirstBannerMatch(allCmpSelectors) {
    try {
      const direct = document.querySelector(allCmpSelectors.join(','));
      if (direct) return direct;
    } catch (e) {
      for (let i = 0; i < allCmpSelectors.length; i++) {
        try {
          const hit = document.querySelector(allCmpSelectors[i]);
          if (hit) return hit;
        } catch (err) {}
      }
    }
    const shadowRoots = collectShadowRoots(document, 0);
    if (shadowRoots.length === 0) return null;
    const joined = allCmpSelectors.join(',');
    for (let i = 0; i < shadowRoots.length; i++) {
      const sr = shadowRoots[i];
      if (!sr) continue;
      if (typeof sr.querySelector === 'function') {
        try {
          const hit = sr.querySelector(joined);
          if (hit) return hit;
        } catch (e) {
          for (let j = 0; j < allCmpSelectors.length; j++) {
            try {
              const hit = sr.querySelector(allCmpSelectors[j]);
              if (hit) return hit;
            } catch (err) {}
          }
        }
      }
      if (typeof sr.querySelectorAll === 'function') {
        for (let j = 0; j < allCmpSelectors.length; j++) {
          try {
            const hits = sr.querySelectorAll(allCmpSelectors[j]);
            if (hits && hits.length > 0) return hits[0];
          } catch (err) {}
        }
      }
    }
    return null;
  }

  function isButtonEnabled(el) {
    if (!el || el.disabled) return false;
    if (typeof el.getAttribute === 'function') {
      const ariaDisabled = el.getAttribute('aria-disabled');
      if (ariaDisabled === 'true') return false;
      const disabledAttr = el.getAttribute('disabled');
      if (disabledAttr !== null && disabledAttr !== undefined) return false;
    }
    return true;
  }

  function matchesRejectLabel(el) {
    if (!isButtonEnabled(el)) return false;
    const textLabel = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const aria = typeof el.getAttribute === 'function' ? (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim() : '';
    const valLabel = String(el.value || '').replace(/\s+/g, ' ').trim();
    const raw = textLabel || aria || valLabel;
    if (!raw || raw.length > 64) return false;
    for (let i = 0; i < CMP_REJECT_TEXT_PATTERNS.length; i++) {
      if (CMP_REJECT_TEXT_PATTERNS[i].test(raw)) return true;
    }
    return false;
  }

  // 1. GDPR Cookie Banner Handling (Shadow-DOM Aware Auto-Rejector + Deduped Counter)
  function processCookieBanners(proActive, extraCmpSelectors = []) {
    const allCmpSelectors = Array.isArray(extraCmpSelectors) && extraCmpSelectors.length > 0
      ? [...CMP_SELECTORS, ...extraCmpSelectors]
      : CMP_SELECTORS;
    const foundBanner = findFirstBannerMatch(allCmpSelectors);
    if (!foundBanner) return;
    if (foundBanner.dataset && foundBanner.dataset.deepblockRejected === '1') return;

    if (!foundBanner.dataset || foundBanner.dataset.deepblockCounted !== '1') {
      if (foundBanner.dataset) foundBanner.dataset.deepblockCounted = '1';
      reportMetric('cookiePromptsDetected', 1);
    }

    if (proActive) {
      let clicked = false;
      const searchRoot = foundBanner.shadowRoot || foundBanner;
      let rejectBtn = queryDeep(searchRoot, CMP_REJECT_BUTTONS, isButtonEnabled);
      if (!rejectBtn) {
        rejectBtn = queryDeep(document, CMP_REJECT_BUTTONS, isButtonEnabled);
      }
      if (rejectBtn) {
        rejectBtn.click();
        clicked = true;
      }

      if (!clicked) {
        const buttons = queryAllDeep(searchRoot, 'button, a[role="button"], input[type="button"], input[type="submit"]');
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          if (matchesRejectLabel(b)) {
            b.click();
            clicked = true;
            break;
          }
        }
      }

      if (clicked) {
        if (foundBanner.dataset) foundBanner.dataset.deepblockRejected = '1';
        unlockScrollIfFrozenByModal(true);
        reportMetric('cookiePromptsRejected', 1);
      }
    }
  }

  let ytShieldActive = false;
  let ytShieldObserver = null;
  let domProtectionObserver = null;

  function removeYouTubeCosmeticStyle() {
    try {
      const ytEl = document.getElementById('deepblock-yt-cosmetic');
      if (ytEl) ytEl.remove();
    } catch (e) {}
  }

  let activeEntitlementSnapshot = null;

  function disableContentProtectionsOnExpiry() {
    ytShieldActive = false;
    try {
      if (ytShieldObserver && typeof ytShieldObserver.disconnect === 'function') {
        ytShieldObserver.disconnect();
        ytShieldObserver = null;
      }
      if (domProtectionObserver && typeof domProtectionObserver.disconnect === 'function') {
        domProtectionObserver.disconnect();
        domProtectionObserver = null;
      }
    } catch (e) {}
    removeUniversalAdCosmeticStyle();
    removeYouTubeCosmeticStyle();
    try {
      const customEl = document.getElementById('deepblock-custom-zapper');
      if (customEl) customEl.remove();
    } catch (e) {}
    syncStealthPausedSignal(true);
  }

  // 2. YouTube Ad-Pod Shield
  function initYouTubeAdShield() {
    if (!/(^|\.)youtube\.com$/i.test(location.hostname)) return;
    ytShieldActive = true;

    if (!document.getElementById('deepblock-yt-cosmetic')) {
      const style = document.createElement('style');
      style.id = 'deepblock-yt-cosmetic';
      style.textContent = `
        ytd-ad-slot-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-banner-promo-renderer,
        ytd-statement-banner-renderer,
        ytd-Display-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-compact-promoted-video-renderer,
        #masthead-ad,
        #player-ads,
        .ytp-ad-overlay-container,
        .ytp-ad-message-container,
        ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    let wasMutedBeforeAd = false;

    function neutralizeYouTubeVideoAd() {
      if (!ytShieldActive) return;
      if (activeEntitlementSnapshot && !hasActiveProEntitlement(activeEntitlementSnapshot)) {
        disableContentProtectionsOnExpiry();
        return;
      }
      const player = document.querySelector('#movie_player, .html5-video-player');
      if (!player) return;

      const isAdShowing =
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting');

      const video = player.querySelector('video.html5-main-video');

      if (isAdShowing && video) {
        if (!video.dataset.deepblockAdMuted) {
          wasMutedBeforeAd = video.muted;
          video.muted = true;
          video.dataset.deepblockAdMuted = '1';
          reportMetric('adsBlocked', 1);
        }

        if (Number.isFinite(video.duration) && video.duration > 0.5 && video.currentTime < video.duration - 0.1) {
          try {
            video.currentTime = video.duration;
          } catch (e) {
            video.playbackRate = 16;
          }
        } else {
          video.playbackRate = 16;
        }

        const skipSelectors = [
          '.ytp-skip-ad-button',
          '.ytp-ad-skip-button',
          '.ytp-ad-skip-button-modern',
          '.ytp-ad-skip-button-slot button',
          '.ytp-ad-overlay-close-button'
        ];
        for (const sel of skipSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
          }
        }
      } else if (video && video.dataset.deepblockAdMuted) {
        video.muted = wasMutedBeforeAd;
        video.playbackRate = 1;
        delete video.dataset.deepblockAdMuted;
      }
    }

    neutralizeYouTubeVideoAd();
    const throttledYtCheck = createThrottle(neutralizeYouTubeVideoAd, 120);
    if (ytShieldObserver && typeof ytShieldObserver.disconnect === 'function') {
      ytShieldObserver.disconnect();
    }
    ytShieldObserver = new MutationObserver(throttledYtCheck);
    ytShieldObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });
  }

  // 6. DeepStealth Layer 5: Active Anti-Adblock Wall Neutralizer & Bait Visual Cloaker
  const ANTI_ADBLOCK_WALL_SELECTORS = [
    '.fc-ab-root',
    '.fc-dialog-container',
    '[id*="admiral" i]',
    '[class*="admiral" i]',
    '#babasbmsgx',
    '[id*="blockadblock" i]',
    '[class*="adblock-modal" i]',
    '[class*="adblock-overlay" i]',
    '[id*="adblock-notice" i]',
    '[class*="adblocker-modal" i]',
    'iframe[src*="error-report.com"]',
    'iframe[src*="html-load.com"]',
    'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    'ytd-enforcement-message-view-model'
  ];

  const BAIT_SELECTORS = [
    '.adsbox',
    '.pub_300x250',
    '.pub_300x250m',
    '.pub_728x90',
    '.text-ad',
    '.textAd',
    '.text_ad',
    '.text_ads',
    '.text-ads',
    '.text-ad-links',
    '#ad-tester',
    '#ad_tester',
    '#ad-unit',
    '#taboola-stream-1',
    '.jag8CityBio212023'
  ];

  function processAntiAdblockStealth() {
    const baits = document.querySelectorAll(BAIT_SELECTORS.join(','));
    baits.forEach((bait) => {
      if (!bait.dataset.deepstealthCloaked) {
        bait.dataset.deepstealthCloaked = '1';
        Object.assign(bait.style, {
          opacity: '0.001',
          pointerEvents: 'none',
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '300px',
          height: '250px',
          display: 'block',
          visibility: 'visible'
        });
      }
    });

    let wallRemoved = false;
    for (const sel of ANTI_ADBLOCK_WALL_SELECTORS) {
      try {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach((node) => {
          node.remove();
          wallRemoved = true;
        });
      } catch (e) {}
    }

    if (wallRemoved) {
      unlockScrollIfFrozenByModal();
      if (document.body) {
        document.body.style.setProperty('pointer-events', 'auto', 'important');
      }
      reportMetric('antiAdblockBypassed', 1);
    }

    // Actively scrub disguised in-grid video ad tiles (.vid-ad) and sticky bars on erothots & streaming grids,
    // then dispatch resize so Isotope/Masonry grids reflow cleanly with zero empty gaps.
    try {
      let removedGridAd = false;
      const gridAdNodes = document.querySelectorAll('a.video.vid-ad, .videos .vid-ad, .vid-ad');
      gridAdNodes.forEach((node) => {
        node.remove();
        removedGridAd = true;
      });
      const promoNodes = document.querySelectorAll(
        'a.top-bar-xx-style, .magic-sites, .list-btn.bnr, .bnr, .bnrs, a.bartab, .video-player .caption.bottom-right, .odw, [data-odw], .ourdreamai-native, .eroslider, a.no-taps[href*="camsoda"], img.camsoda-logo, #vast-ad-block, #vast-ad-block-button, .invideoBlock, .fluid_html_on_pause_container, .fluid_html_on_pause:not(.fluid_initial_play_button_container), [id*="_ad_html_on_pause"], .block-advert, .m-l-ntvb, .card-promotion, .card-deck-promotion, a.add_href_jsclick, .ib-300-250, #banner_iframe, #ag-agegate, #ag-cookiebar, .block-video#block-chat > .table, .block-video > .table:has(.opt), .block-video .opt, .bottom-adv, .pop-adv, .pop-premium, .index-link, .exclusive-link-href, .index-link-href, iframe[src*="gsrv.dev"], iframe[src*="aaaconnect.info"], iframe[src*="awmdelivery.com"], iframe.ipp, iframe[src*="ajscdn.com"], iframe[src*="inppcdn.com"], iframe[src*="tapioni.com"], iframe[src*="boannre.com"], #outstream, #outstream_pb, .outstream-wrapper, .outstream, .upkeep > .promotion, #spot_video_ntv_a, #spot_video_ntv_b, #spot_video_ntv_c, #spot_video_underplayer_livecams, #spot_video_livecams, .stem:has(#spot_video_livecams), .spot-live-cam, .ID_live_cam_wrapper, .ID-viptube-before-ad-video, .download_adv_text_video, .button-under-video:has(.download_adv_text_video), #rvt-element, [id^="rvt-p2p"], a[data-model-item], a[href*="/linkout/livecams/"], li:has(> div.item2 > a[href*="/linkout/livecams/"]), div:has(> a[href*="ey43.com"]), a[href*="ey43.com"], div[style*="z-index: 2147483646"][style*="position: absolute"], [data-cl-overlay], #c_window_xEucqIjg, #alink_overlay_EPXdyaUf, div[style*="z-index: 300000"][style*="position: fixed"]'
      );
      promoNodes.forEach((node) => {
        const parent = node.parentElement;
        if (
          node.classList &&
          node.classList.contains('top-bar-xx-style') &&
          parent &&
          parent.tagName === 'DIV' &&
          parent.children.length === 1
        ) {
          parent.remove();
        } else {
          node.remove();
        }
      });
      if (/(^|\.)porntrex\.com$/i.test(location.hostname)) {
        const overlayEl = document.getElementById('overlay');
        if (overlayEl) overlayEl.remove();
        document.querySelectorAll('div[style*="border:1px solid"]').forEach((box) => {
          if (box.querySelector('iframe[src*="gsrv.dev"]') || box.children.length === 0 || !box.querySelector('video, img, a')) {
            box.remove();
          }
        });
      }
      if (removedGridAd) {
        window.dispatchEvent(new Event('resize'));
        reportMetric('adsBlocked', gridAdNodes.length);
      }
    } catch (e) {}
  }

  let stealthBypassReported = false;
  window.addEventListener('message', (event) => {
    if (stealthBypassReported || event.source !== window) return;
    if (event.data && event.data.source === 'sweepr-deepstealth' && event.data.type === 'STEALTH_BYPASS_TRIGGERED') {
      stealthBypassReported = true;
      reportMetric('antiAdblockBypassed', 1);
    }
  });

  const UNIVERSAL_AD_COSMETIC_CSS = `
    /* YouTube Sponsored & Feed Ad Slots */
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer,
    ytd-statement-banner-renderer,
    ytd-display-ad-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-sparkles-text-search-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-video-masthead-ad-v3-renderer,
    ytd-primetime-promo-renderer,
    ytd-action-companion-ad-renderer,
    ytd-image-companion-ad-renderer,
    #masthead-ad,
    #player-ads,
    #offer-module,
    .ytp-ad-overlay-container,
    .ytp-ad-message-container,
    .ytp-ad-player-overlay-layout,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    /* Search Engine Sponsored Ads */
    #tads,
    #tadsb,
    #bottomads,
    [data-text-ad],
    div[aria-label="Ads"],
    .commercial-unit-desktop-top,
    .commercial-unit-desktop-rhs,
    .uEierd,
    li.b_ad,
    .b_adLastChild,
    /* Universal Display, Programmatic, Taboola & Outbrain Ads */
    ins.adsbygoogle,
    [id^="div-gpt-ad"],
    [id^="google_ads_iframe"],
    iframe[id^="google_ads_"],
    iframe[src*="doubleclick.net"],
    iframe[src*="googlesyndication.com"],
    iframe[src*="adnxs.com"],
    iframe[src*="amazon-adsystem.com"],
    iframe[src*="rubiconproject.com"],
    iframe[src*="criteo."],
    [data-google-query-id],
    [data-ad-client],
    [data-ad-slot],
    [id^="taboola-"]:not(#taboola-stream-1),
    .trc_rbox_container,
    body .trc_related_container,
    .OUTBRAIN,
    [data-widget-id^="outbrain"],
    [id*="ScriptRoot"],
    .mgbox,
    amp-ad,
    amp-embed[type="taboola"],
    /* Yahoo Sports / News / Finance SDA Ad Slots */
    .sda-ssr-placeholder,
    [data-ad-config],
    [id^="sda-"],
    .sda-ad,
    /* Streaming & Tube Ad Containers (Eporner, ExoClick, TrafficStars, TrafficJunky, JuicyAds, ClickAdu) */
    #movieplayer-box-adv,
    #movieplayer-box-adv-iframe,
    #movieplayer-box-adv-NTVA,
    #movieplayer-box-adv-NTVB,
    #movieplayer-box-adv-NTVC,
    .movieplayer-box-adv-box,
    #adstripe,
    #deskadmiddle,
    #ifdeskadmiddle,
    #admobiletop,
    #admobiletopinside,
    #admobilemiddle,
    #ifadmiddle,
    #footadframe,
    #admobilefoot,
    #admobilefootinside,
    #adPlayerIfr,
    #adPlayerIfrMob,
    #videotextbanner,
    #pbwuvpad,
    #adnative-1x1-iframe,
    #EPimLayerOuter,
    #admobileoutstream,
    #ifadoutstream,
    .dotcontainer,
    .adstext,
    .adsinfo,
    [id^="epad-"],
    [data-ep-adzone],
    [data-ts-spot],
    [data-cl-spot],
    [class^="__clb-"],
    #divExoLayerWrapper,
    ins[class^="eas6a97888e"],
    ins[data-zoneid],
    .player-click-layer,
    a.player-click-layer,
    .new-videoplayer-overlay,
    .video-extra-overlay,
    .vast-overlay,
    .video-end-overlay,
    #invideo_wrapper,
    #yps_player_vpaid,
    .ads-block-rightside,
    .wgt-container,
    .fh-line,
    .tilebar-line,
    [data-ph],
    a.blinker,
    li.media-item.no-popup,
    a[href^="/link/out/"],
    a[href*="pornoxo.com/link/out/"],
    a[href*="/zv3/b"],
    a[href*="/zv3/url"],
    a[href*="/zv3/cam"],
    div[class*="advi"],
    body > .ppexcll,
    .extlinkn,
    a[aria-label="AI TAB"],
    .sugggestio,
    [class^="sugggest"],
    .videos-tube-friends,
    .video-videos-slider,
    .btn-hardlink,
    .direct-abnner,
    .under-channel,
    [class*="_ab-io"],
    #und_ban,
    #ntv_a,
    #ntv_b,
    #ntv_a,
    #ntv_b,
    #ntv_c,
    .upkeep > .promotion,
    #spot_video_ntv_a,
    #spot_video_ntv_b,
    #spot_video_ntv_c,
    .stem:has(#spot_video_livecams),
    .ID_live_cam_wrapper,
    .ID-viptube-before-ad-video,
    .download_adv_text_video,
    .button-under-video:has(.download_adv_text_video),
    a[data-model-item],
    a[href*="/linkout/livecams/"],
    li:has(> div.item2 > a[href*="/linkout/livecams/"]),
    iframe[src*="/player_right_ntv_"],
    iframe[src*="/adx_iframe_"],
    #iv_1,
    .__nat_item,
    .__bai-overlay,
    #int_hsSJlay,
    #int_hsSJ,
    .fiioed,
    .pplayer div.jw-title-secondary,
    .drt-spot-box,
    .drt-spot-visible,
    .drt-spot-bottom-box,
    .drt-sponsor-block,
    #spot_video_inside_player,
    [data-spot],
    .player-adx-block,
    .player-sponsor-block,
    #adx_ad,
    #bottom_banner_block,
    #top_banner_block,
    #spot_video_underplayer_livecams,
    #spot_video_livecams,
    .spot-live-cam,
    #rvt-element,
    [id^="rvt-p2p"],
    [class^="rvt-p2p"],
    [class^="rel_right_"],
    .aside:has(> [class^="rel_right_"]),
    .ivn-k3d8p1,
    [class^="ivn-"],
    app-invideo-native-adv,
    .invideo-native-adv,
    .fh-iafjhn,
    .faphouse-promo-btn,
    .player-adv-link,
    .player__promo,
    .player-detail__yhy8t5,
    .outstream-adv,
    app-outstream-adv,
    app-native-item,
    .iframe-a[data-title="Advertisement"],
    [class*="-asg-vast-overlay"],
    .asg-container,
    .asg-vpaid-overlay,
    [id^="ts_ad_native_"],
    .under_video_ad,
    .under_video_ss,
    .avd-title,
    .avd-item,
    .video-page-aside:has(.avd-item),
    #ad_5454652,
    #ad_5454654,
    #im_video,
    #im_video_content,
    #vl_1,
    #vl_2,
    [id^="vl_"],
    [id^="wrapper_vl_"],
    [id^="click_vl_"],
    [id^="btn_close_videoslider_"],
    [id^="close_videoslider_"],
    [id^="lbl_advertise_slider_"],
    .sldr_right_right,
    .exc-pp,
    .lbl_advertise_slider,
    video[src*="sacdnssedge.com"],
    #fpa_layer,
    .invideo_banner,
    [id^="F8-"],
    [id^="F8m-"],
    [data-spot^="F8-"],
    a[href*="/link/cams/"],
    iframe[src*="applzr.com"],
    iframe[src*="goadserver.com"],
    iframe[src*="/agent.php?spot="],
    iframe[src*="nvdst.com/adx_"],
    iframe[src*="rvmessage.online"],
    iframe[src*="tophqcam.com"],
    iframe[src*="/zv3/"],
    iframe[src*="/link/out/"],
    iframe[src*="tsyndicate.com"],
    iframe[src*="contentsserved.com"],
    iframe[src*="exosrv.com"],
    iframe[src*="exoclick.com"],
    iframe[src*="realsrv.com"],
    iframe[src*="magsrv.com"],
    iframe[src*="pemsrv.com"],
    iframe[src*="trafficjunky."],
    iframe[src*="juicyads.com"],
    iframe[src*="jads.co"],
    /* Erothots & Plyr / OurDream / DreamServe / SmartFlora / RealXXX / TrafficHunt Ad Slots */
    a.top-bar-xx-style,
    div:has(> a.top-bar-xx-style),
    .magic-sites,
    .list-btn.bnr,
    .bnr,
    .bnrs,
    a.bartab,
    .video-player .caption.bottom-right,
    a.video.vid-ad,
    .vid-ad,
    .odw,
    [data-odw],
    .ourdreamai-native,
    .section.fh-videos:has(.odw),
    .eroslider,
    img.camsoda-logo,
    a.no-taps[href*="camsoda"],
    a[href*="smartfloralab.com"],
    a[href*="adtng.com"],
    a[href*="traffichunt.com"],
    a[href*="realxxx.com"],
    .section.text-center:has(iframe[src*="adtng.com"]),
    iframe[src*="adtng.com"],
    iframe[src*="dreamserve.dev"],
    iframe[src*="velvetloom.net"],
    iframe[src*="smartfloralab.com"],
    iframe[src*="realxxx.com"],
    iframe[src*="traffichunt.com"],
    /* Pornoeggs / FluidPlayer Pause Banner / VAST Corner Slider / StatServ Ad Slots */
    #vast-ad-block,
    #vast-ad-block-button,
    .invideoBlock,
    .invideoBlockLabel,
    .fluid_html_on_pause_container,
    .fluid_html_on_pause:not(.fluid_initial_play_button_container),
    [id*="_ad_html_on_pause"],
    .block-advert,
    .col-12.col-lg-auto:has(.block-advert),
    .m-l-ntvb,
    .card-promotion,
    .card-deck-promotion,
    a.add_href_jsclick,
    li:has(> a.add_href_jsclick),
    .ib-300-250,
    #banner_iframe,
    #ag-agegate,
    #ag-cookiebar,
    a[href*="/away/pop"],
    a[href*="/away/tab"],
    li:has(> a[href*="/away/tab"]),
    iframe[src*="statserv.net"],
    iframe[src*="/ads/prebid-ads"],
    /* Porntrex & KVS GoAdServer (gsrv.dev / aaaconnect.info / awmdelivery.com) Ad Slots */
    .block-video#block-chat > .table,
    .block-video > .table:has(.opt),
    .block-video > .table:has(iframe[src*="gsrv.dev"]),
    .block-video .opt,
    .bottom-adv,
    .pop-adv,
    .pop-premium,
    .index-link,
    .exclusive-link-href,
    .index-link-href,
    div[style*="border:1px solid #ccc"][style*="text-align:center"],
    div[style*="border:1px solid #ccc"]:has(iframe[src*="gsrv.dev"]),
    div:has(> iframe[src*="gsrv.dev"]),
    div:has(> div > iframe[src*="gsrv.dev"]),
    iframe[src*="gsrv.dev"],
    iframe[src*="aaaconnect.info"],
    iframe[src*="awmdelivery.com"],
    a[href*="rmzsglng.com"],
    li:has(> a[href*="rmzsglng.com"]),
    a[href*="aivanta76.com"],
    li:has(> a[href*="aivanta76.com"]),
    a[href*="gotpd.me"],
    li:has(> a[href*="gotpd.me"]),
    div:has(> a[href*="ey43.com"]),
    a[href*="ey43.com"],
    div[style*="z-index: 2147483646"][style*="position: absolute"],
    [data-cl-overlay],
    #c_window_xEucqIjg,
    #alink_overlay_EPXdyaUf,
    iframe.ipp,
    iframe[src*="ajscdn.com"],
    iframe[src*="inppcdn.com"],
    iframe[src*="tapioni.com"],
    iframe[src*="boannre.com"],
    #outstream,
    #outstream_pb,
    .outstream-wrapper,
    .outstream,
    div[style*="z-index: 300000"][style*="position: fixed"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      pointer-events: none !important;
    }
    .block-video .video-holder {
      width: 100% !important;
      float: none !important;
    }
    /* Ensure anti-adblock bait probes in <head> (#ad-unit, #taboola-stream-1) always report visible geometry */
    head > ins,
    head > div,
    #ad-unit,
    #taboola-stream-1,
    .jag8CityBio212023 {
      display: inline-block !important;
      visibility: visible !important;
      height: 250px !important;
      min-height: 250px !important;
      width: 300px !important;
      opacity: 1 !important;
    }
  `;

  function injectUniversalAdCosmeticStyle() {
    try {
      if (document.getElementById('deepblock-universal-cosmetic')) return;
      const style = document.createElement('style');
      style.id = 'deepblock-universal-cosmetic';
      style.textContent = UNIVERSAL_AD_COSMETIC_CSS;
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
  }

  function removeUniversalAdCosmeticStyle() {
    try {
      const el = document.getElementById('deepblock-universal-cosmetic');
      if (el) el.remove();
      const otaEl = document.getElementById('deepblock-ota-cosmetic');
      if (otaEl) otaEl.remove();
    } catch (e) {}
  }

  function injectIsolatedOtaCosmeticStyles(selectors) {
    try {
      if (!Array.isArray(selectors) || selectors.length === 0) return;
      let style = document.getElementById('deepblock-ota-cosmetic');
      if (!style) {
        style = document.createElement('style');
        style.id = 'deepblock-ota-cosmetic';
        (document.head || document.documentElement).appendChild(style);
      }
      // Each selector is written as an independent CSS rule block so CSSOM error recovery
      // isolates each rule and can never invalidate UNIVERSAL_AD_COSMETIC_CSS or peer rules.
      const rulesCss = selectors
        .filter((s) => {
          if (typeof s !== 'string') return false;
          const clean = s.trim();
          return (
            clean.length > 2 &&
            clean.length <= 250 &&
            /^[a-zA-Z0-9#._:() >[\]="'*~$^|,/-]+$/.test(clean) &&
            !/[{};\\@]/.test(clean) &&
            !/url\(/i.test(clean)
          );
        })
        .map(
          (s) =>
            `${s.trim()} { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; pointer-events: none !important; }`
        )
        .join('\n');
      style.textContent = rulesCss;
    } catch (e) {}
  }

  // Inject cosmetic ad shield immediately at document_start to prevent any flash of ad slots
  injectUniversalAdCosmeticStyle();

  function syncStealthPausedSignal(paused) {
    const isPaused = Boolean(paused);
    try {
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset.dsPaused = isPaused ? '1' : '0';
      }
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('_ds_cfg', { detail: { p: isPaused } }));
    } catch (e) {}
  }

  function hasActiveProEntitlement(res) {
    if (!res || !res.proActive) return false;
    const subStatus = String(res.subscriptionStatus || '').toLowerCase();
    const plan = String(res.plan || '').toLowerCase();
    const rawTrialExp = res.trialExpiresAt || (subStatus === 'trialing' ? res.licenseExpiresAt : 0);
    const trialExpMs = typeof rawTrialExp === 'number'
      ? rawTrialExp
      : (typeof rawTrialExp === 'string' && rawTrialExp ? Date.parse(rawTrialExp) : 0);
    const isTrialExpired =
      subStatus === 'trial_expired' ||
      subStatus === 'expired' ||
      subStatus === 'canceled' ||
      subStatus === 'inactive' ||
      ((subStatus === 'trialing' || plan === 'trial_7d') && Number.isFinite(trialExpMs) && trialExpMs > 0 && Date.now() >= trialExpMs);
    if (isTrialExpired) return false;
    const hasValidCredential = Boolean(
      res.licenseKey || (subStatus === 'trialing' && Number.isFinite(trialExpMs) && trialExpMs > Date.now())
    );
    return hasValidCredential;
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes) return;
      const droppedPro = changes.proActive && changes.proActive.newValue === false;
      const trialExpiredStatus =
        changes.subscriptionStatus &&
        ['trial_expired', 'expired', 'canceled', 'inactive'].includes(String(changes.subscriptionStatus.newValue || '').toLowerCase());
      if (droppedPro || trialExpiredStatus) {
        disableContentProtectionsOnExpiry();
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function') {
    chrome.storage.local.get(
      [
        'proActive',
        'licenseKey',
        'subscriptionStatus',
        'plan',
        'trialExpiresAt',
        'licenseExpiresAt',
        'pausedSites',
        'settings',
        'customHiddenSelectors',
        'remoteFeatureFlags',
        'extraCmpSelectors',
        'extraAntiAdblockSelectors',
        'extraCosmeticSelectors'
      ],
      (res) => {
        const pausedSites = Array.isArray(res && res.pausedSites) ? res.pausedSites : [];
        const settings = (res && res.settings) || {};

        function countAndReportPageAds(metricName = 'adsBlocked') {
          try {
            const adSlotSelector = [
              'ins.adsbygoogle',
              '[id^="google_ads_iframe"]',
              '[data-ad-slot]',
              '[data-ad-client]',
              '[data-google-query-id]',
              '.adsbox',
              '.ad-banner',
              '.ad-slot',
              '.advertisement',
              'ytd-ad-slot-renderer',
              'ytd-in-feed-ad-layout-renderer',
              'iframe[src*="doubleclick.net"]',
              'iframe[src*="googlesyndication.com"]',
              '[id*="taboola"]',
              '[id*="outbrain"]'
            ].join(',');
            const nodes = document.querySelectorAll(adSlotSelector);
            let newlyCounted = 0;
            for (const el of nodes) {
              if (!el.dataset || el.dataset.deepblockAdCounted === '1') continue;
              el.dataset.deepblockAdCounted = '1';
              newlyCounted++;
            }
            if (newlyCounted > 0) {
              reportMetric(metricName, Math.min(newlyCounted, 25));
            }
          } catch (e) {}
        }

        const extraCmpSelectors = Array.isArray(res && res.extraCmpSelectors) ? res.extraCmpSelectors : [];
        activeEntitlementSnapshot = res;
        const isPaidEntitled = hasActiveProEntitlement(res);
        const isPausedSite = Boolean(currentHost && pausedSites.includes(currentHost));
        if (!isPaidEntitled || isPausedSite) {
          removeUniversalAdCosmeticStyle();
          removeYouTubeCosmeticStyle();
          syncStealthPausedSignal(true);
          if (!isPaidEntitled && !isPausedSite) {
            const runFreeDiagnosticPass = () => {
              countAndReportPageAds('adsSpotted');
              processCookieBanners(false, extraCmpSelectors);
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', runFreeDiagnosticPass, { once: true });
            } else {
              runFreeDiagnosticPass();
            }
          }
          return;
        }

        const adBlockingEnabled = settings.adBlocking !== false;
        syncStealthPausedSignal(!adBlockingEnabled);

        if (adBlockingEnabled) {
          if (/(^|\.)sweeprdeepblock\.com$/i.test(currentHost)) {
            try {
              document.documentElement.dataset.sweeprExtensionActive = '1';
            } catch (e) {}
          }
          injectUniversalAdCosmeticStyle();
          if (Array.isArray(res && res.extraCosmeticSelectors)) {
            injectIsolatedOtaCosmeticStyles(res.extraCosmeticSelectors);
          }
        } else {
          removeUniversalAdCosmeticStyle();
        }

        const flags = (res && res.remoteFeatureFlags) || {};
        const extraAntiAdblockSelectors = Array.isArray(res && res.extraAntiAdblockSelectors)
          ? res.extraAntiAdblockSelectors
          : [];
        for (const extraSel of extraAntiAdblockSelectors) {
          if (typeof extraSel === 'string' && extraSel && !ANTI_ADBLOCK_WALL_SELECTORS.includes(extraSel)) {
            ANTI_ADBLOCK_WALL_SELECTORS.push(extraSel);
          }
        }

        function runDomProtectionPass() {
          if (!hasActiveProEntitlement(activeEntitlementSnapshot || res)) {
            disableContentProtectionsOnExpiry();
            return;
          }
          if (adBlockingEnabled) {
            injectUniversalAdCosmeticStyle();
            countAndReportPageAds('adsBlocked');
            if (Array.isArray(res && res.extraCosmeticSelectors)) {
              injectIsolatedOtaCosmeticStyles(res.extraCosmeticSelectors);
            }
            if (flags.youtubeAdShield !== false) {
              initYouTubeAdShield();
            }
            if (flags.antiAdblockStealth !== false) {
              processAntiAdblockStealth();
            }
          }
          if (res && res.customHiddenSelectors) {
            applySavedCustomHiddenSelectors(res.customHiddenSelectors);
          }
          if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
            processCookieBanners(true, extraCmpSelectors);
          }
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', runDomProtectionPass, { once: true });
        } else {
          runDomProtectionPass();
        }

        const throttledDomPass = createThrottle(() => {
          if (!hasActiveProEntitlement(activeEntitlementSnapshot || res)) {
            disableContentProtectionsOnExpiry();
            return;
          }
          if (adBlockingEnabled) {
            countAndReportPageAds('adsBlocked');
            if (flags.antiAdblockStealth !== false) {
              processAntiAdblockStealth();
            }
          }
          if (settings.cookieAutoClose !== false && flags.cookieAutoClose !== false) {
            processCookieBanners(true, extraCmpSelectors);
          }
        }, 200);
        domProtectionObserver = new MutationObserver(throttledDomPass);
        domProtectionObserver.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
          if (domProtectionObserver) domProtectionObserver.disconnect();
        }, 20000);
      }
    );
  }
})();
