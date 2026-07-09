import { describe, expect, it } from 'vitest';
import type { Editor, TLShape } from 'tldraw';
import {
  getShapeLabel,
  getShapeSearchText,
  searchCanvasText,
} from '../../src/whiteboard/utils/shapeTextUtils';

function createMockEditor(
  shapes: TLShape[],
  getTextByShapeId: Record<string, string | undefined> = {},
): Editor {
  return {
    getCurrentPageShapes: () => shapes,
    getShapeUtil: (shape: TLShape) => ({
      getText: () => getTextByShapeId[shape.id],
    }),
  } as unknown as Editor;
}

describe('searchCanvasText', () => {
  it('returns panel shapes matching query case-insensitively', () => {
    const chatShape = {
      id: 'shape:chat',
      type: 'panel',
      props: {
        panelId: 'chat',
        data: { __title: 'Chat' },
      },
      meta: {},
    } as unknown as TLShape;

    const briefShape = {
      id: 'shape:brief',
      type: 'panel',
      props: {
        panelId: 'project-brief',
        data: { __title: 'Project Brief' },
      },
      meta: {},
    } as unknown as TLShape;

    const editor = createMockEditor([chatShape, briefShape], {
      'shape:chat': 'chat Chat',
      'shape:brief': 'project-brief Project Brief',
    });

    const results = searchCanvasText(editor, 'chat');
    expect(results).toHaveLength(1);
    expect(results[0]?.shapeId).toBe('shape:chat');
    expect(results[0]?.label).toBe('Chat');
  });

  it('matches native tldraw text shapes via ShapeUtil.getText', () => {
    const noteShape = {
      id: 'shape:note',
      type: 'note',
      props: {},
      meta: {},
    } as unknown as TLShape;

    const editor = createMockEditor([noteShape], {
      'shape:note': 'Hello whiteboard',
    });

    const results = searchCanvasText(editor, 'whiteboard');
    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('Hello whiteboard');
  });

  it('returns empty array for blank query', () => {
    const editor = createMockEditor([]);
    expect(searchCanvasText(editor, '   ')).toEqual([]);
  });
});

describe('getShapeSearchText', () => {
  it('falls back to panel props when getText is undefined', () => {
    const shape = {
      id: 'shape:preview',
      type: 'panel',
      props: {
        panelId: 'web-preview',
        data: { __title: 'Preview', siteName: 'Acme Landing' },
      },
      meta: {},
    } as unknown as TLShape;

    const editor = createMockEditor([shape]);
    expect(getShapeSearchText(editor, shape)).toContain('Acme Landing');
    expect(getShapeLabel(editor, shape)).toBe('Preview');
  });
});

describe('getShapeLabel', () => {
  it('title-cases panelId when __title is missing', () => {
    const shape = {
      id: 'shape:fm',
      type: 'panel',
      props: {
        panelId: 'file-manager',
        data: {},
      },
      meta: {},
    } as unknown as TLShape;

    const editor = createMockEditor([shape]);
    expect(getShapeLabel(editor, shape)).toBe('File Manager');
  });
});
