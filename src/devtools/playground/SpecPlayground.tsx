/**
 * Read-only spec playground harness.
 * Paste PanelSpec JSON, validate, render preview, and drive the spec inspector.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { validateSpec, defaultCatalog } from '../../panels/spec';
import type { NormalizedPanelSpec } from '../../panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../panels/renderer';
import type { DataLifecycle } from '../../panels/renderer';
import type { PanelScope, PanelSpec } from '../../panels/types';
import { createSpecDevtoolsSession } from '../specDevtoolsSession';
import { withSpecDevtoolsSources } from '../specDevtoolsAdapter';
import { createSpecInspectorPanelDefinition } from '../panels/specInspectorPanel';
import {
  DEVTOOLS_BINDINGS_SOURCE,
  DEVTOOLS_EVENTS_SOURCE,
  DEVTOOLS_VALIDATION_SOURCE,
} from '../specDevtoolsRows';
import { SAMPLE_INVALID_SPEC_JSON, SAMPLE_VALID_SPEC_JSON } from './sampleSpecs';

const PLAYGROUND_SCOPE: PanelScope = { contextId: 'spec-playground', entityId: 'preview' };

const INSPECTOR_ADAPTER_SOURCES = new Set([
  DEVTOOLS_VALIDATION_SOURCE,
  DEVTOOLS_BINDINGS_SOURCE,
  DEVTOOLS_EVENTS_SOURCE,
]);

function parseSpecInput(raw: string): { spec: PanelSpec | null; parseError: string | null } {
  if (raw.trim().length === 0) {
    return { spec: null, parseError: 'Paste a PanelSpec JSON envelope to preview.' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { spec: null, parseError: 'Spec must be a JSON object.' };
    }
    return { spec: parsed as PanelSpec, parseError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message: 'Invalid JSON';
    return { spec: null, parseError: message };
  }
}

function validatedPreviewSpec(
  spec: PanelSpec,
  panelRegistry: Set<string>): { normalized: NormalizedPanelSpec | null; errors: string[] } {
  const result = validateSpec(spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(),
    hostActions: new Set(),
    panelRegistry,
  });
  if (!result.ok) {
    return {
      normalized: null,
      errors: result.errors.map((entry) => `${entry.code}: ${entry.message}`),
    };
  }
  return { normalized: result.spec, errors: [] };
}

export interface SpecPlaygroundProps {
  initialSpecJson?: string;
}

export function SpecPlayground({
  initialSpecJson = SAMPLE_VALID_SPEC_JSON,
}: SpecPlaygroundProps): ReactElement {
  const [rawJson, setRawJson] = useState(initialSpecJson);
  const session = useMemo(() => createSpecDevtoolsSession, []);

  const inspectorDefinition = useMemo(() => createSpecInspectorPanelDefinition, []);
  const inspectorSpec = useMemo(() => {
    if (inspectorDefinition().kind !== 'spec') {
      throw new Error('spec inspector must compile to a spec panel');
    }
    const validation = validateSpec(inspectorDefinition().spec, {
      catalog: defaultCatalog,
      adapterSources: INSPECTOR_ADAPTER_SOURCES,
      hostActions: new Set(),
      panelRegistry: new Set(['spec-inspector']),
    });
    if (!validation.ok) {
      throw new Error(`spec inspector failed validation: ${JSON.stringify(validation.errors)}`);
    }
    return validation.spec;
  }, [inspectorDefinition]);

  const lifecycle = useMemo((): DataLifecycle => {
    const adapter = withSpecDevtoolsSources(session(), {
      query: async () => null,
      mutate: async () => ({ ok: true as const }),
    });
    return createDataLifecycle({ adapter, retryBackoffMs: 5 });
  }, [session]);

  useEffect(() => ()=> lifecycle.dispose, [lifecycle]);

  const inspect = useCallback(
    (raw: string): void => {
      const { spec, parseError } = parseSpecInput(raw);
      if (parseError !== null || spec === null) {
        session().inspectSpec({
          targetLabel: 'playground',
          spec: null,
          errors: [
            {
              code: 'SPEC_ENVELOPE_INVALID',
              message: parseError ?? 'Invalid spec JSON',
              severity: 'error',
            },
          ],
        });
        return;
      }

      const validation = validateSpec(spec, {
        catalog: defaultCatalog,
        adapterSources: new Set(),
        hostActions: new Set(),
        panelRegistry: new Set(),
      });

      if (!validation.ok) {
        session().inspectSpec({
          targetLabel: 'playground',
          spec,
          errors: validation.errors,
          warnings: validation.warnings,
        });
        return;
      }

      session().inspectSpec({
        targetLabel: 'playground',
        spec: validation.spec,
        warnings: validation.warnings,
      });
    },
    [session]);

  useEffect(() => {
    inspect(rawJson);
  }, [inspect, rawJson]);

  const { spec, parseError } = useMemo(() => parseSpecInput(rawJson), [rawJson]);
  const preview = useMemo(() => {
    if (spec === null) {
      return { normalized: null, errors: parseError !== null ? [parseError]: [] };
    }
    return validatedPreviewSpec(spec, new Set());
  }, [parseError, spec]);

  return (
    <div
      data-testid="spec-playground"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr) minmax(300px, 1fr)',
        gap: '1rem',
        padding: '1rem',
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section aria-label="Spec input">
        <header style={{ marginBottom: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Spec playground</h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Read-only preview — paste PanelSpec JSON (not a builder).
          </p>
        </header>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            data-testid="load-valid-sample"
            onClick={() => setRawJson(SAMPLE_VALID_SPEC_JSON)}
          >
            Valid sample
          </button>
          <button
            type="button"
            data-testid="load-invalid-sample"
            onClick={() => setRawJson(SAMPLE_INVALID_SPEC_JSON)}
          >
            Invalid sample
          </button>
        </div>
        <textarea
          data-testid="spec-playground-input"
          aria-label="PanelSpec JSON"
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: '420px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.8rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #334155',
            background: '#020617',
            color: '#f8fafc',
          }}
        />
      </section>

      <section aria-label="Spec preview">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Preview</h2>
        {preview.normalized === null ? (
          <div data-testid="spec-playground-preview-error" role="alert">
            {preview.errors.map((entry) => (
              <p key={entry} style={{ margin: '0 0 0.5rem', color: '#fca5a5' }}>
                {entry}
              </p>
            ))}
          </div>
        ): (
          <div
            data-testid="spec-playground-preview"
            style={{
              background: '#f8fafc',
              color: '#0f172a',
              borderRadius: '0.5rem',
              minHeight: '420px',
              overflow: 'auto',
            }}
          >
            <SpecRenderer
              spec={preview.normalized}
              scope={PLAYGROUND_SCOPE}
              lifecycle={lifecycle}
              bodyScroll="auto"
            />
          </div>
        )}
      </section>

      <section aria-label="Spec inspector">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Inspector</h2>
        <div
          data-testid="spec-playground-inspector"
          style={{
            background: '#f8fafc',
            color: '#0f172a',
            borderRadius: '0.5rem',
            minHeight: '420px',
            overflow: 'auto',
          }}
        >
          <SpecRenderer
            spec={inspectorSpec}
            scope={PLAYGROUND_SCOPE}
            lifecycle={lifecycle}
            bodyScroll="auto"
          />
        </div>
      </section>
    </div>
  );
}
