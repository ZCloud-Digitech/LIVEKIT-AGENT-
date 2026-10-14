import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM

export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionConfigError';
  }
}

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    if (envKey.length === 32) {
      return Buffer.from(envKey, 'utf-8');
    }
  }

  // Strict Production Enforcement: Never permit fallback keys in production
  if (process.env.NODE_ENV === 'production') {
    throw new EncryptionConfigError(
      'CRITICAL SECURITY ERROR: ENCRYPTION_KEY must be configured as a 64-character hex or 32-byte string in production.'
    );
  }

  // Development/Test fallback only when explicitly non-production
  const fallbackSeed = process.env.WORKER_API_SECRET || process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod';
  return crypto.pbkdf2Sync(fallbackSeed, 'zcloud-dev-salt', 100000, 32, 'sha256');
}

/**
 * Encrypts sensitive secrets (BYOK API keys, SIP passwords) using AES-256-GCM.
 * Output format: <iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM payload.
 * In production, strictly rejects unencrypted plaintext payloads.
 */
export function decryptSecret(payload: string): string {
  if (!payload || typeof payload !== 'string') return '';
  const parts = payload.split(':');

  if (parts.length !== 3) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY VIOLATION: Refusing to process unencrypted secret payload in production.');
    }
    console.warn('[SECURITY WARNING] Legacy unencrypted credential detected in development database.');
    return payload;
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('Failed to decrypt secret payload:', err.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Decryption integrity check failed.');
    }
    return '';
  }
}

/**
 * Returns a masked representation of a secret, revealing only trailing characters.
 * Example: "sk-1234567890abcdef" -> "************cdef"
 */
export function maskSecret(secret: string, visible = 4): string {
  if (!secret) return '';
  if (secret.length <= visible) return '*'.repeat(secret.length);
  const maskedLength = secret.length - visible;
  return '*'.repeat(maskedLength) + secret.slice(-visible);
}

/**
 * Checks if a provided input is a masked placeholder (indicating unchanged value).
 */
export function isMaskedValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.includes('***') || value.startsWith('****');
}
