/**
 * render parity: A2UI-ingested IR vs hand-authored native IR produce
 * byte-identical DOM after validateSpec + SpecRenderer ( ).
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ingestA2UIStream } from '../../src/a2ui';
import type { A2UIConformanceFixture } from '../../src/a2ui';
import { A2UI_DATA_ADAPTER_SOURCE } from '../../src/a2ui/constants';
import { defaultCatalog, validateSpec } from '../../src/panels/spec';
import type { NormalizedPanelSpec } from '../../src/panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../src/panels/renderer';
import type { PanelScope, PanelSpec } from '../../src/panels/types';
import { createMockDataAdapter } from '../helpers/mockDataAdapter';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/a2ui/conformance-fixtures.json');

const FIXTURES = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as A2UIConformanceFixture[];

const SCOPE: PanelScope = { contextId: 'a2ui-conformance', entityId: 'surface-1' };

function validated(spec: PanelSpec, fixture: A2UIConformanceFixture): NormalizedPanelSpec {
  const hints = fixture.validation ?? {};
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(hints.adapterSources ?? []),
    hostActions: new Set(hints.hostActions ?? []),
    panelRegistry: new Set(hints.panelRegistry ?? []),
  });
  if (!result.ok) {
    throw new Error(`validation failed: ${JSON.stringify(result.errors)}`);
  }
  return result.spec;
}

function normalizeUnstableDom(html: string): string {
  return html.replace(/(_r_[a-z0-9]+)/gi, '_r_stable_');
}

function contactPayload(state: Record<string, unknown> | undefined): Record<string, unknown> {
  const contact = state?.contact;
  if (typeof contact === 'object' && contact !== null && !Array.isArray(contact)) {
    return contact as Record<string, unknown>;
  }
  return {};
}

function renderSpec(spec: NormalizedPanelSpec, state?: Record<string, unknown>): string {
  const payload = contactPayload(state);
  const adapter = createMockDataAdapter({
    latencyMs: 0,
    plan: (ref) =>
      ref.source === A2UI_DATA_ADAPTER_SOURCE ? { data: payload }: { data: {} },
  });
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 0 });
  const view = render(<SpecRenderer spec={spec} scope={SCOPE} lifecycle={lifecycle} />);
  const html = normalizeUnstableDom(view.container.innerHTML);
  view.unmount();
  lifecycle.dispose();
  return html;
}

async function renderSpecSettled(
  spec: NormalizedPanelSpec,
  state?: Record<string, unknown>): Promise<string> {
  const payload = contactPayload(state);
  const adapter = createMockDataAdapter({
    latencyMs: 0,
    plan: (ref) =>
      ref.source === A2UI_DATA_ADAPTER_SOURCE ? { data: payload }: { data: {} },
  });
  const lifecycle = createDataLifecycle({ adapter, retryBackoffMs: 0 });
  const view = render(<SpecRenderer spec={spec} scope={SCOPE} lifecycle={lifecycle} />);
  await waitFor(() => {
    expect(view.container.querySelectorAll('[data-testid="loading-skeleton"]')).toHaveLength(0);
  });
  const html = normalizeUnstableDom(view.container.innerHTML);
  view.unmount();
  lifecycle.dispose();
  return html;
}

const ASYNC_FIXTURE_IDS = new Set(['contact-email-stream']);

describe('A2UI ingestion render parity vs native IR', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.id}: DOM matches between ingested and native IR`, async () => {
      const ingest = ingestA2UIStream(fixture.messages);
      expect(ingest.ok).toBe(true);
      if (!ingest.ok) {
        return;
      }

      const ingested = validated(ingest.spec, fixture);
      const native = validated(fixture.expectedIr, fixture);
      const state = fixture.expectedIr.state as Record<string, unknown> | undefined;

      const ingestedHtml = ASYNC_FIXTURE_IDS.has(fixture.id)
        ? await renderSpecSettled(ingested, state): renderSpec(ingested, state);
      const nativeHtml = ASYNC_FIXTURE_IDS.has(fixture.id)
        ? await renderSpecSettled(native, state): renderSpec(native, state);

      expect(ingestedHtml).toBe(nativeHtml);
    });
  }
});
