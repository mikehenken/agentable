/**
 * Public scripted-demo surface for gallery pages (P8 northstar draw + see).
 * Uses the same agent tools and fixtures as the Playwright harness — no LLM.
 *
 * Operator-mode scope: gallery steps invoke tool `.handler()` directly
 * for deterministic offline demos. That path intentionally bypasses
 * `canvasTools.executeTool` and operator-mode enforcement; production chat/voice
 * agents must use `executeTool` / `createAgentToolExecutor` instead.
 */
import { withAgentToolContextAsync, getAgentToolContext, type AgentToolExecutionContext } from '../agents/agentContext';
import { withDrawUserMessageAsync } from '../chat/drawIntentContext';
import { AUTHORING_TOOLKIT_TOOLS } from '../agents/tools/authoringToolkitTools';
import { DRAWING_TOOLS } from '../agents/tools/drawingTools';
import { PERCEPTION_TOOLS } from '../agents/tools/perceptionTools';
import { drawAgentShapes } from '../engines/tldraw/agentDrawing/agentDrawingApi';
import { expandWireframeStencil } from '../engines/tldraw/agentDrawing/wireframeStencils';
import { getEditor, inspectBoundEditorStore, openPanelInCanvas, focusPanelInCanvas, bringPanelToFrontInCanvas } from '../engines/tldraw/shapes/panelShapeApi';
import { waitForGalleryWhiteboardReady } from './galleryWhiteboardReady';
import { getFreeCanvasViewportConfig } from '../engines/tldraw/layout/whiteboardChromeInsets';
import { repositionPanelBesideChatIfOverlapping } from '../engines/tldraw/choreography/chatReserved';
import {
  MERIDIAN_GALLERY_DOCUMENT_SHOW_EVENT,
  MERIDIAN_GALLERY_EXPORT_CONFIRMATION_EVENT,
  MERIDIAN_GALLERY_HITL_HIDE_EVENT,
  MERIDIAN_GALLERY_HITL_SHOW_EVENT,
} from './meridian/MeridianGalleryDemoVisuals';
import {
  CHAT_TRANSCRIPT_INJECT_EVENT,
  FIT_AGENT_DRAWING_EVENT,
  OPEN_CHAT_EVENT,
} from '../choreography/constants';
import type { CanvasShapeGraph } from '../engine/canvasPerceptionTypes';
import {
  NORTHSTAR_AGENT,
  NORTHSTAR_FLOW_DIAGRAM,
  NORTHSTAR_SHAPE_BATCH,
} from '../../examples/p8-agent-draw-demo/fixtures/northstarBrand';
import {
  MERIDIAN_AGENT,
  MERIDIAN_DOCUMENT_ID,
  MERIDIAN_PRODUCT_BRIEF_BLOCKS,
  MERIDIAN_PRODUCT_BRIEF_TITLE,
  MERIDIAN_WIREFRAME_FLOW,
  MERIDIAN_WIREFRAME_PLACEMENT,
  MERIDIAN_WIREFRAME_STENCILS,
} from '../../examples/12-open-agent-canvas/fixtures/meridianLabs';
import { DOCUMENT_PANEL_ID } from '../panels/document/types';
import {
  applyBlockOp,
  type BlockOp,
  type DocumentPayload,
} from '../panels/document';
import {
  getMeridianGalleryHostBundle,
  type MeridianGalleryHostBundle,
} from './meridian/meridianGalleryHost';

export const GALLERY_SCRIPTED_TOOL_NAMES = [
  'draw_shapes',
  'read_canvas',
  'clear_agent_drawings',
  'group_shapes',
  'screenshot_canvas',
  'arrange',
] as const;

export type GalleryScriptedToolName = (typeof GALLERY_SCRIPTED_TOOL_NAMES)[number];

export interface GalleryScriptedToolResult {
  ok: boolean;
  toolName: string;
  result?: unknown;
  error?: string;
}

export type NorthstarDemoStep =
  | 'clear'
  | 'draw-flow'
  | 'draw-batch'
  | 'read-canvas'
  | 'full';

export interface NorthstarDemoSummary {
  ok: boolean;
  agentStampedCount: number;
  totalShapes: number;
  agentIds: string[];
}

export type MeridianDemoStep =
  | 'wireframe'
  | 'document'
  | 'export'
  | 'hitl'
  | 'full';

export interface MeridianDemoSummary {
  ok: boolean;
  flowBoxCount: number;
  stencilCount: number;
  totalShapes: number;
}

