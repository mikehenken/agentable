/**
 * Sandboxed iframe host bootstrap — mounts `<agentable-panel>` and wires the
 * postMessage bridge for script-stripping CMS hosts (P9-T4).
 */
import '../agentable-panel';
import { ensurePageSession } from '../../session/pageSession';
import {
  createBridgeIdFromParams,
  createIframeChildBridge,
  readParentOriginAllowlistFromSearchParams,
} from './iframeChildBridge';
import { readIframeHostParamsFromSearchParams } from './iframeHostUrl';
import type { AgentablePanelElement } from '../agentable-panel';

const AGENTABLE_PANEL_EVENTS = [
  'agentable:config-reloaded',
  'agentable:panel-ready',
  'agentable:adapter-loaded',
  'agentable:panel-error',
  'agentable:chrome-changed',
  'agentable:approval-pending',
  'agentable:phase-changed',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function detailToRecord(detail: unknown): Record<string, unknown> {
  if (!isRecord(detail)) {
    return {};
  }
  return detail;
}

function applyPanelAttributes(
  panel: AgentablePanelElement,
  params: NonNullable<ReturnType<typeof readIframeHostParamsFromSearchParams>>,
): void {
  if (params.panel) {
    panel.setAttribute('panel', params.panel);
    panel.panel = params.panel;
  }
  if (params.configUrl) {
    panel.setAttribute('config-url', params.configUrl);
    panel.configUrl = params.configUrl;
  }
  panel.setAttribute('data-skip-react-mount', '');
  if (params.panelDataUrl) {
    panel.panelDataUrl = params.panelDataUrl;
  }
  if (params.primaryColor) {
    panel.primaryColor = params.primaryColor;
  }
  if (params.locale) {
    panel.locale = params.locale;
  }
  if (params.slotName) {
    panel.slotName = params.slotName;
  }
  if (params.hideChrome) {
    panel.hideChrome = true;
  }
}

export function bootstrapIframeHostPage(doc: Document = document): () => void {
  const params = readIframeHostParamsFromSearchParams(new URLSearchParams(doc.defaultView?.location.search ?? ''));
  if (params === null) {
    const alert = doc.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Missing or invalid iframe host surface parameter.';
    doc.body.appendChild(alert);
    return () => undefined;
  }

  if (params.surface !== 'panel') {
    const alert = doc.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = `Iframe host surface "${params.surface}" is not supported in P9-T4.`;
    doc.body.appendChild(alert);
    return () => undefined;
  }

  if (!params.panel?.trim()) {
    const alert = doc.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Panel id is required for panel iframe host.';
    doc.body.appendChild(alert);
    return () => undefined;
  }

  const searchParams = new URLSearchParams(doc.defaultView?.location.search ?? '');
  const bridgeId = createBridgeIdFromParams(searchParams);
  const allowedParentOrigins = readParentOriginAllowlistFromSearchParams(
    searchParams,
    doc.defaultView?.document.referrer ?? null,
  );

  doc.documentElement.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.height = '100%';
  doc.body.style.overflow = 'hidden';

  const mount = doc.createElement('div');
  mount.id = 'agentable-iframe-host-mount';
  mount.style.width = '100%';
  mount.style.height = '100%';
  mount.style.minHeight = '420px';
  doc.body.appendChild(mount);

  const panel = doc.createElement('agentable-panel') as AgentablePanelElement;
  applyPanelAttributes(panel, params);
  panel.style.display = 'block';
  panel.style.width = '100%';
  panel.style.height = '100%';
  mount.appendChild(panel);

  ensurePageSession().join(`iframe-host-${bridgeId}`);

  const bridge = createIframeChildBridge({
    bridgeId,
    surface: 'panel',
    allowedParentOrigins,
    onResize: ({ width, height }) => {
      mount.style.width = `${width}px`;
      mount.style.height = `${height}px`;
    },
  });

  const cleanups: Array<() => void> = [bridge.start()];

  const session = ensurePageSession();
  const publishSession = (): void => {
    bridge.publishSessionSnapshot(session.getSnapshot());
  };

  const sessionInterval = doc.defaultView?.setInterval(publishSession, 5000);
  if (sessionInterval !== undefined) {
    cleanups.push(() => doc.defaultView?.clearInterval(sessionInterval));
  }

  for (const eventName of AGENTABLE_PANEL_EVENTS) {
    const handler = (event: Event): void => {
      const custom = event as CustomEvent;
      bridge.publishEvent(eventName, detailToRecord(custom.detail));
    };
    panel.addEventListener(eventName, handler);
    cleanups.push(() => panel.removeEventListener(eventName, handler));
  }

  publishSession();

  return () => {
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
    panel.remove();
    mount.remove();
  };
}

if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  if (window.location.pathname.endsWith('iframe-host.html')) {
    bootstrapIframeHostPage();
  }
}
