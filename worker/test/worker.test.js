/* PhysiQuest payment Worker: checks every route against fake Google, Razorpay and Firestore services.
   Run with: node --test worker/test/  (Node 20 or later, no packages needed) */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { hmacHex, today, PLANS, dayDate } from '../physiquest-pay.js';

const PROJECT = 'physiquest-1e225';
const te = new TextEncoder();
const b64url = u8 => Buffer.from(u8).toString('base64url');
const RSA = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };

let google, other, sa, ENV;          // key pairs: Google's sign-in keys, a stranger's keys, the Firebase service account
const fsDocs = new Map();            // the fake database: path -> {fields, updateTime}
const links = new Map();             // the fake Razorpay: id -> payment link
let calls = [], tick = 0, failNextCommit = 0;

async function sign(keys, kid, claims) {
  const h = b64url(te.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
  const b = b64url(te.encode(JSON.stringify(claims)));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, te.encode(h + '.' + b));
  return `${h}.${b}.${b64url(new Uint8Array(s))}`;
}
const now = () => Math.floor(Date.now() / 1000);
const idToken = (uid, o = {}) => sign(o.keys || google, o.kid || 'k1', Object.assign({
  iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, sub: uid, iat: now() - 10, auth_time: now() - 100, exp: now() + 3000,
  email: uid + '@example.com', name: 'Ravi Kumar' }, o.claims || {}));

function reply(obj, status = 200, headers = {}) {
  return new Response(obj === null ? null : JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });
}
const docPath = name => name.split('/documents/')[1];

/* ---------- the fake outside world ---------- */
async function fakeFetch(url, init = {}) {
  url = String(url); const method = init.method || 'GET';
  calls.push({ url, method, body: init.body, headers: init.headers || {} });
  if (url === 'https://keys.test/jwk') {
    const jwk = await crypto.subtle.exportKey('jwk', google.publicKey);
    return reply({ keys: [{ kid: 'k1', n: jwk.n, e: jwk.e, alg: 'RS256', kty: 'RSA', use: 'sig' }] }, 200, { 'cache-control': 'public, max-age=3600' });
  }
  if (url === 'https://oauth.test/token') {
    const assertion = new URLSearchParams(init.body).get('assertion');
    const [h, b, s] = assertion.split('.');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', sa.publicKey, Buffer.from(s, 'base64url'), te.encode(h + '.' + b));
    const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (!ok || claims.iss !== 'pay@physiquest.iam.gserviceaccount.com' || !/datastore/.test(claims.scope)) return reply({ error: 'invalid_grant' }, 400);
    return reply({ access_token: 'gtok', expires_in: 3600 });
  }
  if (url.startsWith('https://fs.test/v1/')) {
    if (init.headers.authorization !== 'Bearer gtok') return reply({ error: { status: 'UNAUTHENTICATED' } }, 401);
    const p = url.slice('https://fs.test/v1/'.length);
    if (method === 'GET') {
      const d = fsDocs.get(docPath(p));
      return d ? reply({ name: p, fields: d.fields, updateTime: d.updateTime }) : reply({ error: { status: 'NOT_FOUND' } }, 404);
    }
    if (method === 'POST' && p.endsWith(':commit')) {
      if (failNextCommit > 0) { failNextCommit--; return reply({ error: { status: 'UNAVAILABLE' } }, 503); }
      await new Promise(r => setTimeout(r, 5));   // the network delay comes before the database's atomic step
      const { writes } = JSON.parse(init.body);
      for (const w of writes) {          // every precondition first: all or nothing
        const d = fsDocs.get(docPath(w.update.name)), pre = w.currentDocument || {};
        if (pre.exists === false && d) return reply({ error: { status: 'ALREADY_EXISTS', message: 'exists' } }, 409);
        if (pre.exists === true && !d) return reply({ error: { status: 'NOT_FOUND' } }, 404);
        if (pre.updateTime && (!d || d.updateTime !== pre.updateTime)) return reply({ error: { status: 'FAILED_PRECONDITION', message: 'changed' } }, 400);
      }
      for (const w of writes) fsDocs.set(docPath(w.update.name), { fields: w.update.fields, updateTime: `2026-11-14T00:00:00.${String(++tick).padStart(6, '0')}Z` });
      return reply({ writeResults: writes.map(() => ({})) });
    }
  }
  if (url.startsWith('https://rzp.test/v1/')) {
    if (init.headers.authorization !== 'Basic ' + btoa('rzp_test_abc:keysecret')) return reply({ error: { description: 'auth' } }, 401);
    const p = url.slice('https://rzp.test/v1'.length);
    if (method === 'POST' && p === '/payment_links') {
      const b = JSON.parse(init.body), id = 'plink_' + 'T' + (links.size + 1).toString().padStart(8, '0');
      const l = Object.assign({}, b, { id, short_url: 'https://rzp.io/rzp/' + id, status: 'created', amount_paid: 0, payments: null });
      links.set(id, l); return reply(l);
    }
    const m = /^\/payment_links\/(plink_\w+)$/.exec(p);
    if (method === 'GET' && m) return links.has(m[1]) ? reply(links.get(m[1])) : reply({ error: { description: 'not found' } }, 400);
  }
  return reply({ error: 'unexpected ' + url }, 599);
}

