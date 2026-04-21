import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Envelope encryption for operator-scoped content.
 *
 * Master key:   UNITX_MASTER_KEY   (32 bytes, base64)    [required]
 * Rotation:     UNITX_MASTER_KEY_PREV                    [optional]
 *
 * Per-row DEK:  HKDF-SHA256(master, salt=operator_id, info="unitx-dek-v1") → 32 bytes
 * Cipher:       AES-256-GCM with a random 96-bit nonce per row
 * Storage:      cipher column = ciphertext ‖ authTag(16B); nonce column = 12B
 *
 * During rotation, both keys live side-by-side and decrypt() tries each in
 * order. After a full re-encryption pass (scripts/rotate-keys.mjs), the old
 * key can be removed and the current key becomes the only one.
 *
 * This is NOT end-to-end encryption. The server needs plaintext at runtime
 * to build prompts. What this protects against: a DB dump or SQL-read leak
 * can't reveal conversation content without the master key (which lives in
 * the Vercel env, not in the DB).
 */

const ALGO = 'aes-256-gcm';
const DEK_LENGTH = 32; // AES-256
const NONCE_LENGTH = 12; // 96-bit nonce for AES-GCM
const AUTH_TAG_LENGTH = 16;
const INFO = Buffer.from('unitx-dek-v1', 'utf8');

function decodeMasterKey(b64: string): Buffer {
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error(`master key must decode to 32 bytes, got ${key.length}`);
  }
  return key;
}

/**
 * Returns master keys in try-order: current first, previous second. Callers
 * encrypt with the first; decrypt tries each until one works.
 */
function getMasterKeys(): Buffer[] {
  const current = process.env.UNITX_MASTER_KEY;
  if (!current) {
    throw new Error('UNITX_MASTER_KEY is not set');
  }
  const keys = [decodeMasterKey(current)];
  const prev = process.env.UNITX_MASTER_KEY_PREV;
  if (prev) keys.push(decodeMasterKey(prev));
  return keys;
}

/**
 * UUIDs are 128 random bits — perfectly serviceable as HKDF salt without
 * any further processing. Strip the dashes and parse as hex.
 */
function saltFromOperatorId(operatorId: string): Buffer {
  const hex = operatorId.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`operator id is not a uuid: ${operatorId}`);
  return Buffer.from(hex, 'hex');
}

function deriveDek(master: Buffer, operatorId: string): Buffer {
  const salt = saltFromOperatorId(operatorId);
  return Buffer.from(hkdfSync('sha256', master, salt, INFO, DEK_LENGTH));
}

export interface Ciphertext {
  cipher: Buffer;
  nonce: Buffer;
}

export function encryptText(plaintext: string, operatorId: string): Ciphertext {
  const [current] = getMasterKeys();
  const dek = deriveDek(current, operatorId);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGO, dek, nonce);
  const body = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    cipher: Buffer.concat([body, authTag]),
    nonce,
  };
}

export function decryptText(
  ciphertext: Buffer,
  nonce: Buffer,
  operatorId: string,
): string {
  if (ciphertext.length < AUTH_TAG_LENGTH) {
    throw new Error('ciphertext too short to contain auth tag');
  }
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const body = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LENGTH);

  let lastErr: Error | null = null;
  for (const master of getMasterKeys()) {
    try {
      const dek = deriveDek(master, operatorId);
      const decipher = createDecipheriv(ALGO, dek, nonce);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error('decryption failed');
}

/**
 * Overwrite a buffer in place. Used by the retention sweep to zero out
 * ciphertext for memories past the /forget grace period.
 */
export function zeroBuffer(): Buffer {
  return Buffer.alloc(AUTH_TAG_LENGTH + 1); // 17 bytes: "failed" sentinel
}
