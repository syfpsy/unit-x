import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Phase 3 schema: no auth yet — a single "dev" operator row is created on
 * first use and shared across all visitors. Phase 4 will add per-operator
 * scoping when magic-link auth lands.
 */

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nullable until Phase 4 binds operators to verified email addresses.
  email: varchar('email', { length: 320 }),
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
    text: text('text').notNull(),
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
    text: varchar('text', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Soft-delete tombstone. /forget flips this; active ledger queries filter it out.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('memories_operator_active_idx').on(t.operatorId, t.deletedAt)],
);
