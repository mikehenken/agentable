import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { t } from '../../i18n';
import { bootstrapSessionLocale } from '../../i18n/bootstrapSessionLocale';
import { EmbedPanelApprovalLayer } from './EmbedPanelApprovalLayer';
import { createCanvasHost, type CanvasHost } from '../../panels/host';
import type { PartialCanvasTenantConfig } from '../../config/CanvasContext';
import type { EmbedConfigDocument } from '../types/embedConfig';
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';
import { EmbedPanelBody } from './EmbedPanelBody';
import { EmbedPanelChrome } from './EmbedPanelChrome';
import { PanelEmbedHostProvider } from './PanelEmbedContext';
import { PanelOnlyEngine } from './panelOnlyEngine';
import {
  EmbedPanelResolutionError,
  resolveEmbedPanelHost,
  type ResolvedEmbedPanelHost,
} from './resolveEmbedPanelHost';

import type { PanelEmbedShellPhase } from './panelEmbedPhases';

export type { PanelEmbedShellPhase } from './panelEmbedPhases';

export interface PanelEmbedShellProps {
  panelId: string;
  tenantConfig: PartialCanvasTenantConfig;
  locale: string;
  configDocument: EmbedConfigDocument | null;
  panelDataRaw: RawPanelDataPayload | null;
  panelData?: Record<string, unknown>;
  titleOverride?: string;
  hideChrome?: boolean;
  namedSlot?: string;
  onPhaseChange?: (phase: PanelEmbedShellPhase) => void;
  onReady?: (detail: { panelId: string; definitionKind: 'spec' | 'react' }) => void;
  onAdapterLoaded?: (detail: { ok: boolean; error?: string }) => void;
  onError?: (detail: { code: string; message: string }) => void;
  onChromeChange?: (detail: { minimized: boolean }) => void;
  onApprovalPending?: (detail: { count: number }) => void;
}

function resolvePanelTitle(
  resolved: ResolvedEmbedPanelHost,
  titleOverride: string | undefined): string {
  if (titleOverride?.trim()) {
    return titleOverride.trim();
  }
  const metaTitle = resolved.definition.meta.title;
  if (
    metaTitle.startsWith('career.') ||
    metaTitle.startsWith('agents.') ||
    metaTitle.startsWith('chrome.')
  ) {
    return t(metaTitle as Parameters<typeof t>[0]);
  }
  return metaTitle;
}

function PanelEmbedSurface(props: {
  resolved: ResolvedEmbedPanelHost;
  host: CanvasHost;
  title: string;
  hideChrome: boolean;
  minimized: boolean;
  panelData?: Record<string, unknown>;
  onMinimizeToggle: () => void;
  onClose: () => void;
}): ReactElement {
  return (
    <section
      part="surface"
      className="agentable-panel-surface"
      data-panel-id={props.resolved.panelId}
      data-testid="agentable-panel-surface"
      aria-label={props.title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        borderRadius: 'var(--landi-radius-panel, 12px)',
        border: '1px solid var(--landi-color-border, rgba(0,0,0,0.08))',
        background: 'var(--landi-color-surface, #ffffff)',
        overflow: 'hidden',
      }}
    >
      <EmbedPanelChrome
        panelId={props.resolved.instanceId}
        title={props.title}
        minimized={props.minimized}
        hideChrome={props.hideChrome}
        onMinimizeToggle={props.onMinimizeToggle}
        onClose={props.onClose}
      />
      <EmbedPanelApprovalLayer panelId={props.resolved.instanceId} />
      {!props.minimized ? (
        <div
          part="body"
          className="panel-shape__body"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          <EmbedPanelBody
            definition={props.resolved.definition}
            adapterSources={props.resolved.adapterSources}
            bodyScroll={props.resolved.definition.meta.bodyScroll ?? 'auto'}
            panelData={props.panelData}
          />
        </div>
      ): null}
    </section>
  );
}

