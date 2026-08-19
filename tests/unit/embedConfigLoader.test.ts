import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchEmbedConfigDocument,
  resolveEmbedPanelData,
} from '../../src/embed/embedConfigLoader';
import type { EmbedFetchFn } from '../../src/embed/types/embedConfig';
import panelData from '../fixtures/panel-data-minimal.json';
import embedConfigStatic from '../fixtures/embed-config-static.json';
import embedConfigHttp from '../fixtures/embed-config-http.json';

function mockFetch(routes: Record<string, unknown>): EmbedFetchFn {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find((route) => url.includes(route));
    const body = key ? routes[key]: undefined;
    if (body === undefined) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  }) as unknown as EmbedFetchFn;
}

describe('embedConfigLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchEmbedConfigDocument rejects non-object JSON', async () => {
    const fetchFn = mockFetch({ config: 'not-an-object' });
    await expect(fetchEmbedConfigDocument('/config.json', fetchFn)).rejects.toThrow(
      'not a JSON object');
  });

  it('resolveEmbedPanelData loads static adapter via config-url', async () => {
    const fetchFn = mockFetch({
      'embed-config-static': embedConfigStatic,
      'panel-data-minimal': panelData,
    });
    const result = await resolveEmbedPanelData({
      configUrl: '/fixtures/embed-config-static.json',
      panelDataUrl: '',
      fetchFn,
    });
    expect(result.configDoc?.tenant).toBe('moss-fixture');
    expect(result.panelDataRaw?.jobs).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledWith('/fixtures/embed-config-static.json');
    expect(fetchFn).toHaveBeenCalledWith('/fixtures/panel-data-minimal.json');
  });

  it('resolveEmbedPanelData loads http adapter via config-url', async () => {
    const fetchFn = mockFetch({
      'embed-config-http': embedConfigHttp,
      'panel-data-minimal': panelData,
    });
    const result = await resolveEmbedPanelData({
      configUrl: '/fixtures/embed-config-http.json',
      panelDataUrl: '',
      fetchFn,
    });
    expect(result.configDoc?.tenant).toBe('http-fixture');
    expect(result.panelDataRaw?.jobs?.[0]?.title).toBe('Safety Manager');
  });

  it('config-url wins over legacy panel-data-url', async () => {
    const configWithoutAdapter = {
      tenant: 'config-wins',
      panelData,
    };
    const fetchFn = mockFetch({
      'config-wins.json': configWithoutAdapter,
      'panel-data-minimal': panelData,
    });
    const result = await resolveEmbedPanelData({
      configUrl: '/fixtures/config-wins.json',
      panelDataUrl: '/fixtures/panel-data-minimal.json',
      fetchFn,
    });
    expect(result.configDoc?.tenant).toBe('config-wins');
    expect(fetchFn).toHaveBeenCalledWith('/fixtures/config-wins.json');
    expect(fetchFn).not.toHaveBeenCalledWith('/fixtures/panel-data-minimal.json');
  });

  it('falls back to panel-data-url when config-url is empty', async () => {
    const fetchFn = mockFetch({ 'panel-data-minimal': panelData });
    const result = await resolveEmbedPanelData({
      configUrl: '',
      panelDataUrl: '/fixtures/panel-data-minimal.json',
      fetchFn,
    });
    expect(result.configDoc).toBeNull();
    expect(result.panelDataRaw?.agentJobsGuide).toBe('Use concise job summaries.');
  });
});
