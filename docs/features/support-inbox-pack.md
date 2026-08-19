---
lrn: lrn::en:platform:agentable-canvas.feature.support-inbox-pack::doc
related_docs:
  - docs/features/gallery-d47.md
  - docs/setup/ADOPTER_QUICKSTART.md
  - packages/career-pack/README.md
  - packages/support-inbox-pack/README.md
changelog:
  - date: 2026-07-21
    summary: adds support-inbox-pack as second adopter example with fixtures, extension points, quickstart embed, and tests.
---

# Support inbox example pack 

Second adopter tutorial pack for **P10 ecosystem wave**. Mirrors the `@agentable/career-pack` shape: one shared package, tenant config, documented extension points, mock-first static adapter — oriented to **support inbox** workflows instead of careers.

## Package export

```ts
import {
  createSupportInboxPack,
  extendSupportInboxPack,
  resolveSupportInboxHostConfig,
} from 'agentable-canvas/support-inbox-pack';
```

Peer dependency: `agentable-canvas >= 0.2.0`.

## Panels

| Id | Source | Purpose |
|----|--------|---------|
| `inbox` | `support.tickets` | Filterable ticket queue |
| `ticket-detail` | `support.messages` | Conversation thread |
| `macros` | `support.macros` | Canned responses |

Generated tools: `open_inbox`, `show_ticket`, `open_macros`, `search_tickets`.

## Adapter sources

| Source | Kind | Notes |
|--------|------|-------|
| `support.tickets` | query | status, priority, search filters |
| `support.ticket` | query | single ticket lookup |
| `support.messages` | query | requires `ticketId` param |
| `support.macros` | query | category + search filters |
| `support.reply` | mutate | fixture reply; persists to localStorage |

Implementation: `createStaticSupportInboxAdapter` in `packages/support-inbox-pack/src/adapters/staticSupportInboxAdapter.ts`.

## Quickstart (published packages only)

Runnable embed page: `examples/support-inbox-quickstart/index.html`

Shared fixtures (fictional **Northwind Support** — no real clients):

- `examples/shared/northwind-support-config.json`
- `examples/shared/northwind-support-data.json`

### Freeze limitation

While runs with `deploy_allowed: false`, the pack is available from the monorepo git pin only. After freeze lifts, adopters install from the published package — no `src/` imports. See `packages/support-inbox-pack/README.md`.

## Embed resolution

`<agentable-panel panel="inbox" config-url="…">` resolves support panels through `src/embed/panel/resolveEmbedPanelHost.ts` alongside existing career panels.

## Tests

```bash
npm run test:support-inbox-pack
npm run test:e2e -- tests/e2e/support-inbox-quickstart.spec.ts
```

## Related

- First pack: `agentable-canvas/career-pack` (P4 )
- gallery: `docs/features/gallery-d47.md`
- Generic two-panel quickstart: `docs/setup/ADOPTER_QUICKSTART.md`
