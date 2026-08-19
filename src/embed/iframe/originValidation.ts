/**
 * Origin allowlist validation for the embed postMessage bridge.
 */

function normalizeOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (!trimmed || trimmed === '*') {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(raw: string | readonly string[] | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  const parts = Array.isArray(raw)
    ? raw
    : raw.split(',').map((entry) => entry.trim());
  const normalized = parts
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => entry !== null);
  return [...new Set(normalized)];
}

export function isOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  const normalized = normalizeOrigin(origin);
  if (normalized === null) {
    return false;
  }
  if (allowlist.length === 0) {
    return false;
  }
  return allowlist.includes(normalized);
}

export function resolveParentOriginFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) {
    return null;
  }
  try {
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}
