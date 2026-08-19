/**
 * automated check: pin survives reload.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import {
  PANEL_COMPOSED_EPHEMERAL_KEY,
  PANEL_SPEC_DATA_KEY,
  readPinnedSpec,
} from '../../src/panels/provenance';
import type { PanelSpec } from '../../src/panels/types';
import {
  __resetPanelShapeApiForTests__,
  bindEditor,
  openComposedPanelInCanvas,
  pinPanelInCanvas,
  unbindEditor,
} from '../../src/engines/tldraw/shapes/panelShapeApi';

interface StubShape {
  id: string;
  type: 'panel';
  x: number;
  y: number;
  props: {
    w: number;
    h: number;
    panelId: string;
    minimized: boolean;
    data: Record<string, unknown>;
  };
}

interface StubEditor {
  getShape(): Mock;
  createShape: Mock;
  updateShape: Mock;
  deleteShapes: Mock;
  getShapePageBounds(): Mock;
  getViewportPageBounds(): Mock;
  getCurrentPageShapes(): Mock;
  getSelectedShapeIds(): Mock;
  select: Mock;
  bringToFront: Mock;
  getCamera(): Mock;
  setCamera: Mock;
  zoomToBounds: Mock;
  __shapes: Map<string, StubShape>;
}

function makeStubEditor(): StubEditor {
  const shapes = new Map<string, StubShape>();

  const editor: StubEditor = {
    __shapes: shapes,
    getShape: vi.fn((id: string) => shapes.get(id) ?? undefined),
    createShape: vi.fn((shape: StubShape) => {
      shapes.set(shape.id, shape);
    }),
    updateShape: vi.fn((partial: Partial<StubShape> & { id: string }) => {
      const existing = shapes.get(partial.id);
      if (!existing) return;
      shapes.set(partial.id, {...existing,...partial,
        props: {...existing.props,...(partial.props ?? {}) },
      });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) shapes.delete(id);
    }),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return undefined;
      return { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h };
    }),
    getViewportPageBounds: vi.fn(() => ({ x: 0, y: 0, w: 1200, h: 800 })),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getSelectedShapeIds: vi.fn(() => []),
    select: vi.fn(),
    bringToFront: vi.fn(),
    getCamera: vi.fn(() => ({ x: 0, y: 0, z: 1 })),
    setCamera: vi.fn(),
    zoomToBounds: vi.fn(),
  };

  return editor;
}

const COMPOSED_SPEC: PanelSpec = defineSchemaPanel({
  id: 'composed-seo',
  meta: {
    title: 'Agent SEO',
    schemaVersion: 1,
    agentDescription: 'Agent composed SEO panel',
  },
  sources: {
    seo: { source: 'site.seo' },
  },
  blocks: [{ block: 'header', title: 'Agent draft' }],
}).spec;

describe('pinPanelInCanvas', () => {
  beforeEach(() => {
    __resetPanelShapeApiForTests__();
  });

  it('promotes __composedSpec to __spec and clears ephemeral storage', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as import('tldraw').Editor);

    openComposedPanelInCanvas('composed-1', COMPOSED_SPEC);
    expect(pinPanelInCanvas('composed-1')).toBe(true);

    const shape = editor.__shapes.get('shape:panel:composed-1');
    expect(shape).toBeDefined();
    const data = shape!.props.data;
    expect(data[PANEL_COMPOSED_EPHEMERAL_KEY]).toBeUndefined();
    expect(readPinnedSpec(data)?.origin).toBe('agent');
    expect(data[PANEL_SPEC_DATA_KEY]).toMatchObject({ v: 1, origin: 'agent' });
  });

  it('survives editor unbind/rebind reload', () => {
    const editor = makeStubEditor();
    bindEditor(editor as unknown as import('tldraw').Editor);
    openComposedPanelInCanvas('composed-2', COMPOSED_SPEC);
    pinPanelInCanvas('composed-2');

    const savedData = {...editor.__shapes.get('shape:panel:composed-2')!.props.data };

    unbindEditor();
    __resetPanelShapeApiForTests__();
    const reloaded = makeStubEditor();
    reloaded.createShape({
      id: 'shape:panel:composed-2',
      type: 'panel',
      x: 40,
      y: 40,
      props: {
        w: 480,
        h: 540,
        panelId: 'composed-2',
        minimized: false,
        data: savedData,
      },
    });
    bindEditor(reloaded as unknown as import('tldraw').Editor);

    const restored = reloaded.__shapes.get('shape:panel:composed-2')!.props.data;
    expect(readPinnedSpec(restored)?.root).toBe(COMPOSED_SPEC.root);
    expect(restored.origin).toBe('agent');
    expect(restored[PANEL_COMPOSED_EPHEMERAL_KEY]).toBeUndefined();
  });
});
