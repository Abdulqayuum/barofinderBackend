const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function normalizeBaseUrl(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\/+$/, '') || null;
}

function parseCorsOrigins() {
  return String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => normalizeBaseUrl(origin))
    .filter(Boolean);
}

function isLocalOrigin(value) {
  try {
    const { hostname } = new URL(value);
    return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getAppBaseUrl() {
  const explicitBaseUrl = [
    process.env.FRONTEND_URL,
    process.env.APP_URL,
  ]
    .map((value) => normalizeBaseUrl(value))
    .find(Boolean);

  if (explicitBaseUrl) return explicitBaseUrl;

  const corsOrigins = parseCorsOrigins();
  const publicCorsOrigin = corsOrigins.find((origin) => !isLocalOrigin(origin));
  if (publicCorsOrigin) return publicCorsOrigin;

  const localCorsOrigin = corsOrigins.find(Boolean);
  if (localCorsOrigin) return localCorsOrigin;

  return process.env.NODE_ENV === 'production'
    ? 'https://macalinhub.com'
    : 'http://localhost:8080';
}
