// Re-encrypts every row in messages and memories from UNITX_MASTER_KEY_PREV
// to UNITX_MASTER_KEY. Run this after flipping keys on Vercel and before
// dropping the previous key from the env. Idempotent: rows already encrypted
// under the current key decrypt successfully on the first attempt and skip.
//
// Usage:
//   1. Generate a new key:   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//   2. vercel env add UNITX_MASTER_KEY_PREV production    # paste the CURRENT key
//   3. vercel env rm UNITX_MASTER_KEY production --yes
//      vercel env add UNITX_MASTER_KEY production         # paste the NEW key
//   4. vercel deploy --prod --yes --force                 # new code picks up both
//   5. vercel env pull .env.local
//   6. node scripts/rotate-keys.mjs                       # this file
//   7. vercel env rm UNITX_MASTER_KEY_PREV production --yes
//      vercel deploy --prod --yes --force

import { config as loadEnv } from 'dotenv';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const ALGO = 'aes-256-gcm';
const INFO = Buffer.from('unitx-dek-v1', 'utf8');
const DEK_LENGTH = 32;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function decodeMaster(b64) {
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error(`master key must decode to 32 bytes, got ${key.length}`);
  return key;
}

const current = decodeMaster(process.env.UNITX_MASTER_KEY ?? '');
const prev = process.env.UNITX_MASTER_KEY_PREV
  ? decodeMaster(process.env.UNITX_MASTER_KEY_PREV)
  : null;

if (!prev) {
  console.error('UNITX_MASTER_KEY_PREV is not set. Nothing to rotate from.');
  process.exit(1);
}

function salt(operatorId) {
  return Buffer.from(operatorId.replace(/-/g, ''), 'hex');
}
function deriveDek(master, operatorId) {
  return Buffer.from(hkdfSync('sha256', master, salt(operatorId), INFO, DEK_LENGTH));
}
function tryDecrypt(master, operatorId, cipher, nonce) {
  const authTag = cipher.subarray(cipher.length - AUTH_TAG_LENGTH);
  const body = cipher.subarray(0, cipher.length - AUTH_TAG_LENGTH);
  const dek = deriveDek(master, operatorId);
  const decipher = createDecipheriv(ALGO, dek, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
function encryptUnder(master, operatorId, plaintext) {
  const dek = deriveDek(master, operatorId);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGO, dek, nonce);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { cipher: Buffer.concat([body, authTag]), nonce };
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
let rewrapped = 0;
let alreadyCurrent = 0;
let failed = 0;

try {
  for (const tbl of ['messages', 'memories']) {
    const rows = await sql`
      select id, operator_id, text_cipher, nonce from ${sql(tbl)}
    `;
    console.log(`[rotate] ${tbl}: ${rows.length} rows`);
    for (const row of rows) {
      let plaintext = null;
      // Try current key first; if it works the row is already rotated.
      try {
        plaintext = tryDecrypt(current, row.operator_id, row.text_cipher, row.nonce);
        alreadyCurrent++;
        continue;
      } catch {
        // Fall through to prev.
      }
      try {
        plaintext = tryDecrypt(prev, row.operator_id, row.text_cipher, row.nonce);
      } catch {
        failed++;
        console.warn(`  ! ${tbl}.${row.id}: decryption failed under both keys; skipped`);
        continue;
      }
      const { cipher, nonce } = encryptUnder(current, row.operator_id, plaintext);
      await sql`
        update ${sql(tbl)}
        set text_cipher = ${cipher}, nonce = ${nonce}
        where id = ${row.id}
      `;
      rewrapped++;
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(`[rotate] done. rewrapped=${rewrapped} already-current=${alreadyCurrent} failed=${failed}`);
