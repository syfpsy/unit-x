import type { NextRequest } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { insertMemory, insertMessage } from '@/lib/db/ledger';
import { anonKey, checkRateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import type { MemoryTag } from '@/components/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CompleteBody {
  system: string;
  messages: ChatMessage[];
  temperature?: number;
}

type SseEvent =
  | { type: 'chunk'; text: string }
  | { type: 'memory'; tag: 'fact' | 'rel' | 'thread' | 'feeling'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const REMEMBER_REGEX = /<remember\s+tag="(fact|rel|thread|feeling)">([\s\S]+?)<\/remember>/gi;
const REMEMBER_OPENER = '<remember';

/**
 * True iff `tail` starts with (a prefix of) "<remember". Used to decide
 * whether a `<` encountered mid-stream might still complete into a full
 * <remember tag="…">…</remember>. Anything that clearly can't (like
 * "< 3" or "<div>") is rejected so we don't buffer it forever.
 */
function couldBeRememberPrefix(tail: string): boolean {
  const n = Math.min(tail.length, REMEMBER_OPENER.length);
  return tail.slice(0, n) === REMEMBER_OPENER.slice(0, n);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    return sseError('missing DEEPSEEK_API_KEY in server env', 500);
  }

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return sseError('invalid request body', 400);
  }
  if (!body?.system || !Array.isArray(body?.messages)) {
    return sseError('request must include { system, messages }', 400);
  }

  // Resolve the operator once so the rate limiter, persistence writes,
  // and stream transformer all share the same lookup. An auth failure
  // downgrades to the anonymous (ephemeral) path.
  let authedOperator: Awaited<ReturnType<typeof getOperator>> = null;
  try {
    authedOperator = await getOperator();
  } catch {
    authedOperator = null;
  }

  // Rate limit — keyed by operator if authed, IP otherwise. 15 burst,
  // 15/minute sustained. Cheap in-memory token bucket (lib/ratelimit.ts);
  // swap for @upstash/ratelimit if we ever need cross-worker state.
  const rateKey = authedOperator ? `op:${authedOperator.id}` : anonKey(req);
  const rl = checkRateLimit(rateKey, { capacity: 15, refillPerSec: 0.25 });
  if (!rl.allowed) {
    log.warn('complete rate-limited', { key: rateKey, retryMs: rl.retryAfterMs });
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        message: `rate limited — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`,
      })}\n\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
      {
        status: 429,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: body.temperature ?? 0.7,
        messages: [
          { role: 'system', content: body.system },
          ...body.messages,
        ],
      }),
    });
  } catch (err) {
    return sseError(`upstream fetch failed: ${String((err as Error).message)}`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text().catch(() => '')).slice(0, 200);
    return sseError(`upstream ${upstream.status}: ${detail || 'no body'}`, 502);
  }

  // Persist the user turn if we have an operator. Ephemeral visitors
  // (skip path) just stream — nothing written to DB.
  const operatorId: string | null = authedOperator?.id ?? null;
  if (operatorId) {
    const userText = body.messages[body.messages.length - 1]?.content ?? '';
    if (userText) {
      void insertMessage({ operatorId, who: 'user', text: userText }).catch((err) => {
        log.warn('complete insertMessage failed', { err });
      });
    }
  }

  const stream = transformUpstream(upstream.body, abort, operatorId);

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

