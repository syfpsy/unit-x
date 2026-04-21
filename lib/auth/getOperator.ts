import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { operators } from '@/lib/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface Operator {
  id: string;
  authUserId: string;
  email: string;
  handle: string;
}

/**
 * Resolves (and lazily creates) the operator row keyed to the current
 * Supabase session. Returns null for unauthenticated visitors — callers
 * should branch on that to decide whether to persist or run ephemerally.
 *
 * Phase 4 replaces the `getOrCreateDevOperator` shared-row pattern with
 * this per-session lookup. RLS policies also scope data to this row, but
 * application code is the primary enforcer since the server connection
 * runs as a role that can bypass RLS.
 */
export async function getOperator(): Promise<Operator | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const existing = await db
    .select()
    .from(operators)
    .where(eq(operators.authUserId, user.id))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    return {
      id: row.id,
      authUserId: row.authUserId,
      email: row.email,
      handle: row.handle,
    };
  }

  const email = user.email ?? `${user.id.slice(0, 8)}@nxyz.art`;
  const rawHandle = (email.split('@')[0] || 'operator').toLowerCase();
  // Keep the handle terminal-friendly: only alnum + dash + underscore.
  const handle =
    rawHandle.replace(/[^a-z0-9_-]/g, '').slice(0, 80) || 'operator';

  const [created] = await db
    .insert(operators)
    .values({
      authUserId: user.id,
      email,
      handle,
    })
    .returning();

  return {
    id: created.id,
    authUserId: created.authUserId,
    email: created.email,
    handle: created.handle,
  };
}
