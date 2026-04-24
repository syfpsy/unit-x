/**
 * Embedding provider layer.
 *
 * Keeps the app model-agnostic: the rest of the codebase imports
 * `getEmbeddingProvider()` and uses the uniform `embed(texts)` method.
 * Swap providers by changing `EMBEDDING_PROVIDER` env; the old rows'
 * `embedding_model` column tells us when a backfill is needed.
 *
 * Degradation: when no provider is configured (or the provider call
 * fails), `getEmbeddingProvider()` returns `null`. Callers must handle
 * that — the app falls back to recency-based memory injection, the
 * pre-Phase-12 behaviour.
 */

export interface EmbeddingProvider {
  /** Human-readable model slug, e.g. "openai/text-embedding-3-small@1536". */
  readonly modelSlug: string;
  /** Output vector dimensionality. Must match the DB column's vector(N). */
  readonly dimensions: number;
  /** Embed a batch of texts; returns one vector per input, in order. */
  embed(texts: string[]): Promise<number[][]>;
}

const EXPECTED_DIMS = 1536;

/**
 * OpenAI embeddings via the public REST API. Chosen as default:
 *   - text-embedding-3-small is cheap (~$0.02/1M tok) and fast (~p50 100ms).
 *   - `dimensions` param lets us pin output size without changing model.
 *   - Stable shape; easy to swap to voyage / cohere / local later.
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly modelSlug: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(opts: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    dimensions?: number;
  }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com';
    this.model = opts.model ?? 'text-embedding-3-small';
    this.dimensions = opts.dimensions ?? EXPECTED_DIMS;
    this.modelSlug = `openai/${this.model}@${this.dimensions}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
        encoding_format: 'float',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openai embeddings ${res.status}: ${body.slice(0, 160)}`);
    }
    const json = (await res.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    // Sort by original index in case provider reorders.
    return json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((r) => r.embedding);
  }
}

let cached: EmbeddingProvider | null = null;
let cacheResolved = false;

/**
 * Resolves the active embedding provider once per module instance
 * (cheap — all providers are constructor-only). Returns null when:
 *   - EMBEDDING_PROVIDER=none
 *   - no provider is configured
 *   - the required API key is missing
 * Callers should treat null as "no RAG available" and fall back to
 * recency-based retrieval.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (cacheResolved) return cached;
  cacheResolved = true;

  const kind = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();
  if (kind === 'none') return (cached = null);

  if (kind === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return (cached = null);
    cached = new OpenAIEmbeddingProvider({
      apiKey,
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.EMBEDDING_MODEL,
      dimensions: process.env.EMBEDDING_DIMENSIONS
        ? Number(process.env.EMBEDDING_DIMENSIONS)
        : undefined,
    });
    return cached;
  }

  // Unknown kind — degrade rather than crash.
  return (cached = null);
}

/**
 * Serialise a vector to the pgvector text format: `[0.1,0.2,…]`. Used by
 * raw SQL paths; the Drizzle `vector` customType handles this
 * automatically for typed queries.
 */
export function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