export interface MeridianDocumentDemoResult {
  ok: boolean;
  panelId: string;
  blockCount: number;
  title: string;
}

export interface MeridianExportDemoResult {
  ok: boolean;
  filename?: string;
  sha256?: string;
  format: 'pdf';
}

export interface MeridianHitlDemoResult {
  ok: boolean;
  pendingBeforeSave: number;
  pendingAfterSave: number;
  saveCompleted: boolean;
  authoringDidNotQueueHitl: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readShapeGraph(result: unknown): CanvasShapeGraph | undefined {
  if (!isRecord(result)) return undefined;
  if (!Array.isArray(result.shapes)) return undefined;
  // Safety: untyped tool-result boundary — the `shapes` array shape was
  // verified above and consumers only read optional per-node fields.
  return result as unknown as CanvasShapeGraph;
}

function summarizeProvenance(graph: CanvasShapeGraph): NorthstarDemoSummary {
  const agentIds = [...new Set(
      graph.shapes.map((node) => node.agentId).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
  const agentStampedCount = graph.shapes.filter((node) => node.agentId !== undefined).length;
  return {
    ok: agentStampedCount > 0,
    agentStampedCount,
    totalShapes: graph.shapes.length,
    agentIds,
  };
}

function findDrawingTool(name: string) {
  return DRAWING_TOOLS.find((entry) => entry.declaration.name === name);
}

function findPerceptionTool(name: string) {
  return PERCEPTION_TOOLS.find((entry) => entry.declaration.name === name);
}

function findAuthoringTool(name: string) {
  return AUTHORING_TOOLKIT_TOOLS.find((entry) => entry.declaration.name === name);
}

function dispatchFitAgentDrawing(agentId: string): void {
  window.dispatchEvent(
    new CustomEvent(FIT_AGENT_DRAWING_EVENT, { detail: { agentId } }));
}

async function waitForLayoutSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 180);
      });
    });
  });
}

function resolveGalleryScriptedAgentContext(): AgentToolExecutionContext {
  const active = getAgentToolContext();
  if (active !== null) {
    return active;
  }
  const whiteboard = document.querySelector('agentable-whiteboard');
  const tenant = whiteboard?.getAttribute('tenant')?.trim() ?? '';
  if (tenant === 'meridian-labs') {
    return MERIDIAN_AGENT;
  }
  return NORTHSTAR_AGENT;
}

function readDrawShapesCreatedIds(result: { result?: unknown }): string[] {
  if (result.result === undefined || typeof result.result !== 'object' || result.result === null) {
    return [];
  }
  const payload = result.result as { createdShapeIds?: unknown };
  return Array.isArray(payload.createdShapeIds)
    ? payload.createdShapeIds.filter((id): id is string => typeof id === 'string'): [];
}

export function countPageShapes(): number {
  const editor = getEditor();
  if (editor === null) return 0;
  return editor.getCurrentPageShapeIds().size;
}

export function verifyDrawShapesPersisted(
  createdShapeIds: readonly string[],
  shapesBeforeDraw: number): {
  ok: boolean;
  store: ReturnType<typeof inspectBoundEditorStore>;
  shapesAfterDraw: number;
} {
  const store = inspectBoundEditorStore(createdShapeIds);
  const shapesAfterDraw = countPageShapes();
  const countIncreased = shapesAfterDraw > shapesBeforeDraw;
  const idsOnCurrentPage =
    store.bound &&
    store.createdFound > 0 &&
    store.createdFound >= createdShapeIds.length;
  const persisted =
    createdShapeIds.length > 0 &&
    idsOnCurrentPage &&
    (countIncreased || shapesAfterDraw >= shapesBeforeDraw);
  return { ok: persisted, store, shapesAfterDraw };
}

export { waitForGalleryWhiteboardReady, settleGalleryWhiteboardAfterChromeMount } from './galleryWhiteboardReady';

