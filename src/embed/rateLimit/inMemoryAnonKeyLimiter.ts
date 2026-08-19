/**
 * In-memory sliding-window anon-key limiter for host resolver registration.
 *
 * Hosts may register an instance via {@link registerAnonKeyRateLimitResolver} to
 * enforce client-side limits before network I/O.
 */
import type { AnonKeyRateLimitResolver } from './types';

export interface InMemoryAnonKeyLimiterOptions {
  maxRequests: number;
  windowMs: number;
  now?: () => number;
}

export function createInMemoryAnonKeyRateLimiter(
  options: InMemoryAnonKeyLimiterOptions): AnonKeyRateLimitResolver {
  const maxRequests = Math.max(1, options.maxRequests);
  const windowMs = Math.max(1, options.windowMs);
  const now = options.now ?? (() => Date.now());
  const hitsByKey = new Map<string, number[]>();

  return (anonKey) => {
    const key = anonKey.trim();
    const timestamp = now();
    const windowStart = timestamp - windowMs;

    const prior = hitsByKey.get(key) ?? [];
    const inWindow = prior.filter((hit) => hit > windowStart);

    if (inWindow.length >= maxRequests) {
      const oldest = inWindow[0] ?? timestamp;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, oldest + windowMs - timestamp),
        limit: maxRequests,
        windowMs,
      };
    }

    inWindow.push(timestamp);
    hitsByKey.set(key, inWindow);

    return {
      allowed: true,
      remaining: maxRequests - inWindow.length,
      resetAtMs: timestamp + windowMs,
    };
  };
}

/** Test helper — reset all buckets on a limiter instance. */
export function resetInMemoryAnonKeyLimiter(
  limiter: AnonKeyRateLimitResolver & { _reset?: () => void }): void {
  limiter._reset?.();
}
