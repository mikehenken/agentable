import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLegacyPanelDataUrl,
  resolvePanelDataFromAdapter,
} from '../../src/embed/adapters/resolveAdapterPanelData';
import type { EmbedFetchFn } from '../../src/embed/types/embedConfig';
import panelData from '../fixtures/panel-data-minimal.json';

function mockFetch(body: unknown, status = 200): EmbedFetchFn {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as EmbedFetchFn;
}

describe('embed adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('static adapter returns inline data', async () => {
    const result = await resolvePanelDataFromAdapter(
      { kind: 'static', data: panelData },
      mockFetch({}));
    expect(result.jobs).toHaveLength(1);
    expect(result.agentJobsGuide).toBe('Use concise job summaries.');
  });

  it('static adapter fetches dataUrl', async () => {
    const fetchFn = mockFetch(panelData);
    const result = await resolvePanelDataFromAdapter(
      { kind: 'static', dataUrl: 'https://example.test/data.json' },
      fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/data.json');
    expect(result.roleTaxonomy).toHaveLength(1);
  });

  it('http adapter fetches baseUrl panel-data document', async () => {
    const fetchFn = mockFetch(panelData);
    const result = await resolvePanelDataFromAdapter(
      { kind: 'http', baseUrl: 'https://example.test/career.json' },
      fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('https://example.test/career.json');
    expect(result.jobs?.[0]?.title).toBe('Safety Manager');
  });

  it('legacy panel-data-url fetch throws on HTTP error', async () => {
    await expect(
      fetchLegacyPanelDataUrl('https://example.test/missing.json', mockFetch({}, 404))).rejects.toThrow('HTTP 404');
  });
});
