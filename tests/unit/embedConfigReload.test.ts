import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../src/embed/agentable-canvas';
import type { AgentableCanvasElement } from '../../src/embed/agentable-canvas';
import panelData from '../fixtures/panel-data-minimal.json';
import embedConfig from '../fixtures/embed-config-static.json';

describe('agentable-canvas embed reload', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('embed-config')) {
        return {
          ok: true,
          status: 200,
          json: async () => embedConfig,
        };
      }
      if (url.includes('panel-data')) {
        return {
          ok: true,
          status: 200,
          json: async () => panelData,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('loads config-url on bootstrap and exposes merged tenant on reload', async () => {
    const el = document.createElement('agentable-canvas') as AgentableCanvasElement;
    el.setAttribute('data-skip-react-mount', '');
    el.setAttribute('config-url', '/fixtures/embed-config-static.json');
    document.body.appendChild(el);

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));

    let reloadDetail: { ok: boolean } | undefined;
    el.addEventListener('agentable:config-reloaded', (event) => {
      reloadDetail = (event as CustomEvent<{ ok: boolean }>).detail;
    });

    await el.reload();

    expect(fetchMock).toHaveBeenCalled;
    expect(reloadDetail?.ok).toBe(true);
    expect(el.configUrl).toBe('/fixtures/embed-config-static.json');
  });

  it('supports legacy panel-data-url attribute', async () => {
    const el = document.createElement('agentable-canvas') as AgentableCanvasElement;
    el.setAttribute('data-skip-react-mount', '');
    el.setAttribute('panel-data-url', '/fixtures/panel-data-minimal.json');
    document.body.appendChild(el);

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await el.reload();
    expect(fetchMock).toHaveBeenCalledWith('/fixtures/panel-data-minimal.json');
  });
});
