import crypto from 'crypto';
import { config } from '../config';

/**
 * Generate a cryptographically secure, uniformly random 6-digit OTP.
 * Generates an integer in the range [100000, 999999] so it is always exactly 6 digits.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generate a unique 32-byte cryptographic salt (hex-encoded, 64 chars).
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Derive a dedicated 32-byte HMAC key specifically for OTP hashing from the JWT secret using HKDF.
 * Context string ensures cryptographic domain separation between JWT signing and OTP hashing.
 * Fails safely if the secret is missing or empty.
 */
export function getOtpHmacKey(customSecret?: string): Buffer {
  const secret = customSecret !== undefined ? customSecret : config.jwt.secret;
  if (!secret || secret.trim() === '') {
    throw new Error('FATAL: Cannot derive OTP HMAC key because JWT secret is missing or empty.');
  }
  const arrayBuffer = crypto.hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.alloc(0),
    Buffer.from('financial-services-otp-hmac-v1', 'utf8'),
    32
  );
  return Buffer.from(arrayBuffer);
}

/**
 * Derive an HMAC-SHA256 hash of the OTP code and salt using the domain-separated HKDF key.
 * Never store plaintext OTPs in the database.
 */
export function hashOtp(code: string, salt: string): string {
  const key = getOtpHmacKey();
  return crypto
    .createHmac('sha256', key)
    .update(`${salt}:${code.trim()}`)
    .digest('hex');
}

/**
 * Constant-time comparison to verify a submitted OTP against the stored code hash.
 * Protects against timing side-channel attacks.
 */
export function verifyOtpHash(code: string, salt: string, expectedHash: string): boolean {
  if (!code || !salt || !expectedHash) return false;
  const actualHash = hashOtp(code, salt);
  const actualBuffer = Buffer.from(actualHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Mask an email address for public display without leaking sensitive personal identifiers.
 * E.g., "customer@example.com" -> "c***r@example.com"
 *       "ab@example.com" -> "a*@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 1) {
    return `${localPart}*@${domain}`;
  }
  if (localPart.length === 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}
