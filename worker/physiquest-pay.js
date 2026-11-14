/* PhysiQuest payments: Razorpay checkout that switches Premium on by itself.
 *
 * Runs on Cloudflare Workers (the free plan is enough). One file, no packages:
 * paste it into the Cloudflare editor, or deploy it with `wrangler deploy`.
 *
 * How a payment works
 *   1. The app sends POST /checkout with the student's Firebase sign-in token and the plan (M or Y).
 *      This Worker checks the token with Google, then asks Razorpay for a one-time payment link
 *      for that student and plan. The price is set here, never by the app.
 *   2. The student pays on Razorpay's secure page (UPI, cards, net banking, wallets).
 *   3. Razorpay tells this Worker (POST /webhook, signed with your webhook secret) and also sends the
 *      student back to GET /done (signed with your key secret). Either one writes Premium into the
 *      database with Google's admin access. Each payment link can switch Premium on only once.
 *   4. The app sees premium/{uid} change and shows "Premium is on!". POST /verify lets the app ask
 *      Razorpay directly, in case the webhook is late.
 *
 * Settings (Cloudflare → your Worker → Settings → Variables and Secrets). Add each as a Secret:
 *   RAZORPAY_KEY_ID           rzp_test_… while testing, rzp_live_… after your Razorpay account is activated
 *   RAZORPAY_KEY_SECRET       shown once when you generate the key in Razorpay
 *   RAZORPAY_WEBHOOK_SECRET   the secret you type when you add the webhook in Razorpay
 *   FIREBASE_SERVICE_ACCOUNT  the whole JSON file from Firebase → Project settings → Service accounts
 * Optional (plain text variables):
 *   SITE_URL         where "Back to PhysiQuest" goes on a computer (default: the PhysiQuest website)
 *   ALLOWED_ORIGINS  comma-separated web addresses allowed to call /checkout and /verify
 *   SUPPORT_EMAIL    shown on the payment result page
 *
 * Open the Worker's address in a browser to check the setup: it lists what is set and what is missing.
 */

/* Prices live here, in paise (₹99 = 9900). Change them here and in the app together. */
const PLANS = {
  M: { label: 'Premium · monthly', amount: 9900, days: 31 },
  Y: { label: 'Premium · yearly', amount: 89900, days: 366 },
};
/* Premium end dates are day numbers counted from 1 January 2026 (UTC), the same as in the app. */
const DAY0 = Date.UTC(2026, 0, 1) / 864e5;
const today = (now = Date.now()) => Math.floor(now / 864e5) - DAY0;
const newEnd = (cur, plan, now = Date.now()) => {
  const start = Math.max(today(now), typeof cur === 'number' ? cur + 1 : 0);
  return { start, exp: start + PLANS[plan].days - 1 };
};

const DEFAULTS = {
  project: 'physiquest-1e225',
  site: 'https://mugilstrange-ai.github.io/physiquest/',
  origins: ['https://mugilstrange-ai.github.io', 'https://appassets.androidplatform.net'],
  support: 'mugilstrange@gmail.com',
  appPackage: 'com.physiquest.app',
  razorpay: 'https://api.razorpay.com/v1',
  firestore: 'https://firestore.googleapis.com/v1',
  googleKeys: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  oauth: 'https://oauth2.googleapis.com/token',
};

/* ---------------------------------------------------------------- settings */
function settings(env = {}) {
  let sa = null, saErr = '';
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      sa = typeof env.FIREBASE_SERVICE_ACCOUNT === 'string' ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : env.FIREBASE_SERVICE_ACCOUNT;
      if (!sa.client_email || !sa.private_key) { saErr = 'FIREBASE_SERVICE_ACCOUNT is missing client_email or private_key'; sa = null; }
    } catch (e) { saErr = 'FIREBASE_SERVICE_ACCOUNT is not valid JSON (paste the whole file)'; }
  }
  const keyId = String(env.RAZORPAY_KEY_ID || '').trim();
  const origins = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  return {
    keyId,
    keySecret: String(env.RAZORPAY_KEY_SECRET || '').trim(),
    hookSecret: String(env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
    sa, saErr,
    project: env.FIREBASE_PROJECT_ID || (sa && sa.project_id) || DEFAULTS.project,
    site: env.SITE_URL || DEFAULTS.site,
    origins: origins.length ? origins : DEFAULTS.origins,
    support: env.SUPPORT_EMAIL || DEFAULTS.support,
    mode: keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'not set',
    // the addresses below change only in tests
    razorpay: env.RAZORPAY_API || DEFAULTS.razorpay,
    firestore: env.FIRESTORE_URL || DEFAULTS.firestore,
    firestoreToken: env.FIRESTORE_TOKEN || '',
    googleKeys: env.GOOGLE_KEYS_URL || DEFAULTS.googleKeys,
    oauth: (sa && sa.token_uri) || DEFAULTS.oauth,
  };
}
const ready = c => ({
  razorpay: !!(c.keyId && c.keySecret),
  webhook: !!c.hookSecret,
  firebase: !!(c.sa || c.firestoreToken),
});

