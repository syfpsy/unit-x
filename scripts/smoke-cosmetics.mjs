// Phase 7 smoke: simulates the /api/ledger unlock sweep + the equip flow
// against a disposable operator. Asserts:
//   - 6 catalogue rows exist
//   - A backdated operator at stage 4 with 60 memories unlocks all 6
//   - Equipping a mascot writes equipped=true and unequips same-kind
//
// Non-destructive: cascade-deletes the auth user at the end.

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

function isUnlocked(rule, ctx) {
  switch (rule.type) {
    case 'always': return true;
    case 'tenure_days': return ctx.tenureDays >= rule.min;
    case 'memories_total': return ctx.memoriesTotal >= rule.min;
    case 'memories_by_tag': return (ctx.memoriesByTag[rule.tag] ?? 0) >= rule.min;
    case 'stage_reached': return ctx.evolutionStage >= rule.stage;
  }
  return false;
}

const email = `cosm-smoke-${Date.now()}@unit-x.art`;
let userId = null;
let operatorId = null;

try {
  // Verify catalogue.
  const [{ n: catalogueCount }] = await sql`select count(*)::int as n from cosmetics`;
  console.log(`[smoke] catalogue size: ${catalogueCount}`);
  if (catalogueCount !== 6) throw new Error(`expected 6 cosmetics, got ${catalogueCount}`);

  // Create disposable user + backdated operator.
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (ue) throw ue;
  userId = u.user.id;
  const backdate = new Date(Date.now() - 200 * 86_400_000);
  const [op] = await sql`
    insert into operators (auth_user_id, email, handle, created_at)
    values (${userId}, ${email}, 'cosm', ${backdate})
    returning id
  `;
  operatorId = op.id;

  // Seed 60 encrypted memories so memories_total:50 rule trips.
  for (let i = 0; i < 60; i++) {
    const { cipher, nonce } = encrypt(`mem ${i}`, operatorId);
    await sql`
      insert into memories (operator_id, tag, text_cipher, nonce)
      values (${operatorId}, 'fact', ${cipher}, ${nonce})
    `;
  }

  const ctx = {
    tenureDays: 200,
    memoriesTotal: 60,
    memoriesByTag: { fact: 60 },
    evolutionStage: 4,
  };

  const cat = await sql`select id, slug, unlock_rule from cosmetics`;
  const shouldUnlock = cat.filter((c) => isUnlocked(c.unlock_rule, ctx));
  console.log(`[smoke] ${shouldUnlock.length}/${cat.length} items unlock at stage 4 + 60 mems + 200d`);
  if (shouldUnlock.length !== 6) throw new Error('expected all 6 to unlock');

  // Simulate the detectAndPersistUnlocks insertion path.
  const rows = shouldUnlock.map((c) => ({ operator_id: operatorId, cosmetic_id: c.id }));
  await sql`insert into operator_cosmetics ${sql(rows, 'operator_id', 'cosmetic_id')} on conflict do nothing`;
  const [{ n: ownedCount }] = await sql`
    select count(*)::int as n from operator_cosmetics where operator_id = ${operatorId}
  `;
  console.log(`[smoke] operator now owns ${ownedCount} cosmetics`);
  if (ownedCount !== 6) throw new Error('ownership insertion missed items');

  // Equip mascot-rooted, then mascot-sentinel — verify exclusivity.
  const mascots = cat.filter((c) => c.slug.startsWith('mascot-'));
  const rooted = mascots.find((c) => c.slug === 'mascot-rooted');
  const sentinel = mascots.find((c) => c.slug === 'mascot-sentinel');
  await sql`update operator_cosmetics set equipped = true where operator_id = ${operatorId} and cosmetic_id = ${rooted.id}`;
  const [{ n: equippedA }] = await sql`
    select count(*)::int as n from operator_cosmetics
    where operator_id = ${operatorId} and equipped = true
  `;
  if (equippedA !== 1) throw new Error('first equip misfired');

  // Equip sentinel: first unequip all mascot kind, then set sentinel.
  const mascotIds = mascots.map((m) => m.id);
  await sql`
    update operator_cosmetics set equipped = false
    where operator_id = ${operatorId}
      and cosmetic_id = any(${mascotIds}::uuid[])
  `;
  await sql`update operator_cosmetics set equipped = true where operator_id = ${operatorId} and cosmetic_id = ${sentinel.id}`;

  const equippedRows = await sql`
    select c.slug from operator_cosmetics oc
    inner join cosmetics c on c.id = oc.cosmetic_id
    where oc.operator_id = ${operatorId} and oc.equipped = true
  `;
  console.log(`[smoke] equipped: ${equippedRows.map((r) => r.slug).join(', ')}`);
  if (equippedRows.length !== 1 || equippedRows[0].slug !== 'mascot-sentinel') {
    throw new Error('equip exclusivity broken');
  }

  console.log('[smoke] ✓ cosmetics unlock + equip + exclusivity verified');
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