export async function runGalleryScriptedTool(
  toolName: GalleryScriptedToolName,
  args: Record<string, unknown> = {},
  options: { drawIntentUserText?: string } = {}): Promise<GalleryScriptedToolResult> {
  if (toolName === 'read_canvas' || toolName === 'screenshot_canvas') {
    const perceptionTool = findPerceptionTool(toolName);
    if (perceptionTool === undefined) {
      return { ok: false, toolName, error: `${toolName} tool unavailable` };
    }
    const agentContext = resolveGalleryScriptedAgentContext();
    const result = await withAgentToolContextAsync(agentContext, () =>
      Promise.resolve(perceptionTool.handler(args)));
    if (!result.ok) {
      return { ok: false, toolName, error: String(result.error ?? `${toolName} failed`) };
    }
    return { ok: true, toolName, result: result.result };
  }

  const authoringTool = findAuthoringTool(toolName);
  if (authoringTool !== undefined) {
    const agentContext = resolveGalleryScriptedAgentContext();
    const result = await withAgentToolContextAsync(agentContext, () =>
      Promise.resolve(authoringTool.handler(args)));
    if (!result.ok) {
      return { ok: false, toolName, error: String(result.error ?? `${toolName} failed`) };
    }
    return { ok: true, toolName, result: result.result };
  }

  const drawTool = findDrawingTool(toolName);
  if (drawTool === undefined) {
    return { ok: false, toolName, error: `${toolName} tool unavailable` };
  }

  const agentContext = resolveGalleryScriptedAgentContext();
  const shapesBeforeDraw = toolName === 'draw_shapes' ? countPageShapes() : 0;
  const runDraw = (): Promise<{ ok: boolean; error?: string; result?: unknown }> =>
    withAgentToolContextAsync(agentContext, () => Promise.resolve(drawTool.handler(args)));
  const result = await (options.drawIntentUserText !== undefined
    ? withDrawUserMessageAsync(options.drawIntentUserText, runDraw): runDraw());
  if (!result.ok) {
    return { ok: false, toolName, error: String(result.error ?? 'tool failed') };
  }

  if (toolName === 'draw_shapes') {
    const createdShapeIds = readDrawShapesCreatedIds(result);
    const immediate = verifyDrawShapesPersisted(createdShapeIds, shapesBeforeDraw);
    if (!immediate.ok) {
      return {
        ok: false,
        toolName,
        error: 'draw_shapes did not persist shapes on the bound whiteboard editor',
        result: {...(typeof result.result === 'object' && result.result !== null ? result.result: {}),
          _store: immediate.store,
          _shapesBeforeDraw: shapesBeforeDraw,
          _shapesAfterDraw: immediate.shapesAfterDraw,
          _verifyPageCount: immediate.shapesAfterDraw,
        },
      };
    }

    await waitForLayoutSettle();
    // Camera fit is dispatched by operator/chat callers after verification.
    // Fitting inside this host wrapper raced persistence hydration on gallery-13.
    return {
      ok: true,
      toolName,
      result: {...(typeof result.result === 'object' && result.result !== null ? result.result: {}),
        _store: immediate.store,
        _shapesBeforeDraw: shapesBeforeDraw,
        _shapesAfterDraw: countPageShapes(),
        _verifyPageCount: immediate.shapesAfterDraw,
      },
    };
  }

  return { ok: true, toolName, result: result.result };
}

