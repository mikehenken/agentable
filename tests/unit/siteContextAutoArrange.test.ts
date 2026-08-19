/**
 * Unit tests for site context auto-arrange.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextGroupFrameId } from '../../src/whiteboard/context/contextGroupApi';
import { GRID_GUTTER } from '../../src/canvas/gridLayout';

vi.mock('../../src/whiteboard/context/contextGroupApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/whiteboard/context/contextGroupApi')>();
  return {...actual,
    fitContextGroupFrameToContent: vi.fn(() => true),
  };
});

const setPanelDock = vi.fn();
const applyPanelDock = vi.fn(() => true);

vi.mock('../../src/whiteboard/context/panelDockEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/whiteboard/context/panelDockEngine')>();
  return {...actual,
    setPanelDock: (...args: unknown[]) => setPanelDock(...args),
    applyPanelDock: (...args: unknown[]) => applyPanelDock(...args),
  };
});

import { autoArrangeSiteContextPanels } from '../../src/whiteboard/context/siteContextAutoArrange';

const SITE_ID = 'site-abc';
const FRAME_ID = contextGroupFrameId({ kind: 'site', id: SITE_ID });

describe('autoArrangeSiteContextPanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears dock meta for grid panels and docks chat to frame left', () => {
    const updateShape = vi.fn();
    const frameBounds = { x: 0, y: 0, w: 1200, h: 900 };

    const editor = {
      getShape: (id: string) => {
        if (id === FRAME_ID) {
          return {
            type: 'frame',
            id: FRAME_ID,
            meta: { landiContextGroup: { kind: 'site', id: SITE_ID } },
            props: { w: frameBounds.w, h: frameBounds.h },
          };
        }
        if (id === 'shape:panel:chat') {
          return {
            type: 'panel',
            id,
            x: 10,
            y: 10,
            props: { panelId: 'chat', w: 100, h: 100, data: {} },
          };
        }
        if (id === 'shape:panel:project-brief') {
          return {
            type: 'panel',
            id,
            x: 500,
            y: 500,
            props: { panelId: 'project-brief', w: 100, h: 100, data: {} },
          };
        }
        if (id === 'shape:panel:web-preview') {
          return {
            type: 'panel',
            id,
            x: 600,
            y: 600,
            props: { panelId: 'web-preview', w: 100, h: 100, data: {} },
          };
        }
        return null;
      },
      getSortedChildIdsForParent: () =>
        [
          'shape:panel:chat',
          'shape:panel:project-brief',
          'shape:panel:web-preview',
        ] as never[],
      getShapePageBounds: (id: string) => {
        if (id === FRAME_ID) return frameBounds;
        if (id === 'shape:panel:chat') return { x: 10, y: 10, w: 100, h: 100 };
        if (id === 'shape:panel:project-brief') return { x: 500, y: 500, w: 100, h: 100 };
        if (id === 'shape:panel:web-preview') return { x: 600, y: 600, w: 100, h: 100 };
        return null;
      },
      getViewportPageBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      getCurrentPageShapes: () => [],
      getPointInShapeSpace: (_frame: unknown, pt: { x: number; y: number }) => pt,
      run: (fn: () => void) => fn(),
      updateShape,
    };

    const arranged = autoArrangeSiteContextPanels(editor as never, SITE_ID);
    expect(arranged).toBe(true);

    const briefUpdate = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:project-brief');
    const previewUpdate = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:web-preview');
    expect(briefUpdate).toBeDefined();
    expect(previewUpdate).toBeDefined();

    // Chat's flush-left/fill dock is recorded as intent via setPanelDock; the
    // actual fillHeight is resolved against the fitted frame afterward by
    // cascadeDockedPanelsInFrame (applying it here against the pre-fit frame
    // would lock in a fill↔fit runaway).
    const chatDock = setPanelDock.mock.calls.find((call) => call[1] === 'shape:panel:chat');
    expect(chatDock?.[2]).toMatchObject({
      target: 'group',
      edge: 'left',
      gap: 0,
      fillHeight: true,
    });

    const briefDock = setPanelDock.mock.calls.find(
      (call) => call[1] === 'shape:panel:project-brief');
    expect(briefDock?.[2]).toBeNull();

    const previewDock = setPanelDock.mock.calls.find(
      (call) => call[1] === 'shape:panel:web-preview');
    expect(previewDock?.[2]).toBeNull();
  });

  it('leaves gutter spacing between brief and preview (not flush dock)', () => {
    const updateShape = vi.fn();
    const frameBounds = { x: 0, y: 0, w: 1200, h: 900 };

    const editor = {
      getShape: (id: string) => {
        if (id === FRAME_ID) {
          return {
            type: 'frame',
            id: FRAME_ID,
            meta: { landiContextGroup: { kind: 'site', id: SITE_ID } },
            props: { w: frameBounds.w, h: frameBounds.h },
          };
        }
        if (id === 'shape:panel:project-brief') {
          return {
            type: 'panel',
            id,
            x: 500,
            y: 500,
            props: { panelId: 'project-brief', w: 100, h: 100, data: {} },
          };
        }
        if (id === 'shape:panel:web-preview') {
          return {
            type: 'panel',
            id,
            x: 600,
            y: 600,
            props: { panelId: 'web-preview', w: 100, h: 100, data: {} },
          };
        }
        return null;
      },
      getSortedChildIdsForParent: () =>
        ['shape:panel:project-brief', 'shape:panel:web-preview'] as never[],
      getShapePageBounds: (id: string) => {
        if (id === FRAME_ID) return frameBounds;
        if (id === 'shape:panel:project-brief') return { x: 500, y: 500, w: 100, h: 100 };
        if (id === 'shape:panel:web-preview') return { x: 600, y: 600, w: 100, h: 100 };
        return null;
      },
      getViewportPageBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      getCurrentPageShapes: () => [],
      getPointInShapeSpace: (_frame: unknown, pt: { x: number; y: number }) => pt,
      run: (fn: () => void) => fn(),
      updateShape,
    };

    const arranged = autoArrangeSiteContextPanels(editor as never, SITE_ID);
    expect(arranged).toBe(true);
    expect(updateShape).toHaveBeenCalled();

    const briefUpdate = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:project-brief');
    const previewUpdate = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:web-preview');
    expect(briefUpdate).toBeDefined();
    expect(previewUpdate).toBeDefined();

    const briefRight =
      (briefUpdate?.[0]?.x ?? 0) + (briefUpdate?.[0]?.props?.w ?? 0);
    const gap = (previewUpdate?.[0]?.x ?? 0) - briefRight;
    expect(gap).toBeGreaterThanOrEqual(GRID_GUTTER - 1);
  });

  it('uses stable viewport anchor so repeated arrange does not shrink panels', () => {
    const updateShape = vi.fn();
    const frameBounds = { x: 0, y: 0, w: 800, h: 600 };

    const makeEditor = () => ({
      getShape: (id: string) => {
        if (id === FRAME_ID) {
          return {
            type: 'frame',
            id: FRAME_ID,
            meta: { landiContextGroup: { kind: 'site', id: SITE_ID } },
            props: { w: frameBounds.w, h: frameBounds.h },
          };
        }
        if (id === 'shape:panel:project-brief') {
          return {
            type: 'panel',
            id,
            x: 40,
            y: 40,
            props: { panelId: 'project-brief', w: 280, h: 300, data: {} },
          };
        }
        if (id === 'shape:panel:web-preview') {
          return {
            type: 'panel',
            id,
            x: 340,
            y: 40,
            props: { panelId: 'web-preview', w: 600, h: 400, data: {} },
          };
        }
        return null;
      },
      getSortedChildIdsForParent: () =>
        ['shape:panel:project-brief', 'shape:panel:web-preview'] as never[],
      getShapePageBounds: (id: string) => {
        if (id === FRAME_ID) return frameBounds;
        if (id === 'shape:panel:project-brief') return { x: 40, y: 40, w: 280, h: 300 };
        if (id === 'shape:panel:web-preview') return { x: 340, y: 40, w: 600, h: 400 };
        return null;
      },
      getViewportPageBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      getCurrentPageShapes: () => [],
      getPointInShapeSpace: (_frame: unknown, pt: { x: number; y: number }) => pt,
      run: (fn: () => void) => fn(),
      updateShape,
    });

    const editor = makeEditor();
    autoArrangeSiteContextPanels(editor as never, SITE_ID);
    const firstPreviewW = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:web-preview')?.[0]?.props?.w;

    updateShape.mockClear();
    frameBounds.w = 700;
    frameBounds.h = 500;
    autoArrangeSiteContextPanels(editor as never, SITE_ID);
    const secondPreviewW = updateShape.mock.calls.find(
      (call) => call[0]?.id === 'shape:panel:web-preview')?.[0]?.props?.w;

    expect(firstPreviewW).toBeDefined();
    expect(secondPreviewW).toBeDefined();
    expect(secondPreviewW).toBeGreaterThanOrEqual(firstPreviewW! - 20);
  });
});
