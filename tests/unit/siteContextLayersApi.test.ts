/**
 * Unit tests for site context layer listing and visibility controls.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  deleteSiteContextLayer,
  isSiteContextLayerVisible,
  listSiteContextLayers,
  resolveSelectedSiteContextLayerId,
  selectSiteContextLayer,
  toggleSiteContextLayerVisibility,
} from '../../src/whiteboard/context/siteContextLayersApi';
import { contextGroupFrameId } from '../../src/whiteboard/context/contextGroupApi';

vi.mock('tldraw', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tldraw')>();
  return {
    ...actual,
    fitFrameToContent: vi.fn(),
  };
});

interface StubShape {
  id: string;
  type: string;
  opacity?: number;
  parentId: string;
  props: Record<string, unknown>;
}

interface StubEditor {
  getShape: Mock;
  getSortedChildIdsForParent: Mock;
  getSelectedShapeIds: Mock;
  setCurrentTool: Mock;
  select: Mock;
  getShapePageBounds: Mock;
  zoomToBounds: Mock;
  updateShape: Mock;
  deleteShapes: Mock;
  __shapes: Map<string, StubShape>;
}

function makeStubEditor(): StubEditor {
  const shapes = new Map<string, StubShape>();

  const editor: StubEditor = {
    __shapes: shapes,
    getShape: vi.fn((id: string) => shapes.get(id)),
    getSortedChildIdsForParent: vi.fn((parentId: string) =>
      [...shapes.values()]
        .filter((shape) => shape.parentId === parentId)
        .map((shape) => shape.id),
    ),
    getSelectedShapeIds: vi.fn(() => []),
    setCurrentTool: vi.fn(),
    select: vi.fn(),
    getShapePageBounds: vi.fn(() => ({ x: 0, y: 0, w: 100, h: 100 })),
    zoomToBounds: vi.fn(),
    updateShape: vi.fn((patch: { id: string; type: string; opacity?: number }) => {
      const existing = shapes.get(patch.id);
      if (!existing) return;
      shapes.set(patch.id, { ...existing, opacity: patch.opacity });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) {
        shapes.delete(id);
      }
    }),
  };

  return editor;
}

describe('siteContextLayersApi', () => {
  const siteId = 'site-katara';
  let editor: StubEditor;
  let frameId: string;

  beforeEach(() => {
    editor = makeStubEditor();
    frameId = contextGroupFrameId({ kind: 'site', id: siteId });
    editor.__shapes.set(frameId, {
      id: frameId,
      type: 'frame',
      parentId: 'page:page',
      props: { name: 'Katara Veterinarian' },
    });
    editor.__shapes.set('shape:panel:chat', {
      id: 'shape:panel:chat',
      type: 'panel',
      opacity: 1,
      parentId: frameId,
      props: { panelId: 'chat', data: { __title: 'Chat' } },
    });
    editor.__shapes.set('shape:panel:brief', {
      id: 'shape:panel:brief',
      type: 'panel',
      opacity: 0,
      parentId: frameId,
      props: { panelId: 'project-brief', data: { __title: 'Project Brief' } },
    });
  });

  it('isSiteContextLayerVisible treats near-zero opacity as hidden', () => {
    expect(isSiteContextLayerVisible({ opacity: 1 } as never)).toBe(true);
    expect(isSiteContextLayerVisible({ opacity: 0 } as never)).toBe(false);
    expect(isSiteContextLayerVisible({ opacity: 0.02 } as never)).toBe(false);
  });

  it('lists panel children of the site context frame', () => {
    const layers = listSiteContextLayers(editor as never, siteId);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({
      shapeId: 'shape:panel:chat',
      name: 'Chat',
      panelId: 'chat',
      visible: true,
    });
    expect(layers[1]).toMatchObject({
      shapeId: 'shape:panel:brief',
      name: 'Project Brief',
      panelId: 'project-brief',
      visible: false,
    });
  });

  it('returns empty list when site frame is missing', () => {
    editor.__shapes.delete(frameId);
    expect(listSiteContextLayers(editor as never, siteId)).toEqual([]);
  });

  it('toggles visibility via opacity', () => {
    const shapeId = createShapeId('panel:chat');
    editor.__shapes.set(shapeId, {
      id: shapeId,
      type: 'panel',
      opacity: 1,
      parentId: frameId,
      props: { panelId: 'chat', data: {} },
    });

    toggleSiteContextLayerVisibility(editor as never, shapeId);
    expect(editor.updateShape).toHaveBeenCalledWith({
      id: shapeId,
      type: 'panel',
      opacity: 0,
    });

    editor.__shapes.set(shapeId, {
      id: shapeId,
      type: 'panel',
      opacity: 0,
      parentId: frameId,
      props: { panelId: 'chat', data: {} },
    });

    toggleSiteContextLayerVisibility(editor as never, shapeId);
    expect(editor.updateShape).toHaveBeenLastCalledWith({
      id: shapeId,
      type: 'panel',
      opacity: 1,
    });
  });

  it('deletes a layer shape', () => {
    const shapeId = createShapeId('panel:chat');
    editor.__shapes.set(shapeId, {
      id: shapeId,
      type: 'panel',
      opacity: 1,
      parentId: frameId,
      props: { panelId: 'chat', data: {} },
    });

    const deleted = deleteSiteContextLayer(editor as never, shapeId, siteId);
    expect(deleted).toBe(true);
    expect(editor.deleteShapes).toHaveBeenCalledWith([shapeId]);
    expect(editor.__shapes.has(shapeId)).toBe(false);
  });

  it('resolveSelectedSiteContextLayerId returns the first selected listed layer', () => {
    editor.getSelectedShapeIds.mockReturnValue(['shape:panel:brief', 'shape:panel:chat']);
    expect(resolveSelectedSiteContextLayerId(editor as never, siteId)).toBe('shape:panel:brief');
  });

  it('resolveSelectedSiteContextLayerId returns null when selection is outside site layers', () => {
    editor.getSelectedShapeIds.mockReturnValue(['shape:unrelated']);
    expect(resolveSelectedSiteContextLayerId(editor as never, siteId)).toBeNull();
  });

  it('selectSiteContextLayer selects and focuses a listed layer', () => {
    const selected = selectSiteContextLayer(editor as never, 'shape:panel:chat', siteId);
    expect(selected).toBe(true);
    expect(editor.setCurrentTool).toHaveBeenCalledWith('select');
    expect(editor.select).toHaveBeenCalledWith('shape:panel:chat');
    expect(editor.zoomToBounds).toHaveBeenCalled();
  });

  it('selectSiteContextLayer rejects shapes that are not site context layers', () => {
    const selected = selectSiteContextLayer(editor as never, 'shape:unrelated', siteId);
    expect(selected).toBe(false);
    expect(editor.select).not.toHaveBeenCalled();
  });
});
