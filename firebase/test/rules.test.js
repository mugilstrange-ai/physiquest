/* PhysiQuest database rules: what each person may and may not do. Runs against the Firestore emulator. */
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp, writeBatch, serverTimestamp } from 'firebase/firestore';

let env;
const OWNER = 'mugilstrange@gmail.com';
const tok = (email, extra) => Object.assign({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }, extra || {});
const db = (uid, email, extra) => env.authenticatedContext(uid, tok(email, extra)).firestore();
const stu = () => db('stu1', 'stu1@example.com');
const stu2 = () => db('stu2', 'stu2@example.com');
const owner = () => db('own1', OWNER);
const now = () => Timestamp.now();
const adult = (o) => Object.assign({ name: 'Ravi Kumar', cls: '12', city: 'Coimbatore', state: 'Tamil Nadu', phone: '9876543210', adult: true, email: 'stu1@example.com', v: 1, at: now() }, o || {});
const minor = (o) => Object.assign({ name: 'Anu', cls: '9', city: 'Madurai', state: 'Tamil Nadu', phone: '', adult: false, parentName: 'Lakshmi', parentPhone: '9123456780', parentOk: true, email: 'stu1@example.com', v: 1, at: now() }, o || {});
const pay = (o) => Object.assign({ uid: 'stu1', plan: 'M', amount: 99, utr: '412345678901', status: 'pending', at: now(), name: 'Ravi Kumar', email: 'stu1@example.com' }, o || {});
// a payment request exactly as the app sends it: the payment and the student's queue counter, in one step, on the server's clock
const sendPay = (d, o, q) => { const p = pay(o); const b = writeBatch(d);
  b.set(doc(d, 'payments/' + ((q && q.path) || p.utr)), Object.assign({}, p, { at: serverTimestamp() }));
  b.set(doc(d, 'payq/' + ((q && q.qid) || p.uid)), Object.assign({ open: 1, last: p.utr, at: serverTimestamp() }, (q && q.queue) || {}));
  return b.commit(); };
const seedQ = (uid, open, secondsAgo) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'payq/' + uid), { open, last: '000000000000', at: Timestamp.fromMillis(Date.now() - secondsAgo * 1000) }); });
const seedPay = (o) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'payments/' + pay(o).utr), pay(o)); });
// the owner's approval exactly as the owner page sends it
const approve = (o, utr, uid, plan, exp) => { const b = writeBatch(o);
  b.update(doc(o, 'payments/' + utr), { status: 'approved', decidedAt: now(), exp });
  b.set(doc(o, 'premium/' + uid), { plan, exp, utr, at: now() }); return b.commit(); };
const seedUser = async (uid) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'users/' + uid), adult({ email: uid + '@example.com' })); });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-physiquest', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

test('signed-out visitors can read and write nothing', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'users/stu1')));
  await assertFails(setDoc(doc(anon, 'users/stu1'), adult()));
  await assertFails(getDoc(doc(anon, 'premium/stu1')));
  await assertFails(getDocs(collection(anon, 'payments')));
});

test('a student can save valid details for themselves only', async () => {
  await assertSucceeds(setDoc(doc(stu(), 'users/stu1'), adult()));
  await assertSucceeds(getDoc(doc(stu(), 'users/stu1')));
  await assertFails(getDoc(doc(stu2(), 'users/stu1')));
  await assertFails(setDoc(doc(stu2(), 'users/stu1'), adult({ email: 'stu2@example.com' })));
  await assertSucceeds(getDoc(doc(owner(), 'users/stu1')));
});

test('details are checked field by field', async () => {
  const s = stu();
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ address: '12 Main Road' })));          // nothing extra may be stored
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ email: 'someone@else.com' })));        // email must be the signed-in one
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ phone: '12345' })));                   // a real 10-digit mobile
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ cls: '13' })));
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ state: 'Atlantis' })));
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ name: 'x'.repeat(61) })));
  await assertSucceeds(setDoc(doc(s, 'users/stu1'), adult({ phone: '' })));                      // mobile is optional
});

test('under-18 students need a parent’s name, mobile and agreement', async () => {
  const s = stu();
  await assertSucceeds(setDoc(doc(s, 'users/stu1'), minor()));
  await assertFails(setDoc(doc(s, 'users/stu1'), minor({ parentOk: false })));
  const noParent = minor(); delete noParent.parentName; delete noParent.parentPhone; delete noParent.parentOk;
  await assertFails(setDoc(doc(s, 'users/stu1'), noParent));
  await assertFails(setDoc(doc(s, 'users/stu1'), minor({ phone: '9123456780' })));              // parent must use a different number
  await assertFails(setDoc(doc(s, 'users/stu1'), adult({ parentName: 'X' })));                  // adults store no parent details
});

