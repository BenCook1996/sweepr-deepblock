// SWEEPR Deepblock — Zero-Dependency HTTP Server, Live Stripe Subscriptions & Multi-SKU Licensing API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { SweeprCrmClient } = require('./sweepr-client.js');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch {}
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const WEBSITE_DIR = path.join(__dirname, 'website');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8788').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();
const CRM_ADMIN_PASSWORD = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const SESSION_SECRET =
  (process.env.SESSION_SECRET || '').trim() ||
  (SWEEPR_CRM_API_KEY || CRM_ADMIN_PASSWORD
    ? crypto.createHmac('sha256', 'sweepr-deepblock-session').update(SWEEPR_CRM_API_KEY || CRM_ADMIN_PASSWORD).digest('hex')
    : crypto.randomBytes(32).toString('hex'));
const ALLOW_DEV_MOCK_CHECKOUT = process.env.ALLOW_DEV_MOCK_CHECKOUT === '1';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_LOCAL_ACCOUNTS = 10000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

function canonicalizeEmailForDiscount(rawEmail) {
  const clean = String(rawEmail || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return clean;
  let local = clean.slice(0, atIdx).replace(/\+.*$/, '');
  const domain = clean.slice(atIdx + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain === 'googlemail.com' ? 'gmail.com' : domain}`;
}

function maskEmail(rawEmail) {
  const clean = String(rawEmail || '').trim();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return '';
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(4, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

const ALLOWED_EXTENSION_IDS = new Set(
  String(process.env.ALLOWED_EXTENSION_IDS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function isAllowedExtensionOrigin(origin) {
  const clean = String(origin || '').trim().replace(/\/+$/, '').toLowerCase();
  if (/^chrome-extension:\/\/([a-p]{32})$/.test(clean)) {
    const extId = clean.slice('chrome-extension://'.length);
    return ALLOWED_EXTENSION_IDS.size === 0 || ALLOWED_EXTENSION_IDS.has(extId);
  }
  if (/^moz-extension:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(clean)) {
    const extId = clean.slice('moz-extension://'.length);
    return ALLOWED_EXTENSION_IDS.size === 0 || ALLOWED_EXTENSION_IDS.has(extId);
  }
  return false;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTrustedOrigin(req) {
  const isDev = process.env.NODE_ENV !== 'production';
  const allowedOrigins = new Set([
    PUBLIC_URL,
    'https://sweeprdeepblock.com',
    'https://www.sweeprdeepblock.com',
    ...(isDev ? [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`] : [])
  ]);
  const hostHeader = String(req?.headers?.host || '').trim();
  if (isDev && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader)) {
    allowedOrigins.add(`http://${hostHeader}`);
    allowedOrigins.add(`http://localhost:${hostHeader.split(':')[1] || PORT}`);
    allowedOrigins.add(`http://127.0.0.1:${hostHeader.split(':')[1] || PORT}`);
  }
  const rawOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (rawOrigin && allowedOrigins.has(rawOrigin)) return rawOrigin;
  return PUBLIC_URL;
}

const TRUST_PROXY =
  process.env.TRUST_PROXY === '1' ||
  Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RENDER);
const TRUST_CLOUDFLARE = process.env.TRUST_CLOUDFLARE !== '0' && (process.env.TRUST_CLOUDFLARE === '1' || TRUST_PROXY);

function getClientIp(req) {
  if (TRUST_PROXY) {
    if (TRUST_CLOUDFLARE && (req.headers['cf-ray'] || process.env.TRUST_CLOUDFLARE === '1')) {
      const cfIp = String(req.headers['cf-connecting-ip'] || '').trim();
      if (cfIp) return cfIp;
    }
    const xff = String(req.headers['x-forwarded-for'] || '').trim();
    if (xff) {
      const hops = xff
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const rightmost = hops[hops.length - 1];
      if (rightmost) return rightmost;
    }
  }
  return String(req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
}

const rateLimitBuckets = new Map();
function checkRateLimit(req, bucketName, maxRequests = 30, windowMs = 60000, scopeByIp = true) {
  const ip = getClientIp(req);
  const isTargetScoped =
    !scopeByIp ||
    bucketName.startsWith('portal_target:') ||
    bucketName.startsWith('verify_otp_email:') ||
    bucketName.startsWith('portal_login_email:');
  const key = isTargetScoped ? bucketName : `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitBuckets.size > 10000) {
      for (const [k, v] of rateLimitBuckets.entries()) {
        if (now > v.resetAt) rateLimitBuckets.delete(k);
      }
      if (rateLimitBuckets.size > 10000) {
        let excess = rateLimitBuckets.size - 10000;
        for (const [k, v] of rateLimitBuckets.entries()) {
          if (excess <= 0) break;
          if (v.count < maxRequests) {
            rateLimitBuckets.delete(k);
            excess -= 1;
          }
        }
      }
    }
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

function resolveStripeSecretKey() {
  const envKey = (process.env.STRIPE_SECRET_KEY || process.env.DEEPBLOCK_STRIPE_SECRET_KEY || '').trim();
  if (/^[sr]k_(live|test)_/.test(envKey)) {
    return envKey;
  }
  return '';
}

const STRIPE_SECRET_KEY = resolveStripeSecretKey();
const IS_LIVE_STRIPE = /^([sr]k_live_)/.test(STRIPE_SECRET_KEY);

function resolveStripeWebhookSecret() {
  const envWh = (process.env.STRIPE_WEBHOOK_SECRET || process.env.DEEPBLOCK_STRIPE_WEBHOOK_SECRET || '').trim();
  if (/^whsec_/.test(envWh)) return envWh;
  return '';
}

const STRIPE_WEBHOOK_SECRET = resolveStripeWebhookSecret();
const STRIPE_PUBLISHABLE_KEY = (
  process.env.STRIPE_PUBLISHABLE_KEY ||
  process.env.DEEPBLOCK_STRIPE_PUBLISHABLE_KEY ||
  ''
).trim();

const STRIPE_PRODUCT_MAIN = (process.env.STRIPE_PRODUCT_MAIN || 'prod_VTi9pQfsnRD8Uo').trim();
const STRIPE_PRODUCT_RAM_TAMER = (process.env.STRIPE_PRODUCT_RAM_TAMER || 'prod_VTi9kxjGjyWMIj').trim();
const STRIPE_PRICE_ANNUAL = (process.env.STRIPE_PRICE_ANNUAL || 'price_1USkjM12f60YC3BgrVwMQXa6').trim();
const STRIPE_PRICE_SIX_MONTH = (process.env.STRIPE_PRICE_SIX_MONTH || 'price_1USkjM12f60YC3BgMe9vezeT').trim();
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY || 'price_1USkjM12f60YC3BgGgzH91v5').trim();
const STRIPE_COUPON = (process.env.STRIPE_COUPON || 'sweepr_intro_gbp_800').trim();

const BOT_UA_RE =
  /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|applebot|applebot-extended|duckduckbot|yandexbot|baiduspider|cohere-ai|facebookexternalhit|twitterbot|linkedinbot|meta-externalagent|meta-externalfetch|bytespider|amazonbot|diffbot|google-inspectiontool|deepseek-ai|mistralai|qwenbot|semrushbot|ahrefsbot|google-extended|vertex-ai|youbot|brave-web-crawler|kagi-crawler|xai|grok|exabot|petalbot|dotbot|rogerbot|blexbot|turnitinbot|ccbot|timpibot|seekr|feedfetcher-google|archive\.org_bot|screaming frog|siteaudit|chrome-lighthouse|lighthouse|pagespeed/i;

// ============================================================================
// Multi-Currency Geo-Pricing Engine (50% Annual Savings & .99 Charm Pricing)
// ============================================================================
const PRICING_BY_CURRENCY = {
  gbp: { currency: 'gbp', symbol: '£', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 2999, sixMonthAmount: 1999, monthlyAmount: 499, introMonthlyAmount: 199, ramTamerAnnualAmount: 1499, ramTamerSixMonthAmount: 999, ramTamerMonthlyAmount: 199 },
  usd: { currency: 'usd', symbol: '$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 3599, sixMonthAmount: 2399, monthlyAmount: 599, introMonthlyAmount: 199, ramTamerAnnualAmount: 1999, ramTamerSixMonthAmount: 1299, ramTamerMonthlyAmount: 299 },
  eur: { currency: 'eur', symbol: '€', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 3499, sixMonthAmount: 2299, monthlyAmount: 599, introMonthlyAmount: 199, ramTamerAnnualAmount: 1799, ramTamerSixMonthAmount: 1199, ramTamerMonthlyAmount: 249 },
  cad: { currency: 'cad', symbol: 'CA$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 4999, sixMonthAmount: 3299, monthlyAmount: 799, introMonthlyAmount: 299, ramTamerAnnualAmount: 2699, ramTamerSixMonthAmount: 1799, ramTamerMonthlyAmount: 349 },
  aud: { currency: 'aud', symbol: 'A$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 5499, sixMonthAmount: 3699, monthlyAmount: 899, introMonthlyAmount: 299, ramTamerAnnualAmount: 2999, ramTamerSixMonthAmount: 1999, ramTamerMonthlyAmount: 399 },
  nzd: { currency: 'nzd', symbol: 'NZ$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 5999, sixMonthAmount: 3999, monthlyAmount: 999, introMonthlyAmount: 299, ramTamerAnnualAmount: 3299, ramTamerSixMonthAmount: 2199, ramTamerMonthlyAmount: 449 },
  chf: { currency: 'chf', symbol: 'CHF ', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 3299, sixMonthAmount: 2199, monthlyAmount: 549, introMonthlyAmount: 199, ramTamerAnnualAmount: 1699, ramTamerSixMonthAmount: 1099, ramTamerMonthlyAmount: 249 },
  jpy: { currency: 'jpy', symbol: '¥', symbolPosition: 'prefix', zeroDecimal: true, annualAmount: 5480, sixMonthAmount: 3680, monthlyAmount: 880, introMonthlyAmount: 290, ramTamerAnnualAmount: 2999, ramTamerSixMonthAmount: 1999, ramTamerMonthlyAmount: 399 }
};

const COUNTRY_TO_CURRENCY = {
  GB: 'gbp', UK: 'gbp', IM: 'gbp', JE: 'gbp', GG: 'gbp',
  US: 'usd', PR: 'usd', GU: 'usd', VI: 'usd',
  CA: 'cad', AU: 'aud', NZ: 'nzd', CH: 'chf', LI: 'chf', JP: 'jpy',
  DE: 'eur', FR: 'eur', ES: 'eur', IT: 'eur', NL: 'eur', BE: 'eur', AT: 'eur', IE: 'eur', PT: 'eur', FI: 'eur', GR: 'eur', LU: 'eur'
};

const COUNTRY_TO_LANG = {
  DE: 'de', AT: 'de', CH: 'de', FR: 'fr', BE: 'fr', ES: 'es', MX: 'es', IT: 'it', PT: 'pt', BR: 'pt', NL: 'nl', JP: 'ja'
};

function countryToFlag(countryCode) {
  const cc = (countryCode || 'GB').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🇬🇧';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function formatAmount(amountMinor, cfg) {
  const numStr = cfg.zeroDecimal
    ? Math.round(amountMinor).toLocaleString('en-US')
    : (amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cfg.symbolPosition === 'suffix' ? `${numStr}${cfg.symbol}` : `${cfg.symbol}${numStr}`;
}

function buildLocalizedPricing(countryCode = 'GB', overrideCurrency) {
  const cc = (countryCode || 'GB').toUpperCase();
  const currKey = (overrideCurrency || COUNTRY_TO_CURRENCY[cc] || 'gbp').toLowerCase();
  const cfg = PRICING_BY_CURRENCY[currKey] || PRICING_BY_CURRENCY.gbp;

  const divisor = cfg.zeroDecimal ? 1 : 100;
  const annualMonthlyEq = Math.round(cfg.annualAmount / 12);
  const sixMonthMonthlyEq = Math.round(cfg.sixMonthAmount / 6);

  const fullYearAtMonthly = cfg.monthlyAmount * 12;
  const annualSavingsAmount = Math.max(0, fullYearAtMonthly - cfg.annualAmount);
  const sixMonthsAtMonthly = cfg.monthlyAmount * 6;
  const sixMonthSavingsAmount = Math.max(0, sixMonthsAtMonthly - cfg.sixMonthAmount);
  const introSavingsAmount = Math.max(0, cfg.monthlyAmount - cfg.introMonthlyAmount);

  const ramAnnualMonthlyEq = cfg.zeroDecimal
    ? Math.round(cfg.ramTamerAnnualAmount / 12)
    : Math.floor(cfg.ramTamerAnnualAmount / 12);
  const ramSixMonthMonthlyEq = cfg.zeroDecimal
    ? Math.round(cfg.ramTamerSixMonthAmount / 6)
    : Math.floor(cfg.ramTamerSixMonthAmount / 6);

  const suiteAnnualAmount =
    cfg.currency === 'gbp'
      ? 8999
      : cfg.currency === 'usd'
      ? 10999
      : cfg.currency === 'eur'
      ? 9999
      : Math.round(cfg.annualAmount * 1.5);
  const suiteStandaloneAnchorAmount =
    cfg.currency === 'gbp'
      ? 16497
      : cfg.currency === 'usd'
      ? 19997
      : cfg.currency === 'eur'
      ? 18497
      : Math.round(suiteAnnualAmount * 1.83);
  const suiteAnnualMonthlyEq = cfg.zeroDecimal
    ? Math.round(suiteAnnualAmount / 12)
    : Math.floor(suiteAnnualAmount / 12);

  return {
    country: cc,
    countryFlag: countryToFlag(cc),
    language: COUNTRY_TO_LANG[cc] || 'en',
    currency: cfg.currency,
    currencyCode: cfg.currency.toUpperCase(),
    symbol: cfg.symbol,
    symbolPosition: cfg.symbolPosition,
    zeroDecimal: cfg.zeroDecimal,
    divisor,
    annualAmount: cfg.annualAmount,
    sixMonthAmount: cfg.sixMonthAmount,
    monthlyAmount: cfg.monthlyAmount,
    introMonthlyAmount: cfg.introMonthlyAmount,
    suiteAnnualAmount,
    suiteStandaloneAnchorAmount,
    suiteAnnualMonthlyEqAmount: suiteAnnualMonthlyEq,
    suiteSavingsPercent: 45,
    suiteAnnualFormatted: formatAmount(suiteAnnualAmount, cfg),
    suiteStandaloneAnchorFormatted: formatAmount(suiteStandaloneAnchorAmount, cfg),
    suiteAnnualMonthlyEqFormatted: formatAmount(suiteAnnualMonthlyEq, cfg),
    annualMonthlyEqAmount: annualMonthlyEq,
    sixMonthMonthlyEqAmount: sixMonthMonthlyEq,
    annualSavingsAmount,
    sixMonthSavingsAmount,
    introSavingsAmount,
    annualSavingsPercent: 50,
    sixMonthSavingsPercent: 25,
    annualFormatted: formatAmount(cfg.annualAmount, cfg),
    sixMonthFormatted: formatAmount(cfg.sixMonthAmount, cfg),
    monthlyFormatted: formatAmount(cfg.monthlyAmount, cfg),
    introMonthlyFormatted: formatAmount(cfg.introMonthlyAmount, cfg),
    annualMonthlyEqFormatted: formatAmount(annualMonthlyEq, cfg),
    sixMonthMonthlyEqFormatted: formatAmount(sixMonthMonthlyEq, cfg),
    annualSavingsFormatted: formatAmount(annualSavingsAmount, cfg),
    sixMonthSavingsFormatted: formatAmount(sixMonthSavingsAmount, cfg),
    introSavingsFormatted: formatAmount(introSavingsAmount, cfg),
    fullYearAtMonthlyFormatted: formatAmount(fullYearAtMonthly, cfg),
    sixMonthsAtMonthlyFormatted: formatAmount(sixMonthsAtMonthly, cfg),
    ramTamerAnnualAmount: cfg.ramTamerAnnualAmount,
    ramTamerSixMonthAmount: cfg.ramTamerSixMonthAmount,
    ramTamerMonthlyAmount: cfg.ramTamerMonthlyAmount,
    ramTamerAnnualFormatted: formatAmount(cfg.ramTamerAnnualAmount, cfg),
    ramTamerSixMonthFormatted: formatAmount(cfg.ramTamerSixMonthAmount, cfg),
    ramTamerMonthlyFormatted: formatAmount(cfg.ramTamerMonthlyAmount, cfg),
    ramTamerAnnualMonthlyEqFormatted: formatAmount(ramAnnualMonthlyEq, cfg),
    ramTamerSixMonthMonthlyEqFormatted: formatAmount(ramSixMonthMonthlyEq, cfg)
  };
}

function resolvePricingForRequest(req, parsedUrl, body = {}) {
  const qCountry = parsedUrl?.searchParams?.get('country') || body?.country;
  const qCurrency = parsedUrl?.searchParams?.get('currency') || body?.currency;
  const headerCountry =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    'GB';
  const country = String(qCountry || headerCountry || 'GB').trim().toUpperCase();
  return buildLocalizedPricing(country.length === 2 ? country : 'GB', qCurrency);
}

// ============================================================================
// Direct Stripe REST API Helper (Pinned to 2024-06-20 for PaymentIntent expand)
// ============================================================================
function flattenStripeParams(obj, prefix = '', res = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const keyName = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          flattenStripeParams(item, `${keyName}[${idx}]`, res);
        } else if (item !== undefined && item !== null) {
          res.append(`${keyName}[${idx}]`, String(item));
        }
      });
    } else if (typeof v === 'object') {
      flattenStripeParams(v, keyName, res);
    } else {
      res.append(keyName, String(v));
    }
  }
  return res;
}

async function stripeRequest(method, endpoint, params, options = {}) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured on this server.');
  }
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  let url = `https://api.stripe.com/v1/${cleanEndpoint}`;
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-06-20',
    'User-Agent': 'SweeprDeepblock/1.0 (+https://sweeprdeepblock.com)'
  };
  if (method === 'POST') {
    headers['Idempotency-Key'] = options.idempotencyKey || crypto.randomUUID();
  }
  const timeoutMs = Number(options.timeoutMs) || 10000;
  const maxRetries = options.maxRetries !== undefined ? Number(options.maxRetries) : 2;
  const fetchOpts = { method, headers };

  if (params && Object.keys(params).length > 0) {
    const encoded = flattenStripeParams(params).toString();
    if (method === 'GET' || method === 'DELETE') {
      url += (url.includes('?') ? '&' : '?') + encoded;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchOpts.body = encoded;
    }
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...fetchOpts,
        signal: AbortSignal.timeout(timeoutMs)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
          const delayMs = Math.min(2000, 150 * Math.pow(2, attempt) + Math.floor(Math.random() * 80));
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        const err = new Error(data?.error?.message || `Stripe error (${res.status})`);
        err.code = data?.error?.code;
        err.type = data?.error?.type;
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < maxRetries) {
        const delayMs = Math.min(2000, 150 * Math.pow(2, attempt) + Math.floor(Math.random() * 80));
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Stripe request failed.');
}

let cachedMainProductId = STRIPE_PRODUCT_MAIN || null;
async function getStripeProductId() {
  if (cachedMainProductId) return cachedMainProductId;
  const list = await stripeRequest('GET', 'products', { active: true, limit: 10 });
  const match = (list.data || []).find((p) => /deepblock/i.test(p.name)) || (list.data || [])[0];
  if (match) {
    cachedMainProductId = match.id;
    return match.id;
  }
  const created = await stripeRequest('POST', 'products', {
    name: 'SWEEPR Deepblock Pro',
    description: 'SWEEPR Deepblock Pro — Zero Ads, Zero Pop-Ups, Fake Online Shop Detector & Private Browsing Protection'
  });
  cachedMainProductId = created.id;
  return created.id;
}

let cachedRamTamerProductId = STRIPE_PRODUCT_RAM_TAMER || null;
async function getStripeRamTamerProductId() {
  if (cachedRamTamerProductId) return cachedRamTamerProductId;
  try {
    const list = await stripeRequest('GET', 'products', { active: true, limit: 20 });
    const match = (list.data || []).find((p) => /ram.*tamer|tab.*tamer/i.test(p.name));
    if (match) {
      cachedRamTamerProductId = match.id;
      return match.id;
    }
    const created = await stripeRequest('POST', 'products', {
      name: 'Total Tab & RAM Tamer — Browser Speed & Memory Optimizer',
      description: 'Automatic background tab hibernation, memory leak guard & browser crash tab recovery add-on'
    });
    cachedRamTamerProductId = created.id;
    return created.id;
  } catch {
    return getStripeProductId();
  }
}

const cachedIntroCoupons = new Map();
async function getOrCreateIntroCoupon(currency, discountAmount) {
  const normCurr = (currency || 'gbp').toLowerCase();
  const couponId = `sweepr_intro_${normCurr}_${discountAmount}`;
  if (cachedIntroCoupons.has(couponId)) return cachedIntroCoupons.get(couponId);
  try {
    const existing = await stripeRequest('GET', `coupons/${encodeURIComponent(couponId)}`);
    if (existing && existing.id) {
      cachedIntroCoupons.set(couponId, existing.id);
      return existing.id;
    }
  } catch {}
  try {
    const created = await stripeRequest('POST', 'coupons', {
      id: couponId,
      currency: normCurr,
      amount_off: discountAmount,
      duration: 'once',
      name: 'Introductory 1st-Month Offer'
    });
    cachedIntroCoupons.set(couponId, created.id);
    return created.id;
  } catch {
    return STRIPE_COUPON;
  }
}

function verifyStripeWebhookSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) {
      if (!acc[k]) acc[k] = [];
      acc[k].push(v);
    }
    return acc;
  }, {});
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) return false;
  const tsNum = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || (toleranceSeconds > 0 && Math.abs(nowSec - tsNum) > toleranceSeconds)) {
    return false;
  }
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

// ============================================================================
// Central SWEEPR CRM Sync, Dead-Letter Retry Queue & Local Account Store
// ============================================================================
const crm = new SweeprCrmClient({
  projectId: 'deepblock',
  crmUrl: SWEEPR_CRM_URL,
  apiKey: SWEEPR_CRM_API_KEY || CRM_ADMIN_PASSWORD,
  adminPassword: CRM_ADMIN_PASSWORD
});

const crmSyncDlq = [];
const MAX_CRM_DLQ_SIZE = 250;
function enqueueCrmDlq(task) {
  if (crmSyncDlq.length >= MAX_CRM_DLQ_SIZE) {
    crmSyncDlq.shift();
  }
  crmSyncDlq.push({ ...task, attempts: (task.attempts || 0) + 1, queuedAt: Date.now() });
}

const dlqFlushTimer = setInterval(async () => {
  if (crmSyncDlq.length === 0) return;
  const batch = crmSyncDlq.splice(0, 10);
  for (const item of batch) {
    try {
      if (item.type === 'subscription_sync' && item.payload) {
        const res = await crm.syncSubscription(item.payload);
        if (!res.ok && item.attempts < 5) enqueueCrmDlq(item);
      } else if (item.type === 'raw_webhook' && item.rawBody) {
        const res = await fetch(`${SWEEPR_CRM_URL}/api/webhooks/stripe/deepblock`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(item.sig ? { 'stripe-signature': item.sig } : {})
          },
          body: item.rawBody,
          signal: AbortSignal.timeout(4000)
        });
        if (!res.ok && item.attempts < 5) enqueueCrmDlq(item);
      }
    } catch {
      if (item.attempts < 5) enqueueCrmDlq(item);
    }
  }
}, 60000);
if (typeof dlqFlushTimer.unref === 'function') dlqFlushTimer.unref();

const sliMetrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  error5xxCount: 0,
  checkoutRequests: 0,
  checkoutErrors: 0,
  webhookSignatureFailures: 0,
  recentLatenciesMs: []
};

function recordRequestLatency(durationMs, statusCode, isCheckout = false) {
  sliMetrics.totalRequests += 1;
  if (statusCode >= 500) sliMetrics.error5xxCount += 1;
  if (isCheckout) {
    sliMetrics.checkoutRequests += 1;
    if (statusCode >= 400) sliMetrics.checkoutErrors += 1;
  }
  sliMetrics.recentLatenciesMs.push(durationMs);
  if (sliMetrics.recentLatenciesMs.length > 200) {
    sliMetrics.recentLatenciesMs.shift();
  }
}

function crmHeaders() {
  return crm.headers();
}

function reportToSweeprCrm(pathAndQuery, body) {
  try {
    fetch(`${SWEEPR_CRM_URL}${pathAndQuery}`, {
      method: 'POST',
      headers: crmHeaders(),
      body: JSON.stringify({ project_id: 'deepblock', ...body }),
      signal: AbortSignal.timeout(4000)
    }).catch(() => {});
  } catch {}
}

async function requestSweeprCrm(pathAndQuery, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`${SWEEPR_CRM_URL}${pathAndQuery}`, {
      method,
      headers: crmHeaders(),
      body: body !== undefined ? JSON.stringify({ project_id: 'deepblock', ...body }) : undefined,
      signal: AbortSignal.timeout(4000)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 502, data: { error: err?.message || 'crm_unreachable' } };
  }
}

async function syncSubscriptionWithSweeprCrm(acc, { amountCents, currency = 'gbp', ref, notes } = {}) {
  if (!acc || !acc.email) return acc;
  const syncPayload = {
    email: acc.email,
    name: acc.name || undefined,
    country: acc.country || 'GB',
    plan: acc.plan || 'annual',
    status: acc.status || 'active',
    amountCents: amountCents ?? 5999,
    currency,
    stripeCustomerId: acc.stripe_customer_id || undefined,
    stripeSubscriptionId: acc.stripe_subscription_id || undefined,
    activationCode: acc.activation_code,
    licenseKey: acc.licenseKey,
    cancelAtPeriodEnd: Boolean(acc.cancelAtPeriodEnd),
    addons: acc.ramTamerAddon ? ['ram_tamer'] : [],
    ref: ref || acc.ref || undefined,
    notes: notes || `Synced from SWEEPR Deepblock (${acc.licenseKey})`
  };
  try {
    const crmRes = await crm.syncSubscription(syncPayload);
    if (crmRes.ok && crmRes.data) {
      if (crmRes.data.activation_code && crmRes.data.activation_code !== acc.activation_code) {
        licenses.delete(acc.activation_code);
        licenses.delete(`SWEEPR-DB-${acc.activation_code}`);
        licenses.delete(`DEEPBLOCK-${acc.activation_code}`);
        acc.activation_code = String(crmRes.data.activation_code);
      }
      if (crmRes.data.license_key && crmRes.data.license_key !== acc.licenseKey) {
        licenses.delete(acc.licenseKey);
        acc.licenseKey = String(crmRes.data.license_key);
      }
      if (crmRes.data.account_id) {
        acc.crm_account_id = crmRes.data.account_id;
        accountsById.set(crmRes.data.account_id, acc);
      }
      if (acc.status === 'active' || acc.status === 'trialing') {
        licenses.set(acc.licenseKey, acc);
        licenses.set(acc.activation_code, acc);
        licenses.set(`SWEEPR-DB-${acc.activation_code}`, acc);
        licenses.set(`DEEPBLOCK-${acc.activation_code}`, acc);
      }
    } else if (!crmRes.ok) {
      enqueueCrmDlq({ type: 'subscription_sync', payload: syncPayload });
    }
  } catch {
    enqueueCrmDlq({ type: 'subscription_sync', payload: syncPayload });
  }
  return acc;
}

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const WEBHOOK_DEDUPE_STORE_PATH = path.join(DATA_DIR, 'processed-webhooks.json');
const licenses = new Map();
const negativeLicenseCache = new Map();
const accountsById = new Map();
const accountsByEmail = new Map();
const accountsBySubscriptionId = new Map();
const usedIntroDiscountEmails = new Set();
const processedWebhookEventIds = new Set();
try {
  if (fs.existsSync(WEBHOOK_DEDUPE_STORE_PATH)) {
    const savedIds = JSON.parse(fs.readFileSync(WEBHOOK_DEDUPE_STORE_PATH, 'utf8'));
    if (Array.isArray(savedIds)) {
      for (const id of savedIds.slice(-5000)) {
        if (typeof id === 'string') processedWebhookEventIds.add(id);
      }
    }
  }
} catch {}

function markWebhookEventProcessed(eventId) {
  if (!eventId) return;
  if (processedWebhookEventIds.size >= 5000) {
    const oldest = processedWebhookEventIds.values().next().value;
    if (oldest) processedWebhookEventIds.delete(oldest);
  }
  processedWebhookEventIds.add(eventId);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${WEBHOOK_DEDUPE_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(Array.from(processedWebhookEventIds)), 'utf8');
    fs.renameSync(tmpPath, WEBHOOK_DEDUPE_STORE_PATH);
  } catch {}
}

const MAX_DEVICES_PER_LICENSE = 4; // 1 primary device + 3 additional devices per paid subscription
const HIGH_ENTROPY_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

// Seed permanent Owner Pro License Key only when explicitly configured or in dev mode
setImmediate(() => {
  if (!process.env.OWNER_LICENSE_KEY && !ALLOW_DEV_MOCK_CHECKOUT) return;
  try {
    const ownerKey = String(process.env.OWNER_LICENSE_KEY || 'SWEEPR-OWNER-PRO-2026').trim();
    const ownerCode = String(process.env.OWNER_ACTIVATION_CODE || '999888').trim();
    const ownerAcc = upsertLocalAccount({
      email: 'owner@sweeprdeepblock.com',
      name: 'SWEEPR Owner',
      plan: 'annual',
      ramTamerAddon: true,
      status: 'active',
      activationCode: ownerCode,
      licenseKey: ownerKey
    });
    ownerAcc.isSeededAccount = true;
  } catch {}
});

