/**
 * Anon-key rate limit types ( ).
 *
 * Hosts register a resolver (same boundary pattern as the model resolver)
 * to enforce per-key limits on public embed operations.
 *** Operations subject to anon-key rate limiting. */
export type AnonKeyRateLimitOperation = 'tenant_lookup' | 'embed_bootstrap';

export interface AnonKeyRateLimitContext {
  operation: AnonKeyRateLimitOperation;
  /** Embed `api-endpoint` when available. */
  apiBaseUrl?: string;
}

export interface AnonKeyRateLimitAllowed {
  allowed: true;
  remaining?: number;
  resetAtMs?: number;
}

export interface AnonKeyRateLimitDenied {
  allowed: false;
  retryAfterMs: number;
  limit?: number;
  windowMs?: number;
}

export type AnonKeyRateLimitDecision =
  | AnonKeyRateLimitAllowed
  | AnonKeyRateLimitDenied;

/**
 * Host-supplied resolver invoked before anon-key tenant lookup and embed bootstrap.
 */
export type AnonKeyRateLimitResolver = (
  anonKey: string,
  ctx: AnonKeyRateLimitContext) => AnonKeyRateLimitDecision | Promise<AnonKeyRateLimitDecision>;
