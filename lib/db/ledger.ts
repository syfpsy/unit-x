import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { decryptText, encryptText } from '@/lib/crypto/cipher';
import { getEmbeddingProvider } from '@/lib/llm/embed';
import { getDb } from './client';
import { memories, messages } from './schema';
import type { MemoryTag, Who } from '@/components/types';

// Phase 4 note: operator resolution moved to `lib/auth/getOperator.ts`
// — session-scoped, backed by Supabase Auth.
// Phase 5 note: every content field is encrypted at rest. Writes go through
// encryptText(); reads decrypt here so callers get plaintext.

export interface ActiveMemory {
  id: string;
  tag: string;
  text: string;
  createdAt: Date;
}

export async function listActiveMemories(
  operatorId: string,
): Promise<ActiveMemory[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: memories.id,
      tag: memories.tag,
      textCipher: memories.textCipher,
      nonce: memories.nonce,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .where(
      and(eq(memories.operatorId, operatorId), isNull(memories.deletedAt)),
    )
    .orderBy(desc(memories.createdAt))
    .limit(64);

  const out: ActiveMemory[] = [];
  for (const row of rows) {
    try {
      const text = decryptText(row.textCipher, row.nonce, operatorId);
      out.push({
        id: row.id,
        tag: row.tag,
        text,
        createdAt: row.createdAt,
      });
    } catch {
      // If a row can't be decrypted (e.g. master-key mismatch after
      // botched rotation) skip it silently. Better to drop one memory
      // than to render a lie; Phase 8 observability catches these.
    }
  }
  return out;
}

export async function insertMemory(params: {
  operatorId: string;
  tag: MemoryTag;
  text: string;
}) {
  const db = getDb();
  const clipped = params.text.slice(0, 200);
  const { cipher, nonce } = encryptText(clipped, params.operatorId);

  // Try to embed before insert so the row ships with a vector. If the
  // embedding provider is unavailable or the call fails, store the row
  // without an embedding — a future backfill (scripts/backfill-
  // embeddings.mjs) or the next time this text is rewritten will fill
  // it in. Semantic recall silently skips NULL-embedding rows.
  const provider = getEmbeddingProvider();
  let embedding: number[] | null = null;
  let modelSlug: string | null = null;
  if (provider) {
    try {
      const [vec] = await provider.embed([clipped]);
      if (vec && vec.length === provider.dimensions) {
        embedding = vec;
        modelSlug = provider.modelSlug;
      }
    } catch {
      // swallow — write path must not block on the embedding provider
    }
  }

  const [row] = await db
    .insert(memories)
    .values({
      operatorId: params.operatorId,
      tag: params.tag,
      textCipher: cipher,
      nonce,
      embedding: embedding ?? undefined,
      embeddingModel: modelSlug ?? undefined,
    })
    .returning({
      id: memories.id,
      tag: memories.tag,
      createdAt: memories.createdAt,
    });
  return { ...row, text: clipped };
}

export async function insertMessage(params: {
  operatorId: string;
  who: Who;
  text: string;
}) {
  const db = getDb();
  const { cipher, nonce } = encryptText(params.text, params.operatorId);
  await db.insert(messages).values({
    operatorId: params.operatorId,
    who: params.who,
    textCipher: cipher,
    nonce,
  });
}

/**
 * Soft-delete active memories whose plaintext contains `keyword` (case-
 * insensitive substring). Because content is encrypted we can't filter
 * via SQL — we fetch all active rows, decrypt, match in memory, then
 * batch-update the matching ids. Returns the matched rows with their
 * plaintext for the UI to show the excised list.
 */
export async function softForget(params: {
  operatorId: string;
  keyword: string;
}): Promise<Array<{ id: string; tag: string; text: string }>> {
  const needle = params.keyword.toLowerCase();
  if (!needle) return [];

  const active = await listActiveMemories(params.operatorId);
  const matched = active.filter((m) => m.text.toLowerCase().includes(needle));
  if (matched.length === 0) return [];

  const db = getDb();
  const ids = matched.map((m) => m.id);
  await db
    .update(memories)
    .set({ deletedAt: new Date() })
    .where(inArray(memories.id, ids));

  return matched.map((m) => ({ id: m.id, tag: m.tag, text: m.text }));
}