/* ---------------------------------------------------------------- small helpers */
class HttpErr extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code || ''; }
}
class Conflict extends Error {}
const te = new TextEncoder();
const b64url = bytes => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlText = t => b64url(te.encode(t));
const unb64url = s => {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
};
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}
/* compares two strings in constant time, so a signature cannot be guessed one character at a time */
function same(a, b) {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayDate = n => { const d = new Date((n + DAY0) * 864e5); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/* ---------------------------------------------------------------- the student's sign-in (Firebase ID token) */
let KEYS = { list: null, until: 0 };
async function googleKeys(c, fresh) {
  if (!fresh && KEYS.list && Date.now() < KEYS.until) return KEYS.list;
  const r = await fetch(c.googleKeys);
  if (!r.ok) throw new HttpErr(503, 'Could not reach Google to check the sign-in. Try again in a minute.');
  const j = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  KEYS = { list: Array.isArray(j.keys) ? j.keys : [], until: Date.now() + Math.min(m ? +m[1] : 3600, 21600) * 1000 };
  return KEYS.list;
}
async function verifyIdToken(token, c) {
  const bad = why => new HttpErr(401, 'Please sign in again.', why);
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw bad('format');
  let head, body;
  try { head = JSON.parse(new TextDecoder().decode(unb64url(parts[0]))); body = JSON.parse(new TextDecoder().decode(unb64url(parts[1]))); }
  catch (e) { throw bad('format'); }
  if (head.alg !== 'RS256' || !head.kid) throw bad('alg');
  let jwk = (await googleKeys(c)).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await googleKeys(c, true)).find(k => k.kid === head.kid);   // Google rotated its keys
  if (!jwk) throw bad('kid');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), te.encode(parts[0] + '.' + parts[1]));
  if (!ok) throw bad('signature');
  const now = Math.floor(Date.now() / 1000);
  if (body.aud !== c.project || body.iss !== 'https://securetoken.google.com/' + c.project) throw bad('project');
  if (!(body.exp > now)) throw bad('expired');
  if (!(body.iat <= now + 300) || (body.auth_time !== undefined && !(body.auth_time <= now + 300))) throw bad('time');
  if (typeof body.sub !== 'string' || !body.sub || body.sub.length > 128) throw bad('sub');
  return { uid: body.sub, email: typeof body.email === 'string' ? body.email : '', name: typeof body.name === 'string' ? body.name : '' };
}

