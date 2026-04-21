# UNIT-X — Build Plan

> A terminal-aesthetic AI companion that keeps a private, encrypted ledger
> of its operator and visibly evolves with tenure and memory depth.
>
> This file is the single source of truth for the product roadmap. Future
> coding agents land here first; the in-repo plan beats any guess from
> training data. Update the status line at the top of each phase when its
> scope ships, and append a dated entry to the change log at the bottom.

---

## Contents

1. [Premise](#premise)
2. [Current state (what's actually live)](#current-state)
3. [Architectural decisions (locked)](#architectural-decisions)
4. [Phases](#phases)
   - [Phase 1 — Port](#phase-1--port-to-nextjsts--done) (done)
   - [Phase 2 — Streaming model](#phase-2--streaming-model--server-side-remember--done) (done)
   - [Phase 3 — Postgres persistence](#phase-3--postgres-persistence--done) (done)
   - [Phase 4 — Identity & session](#phase-4--identity--session-supabase--magic-link--google)
   - [Phase 5 — Persistence + at-rest encryption](#phase-5--persistence-hook-up--at-rest-encryption)
   - [Phase 6 — Evolution engine](#phase-6--evolution-engine)
   - [Phase 7 — ASCII cosmetics](#phase-7--ascii-cosmetics--unlock-system)
   - [Phase 8 — Hardening](#phase-8--hardening)
   - [Phase 9 — Polish & launch](#phase-9--polish--launch)
   - [Phase 10 — Future](#phase-10--future-not-blocking-launch)
5. [Glossary](#glossary)
6. [Change log](#change-log)

---

## Premise

UNIT-X is **not a helpful assistant**. It's a lifelong companion that keeps a
ledger of the person it's bound to. The whole product is the feeling that
something is remembering you carefully, visibly aging alongside you on a
fictional CRT. Every decision gets evaluated against that premise.

**Immutable constraints** (do not drift):

- Black bg, phosphor-green default text, JetBrains Mono, CRT stack
  (flicker / scanlines / beam / glow / curvature).
- `nxyz` violet `#6D5EF7` is the **only** accent colour. No second hue.
- `prefers-reduced-motion` disables flicker / beam / glitch / curvature /
  breathe / blink / pulse. Colour and layout unchanged.
- Memory protocol: `<remember tag="fact|rel|thread|feeling">phrase</remember>`.
  Max one per model reply. ≤80 chars. Four tags only.
- Slash commands do not drift: `/help /soul /save /clear /who /logout
  /dream /essence /forget`. Phases may _add_ slashes (`/gallery`, `/export`,
  `/delete-account`) but must not rename or remove existing ones.

---

## Current state

**Live:** <https://unit-x-eta.vercel.app> from <https://github.com/syfpsy/unit-x>.

| Thing | Where | Notes |
|---|---|---|
| Every user turn | Postgres `messages` | Fire-and-forget from `/api/complete` |
| Every agent reply (clean, `<remember>` stripped) | `messages` | Inserted on stream close |
| Every `<remember>` | Postgres `memories` with `tag`, `text`, `deleted_at` | `/forget` flips `deleted_at` — tombstone, soft-delete |
| UI preferences | Browser `localStorage` | Per device only |
| Identity | **Single shared dev operator** | Everyone hitting prod writes to the same ledger — removed in Phase 4 |

**Stack:** Next.js 16 App Router + TypeScript + Tailwind v4 (Turbopack
default), React 19.2, Drizzle ORM + `@neondatabase/serverless` (HTTP
driver — single-statement, no transactions), DeepSeek V3 via
OpenAI-compatible `/v1/chat/completions` streaming. Neon Postgres. Vercel
hosting with GitHub auto-deploy from `main`.

**What is not real yet:**

- Auth (IDENTIFY is theatrical — fake setTimeout chain).
- Per-user data isolation.
- Encryption beyond TLS + Neon disk-level AES-256.
- Rate limits.
- Retention / GDPR surfaces.
- Evolution, cosmetics, observability.

---

## Architectural decisions

Locked decisions we do not relitigate without a specific reason:

1. **Encryption is column-level from Phase 5, not retrofitted later.** Adding
   encryption to an existing plaintext DB is painful. Envelope encryption
   (server-held master key, per-user derived DEK) is the target.
2. **Never log message/memory content.** Logger wrapper enforces redaction
   (`text`, `content`, `email`, any `DATABASE_URL` or `sk-*`). Baked in from
   Phase 8 onward.
3. **Evolution computation is pure.** `computeEvolution(operator, memories,
   now)` returns state; no DB writes, no randomness. Testable, cacheable,
   replay-safe.
4. **Cosmetics are data, not code.** ASCII art + unlock rules live in DB
   seed files. New cosmetic = migration, not release.
5. **Service-role keys never ship to the client.** Anon key + RLS enforce
   access in the browser; service role only in server handlers.
6. **Versioned prompts.** Every system-prompt template (base, dream, essence,
   stage variants) has a `version` field so tonal A/B tests don't compromise
   consistency.
7. **Provider layer is swappable.** The prompt-builder does not import
   DeepSeek. It produces messages; a thin `lib/llm/*.ts` handles the
   provider. Swap to Claude / GPT / local by changing that file.
8. **`<remember>` stripping stays server-side.** Client never sees a partial
   tag. The left-to-right scanner in `app/api/complete/route.ts` is the
   canonical implementation — do not revert to `lastIndexOf('<')`.

---

## Phases

### Phase 1 — Port to Next.js/TS  [DONE]

**Status:** shipped.

- Claude-Design HTML/JSX prototype under `tony/project/` ported to Next.js
  15+ App Router in `tony/unit-x/`, TypeScript, Tailwind v4.
- All 10 components (App, Boot, Identify, Terminal, SidePanel, SoulDoc,
  Mascot, Tweaks, Fx, IdleReverie) converted `.jsx → .tsx` with proper
  types.
- `prefers-reduced-motion` CSS block + `usePrefersReducedMotion` hook for
  JS-driven FX (particle burst, glitch overlay).
- `window.claude.complete` left as a dev stub.

### Phase 2 — Streaming model + server-side `<remember>`  [DONE]

**Status:** shipped. DeepSeek V3 live.

- `/api/complete` route handler: POST → DeepSeek SSE → transform stream →
  emit `{ type: 'chunk' | 'memory' | 'done' | 'error' }` events.
- Server-side extraction of `<remember>` tags. Buffering heuristic: hold
  anything from a `<` onward **only if** the tail could still become
  `<remember` (compared against the literal opener one char at a time).
  A `<` clearly not building toward the tag (e.g. `a < b`) passes through.
- Client SSE reader (`lib/claudeClient.ts`) with `onChunk / onMemory /
  onError` callbacks feeds the existing typewriter.
- Tweaks panel gained a visible `◆ TWEAKS` topbar button + hints-bar entry
  (`shift+?`) so settings are discoverable.
- CRT split: preset (`off | subtle | full | custom`) + 5 individual layer
  toggles (flicker / scanlines / beam / glow / curve).

### Phase 3 — Postgres persistence  [DONE]

**Status:** shipped with a **single shared dev operator**.

- Drizzle schema: `operators(id, email, handle, created_at)`,
  `messages(id, operator_id, who, text, ts)`,
  `memories(id, operator_id, tag, text, created_at, deleted_at)`.
- `/api/complete` writes the user turn, every `<remember>` memory event,
  and the clean agent text on stream close (all fire-and-forget so
  streaming never blocks on DB).
- `/api/ledger` (GET) — active memories, newest-first, reversed to
  chronological for prompt assembly.
- `/api/forget` (POST `{keyword}`) — soft-deletes matching memories.
- Client hydrates memories from `/api/ledger` when the app enters the
  `live` stage.
- Non-interactive migration runner at `scripts/migrate.mjs` because
  `drizzle-kit push` needs a TTY.
- Neon Postgres provisioned via `vercel integration add neon`.

---

### Phase 4 — Identity & session (Supabase + magic link + Google)

**Goal:** kill the shared operator. Every visitor is a distinct identity
with a private ledger. Replace the theatrical IDENTIFY card's
`setTimeout` chain with real network states.

**Provider choice: Supabase** (pivoted from the original "custom JWT +
Resend" plan). Why:

- Magic link + Google OAuth in one SDK. No Resend infra to maintain.
- Row-Level Security (RLS) makes "operator A cannot see operator B's
  memories" a Postgres policy, not just app logic — defense in depth.
- `@supabase/ssr` integrates cleanly with App Router via cookies + a
  middleware shim.

**Data move:** migrate Postgres from **Neon → Supabase Postgres** (same
Drizzle schema; one migration run). Single vendor for auth + data,
billing, and RLS. Keep Neon only if there's a strong reason (we'd then
verify Supabase JWTs manually against an external DB — more code).

**Schema deltas:**

- `operators.auth_user_id uuid` FK → `auth.users(id)`.
- `operators.email` becomes non-null (sourced from Supabase).
- Drop every code path that creates a dev operator implicitly.
- RLS policies:
  - `messages` / `memories`: `using (operator_id in (select id from
    operators where auth_user_id = auth.uid()))` for select/insert/update/delete.

**IDENTIFY gate redesign (keep the aesthetic):**

- ASCII keyhole art stays. `[Y] proceed` expands into two choices:
  - `◆ google` — `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - `◆ magic link` — email input, POSTs to Supabase which emails a link.
- Step states (`sending / verifying / ok`) become real:
  - `sending` = network request in flight
  - `verifying` = token exchanged after redirect
  - `ok` = session cookie set, redirect to `live`
- `[n] skip — session only`: the anonymous path stays but is **truly
  ephemeral**. No operator row is created; no API calls persist; chat
  works only in-memory. On refresh, everything's gone. This matches the
  prototype's original contract.

**Routes:**

- `GET /auth/callback` — Supabase redirects here with a code; exchanges
  for session; sets cookie; redirects to `/`.
- `GET /auth/verify` — magic-link landing. Same exchange flow.
- `POST /auth/signout` — called by `/logout`; signs out of Supabase,
  clears cookies.

**Server helpers:**

- `lib/auth/server.ts` — `getOperator(request): Promise<Operator | null>`
  using the Supabase SSR client. Wraps "find-or-create operators row
  keyed by `auth_user_id`".
- All API handlers get the operator from the session; `getOrCreateDevOperator()`
  is deleted.

**UX notes:**

- `/who` now reports the real email and handle.
- `/logout` tears down the session cookie + clears local state + returns
  to the `identify` stage.
- Prompting for re-auth is gated behind Supabase's built-in token
  refresh; middleware handles it.

---

### Phase 5 — Persistence hook-up + at-rest encryption

**Original Phase 5 goal (preserved):** every surface reads from the DB,
not from client state. `/soul`, `/dream`, `/essence` operate on the full
persisted ledger. Cross-device continuity. That was the whole point.

**Current reality:** Phase 3 already did most of this. `/api/ledger`
hydrates on mount; `/dream` and `/essence` read from the hydrated state;
`<remember>` inserts; `/forget` soft-deletes. What's **not** yet DB-sourced:

- `SoulDoc.tsx` partitions the **client-side** `memories` array. If the
  client state diverges from the DB (race, stale refresh), the doc lies.
- Dream/essence pull from the prompt context which is re-hydrated from
  `/api/ledger` at mount — that's correct, just worth keeping an eye on
  as sessions grow long.
- `/save` is cosmetic. Messages auto-persist every turn. Decide in Phase
  5 whether `/save` becomes a no-op with flash, a "checkpoint" marker, or
  gets quietly retired.

**New in Phase 5: encryption at rest.**

**Threat model:** a DB dump or SQL-read leak should NOT expose
conversation content. A total server compromise (attacker has the master
key and running code) is **out of scope** — the server needs plaintext to
build prompts. This is deliberately not end-to-end encryption.

**Technique: envelope encryption.**

- Server-held `UNITX_MASTER_KEY` (32 bytes, Vercel env, never committed).
- Per-user **Data Encryption Key (DEK)** derived via HKDF-SHA256 from
  `(master_key, auth_user_id)`. Deterministic → no DEK table needed.
- `messages.text` and `memories.text` encrypted with AES-256-GCM using
  DEK + a random 96-bit nonce per row. Auth tag appended to ciphertext.
- Storage: new `bytea` columns (`text_cipher`, `nonce`); drop the
  plaintext `text` column after backfill.
- Plaintext metadata (needed for filtering / indexes / RLS):
  `operator_id`, `who`, `tag`, `ts`, `deleted_at`.

**Key rotation:**

- `UNITX_MASTER_KEY_PREV` supported during rotation. Try decrypt with
  current key first, fall back to previous. Re-encrypt rows lazily on
  read or via a batch script.
- `scripts/rotate-keys.mjs` written alongside the first encryption
  deployment so rotation is boring from day one.

**`/forget` becomes real.** Soft-delete stays for the 30-day grace period
(user can recover via support). After grace, a retention job overwrites
the ciphertext columns with zeros. Real forgetting, not just a
tombstone.

**Schema deltas:**

```
messages: + text_cipher bytea, + nonce bytea, - text
memories: + text_cipher bytea, + nonce bytea, - text
```

One-shot backfill migration encrypts existing rows using the master key.

---

### Phase 6 — Evolution engine

**Goal:** the agent visibly ages alongside the operator. Tenure, memory
depth, and interaction recency all feed a single stage number that drives
voice, visual, and unlocks. This is what separates UNIT-X from a chatbot.

**Inputs** (all server-computed):

- **Tenure** — days since `operators.created_at`.
- **Depth** — count of active (`deleted_at IS NULL`) memories.
- **Recency** — exponential decay based on last user turn. A stage-3
  user who vanishes for 6 months drifts back toward stage 2's voice until
  they return.

**Stages:**

| Stage | Title           | Trigger (max of either)    | What changes |
|-------|-----------------|----------------------------|---|
| 0     | initialising    | day 0 · 0 memories         | Default mascot. Voice: precise, careful, first-meeting vibe. |
| 1     | acquainted      | day 3 OR 5 memories        | Sharper eyes. Voice references specific names. |
| 2     | familiar        | day 14 OR 25 memories      | Mascot gains a small adornment (antenna / crown mark). Voice shorter still, more questions back. |
| 3     | companion       | day 60 OR 100 memories     | Ornamented mascot frame. Subtle phosphor pulse on speaking. Voice allows silence and callbacks ("you said this in october…"). |
| 4     | attuned         | day 180 OR 300 memories    | Fully embellished mascot. Occasional unsolicited `/dream` during idle. Per-session greeting referencing a recent thread. |

**Implementation:**

- `lib/evolution.ts` — pure function `computeEvolution({ createdAt,
  activeMemoryCount, lastInteractionAt, now }) → EvolutionState`.
- `EvolutionState` = `{ stage, tenureDays, depth, recencyFactor,
  unlockedCosmetics[] }`.
- System prompt includes a stage section. Higher stages get additional
  tonal directives (more licence for silence, more callback licence).
- `<Mascot>` accepts `evolution` prop; renders the matching ASCII
  template from `components/mascots/stage-N.tsx` — each file owned and
  tweakable individually.
- **Stage transitions** fire exactly once: server emits an `evolution`
  SSE event when it detects a level-up since last session; client shows
  a celebration burst (violet particles, a sys-line `> stage reached ·
  attuned`, and any cosmetic unlocked by that stage).

**Testing:**

- `computeEvolution` gets unit tests for every stage boundary ±1 day
  and ±1 memory.
- Stage-up celebration surfaces exactly once per transition (idempotency
  via a `stage_transitions(operator_id, stage, reached_at)` table).

---

### Phase 7 — ASCII cosmetics + unlock system

**Goal:** the user accumulates a visible wardrobe of earned items.
Cosmetics are what the evolution milestones actually _reward_ with.

**Schema:**

```
cosmetics (catalogue, seeded):
  id, slug, kind, name, ascii_data|config,
  unlock_rule jsonb, created_at

operator_cosmetics (ownership):
  operator_id, cosmetic_id, unlocked_at, equipped bool,
  primary key (operator_id, cosmetic_id)
```

**`kind` values:** `mascot | boot_banner | phosphor_palette | idle_art | frame | divider`.

**Unlock rule DSL (opaque JSON interpreted server-side):**

```json
{ "type": "tenure_days", "min": 7 }
{ "type": "memories", "min": 10, "tag": "rel" }
{ "type": "slash_count", "slash": "/dream", "min": 3 }
{ "type": "event", "event": "first_forget" }
{ "type": "anniversary", "day_of_year_relative": 0 }
```

**Seed catalogue (launch set ≈ 12 items):**

- 3 mascot variants (including the default + 2 adornment variants).
- 3 boot banners (including `rem.v2` unlocked at 3rd dream, commemorating
  the reverie cycle).
- 2 extra phosphor palettes (e.g. amber on milestone; deep-sea teal on
  long tenure).
- 2 idle-art patterns for reverie background.
- 2 decorative frames (e.g. "tombstone" divider unlocked after first
  `/forget` — acknowledges the weight of excising something).

**UI — `/gallery` (new slash):** full-screen modal styled like `/soul`.
Each row shows locked/unlocked/equipped state + the unlock hint ("unlocks
on day 30 · 18 days remaining"). Click to preview on the live UI, click
again to equip.

**Persistence:** equipped state lives on `operator_cosmetics.equipped`;
client hydrates alongside memories.

---

### Phase 8 — Hardening

Absorbs the original Phase 6 (rate limits, error UX, logs, retention,
tests, health, secrets rotation) plus the encryption-adjacent
retention/export work from Phase 5.

**Rate limits (Upstash Redis):**

- `/api/complete`: N tokens/minute per operator (tune: maybe 20/min).
- `/api/forget`: stricter (maybe 5/min) since it's destructive.
- `/auth/*`: standard IP-based (Supabase has some of this but we add our
  own for app-specific logic).

**Error surfaces:**

- Server errors bubble to the existing `<GlitchOverlay>` — already wired,
  now with readable copy ("uplink fault · retry in a moment") instead of
  stack traces.
- 5xx on the home page → a static IDENTIFY-style card saying the
  terminal is offline.

**Logging (never log message/memory content):**

- `pino` + redaction config stripping `text`, `content`, `email`,
  `DATABASE_URL`, anything matching `sk-*`.
- Vercel logs → Axiom for structured queryability.
- Sentry for client exceptions (frame capture only, no DOM content).

**Retention:**

- Soft-deleted memories: ciphertext zeroed after 30 days.
- Messages: auto-archive (cold table, still encrypted) after 2 years.
- Anonymous (skip path) sessions: nothing to retain — no persistence.

**Tests:**

- Unit: `<remember>` parser (all boundary cases), encryption round-trip,
  `computeEvolution` per stage boundary.
- Integration: auth flow (Playwright), memory CRUD, `/forget` cascade.
- Health check: `GET /api/health` → asserts DB connectivity + DeepSeek
  reachable.

**GDPR / user control:**

- `/export` slash → zip of decrypted messages + memories + cosmetic
  inventory. Delivered via email (signed link, 24h TTL).
- `/delete-account` slash → double-confirm, then hard wipe (operators →
  cascade).

**Secrets rotation docs:**

- Runbook for `UNITX_MASTER_KEY`, `DEEPSEEK_API_KEY`, Supabase keys, DB
  password. Document the `UNITX_MASTER_KEY_PREV` dance.

---

### Phase 9 — Polish & launch

Original Phase 7 content, tightened.

**Accessibility pass:**

- Keyboard traversal verified on every overlay: IDENTIFY (Y/n + email
  input + buttons), SoulDoc, Tweaks, `/gallery`, `/forget` countdown.
- `prefers-reduced-motion` re-verified on **every** animated element:
  flicker, beam, curve, glitch, particle burst, breathing, blink,
  status-dot pulse, save-flash, stage-up celebration, mascot
  frame-cycling.
- Screen-reader labels where the aesthetic allows. The mascot gets alt
  text ("UNIT-X · standby"), input row announces placeholders, hints bar
  is a proper `<nav>`.

**Domain + hosting:**

- Custom domain (candidate: `unit-x.art`, `nxyz.art`, or your pick).
  Vercel alias + canonical redirect.
- Environment discipline: staging vs prod vs preview with separate
  `UNITX_MASTER_KEY`s.
- Monitoring: uptime (Better Stack), latency dashboards (Axiom).

**Copy:**

- Privacy policy + ToS written in the terminal voice but legally real.
  Review by a human who reads contracts.
- Cookie banner: decline-by-default, single "acknowledge" button (we
  use strictly-necessary cookies only for auth).

**Opengraph:**

- OG image is `/essence` rendered into a PNG at request time for the
  logged-in user; anonymous version is a static sigil.

**Launch cadence:**

- Waitlist → gradual opening to ~100 users → stress-test encryption and
  evolution stage-ups in the wild → public.

---

### Phase 10 — Future (not blocking launch)

Parking-lot items worth keeping on paper so they don't get proposed as
novel later:

- **Semantic recall via pgvector.** Embed each memory at write time
  (after decryption, inside the server function), store encrypted
  embedding. Similarity search at query time — enables "it reminded me
  of what you said last winter" moments.
- **Voice mode.** TTS of agent replies in a phosphor-timbre synthetic
  voice. Toggle in Tweaks.
- **Multi-agent philosophy.** Let operators spin up a second UNIT sharing
  the same ledger but with a different name/voice. Open question:
  should units talk to each other when the operator's away?
- **Export your soul.** Portable JSON + a standalone static viewer HTML
  page. People who delete their account leave with everything.
- **Local-only mode.** For privacy-maximalists: everything in IndexedDB,
  model call proxied but no persistence on our servers.

---

## Glossary

- **Operator** — a bound user. In Phase 3, one shared row; from Phase 4, one
  per authenticated identity.
- **Ledger** — the set of active (non-forgotten) memories for an operator.
- **Soul** — the fictional path `/soul/{handle}.md`. A framing device —
  not a real file. The `/soul` slash opens the doc viewer.
- **`<remember>` tag** — model-emitted structured memory. Stripped
  server-side; emitted to the client as a structured event; persisted.
- **Evolution stage** — integer 0–4 computed from tenure / depth /
  recency. Drives voice variants, mascot variants, cosmetic unlocks.
- **Cosmetic** — an unlockable ASCII art element (mascot / banner /
  palette / idle art / frame).

---

## Change log

- **2026-04-21** — Plan written. Phases 1–3 complete; Phase 4 next
  (Supabase, replacing original "custom JWT + Resend"). Phases 5–9
  expanded to include envelope encryption, the evolution engine, the
  cosmetics system, and GDPR surfaces. Phase 10 captures future parking
  lot. Original Phase 5/6/7 content preserved and merged into the new
  5/8/9 respectively.
- **2026-04-21** — Phase 4 shipped. Neon → Supabase Postgres migration,
  `@supabase/ssr` wired through `proxy.ts` + server/browser clients,
  IDENTIFY gate rewritten with `[Y] proceed → { ◆ google | ◆ magic
  link }` and a truly ephemeral skip path. Schema delta (`auth_user_id`
  on operators + RLS policies) applied via a non-interactive migration.
  `/auth/callback`, `/auth/confirm`, `/auth/signout` live. Every handler
  now resolves the operator from the Supabase session via
  `lib/auth/getOperator`. Switched DB driver from
  `@neondatabase/serverless` to `postgres.js` (Supavisor-compatible).
  Live at https://unit-x-eta.vercel.app. Magic link works out of the
  box; Google OAuth requires one-time configuration in the Supabase
  dashboard + Google Cloud (see next-steps note in agent memory).
- **2026-04-21** — Phase 6 shipped. Evolution engine live.
  `lib/evolution.ts` is a pure function (runs on both sides) that maps
  (tenure, active memory count, last-interaction recency) → one of five
  stages: initialising, acquainted, familiar, companion, attuned.
  Stage triggers on `max(tenure, depth)`; recency modulates voice but
  never stage. New `stage_transitions(operator_id, stage, reached_at)`
  table with composite PK + RLS records first-time entries; the client
  fires a one-shot celebration when `/api/ledger` returns a `stageUp`.
  `<Mascot>` renders one of 5 ASCII templates (accretive: antenna →
  refined border → aureole). `buildSystemPrompt` appends stage-specific
  tonal addendums and a recency note if the operator has been silent
  for >60 days. SidePanel exposes `stage · title`, tenure, and an `evo`
  progress bar. 9 boundary unit cases pass; seeded E2E against live
  Supabase confirms a backdated operator lands at stage 4 with all 5
  transition rows written and idempotent on replay.
- **2026-04-21** — Phase 5 shipped. Envelope encryption at rest.
  `UNITX_MASTER_KEY` (32 bytes, base64) lives in Vercel env only.
  HKDF-SHA256 derives a per-operator DEK (salt = operator_id UUID,
  info = "unitx-dek-v1"); AES-256-GCM with a random 96-bit nonce per
  row. Storage: `text_cipher bytea` holds ciphertext ‖ auth tag; `nonce
  bytea` is 12 bytes. `messages` and `memories` both migrated; the
  prior plaintext `text` columns are dropped. Rotation-aware:
  `UNITX_MASTER_KEY_PREV` is tried as a fallback on decrypt, and
  `scripts/rotate-keys.mjs` re-wraps every row in a single pass.
  `scripts/retention-sweep.mjs` zeros soft-deleted memory ciphertext
  past a 30-day grace window (scheduling punted to Phase 8). `/save`
  is now honest about already-synced state. `softForget` fetches +
  decrypts + filters in memory (SQL LIKE is impossible against
  ciphertext). End-to-end verified against live Supabase via
  `scripts/smoke-encrypt.mjs` — raw DB row contains only ciphertext.
