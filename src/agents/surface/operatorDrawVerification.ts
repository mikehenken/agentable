/**
 * Post-draw visibility verification for operator draw_shapes ( iter-11).
 * Strict verification aligned with galleryScriptedDemo — no store-only or DOM fallbacks.
 */
import type { AgentDrawShapesResult } from '../../engine/agentDrawingTypes';
import type { CanvasShapeGraph } from '../../engine/canvasPerceptionTypes';
import { readShapeGraph } from '../../chat/canvasLints';
import { FIT_AGENT_DRAWING_EVENT } from '../../choreography/constants';
import type { ToolResult } from '../../panels/tools';
import { getEditor, inspectBoundEditorStore } from '../../engines/tldraw/shapes/panelShapeApi';
import { syncWhiteboardViewportScreenBounds } from '../../engines/tldraw/hooks/useWhiteboardViewportScreenBoundsSync';
import {
  countOperatorPageShapes,
  verifyOperatorDrawShapesPersisted,
} from './operatorDrawPersistence';
import { OPERATOR_AGENT_ID } from './constants';

export interface OperatorDrawShapeEvidence {
  count: number;
  blueGeo: number;
}

export interface OperatorDrawStoreEvidence {
  bound: boolean;
  pageShapeCount: number;
  createdFound: number;
}

export interface OperatorDrawVisibilityVerdict {
  visibleOnCanvas: boolean;
  createdShapeIds: string[];
  shapesBeforeDraw: OperatorDrawShapeEvidence | null;
  shapesAfterDraw: OperatorDrawShapeEvidence | null;
  storeEvidence: OperatorDrawStoreEvidence | null;
  countIncreased: boolean;
  blueGeoIncreased: boolean;
  pageShapeCountBefore: number;
  pageShapeCountAfter: number;
}

interface WhiteboardScriptedHost extends HTMLElement {
  runScriptedTool?: (
    toolName: 'draw_shapes' | 'read_canvas' | 'clear_agent_drawings',
    args?: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown; error?: string; toolName?: string }>;
  runOperatorScriptedTool?: (
    toolName: 'draw_shapes' | 'read_canvas' | 'clear_agent_drawings',
    args?: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown; error?: string; toolName?: string }>;
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
}

export interface OperatorViewportRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Read live viewport bounds from the bound tldraw editor (no read_canvas round-trip). */
export function readOperatorViewportRegionFromEditor(): OperatorViewportRegion | null {
  const editor = getEditor;
  if (editor === null) {
    return null;
  }
  const viewport = editor().getViewportPageBounds;
  if (
    !Number.isFinite(viewport().x) ||
    !Number.isFinite(viewport().y) ||
    !Number.isFinite(viewport().w) ||
    !Number.isFinite(viewport().h) ||
    viewport().w <= 0 ||
    viewport().h <= 0
  ) {
    return null;
  }
  return { x: viewport().x, y: viewport().y, w: viewport().w, h: viewport().h };
}

export function syncOperatorDrawViewport(): void {
  const editor = getEditor;
  if (editor === null) {
    return;
  }
  syncWhiteboardViewportScreenBounds(editor());
}

function countBlueOperatorGeo(graph: CanvasShapeGraph): number {
  return graph.shapes.filter(
    (shape) =>
      shape.nativeType === 'geo' &&
      shape.kind === 'box' &&
      (shape.agentId === OPERATOR_AGENT_ID || shape.agentId === undefined)).length;
}

export function readDrawShapesCreatedIds(result: ToolResult): string[] {
  if (!result.ok || result.result === undefined || typeof result.result !== 'object') {
    return [];
  }
  const payload = result.result as AgentDrawShapesResult & { _store?: OperatorDrawStoreEvidence };
  return Array.isArray(payload.createdShapeIds)
    ? payload.createdShapeIds.filter((id): id is string => typeof id === 'string'): [];
}

