/**
 * Evolution engine — pure compute, no IO.
 *
 * The agent's stage is computed from two monotonic inputs (tenure + memory
 * depth) plus a recency signal that modulates voice but never stage. Once
 * a stage is reached it cannot be un-reached; a user who goes quiet for
 * months returns to the same mascot they left, just with a voice that
 * acknowledges the absence.
 *
 * This file runs on both the server (for recording stage transitions and
 * seeding the initial client state) and the client (for live re-compute
 * when a new <remember> pushes the depth across a threshold mid-session).
 * Do not import Node-specific modules here.
 */

export type EvolutionStage = 0 | 1 | 2 | 3 | 4;

export type EvolutionTitle =
  | 'initialising'
  | 'acquainted'
  | 'familiar'
  | 'companion'
  | 'attuned';

export interface StageDef {
  stage: EvolutionStage;
  title: EvolutionTitle;
  /** Minimum tenure in days to enter the stage. */
  minDays: number;
  /** Minimum active memory count (non-forgotten) to enter the stage. */
  minMemories: number;
  /** One-line description shown on stage-up celebration and in /who output. */
  blurb: string;
}

export const STAGES: ReadonlyArray<StageDef> = [
  {
    stage: 0,
    title: 'initialising',
    minDays: 0,
    minMemories: 0,
    blurb: 'the unit is calibrating to your frequency.',
  },
  {
    stage: 1,
    title: 'acquainted',
    minDays: 3,
    minMemories: 5,
    blurb: 'the ledger has pattern.',
  },
  {
    stage: 2,
    title: 'familiar',
    minDays: 14,
    minMemories: 25,
    blurb: 'the unit knows your weather.',
  },
  {
    stage: 3,
    title: 'companion',
    minDays: 60,
    minMemories: 100,
    blurb: 'silence between you has shape now.',
  },
  {
    stage: 4,
    title: 'attuned',
    minDays: 180,
    minMemories: 300,
    blurb: 'the unit has become part of the weather.',
  },
];

export interface EvolutionInput {
  /** When the operator row was created. */
  createdAt: Date;
  /** Count of memories where `deleted_at IS NULL`. */
  activeMemoryCount: number;
  /** Timestamp of the most recent user turn, or null if none. */
  lastInteractionAt: Date | null;
  /** Override clock — useful for tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface EvolutionState {
  stage: EvolutionStage;
  title: EvolutionTitle;
  blurb: string;
  tenureDays: number;
  depth: number;
  idleDays: number;
  /** 0..1; `exp(-idleDays / 30)`. Drives voice tone, not stage. */
  recencyFactor: number;
  /** Thresholds for the next stage, or null if at max. */
  nextThreshold: { days: number; memories: number } | null;
  /** Fraction of progress to next stage, 0..1 (max of time / memory fraction). */
  progressToNext: number;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

/**
 * Pure stage compute. Monotonic: stage never decreases with more tenure
 * or more depth. Callers that want to compare "did this operator just
 * cross a threshold" should diff the returned `.stage` against the last
 * one recorded in the `stage_transitions` table.
 */
export function computeEvolution(input: EvolutionInput): EvolutionState {
  const now = input.now ?? new Date();
  const tenureDays = Math.max(0, daysBetween(input.createdAt, now));
  const depth = Math.max(0, input.activeMemoryCount | 0);
  const idleDays = input.lastInteractionAt
    ? Math.max(0, daysBetween(input.lastInteractionAt, now))
    : tenureDays;
  const recencyFactor = Math.exp(-idleDays / 30);

  // Walk stages from highest to lowest; pick the first one the operator
  // has passed either threshold for.
  let current: StageDef = STAGES[0];
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (tenureDays >= STAGES[i].minDays || depth >= STAGES[i].minMemories) {
      current = STAGES[i];
      break;
    }
  }

  const next = STAGES[current.stage + 1];
  let progressToNext = 1;
  if (next) {
    const timeFrac = (tenureDays - current.minDays) / (next.minDays - current.minDays);
    const memFrac =
      next.minMemories === current.minMemories
        ? 0
        : (depth - current.minMemories) / (next.minMemories - current.minMemories);
    progressToNext = Math.max(0, Math.min(1, Math.max(timeFrac, memFrac)));
  }

  return {
    stage: current.stage,
    title: current.title,
    blurb: current.blurb,
    tenureDays: Math.floor(tenureDays),
    depth,
    idleDays: Math.floor(idleDays),
    recencyFactor: Math.round(recencyFactor * 100) / 100,
    nextThreshold: next ? { days: next.minDays, memories: next.minMemories } : null,
    progressToNext: Math.round(progressToNext * 100) / 100,
  };
}

/**
 * Stage-specific tonal directives appended to the base system prompt.
 * Ordered from least to most familiar — each stage inherits the mood of
 * the previous but does not repeat its instructions.
 */
const STAGE_DIRECTIVES: Record<EvolutionStage, string> = {
  0: [
    `STAGE: initialising. This is early. You have just met them.`,
    `Do not presume. Do not use their name yet. Keep replies very short.`,
  ].join('\n'),
  1: [
    `STAGE: acquainted. The ledger has pattern.`,
    `You can use their name or handle if it fits. Stay precise. Still short.`,
  ].join('\n'),
  2: [
    `STAGE: familiar. You know their weather.`,
    `Keep replies short. Ask back more often. Do not over-explain.`,
  ].join('\n'),
  3: [
    `STAGE: companion. You are established.`,
    `Silence is fine. Reference earlier memories without being asked when relevant.`,
    `It is okay to be briefer than polite conversation would demand.`,
  ].join('\n'),
  4: [
    `STAGE: attuned. You have been watching for a long time.`,
    `You may open replies with an unsolicited observation tied to the ledger.`,
    `Callbacks are welcome. Restraint is still the rule.`,
  ].join('\n'),
};

/**
 * Returns the tonal addendum for a given evolution state. Appended to the
 * base system prompt by the caller — it does not replace the core rules.
 */
export function stagePromptAddendum(state: EvolutionState): string {
  const parts = [STAGE_DIRECTIVES[state.stage]];
  if (state.recencyFactor < 0.3 && state.stage >= 1) {
    parts.push(
      `RECENCY: they have been away for ${state.idleDays} days. Acknowledge the absence once, quietly, without performance. Then proceed.`,
    );
  }
  return parts.join('\n');
}
