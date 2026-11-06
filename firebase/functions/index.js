'use strict';
/* PhysiQuest server functions (Firebase Cloud Functions, Mumbai region).
   The app calls these; it can never write to the database itself (see firestore.rules). */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const core = require('./core');
const { makeRazorpay } = require('./razorpay');

admin.initializeApp();
/* Mumbai is closest to Indian students. Many students can be served at once:
   each instance handles many requests, and up to 50 instances start when needed. */
setGlobalOptions({ region: 'asia-south1', maxInstances: 50, memory: '256MiB' });

const KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const HOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

const deps = withRzp => ({
  db: admin.firestore(),
  now: () => Date.now(),
  rzp: withRzp ? makeRazorpay({ keyId: KEY_ID.value(), keySecret: KEY_SECRET.value() }) : null
});

/* every app request: must be signed in; known problems become friendly messages */
function call(fn, opts) {
  return onCall(Object.assign({ cors: true }, opts || {}), async req => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
    try {
      return await fn(req, req.auth.uid, req.auth.token);
    } catch (e) {
      if (e instanceof core.Bad) throw new HttpsError(e.code, e.message);
      if (e instanceof HttpsError) throw e;
      console.error('PhysiQuest error', e);
      throw new HttpsError('internal', 'Something went wrong on our side. Please try again in a minute.');
    }
  });
}
const RZP = { secrets: [KEY_ID, KEY_SECRET] };

exports.getAccount = call((req, uid) => core.getAccount(deps(), uid));
exports.saveProfile = call((req, uid, token) => core.saveProfile(deps(), uid, token, req.data));
exports.saveProgress = call((req, uid) => core.saveProgress(deps(), uid, req.data));
exports.parentConsent = call(async (req, uid, token) => {
  let claims;
  try {
    claims = await admin.auth().verifyIdToken(String((req.data && req.data.parentToken) || ''));
  } catch (e) {
    throw new core.Bad('invalid-argument', 'The parent’s OTP could not be checked. Please try again.');
  }
  return core.parentConsent(deps(), uid, token, claims);
});
exports.deleteAccount = call(async (req, uid) => {
  await core.deleteAccount(deps(), uid);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});
exports.createOrder = call((req, uid, token) => core.createOrder(deps(true), uid, token, req.data), RZP);
exports.confirmPayment = call((req, uid) => core.confirmPayment(deps(true), uid, req.data, KEY_SECRET.value()), RZP);

/* Razorpay → server, signed with the webhook secret */
exports.razorpayWebhook = onRequest({ secrets: [KEY_ID, KEY_SECRET, HOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  try {
    const out = await core.handleWebhook(deps(true), req.rawBody, req.get('x-razorpay-signature'), HOOK_SECRET.value());
    res.status(200).json(out);
  } catch (e) {
    if (e instanceof core.Bad && e.code === 'permission-denied') { res.status(400).send('bad signature'); return; }
    console.error('webhook error', e);
    res.status(500).send('error');   // Razorpay retries later
  }
});
