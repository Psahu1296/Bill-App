/**
 * Cloudflare Worker: PhonePe Payment Initiator
 *
 * Moves PhonePe payment initiation + status polling out of the local POS backend
 * so payments work even when the Cloudflare Tunnel is down.
 *
 * PhonePe SDK v2 uses OAuth Bearer tokens — no HMAC signing, just two HTTPS calls:
 *   1. POST /oauth/token  (client_credentials grant)
 *   2. POST /checkout/v2/pay  (initiate payment)
 *
 * Secrets set via `wrangler secret put <NAME>`:
 *   PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION,
 *   PHONEPE_ENV (UAT | PRODUCTION), ALLOWED_ORIGIN
 *
 * Routes:
 *   POST /initiate    — start a PhonePe payment
 *   GET  /status/:id  — poll payment status
 */

const UAT_BASE       = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const PROD_TOKEN_URL = 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
const PROD_API_BASE  = 'https://api.phonepe.com/apis/pg';

// Module-level token cache — survives within the same Worker isolate
let cachedToken    = null;
let tokenExpiresAt = 0;

function tokenEndpoint(env) {
  return env.PHONEPE_ENV === 'PRODUCTION'
    ? PROD_TOKEN_URL
    : `${UAT_BASE}/v1/oauth/token`;
}

function apiBase(env) {
  return env.PHONEPE_ENV === 'PRODUCTION' ? PROD_API_BASE : UAT_BASE;
}

async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;

  const resp = await fetch(tokenEndpoint(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:     'client_credentials',
      client_id:      env.PHONEPE_CLIENT_ID,
      client_secret:  env.PHONEPE_CLIENT_SECRET,
      client_version: env.PHONEPE_CLIENT_VERSION ?? '1',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`PhonePe token fetch failed: ${err}`);
  }

  const json = await resp.json();
  cachedToken    = json.access_token;
  tokenExpiresAt = json.expires_at
    ? json.expires_at * 1000
    : now + (json.expires_in ?? 3600) * 1000;
  return cachedToken;
}

// ── POST /initiate ─────────────────────────────────────────────────────────────
async function handleInitiate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const { amount, orderId, customerPhone, redirectUrl } = body;
  if (!amount || !orderId || !redirectUrl) {
    return jsonResp({ success: false, message: 'amount, orderId, and redirectUrl are required' }, 400);
  }

  const merchantOrderId = `TXN_${orderId}_${Date.now()}`;
  const amountPaise     = Math.round(Number(amount) * 100);
  const token           = await getAccessToken(env);

  const resp = await fetch(`${apiBase(env)}/checkout/v2/pay`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `O-Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantOrderId,
      amount:      amountPaise,
      expireAfter: 1200,
      paymentFlow: {
        type:         'PG_CHECKOUT',
        message:      `Payment for order #${orderId}`,
        merchantUrls: { redirectUrl },
      },
      ...(customerPhone ? { metaInfo: { udf1: String(customerPhone) } } : {}),
    }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    return jsonResp({ success: false, message: json.message ?? 'PhonePe payment initiation failed' }, 502);
  }

  return jsonResp({
    success: true,
    data: {
      redirectUrl:           json.redirectUrl,
      merchantTransactionId: merchantOrderId,
    },
  });
}

// ── GET /status/:txnId ─────────────────────────────────────────────────────────
async function handleStatus(txnId, env) {
  const token = await getAccessToken(env);

  const resp = await fetch(`${apiBase(env)}/checkout/v2/order/${txnId}/status`, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `O-Bearer ${token}`,
    },
  });

  const json = await resp.json();
  const state = resp.ok ? (json.state ?? 'PENDING') : 'FAILED';

  return jsonResp({
    success: true,
    data: { state, code: json.code, message: json.message },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withCors(response, allowedOrigin) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}

// ── Main handler ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // ALLOWED_ORIGIN may be a comma-separated list, e.g.:
    //   "http://localhost:5173,https://dev--sahu-dhaba.netlify.app"
    const allowedList = (env.ALLOWED_ORIGIN ?? '*')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const isWildcard = allowedList.includes('*');
    const origin = request.headers.get('Origin') ?? '';
    const matchedOrigin = isWildcard ? '*' : (allowedList.find(o => o === origin) ?? '');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  matchedOrigin || allowedList[0],
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Block requests from unexpected origins
    if (!isWildcard && origin && !matchedOrigin) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);
    let response;

    try {
      if (url.pathname === '/initiate' && request.method === 'POST') {
        response = await handleInitiate(request, env);
      } else if (url.pathname.startsWith('/status/') && request.method === 'GET') {
        const txnId = url.pathname.slice('/status/'.length);
        response = await handleStatus(txnId, env);
      } else {
        response = new Response('Not Found', { status: 404 });
      }
    } catch (err) {
      console.error('[phonepe-worker]', err.message);
      response = jsonResp({ success: false, message: err.message }, 500);
    }

    return withCors(response, matchedOrigin || allowedList[0] || '*');
  },
};
