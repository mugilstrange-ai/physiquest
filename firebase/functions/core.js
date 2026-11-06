'use strict';
/* PhysiQuest server logic.
   Kept apart from the Firebase wiring (index.js) so every rule here can be tested.

   The golden rule: the phone is never trusted. Prices live here, every payment is
   checked with Razorpay itself, and Premium is only ever granted by this code. */
const crypto = require('crypto');

const PLANS = {
  M: { label: 'Premium · monthly', amount: 19900, days: 31 },   // amounts in paise
  Y: { label: 'Premium · yearly', amount: 199900, days: 366 }
};
/* the app counts days the same way: day 0 is 1 Jan 2026 (UTC) */
const DAY0 = Date.UTC(2026, 0, 1) / 864e5;
const dayOf = ms => Math.floor(ms / 864e5) - DAY0;

const CLASSES = ['6', '7', '8', '9', '10', '11', '12', 'dropper', 'college', 'other'];
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const MAX_ORDERS_PER_DAY = 15;
const MAX_PROGRESS = 200000;

/* an error the student may see; code is a Firebase HttpsError code */
class Bad extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/* ---------- signatures (constant-time comparison) ---------- */
function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !/^[0-9a-f]+$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
/* Razorpay signs order_id|payment_id with the key secret after a successful payment */
function paymentSignatureOk(orderId, paymentId, signature, secret) {
  if (!secret) return false;
  const want = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
  return sameHex(want, String(signature || ''));
}
/* Razorpay signs the raw webhook body with the webhook secret */
function webhookSignatureOk(rawBody, signature, secret) {
  if (!secret || !rawBody) return false;
  const want = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return sameHex(want, String(signature || ''));
}

/* ---------- input checks ---------- */
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,59}$/u;
const ORDER_RE = /^order_[A-Za-z0-9]{6,40}$/;
const PAY_RE = /^pay_[A-Za-z0-9]{6,40}$/;
function normalizePhone(x) {
  const d = String(x || '').replace(/[\s()-]/g, '');
  const m = d.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return m ? '+91' + m[1] : null;
}
function validateProfile(input, token) {
  const p = input && typeof input === 'object' ? input : {};
  const name = clean(p.name), city = clean(p.city), state = clean(p.state), cls = clean(p.cls);
  if (!NAME_RE.test(name)) throw new Bad('invalid-argument', 'Please enter your name, using letters only.');
  if (!CLASSES.includes(cls)) throw new Bad('invalid-argument', 'Please choose your class.');
  if (!NAME_RE.test(city) || city.length > 50) throw new Bad('invalid-argument', 'Please enter your city or town.');
  if (!STATES.includes(state)) throw new Bad('invalid-argument', 'Please choose your state or union territory.');
  if (typeof p.adult !== 'boolean') throw new Bad('invalid-argument', 'Please say whether you are 18 or older.');
  let phone = token.phone_number || null, phoneVerified = !!token.phone_number;
  if (!phone && p.phone) {
    phone = normalizePhone(p.phone);
    if (!phone) throw new Bad('invalid-argument', 'Please enter a 10-digit Indian mobile number, or leave it empty.');
  }
  return { name, cls, city, state, adult: p.adult, phone, phoneVerified, email: token.email || null };
}

/* ---------- account ---------- */
const refs = (db, uid) => ({
  user: db.collection('users').doc(uid),
  sub: db.collection('subs').doc(uid),
  progress: db.collection('progress').doc(uid),
  limit: db.collection('limits').doc(uid)
});
function publicSub(s) { return s && !s.deleted ? { plan: s.plan, exp: s.exp } : null; }

async function getAccount({ db, now }, uid) {
  const r = refs(db, uid);
  const [u, s, p] = await Promise.all([r.user.get(), r.sub.get(), r.progress.get()]);
  const profile = u.exists ? u.data() : null;
  return {
    profile: profile && { name: profile.name, cls: profile.cls, city: profile.city, state: profile.state, adult: profile.adult,
      phone: profile.phone || null, email: profile.email || null, parentOk: !!profile.parent },
    needsParent: !!profile && !profile.adult && !profile.parent,
    sub: s.exists ? publicSub(s.data()) : null,
    progress: p.exists ? p.data().code : null,
    today: dayOf(now())
  };
}