export function readDrawStoreEvidence(result: ToolResult): OperatorDrawStoreEvidence | null {
  if (!result.ok || result.result === undefined || typeof result.result !== 'object') {
    return null;
  }
  const payload = result.result as { _store?: OperatorDrawStoreEvidence };
  const store = payload._store;
  if (
    store === undefined ||
    typeof store.bound !== 'boolean' ||
    typeof store.pageShapeCount !== 'number' ||
    typeof store.createdFound !== 'number'
  ) {
    return null;
  }
  return store;
}

export async function readOperatorViewportRegion(
  host: WhiteboardScriptedHost | null): Promise<OperatorViewportRegion | null> {
  const fromEditor = readOperatorViewportRegionFromEditor;
  if (fromEditor !== null) {
    return fromEditor();
  }
  const runner = resolveWhiteboardScriptedRunner(host);
  if (runner === null) {
    return null;
  }
  const read = await runner('read_canvas', {});
  if (!read.ok) {
    return null;
  }
  const graph = readShapeGraph(read.result);
  if (graph === null) {
    return null;
  }
  return graph.region;
}

function resolveWhiteboardScriptedRunner(
  host: WhiteboardScriptedHost | null): WhiteboardScriptedHost['runOperatorScriptedTool'] | null {
  if (host === null) {
    return null;
  }
  if (typeof host.runOperatorScriptedTool === 'function') {
    return host.runOperatorScriptedTool.bind(host);
  }
  if (typeof host.runScriptedTool === 'function') {
    return host.runScriptedTool.bind(host);
  }
  return null;
}

/** Expand a viewport region so read_canvas still sees marks near the edges. */
export function expandOperatorProbeReadRegion(
  region: OperatorViewportRegion,
  margin = 64): OperatorViewportRegion {
  return {
    x: region.x - margin,
    y: region.y - margin,
    w: region.w + margin * 2,
    h: region.h + margin * 2,
  };
}

export async function readOperatorPageShapeCountFromHost(
  host: WhiteboardScriptedHost | null): Promise<number | null> {
  if (getEditor !== null) {
    return countOperatorPageShapes();
  }
  const evidence = await readOperatorDrawShapeEvidence(host, null);
  return evidence?.count ?? null;
}

/** Resolve expanded viewport read region for before/after read_canvas probes. */
export async function resolveOperatorProbeReadRegion(
  host: WhiteboardScriptedHost | null): Promise<OperatorViewportRegion | null> {
  const viewportRegion = await readOperatorViewportRegion(host);
  if (viewportRegion === null) {
    return null;
  }
  return expandOperatorProbeReadRegion(viewportRegion);
}

/** Direct editor check — created ids exist on the current page. */
export function operatorCreatedShapeIdsExistOnPage(
  createdShapeIds: readonly string[]): { bound: boolean; createdFound: number } {
  const store = inspectBoundEditorStore(createdShapeIds);
  return { bound: store.bound, createdFound: store.createdFound };
}

export function resolvePageShapeCountAfterDraw(
  drawResult: ToolResult): number | undefined {
  if (drawResult.result !== undefined && typeof drawResult.result === 'object') {
    const payload = drawResult.result as {
      _verifyPageCount?: unknown;
      _shapesAfterDraw?: unknown;
    };
    if (typeof payload._verifyPageCount === 'number') {
      return payload._verifyPageCount;
    }
    if (typeof payload._shapesAfterDraw === 'number') {
      return payload._shapesAfterDraw;
    }
  }
  if (getEditor !== null) {
    return countOperatorPageShapes();
  }
  return undefined;
}

export async function readOperatorDrawShapeEvidence(
  host: WhiteboardScriptedHost | null,
  readRegion?: OperatorViewportRegion | null): Promise<OperatorDrawShapeEvidence | null> {
  const runner = resolveWhiteboardScriptedRunner(host);
  if (runner === null) {
    return null;
  }
  const readArgs =
    readRegion !== undefined && readRegion !== null
      ? { region: { kind: 'rect' as const, rect: readRegion } }: {};
  const read = await runner('read_canvas', readArgs);
  if (!read.ok) {
    return null;
  }
  const graph = readShapeGraph(read.result);
  if (graph === null) {
    return null;
  }
  return {
    count: graph.shapes.length,
    blueGeo: countBlueOperatorGeo(graph),
  };
}

