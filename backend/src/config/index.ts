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
  're_placeholder_api_key',
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
    throw new Error('FATAL: JWT_SECRET environment variable is missing or empty.');
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

/**
 * Validates and retrieves the Resend API configuration.
 * In production, fails fast if RESEND_API_KEY is missing, empty, or an insecure placeholder.
 */
export function validateAndGetResendConfig(
  envApiKey?: string | null,
  envFromEmail?: string | null,
  isProd = isProduction
): { apiKey: string; fromEmail: string } {
  const apiKey = envApiKey !== undefined
    ? (envApiKey === null ? '' : envApiKey.trim())
    : (process.env.RESEND_API_KEY || '').trim();

  const fromEmail = envFromEmail !== undefined
    ? (envFromEmail === null ? 'onboarding@resend.dev' : envFromEmail.trim() || 'onboarding@resend.dev')
    : (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();

  if (isProd) {
    if (!apiKey) {
      throw new Error('FATAL: RESEND_API_KEY environment variable is missing or empty in production.');
    }
    if (INSECURE_SECRET_PLACEHOLDERS.has(apiKey) || apiKey.startsWith('re_placeholder')) {
      throw new Error('FATAL: RESEND_API_KEY is set to an insecure default placeholder value in production.');
    }
  }

  return { apiKey, fromEmail };
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  isConfigured: boolean;
}

/**
 * Validates and retrieves Cloudflare R2 storage configuration.
 * In production, fails fast if R2 is partially configured or contains placeholder values.
 */
export function validateAndGetR2Config(
  envAccountId?: string | null,
  envAccessKeyId?: string | null,
  envSecretAccessKey?: string | null,
  envBucketName?: string | null,
  envEndpoint?: string | null,
  isProd = isProduction
): R2Config {
  const accountId = (envAccountId !== undefined ? (envAccountId || '') : (process.env.R2_ACCOUNT_ID || '')).trim();
  const accessKeyId = (envAccessKeyId !== undefined ? (envAccessKeyId || '') : (process.env.R2_ACCESS_KEY_ID || '')).trim();
  const secretAccessKey = (envSecretAccessKey !== undefined ? (envSecretAccessKey || '') : (process.env.R2_SECRET_ACCESS_KEY || '')).trim();
  const bucketName = (envBucketName !== undefined ? (envBucketName || 'financial-services-private-docs') : (process.env.R2_BUCKET_NAME || 'financial-services-private-docs')).trim();

  const isConfigured = Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    bucketName &&
    !INSECURE_SECRET_PLACEHOLDERS.has(accountId) &&
    !INSECURE_SECRET_PLACEHOLDERS.has(accessKeyId) &&
    !INSECURE_SECRET_PLACEHOLDERS.has(secretAccessKey) &&
    !accessKeyId.startsWith('your_') &&
    !secretAccessKey.startsWith('your_')
  );

  let endpoint = (envEndpoint !== undefined ? (envEndpoint || '') : (process.env.R2_ENDPOINT || '')).trim();
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  if (isProd) {
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('FATAL: Cloudflare R2 configuration is missing in production. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be provided.');
    }
    if (!isConfigured) {
      throw new Error('FATAL: Cloudflare R2 credentials are invalid or contain default placeholders in production.');
    }
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    isConfigured,
  };
}

const jwtSecret = validateAndGetJwtSecret();
const encryptionKey = validateAndGetEncryptionKey(process.env.ENCRYPTION_KEY, jwtSecret);
const resendConfig = validateAndGetResendConfig();
const r2Config = validateAndGetR2Config();

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

  resend: resendConfig,

  r2: r2Config,

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
