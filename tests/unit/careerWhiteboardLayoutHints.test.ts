/**
 * Career whiteboard layout hints — parity with legacy hardcoded ordering (M5 H3).
 */
import { describe, expect, it, afterEach } from 'vitest';
import { CAREER_PANEL_IDS } from '@agentable/career-pack';
import { applyCareerWhiteboardLayoutHints } from '../../packages/career-pack/src/whiteboard/careerWhiteboardLayoutHints';
import {
  compareWhiteboardPanelArrangeOrder,
  getWhiteboardListPanelIds,
  getWhiteboardPanelArrangeOrder,
  resetWhiteboardLayoutHints,
} from '../../src/engines/tldraw/layout/whiteboardLayoutConfig';
import {
  createCareerWhiteboardHostBundle,
  disposeCareerWhiteboardHostBundle,
} from '../../packages/career-pack/src/whiteboard/createCareerWhiteboardHostBundle';
import { careerDatasetToPanelData, ARCHIPELAGO_CAREER_DATASET } from '@agentable/career-pack';

const LEGACY_CAREER_ARRANGE_ORDER: readonly string[] = [
  'chat',
  'open-positions',
  'applications',
  'resources',
  'growth-paths',
  'artifacts',
  'career-tools',
];

describe('career whiteboard layout hints', () => {
  afterEach(() => {
    resetWhiteboardLayoutHints();
  });

  it('list panel ids and arrange order match legacy career hardcoding', () => {
    applyCareerWhiteboardLayoutHints();
    expect([...getWhiteboardListPanelIds].sort()).toEqual([...CAREER_PANEL_IDS].sort());
    expect(getWhiteboardPanelArrangeOrder).toEqual(LEGACY_CAREER_ARRANGE_ORDER);

    expect(compareWhiteboardPanelArrangeOrder('chat', 'open-positions')).toBeLessThan(0);
    expect(compareWhiteboardPanelArrangeOrder('open-positions', 'applications')).toBeLessThan(0);
    expect(compareWhiteboardPanelArrangeOrder('resources', 'growth-paths')).toBeLessThan(0);
  });

  it('disposeCareerWhiteboardHostBundle resets module-level layout hints (H3)', () => {
    const panelData = careerDatasetToPanelData(ARCHIPELAGO_CAREER_DATASET);
    const bundle = createCareerWhiteboardHostBundle({
      configDocument: null,
      tenantConfig: { tenant: 'archipelago', panelData },
      panelDataRaw: null,
      tenant: 'archipelago',
    });

    expect(getWhiteboardPanelArrangeOrder).toEqual(LEGACY_CAREER_ARRANGE_ORDER);

    disposeCareerWhiteboardHostBundle(bundle);

    expect(getWhiteboardPanelArrangeOrder).toEqual(['chat']);
    expect(getWhiteboardListPanelIds().size).toBe(0);
  });
});