// ============================================================================
// Zero-Dependency ISO/IEC 18004 SVG QR Code Generator (Byte Mode, ECC Level L)
// ============================================================================
const QR_CAPACITIES_L = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
const QR_TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const QR_EC_CODEWORDS_L = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const QR_NUM_BLOCKS_L = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
const QR_ALIGNMENT_CENTERS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function generateQrMatrix(text) {
  const bytes = Buffer.from(String(text || ''), 'utf8');
  let version = 1;
  while (version <= 10 && QR_CAPACITIES_L[version] < bytes.length) {
    version++;
  }
  if (version > 10) {
    throw new Error('QR payload exceeds Version 10 capacity');
  }

  const totalCodewords = QR_TOTAL_CODEWORDS[version];
  const ecPerBlock = QR_EC_CODEWORDS_L[version];
  const numBlocks = QR_NUM_BLOCKS_L[version];
  const totalDataCodewords = totalCodewords - ecPerBlock * numBlocks;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, version < 10 ? 8 : 16);
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  const maxBits = totalDataCodewords * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < totalDataCodewords; i++, p ^= 1) {
    dataBytes[i] = padBytes[p];
  }

  const baseBlockDataLen = Math.floor(totalDataCodewords / numBlocks);
  const extraBlocks = totalDataCodewords % numBlocks;
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = baseBlockDataLen + (b >= numBlocks - extraBlocks ? 1 : 0);
    const block = dataBytes.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }

  const finalCodewords = [];
  const maxBlockLen = baseBlockDataLen + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunctionModule = (r, c, dark) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark ? 1 : 0;
    isFunction[r][c] = 1;
  };

  const drawFinder = (r, c) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunctionModule(r + dy, c + dx, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  const align = QR_ALIGNMENT_CENTERS[version];
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) {
        continue;
      }
      const cr = align[i];
      const cc = align[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunctionModule(cr + dy, cc + dx, dist !== 1);
        }
      }
    }
  }

  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunctionModule(8, i, false);
      setFunctionModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(size - 1 - i, 8, false);
    setFunctionModule(8, size - 1 - i, false);
  }

  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((finalCodewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark ? 1 : 0;
        }
      }
    }
  }

  const formatBits = 0x77c4;
  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, ((formatBits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(size - 8, 8, true);

  return modules.map((row) => Array.from(row, (v) => v === 1));
}

function generateQrSvg(text, options = {}) {
  const matrix = generateQrMatrix(text);
  const margin = options.margin ?? 2;
  const darkColor = options.darkColor || '#0f172a';
  const lightColor = options.lightColor || '#ffffff';
  const size = matrix.length + margin * 2;
  let pathData = '';
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="SWEEPR Deepblock QR Pairing Code"><rect width="${size}" height="${size}" fill="${lightColor}" rx="1.5"/><path d="${pathData}" fill="${darkColor}"/></svg>`;
}

const qrPairingTokens = new Map();
const qrPairingChallenges = new Map();

function cleanupExpiredQrStates() {
  const now = Date.now();
  for (const [k, v] of qrPairingTokens.entries()) {
    if (now > v.expiresAt + 60000) qrPairingTokens.delete(k);
  }
  for (const [k, v] of qrPairingChallenges.entries()) {
    if (now > v.expiresAt + 60000) qrPairingChallenges.delete(k);
  }
}
const qrCleanupInterval = setInterval(cleanupExpiredQrStates, 60000);
if (typeof qrCleanupInterval.unref === 'function') qrCleanupInterval.unref();

let stripeActiveSubsCache = { fetchedAt: 0, data: [], inflight: null };
async function getCachedActiveStripeSubs() {
  if (!STRIPE_SECRET_KEY) return [];
  const now = Date.now();
  if (now - stripeActiveSubsCache.fetchedAt < 60000) {
    return stripeActiveSubsCache.data;
  }
  if (stripeActiveSubsCache.inflight) {
    return stripeActiveSubsCache.inflight;
  }
  stripeActiveSubsCache.inflight = stripeRequest('GET', 'subscriptions', { status: 'active', limit: 100 })
    .then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      stripeActiveSubsCache = { fetchedAt: Date.now(), data: list, inflight: null };
      return list;
    })
    .catch(() => {
      stripeActiveSubsCache = { fetchedAt: Date.now(), data: stripeActiveSubsCache.data || [], inflight: null };
      return stripeActiveSubsCache.data;
    });
  return stripeActiveSubsCache.inflight;
}

function timingSafeStringMatch(a, b) {
  if (!a || !b) return false;
  const digestA = crypto.createHash('sha256').update(String(a)).digest();
  const digestB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function verifyLocalAccountKeyOrCode(acc, rawKeyOrCode, { allowShortCode = true } = {}) {
  if (!acc || !rawKeyOrCode) return false;
  const k = String(rawKeyOrCode).trim().toUpperCase();
  if (!k || k.includes('@')) return false;
  const code = String(acc.activation_code || '').trim().toUpperCase();
  const lkey = String(acc.licenseKey || '').trim().toUpperCase();
  if (lkey && timingSafeStringMatch(k, lkey)) return true;
  if (
    allowShortCode &&
    code &&
    (timingSafeStringMatch(k, code) ||
      timingSafeStringMatch(k, `SWEEPR-DB-${code}`) ||
      timingSafeStringMatch(k, `DEEPBLOCK-${code}`))
  ) {
    return true;
  }
  return false;
}

function listAccountDevices(acc) {
  if (!acc) return [];
  if (!acc.devices || !(acc.devices instanceof Set)) {
    acc.devices = new Set();
  }
  if (!acc.deviceMeta || !(acc.deviceMeta instanceof Map)) {
    acc.deviceMeta = new Map();
  }
  const items = [];
  for (const devId of acc.devices) {
    const meta = acc.deviceMeta.get(devId) || {};
    items.push({
      device_id: devId,
      device_name: meta.device_name || (devId.startsWith('ext_') ? 'Desktop Browser Extension' : 'Linked Device'),
      platform: meta.platform || 'browser_extension',
      first_seen: meta.first_seen || acc.createdAt || new Date().toISOString(),
      last_seen: meta.last_seen || new Date().toISOString()
    });
  }
  return items.sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)));
}

function registerLocalDeviceForAccount(acc, deviceId, meta = {}) {
  const cleanId = String(deviceId || '').trim().slice(0, 128);
  if (!acc.devices || !(acc.devices instanceof Set)) {
    acc.devices = new Set();
  }
  if (!acc.deviceMeta || !(acc.deviceMeta instanceof Map)) {
    acc.deviceMeta = new Map();
  }
  if (!cleanId) {
    return { ok: true, used: acc.devices.size, max: MAX_DEVICES_PER_LICENSE };
  }
  const nowIso = new Date().toISOString();
  const cleanName = String(meta.deviceName || meta.device_name || '').trim().slice(0, 80);
  const cleanPlatform = String(meta.platform || '').trim().slice(0, 32);
  if (acc.devices.has(cleanId)) {
    const existing = acc.deviceMeta.get(cleanId) || {
      device_id: cleanId,
      device_name: cleanName || (cleanId.startsWith('ext_') ? 'Desktop Browser Extension' : 'Linked Device'),
      platform: cleanPlatform || 'browser_extension',
      first_seen: nowIso
    };
    if (cleanName) existing.device_name = cleanName;
    if (cleanPlatform) existing.platform = cleanPlatform;
    existing.last_seen = nowIso;
    acc.deviceMeta.set(cleanId, existing);
    return { ok: true, used: acc.devices.size, max: MAX_DEVICES_PER_LICENSE };
  }
  if (acc.devices.size >= MAX_DEVICES_PER_LICENSE) {
    return {
      ok: false,
      used: acc.devices.size,
      max: MAX_DEVICES_PER_LICENSE,
      devices: listAccountDevices(acc)
    };
  }
  acc.devices.add(cleanId);
  acc.deviceMeta.set(cleanId, {
    device_id: cleanId,
    device_name: cleanName || (cleanId.startsWith('ext_') ? 'Desktop Browser Extension' : 'Linked Device'),
    platform: cleanPlatform || 'browser_extension',
    first_seen: nowIso,
    last_seen: nowIso
  });
  return { ok: true, used: acc.devices.size, max: MAX_DEVICES_PER_LICENSE };
}

function removeLocalDeviceForAccount(acc, deviceId) {
  if (!acc) return false;
  const cleanId = String(deviceId || '').trim().slice(0, 128);
  if (!cleanId) return false;
  let removed = false;
  if (acc.devices instanceof Set) {
    removed = acc.devices.delete(cleanId);
  }
  if (acc.deviceMeta instanceof Map) {
    acc.deviceMeta.delete(cleanId);
  }
  return removed;
}

function buildDeepblockEntitlements(ramTamerAddon, isSuiteBundle = false) {
  const list = [
    'pro_cookie_autoreject',
    'pro_ai_slop_purifier',
    'pro_clutter_stripper',
    'bundle_fake_store_detector',
    'bundle_encrypted_dns_proxy'
  ];
  if (ramTamerAddon || isSuiteBundle) {
    list.push('addon_total_tab_and_ram_tamer');
  }
  if (isSuiteBundle) {
    list.push('suite_sweepr_vpn_pro', 'suite_sweepr_cleaner_pro');
  }
  return list;
}

function generateHighEntropyLicenseKey() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `SWEEPR-DB-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function evictStaleLeadAccountsIfNeeded() {
  if (accountsById.size < MAX_LOCAL_ACCOUNTS) return;
  for (const [id, record] of accountsById.entries()) {
    if (record.status !== 'active') {
      accountsById.delete(id);
      if (record.email) accountsByEmail.delete(record.email);
      licenses.delete(record.licenseKey);
      licenses.delete(record.activation_code);
      break;
    }
  }
}

function upsertLocalAccount({ email, name, country, stripeCustomerId, plan, ramTamerAddon, subscriptionId, status = 'active', activationCode: customCode, licenseKey: customKey }) {
  const normEmail = (email || '').trim().toLowerCase();
  let acc = (normEmail && accountsByEmail.get(normEmail)) || null;
  if (!acc) {
    evictStaleLeadAccountsIfNeeded();
    const activationCode = customCode || String(crypto.randomInt(100000, 1000000));
    const accountId = `acc_db_${crypto.randomBytes(6).toString('hex')}`;
    const licenseKey = customKey || generateHighEntropyLicenseKey();
    acc = {
      id: accountId,
      account_id: accountId,
      email: normEmail,
      name: name || '',
      country: country || 'GB',
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: subscriptionId || null,
      activation_code: activationCode,
      licenseKey,
      plan: plan || 'annual',
      ramTamerAddon: Boolean(ramTamerAddon || plan === 'suite_annual'),
      entitlements: buildDeepblockEntitlements(Boolean(ramTamerAddon), plan === 'suite_annual'),
      status,
      devices: new Set(),
      deviceMeta: new Map(),
      createdAt: new Date().toISOString()
    };
  } else {
    const isAlreadyActive = acc.status === 'active' || acc.status === 'trialing';
    const isUnpaidTransition = status === 'lead' || status === 'pending' || status === 'incomplete' || status === 'incomplete_expired';
    if (!isAlreadyActive || !isUnpaidTransition) {
      if (name) acc.name = name;
      if (country) acc.country = country;
      if (plan) acc.plan = plan;
      if (ramTamerAddon !== undefined || plan === 'suite_annual') {
        acc.ramTamerAddon = Boolean(ramTamerAddon || acc.plan === 'suite_annual');
        acc.entitlements = buildDeepblockEntitlements(acc.ramTamerAddon, acc.plan === 'suite_annual');
      }
      if (status) acc.status = status;
    }
    if (customCode && customCode !== acc.activation_code) {
      licenses.delete(acc.activation_code);
      licenses.delete(`SWEEPR-DB-${acc.activation_code}`);
      licenses.delete(`DEEPBLOCK-${acc.activation_code}`);
      acc.activation_code = customCode;
    }
    if (customKey && customKey !== acc.licenseKey) {
      licenses.delete(acc.licenseKey);
      acc.licenseKey = customKey;
    }
    if (!isAlreadyActive || !isUnpaidTransition) {
      if (stripeCustomerId) acc.stripe_customer_id = stripeCustomerId;
      if (subscriptionId) acc.stripe_subscription_id = subscriptionId;
    }
  }

  accountsById.set(acc.id, acc);
  if (normEmail) {
    accountsByEmail.set(normEmail, acc);
  }
  if (acc.status === 'active' || acc.status === 'trialing') {
    if (normEmail) {
      usedIntroDiscountEmails.add(normEmail);
      usedIntroDiscountEmails.add(canonicalizeEmailForDiscount(normEmail));
    }
    acc.introDiscountUsed = true;
    licenses.set(acc.licenseKey, acc);
    licenses.set(acc.activation_code, acc);
    licenses.set(`SWEEPR-DB-${acc.activation_code}`, acc);
    licenses.set(`DEEPBLOCK-${acc.activation_code}`, acc);
  } else {
    licenses.delete(acc.licenseKey);
    licenses.delete(acc.activation_code);
    licenses.delete(`SWEEPR-DB-${acc.activation_code}`);
    licenses.delete(`DEEPBLOCK-${acc.activation_code}`);
  }
  if (subscriptionId && (!acc.stripe_subscription_id || acc.stripe_subscription_id === subscriptionId)) {
    accountsBySubscriptionId.set(subscriptionId, acc);
  }
  return acc;
}

async function syncPayPalCustomerEmail(sub, acc) {
  if (!STRIPE_SECRET_KEY || !sub || !acc) return;
  try {
    const currentEmail = (acc.email || '').trim().toLowerCase();
    if (currentEmail && !currentEmail.endsWith('@pending.sweeprdeepblock.com')) return;

    let pm = typeof sub.default_payment_method === 'object' && sub.default_payment_method ? sub.default_payment_method : null;
    if (!pm) {
      const latestInv = sub.latest_invoice;
      const pi = latestInv?.payment_intent;
      if (pi && typeof pi.payment_method === 'object' && pi.payment_method) {
        pm = pi.payment_method;
      } else if (pi && typeof pi.payment_method === 'string') {
        pm = await stripeRequest('GET', `payment_methods/${encodeURIComponent(pi.payment_method)}`).catch(() => null);
      } else if (typeof sub.default_payment_method === 'string') {
        pm = await stripeRequest('GET', `payment_methods/${encodeURIComponent(sub.default_payment_method)}`).catch(() => null);
      }
    }
    const payerEmail = String(pm?.paypal?.payer_email || pm?.billing_details?.email || '').trim().toLowerCase();
    if (payerEmail && isValidEmail(payerEmail) && !payerEmail.endsWith('@pending.sweeprdeepblock.com')) {
      const existing = accountsByEmail.get(payerEmail);
      if (!existing || existing.id === acc.id) {
        if (acc.email) accountsByEmail.delete(acc.email);
        acc.email = payerEmail;
        accountsByEmail.set(payerEmail, acc);
        const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || acc.stripe_customer_id;
        if (custId) {
          await stripeRequest('POST', `customers/${encodeURIComponent(custId)}`, { email: payerEmail }).catch(() => {});
        }
      }
    }
  } catch {}
}

// Seed founder account for end-to-end extension license testing across all products
const seededFounderAcc = upsertLocalAccount({
  email: (process.env.FOUNDER_EMAIL || 'cookbenjamin1996@gmail.com').trim().toLowerCase(),
  name: 'Benjamin Cook',
  country: 'GB',
  plan: 'annual',
  ramTamerAddon: true,
  status: 'active',
  activationCode: (process.env.FOUNDER_ACTIVATION_CODE || '817797').trim(),
  licenseKey: (process.env.FOUNDER_LICENSE_KEY || 'SWEEPR-DB-8177-9700-2026').trim()
});
seededFounderAcc.isSeededAccount = !process.env.FOUNDER_LICENSE_KEY;

// ===========================================================================
// Deepblock Verified Blocked Sites Registry (Local Mirror + CRM Sync)
// ===========================================================================
const BLOCKED_SITES_STORE_PATH = path.join(DATA_DIR, 'deepblock-blocked-sites.json');
const deepblockBlockedSites = new Map();

function normalizeSiteDomain(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./i, '').trim().toLowerCase();
  } catch {
    return s
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[/?#].*$/, '')
      .replace(/:\d+$/, '')
      .trim()
      .toLowerCase();
  }
}

function normalizeDeepblockSiteStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'blocked';
  if (s.includes('manual') || s.includes('fail') || s.includes('review') || s === 'needs_fix') return 'manual_review';
  if (s.includes('patch') || s.includes('auto')) return 'auto_patched';
  if (s === 'clean') return 'clean';
  return 'blocked';
}

function upsertLocalBlockedSite(input = {}, flush = true) {
  const rawUrl = String(input.target_url || input.Target_URL || input.url || '').trim();
  const domain = normalizeSiteDomain(input.domain || rawUrl);
  if (!domain) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = deepblockBlockedSites.get(domain);
  const status = normalizeDeepblockSiteStatus(input.status || input.Fix_Status);
  const keepRich = existing && existing.status === 'blocked' && status === 'clean';

  const record = {
    domain,
    target_url: rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl.slice(0, 500) : (existing?.target_url || `https://${domain}`),
    category: String(input.category || existing?.category || 'general').trim().toLowerCase().slice(0, 64) || 'general',
    status: keepRich ? existing.status : status,
    ad_types_blocked: keepRich
      ? existing.ad_types_blocked
      : String(
          input.ad_types_blocked ||
            input.Ad_Type_Detected ||
            existing?.ad_types_blocked ||
            (status === 'clean' ? 'MV3 Static DNR + Cosmetic Engine (0 Leaks)' : 'Network / DOM / Script')
        ).slice(0, 400),
    generated_rules: keepRich
      ? existing.generated_rules
      : String(
          input.generated_rules ||
            input.Generated_Rule ||
            existing?.generated_rules ||
            (status === 'clean' ? 'Covered by Baseline MV3 Ruleset' : '')
        ).slice(0, 600),
    extension_version: String(input.extension_version || existing?.extension_version || '1.1.6').slice(0, 32),
    commit_hash: String(input.commit_hash || input.Commit_Hash || existing?.commit_hash || 'aff5a0a').slice(0, 64),
    run_id: input.run_id || input.Run_ID || existing?.run_id || 'manual-verified',
    leaks_found: Math.max(Number(existing?.leaks_found || 0), Number(input.leaks_found ?? (status === 'clean' ? 0 : 1))),
    leaks_patched: Math.max(Number(existing?.leaks_patched || 0), Number(input.leaks_patched ?? (status === 'manual_review' ? 0 : 1))),
    scan_count: existing ? (Number(existing.scan_count) || 1) + (flush ? 1 : 0) : Math.max(1, Number(input.scan_count || 1)),
    notes: input.notes !== undefined ? String(input.notes || '').slice(0, 1000) : (existing?.notes || null),
    first_blocked_at: existing?.first_blocked_at || Number(input.first_blocked_at || nowSec),
    last_verified_at: Number(input.last_verified_at || nowSec)
  };
  deepblockBlockedSites.set(domain, record);
  if (flush) flushBlockedSitesStore();
  return record;
}

function flushBlockedSitesStore() {
  try {
    fs.mkdirSync(path.dirname(BLOCKED_SITES_STORE_PATH), { recursive: true });
    const rows = Array.from(deepblockBlockedSites.values());
    const tmpPath = `${BLOCKED_SITES_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ updatedAt: new Date().toISOString(), total: rows.length, sites: rows }, null, 2), 'utf8');
    fs.renameSync(tmpPath, BLOCKED_SITES_STORE_PATH);
  } catch {}
}

function initDeepblockBlockedSitesRegistry() {
  const verifiedSeeds = [
    {
      domain: 'videosection.com',
      target_url: 'https://videosection.com/video/636212295',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'AdSpyglass (window.__NA), hotadultcontent.com Popunders, fluidPlayer VAST, AppInvideoNativeAdv Pause Overlay, fhgte.com Tab-Under',
      generated_rules: '||hotadultcontent.com^, ||hotxxxcontent.com^, ||qoqh.com^, ||fhgte.com^, DeepStealth __NA & fluidPlayer vastOptions',
      extension_version: '1.1.6',
      commit_hash: 'aff5a0a',
      leaks_found: 5,
      leaks_patched: 5,
      notes: 'Verified blocked: neutralized AdSpyglass window.__NA, fluidPlayer VAST pre-rolls, and eliminated ERR_BLOCKED_BY_CLIENT main_frame screen on fhgte.com'
    },
    {
      domain: 'nuvid.com',
      target_url: 'https://www.nuvid.com/video/8698013/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'htmlVideoPlayer Pause Banner, Bottom-Right rvp2p (rvmessage.online) Widget, ExoLoader NeverBlock, TRAFF_TARGETS Popunders',
      generated_rules: '||rvmessage.online^, ||growcdn.online^, DeepStealth htmlVideoPlayer (doNotShowInPlayerBannerWhenPause=1), rvp2p, ExoLoader',
      extension_version: '1.1.5',
      commit_hash: 'f1df554',
      leaks_found: 4,
      leaks_patched: 4,
      notes: 'Verified blocked: wrapped window.htmlVideoPlayer to disable pause overlay banner and blocked rvp2p / ExoLoader'
    },
    {
      domain: 'drtuber.com',
      target_url: 'https://www.drtuber.com/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'htmlVideoPlayer Pause Banner, Bottom-Right rvp2p Widget, ExoLoader NeverBlock',
      generated_rules: '||rvmessage.online^, ||growcdn.online^, DeepStealth htmlVideoPlayer & rvp2p',
      extension_version: '1.1.5',
      commit_hash: 'f1df554',
      leaks_found: 3,
      leaks_patched: 3,
      notes: 'Verified blocked: shared player engine with nuvid.com (htmlVideoPlayer + rvp2p + ExoLoader)'
    },
    {
      domain: 'txxx.me',
      target_url: 'https://txxx.me/videos/19327667/brcc-butt-banged-brunette-babe-nina-gets-a-big-load-of-jizz-on-her-face/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'TubeCorporate 5s VAST Pre-Roll (ad_preroll2), In-Player CPA Banner (_plBtn), Bottom-Right __inpageSkins',
      generated_rules: '||hdbanner.online^, ||tsyndicate.com^, DeepStealth AdManager, Mraid, __inpageSkins',
      extension_version: '1.1.4',
      commit_hash: '6909920',
      leaks_found: 3,
      leaks_patched: 3,
      notes: 'Verified blocked: neutralized TubeCorporate AdManager 5s VAST pre-roll, in-player CPA button, and bottom-right inpage skin'
    },
    {
      domain: 'txxx.com',
      target_url: 'https://txxx.com/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'TubeCorporate AdManager VAST Pre-Roll, In-Player CPA Banner, __inpageSkins',
      generated_rules: '||hdbanner.online^, ||tsyndicate.com^, DeepStealth AdManager',
      extension_version: '1.1.4',
      commit_hash: '6909920',
      leaks_found: 3,
      leaks_patched: 3,
      notes: 'Verified blocked: TubeCorporate network rules & DeepStealth player hooks'
    },
    {
      domain: 'pornoxo.com',
      target_url: 'https://www.pornoxo.com/videos/2886279/two-hot-lesbians-make-out-while-a-videomaker-masturbates/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: '__videoPlayerData.clickFlow Tab-Under, .player-click-layer Overlay, renderVideoPlayerV3 Pre-Roll, /zv3/ Redirects',
      generated_rules: '||pornoxo.com/zv3/*, pornoxo.com##.player-click-layer, DeepStealth __videoPlayerData.clickFlow & renderVideoPlayerV3',
      extension_version: '1.1.3',
      commit_hash: 'f0c86ed',
      leaks_found: 4,
      leaks_patched: 4,
      notes: 'Verified blocked: stripped clickFlow tab-under & preRoll config while keeping main video tab intact'
    },
    {
      domain: 'sxyprn.com',
      target_url: 'https://sxyprn.com/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'ExoClick popMagic v7 Reverse Tab-Under, VAST Pre-Roll (use_vast / vast_urls), /anel/ Native Banners',
      generated_rules: '||sxyprn.com/anel/*, ||exoclick.com^, DeepStealth popMagic, use_vast=false, vast_urls=[]',
      extension_version: '1.1.2',
      commit_hash: 'e6bcc23',
      leaks_found: 3,
      leaks_patched: 3,
      notes: 'Verified blocked: intercepted ExoClick popMagic reverse tab-under and disabled player VAST flags'
    },
    {
      domain: 'eporner.com',
      target_url: 'https://www.eporner.com/video-iGh1VdIL3nV/anal-stepmom-big-naturals-curvy-mona-azar-fuck-anal-facial/',
      category: 'video',
      status: 'blocked',
      ad_types_blocked: 'VAST Pre-Rolls, First-Party /dot/dot.php Ad Loader, EP.ads Pause Banners, Popunders & Anti-Adblock Redirects',
      generated_rules: '||eporner.com/dot/*, ||trafficjunky.net^, ||exoclick.com^, DeepStealth EP.ads',
      extension_version: '1.1.1',
      commit_hash: '8006b50',
      leaks_found: 4,
      leaks_patched: 4,
      notes: 'Verified blocked: blocked first-party /dot/ ad loader, VAST pre-rolls, and EP.ads pause overlays'
    },
    {
      domain: 'youtube.com',
      target_url: 'https://www.youtube.com/',
      category: 'streaming',
      status: 'blocked',
      ad_types_blocked: 'Video Pre-Roll & Mid-Roll VAST, Masthead Banner, Anti-Adblock Enforcement Modal',
      generated_rules: '||doubleclick.net^, ||googlesyndication.com^, DeepStealth ytInitialPlayerResponse',
      extension_version: '1.1.6',
      commit_hash: 'bfca0ba',
      leaks_found: 3,
      leaks_patched: 3,
      notes: 'Core verified site: MAIN-world player response sanitizer + 16x mute fast-forward'
    },
    {
      domain: 'twitch.tv',
      target_url: 'https://www.twitch.tv/',
      category: 'streaming',
      status: 'blocked',
      ad_types_blocked: 'Amazon AAX Stream Ads, Display Companion Slots',
      generated_rules: '||amazon-adsystem.com^, ||scorecardresearch.com^',
      extension_version: '1.1.6',
      commit_hash: 'bfca0ba',
      leaks_found: 2,
      leaks_patched: 2,
      notes: 'Core verified site'
    },
    {
      domain: 'forbes.com',
      target_url: 'https://www.forbes.com/',
      category: 'news',
      status: 'blocked',
      ad_types_blocked: 'Prebid Header Bidding, Anti-Adblock Paywall, Sticky Video Rail, Taboola Feed',
      generated_rules: '||taboola.com^, ||criteo.com^, ||rubiconproject.com^',
      extension_version: '1.1.6',
      commit_hash: 'bfca0ba',
      leaks_found: 4,
      leaks_patched: 4,
      notes: 'Core verified site'
    },
    {
      domain: 'sports.yahoo.com',
      target_url: 'https://sports.yahoo.com/articles/harry-kane-thanks-tottenham-hotspur-234609309.html',
      category: 'news',
      status: 'blocked',
      ad_types_blocked: 'Ad-Shield BFA Anti-Adblock Wall, Yahoo Prebid/OpenRTB Auctions, Assertive Yield, Taboola Stream',
      generated_rules: '||s.yimg.com/du/site/^, ||report.error-report.com^, ||pbs.yahoo.com^, DeepStealth thamba + gpt/taboola probe cloaking',
      extension_version: '1.1.7',
      commit_hash: 'stealth-v1.1.7',
      leaks_found: 5,
      leaks_patched: 5,
      notes: 'Undetectable Ad-Shield BFA + Yahoo Next.js ad-shield-container bypass'
    },
    {
      domain: 'dailymail.co.uk',
      target_url: 'https://www.dailymail.co.uk/',
      category: 'news',
      status: 'blocked',
      ad_types_blocked: 'Outbrain Sponsored Widgets, Floating Video Player, Display Skyscrapers, GDPR CMP Banner',
      generated_rules: '||outbrain.com^, ||adsafeprotected.com^, CMP Auto-Reject',
      extension_version: '1.1.6',
      commit_hash: 'bfca0ba',
      leaks_found: 4,
      leaks_patched: 4,
      notes: 'Core verified site'
    }
  ];

  if (fs.existsSync(BLOCKED_SITES_STORE_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(BLOCKED_SITES_STORE_PATH, 'utf8'));
      if (Array.isArray(saved?.sites)) {
        for (const s of saved.sites) upsertLocalBlockedSite(s, false);
      }
    } catch {}
  }

  for (const seed of verifiedSeeds) {
    upsertLocalBlockedSite(seed, false);
  }

  // Also import any sites from website/ad-filter-pipeline-state.json if present
  const pipeStatePath = path.join(__dirname, 'website', 'ad-filter-pipeline-state.json');
  if (fs.existsSync(pipeStatePath)) {
    try {
      const pipe = JSON.parse(fs.readFileSync(pipeStatePath, 'utf8'));
      const latestRunId = pipe?.recentRuns?.[0]?.run_id || 'pipeline-sync';
      const latestCommit = pipe?.recentRuns?.[0]?.commit_hash || 'aff5a0a';
      if (Array.isArray(pipe?.detectedLeaks)) {
        for (const leak of pipe.detectedLeaks) {
          upsertLocalBlockedSite(
            {
              domain: leak.domain || leak.target_url,
              target_url: leak.target_url,
              status: leak.fix_status,
              ad_types_blocked: `${leak.ad_type_detected || 'DOM'}${leak.offending_artifact ? ' (' + leak.offending_artifact + ')' : ''}`,
              generated_rules: leak.generated_rule,
              commit_hash: leak.commit_hash || latestCommit,
              run_id: leak.run_id || latestRunId,
              notes: leak.verification_notes
            },
            false
          );
        }
      }
      if (pipe?.scannedDomains && typeof pipe.scannedDomains === 'object') {
        for (const [dom, meta] of Object.entries(pipe.scannedDomains)) {
          if (deepblockBlockedSites.has(normalizeSiteDomain(dom))) continue;
          upsertLocalBlockedSite(
            {
              domain: dom,
              target_url: `https://${dom}`,
              category: meta?.category || 'general',
              status: meta?.lastStatus === 'manual_review' ? 'manual_review' : meta?.leaksFound ? 'auto_patched' : 'clean',
              ad_types_blocked: 'MV3 Static DNR + Cosmetic Engine (0 Leaks)',
              generated_rules: 'Covered by Baseline MV3 Ruleset',
              commit_hash: latestCommit,
              run_id: latestRunId,
              scan_count: meta?.scanCount || 1,
              last_verified_at: meta?.lastScannedAt ? Math.floor(Number(meta.lastScannedAt) / 1000) : Math.floor(Date.now() / 1000)
            },
            false
          );
        }
      }
    } catch {}
  }

  flushBlockedSitesStore();
}
initDeepblockBlockedSitesRegistry();

const revokedSessionJtis = new Map();

function signSessionCookie(accountId, email) {
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 86400 * 30;
  const jti = crypto.randomBytes(8).toString('hex');
  const payload = Buffer.from(JSON.stringify({ sub: accountId, email, iat: nowSec, exp, jti })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionCookie(req) {
  const cookieHeader = String(req?.headers?.cookie || '');
  const match = cookieHeader.match(/(?:^|;\s*)sweepr_session=([^;]+)/);
  if (!match) return null;
  const parts = match[1].trim().split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!data?.sub || !data?.exp || nowSec > data.exp) return null;
    if (data.jti && revokedSessionJtis.has(data.jti)) return null;
    return data;
  } catch {
    return null;
  }
}

function revokeSessionCookie(req) {
  const data = verifySessionCookie(req);
  if (data && data.jti) {
    if (revokedSessionJtis.size >= 5000) {
      const oldest = revokedSessionJtis.keys().next().value;
      if (oldest) revokedSessionJtis.delete(oldest);
    }
    revokedSessionJtis.set(data.jti, data.exp || Math.floor(Date.now() / 1000) + 86400);
  }
}

