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

## Memory categories (planned split)

The current `memories` table covers four tags — `fact | rel | thread |
feeling` — and does most of what we need. The target is a fuller
split:

- **Session memory** — the current conversation (live in client state;
  not persisted).
- **Personal memory** — operator facts (current `fact` tag).
- **Relationship memory** — people + things they care about (current
  `rel`).
- **Project / thread memory** — ongoing situations (current `thread`).
- **Emotional weather** — feelings, moods (current `feeling`).
- **World / system memory** — things the unit knows about _itself_ and
  its environment (not yet represented — candidate for Phase 11).
- **Cosmetic / state memory** — already isolated in
  `operator_cosmetics` + `stage_transitions`.
- **Artifacts** (Phase 11 candidate) — visible, earned durable records
  that live alongside memories: badges, relics, scars (from `/forget`),
  timeline entries, essence captures. Raw rows in a table; some become
  cosmetics; some appear in `/soul` under a new section.

**Raw history vs curated memory** — every message is already persisted
as raw history (`messages`). Memories extracted via `<remember>` are
the curated layer. When Phase 11 arrives we may add a third layer: the
operator's own curations (a `/keep` command that promotes a line from
the transcript into the ledger explicitly).

## Modes (planned expansion)

Today the mascot has three states: idle / thinking / speaking. The
target is six, each affecting portrait state, voice, and available
actions:

| Mode        | Portrait                | Voice                               |
|-------------|-------------------------|-------------------------------------|
| standby     | breathing + soft glow   | base — short fragments              |
| listening   | eyes focus              | no reply; log turns only            |
| thinking    | pupils dilate (`◦`)     | `> parsing` placeholder             |
| speaking    | mouth animation         | streaming reply                     |
| dreaming    | eyes half-lidded (`⊖`)  | `~` prefix, free association        |
| recovering  | flicker + dim phosphor  | shortened, terse, post-error        |
| focused     | brighter eyes, frame    | longer tolerance, bigger context    |

These overlap our current cosmetic/evolution state. Adding them is a
Shell + Mind change; Memory already has the structure.

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
| `/dream`           | Mind — reverie prompt                       |
| `/essence`         | Mind — portrait-from-ledger prompt          |
| `/forget <kw>`     | Memory write — soft-delete then sweep       |
| `/export`          | Memory read — full decrypt + download       |
| `/delete-account`  | Identity + Memory — hard cascade            |

Phase 10+ candidates: `/keep` (promote a transcript line to ledger),
`/timeline` (visible artifact history), `/mode <name>` (explicit mode
switch for debug / focus / dream).

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
