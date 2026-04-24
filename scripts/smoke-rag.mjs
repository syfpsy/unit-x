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
  // Seed with labelled keys so we can assert *which* memories rank top
  // rather than relying on arbitrary distance thresholds (which shift
  // between models + phrase lengths).
  const seeds = {
    sister:   'sister mira moving back from berlin next month',
    interview:'anxious about the interview with kestrel labs',
    bike1:    'bike tire keeps losing pressure every two days',
    bike2:    'the blue mountain bike in the basement needs new brake pads',
    dad:      'coffee with dad last sunday felt different this time',
  };
  const keys = Object.keys(seeds);
  const texts = Object.values(seeds);
  const vecs = await embed(texts);
  const ids = {};
  for (let i = 0; i < texts.length; i++) {
    const { cipher, nonce } = encrypt(texts[i], operatorId);
    const [row] = await sql`
      insert into memories (operator_id, tag, text_cipher, nonce, embedding, embedding_model)
      values (${operatorId}, 'fact', ${cipher}, ${nonce}, ${vec(vecs[i])}::vector, ${`openai/${MODEL}@${DIM}`})
      returning id
    `;
    ids[keys[i]] = row.id;
  }
  console.log(`[smoke-rag] seeded ${texts.length} embedded memories`);

  // Top-K by ID. Meaningful regardless of absolute distance magnitudes.
  async function topK(queryText, k) {
    const [q] = await embed([queryText]);
    const rows = await sql`
      select id, (embedding <=> ${vec(q)}::vector) as dist
      from memories
      where operator_id = ${operatorId} and deleted_at is null and embedding is not null
      order by embedding <=> ${vec(q)}::vector
      limit ${k}
    `;
    return rows;
  }

  // Query 1: bike → top 2 must be bike1 + bike2 (order either way).
  const bikeHits = await topK('my bike has been giving me trouble', 3);
  const bikeTop2 = new Set(bikeHits.slice(0, 2).map((r) => r.id));
  console.log('[smoke-rag] bike query → distances:', bikeHits.map((r) => r.dist.toFixed(3)));
  if (!bikeTop2.has(ids.bike1) || !bikeTop2.has(ids.bike2)) {
    throw new Error('bike query did not rank both bike memories in the top 2');
  }

  // Query 2: sister → top hit must be the sister memory.
  const sisterHits = await topK('tell me about my sister', 1);
  console.log('[smoke-rag] sister query → distance:', sisterHits[0].dist.toFixed(3));
  if (sisterHits[0].id !== ids.sister) {
    throw new Error('sister query did not rank the sister memory first');
  }

  // Query 3 (new): emotional weather → dad memory should win over bike.
  const feelingHits = await topK('how was it seeing family last weekend', 1);
  console.log('[smoke-rag] family query → distance:', feelingHits[0].dist.toFixed(3));
  if (feelingHits[0].id !== ids.dad && feelingHits[0].id !== ids.sister) {
    throw new Error('family query did not rank a family memory first');
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
