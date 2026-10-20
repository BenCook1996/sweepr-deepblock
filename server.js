// SWEEPR Deepblock — Zero-Dependency HTTP Server & Multi-SKU Licensing API (Wired to central sweepr-crm)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const WEBSITE_DIR = path.join(__dirname, 'website');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = process.env.SWEEPR_CRM_API_KEY || '';
const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

function crmHeaders() {
  const h = {
    'content-type': 'application/json',
    'x-sweepr-project': 'deepblock',
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
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 502, data: { error: err?.message || 'crm_unreachable' } };
  }
}

// Local fallback cache for active subscriptions & entitlements
const licenses = new Map();

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const ua = req.headers['user-agent'] || '';
  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    reportToSweeprCrm('/api/crm/seo/bot-hit?project=deepblock', { user_agent: ua, path: pathname, status: 200 });
  }

  // API 1: Checkout Configuration
  if (req.method === 'GET' && pathname === '/api/checkout-config') {
    return sendJson(res, 200, {
      elementsEnabled: false,
      plans: {
        annual: { amountPence: 5999, label: 'Annual Plan (£59.99/yr — £4.99/mo, Save 50%)' },
        six_month: { amountPence: 4499, label: '6-Month Plan (£44.99/6mo — £7.49/mo, Save 25%)' },
        monthly: { amountPence: 999, introPence: 199, label: 'Monthly Plan (£9.99/mo)' }
      },
      addons: {
        ram_tamer: { annualPence: 1499, monthlyPence: 199, label: 'Total Tab & RAM Tamer' }
      }
    });
  }

  // API 2: Multi-SKU Web Checkout (Uses Deepblock's isolated DEEPBLOCK_STRIPE_SECRET_KEY in sweepr-crm)
  if (req.method === 'POST' && pathname === '/api/web-checkout') {
    const data = await readBody(req);
    if (!data) {
      return sendJson(res, 400, { ok: false, error: 'Invalid checkout request' });
    }
    const email = (data.email || 'customer@example.com').trim().toLowerCase();
    const plan = data.plan || 'annual';
    const ramTamerAddon = Boolean(data.ramTamerAddon);

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'checkout_started',
      category: 'funnel',
      os: 'web',
      properties: { plan, ramTamerAddon }
    });

    // Provision via central SWEEPR CRM (/api/payment-intent uses DEEPBLOCK_STRIPE_SECRET_KEY)
    const crmRes = await requestSweeprCrm('/api/payment-intent', {
      method: 'POST',
      body: {
        project_id: 'deepblock',
        email,
        plan,
        ram_tamer: ramTamerAddon,
        addons: ramTamerAddon ? ['ram_tamer'] : [],
        currency: data.currency || 'gbp'
      }
    });

    const activationCode = crmRes.data?.activation_code || null;
    const licenseKey = activationCode
      ? `SWEEPR-DB-${activationCode}`
      : 'SWEEPR-DB-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const entitlements = buildDeepblockEntitlements(ramTamerAddon);
    const record = {
      licenseKey,
      activation_code: activationCode,
      account_id: crmRes.data?.account_id || null,
      email,
      plan,
      ramTamerAddon,
      amountPence: data.amountPence || crmRes.data?.amount_cents || 5999,
      entitlements,
      status: 'active',
      clientSecret: crmRes.data?.clientSecret || null,
      publishableKey: crmRes.data?.publishableKey || null,
      createdAt: new Date().toISOString()
    };

    licenses.set(licenseKey, record);
    if (activationCode) licenses.set(String(activationCode), record);
    licenses.set(email, record);

    // Also sync to /api/crm/subscriptions if API key is set and not already created by /api/payment-intent
    if (!crmRes.ok) {
      reportToSweeprCrm('/api/crm/subscriptions?project=deepblock', {
        project_id: 'deepblock',
        email: record.email,
        plan: record.plan,
        status: 'active',
        amount_cents: record.amountPence,
        addons: record.ramTamerAddon ? ['ram_tamer'] : [],
        notes: `Synced from SWEEPR Deepblock checkout (${licenseKey})`
      });
    }

    reportToSweeprCrm('/v1/telemetry/event', {
      event_name: 'purchase_completed',
      category: 'funnel',
      account_id: record.account_id,
      os: 'web',
      properties: { plan, ramTamerAddon, licenseKey }
    });

    return sendJson(res, 200, { ok: true, ...record });
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
          expiresAt: crmVerify.data.expiresAt,
        });
      }
      // Explicitly revoked/canceled/expired in CRM
      if (crmVerify.data.status === 'canceled' || crmVerify.data.status === 'expired') {
        return sendJson(res, 403, { valid: false, status: crmVerify.data.status });
      }
    }

    const record = licenses.get(key) || licenses.get(key.toLowerCase());
    if (record) {
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
    console.log(`SWEEPR Deepblock Server running at http://localhost:${PORT}/?home=1`);
  });
}

module.exports = server;