/* ---------------------------------------------------------------- the database, with Google admin access */
let GTOK = { token: '', until: 0, who: '' };
async function googleToken(c) {
  if (c.firestoreToken) return c.firestoreToken;          // tests: the Firestore emulator
  if (!c.sa) throw new HttpErr(503, 'Payments are not set up yet: FIREBASE_SERVICE_ACCOUNT is missing.', 'setup');
  if (GTOK.token && GTOK.who === c.sa.client_email && Date.now() < GTOK.until) return GTOK.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: c.sa.private_key_id })) + '.' +
    b64urlText(JSON.stringify({ iss: c.sa.client_email, sub: c.sa.client_email, aud: c.oauth, iat: now, exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore' }));
  const pem = String(c.sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  let key;
  try {
    key = await crypto.subtle.importKey('pkcs8', unb64url(pem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch (e) { throw new HttpErr(503, 'FIREBASE_SERVICE_ACCOUNT has an unreadable private_key. Paste the whole JSON file again.', 'setup'); }
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(unsigned));
  const r = await fetch(c.oauth, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + unsigned + '.' + b64url(sig),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) throw new HttpErr(503, 'Google did not accept the Firebase service account key.', 'setup');
  GTOK = { token: j.access_token, until: Date.now() + Math.max(60, (+j.expires_in || 3600) - 120) * 1000, who: c.sa.client_email };
  return GTOK.token;
}
const docRoot = c => `projects/${c.project}/databases/(default)/documents`;
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}
function dec(x) {
  if (!x) return null;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return x.doubleValue;
  if ('stringValue' in x) return x.stringValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('timestampValue' in x) return x.timestampValue;
  return null;
}
async function fs(c, method, path, body) {
  const r = await fetch(`${c.firestore}/${path}`, {
    method, headers: { authorization: 'Bearer ' + await googleToken(c), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 404) return null;
  const j = await r.json().catch(() => null);
  if (r.ok) return j;
  const e = (Array.isArray(j) ? j[0] && j[0].error : j && j.error) || {};
  if (r.status === 409 || e.status === 'ALREADY_EXISTS' || e.status === 'ABORTED' || e.status === 'FAILED_PRECONDITION') throw new Conflict(e.message || 'conflict');
  if (r.status === 403 || r.status === 401) throw new HttpErr(503, 'The Firebase service account cannot write to the database.', 'setup');
  throw new HttpErr(503, 'The database is busy. Try again in a minute.');
}
async function getDoc(c, path) {
  const j = await fs(c, 'GET', `${docRoot(c)}/${path}`);
  if (!j) return null;
  const data = {}; for (const k in (j.fields || {})) data[k] = dec(j.fields[k]);
  return { data, updateTime: j.updateTime };
}
async function commit(c, writes) {
  await fs(c, 'POST', `${docRoot(c)}:commit`, {
    writes: writes.map(w => {
      const fields = {}; for (const k in w.data) fields[k] = enc(w.data[k]);
      return { update: { name: `${docRoot(c)}/${w.path}`, fields }, currentDocument: w.pre };
    }),
  });
}

/* ---------------------------------------------------------------- Razorpay */
async function razorpay(c, method, path, body) {
  if (!c.keyId || !c.keySecret) throw new HttpErr(503, 'Payments are not set up yet: the Razorpay keys are missing.', 'setup');
  let r;
  try {
    r = await fetch(c.razorpay + path, {
      method, headers: { authorization: 'Basic ' + btoa(c.keyId + ':' + c.keySecret), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) { throw new HttpErr(502, 'Could not reach Razorpay. Try again in a minute.'); }
  const j = await r.json().catch(() => null);
  if (r.status === 401) throw new HttpErr(503, 'Razorpay did not accept the API keys.', 'setup');
  if (!r.ok) throw new HttpErr(r.status === 400 ? 400 : 502, 'Razorpay: ' + String((j && j.error && j.error.description) || r.status).slice(0, 160));
  return j;
}
const notesOf = link => (link && link.notes && !Array.isArray(link.notes) ? link.notes : {});

/* Writes Premium for a fully paid PhysiQuest payment link. Safe to call many times for the same link:
   the payment record gwpay/{link id} is created together with Premium, and only if it does not exist yet. */
async function activate(c, link, payment, via) {
  const n = notesOf(link), plan = n.plan, uid = n.uid, P = PLANS[plan];
  if (n.app !== 'physiquest' || !P || typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new HttpErr(422, 'This is not a PhysiQuest payment.', 'foreign');
  const amount = +link.amount;
  if (link.status !== 'paid' || link.currency !== 'INR' || !(amount >= 100) || amount !== +n.amount || !(+link.amount_paid >= amount)) {
    throw new HttpErr(409, 'This payment is not complete.', 'unpaid');
  }
  const pid = (payment && payment.id) || (Array.isArray(link.payments) && (link.payments.find(p => p.status === 'captured') || link.payments[0] || {}).payment_id) || '';
  const method = (payment && payment.method) || (Array.isArray(link.payments) && (link.payments.find(p => p.payment_id === pid) || {}).method) || '';
  const rec = 'gwpay/' + link.id;
  for (let attempt = 0; attempt < 6; attempt++) {
    const done = await getDoc(c, rec);
    if (done) return { already: true, uid, plan: done.data.plan, exp: done.data.exp, pid: done.data.pid, amount: done.data.amount };
    const cur = await getDoc(c, 'premium/' + uid);
    const curExp = cur && typeof cur.data.exp === 'number' ? cur.data.exp : null;
    const { start, exp } = newEnd(curExp, plan);
    const at = new Date();
    try {
      await commit(c, [
        { path: 'premium/' + uid, data: { plan, exp, at, pay: link.id }, pre: cur ? { updateTime: cur.updateTime } : { exists: false } },
        { path: rec, data: { uid, plan, amount: amount / 100, currency: 'INR', link: link.id, pid, method, start, exp, at,
          email: (payment && payment.email) || (link.customer && link.customer.email) || '', mode: c.mode, via }, pre: { exists: false } },
      ]);
      return { already: false, uid, plan, exp, start, pid, amount: amount / 100 };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;          // someone else wrote at the same moment: read again and retry
      await new Promise(r => setTimeout(r, 40 * (attempt + 1)));
    }
  }
  throw new HttpErr(503, 'The database is busy. Try again in a minute.');
}

/* ---------------------------------------------------------------- web plumbing */
function cors(req, c) {
  const o = (req.headers.get('origin') || '').replace(/\/$/, '');
  if (!o || !c.origins.includes(o)) return {};
  return { 'access-control-allow-origin': o, 'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '86400', vary: 'origin' };
}
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});
async function bodyJson(req) {
  const t = await req.text();
  if (t.length > 4000) throw new HttpErr(413, 'Too large.');
  try { return t ? JSON.parse(t) : {}; } catch (e) { throw new HttpErr(400, 'Bad request.'); }
}
async function signedInStudent(req, c) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  if (!m) throw new HttpErr(401, 'Please sign in first.', 'signin');
  return verifyIdToken(m[1].trim(), c);
}

/* POST /checkout {plan:'M'|'Y', src:'app'|'web'} → {url, id, plan, amount, test} */
async function checkout(req, c) {
  const user = await signedInStudent(req, c);
  const b = await bodyJson(req);
  const plan = b.plan, P = PLANS[plan];
  if (!P) throw new HttpErr(400, 'Choose monthly or yearly.');
  if (!ready(c).firebase) throw new HttpErr(503, 'Payments are not set up yet: FIREBASE_SERVICE_ACCOUNT is missing.', 'setup');
  const profile = await getDoc(c, 'users/' + user.uid);
  if (!profile) throw new HttpErr(409, 'Add your details in My account first.', 'profile');
  const src = b.src === 'app' ? 'app' : 'web';
  const now = Math.floor(Date.now() / 1000);
  const rnd = b64url(crypto.getRandomValues(new Uint8Array(6))).replace(/[-_]/g, 'x');
  const name = String(profile.data.name || user.name || '').replace(/[^\p{L}\p{M} .'-]/gu, '').trim().slice(0, 50);
  const customer = {};
  if (name.length >= 2) customer.name = name;
  if (user.email) customer.email = user.email;
  const link = await razorpay(c, 'POST', '/payment_links', {
    amount: P.amount, currency: 'INR', accept_partial: false,
    description: `PhysiQuest ${P.label} (${P.days} days)`,
    reference_id: ('PQ' + plan + now.toString(36) + rnd).slice(0, 40),
    expire_by: now + 35 * 60,
    reminder_enable: false,
    notify: { sms: false, email: false },
    customer,
    notes: { app: 'physiquest', uid: user.uid, plan, amount: String(P.amount) },
    callback_url: new URL('/done?src=' + src, req.url).toString(),
    callback_method: 'get',
  });
  if (!link || !link.short_url || !link.id) throw new HttpErr(502, 'Razorpay did not return a payment page. Try again.');
  return json({ url: link.short_url, id: link.id, plan, amount: P.amount / 100, days: P.days, test: c.mode !== 'live', expires: link.expire_by || now + 35 * 60 });
}

/* POST /verify {id:'plink_…'} → {status, plan, exp}: asks Razorpay about the student's own payment link */
async function verify(req, c) {
  const user = await signedInStudent(req, c);
  const b = await bodyJson(req);
  if (!/^plink_[A-Za-z0-9]{6,40}$/.test(String(b.id || ''))) throw new HttpErr(400, 'Bad payment link.');
  const link = await razorpay(c, 'GET', '/payment_links/' + b.id);
  if (notesOf(link).uid !== user.uid) throw new HttpErr(403, 'This payment belongs to another account.');
  if (link.status !== 'paid') return json({ status: link.status || 'created' });
  const r = await activate(c, link, null, 'check');
  return json({ status: 'paid', plan: r.plan, exp: r.exp, until: dayDate(r.exp), pid: r.pid, already: r.already });
}

/* POST /webhook: Razorpay's signed message after a payment link is paid */
async function webhook(req, c) {
  if (!c.hookSecret) throw new HttpErr(503, 'RAZORPAY_WEBHOOK_SECRET is not set.', 'setup');
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  if (!same(sig, await hmacHex(c.hookSecret, raw))) return json({ error: 'Bad signature.' }, 400);
  let ev; try { ev = JSON.parse(raw); } catch (e) { return json({ error: 'Bad JSON.' }, 400); }
  if (ev.event !== 'payment_link.paid') return json({ ok: true, ignored: ev.event || 'unknown' });
  const link = ev.payload && ev.payload.payment_link && ev.payload.payment_link.entity;
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
  if (!link || notesOf(link).app !== 'physiquest') return json({ ok: true, ignored: 'not a PhysiQuest link' });
  let r;
  try { r = await activate(c, link, pay, 'webhook'); }
  catch (e) {
    // a payment that can never switch Premium on is answered 200, so Razorpay does not keep sending it;
    // a database error answers 503, so Razorpay tries again later
    if (e instanceof HttpErr && (e.code === 'foreign' || e.code === 'unpaid')) return json({ ok: false, reason: e.message });
    throw e;
  }
  return json({ ok: true, uid: r.uid, exp: r.exp, already: r.already });
}

/* GET /done: where Razorpay sends the student after paying */
async function done(req, c) {
  const q = new URL(req.url).searchParams;
  const app = q.get('src') === 'app';
  const id = q.get('razorpay_payment_link_id') || '', ref = q.get('razorpay_payment_link_reference_id') || '';
  const status = q.get('razorpay_payment_link_status') || '', pid = q.get('razorpay_payment_id') || '';
  const sig = q.get('razorpay_signature') || '';
  // Razorpay's signature proves these details came from Razorpay, so the page may show them.
  const valid = !!(id && pid && c.keySecret) && same(sig, await hmacHex(c.keySecret, `${id}|${ref}|${status}|${pid}`));
  if (!/^plink_[A-Za-z0-9]{6,40}$/.test(id)) return page(c, app, { kind: 'fail' });
  // Whatever the address says, the payment's real state comes from Razorpay itself, asked with the secret key.
  let link;
  try { link = await razorpay(c, 'GET', '/payment_links/' + id); }
  catch (e) { return page(c, app, valid && status === 'paid' ? { kind: 'wait', pid } : { kind: 'fail' }); }
  if (link.status !== 'paid') return page(c, app, { kind: 'fail', pid: valid ? pid : '' });
  try {
    const r = await activate(c, link, valid ? { id: pid } : null, 'return');
    return page(c, app, valid ? { kind: 'ok', pid: r.pid || pid, plan: r.plan, exp: r.exp, amount: r.amount } : { kind: 'ok' });
  } catch (e) {
    return page(c, app, { kind: 'wait', pid: valid ? pid : '' });
  }
}

function page(c, app, o) {
  const back = app
    ? `intent://pay#Intent;scheme=physiquest;package=${DEFAULTS.appPackage};S.browser_fallback_url=${encodeURIComponent(c.site + '#plans')};end`
    : c.site + '#plans';
  const P = PLANS[o.plan] || {};
  const head = { ok: ['Payment successful', 'Premium is on'], wait: ['Payment received', 'Premium is switching on'], fail: ['Payment not completed', 'No Premium was added'] }[o.kind];
  const body = o.kind === 'ok' && typeof o.exp === 'number'
    ? `<p class="big">Premium is on until <b>${esc(dayDate(o.exp))}</b>.</p><p>${esc(P.label || 'Premium')} · ₹${esc(o.amount)}. NEET and JEE practice and mocks are open now, on every phone you sign in to.</p>`
    : o.kind === 'ok'
      ? `<p class="big">Premium is on.</p><p>Go back to PhysiQuest to see it. NEET and JEE practice and mocks are open now, on every phone you sign in to.</p>`
    : o.kind === 'wait'
      ? `<p class="big">Your money reached us safely.</p><p>Premium usually switches on within a minute. Go back to PhysiQuest and it will appear by itself. If it is not on after 15 minutes, write to us with the payment ID below.</p>`
      : `<p class="big">The payment did not go through.</p><p>If money left your account, the bank returns it automatically, usually within 5–7 days. Go back to PhysiQuest and tap Upgrade to try again.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(head[0])} · PhysiQuest</title>
<style>
:root{--bg:#f6f3fc;--card:#fff;--ink:#21143d;--mute:#4a3d6e;--pri:#21143d;--ok:#0b7a4b;--bad:#b3133a;--line:rgba(33,20,61,.13)}
@media (prefers-color-scheme:dark){:root{--bg:#21143d;--card:#291a4a;--ink:#f4efff;--mute:#bfb2e4;--pri:#19e0dc;--ok:#4cf0a0;--bad:#ff6b8a;--line:rgba(191,178,228,.2)}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:28px 24px;max-width:440px;width:100%;display:grid;gap:12px;box-shadow:0 10px 30px rgba(33,20,61,.12)}
.mark{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:30px;color:#fff;background:${o.kind === 'fail' ? 'var(--bad)' : 'var(--ok)'}}
.eyebrow{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600}
h1{margin:0;font-size:1.5rem;line-height:1.2}p{margin:0;color:var(--mute)}.big{color:var(--ink);font-size:1.1rem}
.btn{display:block;text-align:center;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:12px;background:var(--pri);color:var(--bg);margin-top:6px}
.id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem;background:var(--bg);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere;color:var(--ink)}
small{color:var(--mute)}
</style></head><body><main class="card">
<div class="mark" aria-hidden="true">${o.kind === 'fail' ? '!' : '✓'}</div>
<span class="eyebrow">PhysiQuest${c.mode === 'test' ? ' · test mode, no real money' : ''}</span>
<h1>${esc(head[0])}</h1>${body}
${o.pid ? `<p>Payment ID</p><div class="id">${esc(o.pid)}</div>` : ''}
<a class="btn" href="${esc(back)}">${app ? 'Back to the PhysiQuest app' : 'Back to PhysiQuest'}</a>
${app ? '<small>If the button does nothing, just switch back to the PhysiQuest app. Premium shows there by itself.</small>' : ''}
${o.kind !== 'ok' && c.support ? `<small>Questions about a payment? Write to ${esc(c.support)}${o.pid ? ' with the payment ID above' : ''}.</small>` : ''}
<small>Payments are handled by Razorpay. PhysiQuest never sees your card, UPI PIN or bank details.</small>
</main>${!app && o.kind === 'ok' ? `<script>setTimeout(function(){location.href=${JSON.stringify(back)}},4000)</script>` : ''}</body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}

/* ---------------------------------------------------------------- the Worker */
export default {
  async fetch(req, env) {
    const c = settings(env);
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    const h = cors(req, c);
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
      if (req.method === 'GET' && (path === '/' || path === '/health')) {
        const r = ready(c);
        const missing = [!c.keyId && 'RAZORPAY_KEY_ID', !c.keySecret && 'RAZORPAY_KEY_SECRET', !c.hookSecret && 'RAZORPAY_WEBHOOK_SECRET',
          !r.firebase && 'FIREBASE_SERVICE_ACCOUNT'].filter(Boolean);
        return json({ service: 'PhysiQuest payments', mode: c.mode, ready: r, missing, problem: c.saErr || undefined,
          plans: Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { price: p.amount / 100, days: p.days }])) }, 200, h);
      }
      if (req.method === 'POST' && path === '/checkout') return withHeaders(await checkout(req, c), h);
      if (req.method === 'POST' && path === '/verify') return withHeaders(await verify(req, c), h);
      if (req.method === 'POST' && path === '/webhook') return await webhook(req, c);
      if (req.method === 'GET' && path === '/done') return await done(req, c);
      return json({ error: 'Not found.' }, 404, h);
    } catch (e) {
      if (e instanceof HttpErr) return json({ error: e.message, code: e.code || undefined }, e.status, h);
      return json({ error: 'Something went wrong. Try again in a minute.' }, 500, h);
    }
  },
};
function withHeaders(res, h) { for (const k in h) res.headers.set(k, h[k]); return res; }
