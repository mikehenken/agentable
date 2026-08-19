/**
 * Agent-presents e2e scenario (`08-agent-presents`).
 * Exercises career trajectory draw, job-economy chart compose, and island walkthrough.
 */
import { vi, type Mock } from 'vitest';
import {
  ARCHIPELAGO_CAREER_TRAJECTORY,
  ARCHIPELAGO_ISLAND_DIAGRAM,
  ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION,
  ARCHIPELAGO_JOB_ECONOMY_CHART,
} from '../../../examples/08-agent-presents/fixtures/archipelagoResorts';
import { bindEngineCapabilities, resetEngineCapabilitiesForTests } from '../../../src/agents/engineBridge';
import { withAgentToolContextAsync } from '../../../src/agents/agentContext';
import { DRAWING_TOOLS } from '../../../src/agents/tools/drawingTools';
import { WALKTHROUGH_TOOLS } from '../../../src/agents/tools/walkthroughTools';
import {
  bindWalkthroughRuntime,
  resetWalkthroughRuntimeForTests,
} from '../../../src/agents/walkthroughBridge';
import { runWalkthrough } from '../../../src/agents/walkthroughRunner';
import { createCameraQueue, resetCameraIntentCounterForTests } from '../../../src/agents/camera';
import { compileDiagramToDrawShapes } from '../../../src/engines/tldraw/agentDrawing/diagramToDrawShapes';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../../src/engines/tldraw/shapes/panelShapeApi';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../../src/panels/host';
import {
  buildComposedChartSpec,
  createChartsPack,
  mergeChartsCatalog,
} from '@agentable/catalog-charts';
import { defaultCatalog } from '../../../src/panels/spec';
import { validateSpec } from '../../../src/panels/spec/validate';
import type { EngineCapabilities } from '../../../src/engine/types';
import type { JsonObject, PanelSpec } from '../../../src/panels/types';
import type { WalkthroughTarget } from '../../../src/agents/walkthroughTypes';

const PLACEMENT_BOUNDS = { x: 120, y: 96, w: 880, h: 620 };

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
  createShape: Mock;
  deleteShapes: Mock;
  __shapes: Map<string, StubShape>;
}

class FakeEngine implements EngineHandle {
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

  openPanel(): void {}
}

function makeCapabilities(): EngineCapabilities {
  return {
    frames: true,
    draw: true,
    minimap: true,
    infinitePan: true,
    nativeSnapshots: true,
  };
}

function makeStubEditor(viewport = PLACEMENT_BOUNDS): StubEditor {
  const shapes = new Map<string, StubShape>();
  let shapeCounter = 0;
  const editor: StubEditor = {
    __shapes: shapes,
    getViewportPageBounds: vi.fn(() => viewport),
    getCurrentPageShapes: vi.fn(() => [...shapes.values()]),
    getShape: vi.fn((id: string) => shapes.get(String(id))),
    getShapePageBounds: vi.fn((id: string) => {
      const shape = shapes.get(String(id));
      if (!shape) return null;
      if (shape.type === 'geo' || shape.type === 'panel') {
        return {
          x: shape.x,
          y: shape.y,
          w: Number(shape.props.w ?? 120),
          h: Number(shape.props.h ?? 80),
        };
      }
      return { x: shape.x, y: shape.y, w: 80, h: 24 };
    }),
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
        shapes.delete(String(id));
      }
    }),
  };
  return editor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotComposedSpec(spec: PanelSpec): string {
  return JSON.stringify({
    origin: spec.origin,
    root: spec.root,
    nodes: spec.nodes,
  });
}

export interface AgentPresentsE2eCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface AgentPresentsE2eResult {
  ok: boolean;
  checks: AgentPresentsE2eCheck[];
}

