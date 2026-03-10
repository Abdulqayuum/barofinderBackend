import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';
const authWritePaths = new Set([
  '/auth/login',
  '/auth/signup',
  '/auth/request-signup-otp',
  '/auth/reset-password',
  '/auth/confirm-reset',
  '/auth/refresh',
]);

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, shouldSkip }) {
  return rateLimit({
    skip: (req) => !isProduction || req.method === 'OPTIONS' || shouldSkip(req),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientKey,
    handler: (req, res) => {
      const retryAfter = Math.ceil((req.rateLimit?.resetTime?.getTime?.() ?? Date.now()) - Date.now()) / 1000;
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        res.setHeader('Retry-After', String(Math.ceil(retryAfter)));
      }
      res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    },
  });
}

export const authRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '25', 10),
  shouldSkip: (req) => !authWritePaths.has(req.path),
});

export const apiRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  shouldSkip: (req) => authWritePaths.has(req.path),
});