export async function runNorthstarGalleryStep(
  step: NorthstarDemoStep): Promise<{
  ok: boolean;
  summary?: NorthstarDemoSummary;
  steps: GalleryScriptedToolResult[];
}> {
  const steps: GalleryScriptedToolResult[] = [];

  const push = (entry: GalleryScriptedToolResult): boolean => {
    steps.push(entry);
    return entry.ok;
  };

  if (step === 'clear') {
    const cleared = push(await runGalleryScriptedTool('clear_agent_drawings', {}));
    return { ok: cleared, summary: { ok: true, agentStampedCount: 0, totalShapes: 0, agentIds: [] }, steps };
  }

  if (step === 'draw-flow') {
    const drew = push(
      await runGalleryScriptedTool('draw_shapes', {
        layout: NORTHSTAR_FLOW_DIAGRAM.layout,
        diagram: NORTHSTAR_FLOW_DIAGRAM.diagram,
        placement: NORTHSTAR_FLOW_DIAGRAM.placement,
        style: { fill: 'solid', color: 'blue', size: 'l' },
      }));
    return { ok: drew, steps };
  }

  if (step === 'draw-batch') {
    const drew = push(
      await runGalleryScriptedTool('draw_shapes', {
        shapes: NORTHSTAR_SHAPE_BATCH.shapes,
      }));
    return { ok: drew, steps };
  }

  if (step === 'read-canvas') {
    const read = await runGalleryScriptedTool('read_canvas', {});
    steps.push(read);
    if (!read.ok) {
      return { ok: false, steps };
    }
    const graph = readShapeGraph(read.result);
    if (graph === undefined) {
      steps.push({ ok: false, toolName: 'read_canvas', error: 'Unexpected payload' });
      return { ok: false, steps };
    }
    const summary = summarizeProvenance(graph);
    return { ok: summary.ok, summary, steps };
  }

  // full scripted demo
  const ready = await waitForGalleryWhiteboardReady();
  if (!ready) {
    steps.push({ ok: false, toolName: 'full', error: 'Whiteboard not ready' });
    return { ok: false, steps };
  }

  push(await runGalleryScriptedTool('clear_agent_drawings', {}));
  const drewFlow = push(
    await runGalleryScriptedTool('draw_shapes', {
      layout: NORTHSTAR_FLOW_DIAGRAM.layout,
      diagram: NORTHSTAR_FLOW_DIAGRAM.diagram,
      placement: NORTHSTAR_FLOW_DIAGRAM.placement,
      style: { fill: 'solid', color: 'blue', size: 'l' },
    }));
  const drewBatch = push(
    await runGalleryScriptedTool('draw_shapes', {
      shapes: NORTHSTAR_SHAPE_BATCH.shapes,
    }));

  dispatchFitAgentDrawing(NORTHSTAR_AGENT.agentId);
  await waitForLayoutSettle();

  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 350);
  });
  dispatchFitAgentDrawing(NORTHSTAR_AGENT.agentId);

  window.dispatchEvent(
    new CustomEvent(CHAT_TRANSCRIPT_INJECT_EVENT, {
      detail: {
        role: 'user',
        text: 'Run the Northstar Atelier draw-and-see demo on the canvas.',
      },
      bubbles: true,
      composed: true,
    }));

  const readStep = await runNorthstarGalleryStep('read-canvas');
  steps.push(...readStep.steps);
  const summary = readStep.summary;
  const ok = drewFlow && drewBatch && (readStep.ok && (summary?.ok ?? false));

  if (ok) {
    window.dispatchEvent(
      new CustomEvent('landi:assistant-message', {
        detail: {
          text: 'Demo complete — the career flow (Client brief → Final delivery) and Northstar provenance marks are on the canvas. Activity log shows each tool step.',
        },
        bubbles: true,
        composed: true,
      }));
    dispatchFitAgentDrawing(NORTHSTAR_AGENT.agentId);
    await waitForLayoutSettle();
  }

  return { ok, summary, steps };
}

/** Strips the deep `readonly` a fixture's `as const` adds; type-level only. */
type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };

function buildMeridianDocumentPayload(): DocumentPayload {
  let blocks: DocumentPayload['blocks'] = [];
  // Safety: the fixture is `as const` (deeply readonly by type only) while
  // DocBlockInput wants mutable arrays; applyBlockOp copies arrays before
  // storing, so widening away readonly never enables observable mutation.
  const inputBlocks =
    MERIDIAN_PRODUCT_BRIEF_BLOCKS as DeepMutable<typeof MERIDIAN_PRODUCT_BRIEF_BLOCKS>;
  for (let index = 0; index < inputBlocks.length; index += 1) {
    const block = inputBlocks[index]!;
    const op: BlockOp = { op: 'insert', index, block };
    blocks = applyBlockOp(blocks, op);
  }
  return {
    documentId: MERIDIAN_DOCUMENT_ID,
    title: MERIDIAN_PRODUCT_BRIEF_TITLE,
    blocks,
  };
}

export type GalleryDemoPhase =
  | 'idle'
  | 'wireframe'
  | 'document'
  | 'export'
  | 'hitl'
  | 'complete';

/** Dwell long enough for Playwright / manual screenshot capture. */
export const MERIDIAN_GALLERY_DEMO_DWELL_MS = 2_500;
export const MERIDIAN_GALLERY_HITL_DWELL_MS = 2_500;

function setGalleryDemoPhase(phase: GalleryDemoPhase): void {
  if (typeof window === 'undefined') return;
  window.__galleryDemoPhase = phase;
}

