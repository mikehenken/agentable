/**
 * A2UI v1.0 ingestion adapter — unit tests with conformance fixtures.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ingestA2UIEnvelope,
  ingestA2UIStream,
  ingestAndValidateA2UI,
  parseA2UIEnvelope,
  safeParseA2UIEnvelope,
} from '../../src/a2ui';
import type { A2UIConformanceFixture } from '../../src/a2ui';
import { defaultCatalog, validateSpec } from '../../src/panels/spec';
import type { PanelSpec } from '../../src/panels/types';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/a2ui/conformance-fixtures.json');

const FIXTURES = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as A2UIConformanceFixture[];

function ingestFixture(fixture: A2UIConformanceFixture): PanelSpec {
  const result =
    fixture.messages.length === 1
      ? ingestA2UIEnvelope(fixture.messages[0]): ingestA2UIStream(fixture.messages);
  expect(result.ok, JSON.stringify(!result.ok ? result.errors: null)).toBe(true);
  if (!result.ok) {
    throw new Error('fixture ingest failed');
  }
  return result.spec;
}

describe('A2UI envelope schema', () => {
  it('rejects envelopes without exactly one message key', () => {
    const parsed = safeParseA2UIEnvelope({ version: 'v1.0' });
    expect(parsed.ok).toBe(false);
  });

  it('rejects unsupported protocol versions', () => {
    const parsed = safeParseA2UIEnvelope({
      version: 'v0.9.1',
      updateComponents: { surfaceId: 'x', components: [{ id: 'root', component: 'Column' }] },
    });
    expect(parsed.ok).toBe(false);
  });

  it('accepts v1.0 updateComponents envelopes', () => {
    const envelope = parseA2UIEnvelope({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'demo',
        components: [{ id: 'root', component: 'Column' }],
      },
    });
    expect(envelope.updateComponents?.surfaceId).toBe('demo');
  });
});

describe('A2UI conformance fixtures -> native IR', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.id}: ingested spec matches expected IR envelope`, () => {
      const spec = ingestFixture(fixture);
      expect(spec).toEqual(fixture.expectedIr);
    });

    it(`${fixture.id}: ingested spec passes validateSpec`, () => {
      const spec = ingestFixture(fixture);
      const hints = fixture.validation ?? {};
      const validation = validateSpec(spec, {
        catalog: defaultCatalog,
        adapterSources: new Set(hints.adapterSources ?? []),
        hostActions: new Set(hints.hostActions ?? []),
        panelRegistry: new Set(hints.panelRegistry ?? []),
      });
      expect(validation.ok, JSON.stringify(!validation.ok ? validation.errors: null)).toBe(true);
    });

    it(`${fixture.id}: ingestAndValidateA2UI pipeline succeeds`, () => {
      const hints = fixture.validation ?? {};
      const pipeline = ingestAndValidateA2UI(fixture.messages, {
        catalog: defaultCatalog,
        adapterSources: new Set(hints.adapterSources ?? []),
        hostActions: new Set(hints.hostActions ?? []),
        panelRegistry: new Set(hints.panelRegistry ?? []),
      });
      expect(pipeline.ingest.ok).toBe(true);
      expect(pipeline.validation?.ok).toBe(true);
    });
  }
});

describe('A2UI ingestion errors', () => {
  it('fails when root component is missing', () => {
    const result = ingestA2UIEnvelope({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'orphan',
        components: [{ id: 'only', component: 'Text', text: 'Hi' }],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('A2UI_ROOT_MISSING');
    }
  });

  it('fails when data-model path cannot be resolved for Text', () => {
    const result = ingestA2UIEnvelope({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'missing_path',
        components: [
          { id: 'root', component: 'Column', children: ['label'] },
          { id: 'label', component: 'Text', text: { path: '/missing' } },
        ],
      },
    });
    expect(result.ok).toBe(false);
  });
});
