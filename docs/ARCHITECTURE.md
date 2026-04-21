# UNIT-X architecture note

A companion document to [`PLAN.md`](../PLAN.md). PLAN is the phase-ordered
build log; this is the steady-state shape we're building toward. Phases
1-8 delivered a working product; phases 10+ will be organised around the
axes laid out here.

## Three layers: Shell, Mind, Memory

UNIT-X keeps three concerns in loosely coupled layers. Today they exist
but are fused in a few places; phases 10 onward will tighten the seams.

### Shell — what the operator sees and touches

- `<App>` root, the CRT stack, Boot, Identify, Terminal (transmission
  log + input row), SidePanel, SoulDoc, Gallery, Tweaks, IdleReverie.
- Slash-command dispatch (in Terminal), keyboard handling, aesthetic
  tweaks (phosphor / CRT layers / layout).
- ASCII mascot rendering (stage templates + cosmetic overrides).
- Never talks to DeepSeek, never touches the DB, never decrypts.

### Mind — how the unit decides what to say

- `buildSystemPrompt` (today in `Terminal.tsx` — candidate to lift into
  `lib/mind/` when we add mode-specific prompts).
- `/api/complete` stream transformer with `<remember>` extraction.
- Stage-aware tonal addendums (`lib/evolution.ts`).
- Mode handling (today: idle / thinking / speaking — expand to include
  dreaming, recovering, focused).

### Memory — what persists and in what shape

- Postgres: `operators`, `messages` (encrypted), `memories`
  (encrypted, 4 tags, soft-delete), `stage_transitions`,
  `cosmetics`, `operator_cosmetics`.
- Envelope encryption via `lib/crypto/cipher.ts`.
- Server-side `<remember>` write path in `/api/complete`.
- Retention sweep (`/api/cron/retention`).
- Public read surface: `/api/ledger`, `/api/gallery`, `/api/export`.

**Invariant**: Shell never imports from `lib/db` or `lib/crypto`
directly; it goes through `/api/*`. If you catch a Shell component
reaching into the DB layer, that's a seam leak — fix it before the
feature lands.

## Portrait system — slot-based (shipped Phase 10)

The mascot is a vertical composition of nine named slots. Every slot
has a registry of variants; a `PortraitSpec` names one variant per slot;
the renderer concatenates their output. Stage defaults live in
`lib/portrait/stages.ts`; cosmetics overlay on top.

### Slots (shipped)

```
portrait (lib/portrait/types.ts)
├── overhead    aureole / earned crown ornamentation   (0-2 lines)
├── antenna     single upward strut                     (0-1 line)
├── crown       top border — round-light | round-heavy | square-heavy
├── body        face silhouette + eye slots + mouth    (6 lines, atomic)
├── inner_jaw   curl inside the face bottom            (0-1 line)
├── base_cap    bottom border                           (1 line)
├── neck        struts between head and base            (0-1 line)
├── base_plate  tap pattern — thin | wide | narrow     (0-1 line)
└── under       roots, platform, environment glyphs    (0-N lines)
```

`body` keeps `E` (eye) and `M` (mouth) substitution markers — the
Mascot component swaps them at render based on mode, so the slot
system doesn't need separate eye/mouth variants yet.

### Render spec (shipped)

```ts
interface PortraitSpec {
  slots: Partial<Record<SlotName, string>>; // slot → variant slug
}
```

- **Variants** live in `lib/portrait/parts.ts`. Each is a
  `readonly string[]` — pre-aligned whole lines. Render order is
  fixed in `SLOT_ORDER`.
- **Stage defaults** in `lib/portrait/stages.ts`. Verified byte-
  identical to the hand-audited Phase 9 templates (a tiny inline
  node test round-trips stages 1 and 4).
- **Cosmetic overlays** use `CosmeticPayload.slotOverrides` to add
  or replace slot variants on top of the stage default.
  `mascot-rooted` is the reference implementation:
  `{ slots: { under: 'roots-classic' } }` — composes with whatever
  stage the operator wears it at.
- **Legacy path** `CosmeticPayload.template` still works for static
  drawings (e.g. `mascot-sentinel` keeps a narrow silhouette as a
  literal until per-slot narrow variants are fleshed out).
- **Fallback**: unknown variant slugs are silently skipped so a typo
  in a payload can't crash the render.

### What's next on this axis

- **Mode-driven variants** — today mouth + eyes react to mode inside
  the Mascot component. Moving them into slot variants (`eyes-
  dreaming`, `mouth-thinking`, etc.) is the Phase 11 shape; needs a
  way to pipe the current mode into `PortraitSpec`.
- **Companion / environment slots** — a floating object beside the
  head, subtle glyphs around it. Seeded by future cosmetics.
- **Anchors / compatibility rules** — right now slots are independent.
  If we ship a variant that requires a specific crown (e.g. an
  "oversized aureole" that needs heavy borders to not look awkward),
  we'll add an `anchors` field and validate on equip.

## Memory categories (Phase 11)

Today covered by the `memories` table with five tags + existing
companion tables:

- **Session memory** — the current conversation (live in client state;
  not persisted).
