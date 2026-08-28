/**
 * Unit tests for panel dock engine.
 */
import { describe, it, expect, vi } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  resolveDock,
  resolveDockTree,
  cascadeDockedPanelsInFrame,
  reflowContextFrameRow,
  PANEL_DOCK_META_KEY,
  type PanelDock,
} from '../../src/engines/tldraw/context/panelDockEngine';
import { buildAdminSiteDockTree, sizesFromPlacements } from '../../src/engines/tldraw/context/contextFrameDockPresets';
import { computeInitialContextFrameLayout } from '../../src/engines/tldraw/context/contextFramePanelLayout';
import { CONTEXT_FRAME_PADDING } from '../../src/engines/tldraw/context/contextGroupApi';
import { GRID_GUTTER } from '../../src/canvas/gridLayout';

const FRAME_ID = createShapeId('context:site:site-abc');
const FRAME_INNER_PADDING = Math.max(0, Math.floor(CONTEXT_FRAME_PADDING / 2));

function makeDockEditor(frameRect = { x: 0, y: 0, w: 1200, h: 900 }) {
  const panels = new Map<string, { id: string; type: 'panel'; x: number; y: number; props: { w: number; h: number; panelId: string } }>();

  return {
    getShape: (id: string) => {
      if (id === FRAME_ID) {
        return { type: 'frame', id: FRAME_ID, props: { w: frameRect.w, h: frameRect.h } };
      }
      return panels.get(id) ?? null;
    },
    getShapePageBounds: (id: string) => {
      if (id === FRAME_ID) return frameRect;
      const panel = panels.get(id);
      if (!panel) return undefined;
      return { x: panel.x, y: panel.y, w: panel.props.w, h: panel.props.h };
    },
    getViewportPageBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
    getSortedChildIdsForParent: () => [...panels.keys()],
    __panels: panels,
  } as never;
}

describe('resolveDock', () => {
  it('places a panel flush on the group left edge (gap=0)', () => {
    const editor = makeDockEditor();
    const dock: PanelDock = { target: 'group', targetId: FRAME_ID, edge: 'left', gap: 0 };
    const pos = resolveDock(editor, dock, { w: 280, h: 400 });
    expect(pos).toEqual({ x: FRAME_INNER_PADDING, y: FRAME_INNER_PADDING });
  });

  it('stretches chat to full frame inner height when fillHeight is set', () => {
    const editor = makeDockEditor({ x: 0, y: 0, w: 1200, h: 900 });
    const dock: PanelDock = {
      target: 'group',
      targetId: FRAME_ID,
      edge: 'left',
      gap: 0,
      fillHeight: true,
    };
    const pos = resolveDock(editor, dock, { w: 280, h: 400 });
    // inner padding 0 → chat fills the full frame height flush to the edges.
    expect(pos).toEqual({
      x: FRAME_INNER_PADDING,
      y: FRAME_INNER_PADDING,
      h: 900 - FRAME_INNER_PADDING * 2,
    });
  });

  it('places a panel flush to the right of a sibling (gap=0)', () => {
    const editor = makeDockEditor();
    const briefId = createShapeId('panel:project-brief');
    editor.__panels.set(briefId, {
      id: briefId,
      type: 'panel',
      x: 20,
      y: 20,
      props: { w: 280, h: 400, panelId: 'project-brief' },
    });

    const dock: PanelDock = {
      target: 'panel',
      targetId: briefId,
      edge: 'right',
      gap: 0,
    };
    const pos = resolveDock(editor, dock, { w: 600, h: 500 });
    expect(pos).toEqual({ x: 300, y: 20 });
  });
});

describe('resolveDockTree admin preset', () => {
  it('produces non-overlapping flush admin layout', () => {
    const editor = makeDockEditor();
    const placements = computeInitialContextFrameLayout(
      { x: 20, y: 20, maxWidth: 1160, maxHeight: 860 },
      { includeChat: false, includeBrief: true, includePreview: true, includeFiles: true });
    const sizes = sizesFromPlacements(placements);
    const tree = buildAdminSiteDockTree(
      {
        includeChat: false,
        includeBrief: true,
        includePreview: true,
        includeFiles: true,
        frameId: FRAME_ID,
      },
      sizes);

    const resolved = resolveDockTree(editor, FRAME_ID, tree);
    expect(resolved.map((r) => r.panelId)).toEqual([
      'project-brief',
      'web-preview',
      'file-manager',
    ]);

    const brief = resolved.find((r) => r.panelId === 'project-brief');
    const preview = resolved.find((r) => r.panelId === 'web-preview');
    const files = resolved.find((r) => r.panelId === 'file-manager');

    // Admin layout is a single flush row on one inner top edge: brief docks
    // flush-left, preview to the right of brief, files flush to the RIGHT edge.
    expect(brief?.x).toBe(FRAME_INNER_PADDING);
    expect(preview?.x).toBe((brief?.x ?? 0) + (brief?.w ?? 0));
    // File manager is pinned to the frame's right inner edge (gap=0).
    expect((files?.x ?? 0) + (files?.w ?? 0)).toBe(1200 - FRAME_INNER_PADDING);
    // No overlap between the flexed preview and the right-docked files.
    expect((preview?.x ?? 0) + (preview?.w ?? 0)).toBeLessThanOrEqual(files?.x ?? 0);
    // All three share the inner top edge.
    expect(files?.y).toBe(preview?.y);
    expect(preview?.y).toBe(brief?.y);
    expect(brief?.y).toBe(FRAME_INNER_PADDING);
  });
});

