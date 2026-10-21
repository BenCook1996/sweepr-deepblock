// SWEEPR Deepblock — Zero-Dependency HTTP Server, Live Stripe Subscriptions & Multi-SKU Licensing API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SweeprCrmClient } = require('./sweepr-client.js');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch {}
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const WEBSITE_DIR = path.join(__dirname, 'website');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();
const CRM_ADMIN_PASSWORD = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const ALLOW_DEV_MOCK_CHECKOUT = process.env.ALLOW_DEV_MOCK_CHECKOUT === '1';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_LOCAL_ACCOUNTS = 10000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
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
  const allowedOrigins = new Set([
    PUBLIC_URL,
    'https://sweeprdeepblock.com',
    'https://www.sweeprdeepblock.com',
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ]);
  const rawOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (rawOrigin && allowedOrigins.has(rawOrigin)) return rawOrigin;
  return PUBLIC_URL;
}

const rateLimitBuckets = new Map();
function checkRateLimit(req, bucketName, maxRequests = 30, windowMs = 60000) {
  const ip =
    String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitBuckets.size > 10000) rateLimitBuckets.clear();
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// AES-256-GCM encrypted live Stripe credentials for SWEEPR Deepblock (acct_1USkPH12f60YC3Bg)
const ENCRYPTED_LIVE_SK =
  '492a9cabae1f9a6f77a54f50:ab3ecf80d38719ae999b66ab67866c56:4570b1e222c50e73a7aea683bdf757f33961779dabaa852e7ad3e05618542c3091d1df70db9131b4022f3769d8f82857ea796fba47fa38a789ddba6171ddf2efa361f48638bd346665ae6769e1167e27fba0a50f1abb6ceec0faa7432be71b4e15db00d310d6699667d9d3';
const ENCRYPTED_LIVE_WHSEC =
  '6e82e1c9bbdc611d2700ab86:ed08e4e79a17a6c3086463f02ad460bf:b8a9f0b630803f8d2daefd8f5bbb9af28d2716ff54570eae301f1ee4b59aa41ae5f557715273';

function decryptWithAdminKey(payload) {
  if (!CRM_ADMIN_PASSWORD || !payload) return '';
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const key = crypto.createHash('sha256').update(CRM_ADMIN_PASSWORD).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function resolveStripeSecretKey() {
  const envKey = (process.env.STRIPE_SECRET_KEY || process.env.DEEPBLOCK_STRIPE_SECRET_KEY || '').trim();
  if (envKey.startsWith('sk_live_') || envKey.startsWith('sk_test_')) return envKey;
  const dec = decryptWithAdminKey(ENCRYPTED_LIVE_SK);
  if (dec.startsWith('sk_live_')) return dec;
  return envKey;
}

const STRIPE_SECRET_KEY = resolveStripeSecretKey();
const IS_LIVE_STRIPE = STRIPE_SECRET_KEY.startsWith('sk_live_');

function resolveStripeWebhookSecret() {
  const envWh = (process.env.STRIPE_WEBHOOK_SECRET || process.env.DEEPBLOCK_STRIPE_WEBHOOK_SECRET || '').trim();
  if (envWh.startsWith('whsec_')) return envWh;
  if (IS_LIVE_STRIPE) {
    const dec = decryptWithAdminKey(ENCRYPTED_LIVE_WHSEC);
    if (dec.startsWith('whsec_')) return dec;
  }
  return envWh;
}

const STRIPE_WEBHOOK_SECRET = resolveStripeWebhookSecret();
const STRIPE_PUBLISHABLE_KEY =
  (process.env.STRIPE_PUBLISHABLE_KEY || process.env.DEEPBLOCK_STRIPE_PUBLISHABLE_KEY || '').trim() ||
  'pk_live_51USkPH12f60YC3BgReuvRVTVOsy3DRmrMVeZDE7Nev8mAUiMIDzgCWWrxTJlG0ATAUZtB9937kGr8r9xXkjALMxT00KHsxhs4C';

const STRIPE_PRODUCT_MAIN = (process.env.STRIPE_PRODUCT_MAIN || 'prod_VTi9pQfsnRD8Uo').trim();
const STRIPE_PRODUCT_RAM_TAMER = (process.env.STRIPE_PRODUCT_RAM_TAMER || 'prod_VTi9kxjGjyWMIj').trim();
const STRIPE_PRICE_ANNUAL = (process.env.STRIPE_PRICE_ANNUAL || 'price_1USkjM12f60YC3BgrVwMQXa6').trim();
const STRIPE_PRICE_SIX_MONTH = (process.env.STRIPE_PRICE_SIX_MONTH || 'price_1USkjM12f60YC3BgMe9vezeT').trim();
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY || 'price_1USkjM12f60YC3BgGgzH91v5').trim();
const STRIPE_COUPON = (process.env.STRIPE_COUPON || 'sweepr_intro_gbp_800').trim();

