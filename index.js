// RemagStyle Paystack Worker - Stage 5 (secure payment flow + private order lookup)
//
// Secrets (Cloudflare Runtime): PAYSTACK_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT
//
// Endpoints
//   GET  /                     health message
//   POST /initialize-payment   { orderId, email? }  + optional "Authorization: Bearer <Firebase ID token>"
//   POST /verify-payment       { reference }
//   POST /lookup-order         { orderNumber }  -> { orderId }  (lets the tracking page work without public order listing)
//   POST /webhook/paystack     called by Paystack (signature checked)
//
// The browser NEVER sends an amount. The amount always comes from the order in Firestore.

const ALLOWED_ORIGINS = [
  'https://remag.style',
  'https://www.remag.style',
  'https://remagstyle.github.io'
];
const SITE_URL = 'https://remag.style';
const CALLBACK_PATH = '/track-order.html';
const SUPPORTED_CURRENCY = 'GHS';
const MAX_AMOUNT = 1000000; // sanity cap in GHS
const PAID_WORDS = ['paid', 'success', 'successful', 'confirmed'];
const ORDER_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const REFERENCE_RE = /^RS-[a-f0-9]{24}$/;
const ORDER_NUMBER_RE = /^[A-Z0-9-]{6,40}$/;

// ---------- Small helpers ----------

function corsHeaders(request) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 10000) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function randomHex(bytes) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

function validEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function isPaidState(value) {
  return PAID_WORDS.includes(String(value || '').toLowerCase());
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Google service-account login ----------

let cachedToken = null;

function base64UrlFromBytes(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromString(text) {
  return base64UrlFromBytes(new TextEncoder().encode(text));
}

function bytesFromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  return bytesFromBase64Url(body.replace(/\+/g, '-').replace(/\//g, '_')).buffer;
}

function readServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('missing_secret');
  let account;
  try {
    account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new Error('secret_not_valid_json');
  }
  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new Error('secret_missing_fields');
  }
  return account;
}

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const account = readServiceAccount(env);
  const header = base64UrlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlFromString(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlFromBytes(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!response.ok) throw new Error(`token_request_failed_${response.status}`);
  const data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

// ---------- Firebase login check for customers (ID token) ----------

let googleKeys = null;

async function getGoogleKeys(force = false) {
  const now = Date.now();
  if (!force && googleKeys && googleKeys.expires > now) return googleKeys.byKid;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!res.ok) throw new Error('jwk_fetch_failed');
  const data = await res.json();
  const byKid = {};
  for (const k of data.keys || []) byKid[k.kid] = k;
  googleKeys = { byKid, expires: now + 3600 * 1000 };
  return byKid;
}

// Returns { uid, email } for a valid Firebase login token, otherwise null.
async function verifyFirebaseIdToken(env, token) {
  const account = readServiceAccount(env);
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  let jwk = (await getGoogleKeys())[header.kid];
  if (!jwk) jwk = (await getGoogleKeys(true))[header.kid];
  if (!jwk) return null;

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    bytesFromBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== account.project_id) return null;
  if (payload.iss !== `https://securetoken.google.com/${account.project_id}`) return null;
  if (!payload.sub || typeof payload.exp !== 'number' || payload.exp <= now || payload.iat > now + 300) return null;
  return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
}

// ---------- Firestore (REST) ----------

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  throw new Error('unsupported_value');
}

function encodeFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object)) fields[key] = encodeValue(value);
  return fields;
}

function decodeValue(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return undefined;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}

function documentName(account, collection, id) {
  return `projects/${account.project_id}/databases/(default)/documents/${collection}/${id}`;
}

async function fsGet(env, collection, id) {
  const account = readServiceAccount(env);
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/${documentName(account, collection, encodeURIComponent(id))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`firestore_read_${res.status}`);
  const doc = await res.json();
  return { exists: true, fields: decodeFields(doc.fields), updateTime: doc.updateTime };
}

async function fsCommit(env, writes) {
  const account = readServiceAccount(env);
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes })
  });
  if (res.ok) return { ok: true };
  let status = '';
  try {
    status = (await res.json()).error?.status || '';
  } catch {
    // ignore
  }
  const conflict = res.status === 409 || ['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED'].includes(status);
  return { ok: false, conflict, code: res.status };
}