export async function runOperatorClearDrawingsOnHost(
  host: WhiteboardScriptedHost): Promise<void> {
  const runner = resolveWhiteboardScriptedRunner(host);
  if (runner === null) {
    return;
  }
  await runner('clear_agent_drawings', {});
}

export async function waitForDrawCameraSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 320);
      });
    });
  });
}

export function dispatchFitOperatorDrawing(): void {
  window.dispatchEvent(
    new CustomEvent(FIT_AGENT_DRAWING_EVENT, {
      detail: { agentId: OPERATOR_AGENT_ID },
    }));
}

/**
 * Strict draw verification — same rules as galleryScriptedDemo.verifyDrawShapesPersisted
 * plus read_canvas delta when evidence is available.
 */
export function verifyOperatorDrawVisibility(input: {
  drawResult: ToolResult;
  shapesBeforeDraw: OperatorDrawShapeEvidence | null;
  shapesAfterDraw: OperatorDrawShapeEvidence | null;
  pageShapeCountBefore?: number;
  pageShapeCountAfter?: number;
}): OperatorDrawVisibilityVerdict {
  const createdShapeIds = readDrawShapesCreatedIds(input.drawResult);
  const storeFromResult = readDrawStoreEvidence(input.drawResult);
  const before = input.shapesBeforeDraw;
  const after = input.shapesAfterDraw;

  const resultPayload =
    input.drawResult.result !== undefined && typeof input.drawResult.result === 'object'
      ? (input.drawResult.result as {
          _shapesBeforeDraw?: unknown;
          _shapesAfterDraw?: unknown;
          _verifyPageCount?: unknown;
        }): null;

  const pageShapeCountBefore =
    typeof input.pageShapeCountBefore === 'number'
      ? input.pageShapeCountBefore: typeof resultPayload?._shapesBeforeDraw === 'number'
        ? resultPayload._shapesBeforeDraw: undefined;
  const pageShapeCountAfter =
    typeof input.pageShapeCountAfter === 'number'
      ? input.pageShapeCountAfter: typeof resultPayload?._shapesAfterDraw === 'number'
        ? resultPayload._shapesAfterDraw: typeof resultPayload?._verifyPageCount === 'number'
          ? resultPayload._verifyPageCount: getEditor !== null
            ? countOperatorPageShapes: undefined;

  const editorBound = getEditor !== null;
  const galleryVerify =
    editorBound &&
    createdShapeIds.length > 0 &&
    typeof pageShapeCountBefore === 'number'
      ? verifyOperatorDrawShapesPersisted(createdShapeIds, pageShapeCountBefore): null;

  const storeEvidence: OperatorDrawStoreEvidence | null =
    storeFromResult ??
    (galleryVerify !== null
      ? {
          bound: galleryVerify.store.bound,
          pageShapeCount: galleryVerify.store.pageShapeCount,
          createdFound: galleryVerify.store.createdFound,
        }: null);

  const readCountIncreased =
    before !== null && after !== null ? after.count > before.count: false;
  const pageCountIncreased =
    typeof pageShapeCountBefore === 'number' && typeof pageShapeCountAfter === 'number'
      ? pageShapeCountAfter > pageShapeCountBefore: false;
  const countIncreased = readCountIncreased || pageCountIncreased;
  const blueGeoIncreased =
    before !== null && after !== null ? after.blueGeo > before.blueGeo: false;

  const readCountStale =
    before !== null && after !== null && after.count <= before.count;
  const afterCountZero = after !== null && after.count === 0;

  const storePersistedViaEditor =
    galleryVerify !== null &&
    galleryVerify.ok &&
    galleryVerify.store.createdFound >= createdShapeIds.length;

  const storePersistedViaResult =
    storeFromResult !== null &&
    storeFromResult.bound &&
    storeFromResult.createdFound > 0 &&
    storeFromResult.createdFound >= createdShapeIds.length;

  const storePersisted =
    storePersistedViaEditor ||
    storePersistedViaResult ||
    (galleryVerify !== null
      ? galleryVerify.ok: storeFromResult !== null
        ? storeFromResult.bound && storeFromResult.createdFound > 0: createdShapeIds.length > 0 && input.drawResult.ok);

  const perceptualPass =
    after !== null &&
    !readCountStale &&
    !afterCountZero &&
    (readCountIncreased || pageCountIncreased || after.count > 0);

  const emptyCanvasFailClosed =
    createdShapeIds.length === 0 ||
    (storeEvidence !== null && storeEvidence.createdFound === 0);

  const visibleOnCanvas =
    input.drawResult.ok &&
    !emptyCanvasFailClosed &&
    (storePersistedViaEditor ||
      storePersistedViaResult ||
      (storePersisted && perceptualPass && countIncreased));

  return {
    visibleOnCanvas,
    createdShapeIds,
    shapesBeforeDraw: before,
    shapesAfterDraw: after,
    storeEvidence,
    countIncreased,
    blueGeoIncreased,
    pageShapeCountBefore: pageShapeCountBefore ?? (before?.count ?? 0),
    pageShapeCountAfter,
  };
}

