/**
 * Whiteboard body for the Meridian document spec panel (P12-T7 gallery).
 */
import { useMemo, type ReactElement } from 'react';
import { createDocumentPanelDefinition } from '../../agents/panels/documentPanel';
import { EmbedPanelApprovalLayer } from '../panel/EmbedPanelApprovalLayer';
import { SpecRenderer } from '../../panels/renderer';
import { defaultCatalog, validateSpec, type NormalizedPanelSpec } from '../../panels/spec';
import type { PanelScope } from '../../panels/types';
import type { WhiteboardPanelProps } from '../../engines/tldraw/shapes/whiteboardPanelRegistry';
import { DOCUMENT_PANEL_ID } from '../../panels/document/types';
import { useMeridianGalleryHost } from './MeridianGalleryHostContext';

interface PanelShapeData {
  scope?: unknown;
}

function readScope(data: PanelShapeData | undefined): PanelScope {
  if (typeof data?.scope === 'object' && data.scope !== null && !Array.isArray(data.scope)) {
    const record = data.scope as Record<string, unknown>;
    return {
      ...(typeof record.contextId === 'string' ? { contextId: record.contextId } : {}),
      ...(typeof record.entityId === 'string' ? { entityId: record.entityId } : {}),
    };
  }
  return { contextId: 'workspace', entityId: 'meridian-product-brief' };
}

export function MeridianDocumentPanelHost(props: WhiteboardPanelProps): ReactElement {
  const { data, hostedInWhiteboard = false } = props;
  const { host } = useMeridianGalleryHost();
  const lifecycle = host.data.lifecycle;
  const scope = useMemo(() => readScope(data as PanelShapeData | undefined), [data]);
  const definition = useMemo(() => createDocumentPanelDefinition(), []);

  const normalized = useMemo((): NormalizedPanelSpec | null => {
    if (definition.kind !== 'spec') return null;
    const validation = validateSpec(definition.spec, {
      catalog: defaultCatalog,
      adapterSources: new Set(['workspace.documents']),
      hostActions: new Set(['export_document']),
      panelRegistry: new Set(host.panels.ids()),
    });
    return validation.ok ? validation.spec : null;
  }, [definition, host.panels]);

  if (lifecycle === null || normalized === null) {
    return (
      <div data-testid="meridian-document-panel-error" role="alert">
        Document panel lifecycle unavailable.
      </div>
    );
  }

  return (
    <div
      data-testid="meridian-document-panel"
      data-qa-host="meridian-document-panel-host"
      data-panel-id={DOCUMENT_PANEL_ID}
      data-hosted-in-whiteboard={hostedInWhiteboard ? 'true' : 'false'}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <EmbedPanelApprovalLayer panelId={DOCUMENT_PANEL_ID} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <SpecRenderer spec={normalized} scope={scope} lifecycle={lifecycle} bodyScroll="auto" />
      </div>
    </div>
  );
}

export function createMeridianDocumentPanelLoader(): () => Promise<{
  default: React.ComponentType<WhiteboardPanelProps>;
}> {
  return () =>
    Promise.resolve({
      default: MeridianDocumentPanelHost,
    });
}