async function dwellGalleryDemo(ms: number = MERIDIAN_GALLERY_DEMO_DWELL_MS): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function revealMeridianDocumentPanel(options: { dwellMs?: number } = {}): Promise<void> {
  const editor = getEditor();
  if (editor === null) return;

  bringPanelToFrontInCanvas(DOCUMENT_PANEL_ID);
  const viewport = getFreeCanvasViewportConfig(editor);
  repositionPanelBesideChatIfOverlapping(editor, DOCUMENT_PANEL_ID, viewport, true);
  focusPanelInCanvas(DOCUMENT_PANEL_ID, false);
  await waitForLayoutSettle();

  const dwellMs = options.dwellMs ?? MERIDIAN_GALLERY_DEMO_DWELL_MS;
  if (dwellMs > 0) {
    await dwellGalleryDemo(dwellMs);
  }
}

function blockPreviewText(block: DocumentPayload['blocks'][number]): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return block.runs.map((run) => run.text).join('');
    case 'list':
      return block.items.map((item) => item.map((entry) => blockPreviewText(entry)).join(' ')).join(' · ');
    case 'callout':
      return block.runs.map((run) => run.text).join('');
    case 'table':
      return `${block.rows.length} rows`;
    case 'image':
      return block.alt ?? block.assetId;
    case 'pageBreak':
      return 'Page break';
    default: {
      const exhaustive: never = block;
      return String(exhaustive);
    }
  }
}

function showMeridianDocumentGalleryOverlay(document: DocumentPayload): void {
  const blocks = document.blocks.map((block) => ({
    type: block.type,
    preview: blockPreviewText(block),
  }));
  window.dispatchEvent(
    new CustomEvent(MERIDIAN_GALLERY_DOCUMENT_SHOW_EVENT, {
      detail: { title: document.title, blocks },
      bubbles: true,
      composed: true,
    }));
}

function showMeridianHitlGalleryOverlay(actionLabel: string, agentLabel: string): void {
  window.dispatchEvent(
    new CustomEvent(MERIDIAN_GALLERY_HITL_SHOW_EVENT, {
      detail: { actionLabel, agentLabel },
      bubbles: true,
      composed: true,
    }));
}

function hideMeridianHitlGalleryOverlay(): void {
  window.dispatchEvent(new CustomEvent(MERIDIAN_GALLERY_HITL_HIDE_EVENT));
}

function showMeridianExportConfirmation(filename: string, sha256: string): void {
  dispatchMeridianAssistantMessage(
    `PDF exported — ${filename}. Block-model export completed under open policy.`);
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
  window.dispatchEvent(
    new CustomEvent(MERIDIAN_GALLERY_EXPORT_CONFIRMATION_EVENT, {
      detail: { filename, sha256 },
      bubbles: true,
      composed: true,
    }));
}

function dispatchMeridianAssistantMessage(text: string): void {
  window.dispatchEvent(
    new CustomEvent('landi:assistant-message', {
      detail: { text },
      bubbles: true,
      composed: true,
    }));
}

function resolveDocumentPanelSize(): { w: number; h: number } {
  return { w: 560, h: 640 };
}

