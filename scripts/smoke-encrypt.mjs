// Phase 5 smoke test: end-to-end encrypt → write → read → decrypt → cleanup
// against the real Supabase. Creates a disposable auth.users row via the
// admin API, inserts an encrypted memory, reads it back through the same
// path `/api/ledger` would use, then deletes the user (cascades).
//
// Safe to run any time; leaves no residue.

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;
const master = Buffer.from(process.env.UNITX_MASTER_KEY, 'base64');
if (!url || !svc || !dbUrl || master.length !== 32) {
  console.error('missing env for smoke test');
  process.exit(1);
}

const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(dbUrl, { prepare: false, max: 1 });

function deriveDek(operatorId) {
  const salt = Buffer.from(operatorId.replace(/-/g, ''), 'hex');
  return Buffer.from(hkdfSync('sha256', master, salt, Buffer.from('unitx-dek-v1'), 32));
}
function encrypt(plaintext, operatorId) {
  const dek = deriveDek(operatorId);
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', dek, nonce);
  const body = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return { cipher: Buffer.concat([body, c.getAuthTag()]), nonce };
}
function decrypt(ciphertext, nonce, operatorId) {
  const dek = deriveDek(operatorId);
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const body = ciphertext.subarray(0, ciphertext.length - 16);
  const d = createDecipheriv('aes-256-gcm', dek, nonce);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}

const email = `smoke-${Date.now()}@unit-x.art`;
let userId = null;
let operatorId = null;

try {
  // 1. Create disposable auth user
  const { data: createdUser, error: ce } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (ce) throw ce;
  userId = createdUser.user.id;
  console.log('[smoke] created auth.user', userId);

  // 2. Create operator row (same logic as lib/auth/getOperator)
  const handle = email.split('@')[0];
  const [op] = await sql`
    insert into operators (auth_user_id, email, handle)
    values (${userId}, ${email}, ${handle})
    returning id
  `;
  operatorId = op.id;
  console.log('[smoke] created operators row', operatorId);

  // 3. Encrypt + insert a memory
  const plaintext = 'Phase 5 smoke-test memory · encrypt round-trip';
  const { cipher, nonce } = encrypt(plaintext, operatorId);
  const [inserted] = await sql`
    insert into memories (operator_id, tag, text_cipher, nonce)
    values (${operatorId}, 'fact', ${cipher}, ${nonce})
    returning id
  `;
  console.log('[smoke] inserted encrypted memory', inserted.id);

  // 4. Read back ciphertext directly — prove the DB sees no plaintext
  const [raw] = await sql`
    select text_cipher, nonce from memories where id = ${inserted.id}
  `;
  const rawHex = raw.text_cipher.slice(0, 16).toString('hex');
  console.log('[smoke] ciphertext head:', rawHex, `(${raw.text_cipher.length} bytes)`);
  if (raw.text_cipher.toString('utf8').includes('smoke')) {
    throw new Error('PLAINTEXT VISIBLE IN CIPHERTEXT — encryption broken');
  }

  // 5. Decrypt via the derivation path
  const decrypted = decrypt(raw.text_cipher, raw.nonce, operatorId);
  console.log('[smoke] decrypted:', decrypted);
  if (decrypted !== plaintext) throw new Error('round-trip mismatch');

  console.log('[smoke] ✓ encryption at rest verified');
} catch (err) {
  console.error('[smoke] FAIL:', err.message || err);
  process.exitCode = 1;
} finally {
  if (userId) {
    const { error: de } = await admin.auth.admin.deleteUser(userId);
    if (de) console.warn('[smoke] cleanup warning:', de.message);
    else console.log('[smoke] cleanup: deleted auth.user (cascaded to operator + memory)');
  }
  await sql.end({ timeout: 5 });
}
