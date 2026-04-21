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

## Portrait system (composable target)

Today the mascot is one of five stage templates plus optional
cosmetic overrides. The target is slot-based — the five templates
stay as presets, but each becomes a composition of named parts so
cosmetics, evolution stage, mode, and milestone unlocks can each
modify specific slots without the art files being the source of truth.

### Slots (planned)

```
portrait
├── aureole    (above the crown — earned ornamentation)
├── antenna    (single strut + tip)
├── crown      (top border: light | heavy | doubled)
├── head_shell (outer silhouette)
├── eyes       (violet; per-mode glyph)
├── mouth      (5-char mouth; per-mode state)
├── jaw        (inner chin detail or null)
├── base_shell (bottom border)
├── neck       (struts)
├── base_plate (tap pattern + width)
├── companion  (object floating beside — earned)
└── environment (subtle background glyphs — earned)
```

### Render spec (planned)

```ts
interface PortraitSpec {
  stage: 0 | 1 | 2 | 3 | 4;
  mode: 'idle' | 'thinking' | 'speaking' | 'dreaming' | 'recovering' | 'focused';
  slots: Partial<Record<SlotName, SlotVariantSlug>>;
  palette: { phosphor: PhosphorKey; accent?: AccentKey };
}
```

- **Variants** live in a catalogue (same pattern as cosmetics) with
  unlock rules.
- **Anchors** let variants declare which other slots they're compatible
  with (e.g. aureole + heavy crown is allowed; aureole + no crown is a
  fallback to a lighter aureole).
- **Fallback**: if a slot variant isn't unlocked, render the default
  for that stage.
- **Overlays** (damage marks, seasonal glyphs) stack above the base
  render and don't replace slots.

This is a refactor, not a rewrite. Today's five stage templates become
"stage-N default" slot assignments in the new registry; every existing
cosmetic becomes a `{ slot, variant }` entry. See the planning note
under Phase 10 for the migration path.

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
