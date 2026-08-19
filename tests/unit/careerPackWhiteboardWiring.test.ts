/**
 * Career whiteboard wiring — pack-side registration.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { CAREER_PANEL_IDS, ARCHIPELAGO_CAREER_DATASET, careerDatasetToPanelData } from '@agentable/career-pack';
import {
  registerCareerWhiteboard,
  shouldRegisterCareerWhiteboardPanels,
} from '../../packages/career-pack/src/whiteboard/registerCareerWhiteboard';
import { resolveWhiteboardEmbedWiring } from '../../src/embed/whiteboard/resolveWhiteboardEmbedWiring';
import {
  ensureCareerWhiteboardEmbedProviderRegistered,
  unregisterCareerWhiteboardEmbedProvider,
} from '../../packages/career-pack/src/embed/careerWhiteboardProvider';
import { resetWhiteboardWiringProviders } from '../../src/embed/whiteboard/whiteboardWiringProviderRegistry';

describe('career whiteboard wiring (pack)', () => {
  afterEach(() => {
    unregisterCareerWhiteboardEmbedProvider();
    resetWhiteboardWiringProviders();
  });

  it('registerCareerWhiteboard returns career panels + nav for archipelago tenant + panel data', () => {
    const panelData = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
    expect(
      shouldRegisterCareerWhiteboardPanels({
        configDocument: null,
        tenantConfig: { tenant: 'archipelago', panelData },
        panelDataRaw: null,
        tenant: 'archipelago',
      })).toBe(true);

    const result = registerCareerWhiteboard({
      configDocument: {
        panels: CAREER_PANEL_IDS.map((id) => ({ id, kind: 'react' })),
      },
      tenantConfig: { tenant: 'archipelago', panelData },
      panelDataRaw: null,
    });

    expect(result.host).toBeDefined();
    const navPanelIds = result.navItems?.map((item) => item.panelId).sort ?? [];
    expect(navPanelIds).toEqual(
      [
        'applications',
        'career-tools',
        'chat',
        'growth-paths',
        'open-positions',
        'resources',
        'resume-docs',
      ].sort());
    if (result.panels === undefined) {
      throw new Error('expected panels registry');
    }
    expect(result.panels['open-positions']).toBeTypeOf('function');
    expect(result.panels.chat).toBeTypeOf('function');
    result.dispose();
  });

  it('embed provider registers career panels through core resolveWhiteboardEmbedWiring', () => {
    ensureCareerWhiteboardEmbedProviderRegistered();
    const panelData = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
    const { wiring, activeProvider } = resolveWhiteboardEmbedWiring({
      configDocument: {
        panels: [{ id: 'open-positions', kind: 'react' }],
      },
      tenantConfig: { tenant: 'archipelago', panelData },
      panelDataRaw: null,
      tenant: 'archipelago',
    });

    expect(activeProvider).not.toBeNull();
    expect(Object.keys(wiring.panelLoaders).sort()).toEqual(['chat', 'open-positions']);
    expect(wiring.navItems.map((item) => item.panelId).sort()).toEqual(
      ['chat', 'open-positions'].sort());
    wiring.dispose();
  });
});
