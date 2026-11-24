/* Uploads the Premium content to the database by itself, so the owner never has to upload a file.
   Runs in GitHub Actions (.github/workflows/premium.yml) with one secret: FIREBASE_SERVICE_ACCOUNT
   (the Firebase Admin key file, pasted whole). Without the secret it does nothing.

   node tools/pack-upload.mjs key     writes premium/pack-key.pem: the PUBLIC half of that key. It is safe to publish;
                                      new Premium files are locked with it before they are put in this repository.
   node tools/pack-upload.mjs upload  unlocks each premium/pack-*.enc with the PRIVATE half (only GitHub has it),
                                      checks it, and writes prem/{id}-{i} like the Owner screen does, if not there yet.
   The Premium content itself is never stored in this repository unlocked. */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import crypto from 'node:crypto';
const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
if (!raw.trim()) { console.log('::notice::FIREBASE_SERVICE_ACCOUNT is not set, so Premium content is not uploaded automatically. Upload it on the Owner screen instead.'); process.exit(0); }
let sa; try { sa = JSON.parse(raw); } catch (e) { console.log('::error::FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file again.'); process.exit(1); }
if (!sa.private_key || !sa.client_email || !sa.project_id) { console.log('::error::FIREBASE_SERVICE_ACCOUNT is missing private_key, client_email or project_id.'); process.exit(1); }
const priv = crypto.createPrivateKey(String(sa.private_key).replace(/\\n/g, '\n'));
const DIR = process.env.PACK_DIR || 'premium';
const TOKEN_URL = process.env.TOKEN_URL || 'https://oauth2.googleapis.com/token';
const FS = (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1') + `/projects/${sa.project_id}/databases/(default)/documents`;
const mode = process.argv[2];
if (mode === 'key') {
  const pem = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' });
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const f = `${DIR}/pack-key.pem`, old = existsSync(f) ? readFileSync(f, 'utf8') : '';
  if (old !== pem) { writeFileSync(f, pem); console.log('CHANGED: wrote', f); } else console.log('unchanged', f);
  process.exit(0);
}
if (mode !== 'upload') { console.log('usage: node tools/pack-upload.mjs key|upload'); process.exit(2); }
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: TOKEN_URL, iat: now, exp: now + 3000 }));
  const sig = b64u(crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), priv));
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + body + '.' + sig }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google did not accept the service account key (' + r.status + ')');
  return j.access_token;
}
function unlock(box) {
  const key = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(box.k, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
}
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => /^pack-[0-9a-f]{16}\.enc$/.test(f)).sort() : [];
if (!files.length) { console.log('No locked Premium files yet.'); process.exit(0); }
const tok = await token(), H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
let made = 0, had = 0;
for (const f of files) {
  const box = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  let P; try { P = unlock(box); } catch (e) { console.log(`::warning::${f} is locked with a different key; skipped.`); continue; }
  const { id, n, h } = P.meta || {};
  if (`pack-${id}.enc` !== f || !Array.isArray(P.parts) || P.parts.length !== n) throw new Error(f + ': contents do not match its name');
  if (crypto.createHash('sha256').update(P.parts.join('')).digest('hex') !== h) throw new Error(f + ': checksum does not match');
  for (let i = 1; i <= n; i++) {
    const g = await fetch(`${FS}/prem/${id}-${i}`, { headers: H });
    if (g.ok) { had++; continue; }
    if (g.status !== 404) throw new Error(`reading prem/${id}-${i} failed (${g.status})`);
    const fields = { d: { stringValue: P.parts[i - 1] }, i: { integerValue: String(i) }, n: { integerValue: String(n) }, h: { stringValue: h }, at: { timestampValue: new Date().toISOString() } };
    const c = await fetch(`${FS}/prem?documentId=${id}-${i}`, { method: 'POST', headers: H, body: JSON.stringify({ fields }) });
    if (!c.ok && c.status !== 409) throw new Error(`writing prem/${id}-${i} failed (${c.status}): ${(await c.text()).slice(0, 200)}`);
    made++; console.log(`uploaded prem/${id}-${i}`);
  }
}
console.log(`Premium content: ${made} uploaded, ${had} already there.`);
