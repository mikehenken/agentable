/**
 * Structured `rate_limited` refusal shape (D55 / web-components rule 5.3).
 */
import type { AnonKeyRateLimitDenied } from './types';

export const RATE_LIMITED_CODE = 'rate_limited' as const;

export type RateLimitedCode = typeof RATE_LIMITED_CODE;

export interface RateLimitedRefusal {
  code: RateLimitedCode;
  message: string;
  retryAfterMs: number;
  /** Truncated anon-key hint — never the full key. */
  anonKeyHint?: string;
  limit?: number;
  windowMs?: number;
}

export class AnonKeyRateLimitedError extends Error {
  readonly code = RATE_LIMITED_CODE;
  readonly refusal: RateLimitedRefusal;

  constructor(refusal: RateLimitedRefusal) {
    super(refusal.message);
    this.name = 'AnonKeyRateLimitedError';
    this.refusal = refusal;
  }
}

export function isRateLimitedRefusal(value: unknown): value is RateLimitedRefusal {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.code === RATE_LIMITED_CODE &&
    typeof record.message === 'string' &&
    typeof record.retryAfterMs === 'number'
  );
}

export function isAnonKeyRateLimitedError(error: unknown): error is AnonKeyRateLimitedError {
  return error instanceof AnonKeyRateLimitedError;
}

export function anonKeyHint(anonKey: string): string | undefined {
  const trimmed = anonKey.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= 8 ? `${trimmed}…` : `${trimmed.slice(0, 8)}…`;
}

export function buildRateLimitedRefusal(input: {
  anonKey: string;
  denied: AnonKeyRateLimitDenied;
  message?: string;
}): RateLimitedRefusal {
  const hint = anonKeyHint(input.anonKey);
  return {
    code: RATE_LIMITED_CODE,
    message:
      input.message ??
      `Anon-key rate limit exceeded${hint ? ` for ${hint}` : ''}; retry after ${input.denied.retryAfterMs}ms.`,
    retryAfterMs: input.denied.retryAfterMs,
    ...(hint ? { anonKeyHint: hint } : {}),
    ...(input.denied.limit !== undefined ? { limit: input.denied.limit } : {}),
    ...(input.denied.windowMs !== undefined ? { windowMs: input.denied.windowMs } : {}),
  };
}

export function buildRateLimitedRefusalFromHttp429(input: {
  anonKey: string;
  retryAfterMs: number;
  limit?: number;
  windowMs?: number;
}): RateLimitedRefusal {
  const hint = anonKeyHint(input.anonKey);
  return {
    code: RATE_LIMITED_CODE,
    message: `Anon-key tenant lookup rate limited${hint ? ` for ${hint}` : ''}.`,
    retryAfterMs: input.retryAfterMs,
    ...(hint ? { anonKeyHint: hint } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.windowMs !== undefined ? { windowMs: input.windowMs } : {}),
  };
}