async function runMeridianWireframeGalleryStep(): Promise<{
  ok: boolean;
  summary?: MeridianDemoSummary;
  steps: GalleryScriptedToolResult[];
}> {
  const steps: GalleryScriptedToolResult[] = [];

  const push = (entry: GalleryScriptedToolResult): boolean => {
    steps.push(entry);
    return entry.ok;
  };

  const ready = await waitForGalleryWhiteboardReady();
  if (!ready) {
    steps.push({ ok: false, toolName: 'wireframe', error: 'Whiteboard not ready' });
    return { ok: false, steps };
  }

  const drawTool = findDrawingTool('draw_shapes');
  const connectTool = AUTHORING_TOOLKIT_TOOLS.find(
    (entry) => entry.declaration.name === 'connect_shapes');

  if (drawTool === undefined || connectTool === undefined) {
    steps.push({ ok: false, toolName: 'wireframe', error: 'draw or connect tool unavailable' });
    return { ok: false, steps };
  }

  const flowRequest = {
    layout: MERIDIAN_WIREFRAME_FLOW.layout,
    diagram: MERIDIAN_WIREFRAME_FLOW.diagram,
    placement: MERIDIAN_WIREFRAME_PLACEMENT,
    style: { fill: 'semi' as const, color: 'violet' as const, size: 'm' as const },
  };

  const flowResult = await withAgentToolContextAsync(MERIDIAN_AGENT, () =>
    Promise.resolve(drawTool.handler(flowRequest)));
  const flowOk = push({
    ok: flowResult.ok === true,
    toolName: 'draw_shapes',
    result: flowResult.ok ? flowResult.result : undefined,
    error: flowResult.ok ? undefined : String(flowResult.error ?? 'flow draw failed'),
  });

  if (flowOk) {
    await waitForLayoutSettle();
    dispatchFitAgentDrawing(MERIDIAN_AGENT.agentId);
  }

  const stencilShapes = MERIDIAN_WIREFRAME_STENCILS.flatMap((entry) =>
    expandWireframeStencil(entry.stencil, entry.geometry, entry.label));
  const stencilBefore = countPageShapes();
  let stencilOk = false;
  try {
    drawAgentShapes(MERIDIAN_AGENT.agentId, stencilShapes);
    stencilOk = countPageShapes() > stencilBefore;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    push({ ok: false, toolName: 'draw_shapes', error: message });
  }

  if (stencilOk) {
    push({
      ok: true,
      toolName: 'draw_shapes',
      result: { added: countPageShapes() - stencilBefore },
    });
    await waitForLayoutSettle();
    dispatchFitAgentDrawing(MERIDIAN_AGENT.agentId);
  } else if (steps.every((entry) => entry.ok)) {
    push({ ok: false, toolName: 'draw_shapes', error: 'stencil batch did not add shapes' });
  }

  const editor = getEditor();
  const geoShapeIds =
    editor === null
      ? []: editor.getCurrentPageShapes().filter((shape) => shape.type === 'geo').slice(0, 2).map((shape) => shape.id);

  if (geoShapeIds.length >= 2) {
    const connectResult = await withAgentToolContextAsync(MERIDIAN_AGENT, () =>
      Promise.resolve(connectTool.handler({
        from: geoShapeIds[0],
        to: geoShapeIds[1],
        kind: 'flow',
        label: 'Meridian flow',
      })));
    push({
      ok: connectResult.ok === true,
      toolName: 'connect_shapes',
      result: connectResult.ok ? connectResult.result : undefined,
      error: connectResult.ok ? undefined : String(connectResult.error ?? 'connect failed'),
    });
  } else {
    push({
      ok: false,
      toolName: 'connect_shapes',
      error: 'insufficient geo shapes for connector',
    });
  }

  dispatchFitAgentDrawing(MERIDIAN_AGENT.agentId);
  await waitForLayoutSettle();

  const totalShapes = countPageShapes();
  const flowBoxCount = MERIDIAN_WIREFRAME_FLOW.diagram.nodes.length;
  const summary: MeridianDemoSummary = {
    ok: flowOk && stencilOk && totalShapes >= flowBoxCount + 2,
    flowBoxCount,
    stencilCount: MERIDIAN_WIREFRAME_STENCILS.length,
    totalShapes,
  };

  const ok = summary.ok && steps.every((entry) => entry.ok);
  if (ok) {
    setGalleryDemoPhase('wireframe');
    await dwellGalleryDemo(900);
  }
  return { ok, summary, steps };
}

export async function runMeridianDocumentGalleryStep(
  bundle?: MeridianGalleryHostBundle): Promise<MeridianDocumentDemoResult> {
  const resolvedBundle = bundle ?? getMeridianGalleryHostBundle();
  if (resolvedBundle === null) {
    const failure: MeridianDocumentDemoResult = {
      ok: false,
      panelId: '',
      blockCount: 0,
      title: MERIDIAN_PRODUCT_BRIEF_TITLE,
    };
    if (typeof window !== 'undefined') {
      window.__meridianDocumentResult = failure;
    }
    return failure;
  }

  setGalleryDemoPhase('document');

  resolvedBundle.engine.tryAttachBoundEditor();
  await resolvedBundle.host.whenReady();

  const agentContext = {
    agentId: MERIDIAN_AGENT.agentId,
    agentLabel: MERIDIAN_AGENT.agentLabel,
  };
  const scope = { contextId: 'workspace', entityId: MERIDIAN_DOCUMENT_ID };
  const builtDocument = buildMeridianDocumentPayload();
  resolvedBundle.documentStore.set(MERIDIAN_DOCUMENT_ID, builtDocument);
  resolvedBundle.host.data.invalidate('workspace.documents', scope);

  const openResult = await resolvedBundle.host.agents.executeTool(
    'open_panel',
    { id: DOCUMENT_PANEL_ID, scope },
    agentContext);

  const panelId =
    openResult.ok &&
    isRecord(openResult.result) &&
    typeof openResult.result.panelId === 'string'
      ? openResult.result.panelId: DOCUMENT_PANEL_ID;

  resolvedBundle.bindPanelDocument(panelId);

  const panelSize = resolveDocumentPanelSize();
  openPanelInCanvas(DOCUMENT_PANEL_ID, {
    focus: true,
    preserveZoom: false,
    assignToSiteGroup: false,
    size: panelSize,
    panelProps: { scope },
    chrome: { title: MERIDIAN_PRODUCT_BRIEF_TITLE },
  });

  await waitForLayoutSettle();
  showMeridianDocumentGalleryOverlay(builtDocument);
  await revealMeridianDocumentPanel();

  const result: MeridianDocumentDemoResult = {
    ok: openResult.ok === true && builtDocument.blocks.length >= 4,
    panelId,
    blockCount: builtDocument.blocks.length,
    title: builtDocument.title,
  };

  if (typeof window !== 'undefined') {
    window.__meridianDocumentResult = result;
  }

  return result;
}