/* ---------- helpers ---------- */
const req = (method, path, o = {}) => worker.fetch(new Request('https://pay.test' + path, {
  method, headers: Object.assign({}, o.token ? { authorization: 'Bearer ' + o.token } : {}, o.origin ? { origin: o.origin } : {}, o.headers || {}),
  body: o.body === undefined ? undefined : typeof o.body === 'string' ? o.body : JSON.stringify(o.body) }), o.env || ENV);
const field = (path, k) => { const d = fsDocs.get(path); if (!d || !d.fields[k]) return undefined; const v = d.fields[k]; return 'integerValue' in v ? +v.integerValue : v.stringValue ?? v.timestampValue; };
const seedUser = uid => fsDocs.set('users/' + uid, { fields: { name: { stringValue: 'Ravi Kumar' } }, updateTime: 'u0' });
const seedPremium = (uid, exp) => fsDocs.set('premium/' + uid, { fields: { plan: { stringValue: 'M' }, exp: { integerValue: String(exp) } }, updateTime: 'p0' });
async function newLink(uid, plan = 'M') {
  const r = await req('POST', '/checkout', { token: await idToken(uid), body: { plan, src: 'app' } });
  assert.equal(r.status, 200, await r.clone().text()); return (await r.json()).id;
}
function payLink(id, o = {}) {
  const l = links.get(id); const pid = o.pid || 'pay_' + id.slice(6);
  Object.assign(l, { status: 'paid', amount_paid: l.amount, payments: [{ payment_id: pid, status: 'captured', method: 'upi', amount: l.amount }] }, o.link || {});
  return pid;
}
async function webhook(id, o = {}) {
  const l = links.get(id), pid = l.payments[0].payment_id;
  const ev = { entity: 'event', event: o.event || 'payment_link.paid', payload: { payment_link: { entity: l }, payment: { entity: { id: pid, method: 'upi', email: 'stu@example.com', status: 'captured' } } } };
  const raw = JSON.stringify(ev);
  return req('POST', '/webhook', { body: raw, headers: { 'x-razorpay-signature': o.sig !== undefined ? o.sig : await hmacHex('hooksecret', raw), 'content-type': 'application/json' } });
}

before(async () => {
  google = await crypto.subtle.generateKey(RSA, true, ['sign', 'verify']);
  other = await crypto.subtle.generateKey(RSA, true, ['sign', 'verify']);
  sa = await crypto.subtle.generateKey(RSA, true, ['sign', 'verify']);
  const pk = Buffer.from(await crypto.subtle.exportKey('pkcs8', sa.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
  ENV = {
    RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'keysecret', RAZORPAY_WEBHOOK_SECRET: 'hooksecret',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ type: 'service_account', project_id: PROJECT, private_key_id: 'sa1',
      private_key: `-----BEGIN PRIVATE KEY-----\n${pk}\n-----END PRIVATE KEY-----\n`, client_email: 'pay@physiquest.iam.gserviceaccount.com', token_uri: 'https://oauth.test/token' }),
    RAZORPAY_API: 'https://rzp.test/v1', FIRESTORE_URL: 'https://fs.test/v1', GOOGLE_KEYS_URL: 'https://keys.test/jwk',
  };
  globalThis.fetch = fakeFetch;
});
beforeEach(() => { fsDocs.clear(); links.clear(); calls = []; failNextCommit = 0; seedUser('stu1'); seedUser('stu2'); });

/* ---------- tests ---------- */
test('the health page says what is set and what is missing, and never shows a secret', async () => {
  let r = await req('GET', '/');
  let j = await r.json();
  assert.equal(j.mode, 'test');
  assert.deepEqual(j.ready, { razorpay: true, webhook: true, firebase: true });
  assert.deepEqual(j.missing, []);
  assert.deepEqual(j.plans, { M: { price: 99, days: 31 }, Y: { price: 899, days: 366 } });
  assert.ok(!/keysecret|hooksecret|PRIVATE/.test(JSON.stringify(j)));
  r = await req('GET', '/health', { env: { FIREBASE_SERVICE_ACCOUNT: '{not json' } });
  j = await r.json();
  assert.equal(j.mode, 'not set');
  assert.deepEqual(j.missing, ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'FIREBASE_SERVICE_ACCOUNT']);
  assert.match(j.problem, /not valid JSON/);
});

