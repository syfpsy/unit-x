/**
 * Structured logger with aggressive redaction. Content fields (`text`,
 * `content`, `email`, anything matching `sk-*`, anything that looks like
 * a JWT) are replaced with placeholders before the payload hits stdout.
 *
 * Two rules, regularly broken in chat apps — we enforce them here:
 *   1. NEVER log message/memory plaintext. Even for debugging.
 *   2. NEVER log credentials. Even in dev. Once it's in a log collector
 *      it's effectively in someone else's database too.
 */

type LogLevel = 'info' | 'warn' | 'error';

const SK_PATTERN = /sk-[A-Za-z0-9_-]{8,}/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;
const REDACTED_KEYS = new Set([
  'text',
  'text_cipher',
  'textCipher',
  'nonce',
  'content',
  'email',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'token_hash',
  'session',
  'authorization',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UNITX_MASTER_KEY',
  'DEEPSEEK_API_KEY',
]);

function redactString(s: string): string {
  return s.replace(SK_PATTERN, 'sk-[REDACTED]').replace(JWT_PATTERN, '[REDACTED_JWT]');
}

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      // no stack — can contain secrets from upstream SDKs
    };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k)) {
        out[k] = typeof v === 'string' && v.length > 0 ? '[REDACTED]' : '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  const payload = {
    t: new Date().toISOString(),
    level,
    msg: redactString(msg),
    ...(extra ? { ctx: redact(extra) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info(msg: string, extra?: Record<string, unknown>) {
    emit('info', msg, extra);
  },
  warn(msg: string, extra?: Record<string, unknown>) {
    emit('warn', msg, extra);
  },
  error(msg: string, extra?: Record<string, unknown>) {
    emit('error', msg, extra);
  },
};