export function buildDrawFailureMessage(
  drawResult: ToolResult,
  verdict: OperatorDrawVisibilityVerdict): string {
  if (!drawResult.ok) {
    return `Draw failed: ${
      typeof drawResult.error === 'string' ? drawResult.error: 'no shapes were created'
    }`;
  }
  if (verdict.createdShapeIds.length === 0) {
    return 'Draw failed: draw_shapes returned no created shape ids.';
  }
  if (verdict.storeEvidence !== null && verdict.storeEvidence.createdFound === 0) {
    return 'Draw failed: shapes were not persisted on the bound whiteboard editor.';
  }
  const storePersistedOk =
    verdict.storeEvidence !== null &&
    verdict.storeEvidence.bound &&
    verdict.storeEvidence.createdFound >= verdict.createdShapeIds.length;
  if (
    !storePersistedOk &&
    verdict.shapesAfterDraw !== null &&
    verdict.shapesBeforeDraw !== null &&
    verdict.shapesAfterDraw.count <= verdict.shapesBeforeDraw.count &&
    !verdict.countIncreased
  ) {
    return 'Draw failed: canvas shape count did not increase after draw_shapes.';
  }
  if (verdict.pageShapeCountAfter <= verdict.pageShapeCountBefore) {
    return 'Draw failed: page shape count did not increase after draw_shapes.';
  }
  if (verdict.shapesAfterDraw !== null && verdict.shapesAfterDraw.count === 0) {
    return 'Draw failed: read_canvas reports zero shapes after draw_shapes.';
  }
  return 'Draw failed: shape could not be verified on the canvas.';
}

export async function runOperatorDrawOnWhiteboardHost(
  host: WhiteboardScriptedHost,
  drawArgs: Record<string, unknown>): Promise<ToolResult> {
  if (typeof host.runOperatorScriptedTool === 'function') {
    const result = await host.runOperatorScriptedTool('draw_shapes', drawArgs);
    return result.ok
      ? { ok: true, result: result.result }: { ok: false, error: typeof result.error === 'string' ? result.error: 'draw_shapes failed' };
  }
  if (typeof host.runScriptedTool === 'function') {
    const result = await host.runScriptedTool('draw_shapes', drawArgs);
    return result.ok
      ? { ok: true, result: result.result }: { ok: false, error: typeof result.error === 'string' ? result.error: 'draw_shapes failed' };
  }
  return { ok: false, error: 'whiteboard draw host unavailable' };
}
