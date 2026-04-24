// Phase 12 — one-shot embedding backfill for memories that existed
// before pgvector was turned on (or whose write-time embedding failed).
//
// Scope: ALL memories with embedding IS NULL and deleted_at IS NULL.
// Respects encryption — decrypts under the operator's DEK, embeds the
// plaintext, writes the vector + model slug. Processes in small
// batches with a short pause between batches so we don't trip the
// OpenAI rate limit on a large operator.
//
// Idempotent: re-running picks up where the last run stopped (rows
// already embedded no longer appear in the `WHERE` clause).

import { config as loadEnv } from 'dotenv';
import { createDecipheriv, hkdfSync } from 'node:crypto';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;
const openaiKey = process.env.OPENAI_API_KEY;
const master = process.env.UNITX_MASTER_KEY
  ? Buffer.from(process.env.UNITX_MASTER_KEY, 'base64')
  : null;

if (!dbUrl || !openaiKey || !master) {
  console.error('[backfill] missing env — need DATABASE_URL, OPENAI_API_KEY, UNITX_MASTER_KEY');
  process.exit(1);
}

const BATCH = 32;
const MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const DIM = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);
const MODEL_SLUG = `openai/${MODEL}@${DIM}`;
const SLEEP_MS = 300;

function salt(operatorId) {
  return Buffer.from(operatorId.replace(/-/g, ''), 'hex');
}
function deriveDek(operatorId) {
  return Buffer.from(
    hkdfSync('sha256', master, salt(operatorId), Buffer.from('unitx-dek-v1'), 32),
  );
}
function decrypt(ct, nonce, operatorId) {
  const tag = ct.subarray(ct.length - 16);
  const body = ct.subarray(0, ct.length - 16);
  const dec = createDecipheriv('aes-256-gcm', deriveDek(operatorId), nonce);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(body), dec.final()]).toString('utf8');
}

async function embed(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      dimensions: DIM,
      encoding_format: 'float',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`openai ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((r) => r.embedding);
}

function vectorLiteral(v) {
  return `[${v.join(',')}]`;
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });

let total = 0;
let ok = 0;
let failed = 0;

try {
  while (true) {
    const rows = await sql`
      select id, operator_id, text_cipher, nonce
      from memories
      where embedding is null
        and deleted_at is null
      order by created_at
      limit ${BATCH}
    `;
    if (rows.length === 0) break;

    const plains = [];
    const ids = [];
    const ops = [];
    for (const r of rows) {
      try {
        const text = decrypt(r.text_cipher, r.nonce, r.operator_id);
        plains.push(text);
        ids.push(r.id);
        ops.push(r.operator_id);
      } catch (err) {
        failed++;
        console.warn(`[backfill] decrypt failed for ${r.id}: ${err.message}`);
      }
    }
    if (plains.length === 0) {
      total += rows.length;
      continue;
    }

    let vecs;
    try {
      vecs = await embed(plains);
    } catch (err) {
      console.error('[backfill] embed batch failed:', err.message);
      failed += plains.length;
      total += rows.length;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    for (let i = 0; i < ids.length; i++) {
      await sql`
        update memories
        set embedding = ${vectorLiteral(vecs[i])}::vector,
            embedding_model = ${MODEL_SLUG}
        where id = ${ids[i]}
      `;
      ok++;
    }
    total += rows.length;
    console.log(`[backfill] ${total} seen · ${ok} embedded · ${failed} failed`);
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  console.log(`[backfill] done · total=${total} ok=${ok} failed=${failed}`);
} finally {
  await sql.end({ timeout: 5 });
}
