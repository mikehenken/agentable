/**
 * Shared embed config reload detail including structured rate_limited refusals.
 */
import { AnonKeyRateLimitedError } from './rateLimit';

export interface EmbedConfigReloadDetail {
  ok: boolean;
  error?: string;
  code?: string;
  retryAfterMs?: number;
  limit?: number;
  windowMs?: number;
}

export function buildEmbedConfigReloadDetail(
  ok: boolean,
  error?: unknown,
): EmbedConfigReloadDetail {
  if (ok) {
    return { ok: true };
  }

  if (error instanceof AnonKeyRateLimitedError) {
    const { refusal } = error;
    return {
      ok: false,
      error: refusal.message,
      code: refusal.code,
      retryAfterMs: refusal.retryAfterMs,
      ...(refusal.limit !== undefined ? { limit: refusal.limit } : {}),
      ...(refusal.windowMs !== undefined ? { windowMs: refusal.windowMs } : {}),
    };
  }

  const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
  return { ok: false, error: message };
}
