/**
 * Unit tests for 12-column grid layout utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  createGridSpec,
  findNextGridSlot,
  getPanelGridSpan,
  gridPlacementToRect,
  gridSpanToSize,
  markGridOccupancy,
  rectsOverlapWithGap,
  GRID_COLUMNS,
  GRID_GUTTER,
  GRID_ROW_HEIGHT,
} from '../../src/canvas/gridLayout';

describe('createGridSpec', () => {
  it('derives column width from container width and gutters', () => {
    const spec = createGridSpec(1200);
    expect(spec.columns).toBe(GRID_COLUMNS);
    expect(spec.rowHeight).toBe(GRID_ROW_HEIGHT);
    expect(spec.gutter).toBe(GRID_GUTTER);
    const expectedColWidth = (1200 - GRID_GUTTER * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    expect(spec.colWidth).toBeCloseTo(expectedColWidth, 4);
  });
});

describe('gridPlacementToRect', () => {
  it('snaps panel origin and size to the 20px grid', () => {
    const spec = createGridSpec(1200);
    const rect = gridPlacementToRect(
      spec,
      { x: 100, y: 80 },
      { col: 0, row: 0, colSpan: 3, rowSpan: 7 },
      true,
    );
    expect(rect.x % 20).toBe(0);
    expect(rect.y % 20).toBe(0);
    expect(rect.w % 20).toBe(0);
    expect(rect.h % 20).toBe(0);
  });

  it('places cells with gutter offsets', () => {
    const spec = createGridSpec(1200);
    const first = gridPlacementToRect(spec, { x: 0, y: 0 }, { col: 0, row: 0, colSpan: 3, rowSpan: 1 }, false);
    const second = gridPlacementToRect(spec, { x: 0, y: 0 }, { col: 3, row: 0, colSpan: 3, rowSpan: 1 }, false);
    expect(second.x).toBeCloseTo(first.x + first.w + GRID_GUTTER, 4);
  });
});

describe('findNextGridSlot', () => {
  it('returns the first non-overlapping slot', () => {
    const spec = createGridSpec(1200);
    const occupied = new Set<string>();
    markGridOccupancy(occupied, spec, { x: 0, y: 0 }, { x: 0, y: 0, w: 300, h: 300 });

    const slot = findNextGridSlot(spec, occupied, 3, 4);
    expect(slot).not.toBeNull();
    if (!slot) return;

    for (let r = slot.row; r < slot.row + slot.rowSpan; r += 1) {
      for (let c = slot.col; c < slot.col + slot.colSpan; c += 1) {
        expect(occupied.has(`${c},${r}`)).toBe(false);
      }
    }
  });
});

describe('getPanelGridSpan', () => {
  it('caps project-brief row span below viewport-scale heights', () => {
    const span = getPanelGridSpan('project-brief');
    const spec = createGridSpec(1200);
    const size = gridSpanToSize(spec, span, false);
    expect(size.h).toBeLessThan(600);
    expect(span.rowSpan).toBeLessThanOrEqual(8);
  });

  it('uses taller default row span for web-preview', () => {
    const span = getPanelGridSpan('web-preview');
    // Preview drives the uniform row height; a tall span (~720px) gives the
    // site group a viewport-like aspect ratio for full-screen zoom-to-fit.
    expect(span.rowSpan).toBe(13);
    expect(span.rowSpan).toBeGreaterThan(getPanelGridSpan('chat').rowSpan);
  });
});

describe('rectsOverlapWithGap', () => {
  it('detects overlap with gutter gap', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    const b = { x: 110, y: 0, w: 100, h: 100 };
    expect(rectsOverlapWithGap(a, b, 16)).toBe(true);
    expect(rectsOverlapWithGap(a, { x: 120, y: 0, w: 100, h: 100 }, 16)).toBe(false);
  });
});
