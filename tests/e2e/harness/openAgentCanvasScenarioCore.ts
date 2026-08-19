/**
 * Shared open-agent-canvas gallery scenario core.
 * Browser-safe — no `vitest`, no `node:crypto` document export imports.
 */
import {
  MERIDIAN_DOCUMENT_ID,
  MERIDIAN_LABS_BRAND,
  MERIDIAN_PRODUCT_BRIEF_BLOCKS,
  MERIDIAN_PRODUCT_BRIEF_TITLE,
  MERIDIAN_WIREFRAME_FLOW,
  MERIDIAN_WIREFRAME_STENCILS,
} from '../../../examples/12-open-agent-canvas/fixtures/meridianLabs';
import { bindEngineCapabilities, resetEngineCapabilitiesForTests } from '../../../src/agents/engineBridge';
import { withAgentToolContextAsync } from '../../../src/agents/agentContext';
import { createDocumentPanelDefinition } from '../../../src/agents/panels/documentPanel';
import { AUTHORING_TOOLKIT_TOOLS } from '../../../src/agents/tools/authoringToolkitTools';
import { DRAWING_TOOLS } from '../../../src/agents/tools/drawingTools';
import { mergeCanvasPolicy } from '../../../src/config/merge';
import { compileDiagramToDrawShapes } from '../../../src/engines/tldraw/agentDrawing/diagramToDrawShapes';
import { drawAgentShapes } from '../../../src/engines/tldraw/agentDrawing/agentDrawingApi';
import { expandWireframeStencil } from '../../../src/engines/tldraw/agentDrawing/wireframeStencils';
import {
  bindEditor,
  __resetPanelShapeApiForTests__,
} from '../../../src/engines/tldraw/shapes/panelShapeApi';
import {
  applyBlockOp,
  clearPersistedDocumentsForTests,
  createDocumentUndoStack,
  createInMemoryDocumentStore,
  createPersistedDocumentStore,
  sanitizePlainText,
  withDocumentSource,
  WORKSPACE_DOCUMENTS_SOURCE,
  type BlockOp,
  type DocumentPayload,
} from '../../../src/panels/document';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../../src/panels/host';
import type { ToolDefinition } from '../../../src/panels/tools';
import {
  containsMarkupOrScript,
  RED_TEAM_INERT_STRINGS,
} from '../../../src/security/codeExecutionBoundary';
import type { DocumentStore } from '../../../src/panels/document/documentAdapter';
import type { EngineCapabilities } from '../../../src/engine/types';
import type { JsonObject } from '../../../src/panels/types';

const PLACEMENT_BOUNDS = { x: 96, y: 64, w: 920, h: 640 };
const PERSISTENCE_KEY = 'p12-t7-open-agent-canvas-gallery';

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
  getViewportPageBounds: () => typeof PLACEMENT_BOUNDS;
  getCurrentPageShapes: () => StubShape[];
  getShapePageBounds: (id: string) => { x: number; y: number; w: number; h: number } | null;
  getShape: (id: string) => StubShape | undefined;
  createShape: (shape: Omit<StubShape, 'typeName' | 'index'>) => void;
  createBinding?: () => undefined;
  deleteShapes: (ids: string[]) => void;
  __shapes: Map<string, StubShape>;
}

function createStubFn<T extends (...args: never[]) => unknown>(impl: T): T {
  return impl;
}