test('only the app and the website may call it from a browser', async () => {
  let r = await req('OPTIONS', '/checkout', { origin: 'https://appassets.androidplatform.net' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net');
  assert.match(r.headers.get('access-control-allow-headers'), /authorization/);
  r = await req('OPTIONS', '/checkout', { origin: 'https://evil.example' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await req('POST', '/checkout', { origin: 'https://mugilstrange-ai.github.io', token: await idToken('stu1'), body: { plan: 'M' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://mugilstrange-ai.github.io');
});

test('checkout needs a real, current PhysiQuest sign-in', async () => {
  const bad = async (token, why) => { const r = await req('POST', '/checkout', { token, body: { plan: 'M' } }); assert.equal(r.status, 401, why); };
  let r = await req('POST', '/checkout', { body: { plan: 'M' } });
  assert.equal(r.status, 401);
  await bad('not.a.token', 'garbage');
  await bad(await idToken('stu1', { keys: other }), 'signed by someone else');
  await bad(await idToken('stu1', { kid: 'k9', keys: other }), 'unknown key');
  await bad(await idToken('stu1', { claims: { aud: 'another-project' } }), 'another Firebase project');
  await bad(await idToken('stu1', { claims: { iss: 'https://evil.example' } }), 'wrong issuer');
  await bad(await idToken('stu1', { claims: { exp: now() - 5 } }), 'expired');
  await bad(await idToken('stu1', { claims: { iat: now() + 3600 } }), 'issued in the future');
  await bad(await idToken('', {}), 'no user id');
  const t = await idToken('stu1'); const [h, b, s] = t.split('.');
  const forged = b64url(te.encode(JSON.stringify(Object.assign(JSON.parse(Buffer.from(b, 'base64url')), { sub: 'stu2' }))));
  await bad(`${h}.${forged}.${s}`, 'edited token');
  assert.equal(links.size, 0, 'no payment link was made');
});

test('checkout makes a one-time Razorpay link with the price set on the server', async () => {
  const r = await req('POST', '/checkout', { token: await idToken('stu1'), body: { plan: 'Y', src: 'app', amount: 1 } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.match(j.url, /^https:\/\/rzp\.io\//);
  assert.equal(j.plan, 'Y'); assert.equal(j.amount, 899); assert.equal(j.days, 366); assert.equal(j.test, true);
  const l = links.get(j.id);
  assert.equal(l.amount, 89900, 'the app cannot choose the price');
  assert.equal(l.currency, 'INR'); assert.equal(l.accept_partial, false);
  assert.deepEqual(l.notes, { app: 'physiquest', uid: 'stu1', plan: 'Y', amount: '89900' });
  assert.equal(l.callback_url, 'https://pay.test/done?src=app');
  assert.equal(l.callback_method, 'get');
  assert.ok(l.expire_by - now() >= 16 * 60, 'Razorpay needs at least 15 minutes');
  assert.ok(l.reference_id.length <= 40);
  assert.deepEqual(l.customer, { name: 'Ravi Kumar', email: 'stu1@example.com' });
  assert.deepEqual(l.notify, { sms: false, email: false });
  const r2 = await req('POST', '/checkout', { token: await idToken('stu1'), body: { plan: 'M' } });
  assert.equal(links.get((await r2.json()).id).callback_url, 'https://pay.test/done?src=web');
});

test('checkout refuses a made-up plan, a student without details, and a half-set-up Worker', async () => {
  let r = await req('POST', '/checkout', { token: await idToken('stu1'), body: { plan: 'LIFETIME' } });
  assert.equal(r.status, 400);
  r = await req('POST', '/checkout', { token: await idToken('stu9'), body: { plan: 'M' } });
  assert.equal(r.status, 409); assert.equal((await r.json()).code, 'profile');
  const env = Object.assign({}, ENV); delete env.FIREBASE_SERVICE_ACCOUNT;
  r = await req('POST', '/checkout', { token: await idToken('stu1'), body: { plan: 'M' }, env });
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'setup');
  const env2 = Object.assign({}, ENV, { RAZORPAY_KEY_SECRET: 'wrong' });
  r = await req('POST', '/checkout', { token: await idToken('stu1'), body: { plan: 'M' }, env: env2 });
  assert.equal(r.status, 503); assert.match((await r.json()).error, /Razorpay did not accept/);
  assert.equal(links.size, 0);
});

test('a signed webhook switches Premium on for 31 days from today', async () => {
  const id = await newLink('stu1', 'M'); const pid = payLink(id);
  const r = await webhook(id);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.already, false);
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
  assert.equal(field('premium/stu1', 'plan'), 'M');
  assert.equal(field('premium/stu1', 'pay'), id);
  assert.equal(field('gwpay/' + id, 'uid'), 'stu1');
  assert.equal(field('gwpay/' + id, 'amount'), 99);
  assert.equal(field('gwpay/' + id, 'pid'), pid);
  assert.equal(field('gwpay/' + id, 'start'), today());
  assert.equal(field('gwpay/' + id, 'mode'), 'test');
  assert.equal(field('gwpay/' + id, 'via'), 'webhook');
});

test('a webhook with a wrong signature changes nothing', async () => {
  const id = await newLink('stu1'); payLink(id);
  const r = await webhook(id, { sig: 'f'.repeat(64) });
  assert.equal(r.status, 400);
  assert.equal(fsDocs.has('premium/stu1'), false);
  const r2 = await webhook(id, { sig: '' });
  assert.equal(r2.status, 400);
});

test('the same payment never counts twice (Razorpay retries, the return page and the app check)', async () => {
  const id = await newLink('stu1'); payLink(id);
  await webhook(id); await webhook(id);
  const exp = field('premium/stu1', 'exp');
  assert.equal(exp, today() + 30);
  const j = await (await webhook(id)).json();
  assert.equal(j.already, true);
  const r = await req('POST', '/verify', { token: await idToken('stu1'), body: { id } });
  assert.equal((await r.json()).already, true);
  assert.equal(field('premium/stu1', 'exp'), exp);
});

test('renewing early adds the new days after the current end date', async () => {
  seedPremium('stu1', today() + 10);
  const id = await newLink('stu1', 'Y'); payLink(id);
  await webhook(id);
  assert.equal(field('premium/stu1', 'exp'), today() + 10 + 366);
  assert.equal(field('gwpay/' + id, 'start'), today() + 11);
  assert.equal(field('premium/stu1', 'plan'), 'Y');
});

test('after Premium has ended, the new days start today', async () => {
  seedPremium('stu1', today() - 40);
  const id = await newLink('stu1'); payLink(id);
  await webhook(id);
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
});

test('two payments at the same moment both count', async () => {
  const a = await newLink('stu1'), b = await newLink('stu1'); payLink(a); payLink(b);
  const [ra, rb] = await Promise.all([webhook(a), webhook(b)]);
  assert.equal(ra.status, 200); assert.equal(rb.status, 200);
  assert.equal(field('premium/stu1', 'exp'), today() + 61);
});

test('half-paid, edited or someone else\'s payment links never switch Premium on', async () => {
  let id = await newLink('stu1'); payLink(id, { link: { amount_paid: 100 } });
  let j = await (await webhook(id)).json();
  assert.equal(j.ok, false); assert.equal(fsDocs.has('premium/stu1'), false);
  id = await newLink('stu1'); payLink(id, { link: { amount: 100, amount_paid: 100 } });   // price changed after the link was made
  j = await (await webhook(id)).json();
  assert.equal(j.ok, false); assert.equal(fsDocs.has('premium/stu1'), false);
  id = await newLink('stu1'); payLink(id, { link: { notes: { plan: 'M', uid: 'stu1' } } });  // a link not made by PhysiQuest
  j = await (await webhook(id)).json();
  assert.equal(j.ignored, 'not a PhysiQuest link'); assert.equal(fsDocs.has('premium/stu1'), false);
  id = await newLink('stu1'); payLink(id);
  j = await (await webhook(id, { event: 'payment.captured' })).json();
  assert.equal(j.ignored, 'payment.captured'); assert.equal(fsDocs.has('premium/stu1'), false);
});

test('if the database is down, the webhook answers 503 so Razorpay tries again', async () => {
  const id = await newLink('stu1'); payLink(id);
  failNextCommit = 1;
  let r = await webhook(id);
  assert.equal(r.status, 503);
  assert.equal(fsDocs.has('premium/stu1'), false);
  r = await webhook(id);
  assert.equal(r.status, 200);
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
});

test('the return page checks Razorpay\'s signature, then shows Premium switched on', async () => {
  const id = await newLink('stu1', 'M'); const pid = payLink(id); const l = links.get(id);
  const sig = await hmacHex('keysecret', `${id}|${l.reference_id}|paid|${pid}`);
  const q = `?src=app&razorpay_payment_id=${pid}&razorpay_payment_link_id=${id}&razorpay_payment_link_reference_id=${l.reference_id}&razorpay_payment_link_status=paid&razorpay_signature=${sig}`;
  let r = await req('GET', '/done' + q);
  let html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /Payment successful/);
  assert.ok(html.includes('Premium is on until <b>' + dayDate(today() + 30) + '</b>'));
  assert.match(html, /intent:\/\/pay#Intent;scheme=physiquest;package=com\.physiquest\.app/);
  assert.match(html, /test mode, no real money/);
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
  assert.equal(field('gwpay/' + id, 'via'), 'return');
  await webhook(id);                                          // the webhook arrives afterwards: nothing is added twice
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
  r = await req('GET', '/done' + q.replace('src=app', 'src=web'));
  html = await r.text();
  assert.match(html, /Back to PhysiQuest</);
  assert.ok(html.includes('https://mugilstrange-ai.github.io/physiquest/#plans'));
});

test('the return page trusts Razorpay, not the address: forged or unpaid links add nothing', async () => {
  const id = await newLink('stu1'); const l = links.get(id);
  // the link is not paid, but the address claims it is, with a made-up signature
  let q = `?src=web&razorpay_payment_id=pay_FAKE&razorpay_payment_link_id=${id}&razorpay_payment_link_reference_id=${l.reference_id}&razorpay_payment_link_status=paid&razorpay_signature=${'0'.repeat(64)}`;
  let html = await (await req('GET', '/done' + q)).text();
  assert.match(html, /Payment not completed/);
  assert.equal(fsDocs.has('premium/stu1'), false);
  html = await (await req('GET', '/done?src=web&razorpay_payment_link_status=failed')).text();
  assert.match(html, /Payment not completed/);
  html = await (await req('GET', '/done?src=web&razorpay_payment_link_id=plink_NOSUCHLINK&razorpay_payment_link_status=paid')).text();
  assert.match(html, /Payment not completed/);
  // a really paid link with a bad signature: Premium still switches on (Razorpay says it is paid), but no details are shown
  const pid = payLink(id);
  q = `?src=web&razorpay_payment_id=${pid}&razorpay_payment_link_id=${id}&razorpay_payment_link_reference_id=${l.reference_id}&razorpay_payment_link_status=paid&razorpay_signature=bad`;
  html = await (await req('GET', '/done' + q)).text();
  assert.match(html, /Payment successful/);
  assert.ok(!html.includes(pid) && !html.includes('until <b>'));
  assert.equal(field('premium/stu1', 'exp'), today() + 30);
});

test('the return page escapes everything it shows', async () => {
  const r = await req('GET', '/done?src=web&razorpay_payment_id=%3Cscript%3E&razorpay_payment_link_id=x&razorpay_payment_link_status=paid&razorpay_signature=x');
  const html = await r.text();
  assert.ok(!html.includes('<script>alert') && !html.includes('<script>'.repeat(2)));
  assert.ok(!/razorpay_payment_id=<script>/.test(html));
});

test('the app can ask about its own payment link, and only its own', async () => {
  const id = await newLink('stu1', 'M');
  let r = await req('POST', '/verify', { token: await idToken('stu2'), body: { id } });
  assert.equal(r.status, 403);
  r = await req('POST', '/verify', { token: await idToken('stu1'), body: { id } });
  assert.deepEqual(await r.json(), { status: 'created' });
  payLink(id);
  r = await req('POST', '/verify', { token: await idToken('stu1'), body: { id } });
  const j = await r.json();
  assert.equal(j.status, 'paid'); assert.equal(j.exp, today() + 30); assert.equal(j.until, dayDate(today() + 30)); assert.equal(j.already, false);
  assert.equal(field('gwpay/' + id, 'via'), 'check');
  r = await req('POST', '/verify', { token: await idToken('stu1'), body: { id: '../../users/stu2' } });
  assert.equal(r.status, 400);
});

test('prices and lengths match the app', () => {
  assert.equal(PLANS.M.amount, 9900); assert.equal(PLANS.M.days, 31);
  assert.equal(PLANS.Y.amount, 89900); assert.equal(PLANS.Y.days, 366);
  assert.equal(today(Date.UTC(2026, 0, 1)), 0);
  assert.equal(dayDate(0), '1 Jan 2026');
});

test('unknown addresses answer 404', async () => {
  assert.equal((await req('GET', '/admin')).status, 404);
  assert.equal((await req('GET', '/checkout')).status, 404);
});
