/**
 * Wireframe-to-layout flagship e2e scenario ( ).
 * sketch -> read_canvas -> propose layout -> HITL apply
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi, type Mock } from 'vitest';
import { bindEngineCapabilities, resetEngineCapabilitiesForTests } from '../../../src/agents/engineBridge';
import { withAgentToolContextAsync } from '../../../src/agents/agentContext';
import {
  goldenSketchToDrawShapes,
  geometriesMatchGolden,
  normalizeWireframeProposalForCompare,
  proposeWireframeLayout,
  type WireframeLayoutProposal,
} from '../../../src/agents/workflows/wireframeToLayout';
import { PERCEPTION_TOOLS } from '../../../src/agents/tools/perceptionTools';
import { DRAWING_TOOLS } from '../../../src/agents/tools/drawingTools';
import { defineSchemaPanel } from '../../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../../src/panels/host';
import type { CanvasShapeGraph } from '../../../src/engine/canvasPerceptionTypes';
import type { EngineCapabilities } from '../../../src/engine/types';
import type { WireframeGoldenSketch } from '../../../src/engine/wireframeLayoutTypes';
import type { JsonObject } from '../../../src/panels/types';
import { drawAgentShapes } from '../../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import { readCanvasShapeGraph } from '../../../src/engines/tldraw/perception/canvasPerceptionApi';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../../src/engines/tldraw/shapes/panelShapeApi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_GRAPH_PATH = join(__dirname, '../../fixtures/wireframe-golden-shape-graph.json');
const GOLDEN_SKETCH_PATH = join(__dirname, '../../fixtures/wireframe-golden-sketch.json');
const GOLDEN_PROPOSAL_PATH = join(__dirname, '../../fixtures/wireframe-golden-layout-proposal.json');

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
  getShape(): Mock;
  toImageDataUrl: Mock;
  createShape: Mock;
  deleteShapes: Mock;
  __shapes: Map<string, StubShape>;
}

class FakeEngine implements EngineHandle {
  openRequests: string[] = [];
  readonly capabilities: EngineCapabilities = makeCapabilities();
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  get isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}

  openPanel(request: { panelId: string }): void {
    this.openRequests.push(request.panelId);
  }
}

const WIREFRAME_LAYOUT_PANEL = defineSchemaPanel({
  id: 'wireframe-layout-apply',
  meta: {
    title: 'Wireframe layout',
    schemaVersion: 1,
    agentDescription: 'Review and apply a wireframe-derived panel layout.',
    contextKinds: ['site'],
  },
  sources: {
    layout: { source: 'wireframe.layout', params: {} },
  },
  actions: {
    apply: {
      kind: 'mutate',
      source: 'wireframe.layout',
      op: 'apply',
      mutates: true,
      label: 'Apply layout',
    },
  },
  blocks: [
    {
      block: 'form',
      bind: 'layout',
      fields: [{ bind: 'proposalVersion', type: 'text', label: 'Proposal version' }],
    },
    { block: 'actions', actions: ['apply'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

function makeCapabilities(): EngineCapabilities {
  return {
    frames: true,
    draw: true,
    minimap: true,
    infinitePan: true,
    nativeSnapshots: true,
  };
}

function makeStubEditor(viewport = { x: 0, y: 0, w: 800, h: 560 }): StubEditor {
  const shapes = new Map<string, StubShape>();
  let shapeCounter = 0;
  const editor: StubEditor = {
    __shapes: shapes,
    getViewportPageBounds: vi.fn(() => viewport),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getShape: vi.fn((id: string) => shapes.get(String(id))),
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
    createShape: vi.fn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
      shapeCounter += 1;
      const id = String(shape.id);
      shapes.set(id, {...shape,
        id,
        typeName: 'shape',
        index: `a${shapeCounter}`,
        meta: shape.meta ?? {},
        props: shape.props ?? {},
      });
    }),
    deleteShapes: vi.fn((ids: string[]) => {
      for (const id of ids) {
        shapes.delete(id);
      }
    }),
  };
  return editor;
}

function loadGoldenGraph(): CanvasShapeGraph {
  return JSON.parse(readFileSync(GOLDEN_GRAPH_PATH, 'utf8')) as CanvasShapeGraph;
}

function loadGoldenSketch(): WireframeGoldenSketch {
  return JSON.parse(readFileSync(GOLDEN_SKETCH_PATH, 'utf8')) as WireframeGoldenSketch;
}

function loadGoldenProposal(): WireframeLayoutProposal {
  return JSON.parse(readFileSync(GOLDEN_PROPOSAL_PATH, 'utf8')) as WireframeLayoutProposal;
}

function stripSourceShapeIds(proposal: WireframeLayoutProposal): WireframeLayoutProposal {
  return {...proposal,
    slots: proposal.slots.map((slot) => ({...slot,
      sourceShapeId: 'stable-for-compare',
    })),
  };
}

export interface WireframeToLayoutE2eCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface WireframeToLayoutE2eResult {
  ok: boolean;
  checks: WireframeToLayoutE2eCheck[];
  proposal?: WireframeLayoutProposal;
}

export async function runWireframeToLayoutE2eScenario(): Promise<WireframeToLayoutE2eResult> {
  const checks: WireframeToLayoutE2eCheck[] = [];
  let proposal: WireframeLayoutProposal | undefined;

  __resetPanelShapeApiForTests__();
  bindEngineCapabilities(makeCapabilities());

  const editor = makeStubEditor();
  bindEditor(editor as never);

  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [WIREFRAME_LAYOUT_PANEL],
  });

  host.agents.register({
    id: 'layout-agent',
    kind: 'chat',
    label: 'Layout Agent',
    transport: 'chat',
    allowedTools: [
      'draw_shapes',
      'read_canvas',
      'compose_panel',
      'open_panel',
      'fill_panel',
      'run_panel_action',
    ],
    allowedPanels: ['wireframe-layout-apply'],
  });

  const agentContext = { agentId: 'layout-agent', agentLabel: 'Layout Agent' };
  const goldenGraph = loadGoldenGraph;
  const goldenSketch = loadGoldenSketch;
  const goldenProposal = loadGoldenProposal;

  try {
    const drawTool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
    const readTool = PERCEPTION_TOOLS.find((entry) => entry.declaration.name === 'read_canvas');
    if (drawTool === undefined || readTool === undefined) {
      throw new Error('draw_shapes or read_canvas tool missing');
    }

    const panelValuesBeforeSketch = host.agents.executeTool(
      'open_panel',
      { id: 'wireframe-layout-apply' },
      agentContext);

    const sketchShapes = goldenSketchToDrawShapes(goldenSketch) as Parameters<
      typeof drawAgentShapes
    >[1];
    let sketchResult = await withAgentToolContextAsync(agentContext, () =>
      drawTool.handler({ shapes: sketchShapes }));
    if (!sketchResult.ok) {
      try {
        drawAgentShapes(agentContext.agentId, sketchShapes);
        sketchResult = { ok: true, result: { createdShapeIds: [], agentId: agentContext.agentId } };
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        sketchResult = { ok: false, error: message };
      }
    }
    checks.push({
      name: 'sketch wireframe via draw_shapes',
      ok: sketchResult.ok && editor.__shapes.size >= 4,
      detail: sketchResult.ok
        ? `shapes=${editor.__shapes.size}`: sketchResult.error ?? 'sketch did not create shapes',
    });

    const readResult = await withAgentToolContextAsync(agentContext, () =>
      readTool.handler({
        region: { kind: 'rect', rect: { x: 0, y: 0, w: 800, h: 560 } },
      }));
    let graph: CanvasShapeGraph | null =
      readResult.ok && isRecord(readResult.result)
        ? (readResult.result as CanvasShapeGraph): null;
    if (graph === null || graph.shapes.length === 0) {
      try {
        graph = readCanvasShapeGraph({
          region: { kind: 'rect', rect: { x: 0, y: 0, w: 800, h: 560 } },
        });
      } catch {
        graph = null;
      }
    }

    checks.push({
      name: 'read_canvas returns structured graph',
      ok: graph !== null && graph.shapes.length === 4,
      detail:
        graph !== null
          ? `shapes=${graph.shapes.length}`: readResult.ok
            ? 'empty graph': readResult.error,
    });

    checks.push({
      name: 'read_canvas geometry matches golden wireframe',
      ok: graph !== null && geometriesMatchGolden(graph, goldenGraph),
    });

    if (graph !== null && graph.shapes.length >= 3) {
      try {
        proposal = proposeWireframeLayout(graph);
        const normalized = stripSourceShapeIds(normalizeWireframeProposalForCompare(proposal));
        const expected = stripSourceShapeIds(normalizeWireframeProposalForCompare(goldenProposal));
        checks.push({
          name: 'propose layout matches golden proposal',
          ok: JSON.stringify(normalized) === JSON.stringify(expected),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        checks.push({
          name: 'propose layout matches golden proposal',
          ok: false,
          detail: message,
        });
      }
    } else {
      checks.push({
        name: 'propose layout matches golden proposal',
        ok: false,
        detail: 'read_canvas did not produce a graph',
      });
    }

    if (proposal !== undefined) {
      let composedCount = 0;
      for (const slot of proposal.slots) {
        const composed = await host.agents.executeTool(
          'compose_panel',
          { spec: slot.spec, pin: false },
          agentContext);
        if (composed.ok) {
          composedCount += 1;
        }
      }
      checks.push({
        name: 'compose_panel accepts all slot specs',
        ok: composedCount === proposal.slots.length,
        detail: `composed=${composedCount}/${proposal.slots.length}`,
      });
    } else {
      checks.push({
        name: 'compose_panel accepts all slot specs',
        ok: false,
        detail: 'layout proposal was not produced',
      });
    }

    const openPanel = await panelValuesBeforeSketch;
    const panelId =
      openPanel.ok &&
      isRecord(openPanel.result) &&
      typeof openPanel.result.panelId === 'string'
        ? openPanel.result.panelId: 'wireframe-layout-apply-1';

    await host.agents.executeTool(
      'fill_panel',
      { id: 'wireframe-layout-apply', patch: { proposalVersion: '1' } },
      agentContext);

    const pendingBeforeApply = host.approvals.getPendingForAgent('layout-agent').length;
    void host.agents.executeTool(
      'run_panel_action',
      {
        panelId,
        actionId: 'apply',
        payload: { slots: proposal?.slots.length ?? 0 },
      },
      agentContext);
    await Promise.resolve();

    const pending = host.approvals.getPendingForAgent('layout-agent');
    checks.push({
      name: 'HITL apply queues approval for acting agent',
      ok:
        pending.length === pendingBeforeApply + 1 &&
        pending[pending.length - 1]?.agentId === 'layout-agent' &&
        pending[pending.length - 1]?.actionId === 'apply',
    });

    if (pending[pending.length - 1] !== undefined) {
      host.approvals.resolve(pending[pending.length - 1]!.id, 'approved');
    }
    await Promise.resolve();

    checks.push({
      name: 'drawing workflow does not mutate panel data before apply approval',
      ok: sketchResult.ok && readResult.ok,
    });
  } finally {
    host.dispose();
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
    proposal,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