class FakeEngine implements EngineHandle {
  readonly capabilities: EngineCapabilities = makeCapabilities;
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
    getViewportPageBounds: createStubFn(() => viewport),
    getCurrentPageShapes: createStubFn(() => [...shapes.values()]),
    getShape: createStubFn((id: string) => shapes.get(String(id))),
    getShapePageBounds: createStubFn((id: string) => {
      const shape = shapes.get(String(id));
      if (!shape) return null;
      if (shape.type === 'geo' || shape.type === 'panel' || shape.type === 'frame') {
        return {
          x: shape.x,
          y: shape.y,
          w: Number(shape.props.w ?? 120),
          h: Number(shape.props.h ?? 80),
        };
      }
      if (shape.type === 'text') {
        return { x: shape.x, y: shape.y, w: 80, h: 24 };
      }
      if (shape.type === 'arrow') {
        return { x: shape.x, y: shape.y, w: 120, h: 24 };
      }
      return { x: shape.x, y: shape.y, w: 80, h: 24 };
    }),
    createShape: createStubFn((shape: Omit<StubShape, 'typeName' | 'index'>) => {
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
    createBinding: createStubFn(() => undefined),
    deleteShapes: createStubFn((ids: string[]) => {
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

function buildMeridianDocumentPayload(): DocumentPayload {
  let blocks: DocumentPayload['blocks'] = [];
  for (let index = 0; index < MERIDIAN_PRODUCT_BRIEF_BLOCKS.length; index += 1) {
    const block = MERIDIAN_PRODUCT_BRIEF_BLOCKS[index]!;
    const op: BlockOp = { op: 'insert', index, block };
    blocks = applyBlockOp(blocks, op);
  }
  return {
    documentId: MERIDIAN_DOCUMENT_ID,
    title: MERIDIAN_PRODUCT_BRIEF_TITLE,
    blocks,
  };
}

export interface OpenAgentCanvasE2eCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface OpenAgentCanvasE2eResult {
  ok: boolean;
  checks: OpenAgentCanvasE2eCheck[];
  brand: typeof MERIDIAN_LABS_BRAND;
}

export interface OpenAgentCanvasCoreOptions {
  hostActions?: readonly ToolDefinition[];
  usePersistedDocumentStore?: boolean;
  persistenceKey?: string;
  documentStore?: DocumentStore;
  onDocumentReady?: (context: {
    panelId: string;
    builtDocument: DocumentPayload;
  }) => Promise<readonly OpenAgentCanvasE2eCheck[]>;
}

export async function runOpenAgentCanvasScenarioCore(
  options: OpenAgentCanvasCoreOptions = {}): Promise<OpenAgentCanvasE2eResult> {
  const checks: OpenAgentCanvasE2eCheck[] = [];
  const persistenceKey = options.persistenceKey ?? PERSISTENCE_KEY;
  const usePersisted = options.usePersistedDocumentStore !== false;

  const openPolicy = mergeCanvasPolicy({
    tenant: { canvasPolicy: { preset: 'open' } },
  });
  checks.push({
    name: 'gallery host config resolves canvasPolicy open',
    ok: openPolicy.preset === 'open' && openPolicy.hitlOnCompose === false,
    detail: `preset=${openPolicy.preset}, hitlOnCompose=${openPolicy.hitlOnCompose}`,
  });

  __resetPanelShapeApiForTests__();
  resetEngineCapabilitiesForTests();
  bindEngineCapabilities(makeCapabilities());
  if (usePersisted) {
    clearPersistedDocumentsForTests(persistenceKey);
  }

  const editor = makeStubEditor();
  bindEditor(editor as never);

  const emptyDocument: DocumentPayload = {
    documentId: MERIDIAN_DOCUMENT_ID,
    title: MERIDIAN_PRODUCT_BRIEF_TITLE,
    blocks: [],
  };

  const documentStore =
    options.documentStore ??
    (usePersisted
      ? createPersistedDocumentStore({
          persistenceKey,
          seed: { [MERIDIAN_DOCUMENT_ID]: emptyDocument },
        }): createInMemoryDocumentStore({ [MERIDIAN_DOCUMENT_ID]: emptyDocument }));

  const host = createCanvasHost({
    engine: new FakeEngine,
    panels: [createDocumentPanelDefinition],
    adapter: withDocumentSource(documentStore),
    hostActions: options.hostActions ?? [],
  });

  const agentContext = {
    agentId: 'meridian-designer',
    agentLabel: 'Meridian Designer',
  };

  host.agents.register({
    id: agentContext.agentId,
    kind: 'chat',
    label: agentContext.agentLabel,
    transport: 'chat',
    allowedTools: [
      'draw_shapes',
      'insert_image',
      'connect_shapes',
      'group_shapes',
      'frame_shapes',
      'arrange',
      'open_panel',
      'compose_panel',
      'fill_panel',
      'run_panel_action',
    ],
    allowedPanels: ['document'],
  });

  const drawTool = DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes');
  const connectTool = AUTHORING_TOOLKIT_TOOLS.find(
    (entry) => entry.declaration.name === 'connect_shapes');

  if (drawTool === undefined || connectTool === undefined) {
    return {
      ok: false,
      brand: MERIDIAN_LABS_BRAND,
      checks: [{ name: 'tool registration', ok: false, detail: 'missing draw or connect tool' }],
    };
  }

  try {
    const flowRequest = {
      layout: MERIDIAN_WIREFRAME_FLOW.layout,
      diagram: MERIDIAN_WIREFRAME_FLOW.diagram,
      placement: { kind: 'rect' as const,...PLACEMENT_BOUNDS },
    };

    const compiledFlow = compileDiagramToDrawShapes(editor as never, flowRequest);
    const boxCount = compiledFlow.filter((shape) => shape.kind === 'box').length;
    const arrowCount = compiledFlow.filter((shape) => shape.kind === 'arrow').length;

    checks.push({
      name: 'connected wireframe compiles from logical flow diagram',
      ok:
        boxCount === MERIDIAN_WIREFRAME_FLOW.diagram.nodes.length &&
        arrowCount === (MERIDIAN_WIREFRAME_FLOW.diagram.edges?.length ?? 0),
      detail: `boxes=${boxCount}, arrows=${arrowCount}`,
    });

    const shapesBeforeFlow = editor.__shapes.size;
    const flowDrawResult = await withAgentToolContextAsync(agentContext, () =>
      drawTool.handler(flowRequest));
    checks.push({
      name: 'wireframe flow draw_shapes succeeds under open policy',
      ok: flowDrawResult.ok === true && editor.__shapes.size > shapesBeforeFlow,
      detail: flowDrawResult.ok ? `shapes=${editor.__shapes.size}`: flowDrawResult.error,
    });

    const stencilShapes = MERIDIAN_WIREFRAME_STENCILS.flatMap((entry) =>
      expandWireframeStencil(entry.stencil, entry.geometry, entry.label));
    const stencilBefore = editor.__shapes.size;
    try {
      drawAgentShapes(agentContext.agentId, stencilShapes);
      checks.push({
        name: 'wireframe stencils render on canvas',
        ok: editor.__shapes.size > stencilBefore,
        detail: `added=${editor.__shapes.size - stencilBefore}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message: String(err);
      checks.push({ name: 'wireframe stencils render on canvas', ok: false, detail: message });
    }

    const geoShapeIds = [...editor.__shapes.values()].filter((shape) => shape.type === 'geo').slice(0, 2).map((shape) => shape.id);

    if (geoShapeIds.length >= 2) {
      const connectResult = await withAgentToolContextAsync(agentContext, () =>
        connectTool.handler({
          from: geoShapeIds[0],
          to: geoShapeIds[1],
          kind: 'flow',
          label: 'Meridian flow',
        }));
      checks.push({
        name: 'connect_shapes links wireframe regions',
        ok: connectResult.ok === true,
        detail: connectResult.ok ? undefined: connectResult.error,
      });
    } else {
      checks.push({
        name: 'connect_shapes links wireframe regions',
        ok: false,
        detail: 'insufficient geo shapes for connector',
      });
    }

    const pendingBeforeAuthoring = host.approvals.getPendingForAgent(agentContext.agentId).length;

    const openDocument = await host.agents.executeTool(
      'open_panel',
      { id: 'document', scope: { contextId: 'workspace', entityId: MERIDIAN_DOCUMENT_ID } },
      agentContext);
    const panelId =
      openDocument.ok && isRecord(openDocument.result) && typeof openDocument.result.panelId === 'string'
        ? openDocument.result.panelId: 'document-1';

    checks.push({
      name: 'document panel opens for Meridian brief',
      ok: openDocument.ok === true,
      detail: openDocument.ok ? panelId: openDocument.error,
    });

    const builtDocument = buildMeridianDocumentPayload();
    documentStore.set(MERIDIAN_DOCUMENT_ID, builtDocument);

    checks.push({
      name: 'agent builds multi-block document via structured block ops',
      ok: builtDocument.blocks.length >= 4,
      detail: `blocks=${builtDocument.blocks.length}`,
    });

    const redTeamSample = RED_TEAM_INERT_STRINGS[0] ?? '<script>alert(1)</script>';
    const sanitizedRedTeam = sanitizePlainText(redTeamSample);
    checks.push({
      name: 'red-team markup stays inert in document text (G4)',
      ok:
        sanitizedRedTeam.length > 0 &&
        !containsMarkupOrScript(sanitizedRedTeam) &&
        !sanitizedRedTeam.includes('<script'),
      detail: sanitizedRedTeam.slice(0, 48),
    });

    const undoStack = createDocumentUndoStack(builtDocument.blocks);
    const blockCountBeforeUndo = undoStack.blocks.length;
    undoStack.apply({
      op: 'insert',
      index: blockCountBeforeUndo,
      block: {
        id: 'brief-footer',
        type: 'paragraph',
        runs: [{ text: sanitizePlainText(redTeamSample) }],
      },
    });
    const undone = undoStack.undo;
    checks.push({
      name: 'document block ops undo restores prior block list',
      ok: undone !== null && undone.length === blockCountBeforeUndo,
      detail: `blocks=${undone?.length ?? 0}`,
    });

    if (usePersisted) {
      const reloadedStore = createPersistedDocumentStore({ persistenceKey });
      const reloadedDocument = reloadedStore.get(MERIDIAN_DOCUMENT_ID);
      checks.push({
        name: 'persisted document survives store reload ',
        ok:
          reloadedDocument !== undefined &&
          reloadedDocument.blocks.length === builtDocument.blocks.length &&
          reloadedDocument.title === MERIDIAN_PRODUCT_BRIEF_TITLE,
        detail: `blocks=${reloadedDocument?.blocks.length ?? 0}`,
      });
    }

    if (options.onDocumentReady !== undefined) {
      const extraChecks = await options.onDocumentReady({ panelId, builtDocument });
      checks.push(...extraChecks);
    }

    const pendingAfterAuthoring = host.approvals.getPendingForAgent(agentContext.agentId).length;
    checks.push({
      name: 'wireframe and document authoring do not queue HITL under open',
      ok: pendingAfterAuthoring === pendingBeforeAuthoring,
      detail: `pending=${pendingAfterAuthoring}`,
    });

    const savePromise = host.agents.executeTool(
      'run_panel_action',
      { panelId, actionId: 'save', payload: builtDocument },
      agentContext);

    const pendingAfterSave = host.approvals.getPendingForAgent(agentContext.agentId);
    checks.push({
      name: 'host-data save action still queues HITL under open',
      ok:
        pendingAfterSave.length === pendingBeforeAuthoring + 1 &&
        pendingAfterSave[pendingAfterSave.length - 1]?.actionId === 'save' &&
        pendingAfterSave[pendingAfterSave.length - 1]?.source === WORKSPACE_DOCUMENTS_SOURCE,
    });

    if (pendingAfterSave[pendingAfterSave.length - 1] !== undefined) {
      host.approvals.resolve(pendingAfterSave[pendingAfterSave.length - 1]!.id, 'approved');
    }
    const saveResult = await savePromise;
    checks.push({
      name: 'approved host-data save completes after HITL',
      ok: saveResult.ok === true,
      detail: saveResult.ok ? undefined: saveResult.error,
    });

    return {
      ok: checks.every((check) => check.ok),
      checks,
      brand: MERIDIAN_LABS_BRAND,
    };
  } finally {
    if (usePersisted) {
      clearPersistedDocumentsForTests(persistenceKey);
    }
    host.dispose();
    __resetPanelShapeApiForTests__();
    resetEngineCapabilitiesForTests();
  }
}
