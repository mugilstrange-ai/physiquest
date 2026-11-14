/* Loads the Worker for tests. The Worker file itself exports only its default handler (Cloudflare treats
   other exports as entrypoints), so the parts the tests need are exported here from a copy of its source. */
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../physiquest-pay.js', import.meta.url), 'utf8') +
  '\nexport { PLANS, DAY0, today, newEnd, settings, hmacHex, verifyIdToken, getDoc, activate, dayDate, page as resultPage, HttpErr };\n';
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
export default mod.default;
export const { PLANS, DAY0, today, newEnd, settings, hmacHex, verifyIdToken, getDoc, activate, dayDate, resultPage, HttpErr } = mod;