const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

// ============================================================================
// Multi-Currency Geo-Pricing Engine (50% Annual Savings & .99 Charm Pricing)
// ============================================================================
const PRICING_BY_CURRENCY = {
  gbp: { currency: 'gbp', symbol: '£', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 5999, sixMonthAmount: 4499, monthlyAmount: 999, introMonthlyAmount: 199, ramTamerAnnualAmount: 1499, ramTamerSixMonthAmount: 999, ramTamerMonthlyAmount: 199 },
  usd: { currency: 'usd', symbol: '$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 7499, sixMonthAmount: 5499, monthlyAmount: 1199, introMonthlyAmount: 199, ramTamerAnnualAmount: 1999, ramTamerSixMonthAmount: 1299, ramTamerMonthlyAmount: 299 },
  eur: { currency: 'eur', symbol: '€', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 6999, sixMonthAmount: 5199, monthlyAmount: 1099, introMonthlyAmount: 199, ramTamerAnnualAmount: 1799, ramTamerSixMonthAmount: 1199, ramTamerMonthlyAmount: 249 },
  cad: { currency: 'cad', symbol: 'CA$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 9999, sixMonthAmount: 7499, monthlyAmount: 1599, introMonthlyAmount: 299, ramTamerAnnualAmount: 2699, ramTamerSixMonthAmount: 1799, ramTamerMonthlyAmount: 349 },
  aud: { currency: 'aud', symbol: 'A$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 11499, sixMonthAmount: 8499, monthlyAmount: 1799, introMonthlyAmount: 299, ramTamerAnnualAmount: 2999, ramTamerSixMonthAmount: 1999, ramTamerMonthlyAmount: 399 },
  nzd: { currency: 'nzd', symbol: 'NZ$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 12499, sixMonthAmount: 8999, monthlyAmount: 1999, introMonthlyAmount: 299, ramTamerAnnualAmount: 3299, ramTamerSixMonthAmount: 2199, ramTamerMonthlyAmount: 449 },
  chf: { currency: 'chf', symbol: 'CHF ', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 6499, sixMonthAmount: 4899, monthlyAmount: 1099, introMonthlyAmount: 199, ramTamerAnnualAmount: 1699, ramTamerSixMonthAmount: 1099, ramTamerMonthlyAmount: 249 },
  jpy: { currency: 'jpy', symbol: '¥', symbolPosition: 'prefix', zeroDecimal: true, annualAmount: 11480, sixMonthAmount: 8480, monthlyAmount: 1880, introMonthlyAmount: 290, ramTamerAnnualAmount: 2999, ramTamerSixMonthAmount: 1999, ramTamerMonthlyAmount: 399 }
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
  const annualMonthlyEq = cfg.zeroDecimal
    ? Math.round(cfg.annualAmount / 12)
    : Math.floor((cfg.annualAmount / 12)) ;
  const sixMonthMonthlyEq = cfg.zeroDecimal
    ? Math.round(cfg.sixMonthAmount / 6)
    : Math.floor((cfg.sixMonthAmount / 6));

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

async function stripeRequest(method, endpoint, params) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured on this server.');
  }
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  let url = `https://api.stripe.com/v1/${cleanEndpoint}`;
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-06-20'
  };
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

  const res = await fetch(url, fetchOpts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error (${res.status})`);
    err.code = data?.error?.code;
    err.type = data?.error?.type;
    err.status = res.status;
    throw err;
  }
  return data;
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
// Central SWEEPR CRM Sync & Local Account / License Store
// ============================================================================
const crm = new SweeprCrmClient({
  projectId: 'deepblock',
  crmUrl: SWEEPR_CRM_URL,
  apiKey: SWEEPR_CRM_API_KEY || CRM_ADMIN_PASSWORD,
  adminPassword: CRM_ADMIN_PASSWORD
});

function crmHeaders() {
  return crm.headers();
}

function reportToSweeprCrm(pathAndQuery, body) {
  try {
    fetch(`${SWEEPR_CRM_URL}${pathAndQuery}`, {
      method: 'POST',
      headers: crmHeaders(),
      body: JSON.stringify({ project_id: 'deepblock', ...body })
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

async function syncSubscriptionWithSweeprCrm(acc, { amountCents, currency = 'gbp', notes } = {}) {
  if (!acc || !acc.email) return acc;
  try {
    const crmRes = await crm.syncSubscription({
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
      notes: notes || `Synced from SWEEPR Deepblock (${acc.licenseKey})`
    });
    if (crmRes.ok && crmRes.data) {
      if (crmRes.data.activation_code && crmRes.data.activation_code !== acc.activation_code) {
        licenses.delete(acc.activation_code);
        acc.activation_code = String(crmRes.data.activation_code);
      }
      if (crmRes.data.account_id) {
        acc.crm_account_id = crmRes.data.account_id;
        accountsById.set(crmRes.data.account_id, acc);
      }
      licenses.set(acc.licenseKey, acc);
      licenses.set(acc.activation_code, acc);
      licenses.set(`SWEEPR-DB-${acc.activation_code}`, acc);
      licenses.set(`DEEPBLOCK-${acc.activation_code}`, acc);
    }
  } catch {}
  return acc;
}

const licenses = new Map();
const accountsById = new Map();
const accountsByEmail = new Map();
const accountsBySubscriptionId = new Map();

function buildDeepblockEntitlements(ramTamerAddon) {
  const list = [
    'pro_cookie_autoreject',
    'pro_ai_slop_purifier',
    'pro_clutter_stripper',
    'bundle_fake_store_detector',
    'bundle_encrypted_dns_proxy'
  ];
  if (ramTamerAddon) {
    list.push('addon_total_tab_and_ram_tamer');
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

function upsertLocalAccount({ email, name, country, stripeCustomerId, plan, ramTamerAddon, subscriptionId, status = 'active' }) {
  const normEmail = (email || '').trim().toLowerCase();
  let acc = (normEmail && accountsByEmail.get(normEmail)) || null;
  if (!acc) {
    evictStaleLeadAccountsIfNeeded();
    const activationCode = String(crypto.randomInt(100000, 1000000));
    const accountId = `acc_db_${crypto.randomBytes(6).toString('hex')}`;
    const licenseKey = generateHighEntropyLicenseKey();
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
      ramTamerAddon: Boolean(ramTamerAddon),
      entitlements: buildDeepblockEntitlements(Boolean(ramTamerAddon)),
      status,
      createdAt: new Date().toISOString()
    };
  } else {
    const isAlreadyActive = acc.status === 'active';
    const isUnpaidTransition = status === 'lead' || status === 'pending';
    if (!isAlreadyActive || !isUnpaidTransition) {
      if (name) acc.name = name;
      if (country) acc.country = country;
      if (plan) acc.plan = plan;
      if (ramTamerAddon !== undefined) {
        acc.ramTamerAddon = Boolean(ramTamerAddon);
        acc.entitlements = buildDeepblockEntitlements(acc.ramTamerAddon);
      }
      if (status) acc.status = status;
    }
    if (stripeCustomerId) acc.stripe_customer_id = stripeCustomerId;
    if (subscriptionId) acc.stripe_subscription_id = subscriptionId;
  }

  accountsById.set(acc.id, acc);
  if (normEmail) {
    accountsByEmail.set(normEmail, acc);
  }
  licenses.set(acc.licenseKey, acc);
  licenses.set(acc.activation_code, acc);
  licenses.set(`SWEEPR-DB-${acc.activation_code}`, acc);
  licenses.set(`DEEPBLOCK-${acc.activation_code}`, acc);
  if (subscriptionId) accountsBySubscriptionId.set(subscriptionId, acc);
  return acc;
}

function signSessionCookie(accountId, email) {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  const payload = Buffer.from(JSON.stringify({ sub: accountId, email, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
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
  '.ico': 'image/x-icon'
};

const CLEAN_ROUTES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/checkout': 'order.html',
  '/login': 'login.html',
  '/download': 'download.html',
  '/test-lab': 'test-lab.html',
  '/vs/total-adblock': path.join('vs', 'total-adblock.html')
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
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
    ...extraHeaders
  });
  res.end(html);
}

function readRawBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
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
  <script src="https://cdn.tailwindcss.com"></script>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>You're Activated 🎉 — SWEEPR Deepblock Pro</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    try {
      localStorage.removeItem('deepblock_visited_order');
      localStorage.removeItem('sweepr_visited_order');
      document.cookie = 'sweepr_visited_order=; path=/; max-age=0';
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
        <button onclick="navigator.clipboard.writeText('${licenseKey}'); this.textContent='Copied ✓';" class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer">
          Copy Key
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-300 pt-1">
        <span>6-Digit Portal Login Code:</span>
        <span class="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded">${activationCode}</span>
      </div>
      <div class="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
        <div class="font-bold text-slate-200 mb-1">Unlocked on your account (Up to 5 Devices):</div>
        <div>✓ YouTube &amp; Banner Ad Blocker + Auto Cookie Pop-Up Closer</div>
        <div>✓ Fake Online Shop &amp; Review Detector + Private Browsing Protection</div>
        ${hasRamTamer ? '<div class="text-emerald-400 font-semibold">✓ Total Tab &amp; RAM Tamer Speed Add-On Active</div>' : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      <a href="/download" class="py-3.5 px-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-lg no-underline">
        Install Browser Extension
      </a>
      <a href="/login" class="py-3.5 px-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 no-underline">
        Open Customer Portal
      </a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const ua = req.headers['user-agent'] || '';

  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    reportToSweeprCrm('/api/crm/seo/bot-hit?project=deepblock', { user_agent: ua, path: pathname, status: 200 });
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
      }
    });
  }

  // API 1b: Lead Capture when visitor enters email on /order
  if (req.method === 'POST' && pathname === '/api/lead') {
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
    if (!checkRateLimit(req, 'create_sub', 15, 60000)) {
      return sendJson(res, 429, { error: 'Too many checkout attempts. Please wait a moment and try again.' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    if (!body) return sendJson(res, 400, { error: 'Invalid request body.' });
    if (!STRIPE_SECRET_KEY) return sendJson(res, 503, { error: 'stripe_not_configured' });

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toLowerCase() : 'card';
    const isPayPal = paymentMethod === 'paypal';
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay';
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    if (providedEmail && !isValidEmail(providedEmail)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }
    const email =
      (providedEmail ? providedEmail : null) ||
      (isPayPal || isWallet
        ? `${isPayPal ? 'paypal' : 'wallet'}_${crypto.randomBytes(4).toString('hex')}@pending.sweeprdeepblock.com`
        : null);

    if (!email) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const addressLine1 = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
    const postalCode = typeof body.postcode === 'string' ? body.postcode.trim().slice(0, 32) : '';
    const rawPlan = typeof body.plan === 'string' ? body.plan.toLowerCase() : 'annual';
    const plan =
      rawPlan === 'annual'
        ? 'annual'
        : rawPlan === 'six_month' || rawPlan === '6month' || rawPlan === 'sixmonth'
        ? 'six_month'
        : 'monthly';
    const applyDiscount = Boolean(body.applyDiscount || body.discountApplied) && plan === 'monthly';
    const includeRamTamer = hasRamTamerInBody(body);

    const localizedPricing = resolvePricingForRequest(req, parsedUrl, body);
    const existingAcc = accountsByEmail.get(email);
    const wasAlreadyActive = Boolean(existingAcc && existingAcc.status === 'active');
    const acc = upsertLocalAccount({
      email,
      name,
      country: localizedPricing.country,
      plan,
      ramTamerAddon: includeRamTamer,
      status: 'pending'
    });

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'checkout_started',
      category: 'funnel',
      account_id: acc.id,
      os: 'web',
      properties: { plan, ramTamerAddon: includeRamTamer, paymentMethod }
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
        country: localizedPricing.country
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
        acc.stripe_customer_id = customerId;
      }

      const isAnnual = plan === 'annual';
      const isSixMonth = plan === 'six_month';
      const productId = await getStripeProductId();
      const unitAmount = isAnnual
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

      if (includeRamTamer) {
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
        !isAnnual && !isSixMonth && applyDiscount
          ? await getOrCreateIntroCoupon(localizedPricing.currency, localizedPricing.introSavingsAmount)
          : '';

      const subParams = {
        customer: customerId,
        items: subItems,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: isPayPal ? ['paypal'] : ['card']
        },
        ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
        metadata,
        expand: ['latest_invoice.payment_intent']
      };

      const subscription = await stripeRequest('POST', 'subscriptions', subParams);
      acc.stripe_subscription_id = subscription.id;
      accountsBySubscriptionId.set(subscription.id, acc);

      const latestInvoice = subscription.latest_invoice;
      let paymentIntent = latestInvoice?.payment_intent || null;
      if (typeof paymentIntent === 'string') {
        paymentIntent = await stripeRequest('GET', `payment_intents/${encodeURIComponent(paymentIntent)}`);
      }

      if (!paymentIntent?.id) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent.' });
      }

      const hostOrigin = resolveTrustedOrigin(req);
      const returnUrl = `${hostOrigin}/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`;

      if (isPayPal) {
        const confirmedPi = await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method_data: {
            type: 'paypal',
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
                ip_address: '127.0.0.1',
                user_agent: req.headers['user-agent'] || 'Mozilla/5.0'
              }
            }
          },
          return_url: returnUrl
        });

        const redirectUrl = confirmedPi.next_action?.redirect_to_url?.url || null;
        if (!redirectUrl) {
          return sendJson(res, 500, { error: 'Could not initialize PayPal authorization redirect.' });
        }

        return sendJson(res, 200, {
          redirectUrl,
          subscriptionId: subscription.id,
          accountId: acc.id,
          plan,
          livemode: Boolean(confirmedPi.livemode)
        });
      }

      // Test-mode server confirmation fallback if confirmOnServer is requested with a sk_test_ key
      if (body.confirmOnServer && paymentIntent.livemode === false) {
        const rawCard = typeof body.cardNumber === 'string' ? body.cardNumber.replace(/\D/g, '') : '';
        const testPm = rawCard.endsWith('0002')
          ? 'pm_card_chargeDeclined'
          : rawCard.startsWith('5')
          ? 'pm_card_mastercard'
          : rawCard.startsWith('3')
          ? 'pm_card_amex'
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

      const metaAccountId = sub.metadata?.account_id || accountId;
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

      const totalAmount = (sub.items?.data || []).reduce(
        (sum, it) => sum + (it.price?.unit_amount || 0) * (it.quantity || 1),
        0
      );

      await syncSubscriptionWithSweeprCrm(acc, {
        amountCents: totalAmount || 5999,
        currency: sub.currency || 'gbp',
        notes: `Stripe Live Subscription ${sub.id} (${acc.licenseKey})`
      });

      reportToSweeprCrm('/v1/telemetry/event', {
        event_name: 'purchase_completed',
        category: 'funnel',
        account_id: acc.crm_account_id || acc.id,
        os: 'web',
        properties: { plan: acc.plan, ramTamerAddon: acc.ramTamerAddon, licenseKey: acc.licenseKey, subscriptionId: sub.id }
      });

      const sessionToken = signSessionCookie(acc.id, acc.email);
      const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
      return sendJson(
        res,
        200,
        {
          ok: true,
          status: sub.status,
          accountId: acc.id,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          entitlements: acc.entitlements,
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
    if ((IS_LIVE_STRIPE || STRIPE_WEBHOOK_SECRET) && !verifyStripeWebhookSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
      return sendJson(res, 400, { error: 'invalid_signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return sendJson(res, 400, { error: 'invalid_json' });
    }

    try {
      const obj = event?.data?.object || {};
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
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
          await syncSubscriptionWithSweeprCrm(syncedAcc, {
            currency: obj.currency || 'gbp',
            notes: `Stripe Webhook (${event.type}) ${obj.id}`
          });
        }
      }
      // Forward raw webhook to central sweepr-crm if reachable
      fetch(`${SWEEPR_CRM_URL}/api/webhooks/stripe/deepblock`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(sig ? { 'stripe-signature': sig } : {})
        },
        body: rawBody
      }).catch(() => {});
    } catch (err) {
      console.error('[webhooks/stripe] handler error:', err.message);
    }

    return sendJson(res, 200, { received: true });
  }

  // Checkout Success & Cancel Pages
  if (req.method === 'GET' && pathname === '/checkout/success') {
    const subscriptionId = (parsedUrl.searchParams.get('subscription_id') || '').trim();
    const accountId = (parsedUrl.searchParams.get('account_id') || '').trim();
    const redirectStatus = (parsedUrl.searchParams.get('redirect_status') || '').trim();

    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      res.writeHead(302, { Location: '/order?error=payment_cancelled' });
      return res.end();
    }

    let acc = accountsById.get(accountId) || accountsBySubscriptionId.get(subscriptionId) || null;
    if (subscriptionId && STRIPE_SECRET_KEY) {
      try {
        const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`);
        if (sub.status === 'incomplete' || sub.status === 'incomplete_expired' || sub.status === 'canceled') {
          res.writeHead(302, { Location: '/order?error=payment_cancelled' });
          return res.end();
        }
        acc = upsertLocalAccount({
          email: acc?.email || sub.metadata?.email || 'customer@sweeprdeepblock.com',
          plan: sub.metadata?.plan || acc?.plan || 'annual',
          ramTamerAddon: sub.metadata?.ram_tamer === 'true' || acc?.ramTamerAddon,
          subscriptionId: sub.id,
          status: 'active'
        });
        await syncSubscriptionWithSweeprCrm(acc, {
          currency: sub.currency || 'gbp',
          notes: `Checkout Success Verified ${sub.id} (${acc.licenseKey})`
        });
      } catch {}
    } else if (acc && acc.status === 'active') {
      await syncSubscriptionWithSweeprCrm(acc);
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
    if (!key || key.length < 6 || key.length > 512 || key.includes('@')) {
      return sendJson(res, 400, { valid: false, error: 'invalid_key_format' });
    }

    // 1. Offline Ed25519 JWS token verification if key is a compact JWS token
    if (key.split('.').length === 3 && crm.publicKeySpki) {
      const offline = crm.verifyLicenseTokenOffline(key);
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
    const crmVerify = await crm.verifyKey(key);
    if (crmVerify.ok && crmVerify.data && typeof crmVerify.data.valid === 'boolean') {
      const crmStatus = String(crmVerify.data.status || 'active').toLowerCase();
      if (crmVerify.data.valid && (crmStatus === 'active' || crmStatus === 'trialing')) {
        const addonsList = Array.isArray(crmVerify.data.addons) ? crmVerify.data.addons : [];
        const hasRamTamer =
          Boolean(crmVerify.data.ramTamerAddon) ||
          addonsList.includes('ram_tamer') ||
          addonsList.includes('sweepr_secure_bundle');
        return sendJson(res, 200, {
          valid: true,
          project_id: 'deepblock',
          account_id: crmVerify.data.account_id,
          activation_code: crmVerify.data.activation_code,
          licenseKey: crmVerify.data.licenseKey || crmVerify.data.license_key || key,
          plan: crmVerify.data.plan,
          ramTamerAddon: hasRamTamer,
          addons: addonsList,
          entitlements: buildDeepblockEntitlements(hasRamTamer),
          status: crmStatus,
          cancelAtPeriodEnd: Boolean(crmVerify.data.cancelAtPeriodEnd || crmVerify.data.cancel_at_period_end),
          expiresAt: crmVerify.data.expiresAt,
          token: crmVerify.data.token
        });
      }
      if (crmStatus === 'canceled' || crmStatus === 'expired' || crmStatus === 'unpaid' || crmStatus === 'past_due') {
        return sendJson(res, 403, { valid: false, status: crmStatus, error: 'subscription_inactive' });
      }
    }

    let record = licenses.get(key) || licenses.get(key.toUpperCase());

    // 3. Stateless live Stripe fallback if server restarted and CRM was unreachable during checkout
    if (!record && STRIPE_SECRET_KEY) {
      try {
        const activeSubs = await stripeRequest('GET', 'subscriptions', { status: 'active', limit: 100 });
        const matchedSub = (activeSubs.data || []).find(
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
        return sendJson(res, 200, {
          valid: true,
          project_id: 'deepblock',
          activation_code: record.activation_code,
          licenseKey: record.licenseKey,
          plan: record.plan,
          ramTamerAddon: Boolean(record.ramTamerAddon),
          entitlements: record.entitlements,
          status: record.status
        });
      }
      return sendJson(res, 403, { valid: false, status: record.status, error: 'subscription_inactive' });
    }
    return sendJson(res, 404, { valid: false, error: 'license_not_found' });
  }

  // API 3b: Customer Portal Subscription Lookup & 1-Click Auto-Renewal Cancellation (Delegated to Central SWEEPR CRM)
  if (req.method === 'POST' && pathname === '/api/portal/lookup') {
    if (!checkRateLimit(req, 'portal_lookup', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const rawLookup = String(body?.lookup || '').trim();
    if (!rawLookup || rawLookup.length > 254) {
      return sendJson(res, 400, { ok: false, error: 'lookup_required' });
    }

    // 1. Check Central SWEEPR CRM first
    const crmLookup = await crm.portalLookup(rawLookup);
    if (crmLookup.ok && crmLookup.data && crmLookup.data.ok) {
      const d = crmLookup.data;
      const hasRamTamer = Boolean(d.ramTamerAddon);
      return sendJson(res, 200, {
        ok: true,
        project_id: 'deepblock',
        account_id: d.account_id,
        status: d.status,
        plan: d.plan,
        activation_code: d.activation_code,
        licenseKey: d.licenseKey || d.license_key,
        ramTamerAddon: hasRamTamer,
        entitlements: buildDeepblockEntitlements(hasRamTamer),
        cancelAtPeriodEnd: Boolean(d.cancelAtPeriodEnd || d.cancel_at_period_end),
        expiresAt: d.expiresAt
      });
    }

    const isEmail = rawLookup.includes('@');
    let record = isEmail
      ? accountsByEmail.get(rawLookup.toLowerCase())
      : licenses.get(rawLookup) || licenses.get(rawLookup.toUpperCase());

    if ((!record || record.status !== 'active') && STRIPE_SECRET_KEY) {
      try {
        const activeSubs = await stripeRequest('GET', 'subscriptions', { status: 'active', limit: 100 });
        const matchedSub = (activeSubs.data || []).find((s) =>
          isEmail
            ? (s.metadata?.email || '').toLowerCase() === rawLookup.toLowerCase()
            : (s.metadata?.license_key || '').toUpperCase() === rawLookup.toUpperCase() ||
              s.metadata?.activation_code === rawLookup
        );
        if (matchedSub) {
          record = upsertLocalAccount({
            email: matchedSub.metadata?.email || (isEmail ? rawLookup.toLowerCase() : 'customer@sweeprdeepblock.com'),
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
        error: 'No active paid Pro subscription found for that email or license key.'
      });
    }

    return sendJson(res, 200, {
      ok: true,
      status: record.status,
      plan: record.plan,
      activation_code: record.activation_code,
      licenseKey: record.licenseKey,
      ramTamerAddon: Boolean(record.ramTamerAddon),
      entitlements: record.entitlements,
      cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd)
    });
  }

  if (req.method === 'POST' && pathname === '/api/portal/cancel') {
    if (!checkRateLimit(req, 'portal_cancel', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const body = await readBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    const rawLookup = String(body?.lookup || '').trim();
    if (!rawLookup) return sendJson(res, 400, { ok: false, error: 'lookup_required' });

    const isEmail = rawLookup.includes('@');
    const record = isEmail
      ? accountsByEmail.get(rawLookup.toLowerCase())
      : licenses.get(rawLookup) || licenses.get(rawLookup.toUpperCase());

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

    const crmCancel = await crm.portalCancel(rawLookup);
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

  // API 4: Customer Support Ticket Submission -> Central CRM
  if (req.method === 'POST' && pathname === '/api/support') {
    if (!checkRateLimit(req, 'support', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const data = await readBody(req);
    if (data && data.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    if (!data || !isValidEmail(String(data.email || '').trim()) || !data.subject || !data.message) {
      return sendJson(res, 400, { ok: false, error: 'email_subject_and_message_required' });
    }
    const crmRes = await requestSweeprCrm('/api/support/contact', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        email: String(data.email).trim().toLowerCase(),
        name: typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '',
        subject: String(data.subject).slice(0, 200),
        message: String(data.message).slice(0, 4000),
        category: typeof data.category === 'string' ? data.category.slice(0, 64) : 'general',
        os: typeof data.os === 'string' ? data.os.slice(0, 64) : 'browser_extension'
      }
    });
    return sendJson(res, crmRes.ok ? 200 : 502, crmRes.data);
  }

  // API 5: Extension Telemetry & Funnel Events -> Central CRM
  if (req.method === 'POST' && pathname === '/api/telemetry') {
    if (!checkRateLimit(req, 'telemetry', 60, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    }
    const data = await readBody(req);
    if (data && data.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' });
    if (!data || (!data.event_name && !data.event)) {
      return sendJson(res, 400, { ok: false, error: 'event_name_required' });
    }
    const crmRes = await requestSweeprCrm('/v1/telemetry/event', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        event_name: String(data.event_name || data.event).slice(0, 120),
        category: typeof data.category === 'string' ? data.category.slice(0, 64) : 'funnel',
        account_id: typeof data.account_id === 'string' ? data.account_id.slice(0, 64) : undefined,
        device_id: typeof data.device_id === 'string' ? data.device_id.slice(0, 64) : undefined,
        os: typeof data.os === 'string' ? data.os.slice(0, 64) : 'browser_extension',
        app_version: typeof data.app_version === 'string' ? data.app_version.slice(0, 32) : '1.0.0',
        properties: data.properties && typeof data.properties === 'object' ? data.properties : {}
      }
    });
    return sendJson(res, 200, crmRes.data);
  }

  // 301 Redirect .html Suffixes on Public Pages to Clean Canonical URLs
  const HTML_CANONICAL_REDIRECTS = {
    '/index.html': '/',
    '/pricing.html': '/pricing',
    '/download.html': '/download',
    '/test-lab.html': '/test-lab',
    '/order.html': '/order',
    '/login.html': '/login',
    '/vs/total-adblock.html': '/vs/total-adblock'
  };
  if ((req.method === 'GET' || req.method === 'HEAD') && HTML_CANONICAL_REDIRECTS[pathname]) {
    const targetUrl = HTML_CANONICAL_REDIRECTS[pathname] + (parsedUrl.search || '');
    res.writeHead(301, { Location: targetUrl });
    return res.end();
  }

  // Static Website Serving
  const mappedRelative = CLEAN_ROUTES[pathname] || pathname.slice(1);
  const safePath = path.normalize(mappedRelative).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(WEBSITE_DIR, safePath);
  const resolvedRoot = path.resolve(WEBSITE_DIR);
  if (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    const isStaticAsset = ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico', '.css', '.js'].includes(ext);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': isStaticAsset ? 'public, max-age=86400' : 'public, max-age=300'
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`SWEEPR Deepblock Server running at http://localhost:${PORT}/?home=1 (Stripe Live: ${IS_LIVE_STRIPE})`);
  });
}

module.exports = server;