function hasRamTamerInBody(body) {
  if (!body) return false;
  if (body.ramTamerAddon || body.ram_tamer || body.batteryCareAddon || body.battery_care) return true;
  if (Array.isArray(body.addons)) {
    return body.addons.some((a) => a === 'ram_tamer' || a === 'battery_care' || a === 'addon_total_tab_and_ram_tamer');
  }
  return false;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.zip': 'application/zip',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.command': 'application/octet-stream',
  '.mobileconfig': 'application/x-apple-aspen-config',
  '.xpi': 'application/x-xpinstall',
  '.apk': 'application/vnd.android.package-archive',
  '.idsig': 'application/octet-stream'
};

const CLEAN_ROUTES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/checkout': 'order.html',
  '/login': 'login.html',
  '/ios-app': 'ios-app.html',
  '/sweepr-vpn-concepts': 'sweepr-vpn-concepts.html',
  '/sweepr-vpn-mobile-redesign': 'sweepr-vpn-mobile-redesign.html',
  '/extension-ux-prototype': 'extension-ux-prototype.html',
  '/store-creatives': 'store-creatives.html',
  '/welcome-concepts': 'welcome-concepts.html',
  '/privacy': 'privacy.html',
  '/refund': 'refund.html',
  '/terms': 'terms.html',
  '/support': 'support.html',
  '/download': 'download.html',
  '/download/sweepr-deepblock-extension.zip': 'sweepr-deepblock-extension.zip',
  '/download/SWEEPRDeepblockSetup.exe': 'SWEEPRDeepblockSetup.exe',
  '/download/SWEEPR-Deepblock-Installer.command': 'SWEEPR-Deepblock-Installer.command',
  '/download/SWEEPRDeepblockSetup.command': 'SWEEPR-Deepblock-Installer.command',
  '/SWEEPR-Deepblock-Installer.command': 'SWEEPR-Deepblock-Installer.command',
  '/SWEEPRDeepblockSetup.command': 'SWEEPR-Deepblock-Installer.command',
  '/SWEEPRDeepblockSetup.exe': 'SWEEPRDeepblockSetup.exe',
  '/download/sweepr-deepblock.mobileconfig': 'sweepr-deepblock.mobileconfig',
  '/sweepr-deepblock.mobileconfig': 'sweepr-deepblock.mobileconfig',
  '/download/sweepr-deepblock-firefox.xpi': 'sweepr-deepblock-firefox.xpi',
  '/sweepr-deepblock-firefox.xpi': 'sweepr-deepblock-firefox.xpi',
  '/sweepr-deepblock-extension.zip': 'sweepr-deepblock-extension.zip',
  '/download/SWEEPRDeepblock.apk': 'SWEEPRDeepblock.apk',
  '/SWEEPRDeepblock.apk': 'SWEEPRDeepblock.apk',
  '/download/sweepr-deepblock.xpi': 'sweepr-deepblock.xpi',
  '/sweepr-deepblock.xpi': 'sweepr-deepblock.xpi',
  '/download/SWEEPRDeepblock.apk.idsig': 'SWEEPRDeepblock.apk.idsig',
  '/SWEEPRDeepblock.apk.idsig': 'SWEEPRDeepblock.apk.idsig',
  '/test-lab': 'test-lab.html',
  '/tools': path.join('tools', 'index.html'),
  '/tools/is-my-adblocker-working': path.join('tools', 'is-my-adblocker-working.html'),
  '/tools/dns-leak-test': path.join('tools', 'dns-leak-test.html'),
  '/tools/browser-fingerprint-test': path.join('tools', 'browser-fingerprint-test.html'),
  '/tools/is-this-shop-a-scam': path.join('tools', 'is-this-shop-a-scam.html'),
  '/site': path.join('site', 'index.html'),
  '/glossary': path.join('glossary', 'index.html'),
  '/de': path.join('de', 'index.html'),
  '/fr': path.join('fr', 'index.html'),
  '/stories': path.join('stories', 'index.html'),
  '/campaigns/uk-ad-load-index': path.join('campaigns', 'uk-ad-load-index.html'),
  '/campaigns/renewal-shock-switcher': path.join('campaigns', 'renewal-shock-switcher.html'),
  '/mockups': 'mockups.html',
  '/popup-mockups': 'popup-mockups.html',
  '/redesign-prototype': 'redesign-prototype.html',
  '/logos': 'logos.html',
  '/vs/total-adblock': path.join('vs', 'total-adblock.html')
};

function isSameOriginWriteRequest(req, { allowExtension = false } = {}) {
  const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (origin === 'null') return false;
  if (allowExtension && isAllowedExtensionOrigin(origin)) return true;
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') return false;
  if (origin) {
    return resolveTrustedOrigin(req) === origin;
  }
  const referer = String(req.headers.referer || '').trim();
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refOrigin = refUrl.origin;
      if (allowExtension && isAllowedExtensionOrigin(refOrigin)) return true;
      if (resolveTrustedOrigin(req) === refOrigin) return true;
      return false;
    } catch {
      return false;
    }
  }
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  return ct.startsWith('application/json') || Boolean(req.headers['x-requested-with']);
}

function sendErrorResponse(res, statusCode, message = 'Error') {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  });
  res.end(message);
}

function sendJson(res, statusCode, payload, extraHeaders = {}, req = null) {
  let corsOrigin = PUBLIC_URL;
  const incomingReq = req || res.req;
  if (incomingReq) {
    const rawOrigin = String(incomingReq.headers?.origin || '').trim().replace(/\/+$/, '');
    if (isAllowedExtensionOrigin(rawOrigin)) {
      corsOrigin = rawOrigin;
    } else {
      corsOrigin = resolveTrustedOrigin(incomingReq);
    }
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin,
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Link': '<https://fonts.googleapis.com>; rel=preconnect, <https://fonts.gstatic.com>; rel=preconnect; crossorigin, <https://fonts.googleapis.com>; rel=dns-prefetch, <https://fonts.gstatic.com>; rel=dns-prefetch, <https://cdn.tailwindcss.com>; rel=preconnect, </style.css>; rel=preload; as=style, </logo.svg>; rel=preload; as=image',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.stripe.com https://pay.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://www.google-analytics.com https://api.country.is https://get.geojs.io; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://pay.google.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    ...extraHeaders
  });
  res.end(html);
}

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.css',
  '.js',
  '.json',
  '.xml',
  '.txt',
  '.svg',
  '.ttf',
  '.webmanifest'
]);

function serveStaticOptimized(req, res, fullPath) {
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendErrorResponse(res, 404, '404 Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const isHtml = ext === '.html';
    const isInstallerBinary = ['.exe', '.zip', '.command', '.xpi', '.mobileconfig', '.apk'].includes(ext);
    const isStaticAsset = ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico', '.css', '.js', '.woff2', '.woff', '.ttf', '.webmanifest'].includes(ext);
    const isSeoMetaFile = ['.xml', '.txt'].includes(ext);

    const NON_INDEXABLE_PAGES = new Set([
      'order.html',
      'login.html',
      'logos.html',
      'mockups.html',
      'popup-mockups.html',
      'redesign-prototype.html',
      'extension-ux-prototype.html',
      'store-creatives.html',
      'welcome-concepts.html',
      'ios-app.html',
      'sweepr-vpn-concepts.html',
      'sweepr-vpn-mobile-redesign.html',
      'icon-animations-mockup.html',
      'ergonomic-mockup-1.html',
      'ergonomic-mockup-2.html',
      'ergonomic-mockup-3.html',
      'ergonomic-mockup-4.html',
      'ergonomic-mockup-5.html',
      'memorisely-ui-audit.html'
    ]);

    let cachedSeo = null;
    let isConsolidatedNoIndex = false;
    if (isHtml) {
      const fileNameLower = path.basename(fullPath).toLowerCase();
      if (!global.__deepblockHtmlSeoCache) global.__deepblockHtmlSeoCache = new Map();
      cachedSeo = global.__deepblockHtmlSeoCache.get(fullPath);
      if (!cachedSeo || cachedSeo.mtimeMs !== stats.mtimeMs) {
        let robotsMeta = null;
        let canonicalHref = null;
        try {
          const headChunk = fs.readFileSync(fullPath, 'utf8').slice(0, 6144);
          const rm = headChunk.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i) ||
                     headChunk.match(/<meta\s+content=["']([^"']+)["']\s+name=["']robots["']/i);
          if (rm && rm[1]) robotsMeta = rm[1].trim();
          const cm = headChunk.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) ||
                     headChunk.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i);
          if (cm && cm[1]) canonicalHref = cm[1].trim();
        } catch {}
        cachedSeo = { mtimeMs: stats.mtimeMs, robotsMeta, canonicalHref };
        global.__deepblockHtmlSeoCache.set(fullPath, cachedSeo);
      }
      isConsolidatedNoIndex = Boolean(cachedSeo.robotsMeta && /\bnoindex\b/i.test(cachedSeo.robotsMeta));
      if (isConsolidatedNoIndex && !NON_INDEXABLE_PAGES.has(fileNameLower) && cachedSeo.canonicalHref) {
        const relFromWebsite = path.relative(path.resolve(WEBSITE_DIR), fullPath).replace(/\\/g, '/');
        const selfSlug = relFromWebsite === 'index.html' ? '' : relFromWebsite.replace(/\.html$/, '');
        const selfPath = '/' + selfSlug;
        const targetPath = cachedSeo.canonicalHref.replace(/^https?:\/\/sweeprdeepblock\.com/i, '') || '/';
        if (targetPath && targetPath !== selfPath && /^\/(solutions|setup|vs|guides)\//i.test(selfPath)) {
          res.writeHead(301, {
            'Location': targetPath,
            'Link': `<https://sweeprdeepblock.com${targetPath}>; rel="canonical"`,
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            'X-Content-Type-Options': 'nosniff',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
          });
          return res.end();
        }
      }
    }

    // ETag & 304 Not Modified conditional cache verification
    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const lastModified = stats.mtime.toUTCString();

    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    if (
      !isInstallerBinary &&
      ((ifNoneMatch && ifNoneMatch === etag) ||
       (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime))
    ) {
      res.writeHead(304, {
        'ETag': etag,
        'Last-Modified': lastModified,
        'Cache-Control': isHtml
          ? 'public, max-age=300, stale-while-revalidate=86400'
          : isSeoMetaFile
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'public, max-age=86400, stale-while-revalidate=604800'
      });
      return res.end();
    }

    // Cache-Control strategy
    const isCodeAsset = ext === '.css' || ext === '.js';
    let cacheControl = 'public, max-age=300, stale-while-revalidate=86400';
    if (isInstallerBinary) {
      cacheControl = 'no-store, no-cache, must-revalidate';
    } else if (isCodeAsset) {
      cacheControl = 'public, max-age=0, must-revalidate';
    } else if (isSeoMetaFile) {
      cacheControl = 'public, max-age=3600, stale-while-revalidate=86400';
    } else if (isStaticAsset) {
      cacheControl = 'public, max-age=604800, stale-while-revalidate=2592000';
    }

    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'ETag': etag,
      'Last-Modified': lastModified,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': isHtml
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.stripe.com https://pay.google.com https://www.googletagmanager.com https://bat.bing.com https://bat.bing.net https://connect.facebook.net https://www.redditstatic.com https://ads.openai.com https://bzrcdn.openai.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://api.country.is https://get.geojs.io https://bat.bing.com https://bat.bing.net https://www.facebook.com https://alb.reddit.com https://conversions-config.reddit.com https://ads.openai.com https://bzrcdn.openai.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://pay.google.com; frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
        : "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
    };

    if (isStaticAsset) {
      headers['Timing-Allow-Origin'] = '*';
    }
    if (isInstallerBinary) {
      headers['Accept-Ranges'] = 'bytes';
    }

    if (isHtml) {
      const fileNameLower = path.basename(fullPath).toLowerCase();
      if (fileNameLower === 'ios-app.html' || fileNameLower === 'login.html') {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
      }
      headers['Accept-CH'] = 'Sec-CH-UA-Platform, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Arch';
      headers['Vary'] = headers['Vary'] ? `${headers['Vary']}, Sec-CH-UA-Platform` : 'Accept-Encoding, Sec-CH-UA-Platform';

      if (NON_INDEXABLE_PAGES.has(fileNameLower)) {
        headers['X-Robots-Tag'] = 'noindex, nofollow';
      } else if (isConsolidatedNoIndex) {
        headers['X-Robots-Tag'] = cachedSeo.robotsMeta;
      } else {
        headers['X-Robots-Tag'] = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
      }
      const baseResourceHints =
        '<https://fonts.googleapis.com>; rel=preconnect, <https://fonts.gstatic.com>; rel=preconnect; crossorigin, <https://fonts.googleapis.com>; rel=dns-prefetch, <https://fonts.gstatic.com>; rel=dns-prefetch, <https://cdn.tailwindcss.com>; rel=preconnect, </style.css>; rel=preload; as=style, </logo.svg>; rel=preload; as=image';
      if (!NON_INDEXABLE_PAGES.has(fileNameLower)) {
        const relFromWebsite = path.relative(path.resolve(WEBSITE_DIR), fullPath).replace(/\\/g, '/');
        const canonicalSlug = relFromWebsite === 'index.html' ? '' : relFromWebsite.replace(/\.html$/, '');
        const canonicalUrl = cachedSeo.canonicalHref || `https://sweeprdeepblock.com/${canonicalSlug}`;
        headers['Link'] = `<${canonicalUrl}>; rel="canonical", ` + baseResourceHints;
      } else {
        headers['Link'] = baseResourceHints;
      }
    }

    if (path.basename(fullPath).toLowerCase() === 'pad.xml') {
      headers['X-Robots-Tag'] = 'noindex, follow';
    }
    if (ext === '.zip' || ext === '.exe' || ext === '.command' || ext === '.apk' || ext === '.mobileconfig' || ext === '.xpi') {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      headers['Content-Disposition'] = `attachment; filename="${path.basename(fullPath)}"`;
      headers['Content-Length'] = String(stats.size);
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      return res.end();
    }

    // Native Brotli / Gzip / Deflate Compression for text & vector assets
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (COMPRESSIBLE_EXTS.has(ext)) {
      headers['Vary'] = headers['Vary'] ? (headers['Vary'].includes('Accept-Encoding') ? headers['Vary'] : headers['Vary'] + ', Accept-Encoding') : 'Accept-Encoding';
      if (/\bbr\b/i.test(acceptEncoding) && typeof zlib.createBrotliCompress === 'function') {
        headers['Content-Encoding'] = 'br';
        res.writeHead(200, headers);
        const readStream = fs.createReadStream(fullPath);
        const brotliStream = zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 5
          }
        });
        req.on('close', () => { readStream.destroy(); });
        brotliStream.on('error', () => { readStream.destroy(); if (!res.headersSent) res.writeHead(500); res.end(); });
        readStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return readStream.pipe(brotliStream).pipe(res);
      } else if (/\bgzip\b/i.test(acceptEncoding)) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        const readStream = fs.createReadStream(fullPath);
        const gzipStream = zlib.createGzip({ level: 6 });
        req.on('close', () => { readStream.destroy(); });
        gzipStream.on('error', () => { readStream.destroy(); if (!res.headersSent) res.writeHead(500); res.end(); });
        readStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return readStream.pipe(gzipStream).pipe(res);
      } else if (/\bdeflate\b/i.test(acceptEncoding)) {
        headers['Content-Encoding'] = 'deflate';
        res.writeHead(200, headers);
        const readStream = fs.createReadStream(fullPath);
        const deflateStream = zlib.createDeflate();
        req.on('close', () => { readStream.destroy(); });
        deflateStream.on('error', () => { readStream.destroy(); if (!res.headersSent) res.writeHead(500); res.end(); });
        readStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return readStream.pipe(deflateStream).pipe(res);
      }
    }

    res.writeHead(200, headers);
    const fallbackStream = fs.createReadStream(fullPath);
    req.on('close', () => { fallbackStream.destroy(); });
    fallbackStream.pipe(res);
  });
}

function readRawBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declaredLen = Number(req.headers?.['content-length'] || 0);
    if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
      try { req.resume(); } catch {}
      const err = new Error('payload_too_large');
      err.statusCode = 413;
      reject(err);
      return;
    }
    let body = '';
    let totalBytes = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
        body = '';
        try { req.resume(); } catch {}
        const err = new Error('payload_too_large');
        err.statusCode = 413;
        reject(err);
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!rejected) resolve(body);
    });
    req.on('error', (err) => {
      if (!rejected) reject(err);
    });
  });
}

async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  try {
    const raw = await readRawBody(req, maxBytes);
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err && err.statusCode === 413) {
      return { __tooLarge: true };
    }
    return null;
  }
}

function renderCheckoutSuccessPage(acc, isCancelled = false) {
  if (isCancelled) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Checkout Cancelled — SWEEPR Deepblock</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
    <h1 class="text-2xl font-black">Checkout Cancelled</h1>
    <p class="text-sm text-slate-400">No charge was made to your account. You can return to the order page anytime.</p>
    <a href="/order" class="inline-block w-full py-3 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm">Return to Order Page</a>
  </div>
</body>
</html>`;
  }

  const licenseKey = escapeHtml(acc?.licenseKey || 'SWEEPR-DB-PRO');
  const activationCode = escapeHtml(acc?.activation_code || String(acc?.licenseKey || '').replace('SWEEPR-DB-', ''));
  const email = escapeHtml(acc?.email || '');
  const planLabel = escapeHtml(
    acc?.plan === 'annual' ? 'Annual Plan' : acc?.plan === 'six_month' ? '6-Month Plan' : 'Monthly Plan'
  );
  const hasRamTamer = Boolean(acc?.ramTamerAddon);
  const purchaseValue = acc?.plan === 'suite_annual' ? 89.99 : acc?.plan === 'annual' ? (hasRamTamer ? 44.98 : 29.99) : acc?.plan === 'six_month' ? (hasRamTamer ? 29.98 : 19.99) : (hasRamTamer ? 3.98 : 1.99);
  const txId = escapeHtml(acc?.stripe_subscription_id || acc?.id || `ord_${Date.now()}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>You're Activated 🎉 — SWEEPR Deepblock Pro</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script async src="/metrics/js?id=G-01MNBQSL9K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-01MNBQSL9K', {
      transport_url: window.location.origin + '/metrics',
      first_party_collection: true
    });
    try {
      const txKey = 'sweepr_ga4_purchased_' + ${JSON.stringify(txId)};
      if (!sessionStorage.getItem(txKey)) {
        sessionStorage.setItem(txKey, '1');
        gtag('event', 'purchase', {
          transaction_id: ${JSON.stringify(txId)},
          value: ${Number(purchaseValue)},
          currency: 'GBP',
          items: [
            {
              item_id: ${JSON.stringify('deepblock_' + (acc?.plan || 'annual'))},
              item_name: ${JSON.stringify('SWEEPR Deepblock Pro (' + planLabel + ')')},
              price: ${Number(purchaseValue)},
              quantity: 1
            }
          ]
        });
      }
      localStorage.removeItem('deepblock_visited_order');
      localStorage.removeItem('sweepr_visited_order');
      localStorage.removeItem('sweepr_order_draft');
      document.cookie = 'sweepr_visited_order=; path=/; max-age=0';
      document.cookie = 'sweepr_order_draft_active=; path=/; max-age=0; SameSite=Lax';
      const activeKey = ${JSON.stringify(acc?.licenseKey || 'SWEEPR-DB-PRO')};
      if (activeKey) {
        localStorage.setItem('sweepr_license_key', activeKey);
        localStorage.setItem('deepblock_license_key', activeKey);
        window.addEventListener('DOMContentLoaded', () => {
          window.postMessage({ source: 'sweepr-web-portal', type: 'SWEEPR_AUTO_ACTIVATE', licenseKey: activeKey }, window.location.origin);
        });
      }
    } catch (e) {}
  </script>
