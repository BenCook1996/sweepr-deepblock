// SWEEPR Deepblock — Zero-Dependency HTTP Server & Multi-SKU Licensing API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const WEBSITE_DIR = path.join(__dirname, 'website');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = process.env.SWEEPR_CRM_API_KEY || '';
const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

function reportToSweeprCrm(pathAndQuery, body) {
  try {
    fetch(`${SWEEPR_CRM_URL}${pathAndQuery}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sweepr-project': 'deepblock',
        ...(SWEEPR_CRM_API_KEY ? { 'x-sweepr-api-key': SWEEPR_CRM_API_KEY } : {})
      },
      body: JSON.stringify({ project_id: 'deepblock', ...body })
    }).catch(() => {});
  } catch {}
}

// In-memory store for active subscriptions & entitlements
const licenses = new Map();

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

const server = http.createServer((req, res) => {
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

  // API 2: Multi-SKU Web Checkout (Core Pro + Fake Store + Encrypted DNS + Optional Tab & RAM Tamer Add-On)
  if (req.method === 'POST' && pathname === '/api/web-checkout') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const licenseKey = 'SWEEPR-DB-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const entitlements = [
          'pro_cookie_autoreject',
          'pro_ai_slop_purifier',
          'pro_clutter_stripper',
          'bundle_fake_store_detector',
          'bundle_encrypted_dns_proxy'
        ];
        if (data.ramTamerAddon) {
          entitlements.push('addon_total_tab_and_ram_tamer');
        }
        const record = {
          licenseKey,
          email: data.email || 'customer@example.com',
          plan: data.plan || 'annual',
          ramTamerAddon: Boolean(data.ramTamerAddon),
          amountPence: data.amountPence || 5999,
          entitlements,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        licenses.set(licenseKey, record);
        licenses.set(record.email.toLowerCase(), record);
        reportToSweeprCrm('/api/crm/subscriptions?project=deepblock', {
          project_id: 'deepblock',
          email: record.email,
          plan: record.plan,
          status: 'active',
          amount_cents: record.amountPence,
          addons: record.ramTamerAddon ? ['ram_tamer'] : [],
          activate_local_app: false,
          notes: `Synced from SWEEPR Deepblock checkout (${licenseKey})`
        });
        return sendJson(res, 200, { ok: true, ...record });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'Invalid checkout request' });
      }
    });
    return;
  }

  // API 3: Extension License Verification
  if (req.method === 'GET' && pathname === '/api/license-verify') {
    const key = (parsedUrl.searchParams.get('key') || '').trim();
    const record = licenses.get(key) || licenses.get(key.toLowerCase());
    if (record) {
      return sendJson(res, 200, { valid: true, ...record });
    }
    return sendJson(res, 404, { valid: false });
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
