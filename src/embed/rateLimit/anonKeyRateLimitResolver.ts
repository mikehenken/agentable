/**
 * Host-supplied anon-key rate limit resolver registry.
 */
import { emitEmbedRateLimitTelemetry } from '../../telemetry/embedBridge';
import type {
  AnonKeyRateLimitContext,
  AnonKeyRateLimitDecision,
  AnonKeyRateLimitResolver,
} from './types';
import {
  AnonKeyRateLimitedError,
  buildRateLimitedRefusal,
  buildRateLimitedRefusalFromHttp429,
} from './rateLimitedRefusal';

let activeResolver: AnonKeyRateLimitResolver | null = null;

export function registerAnonKeyRateLimitResolver(
  resolver: AnonKeyRateLimitResolver,
): () => void {
  activeResolver = resolver;
  return () => {
    if (activeResolver === resolver) {
      activeResolver = null;
    }
  };
}

export function getRegisteredAnonKeyRateLimitResolver(): AnonKeyRateLimitResolver | null {
  return activeResolver;
}

export function clearAnonKeyRateLimitResolverForTests(): void {
  activeResolver = null;
}

export interface AssertAnonKeyRateAllowedInput {
  anonKey: string;
  ctx: AnonKeyRateLimitContext;
}

/**
 * Consult the host resolver when registered. Throws {@link AnonKeyRateLimitedError}
 * immediately when denied — never waits on network (no silent hang).
 */
export async function assertAnonKeyRateAllowed(
  input: AssertAnonKeyRateAllowedInput,
): Promise<void> {
  const resolver = activeResolver;
  if (!resolver) {
    return;
  }

  const anonKey = input.anonKey.trim();
  if (!anonKey) {
    return;
  }

  const decision = await resolver(anonKey, input.ctx);
  if (decision.allowed) {
    return;
  }

  const refusal = buildRateLimitedRefusal({
    anonKey,
    denied: decision,
  });

  emitEmbedRateLimitTelemetry({
    operation: input.ctx.operation,
    outcome: 'refused',
    retryAfterMs: refusal.retryAfterMs,
    limit: refusal.limit,
    windowMs: refusal.windowMs,
    anonKeyHint: refusal.anonKeyHint,
  });

  throw new AnonKeyRateLimitedError(refusal);
}

export function throwRateLimitedFromHttp429(input: {
  anonKey: string;
  retryAfterMs: number;
  limit?: number;
  windowMs?: number;
  operation: AnonKeyRateLimitContext['operation'];
}): never {
  const refusal = buildRateLimitedRefusalFromHttp429({
    anonKey: input.anonKey,
    retryAfterMs: input.retryAfterMs,
    limit: input.limit,
    windowMs: input.windowMs,
  });

  emitEmbedRateLimitTelemetry({
    operation: input.operation,
    outcome: 'refused',
    retryAfterMs: refusal.retryAfterMs,
    limit: refusal.limit,
    windowMs: refusal.windowMs,
    anonKeyHint: refusal.anonKeyHint,
  });

  throw new AnonKeyRateLimitedError(refusal);
}

/** Parse Retry-After (seconds or HTTP-date) into milliseconds. */
export function parseRetryAfterMs(
  header: string | null,
  nowMs: number = Date.now(),
): number {
  if (!header?.trim()) {
    return 60_000;
  }
  const trimmed = header.trim();
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.ceil(asSeconds * 1000);
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - nowMs);
  }
  return 60_000;
}

export type { AnonKeyRateLimitDecision, AnonKeyRateLimitResolver };