export async function runAgentPresentsE2eScenario(): Promise<AgentPresentsE2eResult> {
  const checks: AgentPresentsE2eCheck[] = [];

  __resetPanelShapeApiForTests__();
  resetEngineCapabilitiesForTests();
  resetWalkthroughRuntimeForTests();
  resetCameraIntentCounterForTests();
  bindEngineCapabilities(makeCapabilities());

  const editor = makeStubEditor();
  bindEditor(editor as never);

  const chartsPack = createChartsPack();
  const catalog = mergeChartsCatalog(defaultCatalog);
  const host = createCanvasHost({
    engine: new FakeEngine(),
    panels: chartsPack.panels,
    catalog,
  });

  const agentContext = { agentId: 'archipelago-presenter', agentLabel: 'Resort Guide' };

  host.agents.register({
    id: agentContext.agentId,
    kind: 'chat',
    label: agentContext.agentLabel,
    transport: 'chat',
    allowedTools: [
      'draw_shapes',
      'compose_panel',
      'present_walkthrough',
      'open_panel',
      'list_panels',
    ],
    allowedPanels: [...chartsPack.panelIds],
  });

  const drawTool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
  const walkthroughTool = WALKTHROUGH_TOOLS.find(
    (entry) => entry.declaration.name === 'present_walkthrough');

  if (drawTool === undefined || walkthroughTool === undefined) {
    return {
      ok: false,
      checks: [{ name: 'tool registration', ok: false, detail: 'missing draw or walkthrough tool' }],
    };
  }

  let composedSpecSnapshot = '';

  try {
    const trajectoryRequest = {
      layout: ARCHIPELAGO_CAREER_TRAJECTORY.layout,
      diagram: ARCHIPELAGO_CAREER_TRAJECTORY.diagram,
      placement: { kind: 'rect' as const,...PLACEMENT_BOUNDS },
    };

    const compiledTrajectory = compileDiagramToDrawShapes(editor as never, trajectoryRequest);
    const diagramOnly = JSON.stringify(ARCHIPELAGO_CAREER_TRAJECTORY.diagram);
    const hasCoordinatesInDiagram =
      diagramOnly.includes('"x":') || diagramOnly.includes('"y":');

    checks.push({
      name: 'career trajectory renders from logical structure alone',
      ok:
        !hasCoordinatesInDiagram &&
        compiledTrajectory.filter((shape) => shape.kind === 'box').length ===
          ARCHIPELAGO_CAREER_TRAJECTORY.diagram.nodes.length,
      detail: `boxes=${compiledTrajectory.filter((shape) => shape.kind === 'box').length}`,
    });

    const shapesBeforeTrajectory = editor.__shapes.size;
    const trajectoryResult = await withAgentToolContextAsync(agentContext, () =>
      drawTool.handler(trajectoryRequest));
    checks.push({
      name: 'career trajectory draw_shapes succeeds in chat turn',
      ok:
        trajectoryResult.ok &&
        editor.__shapes.size > shapesBeforeTrajectory &&
        (trajectoryResult.ok
          ? (trajectoryResult.result as { layout?: string }).layout === 'timeline': false),
    });

    const chartSpec = buildComposedChartSpec({
      chartType: ARCHIPELAGO_JOB_ECONOMY_CHART.chartType,
      chartProps: ARCHIPELAGO_JOB_ECONOMY_CHART.chartProps,
      title: ARCHIPELAGO_JOB_ECONOMY_CHART.title,
      subtitle: ARCHIPELAGO_JOB_ECONOMY_CHART.subtitle,
    });

    composedSpecSnapshot = snapshotComposedSpec(chartSpec);

    const validation = validateSpec(chartSpec, {
      catalog,
      adapterSources: new Set(chartsPack.adapterSources),
      hostActions: new Set(),
      panelRegistry: new Set(chartsPack.panelIds),
    });

    checks.push({
      name: 'job-economy chart spec validates against merged charts catalog',
      ok: validation.ok && chartSpec.origin === 'agent',
      detail: validation.ok ? undefined: validation.errors.map((e) => e.message).join('; '),
    });

    const composeResult = await host.agents.executeTool(
      'compose_panel',
      { spec: chartSpec, title: ARCHIPELAGO_JOB_ECONOMY_CHART.title, pin: true },
      agentContext);

    checks.push({
      name: 'job-economy chart compose_panel succeeds with pin',
      ok: composeResult.ok && isRecord(composeResult.result) && composeResult.result.ok === true,
      detail: composeResult.ok ? undefined: String(composeResult.error ?? 'compose failed'),
    });

    checks.push({
      name: 'job-economy chart is agent-origin (provenance-badged)',
      ok: chartSpec.origin === 'agent' && chartSpec.nodes.chart?.type === 'chart-bar',
    });

    const islandRequest = {
      layout: ARCHIPELAGO_ISLAND_DIAGRAM.layout,
      diagram: ARCHIPELAGO_ISLAND_DIAGRAM.diagram,
      placement: { kind: 'rect' as const, x: 960, y: 96, w: 720, h: 620 },
    };

    const islandDrawResult = await withAgentToolContextAsync(agentContext, () =>
      drawTool.handler(islandRequest));

    const islandShapeIds =
      islandDrawResult.ok && isRecord(islandDrawResult.result)
        ? (islandDrawResult.result.createdShapeIds as string[] | undefined): undefined;

    checks.push({
      name: 'island journey map draws via radial auto-layout',
      ok:
        islandDrawResult.ok === true &&
        (islandShapeIds?.length ?? 0) >= ARCHIPELAGO_ISLAND_DIAGRAM.diagram.nodes.length,
      detail: `shapeIds=${islandShapeIds?.length ?? 0}`,
    });

    const walkthroughSteps = ARCHIPELAGO_ISLAND_WALKTHROUGH_NARRATION.map((entry) => {
      const shapeId = mapNodeIdToShapeId(editor, entry.nodeId);
      return {
        target: shapeId ?? entry.nodeId,
        say: entry.say,
      };
    });

    const camera = createCameraQueue({ now: () => 10_000 });
    const narrations: string[] = [];

    bindWalkthroughRuntime({
      camera,
      resolveTarget: (target: WalkthroughTarget) => ({
        kind: 'zoomTo',
        rect: { x: 0, y: 0, w: 120, h: 120 },
        inset: 24,
        targetKind: target.kind,
      }),
      applyIntent: () => {},
    });

    const narrationRun = await withAgentToolContextAsync(agentContext, () =>
      walkthroughTool.handler({
        steps: walkthroughSteps.map((step) => ({...step, dwellMs: 0 })),
      }));

    if (narrationRun.ok && isRecord(narrationRun.result)) {
      const payload = narrationRun.result as {
        narrations?: Array<{ say: string }>;
      };
      if (Array.isArray(payload.narrations)) {
        narrations.push(...payload.narrations.map((entry) => entry.say));
      }
    }

    checks.push({
      name: 'island walkthrough narrates scene-by-scene',
      ok:
        narrationRun.ok === true &&
        narrations.length >= 1 &&
        narrations.some((line) => line.includes('Archipelago Resorts') || line.includes('Coral Bay')),
      detail: `narrations=${narrations.length}`,
    });

    let triggerUserCancel: (() => void) | undefined;
    const cancelCamera = createCameraQueue({ now: () => 11_000 });
    const cancelResult = await runWalkthrough({
      agentId: agentContext.agentId,
      steps: walkthroughSteps.slice(0, 3),
      camera: cancelCamera,
      resolveTarget: () => ({ kind: 'zoomTo', rect: { x: 0, y: 0, w: 80, h: 80 } }),
      applyIntent: () => {},
      emitNarration: () => {},
      defaultDwellMs: 200,
      sleep: async (_ms, isCancelled) => {
        triggerUserCancel?.();
        return !isCancelled;
      },
      registerCancelListener: (onCancel) => {
        triggerUserCancel = onCancel;
        return () => {
          triggerUserCancel = undefined;
        };
      },
    });

    checks.push({
      name: 'island walkthrough cedes camera on user input',
      ok:
        cancelResult.cancelled === true &&
        cancelResult.cancelReason === 'user_input' &&
        cancelResult.completedSteps >= 1,
      detail: cancelResult.cancelReason,
    });

    const postDrawSpec = buildComposedChartSpec({
      chartType: ARCHIPELAGO_JOB_ECONOMY_CHART.chartType,
      chartProps: ARCHIPELAGO_JOB_ECONOMY_CHART.chartProps,
      title: ARCHIPELAGO_JOB_ECONOMY_CHART.title,
      subtitle: ARCHIPELAGO_JOB_ECONOMY_CHART.subtitle,
    });

    checks.push({
      name: 'drawing never mutates panel data',
      ok:
        trajectoryResult.ok &&
        islandDrawResult.ok &&
        snapshotComposedSpec(postDrawSpec) === composedSpecSnapshot,
    });
  } finally {
    host.dispose();
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
    resetWalkthroughRuntimeForTests();
    resetCameraIntentCounterForTests();
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function mapNodeIdToShapeId(editor: StubEditor, nodeId: string): string | undefined {
  const node = ARCHIPELAGO_ISLAND_DIAGRAM.diagram.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined) return undefined;

  for (const shape of editor.__shapes.values()) {
    const text =
      typeof shape.props.text === 'string'
        ? shape.props.text: typeof shape.meta.label === 'string'
          ? shape.meta.label: undefined;
    if (text === node.label) {
      return shape.id;
    }
  }

  const boxShapes = [...editor.__shapes.values()].filter((shape) => shape.type === 'geo');
  const index = ARCHIPELAGO_ISLAND_DIAGRAM.diagram.nodes.findIndex((entry) => entry.id === nodeId);
  return boxShapes[index]?.id;
}
