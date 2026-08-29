/**
 * Panel body renderer for whiteboard PanelShapes — wires host lifecycle
 * (adapter queries) and spec panels the same way PanelEmbedShell does.
 */
import {
  Suspense,
  useMemo,
  type ComponentType,
  type LazyExoticComponent,
  type ReactElement,
} from 'react';
import { t } from '../../../i18n';
import type { PanelDefinition } from '../../../panels/types';
import { SpecRenderer } from '../../../panels/renderer';
import { defaultCatalog, validateSpec, type NormalizedPanelSpec } from '../../../panels/spec';
import type { WhiteboardPanelProps, WhiteboardPanelRegistry } from './whiteboardPanelRegistry';
import { useLazyPanel } from './useLazyPanel';
import {
  useOptionalPanelEmbedHost,
  usePanelEmbedAdapterSources,
} from '../../../embed/panel/PanelEmbedContext';
import { getWhiteboardPanelAdapterSources, useWhiteboardPanelHost } from './whiteboardPanelHostBridge';
import { useEmbedReactPanelData } from '../../../embed/panel/useEmbedReactPanelData';
import { ComposedSpecPanel } from '../../../panels/provenance/ComposedSpecPanel';

function PanelLoadingPlaceholder(): ReactElement {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--landi-color-text-muted, #6B6B66)',
        fontSize: 13,
      }}
    >
      {t('chrome.panel.loading')}
    </div>
  );
}

function PanelMissingPlaceholder({ panelId }: { panelId: string }): ReactElement {
  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        color: 'var(--landi-color-text-muted, #6B6B66)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--landi-color-text, #1A1A1A)' }}>
        Panel not registered
      </div>
      <div>
        No whiteboard panel registered for id <code>{panelId || '(empty)'}</code>.
      </div>
    </div>
  );
}

function WhiteboardReactPanelContent(props: {
  panelId: string;
  data: Record<string, unknown>;
  Lazy: LazyExoticComponent<ComponentType<WhiteboardPanelProps>>;
}): ReactElement {
  const resolvedData = useEmbedReactPanelData(props.panelId, props.data);
  return (
    <Suspense fallback={<PanelLoadingPlaceholder />}>
      <props.Lazy data={resolvedData} hostedInWhiteboard />
    </Suspense>
  );
}

function WhiteboardSpecPanelContent(props: {
  definition: Extract<PanelDefinition, { kind: 'spec' }>;
}): ReactElement {
  const ctx = useOptionalPanelEmbedHost();
  // Always call the hook — behind `??` it runs conditionally and breaks
  // hook order when the embed context host flips between renders.
  const whiteboardHost = useWhiteboardPanelHost();
  const host = ctx?.host ?? whiteboardHost;
  const contextSources = usePanelEmbedAdapterSources();
  const adapterSources =
    contextSources.length > 0 ? contextSources : getWhiteboardPanelAdapterSources();
  const lifecycle = host?.data.lifecycle ?? null;

  const normalized = useMemo((): NormalizedPanelSpec | null => {
    if (host === null) {
      return null;
    }
    const validation = validateSpec(props.definition.spec, {
      catalog: defaultCatalog,
      adapterSources: new Set(adapterSources),
      hostActions: new Set(),
      panelRegistry: new Set(host.panels.ids()),
    });
    return validation.ok ? validation.spec : null;
  }, [adapterSources, host, props.definition.spec]);

  if (lifecycle === null || normalized === null) {
    return (
      <div role="alert" data-testid="panel-lifecycle-missing">
        {t('chrome.panel.adapterUnavailable')}
      </div>
    );
  }

  return (
    <SpecRenderer spec={normalized} scope={{}} lifecycle={lifecycle} bodyScroll="auto" />
  );
}

export interface WhiteboardPanelShapeContentProps {
  panelId: string;
  data: Record<string, unknown>;
  registry: WhiteboardPanelRegistry;
  composedSpec: boolean;
}

export function WhiteboardPanelShapeContent({
  panelId,
  data,
  registry,
  composedSpec,
}: WhiteboardPanelShapeContentProps): ReactElement {
  const ctx = useOptionalPanelEmbedHost();
  // Always call the hook — behind `??` it runs conditionally and breaks
  // hook order when the embed context host flips between renders.
  const whiteboardHost = useWhiteboardPanelHost();
  const host = ctx?.host ?? whiteboardHost;
  const Lazy = useLazyPanel(registry, panelId);
  const hostDefinition = host?.panels.get(panelId);

  if (composedSpec) {
    return <ComposedSpecPanel data={data} bodyScroll="auto" />;
  }

  if (Lazy) {
    return <WhiteboardReactPanelContent panelId={panelId} data={data} Lazy={Lazy} />;
  }

  if (hostDefinition?.kind === 'spec') {
    return <WhiteboardSpecPanelContent definition={hostDefinition} />;
  }

  return <PanelMissingPlaceholder panelId={panelId} />;
}
