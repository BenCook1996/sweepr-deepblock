/**
 * SWEEPR Multi-Project CRM & Licensing SDK (`sweepr-client.js`)
 * CommonJS version for zero-dependency Node 22 product servers (`adblocker`, etc.).
 */
const crypto = require('node:crypto');

class SweeprCrmClient {
  constructor(opts = {}) {
    this.projectId = String(opts.projectId || 'deepblock').trim().toLowerCase();
    this.crmUrl = String(opts.crmUrl || process.env.SWEEPR_CRM_URL || 'http://localhost:8788').replace(/\/+$/, '');
    this.apiKey =
      opts.apiKey ||
      process.env.SWEEPR_CRM_API_KEY ||
      process.env.CRM_ADMIN_PASSWORD ||
      '';
    this.adminUser = opts.adminUser || process.env.CRM_ADMIN_USER || 'admin';
    this.adminPassword = opts.adminPassword || process.env.CRM_ADMIN_PASSWORD || '';
    this.publicKeySpki = opts.publicKeySpki || process.env.SWEEPR_LICENSE_PUBLIC_KEY || '';
    this.publicKeysByKid = opts.publicKeysByKid || {};
    if (process.env.SWEEPR_LICENSE_PUBLIC_KEYS_JSON) {
      try {
        Object.assign(this.publicKeysByKid, JSON.parse(process.env.SWEEPR_LICENSE_PUBLIC_KEYS_JSON));
      } catch {}
    }
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  async _fetchWithRetry(url, init = {}, { timeoutMs = 4000, maxRetries = 1 } = {}) {
    if (Date.now() < this.circuitOpenUntil) {
      return { ok: false, status: 503, circuitOpen: true, data: { error: 'crm_circuit_open' } };
    }
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
          if (attempt < maxRetries) {
            const delayMs = Math.min(1500, 140 * Math.pow(2, attempt) + Math.floor(Math.random() * 80));
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          this.consecutiveFailures += 1;
          if (this.consecutiveFailures >= 3) {
            this.circuitOpenUntil = Date.now() + 30000;
          }
        } else {
          this.consecutiveFailures = 0;
          this.circuitOpenUntil = 0;
        }
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          const delayMs = Math.min(1500, 140 * Math.pow(2, attempt) + Math.floor(Math.random() * 80));
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= 3) {
          this.circuitOpenUntil = Date.now() + 30000;
        }
      }
    }
    return { ok: false, status: 502, data: { error: lastErr?.message || 'crm_unreachable' } };
  }

  headers(extra = {}) {
    const h = {
      'content-type': 'application/json',
      'x-sweepr-project': this.projectId,
      ...extra
    };
    if (this.apiKey) {
      h['x-crm-api-key'] = this.apiKey;
      h['x-sweepr-api-key'] = this.apiKey;
    }
    if (this.adminPassword && !h.authorization) {
      h.authorization = 'Basic ' + Buffer.from(`${this.adminUser}:${this.adminPassword}`).toString('base64');
    }
    return h;
  }

  verifyLicenseTokenOffline(token, expectedDeviceId, publicKeyOverride) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return { valid: false, reason: 'malformed_jws' };
      const [headerB64, payloadB64, sigB64] = parts;
      const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
      const signature = Buffer.from(sigB64, 'base64url');

      let header = {};
      try {
        header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      } catch {}
      const kidKey = header && header.kid && this.publicKeysByKid ? this.publicKeysByKid[header.kid] : '';
      const rawKey = publicKeyOverride || kidKey || this.publicKeySpki;
      if (!rawKey) return { valid: false, reason: 'missing_public_key' };

      const keyObj = rawKey.includes('BEGIN PUBLIC KEY')
        ? crypto.createPublicKey(rawKey)
        : crypto.createPublicKey({ key: Buffer.from(rawKey, 'base64'), format: 'der', type: 'spki' });

      const ok = crypto.verify(null, signingInput, keyObj, signature);
      if (!ok) return { valid: false, reason: 'invalid_signature' };

      const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);

      if (claims.project_id && claims.project_id !== this.projectId) {
        const hasBundle = Array.isArray(claims.addons) && claims.addons.includes('sweepr_secure_bundle');
        if (!hasBundle) {
          return { valid: false, reason: `project_mismatch:${claims.project_id}`, claims };
        }
      }

      if (expectedDeviceId && claims.device_id !== expectedDeviceId) {
        return { valid: false, reason: 'device_mismatch', claims };
      }

      if (now > (claims.grace_until || claims.exp || 0)) {
        return { valid: false, reason: 'token_expired', claims };
      }

      const active =
        claims.status === 'active' ||
        claims.status === 'trialing' ||
        (claims.status === 'past_due' && now <= (claims.grace_until || 0));

      return { valid: active, reason: active ? undefined : `inactive_status:${claims.status}`, claims };
    } catch (err) {
      return { valid: false, reason: err?.message || 'verify_error' };
    }
  }

  async activateDevice({ email, otp, accountId, refreshToken, deviceId, deviceName, os, appVersion }) {
    return this._fetchWithRetry(`${this.crmUrl}/v1/license/activate`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        email,
        otp: otp || refreshToken,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
        device_name: deviceName,
        os,
        app_version: appVersion
      })
    });
  }

  async refreshLicense({ accountId, refreshToken, deviceId, appVersion }) {
    return this._fetchWithRetry(`${this.crmUrl}/v1/license/refresh`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
        app_version: appVersion
      })
    });
  }

  async verifyKey(key, deviceId = '') {
    const qs = new URLSearchParams({ project: this.projectId, key: String(key || '').trim() });
    if (deviceId) qs.set('device_id', String(deviceId).trim().slice(0, 128));
    return this._fetchWithRetry(`${this.crmUrl}/v1/license/verify-key?${qs.toString()}`, {
      headers: this.headers()
    });
  }

  async sendOtp(email) {
    return this._fetchWithRetry(
      `${this.crmUrl}/v1/account/send-otp?project=${encodeURIComponent(this.projectId)}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          email: String(email || '').trim().toLowerCase()
        })
      },
      { timeoutMs: 5000 }
    );
  }

  async verifyOtp({ email, code, deviceId, platform = 'web', deviceLabel = 'SWEEPR Deepblock Portal' } = {}) {
    return this._fetchWithRetry(
      `${this.crmUrl}/v1/account/verify-otp?project=${encodeURIComponent(this.projectId)}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          email: String(email || '').trim().toLowerCase(),
          code: String(code || '').trim(),
          device_id: deviceId || `portal_deepblock_${Date.now()}`,
          device_type: 'pc',
          platform,
          device_label: deviceLabel
        })
      },
      { timeoutMs: 5000 }
    );
  }

  async syncSubscription(params = {}) {
    return this._fetchWithRetry(`${this.crmUrl}/api/crm/subscriptions?project=${encodeURIComponent(this.projectId)}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        email: params.email,
        name: params.name,
        country: params.country,
        plan: params.plan,
        status: params.status || 'active',
        days: params.days,
        amount_cents: params.amountCents ?? params.amount_cents,
        currency: params.currency,
        stripe_customer_id: params.stripeCustomerId ?? params.stripe_customer_id,
        stripe_subscription_id: params.stripeSubscriptionId ?? params.stripe_subscription_id,
        activation_code: params.activationCode ?? params.activation_code,
        license_key: params.licenseKey ?? params.license_key,
        cancel_at_period_end: params.cancelAtPeriodEnd ?? params.cancel_at_period_end,
        ref: params.ref ?? params.affiliateCode ?? params.affiliate_code,
        affiliate_code: params.affiliateCode ?? params.affiliate_code ?? params.ref,
        addons: params.addons || [],
        notes: params.notes
      })
    });
  }

  async reportAffiliateClick({ code, landingPath = '/', referrer = null, country = null } = {}) {
    if (!code) return { ok: false };
    return this._fetchWithRetry(
      `${this.crmUrl}/v1/affiliate/click`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          code: String(code).trim().toLowerCase(),
          landing_path: landingPath,
          referrer,
          country
        })
      },
      { timeoutMs: 3500, maxRetries: 0 }
    );
  }

  async portalLookup(lookup, keyOrCode = '') {
    return this._fetchWithRetry(`${this.crmUrl}/v1/license/portal-lookup`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        lookup,
        ...(keyOrCode ? { key: keyOrCode } : {})
      })
    });
  }

  async portalCancel(lookup, immediate = false, keyOrCode = '') {
    return this._fetchWithRetry(`${this.crmUrl}/v1/license/portal-cancel`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        lookup,
        immediate,
        ...(keyOrCode ? { key: keyOrCode } : {})
      })
    });
  }
}

module.exports = { SweeprCrmClient };
