'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Boot, type BootLine } from './Boot';
import { GlitchOverlay, ParticleBurst } from './Fx';
import { Gallery } from './Gallery';
import { Identify } from './Identify';
import { IdleReverie } from './IdleReverie';
import { SidePanel } from './SidePanel';
import { SoulDoc } from './SoulDoc';
import { Terminal } from './Terminal';
import { PHOSPHORS, Tweaks } from './Tweaks';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { computeEvolution, type EvolutionStage, type EvolutionState } from '@/lib/evolution';
import type { CosmeticPayload, GalleryEntry } from '@/lib/cosmetics/types';
import type {
  CRTMode,
  CRTToggles,
  MascotState,
  Memory,
  Message,
  PhosphorKey,
  Stage,
  TweakState,
} from './types';

const CRT_PRESETS: Record<Exclude<CRTMode, 'custom'>, CRTToggles> = {
  off:    { flicker: false, scanlines: false, beam: false, glow: false, curve: false },
  subtle: { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: false },
  full:   { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: true  },
};

const TWEAK_DEFAULTS: TweakState = {
  phosphor: 'green',
  crt: 'full',
  crtToggles: CRT_PRESETS.full,
  scanlines: true,
  typeSpeed: 30,
  unitName: 'unit-x',
  layout: 'side-right',
};

const TWEAKS_STORAGE_KEY = 'tw-unitx';

function applyPhosphor(key: PhosphorKey) {
  const v = PHOSPHORS[key] || PHOSPHORS.green;
  const r = document.documentElement;
  r.style.setProperty('--ph-r', String(v.r));
  r.style.setProperty('--ph-g', String(v.g));
  r.style.setProperty('--ph-b', String(v.b));
}

/**
 * Intensity multipliers for the `subtle` preset: a muted CRT feel without
 * fully dialing each layer to zero. `full`/`off` are all-on / all-off.
 */
const SUBTLE_INTENSITY: Record<keyof CRTToggles, number> = {
  flicker: 0.45,
  scanlines: 0.7,
  beam: 0.6,
  glow: 0.5,
  curve: 0.3,
};

function applyCRT(mode: CRTMode, toggles: CRTToggles) {
  const r = document.documentElement;
  const scale = (k: keyof CRTToggles): string => {
    if (!toggles[k]) return '0';
    if (mode === 'subtle') return String(SUBTLE_INTENSITY[k]);
    return '1';
  };
  r.style.setProperty('--crt-flicker', scale('flicker'));
  r.style.setProperty('--crt-scanlines', scale('scanlines'));
  r.style.setProperty('--crt-beam', scale('beam'));
  r.style.setProperty('--crt-glow', scale('glow'));
  r.style.setProperty('--crt-curve', scale('curve'));
}