async function saveProfile(deps, uid, token, data) {
  const prof = validateProfile(data, token);
  const ref = refs(deps.db, uid).user;
  await deps.db.runTransaction(async t => {
    const cur = await t.get(ref);
    const old = cur.exists ? cur.data() : null;
    /* a parent's consent stays only while the student is still marked under 18 */
    t.set(ref, Object.assign({}, prof, {
      parent: old && old.parent && !prof.adult ? old.parent : null,
      createdAt: old ? old.createdAt : deps.now(), updatedAt: deps.now()
    }));
  });
  return getAccount(deps, uid);
}

async function saveProgress({ db, now }, uid, data) {
  const code = data && data.code;
  if (typeof code !== 'string' || !/^PQ1-[A-Za-z0-9_-]+$/.test(code) || code.length > MAX_PROGRESS)
    throw new Bad('invalid-argument', 'That progress could not be saved.');
  await refs(db, uid).progress.set({ code, at: now() });
  return { ok: true };
}

/* parentClaims: the verified sign-in of the parent's phone number (checked in index.js) */
async function parentConsent(deps, uid, token, parentClaims) {
  const c = parentClaims || {};
  const phone = c.phone_number;
  const fresh = typeof c.auth_time === 'number' && c.auth_time * 1000 > deps.now() - 15 * 60 * 1000;
  if (!phone || !(c.firebase && c.firebase.sign_in_provider === 'phone') || !fresh)
    throw new Bad('invalid-argument', 'Please verify the parent’s mobile number with the OTP again.');
  if (c.uid === uid) throw new Bad('invalid-argument', 'The parent must use a different mobile number from the student.');
  const ref = refs(deps.db, uid).user;
  await deps.db.runTransaction(async t => {
    const cur = await t.get(ref);
    if (!cur.exists) throw new Bad('failed-precondition', 'Please fill in your details first.');
    const p = cur.data();
    if (p.adult) throw new Bad('failed-precondition', 'Parent consent is only needed for students under 18.');
    if (phone === p.phone || phone === token.phone_number)
      throw new Bad('invalid-argument', 'The parent must use a different mobile number from the student.');
    t.update(ref, { parent: { phone, at: deps.now(), method: 'otp' }, updatedAt: deps.now() });
  });
  return getAccount(deps, uid);
}

async function deleteAccount({ db, now }, uid) {
  const r = refs(db, uid);
  /* payment records are kept (they are needed for refunds and accounts), but no longer linked to a profile */
  await Promise.all([r.user.delete(), r.progress.delete(), r.limit.delete(),
    r.sub.set({ deleted: true, deletedAt: now() }, { merge: true })]);
  return { ok: true };
}

/* ---------- payments ---------- */
async function createOrder(deps, uid, token, data) {
  const plan = data && data.plan;
  const P = PLANS[plan];
  if (!P) throw new Bad('invalid-argument', 'Please choose the monthly or the yearly plan.');
  const r = refs(deps.db, uid);
  const u = await r.user.get();
  if (!u.exists) throw new Bad('failed-precondition', 'Please fill in your details before paying.');
  const prof = u.data();
  if (!prof.adult && !prof.parent) throw new Bad('failed-precondition', 'A parent needs to give consent before a student under 18 can pay.');
  const today = dayOf(deps.now());
  await deps.db.runTransaction(async t => {
    const l = await t.get(r.limit);
    const cur = l.exists && l.data().day === today ? l.data().n : 0;
    if (cur >= MAX_ORDERS_PER_DAY) throw new Bad('resource-exhausted', 'Too many payment attempts today. Please try again tomorrow.');
    t.set(r.limit, { day: today, n: cur + 1 });
  });
  const order = await deps.rzp.createOrder({
    amount: P.amount, currency: 'INR',
    receipt: ('pq_' + uid.slice(0, 12) + '_' + deps.now().toString(36)).slice(0, 40),
    notes: { uid, plan, app: 'PhysiQuest' }
  });
  if (!order || !ORDER_RE.test(order.id) || order.amount !== P.amount) throw new Error('Unexpected order from Razorpay');
  await deps.db.collection('orders').doc(order.id).set({ uid, plan, amount: P.amount, status: 'created', createdAt: deps.now() });
  return {
    orderId: order.id, amount: P.amount, currency: 'INR', plan, label: P.label, keyId: deps.rzp.keyId,
    name: prof.name, email: prof.email || token.email || '', contact: prof.phone || token.phone_number || ''
  };
}

