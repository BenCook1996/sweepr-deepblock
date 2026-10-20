// SWEEPR Deepblock — Zero-Dependency HTTP Server & Multi-SKU Licensing API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const WEBSITE_DIR = path.join(__dirname, 'website');

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

  // API 1: Checkout Configuration
  if (req.method === 'GET' && pathname === '/api/checkout-config') {
    return sendJson(res, 200, {
      elementsEnabled: false,
      plans: {
        annual: { amountPence: 4999, label: 'Annual Plan (£49.99/yr)' },
        six_month: { amountPence: 3899, label: '6-Month Plan (£38.99/6mo)' },
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
          amountPence: data.amountPence || 4999,
          entitlements,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        licenses.set(licenseKey, record);
        licenses.set(record.email.toLowerCase(), record);
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