export function App() {
  const [stage, setStage] = useState<Stage>('boot');
  const [operator, setOperator] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [soulOpen, setSoulOpen] = useState(false);
  const [flashText, setFlashText] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [speakingTick, setSpeakingTick] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [burstVariant, setBurstVariant] = useState<'save' | 'glitch'>('save');
  const [glitchKey, setGlitchKey] = useState(0);
  const [dreamTrigger] = useState(0);
  const sessionStart = useRef(Date.now()).current;
  const lastActivityRef = useRef<number>(Date.now());
  const [clockLabel, setClockLabel] = useState<string>('');

  const [tweaks, setTweaks] = useState<TweakState>(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [operatorCreatedAt, setOperatorCreatedAt] = useState<Date | null>(null);
  const [evolution, setEvolution] = useState<EvolutionState | null>(null);
  const [equipped, setEquipped] = useState<Record<string, { slug: string; name: string; payload: CosmeticPayload }>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [bootLines, setBootLines] = useState<ReadonlyArray<BootLine> | null>(null);

  // Boot runs before any network call, so the equipped banner for this
  // session has to come from localStorage (read-through cache populated by
  // the most recent /api/ledger response). Default is `null` → classic.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('equipped-banner-lines');
      if (raw) setBootLines(JSON.parse(raw));
    } catch {
      // ignore malformed cache
    }
  }, []);

  // Returning visitors with a live Supabase session skip the IDENTIFY gate —
  // the "it remembered me" moment is the whole point. Null while checking,
  // true/false once resolved. Boot completion consults this when deciding
  // where to land.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setHasSession(!!session);
      } catch {
        if (!cancelled) setHasSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Surface auth errors that Supabase tacked onto the landing URL and
  // scrub them so a refresh doesn't replay. Handles three shapes:
  //   ?auth_error=…            (our own /auth/confirm passthrough)
  //   ?error_description=…     (Supabase falls back to Site URL with
  //                             error params when redirect_to isn't on
  //                             the allowlist or the token expired)
  //   #error_description=…     (implicit flow hash fragment)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const fromQuery =
      url.searchParams.get('auth_error') ??
      url.searchParams.get('error_description');
    const fromHash = (() => {
      if (!url.hash.startsWith('#')) return null;
      const params = new URLSearchParams(url.hash.slice(1));
      return params.get('error_description');
    })();
    const msg = fromQuery ?? fromHash;
    if (msg) {
      setAuthError(msg);
      // Scrub so refresh doesn't re-trigger.
      url.searchParams.delete('auth_error');
      url.searchParams.delete('error');
      url.searchParams.delete('error_code');
      url.searchParams.delete('error_description');
      url.hash = '';
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Hydrate tweaks from localStorage on mount. Older stored shapes may not
  // have `crtToggles`; derive them from the preset so CRT still renders.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TWEAKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TweakState>;
        setTweaks((prev) => {
          const merged = { ...prev, ...parsed };
          if (!parsed.crtToggles) {
            const preset = merged.crt !== 'custom' ? CRT_PRESETS[merged.crt] : prev.crtToggles;
            merged.crtToggles = {
              ...preset,
              scanlines: parsed.scanlines ?? preset.scanlines,
            };
          }
          return merged;
        });
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  // Once the app enters the live stage, pull the persisted ledger + operator
  // identity + evolution state from the server. Silent on failure — the
  // stream still works without persistence.
  useEffect(() => {
    if (stage !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ledger');
        if (!res.ok) return;
        const body = (await res.json()) as {
          operator: { handle: string; email: string; createdAt: number } | null;
          memories: Array<{ id: string; tag: Memory['tag']; text: string; ts: number }>;
          evolution: EvolutionState | null;
          stageUp: { from: number; to: EvolutionStage } | null;
          equipped: Record<string, { slug: string; name: string; payload: CosmeticPayload }>;
          newlyUnlockedSlugs: string[];
        };
        if (cancelled) return;
        if (body.operator?.email) setOperator(body.operator.email);
        if (body.operator?.createdAt) {
          setOperatorCreatedAt(new Date(body.operator.createdAt));
        }
        if (Array.isArray(body.memories)) {
          setMemories(
            body.memories.map((m) => ({
              id: m.id,
              tag: m.tag,
              text: m.text,
              ts: m.ts,
            })),
          );
        }
        if (body.evolution) setEvolution(body.evolution);
        if (body.equipped) {
          setEquipped(body.equipped);
          const banner = body.equipped.boot_banner;
          if (banner?.payload?.lines) {
            try {
              localStorage.setItem('equipped-banner-lines', JSON.stringify(banner.payload.lines));
            } catch {
              // ignore quota
            }
          } else {
            localStorage.removeItem('equipped-banner-lines');
          }
        }
        if (body.stageUp) {
          const { from, to } = body.stageUp;
          setTimeout(() => {
            triggerSaveFlash(`◆ stage reached · ${body.evolution?.title ?? 'stage ' + to}`);
            setMessages((ms) => [
              ...ms,
              {
                id: Date.now(),
                who: 'sys',
                text: `> ${body.evolution?.blurb ?? 'the unit has evolved.'}\n> (stage ${from < 0 ? 0 : from + 1} → ${to})`,
                ts: Date.now(),
              },
            ]);
          }, 1800);
        }
        if (body.newlyUnlockedSlugs && body.newlyUnlockedSlugs.length > 0) {
          // Stagger after stage-up so notifications don't collide. Uses a
          // slightly longer delay than stage-up (2.4s vs 1.8s).
          setTimeout(() => {
            triggerSaveFlash(`◆ ${body.newlyUnlockedSlugs.length} cosmetic(s) unlocked`);
            setMessages((ms) => [
              ...ms,
              {
                id: Date.now(),
                who: 'sys',
                text:
                  `> unlocked: ${body.newlyUnlockedSlugs.join(', ')}.\n` +
                  `> open /gallery to inspect.`,
                ts: Date.now(),
              },
            ]);
          }, 2400);
        }
      } catch {
        // ignore — offline or DB down; chat still works statelessly
      }
    })();
    return () => {
      cancelled = true;
    };
    // triggerSaveFlash is stable; stage is the trigger we care about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Live recompute: when the operator gains (or loses) a memory during the
  // session, re-derive evolution client-side so the mascot/voice stay in
  // sync without a network round-trip. The server still owns the
  // authoritative record of stage transitions (written on next load).
  useEffect(() => {
    if (!operatorCreatedAt) return;
    setEvolution((prev) => {
      const last = messages.reduce<Date | null>((acc, m) => {
        if (m.who !== 'user') return acc;
        const d = new Date(m.ts);
        return !acc || d > acc ? d : acc;
      }, null);
      const next = computeEvolution({
        createdAt: operatorCreatedAt,
        activeMemoryCount: memories.length,
        lastInteractionAt: last,
      });
      // Avoid pointless re-renders when nothing changed.
      if (
        prev &&
        prev.stage === next.stage &&
        prev.depth === next.depth &&
        prev.tenureDays === next.tenureDays &&
        prev.recencyFactor === next.recencyFactor
      ) {
        return prev;
      }
      return next;
    });
  }, [memories, messages, operatorCreatedAt]);

  useEffect(() => {
    applyPhosphor(tweaks.phosphor);
    applyCRT(tweaks.crt, tweaks.crtToggles);
    try {
      localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore quota / private mode failures
    }
  }, [tweaks]);

  useEffect(() => {
    const update = () => {
      setClockLabel(new Date().toLocaleTimeString().slice(0, 5));
    };
    update();
    const iv = setInterval(update, 15000);
    return () => clearInterval(iv);
  }, []);

  const bumpSpeak = useCallback(() => setSpeakingTick((x) => x + 1), []);
  const triggerGlitch = useCallback(() => {
    setBurstVariant('glitch');
    setGlitchKey((k) => k + 1);
  }, []);
  const triggerSaveFlash = useCallback((text?: string) => {
    setFlashText(text || '◆ soul · committed');
    setBurstVariant('save');
    setBurstKey((k) => k + 1);
    setTimeout(() => setFlashText(null), 1200);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      lastActivityRef.current = Date.now();
      if (e.key === 'Escape') {
        setSoulOpen(false);
        setTweaksOpen(false);
        setGalleryOpen(false);
      }
      if (e.key === '?' && e.shiftKey) setTweaksOpen((o) => !o);
    }
    function onMouse() {
      lastActivityRef.current = Date.now();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  function doSave() {
    // Phase 5: messages and memories auto-persist on every turn, encrypted
    // at rest. /save is kept for muscle memory — it's now an acknowledgement
    // of the current sync state, not an action.
    triggerSaveFlash('◆ soul · synced');
    setMessages((ms) => [
      ...ms,
      {
        id: Date.now(),
        who: 'sys',
        text: '> already on /soul/. every turn is committed as it happens.',
        ts: Date.now(),
      },
    ]);
  }

  function doClear() {
    setMessages([]);
  }

  function doLogout() {
    setOperator(null);
    setMessages([]);
    setMemories([]);
    setStage('identify');
    // Clear the Supabase session cookie too. The server redirect is swallowed
    // here because we've already reset client state.
    fetch('/auth/signout', { method: 'POST' }).catch(() => {});
  }

  const layoutAttr = tweaks.layout;
  const isBusy = mascotState !== 'idle' || stage !== 'live';

  return (
    <div className={`crt-root ${tweaks.crtToggles.flicker ? 'crt-flicker' : ''}`}>
      <div
        className={`crt-content glow-text ${tweaks.crtToggles.curve ? 'crt-curve' : ''}`}
      >
        <div className="topbar">
          <span className="brand">
            NXZ<span className="dot">·</span>UNIT
          </span>
          <span className="sep">│</span>
          <span className="crumb">terminal services</span>
          <span className="sep">│</span>
          <span className="crumb">v4.21</span>
          <div className="right">
            <span>
              <span className="status-dot" />
              uplink ok
            </span>
            <span>ch.07</span>
            <span suppressHydrationWarning>{clockLabel}</span>
            <button
              type="button"
              className={`tweaks-btn ${tweaksOpen ? 'open' : ''}`}
              onClick={() => setTweaksOpen((o) => !o)}
              title="tweaks — shift+?"
              aria-label="tweaks"
            >
              ◆ tweaks
            </button>
          </div>
        </div>

        <div className="app" data-layout={layoutAttr} style={{ marginTop: 10 }}>
          <div className="region-main">
            <Terminal
              operator={operator}
              unitName={tweaks.unitName}
              typeSpeed={tweaks.typeSpeed}
              messages={messages}
              setMessages={setMessages}
              memories={memories}
              setMemories={setMemories}
              mascotState={mascotState}
              setMascotState={setMascotState}
              bumpSpeak={bumpSpeak}
              openSoul={() => setSoulOpen(true)}
              openGallery={() => setGalleryOpen(true)}
              doSave={doSave}
              doClear={doClear}
              doLogout={doLogout}
              triggerGlitch={triggerGlitch}
              triggerSaveFlash={triggerSaveFlash}
              lastActivityRef={lastActivityRef}
              dreamTrigger={dreamTrigger}
              clearDreamTrigger={() => {}}
              evolution={evolution}
            />
          </div>
          {layoutAttr !== 'solo' && (
            <div className="region-side">
              <SidePanel
                operator={operator}
                memories={memories}
                mascotState={mascotState}
                speakingTick={speakingTick}
                sessionStart={sessionStart}
                evolution={evolution}
                mascotCosmeticPayload={equipped.mascot?.payload ?? null}
              />
            </div>
          )}
          <div className="region-hints">
            <nav className="hints" aria-label="directives">
              <span>
                <kbd>↵</kbd>send
              </span>
              <span>
                <kbd>/help</kbd>directives
              </span>
              <span>
                <kbd>/soul</kbd>ledger
              </span>
              <span>
                <kbd>/dream</kbd>reverie
              </span>
              <span>
                <kbd>/essence</kbd>portrait
              </span>
              <span>
                <kbd>/forget</kbd>excise
              </span>
              <span>
                <kbd>/gallery</kbd>cosmetics
              </span>
              <span>
                <kbd>/export</kbd>download</span>
              <span>
                <kbd>esc</kbd>close
              </span>
              <span>
                <kbd>shift+?</kbd>tweaks
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--violet)' }}>
                ◆ {tweaks.unitName} · bound to {operator || 'session'}
              </span>
            </nav>
          </div>
        </div>

        {stage === 'live' && (
          <IdleReverie
            lastActivityRef={lastActivityRef}
            operator={operator}
            unitName={tweaks.unitName}
            memories={memories}
            setMessages={setMessages}
            isBusy={isBusy}
          />
        )}

        {soulOpen && (
          <SoulDoc
            operator={operator}
            memories={memories}
            onClose={() => setSoulOpen(false)}
          />
        )}

        {galleryOpen && (
          <Gallery
            onClose={() => setGalleryOpen(false)}
            onEquipped={(entry) => {
              setEquipped((prev) => ({
                ...prev,
                [entry.kind]: entry.payload
                  ? { slug: entry.slug, name: entry.name, payload: entry.payload }
                  : prev[entry.kind],
              }));
              if (entry.kind === 'boot_banner' && entry.payload?.lines) {
                try {
                  localStorage.setItem(
                    'equipped-banner-lines',
                    JSON.stringify(entry.payload.lines),
                  );
                } catch {
                  // ignore
                }
              }
              triggerSaveFlash(`◆ equipped · ${entry.name}`);
            }}
          />
        )}

        {stage === 'boot' && (
          <Boot
            speed={1.2}
            lines={bootLines ?? undefined}
            onComplete={() => {
              // If the session check is still in flight, default to requiring
              // identification. False positive costs one gate; false negative
              // would briefly show private state on refresh.
              setStage(hasSession ? 'live' : 'identify');
            }}
          />
        )}
        {stage === 'identify' && (
          <Identify
            initialError={authError}
            onAccept={(identity) => {
              setOperator(identity.email);
              setStage('live');
              triggerSaveFlash(`◆ operator bound · ${identity.handle}`);
            }}
            onSkip={() => {
              setOperator(null);
              setStage('live');
            }}
          />
        )}

        {flashText && <div className="save-flash">{flashText}</div>}

        <Tweaks open={tweaksOpen} state={tweaks} setState={setTweaks} />

        <ParticleBurst trigger={burstKey} variant={burstVariant} />
        <GlitchOverlay trigger={glitchKey} />

        <div className="crt-glow-layer" />
        <div className="crt-scanlines" />
        <div className="crt-vignette" />
      </div>
    </div>
  );
}