- **Personal memory** — operator facts (`fact` tag).
- **Relationship memory** — people + things they care about (`rel`).
- **Project / thread memory** — ongoing situations (`thread`).
- **Emotional weather** — feelings, moods (`feeling`).
- **World / system memory** — what the unit has noticed about itself
  and its shared context with the operator (`world` tag — shipped
  Phase 11). Not facts about the operator; things like "we speak
  mostly late at night" or "the phosphor runs amber when I'm tired".
- **Cosmetic / state memory** — `operator_cosmetics` +
  `stage_transitions`.
- **Artifacts** — the `/timeline` view (shipped Phase 11) surfaces
  milestones as visible durable records: bind date, stage-ups,
  cosmetic unlocks. Future additions (first dream, first forget,
  anniversaries) can slot in with no schema change if derived from
  existing tables, or with a lightweight `operator_events` table for
  anything that isn't already recorded.

**Raw history vs curated memory** — every message is already persisted
as raw history (`messages`). Memories extracted via `<remember>` are
the curated layer. An operator-curated third layer (a `/keep` command
that promotes a transcript line into the ledger) is still on the
table; no concrete plan yet.

## Modes (Phase 11 — dreaming + recovering shipped; focused pending)

Current mascot states and what fires them:

| Mode        | Eye   | Mouth        | Fires when                                     |
|-------------|-------|--------------|------------------------------------------------|
| idle        | `●`   | `─────`      | default                                        |
| thinking    | `◦`   | `· · ·`      | `callModel` in flight before first chunk       |
| speaking    | `●`   | animated ▁▃  | stream chunks arriving                         |
| dreaming    | `⊖`   | animated ∼∽  | `/dream` slash running                         |
| recovering  | `╳`   | `╌╌╌╌╌`      | `triggerGlitch` (error / SSE fault); 2.4s fade |

Still planned: `focused` (triggered by sustained session — lots of
activity without an idle gap — extends tolerance for longer replies,
brightens eyes). Needs a trigger policy before it's worth shipping
(what counts as "sustained"?).

Per the mascot rule, reduced-motion users see a still frame for
dreaming + speaking animations.

## Commands as rituals, not flavour

Every slash in UNIT-X today maps to a real subsystem. We keep that
rule going forward.

| slash              | subsystem                                   |
|--------------------|---------------------------------------------|
| `/help`            | Shell — list directives                     |
| `/soul`            | Memory read (ledger partition)              |
| `/gallery`         | Cosmetics read + equip                      |
| `/save`            | acknowledgement (writes auto-happen)        |
| `/clear`           | Shell — local scroll wipe only              |
| `/who`             | Memory read (identity)                      |
| `/logout`          | Identity — session cookie clear             |
| `/dream`           | Mind — reverie prompt (+ dreaming mode)     |
| `/essence`         | Mind — portrait-from-ledger prompt          |
| `/forget <kw>`     | Memory write — soft-delete then sweep       |
| `/timeline`        | Artifact read — milestones across layers    |
| `/export`          | Memory read — full decrypt + download       |
| `/delete-account`  | Identity + Memory — hard cascade            |

Phase 12+ candidates: `/keep` (promote a transcript line to ledger),
`/mode <name>` (explicit mode switch for debug / focus), `/anniversary`
(seasonal ritual).

## Data-driven over hardcoded

Already follow this rule for cosmetics (catalogue + unlock DSL in
`lib/cosmetics/types.ts`), evolution (table of stage thresholds in
`lib/evolution.ts`). Carry it forward:

- **Portrait parts**: slot variants in a registry, not literals in
  component files.
- **Mode definitions**: table of `{ slug, portrait overrides, prompt
  addendum, allowed actions }`. New modes become data.
- **Prompt templates**: versioned fragments composable by Mind, not a
  monolithic string.
- **Artifact types**: same pattern as cosmetics.

## Risk register + simplification opportunities

| Risk                                                             | Mitigation                                  |
|------------------------------------------------------------------|---------------------------------------------|
| Provider lock-in on DeepSeek                                     | Mind layer stays provider-neutral; swap in `lib/llm/*` file only |
| Monolithic prompt builder in Terminal.tsx                        | Move to `lib/mind/prompt.ts` at Phase 10; keep build-a-string pure |
| Cosmetic payloads are opaque JSON — hard to validate at runtime  | Add a zod schema in `lib/cosmetics/types.ts`; validate on equip + migration |
| Slot-based portrait refactor touches many files                  | Ship alongside Phase 10; keep old stage templates as seeded presets |
| `messages` table grows unbounded                                 | Cold-archive after 2y (Phase 8 plan line; not yet wired)  |
| In-memory rate limits don't cross workers                        | Swap to `@upstash/ratelimit` when multi-instance traffic warrants |
| Stage demotion on absence is disabled                            | Intentional — re-evaluate if the "they were away" note lands wrong in practice |

## How this note gets updated

Every phase should leave this doc truer than it found it. If a phase
ships a piece of the target shape (e.g. the slot-based portrait), move
it from "planned" to reality here. If a phase reveals a risk we didn't
see, add it. Keep the tone short — this is a field guide, not a thesis.
