---
doc_type: guide
title: Adopter quickstart
description: Minimal two-panel React app using agentable-canvas from a published git pin, plus local substrate dev via VITE_LOCAL_AGENTABLE.
created_at: "2026-07-21"
version: "1.0.0"
updated_at: "2026-07-21"
lrn: "lrn::en:platform:component:agentable-canvas:adopter-quickstart::doc"
entity_id: platform.component.agentable-canvas.adopter-quickstart
entity_type: guide
related_docs:
  - "development/ARCHITECTURE.md"
  - "whiteboard-embed.md"
  - "RELEASE.md"
changelog:
  - version: "1.0.0"
    date: "2026-07-21"
    type: "minor"
    author: "documentation-engineer"
    description: "Two-panel whiteboard quickstart for published package consumers (ASSUME-04)"
---

# Adopter quickstart

Build a minimal **two-panel** whiteboard app on top of `agentable-canvas`. Panels render as draggable tldraw shapes (`PanelShape`), not fixed columns.

## Prerequisites

- Node.js 20+
- React 19 + Vite (or compatible bundler)
- A server token mint URL for voice in production (`token-endpoint`). Use env vars in dev; never commit API keys.

## Install (published git pin)

When `deploy_allowed` is false in study runs, pin the same ref landi-canvas-studio uses:

```bash
npm install github:mikehenken/agentable#v0.2.0
```

The installed package name is `agentable-canvas` (from upstream `package.json`).

Verify embed artifacts after install:

```bash
ls node_modules/agentable-canvas/dist/embed/agentable-whiteboard.js
```

If missing:

```bash
cd node_modules/agentable-canvas
npm run build:embed
```

## Two-panel React app

This pattern uses only documented package exports (`agentable-canvas/whiteboard`). It passes a stable module-scope loader map to `WhiteboardShell`. The default OSS registry includes `chat`; add one custom panel for a two-panel demo.

### 1. Panel components

`src/panels/NotesPanel.tsx`:

```tsx
import type { WhiteboardPanelProps } from 'agentable-canvas/whiteboard';

export function NotesPanel({ data, hostedInWhiteboard }: WhiteboardPanelProps) {
  const title = typeof data?.title === 'string' ? data.title: 'Notes';
  return (
    <div data-hosted-in-whiteboard={hostedInWhiteboard ? 'true': 'false'}>
      <h2>{title}</h2>
      <p>Custom panel body.</p>
    </div>
  );
}
```

### 2. Registry (module scope)

Keep the registry object at module scope so lazy loaders memoize correctly.

`src/panel-registry.ts`:

```tsx
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
} from 'agentable-canvas/whiteboard';

export const APP_PANELS: WhiteboardPanelRegistry = {...DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  notes: => import('./panels/NotesPanel').then((m) => ({ default: m.NotesPanel })),
};
```

`DEFAULT_WHITEBOARD_PANEL_REGISTRY` ships the built-in `chat` loader from the package export.

### 3. App shell

`src/App.tsx`:

```tsx
import { Suspense, useEffect } from 'react';
import {
  LazyWhiteboardShell,
  openPanelInCanvas,
  prefetchWhiteboardShell,
} from 'agentable-canvas/whiteboard';
import { APP_PANELS } from './panel-registry';

const tokenEndpoint = import.meta.env.VITE_TOKEN_MINT_URL ?? '';

/** Opens the second panel after mount; chat opens via openChatOnMount default. */
function OpenNotesOnMount {
  useEffect( => {
    openPanelInCanvas('notes', {
      focus: false,
      panelProps: { title: 'My notes' },
    });
  }, []);
  return null;
}

export function App {
  useEffect( => {
    prefetchWhiteboardShell;
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Suspense fallback={<p>Loading whiteboard…</p>}>
        <LazyWhiteboardShell
          panels={APP_PANELS}
          config={{
            tenant: 'demo',
            persona: {
              assistantName: 'Demo',
              systemPrompt: 'You help users organize notes on a canvas.',
              tokenEndpoint: tokenEndpoint || undefined,
            },
          }}
        />
        <OpenNotesOnMount />
      </Suspense>
    </div>
  );
}
```

`openPanelInCanvas` queues until the tldraw editor binds (see `panelShapeApi`). `openChatOnMount` defaults to `true` for `infinite-panels` layout, so the chat panel opens on editor mount without extra code.

### 4. Vite env

`.env.local`:

```bash
VITE_TOKEN_MINT_URL=https://dev.landi.build/api/ai/gemini-token
```

Do not set `VITE_GEMINI_API_KEY` in a public app bundle.

### 5. Run

```bash
npm run dev
```

## Preferred wiring (monorepo advanced)

When you control the bundler aliases (as landi-canvas-studio does), register panels through `createCanvasHost`:

```tsx
import { WhiteboardShell, createWhiteboardEngine } from 'agentable-canvas/whiteboard';
import { createCanvasHost } from '@agentable/panels/host';
import { defineStaticPanel } from '@agentable/panels/builder';

const notesPanel = defineStaticPanel({
  id: 'notes',
  meta: { title: 'Notes', schemaVersion: 1, agentDescription: 'Static notes panel.' },
  blocks: [{ block: 'text', text: 'Hello from a spec panel.' }],
});

const engine = createWhiteboardEngine;
const host = createCanvasHost({ engine, panels: [notesPanel] });

<WhiteboardShell host={host} config={tenantConfig} />;
```

Add a Vite alias:

```ts
{ find: '@agentable/panels', replacement: path.resolve(__dirname, 'node_modules/agentable-canvas/src/panels') }
```

This path is not in the package `exports` map yet; the alias matches the studio reference host.

## Local substrate development (landi-canvas-studio)

When iterating on `agentable-canvas` alongside landi-canvas-studio:

1. Clone `agentable-canvas` at `../agentable-canvas`
2. In studio `.env.local`:

```bash
VITE_LOCAL_AGENTABLE=1
```

3. Start studio:

```bash
npm run dev
```

Vite logs `[vite] VITE_LOCAL_AGENTABLE=1` and aliases `agentable-canvas` to `../agentable-canvas`. Edits under the substrate repo hot-reload in the studio host.

Do **not** change the git pin in `package.json` during local iteration. See landi-canvas-studio `docs/setup/LOCAL_DEVELOPMENT.md`.

## Script-tag alternative

For non-React hosts, use `<agentable-whiteboard>` instead. See [whiteboard-embed.md](./whiteboard-embed.md).

## Verify your integration

From `agentable-canvas`:

```bash
npm run test
npm run test:component
```

From landi-canvas-studio (reference host):

```bash
npm run test
npm run test:e2e:mock
```

See [INTEROP_MATRIX.md](../development/INTEROP_MATRIX.md) for the full smoke matrix.

## Related

- [ARCHITECTURE.md](../development/ARCHITECTURE.md)
- [RELEASE.md](./RELEASE.md)
- [INSTALL.md](../../INSTALL.md)
