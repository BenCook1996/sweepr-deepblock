// SWEEPR Deepblock — Zero-Dependency HTTP Server, Live Stripe Subscriptions & Multi-SKU Licensing API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch {}
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const WEBSITE_DIR = path.join(__dirname, 'website');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();
const CRM_ADMIN_PASSWORD = process.env.CRM_ADMIN_PASSWORD || 'B3njamin123!';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update(`sweepr-db-session:${CRM_ADMIN_PASSWORD}`).digest('hex');

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

function verifyStripeWebhookSignature(rawBody, sigHeader, secret) {
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
function crmHeaders() {
  const h = {
    'content-type': 'application/json',
    'x-sweepr-project': 'deepblock'
  };
  if (SWEEPR_CRM_API_KEY) {
    h['x-crm-api-key'] = SWEEPR_CRM_API_KEY;
    h['x-sweepr-api-key'] = SWEEPR_CRM_API_KEY;
  }
  return h;
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

const licenses = new Map();
const accountsById = new Map();
const accountsByEmail = new Map();

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

function upsertLocalAccount({ email, name, country, stripeCustomerId, plan, ramTamerAddon, subscriptionId, status = 'active' }) {
  const normEmail = (email || '').trim().toLowerCase();
  let acc = (normEmail && accountsByEmail.get(normEmail)) || null;
  if (!acc) {
    const activationCode = String(crypto.randomInt(100000, 1000000));
    const accountId = `acc_db_${crypto.randomBytes(6).toString('hex')}`;
    const licenseKey = `SWEEPR-DB-${activationCode}`;
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
    if (name) acc.name = name;
    if (country) acc.country = country;
    if (stripeCustomerId) acc.stripe_customer_id = stripeCustomerId;
    if (subscriptionId) acc.stripe_subscription_id = subscriptionId;
    if (plan) acc.plan = plan;
    if (ramTamerAddon !== undefined) {
      acc.ramTamerAddon = Boolean(ramTamerAddon);
      acc.entitlements = buildDeepblockEntitlements(acc.ramTamerAddon);
    }
    if (status) acc.status = status;
  }

  accountsById.set(acc.id, acc);
  if (normEmail) {
    accountsByEmail.set(normEmail, acc);
    licenses.set(normEmail, acc);
  }
  licenses.set(acc.licenseKey, acc);
  licenses.set(acc.activation_code, acc);
  if (subscriptionId) licenses.set(subscriptionId, acc);
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
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const CLEAN_ROUTES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/checkout': 'order.html',
  '/login': 'login.html',
  '/download': 'download.html',
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
    ...extraHeaders
  });
  res.end(html);
}

function readRawBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

