/**
 * Unit tests for site context layout repair after snapshot restore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSiteContextLayoutInvalid,
  repairSiteContextFrameLayout,
} from '../../src/whiteboard/context/siteContextLayoutRepair';
import { GRID_GUTTER, getPanelGridSpan, GRID_ROW_HEIGHT } from '../../src/canvas/gridLayout';
import { gridSpanToSize } from '../../src/canvas/gridLayout';
import { computeInitialSiteContextLayout } from '../../src/whiteboard/context/siteContextPanelLayout';

function maxBriefHeight(): number {
  const span = getPanelGridSpan('project-brief');
  return (
    span.rowSpan * GRID_ROW_HEIGHT +
    (span.rowSpan - 1) * GRID_GUTTER +
    24
  );
}

describe('isSiteContextLayoutInvalid', () => {
  it('returns false for a valid non-overlapping grid layout', () => {
    const placements = computeInitialSiteContextLayout(
      { x: 0, y: 0, maxWidth: 1200, maxHeight: 900 },
      { includeChat: false, includeBrief: true, includePreview: true, includeFiles: true },
    );
    const panels = placements.map((p, i) => ({
      panelId: p.panelId,
      shapeId: `shape:panel:${i}` as never,
      rect: { x: p.x, y: p.y, w: p.w, h: p.h },
    }));
    expect(isSiteContextLayoutInvalid(panels)).toBe(false);
  });

  it('returns true when brief exceeds row-span height cap', () => {
    const { h: normalH } = gridSpanToSize(
      { columns: 12, rowHeight: GRID_ROW_HEIGHT, gutter: GRID_GUTTER, colWidth: 80 },
      getPanelGridSpan('project-brief'),
      false,
    );
    expect(
      isSiteContextLayoutInvalid([
        {
          panelId: 'project-brief',
          shapeId: 'shape:panel:brief' as never,
          rect: { x: 0, y: 0, w: 300, h: normalH + 200 },
        },
      ]),
    ).toBe(true);
    expect(maxBriefHeight()).toBeGreaterThan(normalH);
  });

  it('returns true when two panels overlap', () => {
    expect(
      isSiteContextLayoutInvalid([
        {
          panelId: 'project-brief',
          shapeId: 'shape:panel:brief' as never,
          rect: { x: 0, y: 0, w: 300, h: 300 },
        },
        {
          panelId: 'web-preview',
          shapeId: 'shape:panel:preview' as never,
          rect: { x: 100, y: 100, w: 400, h: 400 },
        },
      ]),
    ).toBe(true);
  });
});

describe('repairSiteContextFrameLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repositions overlapping panels onto the grid', () => {
    const updateShape = vi.fn();
    const frameBounds = { x: 0, y: 0, w: 1200, h: 900 };
    const editor = {
      getSortedChildIdsForParent: () => ['shape:panel:brief', 'shape:panel:preview'] as never[],
      getShape: (id: string) => {
        if (id === 'shape:frame:site') {
          return { type: 'frame', id, props: { name: 'Site' }, meta: {} };
        }
        if (id === 'shape:panel:brief') {
          return {
            type: 'panel',
            id,
            props: { panelId: 'project-brief', w: 300, h: 900, data: {} },
          };
        }
        if (id === 'shape:panel:preview') {
          return {
            type: 'panel',
            id,
            props: { panelId: 'web-preview', w: 600, h: 500, data: {} },
          };
        }
        return null;
      },
      getShapePageBounds: (id: string) => {
        if (id === 'shape:frame:site') return frameBounds;
        if (id === 'shape:panel:brief') return { x: 40, y: 40, w: 300, h: 900 };
        if (id === 'shape:panel:preview') return { x: 200, y: 200, w: 600, h: 500 };
        return null;
      },
      updateShape,
    };

    const repaired = repairSiteContextFrameLayout(editor as never, 'shape:frame:site' as never);
    expect(repaired).toBe(true);
    expect(updateShape).toHaveBeenCalled();
  });

  it('skips repair when layout is already valid', () => {
    const placements = computeInitialSiteContextLayout(
      { x: 40, y: 40, maxWidth: 1120, maxHeight: 820 },
      { includeChat: false, includeBrief: true, includePreview: true, includeFiles: false },
    );
    const brief = placements.find((p) => p.panelId === 'project-brief');
    const preview = placements.find((p) => p.panelId === 'web-preview');
    expect(brief).toBeDefined();
    expect(preview).toBeDefined();

    const updateShape = vi.fn();
    const editor = {
      getSortedChildIdsForParent: () => ['shape:panel:brief', 'shape:panel:preview'] as never[],
      getShape: (id: string) => ({
        type: 'panel',
        id,
        props: {
          panelId: id.includes('brief') ? 'project-brief' : 'web-preview',
          w: 300,
          h: 300,
          data: {},
        },
      }),
      getShapePageBounds: (id: string) => {
        if (id === 'shape:frame:site') return { x: 0, y: 0, w: 1200, h: 900 };
        if (id === 'shape:panel:brief') {
          return { x: brief!.x, y: brief!.y, w: brief!.w, h: brief!.h };
        }
        return { x: preview!.x, y: preview!.y, w: preview!.w, h: preview!.h };
      },
      updateShape,
    };

    expect(repairSiteContextFrameLayout(editor as never, 'shape:frame:site' as never)).toBe(false);
    expect(updateShape).not.toHaveBeenCalled();
  });
});
