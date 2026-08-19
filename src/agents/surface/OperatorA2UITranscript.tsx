import { useEffect, useMemo, type ReactElement } from 'react';
import { ingestA2UIStream } from '../../a2ui';
import type { A2UIEnvelope } from '../../a2ui/types';
import { defaultCatalog, validateSpec } from '../../panels/spec';
import type { NormalizedPanelSpec } from '../../panels/spec';
import { createDataLifecycle, SpecRenderer } from '../../panels/renderer';
import type { DataAdapter } from '../../panels/renderer';
import type { PanelScope } from '../../panels/types';

const OPERATOR_A2UI_SCOPE: PanelScope = {
  contextId: 'operator-surface',
  entityId: 'operator-transcript',
};

const readOnlyTranscriptAdapter: DataAdapter = {
  query(): Promise<unknown> {
    return Promise.resolve({});
  },
  mutate(): Promise<{ ok: false; error: { code: 'forbidden'; message: string } }> {
    return Promise.resolve({
      ok: false,
      error: { code: 'forbidden', message: 'Operator transcript is read-only.' },
    });
  },
};

export interface OperatorA2UITranscriptProps {
  envelopes: readonly A2UIEnvelope[];
  messageId: string;
}

function normalizeIngestedSpec(
  envelopes: readonly A2UIEnvelope[]): NormalizedPanelSpec | null {
  const ingest = ingestA2UIStream(envelopes);
  if (!ingest.ok) {
    return null;
  }
  const validation = validateSpec(ingest.spec, {
    catalog: defaultCatalog,
    adapterSources: new Set(),
    hostActions: new Set(),
    panelRegistry: new Set(),
  });
  return validation.ok ? validation.spec: null;
}

export function OperatorA2UITranscript({
  envelopes,
  messageId,
}: OperatorA2UITranscriptProps): ReactElement {
  const normalized = useMemo(() => normalizeIngestedSpec(envelopes), [envelopes]);
  const lifecycle = useMemo(() =>
      createDataLifecycle({
        adapter: readOnlyTranscriptAdapter,
        retryBackoffMs: 0,
      }),
    []);

  useEffect(() => () => lifecycle.dispose(), [lifecycle]);

  if (normalized === null) {
    return (
      <div
        part="a2ui-error"
        role="alert"
        data-testid={`operator-a2ui-error-${messageId}`}
      >
        Unable to render A2UI message.
      </div>
    );
  }

  return (
    <div
      part="a2ui-content"
      className="operator-a2ui-content"
      data-testid={`operator-a2ui-content-${messageId}`}
    >
      <SpecRenderer
        spec={normalized}
        scope={OPERATOR_A2UI_SCOPE}
        lifecycle={lifecycle}
        bodyScroll="auto"
      />
    </div>
  );
}
