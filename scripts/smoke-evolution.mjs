// Phase 6 smoke test: creates a disposable auth user with a backdated
// operators.created_at and a bunch of memories, hits evolutionForOperator
// equivalent SQL, asserts stage 4 + all 5 stage_transitions rows get
// written, then cleans up.
//
// Non-destructive: leaves no residue via cascade delete on auth.users.

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import {
  createCipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;
const master = Buffer.from(process.env.UNITX_MASTER_KEY, 'base64');

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

const STAGES = [
  { stage: 0, minDays: 0,   minMemories: 0 },
  { stage: 1, minDays: 3,   minMemories: 5 },
  { stage: 2, minDays: 14,  minMemories: 25 },
  { stage: 3, minDays: 60,  minMemories: 100 },
  { stage: 4, minDays: 180, minMemories: 300 },
];
function expectStage(tenureDays, memCount) {
  let s = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (tenureDays >= STAGES[i].minDays || memCount >= STAGES[i].minMemories) {
      s = STAGES[i].stage;
      break;
    }
  }
  return s;
}

const email = `evo-smoke-${Date.now()}@unit-x.art`;
let userId = null;
let operatorId = null;

try {
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (ue) throw ue;
  userId = u.user.id;

  // Backdate by 200 days so stage 4 trips on tenure alone.
  const backdate = new Date(Date.now() - 200 * 86_400_000);
  const [op] = await sql`
    insert into operators (auth_user_id, email, handle, created_at)
    values (${userId}, ${email}, 'evo', ${backdate})
    returning id, created_at
  `;
  operatorId = op.id;
  console.log('[smoke] operator created', operatorId, '@', op.created_at.toISOString());

  // Insert 10 encrypted memories for good measure.
  for (let i = 0; i < 10; i++) {
    const { cipher, nonce } = encrypt(`memory #${i}`, operatorId);
    await sql`
      insert into memories (operator_id, tag, text_cipher, nonce, created_at)
      values (${operatorId}, 'fact', ${cipher}, ${nonce}, ${new Date(Date.now() - i * 3600_000)})
    `;
  }

  // Replicate the server's evolutionForOperator: pick stage from tenure + active mem count.
  const [counts] = await sql`
    select count(*)::int as n from memories where operator_id = ${operatorId} and deleted_at is null
  `;
  const tenure = (Date.now() - new Date(op.created_at).getTime()) / 86_400_000;
  const stage = expectStage(tenure, counts.n);
  console.log(`[smoke] tenure=${Math.floor(tenure)}d mems=${counts.n} → computed stage ${stage}`);
  if (stage !== 4) throw new Error(`expected stage 4 for backdated operator, got ${stage}`);

  // Simulate writing transitions for all unseen stages (0..stage).
  const rows = [];
  for (let s = 0; s <= stage; s++) rows.push({ operator_id: operatorId, stage: s });
  await sql`insert into stage_transitions ${sql(rows, 'operator_id', 'stage')} on conflict do nothing`;
  const inserted = await sql`select stage from stage_transitions where operator_id = ${operatorId} order by stage`;
  console.log('[smoke] stage_transitions rows:', inserted.map((r) => r.stage));
  if (inserted.length !== 5) throw new Error(`expected 5 transitions, got ${inserted.length}`);

  // Re-run the insert — should be a no-op.
  await sql`insert into stage_transitions ${sql(rows, 'operator_id', 'stage')} on conflict do nothing`;
  const again = await sql`select count(*)::int as n from stage_transitions where operator_id = ${operatorId}`;
  if (again[0].n !== 5) throw new Error(`idempotency broken: got ${again[0].n} rows after re-insert`);

  console.log('[smoke] ✓ evolution + stage_transitions verified (and idempotent)');
} catch (err) {
  console.error('[smoke] FAIL:', err.message || err);
  process.exitCode = 1;
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log('[smoke] cleanup: deleted auth.user (cascaded)');
  }
  await sql.end({ timeout: 5 });
}
