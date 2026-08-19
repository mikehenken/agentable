# @agentable/support-inbox-pack

Shared **support inbox** domain pack for Agentable canvas hosts — Tier 2 panel definitions, generated tools, persona scaffold, and documented extension points ( pattern).

## What you get

| Panel | Id | Purpose |
|-------|-----|---------|
| Inbox | `inbox` | Filterable ticket queue (status, priority, search) |
| Ticket detail | `ticket-detail` | Conversation thread for a selected ticket |
| Macros | `macros` | Canned responses and quick-reply templates |

All panels compile from `defineSchemaPanel` and validate against the v1 catalog. Data flows through a mock-first `createStaticSupportInboxAdapter` with optional localStorage-backed replies.

## Quickstart (published packages)

> **Freeze note:** While `deploy_allowed: false`, the pack ships in the `agentable-canvas` repo but is **not** published to npm/GitHub Packages yet. Pin the git ref that includes `packages/support-inbox-pack/` (same ref as landi-canvas-studio) or develop from a monorepo checkout. After freeze lifts, import `agentable-canvas/support-inbox-pack` from the released package only.

### 1. Install

```bash
npm install github:mikehenken/agentable#v0.2.0
```

Verify the export after install (post-freeze release must include `./support-inbox-pack`):

```bash
node -e "import('agentable-canvas/support-inbox-pack').then(m => console.log(m.SUPPORT_INBOX_PANEL_IDS))"
```

### 2. Create the pack + host config

```ts
import {
  createSupportInboxPack,
  resolveSupportInboxHostConfig,
  toReactHostConfig,
} from 'agentable-canvas/support-inbox-pack';
import { createCanvasHost } from 'agentable-canvas/src/panels/host'; monorepo alias until./panels export ships
import { WhiteboardShell } from 'agentable-canvas/whiteboard';

const pack = createSupportInboxPack({
  tenant: 'northwind-support',
  persona: { assistantName: 'Casey', tenantTitle: 'Northwind Support Desk' },
});

const hostConfig = resolveSupportInboxHostConfig(pack, {
  adapter: { kind: 'static', dataUrl: '/fixtures/northwind-support-data.json' },
});

const host = createCanvasHost({
  engine: createWhiteboardEngine,
  panels: [...hostConfig.panels],
});

export function SupportApp {
  return <WhiteboardShell host={host} config={toReactHostConfig(hostConfig)} />;
}
```

### 3. Plain-HTML embed (zero build step)

```html
<agentable-panel
  panel="inbox"
  config-url="/fixtures/northwind-support-config.json"
  primary-color="#2563EB"
></agentable-panel>
<script type="module" src="/embed/agentable-panel.js"></script>
```

See `examples/support-inbox-quickstart/` for a runnable fixture page and Playwright smoke.

### 4. Extend without forking 

```ts
import { createSupportInboxPack, extendSupportInboxPack } from 'agentable-canvas/support-inbox-pack';
import { defineStaticPanel } from 'agentable-canvas/src/panels/builder';

const base = createSupportInboxPack;
const extended = extendSupportInboxPack(base, {
  panels: [
    defineStaticPanel({
      id: 'sla-dashboard',
      meta: { title: 'SLA Dashboard', schemaVersion: 1 },
      blocks: [{ block: 'header', title: 'SLA Dashboard' }],
    }),
  ],
  navItems: [{ id: 'sla', label: 'SLA', icon: 'Gauge', panelId: 'sla-dashboard' }],
});
```

## Verify

```bash
npm run test -- tests/unit/supportInboxPack.test.ts tests/unit/supportInboxPackInterop.test.ts
npm run test:e2e -- tests/e2e/support-inbox-quickstart.spec.ts
```

## Related

- Career pack (first example): `agentable-canvas/career-pack`
- Adopter quickstart (generic two-panel): `docs/setup/ADOPTER_QUICKSTART.md`
- Feature doc: `docs/features/support-inbox-pack.md`
