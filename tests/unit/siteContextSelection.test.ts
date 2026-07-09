import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  findSiteContextGroupForShape,
  resolveSiteContextFromSelection,
  contextGroupFrameId,
  CONTEXT_META_KEY,
} from '../../src/whiteboard/context/contextGroupApi';

interface StubShape {
  id: string;
  type: string;
  parentId: string;
  props: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

function makeEditor(shapes: Map<string, StubShape>) {
  return {
    getShape: vi.fn((id: string) => shapes.get(id)),
    getSelectedShapeIds: vi.fn((): string[] => []),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveSiteContextFromSelection', () => {
  it('returns site context when site frame is selected', () => {
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-abc' });
    const shapes = new Map<string, StubShape>([
      [
        frameId,
        {
          id: frameId,
          type: 'frame',
          parentId: 'page:page',
          props: { name: 'My Site' },
          meta: { [CONTEXT_META_KEY]: { kind: 'site', id: 'site-abc' } },
        },
      ],
    ]);
    const editor = makeEditor(shapes);
    editor.getSelectedShapeIds = vi.fn(() => [frameId]);

    const result = resolveSiteContextFromSelection(editor as never);
    expect(result).toEqual({
      siteId: 'site-abc',
      frameId,
      label: 'My Site',
    });
  });

  it('returns site context when a panel inside the site group is selected', () => {
    const frameId = contextGroupFrameId({ kind: 'site', id: 'site-abc' });
    const panelId = createShapeId('panel:web-preview');
    const shapes = new Map<string, StubShape>([
      [
        frameId,
        {
          id: frameId,
          type: 'frame',
          parentId: 'page:page',
          props: { name: 'Site frame' },
          meta: { [CONTEXT_META_KEY]: { kind: 'site', id: 'site-abc' } },
        },
      ],
      [
        panelId,
        {
          id: panelId,
          type: 'panel',
          parentId: frameId,
          props: {
            panelId: 'web-preview',
            data: { __siteId: 'site-abc' },
          },
        },
      ],
    ]);
    const editor = makeEditor(shapes);
    editor.getSelectedShapeIds = vi.fn(() => [panelId]);

    const ctx = findSiteContextGroupForShape(editor as never, panelId);
    expect(ctx?.siteId).toBe('site-abc');

    const result = resolveSiteContextFromSelection(editor as never);
    expect(result?.siteId).toBe('site-abc');
  });

  it('returns null when selection is not site-scoped', () => {
    const panelId = createShapeId('panel:chat');
    const shapes = new Map<string, StubShape>([
      [
        panelId,
        {
          id: panelId,
          type: 'panel',
          parentId: 'page:page',
          props: { panelId: 'chat', data: {} },
        },
      ],
    ]);
    const editor = makeEditor(shapes);
    editor.getSelectedShapeIds = vi.fn(() => [panelId]);

    expect(resolveSiteContextFromSelection(editor as never)).toBeNull();
  });
});
