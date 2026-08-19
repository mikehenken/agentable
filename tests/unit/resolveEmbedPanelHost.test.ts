/**
 * resolveEmbedPanelHost — panel registry + adapter lifecycle wiring.
 */
import { describe, expect, it } from 'vitest';
import { MINIMAL_CAREER_DATASET } from '@agentable/career-pack';
import { MINIMAL_SUPPORT_DATASET } from '@agentable/support-inbox-pack';
import {
  EmbedPanelResolutionError,
  resolveEmbedPanelHost,
} from '../../src/embed/panel/resolveEmbedPanelHost';

describe('resolveEmbedPanelHost', () => {
  it('resolves open-positions with career pack definition + minimal dataset fallback', () => {
    const resolved = resolveEmbedPanelHost({
      panelId: 'open-positions',
      configDocument: null,
      panelDataRaw: null,
      tenant: 'fixture',
    });

    expect(resolved.panelId).toBe('open-positions');
    expect(resolved.definition.kind).toBe('react');
    expect(resolved.instanceId).toBe('embed-open-positions');
    expect(resolved.adapterSources).toContain('career.jobs');
  });

  it('accepts inline validated career dataset on config adapter.data', () => {
    const resolved = resolveEmbedPanelHost({
      panelId: 'resources',
      configDocument: {
        tenant: 'acme',
        adapter: { kind: 'static', data: MINIMAL_CAREER_DATASET },
      },
      panelDataRaw: null,
      tenant: 'acme',
    });

    expect(resolved.panelId).toBe('resources');
    expect(resolved.definition.id).toBe('resources');
  });

  it('resolves inbox with support-inbox pack definition + minimal dataset fallback', () => {
    const resolved = resolveEmbedPanelHost({
      panelId: 'inbox',
      configDocument: null,
      panelDataRaw: null,
      tenant: 'northwind',
    });

    expect(resolved.panelId).toBe('inbox');
    expect(resolved.definition.id).toBe('inbox');
    expect(resolved.adapterSources).toContain('support.tickets');
  });

  it('accepts inline validated support dataset on config adapter.data', () => {
    const resolved = resolveEmbedPanelHost({
      panelId: 'macros',
      configDocument: {
        tenant: 'northwind',
        adapter: { kind: 'static', data: MINIMAL_SUPPORT_DATASET },
      },
      panelDataRaw: null,
      tenant: 'northwind',
    });

    expect(resolved.panelId).toBe('macros');
    expect(resolved.definition.id).toBe('macros');
  });

  it('throws PANEL_UNKNOWN for missing panel id', () => {
    expect(() =>
      resolveEmbedPanelHost({
        panelId: 'not-a-panel',
        configDocument: null,
        panelDataRaw: null,
        tenant: 'x',
      })).toThrow(EmbedPanelResolutionError);
  });

  it('throws PANEL_UNKNOWN for empty panel attribute', () => {
    try {
      resolveEmbedPanelHost({
        panelId: ' ',
        configDocument: null,
        panelDataRaw: null,
        tenant: 'x',
      });
      expect.fail('expected throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EmbedPanelResolutionError);
      if (error instanceof EmbedPanelResolutionError) {
        expect(error.code).toBe('PANEL_UNKNOWN');
      }
    }
  });
});
