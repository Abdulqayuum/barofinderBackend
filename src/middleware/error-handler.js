export function errorHandler(err, req, res, next) {
  const status = err?.status || 500;
  const code = err?.code || 'INTERNAL_ERROR';
  const message = err?.message || 'Internal server error';
  const details = err?.details;
  const isServerError = status >= 500;

  console.error('Error:', err);

  const payload = { error: isServerError ? 'Internal server error' : message, code };
  if (details) payload.details = details;
  if (process.env.NODE_ENV === 'development' && err?.stack) payload.stack = err.stack;

  res.status(status).json(payload);
}

export function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
