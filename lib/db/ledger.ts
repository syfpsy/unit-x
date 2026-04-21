import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from './client';
import { memories, messages } from './schema';
import type { MemoryTag, Who } from '@/components/types';

// Phase 4 note: operator resolution moved to `lib/auth/getOperator.ts`
// — session-scoped, backed by Supabase Auth. The pre-auth
// `getOrCreateDevOperator` helper is gone; every function here expects
// an already-resolved operator id.

export async function listActiveMemories(operatorId: string) {
  const db = getDb();
  return db
    .select({
      id: memories.id,
      tag: memories.tag,
      text: memories.text,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .where(
      and(eq(memories.operatorId, operatorId), isNull(memories.deletedAt)),
    )
    .orderBy(desc(memories.createdAt))
    .limit(64);
}

export async function insertMemory(params: {
  operatorId: string;
  tag: MemoryTag;
  text: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(memories)
    .values({
      operatorId: params.operatorId,
      tag: params.tag,
      text: params.text.slice(0, 200),
    })
    .returning({
      id: memories.id,
      tag: memories.tag,
      text: memories.text,
      createdAt: memories.createdAt,
    });
  return row;
}

export async function insertMessage(params: {
  operatorId: string;
  who: Who;
  text: string;
}) {
  const db = getDb();
  await db.insert(messages).values({
    operatorId: params.operatorId,
    who: params.who,
    text: params.text,
  });
}

/**
 * Soft-delete every memory belonging to `operatorId` whose `text` contains
 * `keyword` (case-insensitive substring). Returns the rows that were marked
 * so the client can show the excised list.
 */
export async function softForget(params: {
  operatorId: string;
  keyword: string;
}) {
  const db = getDb();
  const needle = `%${params.keyword.toLowerCase()}%`;
  const rows = await db
    .update(memories)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(memories.operatorId, params.operatorId),
        isNull(memories.deletedAt),
        sql`lower(${memories.text}) like ${needle}`,
      ),
    )
    .returning({
      id: memories.id,
      tag: memories.tag,
      text: memories.text,
    });
  return rows;
}
