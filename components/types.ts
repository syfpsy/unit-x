export type Who = 'user' | 'agent' | 'sys';

export interface Message {
  id: number;
  who: Who;
  text: string;
  ts: number;
}

export type MemoryTag = 'fact' | 'rel' | 'thread' | 'feeling';

export interface Memory {
  id: number;
  text: string;
  tag: MemoryTag;
  ts: number;
}

export type MascotState = 'idle' | 'thinking' | 'speaking';

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

