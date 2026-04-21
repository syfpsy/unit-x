export type Who = 'user' | 'agent' | 'sys';

export interface Message {
  id: string | number;
  who: Who;
  text: string;
  ts: number;
}

export type MemoryTag = 'fact' | 'rel' | 'thread' | 'feeling' | 'world';

export interface Memory {
  /** UUID string when hydrated from DB; numeric timestamp when created client-side. */
  id: string | number;
  text: string;
  tag: MemoryTag;
  ts: number;
}

export type MascotState =
  | 'idle'
  | 'thinking'
  | 'speaking'
  | 'dreaming'    // during /dream reverie — half-lidded eyes, flowing mouth
  | 'recovering'; // brief state after a glitch/error — dim, post-shock

export type Stage = 'boot' | 'identify' | 'live';

export type PhosphorKey = 'green' | 'amber' | 'cyan' | 'violet' | 'white';

export type CRTMode = 'off' | 'subtle' | 'full' | 'custom';

export type LayoutMode = 'side-right' | 'side-left' | 'solo';

export interface CRTToggles {
  flicker: boolean;
  scanlines: boolean;
  beam: boolean;
  glow: boolean;
  curve: boolean;
}

export interface TweakState {
  phosphor: PhosphorKey;
  crt: CRTMode;
  /** Individual CRT layer toggles. Take effect when crt === 'custom'. */
  crtToggles: CRTToggles;
  /** @deprecated use crtToggles.scanlines — kept for backward-compat storage reads. */
  scanlines: boolean;
  typeSpeed: number;
  unitName: string;
  layout: LayoutMode;
}