async function fsFindOrderIdByNumber(env, orderNumber) {
  const account = readServiceAccount(env);
  const token = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: { fieldFilter: { field: { fieldPath: 'orderNumber' }, op: 'EQUAL', value: { stringValue: orderNumber } } },
        select: { fields: [{ fieldPath: '__name__' }] },
        limit: 1
      }
    })
  });
  if (!res.ok) throw new Error(`firestore_query_${res.status}`);
  const rows = await res.json();
  const name = Array.isArray(rows) ? rows.find((row) => row.document)?.document?.name : null;
  return name ? name.split('/').pop() : null;
}

function writeCreate(account, collection, id, object) {
  return {
    update: { name: documentName(account, collection, id), fields: encodeFields(object) },
    currentDocument: { exists: false }
  };
}

function writeUpdate(account, collection, id, object, updateTime) {
  const write = {
    update: { name: documentName(account, collection, id), fields: encodeFields(object) },
    updateMask: { fieldPaths: Object.keys(object) }
  };
  if (updateTime) write.currentDocument = { updateTime };
  return write;
}

// ---------- Paystack ----------

function paystackRequest(env, path, init = {}) {
  return fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
  });
}

async function paystackVerify(env, reference) {
  let res;
  try {
    res = await paystackRequest(env, `/transaction/verify/${encodeURIComponent(reference)}`);
  } catch {
    return { unavailable: true };
  }
  if (res.status >= 500) return { unavailable: true };
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  if (!body || body.status !== true || !body.data) return { data: null };
  return { data: body.data };
}

function readMetadata(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return {};
}

function mapPaystackStatus(status) {
  if (status === 'failed') return 'failed';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'reversed') return 'reversed';
  return 'pending';
}

// ---------- Core: confirm a payment (used by /verify-payment and the webhook) ----------
// Safe to call any number of times, at the same moment, from anywhere. The order is marked paid once.

async function finalizePayment(env, reference) {
  const account = readServiceAccount(env);

  for (let attempt = 0; attempt < 3; attempt++) {
    const paymentDoc = await fsGet(env, 'payments', reference);
    // We only accept references that WE created when the payment was started.
    if (!paymentDoc.exists) {
      return { http: 404, body: { ok: false, status: 'unknown_reference', message: 'Payment not found.' } };
    }
    const payment = paymentDoc.fields;
    const base = { orderId: payment.orderId, reference };

    if (payment.status === 'success') {
      return { http: 200, body: { ok: true, status: 'paid', ...base } };
    }
    if (payment.status === 'review' || payment.status === 'duplicate_payment') {
      return { http: 200, body: { ok: false, status: 'under_review', ...base } };
    }

    const checked = await paystackVerify(env, reference);
    if (checked.unavailable) {
      return { http: 502, body: { ok: false, status: 'verification_unavailable', message: 'Could not reach Paystack. Please try again shortly.', ...base } };
    }
    const tx = checked.data;

    if (!tx || tx.status !== 'success') {
      const mapped = tx ? mapPaystackStatus(tx.status) : 'pending';
      if (tx && payment.status !== mapped) {
        await fsCommit(env, [writeUpdate(account, 'payments', reference, {
          status: mapped,
          paystackStatus: String(tx.status),
          lastCheckedAt: nowIso()
        })]);
      }
      return { http: 200, body: { ok: false, status: mapped, ...base } };
    }

    // Paystack says "success". Now prove it is the right money for the right order.
    const orderDoc = await fsGet(env, 'orders', payment.orderId);
    const metadata = readMetadata(tx.metadata);
    const problems = [];
    if (!orderDoc.exists) problems.push('order_missing');
    if (tx.reference !== reference) problems.push('reference_mismatch');
    if (tx.amount !== payment.expectedAmountMinor) problems.push('amount_mismatch');
    if (String(tx.currency || '').toUpperCase() !== payment.currency) problems.push('currency_mismatch');
    if (metadata.orderId !== payment.orderId) problems.push('order_mismatch');

    let flag = null;
    if (problems.length) {
      flag = { status: 'review', reviewReason: problems.join(',') };
    } else if (isPaidState(orderDoc.fields.paymentStatus) && orderDoc.fields.paymentReference !== reference) {
      flag = { status: 'duplicate_payment', reviewReason: 'order_already_paid' };
    }

    if (flag) {
      const committed = await fsCommit(env, [writeUpdate(account, 'payments', reference, {
        ...flag,
        paystackStatus: 'success',
        paystackTransactionId: String(tx.id),
        paidAmountMinor: typeof tx.amount === 'number' ? tx.amount : null,
        lastCheckedAt: nowIso()
      }, paymentDoc.updateTime)]);
      if (committed.conflict) continue;
      if (!committed.ok) throw new Error('firestore_commit_failed');
      console.error(`payment flagged for review: ${reference} ${flag.reviewReason}`);
      return { http: 200, body: { ok: false, status: 'under_review', ...base } };
    }

    const paidAmount = Number((tx.amount / 100).toFixed(2));
    const paidAt = tx.paid_at || nowIso();
    const committed = await fsCommit(env, [
      writeUpdate(account, 'payments', reference, {
        status: 'success',
        paystackStatus: 'success',
        paystackTransactionId: String(tx.id),
        paidAmountMinor: tx.amount,
        paidAmount,
        paidCurrency: payment.currency,
        channel: tx.channel || null,
        paidAt,
        verifiedAt: nowIso()
      }, paymentDoc.updateTime),
      writeUpdate(account, 'orders', payment.orderId, {
        paymentStatus: 'Paid',
        paidAmount,
        paidCurrency: payment.currency,
        paidAt,
        paymentReference: reference,
        paystackTransactionId: String(tx.id)
      }, orderDoc.updateTime)
    ]);
    if (committed.ok) return { http: 200, body: { ok: true, status: 'paid', ...base } };
    if (committed.conflict) continue; // someone else changed it at the same moment; look again
    throw new Error('firestore_commit_failed');
  }
  return { http: 409, body: { ok: false, status: 'busy', message: 'Please try again in a moment.' } };
}

