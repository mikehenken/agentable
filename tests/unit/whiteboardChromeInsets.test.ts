import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createShapeId } from 'tldraw';
import { useNavChromeStore } from '../../src/components/chrome/navChromeStore';
import { autoArrangeWhiteboardPanels } from '../../src/engines/tldraw/layout/autoArrangeWhiteboardPanels';
import {
  getFreeCanvasViewportConfig,
  resolveWhiteboardChromeInsets,
} from '../../src/engines/tldraw/layout/whiteboardChromeInsets';
import {
  __resetPanelShapeApiForTests__,
  bindEditor,
  openPanelInCanvas,
} from '../../src/engines/tldraw/shapes/panelShapeApi';

function makeEditor(viewport = { x: 0, y: 0, w: 1280, h: 800 }) {
  const shapes = new Map<
    string,
    { id: string; type: string; x: number; y: number; props: Record<string, unknown> }
  >;

  const editor = {
    getViewportPageBounds: () => viewport,
    getCurrentPageShapes: () => Array.from(shapes.values),
    getShape: (id: string) => shapes.get(String(id)) ?? null,
    createShape: (shape: {
      id: string;
      type: string;
      x: number;
      y: number;
      props: Record<string, unknown>;
    }) => {
      shapes.set(String(shape.id), {...shape, props: {...shape.props } });
    },
    updateShape: (patch: {
      id: string;
      type: string;
      x?: number;
      y?: number;
      props?: Record<string, unknown>;
    }) => {
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
    select: () => undefined,
    setCamera: () => undefined,
    getSelectedShapeIds: () => [],
    getShapePageBounds: (id: string) => {
      const shape = shapes.get(String(id));
      if (!shape) return null;
      const w = typeof shape.props.w === 'number' ? shape.props.w: 360;
      const h = typeof shape.props.h === 'number' ? shape.props.h: 400;
      return { x: shape.x, y: shape.y, w, h };
    },
    bringToFront: () => undefined,
  };

  return { editor, shapes };
}

describe('whiteboard chrome insets — expanded vs collapsed Menu', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    useNavChromeStore.setState({ navSidebarExpanded: false });
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    useNavChromeStore.setState({ navSidebarExpanded: false });
  });

  it('resolveWhiteboardChromeInsets uses store expanded state', () => {
    useNavChromeStore.setState({ navSidebarExpanded: true });
    const expanded = resolveWhiteboardChromeInsets(1280);
    expect(expanded.left).toBe(234);
    expect(expanded.navExpanded).toBe(true);

    useNavChromeStore.setState({ navSidebarExpanded: false });
    const collapsed = resolveWhiteboardChromeInsets(1280);
    expect(collapsed.left).toBe(80);
    expect(collapsed.navExpanded).toBe(false);
  });

  it('getFreeCanvasViewportConfig left edge clears expanded Menu', () => {
    useNavChromeStore.setState({ navSidebarExpanded: true });
    const { editor } = makeEditor;
    const free = getFreeCanvasViewportConfig(editor as never);
    expect(free.left).toBe(234);
    expect(free.top).toBe(24);
  });

  it('openPanelInCanvas places new panels beside expanded Menu', () => {
    useNavChromeStore.setState({ navSidebarExpanded: true });
    const { editor, shapes } = makeEditor;
    bindEditor(editor as never);

    openPanelInCanvas('chat', {
      focus: false,
      preserveZoom: true,
      size: { w: 320, h: 480 },
    });

    const chatId = String(createShapeId('panel:chat'));
    const chat = shapes.get(chatId);
    expect(chat).toBeDefined();
     // Free-canvas left = 24+210; y snaps to 20px grid (24 → 20).
    expect(chat?.x).toBeGreaterThanOrEqual(220);
    expect(chat?.y).toBeGreaterThanOrEqual(20);
  });

  it('openPanelInCanvas uses narrower inset when Menu is collapsed', () => {
    useNavChromeStore.setState({ navSidebarExpanded: false });
    const { editor, shapes } = makeEditor;
    bindEditor(editor as never);

    openPanelInCanvas('applications', {
      focus: false,
      preserveZoom: true,
      size: { w: 400, h: 400 },
    });

    const appsId = String(createShapeId('panel:applications'));
    const apps = shapes.get(appsId);
    expect(apps).toBeDefined();
     // Collapsed left = 24+56; must stay left of expanded origin.
    expect(apps?.x).toBeGreaterThanOrEqual(60);
    expect(apps?.x).toBeLessThan(220);
  });

  it('autoArrangeWhiteboardPanels origin respects expanded Menu override', () => {
    const { editor, shapes } = makeEditor;
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
    expect(chat?.x).toBeGreaterThanOrEqual(234);

    autoArrangeWhiteboardPanels(editor as never, { navExpanded: false });
    const chatCollapsed = shapes.get(String(chatId));
    expect(chatCollapsed?.x).toBeGreaterThanOrEqual(80);
    expect(chatCollapsed?.x).toBeLessThan(234);
  });

  it('openPanelInCanvas places sequential career panels without overlap beside expanded Menu', () => {
    useNavChromeStore.setState({ navSidebarExpanded: true });
    const { editor, shapes } = makeEditor;
    bindEditor(editor as never);

    const panelIds = [
      'chat',
      'open-positions',
      'resources',
      'growth-paths',
      'applications',
      'artifacts',
    ] as const;

    for (const panelId of panelIds) {
      openPanelInCanvas(panelId, {
        focus: false,
        preserveZoom: true,
        size: { w: 400, h: 480 },
      });
    }

    const rects = panelIds.map((panelId) => {
      const shape = shapes.get(String(createShapeId(`panel:${panelId}`)));
      expect(shape).toBeDefined();
      return {
        id: panelId,
        x: shape!.x,
        y: shape!.y,
        w: Number(shape!.props.w),
        h: Number(shape!.props.h),
      };
    });

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(220);
      expect(rect.y).toBeGreaterThanOrEqual(20);
    }

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const overlap = !(
          a.x + a.w + 16 <= b.x ||
          b.x + b.w + 16 <= a.x ||
          a.y + a.h + 16 <= b.y ||
          b.y + b.h + 16 <= a.y
        );
        expect(overlap).toBe(false);
        expect(a.x === b.x && a.y === b.y).toBe(false);
      }
    }
  });
});
