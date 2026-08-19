/**
 * telemetry event catalog published.
 * Automated check: catalog doc covers all families + frozen codes; entity + reference sink exist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { FROZEN_TELEMETRY_ERROR_CODES } from '../../src/telemetry/frozenErrorCodes';
import type { TelemetryEventFamily } from '../../src/telemetry/types';
import { createReferenceTelemetrySink } from '../../examples/telemetry-reference-sink/referenceSink';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const CATALOG_DOC_PATH = path.join(REPO_ROOT, 'docs/features/telemetry-event-catalog.md');
const ENTITY_PATH = path.join(REPO_ROOT, 'assets/entities/canvas.telemetry.event-catalog.json');
const REFERENCE_SINK_PATH = path.join(
  REPO_ROOT,
  'examples/telemetry-reference-sink/referenceSink.ts');

const TELEMETRY_EVENT_FAMILIES: readonly TelemetryEventFamily[] = [
  'compose',
  'hitl',
  'tool',
  'voice',
  'cost',
  'embed',
];

function readCatalogDoc(): string {
  expect(existsSync(CATALOG_DOC_PATH), CATALOG_DOC_PATH).toBe(true);
  return readFileSync(CATALOG_DOC_PATH, 'utf8');
}

describe(' telemetry event catalog ', () => {
  it('publishes the catalog feature doc with LRN frontmatter', () => {
    const doc = readCatalogDoc();
    expect(doc).toContain('lrn: lrn::en:platform:agentable-canvas.feature.telemetry-event-catalog::doc');
    expect(doc).toContain('# Telemetry event catalog');
    expect(doc).toContain('## Event families');
    expect(doc).toContain('## Frozen error codes');
    expect(doc).toContain('## Reference sink example');
  });

  it('documents every telemetry event family', () => {
    const doc = readCatalogDoc();
    for (const family of TELEMETRY_EVENT_FAMILIES) {
      expect(doc, `missing family \`${family}\``).toMatch(new RegExp(`\`${family}\``));
    }
  });

  it('documents every frozen telemetry error code', () => {
    const doc = readCatalogDoc();
    for (const code of FROZEN_TELEMETRY_ERROR_CODES) {
      expect(doc, `missing frozen code \`${code}\``).toContain(`\`${code}\``);
    }
    expect(FROZEN_TELEMETRY_ERROR_CODES.length).toBeGreaterThanOrEqual(36);
  });

  it('registers the ecosystem entity with matching LRN', () => {
    expect(existsSync(ENTITY_PATH), ENTITY_PATH).toBe(true);
    const entity = JSON.parse(readFileSync(ENTITY_PATH, 'utf8')) as {
      entity_id: string;
      metadata: { lrn: string };
    };
    expect(entity.entity_id).toBe('canvas.telemetry.event-catalog');
    expect(entity.metadata.lrn).toBe(
      'lrn::en:platform:agentable-canvas.feature.telemetry-event-catalog::feature');
  });

  it('ships the reference sink example and routes all families', () => {
    expect(existsSync(REFERENCE_SINK_PATH), REFERENCE_SINK_PATH).toBe(true);

    const records: Array<{ kind: TelemetryEventFamily; payload: Record<string, unknown> }> = [];
    const sink = createReferenceTelemetrySink((record) => {
      records.push({ kind: record.kind, payload: record.payload });
    });

    sink({
      ts: '2026-07-21T21:00:00.000Z',
      family: 'compose',
      phase: 'compose',
      outcome: 'rejected',
      tool: 'compose_panel',
      errorCodes: ['SPEC_ACTION_REF_MISSING'],
    });
    sink({
      ts: '2026-07-21T21:00:01.000Z',
      family: 'hitl',
      outcome: 'approved',
      panelId: 'p1',
      definitionId: 'def',
      actionId: 'save',
    });
    sink({
      ts: '2026-07-21T21:00:02.000Z',
      family: 'tool',
      toolName: 'compose_panel',
      outcome: 'error',
      latencyMs: 12,
      errorCodes: ['SCOPE_DENIED'],
    });
    sink({
      ts: '2026-07-21T21:00:03.000Z',
      family: 'voice',
      outcome: 'connected',
      sessionId: 'voice-1',
    });
    sink({
      ts: '2026-07-21T21:00:04.000Z',
      family: 'cost',
      outcome: 'refused',
      agentId: 'agent-1',
      capability: 'compose_panel',
      costClass: 'expensive',
      units: 1,
      errorCodes: ['BUDGET_HARD_CAP'],
    });
    sink({
      ts: '2026-07-21T21:00:05.000Z',
      family: 'embed',
      operation: 'tenant_lookup',
      outcome: 'refused',
      retryAfterMs: 60_000,
      errorCodes: ['RATE_LIMITED'],
    });

    expect(new Set(records.map((r) => r.kind))).toEqual(new Set(TELEMETRY_EVENT_FAMILIES));
  });
});
