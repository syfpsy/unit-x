-- Phase 4 — Supabase Auth integration.
-- Binds every `operators` row to a Supabase `auth.users` row, enables RLS
-- as a belt-and-suspenders policy layer, and wipes any legacy rows from
-- the shared-dev-operator era (we have no real users yet).

-- 1. Wipe legacy data. operators cascades to messages + memories via FK.
DELETE FROM "memories";
--> statement-breakpoint
DELETE FROM "messages";
--> statement-breakpoint
DELETE FROM "operators";
--> statement-breakpoint

-- 2. Schema delta on operators.
ALTER TABLE "operators" ADD COLUMN "auth_user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_auth_user_id_unique" UNIQUE ("auth_user_id");
--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_auth_user_id_fkey"
  FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "operators" ALTER COLUMN "email" SET NOT NULL;
--> statement-breakpoint

-- 3. Row-Level Security. Our server code connects as a role that can
-- bypass RLS (service role via DATABASE_URL) and enforces scoping in
-- application code — but enabling RLS + policies means a leaked anon
-- key cannot read any operator's data without going through our own
-- handlers, and gives us an easy path to stricter enforcement later.
ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "operators_self" ON "operators"
  FOR ALL
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
--> statement-breakpoint

CREATE POLICY "messages_owner" ON "messages"
  FOR ALL
  USING (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()))
  WITH CHECK (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()));
--> statement-breakpoint

CREATE POLICY "memories_owner" ON "memories"
  FOR ALL
  USING (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()))
  WITH CHECK (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()));
