'use strict';
/* Tests for the PhysiQuest server rules.
   On GitHub they run against Google's Firestore emulator; elsewhere against a small in-memory stand-in. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const core = require('../core');

function fakeDb() {
  const store = new Map();
  const clone = v => JSON.parse(JSON.stringify(v));
  const doc = (c, id) => {
    const k = c + '/' + id;
    return {
      get: async () => ({ exists: store.has(k), data: () => clone(store.get(k)) }),
      set: async (v, o) => { store.set(k, o && o.merge && store.has(k) ? Object.assign(store.get(k), clone(v)) : clone(v)); },
      update: async v => { if (!store.has(k)) throw new Error('missing ' + k); Object.assign(store.get(k), clone(v)); },
      delete: async () => { store.delete(k); }
    };
  };
  return {
    collection: c => ({ doc: id => doc(c, id) }),
    runTransaction: async fn => fn({ get: r => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) })
  };
}
function makeDb() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-physiquest' });
    return admin.firestore();
  }
  return fakeDb();
}
const db = makeDb();
console.log(process.env.FIRESTORE_EMULATOR_HOST ? 'Using the Firestore emulator' : 'Using the in-memory stand-in');

const SECRET = 'test_key_secret', HOOK = 'test_webhook_secret';
const rid = p => p + crypto.randomBytes(6).toString('hex');
const sign = (o, p, s = SECRET) => crypto.createHmac('sha256', s).update(o + '|' + p).digest('hex');

/* a fake Razorpay that remembers orders and lets tests decide each payment's state */
function fakeRzp() {
  const orders = {}, payments = {}, calls = [];
  return {
    keyId: 'rzp_test_abc', orders, payments, calls,
    async createOrder(b) { calls.push(['order', b]); const id = rid('order_'); orders[id] = Object.assign({ id }, b); return orders[id]; },
    async fetchPayment(id) { calls.push(['fetch', id]); if (!payments[id]) throw new Error('404'); return Object.assign({}, payments[id]); },
    async capture(id, amount) { calls.push(['capture', id, amount]); payments[id].status = 'captured'; return Object.assign({}, payments[id]); }
  };
}
let clock = Date.UTC(2026, 10, 6, 6, 0, 0);
const deps = rzp => ({ db, rzp, now: () => clock });
const today = () => core.dayOf(clock);
const ADULT = { name: 'Mugilan', cls: '12', city: 'Coimbatore', state: 'Tamil Nadu', adult: true };
const MINOR = { name: 'Priya S', cls: '9', city: 'Madurai', state: 'Tamil Nadu', adult: false, phone: '98765 43210' };
const tok = (extra) => Object.assign({ email: 'student@example.com' }, extra || {});

test('profile checks', () => {
  assert.equal(core.validateProfile(ADULT, tok()).name, 'Mugilan');
  assert.equal(core.validateProfile(Object.assign({}, ADULT, { name: 'முகிலன்' }), tok()).name, 'முகிலன்', 'Tamil names are accepted');
  assert.equal(core.validateProfile(MINOR, tok()).phone, '+919876543210');
  for (const bad of [{ name: '' }, { name: '<script>' }, { cls: '13' }, { state: 'Atlantis' }, { city: '1' }, { adult: 'yes' }, { phone: '12345' }]) {
    assert.throws(() => core.validateProfile(Object.assign({}, ADULT, bad), tok()), e => e.code === 'invalid-argument', JSON.stringify(bad));
  }
  assert.equal(core.validateProfile(ADULT, tok({ phone_number: '+919000000001' })).phoneVerified, true);
  assert.equal(core.normalizePhone('+91 98765-43210'), '+919876543210');
  assert.equal(core.normalizePhone('09876543210'), '+919876543210');
  assert.equal(core.normalizePhone('5876543210'), null);
});

test('signature checks', () => {
  assert.ok(core.paymentSignatureOk('order_A1B2C3', 'pay_X1Y2Z3', sign('order_A1B2C3', 'pay_X1Y2Z3'), SECRET));
  assert.ok(!core.paymentSignatureOk('order_A1B2C3', 'pay_X1Y2Z3', sign('order_A1B2C3', 'pay_X1Y2Z4'), SECRET));
  assert.ok(!core.paymentSignatureOk('order_A1B2C3', 'pay_X1Y2Z3', 'short', SECRET));
  assert.ok(!core.paymentSignatureOk('order_A1B2C3', 'pay_X1Y2Z3', sign('order_A1B2C3', 'pay_X1Y2Z3'), ''));
  const body = '{"event":"payment.captured"}';
  assert.ok(core.webhookSignatureOk(body, crypto.createHmac('sha256', HOOK).update(body).digest('hex'), HOOK));
  assert.ok(!core.webhookSignatureOk(body, crypto.createHmac('sha256', 'other').update(body).digest('hex'), HOOK));
});