test('progress is private to its owner', async () => {
  await assertSucceeds(setDoc(doc(stu(), 'progress/stu1'), { code: 'PQ1-abc', at: now() }));
  await assertSucceeds(getDoc(doc(stu(), 'progress/stu1')));
  await assertFails(getDoc(doc(stu2(), 'progress/stu1')));
  await assertFails(setDoc(doc(stu(), 'progress/stu1'), { code: 'x'.repeat(200001), at: now() }));
  await assertFails(setDoc(doc(stu(), 'progress/stu1'), { code: 'PQ1-abc', at: now(), xp: 99999 }));
});

test('a payment request must be honest, pending and the student’s own', async () => {
  await seedUser('stu1');
  const s = stu();
  await assertFails(sendPay(s, { amount: 1 }));                                   // wrong price
  await assertFails(sendPay(s, { plan: 'Y', amount: 99 }));
  await assertFails(sendPay(s, { amount: 199 }));                                 // old monthly price is no longer accepted
  await assertFails(sendPay(s, { status: 'approved' }));                          // cannot approve itself
  await assertFails(sendPay(s, { uid: 'stu2' }));
  await assertFails(sendPay(s, { utr: '999' }));                                  // a UTR has 12 digits
  await assertFails(sendPay(s, {}, { path: '412345678902' }));                    // id must equal the UTR
  await assertSucceeds(sendPay(s));
  await seedQ('stu1', 1, 120);
  await assertSucceeds(sendPay(s, { utr: '512345678901', plan: 'Y', amount: 899 }, { queue: { open: 2 } }));
});

test('a payment must be sent together with the queue counter, on the server clock', async () => {
  await seedUser('stu1');
  const s = stu();
  await assertFails(setDoc(doc(s, 'payments/412345678901'), pay()));             // the payment alone
  await assertFails(setDoc(doc(s, 'payq/stu1'), { open: 1, last: '412345678901', at: serverTimestamp() }));   // the counter alone
  await assertFails(sendPay(s, {}, { queue: { at: now() } }));                    // the phone's own clock is not trusted
  await assertFails(sendPay(s, {}, { queue: { open: 0 } }));                      // the counter must go up by one
  await assertFails(sendPay(s, {}, { queue: { last: '512345678901' } }));         // and point at this payment
  await assertFails(sendPay(s, {}, { qid: 'stu2' }));                             // and be the student’s own
  await assertSucceeds(sendPay(s));
});

test('at most 3 requests can wait, and they must be at least a minute apart', async () => {
  await seedUser('stu1');
  const s = stu();
  await seedQ('stu1', 3, 600);
  await assertFails(sendPay(s, {}, { queue: { open: 4 } }));                      // three already waiting
  await seedQ('stu1', 1, 20);
  await assertFails(sendPay(s, {}, { queue: { open: 2 } }));                      // only 20 seconds after the last one
  await seedQ('stu1', 2, 90);
  await assertSucceeds(sendPay(s, {}, { queue: { open: 3 } }));
});

test('a student cannot lower their own queue counter', async () => {
  await seedQ('stu1', 3, 600);
  await assertFails(updateDoc(doc(stu(), 'payq/stu1'), { open: 0 }));
  await assertFails(setDoc(doc(stu(), 'payq/stu1'), { open: 0, last: '000000000000', at: serverTimestamp() }));
  await assertFails(deleteDoc(doc(stu(), 'payq/stu1')));
  await assertFails(getDoc(doc(stu2(), 'payq/stu1')));
  await assertSucceeds(getDoc(doc(stu(), 'payq/stu1')));
});

test('the owner frees one place in the queue per decision', async () => {
  await seedQ('stu1', 2, 600);
  await assertSucceeds(updateDoc(doc(owner(), 'payq/stu1'), { open: 1 }));
  await assertFails(updateDoc(doc(owner(), 'payq/stu1'), { open: 3 }));
  await assertFails(updateDoc(doc(owner(), 'payq/stu1'), { last: '512345678901' }));
  await assertSucceeds(updateDoc(doc(owner(), 'payq/stu1'), { open: 0 }));
  await assertFails(updateDoc(doc(owner(), 'payq/stu1'), { open: -1 }));
});

test('a student without saved details cannot send a payment', async () => {
  await assertFails(sendPay(stu()));
});

test('a UTR can be used only once', async () => {
  await seedUser('stu1'); await seedUser('stu2');
  await assertSucceeds(sendPay(stu()));
  await assertFails(sendPay(stu2(), { uid: 'stu2', email: 'stu2@example.com' }));
  await assertFails(setDoc(doc(stu(), 'payments/412345678901'), pay({ name: 'Changed' })));     // and cannot be edited by the student
});

