-- Phase 10 — mascot-rooted switches from a literal template to a slot
-- override. Same visual, but now composes with whatever stage the
-- operator is at when they equip it (unlock guarantees stage 4, but the
-- pattern is what matters — future cosmetics should prefer this shape).

UPDATE "cosmetics"
SET "payload" = jsonb_build_object(
  'slotOverrides', jsonb_build_object(
    'slots', jsonb_build_object('under', 'roots-classic')
  )
),
"blurb" = 'the unit lays down roots. composes with the stage you earned it at.'
WHERE "slug" = 'mascot-rooted';
