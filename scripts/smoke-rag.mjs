// Phase 12 smoke — write a handful of encrypted + embedded memories
// for a disposable operator, run a semantic query against them, and
// assert the expected nearest-neighbour ranking. Non-destructive:
// cascade-deletes everything at the end.
//
// Requires OPENAI_API_KEY in the env so the embeddings are real.

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;
const master = Buffer.from(process.env.UNITX_MASTER_KEY, 'base64');
const openaiKey = process.env.OPENAI_API_KEY;

if (!openaiKey) {
  console.error('[smoke-rag] OPENAI_API_KEY not set — RAG is off. Run `vercel env add OPENAI_API_KEY` and `vercel env pull .env.local`.');
  process.exit(1);
}

const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(dbUrl, { prepare: false, max: 1 });

const MODEL = 'text-embedding-3-small';
const DIM = 1536;

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
async function embed(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIM, encoding_format: 'float' }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = await res.json();
  return json.data.slice().sort((a, b) => a.index - b.index).map((r) => r.embedding);
}
const vec = (v) => `[${v.join(',')}]`;

const email = `rag-smoke-${Date.now()}@unit-x.art`;
let userId = null;
let operatorId = null;

try {
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (ue) throw ue;
  userId = u.user.id;
  const [op] = await sql`
    insert into operators (auth_user_id, email, handle)
    values (${userId}, ${email}, 'rag')
    returning id
  `;
  operatorId = op.id;

  // Five memories spanning distinct topics. Query should pull the
  // bike ones on a bike query and the sister ones on a sister query.
  const texts = [
    'sister mira moving back from berlin next month',
    'anxious about the interview with kestrel labs',
    'bike tire keeps losing pressure every two days',
    'the blue mountain bike in the basement needs new brake pads',
    'coffee with dad last sunday felt different this time',
  ];
  const vecs = await embed(texts);
  for (let i = 0; i < texts.length; i++) {
    const { cipher, nonce } = encrypt(texts[i], operatorId);
    await sql`
      insert into memories (operator_id, tag, text_cipher, nonce, embedding, embedding_model)
      values (${operatorId}, 'fact', ${cipher}, ${nonce}, ${vec(vecs[i])}::vector, ${`openai/${MODEL}@${DIM}`})
    `;
  }
  console.log(`[smoke-rag] seeded ${texts.length} embedded memories`);

  // Query 1: bike → expect the two bike memories at top.
  const [q1vec] = await embed(['my bike has been giving me trouble']);
  const bikeHits = await sql`
    select id, (embedding <=> ${vec(q1vec)}::vector) as dist
    from memories
    where operator_id = ${operatorId} and deleted_at is null and embedding is not null
    order by embedding <=> ${vec(q1vec)}::vector
    limit 3
  `;
  console.log('[smoke-rag] bike query → top 3 distances:', bikeHits.map((r) => r.dist.toFixed(3)));
  // top 2 should have distance < 0.5
  if (bikeHits[0].dist > 0.5 || bikeHits[1].dist > 0.5) {
    throw new Error(`bike ranking looks off — first two distances should be < 0.5`);
  }

  // Query 2: sister → expect the sister memory at top.
  const [q2vec] = await embed(['tell me about my sister']);
  const sisterHits = await sql`
    select id, (embedding <=> ${vec(q2vec)}::vector) as dist
    from memories
    where operator_id = ${operatorId} and deleted_at is null and embedding is not null
    order by embedding <=> ${vec(q2vec)}::vector
    limit 1
  `;
  console.log('[smoke-rag] sister query → top distance:', sisterHits[0].dist.toFixed(3));
  if (sisterHits[0].dist > 0.5) {
    throw new Error('sister ranking looks off');
  }

  console.log('[smoke-rag] ✓ similarity ranking verified');
} catch (err) {
  console.error('[smoke-rag] FAIL:', err.message || err);
  process.exitCode = 1;
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    console.log('[smoke-rag] cleanup: deleted auth.user (cascaded)');
  }
  await sql.end({ timeout: 5 });
}
