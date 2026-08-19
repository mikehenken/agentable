/**
 * iframe host bootstrap integration coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootstrapIframeHostPage } from '../../src/embed/iframe/iframeHostBootstrap';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

describe('iframe host bootstrap integration', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('iframe host test');
    doc.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts agentable-panel from query params and wires child bridge listeners', async () => {
    const search =
      '?surface=panel&panel=open-positions&config-url=%2Fcfg.json&parent-origin=https%3A%2F%2Fcms.example.com&bridge-id=bridge_host';
    Object.defineProperty(doc, 'defaultView', {
      configurable: true,
      value: {
        location: { search },
        document: { referrer: 'https://cms.example.com/page' },
        setInterval: (fn: () => void) => window.setInterval(fn, 60_000),
        clearInterval: (id: number) => window.clearInterval(id),
        parent: {
          postMessage: vi.fn(),
        },
      },
    });

    const cleanup = bootstrapIframeHostPage(doc);
    await customElements.whenDefined('agentable-panel');

    const panel = doc.querySelector('agentable-panel') as AgentablePanelElement | null;
    expect(panel).not.toBeNull();
    expect(panel?.panel).toBe('open-positions');
    expect(panel?.configUrl).toBe('/cfg.json');
    expect(doc.getElementById('agentable-iframe-host-mount')).not.toBeNull();

    cleanup();
  });

  it('shows an alert when surface param is missing', () => {
    Object.defineProperty(doc, 'defaultView', {
      configurable: true,
      value: {
        location: { search: '' },
        document: { referrer: '' },
      },
    });

    bootstrapIframeHostPage(doc);
    const alert = doc.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Missing or invalid');
  });
});
