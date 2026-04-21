import { boolean, customType, integer, jsonb, pgTable, primaryKey, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Drizzle doesn't ship a first-class bytea type — this custom type bridges
 * Postgres `bytea` and Node `Buffer`. postgres.js returns bytea columns as
 * Buffer already, so no runtime marshalling is needed.
 */
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Phase 3 schema: no auth yet — a single "dev" operator row is created on
 * first use and shared across all visitors. Phase 4 will add per-operator
 * scoping when magic-link auth lands.
 */

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  // FK to Supabase's auth.users(id). Enforced by a SQL constraint added in the
  // Phase 4 migration (Drizzle doesn't express cross-schema FKs well).
  authUserId: uuid('auth_user_id').notNull().unique(),
  email: varchar('email', { length: 320 }).notNull(),
  handle: varchar('handle', { length: 80 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    // 'user' | 'agent' | 'sys' — matches the client `Who` union.
    who: varchar('who', { length: 8 }).notNull(),
    // Encrypted content (ciphertext ‖ auth tag). See lib/crypto/cipher.ts.
    textCipher: bytea('text_cipher').notNull(),
    nonce: bytea('nonce').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_operator_ts_idx').on(t.operatorId, t.ts)],
);

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    // 'fact' | 'rel' | 'thread' | 'feeling' — mirrored from the client.
    tag: varchar('tag', { length: 10 }).notNull(),
    // Encrypted content (ciphertext ‖ auth tag). See lib/crypto/cipher.ts.
    textCipher: bytea('text_cipher').notNull(),
    nonce: bytea('nonce').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Soft-delete tombstone. /forget flips this; active ledger queries filter it out.
    // Phase 8 retention sweep overwrites text_cipher with zeros after a grace period.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('memories_operator_active_idx').on(t.operatorId, t.deletedAt)],
);

/**
 * Records each time an operator crossed into a new evolution stage.
 * Phase 6 uses this to fire the stage-up celebration exactly once per
 * stage per operator — if the row already exists, the client has
 * already seen the transition.
 */
export const stageTransitions = pgTable(
  'stage_transitions',
  {
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    stage: integer('stage').notNull(),
    reachedAt: timestamp('reached_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.operatorId, t.stage] })],
);

/**
 * Cosmetics catalogue — seeded from migrations, not mutated at runtime.
 * `payload` is the kind-specific config (mascot ASCII, boot banner lines,
 * etc). `unlock_rule` is an opaque JSON DSL interpreted by
 * `lib/cosmetics/evaluate.ts`.
 */
export const cosmetics = pgTable('cosmetics', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  // 'mascot' | 'boot_banner' | 'phosphor_palette' | 'idle_art' | 'frame' | 'divider'
  kind: varchar('kind', { length: 24 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  blurb: varchar('blurb', { length: 240 }).notNull(),
  payload: jsonb('payload').notNull(),
  unlockRule: jsonb('unlock_rule').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-operator cosmetic state: which items have been first-observed
 * (`unlocked_at`) and which are currently equipped. Only one cosmetic
 * per kind may be equipped at a time — enforced in the equip helper.
 */
export const operatorCosmetics = pgTable(
  'operator_cosmetics',
  {
    operatorId: uuid('operator_id')
      .notNull()
      .references(() => operators.id, { onDelete: 'cascade' }),
    cosmeticId: uuid('cosmetic_id')
      .notNull()
      .references(() => cosmetics.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
    equipped: boolean('equipped').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.operatorId, t.cosmeticId] })],
);
