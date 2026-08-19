/**
 * Gallery 06 — React host with published AgentablePanel wrapper and product chrome.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  AgentablePanel,
  type AgentablePanelHandle,
} from 'agentable-canvas/react/panel';

const JOB_TITLES = ['Guest Experience Lead', 'Culinary Innovation Chef'] as const;

type HostConnectionState = 'connecting' | 'connected' | 'error';

interface GalleryReadyState {
  example: string;
  ok: boolean;
  panelId: string;
  themeDark: boolean;
  jobTitlesFound: string[];
  connectionState: HostConnectionState;
}

const pageStyles: Record<string, CSSProperties> = {
  page: {
    background: '#0f172a',
    color: '#e2e8f0',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.9rem 1.5rem',
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'linear-gradient(180deg, #134e4a 0%, #0f172a 100%)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    minWidth: 0,
  },
  brandMark: {
    display: 'grid',
    placeItems: 'center',
    width: 30,
    height: 30,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #0e7490 0%, #14b8a6 100%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    flexShrink: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#f8fafc',
  },
  brandSubtitle: {
    margin: '2px 0 0',
    fontSize: '0.78rem',
    color: '#94a3b8',
  },
  sidebar: {
    padding: '1.25rem',
    borderRight: '1px solid rgba(148, 163, 184, 0.16)',
    background: '#0b1220',
  },
  sidebarTitle: {
    margin: '0 0 0.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  sidebarCopy: {
    margin: 0,
    fontSize: '0.82rem',
    lineHeight: 1.55,
    color: '#94a3b8',
  },
  statusCard: {
    marginTop: '1.25rem',
    padding: '0.85rem',
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)',
  },
  statusLabel: {
    margin: 0,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  statusValue: {
    margin: '0.35rem 0 0',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#f8fafc',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem 1.25rem 1.25rem',
    minWidth: 0,
  },
  panelBand: {
    flex: 1,
    minHeight: 420,
    border: '1px solid rgba(148, 163, 184, 0.28)',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#141414',
    boxShadow:
      '0 0 0 1px rgb(0 0 0 0.35), inset 0 1px 0 rgb(255 255 255 0.04)',
  },
  telemetry: {
    marginTop: '0.85rem',
    borderRadius: 8,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.92)',
    fontSize: '0.72rem',
    color: '#94a3b8',
  },
};

function collectJobTitlesFromPanel(panel: HTMLElement | null): string[] {
  if (!panel?.shadowRoot) {
    return [];
  }
  const list = panel.shadowRoot.querySelector('agentable-virtual-list');
  const text = list?.shadowRoot?.textContent ?? panel.shadowRoot.textContent ?? '';
  return JOB_TITLES.filter((title) => text.includes(title));
}

function publishGalleryReady(state: GalleryReadyState): void {
  window.__galleryReady = state;
}

function Gallery06App(): ReactElement {
  const panelRef = useRef<AgentablePanelHandle>(null);
  const [connectionState, setConnectionState] = useState<HostConnectionState>('connecting');
  const [jobTitlesFound, setJobTitlesFound] = useState<string[]>([]);
  const [telemetryJson, setTelemetryJson] = useState<string>('waiting…');

  const refreshContentChecks = useCallback((connectionOverride?: HostConnectionState) => {
    const panel = panelRef.current?.element ?? document.querySelector('agentable-panel');
    if (panel && panel.getAttribute('data-theme') !== 'gallery-dark') {
      panel.setAttribute('data-theme', 'gallery-dark');
    }
    const themeDark = panel?.getAttribute('data-theme') === 'gallery-dark';
    const titles = collectJobTitlesFromPanel(panel);
    setJobTitlesFound(titles);

    const effectiveConnection = connectionOverride ?? connectionState;

    const ready: GalleryReadyState = {
      example: '06-react-host-deep',
      ok:
        effectiveConnection === 'connected' &&
        themeDark &&
        titles.length === JOB_TITLES.length,
      panelId: 'open-positions',
      themeDark,
      jobTitlesFound: titles,
      connectionState: effectiveConnection,
    };
    publishGalleryReady(ready);
    setTelemetryJson(JSON.stringify(ready, null, 2));
    return ready;
  }, [connectionState]);

  useEffect(() => {
    refreshContentChecks();
    const timers = [
      window.setTimeout(refreshContentChecks, 400),
      window.setTimeout(refreshContentChecks, 1200),
      window.setTimeout(refreshContentChecks, 2500),
    ];
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [refreshContentChecks]);

  const handlePanelReady = useCallback(() => {
    setConnectionState('connected');
    window.setTimeout(() => refreshContentChecks('connected'), 100);
    window.setTimeout(() => refreshContentChecks('connected'), 800);
  }, [refreshContentChecks]);

  const handlePanelError = useCallback(() => {
    setConnectionState('error');
    refreshContentChecks('error');
  }, [refreshContentChecks]);

  const connectionLabel =
    connectionState === 'connected'
      ? 'Connected': connectionState === 'error'
        ? 'Connection issue': 'Connecting…';

  return (
    <div className="react-host-page" style={pageStyles.page}>
      <header style={pageStyles.header}>
        <div style={pageStyles.brand}>
          <div style={pageStyles.brandMark} aria-hidden="true">
            AR
          </div>
          <div>
            <h1 style={pageStyles.brandTitle}>Archipelago Resorts</h1>
            <p style={pageStyles.brandSubtitle}>React host · career panel embed</p>
          </div>
        </div>
        <p className="react-host-tagline">
          Host-owned layout and event wiring with the published React panel wrapper inside a
          product careers surface.
        </p>
      </header>

      <div className="react-host-workspace" data-testid="react-host-workspace">
        <aside style={pageStyles.sidebar} data-testid="host-sidebar">
          <h2 style={pageStyles.sidebarTitle}>Careers integration</h2>
          <p style={pageStyles.sidebarCopy}>
            This sidebar is owned by the React app. The Open Positions panel mounts beside it
            using the published wrapper and reports ready state back to the host.
          </p>
          <div style={pageStyles.statusCard}>
            <p style={pageStyles.statusLabel}>Panel connection</p>
            <p style={pageStyles.statusValue} data-testid="panel-ready-detail">
              {connectionLabel}
            </p>
          </div>
          {jobTitlesFound.length > 0 ? (
            <div style={{...pageStyles.statusCard, marginTop: '0.75rem' }}>
              <p style={pageStyles.statusLabel}>Roles loaded</p>
              <p style={{...pageStyles.statusValue, fontWeight: 500, fontSize: '0.82rem' }}>
                {jobTitlesFound.join(' · ')}
              </p>
            </div>
          ): null}
        </aside>

        <main style={pageStyles.main} data-panel-host>
          <div style={pageStyles.panelBand}>
            <AgentablePanel
              ref={panelRef}
              panel="open-positions"
              tenant="archipelago-resorts"
              locale="en"
              configUrl="/examples/shared/archipelago-panel-config.json"
              primaryColor="#0E7490"
              onPanelReady={handlePanelReady}
              onPanelError={handlePanelError}
              style={{ display: 'block', minHeight: 420 }}
            />
          </div>
          <details style={pageStyles.telemetry}>
            <summary style={{ cursor: 'pointer', padding: '0.35rem 0.65rem' }}>
              Gallery telemetry
            </summary>
            <pre
              style={{
                margin: 0,
                padding: '0.5rem 0.65rem 0.65rem',
                maxHeight: '7rem',
                overflow: 'auto',
                fontSize: '0.68rem',
                color: '#cbd5e1',
                borderTop: '1px solid rgba(148, 163, 184, 0.12)',
              }}
            >
              {telemetryJson}
            </pre>
          </details>
        </main>
      </div>
    </div>
  );
}

const mount = document.getElementById('root');
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <Gallery06App />
    </StrictMode>);
}

declare global {
  interface Window {
    __galleryReady?: GalleryReadyState;
  }
}