test('profile save keeps parent consent; progress is validated', async () => {
  const uid = rid('u');
  const a = await core.saveProfile(deps(), uid, tok(), ADULT);
  assert.equal(a.profile.name, 'Mugilan');
  assert.equal(a.needsParent, false);
  await assert.rejects(core.saveProgress(deps(), uid, { code: 'hello' }), e => e.code === 'invalid-argument');
  await assert.rejects(core.saveProgress(deps(), uid, { code: 'PQ1-' + 'a'.repeat(200001) }), e => e.code === 'invalid-argument');
  await core.saveProgress(deps(), uid, { code: 'PQ1-abc_DEF-123' });
  assert.equal((await core.getAccount(deps(), uid)).progress, 'PQ1-abc_DEF-123');
});

test('under-18 students need a parent before paying', async () => {
  const rzp = fakeRzp(), uid = rid('u');
  await assert.rejects(core.createOrder(deps(rzp), uid, tok(), { plan: 'M' }), e => e.code === 'failed-precondition', 'no profile yet');
  const acc = await core.saveProfile(deps(), uid, tok(), MINOR);
  assert.equal(acc.needsParent, true);
  await assert.rejects(core.createOrder(deps(rzp), uid, tok(), { plan: 'M' }), e => e.code === 'failed-precondition', 'no consent yet');
  const nowSec = Math.floor(clock / 1000);
  const parent = { uid: rid('p'), phone_number: '+919123456780', auth_time: nowSec, firebase: { sign_in_provider: 'phone' } };
  await assert.rejects(core.parentConsent(deps(), uid, tok(), Object.assign({}, parent, { phone_number: '+919876543210' })), e => e.code === 'invalid-argument', 'same phone as student');
  await assert.rejects(core.parentConsent(deps(), uid, tok(), Object.assign({}, parent, { firebase: { sign_in_provider: 'password' } })), e => e.code === 'invalid-argument', 'not a phone OTP');
  await assert.rejects(core.parentConsent(deps(), uid, tok(), Object.assign({}, parent, { auth_time: nowSec - 3600 })), e => e.code === 'invalid-argument', 'old OTP');
  const ok = await core.parentConsent(deps(), uid, tok(), parent);
  assert.equal(ok.needsParent, false);
  assert.equal(ok.profile.parentOk, true);
  const again = await core.saveProfile(deps(), uid, tok(), MINOR);
  assert.equal(again.profile.parentOk, true, 'editing details keeps consent');
  const order = await core.createOrder(deps(rzp), uid, tok(), { plan: 'M' });
  assert.equal(order.amount, 19900);
});

test('payments: price comes from the server, signature and Razorpay are both checked, Premium is granted once', async () => {
  const rzp = fakeRzp(), uid = rid('u'), other = rid('u');
  await core.saveProfile(deps(), uid, tok(), ADULT);
  await assert.rejects(core.createOrder(deps(rzp), uid, tok(), { plan: 'FREE', amount: 1 }), e => e.code === 'invalid-argument');
  const o = await core.createOrder(deps(rzp), uid, tok(), { plan: 'M', amount: 1 });
  assert.equal(o.amount, 19900, 'the app cannot change the price');
  assert.equal(rzp.calls[0][1].amount, 19900);
  const pay = rid('pay_');
  rzp.payments[pay] = { id: pay, order_id: o.orderId, amount: 19900, currency: 'INR', status: 'authorized' };
  const sig = sign(o.orderId, pay);
  await assert.rejects(core.confirmPayment(deps(rzp), uid, { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay, 'wrong') }, SECRET), e => e.code === 'permission-denied', 'forged signature');
  await assert.rejects(core.confirmPayment(deps(rzp), other, { orderId: o.orderId, paymentId: pay, signature: sig }, SECRET), e => e.code === 'permission-denied', 'someone else’s order');
  const r1 = await core.confirmPayment(deps(rzp), uid, { orderId: o.orderId, paymentId: pay, signature: sig }, SECRET);
  assert.ok(rzp.calls.some(c => c[0] === 'capture'), 'authorized payments are captured');
  assert.deepEqual(r1.sub, { plan: 'M', exp: today() + 30 });
  const r2 = await core.confirmPayment(deps(rzp), uid, { orderId: o.orderId, paymentId: pay, signature: sig }, SECRET);
  assert.deepEqual(r2.sub, r1.sub, 'confirming twice does not add days twice');
  /* a second (yearly) payment extends from the end of the first */
  const o2 = await core.createOrder(deps(rzp), uid, tok(), { plan: 'Y' });
  const pay2 = rid('pay_');
  rzp.payments[pay2] = { id: pay2, order_id: o2.orderId, amount: 199900, currency: 'INR', status: 'captured' };
  const r3 = await core.confirmPayment(deps(rzp), uid, { orderId: o2.orderId, paymentId: pay2, signature: sign(o2.orderId, pay2) }, SECRET);
  assert.deepEqual(r3.sub, { plan: 'Y', exp: today() + 30 + 366 });
});

