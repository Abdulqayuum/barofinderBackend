import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

export const apiRateLimiter = rateLimit({
  // Keep rate limiting in production, disable it during local development.
  skip: () => !isProduction,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit?.resetTime?.getTime?.() ?? Date.now()) - Date.now()) / 1000;
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      res.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    }
    res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
  }
});
