-- Phase 9 — ASCII quality pass.
-- The cosmetic mascot templates seeded in 0004 had the old asymmetric
-- base (`═╧═╧╧═╧═`) and the rooted variant had misaligned root-stakes.
-- This migration replaces the payloads with the audited versions that
-- share the same 5-strut neck + 5-tap base as the stage mascots.

UPDATE "cosmetics"
SET "payload" = jsonb_build_object(
  'template',
  '    ╔═════════════╗' || E'\n' ||
  '   ╱               ╲' || E'\n' ||
  '  ╱   ┌─┐     ┌─┐   ╲' || E'\n' ||
  ' │    │E│     │E│    │' || E'\n' ||
  ' │    └─┘     └─┘    │' || E'\n' ||
  '  ╲                 ╱' || E'\n' ||
  '   │      M      │' || E'\n' ||
  '   │   ╲═══════╱    │' || E'\n' ||
  '    ╚═════════════╝' || E'\n' ||
  '        │ │││ │' || E'\n' ||
  '     ══╧═╧═╧═╧═══' || E'\n' ||
  '      ╱  ╲ ╱  ╲' || E'\n' ||
  '     ╱    ╳    ╲' || E'\n' ||
  '    ─┴─  ─┴─  ─┴─'
)
WHERE "slug" = 'mascot-rooted';
--> statement-breakpoint

UPDATE "cosmetics"
SET "payload" = jsonb_build_object(
  'template',
  '      ╭─────────╮' || E'\n' ||
  '     ╱           ╲' || E'\n' ||
  '    ╱   ┌─┐ ┌─┐   ╲' || E'\n' ||
  '    │   │E│ │E│   │' || E'\n' ||
  '    │   └─┘ └─┘   │' || E'\n' ||
  '     ╲           ╱' || E'\n' ||
  '      │    M    │' || E'\n' ||
  '      │  ╲___╱   │' || E'\n' ||
  '       ╲_________╱' || E'\n' ||
  '         │ │ │' || E'\n' ||
  '        ═╧═╧═╧═'
)
WHERE "slug" = 'mascot-sentinel';
