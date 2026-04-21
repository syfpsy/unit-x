import type { MemoryTag } from '@/components/types';

export interface CompleteArgs {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
  onMemory?: (memory: { tag: MemoryTag; text: string }) => void;
  onError?: (message: string) => void;
}

export interface CompleteResult {
  text: string;
  memories: Array<{ tag: MemoryTag; text: string }>;
  errored: boolean;
}

/**
 * Streams a completion from /api/complete. Invokes `onChunk` as safe text
 * arrives, `onMemory` when the server extracts a <remember> block, and
 * `onError` on transport or upstream failure. Resolves with the full
 * accumulated text + parsed memories once the stream closes.
 */
export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const { system, messages, signal, onChunk, onMemory, onError } = args;

  const res = await fetch('/api/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
    signal,
  });

  if (!res.body) {
    const msg = `no response body (status ${res.status})`;
    onError?.(msg);
    return { text: '', memories: [], errored: true };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = '';
  let text = '';
  const memories: Array<{ tag: MemoryTag; text: string }> = [];
  let errored = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      sseBuf += decoder.decode(value, { stream: true });

      const events = sseBuf.split('\n\n');
      sseBuf = events.pop() ?? '';

      for (const evt of events) {
        for (const line of evt.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          let payload: {
            type: 'chunk' | 'memory' | 'done' | 'error';
            text?: string;
            message?: string;
            tag?: MemoryTag;
          };
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }
          if (payload.type === 'chunk' && payload.text) {
            text += payload.text;
            onChunk?.(payload.text);
          } else if (payload.type === 'memory' && payload.tag && payload.text) {
            const mem = { tag: payload.tag, text: payload.text };
            memories.push(mem);
            onMemory?.(mem);
          } else if (payload.type === 'error') {
            errored = true;
            onError?.(payload.message || 'unknown upstream error');
          } else if (payload.type === 'done') {
            return { text, memories, errored };
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      errored = true;
      onError?.(String((err as Error).message || err));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }

  return { text, memories, errored };
}
