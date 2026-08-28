/**
 * Unit tests for site context panel layout.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  computeInitialContextFrameLayout,
  computePanelPlacementInContextFrame,
  resolveInsertionContextFrame,
  getPanelGridSpan,
  GRID_ROW_HEIGHT,
  GRID_GUTTER,
} from '../../src/engines/tldraw/context/contextFramePanelLayout';
import { createGridSpec, gridSpanToSize } from '../../src/layout/gridLayout';
import { contextGroupFrameId } from '../../src/engines/tldraw/context/contextGroupApi';
import { rectsOverlapWithGap } from '../../src/layout/gridLayout';

const ANCHOR = { x: 100, y: 80, maxWidth: 1600, maxHeight: 900 };

function maxBriefHeight(): number {
  const span = getPanelGridSpan('project-brief');
  return span.rowSpan * GRID_ROW_HEIGHT + (span.rowSpan - 1) * GRID_GUTTER;
}

describe('computeInitialContextFrameLayout', () => {
  it('places brief, preview, and files without chat on the 12-column grid', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: false,
      includeBrief: true,
      includePreview: true,
      includeFiles: true,
    });

    expect(layouts.map((l) => l.panelId)).toEqual([
      'project-brief',
      'web-preview',
      'file-manager',
    ]);

    const brief = layouts.find((l) => l.panelId === 'project-brief');
    const preview = layouts.find((l) => l.panelId === 'web-preview');
    const files = layouts.find((l) => l.panelId === 'file-manager');

    expect(brief).toBeDefined();
    expect(preview).toBeDefined();
    expect(files).toBeDefined();

    expect(files?.y).toBe(brief?.y);
    expect(files?.x).toBeGreaterThan((preview?.x ?? 0) + (preview?.w ?? 0) - 1);
    expect(preview?.w).toBeGreaterThan(brief?.w ?? 0);
  });

  it('does not stretch brief to viewport height', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: false,
      includeBrief: true,
      includePreview: false,
      includeFiles: false,
    });

    const brief = layouts.find((l) => l.panelId === 'project-brief');
    expect(brief).toBeDefined();
    expect(brief?.h).toBeLessThan(ANCHOR.maxHeight * 0.6);
    expect(brief?.h).toBeLessThanOrEqual(maxBriefHeight() + 40);
  });

  it('expands preview to fill remaining columns without chat', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: false,
      includeBrief: true,
      includePreview: true,
      includeFiles: false,
    });

    const brief = layouts.find((l) => l.panelId === 'project-brief');
    const preview = layouts.find((l) => l.panelId === 'web-preview');
    expect(brief).toBeDefined();
    expect(preview).toBeDefined();

    const briefSpan = getPanelGridSpan('project-brief');
    const refSpec = createGridSpec(ANCHOR.maxWidth);
    const briefW = gridSpanToSize(refSpec, briefSpan).w;
    const expectedPreviewW = ANCHOR.maxWidth - briefW - GRID_GUTTER;
    expect(preview?.w).toBeGreaterThan(gridSpanToSize(refSpec, getPanelGridSpan('web-preview')).w - 40);
    expect(preview?.w).toBeCloseTo(expectedPreviewW, -1);
  });

  it('uses docked chat + brief + preview + files with gutter after chat', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: true,
      includeBrief: true,
      includePreview: true,
      includeFiles: true,
      dockChatLeft: true,
    });

    expect(layouts.map((l) => l.panelId)).toEqual([
      'chat',
      'project-brief',
      'web-preview',
      'file-manager',
    ]);

    const chat = layouts.find((l) => l.panelId === 'chat');
    const brief = layouts.find((l) => l.panelId === 'project-brief');
    expect(chat).toBeDefined();
    expect(brief).toBeDefined();
    const gap = (brief?.x ?? 0) - ((chat?.x ?? 0) + (chat?.w ?? 0));
    expect(gap).toBeGreaterThanOrEqual(GRID_GUTTER - 1);
  });

  it('produces non-overlapping panel placements', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: true,
      includeBrief: true,
      includePreview: true,
      includeFiles: true,
      dockChatLeft: true,
    });

    for (let i = 0; i < layouts.length; i += 1) {
      for (let j = i + 1; j < layouts.length; j += 1) {
        const a = layouts[i];
        const b = layouts[j];
        expect(rectsOverlapWithGap(a, b, GRID_GUTTER)).toBe(false);
      }
    }
  });

  it('snaps all coordinates to the 20px grid', () => {
    const layouts = computeInitialContextFrameLayout(ANCHOR, {
      includeChat: true,
      includeBrief: true,
      includePreview: true,
      includeFiles: true,
    });

    for (const layout of layouts) {
      expect(layout.x % 20).toBe(0);
      expect(layout.y % 20).toBe(0);
      expect(layout.w % 20).toBe(0);
      expect(layout.h % 20).toBe(0);
    }
  });
});

interface StubPanel {
  id: string;
  type: 'panel';
  x: number;
  y: number;
  parentId: string;
  props: { w: number; h: number; panelId: string; data: Record<string, unknown> };
}

interface StubFrame {
  id: string;
  type: 'frame';
  x: number;
  y: number;
  parentId: string;
  props: { w: number; h: number; name: string };
  meta?: Record<string, unknown>;
}

interface StubEditor {
  getShape: Mock;
  getSelectedShapeIds: Mock;
  getSortedChildIdsForParent: Mock;
  getShapePageBounds: Mock;
  getViewportPageBounds: Mock;
  __panels: Map<string, StubPanel>;
  __frames: Map<string, StubFrame>;
}

function makeLayoutEditor(): StubEditor {
  const panels = new Map<string, StubPanel>();
  const frames = new Map<string, StubFrame>();
  const frameId = contextGroupFrameId({ kind: 'site', id: 'site-abc' });

  frames.set(frameId, {
    id: frameId,
    type: 'frame',
    x: 0,
    y: 0,
    parentId: 'page:page',
    props: { w: 2000, h: 1200, name: 'Site' },
    meta: { landiContextGroup: { kind: 'site', id: 'site-abc' } },
  });

  panels.set('shape:panel:chat', {
    id: 'shape:panel:chat',
    type: 'panel',
    x: 40,
    y: 40,
    parentId: frameId,
    props: { w: 280, h: 240, panelId: 'chat', data: { __siteId: 'site-abc' } },
  });

  const editor: StubEditor = {
    __panels: panels,
    __frames: frames,
    getShape: vi.fn((id: string) => panels.get(id) ?? frames.get(id)),
    getSelectedShapeIds: vi.fn(() => ['shape:panel:chat']),
    getSortedChildIdsForParent: vi.fn((parentId: string) =>
      [...panels.values()].filter((p) => p.parentId === parentId).map((p) => p.id)),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = panels.get(id) ?? frames.get(id);
      if (!shape) return undefined;
      const w = (shape.props as { w: number }).w;
      const h = (shape.props as { h: number }).h;
      return { x: shape.x, y: shape.y, w, h };
    }),
    getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1440, h: 900 })),
  };

  return editor;
}

describe('resolveInsertionContextFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves from panel __siteId', () => {
    const editor = makeLayoutEditor();
    const ctx = resolveInsertionContextFrame(editor as never, { __siteId: 'site-abc' });
    expect(ctx?.siteId).toBe('site-abc');
  });

  it('resolves from selected panel in site group', () => {
    const editor = makeLayoutEditor();
    const ctx = resolveInsertionContextFrame(editor as never);
    expect(ctx?.siteId).toBe('site-abc');
  });
});

describe('computePanelPlacementInContextFrame', () => {
  it('places new panels on the grid without overlapping existing panels', () => {
    const editor = makeLayoutEditor();
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-abc' });
    const span = getPanelGridSpan('project-brief');
    const size = {
      w: span.colSpan * 80,
      h: span.rowSpan * GRID_ROW_HEIGHT,
    };

    const placement = computePanelPlacementInContextFrame(
      editor as never,
      { siteId: 'site-abc', frameId, label: 'Site' },
      size,
      { panelId: 'project-brief' });

    const existing = editor.getShapePageBounds('shape:panel:chat');
    expect(existing).toBeDefined();
    if (!existing) return;

    const candidate = {
      x: placement.x,
      y: placement.y,
      w: size.w,
      h: size.h,
    };

    expect(rectsOverlapWithGap(candidate, existing, GRID_GUTTER)).toBe(false);
  });
});
