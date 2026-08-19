---
lrn: lrn::en:platform:agentable-canvas.feature.catalog-charts-addon::doc
related_docs:
  - docs/setup/ADOPTER_QUICKSTART.md
  - docs/setup/whiteboard-embed.md
changelog:
  - date: 2026-07-21
    summary: @agentable/catalog-charts add-on — bar/line/area/pie composites, Zod props, opt-in catalog merge.
---

# Catalog charts add-on 

Optional heavy-dependency package following the add-on pattern. Data visuals ride the validated panel path as composed spec panels (provenance-badged, pinnable) instead of throwaway canvas sketches.

## Package

| Export | Purpose |
|--------|---------|
| `@agentable/catalog-charts` | Pack factory, catalog merge, Zod schemas, components |
| `mergeChartsCatalog(base)` | Opt-in merge of `chart-bar`, `chart-line`, `chart-area`, `chart-pie` onto a host catalog |
| `createChartsPack` | Demo panels + merged catalog for `createCanvasHost` |

Install path: `agentable-canvas/catalog-charts` (source export) or `@agentable/catalog-charts` via Vitest/workspace alias.

## Chart composites

| Catalog entry | Schema | Notes |
|---------------|--------|-------|
| `chart-bar` | `barChartPropsSchema` | Categorical comparisons |
| `chart-line` | `lineChartPropsSchema` | Ordered trends |
| `chart-area` | `areaChartPropsSchema` | Filled trend areas |
| `chart-pie` | `pieChartPropsSchema` | Part-to-whole; optional donut via `innerRadius` |

Props accept inline `data` **or** read-only `bind` to a declared source. Charts never mutate panel data.

## Host wiring

```typescript
import { createCanvasHost } from 'agentable-canvas/panels/host';
import { createChartsPack } from '@agentable/catalog-charts';

const charts = createChartsPack;

const host = createCanvasHost({
  panels: [...charts.panels],
  catalog: charts.catalog,
});
```

Agents compose charts via `compose_panel` using `buildComposedChartSpec({ chartType, chartProps, title })` with `origin: 'agent'` for provenance + pin flows.

## Bundle boundary

Core `src/` does **not** import `@agentable/catalog-charts`. Chart entries are absent from `v1CatalogEntries`. Legacy embed gzip budget (`check:bundle`, 950 KB ceiling) remains a separate PASS_WITH_GAPS track — this add-on proves isolation via import-graph tests, not by shrinking the existing whiteboard bundle.

## Tests

| File | Coverage |
|------|----------|
| `tests/unit/catalogChartsSchema.test.ts` | Zod validation per chart type |
| `tests/unit/catalogChartsRender.test.tsx` | Composite smoke (recharts mocked) |
| `tests/unit/catalogChartsBundleBoundary.test.ts` | Core import graph + v1 catalog exclusion |
| `tests/unit/catalogChartsPack.test.ts` | Pack assembly + composed spec helper |

## Module map

- `packages/catalog-charts/src/schema/chartProps.ts` — Zod prop contracts
- `packages/catalog-charts/src/catalog/components.tsx` — Recharts renderers
- `packages/catalog-charts/src/catalog/entries.ts` — catalog registration
- `packages/catalog-charts/src/panels.ts` — demo panel blueprints + `buildComposedChartSpec`
- `packages/catalog-charts/src/pack.ts` — `createChartsPack` factory
