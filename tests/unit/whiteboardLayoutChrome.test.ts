import { describe, it, expect, vi } from 'vitest';
import { createShapeId } from 'tldraw';
import { autoArrangeWhiteboardPanels } from '../../src/engines/tldraw/layout/autoArrangeWhiteboardPanels';
import { resetWhiteboardLayout } from '../../src/engines/tldraw/layout/resetWhiteboardLayout';
import {
  __resetPanelShapeApiForTests__,
  bindEditor,
  openPanelInCanvas,
} from '../../src/engines/tldraw/shapes/panelShapeApi';

function makeEditor(viewport = { x: 0, y: 0, w: 1200, h: 800 }) {
  const shapes = new Map<string, { id: string; type: string; x: number; y: number; props: Record<string, unknown> }>;

  const editor = {
    getViewportPageBounds: () => viewport,
    getCurrentPageShapes: () => Array.from(shapes.values),
    getShape: (id: string) => shapes.get(String(id)) ?? null,
    createShape: (shape: { id: string; type: string; x: number; y: number; props: Record<string, unknown> }) => {
      shapes.set(String(shape.id), {...shape, props: {...shape.props } });
    },
    updateShape: (patch: { id: string; type: string; x?: number; y?: number; props?: Record<string, unknown> }) => {
      const existing = shapes.get(String(patch.id));
      if (!existing) return;
      shapes.set(String(patch.id), {...existing,
        x: patch.x ?? existing.x,
        y: patch.y ?? existing.y,
        props: {...existing.props,...(patch.props ?? {}) },
      });
    },
    deleteShapes: (ids: string[]) => {
      for (const id of ids) shapes.delete(String(id));
    },
    select: vi.fn(),
    setCamera: vi.fn(),
    getSelectedShapeIds: () => [],
    getShapePageBounds: () => null,
    bringToFront: vi.fn(),
  };

  return { editor, shapes };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

describe('autoArrangeWhiteboardPanels', () => {
  it('repositions chat left and other panels without overlapping origin', () => {
    const { editor, shapes } = makeEditor();
    const chatId = createShapeId('panel:chat');
    const appsId = createShapeId('panel:applications');
    shapes.set(String(chatId), {
      id: String(chatId),
      type: 'panel',
      x: 400,
      y: 400,
      props: { panelId: 'chat', w: 320, h: 480 },
    });
    shapes.set(String(appsId), {
      id: String(appsId),
      type: 'panel',
      x: 10,
      y: 10,
      props: { panelId: 'applications', w: 400, h: 500 },
    });

    const moved = autoArrangeWhiteboardPanels(editor as never, { navExpanded: false });
    expect(moved).toBe(2);

    const chat = shapes.get(String(chatId));
    const apps = shapes.get(String(appsId));
    expect(chat?.x).toBeLessThan(apps?.x ?? Number.POSITIVE_INFINITY);
    expect(chat?.y).toBeGreaterThanOrEqual(0);
     // Collapsed Menu icon rail: inset 24 + reserve 56
    expect(chat?.x).toBeGreaterThanOrEqual(80);
  });

  it('starts further right when Menu is expanded', () => {
    const { editor, shapes } = makeEditor();
    const chatId = createShapeId('panel:chat');
    shapes.set(String(chatId), {
      id: String(chatId),
      type: 'panel',
      x: 10,
      y: 10,
      props: { panelId: 'chat', w: 320, h: 480 },
    });

    autoArrangeWhiteboardPanels(editor as never, { navExpanded: true });
    const chat = shapes.get(String(chatId));
     // Expanded Menu: inset 24 + reserve 210
    expect(chat?.x).toBeGreaterThanOrEqual(234);
  });

  it('tiles many panels without stacking at the same origin or overlapping', () => {
    const { editor, shapes } = makeEditor({ x: 0, y: 0, w: 1280, h: 800 });
    const defs = [
      { id: 'chat', w: 400, h: 620 },
      { id: 'open-positions', w: 440, h: 540 },
      { id: 'resources', w: 440, h: 540 },
      { id: 'growth-paths', w: 440, h: 540 },
      { id: 'applications', w: 440, h: 540 },
      { id: 'artifacts', w: 420, h: 340 },
    ] as const;

    for (const def of defs) {
      const shapeId = createShapeId(`panel:${def.id}`);
      shapes.set(String(shapeId), {
        id: String(shapeId),
        type: 'panel',
        x: 10,
        y: 10,
        props: { panelId: def.id, w: def.w, h: def.h },
      });
    }

    const moved = autoArrangeWhiteboardPanels(editor as never, { navExpanded: true });
    expect(moved).toBe(defs.length);

    const rects = Array.from(shapes.values).map((shape) => ({
      id: String(shape.props.panelId),
      x: shape.x,
      y: shape.y,
      w: Number(shape.props.w),
      h: Number(shape.props.h),
    }));

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(234);
      expect(rect.y).toBeGreaterThanOrEqual(20);
    }

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(rectsOverlap(rects[i], rects[j], 16)).toBe(false);
        expect(rects[i].x === rects[j].x && rects[i].y === rects[j].y).toBe(false);
      }
    }

    const chat = rects.find((r) => r.id === 'chat');
    const openPositions = rects.find((r) => r.id === 'open-positions');
    expect(chat).toBeDefined();
    expect(openPositions).toBeDefined();
    expect(openPositions!.x).toBeGreaterThan(chat!.x);
  });
});