// ---------- Handlers ----------

async function handleInitialize(request, env) {
  const body = await readJson(request);
  if (!body) return json(request, { ok: false, error: 'Invalid request.' }, 400);

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  if (!ORDER_ID_RE.test(orderId)) return json(request, { ok: false, error: 'Invalid order.' }, 400);

  const order = await fsGet(env, 'orders', orderId);
  if (!order.exists) return json(request, { ok: false, error: 'Order not found.' }, 404);
  const fields = order.fields;

  if (isPaidState(fields.paymentStatus)) {
    return json(request, { ok: false, error: 'This order has already been paid.' }, 400);
  }
  if (['cancelled', 'canceled'].includes(String(fields.status || '').toLowerCase())) {
    return json(request, { ok: false, error: 'This order has been cancelled.' }, 400);
  }

  // The amount comes ONLY from the order stored in Firestore.
  let amount = null;
  if (typeof fields.paymentAmount === 'number' && Number.isFinite(fields.paymentAmount)) amount = fields.paymentAmount;
  else if (typeof fields.paymentAmount === 'string' && /^\d+(\.\d{1,2})?$/.test(fields.paymentAmount.trim())) amount = Number(fields.paymentAmount);
  if (amount === null || amount <= 0) {
    return json(request, { ok: false, error: 'No payment is due on this order yet.' }, 400);
  }
  const minor = Math.round(amount * 100);
  if (amount > MAX_AMOUNT || Math.abs(amount * 100 - minor) > 1e-6) {
    return json(request, { ok: false, error: 'This order amount cannot be paid online. Please contact us.' }, 400);
  }

  const currency = String(fields.currency || SUPPORTED_CURRENCY).toUpperCase();
  if (currency !== SUPPORTED_CURRENCY) {
    return json(request, { ok: false, error: 'Online payment is not available for this currency yet. Please contact us.' }, 400);
  }

  // Who is paying?
  const ownerUid = typeof fields.userId === 'string' && fields.userId ? fields.userId : null;
  let email;
  if (ownerUid) {
    const token = bearerToken(request);
    if (!token) return json(request, { ok: false, error: 'Please log in to pay for this order.' }, 401);
    let user = null;
    try {
      user = await verifyFirebaseIdToken(env, token);
    } catch {
      user = null;
    }
    if (!user) return json(request, { ok: false, error: 'Your login has expired. Please log in again.' }, 401);
    if (user.uid !== ownerUid) return json(request, { ok: false, error: 'This order does not belong to your account.' }, 403);
    email = validEmail(fields.customerEmail) || validEmail(user.email);
    if (!email) return json(request, { ok: false, error: 'No email address is saved for this order.' }, 400);
  } else {
    email = validEmail(body.email);
    if (!email) return json(request, { ok: false, error: 'Please enter a valid email address.' }, 400);
  }

  const account = readServiceAccount(env);
  const reference = `RS-${randomHex(12)}`;
  const orderNumber = typeof fields.orderNumber === 'string' ? fields.orderNumber : orderId;

  // Save what we EXPECT before Paystack is even contacted.
  const created = await fsCommit(env, [writeCreate(account, 'payments', reference, {
    reference,
    orderId,
    orderNumber,
    expectedAmountMinor: minor,
    expectedAmount: amount,
    currency,
    email,
    userId: ownerUid,
    status: 'initialized',
    createdAt: nowIso()
  })]);
  if (!created.ok) throw new Error('payment_record_failed');

  const pageUrl = `${SITE_URL}${CALLBACK_PATH}?order=${encodeURIComponent(orderId)}`;
  let paystackBody = null;
  try {
    const res = await paystackRequest(env, '/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email,
        amount: minor,
        currency,
        reference,
        callback_url: pageUrl,
        metadata: { orderId, orderNumber, cancel_action: `${pageUrl}&payment=cancelled` }
      })
    });
    paystackBody = await res.json();
  } catch {
    paystackBody = null;
  }

  if (!paystackBody || paystackBody.status !== true || !paystackBody.data?.authorization_url) {
    await fsCommit(env, [writeUpdate(account, 'payments', reference, { status: 'init_failed', lastCheckedAt: nowIso() })]);
    return json(request, { ok: false, error: 'Could not start the payment. Please try again.' }, 502);
  }

  return json(request, { ok: true, authorizationUrl: paystackBody.data.authorization_url, reference }, 200);
}

