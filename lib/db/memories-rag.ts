import { sql as rawSql } from 'drizzle-orm';
import { decryptText } from '@/lib/crypto/cipher';
import { getDb } from './client';
import { vectorLiteral } from '@/lib/llm/embed';

export interface RecallHit {
  id: string;
  tag: string;
  text: string;
  createdAt: Date;
  /** Cosine distance (0 = identical, 2 = opposite). Lower = more similar. */
  distance: number;
}

/**
 * Top-K most-similar memories for a given operator, scoped to active
 * (non-deleted) rows that have an embedding. Decrypts content before
 * returning. Empty array when the operator has no embedded memories
 * yet — caller should fall back to recency.
 *
 * Uses pgvector's cosine distance (`<=>`). The partial HNSW index set
 * up in migration 0007 accelerates this for reasonable catalogues
 * (<1M rows per index); for very large volumes we'd switch to IVFFlat
 * or add per-operator partitioning.
 */
export async function similarMemories(params: {
  operatorId: string;
  queryEmbedding: number[];
  limit?: number;
  /** Distance ceiling; hits further than this are dropped. 0..2 range. */
  maxDistance?: number;
}): Promise<RecallHit[]> {
  const db = getDb();
  const limit = params.limit ?? 8;
  // Default calibrated for text-embedding-3-small on short phrases;
  // override via the `maxDistance` arg if a different embedding model
  // produces tighter / looser distance distributions.
  const maxDistance = params.maxDistance ?? 0.8;
  const vec = vectorLiteral(params.queryEmbedding);

  // We use `db.execute` + raw SQL because pgvector operators aren't
  // part of Drizzle's DSL. The <=> operator returns cosine distance.
  const rows = await db.execute<{
    id: string;
    tag: string;
    text_cipher: Buffer;
    nonce: Buffer;
    created_at: Date;
    distance: number;
  }>(rawSql`
    select
      id,
      tag,
      text_cipher,
      nonce,
      created_at,
      (embedding <=> ${vec}::vector) as distance
    from memories
    where operator_id = ${params.operatorId}
      and deleted_at is null
      and embedding is not null
    order by embedding <=> ${vec}::vector
    limit ${limit}
  `);

  // postgres.js returns Result-like; normalise to an array.
  const list: Array<typeof rows extends Iterable<infer T> ? T : never> =
    Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows
      ? ((rows as { rows: unknown[] }).rows as typeof list)
      : (rows as unknown as typeof list);

  const out: RecallHit[] = [];
  for (const r of list) {
    if (r.distance > maxDistance) continue;
    try {
      const text = decryptText(r.text_cipher, r.nonce, params.operatorId);
      out.push({
        id: r.id,
        tag: r.tag,
        text,
        createdAt: r.created_at,
        distance: r.distance,
      });
    } catch {
      // Row that can't be decrypted (botched rotation) — skip, don't crash.
    }
  }
  return out;
}
