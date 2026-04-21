'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Boot } from './Boot';
import { GlitchOverlay, ParticleBurst } from './Fx';
import { Identify } from './Identify';
import { IdleReverie } from './IdleReverie';
import { SidePanel } from './SidePanel';
import { SoulDoc } from './SoulDoc';
import { Terminal } from './Terminal';
import { PHOSPHORS, Tweaks } from './Tweaks';
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
    triggerSaveFlash('◆ soul · committed');
    setMessages((ms) => [
      ...ms,
      {
        id: Date.now(),
        who: 'sys',
        text: '> committed — thread flushed to /soul/',
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
              doSave={doSave}
              doClear={doClear}
              doLogout={doLogout}
              triggerGlitch={triggerGlitch}
              triggerSaveFlash={triggerSaveFlash}
              lastActivityRef={lastActivityRef}
              dreamTrigger={dreamTrigger}
              clearDreamTrigger={() => {}}
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
              />
            </div>
          )}
          <div className="region-hints">
            <div className="hints">
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
                <kbd>esc</kbd>close
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--violet)' }}>
                ◆ {tweaks.unitName} · bound to {operator || 'session'}
              </span>
            </div>
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

        {stage === 'boot' && (
          <Boot speed={1.2} onComplete={() => setStage('identify')} />
        )}
        {stage === 'identify' && (
          <Identify
            onAccept={(addr) => {
              setOperator(addr);
              setStage('live');
              triggerSaveFlash(`◆ operator bound · ${addr}`);
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
