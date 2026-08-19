---
lrn: lrn::en:platform:agentable-canvas.feature.anon-key-tenant-lookup::doc
related_docs:
  - docs/features/agentable-panel-single-element.md
  - docs/features/auto-mount-scan.md
  - landi-canvas-studio/docs/development/agentable-panels/02-PANEL_SYSTEM_SPEC.md
changelog:
  - date: 2026-07-21
    summary: client-side rate limit gate before lookup; see anon-key-rate-limiting.md.
  - date: 2026-07-21
    summary: anon-key tenant lookup — script-tag, data-* placeholder, and JS API parity.
---

# Anon-key tenant config lookup 

Public embed hosts identify a tenant with an **anon/public key** (never a service role key). The framework fetches a sanitized tenant config document from the host API and merges it through the same path as `config-url` ( white-label contract).

## Precedence

1. `config-url` (explicit JSON document)
2. **anon-key lookup** when `anon-key` + `api-endpoint` are set
3. legacy `panel-data-url`

Element attributes still win over fetched tenant config (section 11 merge order).

## Script-tag embed

```html
<agentable-canvas
  anon-key="pk_live_agency_xxxxxxxx"
  api-endpoint="/api"
></agentable-canvas>
<script type="module" src="/embed/agentable-canvas.js"></script>
```

Auto-mount from the executing script tag:

```html
<script
  type="module"
  src="/embed/agentable-canvas.js"
  data-anon-key="pk_live_agency_xxxxxxxx"
  data-api-endpoint="/api"
  data-container="#mount"
></script>
<div id="mount"></div>
```

## Zero-JS placeholder parity

```html
<div
  data-agentable-panel="open-positions"
  data-anon-key="pk_live_agency_xxxxxxxx"
  data-api-endpoint="/api"
></div>
```

## JS API

```ts
import AgentableEmbed from 'agentable-canvas/embed/api';

AgentableEmbed.init({
  container: '#mount',
  anonKey: 'pk_live_agency_xxxxxxxx',
  apiEndpoint: '/api',
});
```

## Lookup contract

| Input | Default | Role |
|-------|---------|------|
| `api-endpoint` `data-api-endpoint` | `/api` | API base URL |
| `config-path` `data-config-path` | `/agentable/embed/config` | Lookup route |
| `anon-key` `data-anon-key` | — | Public embed key (G3) |

Request:

`GET {api-endpoint}{config-path}?anonKey=…`

Header: `X-Agentable-Anon-Key: …`

Response: JSON matching `EmbedConfigDocument` allow-list. Credential-shaped fields are stripped client-side before merge.

## Caching

In-memory TTL cache (5 minutes) keyed by `(apiBaseUrl, configPath, anonKey)`. Tests can reset via `resetAnonKeyLookupCache`.

## Module map

| Path | Role |
|------|------|
| `src/embed/tenantLookup/anonKeyTenantLookup.ts` | Fetch + cache |
| `src/embed/tenantLookup/sanitizeEmbedConfigDocument.ts` | G3 defense-in-depth |
| `src/embed/tenantLookup/readAnonKeyFromHost.ts` | Script-tag attribute readers |
| `src/embed/embedConfigLoader.ts` | Unified config source resolution |
| `src/embed/embedApi.ts` | JS API `init` |

## Tests

- `tests/unit/anonKeyTenantLookup.test.ts`
- `tests/unit/readAnonKeyFromHost.test.ts`
- `tests/unit/embedApi.test.ts`
- `tests/unit/embedG3AnonKeyBoundary.test.ts`
