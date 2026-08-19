import { configureWhiteboardLayoutHints } from '../../../../src/engines/tldraw/layout/whiteboardLayoutConfig';
import { CAREER_PANEL_IDS } from '../constants';

/** Career domain layout hints — registered when career whiteboard wiring is active. */
export function applyCareerWhiteboardLayoutHints(): void {
  configureWhiteboardLayoutHints({
    listPanelIds: [...CAREER_PANEL_IDS],
    panelArrangeOrder: [
      'chat',
      'open-positions',
      'applications',
      'resources',
      'growth-paths',
      'artifacts',
      'career-tools',
    ],
    paletteEntities: [
      {
        id: 'lrn::en:platform.feature.open-positions::component',
        label: 'Open positions',
        panelId: 'open-positions',
      },
      {
        id: 'lrn::en:platform.feature.resources::component',
        label: 'Resources',
        panelId: 'resources',
      },
    ],
  });
}
