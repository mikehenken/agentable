/**
 * Renders a validated composed spec inside a panel shape body (Tier 3).
 */
import { useMemo, type ReactElement } from 'react';
import { t } from '../../i18n';
import { createDataLifecycle, SpecRenderer } from '../renderer';
import { validateSpec, defaultCatalog } from '../spec';
import { dispatchChatPrompt } from '../../choreography/dispatchPrompt';
import { readComposedSpec } from '../provenance';

export interface ComposedSpecPanelProps {
  data: Record<string, unknown>;
  bodyScroll?: 'auto' | 'hidden';
}

const noopLifecycle = createDataLifecycle({
  adapter: {
    query: async () => null,
    mutate: async () => ({ ok: true as const }),
  },
});

export function ComposedSpecPanel({ data, bodyScroll = 'auto' }: ComposedSpecPanelProps): ReactElement {
  const spec = readComposedSpec(data);

  const normalized = useMemo(() => {
    if (spec === null) return null;
    const validation = validateSpec(spec, {
      catalog: defaultCatalog,
      adapterSources: new Set(),
      hostActions: new Set(),
      panelRegistry: new Set(),
    });
    return validation.ok ? validation.spec : null;
  }, [spec]);

  if (normalized === null) {
    return (
      <div data-testid="composed-spec-invalid" role="alert">
        {t('chrome.composed.invalid')}
      </div>
    );
  }

  return (
    <SpecRenderer
      spec={normalized}
      scope={{}}
      lifecycle={noopLifecycle}
      bodyScroll={bodyScroll}
      onPrompt={dispatchChatPrompt}
    />
  );
}

export function hasComposedSpecData(data: Record<string, unknown> | undefined): boolean {
  return readComposedSpec(data) !== null;
}