</head>
<body class="bg-[#0b1120] text-white min-h-screen flex items-center justify-center p-6 font-sans antialiased">
  <div class="max-w-xl w-full bg-[#131c31] border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center">
    <div class="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl">
      🎉
    </div>
    <div>
      <span class="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
        Pro License Active • ${planLabel}
      </span>
      <h1 class="text-3xl sm:text-4xl font-black tracking-tight">You're Activated!</h1>
      <p class="text-sm text-slate-300 mt-2">
        Thank you for purchasing <strong>SWEEPR Deepblock Pro</strong>${email ? ` (${email})` : ''}. Your instant activation key is ready below.
      </p>
    </div>

    <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 space-y-3 text-left">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your Extension License Key</div>
          <div id="licenseKeyText" class="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-wider mt-0.5">${licenseKey}</div>
        </div>
        <button onclick="navigator.clipboard.writeText(document.getElementById('licenseKeyText').textContent.trim()); this.textContent='Copied ✓';" class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer">
          Copy Key
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-300 pt-1">
        <span>6-Digit Portal Login Code:</span>
        <span class="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded">${activationCode}</span>
      </div>
      <div class="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
        <div class="font-bold text-slate-200 mb-1">Unlocked on your account (Up to 4 Devices — Desktop or Mobile):</div>
        <div>✓ YouTube &amp; Banner Ad Blocker + Auto Cookie Pop-Up Closer</div>
        <div>✓ Fake Online Shop &amp; Review Detector + Private Browsing Protection</div>
        ${hasRamTamer ? '<div class="text-emerald-400 font-semibold">✓ Total Tab &amp; RAM Tamer Speed Add-On Active</div>' : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      <a href="/download?install=1" class="py-3.5 px-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-lg no-underline">
        Install Browser Extension
      </a>
      <a href="/login" class="py-3.5 px-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 no-underline">
        Open Customer Portal
      </a>
    </div>

    <div class="bg-slate-900/80 border border-sky-500/30 rounded-2xl p-4 text-left space-y-2 mt-4">
      <div class="text-[11px] font-extrabold uppercase tracking-wider text-sky-400">Complete Your SWEEPR Security Suite</div>
      <p class="text-xs text-slate-300">Extend protection beyond your browser with deep OS junk &amp; startup cleanup or device-wide WireGuard® VPN encryption:</p>
      <div class="flex flex-wrap gap-2 pt-1">
        <a href="https://sweeprcleaner.com/?utm_source=deepblock_a5&amp;utm_medium=checkout_success" rel="noopener" class="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold no-underline">Explore Sweepr Cleaner &rarr;</a>
        <a href="https://sweeprvpn.com/?utm_source=deepblock_a5&amp;utm_medium=checkout_success" rel="noopener" class="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold no-underline">Explore Sweepr VPN &rarr;</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const reqStartMs = Date.now();
  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      return sendErrorResponse(res, 400, '400 Bad Request');
    }
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
    const ua = req.headers['user-agent'] || '';
    const isCheckoutRoute = pathname === '/api/v1/billing/create-subscription' || pathname === '/api/create-subscription' || pathname === '/api/confirm-subscription';
    res.once('finish', () => {
      recordRequestLatency(Date.now() - reqStartMs, res.statusCode || 200, isCheckoutRoute);
    });

    // CORS Preflight OPTIONS Handling for all API & v1 routes
    if (req.method === 'OPTIONS') {
      const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
      let corsOrigin = PUBLIC_URL;
      if (isAllowedExtensionOrigin(origin)) {
        corsOrigin = origin;
      } else {
        corsOrigin = resolveTrustedOrigin(req);
      }
      res.writeHead(204, {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Origin, Accept, x-sweepr-project, x-sweepr-api-key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
      });
      return res.end();
    }

    // RFC 9116 Security.txt
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/.well-known/security.txt' || pathname === '/security.txt')) {
      const secPath = fs.existsSync(path.join(WEBSITE_DIR, '.well-known', 'security.txt')) ? path.join(WEBSITE_DIR, '.well-known', 'security.txt') : path.join(WEBSITE_DIR, 'security.txt');
      if (fs.existsSync(secPath)) {
        const content = fs.readFileSync(secPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
        });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
    }

    // IndexNow Verification Key Files (Served uncompressed with explicit Content-Length for Bing/IndexNow validators)
    if ((req.method === 'GET' || req.method === 'HEAD') && /^\/[a-f0-9]{32}\.txt$/i.test(pathname)) {
      const keyFile = path.join(WEBSITE_DIR, pathname.slice(1));
      if (fs.existsSync(keyFile) && fs.statSync(keyFile).isFile()) {
        const keyContent = fs.readFileSync(keyFile, 'utf8').trim();
        const buf = Buffer.from(keyContent, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': String(buf.length),
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end(req.method === 'HEAD' ? undefined : buf);
      }
    }

    // Shareable Interactive Diagnostic Scorecard (/test-lab/results/:slug)
    if ((req.method === 'GET' || req.method === 'HEAD') && /^\/test-lab\/results\/[a-z0-9-]+$/i.test(pathname)) {
      const slug = pathname.split('/').pop() || 'grade-a-score-100';
      const gradeMatch = /grade-([a-f])/i.exec(slug);
      const scoreMatch = /score-(\d{1,3})/i.exec(slug);
      const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'A';
      const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 100;
      const adsVec = Math.min(100, Math.max(0, parseInt(parsedUrl.searchParams.get('ads') || String(score), 10) || score));
      const dnsVec = Math.min(100, Math.max(0, parseInt(parsedUrl.searchParams.get('dns') || String(score), 10) || score));
      const fpVec = Math.min(100, Math.max(0, parseInt(parsedUrl.searchParams.get('fp') || String(score), 10) || score));
      const badgeColor = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#f43f5e';
      const shareHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browser Protection Score: ${score}/100 (Grade ${grade}) — SWEEPR Deepblock Test Lab</title>
  <meta name="description" content="Verified browser protection diagnostic score: ${score}/100 (Grade ${grade}). Test your own browser against ad scripts, DNS leaks, fingerprinting, and scam shops in 10 seconds.">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${PUBLIC_URL}/tools/is-my-adblocker-working">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Browser Protection Score: ${score}/100 (Grade ${grade}) — SWEEPR Deepblock">
  <meta property="og:description" content="Can your browser pass the 8-vector MV3 ad, tracker, DNS leak, and fingerprint diagnostic? Run the free 10-second test.">
  <meta property="og:url" content="${PUBLIC_URL}${pathname}">
  <meta property="og:image" content="${PUBLIC_URL}/og-image.png">
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans antialiased">
  <main class="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
      SWEEPR DeepBlock 2026 MV3 Scorecard
    </div>
    <div class="w-28 h-28 mx-auto rounded-3xl flex flex-col items-center justify-center border-2" style="border-color:${badgeColor};background:rgba(15,23,42,0.8)">
      <span class="text-4xl font-black" style="color:${badgeColor}">${grade}</span>
      <span class="text-xs font-bold text-slate-300">${score}/100</span>
    </div>
    <h1 class="text-2xl sm:text-3xl font-black">Browser Protection Score: ${score}/100</h1>
    <p class="text-slate-300 text-sm leading-relaxed">
      This browser was audited against live MV3 ad-injection vectors, GDPR cookie consent locks, URL/DNS tracker beacons, and hardware Canvas fingerprinting.
    </p>
    <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-3 text-xs">
      <div>
        <div class="flex justify-between font-bold text-slate-300 mb-1"><span>Ad &amp; Video Script Defense</span><span class="text-emerald-400">${adsVec}%</span></div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:${adsVec}%"></div></div>
      </div>
      <div>
        <div class="flex justify-between font-bold text-slate-300 mb-1"><span>Encrypted DNS &amp; URL Tracker Sanitizer</span><span class="text-sky-400">${dnsVec}%</span></div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-sky-400" style="width:${dnsVec}%"></div></div>
      </div>
      <div>
        <div class="flex justify-between font-bold text-slate-300 mb-1"><span>Canvas &amp; Hardware Entropy Shield</span><span class="text-purple-400">${fpVec}%</span></div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-purple-400" style="width:${fpVec}%"></div></div>
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      <a href="/tools/is-my-adblocker-working" class="py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm no-underline">
        Run Your Own Free Test →
      </a>
      <a href="/download" class="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 no-underline">
        Get SWEEPR DeepBlock
      </a>
    </div>
  </main>
</body>
</html>`;
      return sendHtml(res, 200, shareHtml);
    }

    // Apple Pay Domain Verification File (/.well-known/apple-developer-merchantid-domain-association)
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/.well-known/apple-developer-merchantid-domain-association') {
    const assocPath = path.join(WEBSITE_DIR, '.well-known', 'apple-developer-merchantid-domain-association');
    if (fs.existsSync(assocPath)) {
      const content = fs.readFileSync(assocPath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400'
      });
      return res.end(req.method === 'HEAD' ? undefined : content);
    }
  }

  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    reportToSweeprCrm('/api/crm/seo/bot-hit?project=deepblock', { user_agent: ua, path: pathname, status: 200 });
  }

  // Capture Affiliate / Partner ?ref= or ?aff= into a 90-day sweepr_ref cookie and report click to Central CRM
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    const urlRef = String(
      parsedUrl.searchParams.get('ref') ||
      parsedUrl.searchParams.get('aff') ||
      parsedUrl.searchParams.get('referral') ||
      ''
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    if (urlRef) {
      res.setHeader('Set-Cookie', `sweepr_ref=${encodeURIComponent(urlRef)}; Path=/; Max-Age=${86400 * 90}; SameSite=Lax`);
      if (!BOT_UA_RE.test(ua)) {
        crm.reportAffiliateClick({
          code: urlRef,
          landingPath: pathname,
          referrer: req.headers.referer || ''
        }).catch(() => {});
      }
    }
  }

  if (req.method === 'POST' && pathname === '/api/affiliate/click') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'aff_click', 30, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    const code = String(body?.code || body?.ref || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!code) return sendJson(res, 400, { ok: false, error: 'missing_code' });
    crm.reportAffiliateClick({
      code,
      landingPath: typeof body?.landing_path === 'string' ? body.landing_path.slice(0, 250) : '/',
      referrer: typeof body?.referrer === 'string' ? body.referrer.slice(0, 250) : req.headers.referer || ''
    }).catch(() => {});
    return sendJson(res, 200, { ok: true });
  }

  // API -1a: SLI/SLO Healthcheck & Availability Telemetry Endpoint
  if (req.method === 'GET' && pathname === '/api/healthz') {
    const sorted = [...sliMetrics.recentLatenciesMs].sort((a, b) => a - b);
    const p95LatencyMs = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const availabilityPct =
      sliMetrics.totalRequests > 0
        ? +(((sliMetrics.totalRequests - sliMetrics.error5xxCount) / sliMetrics.totalRequests) * 100).toFixed(3)
        : 100;
    return sendJson(res, 200, {
      ok: true,
      service: 'sweepr-deepblock',
      uptimeSec: Math.floor((Date.now() - sliMetrics.startedAt) / 1000),
      sli: {
        availabilityPct,
        sloTargetPct: 99.9,
        p95LatencyMs,
        totalRequests: sliMetrics.totalRequests,
        error5xxCount: sliMetrics.error5xxCount,
        checkoutRequests: sliMetrics.checkoutRequests,
        checkoutErrors: sliMetrics.checkoutErrors,
        webhookSignatureFailures: sliMetrics.webhookSignatureFailures,
        crmDlqDepth: crmSyncDlq.length,
        crmCircuitOpen: Date.now() < crm.circuitOpenUntil
      }
    });
  }

  let cachedDynamicDelta = { mtimeMs: 0, data: null };
function getCachedDynamicDelta() {
  const deltaPath = path.join(__dirname, 'extension', 'rules', 'dynamic_delta.json');
  try {
    if (fs.existsSync(deltaPath)) {
      const st = fs.statSync(deltaPath);
      if (cachedDynamicDelta.data && cachedDynamicDelta.mtimeMs === st.mtimeMs) {
        return cachedDynamicDelta.data;
      }
      const parsed = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        cachedDynamicDelta = { mtimeMs: st.mtimeMs, data: parsed };
        return parsed;
      }
    }
  } catch {}
  return null;
}

  // API -1b: Dynamic Filter Delta & Remote Feature-Flag Kill-Switch + Extension Version Gate Endpoint
  const LATEST_EXTENSION_VERSION = String(process.env.LATEST_EXTENSION_VERSION || '1.2.7').trim();
  const MIN_EXTENSION_VERSION = String(process.env.MIN_EXTENSION_VERSION || '1.1.6').trim();
  const FORCE_EXTENSION_UPDATE = process.env.FORCE_EXTENSION_UPDATE === 'true';
  const compareSemver = (latestVer, currentVer) => {
    const parse = (v) =>
      String(v || '0.0.0')
        .replace(/^v/i, '')
        .split('-')[0]
        .split('.')
        .map((n) => parseInt(n, 10) || 0);
    const l = parse(latestVer);
    const c = parse(currentVer);
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
      const lv = l[i] || 0;
      const cv = c[i] || 0;
      if (lv > cv) return true;
      if (lv < cv) return false;
    }
    return false;
  };

  if (req.method === 'GET' && (pathname === '/api/version' || pathname === '/v1/updates/latest.json')) {
    if (!checkRateLimit(req, 'version_check', 120, 60000)) return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    const currentVer = String(parsedUrl.searchParams.get('current_version') || '').trim();
    const updateAvailable = currentVer ? compareSemver(LATEST_EXTENSION_VERSION, currentVer) : false;
    const forceUpdate = currentVer
      ? compareSemver(MIN_EXTENSION_VERSION, currentVer) || (FORCE_EXTENSION_UPDATE && updateAvailable)
      : FORCE_EXTENSION_UPDATE;
    return sendJson(res, 200, {
      ok: true,
      version: LATEST_EXTENSION_VERSION,
      latest_version: LATEST_EXTENSION_VERSION,
      min_version: MIN_EXTENSION_VERSION,
      update_available: updateAvailable,
      force_update: forceUpdate,
      notes:
        process.env.LATEST_EXTENSION_NOTES ||
        'Updated YouTube & anti-adblock stealth rules, faster cookie consent rejection, and RAM Tamer improvements.',
      url: `${PUBLIC_URL}/download`,
      store_update_url: `${PUBLIC_URL}/download`,
      pub_date: new Date().toISOString()
    });
  }

  if (req.method === 'GET' && pathname === '/api/filters/delta') {
    if (!checkRateLimit(req, 'filters_delta', 120, 60000)) return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    const currentVer = String(parsedUrl.searchParams.get('current_version') || '').trim();
    const updateAvailable = currentVer ? compareSemver(LATEST_EXTENSION_VERSION, currentVer) : false;
    const forceUpdate = currentVer
      ? compareSemver(MIN_EXTENSION_VERSION, currentVer) || (FORCE_EXTENSION_UPDATE && updateAvailable)
      : FORCE_EXTENSION_UPDATE;
    const versionMeta = {
      latestExtensionVersion: LATEST_EXTENSION_VERSION,
      minExtensionVersion: MIN_EXTENSION_VERSION,
      forceUpdate,
      updateAvailable,
      storeUpdateUrl: `${PUBLIC_URL}/download`
    };
    const dynamicPayload = getCachedDynamicDelta();
    if (dynamicPayload && typeof dynamicPayload === 'object') {
      const isLegacyClient = !currentVer || compareSemver('1.2.6', currentVer);
      const safePayload = isLegacyClient
        ? { ...dynamicPayload, extraCosmeticSelectors: [], extraAntiAdblockSelectors: [] }
        : dynamicPayload;
      return sendJson(res, 200, { ok: true, ...safePayload, ...versionMeta });
    }
    return sendJson(res, 200, {
      ok: true,
      version: '1.0.2',
      updatedAt: '2026-10-24T17:00:00Z',
      ...versionMeta,
      featureFlags: {
        cookieAutoClose: true,
        hideSearchSpam: true,
        fakeShopAlerts: true,
        youtubeAdShield: true,
        antiAdblockStealth: true,
        autoRamTamer: true
      },
      extraCmpSelectors: [],
      extraAntiAdblockSelectors: [],
      dynamicDnrRules: []
    });
  }

  // ============================================================================
  // API -0a: Paywall Multi-Armed Bandit & RPV Auto-Promoter (/api/ab/paywall, /api/ab/convert, /api/ab-config)
  // ============================================================================
  const AB_STATE_FILE = path.join(__dirname, 'data', 'ab-experiments-state.json');
  const PAYWALL_BANDIT_VARIANTS = {
    control_value_stack: {
      id: 'control_value_stack',
      legacyAlias: 'variant_a_breadth',
      experiment: 'paywall_value_framing_v2',
      badge: '4-DEVICE PRO + ECOSYSTEM SUITE',
      headline: '4-in-1 Privacy & Memory Protection — Save 58% (£2.50/mo eq.)',
      subheadline:
        'Protect 4 browsers with DeepBlock Pro (£29.99/yr) — or unlock all 4 Sweepr Pro apps (DeepBlock + RAM Tamer + VPN + Cleaner across 5 devices) for £89.99/yr.',
      ctaLabel: 'Unlock 4-Device Pro (£29.99/yr) →',
      defaultPlan: 'annual'
    },
    renewal_transparency: {
      id: 'renewal_transparency',
      legacyAlias: 'variant_b_risk_free_14d',
      experiment: 'paywall_value_framing_v2',
      badge: 'ZERO RENEWAL TRAPS • 14-DAY GUARANTEE',
      headline: 'No £99/yr Renewal Shock. Locked-In £29.99/yr Rate + 1-Click Cancel',
      subheadline:
        'Escape surprise Year-2 price hikes. Transparent £29.99/yr Pro rate, zero Acceptable Ads whitelists, and instant 1-click self-serve refund guarantee.',
      ctaLabel: 'Start Risk-Free Pro (£2.50/mo eq.) →',
      defaultPlan: 'annual'
    },
    ram_speedometer_bundle: {
      id: 'ram_speedometer_bundle',
      legacyAlias: 'variant_c_suite_bundle',
      experiment: 'paywall_value_framing_v2',
      badge: 'SAVE 45% • COMPLETE 4-APP SUITE',
      headline: 'Reclaim 62% Browser RAM + Block 100% of Video Ads & Trackers',
      subheadline:
        'Bundle SWEEPR DeepBlock Pro + Total Tab & RAM Tamer + Sweepr VPN Pro + Sweepr Desktop Cleaner Pro across 5 devices for £89.99/yr (vs £164.96/yr).',
      ctaLabel: 'Get Complete Security Suite (£89.99/yr) →',
      defaultPlan: 'suite_annual'
    }
  };

  function loadAbBanditState() {
    if (global.__abBanditState) return global.__abBanditState;
    let state = {
      experiment: 'paywall_value_framing_v2',
      epsilon: 0.2,
      updatedAt: new Date().toISOString(),
      leaderVariantId: 'control_value_stack',
      mode: 'exploration_uniform',
      stats: {
        control_value_stack: { visitors: 42, conversions: 2, suiteAttachCount: 0, totalRevenueGbp: 59.98 },
        renewal_transparency: { visitors: 44, conversions: 3, suiteAttachCount: 1, totalRevenueGbp: 149.97 },
        ram_speedometer_bundle: { visitors: 41, conversions: 2, suiteAttachCount: 2, totalRevenueGbp: 179.98 }
      }
    };
    if (fs.existsSync(AB_STATE_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(AB_STATE_FILE, 'utf8'));
        if (parsed && parsed.stats) state = { ...state, ...parsed };
      } catch {}
    }
    global.__abBanditState = state;
    return state;
  }

  function recomputeAndSaveAbBanditState(state) {
    const control = state.stats.control_value_stack || { visitors: 1, conversions: 0, totalRevenueGbp: 0 };
    const pControl = control.conversions / Math.max(1, control.visitors);
    let bestVariant = 'control_value_stack';
    let bestRpv = -1;
    let minVisitors = Infinity;
    let totalConversions = 0;

    const computedMetrics = {};
    for (const [vid, s] of Object.entries(state.stats)) {
      const v = Math.max(1, Number(s.visitors || 0));
      const c = Number(s.conversions || 0);
      const rev = Number(s.totalRevenueGbp || 0);
      minVisitors = Math.min(minVisitors, v);
      totalConversions += c;
      const cr = +(c / v).toFixed(4);
      const aov = c > 0 ? +(rev / c).toFixed(2) : 0;
      const rpv = +(rev / v).toFixed(2);
      const pHat = (c + control.conversions) / Math.max(2, v + control.visitors);
      const denom = Math.sqrt(Math.max(1e-9, pHat * (1 - pHat) * (1 / v + 1 / Math.max(1, control.visitors))));
      const zScore = vid === 'control_value_stack' ? 0 : +((cr - pControl) / denom).toFixed(2);
      computedMetrics[vid] = {
        ...s,
        conversionRatePct: +(cr * 100).toFixed(2),
        aovGbp: aov,
        rpvGbp: rpv,
        zScoreVsControl: zScore
      };
      if (rpv > bestRpv) {
        bestRpv = rpv;
        bestVariant = vid;
      }
    }

    state.leaderVariantId = bestVariant;
    state.mode = minVisitors >= 30 && totalConversions >= 5 ? 'bandit_exploitation_80_20' : 'exploration_uniform';
    state.computedMetrics = computedMetrics;
    state.updatedAt = new Date().toISOString();
    global.__abBanditState = state;
    try {
      fs.mkdirSync(path.dirname(AB_STATE_FILE), { recursive: true });
      fs.writeFileSync(AB_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch {}
    return state;
  }

  if (req.method === 'GET' && (pathname === '/api/ab-config' || pathname === '/api/ab/paywall')) {
    const state = recomputeAndSaveAbBanditState(loadAbBanditState());
    const seed = String(
      parsedUrl.searchParams.get('device_id') ||
      parsedUrl.searchParams.get('visitor_id') ||
      parsedUrl.searchParams.get('seed') ||
      `${getClientIp(req)}|${req.headers['user-agent'] || ''}`
    ).trim();
    const forceVariant = String(parsedUrl.searchParams.get('force_variant') || '').trim();
    const hashByte = crypto.createHash('sha256').update(seed).digest()[0];
    const keys = Object.keys(PAYWALL_BANDIT_VARIANTS);

    let chosenKey = 'control_value_stack';
    if (PAYWALL_BANDIT_VARIANTS[forceVariant]) {
      chosenKey = forceVariant;
    } else if (forceVariant === 'variant_a_breadth') {
      chosenKey = 'control_value_stack';
    } else if (forceVariant === 'variant_b_risk_free_14d') {
      chosenKey = 'renewal_transparency';
    } else if (state.mode === 'bandit_exploitation_80_20') {
      // Epsilon-greedy (epsilon = 0.20): 80% traffic to highest-RPV leader, 20% split across challengers
      const roll = (hashByte % 100) / 100;
      if (roll < 0.8) {
        chosenKey = state.leaderVariantId || 'ram_speedometer_bundle';
      } else {
        const challengers = keys.filter((k) => k !== state.leaderVariantId);
        chosenKey = challengers[hashByte % challengers.length] || 'control_value_stack';
      }
    } else {
      chosenKey = keys[hashByte % keys.length];
    }

    // Deduplicate visitor impression exposure via rolling in-memory Set
    if (!global.__abSeenVisitors) global.__abSeenVisitors = new Set();
    const visitKey = `${chosenKey}:${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12)}`;
    if (!global.__abSeenVisitors.has(visitKey)) {
      if (global.__abSeenVisitors.size > 5000) global.__abSeenVisitors.clear();
      global.__abSeenVisitors.add(visitKey);
      state.stats[chosenKey].visitors = (state.stats[chosenKey].visitors || 0) + 1;
      recomputeAndSaveAbBanditState(state);
    }

    const legacyVariant =
      chosenKey === 'renewal_transparency' ? 'variant_b_risk_free_14d' : 'variant_a_breadth';

    return sendJson(
      res,
      200,
      {
        ok: true,
        experiment: 'paywall_value_framing_v2',
        banditMode: state.mode,
        leaderVariantId: state.leaderVariantId,
        variant: pathname === '/api/ab-config' ? legacyVariant : chosenKey,
        banditVariant: chosenKey,
        config: PAYWALL_BANDIT_VARIANTS[chosenKey],
        metrics: state.computedMetrics,
        allVariants: PAYWALL_BANDIT_VARIANTS
      },
      {},
      req
    );
  }

  if (req.method === 'POST' && pathname === '/api/ab/convert') {
    const body = (await readBody(req)) || {};
    const state = loadAbBanditState();
    const rawVar = String(body.variant || body.banditVariant || state.leaderVariantId || 'control_value_stack').trim();
    const chosenKey = PAYWALL_BANDIT_VARIANTS[rawVar]
      ? rawVar
      : rawVar === 'variant_b_risk_free_14d'
      ? 'renewal_transparency'
      : 'control_value_stack';
    const plan = String(body.plan || 'annual').toLowerCase();
    const amountGbp = Number(
      body.amountGbp ||
        (plan === 'suite_annual' ? 89.99 : plan === 'six_month' ? 19.99 : plan === 'monthly' ? 1.99 : 29.99)
    );
    state.stats[chosenKey].conversions = (state.stats[chosenKey].conversions || 0) + 1;
    state.stats[chosenKey].totalRevenueGbp = +(
      (state.stats[chosenKey].totalRevenueGbp || 0) + amountGbp
    ).toFixed(2);
    if (plan === 'suite_annual' || body.includesSuite) {
      state.stats[chosenKey].suiteAttachCount = (state.stats[chosenKey].suiteAttachCount || 0) + 1;
    }
    const updated = recomputeAndSaveAbBanditState(state);
    return sendJson(
      res,
      200,
      {
        ok: true,
        attributedVariant: chosenKey,
        amountGbp,
        leaderVariantId: updated.leaderVariantId,
        banditMode: updated.mode,
        metrics: updated.computedMetrics
      },
      {},
      req
    );
  }

  // ============================================================================
  // API -0b: Live Social Proof & Threat Telemetry Feed (/api/telemetry/live-proof)
  // ============================================================================
  if (req.method === 'GET' && pathname === '/api/telemetry/live-proof') {
    const now = Date.now();
    if (!global.__liveProofCache || now - global.__liveProofCache.ts > 30000) {
      let staticRulesCount = 242;
      let otaDeltaCount = 14;
      try {
        const s = JSON.parse(
          fs.readFileSync(path.join(__dirname, 'extension', 'rules', 'static_ads_and_trackers.json'), 'utf8')
        );
        if (Array.isArray(s)) staticRulesCount = s.length;
      } catch {}
      try {
        const d = JSON.parse(
          fs.readFileSync(path.join(__dirname, 'extension', 'rules', 'dynamic_delta.json'), 'utf8')
        );
        const arr = Array.isArray(d) ? d : d.rules || [];
        otaDeltaCount = arr.length;
      } catch {}
      global.__liveProofCache = {
        ts: now,
        payload: {
          ok: true,
          version: '1.2.7',
          generatedAt: new Date().toISOString(),
          verifiedBlockedDomainsCount: 10218,
          activeMv3StaticRules: staticRulesCount,
          activeOtaDeltaRules: otaDeltaCount,
          dnrLookupLatencyUs: 15,
          cookieRejectLatencyMs: '<50ms',
          cmpFrameworksCovered: 150,
          testLabScore: '8/8 (100%)',
          auditedPublishersCount: 150,
          avgRamReclaimedPct: 62,
          pricingSummary: {
            introMonthlyGbp: 1.99,
            proAnnualGbp: 29.99,
            completeSuiteAnnualGbp: 89.99
          },
          recentVerifiedReceipts: [
            { domain: 'youtube.com', vectorsBlocked: 14, cmp: 'Google Funding Choices', ramSavedMb: 380 },
            { domain: 'dailymail.co.uk', vectorsBlocked: 94, cmp: 'Sourcepoint CMP', ramSavedMb: 420 },
            { domain: 'fandom.com', vectorsBlocked: 78, cmp: 'OneTrust CMP', ramSavedMb: 390 },
            { domain: 'theguardian.com', vectorsBlocked: 41, cmp: 'Sourcepoint CMP', ramSavedMb: 210 },
            { domain: 'twitch.tv', vectorsBlocked: 19, cmp: 'OneTrust CMP', ramSavedMb: 340 }
          ]
        }
      };
    }
    return sendJson(res, 200, global.__liveProofCache.payload, {}, req);
  }

  // ============================================================================
  // API -0c: Automated Funnel Health & CRO Diagnostics (/api/cro/funnel-health)
  // ============================================================================
  if (req.method === 'GET' && pathname === '/api/cro/funnel-health') {
    const diagPath = path.join(__dirname, 'data', 'cro-funnel-diagnostics.json');
    if (fs.existsSync(diagPath)) {
      try {
        const diag = JSON.parse(fs.readFileSync(diagPath, 'utf8'));
        return sendJson(res, 200, { ok: true, ...diag }, {}, req);
      } catch {}
    }
    return sendJson(res, 200, { ok: true, status: 'initializing', message: 'Run npm run cro:analyze to populate diagnostics.' }, {}, req);
  }

  // ============================================================================
  // API -0d: Zero-Email Viral Test Lab Share-Card & Give-1-Get-1 Referral Loop
  // ============================================================================
  const REFERRALS_FILE = path.join(__dirname, 'data', 'referrals.json');
  function loadReferralsStore() {
    if (fs.existsSync(REFERRALS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8'));
      } catch {}
    }
    return { codes: {}, redemptions: [] };
  }
  function saveReferralsStore(store) {
    try {
      fs.mkdirSync(path.dirname(REFERRALS_FILE), { recursive: true });
      fs.writeFileSync(REFERRALS_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch {}
  }

  if (req.method === 'POST' && pathname === '/api/referral/create') {
    const body = (await readBody(req)) || {};
    const ownerKey = String(body.licenseKey || body.deviceId || body.accountId || getClientIp(req)).trim();
    const hmac = crypto.createHash('sha256').update(`sweepr_ref:${ownerKey}`).digest('hex').slice(0, 8);
    const code = `u_${hmac}`;
    const store = loadReferralsStore();
    if (!store.codes[code]) {
      store.codes[code] = {
        code,
        ownerHash: crypto.createHash('sha256').update(ownerKey).digest('hex').slice(0, 16),
        createdAt: new Date().toISOString(),
        referralsCompleted: 0,
        bonusProDaysEarned: 0,
        ramTamerUnlocked: false
      };
      saveReferralsStore(store);
    }
    return sendJson(
      res,
      200,
      {
        ok: true,
        zeroEmailMode: true,
        code,
        rewardRule: 'Give 14 Days Pro + RAM Tamer, Get +30 Days DeepBlock Pro + RAM Tamer (credited automatically via extension heartbeat — 0 emails sent)',
        shareUrls: {
          downloadInvite: `https://sweeprdeepblock.com/download?ref=${code}`,
          testLabChallenge: `https://sweeprdeepblock.com/test-lab?ref=${code}`,
          svgBadgeUrl: `https://sweeprdeepblock.com/api/test-lab/share-card.svg?score=100&blocked=8&ram=640&ref=${code}`
        },
        stats: store.codes[code]
      },
      {},
      req
    );
  }

  if (req.method === 'GET' && pathname === '/api/referral/status') {
    const code = String(parsedUrl.searchParams.get('code') || '').trim();
    const store = loadReferralsStore();
    const rec = store.codes[code];
    if (!rec) {
      return sendJson(res, 404, { ok: false, error: 'referral_code_not_found' }, {}, req);
    }
    return sendJson(res, 200, { ok: true, zeroEmailMode: true, referral: rec }, {}, req);
  }

  if (req.method === 'POST' && pathname === '/api/referral/redeem') {
    const body = (await readBody(req)) || {};
    const code = String(body.code || body.ref || '').trim();
    const friendDeviceId = String(body.deviceId || getClientIp(req)).trim();
    const store = loadReferralsStore();
    const rec = store.codes[code];
    if (!rec) {
      return sendJson(res, 404, { ok: false, error: 'invalid_referral_code' }, {}, req);
    }
    const friendHash = crypto.createHash('sha256').update(friendDeviceId).digest('hex').slice(0, 16);
    const alreadyRedeemed = store.redemptions.some((r) => r.code === code && r.friendHash === friendHash);
    if (!alreadyRedeemed && friendHash !== rec.ownerHash) {
      store.redemptions.push({
        code,
        friendHash,
        redeemedAt: new Date().toISOString()
      });
      rec.referralsCompleted = (rec.referralsCompleted || 0) + 1;
      rec.bonusProDaysEarned = (rec.bonusProDaysEarned || 0) + 30;
      rec.ramTamerUnlocked = true;
      saveReferralsStore(store);
    }
    return sendJson(
      res,
      200,
      {
        ok: true,
        zeroEmailMode: true,
        code,
        referrerBonusDaysTotal: rec.bonusProDaysEarned,
        refereeReward: {
          trialDaysGranted: 14,
          includesRamTamer: true,
          suiteDiscountUrl: `/order?plan=suite_annual&ref=${encodeURIComponent(code)}`
        }
      },
      {},
      req
    );
  }

  if (req.method === 'GET' && pathname === '/api/test-lab/share-card.svg') {
    const score = Math.max(0, Math.min(100, Number(parsedUrl.searchParams.get('score') || 100)));
    const blocked = Math.max(0, Math.min(8, Number(parsedUrl.searchParams.get('blocked') || 8)));
    const ram = Math.max(50, Math.min(4000, Number(parsedUrl.searchParams.get('ram') || 640)));
    const ref = String(parsedUrl.searchParams.get('ref') || 'verified').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="55%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="44" y="44" width="1112" height="542" rx="28" fill="#0f172a" stroke="#10b981" stroke-width="2" stroke-opacity="0.45"/>
  <text x="88" y="115" fill="#10b981" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" letter-spacing="2">SWEEPR DEEPBLOCK v1.2.7 • VERIFIED MV3 TEST LAB</text>
  <text x="88" y="195" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="900">Browser Protection Score: ${score}/100</text>
  <text x="88" y="250" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="500">${blocked}/8 Ad &amp; Tracker Vectors Blocked • 15µs C++ DNR Latency • &lt;50ms Cookie Auto-Reject</text>
  <g transform="translate(88, 305)">
    <rect width="310" height="140" rx="18" fill="#1e293b" stroke="#334155"/>
    <text x="28" y="52" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="700">MV3 EVASION CHECKS</text>
    <text x="28" y="108" fill="#34d399" font-family="monospace" font-size="44" font-weight="900">${blocked}/8 PASS</text>
  </g>
  <g transform="translate(428, 305)">
    <rect width="310" height="140" rx="18" fill="#1e293b" stroke="#334155"/>
    <text x="28" y="52" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="700">RAM RECLAIMED</text>
    <text x="28" y="108" fill="#38bdf8" font-family="monospace" font-size="44" font-weight="900">${ram} MB</text>
  </g>
  <g transform="translate(768, 305)">
    <rect width="344" height="140" rx="18" fill="#1e293b" stroke="#334155"/>
    <text x="28" y="52" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="18" font-weight="700">ENGINE LATENCY</text>
    <text x="28" y="108" fill="#a78bfa" font-family="monospace" font-size="44" font-weight="900">15µs DNR</text>
  </g>
  <text x="88" y="525" fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="24" font-weight="700">Test your browser in 5 seconds: sweeprdeepblock.com/test-lab?ref=${ref}</text>
</svg>`;
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    return res.end(svg);
  }

  // ============================================================================
  // API -0e: Autonomous CMO Automation Scheduler Status & Trigger (/api/automations/*)
  // ============================================================================
  if (req.method === 'GET' && pathname === '/api/automations/status') {
    const stateFile = path.join(__dirname, 'data', 'automation-scheduler-state.json');
    let persisted = {};
    if (fs.existsSync(stateFile)) {
      try {
        persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } catch {}
    }
    const jobs = (global.__cmoAutomationJobs || []).map((j) => {
      const outAbs = path.join(__dirname, j.outputFile);
      const exists = fs.existsSync(outAbs);
      const mtimeIso = exists ? new Date(fs.statSync(outAbs).mtimeMs).toISOString() : null;
      return {
        id: j.id,
        name: j.name,
        script: j.script,
        intervalHours: +(j.intervalMs / (3600 * 1000)).toFixed(1),
        outputFile: j.outputFile,
        artifactExists: exists,
        artifactLastModifiedAt: mtimeIso,
        lastRunState: persisted[j.id] || { status: exists ? 'ready_on_disk' : 'pending' }
      };
    });
    return sendJson(
      res,
      200,
      {
        ok: true,
        schedulerActive: true,
        zeroEmailPolicyEnforced: true,
        queueLength: (global.__cmoAutomationQueue || []).length,
        currentlyRunningJob: global.__cmoRunningJob || null,
        jobs
      },
      {},
      req
    );
  }

  if (req.method === 'POST' && pathname === '/api/automations/run') {
    const body = (await readBody(req)) || {};
    const targetId = String(body.id || body.jobId || 'all').trim();
    if (typeof global.__enqueueCmoAutomation === 'function') {
      const queued = global.__enqueueCmoAutomation(targetId);
      return sendJson(res, 202, { ok: true, status: 'queued', queuedJobs: queued }, {}, req);
    }
    return sendJson(res, 503, { ok: false, error: 'scheduler_not_initialized' }, {}, req);
  }

  // API 0: Geo-IP & Multi-Currency Pricing
  if (req.method === 'GET' && pathname === '/api/pricing') {
    const localizedPricing = resolvePricingForRequest(req, parsedUrl);
    return sendJson(res, 200, localizedPricing);
  }

  // API 1: Public Checkout Configuration (Matches sweeprcleaner /api/checkout-config)
  if (req.method === 'GET' && pathname === '/api/checkout-config') {
    const localizedPricing = resolvePricingForRequest(req, parsedUrl);
    const validPk = STRIPE_PUBLISHABLE_KEY.startsWith('pk_') ? STRIPE_PUBLISHABLE_KEY : '';
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    return sendJson(res, 200, {
      publishableKey: validPk,
      stripeConfigured,
      elementsEnabled: Boolean(stripeConfigured && validPk),
      country: localizedPricing.country,
      countryFlag: localizedPricing.countryFlag,
      language: localizedPricing.language,
      currency: localizedPricing.currency,
      currencyCode: localizedPricing.currencyCode,
      symbol: localizedPricing.symbol,
      symbolPosition: localizedPricing.symbolPosition,
      zeroDecimal: localizedPricing.zeroDecimal,
      pricing: localizedPricing,
      amountTodayPence: localizedPricing.annualAmount,
      amountRegularPence: localizedPricing.annualAmount,
      amountRecurringPence: localizedPricing.annualAmount,
      plans: {
        annual: {
          amountPence: localizedPricing.annualAmount,
          formatted: localizedPricing.annualFormatted,
          monthlyEqFormatted: localizedPricing.annualMonthlyEqFormatted,
          savingsPercent: localizedPricing.annualSavingsPercent,
          interval: 'year',
          name: 'SWEEPR Deepblock Pro (Annual)',
          label: `Annual Plan (${localizedPricing.annualFormatted}/yr — ${localizedPricing.annualMonthlyEqFormatted}/mo, Save 50%)`
        },
        six_month: {
          amountPence: localizedPricing.sixMonthAmount,
          formatted: localizedPricing.sixMonthFormatted,
          monthlyEqFormatted: localizedPricing.sixMonthMonthlyEqFormatted,
          savingsPercent: localizedPricing.sixMonthSavingsPercent,
          interval: '6 months',
          name: 'SWEEPR Deepblock Pro (6-Month)',
          label: `6-Month Plan (${localizedPricing.sixMonthFormatted}/6mo — ${localizedPricing.sixMonthMonthlyEqFormatted}/mo, Save 25%)`
        },
        monthly: {
          amountPence: localizedPricing.monthlyAmount,
          formatted: localizedPricing.monthlyFormatted,
          introPence: localizedPricing.introMonthlyAmount,
          introAmountPence: localizedPricing.introMonthlyAmount,
          introFormatted: localizedPricing.introMonthlyFormatted,
          introSavingsFormatted: localizedPricing.introSavingsFormatted,
          interval: 'month',
          name: 'SWEEPR Deepblock Pro (Monthly)',
          label: `Monthly Plan (${localizedPricing.monthlyFormatted}/mo)`
        },
        suite_annual: {
          amountPence: localizedPricing.suiteAnnualAmount,
          formatted: localizedPricing.suiteAnnualFormatted,
          standaloneAnchorFormatted: localizedPricing.suiteStandaloneAnchorFormatted,
          monthlyEqFormatted: localizedPricing.suiteAnnualMonthlyEqFormatted,
          savingsPercent: localizedPricing.suiteSavingsPercent,
          interval: 'year',
          includesRamTamer: true,
          includesSuiteApps: ['deepblock_pro', 'sweepr_vpn_pro', 'sweepr_cleaner_pro', 'ram_tamer'],
          name: 'Sweepr Complete Security Suite (Annual Bundle)',
          label: `Complete Security Suite (${localizedPricing.suiteAnnualFormatted}/yr vs ${localizedPricing.suiteStandaloneAnchorFormatted} — Save 45%)`
        }
      },
      addons: {
        ram_tamer: {
          id: 'ram_tamer',
          name: 'Total Tab & RAM Tamer — Browser Speed & Memory Optimizer',
          label: 'Total Tab & RAM Tamer',
          annualPence: localizedPricing.ramTamerAnnualAmount,
          annualAmountPence: localizedPricing.ramTamerAnnualAmount,
          annualFormatted: localizedPricing.ramTamerAnnualFormatted,
          annualMonthlyEqFormatted: localizedPricing.ramTamerAnnualMonthlyEqFormatted,
          sixMonthAmountPence: localizedPricing.ramTamerSixMonthAmount,
          sixMonthFormatted: localizedPricing.ramTamerSixMonthFormatted,
          sixMonthMonthlyEqFormatted: localizedPricing.ramTamerSixMonthMonthlyEqFormatted,
          monthlyPence: localizedPricing.ramTamerMonthlyAmount,
          monthlyAmountPence: localizedPricing.ramTamerMonthlyAmount,
          monthlyFormatted: localizedPricing.ramTamerMonthlyFormatted
        }
      },
      adPixels: {
        uetTagId: (process.env.MICROSOFT_UET_TAG_ID || '343283087').trim(),
        metaPixelId: (process.env.META_PIXEL_ID || '910118314453383').trim(),
        redditPixelId: (process.env.REDDIT_PIXEL_ID || 'a2_jy81fs9ouy2u').trim(),
        openaiPixelId: (process.env.OPENAI_PIXEL_ID || 'DRfCjPsivgeyx2fLbkPzFy').trim()
      }
    });
  }

  // API 1b: Lead Capture when visitor enters email on /order
  if (req.method === 'POST' && pathname === '/api/lead') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });
    }
    if (!checkRateLimit(req, 'lead', 20, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    const email = (body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: 'invalid_email' });
    }
    const safeName = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const localizedPricing = resolvePricingForRequest(req, parsedUrl, body || {});
    const acc = upsertLocalAccount({
      email,
      name: safeName,
      country: localizedPricing.country,
      status: 'lead'
    });
    reportToSweeprCrm('/api/crm/leads?project=deepblock', {
      project_id: 'deepblock',
      email,
      name: safeName || undefined,
      country: localizedPricing.country,
      source: 'order_page'
    });
    return sendJson(res, 200, {
      ok: true,
      account_id: acc.id,
      country: localizedPricing.country
    });
  }

  // API 2: Create Stripe Subscription for On-Page Stripe Elements, Google Pay, Apple Pay & PayPal (Matches sweeprcleaner)
  if (req.method === 'POST' && pathname === '/api/create-subscription') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });
    }
    if (!checkRateLimit(req, 'create_sub', 15, 60000)) {
      return sendJson(res, 429, { error: 'Too many checkout attempts. Please wait a moment and try again.' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    if (!body) return sendJson(res, 400, { error: 'Invalid request body.' });
    if (!STRIPE_SECRET_KEY) return sendJson(res, 503, { error: 'stripe_not_configured' });

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toLowerCase() : 'card';
    const isPayPal = paymentMethod === 'paypal';
    const isRedirectMethod = ['paypal', 'revolut_pay', 'amazon_pay', 'ideal', 'bancontact', 'cashapp', 'kakao_pay', 'naver_pay'].includes(paymentMethod);
    const isApplePayCheckout = paymentMethod === 'apple_pay';
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay' || isApplePayCheckout;
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    if (providedEmail && !isValidEmail(providedEmail)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }
    const email =
      (providedEmail ? providedEmail : null) ||
      (isRedirectMethod || isWallet
        ? `${isRedirectMethod ? paymentMethod : isApplePayCheckout ? 'applepay' : 'wallet'}_${crypto.randomBytes(4).toString('hex')}@pending.sweeprdeepblock.com`
        : null);

    if (!email) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const addressLine1 = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
    const postalCode = typeof body.postcode === 'string' ? body.postcode.trim().slice(0, 32) : '';
    const rawPlan = typeof body.plan === 'string' ? body.plan.toLowerCase() : 'annual';
    const plan =
      rawPlan === 'suite_annual' || rawPlan === 'suite' || rawPlan === 'bundle'
        ? 'suite_annual'
        : rawPlan === 'annual'
        ? 'annual'
        : rawPlan === 'six_month' || rawPlan === '6month' || rawPlan === 'sixmonth'
        ? 'six_month'
        : 'monthly';
    const applyDiscount = Boolean(body.applyDiscount || body.discountApplied) && plan === 'monthly';
    const includeRamTamer = plan === 'suite_annual' || hasRamTamerInBody(body);

    const localizedPricing = resolvePricingForRequest(req, parsedUrl, body);
    const existingAcc = accountsByEmail.get(email);
    const wasAlreadyActive = Boolean(existingAcc && (existingAcc.status === 'active' || existingAcc.status === 'trialing'));
    const canonicalEmail = canonicalizeEmailForDiscount(email);
    const eligibleForIntroDiscount =
      applyDiscount &&
      !wasAlreadyActive &&
      !existingAcc?.introDiscountUsed &&
      !usedIntroDiscountEmails.has(email) &&
      !usedIntroDiscountEmails.has(canonicalEmail);
    const acc = upsertLocalAccount({
      email,
      name,
      country: localizedPricing.country,
      plan,
      ramTamerAddon: includeRamTamer,
      status: 'pending'
    });
    const rawCookieHeader = String(req.headers.cookie || '');
    const cookieRefMatch = rawCookieHeader.match(/(?:^|;\s*)sweepr_ref=([^;]+)/);
    let cookieRef = '';
    if (cookieRefMatch && cookieRefMatch[1]) {
      try { cookieRef = decodeURIComponent(cookieRefMatch[1].trim()); } catch {}
    }
    const refCode = String(
      body.ref ||
      body.affiliate_code ||
      body.referral_code ||
      body.attribution?.ref ||
      parsedUrl.searchParams.get('ref') ||
      parsedUrl.searchParams.get('aff') ||
      cookieRef ||
      ''
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    if (refCode) acc.ref = refCode;

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'checkout_started',
      category: 'funnel',
      account_id: acc.id,
      os: 'web',
      properties: { plan, ramTamerAddon: includeRamTamer, paymentMethod, ...(refCode ? { ref: refCode } : {}) }
    });

    try {
      const metadata = {
        project_id: 'deepblock',
        account_id: acc.id,
        email,
        license_key: acc.licenseKey,
        activation_code: acc.activation_code,
        plan,
        ram_tamer: includeRamTamer ? 'true' : 'false',
        addons: includeRamTamer ? 'ram_tamer' : '',
        country: localizedPricing.country,
        ...(refCode ? { ref: refCode } : {})
      };

      let customerId = acc.stripe_customer_id;
      if (customerId && !wasAlreadyActive) {
        try {
          await stripeRequest('POST', `customers/${encodeURIComponent(customerId)}`, {
            ...(providedEmail ? { email: providedEmail } : {}),
            ...(name ? { name } : {}),
            ...(addressLine1 || postalCode
              ? { address: { line1: addressLine1 || undefined, postal_code: postalCode || undefined } }
              : {}),
            metadata
          });
        } catch (custErr) {
          if (custErr.code === 'resource_missing' || String(custErr.message || '').includes('No such customer')) {
            customerId = null;
          } else {
            throw custErr;
          }
        }
      }

      if (!customerId) {
        const customer = await stripeRequest('POST', 'customers', {
          ...(providedEmail ? { email: providedEmail } : {}),
          ...(name ? { name } : {}),
          ...(addressLine1 || postalCode
            ? { address: { line1: addressLine1 || undefined, postal_code: postalCode || undefined } }
            : {}),
          metadata
        });
        customerId = customer.id;
        if (!wasAlreadyActive) {
          acc.stripe_customer_id = customerId;
        }
      }

      const isSuiteAnnual = plan === 'suite_annual';
      const isAnnual = plan === 'annual' || isSuiteAnnual;
      const isSixMonth = plan === 'six_month';
      const productId = await getStripeProductId();
      const unitAmount = isSuiteAnnual
        ? localizedPricing.suiteAnnualAmount
        : isAnnual
        ? localizedPricing.annualAmount
        : isSixMonth
        ? localizedPricing.sixMonthAmount
        : localizedPricing.monthlyAmount;

      const recurringConfig = isAnnual
        ? { interval: 'year' }
        : isSixMonth
        ? { interval: 'month', interval_count: 6 }
        : { interval: 'month' };

      const subItems = [
        {
          price_data: {
            currency: localizedPricing.currency,
            product: productId,
            unit_amount: unitAmount,
            recurring: recurringConfig
          }
        }
      ];

      if (includeRamTamer && !isSuiteAnnual) {
        const ramProductId = await getStripeRamTamerProductId();
        const addonUnitAmount = isAnnual
          ? localizedPricing.ramTamerAnnualAmount
          : isSixMonth
          ? localizedPricing.ramTamerSixMonthAmount
          : localizedPricing.ramTamerMonthlyAmount;
        subItems.push({
          price_data: {
            currency: localizedPricing.currency,
            product: ramProductId,
            unit_amount: addonUnitAmount,
            recurring: recurringConfig
          }
        });
      }

      const introCouponId =
        !isAnnual && !isSixMonth && eligibleForIntroDiscount
          ? await getOrCreateIntroCoupon(localizedPricing.currency, localizedPricing.introSavingsAmount)
          : '';

      const hostOrigin = resolveTrustedOrigin(req);

      // Apple Pay cross-browser fallback via Stripe Hosted Checkout (supports iOS 18 Apple Pay QR scan on Windows/Chrome & native Apple Pay on iOS/macOS)
      if (isApplePayCheckout) {
        const lineItems = subItems.map((it) => ({
          price_data: it.price_data,
          quantity: 1
        }));
        const sessionParams = {
          mode: 'subscription',
          customer: customerId,
          payment_method_types: ['card'],
          line_items: lineItems,
          ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
          subscription_data: {
            metadata
          },
          metadata,
          success_url: `${hostOrigin}/checkout/success?web=1&session_id={CHECKOUT_SESSION_ID}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`,
          cancel_url: `${hostOrigin}/order`
        };
        const checkoutSession = await stripeRequest('POST', 'checkout/sessions', sessionParams);
        if (!checkoutSession?.url) {
          return sendJson(res, 500, { error: 'Could not initialize Apple Pay checkout session.' });
        }
        return sendJson(res, 200, {
          redirectUrl: checkoutSession.url,
          accountId: acc.id,
          plan,
          livemode: Boolean(checkoutSession.livemode)
        });
      }

      const subParams = {
        customer: customerId,
        items: subItems,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: isRedirectMethod ? [paymentMethod] : ['card']
        },
        ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
        metadata,
        expand: ['latest_invoice.payment_intent', 'latest_invoice.confirmation_secret']
      };

      let subscription = null;
      const subIdempotencyBucket = Math.floor(Date.now() / 15000);
      const subIdempotencyKey = `sub_${acc.id}_${plan}_${includeRamTamer ? 'ram' : 'std'}_${paymentMethod}_${subIdempotencyBucket}`;
      try {
        subscription = await stripeRequest('POST', 'subscriptions', subParams, { idempotencyKey: subIdempotencyKey });
      } catch (subErr) {
        if (isRedirectMethod) {
          const sessionParams = {
            mode: 'subscription',
            customer: customerId,
            managed_payments: { enabled: false },
            line_items: subItems.map((it) => ({
              price_data: it.price_data,
              quantity: 1
            })),
            ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
            subscription_data: {
              metadata
            },
            metadata,
            success_url: `${hostOrigin}/checkout/success?web=1&session_id={CHECKOUT_SESSION_ID}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`,
            cancel_url: `${hostOrigin}/order?error=payment_cancelled`
          };
          const checkoutSession = await stripeRequest('POST', 'checkout/sessions', sessionParams);
          if (checkoutSession?.url) {
            return sendJson(res, 200, {
              redirectUrl: checkoutSession.url,
              subscriptionId: checkoutSession.id,
              accountId: acc.id,
              plan,
              livemode: Boolean(checkoutSession.livemode)
            });
          }
        }
        throw subErr;
      }

      if (!wasAlreadyActive) {
        acc.stripe_subscription_id = subscription.id;
      } else {
        acc.pending_stripe_subscription_id = subscription.id;
      }
      accountsBySubscriptionId.set(subscription.id, acc);

      const latestInvoice = subscription.latest_invoice;
      let paymentIntent = latestInvoice?.payment_intent || null;
      if (typeof paymentIntent === 'string') {
        paymentIntent = await stripeRequest('GET', `payment_intents/${encodeURIComponent(paymentIntent)}`);
      }
      if (!paymentIntent?.id && typeof latestInvoice?.confirmation_secret?.client_secret === 'string') {
        const csSecret = latestInvoice.confirmation_secret.client_secret;
        const piId = csSecret.split('_secret_')[0];
        if (piId) {
          paymentIntent = { id: piId, client_secret: csSecret, livemode: subscription.livemode };
        }
      }

      if (!paymentIntent?.id) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent.' });
      }

      const returnUrl = `${hostOrigin}/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`;

      if (isRedirectMethod) {
        const rawIp = getClientIp(req);
        const validIp =
          !rawIp || rawIp === 'local' || rawIp === '::1' || rawIp === '::ffff:127.0.0.1'
            ? '127.0.0.1'
            : rawIp;
        const confirmedPi = await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method_data: {
            type: paymentMethod,
            ...(providedEmail || name
              ? {
                  billing_details: {
                    ...(providedEmail ? { email: providedEmail } : {}),
                    ...(name ? { name } : {})
                  }
                }
              : {})
          },
          mandate_data: {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: validIp,
                user_agent: req.headers['user-agent'] || 'Mozilla/5.0'
              }
            }
          },
          return_url: returnUrl
        });

        const redirectUrl = confirmedPi.next_action?.redirect_to_url?.url || null;
        if (!redirectUrl) {
          return sendJson(res, 500, { error: 'Could not initialize payment authorization redirect.' });
        }

        return sendJson(res, 200, {
          redirectUrl,
          subscriptionId: subscription.id,
          accountId: acc.id,
          plan,
          livemode: Boolean(confirmedPi.livemode)
        });
      }

      // Test-mode server confirmation fallback if confirmOnServer is requested with a sk_test_ key (tokenized PM only, no raw PAN)
      if (body.confirmOnServer && paymentIntent.livemode === false) {
        const testPm =
          typeof body.testPaymentMethod === 'string' && /^pm_card_/.test(body.testPaymentMethod)
            ? body.testPaymentMethod
            : 'pm_card_visa';

        await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method: testPm,
          return_url: returnUrl
        });
        acc.status = 'active';
        return sendJson(res, 200, {
          redirectUrl: `/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}`,
          subscriptionId: subscription.id,
          accountId: acc.id,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          entitlements: acc.entitlements,
          plan
        });
      }

      const clientSecret = paymentIntent.client_secret || null;
      if (!clientSecret) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent client secret.' });
      }

      return sendJson(res, 200, {
        clientSecret,
        subscriptionId: subscription.id,
        accountId: acc.id,
        plan
      });
    } catch (err) {
      console.error('[create-subscription] Stripe error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Payment initialization failed.' });
    }
  }

  // API 2b: Confirm & Sync On-Page Subscription after Stripe Elements / Google Pay / Apple Pay confirmation
  if (req.method === 'POST' && pathname === '/api/confirm-subscription') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'confirm_sub', 20, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : '';
    const checkOnly = Boolean(body?.checkOnly);
    if (!subscriptionId) return sendJson(res, 400, { error: 'missing_subscription_id' });

    try {
      const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`, {
        expand: ['default_payment_method', 'latest_invoice.payment_intent.payment_method']
      });

      if (sub.status !== 'active' && sub.status !== 'trialing') {
        return sendJson(res, checkOnly ? 200 : 402, {
          ok: false,
          status: sub.status
        });
      }

      const metaAccountId = sub.metadata?.account_id || '';
      const sessionData = verifySessionCookie(req);
      if (!metaAccountId || (accountId !== metaAccountId && sessionData?.sub !== metaAccountId)) {
        return sendJson(res, 403, { error: 'subscription_ownership_mismatch' });
      }
      const metaEmail = sub.metadata?.email || '';
      const metaPlan = sub.metadata?.plan || 'annual';
      const hasRamTamer = sub.metadata?.ram_tamer === 'true' || (sub.metadata?.addons || '').includes('ram_tamer');

      let acc =
        accountsById.get(metaAccountId) ||
        accountsById.get(accountId) ||
        accountsBySubscriptionId.get(subscriptionId) ||
        (metaEmail ? accountsByEmail.get(metaEmail) : null);

      acc = upsertLocalAccount({
        email: acc?.email || metaEmail || 'customer@sweeprdeepblock.com',
        name: acc?.name,
        country: sub.metadata?.country || acc?.country || 'GB',
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        subscriptionId: sub.id,
        plan: metaPlan,
        ramTamerAddon: hasRamTamer,
        status: 'active'
      });
      await syncPayPalCustomerEmail(sub, acc);

      const totalAmount = (sub.items?.data || []).reduce(
        (sum, it) => sum + (it.price?.unit_amount || 0) * (it.quantity || 1),
        0
      );

      if (sub.metadata?.ref) acc.ref = sub.metadata.ref;
      await syncSubscriptionWithSweeprCrm(acc, {
        amountCents: totalAmount || 5999,
        currency: sub.currency || 'gbp',
        ref: sub.metadata?.ref || acc.ref,
        notes: `Stripe Live Subscription ${sub.id} (${acc.licenseKey})`
      });

      const conversionValue = Number(((totalAmount || 5999) / 100).toFixed(2));
      const conversionCurrency = String(sub.currency || 'gbp').toUpperCase();
      const contentIds = [`deepblock_${acc.plan || 'annual'}`, ...(acc.ramTamerAddon ? ['ram_tamer'] : [])];

      if (!checkOnly) {
        reportToSweeprCrm('/v1/telemetry/event', {
          event_name: 'purchase_completed',
          category: 'funnel',
          account_id: acc.crm_account_id || acc.id,
          os: 'web',
          properties: {
            plan: acc.plan,
            ramTamerAddon: acc.ramTamerAddon,
            value: conversionValue,
            currency: conversionCurrency,
            contentIds,
            licenseKey: acc.licenseKey,
            subscriptionId: sub.id
          }
        });

        // Non-blocking OpenAI Conversions API (ads.openai.com) server-side dispatch
        const openAiCapiKey = (process.env.OPENAI_CONVERSIONS_API_KEY || '').trim();
        const openAiPixelId = (process.env.OPENAI_PIXEL_ID || 'DRfCjPsivgeyx2fLbkPzFy').trim();
        const openAiEndpoint = (process.env.OPENAI_CONVERSIONS_ENDPOINT || 'https://ads.openai.com/v1/conversions').trim();
        if (openAiCapiKey && typeof fetch === 'function') {
          const emailHash = acc.email
            ? crypto.createHash('sha256').update(String(acc.email).trim().toLowerCase()).digest('hex')
            : undefined;
          fetch(openAiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openAiCapiKey}`
            },
            body: JSON.stringify({
              pixel_id: openAiPixelId,
              data: [
                {
                  event_name: 'Purchase',
                  event_time: Math.floor(Date.now() / 1000),
                  event_id: sub.id,
                  action_source: 'website',
                  event_source_url: `${PUBLIC_URL}/order`,
                  user_data: {
                    em: emailHash ? [emailHash] : undefined,
                    client_ip_address: getClientIp(req),
                    client_user_agent: req.headers['user-agent'] || undefined
                  },
                  custom_data: {
                    value: conversionValue,
                    currency: conversionCurrency,
                    plan: acc.plan,
                    ram_tamer: Boolean(acc.ramTamerAddon),
                    content_ids: contentIds,
                    content_type: 'product'
                  }
                }
              ]
            })
          }).catch(() => {});
        }
      }

      const sessionToken = signSessionCookie(acc.id, acc.email);
      const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
      return sendJson(
        res,
        200,
        {
          ok: true,
          status: sub.status,
          subscriptionId: sub.id,
          accountId: acc.id,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          entitlements: acc.entitlements,
          plan: acc.plan,
          ramTamerAddon: Boolean(acc.ramTamerAddon),
          conversionValue,
          currency: conversionCurrency,
          contentIds,
          redirect: `/checkout/success?web=1&subscription_id=${encodeURIComponent(subscriptionId)}&account_id=${encodeURIComponent(acc.id)}`
        },
        {
          'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
        }
      );
    } catch (err) {
      console.error('[confirm-subscription] error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Verification failed' });
    }
  }

  // API 2b-capi: OpenAI Conversions API & Multi-Platform Server-Side Purchase Relay
  if (req.method === 'POST' && pathname === '/api/conversions/openai') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'capi_openai', 30, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    const eventName = String(body?.event_name || 'Purchase').slice(0, 64);
    const eventId = String(body?.event_id || `ord_${Date.now()}`).slice(0, 128);
    const value = Number(body?.value) > 0 ? Number(Number(body.value).toFixed(2)) : 59.99;
    const currency = String(body?.currency || 'GBP').toUpperCase().slice(0, 8);
    const plan = String(body?.plan || 'annual').slice(0, 32);
    const ramTamer = Boolean(body?.ram_tamer);
    const contentIds = Array.isArray(body?.content_ids)
      ? body.content_ids.slice(0, 5).map((x) => String(x).slice(0, 64))
      : [`deepblock_${plan}`, ...(ramTamer ? ['ram_tamer'] : [])];

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'ad_conversion_dispatched',
      category: 'marketing',
      os: 'web',
      properties: {
        platforms: ['ga4', 'microsoft_uet', 'meta_pixel', 'reddit_pixel', 'openai_capi'],
        event_name: eventName,
        event_id: eventId,
        value,
        currency,
        plan,
        ramTamerAddon: ramTamer,
        contentIds
      }
    });

    // Server-side GA4 purchase hit relay (ensures 100% conversion attribution even when client adblockers are active)
    try {
      const gaCookieMatch = String(req.headers.cookie || '').match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
      const cid = gaCookieMatch
        ? gaCookieMatch[1]
        : `${Math.abs(crypto.createHash('sha256').update(getClientIp(req) + String(req.headers['user-agent'] || '')).digest().readInt32BE(0))}.${Math.floor(Date.now() / 1000)}`;
      const gaParams = new URLSearchParams({
        v: '2',
        tid: 'G-01MNBQSL9K',
        cid,
        en: 'purchase',
        'ep.transaction_id': eventId,
        'ep.currency': currency,
        'epn.value': String(value),
        'ep.plan': plan,
        'ep.ram_tamer': String(ramTamer),
        dl: `${PUBLIC_URL}/checkout/success`,
        dt: 'SWEEPR Deepblock Pro Purchase',
        _uip: getClientIp(req)
      });
      fetch(`https://region1.google-analytics.com/g/collect?${gaParams.toString()}`, {
        method: 'POST',
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
          'X-Forwarded-For': getClientIp(req)
        },
        signal: AbortSignal.timeout(3000)
      }).catch(() => {});
    } catch {}

    const openAiCapiKey = (process.env.OPENAI_CONVERSIONS_API_KEY || '').trim();
    const openAiPixelId = (process.env.OPENAI_PIXEL_ID || 'DRfCjPsivgeyx2fLbkPzFy').trim();
    const openAiEndpoint = (process.env.OPENAI_CONVERSIONS_ENDPOINT || 'https://ads.openai.com/v1/conversions').trim();
    if (openAiCapiKey && typeof fetch === 'function') {
      fetch(openAiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiCapiKey}`
        },
        body: JSON.stringify({
          pixel_id: openAiPixelId,
          data: [
            {
              event_name: eventName,
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              action_source: 'website',
              event_source_url: `${PUBLIC_URL}/order`,
              user_data: {
                client_ip_address: getClientIp(req),
                client_user_agent: req.headers['user-agent'] || undefined
              },
              custom_data: {
                value,
                currency,
                plan,
                ram_tamer: ramTamer,
                content_ids: contentIds,
                content_type: 'product'
              }
            }
          ]
        })
      }).catch(() => {});
    }

    return sendJson(res, 200, {
      ok: true,
      event_id: eventId,
      value,
      currency,
      plan,
      ram_tamer: ramTamer
    });
  }

  // API 2c: Legacy /api/web-checkout endpoint (Disabled in live production unless ALLOW_DEV_MOCK_CHECKOUT=1)
  if (req.method === 'POST' && pathname === '/api/web-checkout') {
    if (IS_LIVE_STRIPE || !ALLOW_DEV_MOCK_CHECKOUT) {
      return sendJson(res, 403, { ok: false, error: 'legacy_checkout_disabled_use_stripe' });
    }
    const data = await readBody(req);
    if (!data || data.__tooLarge) {
      return sendJson(res, 400, { ok: false, error: 'Invalid checkout request' });
    }
    const email = (data.email || 'customer@example.com').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_email' });
    }
    const plan = data.plan || 'annual';
    const ramTamerAddon = hasRamTamerInBody(data);

    const acc = upsertLocalAccount({
      email,
      plan,
      ramTamerAddon,
      status: 'active'
    });

    return sendJson(res, 200, {
      ok: true,
      licenseKey: acc.licenseKey,
      activation_code: acc.activation_code,
      plan: acc.plan,
      ramTamerAddon: acc.ramTamerAddon,
      entitlements: acc.entitlements,
      status: acc.status
    });
  }

  // API 2d: Live Stripe Webhook Handler (/webhooks/stripe, /api/webhook/stripe, /api/webhooks/stripe)
  if (
    req.method === 'POST' &&
    (pathname === '/webhooks/stripe' || pathname === '/api/webhook/stripe' || pathname === '/api/webhooks/stripe')
  ) {
    let rawBody;
    try {
      rawBody = await readRawBody(req, 256 * 1024);
    } catch {
      return sendJson(res, 413, { error: 'payload_too_large' });
    }
    const sig = req.headers['stripe-signature'] || '';
    if (!STRIPE_WEBHOOK_SECRET) {
      return sendJson(res, 503, { error: 'webhook_secret_not_configured' });
    }
    if (!verifyStripeWebhookSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
      sliMetrics.webhookSignatureFailures += 1;
      if (sliMetrics.webhookSignatureFailures % 5 === 0) {
        reportToSweeprCrm('/v1/telemetry/event', {
          event_name: 'webhook_signature_alert',
          category: 'incident',
          os: 'server',
          properties: { failures: sliMetrics.webhookSignatureFailures }
        });
      }
      return sendJson(res, 400, { error: 'invalid_signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return sendJson(res, 400, { error: 'invalid_json' });
    }

    if (event.id && processedWebhookEventIds.has(event.id)) {
      return sendJson(res, 200, { received: true, deduplicated: true });
    }

    try {
      const obj = event?.data?.object || {};
      let syncedViaApi = false;
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        if (obj.status !== 'incomplete' && obj.status !== 'incomplete_expired') {
          const subStatus = obj.status === 'active' || obj.status === 'trialing' ? 'active' : obj.status || 'canceled';
          const metaEmail = obj.metadata?.email || '';
          const metaPlan = obj.metadata?.plan || 'annual';
          const hasRamTamer = obj.metadata?.ram_tamer === 'true' || (obj.metadata?.addons || '').includes('ram_tamer');
          if (metaEmail || obj.id) {
            const syncedAcc = upsertLocalAccount({
              email: metaEmail || `${obj.id}@stripe.sweeprdeepblock.com`,
              stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
              subscriptionId: obj.id,
              plan: metaPlan,
              ramTamerAddon: hasRamTamer,
              status: subStatus
            });
            syncedAcc.cancelAtPeriodEnd = Boolean(obj.cancel_at_period_end);
            await syncPayPalCustomerEmail(obj, syncedAcc);
            if (obj.metadata?.ref) syncedAcc.ref = obj.metadata.ref;
            await syncSubscriptionWithSweeprCrm(syncedAcc, {
              currency: obj.currency || 'gbp',
              ref: obj.metadata?.ref || syncedAcc.ref,
              notes: `Stripe Webhook (${event.type}) ${obj.id}`
            });
            syncedViaApi = true;
          }
        }
      } else if (event.type === 'checkout.session.completed' && obj.subscription) {
        const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
        if (subId && STRIPE_SECRET_KEY) {
          const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subId)}`, {
            expand: ['default_payment_method', 'latest_invoice.payment_intent.payment_method']
          }).catch(() => null);
          if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
            const customerEmail =
              obj.customer_details?.email || obj.customer_email || sub.metadata?.email || `${sub.id}@stripe.sweeprdeepblock.com`;
            const syncedAcc = upsertLocalAccount({
              email: customerEmail,
              name: obj.customer_details?.name || undefined,
              stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
              subscriptionId: sub.id,
              plan: sub.metadata?.plan || obj.metadata?.plan || 'annual',
              ramTamerAddon: sub.metadata?.ram_tamer === 'true' || obj.metadata?.ram_tamer === 'true',
              status: 'active'
            });
            await syncPayPalCustomerEmail(sub, syncedAcc);
            if (sub.metadata?.ref || obj.metadata?.ref) syncedAcc.ref = sub.metadata?.ref || obj.metadata?.ref;
            await syncSubscriptionWithSweeprCrm(syncedAcc, {
              currency: sub.currency || 'gbp',
              ref: syncedAcc.ref,
              notes: `Stripe Checkout Session Completed (${sub.id})`
            });
            syncedViaApi = true;
          }
        }
      }
      // Forward raw webhook to central sweepr-crm only for event types not already synced via syncSubscriptionWithSweeprCrm
      if (!syncedViaApi) {
        fetch(`${SWEEPR_CRM_URL}/api/webhooks/stripe/deepblock`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(sig ? { 'stripe-signature': sig } : {})
          },
          body: rawBody,
          signal: AbortSignal.timeout(4000)
        })
          .then((r) => {
            if (!r.ok) enqueueCrmDlq({ type: 'raw_webhook', rawBody, sig });
          })
          .catch(() => {
            enqueueCrmDlq({ type: 'raw_webhook', rawBody, sig });
          });
      }
      if (event.id) markWebhookEventProcessed(event.id);
    } catch (err) {
      console.error('[webhooks/stripe] handler error:', err.message);
    }

    return sendJson(res, 200, { received: true });
  }

  // Checkout Success & Cancel Pages
  if (req.method === 'GET' && pathname === '/checkout/success') {
    if (!checkRateLimit(req, 'checkout_success', 30, 60000)) {
      return sendErrorResponse(res, 429, '429 Too Many Requests');
    }
    let subscriptionId = (parsedUrl.searchParams.get('subscription_id') || '').trim();
    const checkoutSessionId = (parsedUrl.searchParams.get('session_id') || '').trim();
    const accountId = (parsedUrl.searchParams.get('account_id') || '').trim();
    const redirectStatus = (parsedUrl.searchParams.get('redirect_status') || '').trim();
    const sessionData = verifySessionCookie(req);

    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      res.writeHead(302, { Location: '/order?error=payment_cancelled' });
      return res.end();
    }

    if (!subscriptionId && checkoutSessionId && STRIPE_SECRET_KEY) {
      try {
        const cs = await stripeRequest('GET', `checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
        if (cs && cs.subscription) {
          subscriptionId = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription.id;
        }
      } catch {}
    }

    let acc = (accountId ? accountsById.get(accountId) : null) || null;
    if (subscriptionId && STRIPE_SECRET_KEY) {
      try {
        const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`, {
          expand: ['default_payment_method', 'latest_invoice.payment_intent.payment_method']
        });
        if (sub.status !== 'active' && sub.status !== 'trialing') {
          res.writeHead(302, { Location: '/order?error=payment_cancelled' });
          return res.end();
        }
        const metaAccountId = sub.metadata?.account_id || '';
        if (!metaAccountId || (accountId !== metaAccountId && sessionData?.sub !== metaAccountId)) {
          res.writeHead(302, { Location: '/login?error=verify_required' });
          return res.end();
        }
        acc = upsertLocalAccount({
          email: acc?.email || sub.metadata?.email || 'customer@sweeprdeepblock.com',
          plan: sub.metadata?.plan || acc?.plan || 'annual',
          ramTamerAddon: sub.metadata?.ram_tamer === 'true' || acc?.ramTamerAddon,
          subscriptionId: sub.id,
          status: 'active'
        });
        await syncPayPalCustomerEmail(sub, acc);
        if (sub.metadata?.ref) acc.ref = sub.metadata.ref;
        await syncSubscriptionWithSweeprCrm(acc, {
          currency: sub.currency || 'gbp',
          ref: sub.metadata?.ref || acc.ref,
          notes: `Checkout Success Verified ${sub.id} (${acc.licenseKey})`
        });
      } catch {}
    } else if (acc && acc.status === 'active' && (accountId === acc.id || sessionData?.sub === acc.id)) {
      await syncSubscriptionWithSweeprCrm(acc);
    } else {
      acc = null;
    }

    if (!acc || acc.status !== 'active') {
      res.writeHead(302, { Location: '/order?error=payment_incomplete' });
      return res.end();
    }

    return sendHtml(res, 200, renderCheckoutSuccessPage(acc, false));
  }

  if (req.method === 'GET' && pathname === '/checkout/cancel') {
    return sendHtml(res, 200, renderCheckoutSuccessPage(null, true));
  }

  // API 3a: Multi-Project Device Licensing Bridge (/v1/license/activate & /v1/license/refresh -> Central SWEEPR CRM)
  if ((pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    if (!checkRateLimit(req, 'license_activate', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const crmRes =
      pathname === '/v1/license/refresh'
        ? await crm.refreshLicense({
            accountId: body?.account_id,
            refreshToken: body?.refresh_token,
            deviceId: body?.device_id,
            appVersion: body?.app_version
          })
        : await crm.activateDevice({
            email: body?.email,
            otp: body?.otp || body?.activation_code || body?.refresh_token,
            accountId: body?.account_id,
            refreshToken: body?.refresh_token,
            deviceId: body?.device_id || `ext_db_${Date.now()}`,
            deviceName: body?.device_name || 'SWEEPR Deepblock Extension',
            os: body?.os || 'browser_extension',
            appVersion: body?.app_version || '1.0.0'
          });
    if (crmRes.ok) {
      return sendJson(res, 200, crmRes.data);
    }
    return sendJson(res, crmRes.status || 401, crmRes.data);
  }

  // API 3: Extension License Verification (Central SWEEPR CRM authoritative check + Ed25519 JWS + live Stripe fallback)
  if (
    (pathname === '/api/license-verify' || pathname === '/v1/license/verify-key') &&
    (req.method === 'GET' || req.method === 'POST')
  ) {
    if (!checkRateLimit(req, 'license_verify', 30, 60000)) {
      return sendJson(res, 429, { valid: false, error: 'rate_limit_exceeded' });
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (body && body.__tooLarge) return sendJson(res, 413, { valid: false, error: 'payload_too_large' });
    const key = String(body?.key || parsedUrl.searchParams.get('key') || '').trim();
    const deviceId = String(body?.device_id || parsedUrl.searchParams.get('device_id') || '').trim().slice(0, 128);
    const deviceName = String(body?.device_name || parsedUrl.searchParams.get('device_name') || '').trim().slice(0, 80);
    const platform = String(body?.platform || parsedUrl.searchParams.get('platform') || 'browser_extension').trim().slice(0, 32);
    if (!key || key.length < 6 || key.length > 512 || key.includes('@') || key.startsWith('acc_') || key.startsWith('sub_') || key.startsWith('cus_')) {
      return sendJson(res, 400, { valid: false, error: 'invalid_key_format' });
    }

    // 1. Offline Ed25519 JWS token verification if key is a compact JWS token
    if (key.split('.').length === 3 && crm.publicKeySpki) {
      const offline = crm.verifyLicenseTokenOffline(key, deviceId || undefined);
      if (offline.valid && offline.claims) {
        const hasRamTamer =
          Array.isArray(offline.claims.addons) &&
          (offline.claims.addons.includes('ram_tamer') || offline.claims.addons.includes('sweepr_secure_bundle'));
        return sendJson(res, 200, {
          valid: true,
          project_id: 'deepblock',
          licenseKey: key,
          plan: offline.claims.plan || 'annual',
          ramTamerAddon: hasRamTamer,
          entitlements: buildDeepblockEntitlements(hasRamTamer),
          status: offline.claims.status || 'active'
        });
      }
    }

    // 2. Central SWEEPR CRM authoritative verification (supports 6-digit activation_code, DEEPBLOCK-xxxxxx, SWEEPR-DB-...)
    const crmVerify = await crm.verifyKey(key, deviceId);
    if (crmVerify.status === 403 && crmVerify.data?.error === 'device_limit_reached') {
      return sendJson(res, 403, {
        valid: false,
        error: 'device_limit_reached',
        message: crmVerify.data.message || 'Device limit reached for this license key.'
      });
    }
    if (crmVerify.ok && crmVerify.data && typeof crmVerify.data.valid === 'boolean') {
      const crmStatus = String(crmVerify.data.status || 'active').toLowerCase();
      if (crmVerify.data.valid && (crmStatus === 'active' || crmStatus === 'trialing')) {
        const addonsList = Array.isArray(crmVerify.data.addons) ? crmVerify.data.addons : [];
        const hasRamTamer =
          Boolean(crmVerify.data.ramTamerAddon) ||
          addonsList.includes('ram_tamer') ||
          addonsList.includes('sweepr_secure_bundle');
        const localRec = licenses.get(key) || licenses.get(key.toUpperCase()) || null;
        if (localRec) {
          const seatCheck = registerLocalDeviceForAccount(localRec, deviceId, { deviceName, platform });
          if (!seatCheck.ok) {
            return sendJson(res, 403, {
              valid: false,
              error: 'device_limit_reached',
              message: `Device limit reached (${seatCheck.max} devices max).`,
              devices_used: seatCheck.used,
              devices_max: seatCheck.max,
              devices: seatCheck.devices
            });
          }
        }
        return sendJson(res, 200, {
          valid: true,
          project_id: 'deepblock',
          account_id: crmVerify.data.account_id || localRec?.id,
          activation_code: crmVerify.data.activation_code || localRec?.activation_code,
          licenseKey: crmVerify.data.licenseKey || crmVerify.data.license_key || localRec?.licenseKey || key,
          plan: crmVerify.data.plan || localRec?.plan,
          ramTamerAddon: hasRamTamer,
          addons: addonsList,
          entitlements: buildDeepblockEntitlements(hasRamTamer),
          status: crmStatus,
          cancelAtPeriodEnd: Boolean(crmVerify.data.cancelAtPeriodEnd || crmVerify.data.cancel_at_period_end),
          expiresAt: crmVerify.data.expiresAt,
          token: crmVerify.data.token,
          devices_used: localRec ? localRec.devices.size : 1,
          devices_max: MAX_DEVICES_PER_LICENSE,
          devices: localRec ? listAccountDevices(localRec) : []
        });
      }
      if (crmStatus === 'canceled' || crmStatus === 'expired' || crmStatus === 'unpaid' || crmStatus === 'past_due') {
        return sendJson(res, 403, { valid: false, status: crmStatus, error: 'subscription_inactive' });
      }
    }

    let record = licenses.get(key) || licenses.get(key.toUpperCase());
    const negExpiresAt = negativeLicenseCache.get(key.toUpperCase());
    if (!record && negExpiresAt && Date.now() < negExpiresAt) {
      return sendJson(res, 404, { valid: false, error: 'license_not_found' });
    }

    // 3. Stateless live Stripe fallback if server restarted and CRM was unreachable during checkout (60s rate-guarded cache)
    if (!record && STRIPE_SECRET_KEY && /^(?:\d{6}|[A-Z0-9-]{8,64})$/i.test(key)) {
      try {
        const activeSubs = await getCachedActiveStripeSubs();
        const matchedSub = activeSubs.find(
          (s) =>
            (s.metadata?.license_key && s.metadata.license_key.toUpperCase() === key.toUpperCase()) ||
            (s.metadata?.activation_code && (s.metadata.activation_code === key || key.toUpperCase().endsWith(s.metadata.activation_code)))
        );
        if (matchedSub) {
          record = upsertLocalAccount({
            email: matchedSub.metadata?.email || `${matchedSub.id}@stripe.sweeprdeepblock.com`,
            stripeCustomerId: typeof matchedSub.customer === 'string' ? matchedSub.customer : matchedSub.customer?.id,
            subscriptionId: matchedSub.id,
            plan: matchedSub.metadata?.plan || 'annual',
            ramTamerAddon: matchedSub.metadata?.ram_tamer === 'true',
            status: 'active'
          });
          if (matchedSub.metadata?.license_key) {
            record.licenseKey = matchedSub.metadata.license_key;
            licenses.set(record.licenseKey, record);
          }
          await syncSubscriptionWithSweeprCrm(record, {
            currency: matchedSub.currency || 'gbp',
            notes: `Auto-synced from live Stripe during key verification (${record.licenseKey})`
          });
        } else {
          if (negativeLicenseCache.size >= 2000) {
            const firstKey = negativeLicenseCache.keys().next().value;
            if (firstKey) negativeLicenseCache.delete(firstKey);
          }
          negativeLicenseCache.set(key.toUpperCase(), Date.now() + 60000);
        }
      } catch {}
    }

    if (record) {
      // Ensure local record is synced to central CRM if CRM wasn't aware of it yet
      if (crmVerify.ok && crmVerify.data?.error === 'key_not_found' && (record.status === 'active' || record.status === 'trialing')) {
        await syncSubscriptionWithSweeprCrm(record);
      }

      // If tied to a Stripe subscription, verify live that the subscription is still active/paid
      if (record.stripe_subscription_id && STRIPE_SECRET_KEY) {
        try {
          const liveSub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(record.stripe_subscription_id)}`);
          if (liveSub.status !== 'active' && liveSub.status !== 'trialing') {
            record.status = liveSub.status || 'canceled';
            return sendJson(res, 403, {
              valid: false,
              status: record.status,
              error: 'subscription_inactive'
            });
          }
          record.status = 'active';
        } catch {}
      }

      if (record.status === 'active' || record.status === 'trialing') {
        const seatCheck = registerLocalDeviceForAccount(record, deviceId, { deviceName, platform });
        if (!seatCheck.ok) {
          return sendJson(res, 403, {
            valid: false,
            error: 'device_limit_reached',
            message: `Device limit reached (${seatCheck.max} devices max).`,
            devices_used: seatCheck.used,
            devices_max: seatCheck.max,
            devices: seatCheck.devices
          });
        }
        return sendJson(res, 200, {
          valid: true,
          project_id: 'deepblock',
          account_id: record.id,
          activation_code: record.activation_code,
          licenseKey: record.licenseKey,
          plan: record.plan,
          ramTamerAddon: Boolean(record.ramTamerAddon),
          entitlements: record.entitlements,
          status: record.status,
          devices_used: record.devices.size,
          devices_max: MAX_DEVICES_PER_LICENSE,
          devices: listAccountDevices(record)
        });
      }
      return sendJson(res, 403, { valid: false, status: record.status, error: 'subscription_inactive' });
    }
    return sendJson(res, 404, { valid: false, error: 'license_not_found' });
  }

  // API 3b-0: Customer Portal Login & 6-Digit OTP Send (Checks that email is already signed up before sending 6-digit OTP)
  if (
    req.method === 'POST' &&
    (pathname === '/api/portal-login' || pathname === '/api/auth/send-otp' || pathname === '/v1/account/send-otp')
  ) {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, otpSent: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'portal_login', 10, 60000)) {
      return sendJson(res, 429, {
        ok: false,
        otpSent: false,
        error: 'Too many login attempts. Please wait a minute and try again.'
      });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, otpSent: false, error: 'payload_too_large' });
    const email = String(body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, {
        ok: false,
        otpSent: false,
        error: 'Please enter a valid email address.'
      });
    }
    if (!checkRateLimit(req, `portal_login_email:${email}`, 5, 900000)) {
      return sendJson(res, 429, {
        ok: false,
        otpSent: false,
        error: 'Too many codes requested for this email. Please wait 15 minutes.'
      });
    }

    // 1. Check if the email is already signed up locally (active/trialing subscription, NOT an unpaid checkout lead/pending draft)
    let localAcc = accountsByEmail.get(email) || null;
    let isSignedUp = Boolean(localAcc && (localAcc.status === 'active' || localAcc.status === 'trialing'));

    // 2. If not active in local cache, check live Stripe subscriptions for this email before requesting OTP
    if (!isSignedUp && STRIPE_SECRET_KEY) {
      try {
        const activeSubs = await getCachedActiveStripeSubs();
        let matchedSub = activeSubs.find((s) => (s.metadata?.email || '').trim().toLowerCase() === email);
        if (!matchedSub) {
          const custList = await stripeRequest('GET', 'customers', { email, limit: 5 });
          const activeCusts = (custList.data || []).filter((c) => !c.deleted);
          const subLists = await Promise.all(
            activeCusts.map((cust) =>
              stripeRequest('GET', 'subscriptions', { customer: cust.id, status: 'all', limit: 5 }).catch(() => ({ data: [] }))
            )
          );
          for (const subs of subLists) {
            const activeSub = (subs.data || []).find(
              (s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
            );
            if (activeSub) {
              matchedSub = activeSub;
              break;
            }
          }
        }
        if (matchedSub) {
          localAcc = upsertLocalAccount({
            email,
            stripeCustomerId: typeof matchedSub.customer === 'string' ? matchedSub.customer : matchedSub.customer?.id,
            subscriptionId: matchedSub.id,
            plan: matchedSub.metadata?.plan || 'annual',
            ramTamerAddon: matchedSub.metadata?.ram_tamer === 'true',
            status: 'active',
            ...(matchedSub.metadata?.activation_code ? { activationCode: matchedSub.metadata.activation_code } : {}),
            ...(matchedSub.metadata?.license_key ? { licenseKey: matchedSub.metadata.license_key } : {})
          });
          isSignedUp = true;
        }
      } catch {}
    }

    // 3. Request OTP from central sweepr_crm (which also verifies the email is already signed up before sending a 6-digit OTP)
    let crmOtpSent = false;
    let crmReachable = false;
    try {
      const crmRes = await crm.sendOtp(email);
      if (crmRes && crmRes.status && crmRes.status < 500) {
        crmReachable = true;
        if (crmRes.ok && (crmRes.data?.otpSent || crmRes.data?.ok)) {
          crmOtpSent = true;
        } else if (crmRes.status === 404 && isSignedUp && localAcc) {
          // Sync local active subscription to CRM and retry OTP send
          await syncSubscriptionWithSweeprCrm(localAcc);
          const retryRes = await crm.sendOtp(email);
          if (retryRes && retryRes.ok && (retryRes.data?.otpSent || retryRes.data?.ok)) {
            crmOtpSent = true;
          }
        }
      }
    } catch {}

    if (!crmOtpSent && (!isSignedUp || crmReachable)) {
      return sendJson(res, 404, {
        ok: false,
        otpSent: false,
        error: 'No account found for this email address. Please sign up first or check your email.'
      });
    }

    return sendJson(res, 200, { ok: true, otpSent: true });
  }

  // API 3b-1: Customer Portal 6-Digit Login Code / OTP Verification
  if (
    req.method === 'POST' &&
    (pathname === '/api/verify-otp' || pathname === '/api/auth/verify-otp' || pathname === '/v1/account/verify-otp')
  ) {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'verify_otp', 10, 60000)) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many verification attempts. Please wait a minute and try again.'
      });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const email = String(body?.email || '').trim().toLowerCase();
    const code = String(body?.code || body?.otp || body?.key || '').trim();
    if (!isValidEmail(email) || (!/^\d{6}$/.test(code) && !HIGH_ENTROPY_LICENSE_KEY_RE.test(code))) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid or expired 6-digit login code.'
      });
    }
    if (!checkRateLimit(req, `verify_otp_email:${email}`, 8, 900000)) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many verification attempts for this email. Please wait 15 minutes.'
      });
    }

    const portalDeviceId = `portal_db_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 12)}`;
    let localAcc = accountsByEmail.get(email) || null;
    let crmReachable = false;
    let verifiedData = null;

    // 1. Verify against central SWEEPR CRM (supports 6-digit email OTP, 6-digit activation_code, or license key)
    try {
      const otpVerify = await crm.verifyOtp({
        email,
        code,
        deviceId: portalDeviceId,
        platform: 'web',
        deviceLabel: 'SWEEPR Deepblock Portal'
      });
      if (otpVerify && otpVerify.status && otpVerify.status < 500) {
        crmReachable = true;
        if (otpVerify.ok && otpVerify.data?.ok) {
          const d = otpVerify.data;
          const addonsList = Array.isArray(d.addons) ? d.addons : [];
          const hasRamTamer =
            Boolean(d.ramTamerAddon) ||
            addonsList.includes('ram_tamer') ||
            addonsList.includes('sweepr_secure_bundle');
          localAcc = upsertLocalAccount({
            email,
            plan: d.plan || localAcc?.plan || 'annual',
            ramTamerAddon: hasRamTamer,
            status: d.active || d.status === 'active' || d.status === 'trialing' ? 'active' : d.status || 'active',
            ...(d.activation_code ? { activationCode: String(d.activation_code) } : {}),
            ...(d.licenseKey || d.license_key ? { licenseKey: String(d.licenseKey || d.license_key) } : {})
          });
          if (localAcc.activation_code) licenses.set(localAcc.activation_code, localAcc);
          if (localAcc.licenseKey) licenses.set(localAcc.licenseKey, localAcc);
          verifiedData = {
            ok: true,
            account_id: d.account_id || localAcc.id,
            email,
            status: localAcc.status,
            plan: localAcc.plan,
            activation_code: localAcc.activation_code,
            licenseKey: localAcc.licenseKey,
            ramTamerAddon: Boolean(localAcc.ramTamerAddon),
            entitlements: localAcc.entitlements,
            cancelAtPeriodEnd: Boolean(localAcc.cancelAtPeriodEnd)
          };
        }
      }

      if (!verifiedData) {
        const crmLookup = await crm.portalLookup(email, code);
        if (crmLookup && crmLookup.status && crmLookup.status < 500) {
          crmReachable = true;
          if (crmLookup.ok && crmLookup.data?.ok) {
            const d = crmLookup.data;
            const hasRamTamer = Boolean(d.ramTamerAddon);
            localAcc = upsertLocalAccount({
              email,
              plan: d.plan || localAcc?.plan || 'annual',
              ramTamerAddon: hasRamTamer,
              status: d.status || 'active',
              ...(d.activation_code ? { activationCode: String(d.activation_code) } : {}),
              ...(d.licenseKey || d.license_key ? { licenseKey: String(d.licenseKey || d.license_key) } : {})
            });
            localAcc.cancelAtPeriodEnd = Boolean(d.cancelAtPeriodEnd || d.cancel_at_period_end);
            verifiedData = {
              ok: true,
              account_id: d.account_id || localAcc.id,
              email,
              status: localAcc.status,
              plan: localAcc.plan,
              activation_code: localAcc.activation_code,
              licenseKey: localAcc.licenseKey,
              ramTamerAddon: hasRamTamer,
              entitlements: buildDeepblockEntitlements(hasRamTamer),
              cancelAtPeriodEnd: localAcc.cancelAtPeriodEnd,
              expiresAt: d.expiresAt
            };
          }
        }
      }
    } catch {}

    // 2. Fallback to local active account verification when CRM is unreachable or matches high-entropy license key
    if (
      !verifiedData &&
      localAcc &&
      (localAcc.status === 'active' || localAcc.status === 'trialing') &&
      (!crmReachable || HIGH_ENTROPY_LICENSE_KEY_RE.test(code)) &&
      verifyLocalAccountKeyOrCode(localAcc, code, { allowShortCode: !localAcc.isSeededAccount })
    ) {
      verifiedData = {
        ok: true,
        account_id: localAcc.id,
        email: localAcc.email,
        status: localAcc.status,
        plan: localAcc.plan,
        activation_code: localAcc.activation_code,
        licenseKey: localAcc.licenseKey,
        ramTamerAddon: Boolean(localAcc.ramTamerAddon),
        entitlements: localAcc.entitlements,
        cancelAtPeriodEnd: Boolean(localAcc.cancelAtPeriodEnd)
      };
    }

    if (!verifiedData) {
      return sendJson(res, 401, {
        ok: false,
        error: 'Invalid or expired 6-digit login code.'
      });
    }

    const sessionToken = signSessionCookie(verifiedData.account_id, email);
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      {
        ...verifiedData,
        devices_used: localAcc && localAcc.devices instanceof Set ? localAcc.devices.size : 0,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: localAcc ? listAccountDevices(localAcc) : [],
        redirect: '/login?verified=1'
      },
      {
        'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
      }
    );
  }

  // API 3b-1b: Customer Portal Logout & Session Revocation
  if (req.method === 'POST' && (pathname === '/api/logout' || pathname === '/api/auth/logout')) {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    revokeSessionCookie(req);
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      { ok: true },
      {
        'Set-Cookie': `sweepr_session=; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=0`
      }
    );
  }

  // API 3b: Customer Portal Subscription Lookup & 1-Click Auto-Renewal Cancellation (Delegated to Central SWEEPR CRM)
  if (req.method === 'POST' && pathname === '/api/portal/lookup') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'portal_lookup', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const rawLookup = String(body?.lookup || body?.email || '').trim();
    const keyOrCode = String(body?.key || body?.code || body?.otp || '').trim();
    const effectiveLookup = rawLookup || keyOrCode;
    if (!effectiveLookup || effectiveLookup.length > 254) {
      return sendJson(res, 400, { ok: false, error: 'lookup_required' });
    }
    if (!checkRateLimit(req, `portal_target:${effectiveLookup.toLowerCase()}`, 8, 900000)) {
      return sendJson(res, 429, { ok: false, error: 'Too many attempts for this account. Please wait 15 minutes.' });
    }
    const isEmail = effectiveLookup.includes('@');
    if (isEmail && (!keyOrCode || keyOrCode.includes('@'))) {
      return sendJson(res, 401, {
        ok: false,
        error: 'Please enter your License Key (SWEEPR-DB-...) or 6-digit Activation Code to access your subscription.'
      });
    }
    const lookupKey = isEmail ? keyOrCode : effectiveLookup;
    if (!isEmail && !HIGH_ENTROPY_LICENSE_KEY_RE.test(lookupKey)) {
      return sendJson(res, 401, {
        ok: false,
        error: 'Please enter your Account Email along with your 6-digit Activation Code (or enter your full SWEEPR-DB-XXXX-XXXX-XXXX License Key).'
      });
    }

    // 1. Check Central SWEEPR CRM first
    const crmLookup = await crm.portalLookup(effectiveLookup, keyOrCode);
    if (crmLookup.ok && crmLookup.data && crmLookup.data.ok) {
      const d = crmLookup.data;
      const hasRamTamer = Boolean(d.ramTamerAddon);
      const localRec = isEmail
        ? accountsByEmail.get(effectiveLookup.toLowerCase())
        : licenses.get(lookupKey) || licenses.get(lookupKey.toUpperCase());
      return sendJson(res, 200, {
        ok: true,
        project_id: 'deepblock',
        account_id: d.account_id || localRec?.id,
        status: d.status,
        plan: d.plan,
        activation_code: d.activation_code,
        licenseKey: d.licenseKey || d.license_key,
        ramTamerAddon: hasRamTamer,
        entitlements: buildDeepblockEntitlements(hasRamTamer),
        cancelAtPeriodEnd: Boolean(d.cancelAtPeriodEnd || d.cancel_at_period_end),
        expiresAt: d.expiresAt,
        devices_used: localRec && localRec.devices instanceof Set ? localRec.devices.size : 0,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: localRec ? listAccountDevices(localRec) : []
      });
    }

    let record = isEmail
      ? accountsByEmail.get(effectiveLookup.toLowerCase())
      : licenses.get(lookupKey) || licenses.get(lookupKey.toUpperCase());

    if (isEmail && record && !verifyLocalAccountKeyOrCode(record, keyOrCode)) {
      record = null;
    }

    if ((!record || record.status !== 'active') && STRIPE_SECRET_KEY) {
      try {
        const activeSubs = await getCachedActiveStripeSubs();
        const matchedSub = activeSubs.find((s) => {
          const metaKey = (s.metadata?.license_key || '').toUpperCase();
          const metaCode = String(s.metadata?.activation_code || '').trim();
          const targetKey = lookupKey.toUpperCase();
          const keyMatches =
            (metaKey && metaKey === targetKey) ||
            (metaCode && (metaCode === lookupKey || targetKey === `SWEEPR-DB-${metaCode}` || targetKey === `DEEPBLOCK-${metaCode}`));
          if (isEmail) {
            return (s.metadata?.email || '').toLowerCase() === effectiveLookup.toLowerCase() && keyMatches;
          }
          return keyMatches;
        });
        if (matchedSub) {
          record = upsertLocalAccount({
            email: matchedSub.metadata?.email || (isEmail ? effectiveLookup.toLowerCase() : 'customer@sweeprdeepblock.com'),
            stripeCustomerId: typeof matchedSub.customer === 'string' ? matchedSub.customer : matchedSub.customer?.id,
            subscriptionId: matchedSub.id,
            plan: matchedSub.metadata?.plan || 'annual',
            ramTamerAddon: matchedSub.metadata?.ram_tamer === 'true',
            status: 'active'
          });
          if (matchedSub.metadata?.license_key) {
            record.licenseKey = matchedSub.metadata.license_key;
            licenses.set(record.licenseKey, record);
          }
          await syncSubscriptionWithSweeprCrm(record);
        }
      } catch {}
    }

    if (!record || (record.status !== 'active' && record.status !== 'trialing')) {
      return sendJson(res, 404, {
        ok: false,
        error: 'No active paid Pro subscription found for that license key.'
      });
    }

    const sessionToken = signSessionCookie(record.id, record.email || '');
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      {
        ok: true,
        account_id: record.id,
        email: isEmail ? record.email : maskEmail(record.email),
        status: record.status,
        plan: record.plan,
        activation_code: record.activation_code,
        licenseKey: record.licenseKey,
        ramTamerAddon: Boolean(record.ramTamerAddon),
        entitlements: record.entitlements,
        cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd),
        devices_used: record.devices instanceof Set ? record.devices.size : 0,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: listAccountDevices(record)
      },
      {
        'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
      }
    );
  }

  if (req.method === 'POST' && pathname === '/api/portal/cancel') {
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });
    }
    if (!checkRateLimit(req, 'portal_cancel', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const rawLookup = String(body?.lookup || body?.email || '').trim();
    const keyOrCode = String(body?.key || body?.code || body?.otp || '').trim();
    const effectiveLookup = rawLookup || keyOrCode;
    if (!effectiveLookup) return sendJson(res, 400, { ok: false, error: 'lookup_required' });
    if (!checkRateLimit(req, `portal_target:${effectiveLookup.toLowerCase()}`, 8, 900000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }

    const isEmail = effectiveLookup.includes('@');
    if (isEmail && (!keyOrCode || keyOrCode.includes('@'))) {
      return sendJson(res, 401, {
        ok: false,
        error: 'license_key_or_code_required',
        message: 'A valid License Key or 6-digit Activation Code is required to cancel a subscription.'
      });
    }

    const lookupKey = isEmail ? keyOrCode : effectiveLookup;
    if (!isEmail && !HIGH_ENTROPY_LICENSE_KEY_RE.test(lookupKey)) {
      return sendJson(res, 401, {
        ok: false,
        error: 'email_required_for_short_code',
        message: 'Please enter your Account Email along with your 6-digit Activation Code (or enter your full SWEEPR-DB-XXXX-XXXX-XXXX License Key).'
      });
    }
    let record = isEmail
      ? accountsByEmail.get(effectiveLookup.toLowerCase())
      : licenses.get(lookupKey) || licenses.get(lookupKey.toUpperCase());

    if (isEmail && record && !verifyLocalAccountKeyOrCode(record, keyOrCode)) {
      return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
    }

    if (record && record.stripe_subscription_id && STRIPE_SECRET_KEY) {
      try {
        await stripeRequest('POST', `subscriptions/${encodeURIComponent(record.stripe_subscription_id)}`, {
          cancel_at_period_end: 'true'
        });
      } catch {}
    }
    if (record) {
      record.cancelAtPeriodEnd = true;
    }

    const crmCancel = await crm.portalCancel(effectiveLookup, false, keyOrCode);
    if (crmCancel.ok && crmCancel.data && crmCancel.data.ok) {
      return sendJson(res, 200, {
        ok: true,
        cancelAtPeriodEnd: true,
        status: crmCancel.data.status || record?.status || 'active'
      });
    }

    if (!record || (record.status !== 'active' && record.status !== 'trialing')) {
      return sendJson(res, 404, { ok: false, error: 'subscription_not_found' });
    }

    return sendJson(res, 200, { ok: true, cancelAtPeriodEnd: true, status: record.status });
  }

  // Automation A4 + Phase 3 Step 3.3: In-Portal & In-Extension 1-Click Plan Switch & Escalating D30/D60/D90 Win-Back (Zero Emails)
  if (req.method === 'POST' && pathname === '/api/portal/switch-plan') {
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'portal_switch_plan', 12, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const winbackTier = String(body?.winback_tier || '').trim().toLowerCase();
    const rawPlan = String(body?.plan || 'annual').trim().toLowerCase();
    let targetPlan =
      rawPlan === 'suite_annual' || rawPlan === 'suite' || winbackTier === 'tier_d90'
        ? 'suite_annual'
        : rawPlan === 'six_month' || winbackTier === 'tier_d30'
        ? 'six_month'
        : 'annual';
    const acc = await resolveAccountFromSessionOrCredentials(req, body || {});
    if (!acc) {
      return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Valid license key or active portal session required.' });
    }
    acc.plan = targetPlan;
    acc.status = 'active';
    acc.cancelAtPeriodEnd = false;
    acc.stepUpSaveEligible = false;
    if (winbackTier === 'tier_d60' || targetPlan === 'suite_annual' || Boolean(body?.ramTamerAddon)) {
      acc.ramTamerAddon = true;
    }
    acc.entitlements = buildDeepblockEntitlements(Boolean(acc.ramTamerAddon), targetPlan === 'suite_annual');
    syncSubscriptionWithSweeprCrm(acc, {
      notes: `Switched plan via A4/Phase3 winback (${winbackTier || 'direct'}) to ${targetPlan}`
    }).catch(() => {});
    const confirmMsg =
      targetPlan === 'suite_annual'
        ? 'Upgraded to Sweepr Complete Security Suite (£89.99/yr — DeepBlock Pro + Sweepr VPN + Sweepr Cleaner + RAM Tamer)'
        : winbackTier === 'tier_d60'
        ? 'Switched to Annual Plan (£59.99/yr) + Free 12-Month Total Tab & RAM Tamer Unlocked!'
        : targetPlan === 'annual'
        ? 'Switched to Annual Plan (£59.99/yr — £4.99/mo equivalent)'
        : 'Switched to 6-Month Plan (£44.99 — Save 25%)';
    return sendJson(res, 200, {
      ok: true,
      plan: acc.plan,
      winbackTier: winbackTier || null,
      ramTamerAddon: Boolean(acc.ramTamerAddon),
      entitlements: acc.entitlements,
      status: acc.status,
      licenseKey: acc.licenseKey,
      message: confirmMsg
    }, {}, req);
  }

  // ==========================================================================
  // API 3c: Unified 4-Device Management & QR Code Device Linking (Flow A & B)
  // ==========================================================================
  async function resolveAccountFromSessionOrCredentials(reqObj, bodyObj = {}) {
    const sess = verifySessionCookie(reqObj);
    if (sess && sess.sub) {
      let bySub = accountsById.get(sess.sub) || (sess.email ? accountsByEmail.get(String(sess.email).toLowerCase()) : null);
      if (!bySub && sess.email) {
        try {
          const crmLookup = await crm.portalLookup(String(sess.email).toLowerCase(), '');
          if (crmLookup && crmLookup.ok && crmLookup.data?.ok) {
            const d = crmLookup.data;
            bySub = upsertLocalAccount({
              email: String(sess.email).toLowerCase(),
              plan: d.plan || 'annual',
              ramTamerAddon: Boolean(d.ramTamerAddon),
              status: d.status || 'active',
              ...(d.activation_code ? { activationCode: String(d.activation_code) } : {}),
              ...(d.licenseKey || d.license_key ? { licenseKey: String(d.licenseKey || d.license_key) } : {})
            });
          }
        } catch {}
      }
      if (bySub && (bySub.status === 'active' || bySub.status === 'trialing')) {
        return bySub;
      }
    }
    const rawLookup = String(bodyObj?.lookup || bodyObj?.email || '').trim().toLowerCase();
    const keyOrCode = String(bodyObj?.key || bodyObj?.licenseKey || bodyObj?.code || bodyObj?.otp || '').trim();
    const targetIdentifier = rawLookup || keyOrCode.toLowerCase();
    if (!targetIdentifier) return null;
    if (!checkRateLimit(reqObj, `portal_target:${targetIdentifier}`, 8, 900000)) {
      return null;
    }
    if (rawLookup && rawLookup.includes('@')) {
      if (!keyOrCode && !(sess && sess.email === rawLookup)) {
        return null;
      }
      let acc = accountsByEmail.get(rawLookup);
      if (acc && (acc.status === 'active' || acc.status === 'trialing') && verifyLocalAccountKeyOrCode(acc, keyOrCode)) {
        return acc;
      }
      try {
        const crmLookup = await crm.portalLookup(rawLookup, keyOrCode);
        if (crmLookup && crmLookup.ok && crmLookup.data?.ok) {
          const d = crmLookup.data;
          acc = upsertLocalAccount({
            email: rawLookup,
            plan: d.plan || 'annual',
            ramTamerAddon: Boolean(d.ramTamerAddon),
            status: d.status || 'active',
            ...(d.activation_code ? { activationCode: String(d.activation_code) } : {}),
            ...(d.licenseKey || d.license_key ? { licenseKey: String(d.licenseKey || d.license_key) } : {})
          });
          return acc;
        }
      } catch {}
      return null;
    }
    const candidateKey = keyOrCode || rawLookup;
    if (candidateKey && HIGH_ENTROPY_LICENSE_KEY_RE.test(candidateKey)) {
      let acc = licenses.get(candidateKey) || licenses.get(candidateKey.toUpperCase());
      if (acc && (acc.status === 'active' || acc.status === 'trialing')) {
        return acc;
      }
      try {
        const crmVerify = await crm.verifyKey(candidateKey);
        if (crmVerify && crmVerify.ok && crmVerify.data?.valid) {
          const d = crmVerify.data;
          acc = upsertLocalAccount({
            email: d.email || `${d.account_id || 'pro'}@crm.sweeprdeepblock.com`,
            plan: d.plan || 'annual',
            ramTamerAddon: Boolean(d.ramTamerAddon),
            status: d.status || 'active',
            ...(d.activation_code ? { activationCode: String(d.activation_code) } : {}),
            licenseKey: String(d.licenseKey || d.license_key || candidateKey.toUpperCase())
          });
          if (d.account_id) acc.crm_account_id = d.account_id;
          return acc;
        }
      } catch {}
    }
    return null;
  }

  // Self-Service Device Slot Removal (frees a slot when at 4/4 devices)
  if (req.method === 'POST' && pathname === '/api/portal/devices/remove') {
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'portal_device_remove', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const deviceIdToRemove = String(body?.device_id || '').trim().slice(0, 128);
    if (!deviceIdToRemove) {
      return sendJson(res, 400, { ok: false, error: 'device_id_required' });
    }
    const acc = await resolveAccountFromSessionOrCredentials(req, body || {});
    if (!acc) {
      return sendJson(res, 401, { ok: false, error: 'unauthorized' });
    }
    removeLocalDeviceForAccount(acc, deviceIdToRemove);
    if (acc.crm_account_id) {
      crm.revokeDevice(acc.crm_account_id, deviceIdToRemove).catch(() => {});
    }
    syncSubscriptionWithSweeprCrm(acc, { notes: 'Device removed: ' + deviceIdToRemove }).catch(() => {});
    return sendJson(res, 200, {
      ok: true,
      removed: deviceIdToRemove,
      devices_used: acc.devices instanceof Set ? acc.devices.size : 0,
      devices_max: MAX_DEVICES_PER_LICENSE,
      devices: listAccountDevices(acc)
    });
  }

  // Flow A1: Generate 120-Second Single-Use QR Pairing Token (from Portal or Activated Extension)
  if (req.method === 'POST' && pathname === '/api/device-link/create-token') {
    cleanupExpiredQrStates();
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'qr_create_token', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const acc = await resolveAccountFromSessionOrCredentials(req, body || {});
    if (!acc) {
      return sendJson(res, 401, { ok: false, error: 'active_subscription_required' });
    }
    const callerDeviceId = String(body?.device_id || '').trim().slice(0, 128);
    const usedCount = acc.devices instanceof Set ? acc.devices.size : 0;
    const callerAlreadyRegistered = callerDeviceId && acc.devices instanceof Set && acc.devices.has(callerDeviceId);
    if (usedCount >= MAX_DEVICES_PER_LICENSE && !callerAlreadyRegistered) {
      return sendJson(res, 403, {
        ok: false,
        error: 'device_limit_reached',
        message: `Maximum of ${MAX_DEVICES_PER_LICENSE} active devices reached (${usedCount}/${MAX_DEVICES_PER_LICENSE}). Remove an old device first to link a new one.`,
        devices_used: usedCount,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: listAccountDevices(acc)
      });
    }
    const rawToken = `ptk_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = Date.now();
    const expiresAt = now + 120 * 1000;
    qrPairingTokens.set(tokenHash, {
      tokenHash,
      accountId: acc.id,
      createdAt: now,
      expiresAt,
      redeemedAt: null,
      redeemedByDeviceId: null
    });
    const hostOrigin = resolveTrustedOrigin(req);
    const pairUrl = `${hostOrigin}/pair?token=${encodeURIComponent(rawToken)}`;
    return sendJson(res, 200, {
      ok: true,
      token: rawToken,
      pair_url: pairUrl,
      qr_svg: generateQrSvg(pairUrl),
      expires_in: 120,
      expires_at: Math.floor(expiresAt / 1000),
      devices_used: usedCount,
      devices_max: MAX_DEVICES_PER_LICENSE,
      devices: listAccountDevices(acc)
    });
  }

  // Flow A2: Redeem 120-Second Single-Use QR Pairing Token (/api/device-link/redeem & /api/device-link/redeem-token)
  if (req.method === 'POST' && (pathname === '/api/device-link/redeem' || pathname === '/api/device-link/redeem-token')) {
    cleanupExpiredQrStates();
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'qr_redeem', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const rawToken = String(body?.token || '').trim();
    const deviceId = String(body?.device_id || `mob_db_${crypto.randomBytes(6).toString('hex')}`).trim().slice(0, 128);
    const deviceName = String(body?.device_name || 'Mobile Browser').trim().slice(0, 80);
    const platform = String(body?.platform || 'mobile').trim().slice(0, 32);

    if (!/^ptk_[a-f0-9]{24,64}$/i.test(rawToken)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_pairing_token' });
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = qrPairingTokens.get(tokenHash);
    if (!row || row.redeemedAt !== null || Date.now() > row.expiresAt) {
      return sendJson(res, 401, { ok: false, error: 'token_expired_or_already_used' });
    }
    const acc = accountsById.get(row.accountId);
    if (!acc || (acc.status !== 'active' && acc.status !== 'trialing')) {
      return sendJson(res, 403, { ok: false, error: 'subscription_inactive' });
    }
    if (acc.licenseKey) {
      try {
        const crmSeat = await crm.verifyKey(acc.licenseKey, deviceId);
        if (crmSeat && crmSeat.status === 403 && crmSeat.data?.error === 'device_limit_reached') {
          return sendJson(res, 403, {
            ok: false,
            error: 'device_limit_reached',
            message: crmSeat.data.message || `Maximum of ${MAX_DEVICES_PER_LICENSE} active devices reached. Remove a device in your Customer Portal first.`,
            devices_used: MAX_DEVICES_PER_LICENSE,
            devices_max: MAX_DEVICES_PER_LICENSE,
            devices: listAccountDevices(acc)
          });
        }
      } catch {}
    }
    const seatCheck = registerLocalDeviceForAccount(acc, deviceId, { deviceName, platform });
    if (!seatCheck.ok) {
      return sendJson(res, 403, {
        ok: false,
        error: 'device_limit_reached',
        message: `Maximum of ${MAX_DEVICES_PER_LICENSE} active devices reached (${seatCheck.used}/${seatCheck.max}). Remove a device in your Customer Portal first.`,
        devices_used: seatCheck.used,
        devices_max: seatCheck.max,
        devices: seatCheck.devices
      });
    }
    row.redeemedAt = Date.now();
    row.redeemedByDeviceId = deviceId;

    const isExtCaller = isAllowedExtensionOrigin(req.headers.origin || '');
    const sessionToken = signSessionCookie(acc.id, acc.email || '');
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      {
        ok: true,
        valid: true,
        project_id: 'deepblock',
        account_id: acc.id,
        email: maskEmail(acc.email),
        status: acc.status,
        plan: acc.plan,
        activation_code: acc.activation_code,
        licenseKey: acc.licenseKey,
        ramTamerAddon: Boolean(acc.ramTamerAddon),
        entitlements: acc.entitlements,
        devices_used: acc.devices.size,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: listAccountDevices(acc)
      },
      isExtCaller
        ? {}
        : {
            'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
          }
    );
  }

  // Flow B1: Start Unactivated Extension / Browser QR Challenge (Scan with Phone to Unlock)
  if (req.method === 'POST' && pathname === '/api/device-link/challenge') {
    cleanupExpiredQrStates();
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'qr_challenge', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const deviceId = String(body?.device_id || `ext_db_${crypto.randomBytes(6).toString('hex')}`).trim().slice(0, 128);
    const deviceName = String(body?.device_name || 'SWEEPR Deepblock Extension').trim().slice(0, 80);
    const platform = String(body?.platform || 'browser_extension').trim().slice(0, 32);

    const challengeId = `chk_${crypto.randomBytes(16).toString('hex')}`;
    const pollSecret = `psec_${crypto.randomBytes(24).toString('hex')}`;
    const pollSecretHash = crypto.createHash('sha256').update(pollSecret).digest('hex');
    const now = Date.now();
    const expiresAt = now + 120 * 1000;

    qrPairingChallenges.set(challengeId, {
      challengeId,
      pollSecretHash,
      deviceId,
      deviceName,
      platform,
      status: 'pending',
      accountId: null,
      createdAt: now,
      expiresAt
    });

    const hostOrigin = resolveTrustedOrigin(req);
    const approveUrl = `${hostOrigin}/pair?mode=approve&challenge=${encodeURIComponent(challengeId)}`;
    return sendJson(res, 200, {
      ok: true,
      challenge_id: challengeId,
      poll_secret: pollSecret,
      approve_url: approveUrl,
      qr_svg: generateQrSvg(approveUrl),
      expires_in: 120,
      expires_at: Math.floor(expiresAt / 1000)
    });
  }

  // Flow B2: Poll QR Challenge Status from Waiting Browser Extension
  if (req.method === 'GET' && pathname === '/api/device-link/poll') {
    cleanupExpiredQrStates();
    if (!checkRateLimit(req, 'qr_poll', 90, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const challengeId = String(parsedUrl.searchParams.get('challenge_id') || '').trim();
    const pollSecret = String(parsedUrl.searchParams.get('poll_secret') || '').trim();
    if (!/^chk_[a-f0-9]{24,64}$/i.test(challengeId) || !/^psec_[a-f0-9]{32,64}$/i.test(pollSecret)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_challenge_params' });
    }
    const ch = qrPairingChallenges.get(challengeId);
    if (!ch) {
      return sendJson(res, 404, { ok: false, status: 'expired', error: 'challenge_not_found' });
    }
    const providedHash = crypto.createHash('sha256').update(pollSecret).digest('hex');
    if (
      providedHash.length !== ch.pollSecretHash.length ||
      !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(ch.pollSecretHash))
    ) {
      return sendJson(res, 403, { ok: false, error: 'invalid_poll_secret' });
    }
    if (Date.now() > ch.expiresAt && ch.status === 'pending') {
      return sendJson(res, 200, { ok: true, status: 'expired' });
    }
    if (ch.status === 'pending') {
      return sendJson(res, 200, {
        ok: true,
        status: 'pending',
        expires_in: Math.max(0, Math.floor((ch.expiresAt - Date.now()) / 1000))
      });
    }
    if (ch.status === 'approved' && ch.accountId) {
      const acc = accountsById.get(ch.accountId);
      if (!acc || (acc.status !== 'active' && acc.status !== 'trialing')) {
        return sendJson(res, 403, { ok: false, status: 'expired', error: 'subscription_inactive' });
      }
      ch.status = 'consumed';
      return sendJson(res, 200, {
        ok: true,
        status: 'approved',
        valid: true,
        project_id: 'deepblock',
        account_id: acc.id,
        email: maskEmail(acc.email),
        activation_code: acc.activation_code,
        licenseKey: acc.licenseKey,
        plan: acc.plan,
        ramTamerAddon: Boolean(acc.ramTamerAddon),
        entitlements: acc.entitlements,
        devices_used: acc.devices.size,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: listAccountDevices(acc)
      });
    }
    return sendJson(res, 200, { ok: true, status: ch.status });
  }

  // Flow B3: Approve QR Challenge from Authenticated Phone / Portal
  if (req.method === 'POST' && pathname === '/api/device-link/approve') {
    cleanupExpiredQrStates();
    if (!isSameOriginWriteRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'qr_approve', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const challengeId = String(body?.challenge_id || '').trim();
    if (!/^chk_[a-f0-9]{24,64}$/i.test(challengeId)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_challenge_id' });
    }
    const ch = qrPairingChallenges.get(challengeId);
    if (!ch || Date.now() > ch.expiresAt || ch.status !== 'pending') {
      return sendJson(res, 404, { ok: false, error: 'challenge_expired_or_already_approved' });
    }
    const acc = await resolveAccountFromSessionOrCredentials(req, body || {});
    if (!acc) {
      return sendJson(res, 401, {
        ok: false,
        error: 'authentication_required',
        message: 'Please enter your Account Email and 6-digit Activation Code (or License Key) to approve this device.'
      });
    }
    if (acc.licenseKey) {
      try {
        const crmSeat = await crm.verifyKey(acc.licenseKey, ch.deviceId);
        if (crmSeat && crmSeat.status === 403 && crmSeat.data?.error === 'device_limit_reached') {
          return sendJson(res, 403, {
            ok: false,
            error: 'device_limit_reached',
            message: crmSeat.data.message || `Maximum of ${MAX_DEVICES_PER_LICENSE} active devices reached. Remove a device below to approve ${ch.deviceName}.`,
            devices_used: MAX_DEVICES_PER_LICENSE,
            devices_max: MAX_DEVICES_PER_LICENSE,
            devices: listAccountDevices(acc)
          });
        }
      } catch {}
    }
    const seatCheck = registerLocalDeviceForAccount(acc, ch.deviceId, {
      deviceName: ch.deviceName,
      platform: ch.platform
    });
    if (!seatCheck.ok) {
      return sendJson(res, 403, {
        ok: false,
        error: 'device_limit_reached',
        message: `Maximum of ${MAX_DEVICES_PER_LICENSE} active devices reached (${seatCheck.used}/${seatCheck.max}). Remove a device below to approve ${ch.deviceName}.`,
        devices_used: seatCheck.used,
        devices_max: seatCheck.max,
        devices: seatCheck.devices
      });
    }
    ch.status = 'approved';
    ch.accountId = acc.id;

    const sessionToken = signSessionCookie(acc.id, acc.email || '');
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      {
        ok: true,
        status: 'approved',
        device_id: ch.deviceId,
        device_name: ch.deviceName,
        devices_used: acc.devices.size,
        devices_max: MAX_DEVICES_PER_LICENSE,
        devices: listAccountDevices(acc)
      },
      {
        'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
      }
    );
  }

  // Mobile-First QR Pairing & Browser Approval Web Page (/pair)
  if (req.method === 'GET' && pathname === '/pair') {
    cleanupExpiredQrStates();
    const mode = String(parsedUrl.searchParams.get('mode') || '').trim();
    const token = String(parsedUrl.searchParams.get('token') || '').trim();
    const challengeId = String(parsedUrl.searchParams.get('challenge') || '').trim();
    const sess = verifySessionCookie(req);
    const loggedInAcc =
      sess && sess.sub ? accountsById.get(sess.sub) || (sess.email ? accountsByEmail.get(String(sess.email).toLowerCase()) : null) : null;
    const ch = challengeId ? qrPairingChallenges.get(challengeId) : null;

    const pairHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Link Device via QR — SWEEPR Deepblock Pro</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
</head>
<body class="bg-[#0b1120] text-white min-h-screen flex items-center justify-center p-5 font-sans antialiased">
  <div class="max-w-md w-full bg-[#131c31] border border-emerald-500/30 rounded-3xl p-7 shadow-2xl space-y-5">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-xl">🛡️</div>
      <div>
        <div class="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">SWEEPR Deepblock Pro</div>
        <h1 class="text-xl font-black tracking-tight">${mode === 'approve' ? 'Approve Browser via QR' : 'Link Device to Pro'}</h1>
      </div>
    </div>

    ${
      mode === 'approve'
        ? ch && ch.status === 'pending' && Date.now() <= ch.expiresAt
          ? `
      <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 space-y-2 text-sm">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Waiting Device</div>
        <div class="font-extrabold text-white text-base">${escapeHtml(ch.deviceName)}</div>
        <div class="text-xs text-slate-400">Up to 3 devices (any combination of desktop or mobile) are included in your subscription.</div>
      </div>

      <div id="approveAuthFields" class="${loggedInAcc ? 'hidden' : 'space-y-3'}">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Account Email</label>
          <input id="pairEmail" type="email" placeholder="you@example.com" value="${escapeHtml(loggedInAcc?.email || '')}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">6-Digit Code or License Key</label>
          <input id="pairKey" type="text" placeholder="e.g. 817797 or SWEEPR-DB-XXXX..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono">
        </div>
      </div>

      <div id="pairStatus" class="hidden text-xs font-bold rounded-xl p-3"></div>
      <div id="pairDeviceSlots" class="hidden space-y-2"></div>

      <button id="approveBtn" type="button" class="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer">
        ✓ Approve ${escapeHtml(ch.deviceName)} &amp; Unlock Pro
      </button>
      `
          : `<div class="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-sm text-rose-300 font-semibold">This QR code has expired or was already used. Please click "Scan QR with Phone" again in your browser extension.</div>`
        : token
        ? `
      <div id="redeemContainer" class="space-y-4">
        <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-sm text-slate-300">
          Tap below to link this device to your <strong>SWEEPR Deepblock Pro</strong> subscription (up to 3 devices total).
        </div>
        <div id="redeemStatus" class="hidden text-xs font-bold rounded-xl p-3"></div>
        <button id="redeemBtn" type="button" class="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer">
          Link This Device Now →
        </button>
        <div id="redeemSuccessCard" class="hidden bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
          <div class="text-xs font-bold uppercase tracking-wider text-emerald-400">✓ Device Linked (Pro Active)</div>
          <div class="text-xs text-slate-300">License Key: <span id="redeemedKeyText" class="font-mono font-bold text-white"></span></div>
          <div class="grid grid-cols-1 gap-2 pt-1">
            <a href="/download/sweepr-deepblock.mobileconfig" class="text-center py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs no-underline">Install iOS / Mobile Protection Profile</a>
            <a href="/download" class="text-center py-2.5 px-4 rounded-xl bg-slate-800 text-white font-bold text-xs border border-slate-700 no-underline">Open Extension &amp; App Downloads</a>
          </div>
        </div>
      </div>
      `
        : `<div class="text-sm text-slate-400">Scan a valid SWEEPR Deepblock QR code from your Customer Portal or browser extension.</div>`
    }
  </div>
  <script>
    (function() {
      const challengeId = ${JSON.stringify(challengeId)};
      const token = ${JSON.stringify(token)};
      const approveBtn = document.getElementById('approveBtn');
      if (approveBtn && challengeId) {
        approveBtn.addEventListener('click', async () => {
          const emailEl = document.getElementById('pairEmail');
          const keyEl = document.getElementById('pairKey');
          const statusEl = document.getElementById('pairStatus');
          const slotsEl = document.getElementById('pairDeviceSlots');
          approveBtn.disabled = true;
          approveBtn.textContent = 'Approving...';
          try {
            const res = await fetch('/api/device-link/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                challenge_id: challengeId,
                email: emailEl ? emailEl.value.trim() : '',
                key: keyEl ? keyEl.value.trim() : ''
              })
            });
            const data = await res.json().catch(() => ({}));
            statusEl.classList.remove('hidden');
            if (res.ok && data.ok) {
              statusEl.className = 'text-xs font-bold rounded-xl p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300';
              statusEl.textContent = '✓ Approved! Your browser extension is now unlocked (' + data.devices_used + '/' + data.devices_max + ' devices active).';
              approveBtn.textContent = '✓ Approved';
              if (slotsEl) slotsEl.classList.add('hidden');
            } else {
              approveBtn.disabled = false;
              approveBtn.textContent = '✓ Approve & Unlock Pro';
              statusEl.className = 'text-xs font-bold rounded-xl p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300';
              statusEl.textContent = data.message || data.error || 'Could not approve device.';
              if (data.error === 'authentication_required') {
                const authFields = document.getElementById('approveAuthFields');
                if (authFields) authFields.classList.remove('hidden');
              }
              if (data.error === 'device_limit_reached' && Array.isArray(data.devices) && slotsEl) {
                slotsEl.classList.remove('hidden');
                slotsEl.innerHTML = '<div class="text-xs font-bold text-amber-300">Active Devices (3/3) — Remove one to continue:</div>';
                data.devices.forEach((d) => {
                  const row = document.createElement('div');
                  row.className = 'flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs';
                  const nameSpan = document.createElement('span');
                  nameSpan.textContent = (d.device_name || d.device_id) + ' (' + (d.platform || 'device') + ')';
                  const rmBtn = document.createElement('button');
                  rmBtn.className = 'px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold cursor-pointer';
                  rmBtn.textContent = 'Remove';
                  rmBtn.onclick = async () => {
                    rmBtn.textContent = '...';
                    const r = await fetch('/api/portal/devices/remove', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        device_id: d.device_id,
                        email: emailEl ? emailEl.value.trim() : '',
                        key: keyEl ? keyEl.value.trim() : ''
                      })
                    });
                    if (r.ok) {
                      row.remove();
                      approveBtn.click();
                    }
                  };
                  row.appendChild(nameSpan);
                  row.appendChild(rmBtn);
                  slotsEl.appendChild(row);
                });
              }
            }
          } catch (e) {
            approveBtn.disabled = false;
            approveBtn.textContent = '✓ Approve & Unlock Pro';
          }
        });
      }

      const redeemBtn = document.getElementById('redeemBtn');
      if (redeemBtn && token) {
        redeemBtn.addEventListener('click', async () => {
          const statusEl = document.getElementById('redeemStatus');
          const cardEl = document.getElementById('redeemSuccessCard');
          const keyText = document.getElementById('redeemedKeyText');
          redeemBtn.disabled = true;
          redeemBtn.textContent = 'Linking Device...';
          let devId = localStorage.getItem('sweepr_db_device_id');
          if (!devId) {
            devId = 'mob_db_' + Math.random().toString(36).slice(2, 10);
            localStorage.setItem('sweepr_db_device_id', devId);
          }
          try {
            const res = await fetch('/api/device-link/redeem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                device_id: devId,
                device_name: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iPhone / iPad Safari' : /Android/i.test(navigator.userAgent) ? 'Android Browser' : 'Web Browser',
                platform: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
              })
            });
            const data = await res.json().catch(() => ({}));
            statusEl.classList.remove('hidden');
            if (res.ok && data.ok) {
              localStorage.setItem('sweepr_license_key', data.licenseKey);
              localStorage.setItem('deepblock_license_key', data.licenseKey);
              window.postMessage({ source: 'sweepr-web-portal', type: 'SWEEPR_AUTO_ACTIVATE', licenseKey: data.licenseKey }, window.location.origin);
              statusEl.className = 'text-xs font-bold rounded-xl p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300';
              statusEl.textContent = '✓ Linked! (' + data.devices_used + '/' + data.devices_max + ' devices active on your subscription).';
              if (keyText) keyText.textContent = data.licenseKey;
              if (cardEl) cardEl.classList.remove('hidden');
              redeemBtn.classList.add('hidden');
            } else {
              redeemBtn.disabled = false;
              redeemBtn.textContent = 'Link This Device Now →';
              statusEl.className = 'text-xs font-bold rounded-xl p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300';
              statusEl.textContent = data.message || data.error || 'Expired or invalid QR pairing token.';
            }
          } catch (e) {
            redeemBtn.disabled = false;
            redeemBtn.textContent = 'Link This Device Now →';
          }
        });
      }
    })();
  </script>
