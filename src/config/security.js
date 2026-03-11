import crypto from 'crypto';

const DEFAULT_DEVELOPMENT_JWT_SECRET = 'dev-only-change-me-please-before-production';
const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

function readTrimmedEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getJwtSecret() {
  const secret = readTrimmedEnv('JWT_SECRET');
  if (secret) return secret;
  return DEFAULT_DEVELOPMENT_JWT_SECRET;
}

export function validateSecurityConfig() {
  const jwtSecret = readTrimmedEnv('JWT_SECRET');
  if (process.env.NODE_ENV === 'production') {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in production.');
    }
    if (jwtSecret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`);
    }
  } else if (!jwtSecret) {
    console.warn('JWT_SECRET is not set. Falling back to a development-only secret.');
  }
}

export function hashSensitiveToken(scope, value) {
  const hashSecret = readTrimmedEnv('TOKEN_HASH_SECRET') || getJwtSecret();
  return crypto
    .createHmac('sha256', hashSecret)
    .update(`${scope}:${String(value)}`)
    .digest('hex');
}

export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function isLegacyPlaintextPasswordFallbackEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_LEGACY_PLAINTEXT_PASSWORDS === 'true';
}