test('students see only their own payment requests', async () => {
  await seedUser('stu1'); await seedUser('stu2');
  await sendPay(stu());
  await assertSucceeds(getDocs(query(collection(stu(), 'payments'), where('uid', '==', 'stu1'))));
  await assertFails(getDocs(collection(stu(), 'payments')));
  await assertFails(getDoc(doc(stu2(), 'payments/412345678901')));
  await assertFails(getDocs(query(collection(stu(), 'payments'), where('status', '==', 'pending'))));
});

test('nobody but the owner can grant Premium', async () => {
  await seedPay();
  await assertFails(approve(stu(), '412345678901', 'stu1', 'M', 400));
  await assertFails(approve(stu2(), '412345678901', 'stu1', 'M', 400));
  await assertSucceeds(approve(owner(), '412345678901', 'stu1', 'M', 400));
  await assertSucceeds(getDoc(doc(stu(), 'premium/stu1')));
  await assertFails(getDoc(doc(stu2(), 'premium/stu1')));
  await assertFails(updateDoc(doc(stu(), 'premium/stu1'), { exp: 4000 }));
  await assertFails(deleteDoc(doc(stu(), 'premium/stu1')));
});

test('Premium only comes with approving a matching waiting payment', async () => {
  await seedPay(); await seedPay({ utr: '512345678901', plan: 'Y', amount: 899 });
  const o = owner();
  await assertFails(setDoc(doc(o, 'premium/stu1'), { plan: 'M', exp: 400, utr: '412345678901', at: now() }));   // no approval in the same step
  await assertFails(approve(o, '412345678901', 'stu2', 'M', 400));               // someone else’s payment
  await assertFails(approve(o, '412345678901', 'stu1', 'Y', 400));               // a monthly payment cannot give a yearly plan
  await assertSucceeds(approve(o, '412345678901', 'stu1', 'M', 400));
  await assertFails(approve(o, '412345678901', 'stu1', 'M', 800));               // the same payment cannot be used twice
  await assertFails(setDoc(doc(o, 'premium/stu1'), { plan: 'M', exp: 800, utr: '412345678901', at: now() }));
  await assertSucceeds(deleteDoc(doc(o, 'premium/stu1')));                        // removing Premium after a refund
});

test('the owner check cannot be faked', async () => {
  await seedPay();
  const unverified = db('x1', OWNER, { email_verified: false });
  const password = db('x2', OWNER, { firebase: { sign_in_provider: 'password' } });
  const lookalike = db('x3', 'mugilstrange@gmail.com.evil.com');
  for (const d of [unverified, password, lookalike]) {
    await assertFails(approve(d, '412345678901', 'stu1', 'M', 400));
    await assertFails(getDocs(query(collection(d, 'payments'), where('status', '==', 'pending'))));
  }
});

test('the owner can review, approve and reject payment requests, each only once', async () => {
  await seedPay(); await seedPay({ utr: '512345678901' });
  const o = owner();
  await assertSucceeds(getDocs(query(collection(o, 'payments'), where('status', '==', 'pending'))));
  await assertSucceeds(updateDoc(doc(o, 'payments/412345678901'), { status: 'approved', decidedAt: now(), exp: 400 }));
  await assertFails(updateDoc(doc(o, 'payments/412345678901'), { status: 'rejected', decidedAt: now(), note: 'x' }));   // decided once
  await assertSucceeds(updateDoc(doc(o, 'payments/512345678901'), { status: 'rejected', decidedAt: now(), note: 'UTR not found in my bank' }));
  await assertFails(updateDoc(doc(o, 'payments/512345678901'), { amount: 5 }));                  // the record of what was paid stays as sent
  await assertFails(updateDoc(doc(o, 'payments/512345678901'), { status: 'pending' }));
  await assertFails(deleteDoc(doc(o, 'payments/412345678901')));
});

test('premium values are checked even for the owner', async () => {
  await seedPay();
  const o = owner();
  const bad = (prem) => { const b = writeBatch(o);
    b.update(doc(o, 'payments/412345678901'), { status: 'approved', decidedAt: now(), exp: 400 });
    b.set(doc(o, 'premium/stu1'), prem); return b.commit(); };
  await assertFails(bad({ plan: 'Z', exp: 400, utr: '412345678901', at: now() }));
  await assertFails(bad({ plan: 'M', exp: 'forever', utr: '412345678901', at: now() }));
  await assertFails(bad({ plan: 'M', exp: 400, utr: '412345678901', at: now(), admin: true }));
});

test('anything outside these collections is closed', async () => {
  await assertFails(setDoc(doc(stu(), 'config/app'), { open: true }));
  await assertFails(getDoc(doc(owner(), 'secrets/x')));
});