export async function runMeridianExportGalleryStep(
  panelId: string,
  bundle?: MeridianGalleryHostBundle): Promise<MeridianExportDemoResult> {
  const resolvedBundle = bundle ?? getMeridianGalleryHostBundle();
  if (resolvedBundle === null) {
    const failure: MeridianExportDemoResult = { ok: false, format: 'pdf' };
    if (typeof window !== 'undefined') {
      window.__meridianExportResult = failure;
    }
    return failure;
  }

  resolvedBundle.engine.tryAttachBoundEditor();
  await resolvedBundle.host.whenReady();

  setGalleryDemoPhase('export');
  await revealMeridianDocumentPanel({ dwellMs: 400 });

  const exportResult = await resolvedBundle.exportDocument.handler({ panelId, format: 'pdf' });
  const sha256 =
    exportResult.ok && isRecord(exportResult.result) && typeof exportResult.result.sha256 === 'string'
      ? exportResult.result.sha256: undefined;
  const filename =
    exportResult.ok && isRecord(exportResult.result) && typeof exportResult.result.filename === 'string'
      ? exportResult.result.filename: undefined;

  const result: MeridianExportDemoResult = {
    ok: exportResult.ok === true && sha256 !== undefined && sha256.length === 64,
    filename,
    sha256,
    format: 'pdf',
  };

  if (result.ok && filename !== undefined && sha256 !== undefined) {
    showMeridianExportConfirmation(filename, sha256);
    await dwellGalleryDemo(MERIDIAN_GALLERY_DEMO_DWELL_MS);
  }

  if (typeof window !== 'undefined') {
    window.__meridianExportResult = result;
  }

  return result;
}

export async function runMeridianHitlGalleryStep(
  panelId: string,
  builtDocument: DocumentPayload,
  bundle?: MeridianGalleryHostBundle): Promise<MeridianHitlDemoResult> {
  const resolvedBundle = bundle ?? getMeridianGalleryHostBundle();
  if (resolvedBundle === null) {
    const failure: MeridianHitlDemoResult = {
      ok: false,
      pendingBeforeSave: 0,
      pendingAfterSave: 0,
      saveCompleted: false,
      authoringDidNotQueueHitl: false,
    };
    if (typeof window !== 'undefined') {
      window.__meridianHitlResult = failure;
    }
    return failure;
  }

  resolvedBundle.engine.tryAttachBoundEditor();
  await resolvedBundle.host.whenReady();

  setGalleryDemoPhase('hitl');
  await revealMeridianDocumentPanel({ dwellMs: 400 });

  const agentContext = {
    agentId: MERIDIAN_AGENT.agentId,
    agentLabel: MERIDIAN_AGENT.agentLabel,
  };

  const pendingBeforeSave = resolvedBundle.host.approvals.getPendingForAgent(MERIDIAN_AGENT.agentId).length;

  const savePromise = resolvedBundle.host.agents.executeTool(
    'run_panel_action',
    { panelId, actionId: 'save', payload: builtDocument },
    agentContext);

  await waitForLayoutSettle();

  const pendingAfterSave = resolvedBundle.host.approvals.getPendingForAgent(MERIDIAN_AGENT.agentId);
  const pendingQueued =
    pendingAfterSave.length === pendingBeforeSave + 1 &&
    pendingAfterSave[pendingAfterSave.length - 1]?.actionId === 'save';

  if (!pendingQueued) {
    const failure: MeridianHitlDemoResult = {
      ok: false,
      pendingBeforeSave,
      pendingAfterSave: pendingAfterSave.length,
      saveCompleted: false,
      authoringDidNotQueueHitl: pendingBeforeSave === 0,
    };
    if (typeof window !== 'undefined') {
      window.__meridianHitlResult = failure;
    }
    return failure;
  }

  if (pendingAfterSave[pendingAfterSave.length - 1] !== undefined) {
    showMeridianHitlGalleryOverlay('save', MERIDIAN_AGENT.agentLabel);
    await revealMeridianDocumentPanel({ dwellMs: 0 });
    await dwellGalleryDemo(MERIDIAN_GALLERY_HITL_DWELL_MS);
    resolvedBundle.host.approvals.resolve(pendingAfterSave[pendingAfterSave.length - 1]!.id, 'approved');
    hideMeridianHitlGalleryOverlay();
  }

  const saveResult = await savePromise;

  const result: MeridianHitlDemoResult = {
    ok: pendingQueued && saveResult.ok === true,
    pendingBeforeSave,
    pendingAfterSave: pendingAfterSave.length,
    saveCompleted: saveResult.ok === true,
    authoringDidNotQueueHitl: pendingBeforeSave === 0,
  };

  if (result.ok) {
    dispatchMeridianAssistantMessage(
      'Host-data save approved — persistence stays HITL even when canvasPolicy is open.');
  }

  if (typeof window !== 'undefined') {
    window.__meridianHitlResult = result;
  }

  return result;
}