describe('cascadeDockedPanelsInFrame', () => {
  it('writes frame-LOCAL coordinates for a frame offset from the page origin', () => {
    // Regression: docked panels are children of the frame, so their x/y are in
    // the frame's local space. resolveDock returns page space; writing those raw
    // page coords as local flung chat off by the frame's page position (which
    // then ballooned the frame). The cascade must convert page → frame-local.
    const chatId = createShapeId('panel:chat');
    // Frame far from the page origin — this is where the bug manifested.
    const frameRect = { x: 1000, y: 2000, w: 1200, h: 900 };
    const chatDock: PanelDock = {
      target: 'group',
      targetId: FRAME_ID,
      edge: 'left',
      gap: 0,
      fillHeight: true,
    };
    const updateShape = vi.fn();

    const editor = {
      getShape: (id: string) => {
        if (id === FRAME_ID) {
          return {
            type: 'frame',
            id: FRAME_ID,
            meta: { landiContextGroup: { kind: 'site', id: 'site-abc' } },
            props: { w: frameRect.w, h: frameRect.h },
          };
        }
        if (id === chatId) {
          return {
            type: 'panel',
            id: chatId,
            parentId: FRAME_ID,
            meta: { [PANEL_DOCK_META_KEY]: chatDock },
            props: { panelId: 'chat', w: 280, h: 400 },
          };
        }
        return null;
      },
      getShapePageBounds: (id: string) => (id === FRAME_ID ? frameRect : undefined),
      getSortedChildIdsForParent: () => [chatId] as never[],
      // Inverse of the frame's page transform (frame at (1000, 2000)).
      getPointInShapeSpace: (_frame: unknown, pt: { x: number; y: number }) => ({
        x: pt.x - frameRect.x,
        y: pt.y - frameRect.y,
      }),
      updateShape,
    };

    cascadeDockedPanelsInFrame(editor as never, FRAME_ID);

    const chatUpdate = updateShape.mock.calls.find((call) => call[0]?.id === chatId);
    expect(chatUpdate).toBeDefined();
    // Local flush-left/top at the frame inner padding — NOT the page position.
    expect(chatUpdate?.[0]?.x).toBe(FRAME_INNER_PADDING);
    expect(chatUpdate?.[0]?.y).toBe(FRAME_INNER_PADDING);
    expect(chatUpdate?.[0]?.x).toBeLessThan(frameRect.x);
    // fillHeight stretches chat to the frame inner height.
    expect(chatUpdate?.[0]?.props?.h).toBe(frameRect.h - FRAME_INNER_PADDING * 2);
  });
});

interface ReflowPanel {
  id: string;
  type: 'panel';
  parentId: string;
  x: number;
  y: number;
  meta?: Record<string, unknown>;
  props: { panelId: string; w: number; h: number };
}

/**
 * Mutable stub editor: updateShape writes back so cascade → preview centering
 * observe the docked positions, and page bounds are frame-origin + local x/y.
 */
