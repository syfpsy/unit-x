-- Phase 7 — ASCII cosmetics + unlock system.
-- Two tables: `cosmetics` (catalogue, seeded here) and `operator_cosmetics`
-- (per-operator unlock + equip state). RLS on both. Catalogue reads are
-- public — unlock rules are evaluated server-side and the payload is
-- static; there's nothing sensitive in there.

CREATE TABLE "cosmetics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(80) NOT NULL UNIQUE,
  "kind" varchar(24) NOT NULL,
  "name" varchar(120) NOT NULL,
  "blurb" varchar(240) NOT NULL,
  "payload" jsonb NOT NULL,
  "unlock_rule" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "operator_cosmetics" (
  "operator_id" uuid NOT NULL REFERENCES "operators"("id") ON DELETE cascade,
  "cosmetic_id" uuid NOT NULL REFERENCES "cosmetics"("id") ON DELETE cascade,
  "unlocked_at" timestamp with time zone NOT NULL DEFAULT now(),
  "equipped" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("operator_id", "cosmetic_id")
);
--> statement-breakpoint

ALTER TABLE "cosmetics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "operator_cosmetics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Catalogue is readable to any authenticated user; no one writes to it at
-- runtime (migrations only). RLS permits select-only for everyone.
CREATE POLICY "cosmetics_read_all" ON "cosmetics"
  FOR SELECT
  USING (true);
--> statement-breakpoint

CREATE POLICY "operator_cosmetics_owner" ON "operator_cosmetics"
  FOR ALL
  USING (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()))
  WITH CHECK (operator_id IN (SELECT id FROM operators WHERE auth_user_id = auth.uid()));
--> statement-breakpoint

-- Seed catalogue — 6 items. Mascots are stored as full templates with the
-- same `E`/`M` markers as the code-baked stage templates. Boot banners are
-- arrays of { t, s } pairs matching the boot line schema in Boot.tsx.

INSERT INTO "cosmetics" ("slug", "kind", "name", "blurb", "payload", "unlock_rule") VALUES
(
  'mascot-default',
  'mascot',
  'default',
  'the shape you grew into. follows evolution stage.',
  '{"delegate":"stage"}'::jsonb,
  '{"type":"always"}'::jsonb
),
(
  'mascot-rooted',
  'mascot',
  'rooted',
  'the unit lays down roots. earned at attuned.',
  '{"template":"    ╔═════════════╗\n   ╱               ╲\n  ╱   ┌─┐     ┌─┐   ╲\n │    │E│     │E│    │\n │    └─┘     └─┘    │\n  ╲                 ╱\n   │      M      │\n   │   ╲═══════╱    │\n    ╚═════════════╝\n        │ │││ │\n      ══╧═╧╧═╧══\n       │  ╱╲  │\n      ─┼─╱  ╲─┼─\n       │      │"}'::jsonb,
  '{"type":"stage_reached","stage":4}'::jsonb
),
(
  'mascot-sentinel',
  'mascot',
  'sentinel',
  'narrower, more alert. earned with enough memory to hold a watch.',
  '{"template":"       ╭───────╮\n      ╱         ╲\n     ╱   ┌─┐ ┌─┐ ╲\n     │   │E│ │E│ │\n     │   └─┘ └─┘ │\n      ╲         ╱\n       │    M    │\n       │╲_______╱│\n        ╲_______╱\n          │ │ │\n         ═╧═╧═"}'::jsonb,
  '{"type":"memories_total","min":50}'::jsonb
),
(
  'banner-classic',
  'boot_banner',
  'classic',
  'the original boot. always available.',
  '{"delegate":"default"}'::jsonb,
  '{"type":"always"}'::jsonb
),
(
  'banner-rem-v2',
  'boot_banner',
  'rem.v2',
  'the reverie-era boot. earned when the unit knows your weather.',
  '{"lines":[{"t":"dim","s":">> NXZ-UNIT // REM.V2 CYCLE"},{"t":"faint","s":">> (c) gridline systems"},{"t":"faint","s":""},{"t":"ok","s":"DREAM MODULE  ::  rem.v2  ...................... [ONLINE]"},{"t":"ok","s":"LEDGER INDEX  ::  loaded  ....................... [OK]"},{"t":"violet","s":"    ├── reverie.core   ████████████████  ACTIVE"},{"t":"violet","s":"    ├── association    ████████████░░░░  WARM"},{"t":"violet","s":"    └── association.ii ██████████░░░░░░  ANCHORED"},{"t":"ok","s":"UPLINK  ::  channel 07 ............................ [OK]"},{"t":"faint","s":""},{"t":"violet","s":"   ╔══════════════════════════════════════════════════╗"},{"t":"violet","s":"   ║                                                  ║"},{"t":"violet","s":"   ║           U N I T - X   //   REM.V2              ║"},{"t":"violet","s":"   ║                                                  ║"},{"t":"violet","s":"   ╚══════════════════════════════════════════════════╝"}]}'::jsonb,
  '{"type":"stage_reached","stage":2}'::jsonb
),
(
  'banner-minimal',
  'boot_banner',
  'minimal',
  'less ceremony. earned when you and the unit have enough history to skip the drumroll.',
  '{"lines":[{"t":"dim","s":"nxz-unit · warm start"},{"t":"faint","s":""},{"t":"ok","s":"ledger .. ok"},{"t":"ok","s":"uplink .. ok"},{"t":"faint","s":""},{"t":"violet","s":"   unit-x // online"}]}'::jsonb,
  '{"type":"stage_reached","stage":3}'::jsonb
);
