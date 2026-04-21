<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Start here

Read **[PLAN.md](./PLAN.md)** before planning any work. It's the single
source of truth for:

- The product premise and the immutable aesthetic / memory-protocol / slash-command constraints.
- What's already shipped (phases 1–3) vs what's queued (phases 4–10).
- Architectural decisions we don't relitigate (encryption from day one,
  pure evolution computation, cosmetics as data, etc.).

If PLAN.md and your intuition disagree, PLAN.md wins. Update its Change
Log when a phase ships.

## Quick orientation

- Production app: `/app/`, `/components/`, `/lib/`.
- Prototype for reference: `../project/` (frozen, don't edit).
- Database schema: `lib/db/schema.ts`; migrations under `lib/db/migrations/`.
- Non-interactive migration runner: `npm run db:migrate` (uses
  `scripts/migrate.mjs`; `drizzle-kit push` needs a TTY we don't have).
- Tests for the `<remember>` parser live next to `app/api/complete/route.ts`
  when they exist; regressions there are the most expensive.
