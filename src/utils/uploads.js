export function toStoredUploadPath(value) {
  if (typeof value !== 'string') return value ?? null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/api/uploads/')) return trimmed.slice(4);
  if (trimmed.startsWith('api/uploads/')) return `/${trimmed.slice(4)}`;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/api/uploads/')) {
      return parsed.pathname.slice(4);
    }
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function toPublicUploadUrl(value) {
  return toStoredUploadPath(value);
}

export function toStoredUploadDocument(document) {
  if (!document || typeof document !== 'object') return document;
  return {
    ...document,
    url: toStoredUploadPath(document.url),
  };
}

export function toPublicUploadDocument(document) {
  if (!document || typeof document !== 'object') return document;
  return {
    ...document,
    url: toPublicUploadUrl(document.url),
  };
}

export function toStoredUploadDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map(toStoredUploadDocument);
}

export function toPublicUploadDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map(toPublicUploadDocument);
}