export async function runMeridianGalleryStep(
  step: MeridianDemoStep): Promise<{
  ok: boolean;
  summary?: MeridianDemoSummary;
  steps: GalleryScriptedToolResult[];
  document?: MeridianDocumentDemoResult;
  export?: MeridianExportDemoResult;
  hitl?: MeridianHitlDemoResult;
}> {
  if (step === 'document' || step === 'export' || step === 'hitl') {
    const bundle = getMeridianGalleryHostBundle();
    if (bundle === null) {
      return {
        ok: false,
        steps: [{ ok: false, toolName: step, error: 'Meridian gallery host unavailable' }],
      };
    }

    if (step === 'document') {
      const document = await runMeridianDocumentGalleryStep(bundle);
      return {
        ok: document.ok,
        steps: [{ ok: document.ok, toolName: 'document', result: document }],
        document,
      };
    }

    const builtDocument = buildMeridianDocumentPayload();
    const document =
      window.__meridianDocumentResult ??
      (await runMeridianDocumentGalleryStep(bundle));
    const panelId = document.panelId;

    if (step === 'export') {
      const exportResult = await runMeridianExportGalleryStep(panelId, bundle);
      return {
        ok: exportResult.ok,
        steps: [{ ok: exportResult.ok, toolName: 'export_document', result: exportResult }],
        export: exportResult,
      };
    }

    const hitl = await runMeridianHitlGalleryStep(panelId, builtDocument, bundle);
    return {
      ok: hitl.ok,
      steps: [{ ok: hitl.ok, toolName: 'run_panel_action', result: hitl }],
      hitl,
    };
  }

  const wireframe = await runMeridianWireframeGalleryStep();
  if (step === 'wireframe') {
    return wireframe;
  }

  const bundle = getMeridianGalleryHostBundle();
  if (bundle === null) {
    return {...wireframe,
      ok: false,
      steps: [...wireframe.steps,
        { ok: false, toolName: 'full', error: 'Meridian gallery host unavailable' },
      ],
    };
  }

  const document = await runMeridianDocumentGalleryStep(bundle);
  const exportResult = await runMeridianExportGalleryStep(document.panelId, bundle);
  const builtDocument = buildMeridianDocumentPayload();
  const hitl = await runMeridianHitlGalleryStep(document.panelId, builtDocument, bundle);

  setGalleryDemoPhase('complete');

  const ok =
    wireframe.ok &&
    document.ok &&
    exportResult.ok &&
    hitl.ok &&
    wireframe.steps.every((entry) => entry.ok);

  return {
    ok,
    summary: wireframe.summary,
    steps: wireframe.steps,
    document,
    export: exportResult,
    hitl,
  };
}

declare global {
  interface Window {
    __galleryDemoPhase?: GalleryDemoPhase;
    __meridianDocumentResult?: MeridianDocumentDemoResult;
    __meridianExportResult?: MeridianExportDemoResult;
    __meridianHitlResult?: MeridianHitlDemoResult;
  }
}
