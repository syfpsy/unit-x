import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import { cosmetics, operatorCosmetics } from './schema';
import { isUnlocked, lockHintFor } from '@/lib/cosmetics/evaluate';
import type { CosmeticKind, CosmeticPayload, CosmeticRow, GalleryEntry, OwnerCtx, UnlockRule } from '@/lib/cosmetics/types';
import type { EvolutionStage } from '@/lib/evolution';
import type { MemoryTag } from '@/components/types';

/**
 * Build the OwnerCtx used for unlock evaluation. `activeMemories` is
 * passed in to avoid a duplicate query — the ledger route already has
 * them. `memoriesByTag` is derived cheaply from the same list.
 */
export function ownerCtxFrom(input: {
  tenureDays: number;
  activeMemories: Array<{ tag: string }>;
  evolutionStage: EvolutionStage;
}): OwnerCtx {
  const byTag: Partial<Record<MemoryTag, number>> = {};
  for (const m of input.activeMemories) {
    const k = m.tag as MemoryTag;
    byTag[k] = (byTag[k] ?? 0) + 1;
  }
  return {
    tenureDays: input.tenureDays,
    memoriesTotal: input.activeMemories.length,
    memoriesByTag: byTag,
    evolutionStage: input.evolutionStage,
  };
}

/**
 * Writes `operator_cosmetics` rows for any items whose unlock rule just
 * became satisfied. Returns the slugs that were actually freshly written
 * so callers (e.g. `/api/ledger`) can surface a one-shot celebration.
 *
 * Idempotent: items already owned are skipped via `ON CONFLICT DO NOTHING`.
 */
export async function detectAndPersistUnlocks(
  operatorId: string,
  ctx: OwnerCtx,
): Promise<string[]> {
  const db = getDb();
  const all = await db.select().from(cosmetics);
  const owned = await db
    .select({ cosmeticId: operatorCosmetics.cosmeticId })
    .from(operatorCosmetics)
    .where(eq(operatorCosmetics.operatorId, operatorId));
  const ownedIds = new Set(owned.map((r) => r.cosmeticId));

  const newlyUnlockedIds: string[] = [];
  for (const c of all) {
    const rule = c.unlockRule as UnlockRule;
    if (isUnlocked(rule, ctx) && !ownedIds.has(c.id)) {
      newlyUnlockedIds.push(c.id);
    }
  }
  if (newlyUnlockedIds.length === 0) return [];

  await db
    .insert(operatorCosmetics)
    .values(newlyUnlockedIds.map((id) => ({ operatorId, cosmeticId: id })))
    .onConflictDoNothing();

  return newlyUnlockedIds
    .map((id) => all.find((c) => c.id === id)?.slug)
    .filter((s): s is string => !!s);
}

/**
 * Fetches every catalogue item + the operator's per-row ownership state.
 * Payload is included only for unlocked items (don't spoil previews).
 * Pure read — does not mutate. Call `detectAndPersistUnlocks` first if
 * you want newly-eligible items marked.
 */
export async function galleryFor(
  operatorId: string,
  ctx: OwnerCtx,
): Promise<GalleryEntry[]> {
  const db = getDb();
  const all = await db.select().from(cosmetics);
  const owned = await db
    .select()
    .from(operatorCosmetics)
    .where(eq(operatorCosmetics.operatorId, operatorId));
  const ownedById = new Map(owned.map((r) => [r.cosmeticId, r]));

  const entries: GalleryEntry[] = all.map((c) => {
    const rule = c.unlockRule as UnlockRule;
    const payload = c.payload as CosmeticPayload;
    const own = ownedById.get(c.id);
    const unlocked = isUnlocked(rule, ctx) || !!own;
    return {
      slug: c.slug,
      kind: c.kind as CosmeticKind,
      name: c.name,
      blurb: c.blurb,
      unlocked,
      equipped: !!own?.equipped,
      lockHint: unlocked ? null : lockHintFor(rule, ctx),
      payload: unlocked ? payload : null,
    };
  });
  entries.sort((a, b) =>
    a.kind === b.kind ? a.slug.localeCompare(b.slug) : a.kind.localeCompare(b.kind),
  );
  return entries;
}

/**
 * Equip a cosmetic for an operator. Requires the item to already be
 * unlocked (i.e. an operator_cosmetics row exists). Unequips any other
 * cosmetic of the same kind first so only one-per-kind is active.
 */
export async function equipCosmetic(params: {
  operatorId: string;
  slug: string;
}): Promise<{ kind: CosmeticKind; slug: string; payload: CosmeticPayload } | { error: string }> {
  const db = getDb();
  const [c] = await db.select().from(cosmetics).where(eq(cosmetics.slug, params.slug));
  if (!c) return { error: 'cosmetic not found' };

  const [own] = await db
    .select()
    .from(operatorCosmetics)
    .where(
      and(
        eq(operatorCosmetics.operatorId, params.operatorId),
        eq(operatorCosmetics.cosmeticId, c.id),
      ),
    );
  if (!own) return { error: 'not unlocked yet' };

  // Unequip all other cosmetics of the same kind.
  const sameKind = await db
    .select({ id: cosmetics.id })
    .from(cosmetics)
    .where(eq(cosmetics.kind, c.kind));
  const sameKindIds = sameKind.map((r) => r.id);
  if (sameKindIds.length > 0) {
    await db
      .update(operatorCosmetics)
      .set({ equipped: false })
      .where(
        and(
          eq(operatorCosmetics.operatorId, params.operatorId),
          inArray(operatorCosmetics.cosmeticId, sameKindIds),
        ),
      );
  }

  await db
    .update(operatorCosmetics)
    .set({ equipped: true })
    .where(
      and(
        eq(operatorCosmetics.operatorId, params.operatorId),
        eq(operatorCosmetics.cosmeticId, c.id),
      ),
    );

  return {
    kind: c.kind as CosmeticKind,
    slug: c.slug,
    payload: c.payload as CosmeticPayload,
  };
}

/**
 * Returns the set of equipped cosmetics for an operator — the map
 * `kind → payload` that the client applies on load. Boots up the
 * initial state; gallery responses stay independent.
 *
 * Ensures the default cosmetic for each kind is always present so an
 * operator who has never opened the gallery still renders correctly.
 */
export async function equippedFor(operatorId: string): Promise<Record<string, CosmeticRow>> {
  const db = getDb();
  const rows = await db
    .select({
      id: cosmetics.id,
      slug: cosmetics.slug,
      kind: cosmetics.kind,
      name: cosmetics.name,
      blurb: cosmetics.blurb,
      payload: cosmetics.payload,
      unlockRule: cosmetics.unlockRule,
    })
    .from(operatorCosmetics)
    .innerJoin(cosmetics, eq(cosmetics.id, operatorCosmetics.cosmeticId))
    .where(
      and(
        eq(operatorCosmetics.operatorId, operatorId),
        eq(operatorCosmetics.equipped, true),
      ),
    );
  const out: Record<string, CosmeticRow> = {};
  for (const r of rows) {
    out[r.kind] = {
      id: r.id,
      slug: r.slug,
      kind: r.kind as CosmeticKind,
      name: r.name,
      blurb: r.blurb,
      payload: r.payload as CosmeticPayload,
      unlockRule: r.unlockRule as UnlockRule,
    };
  }
  return out;
}