function makeReflowEditor(frameRect: { x: number; y: number; w: number; h: number }) {
  const chatId = createShapeId('panel:chat');
  const previewId = createShapeId('panel:web-preview');
  const filesId = createShapeId('panel:file-manager');

  const shapes = new Map<string, ReflowPanel | { type: 'frame'; id: string; meta: Record<string, unknown>; props: { w: number; h: number } }>();
  shapes.set(FRAME_ID, {
    type: 'frame',
    id: FRAME_ID,
    meta: { landiContextGroup: { kind: 'site', id: 'site-abc' } },
    props: { w: frameRect.w, h: frameRect.h },
  });
  shapes.set(chatId, {
    id: chatId,
    type: 'panel',
    parentId: FRAME_ID,
    x: 0,
    y: 0,
    meta: { [PANEL_DOCK_META_KEY]: { target: 'group', targetId: FRAME_ID, edge: 'left', gap: 0, fillHeight: true } },
    props: { panelId: 'chat', w: 200, h: frameRect.h },
  });
  shapes.set(previewId, {
    id: previewId,
    type: 'panel',
    parentId: FRAME_ID,
    x: 220,
    y: 0,
    props: { panelId: 'web-preview', w: 400, h: frameRect.h },
  });
  shapes.set(filesId, {
    id: filesId,
    type: 'panel',
    parentId: FRAME_ID,
    x: 780,
    y: 0,
    meta: { [PANEL_DOCK_META_KEY]: { target: 'group', targetId: FRAME_ID, edge: 'right', gap: 0, fillHeight: true } },
    props: { panelId: 'file-manager', w: 200, h: frameRect.h },
  });

  const editor = {
    run: (fn: () => void) => fn(),
    getShape: (id: string) => shapes.get(id) ?? null,
    getShapePageBounds: (id: string) => {
      const s = shapes.get(id);
      if (!s) return undefined;
      if (id === FRAME_ID) return frameRect;
      const panel = s as ReflowPanel;
      return { x: frameRect.x + panel.x, y: frameRect.y + panel.y, w: panel.props.w, h: panel.props.h };
    },
    getSortedChildIdsForParent: () => [chatId, previewId, filesId] as never[],
    getPointInShapeSpace: (_frame: unknown, pt: { x: number; y: number }) => ({
      x: pt.x - frameRect.x,
      y: pt.y - frameRect.y,
    }),
    updateShape: (patch: { id: string; x?: number; y?: number; props?: Record<string, unknown> }) => {
      const s = shapes.get(patch.id) as ReflowPanel | undefined;
      if (!s) return;
      if (patch.x !== undefined) s.x = patch.x;
      if (patch.y !== undefined) s.y = patch.y;
      if (patch.props) s.props = { ...s.props, ...(patch.props as ReflowPanel['props']) };
    },
  };

  const pageRect = (id: string) => {
    const s = shapes.get(id) as ReflowPanel;
    return { x: frameRect.x + s.x, y: frameRect.y + s.y, w: s.props.w, h: s.props.h };
  };

  return { editor, shapes, chatId, previewId, filesId, pageRect };
}

describe('reflowContextFrameRow', () => {
  it('docks chat left + files right and centers preview with symmetric gutters', () => {
    const frameRect = { x: 100, y: 200, w: 1000, h: 600 };
    const { editor, chatId, filesId, pageRect } = makeReflowEditor(frameRect);

    reflowContextFrameRow(editor as never, FRAME_ID);

    const chat = pageRect(chatId);
    const preview = pageRect(createShapeId('panel:web-preview'));
    const files = pageRect(filesId);

    // Chat flush-left at full inner height.
    expect(chat.x).toBe(frameRect.x);
    expect(chat.h).toBe(frameRect.h);
    // Files flush to the right inner edge at full height.
    expect(files.x + files.w).toBe(frameRect.x + frameRect.w);
    expect(files.h).toBe(frameRect.h);
    // Preview full height with EQUAL gutters to both neighbours.
    expect(preview.h).toBe(frameRect.h);
    expect(preview.x - (chat.x + chat.w)).toBe(GRID_GUTTER);
    expect(files.x - (preview.x + preview.w)).toBe(GRID_GUTTER);
  });

  it('tracks a horizontal GROUP resize: files follow the right edge, preview refills', () => {
    const frameRect = { x: 100, y: 200, w: 1000, h: 600 };
    const { editor, filesId, previewId, pageRect } = makeReflowEditor(frameRect);

    reflowContextFrameRow(editor as never, FRAME_ID);
    const previewWBefore = pageRect(previewId).w;

    // Simulate the user widening the group by 400px.
    frameRect.w = 1400;
    reflowContextFrameRow(editor as never, FRAME_ID);

    const files = pageRect(filesId);
    const preview = pageRect(previewId);
    // Files stay pinned flush to the (new) right edge.
    expect(files.x + files.w).toBe(frameRect.x + frameRect.w);
    // Preview absorbs the extra width (still one gutter from files).
    expect(files.x - (preview.x + preview.w)).toBe(GRID_GUTTER);
    expect(preview.w).toBeGreaterThan(previewWBefore);
  });

  it('tracks a vertical GROUP resize: all three panels fill the new height', () => {
    const frameRect = { x: 100, y: 200, w: 1000, h: 600 };
    const { editor, chatId, filesId, previewId, pageRect } = makeReflowEditor(frameRect);

    frameRect.h = 900;
    reflowContextFrameRow(editor as never, FRAME_ID);

    expect(pageRect(chatId).h).toBe(900);
    expect(pageRect(previewId).h).toBe(900);
    expect(pageRect(filesId).h).toBe(900);
  });
});
