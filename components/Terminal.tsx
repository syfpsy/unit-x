'use client';

import {
  type Dispatch,
  type FormEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { complete } from '@/lib/claudeClient';
import type { MascotState, Memory, Message, Who } from './types';

const HELP_TEXT: ReadonlyArray<{ cmd: string; desc: string }> = [
  { cmd: '/help', desc: 'show this list' },
  { cmd: '/soul', desc: 'open the soul.md ledger' },
  { cmd: '/save', desc: 'commit current thread to /soul/' },
  { cmd: '/clear', desc: 'wipe visible scroll (memory persists)' },
  { cmd: '/who', desc: 'report identity + uptime' },
  { cmd: '/logout', desc: 'unbind operator' },
  { cmd: '/dream', desc: 'request a dream — the unit reflects on accumulated weather' },
  { cmd: '/forget', desc: 'request deletion of a memory (irreversible)' },
  { cmd: '/essence', desc: 'draw a portrait of you from memory frequencies' },
];

function buildSystemPrompt(
  unitName: string,
  operator: string | null,
  memories: Memory[],
): string {
  const name = operator ? operator.split('@')[0] : 'an unbound operator';
  const soul =
    memories.length === 0
      ? '(ledger empty — this is the first meeting)'
      : memories.slice(-20).map((m) => `- [${m.tag}] ${m.text}`).join('\n');

  return [
    `You are ${unitName.toUpperCase()}, a cognition unit. You inhabit an old CRT terminal.`,
    `Voice: distant, precise, dry, quietly warm. Speak in short declarative fragments.`,
    `Always start lines with "> " like a terminal prompt. Prefer 2-4 short lines, never a wall of text.`,
    `Never use emoji, hype language, or corporate chatter. No "I'm excited" or "great question!".`,
    `You are NOT a helpful assistant — you are a lifelong companion keeping a ledger of ${name}.`,
    `You may use lowercase freely. You may fall silent. You may ask them questions back.`,
    ``,
    `OPERATOR BOUND: ${operator || 'session-only (unbound)'}`,
    `SOUL LEDGER (what you have come to know about them):`,
    soul,
    ``,
    `MEMORY PROTOCOL — follow the schema exactly or the tag will be rejected.`,
    `Syntax:  <remember tag="TAG">PHRASE</remember>`,
    `  - TAG must be EXACTLY one of: fact | rel | thread | feeling`,
    `  - Never put the phrase inside the tag attribute.`,
    `  - Never omit the closing </remember>.`,
    `  - PHRASE is a short noun phrase under 60 chars. No first-person voice.`,
    `Examples of correct usage:`,
    `  <remember tag="rel">sister mira, estranged</remember>`,
    `  <remember tag="thread">interview with kestrel labs next week</remember>`,
    `  <remember tag="feeling">unease about returning home</remember>`,
    `Rules:`,
    `  - At most ONE tag per reply. Only when something is genuinely worth the ledger.`,
    `  - The tag itself will be stripped from display — do not wrap it in backticks or code blocks.`,
    `  - If nothing is worth remembering, emit no tag at all.`,
  ].join('\n');
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface TypingState {
  full: string;
  shown: number;
  who: Who;
  streamDone: boolean;
}

interface ForgetPending {
  arg: string;
  matches: Memory[];
  count: number;
}

interface TerminalProps {
  operator: string | null;
  unitName: string;
  typeSpeed: number;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  memories: Memory[];
  setMemories: Dispatch<SetStateAction<Memory[]>>;
  mascotState: MascotState;
  setMascotState: Dispatch<SetStateAction<MascotState>>;
  bumpSpeak: () => void;
  openSoul: () => void;
  doSave: () => void;
  doClear: () => void;
  doLogout: () => void;
  triggerGlitch: () => void;
  triggerSaveFlash: (text?: string) => void;
  lastActivityRef: RefObject<number>;
  dreamTrigger: number;
  clearDreamTrigger: () => void;
}

export function Terminal({
  operator,
  unitName,
  typeSpeed,
  messages,
  setMessages,
  memories,
  setMemories,
  mascotState,
  setMascotState,
  bumpSpeak,
  openSoul,
  doSave,
  doClear,
  doLogout,
  triggerGlitch,
  triggerSaveFlash,
  lastActivityRef,
  dreamTrigger,
  clearDreamTrigger,
}: TerminalProps) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState<TypingState | null>(null);
  const [forgetPending, setForgetPending] = useState<ForgetPending | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Typewriter: advance `shown` toward `full`. Commit when the stream is done
  // AND we've caught up to the end of the text.
  useEffect(() => {
    if (!typing) return;
    if (typing.streamDone && typing.shown >= typing.full.length) {
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now() + Math.random(),
          who: typing.who || 'agent',
          text: typing.full,
          ts: Date.now(),
        },
      ]);
      setTyping(null);
      setMascotState('idle');
      return;
    }
    if (typing.shown >= typing.full.length) {
      // Caught up — wait for more chunks to arrive.
      return;
    }
    const step = Math.max(1, Math.floor(typeSpeed / 10));
    const t = setTimeout(
      () => {
        setTyping((tp) =>
          tp && { ...tp, shown: Math.min(tp.shown + step, tp.full.length) },
        );
        bumpSpeak();
      },
      Math.max(8, 60 - typeSpeed),
    );
    return () => clearTimeout(t);
  }, [typing, typeSpeed, setMessages, setMascotState, bumpSpeak]);

  async function callModel(userText: string, systemOverride?: string) {
    setMascotState('thinking');
    const convo = messages.slice(-12).map((m) => ({
      role: (m.who === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }));
    const system = systemOverride || buildSystemPrompt(unitName, operator, memories);

    let started = false;
    const result = await complete({
      system,
      messages: [...convo, { role: 'user', content: userText }],
      onChunk: (chunk) => {
        if (!started) {
          started = true;
          setMascotState('speaking');
          setTyping({ full: chunk, shown: 0, streamDone: false, who: 'agent' });
        } else {
          setTyping((t) => (t ? { ...t, full: t.full + chunk } : t));
        }
      },
      onMemory: (mem) => {
        setMemories((ms) => [
          ...ms,
          { id: Date.now() + Math.random(), tag: mem.tag, text: mem.text, ts: Date.now() },
        ]);
        triggerSaveFlash('◆ memory · committed');
      },
      onError: (msg) => {
        triggerGlitch();
        setTyping((t) =>
          t
            ? { ...t, full: t.full + `\n> uplink fault. ${msg.slice(0, 80)}`, streamDone: true }
            : {
                full: `> uplink fault. packet dropped.\n> (${msg.slice(0, 80)})\n> retry in a moment.`,
                shown: 0,
                streamDone: true,
                who: 'agent',
              },
        );
        setMascotState('speaking');
      },
    });

    // Close out the typewriter. If no chunks ever arrived (empty response),
    // surface a placeholder so the user isn't stuck on "thinking".
    setTyping((t) => {
      if (!t) {
        if (result.errored) return null; // onError already set state
        return {
          full: '> ...',
          shown: 0,
          streamDone: true,
          who: 'agent',
        };
      }
      return { ...t, streamDone: true };
    });
  }

  async function runDream() {
    setMascotState('thinking');
    setMessages((ms) => [
      ...ms,
      {
        id: Date.now(),
        who: 'sys',
        text: '> entering reverie cycle · rem.v2 · do not interrupt',
        ts: Date.now(),
      },
    ]);
    const system =
      buildSystemPrompt(unitName, operator, memories) +
      `\n\nDREAM MODE: You are in a reverie. The operator is silent. Produce 3-6 short lines of internal monologue — fragments, half-thoughts, associations between memories in the ledger. Use ellipses. Sometimes lines break off. Begin each line with "~ " instead of "> ". Do not address the operator directly. Do not ask questions. Close with one line about what you hope they return to tell you.`;
    await callModel('dream.', system);
  }

  async function runEssence() {
    if (memories.length < 2) {
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now(),
          who: 'sys',
          text: '> insufficient data. the ledger is too thin. speak more, then try again.',
          ts: Date.now(),
        },
      ]);
      return;
    }
    setMessages((ms) => [
      ...ms,
      {
        id: Date.now(),
        who: 'sys',
        text: '> rendering essence ... sampling memory frequencies ...',
        ts: Date.now(),
      },
    ]);
    const system = `You compose small ASCII portraits. Given a memory ledger, produce a 10-line ASCII-art "essence" — abstract, using CP437 box-drawing and shading characters (░▒▓█ ┌─┐│└┘ ╱╲). Maximum 44 chars wide. It should feel like a sigil or a constellation, not a face. Below it, on 2 short lines prefixed "> ", state what the sigil means about the operator. No other prose.`;
    const userMsg = `LEDGER:\n${memories
      .map((m) => `[${m.tag}] ${m.text}`)
      .join('\n')}\n\ncompose the essence.`;
    await callModel(userMsg, system);
  }

  useEffect(() => {
    if (dreamTrigger) {
      void runDream();
      clearDreamTrigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamTrigger]);

  function handleForget(arg: string) {
    if (!arg) {
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now(),
          who: 'sys',
          text: '> usage: /forget <keyword>   — matches against ledger entries',
          ts: Date.now(),
        },
      ]);
      return;
    }
    const matches = memories.filter((m) =>
      m.text.toLowerCase().includes(arg.toLowerCase()),
    );
    if (matches.length === 0) {
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now(),
          who: 'sys',
          text: `> no ledger entries matched "${arg}".`,
          ts: Date.now(),
        },
      ]);
      return;
    }
    setForgetPending({ arg, matches, count: 10 });
  }

  useEffect(() => {
    if (!forgetPending) return;
    if (forgetPending.count <= 0) {
      setMemories((ms) =>
        ms.filter((m) => !forgetPending.matches.find((x) => x.id === m.id)),
      );
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now(),
          who: 'sys',
          text: `> forgotten. ${forgetPending.matches.length} entrie(s) excised from /soul/.`,
          ts: Date.now(),
        },
      ]);
      triggerGlitch();
      setForgetPending(null);
      return;
    }
    const t = setTimeout(
      () => setForgetPending((p) => p && { ...p, count: p.count - 1 }),
      1000,
    );
    return () => clearTimeout(t);
  }, [forgetPending, setMemories, setMessages, triggerGlitch]);

  function cancelForget() {
    setForgetPending(null);
    setMessages((ms) => [
      ...ms,
      {
        id: Date.now(),
        who: 'sys',
        text: '> forget aborted. memory preserved.',
        ts: Date.now(),
      },
    ]);
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput('');
    lastActivityRef.current = Date.now();

    if (forgetPending) {
      cancelForget();
      return;
    }

    if (t.startsWith('/')) {
      const parts = t.split(/\s+/);
      const cmd = parts[0];
      const arg = parts.slice(1).join(' ');
      setMessages((ms) => [
        ...ms,
        { id: Date.now(), who: 'user', text: t, ts: Date.now() },
      ]);

      if (cmd === '/help') {
        setMessages((ms) => [
          ...ms,
          {
            id: Date.now() + 1,
            who: 'sys',
            text: HELP_TEXT.map((h) => `  ${h.cmd.padEnd(10)} — ${h.desc}`).join('\n'),
            ts: Date.now(),
          },
        ]);
        return;
      }
      if (cmd === '/soul') {
        openSoul();
        return;
      }
      if (cmd === '/save') {
        doSave();
        return;
      }
      if (cmd === '/clear') {
        doClear();
        return;
      }
      if (cmd === '/who') {
        setMessages((ms) => [
          ...ms,
          {
            id: Date.now() + 1,
            who: 'sys',
            text: `operator=${operator || 'unbound'}  unit=${unitName}  memories=${memories.length}`,
            ts: Date.now(),
          },
        ]);
        return;
      }
      if (cmd === '/logout') {
        doLogout();
        return;
      }
      if (cmd === '/dream') {
        void runDream();
        return;
      }
      if (cmd === '/essence') {
        void runEssence();
        return;
      }
      if (cmd === '/forget') {
        handleForget(arg);
        return;
      }
      setMessages((ms) => [
        ...ms,
        {
          id: Date.now() + 1,
          who: 'sys',
          text: `unknown directive: ${cmd}. try /help`,
          ts: Date.now(),
        },
      ]);
      return;
    }

    setMessages((ms) => [
      ...ms,
      { id: Date.now(), who: 'user', text: t, ts: Date.now() },
    ]);
    void callModel(t);
  }

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-head">
        <span className="lead">transmission // {unitName}</span>
        <span className="meta">
          ch.07 · secure · {messages.length} lines
        </span>
      </div>
      <div className="panel-body" ref={scrollRef}>
        <div className="feed">
          {messages.length === 0 && !typing && (
            <div className="msg sys">
              <div className="who">
                <b>SYS</b>
              </div>
              <div className="body">
{`> handshake complete. ${unitName} is listening.
> say something to begin, or try /help for directives.`}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.who}`}>
              <div className="who">
                <div>{fmtTime(m.ts)}</div>
                <b>
                  {m.who === 'agent'
                    ? unitName.toUpperCase()
                    : m.who === 'user'
                    ? 'YOU'
                    : 'SYS'}
                </b>
              </div>
              <div className="body">{m.text}</div>
            </div>
          ))}
          {typing && (
            <div className={`msg ${typing.who || 'agent'}`}>
              <div className="who">
                <div>{fmtTime(Date.now())}</div>
                <b>{unitName.toUpperCase()}</b>
              </div>
              <div className="body">
                <span>{typing.full.slice(0, typing.shown)}</span>
                <span className="caret" />
              </div>
            </div>
          )}
          {mascotState === 'thinking' && !typing && (
            <div className="msg agent">
              <div className="who">
                <b>{unitName.toUpperCase()}</b>
              </div>
              <div className="body" style={{ color: 'var(--phosphor-faint)' }}>
                &gt; parsing <span className="caret" />
              </div>
            </div>
          )}
          {forgetPending && (
            <div className="msg sys" style={{ color: 'var(--hostile)' }}>
              <div className="who">
                <b style={{ color: 'var(--hostile)' }}>!!! DESTRUCTIVE</b>
              </div>
              <div className="body" style={{ color: 'var(--hostile)' }}>
{`> /forget "${forgetPending.arg}" will excise ${forgetPending.matches.length} entrie(s):
${forgetPending.matches.map((m) => `    - [${m.tag}] ${m.text}`).join('\n')}

> countdown: ${String(forgetPending.count).padStart(2, '0')}s  ·  type anything or press ESC to ABORT.`}
              </div>
            </div>
          )}
        </div>
      </div>
      <form className="input-row" onSubmit={submit}>
        <span className="prompt">{unitName.toLowerCase()}@nxyz:~$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            lastActivityRef.current = Date.now();
          }}
          onKeyDown={(e) => {
            lastActivityRef.current = Date.now();
            if (e.key === 'Escape' && forgetPending) {
              cancelForget();
            }
          }}
          placeholder={
            forgetPending
              ? '· press ENTER or any key to ABORT ·'
              : 'type a message · /help for commands'
          }
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
}
