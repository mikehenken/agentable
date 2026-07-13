/**
 * Unit tests for canvas-global panel isolation.
 */
import { describe, it, expect } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  CANVAS_GLOBAL_PANEL_IDS,
  ejectGlobalPanelsFromSiteFrames,
  filterSiteContextPanelIds,
  isCanvasGlobalPanel,
} from '../../src/whiteboard/context/canvasGlobalPanels';
import { contextGroupFrameId } from '../../src/whiteboard/context/contextGroupApi';

describe('canvasGlobalPanels', () => {
  it('identifies all-sites as a canvas-global panel', () => {
    expect(isCanvasGlobalPanel('all-sites')).toBe(true);
    expect(CANVAS_GLOBAL_PANEL_IDS).toContain('all-sites');
    expect(isCanvasGlobalPanel('chat')).toBe(false);
  });

  it('filters global panels from site grouping lists', () => {
    expect(filterSiteContextPanelIds(['chat', 'all-sites', 'web-preview'])).toEqual([
      'chat',
      'web-preview',
    ]);
  });

  it('ejects all-sites from site context frames to the page', () => {
    const siteId = 'site-abc';
    const frameId = contextGroupFrameId({ kind: 'site', id: siteId });
    const allSitesId = createShapeId('panel:all-sites');
    const pageId = 'page:page';

    const reparented: Array<{ ids: string[]; parent: string }> = [];

    const editor = {
      getCurrentPageId: () => pageId,
      getShape: (id: string) => {
        if (id === frameId) {
          return {
            type: 'frame',
            id: frameId,
            meta: { landiContextGroup: { kind: 'site', id: siteId } },
          };
        }
        if (id === allSitesId) {
          return { type: 'panel', id: allSitesId, parentId: frameId, props: { panelId: 'all-sites' } };
        }
        return null;
      },
      reparentShapes: (ids: string[], parentId: string) => {
        reparented.push({ ids, parent: parentId });
      },
    } as never;

    const count = ejectGlobalPanelsFromSiteFrames(editor);
    expect(count).toBe(1);
    expect(reparented).toEqual([{ ids: [allSitesId], parent: pageId }]);
  });
});