function transformUpstream(
  upstream: ReadableStream<Uint8Array>,
  abort: AbortController,
  operatorId: string | null,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Full accumulator of model output — used for <remember> scanning.
  let buffer = '';
  // How many chars of `buffer` have already been emitted to the client as chunks.
  let emitted = 0;
  // Mirror of `buffer` with all <remember> tags stripped, used to persist the
  // agent's final displayed text when the stream closes.
  let cleanText = '';

  function send(ctrl: ReadableStreamDefaultController<Uint8Array>, evt: SseEvent) {
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
  }

  /**
   * Emits safe, remember-stripped text from the unsent window of `buffer`.
   *
   * Strategy:
   *  1. Extract every complete <remember tag="…">…</remember> that falls inside
   *     the unsent window. For each, emit the text before the match as a chunk,
   *     then emit a `memory` event, then advance past the match.
   *  2. What remains after step 1 may still contain a partial opening tag
   *     (e.g. "<remem"). When `final` is false, hold everything from the LAST
   *     `<` onward so the client never sees a partial `<remember…>`. On
   *     `final`, flush the tail as-is.
   */
  function drain(ctrl: ReadableStreamDefaultController<Uint8Array>, final: boolean) {
    let unsent = buffer.slice(emitted);

    // Step 1: extract complete remember blocks.
    REMEMBER_REGEX.lastIndex = 0;
    let out = '';
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    const memEvents: Extract<SseEvent, { type: 'memory' }>[] = [];
    while ((match = REMEMBER_REGEX.exec(unsent)) !== null) {
      out += unsent.slice(lastEnd, match.index);
      memEvents.push({
        type: 'memory',
        tag: match[1] as 'fact' | 'rel' | 'thread' | 'feeling',
        text: match[2].trim().slice(0, 80),
      });
      lastEnd = match.index + match[0].length;
    }
    let remainder = unsent.slice(lastEnd);

    // Step 2: walk `remainder` left-to-right. For each `<` we find, decide
    // whether it could still grow into a `<remember …>`; if so, hold from
    // that `<` onward. Any `<` that clearly can't (e.g. "< 3") is emitted
    // as plain text so we don't buffer forever.
    let safeOut = '';
    let held = '';
    let cursor = 0;
    while (cursor < remainder.length) {
      const ltIdx = remainder.indexOf('<', cursor);
      if (ltIdx === -1) {
        safeOut += remainder.slice(cursor);
        cursor = remainder.length;
        break;
      }
      safeOut += remainder.slice(cursor, ltIdx);
      const tail = remainder.slice(ltIdx);
      if (couldBeRememberPrefix(tail)) {
        held = tail;
        cursor = remainder.length;
        break;
      }
      // Not a remember opener — emit the `<` verbatim and keep scanning.
      safeOut += '<';
      cursor = ltIdx + 1;
    }

    if (final) {
      // Stream is closing — flush anything we were holding. Partial tags at
      // EOF are malformed; surface them as text rather than swallow silently.
      safeOut += held;
      held = '';
    }
    out += safeOut;

    if (out) {
      send(ctrl, { type: 'chunk', text: out });
      cleanText += out;
    }
    for (const evt of memEvents) {
      send(ctrl, evt);
      if (operatorId) {
        void insertMemory({
          operatorId,
          tag: evt.tag as MemoryTag,
          text: evt.text,
        }).catch(() => {});
      }
    }

    // Advance emitted pointer past everything we just shipped.
    emitted = buffer.length - held.length;
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let sseBuf = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });

          // DeepSeek streams OpenAI-compatible SSE: each event is terminated
          // by a blank line. An event has one or more `data: …` lines.
          const events = sseBuf.split('\n\n');
          sseBuf = events.pop() ?? '';

          for (const evt of events) {
            for (const line of evt.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const obj = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = obj.choices?.[0]?.delta?.content;
                if (delta) {
                  buffer += delta;
                  drain(controller, false);
                }
              } catch {
                // ignore malformed SSE fragments
              }
            }
          }
        }
        drain(controller, true);
        send(controller, { type: 'done' });
        if (operatorId && cleanText.trim()) {
          void insertMessage({
            operatorId,
            who: 'agent',
            text: cleanText.trim(),
          }).catch(() => {});
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          send(controller, {
            type: 'error',
            message: String((err as Error).message || err),
          });
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // reader already released
        }
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
}

function sseError(message: string, status = 500): Response {
  const payload: SseEvent = { type: 'error', message };
  const body = `data: ${JSON.stringify(payload)}\n\ndata: ${JSON.stringify({
    type: 'done',
  } satisfies SseEvent)}\n\n`;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
