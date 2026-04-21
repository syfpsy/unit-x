-- Phase 6 — evolution engine. Records each first-time entry into a stage
-- so the client can fire the level-up celebration exactly once.

CREATE TABLE "stage_transitions" (
  "operator_id" uuid NOT NULL REFERENCES "operators"("id") ON DELETE cascade,
  "stage" integer NOT NULL,
  "reached_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("operator_id", "stage")
);
--> statement-breakpoint
ALTER TABLE "stage_transitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "stage_transitions_owner" ON "stage_transitions"
  FOR ALL
  USING (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()))
  WITH CHECK (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()));