export function PanelEmbedShell(props: PanelEmbedShellProps): ReactElement {
  const [phase, setPhase] = useState<PanelEmbedShellPhase>('loading');
  const [minimized, setMinimized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedEmbedPanelHost | null>(null);
  const [host, setHost] = useState<CanvasHost | null>(null);
  const engineRef = useRef<PanelOnlyEngine | null>(null);

  const tenant = props.tenantConfig.tenant ?? 'default';

  useEffect(() => {
    bootstrapSessionLocale({
      embedLocale: props.locale,
      tenantLocale: props.tenantConfig.locale ?? props.locale,
    });
  }, [props.locale, props.tenantConfig.locale]);

  useEffect(() => {
    let cancelled = false;

    try {
      const nextResolved = resolveEmbedPanelHost({
        panelId: props.panelId,
        configDocument: props.configDocument,
        panelDataRaw: props.panelDataRaw,
        tenant,
      });
      if (cancelled) return;

      const engine = new PanelOnlyEngine();
      engineRef.current = engine;
      const nextHost = createCanvasHost({
        engine,
        adapter: nextResolved.adapter,
        panels: [...nextResolved.definitions],
      });

      setResolved(nextResolved);
      setHost(nextHost);
      setErrorMessage(null);
      setPhase('loading');
      props.onPhaseChange?.('loading');

      void nextHost.whenReady().then(() => {
        if (cancelled) return;
        setPhase('ready');
        props.onPhaseChange?.('ready');
        props.onAdapterLoaded?.({ ok: true });
        props.onReady?.({
          panelId: nextResolved.panelId,
          definitionKind: nextResolved.definition.kind,
        });
      });
    } catch (error: unknown) {
      if (cancelled) return;
      const detail =
        error instanceof EmbedPanelResolutionError
          ? { code: error.code, message: error.message }: {
              code: 'PANEL_UNKNOWN',
              message: error instanceof Error ? error.message: String(error),
            };
      setResolved(null);
      setHost(null);
      setErrorMessage(detail.message);
      setPhase('error');
      props.onPhaseChange?.('error');
      props.onError?.(detail);
    }

    return () => {
      cancelled = true;
      engineRef.current = null;
      setHost((current) => {
        current?.dispose();
        return null;
      });
    };
  }, [props.panelId, props.configDocument, props.panelDataRaw, tenant]);

  useEffect(() => {
    if (host === null || resolved === null || phase !== 'ready') {
      return;
    }
    return host.approvals.subscribe(() => {
      const pending = host.approvals.getPendingForPanel(resolved.instanceId);
      if (pending.length > 0) {
        props.onApprovalPending?.({ count: pending.length });
      }
    });
  }, [host, resolved, phase, props.onApprovalPending]);

  if (phase === 'error' || resolved === null) {
    return (
      <div part="error" role="alert" data-testid="agentable-panel-error">
        {errorMessage ?? t('chrome.panel.notRegistered', { panelId: props.panelId })}
      </div>
    );
  }

  if (phase === 'closed') {
    return (
      <div part="closed" data-testid="agentable-panel-closed" aria-hidden="true">
        {t('chrome.panel.close')}
      </div>
    );
  }

  if (phase === 'loading' || host === null) {
    return (
      <div part="skeleton" role="status" data-testid="agentable-panel-skeleton">
        {t('chrome.panel.loading')}
      </div>
    );
  }

  const title = resolvePanelTitle(resolved, props.titleOverride);

  return (
    <PanelEmbedHostProvider host={host}>
      <PanelEmbedSurface
        resolved={resolved}
        host={host}
        title={title}
        hideChrome={props.hideChrome ?? false}
        minimized={minimized}
        panelData={props.panelData}
        onMinimizeToggle={() => {
          setMinimized((value) => {
            const next = !value;
            props.onChromeChange?.({ minimized: next });
            return next;
          });
        }}
        onClose={() => {
          setPhase('closed');
          props.onPhaseChange?.('closed');
          props.onChromeChange?.({ minimized: true });
        }}
      />
    </PanelEmbedHostProvider>
  );
}
