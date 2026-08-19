---
lrn: lrn::en:platform:agentable-canvas.feature.anon-key-rate-limiting::doc
related_docs:
  - docs/features/anon-key-tenant-lookup.md
  - docs/features/telemetry-sink-boundary.md
  - docs/features/telemetry-event-coverage.md
changelog:
  - date: 2026-07-21
    summary: anon-key rate limiting with structured rate_limited refusal and RATE_LIMITED telemetry.
---

# Anon-key rate limiting 

Public embed hosts register an anon-key rate limit resolver (same boundary pattern as the model resolver) to refuse abusive lookup/bootstrap traffic before network I/O.

## Host registration

```typescript
import {
  createInMemoryAnonKeyRateLimiter,
  registerAnonKeyRateLimitResolver,
} from 'agentable-canvas/embed/tenantLookup';

const limiter = createInMemoryAnonKeyRateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
});

registerAnonKeyRateLimitResolver(limiter);
```

Production hosts should enforce limits server-side as well; the client resolver is defense-in-depth for embed abuse control.

## Structured refusal

When denied, tenant lookup throws `AnonKeyRateLimitedError` with a structured refusal:

| Field | Value |
|-------|-------|
| `code` | `rate_limited` |
| `retryAfterMs` | Backoff hint (ms) |
| `limit` / `windowMs` | Optional bucket metadata |
| `anonKeyHint` | Truncated key prefix only — never the full key |

Embed elements dispatch `agentable:config-reloaded` with the same fields on `detail` (`ok: false`, `code`, `retryAfterMs`, …).

HTTP `429` responses from the host lookup route map to the same refusal shape via `Retry-After`.

## Telemetry

Refusals emit `embed` family telemetry through `registerEmbedTelemetryEmit(host.telemetry.emit)` wired at `createCanvasHost`:

| Field | Value |
|-------|-------|
| `family` | `embed` |
| `operation` | `tenant_lookup` \| `embed_bootstrap` |
| `outcome` | `refused` |
| `errorCodes` | `['RATE_LIMITED']` (frozen error-code vocabulary) |

## Source map

| Module | Role |
|--------|------|
| `src/embed/rateLimit/` | Resolver registry, in-memory limiter, refusal types |
| `src/embed/tenantLookup/anonKeyTenantLookup.ts` | Pre-fetch gate + HTTP 429 mapping |
| `src/embed/configReloadDetail.ts` | Config reload event detail |
| `src/telemetry/embedBridge.ts` | Embed → host.telemetry bridge |
| `src/telemetry/frozenErrorCodes.ts` | `RATE_LIMITED` frozen code |

## Tests

```powershell
npm run test -- anonKeyRateLimit telemetryFrozenCodes
```

- Unit: `tests/unit/anonKeyRateLimit.test.ts`
- E2e: `tests/integration/anonKeyRateLimitE2e.test.ts` — over-limit key gets structured refusal immediately, not a hang
