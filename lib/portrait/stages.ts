import type { EvolutionStage } from '@/lib/evolution';
import type { PortraitSpec } from './types';

/**
 * Default slot assignment per evolution stage. Translated 1:1 from the
 * hand-written templates that used to live in `components/mascots/
 * stages.ts` — same visual output, just assembled from parts.
 *
 * Accretion pattern:
 *   - Stage 0: head + body + base. No neck, no jaw, no base plate.
 *   - Stage 1: + inner jaw, neck, thin base plate.
 *   - Stage 2: + antenna.
 *   - Stage 3: all borders go heavy (round-heavy), base plate widens.
 *   - Stage 4: + aureole, crown + cap become square-heavy.
 */
export const STAGE_SPECS: Record<EvolutionStage, PortraitSpec> = {
  0: {
    slots: {
      crown: 'round-light',
      body: 'default',
      base_cap: 'round-light',
    },
  },
  1: {
    slots: {
      crown: 'round-light',
      body: 'default',
      inner_jaw: 'light',
      base_cap: 'round-light',
      neck: 'five-strut',
      base_plate: 'thin',
    },
  },
  2: {
    slots: {
      antenna: 'dot',
      crown: 'round-light',
      body: 'default',
      inner_jaw: 'light',
      base_cap: 'round-light',
      neck: 'five-strut',
      base_plate: 'thin',
    },
  },
  3: {
    slots: {
      antenna: 'dot',
      crown: 'round-heavy',
      body: 'default',
      inner_jaw: 'heavy',
      base_cap: 'round-heavy',
      neck: 'five-strut',
      base_plate: 'wide',
    },
  },
  4: {
    slots: {
      overhead: 'aureole-3',
      antenna: 'dot',
      crown: 'square-heavy',
      body: 'default',
      inner_jaw: 'heavy',
      base_cap: 'square-heavy',
      neck: 'five-strut',
      base_plate: 'wide',
    },
  },
};