async function handleVerify(request, env) {
  const body = await readJson(request);
  const reference = body && typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!REFERENCE_RE.test(reference)) return json(request, { ok: false, error: 'Invalid payment reference.' }, 400);
  const result = await finalizePayment(env, reference);
  return json(request, result.body, result.http);
}

// Returns ONLY the random order id. The tracking page then reads that one order directly,
// so the orders collection no longer has to be listable by the public.
async function handleLookup(request, env) {
  if (env.LOOKUP_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.LOOKUP_LIMITER.limit({ key: ip });
    if (!success) return json(request, { ok: false, error: 'Too many attempts. Please wait a minute and try again.' }, 429);
  }
  const body = await readJson(request);
  const orderNumber = body && typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
  if (!ORDER_NUMBER_RE.test(orderNumber)) return json(request, { ok: false, error: 'Invalid order number.' }, 400);
  const orderId = await fsFindOrderIdByNumber(env, orderNumber);
  if (!orderId) return json(request, { ok: false, error: 'Order not found.' }, 404);
  return json(request, { ok: true, orderId }, 200);
}

async function computeSignature(rawBody, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const header = request.headers.get('x-paystack-signature') || '';
  if (!env.PAYSTACK_SECRET_KEY || !header) return new Response('Invalid signature', { status: 401 });
  const expected = await computeSignature(rawBody, env.PAYSTACK_SECRET_KEY);
  if (!timingSafeEqualHex(expected, header.toLowerCase())) return new Response('Invalid signature', { status: 401 });

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // We do not trust the webhook body for amounts or status. We only use its reference,
  // then ask Paystack directly and run the same checks as /verify-payment.
  if (event && event.event === 'charge.success' && REFERENCE_RE.test(String(event.data?.reference || ''))) {
    await finalizePayment(env, event.data.reference); // a thrown error returns 500 so Paystack retries
  }
  return new Response('ok', { status: 200 });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });

    const { pathname } = new URL(request.url);
    try {
      if (request.method === 'GET' && pathname === '/') {
        return new Response('RemagStyle Paystack Worker is running.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
      if (request.method === 'POST' && pathname === '/initialize-payment') return await handleInitialize(request, env);
      if (request.method === 'POST' && pathname === '/verify-payment') return await handleVerify(request, env);
      if (request.method === 'POST' && pathname === '/lookup-order') return await handleLookup(request, env);
      if (request.method === 'POST' && pathname === '/webhook/paystack') return await handleWebhook(request, env);
      return json(request, { ok: false, error: 'Not found.' }, 404);
    } catch (error) {
      console.error('worker_error', String(error && error.message));
      return json(request, { ok: false, error: 'Something went wrong. Please try again.' }, 500);
    }
  }
};