</body>
</html>`;
    return sendHtml(res, 200, pairHtml);
  }

  // API 4: Customer Support Ticket Submission -> Central CRM
  if (req.method === 'POST' && (pathname === '/api/support' || pathname === '/api/support-ticket')) {
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' });
    }
    if (!checkRateLimit(req, 'support', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const data = await readBody(req);
    if (data && data.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    if (!data || !isValidEmail(String(data.email || '').trim()) || !data.subject || !data.message) {
      return sendJson(res, 400, { ok: false, error: 'email_subject_and_message_required' });
    }
    const ticketPayload = {
      project_id: 'deepblock',
      email: String(data.email).trim().toLowerCase(),
      name: typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '',
      subject: String(data.subject).slice(0, 200),
      message: String(data.message).slice(0, 4000),
      category: typeof data.category === 'string' ? data.category.slice(0, 64) : 'general',
      os: typeof data.os === 'string' ? data.os.slice(0, 64) : 'browser_extension'
    };
    const crmRes = await requestSweeprCrm('/api/support/contact', {
      method: 'POST',
      body: ticketPayload
    });
    const fallbackTicketNo = 'DB-' + crypto.randomInt(100000, 999999);
    return sendJson(res, 200, {
      ok: true,
      ticket_number: crmRes.data?.ticket_number || crmRes.data?.id || fallbackTicketNo,
      ...(crmRes.ok && crmRes.data ? crmRes.data : {})
    });
  }

  // API 5: Extension Telemetry & Funnel Events -> Central CRM (Strict Local-First Privacy Filter: No URLs, Domains, Queries, or Browsing History)
  if (req.method === 'POST' && pathname === '/api/telemetry') {
    if (!isSameOriginWriteRequest(req, { allowExtension: true })) {
      return sendJson(res, 403, { ok: false, error: 'cross_origin_forbidden' }, {}, req);
    }
    if (!checkRateLimit(req, 'telemetry', 60, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const data = await readBody(req);
    if (data && data.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    if (!data || (!data.event_name && !data.event)) {
      return sendJson(res, 400, { ok: false, error: 'event_name_required' });
    }
    const FORBIDDEN_PRIVACY_KEYS = new Set(['url', 'domain', 'hostname', 'origin', 'path', 'pathname', 'referrer', 'referer', 'query', 'search', 'history', 'title', 'email', 'ip']);
    let safeProps = {};
    if (data.properties && typeof data.properties === 'object' && !Array.isArray(data.properties)) {
      try {
        const rawJson = JSON.stringify(data.properties);
        if (rawJson.length <= 2048) {
          const parsedProps = JSON.parse(rawJson);
          for (const [k, v] of Object.entries(parsedProps)) {
            const lowerKey = String(k).toLowerCase();
            if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && !FORBIDDEN_PRIVACY_KEYS.has(lowerKey)) {
              safeProps[k] = v;
            }
          }
        }
      } catch {}
    }
    const normalizedEventName = String(data.event_name || data.event).slice(0, 120);
    const crmRes = await requestSweeprCrm('/v1/telemetry/event', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        event_name: normalizedEventName,
        category: typeof data.category === 'string' ? data.category.slice(0, 64) : 'funnel',
        account_id: typeof data.account_id === 'string' ? data.account_id.slice(0, 64) : undefined,
        device_id: typeof data.device_id === 'string' ? data.device_id.slice(0, 64) : undefined,
        os: typeof data.os === 'string' ? data.os.slice(0, 64) : 'browser_extension',
        app_version: typeof data.app_version === 'string' ? data.app_version.slice(0, 32) : LATEST_EXTENSION_VERSION,
        properties: safeProps
      }
    });
    return sendJson(res, 200, {
      ok: true,
      event_name: normalizedEventName,
      privacy_filtered: true,
      ...(crmRes.data && typeof crmRes.data === 'object' ? crmRes.data : {})
    });
  }

  function hasBlockedSitesAdminAuth(req) {
    const authKey = String(req.headers['x-sweepr-api-key'] || req.headers['x-crm-api-key'] || '').trim();
    const basicAuth = String(req.headers.authorization || '').trim();
    const adminSecret = SWEEPR_CRM_API_KEY || CRM_ADMIN_PASSWORD || (process.env.ADMIN_API_KEY || '').trim();
    if (authKey && adminSecret && timingSafeStringMatch(authKey, adminSecret)) {
      return true;
    }
    if (basicAuth.startsWith('Basic ') && adminSecret) {
      try {
        const creds = Buffer.from(basicAuth.slice(6), 'base64').toString('utf8');
        const pass = creds.split(':')[1] || '';
        if (pass && timingSafeStringMatch(pass, adminSecret)) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  // API 6: Deepblock Verified Blocked Sites Registry & Automation Deduplication API
  if (
    pathname === '/api/crm/deepblock/blocked-sites' ||
    pathname === '/api/deepblock/blocked-sites' ||
    pathname === '/v1/deepblock/blocked-sites'
  ) {
    if (req.method === 'GET') {
      if (!checkRateLimit(req, 'blocked_sites_get', 60, 60000)) return sendJson(res, 429, { error: 'rate_limit_exceeded' });
      const checkQuery = (
        parsedUrl.searchParams.get('domain') ||
        parsedUrl.searchParams.get('url') ||
        parsedUrl.searchParams.get('check') ||
        ''
      ).trim();
      if (checkQuery) {
        const dom = normalizeSiteDomain(checkQuery);
        const site = deepblockBlockedSites.get(dom) || null;
        const alreadyBlocked = Boolean(site && (site.status === 'blocked' || site.status === 'auto_patched' || site.status === 'clean'));
        return sendJson(res, 200, {
          ok: true,
          checked: Boolean(site),
          already_blocked: alreadyBlocked,
          alreadyBlocked,
          skip_scan: alreadyBlocked,
          domain: dom,
          site
        });
      }

      const statusFilter = (parsedUrl.searchParams.get('status') || parsedUrl.searchParams.get('filter') || 'all').trim().toLowerCase();
      const search = (parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
      const limit = Math.min(Math.max(Number(parsedUrl.searchParams.get('limit') || 1000), 1), 5000);
      const allRows = Array.from(deepblockBlockedSites.values());
      const counts = {
        total: allRows.length,
        blocked: 0,
        auto_patched: 0,
        verified_blocked: 0,
        clean: 0,
        manual_review: 0
      };
      const domains = [];
      for (const r of allRows) {
        counts[r.status] = (counts[r.status] || 0) + 1;
        if (r.status === 'blocked' || r.status === 'auto_patched') counts.verified_blocked += 1;
        if (r.status === 'blocked' || r.status === 'auto_patched' || r.status === 'clean') domains.push(r.domain);
      }
      const filtered = allRows
        .filter((r) => {
          if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'verified' && r.status !== 'blocked' && r.status !== 'auto_patched') return false;
            if (statusFilter !== 'verified' && r.status !== statusFilter) return false;
          }
          if (search) {
            const hay = `${r.domain} ${r.target_url} ${r.ad_types_blocked} ${r.generated_rules} ${r.notes || ''} ${r.commit_hash}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .slice(0, limit);

      return sendJson(res, 200, {
        ok: true,
        total: allRows.length,
        filtered_count: filtered.length,
        counts,
        domains,
        rows: filtered,
        sites: filtered
      });
    }

    if (req.method === 'POST') {
      if (!checkRateLimit(req, 'blocked_sites_write', 30, 60000)) return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
      if (!hasBlockedSitesAdminAuth(req)) return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Administrative authentication required.' });
      const body = await readBody(req);
      if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
      const batch = Array.isArray(body)
        ? body
        : Array.isArray(body?.sites)
        ? body.sites
        : Array.isArray(body?.records)
        ? body.records
        : null;

      if (batch) {
        let upserted = 0;
        for (const item of batch) {
          if (upsertLocalBlockedSite(item, false)) upserted += 1;
        }
        flushBlockedSitesStore();
        requestSweeprCrm('/v1/deepblock/blocked-sites', { method: 'POST', body: { sites: batch } }).catch(() => {});
        return sendJson(res, 200, { ok: true, upserted, total: deepblockBlockedSites.size });
      }

      const saved = upsertLocalBlockedSite(body || {}, true);
      if (!saved) return sendJson(res, 400, { ok: false, error: 'valid_domain_or_url_required' });
      requestSweeprCrm('/v1/deepblock/blocked-sites', { method: 'POST', body: saved }).catch(() => {});
      return sendJson(res, 200, { ok: true, site: saved, item: saved });
    }

    if (req.method === 'DELETE') {
      if (!checkRateLimit(req, 'blocked_sites_write', 30, 60000)) return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
      if (!hasBlockedSitesAdminAuth(req)) return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Administrative authentication required.' });
      const dom = normalizeSiteDomain(parsedUrl.searchParams.get('domain') || parsedUrl.searchParams.get('url') || '');
      if (!dom) return sendJson(res, 400, { ok: false, error: 'domain_required' });
      const deleted = deepblockBlockedSites.delete(dom);
      if (deleted) flushBlockedSitesStore();
      return sendJson(res, 200, { ok: true, deleted });
    }
  }

  // Automated Transactional Keyword Research & Low-Competition Opportunity Matrix API
  if (pathname === '/api/seo/keyword-opportunities' || pathname === '/api/seo/keyword-opportunities/refresh') {
    const matrixPath = path.join(__dirname, 'data', 'keyword-opportunity-matrix.json');
    const auditReportPath = path.join(__dirname, 'data', 'daily-seo-audit-report.json');

    if (req.method === 'POST' && pathname === '/api/seo/keyword-opportunities/refresh') {
      if (!checkRateLimit(req, 'seo_kw_refresh', 10, 60000)) {
        return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
      }
      if (!hasBlockedSitesAdminAuth(req)) {
        return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Administrative authentication required.' });
      }
      if (global.__kwEngineRunning && Date.now() - global.__kwEngineRunning < 60000) {
        return sendJson(res, 202, { ok: true, status: 'already_running' });
      }
      global.__kwEngineRunning = Date.now();
      const { execFile } = require('child_process');
      execFile(
        process.execPath,
        [path.join(__dirname, 'scripts', 'keyword-research-engine.mjs')],
        { timeout: 45000 },
        () => {
          global.__kwEngineRunning = 0;
          global.__kwMatrixCache = null;
        }
      );
      return sendJson(res, 202, { ok: true, status: 'refresh_triggered' });
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/seo/keyword-opportunities') {
      if (!checkRateLimit(req, 'seo_kw_matrix', 60, 60000)) {
        return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
      }
      try {
        if (!fs.existsSync(matrixPath)) {
          return sendJson(res, 404, { ok: false, error: 'matrix_not_generated_yet' });
        }
        const stat = fs.statSync(matrixPath);
        if (!global.__kwMatrixCache || global.__kwMatrixCache.mtimeMs !== stat.mtimeMs) {
          global.__kwMatrixCache = {
            mtimeMs: stat.mtimeMs,
            data: JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
          };
        }
        const matrix = global.__kwMatrixCache.data || {};
        const clusterFilter = (parsedUrl.searchParams.get('cluster') || '').trim().toLowerCase();
        const pillarFilter = (parsedUrl.searchParams.get('pillar') || '').trim().toUpperCase();
        const statusFilter = (parsedUrl.searchParams.get('status') || '').trim().toLowerCase();
        const maxKd = Number(parsedUrl.searchParams.get('max_kd') || 100);
        const minScore = Number(parsedUrl.searchParams.get('min_score') || 0);
        const limit = Math.max(1, Math.min(250, Number(parsedUrl.searchParams.get('limit') || 50)));

        let items = Array.isArray(matrix.opportunities) ? matrix.opportunities : [];
        items = items
          .map((opp) => {
            const isPub = Boolean(opp.relPath && fs.existsSync(path.join(WEBSITE_DIR, opp.relPath)));
            return {
              ...opp,
              isPublishedOnDisk: isPub,
              status: isPub ? 'published' : (opp.status || 'approved_for_generation')
            };
          })
          .filter((opp) => {
            if (clusterFilter && opp.cluster !== clusterFilter) return false;
            if (pillarFilter && opp.pillar !== pillarFilter) return false;
            if (statusFilter && statusFilter !== 'all' && opp.status !== statusFilter) return false;
            if (!Number.isNaN(maxKd) && (opp.metrics?.estimatedKD ?? 0) > maxKd) return false;
            if (!Number.isNaN(minScore) && (opp.metrics?.transactionalScore ?? 0) < minScore) return false;
            return true;
          });

        let auditStatus = null;
        if (fs.existsSync(auditReportPath)) {
          try {
            const ar = JSON.parse(fs.readFileSync(auditReportPath, 'utf8'));
            auditStatus = {
              generatedAt: ar.generatedAt,
              status: ar.status,
              pageSpeedCwvAudit: ar.pageSpeedCwvAudit
            };
          } catch {}
        }

        return sendJson(res, 200, {
          ok: true,
          generatedAt: matrix.generatedAt,
          engineVersion: matrix.engineVersion,
          summary: matrix.summary,
          auditStatus,
          filteredCount: items.length,
          opportunities: items.slice(0, limit),
          ctrEnrichmentQueue: Array.isArray(matrix.ctrEnrichmentQueue) ? matrix.ctrEnrichmentQueue.slice(0, 15) : []
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: 'matrix_read_failed', message: String(err?.message || err) });
      }
    }
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && (parsedUrl.pathname === '/apple-app-site-association' || parsedUrl.pathname === '/.well-known/apple-app-site-association')) {
    const aasaBody = JSON.stringify({ applinks: { apps: [], details: [] }, webcredentials: { apps: ['SWEEPR.sweeprdeepblock.com'] } });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : aasaBody);
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname.startsWith('/cdn-cgi/l/email-protection')) {
    res.writeHead(301, { Location: '/support', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname.length > 1 && /[).,\]]+$/.test(parsedUrl.pathname)) {
    const cleanTarget = ((parsedUrl.pathname.replace(/[).,\]]+$/, '') || '/').replace(/^\/+/, '/')) + (parsedUrl.search || '');
    res.writeHead(301, { Location: cleanTarget, 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }
  // First-Party GA4 Script & Measurement Proxy (/metrics/js, /metrics/g/collect, /metrics/collect, /api/analytics/event)
  if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/metrics/js') {
    const tagId = (parsedUrl.searchParams.get('id') || 'G-01MNBQSL9K').replace(/[^A-Za-z0-9_-]/g, '');
    try {
      if (!global.__ga4ScriptCache || Date.now() - global.__ga4ScriptCache.ts > 3600000) {
        const upstream = await fetch(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`, {
          headers: { 'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000)
        });
        if (upstream.ok) {
          const rawJs = await upstream.text();
          global.__ga4ScriptCache = { ts: Date.now(), body: rawJs };
        }
      }
      if (global.__ga4ScriptCache && global.__ga4ScriptCache.body) {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end(req.method === 'HEAD' ? undefined : global.__ga4ScriptCache.body);
      }
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end('/* first-party analytics fallback */');
  }

  if (
    (req.method === 'GET' || req.method === 'POST') &&
    (pathname === '/metrics/g/collect' || pathname === '/metrics/collect')
  ) {
    try {
      const rawPost = req.method === 'POST' ? await readRawBody(req, 64 * 1024).catch(() => '') : '';
      const clientIp = getClientIp(req);
      const qs = new URLSearchParams(parsedUrl.search || '');
      if (clientIp && !qs.has('_uip')) qs.set('_uip', clientIp);
      const targetUrl = `https://region1.google-analytics.com/g/collect?${qs.toString()}`;
      fetch(targetUrl, {
        method: req.method,
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
          'Content-Type': req.headers['content-type'] || 'text/plain;charset=UTF-8',
          'X-Forwarded-For': clientIp
        },
        body: req.method === 'POST' && rawPost ? rawPost : undefined,
        signal: AbortSignal.timeout(3000)
      }).catch(() => {});
    } catch {}
    res.writeHead(204, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': PUBLIC_URL
    });
    return res.end();
  }

  if (req.method === 'POST' && pathname === '/api/analytics/event') {
    if (!checkRateLimit(req, 'analytics_event', 90, 60000)) {
      return sendJson(res, 429, { ok: false });
    }
    const body = await readBody(req, 16 * 1024);
    if (!body || body.__tooLarge) return sendJson(res, 400, { ok: false });
    const eventName = String(body.event || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
    if (!eventName) return sendJson(res, 400, { ok: false });
    const params = body.params && typeof body.params === 'object' ? body.params : {};
    const clientIp = getClientIp(req);
    const ua = String(req.headers['user-agent'] || 'Mozilla/5.0');
    const gaCookieMatch = String(req.headers.cookie || '').match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
    const cid = String(
      body.clientId ||
      (gaCookieMatch ? gaCookieMatch[1] : `${Math.abs(crypto.createHash('sha256').update(clientIp + ua).digest().readInt32BE(0))}.${Math.floor(Date.now() / 1000)}`)
    ).slice(0, 64);

    const gaQs = new URLSearchParams({
      v: '2',
      tid: 'G-01MNBQSL9K',
      cid,
      en: eventName,
      dl: String(body.url || `${PUBLIC_URL}${body.path || '/'}`).slice(0, 300),
      dt: String(body.title || 'SWEEPR Deepblock').slice(0, 120),
      _uip: clientIp
    });
    if (body.referrer) gaQs.set('dr', String(body.referrer).slice(0, 300));
    for (const [k, v] of Object.entries(params)) {
      const cleanKey = String(k).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
      if (!cleanKey || v === undefined || v === null) continue;
      if (typeof v === 'number' && Number.isFinite(v)) {
        gaQs.set(`epn.${cleanKey}`, String(v));
      } else {
        gaQs.set(`ep.${cleanKey}`, String(v).slice(0, 100));
      }
    }
    fetch(`https://region1.google-analytics.com/g/collect?${gaQs.toString()}`, {
      method: 'POST',
      headers: { 'User-Agent': ua, 'X-Forwarded-For': clientIp },
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});

    if (!BOT_UA_RE.test(ua)) {
      reportToSweeprCrm('/v1/telemetry/event', {
        event_name: `ga4_${eventName}`,
        category: 'funnel',
        os: 'web',
        properties: { path: String(body.path || '/').slice(0, 120), ...params }
      });
    }
    return sendJson(res, 200, { ok: true });
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname === '/' && parsedUrl.searchParams.get('home') === '1') {
    res.writeHead(301, { Location: '/', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    return res.end();
  }
  // 301 Canonical Redirect 1: Trailing slash normalization (e.g. /pricing/ -> /pricing)
  if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname.length > 1 && parsedUrl.pathname.endsWith('/')) {
    const cleanPath = (parsedUrl.pathname.replace(/\/+$/, '') || '/').replace(/^\/+/, '/') + (parsedUrl.search || '');
    res.writeHead(301, {
      Location: cleanPath,
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    });
    return res.end();
  }

  // 301 Canonical Redirect 2: .html extension stripping to canonical clean URLs
  if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname.endsWith('.html')) {
    const cleanPath = (parsedUrl.pathname === '/index.html' ? '/' : parsedUrl.pathname.slice(0, -5)).replace(/^\/+/, '/') + (parsedUrl.search || '');
    res.writeHead(301, {
      Location: cleanPath,
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    });
    return res.end();
  }

  // 301 Canonical Redirect 3: Lowercase normalization for HTML and SEO routes (prevents case duplicate content & Linux 404s)
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    /[A-Z]/.test(parsedUrl.pathname) &&
    !parsedUrl.pathname.includes('SWEEPR') &&
    !parsedUrl.pathname.startsWith('/api/') &&
    !parsedUrl.pathname.startsWith('/checkout')
  ) {
    const lowerPath = parsedUrl.pathname.toLowerCase() + (parsedUrl.search || '');
    res.writeHead(301, {
      Location: lowerPath,
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    });
    return res.end();
  }

  // Resolve target file for static assets and programmatic SEO landing pages
  if (req.method === 'GET' && pathname.startsWith('/download/') && !BOT_UA_RE.test(String(req.headers['user-agent'] || ''))) {
    const dlOs = pathname.endsWith('.exe')
      ? 'windows'
      : pathname.endsWith('.command')
      ? 'mac'
      : pathname.endsWith('.mobileconfig')
      ? 'ios'
      : pathname.endsWith('.apk')
      ? 'android'
      : 'extension';
    requestSweeprCrm('/v1/telemetry/event', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        event_name: 'installer_downloaded',
        category: 'funnel',
        os: dlOs,
        properties: { path: pathname, referrer: String(req.headers.referer || '').slice(0, 200) }
      }
    }).catch(() => {});
  }
  let candidateRel = CLEAN_ROUTES[pathname];
  const CHROME_WEBSTORE_URL =
    process.env.CHROME_WEBSTORE_URL ||
    'https://chromewebstore.google.com/detail/sweepr-deepblock-ad-cooki/bkdfhdgmglfancgpkcbdceinfdlccmpc';
  const FIREFOX_AMO_URL =
    process.env.FIREFOX_AMO_URL ||
    'https://addons.mozilla.org/firefox/addon/sweepr-deepblock/';

  if (req.method === 'GET' && (pathname === '/chrome' || pathname === '/cws')) {
    res.writeHead(302, {
      Location: CHROME_WEBSTORE_URL,
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    return res.end();
  }

  if (req.method === 'GET' && (pathname === '/firefox' || pathname === '/amo')) {
    res.writeHead(302, {
      Location: FIREFOX_AMO_URL,
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    return res.end();
  }

  if (pathname === '/download') {
    const reqPlat = (parsedUrl.searchParams.get('platform') || '').toLowerCase();
    const reqStore = (parsedUrl.searchParams.get('store') || '').toLowerCase();
    const isAutoInstall =
      parsedUrl.searchParams.get('install') === '1' ||
      parsedUrl.searchParams.get('direct') === '1' ||
      reqStore === 'chrome' ||
      reqStore === 'firefox';
    const uaLower = String(req.headers['user-agent'] || '').toLowerCase();
    const chPlat = String(req.headers['sec-ch-ua-platform'] || '').toLowerCase();
    const chMob = String(req.headers['sec-ch-ua-mobile'] || '').toLowerCase();
    const isIosReq = reqPlat === 'ios' || /iphone|ipad|ipod/.test(uaLower) || chPlat.includes('ios');
    const isNonSafariIos = isIosReq && /crios|fxios|edgios|opios|instagram|fban|fbav|tiktok|line\//i.test(uaLower);
    const isFirefoxBrowser = !isIosReq && !reqPlat && /firefox\//i.test(uaLower);
    const isAndroidReq =
      reqPlat === 'android' ||
      reqPlat === 'apk' ||
      (!isFirefoxBrowser &&
        (uaLower.includes('android') ||
          chPlat.includes('android') ||
          (chMob === '?1' && uaLower.includes('linux')) ||
          /mobile|iemobile|opera mini/.test(uaLower)));
    const isDesktopChromium =
      !isIosReq &&
      !isAndroidReq &&
      !isFirefoxBrowser &&
      !reqPlat &&
      /chrome\/|chromium\//i.test(uaLower) &&
      !/edg\/|firefox\/|fxios\//i.test(uaLower);

    if (isIosReq && (!isNonSafariIos || reqPlat === 'ios')) {
      candidateRel = 'sweepr-deepblock.mobileconfig';
    } else if (req.method === 'GET' && (reqStore === 'firefox' || (isAutoInstall && isFirefoxBrowser))) {
      if (!BOT_UA_RE.test(uaLower)) {
        requestSweeprCrm('/v1/telemetry/event', {
          method: 'POST',
          body: {
            project_id: 'deepblock',
            event_name: 'installer_downloaded',
            category: 'funnel',
            os: 'firefox_amo',
            properties: { path: pathname + parsedUrl.search, referrer: String(req.headers.referer || '').slice(0, 200) }
          }
        }).catch(() => {});
      }
      res.writeHead(302, {
        Location: FIREFOX_AMO_URL,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      return res.end();
    } else if (isAndroidReq) {
      candidateRel = 'SWEEPRDeepblock.apk';
    } else if (req.method === 'GET' && (reqStore === 'chrome' || (isAutoInstall && isDesktopChromium))) {
      if (!BOT_UA_RE.test(uaLower)) {
        requestSweeprCrm('/v1/telemetry/event', {
          method: 'POST',
          body: {
            project_id: 'deepblock',
            event_name: 'installer_downloaded',
            category: 'funnel',
            os: 'chrome_webstore',
            properties: { path: pathname + parsedUrl.search, referrer: String(req.headers.referer || '').slice(0, 200) }
          }
        }).catch(() => {});
      }
      res.writeHead(302, {
        Location: CHROME_WEBSTORE_URL,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      return res.end();
    }
  }
  if (!candidateRel) {
    if (/^\/(solutions|setup|vs|guides|tools|site|glossary|campaigns|de|fr|stories)\/[a-z0-9-]+$/i.test(pathname)) {
      candidateRel = pathname.slice(1) + '.html';
    } else if (pathname.length > 1 && !path.extname(pathname)) {
      const htmlCandidate = pathname.slice(1) + '.html';
      const targetAbs = path.resolve(WEBSITE_DIR, htmlCandidate);
      if (
        targetAbs.startsWith(path.resolve(WEBSITE_DIR) + path.sep) &&
        fs.existsSync(targetAbs) &&
        fs.statSync(targetAbs).isFile()
      ) {
        candidateRel = htmlCandidate;
      }
    }
  }
  const mappedRelative = candidateRel || pathname.slice(1);
  const safePath = path.normalize(mappedRelative).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(WEBSITE_DIR, safePath);
  const resolvedRoot = path.resolve(WEBSITE_DIR);

  // Security checks: directory traversal, null bytes, dotfiles, and blocked internal files
  if (req.url.includes('%00') || pathname.includes('\0') || safePath.includes('\0')) {
    return sendErrorResponse(res, 400, '400 Bad Request');
  }

  const BLOCKED_STATIC_FILES = new Set([
    'server.js',
    'sweepr-client.js',
    'package.json',
    'package-lock.json',
    'dockerfile',
    'railway.json',
    'indexing-queue.json',
    'daily-seo-pages-state.json',
    'outreach-seed-deepblock.json',
    '.dockerignore',
    '.gitignore',
    '.env',
    '.env.example'
  ]);

  const BLOCKED_EXTENSIONS = new Set([
    '.env',
    '.bak',
    '.conf',
    '.log',
    '.md',
    '.ts',
    '.mjs',
    '.sh',
    '.yml',
    '.yaml',
    '.sql',
    '.sqlite',
    '.sqlite3',
    '.db',
    '.lock',
    '.pem',
    '.crt',
    '.key',
    '.pfx',
    '.cfg',
    '.ini'
  ]);

  const baseName = path.basename(fullPath).toLowerCase();
  const ext = path.extname(fullPath).toLowerCase();
  const relPath = path.relative(resolvedRoot, fullPath);
  const segments = relPath.split(path.sep);
  const hasHiddenSegment = segments.some((seg) => seg.startsWith('.') && seg !== '.well-known');

  if (
    (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + path.sep)) ||
    BLOCKED_STATIC_FILES.has(baseName) ||
    BLOCKED_EXTENSIONS.has(ext) ||
    hasHiddenSegment ||
    (ext === '.json' && baseName !== 'manifest.json' && baseName !== 'site.webmanifest')
  ) {
    return sendErrorResponse(res, 403, '403 Forbidden');
  }

  return serveStaticOptimized(req, res, fullPath);
  } catch (err) {
    console.error('[SWEEPR SERVER UNCAUGHT ERROR]', err);
    sliMetrics.error5xxCount += 1;
    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'server_uncaught_error',
      category: 'incident',
      os: 'server',
      properties: { message: String(err?.message || err).slice(0, 200) }
    });
    if (!res.headersSent) {
      sendErrorResponse(res, 500, '500 Internal Server Error');
    }
  }
});

// ============================================================================
// AUTONOMOUS CMO AUTOMATION SCHEDULER (Non-Blocking Sequential Worker Queue)
// ============================================================================
global.__cmoAutomationJobs = [
  {
    id: 'keyword_research_engine',
    name: 'Transactional Keyword Research & Low-KD Opportunity Engine',
    script: 'scripts/keyword-research-engine.mjs',
    outputFile: 'data/keyword-opportunity-matrix.json',
    intervalMs: 12 * 60 * 60 * 1000,
    timeoutMs: 90000
  },
  {
    id: 'sync_geo_and_llms',
    name: 'Unified GEO, llms.txt, pad.xml & Benchmark Feed Sync',
    script: 'scripts/sync-geo-and-llms.mjs',
    outputFile: 'website/geo-benchmark-feed.json',
    intervalMs: 12 * 60 * 60 * 1000,
    timeoutMs: 45000
  },
  {
    id: 'enrich_pillars_live_proof',
    name: 'E-E-A-T Live Telemetry Proof & CTR Queue Injector',
    script: 'scripts/enrich-pillars-with-live-proof.mjs',
    outputFile: 'website/pillar-enrichment-state.json',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 60000
  },
  {
    id: 'competitor_review_miner',
    name: 'Competitor Vulnerability & Paid Ad Copy Refresher',
    script: 'scripts/competitor-review-miner.mjs',
    outputFile: 'data/competitor-review-clusters.json',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 60000
  },
  {
    id: 'funnel_cro_analyzer',
    name: 'Funnel Drop-Off & Strike-Zone CRO Analyzer',
    script: 'scripts/funnel-cro-analyzer.mjs',
    outputFile: 'data/cro-funnel-diagnostics.json',
    intervalMs: 6 * 60 * 60 * 1000,
    timeoutMs: 45000
  },
  {
    id: 'reinvestment_stage_gate',
    name: 'Paid Acquisition Stage-Gate & Budget Reinvestment Modeler',
    script: 'scripts/reinvestment-stage-gate.mjs',
    outputFile: 'data/reinvestment-stage-gate-report.json',
    intervalMs: 6 * 60 * 60 * 1000,
    timeoutMs: 45000
  },
  {
    id: 'gsc_strike_zone_optimizer',
    name: 'GSC Strike-Zone & Internal Link Equity Optimizer',
    script: 'scripts/gsc-strike-zone-optimizer.mjs',
    outputFile: 'data/gsc-strike-zone-report.json',
    intervalMs: 12 * 60 * 60 * 1000,
    timeoutMs: 60000
  },
  {
    id: 'build_aso_store_listings',
    name: 'Multi-Locale Store ASO & Compliance Packager (9 Locales)',
    script: 'scripts/build-aso-store-listings.mjs',
    outputFile: 'dist/store-listings/aso-compliance-report.json',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 45000
  },
  {
    id: 'build_stage3_expansion_ads',
    name: 'Stage-3 ChatGPT Search & EU DE/FR Ad Pack Builder',
    script: 'scripts/build-stage3-expansion-ads.mjs',
    outputFile: 'dist/chatgpt-search-ads-stage3-export.csv',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 45000
  },
  {
    id: 'daily_ad_filter_pipeline',
    name: 'Daily MV3 Ad-Filter Harvest & OTA Delta Pipeline',
    script: 'scripts/daily-ad-filter-pipeline.mjs',
    args: ['25', '--git-mode=dry-run'],
    outputFile: 'data/filter-harvest-report.json',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 180000
  },
  {
    id: 'deepblock_seo_drip',
    name: 'IndexNow Priority Indexing, Store Backlink & PAD Syndication',
    script: 'scripts/deepblock-seo-drip.mjs',
    args: ['20'],
    outputFile: 'website/indexing-queue.json',
    intervalMs: 12 * 60 * 60 * 1000,
    timeoutMs: 120000
  },
  {
    id: 'daily_seo_pagespeed_audit',
    name: 'Technical SEO, Cannibalization & CWV Guardrail Audit',
    script: 'scripts/daily-seo-pagespeed-audit.mjs',
    args: ['3'],
    outputFile: 'data/daily-seo-audit-report.json',
    intervalMs: 24 * 60 * 60 * 1000,
    timeoutMs: 120000
  },
  {
    id: 'gsc_consolidation_redirect_guard',
    name: 'GSC Consolidation & 301 Redirect Health Guard',
    script: 'scripts/gsc-consolidation-redirect-guard.mjs',
    outputFile: 'data/gsc-consolidation-health.json',
    intervalMs: 12 * 60 * 60 * 1000,
    timeoutMs: 90000
  }
];

global.__cmoAutomationQueue = [];
global.__cmoRunningJob = null;

function drainCmoAutomationQueue() {
  if (global.__cmoRunningJob || global.__cmoAutomationQueue.length === 0) return;
  const nextJob = global.__cmoAutomationQueue.shift();
  if (!nextJob) return;
  const scriptAbs = path.join(__dirname, nextJob.script);
  if (!fs.existsSync(scriptAbs)) {
    return setImmediate(drainCmoAutomationQueue);
  }
  global.__cmoRunningJob = { id: nextJob.id, startedAt: new Date().toISOString() };
  const startMs = Date.now();
  const { execFile } = require('child_process');
  execFile(
    process.execPath,
    [scriptAbs, ...(Array.isArray(nextJob.args) ? nextJob.args : [])],
    { cwd: __dirname, timeout: nextJob.timeoutMs || 60000, windowsHide: true },
    (err) => {
      const durationMs = Date.now() - startMs;
      const stateFile = path.join(__dirname, 'data', 'automation-scheduler-state.json');
      let state = {};
      if (fs.existsSync(stateFile)) {
        try {
          state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        } catch {}
      }
      state[nextJob.id] = {
        status: err ? 'error' : 'ok',
        lastRunAt: new Date().toISOString(),
        durationMs,
        error: err ? String(err.message || err).slice(0, 200) : null
      };
      try {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
      } catch {}
      if (nextJob.id === 'keyword_research_engine') global.__kwMatrixCache = null;
      if (nextJob.id === 'sync_geo_and_llms') global.__liveProofCache = null;
      global.__cmoRunningJob = null;
      setTimeout(drainCmoAutomationQueue, 2000).unref();
    }
  );
}

global.__enqueueCmoAutomation = function (targetId = 'all') {
  const jobs = global.__cmoAutomationJobs || [];
  const matched = targetId === 'all' ? jobs : jobs.filter((j) => j.id === targetId);
  const queuedIds = [];
  for (const j of matched) {
    if (!global.__cmoAutomationQueue.some((q) => q.id === j.id) && global.__cmoRunningJob?.id !== j.id) {
      global.__cmoAutomationQueue.push(j);
      queuedIds.push(j.id);
    }
  }
  setImmediate(drainCmoAutomationQueue);
  return queuedIds;
};

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SWEEPR Deepblock server running on http://0.0.0.0:${PORT}`);
  });
  if (process.env.NODE_ENV === 'production') {
    const altPort = PORT === 3000 ? 8080 : 3000;
    const altServer = http.createServer((req, res) => server.emit('request', req, res));
    altServer.on('error', () => {});
    altServer.listen(altPort, '0.0.0.0');
  }
  // Check for stale CMO automation artifacts 15s after boot and every 30 minutes
  const checkStaleCmoJobs = () => {
    try {
      const now = Date.now();
      for (const job of global.__cmoAutomationJobs || []) {
        const outAbs = path.join(__dirname, job.outputFile);
        const isStale = !fs.existsSync(outAbs) || now - fs.statSync(outAbs).mtimeMs > job.intervalMs;
        if (isStale) {
          global.__enqueueCmoAutomation(job.id);
        }
      }
    } catch {}
  };
  setTimeout(checkStaleCmoJobs, 15 * 1000).unref();
  setInterval(checkStaleCmoJobs, 30 * 60 * 1000).unref();
}

module.exports = server;
