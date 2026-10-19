import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Known insecure placeholder values that must never be used in production
export const INSECURE_SECRET_PLACEHOLDERS = new Set([
  'change-this-to-a-secure-random-string-in-production',
  'dev-secret-change-in-production',
  'financial-services-secure-encryption-key-32',
]);

/**
 * Validates and retrieves the JWT secret.
 * In production, fails fast with a descriptive error if missing or set to an insecure placeholder.
 */
export function validateAndGetJwtSecret(envSecret?: string | null, isProd = isProduction): string {
  const secret = envSecret !== undefined
    ? (envSecret === null ? '' : envSecret)
    : (process.env.JWT_SECRET || '');

  if (!secret || secret.trim() === '') {
    if (isProd) {
      throw new Error('FATAL: JWT_SECRET environment variable is missing or empty in production.');
    }
    return '';
  }
  if (isProd) {
    if (INSECURE_SECRET_PLACEHOLDERS.has(secret)) {
      throw new Error('FATAL: JWT_SECRET is set to an insecure default placeholder value in production.');
    }
    if (secret.length < 16) {
      throw new Error('FATAL: JWT_SECRET must be at least 16 characters long in production.');
    }
  }
  return secret;
}

/**
 * Validates and retrieves the 32-byte AES-256 encryption key.
 * In production, fails fast with a descriptive error if neither ENCRYPTION_KEY nor JWT_SECRET is provided.
 * Derives a 32-byte key preserving backwards compatibility with existing encrypted records.
 */
export function validateAndGetEncryptionKey(
  envEncryptionKey?: string | null,
  jwtSecret = '',
  isProd = isProduction
): string {
  const rawKey = envEncryptionKey !== undefined
    ? (envEncryptionKey === null ? '' : envEncryptionKey)
    : (process.env.ENCRYPTION_KEY || jwtSecret);

  if (!rawKey || rawKey.trim() === '') {
    if (isProd) {
      throw new Error('FATAL: ENCRYPTION_KEY or JWT_SECRET environment variable is required in production.');
    }
    return '';
  }
  if (isProd) {
    if (INSECURE_SECRET_PLACEHOLDERS.has(rawKey)) {
      throw new Error('FATAL: ENCRYPTION_KEY is set to an insecure default placeholder value in production.');
    }
    if (rawKey.length < 16) {
      throw new Error('FATAL: ENCRYPTION_KEY must be at least 16 characters long in production.');
    }
  }
  return rawKey.padEnd(32, '0').slice(0, 32);
}

const jwtSecret = validateAndGetJwtSecret();
const encryptionKey = validateAndGetEncryptionKey(process.env.ENCRYPTION_KEY, jwtSecret);

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  database: {
    url: process.env.DATABASE_URL || '',
  },

  encryptionKey,

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ],
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000', 10),
    loginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000', 10), // 15 minutes
    loginMaxAttempts: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10), // 5 failed attempts
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    channelId: process.env.YOUTUBE_CHANNEL_ID || '',
  },
};
