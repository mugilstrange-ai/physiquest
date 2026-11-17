/* Premium content (prem/...): only students whose Premium is active can download it; only the owner can add it,
   and nobody can change it afterwards. */
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, Timestamp } from 'firebase/firestore';

let env;
const OWNER = 'mugilstrange@gmail.com';
const tok = email => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid, email) => env.authenticatedContext(uid, tok(email)).firestore();
const stu = () => as('stu1', 'stu1@example.com');
const owner = () => as('own1', OWNER);
const anon = () => env.unauthenticatedContext().firestore();
const today = () => Math.floor(Date.now() / 864e5) - Date.UTC(2026, 0, 1) / 864e5;
const H = 'ab'.repeat(32), ID = '0123456789abcdef-1';
const part = (o = {}) => Object.assign({ d: '{"v":1}', i: 1, n: 1, h: H, at: Timestamp.now() }, o);
const seed = (path, data) => env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), path), data); });
const premium = exp => seed('premium/stu1', { plan: 'M', exp, utr: '412345678901', at: Timestamp.now() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-physiquest', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed('prem/' + ID, part()); });

test('a student with active Premium can download the pack, including on the last day', async () => {
  await premium(today() + 20);
  await assertSucceeds(getDoc(doc(stu(), 'prem/' + ID)));
  await premium(today());
  await assertSucceeds(getDoc(doc(stu(), 'prem/' + ID)));
});

test('no Premium, ended Premium, signed out: no download', async () => {
  await assertFails(getDoc(doc(stu(), 'prem/' + ID)));          // no premium record
  await premium(today() - 1);
  await assertFails(getDoc(doc(stu(), 'prem/' + ID)));          // ended yesterday
  await assertFails(getDoc(doc(anon(), 'prem/' + ID)));
  await premium(today() + 30);
  await assertFails(getDoc(doc(as('stu2', 'stu2@example.com'), 'prem/' + ID)));   // someone else's Premium does not count
});

test('nobody can list the packs', async () => {
  await premium(today() + 30);
  await assertFails(getDocs(collection(stu(), 'prem')));
  await assertFails(getDocs(collection(owner(), 'prem')));
});

test('only the owner adds a pack, in the right shape, and nobody changes it', async () => {
  await assertSucceeds(getDoc(doc(owner(), 'prem/' + ID)));
  await assertSucceeds(setDoc(doc(owner(), 'prem/fedcba9876543210-1'), part()));
  await assertFails(setDoc(doc(owner(), 'prem/' + ID), part({ d: 'changed' })));            // no changes
  await assertFails(setDoc(doc(owner(), 'prem/not-a-pack'), part()));                        // bad name
  await assertFails(setDoc(doc(owner(), 'prem/1111111111111111-1'), part({ x: 1 })));        // extra field
  await assertFails(setDoc(doc(owner(), 'prem/2222222222222222-1'), part({ i: 2, n: 1 })));  // part number beyond the count
  await assertFails(setDoc(doc(owner(), 'prem/3333333333333333-1'), part({ h: 'nothex' })));
  await premium(today() + 30);
  await assertFails(setDoc(doc(stu(), 'prem/4444444444444444-1'), part()));                  // students never write
  await assertFails(deleteDoc(doc(stu(), 'prem/' + ID)));
  await assertSucceeds(deleteDoc(doc(owner(), 'prem/' + ID)));                               // the owner may remove an old pack
});
