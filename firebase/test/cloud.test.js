/* The app's own cloud code (pqcloud.cjs, copied from the app) against the Auth and Firestore emulators:
   sign-in, keeping the sign-in fresh, details, progress, a payment request, owner approval and account deletion. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('./pqcloud.cjs', import.meta.url), 'utf8');
const CFG = { apiKey: 'demo-key', projectId: 'demo-physiquest', authUrl: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com',
  tokenUrl: 'http://127.0.0.1:9099/securetoken.googleapis.com', fsUrl: 'http://127.0.0.1:8080' };
function app() {           // a fresh copy of the app's cloud code, like one phone
  const store = new Map();
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const ctx = { window: { PQ_CLOUD: CFG }, localStorage, fetch, AbortController, setTimeout, clearTimeout, console, Date, module: {} };
  vm.runInNewContext(SRC, ctx);
  return ctx.module.exports;
}
const google = (sub, email) => JSON.stringify({ sub, email, email_verified: true, name: sub });   // the emulator accepts unsigned test tokens
const today = () => Math.floor(Date.now() / 864e5) - Date.UTC(2026, 0, 1) / 864e5;

test('full journey: sign in, details, progress, pay, approve, Premium, delete', async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-physiquest/databases/(default)/documents', { method: 'DELETE' });
  const phone = app(), other = app(), owner = app();
  const s = await phone.signInGoogle(google('student-1', 'ravi@example.com'));
  assert.ok(s.uid && s.idToken, 'signed in');
  const uid = s.uid;

  await phone.set('users/' + uid, { name: 'Ravi Kumar', cls: '12', city: 'Coimbatore', state: 'Tamil Nadu', phone: '9876543210', adult: true, email: 'ravi@example.com', v: 1, at: new Date() });
  const me = await phone.get('users/' + uid);
  assert.equal(me.name, 'Ravi Kumar'); assert.equal(me.adult, true);

  await phone.set('progress/' + uid, { code: 'PQ1-test', at: new Date() });
  assert.equal((await phone.get('progress/' + uid)).code, 'PQ1-test');

  await assert.rejects(phone.set('premium/' + uid, { plan: 'Y', exp: 9999, utr: 'x', at: new Date() }), e => e.code === 'denied', 'a student cannot grant Premium');

  await phone.create('payments/412345678901', { uid, plan: 'M', amount: 99, utr: '412345678901', status: 'pending', at: new Date(), name: 'Ravi Kumar', email: 'ravi@example.com' });
  await assert.rejects(phone.create('payments/412345678901', { uid, plan: 'M', amount: 99, utr: '412345678901', status: 'pending', at: new Date(), name: 'Ravi Kumar', email: 'ravi@example.com' }), 'same UTR twice');
  const mine = await phone.query('payments', { uid });
  assert.equal(mine.length, 1); assert.equal(mine[0].status, 'pending');

  const o = await other.signInGoogle(google('student-2', 'meena@example.com'));
  assert.equal(await other.get('users/' + uid).catch(e => e.code), 'denied', 'another student cannot read Ravi’s details');
  await assert.rejects(other.query('payments', { status: 'pending' }), e => e.code === 'denied');

  await owner.signInGoogle(google('owner-1', 'mugilstrange@gmail.com'));
  assert.equal(owner.isOwner(), true);
  const pending = await owner.query('payments', { status: 'pending' });
  assert.equal(pending.length, 1); assert.equal(pending[0]._id, '412345678901');
  const exp = today() + 30;
  await owner.commit([
    { path: 'premium/' + uid, data: { plan: 'M', exp, utr: '412345678901', at: new Date() } },
    { path: 'payments/412345678901', data: { status: 'approved', decidedAt: new Date(), exp }, mask: ['status', 'decidedAt', 'exp'], mustExist: true }]);

  const prem = await phone.get('premium/' + uid);
  assert.equal(prem.exp, exp); assert.equal(prem.plan, 'M');
  assert.equal((await phone.query('payments', { uid }))[0].status, 'approved');

  // the sign-in renews itself when its hour is up
  const before = phone.user().idToken;
  phone.user().exp = 0;
  const after = await phone.token();
  assert.ok(after && after !== before, 'token refreshed');

  // deleting the account removes the student’s own records and the sign-in
  await phone.del('progress/' + uid); await phone.del('users/' + uid);
  await phone.deleteAccount();
  assert.equal(phone.user(), null);
  assert.equal(await owner.get('users/' + uid), null);
  assert.equal(o.uid !== uid, true);
});

test('a missing record reads as empty, not as an error', async () => {
  const a = app(); const s = await a.signInGoogle(google('student-3', 'x3@example.com'));
  assert.equal(await a.get('premium/' + s.uid), null);
});
