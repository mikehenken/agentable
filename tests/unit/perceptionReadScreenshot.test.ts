/**
 * automated checks: read_canvas shape graph, screenshot_canvas raster,
 * golden wireframe fixture, and vision degradation wiring.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  gateToolsForCapabilities,
  selectOfferedTools,
} from '../../src/agents/capabilities';
import {
  PERCEPTION_TOOLS,
  PERCEPTION_TOOL_NAMES,
} from '../../src/agents/tools/perceptionTools';
import { getFunctionDeclarations, getTool } from '../../src/agents/tools/canvasTools';
import {
  bindEngineCapabilities,
  resetEngineCapabilitiesForTests,
} from '../../src/agents/engineBridge';
import type { ModelCapabilities, ProviderBinding } from '../../src/agents/types';
import type { EngineCapabilities } from '../../src/engine/types';
import { readCanvasShapeGraph, screenshotCanvasRegion, clampPixelRatio } from '../../src/engines/tldraw/perception/canvasPerceptionApi';
import { serializeShapeGraph } from '../../src/engines/tldraw/perception/shapeGraphSerializer';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../src/engines/tldraw/shapes/panelShapeApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, '../fixtures/wireframe-golden-shape-graph.json');

/** Draw-capable engine capabilities: matches the tldraw whiteboard engine these
 * perception tools assume ( adds a separate capability-refusal suite for
 * engines that declare draw: false). */
function drawCapableEngine(): EngineCapabilities {
  return {
    frames: true,
    draw: true,
    minimap: true,
    infinitePan: true,
    nativeSnapshots: true,
  };
}

interface StubShape {
  id: string;
  typeName: 'shape';
  type: string;
  x: number;
  y: number;
  parentId?: string;
  index: string;
  meta: Record<string, unknown>;
  props: Record<string, unknown>;
}

interface StubEditor {
  getViewportPageBounds(): Mock;
  getCurrentPageShapes(): Mock;
  getShapePageBounds(): Mock;
  toImageDataUrl: Mock;
  __shapes: Map<string, StubShape>;
}

const TEXT_ONLY_CAPS: ModelCapabilities = {
  vision: false,
  tools: true,
  contextTokens: 32_000,
  streaming: false,
};

function binding(model: string, caps: ModelCapabilities): ProviderBinding {
  return { providerId: 'mock', model, caps, available: true };
}

function makeStubEditor(viewport = { x: 0, y: 0, w: 800, h: 560 }): StubEditor {
  const shapes = new Map<string, StubShape>();
  const editor: StubEditor = {
    __shapes: shapes,
    getViewportPageBounds: vi.fn(() => viewport),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(id);
      if (!shape) return null;
      if (shape.type === 'geo' || shape.type === 'panel') {
        return {
          x: shape.x,
          y: shape.y,
          w: Number(shape.props.w),
          h: Number(shape.props.h),
        };
      }
      if (shape.type === 'text') {
        return { x: shape.x, y: shape.y, w: 80, h: 24 };
      }
      return { x: shape.x, y: shape.y, w: 1, h: 1 };
    }),
    toImageDataUrl: vi.fn(async () => 'data:image/png;base64,stub'),
  };
  return editor;
}

function seedWireframe(editor: StubEditor): void {
  const entries: Array<Omit<StubShape, 'typeName' | 'meta'>> = [
    {
      id: String(createShapeId('wf-header')),
      type: 'geo',
      x: 40,
      y: 40,
      index: 'a1',
      props: { geo: 'rectangle', w: 720, h: 64 },
    },
    {
      id: String(createShapeId('wf-nav')),
      type: 'geo',
      x: 40,
      y: 120,
      index: 'a2',
      props: { geo: 'rectangle', w: 160, h: 400 },
    },
    {
      id: String(createShapeId('wf-main')),
      type: 'geo',
      x: 220,
      y: 120,
      index: 'a3',
      props: { geo: 'rectangle', w: 540, h: 400 },
    },
    {
      id: String(createShapeId('wf-hero-label')),
      type: 'text',
      x: 240,
      y: 140,
      index: 'a4',
      props: { text: 'Hero' },
    },
  ];

  for (const entry of entries) {
    editor.__shapes.set(entry.id, {...entry,
      typeName: 'shape',
      meta: {},
    });
  }
}

describe('read_canvas golden wireframe ', () => {
  it('serializeShapeGraph reproduces the seeded wireframe exactly', () => {
    const editor = makeStubEditor();
    seedWireframe(editor);

    const graph = serializeShapeGraph({
      shapes: [...editor.__shapes.values()],
      region: { x: 0, y: 0, w: 800, h: 560 },
      getPageBounds: (id) => {
        const bounds = editor.getShapePageBounds(id);
        if (!bounds) return null;
        return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
      },
    });

    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as typeof graph;

    expect(graph.region).toEqual(golden.region);
    expect(graph.shapes).toHaveLength(golden.shapes.length);
    for (let i = 0; i < golden.shapes.length; i += 1) {
      expect(graph.shapes[i]).toEqual(golden.shapes[i]);
    }
  });

  it('readCanvasShapeGraph matches golden via bound editor', () => {
    const editor = makeStubEditor();
    seedWireframe(editor);
    bindEditor(editor as never);

    const graph = readCanvasShapeGraph({
      region: { kind: 'rect', rect: { x: 0, y: 0, w: 800, h: 560 } },
    });

    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    expect(graph.shapes).toEqual(golden.shapes);
  });
});

