import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getOperator } from '@/lib/auth/getOperator';
import { decryptText } from '@/lib/crypto/cipher';
import { getDb } from '@/lib/db/client';
import { messages, memories, operatorCosmetics, cosmetics } from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR data export. Returns the operator's full ledger + messages +
 * cosmetic ownership as a single JSON download. Decrypts content on
 * read; the downloaded file is plaintext — the user already has
 * plaintext in their browser while chatting.
 *
 * Stricter rate limit (1 per minute, 3 burst) — this is the kind of
 * endpoint you want to abuse-proof even for authenticated users.
 */
export async function POST() {
  const op = await getOperator();
  if (!op) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const rl = checkRateLimit(`export:${op.id}`, { capacity: 3, refillPerSec: 1 / 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `rate limited — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 },
    );
  }

  try {
    const db = getDb();
    const [msgRows, memRows, cosmRows] = await Promise.all([
      db
        .select()
        .from(messages)
        .where(eq(messages.operatorId, op.id))
        .orderBy(desc(messages.ts)),
      db
        .select()
        .from(memories)
        .where(eq(memories.operatorId, op.id))
        .orderBy(desc(memories.createdAt)),
      db
        .select({
          slug: cosmetics.slug,
          kind: cosmetics.kind,
          name: cosmetics.name,
          unlockedAt: operatorCosmetics.unlockedAt,
          equipped: operatorCosmetics.equipped,
        })
        .from(operatorCosmetics)
        .innerJoin(cosmetics, eq(cosmetics.id, operatorCosmetics.cosmeticId))
        .where(eq(operatorCosmetics.operatorId, op.id)),
    ]);

    const decodedMessages = msgRows.map((r) => {
      try {
        return {
          ts: r.ts.toISOString(),
          who: r.who,
          text: decryptText(r.textCipher as Buffer, r.nonce as Buffer, op.id),
        };
      } catch {
        return { ts: r.ts.toISOString(), who: r.who, text: '[undecryptable]' };
      }
    });
    const decodedMemories = memRows.map((r) => {
      try {
        return {
          createdAt: r.createdAt.toISOString(),
          deletedAt: r.deletedAt?.toISOString() ?? null,
          tag: r.tag,
          text: decryptText(r.textCipher as Buffer, r.nonce as Buffer, op.id),
        };
      } catch {
        return {
          createdAt: r.createdAt.toISOString(),
          deletedAt: r.deletedAt?.toISOString() ?? null,
          tag: r.tag,
          text: '[undecryptable]',
        };
      }
    });

    const payload = {
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      operator: {
        email: op.email,
        handle: op.handle,
        createdAt: op.createdAt.toISOString(),
      },
      messages: decodedMessages,
      memories: decodedMemories,
      cosmetics: cosmRows.map((r) => ({
        slug: r.slug,
        kind: r.kind,
        name: r.name,
        unlockedAt: r.unlockedAt.toISOString(),
        equipped: r.equipped,
      })),
    };

    const filename = `unit-x-${op.handle}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    log.error('export failed', { err });
    return NextResponse.json(
      { error: 'export failed' },
      { status: 500 },
    );
  }
}
