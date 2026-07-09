/**
 * Unit tests for site context panel layout.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  computeInitialSiteContextLayout,
  computePanelPlacementInSiteContext,
  resolveInsertionSiteContext,
  SITE_FILE_MANAGER_WIDTH,
} from '../../src/whiteboard/context/siteContextPanelLayout';
import { contextGroupFrameId } from '../../src/whiteboard/context/contextGroupApi';

describe('computeInitialSiteContextLayout', () => {
  it('places brief, preview, and narrow files without chat', () => {
    const layouts = computeInitialSiteContextLayout(
      { x: 100, y: 80, maxWidth: 1600, maxHeight: 800 },
      { includeChat: false, includeBrief: true, includePreview: true, includeFiles: true },
    );

    expect(layouts.map((l) => l.panelId)).toEqual([
      'project-brief',
      'web-preview',
      'file-manager',
    ]);

    const files = layouts.find((l) => l.panelId === 'file-manager');
    expect(files?.w).toBe(SITE_FILE_MANAGER_WIDTH);
    expect(files?.y).toBeGreaterThan(layouts[0]?.y ?? 0);
  });

  it('includes chat in the primary row when requested', () => {
    const layouts = computeInitialSiteContextLayout(
      { x: 0, y: 0, maxWidth: 1800, maxHeight: 900 },
      { includeChat: true, includeBrief: true, includePreview: true, includeFiles: true },
    );

    expect(layouts[0]?.panelId).toBe('chat');
    expect(layouts[1]?.panelId).toBe('project-brief');
    expect(layouts[2]?.panelId).toBe('web-preview');
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
    props: { w: 400, h: 500, panelId: 'chat', data: { __siteId: 'site-abc' } },
  });

  const editor: StubEditor = {
    __panels: panels,
    __frames: frames,
    getShape: vi.fn((id: string) => panels.get(id) ?? frames.get(id)),
    getSelectedShapeIds: vi.fn(() => ['shape:panel:chat']),
    getSortedChildIdsForParent: vi.fn((parentId: string) =>
      [...panels.values()].filter((p) => p.parentId === parentId).map((p) => p.id),
    ),
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

describe('resolveInsertionSiteContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves from panel __siteId', () => {
    const editor = makeLayoutEditor();
    const ctx = resolveInsertionSiteContext(editor as never, { __siteId: 'site-abc' });
    expect(ctx?.siteId).toBe('site-abc');
  });

  it('resolves from selected panel in site group', () => {
    const editor = makeLayoutEditor();
    const ctx = resolveInsertionSiteContext(editor as never);
    expect(ctx?.siteId).toBe('site-abc');
  });
});

describe('computePanelPlacementInSiteContext', () => {
  it('places beside existing panels without overlap', () => {
    const editor = makeLayoutEditor();
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-abc' });
    const placement = computePanelPlacementInSiteContext(
      editor as never,
      { siteId: 'site-abc', frameId, label: 'Site' },
      { w: 380, h: 520 },
    );

    expect(placement.x + 380).toBeLessThanOrEqual(2000);
    expect(placement.x >= 440 + 16 || placement.y >= 540).toBe(true);
  });
});
