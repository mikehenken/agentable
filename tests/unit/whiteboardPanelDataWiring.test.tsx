/**
 * Whiteboard panel data — host lifecycle reaches PanelShape bodies.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import {
  CAREER_PANEL_IDS,
  ARCHIPELAGO_CAREER_DATASET,
  careerDatasetToPanelData,
} from '@agentable/career-pack';
import { registerCareerWhiteboard } from '../../packages/career-pack/src/whiteboard/registerCareerWhiteboard';
import { PanelEmbedHostProvider } from '../../src/embed/panel/PanelEmbedContext';
import { WhiteboardPanelShapeContent } from '../../src/engines/tldraw/shapes/WhiteboardPanelShapeContent';
import { DEFAULT_WHITEBOARD_PANEL_REGISTRY } from '../../src/engines/tldraw/shapes/whiteboardPanelRegistry';

describe('whiteboard panel data wiring', () => {
  afterEach(() => {
     // no global provider teardown required
  });

  it('Open Positions receives jobs from host adapter lifecycle on PanelShape', async () => {
    const panelData = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
    const result = registerCareerWhiteboard({
      configDocument: {
        panels: CAREER_PANEL_IDS.map((id) => ({ id, kind: 'react' as const })),
      },
      tenantConfig: { tenant: 'archipelago', panelData },
      panelDataRaw: null,
    });

    if (result.host === undefined || result.panels === undefined) {
      throw new Error('expected career host bundle');
    }

    const registry = {...DEFAULT_WHITEBOARD_PANEL_REGISTRY,...result.panels,
    };

    render(
      <PanelEmbedHostProvider host={result.host} adapterSources={result.adapterSources}>
        <div style={{ width: 640, height: 520 }}>
          <WhiteboardPanelShapeContent
            panelId="open-positions"
            data={{}}
            registry={registry}
            composedSpec={false}
          />
        </div>
      </PanelEmbedHostProvider>);

    await waitFor(() => {
        expect(screen.getByText('Resort Manager')).toBeInTheDocument;
        expect(screen.getByText('Senior Software Developer')).toBeInTheDocument;
      },
      { timeout: 5000 });

    result.dispose();
  });

  it('legacy ARCHIPELAGO panelData resolves tenant fixture for adapter', () => {
    const legacyPanelData = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
    const result = registerCareerWhiteboard({
      configDocument: null,
      tenantConfig: { tenant: 'archipelago', panelData: legacyPanelData },
      panelDataRaw: null,
    });
    expect(result.host).toBeDefined();
    result.dispose();
  });
});
