/**
 * Per-key token bucket rate limiter. In-memory — scoped to a single
 * serverless worker, not a cluster. Good enough for a personal-scale
 * product; a busy production would swap this for Upstash Redis via the
 * @upstash/ratelimit package and the same interface.
 *
 * Keys should be stable per operator (use `operatorId` when available,
 * fall back to IP for anonymous routes). Returns the decision + when
 * the bucket will next have capacity so handlers can surface a useful
 * retry-after.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Prune stale buckets every N checks. Prevents unbounded Map growth on
 * serverless workers that stay warm a while. Inexpensive: one pass over
 * the Map, dropping anything inactive for > 10 minutes.
 */
let checksSinceSweep = 0;
function maybeSweep() {
  checksSinceSweep += 1;
  if (checksSinceSweep < 500) return;
  checksSinceSweep = 0;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.lastRefill > 10 * 60_000) buckets.delete(k);
  }
}

export interface RateLimitConfig {
  /** Maximum burst capacity. */
  capacity: number;
  /** Tokens added per second (float). */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  maybeSweep();
  const now = Date.now();
  const existing = buckets.get(key);
  let bucket: Bucket;
  if (!existing) {
    bucket = { tokens: cfg.capacity, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    bucket = existing;
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerSec);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
    };
  }

  const tokensNeeded = 1 - bucket.tokens;
  const retryAfterMs = Math.ceil((tokensNeeded / cfg.refillPerSec) * 1000);
  return { allowed: false, remaining: 0, retryAfterMs };
}

/**
 * Extract a best-effort identifier for rate limiting when we can't tie a
 * request to an operator id yet (e.g. the anon pass-through in
 * /api/complete). Uses the forwarded client IP headers Vercel adds.
 */
export function anonKey(req: Request): string {
  const h = req.headers;
  const ip =
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return `anon:${ip}`;
}