test('payments: wrong amount, wrong order or unfinished payment never unlock Premium', async () => {
  const rzp = fakeRzp(), uid = rid('u');
  await core.saveProfile(deps(), uid, tok(), ADULT);
  const o = await core.createOrder(deps(rzp), uid, tok(), { plan: 'Y' });
  const cases = [
    { amount: 100, order_id: o.orderId, status: 'captured', currency: 'INR' },
    { amount: 199900, order_id: 'order_SomethingElse1', status: 'captured', currency: 'INR' },
    { amount: 199900, order_id: o.orderId, status: 'failed', currency: 'INR' },
    { amount: 199900, order_id: o.orderId, status: 'captured', currency: 'USD' }
  ];
  for (const c of cases) {
    const pay = rid('pay_');
    rzp.payments[pay] = Object.assign({ id: pay }, c);
    await assert.rejects(core.confirmPayment(deps(rzp), uid, { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, SECRET), e => e.code === 'failed-precondition', JSON.stringify(c));
  }
  assert.equal((await core.getAccount(deps(), uid)).sub, null);
});

test('webhook gives Premium even if the app closed, and never twice', async () => {
  const rzp = fakeRzp(), uid = rid('u');
  await core.saveProfile(deps(), uid, tok(), ADULT);
  const o = await core.createOrder(deps(rzp), uid, tok(), { plan: 'M' });
  const pay = rid('pay_');
  rzp.payments[pay] = { id: pay, order_id: o.orderId, amount: 19900, currency: 'INR', status: 'captured' };
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: rzp.payments[pay] } } });
  const good = crypto.createHmac('sha256', HOOK).update(body).digest('hex');
  await assert.rejects(core.handleWebhook(deps(rzp), body, 'f'.repeat(64), HOOK), e => e.code === 'permission-denied');
  const r = await core.handleWebhook(deps(rzp), Buffer.from(body), good, HOOK);
  assert.equal(r.granted, true);
  assert.deepEqual((await core.getAccount(deps(), uid)).sub, { plan: 'M', exp: today() + 30 });
  /* order.paid for the same payment, then the app confirming: still 31 days */
  const body2 = JSON.stringify({ event: 'order.paid', payload: { payment: { entity: rzp.payments[pay] } } });
  await core.handleWebhook(deps(rzp), body2, crypto.createHmac('sha256', HOOK).update(body2).digest('hex'), HOOK);
  await core.confirmPayment(deps(rzp), uid, { orderId: o.orderId, paymentId: pay, signature: sign(o.orderId, pay) }, SECRET);
  assert.deepEqual((await core.getAccount(deps(), uid)).sub, { plan: 'M', exp: today() + 30 });
  const other = JSON.stringify({ event: 'refund.created', payload: {} });
  assert.ok((await core.handleWebhook(deps(rzp), other, crypto.createHmac('sha256', HOOK).update(other).digest('hex'), HOOK)).ignored);
});

test('too many payment attempts in a day are stopped', async () => {
  const rzp = fakeRzp(), uid = rid('u');
  await core.saveProfile(deps(), uid, tok(), ADULT);
  for (let i = 0; i < 15; i++) await core.createOrder(deps(rzp), uid, tok(), { plan: 'M' });
  await assert.rejects(core.createOrder(deps(rzp), uid, tok(), { plan: 'M' }), e => e.code === 'resource-exhausted');
  clock += 864e5;   // next day
  await core.createOrder(deps(rzp), uid, tok(), { plan: 'M' });
});

test('deleting an account removes the profile and progress', async () => {
  const uid = rid('u');
  await core.saveProfile(deps(), uid, tok(), ADULT);
  await core.saveProgress(deps(), uid, { code: 'PQ1-abc' });
  await core.deleteAccount(deps(), uid);
  const a = await core.getAccount(deps(), uid);
  assert.equal(a.profile, null);
  assert.equal(a.progress, null);
  assert.equal(a.sub, null);
});