describe('resetWhiteboardLayout', () => {
  it('closes panels, resets camera, and reopens chat at default placement', () => {
    __resetPanelShapeApiForTests__();
    const { editor, shapes } = makeEditor();
    bindEditor(editor as never);

    openPanelInCanvas('applications', {
      focus: false,
      preserveZoom: true,
      position: { x: 200, y: 100 },
      size: { w: 400, h: 400 },
    });
    expect(shapes.size).toBeGreaterThanOrEqual(1);

    const closed = resetWhiteboardLayout(editor as never, { openChat: true, resetCamera: true });
    expect(closed).toBeGreaterThanOrEqual(1);
    expect(editor.setCamera).toHaveBeenCalled;

    const chatId = String(createShapeId('panel:chat'));
    const chat = shapes.get(chatId);
    expect(chat?.props.panelId).toBe('chat');
    expect(typeof chat?.x).toBe('number');
    expect(typeof chat?.y).toBe('number');

    __resetPanelShapeApiForTests__();
  });

  it('deletes drawn content by default (a reset that keeps old sketches is not a reset)', () => {
    __resetPanelShapeApiForTests__();
    const { editor, shapes } = makeEditor();
    bindEditor(editor as never);

    const drawingId = String(createShapeId('old-drawing'));
    shapes.set(drawingId, {
      id: drawingId,
      typeName: 'shape',
      type: 'geo',
      x: 100,
      y: 100,
      index: 'a9',
      meta: {},
      props: { w: 200, h: 100 },
    } as never);

    resetWhiteboardLayout(editor as never, { openChat: true, resetCamera: true });
    expect(shapes.has(drawingId)).toBe(false);

    const chatId = String(createShapeId('panel:chat'));
    expect(shapes.get(chatId)?.props.panelId).toBe('chat');

    __resetPanelShapeApiForTests__();
  });

  it('keeps drawn content when clearContent is false', () => {
    __resetPanelShapeApiForTests__();
    const { editor, shapes } = makeEditor();
    bindEditor(editor as never);

    const drawingId = String(createShapeId('kept-drawing'));
    shapes.set(drawingId, {
      id: drawingId,
      typeName: 'shape',
      type: 'geo',
      x: 100,
      y: 100,
      index: 'a9',
      meta: {},
      props: { w: 200, h: 100 },
    } as never);

    resetWhiteboardLayout(editor as never, {
      openChat: true,
      resetCamera: true,
      clearContent: false,
    });
    expect(shapes.has(drawingId)).toBe(true);

    __resetPanelShapeApiForTests__();
  });
});
