import type { EvolutionStage } from '@/lib/evolution';
import type { MemoryTag } from '@/components/types';

export type CosmeticKind =
  | 'mascot'
  | 'boot_banner'
  | 'phosphor_palette'
  | 'idle_art'
  | 'frame'
  | 'divider';

export type UnlockRule =
  | { type: 'always' }
  | { type: 'tenure_days'; min: number }
  | { type: 'memories_total'; min: number }
  | { type: 'memories_by_tag'; tag: MemoryTag; min: number }
  | { type: 'stage_reached'; stage: EvolutionStage };

export interface CosmeticPayload {
  /** mascot: a literal ASCII template with `E` (eyes) and `M` (mouth) markers. */
  template?: string;
  /** mascot: delegate to the stage-based renderer instead of a fixed template. */
  delegate?: 'stage' | 'default';
  /** boot_banner: explicit line array (type + string). */
  lines?: Array<{ t: 'dim' | 'faint' | 'ok' | 'violet' | 'warn'; s: string }>;
}

export interface CosmeticRow {
  id: string;
  slug: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  payload: CosmeticPayload;
  unlockRule: UnlockRule;
}

export interface OwnerCtx {
  tenureDays: number;
  memoriesTotal: number;
  memoriesByTag: Partial<Record<MemoryTag, number>>;
  evolutionStage: EvolutionStage;
}

export interface GalleryEntry {
  slug: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  unlocked: boolean;
  equipped: boolean;
  /** Short human-readable hint of what it takes to unlock. Computed server-side. */
  lockHint: string | null;
  /** Full payload is only included when unlocked — prevents spoiling previews. */
  payload: CosmeticPayload | null;
}