describe('perception tool registration ', () => {
  it('exposes read_canvas and screenshot_canvas in CANVAS_TOOLS declarations', () => {
    const names = getFunctionDeclarations().map((entry) => entry.name);
    for (const name of PERCEPTION_TOOL_NAMES) {
      expect(names).toContain(name);
      expect(getTool(name)).toBeDefined();
    }
  });

  it('read_canvas handler returns structured graph', async () => {
    bindEngineCapabilities(drawCapableEngine);
    const editor = makeStubEditor();
    seedWireframe(editor);
    bindEditor(editor as never);

    const tool = PERCEPTION_TOOLS.find((entry) => entry.declaration.name === 'read_canvas');
    expect(tool).toBeDefined();
    const result = await tool!.handler({
      region: { kind: 'rect', rect: { x: 0, y: 0, w: 800, h: 560 } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const graph = result.result as { shapes: unknown[] };
    expect(graph.shapes).toHaveLength(4);
    resetEngineCapabilitiesForTests();
  });
});

describe('screenshot_canvas raster capture ', () => {
  let editor: StubEditor;

  beforeEach(() => {
    __resetPanelShapeApiForTests__();
    bindEngineCapabilities(drawCapableEngine);
    editor = makeStubEditor;
    seedWireframe(editor);
    bindEditor(editor as never);
  });

  afterEach(() => {
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  });

  it('returns a PNG data URL for the viewport region', async () => {
    const capture = await screenshotCanvasRegion({ region: { kind: 'viewport' } });
    expect(capture.format).toBe('png');
    expect(capture.dataUrl.startsWith('data:image/png')).toBe(true);
    expect(capture.width).toBeGreaterThan(0);
    expect(capture.height).toBeGreaterThan(0);
    expect(editor.toImageDataUrl).toHaveBeenCalled;
  });

  it('extracts url from tldraw toImageDataUrl object result', async () => {
    editor.toImageDataUrl.mockResolvedValueOnce({
      url: 'data:image/png;base64,tldraw-object-url',
      width: 640,
      height: 448,
    });
    const capture = await screenshotCanvasRegion({ region: { kind: 'viewport' } });
    expect(capture.dataUrl).toBe('data:image/png;base64,tldraw-object-url');
    expect(capture.width).toBe(640);
    expect(capture.height).toBe(448);
  });

  it('clamps fractional pixelRatio and still captures ', async () => {
    const capture = await screenshotCanvasRegion({
      region: { kind: 'viewport' },
      pixelRatio: 0.375560817546181,
    });
    expect(capture.dataUrl.startsWith('data:image/png')).toBe(true);
    expect(editor.toImageDataUrl).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ pixelRatio: 0.375560817546181 }));
  });

  it('falls back to all page shapes when viewport region is empty', async () => {
    editor.getViewportPageBounds().mockReturnValue({ x: 5000, y: 5000, w: 800, h: 560 });
    const capture = await screenshotCanvasRegion({ region: { kind: 'viewport' } });
    expect(capture.dataUrl.startsWith('data:image/png')).toBe(true);
    expect(capture.region.x).toBeLessThan(5000);
    expect(editor.toImageDataUrl).toHaveBeenCalled;
  });

  it('falls back to explicit fallbackShapeIds when region is empty', async () => {
    editor.getViewportPageBounds().mockReturnValue({ x: 5000, y: 5000, w: 800, h: 560 });
    const shapeId = [...editor.__shapes.keys()][0];
    expect(shapeId).toBeDefined();
    const capture = await screenshotCanvasRegion({
      region: { kind: 'viewport' },
      fallbackShapeIds: [shapeId!],
    });
    expect(capture.dataUrl.startsWith('data:image/png')).toBe(true);
    expect(editor.toImageDataUrl).toHaveBeenCalledWith(
      [shapeId],
      expect.objectContaining({ pixelRatio: 1 }));
  });

  it('clampPixelRatio bounds values to 0.25–4', () => {
    expect(clampPixelRatio(0.01)).toBe(0.25);
    expect(clampPixelRatio(0.375560817546181)).toBe(0.375560817546181);
    expect(clampPixelRatio(8)).toBe(4);
    expect(clampPixelRatio(undefined)).toBe(1);
  });

  it('handler surfaces editor errors cleanly', async () => {
    __resetPanelShapeApiForTests__();
    const tool = PERCEPTION_TOOLS.find((entry) => entry.declaration.name === 'screenshot_canvas');
    expect(tool).toBeDefined();
    const result = await tool!.handler({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('canvas editor not bound');
  });
});

describe(' vision degradation for perception tools ', () => {
  it('degrades screenshot_canvas to read_canvas when vision is unavailable', () => {
    const offers = gateToolsForCapabilities(
      PERCEPTION_TOOLS,
      binding('text-only', TEXT_ONLY_CAPS));
    const offered = selectOfferedTools(offers).map((tool) => tool.declaration.name);
    expect(offered).toContain('read_canvas');
    expect(offered).not.toContain('screenshot_canvas');
    expect(
      offers.find((offer) => offer.degradedFrom === 'screenshot_canvas')?.note?.code).toBe('TOOL_DEGRADED');
  });
});
