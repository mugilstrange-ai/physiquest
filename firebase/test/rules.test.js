/* PhysiQuest database rules: what each person may and may not do. Runs against the Firestore emulator. */
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

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
const pay = (o) => Object.assign({ uid: 'stu1', plan: 'M', amount: 199, utr: '412345678901', status: 'pending', at: now(), name: 'Ravi Kumar', email: 'stu1@example.com' }, o || {});
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
  await assertFails(setDoc(doc(s, 'payments/412345678901'), pay({ amount: 1 })));                // wrong price
  await assertFails(setDoc(doc(s, 'payments/412345678901'), pay({ plan: 'Y', amount: 199 })));
  await assertFails(setDoc(doc(s, 'payments/412345678901'), pay({ status: 'approved' })));       // cannot approve itself
  await assertFails(setDoc(doc(s, 'payments/412345678901'), pay({ uid: 'stu2' })));
  await assertFails(setDoc(doc(s, 'payments/999'), pay({ utr: '999' })));                        // a UTR has 12 digits
  await assertFails(setDoc(doc(s, 'payments/412345678902'), pay()));                             // id must equal the UTR
  await assertSucceeds(setDoc(doc(s, 'payments/412345678901'), pay()));
  await assertSucceeds(setDoc(doc(s, 'payments/512345678901'), pay({ utr: '512345678901', plan: 'Y', amount: 1999 })));
});

test('a student without saved details cannot send a payment', async () => {
  await assertFails(setDoc(doc(stu(), 'payments/412345678901'), pay()));
});

test('a UTR can be used only once', async () => {
  await seedUser('stu1'); await seedUser('stu2');
  await assertSucceeds(setDoc(doc(stu(), 'payments/412345678901'), pay()));
  await assertFails(setDoc(doc(stu2(), 'payments/412345678901'), pay({ uid: 'stu2', email: 'stu2@example.com' })));
  await assertFails(setDoc(doc(stu(), 'payments/412345678901'), pay({ name: 'Changed' })));     // and cannot be edited by the student
});

test('students see only their own payment requests', async () => {
  await seedUser('stu1'); await seedUser('stu2');
  await setDoc(doc(stu(), 'payments/412345678901'), pay());
  await assertSucceeds(getDocs(query(collection(stu(), 'payments'), where('uid', '==', 'stu1'))));
  await assertFails(getDocs(collection(stu(), 'payments')));
  await assertFails(getDoc(doc(stu2(), 'payments/412345678901')));
  await assertFails(getDocs(query(collection(stu(), 'payments'), where('status', '==', 'pending'))));
});

test('nobody but the owner can grant Premium', async () => {
  await assertFails(setDoc(doc(stu(), 'premium/stu1'), { plan: 'Y', exp: 900, utr: '1', at: now() }));
  await assertFails(setDoc(doc(stu2(), 'premium/stu1'), { plan: 'Y', exp: 900, utr: '1', at: now() }));
  await assertSucceeds(setDoc(doc(owner(), 'premium/stu1'), { plan: 'M', exp: 400, utr: '412345678901', at: now() }));
  await assertSucceeds(getDoc(doc(stu(), 'premium/stu1')));
  await assertFails(getDoc(doc(stu2(), 'premium/stu1')));
  await assertFails(updateDoc(doc(stu(), 'premium/stu1'), { exp: 4000 }));
  await assertFails(deleteDoc(doc(stu(), 'premium/stu1')));
});

test('the owner check cannot be faked', async () => {
  const unverified = db('x1', OWNER, { email_verified: false });
  const password = db('x2', OWNER, { firebase: { sign_in_provider: 'password' } });
  const lookalike = db('x3', 'mugilstrange@gmail.com.evil.com');
  for (const d of [unverified, password, lookalike]) {
    await assertFails(setDoc(doc(d, 'premium/stu1'), { plan: 'Y', exp: 900, utr: '1', at: now() }));
    await assertFails(getDocs(query(collection(d, 'payments'), where('status', '==', 'pending'))));
  }
});

test('the owner can review, approve and reject payment requests', async () => {
  await seedUser('stu1');
  await setDoc(doc(stu(), 'payments/412345678901'), pay());
  const o = owner();
  await assertSucceeds(getDocs(query(collection(o, 'payments'), where('status', '==', 'pending'))));
  await assertSucceeds(updateDoc(doc(o, 'payments/412345678901'), { status: 'approved', decidedAt: now(), exp: 400 }));
  await assertFails(updateDoc(doc(o, 'payments/412345678901'), { amount: 5 }));                  // the record of what was paid stays as sent
  await assertFails(updateDoc(doc(o, 'payments/412345678901'), { status: 'pending' }));
  await assertFails(deleteDoc(doc(o, 'payments/412345678901')));
});

test('premium values are checked even for the owner', async () => {
  const o = owner();
  await assertFails(setDoc(doc(o, 'premium/stu1'), { plan: 'Z', exp: 400, utr: '1', at: now() }));
  await assertFails(setDoc(doc(o, 'premium/stu1'), { plan: 'M', exp: 'forever', utr: '1', at: now() }));
  await assertFails(setDoc(doc(o, 'premium/stu1'), { plan: 'M', exp: 400, utr: '1', at: now(), admin: true }));
});

test('anything outside these collections is closed', async () => {
  await assertFails(setDoc(doc(stu(), 'config/app'), { open: true }));
  await assertFails(getDoc(doc(owner(), 'secrets/x')));
});