async function readBody(req) {
  const raw = await readRawBody(req);
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function renderCheckoutSuccessPage(acc, isCancelled = false) {
  if (isCancelled) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
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

  const licenseKey = acc?.licenseKey || 'SWEEPR-DB-PRO';
  const activationCode = acc?.activation_code || licenseKey.replace('SWEEPR-DB-', '');
  const email = acc?.email || '';
  const planLabel = acc?.plan === 'annual' ? 'Annual Plan' : acc?.plan === 'six_month' ? '6-Month Plan' : 'Monthly Plan';
  const hasRamTamer = Boolean(acc?.ramTamerAddon);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    const body = await readBody(req);
    const email = (body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'invalid_email' });
    }
    const localizedPricing = resolvePricingForRequest(req, parsedUrl, body || {});
    const acc = upsertLocalAccount({
      email,
      name: body?.name,
      country: localizedPricing.country,
      status: 'lead'
    });
    reportToSweeprCrm('/api/crm/leads?project=deepblock', {
      project_id: 'deepblock',
      email,
      name: body?.name || undefined,
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
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: 'Invalid request body.' });
    if (!STRIPE_SECRET_KEY) return sendJson(res, 503, { error: 'stripe_not_configured' });

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toLowerCase() : 'card';
    const isPayPal = paymentMethod === 'paypal';
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay';
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    const email =
      (providedEmail && providedEmail.includes('@') ? providedEmail : null) ||
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
        plan,
        ram_tamer: includeRamTamer ? 'true' : 'false',
        addons: includeRamTamer ? 'ram_tamer' : '',
        country: localizedPricing.country
      };

      let customerId = acc.stripe_customer_id;
      if (customerId) {
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
      licenses.set(subscription.id, acc);

      const latestInvoice = subscription.latest_invoice;
      let paymentIntent = latestInvoice?.payment_intent || null;
      if (typeof paymentIntent === 'string') {
        paymentIntent = await stripeRequest('GET', `payment_intents/${encodeURIComponent(paymentIntent)}`);
      }

      if (!paymentIntent?.id) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent.' });
      }

      const hostOrigin = req.headers.origin || `http://${req.headers.host || `localhost:${PORT}`}`;
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
        licenseKey: acc.licenseKey,
        activation_code: acc.activation_code,
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
        licenses.get(subscriptionId) ||
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

      reportToSweeprCrm('/api/crm/subscriptions?project=deepblock', {
        project_id: 'deepblock',
        email: acc.email,
        plan: acc.plan,
        status: 'active',
        amount_cents: totalAmount || 5999,
        addons: acc.ramTamerAddon ? ['ram_tamer'] : [],
        notes: `Stripe Live Subscription ${sub.id} (${acc.licenseKey})`
      });

      reportToSweeprCrm('/v1/telemetry/event', {
        event_name: 'purchase_completed',
        category: 'funnel',
        account_id: acc.id,
        os: 'web',
        properties: { plan: acc.plan, ramTamerAddon: acc.ramTamerAddon, licenseKey: acc.licenseKey, subscriptionId: sub.id }
      });

      const sessionToken = signSessionCookie(acc.id, acc.email);
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
          'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 30}`
        }
      );
    } catch (err) {
      console.error('[confirm-subscription] error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Verification failed' });
    }
  }

  // API 2c: Legacy /api/web-checkout endpoint
  if (req.method === 'POST' && pathname === '/api/web-checkout') {
    const data = await readBody(req);
    if (!data) {
      return sendJson(res, 400, { ok: false, error: 'Invalid checkout request' });
    }
    const email = (data.email || 'customer@example.com').trim().toLowerCase();
    const plan = data.plan || 'annual';
    const ramTamerAddon = hasRamTamerInBody(data);

    const acc = upsertLocalAccount({
      email,
      plan,
      ramTamerAddon,
      status: 'active'
    });

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'purchase_completed',
      category: 'funnel',
      account_id: acc.id,
      os: 'web',
      properties: { plan, ramTamerAddon, licenseKey: acc.licenseKey }
    });

    return sendJson(res, 200, { ok: true, ...acc });
  }

  // API 2d: Live Stripe Webhook Handler (/webhooks/stripe, /api/webhook/stripe, /api/webhooks/stripe)
  if (
    req.method === 'POST' &&
    (pathname === '/webhooks/stripe' || pathname === '/api/webhook/stripe' || pathname === '/api/webhooks/stripe')
  ) {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'] || '';
    if (STRIPE_WEBHOOK_SECRET && !verifyStripeWebhookSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
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
          upsertLocalAccount({
            email: metaEmail || `${obj.id}@stripe.sweeprdeepblock.com`,
            stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
            subscriptionId: obj.id,
            plan: metaPlan,
            ramTamerAddon: hasRamTamer,
            status: subStatus
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

    let acc = accountsById.get(accountId) || licenses.get(subscriptionId) || null;
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
      } catch {}
    }

    return sendHtml(res, 200, renderCheckoutSuccessPage(acc, false));
  }

  if (req.method === 'GET' && pathname === '/checkout/cancel') {
    return sendHtml(res, 200, renderCheckoutSuccessPage(null, true));
  }

  // API 3: Extension License Verification (Checks central sweepr-crm first, then local fallback cache)
  if (req.method === 'GET' && pathname === '/api/license-verify') {
    const key = (parsedUrl.searchParams.get('key') || '').trim();
    if (!key) return sendJson(res, 400, { valid: false, error: 'missing_key' });

    const crmVerify = await requestSweeprCrm(`/v1/license/verify-key?project=deepblock&key=${encodeURIComponent(key)}`);
    if (crmVerify.ok && crmVerify.data && typeof crmVerify.data.valid === 'boolean') {
      if (crmVerify.data.valid) {
        const hasRamTamer = Array.isArray(crmVerify.data.addons) && crmVerify.data.addons.includes('ram_tamer');
        return sendJson(res, 200, {
          valid: true,
          licenseKey: key,
          activation_code: crmVerify.data.activation_code,
          email: crmVerify.data.email,
          plan: crmVerify.data.plan,
          ramTamerAddon: hasRamTamer,
          entitlements: buildDeepblockEntitlements(hasRamTamer),
          status: crmVerify.data.status,
          expiresAt: crmVerify.data.expiresAt
        });
      }
      if (crmVerify.data.status === 'canceled' || crmVerify.data.status === 'expired') {
        return sendJson(res, 403, { valid: false, status: crmVerify.data.status });
      }
    }

    const record = licenses.get(key) || licenses.get(key.toLowerCase()) || licenses.get(key.toUpperCase());
    if (record && record.status === 'active') {
      return sendJson(res, 200, { valid: true, ...record });
    }
    return sendJson(res, 404, { valid: false });
  }

  // API 4: Customer Support Ticket Submission -> Central CRM
  if (req.method === 'POST' && pathname === '/api/support') {
    const data = await readBody(req);
    if (!data || !data.email || !data.subject || !data.message) {
      return sendJson(res, 400, { ok: false, error: 'email_subject_and_message_required' });
    }
    const crmRes = await requestSweeprCrm('/api/support/contact', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        email: data.email,
        name: data.name,
        subject: data.subject,
        message: data.message,
        category: data.category || 'general',
        os: data.os || 'browser_extension'
      }
    });
    return sendJson(res, crmRes.ok ? 200 : 502, crmRes.data);
  }

  // API 5: Extension Telemetry & Funnel Events -> Central CRM
  if (req.method === 'POST' && pathname === '/api/telemetry') {
    const data = await readBody(req);
    if (!data || (!data.event_name && !data.event)) {
      return sendJson(res, 400, { ok: false, error: 'event_name_required' });
    }
    const crmRes = await requestSweeprCrm('/v1/telemetry/event', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        event_name: data.event_name || data.event,
        category: data.category || 'funnel',
        account_id: data.account_id,
        device_id: data.device_id,
        os: data.os || 'browser_extension',
        app_version: data.app_version || '1.0.0',
        properties: data.properties || {}
      }
    });
    return sendJson(res, 200, crmRes.data);
  }

  // Static Website Serving
  const mappedRelative = CLEAN_ROUTES[pathname] || pathname.slice(1);
  const safePath = path.normalize(mappedRelative).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(WEBSITE_DIR, safePath);

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`SWEEPR Deepblock Server running at http://localhost:${PORT}/?home=1 (Stripe Live: ${IS_LIVE_STRIPE})`);
  });
}

module.exports = server;
