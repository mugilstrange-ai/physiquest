/* Razorpay payments: the payment server's database writes (worker/physiquest-pay.js) against the real
   Firestore emulator, and what the app may read and write afterwards. */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { activate, settings, today, getDoc as serverGet } from '../../worker/test/load.js';

let env;
const OWNER = 'mugilstrange@gmail.com';
const tok = email => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const stu = () => env.authenticatedContext('stu1', tok('stu1@example.com')).firestore();
const stu2 = () => env.authenticatedContext('stu2', tok('stu2@example.com')).firestore();
const owner = () => env.authenticatedContext('own1', tok(OWNER)).firestore();
const anon = () => env.unauthenticatedContext().firestore();
// the payment server talks to the emulator with admin access ("Bearer owner"), like Google admin access in production
const server = settings({ FIREBASE_PROJECT_ID: 'demo-physiquest', FIRESTORE_URL: 'http://127.0.0.1:8080/v1', FIRESTORE_TOKEN: 'owner', RAZORPAY_KEY_ID: 'rzp_test_x' });
const price = { M: 9900, Y: 89900 };
const link = (id, uid = 'stu1', plan = 'M', o = {}) => Object.assign({
  id, status: 'paid', currency: 'INR', amount: price[plan], amount_paid: price[plan],
  notes: { app: 'physiquest', uid, plan, amount: String(price[plan]) },
  payments: [{ payment_id: 'pay_' + id.slice(6), status: 'captured', method: 'upi' }] }, o);
const seed = (path, data) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), path), data); });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-physiquest', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

test('a paid Razorpay link switches Premium on in the database, exactly once', async () => {
  const r1 = await activate(server, link('plink_A1'), null, 'webhook');
  assert.equal(r1.already, false);
  assert.equal(r1.exp, today() + 30);
  const r2 = await activate(server, link('plink_A1'), null, 'return');
  assert.equal(r2.already, true);
  assert.equal(r2.exp, today() + 30);
  const p = await serverGet(server, 'premium/stu1');
  assert.deepEqual([p.data.plan, p.data.exp, p.data.pay], ['M', today() + 30, 'plink_A1']);
  const g = await serverGet(server, 'gwpay/plink_A1');
  assert.deepEqual([g.data.uid, g.data.amount, g.data.pid, g.data.via, g.data.mode], ['stu1', 99, 'pay_A1', 'webhook', 'test']);
});

test('renewals add days after the current end, even when payments arrive together', async () => {
  await seed('premium/stu1', { plan: 'M', exp: today() + 5, utr: '412345678901', at: Timestamp.now() });
  await Promise.all([activate(server, link('plink_B1'), null, 'webhook'), activate(server, link('plink_B2', 'stu1', 'Y'), null, 'webhook'),
    activate(server, link('plink_B3'), null, 'webhook'), activate(server, link('plink_B1'), null, 'return')]);
  const p = await serverGet(server, 'premium/stu1');
  assert.equal(p.data.exp, today() + 5 + 31 + 366 + 31);
});

test('unpaid, half-paid and foreign links are refused', async () => {
  await assert.rejects(activate(server, link('plink_C1', 'stu1', 'M', { status: 'created', amount_paid: 0 }), null, 'check'), { code: 'unpaid' });
  await assert.rejects(activate(server, link('plink_C2', 'stu1', 'M', { amount_paid: 500 }), null, 'check'), { code: 'unpaid' });
  await assert.rejects(activate(server, link('plink_C3', 'stu1', 'M', { notes: { uid: 'stu1', plan: 'M' } }), null, 'check'), { code: 'foreign' });
  await assert.rejects(activate(server, link('plink_C4', '../users/x'), null, 'check'), { code: 'foreign' });
  assert.equal(await serverGet(server, 'premium/stu1'), null);
});

test('students read only their own Razorpay payment records and can never write them', async () => {
  await activate(server, link('plink_D1'), null, 'webhook');
  await activate(server, link('plink_D2', 'stu2'), null, 'webhook');
  await assertSucceeds(getDoc(doc(stu(), 'gwpay/plink_D1')));
  await assertFails(getDoc(doc(stu(), 'gwpay/plink_D2')));
  await assertSucceeds(getDocs(query(collection(stu(), 'gwpay'), where('uid', '==', 'stu1'))));   // the app's payment history
  await assertFails(getDocs(collection(stu(), 'gwpay')));                                           // but not everyone's
  await assertFails(getDoc(doc(anon(), 'gwpay/plink_D1')));
  await assertSucceeds(getDocs(collection(owner(), 'gwpay')));                                      // the owner sees all sales
  const fake = { uid: 'stu1', plan: 'Y', amount: 899, link: 'plink_X', pid: 'pay_X', start: today(), exp: today() + 365, at: Timestamp.now() };
  await assertFails(setDoc(doc(stu(), 'gwpay/plink_X'), fake));
  await assertFails(setDoc(doc(owner(), 'gwpay/plink_X'), fake));
  await assertFails(setDoc(doc(stu(), 'premium/stu1'), { plan: 'Y', exp: today() + 365, pay: 'plink_X', at: Timestamp.now() }));
  await assertSucceeds(getDoc(doc(stu(), 'premium/stu1')));
  await assertFails(getDoc(doc(stu2(), 'premium/stu1')));
});

test('the payment server address is public to read and closed to write', async () => {
  await seed('config/pay', { api: 'https://physiquest-pay.example.workers.dev' });
  await assertSucceeds(getDoc(doc(anon(), 'config/pay')));
  await assertSucceeds(getDoc(doc(stu(), 'config/pay')));
  await assertFails(setDoc(doc(stu(), 'config/pay'), { api: 'https://evil.example' }));
  await assertFails(setDoc(doc(owner(), 'config/pay'), { api: 'https://evil.example' }));
  await assertFails(setDoc(doc(anon(), 'config/pay'), { api: 'https://evil.example' }));
});

test('the owner can still approve an older UPI request after a Razorpay payment', async () => {
  await activate(server, link('plink_E1'), null, 'webhook');
  const exp = today() + 61;
  await seed('payments/412345678901', { uid: 'stu1', plan: 'M', amount: 99, utr: '412345678901', status: 'pending', at: Timestamp.now(), name: 'Ravi Kumar', email: 'stu1@example.com' });
  const o = owner(), b = writeBatch(o);
  b.update(doc(o, 'payments/412345678901'), { status: 'approved', decidedAt: Timestamp.now(), exp });
  b.set(doc(o, 'premium/stu1'), { plan: 'M', exp, utr: '412345678901', at: Timestamp.now() });
  await assertSucceeds(b.commit());
});