/* the one place Premium is given; safe to call twice for the same payment */
async function grant({ db, now }, uid, plan, paymentId, orderId, amount, via) {
  const P = PLANS[plan];
  const r = refs(db, uid);
  const payRef = db.collection('payments').doc(paymentId), orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async t => {
    const [p, s] = await Promise.all([t.get(payRef), t.get(r.sub)]);
    if (p.exists) return publicSub(s.exists ? s.data() : null);
    const today = dayOf(now());
    const cur = s.exists && !s.data().deleted ? s.data() : null;
    const start = Math.max(today, cur ? cur.exp + 1 : today);
    const exp = start + P.days - 1;
    const sub = { plan, exp, updatedAt: now() };
    t.set(r.sub, sub);
    t.set(payRef, { uid, orderId, plan, amount, start, exp, via, at: now() });
    t.set(orderRef, { status: 'paid', paymentId, paidAt: now() }, { merge: true });
    return publicSub(sub);
  });
}

/* make sure Razorpay really has this money, for this order, in full */
async function checkedPayment(rzp, paymentId, order, orderId) {
  let pay = await rzp.fetchPayment(paymentId);
  if (!pay || pay.order_id !== orderId || pay.amount !== order.amount || pay.currency !== 'INR')
    throw new Bad('failed-precondition', 'This payment does not match your order. Please contact support.');
  if (pay.status === 'authorized') pay = await rzp.capture(paymentId, order.amount, 'INR');
  if (!pay || pay.status !== 'captured') throw new Bad('failed-precondition', 'The payment has not completed yet.');
  return pay;
}

async function confirmPayment(deps, uid, data, keySecret) {
  const { orderId, paymentId, signature } = data || {};
  if (!ORDER_RE.test(orderId || '') || !PAY_RE.test(paymentId || '')) throw new Bad('invalid-argument', 'Payment details are missing.');
  const o = await deps.db.collection('orders').doc(orderId).get();
  if (!o.exists || o.data().uid !== uid) throw new Bad('permission-denied', 'This order does not belong to your account.');
  if (!paymentSignatureOk(orderId, paymentId, signature, keySecret))
    throw new Bad('permission-denied', 'The payment could not be verified.');
  const order = o.data();
  await checkedPayment(deps.rzp, paymentId, order, orderId);
  const sub = await grant(deps, uid, order.plan, paymentId, orderId, order.amount, 'app');
  return { sub, today: dayOf(deps.now()) };
}

/* Razorpay calls this directly, so Premium arrives even if the app closed during payment */
async function handleWebhook(deps, rawBody, signature, secret) {
  if (!webhookSignatureOk(rawBody, signature, secret)) throw new Bad('permission-denied', 'bad signature');
  let ev;
  try { ev = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody); } catch (e) { return { ignored: 'not json' }; }
  if (ev.event !== 'payment.captured' && ev.event !== 'order.paid') return { ignored: ev.event || 'unknown' };
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
  if (!pay || !PAY_RE.test(pay.id || '') || !ORDER_RE.test(pay.order_id || '')) return { ignored: 'no payment' };
  const o = await deps.db.collection('orders').doc(pay.order_id).get();
  if (!o.exists) return { ignored: 'unknown order' };
  const order = o.data();
  await checkedPayment(deps.rzp, pay.id, order, pay.order_id);
  const sub = await grant(deps, order.uid, order.plan, pay.id, pay.order_id, order.amount, 'webhook');
  return { granted: true, exp: sub && sub.exp };
}

module.exports = {
  PLANS, CLASSES, STATES, DAY0, dayOf, Bad,
  paymentSignatureOk, webhookSignatureOk, normalizePhone, validateProfile,
  getAccount, saveProfile, saveProgress, parentConsent, deleteAccount,
  createOrder, confirmPayment, handleWebhook, grant
};
