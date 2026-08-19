# Telemetry reference sink

Demonstrates host-side routing of structured runtime telemetry emitted by `createCanvasHost`.

## Files

| File | Purpose |
|------|---------|
| `referenceSink.ts` | `createReferenceTelemetrySink`, a family switch plus frozen-code guard |
| [telemetry-event-catalog.md](../../docs/features/telemetry-event-catalog.md) | Full event catalog and frozen error codes |

## Usage

```typescript
import { createCanvasHost } from '../../src/panels/host';
import { createReferenceTelemetrySink } from './referenceSink';

const host = createCanvasHost({
  telemetrySink: createReferenceTelemetrySink((record) => {
     Forward to your observability stack (Datadog, OpenTelemetry, etc.)
    console.info('[telemetry]', record.kind, record.payload);
  }),
});
```

Events arrive already redacted. Do not log raw embed anon keys; `anonKeyHint` is already truncated at the framework boundary.

## Automated check

```bash
npm run test -- telemetryEventCatalog
```
