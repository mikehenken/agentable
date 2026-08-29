/**
 * P8 agent draw + see interactive demo harness.
 * Scripted draw_shapes / read_canvas — no live LLM or API keys.
 */
import {
  StrictMode,
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { WhiteboardShell } from '../../../src/engines/tldraw/WhiteboardShell';
import { withAgentToolContextAsync } from '../../../src/agents/agentContext';
import { isDrawCapabilityAvailable } from '../../../src/agents/engineBridge';
import { DRAWING_TOOLS } from '../../../src/agents/tools/drawingTools';
import { PERCEPTION_TOOLS } from '../../../src/agents/tools/perceptionTools';
import {
  CHAT_TRANSCRIPT_INJECT_EVENT,
  FIT_AGENT_DRAWING_EVENT,
  OPEN_CHAT_EVENT,
} from '../../../src/choreography/constants';
import { getEditor } from '../../../src/engines/tldraw/shapes/panelShapeApi';
import {
  fitAgentDrawingCamera,
  computeFitZoomForPageBounds,
  isViewportPageBoundsCorrupted,
  resetEditorCameraIfViewportCorrupted,
} from '../../../src/engines/tldraw/agentDrawing/fitAgentDrawingCamera';
import { syncWhiteboardViewportScreenBounds } from '../../../src/engines/tldraw/hooks/useWhiteboardViewportScreenBoundsSync';
import { AGENT_SHAPE_PROVENANCE_META_KEY } from '../../../src/engine/agentDrawingTypes';
import type { CanvasShapeGraph } from '../../../src/engine/canvasPerceptionTypes';
import {
  NORTHSTAR_AGENT,
  NORTHSTAR_BRAND,
  NORTHSTAR_FLOW_DIAGRAM,
  NORTHSTAR_SHAPE_BATCH,
} from '../../../examples/p8-agent-draw-demo/fixtures/northstarBrand';

type DemoStatus = 'idle' | 'running' | 'ok' | 'error';

interface DemoLogEntry {
  id: string;
  title: string;
  status: DemoStatus;
  detail?: string;
  payload?: unknown;
}

interface P8DemoRunSummary {
  ok: boolean;
  agentStampedCount: number;
  totalShapes: number;
  agentIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readShapeGraph(result: unknown): CanvasShapeGraph | undefined {
  if (!isRecord(result)) return undefined;
  if (!Array.isArray(result.shapes)) return undefined;
  return result as CanvasShapeGraph;
}

const NARROW_LAYOUT_MQ = '(max-width: 720px)';

function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_LAYOUT_MQ).matches: false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_LAYOUT_MQ);
    const onChange = (): void => {
      setNarrow(mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return narrow;
}

async function waitForCanvasReady(timeoutMs = 20_000, narrow = false): Promise<boolean> {
  const effectiveTimeout = narrow ? Math.max(timeoutMs, 45_000): timeoutMs;
  const deadline = Date.now() + effectiveTimeout;
  while (Date.now() < deadline) {
    if (isDrawCapabilityAvailable() && getEditor() !== null) {
      return true;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50);
    });
  }
  return false;
}

function readCanvasHostScreenBounds(): { x: number; y: number; w: number; h: number } {
  const viewport = document.querySelector('[data-testid="whiteboard-tldraw-viewport"]');
  if (viewport instanceof HTMLElement) {
    const rect = viewport.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    }
  }
  const host = document.querySelector('[data-testid="p8-canvas-host"]');
  if (host instanceof HTMLElement) {
    const rect = host.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    }
  }
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

function readTldrawViewportScreenBounds(): { x: number; y: number; w: number; h: number } {
  const host = readCanvasHostScreenBounds();
  const editor = getEditor();
  const viewport = editor?.getViewportScreenBounds?.();
  if (viewport !== undefined && viewport.w > 80 && viewport.h > 80) {
    // tldraw screen bounds are client coordinates; prefer host width when aligned.
    return {
      x: host.x,
      y: host.y,
      w: Math.min(viewport.w, host.w),
      h: Math.min(viewport.h, host.h),
    };
  }
  return host;
}

function measureAgentShapeScreenLegibility(agentId: string): {
  agentShapeCount: number;
  legibleCount: number;
  geoNodeCount: number;
  visibleGeoNodeCount: number;
} {
  const editor = getEditor();
  if (editor === null) {
    return { agentShapeCount: 0, legibleCount: 0, geoNodeCount: 0, visibleGeoNodeCount: 0 };
  }
  let agentShapeCount = 0;
  let legibleCount = 0;
  let geoNodeCount = 0;
  let visibleGeoNodeCount = 0;
  const host = readCanvasHostScreenBounds();
  for (const shape of editor.getCurrentPageShapes()) {
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.[AGENT_SHAPE_PROVENANCE_META_KEY] !== agentId) continue;
    agentShapeCount += 1;
    if (shape.type === 'geo') {
      const geoPageBounds = editor.getShapePageBounds(shape.id);
      if (geoPageBounds !== undefined && geoPageBounds.y >= 580) continue;
      geoNodeCount += 1;
      const center = editor.pageToScreen({
        x: geoPageBounds!.x + geoPageBounds!.w / 2,
        y: geoPageBounds!.y + geoPageBounds!.h / 2,
      });
      if (isCentroidInsideHost(center.x, center.y, host)) {
        visibleGeoNodeCount += 1;
        legibleCount += 1;
      }
    }
  }

  const domTimeline = measureFlowTimelineDomLegibility();
  if (geoNodeCount < 4) {
    geoNodeCount = domTimeline.geoNodeCount;
  }
  visibleGeoNodeCount = Math.max(visibleGeoNodeCount, domTimeline.visibleGeoNodeCount);
  legibleCount = Math.max(legibleCount, visibleGeoNodeCount);

  return { agentShapeCount, legibleCount, geoNodeCount, visibleGeoNodeCount };
}

async function waitForShapeLayoutSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.setTimeout(resolve, 200);
          });
        });
      });
    });
  });
}

function frameAgentFlowGeoBounds(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const flowGeos: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.[AGENT_SHAPE_PROVENANCE_META_KEY] !== agentId) continue;
    if (shape.type !== 'geo') continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (bounds === undefined) continue;
    // Exclude branded batch box below the timeline stack.
    if (bounds.y >= 580) continue;
    flowGeos.push({
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.w,
      maxY: bounds.y + bounds.h,
    });
  }
  if (flowGeos.length < 4) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of flowGeos) {
    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function frameAgentGeoBounds(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  return frameAgentFlowGeoBounds(editor, agentId);
}

const FLOW_NODE_LABELS = [
  'Client brief',
  'Moodboard',
  'Concept sketches',
  'Final delivery',
] as const;

interface ScreenCentroid {
  x: number;
  y: number;
  source: 'dom-geo' | 'dom-label' | 'page';
  shapeId?: string;
  label?: string;
}

function isCentroidInsideHost(
  cx: number,
  cy: number,
  host: { x: number; y: number; w: number; h: number },
  tolerancePx = 12): boolean {
  return (
    cx >= host.x - tolerancePx &&
    cx <= host.x + host.w + tolerancePx &&
    cy >= host.y - tolerancePx &&
    cy <= host.y + host.h + tolerancePx
  );
}

function listFlowGeoShapeIds(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string): string[] {
  const geos: Array<{ id: string; pageY: number }> = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.[AGENT_SHAPE_PROVENANCE_META_KEY] !== agentId) continue;
    if (shape.type !== 'geo') continue;
    const bounds = editor.getShapePageBounds(shape.id);
    if (bounds === undefined || bounds.y >= 580) continue;
    geos.push({ id: shape.id, pageY: bounds.y });
  }
  geos.sort((a, b) => a.pageY - b.pageY);
  return geos.map((entry) => entry.id);
}

function collectFlowLabelDomCentroids(): ScreenCentroid[] {
  const centroids: ScreenCentroid[] = [];
  for (const label of FLOW_NODE_LABELS) {
    const el = findFlowLabelElement(label);
    if (el === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 10) continue;
    centroids.push({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      source: 'dom-label',
      label,
    });
  }
  if (centroids.length >= 2) {
    const xs = centroids.map((c) => c.x);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    if (spreadX < 4) {
      return [];
    }
  }
  return centroids;
}

function collectFlowPageCentroids(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string): ScreenCentroid[] {
  const centroids: ScreenCentroid[] = [];
  for (const shapeId of listFlowGeoShapeIds(editor, agentId)) {
    const pageBounds = editor.getShapePageBounds(shapeId);
    if (pageBounds === undefined) continue;
    const pageCenter = editor.pageToScreen({
      x: pageBounds.x + pageBounds.w / 2,
      y: pageBounds.y + pageBounds.h / 2,
    });
    centroids.push({
      x: pageCenter.x,
      y: pageCenter.y,
      source: 'page',
      shapeId,
    });
  }
  return centroids.slice(0, 4);
}

function collectFlowGeoScreenCentroids(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string): ScreenCentroid[] {
  const labelCentroids = collectFlowLabelDomCentroids();
  if (labelCentroids.length >= 4) {
    return labelCentroids;
  }
  return collectFlowPageCentroids(editor, agentId);
}

function findFlowLabelElement(label: string): Element | null {
  const host = document.querySelector('[data-testid="p8-canvas-host"]');
  const scope = host ?? document.querySelector('[data-testid="whiteboard-tldraw-viewport"]');
  if (scope === null) return null;
  const candidates = Array.from(
    scope.querySelectorAll('.tl-shape p,.tl-shape span, svg text,.tl-text-content')).filter((el) => el.textContent?.trim() === label && el.children.length === 0);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width >= 40 && rect.height >= 12) {
      return el;
    }
  }
  return candidates[0] ?? null;
}

/** Geo container + label DOM legibility — prefer visible label DOM over pageToScreen. */
function measureFlowTimelineDomLegibility(): {
  visibleGeoNodeCount: number;
  geoNodeCount: number;
} {
  const host = readCanvasHostScreenBounds();
  const labelCentroids = collectFlowLabelDomCentroids();
  if (labelCentroids.length >= 4) {
    const visibleGeoNodeCount = labelCentroids.filter((c) =>
      isCentroidInsideHost(c.x, c.y, host)).length;
    return { visibleGeoNodeCount, geoNodeCount: FLOW_NODE_LABELS.length };
  }

  const editor = getEditor();
  if (editor !== null) {
    const centroids = collectFlowGeoScreenCentroids(editor, NORTHSTAR_AGENT.agentId);
    const visibleGeoNodeCount = centroids.filter((c) =>
      isCentroidInsideHost(c.x, c.y, host)).length;
    if (centroids.length >= 4) {
      return { visibleGeoNodeCount, geoNodeCount: FLOW_NODE_LABELS.length };
    }
  }

  let visibleGeoNodeCount = 0;
  for (const label of FLOW_NODE_LABELS) {
    const el = findFlowLabelElement(label);
    if (el === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 12) continue;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    if (isCentroidInsideHost(cx, cy, host)) {
      visibleGeoNodeCount += 1;
    }
  }

  return { visibleGeoNodeCount, geoNodeCount: FLOW_NODE_LABELS.length };
}

interface CameraLoopAttempt {
  attempt: number;
  visibleCount: number;
  centroidCount: number;
  host: { x: number; y: number; w: number; h: number };
  centroids: ScreenCentroid[];
  camera: { x: number; y: number; z: number };
  action: 'pan' | 'zoom-out' | 'fit-page' | 'done';
}

function fitCameraToGeoCentroidsLoop(
  editor: NonNullable<ReturnType<typeof getEditor>>,
  agentId: string,
  maxIterations = 20): { success: boolean; attempts: CameraLoopAttempt[] } {
  const attempts: CameraLoopAttempt[] = [];
  const host = readCanvasHostScreenBounds();
  const margin = 32;
  const bounds = frameAgentGeoBounds(editor, agentId);
  const minZoom =
    bounds !== null
      ? computeFitZoomForPageBounds(bounds, {
          w: host.w,
          h: Math.max(host.h - TOOLBAR_CLEARANCE_PX, 120),
        }, { toolbarClearancePx: TOOLBAR_CLEARANCE_PX }): 0.35;

  for (let attempt = 0; attempt < maxIterations; attempt += 1) {
    syncWhiteboardViewportScreenBounds(editor);
    const centroids = collectFlowPageCentroids(editor, agentId);
    const visibleCount = centroids.filter((c) => isCentroidInsideHost(c.x, c.y, host)).length;
    const camera = editor.getCamera();

    if (centroids.length >= 4 && visibleCount >= 4) {
      attempts.push({
        attempt,
        visibleCount,
        centroidCount: centroids.length,
        host,
        centroids,
        camera: { x: camera.x, y: camera.y, z: camera.z },
        action: 'done',
      });
      return { success: true, attempts };
    }

    if (centroids.length < 4 && attempt === 0 && bounds !== null) {
      fitAgentDrawingCamera(editor, bounds, {
        toolbarClearancePx: TOOLBAR_CLEARANCE_PX,
        screen: readTldrawViewportScreenBounds(),
      });
      attempts.push({
        attempt,
        visibleCount,
        centroidCount: centroids.length,
        host,
        centroids,
        camera: { x: camera.x, y: camera.y, z: camera.z },
        action: 'fit-page',
      });
      continue;
    }

    if (centroids.length === 0) {
      attempts.push({
        attempt,
        visibleCount,
        centroidCount: 0,
        host,
        centroids,
        camera: { x: camera.x, y: camera.y, z: camera.z },
        action: 'fit-page',
      });
      break;
    }

    const minCx = Math.min(...centroids.map((c) => c.x));
    const maxCx = Math.max(...centroids.map((c) => c.x));
    const minCy = Math.min(...centroids.map((c) => c.y));
    const maxCy = Math.max(...centroids.map((c) => c.y));
    const bboxCx = (minCx + maxCx) / 2;
    const bboxCy = (minCy + maxCy) / 2;
    const hostCx = host.x + host.w / 2;
    const hostCy = host.y + (host.h - TOOLBAR_CLEARANCE_PX) / 2;

    const panScreenX = bboxCx - hostCx;
    const panScreenY = bboxCy - hostCy;
    const panDampening = 0.55;

    let action: CameraLoopAttempt['action'] = 'pan';
    let nextCamera = {
      x: camera.x - panScreenX * camera.z * panDampening,
      y: camera.y - panScreenY * camera.z * panDampening,
      z: Math.max(camera.z, minZoom),
    };

    const spreadW = Math.max(maxCx - minCx, 80) + margin * 2;
    const spreadH = Math.max(maxCy - minCy, 80) + margin * 2 + TOOLBAR_CLEARANCE_PX;
    const neededW = host.w - margin * 2;
    const neededH = host.h - margin * 2;
    if (spreadW > neededW || spreadH > neededH) {
      const zoomFitX = neededW / spreadW;
      const zoomFitY = neededH / spreadH;
      const zoomScale = Math.min(zoomFitX, zoomFitY);
      const nextZ = Math.max(minZoom, camera.z * zoomScale);
      if (nextZ < camera.z * 0.98) {
        action = 'zoom-out';
        nextCamera = {
          x: camera.x - panScreenX * nextZ,
          y: camera.y - panScreenY * nextZ,
          z: nextZ,
        };
      }
    }

    editor.setCamera(nextCamera, { animation: { duration: 0 } });
    attempts.push({
      attempt,
      visibleCount,
      centroidCount: centroids.length,
      host,
      centroids,
      camera: { x: camera.x, y: camera.y, z: camera.z },
      action,
    });
  }

  const finalCentroids = collectFlowPageCentroids(editor, agentId);
  const finalVisible = finalCentroids.filter((c) => isCentroidInsideHost(c.x, c.y, host)).length;
  return { success: finalVisible >= 4, attempts };
}

async function clearHarnessIndexedDbPersistence(): Promise<void> {
  const marker = 'agentable-canvas-northstar-atelier-p8-agent-draw-demo';
  if (typeof indexedDB.databases !== 'function') {
    return;
  }
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map((db) => db.name).filter((name): name is string => typeof name === 'string' && name.includes(marker)).map(
          (name) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })));
  } catch {
    // Non-fatal for harness runs.
  }
}

const TOOLBAR_CLEARANCE_PX = 96;

function nudgeCameraForDomTimelineLegibility(
  editor: NonNullable<ReturnType<typeof getEditor>>): void {
  const host = readCanvasHostScreenBounds();
  const viewBottom = host.y + host.h;
  const viewTop = host.y;
  let overflowBottomPx = 0;
  let overflowTopPx = 0;

  for (const label of FLOW_NODE_LABELS) {
    const el = findFlowLabelElement(label);
    if (el === null) continue;
    const rect = el.getBoundingClientRect();
    const cy = rect.y + rect.height / 2;
    if (cy > viewBottom) {
      overflowBottomPx = Math.max(overflowBottomPx, cy - viewBottom + 12);
    }
    if (cy < viewTop) {
      overflowTopPx = Math.max(overflowTopPx, viewTop - cy + 12);
    }
  }

  const panScreenPx = overflowBottomPx - overflowTopPx;
  if (Math.abs(panScreenPx) < 1) {
    return;
  }
  const camera = editor.getCamera();
  editor.setCamera(
    { x: camera.x, y: camera.y - panScreenPx * camera.z, z: camera.z },
    { animation: { duration: 0 } });
}

function dispatchShellAgentFit(agentId: string): void {
  window.dispatchEvent(
    new CustomEvent(FIT_AGENT_DRAWING_EVENT, { detail: { agentId } }));
}

function isCameraStateCorrupted(editor: NonNullable<ReturnType<typeof getEditor>>): boolean {
  const viewport = editor.getViewportPageBounds();
  const camera = editor.getCamera();
  if (
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.z)
  ) {
    return true;
  }
  return (
    isViewportPageBoundsCorrupted(viewport) ||
    Math.abs(camera.y) > 10_000 ||
    camera.z <= 0 ||
    camera.z > 8
  );
}

function resetEditorCameraIfCorrupted(
  editor: NonNullable<ReturnType<typeof getEditor>>): void {
  resetEditorCameraIfViewportCorrupted(editor);
  if (isCameraStateCorrupted(editor)) {
    editor.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 0 } });
  }
}

async function fitCanvasToAgentDrawings(agentId: string): Promise<boolean> {
  const editor = getEditor();
  if (editor === null) {
    window.__p8AgentDrawDemoCanvasLegible = false;
    return false;
  }

  resetEditorCameraIfCorrupted(editor);
  syncWhiteboardViewportScreenBounds(editor);
  await waitForShapeLayoutSettle();

  const bounds = frameAgentGeoBounds(editor, agentId);
  if (bounds === null) {
    window.__p8AgentDrawDemoCanvasLegible = false;
    return false;
  }

  dispatchShellAgentFit(agentId);
  await waitForShapeLayoutSettle();

  syncWhiteboardViewportScreenBounds(editor);
  fitAgentDrawingCamera(editor, bounds, {
    toolbarClearancePx: TOOLBAR_CLEARANCE_PX,
    screen: readTldrawViewportScreenBounds(),
  });
  await waitForShapeLayoutSettle();

  const cameraLoop = fitCameraToGeoCentroidsLoop(editor, agentId, 8);
  window.__p8AgentDrawDemoCameraLoopLog = cameraLoop.attempts;
  await waitForShapeLayoutSettle();

  let domTimeline = measureFlowTimelineDomLegibility();
  if (!cameraLoop.success) {
    for (let nudgeAttempt = 0; nudgeAttempt < 6 && domTimeline.visibleGeoNodeCount < 4; nudgeAttempt += 1) {
      nudgeCameraForDomTimelineLegibility(editor);
      await waitForShapeLayoutSettle();
      domTimeline = measureFlowTimelineDomLegibility();
    }
  }

  const metrics = measureAgentShapeScreenLegibility(agentId);

  const legible =
    domTimeline.geoNodeCount >= 4 &&
    domTimeline.visibleGeoNodeCount >= 4 &&
    metrics.legibleCount >= 4;
  window.__p8AgentDrawDemoCanvasLegible = legible;
  window.__p8AgentDrawDemoLegibility = metrics;

  const dump: Array<Record<string, unknown>> = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const meta = shape.meta as Record<string, unknown> | undefined;
    if (meta?.[AGENT_SHAPE_PROVENANCE_META_KEY] !== agentId) continue;
    const pageBounds = editor.getShapePageBounds(shape.id);
    const topLeft = pageBounds
      ? editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y }): null;
    const bottomRight = pageBounds
      ? editor.pageToScreen({
          x: pageBounds.x + pageBounds.w,
          y: pageBounds.y + pageBounds.h,
        }): null;
    dump.push({
      type: shape.type,
      pageBounds,
      screen: topLeft && bottomRight
        ? {
            x: topLeft.x,
            y: topLeft.y,
            w: Math.abs(bottomRight.x - topLeft.x),
            h: Math.abs(bottomRight.y - topLeft.y),
          }: null,
    });
  }
  window.__p8AgentDrawDemoShapeDump = {
    zoom: editor.getZoomLevel(),
    viewport: editor.getViewportPageBounds(),
    centroids: collectFlowGeoScreenCentroids(editor, agentId),
    shapes: dump,
  };
  return legible;
}

function notifyScriptedToolRun(name: string, summary: string, ok: boolean): void {
  window.dispatchEvent(
    new CustomEvent('landi:tool-call', {
      detail: {
        name,
        args: { _demoSummary: summary },
        ok,
        source: 'p8-scripted-demo',
        timestamp: new Date().toISOString(),
      },
      bubbles: true,
      composed: true,
    }));
}

function summarizeProvenance(graph: CanvasShapeGraph): P8DemoRunSummary {
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

function DemoErrorBoundary({ children }: { children: ReactNode }): ReactElement {
  const [error, setError] = useState<string | null>(null);

  if (error !== null) {
    return (
      <div style={{ padding: '1.5rem', color: '#fecaca', background: '#450a0a' }}>
        <h1 style={{ marginTop: 0 }}>P8 demo failed to mount</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return (
    <DemoErrorBoundaryInner onError={setError}>{children}</DemoErrorBoundaryInner>
  );
}

class DemoErrorBoundaryInner extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (message: string) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(`${error.message}\n${info.componentStack ?? ''}`);
    window.__galleryReady = { example: 'p8-agent-draw-demo', ok: false };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function P8AgentDrawDemoApp(): ReactElement {
  const [logs, setLogs] = useState<DemoLogEntry[]>([]);
  const [summary, setSummary] = useState<P8DemoRunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [useBoundedFallback, setUseBoundedFallback] = useState(true);
  const narrow = useNarrowLayout();
  const canvasMainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.__galleryReady = { example: 'p8-agent-draw-demo', ok: true };
    window.__p8AgentDrawDemoCanvasLegible = false;
    window.__p8AgentDrawDemoChatSettled = false;
    void clearHarnessIndexedDbPersistence();
  }, []);

  const drawTool = useMemo(() => DRAWING_TOOLS.find((entry) => entry.declaration.name === 'draw_shapes'),
    []);
  const readTool = useMemo(() => PERCEPTION_TOOLS.find((entry) => entry.declaration.name === 'read_canvas'),
    []);
  const clearTool = useMemo(() => DRAWING_TOOLS.find((entry) => entry.declaration.name === 'clear_agent_drawings'),
    []);

  const pushLog = useCallback((entry: Omit<DemoLogEntry, 'id'>) => {
    setLogs((prev) => [...prev, {...entry, id: `${Date.now()}-${prev.length}` }]);
  }, []);

  const runDrawFlow = useCallback(async (): Promise<boolean> => {
    if (drawTool === undefined) return false;
    const result = await withAgentToolContextAsync(NORTHSTAR_AGENT, () =>
      drawTool.handler({
        layout: NORTHSTAR_FLOW_DIAGRAM.layout,
        diagram: NORTHSTAR_FLOW_DIAGRAM.diagram,
        placement: NORTHSTAR_FLOW_DIAGRAM.placement,
        style: { fill: 'solid', color: 'blue', size: 'l' },
      }));
    if (result.ok) {
      const legible = await fitCanvasToAgentDrawings(NORTHSTAR_AGENT.agentId);
      if (!legible && !useBoundedFallback) {
        setUseBoundedFallback(true);
      }
    }
    notifyScriptedToolRun(
      'draw_shapes',
      'Flow diagram — Client brief → Moodboard → Concepts → Final delivery',
      result.ok);
    pushLog({
      title: 'draw_shapes · flow diagram',
      status: result.ok ? 'ok': 'error',
      detail: result.ok ? 'Career-style flow from logical nodes': String(result.error ?? 'failed'),
      payload: result.ok ? result.result: undefined,
    });
    return result.ok;
  }, [drawTool, pushLog]);

  const runDrawBatch = useCallback(async (): Promise<boolean> => {
    if (drawTool === undefined) return false;
    const result = await withAgentToolContextAsync(NORTHSTAR_AGENT, () =>
      drawTool.handler({ shapes: NORTHSTAR_SHAPE_BATCH.shapes }));
    if (result.ok) {
      const legible = await fitCanvasToAgentDrawings(NORTHSTAR_AGENT.agentId);
      if (!legible && !useBoundedFallback) {
        setUseBoundedFallback(true);
      }
    }
    notifyScriptedToolRun(
      'draw_shapes',
      'Branded box + provenance hint (Northstar Atelier)',
      result.ok);
    pushLog({
      title: 'draw_shapes · explicit batch',
      status: result.ok ? 'ok': 'error',
      detail: result.ok ? 'Box + text with agent provenance meta': String(result.error ?? 'failed'),
      payload: result.ok ? result.result: undefined,
    });
    return result.ok;
  }, [drawTool, pushLog]);

  const runReadCanvas = useCallback(async (): Promise<P8DemoRunSummary | null> => {
    if (readTool === undefined) return null;
    const result = await readTool.handler({ region: { kind: 'viewport' }, budget: 200 });
    if (!result.ok) {
      pushLog({
        title: 'read_canvas · viewport',
        status: 'error',
        detail: String(result.error ?? 'read failed'),
      });
      return null;
    }
    const graph = readShapeGraph(result.result);
    if (graph === undefined) {
      pushLog({
        title: 'read_canvas · viewport',
        status: 'error',
        detail: 'Unexpected read_canvas payload',
      });
      return null;
    }
    const nextSummary = summarizeProvenance(graph);
    setSummary(nextSummary);
    pushLog({
      title: 'read_canvas · viewport',
      status: nextSummary.ok ? 'ok': 'error',
      detail: `${nextSummary.agentStampedCount} agent-stamped / ${nextSummary.totalShapes} total shapes`,
      payload: graph,
    });
    window.__p8AgentDrawDemoResult = nextSummary;
    return nextSummary;
  }, [pushLog, readTool]);

  const runClear = useCallback(async (): Promise<boolean> => {
    if (clearTool === undefined) return false;
    await clearHarnessIndexedDbPersistence();
    const result = await withAgentToolContextAsync(NORTHSTAR_AGENT, () =>
      clearTool.handler({}));
    pushLog({
      title: 'clear_agent_drawings',
      status: result.ok ? 'ok': 'error',
      detail: result.ok ? 'Removed agent-stamped marks': String(result.error ?? 'clear failed'),
      payload: result.ok ? result.result: undefined,
    });
    if (result.ok) {
      setSummary(null);
      window.__p8AgentDrawDemoResult = { ok: true, agentStampedCount: 0, totalShapes: 0, agentIds: [] };
      window.__p8AgentDrawDemoCanvasLegible = false;
      window.__p8AgentDrawDemoChatSettled = false;
    }
    return result.ok;
  }, [clearTool, pushLog]);

  const runFullDemo = useCallback(async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setLogs([]);
    setSummary(null);
    pushLog({ title: 'Demo started', status: 'running', detail: 'Scripted agent turn (no LLM)' });

    try {
      canvasMainRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

      const ready = await waitForCanvasReady(20_000, narrow);
      if (!ready) {
        pushLog({
          title: 'Demo aborted',
          status: 'error',
          detail: 'Whiteboard editor not ready — retry after canvas mounts',
        });
        window.__galleryReady = { example: 'p8-agent-draw-demo', ok: false };
        return;
      }

      await runClear();
      notifyScriptedToolRun('clear_agent_drawings', 'Cleared prior agent-stamped marks', true);
      const drewFlow = await runDrawFlow();
      const drewBatch = await runDrawBatch();
      await fitCanvasToAgentDrawings(NORTHSTAR_AGENT.agentId);

      window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 400);
      });
      await fitCanvasToAgentDrawings(NORTHSTAR_AGENT.agentId);

      window.dispatchEvent(
        new CustomEvent(CHAT_TRANSCRIPT_INJECT_EVENT, {
          detail: {
            role: 'user',
            text: 'Run the Northstar Atelier draw-and-see demo on the canvas.',
          },
          bubbles: true,
          composed: true,
        }));

      const readSummary = await runReadCanvas();
      notifyScriptedToolRun(
        'read_canvas',
        readSummary
          ? `Viewport read — ${readSummary.agentStampedCount} agent-stamped shapes` : 'Viewport read failed',
        readSummary?.ok ?? false);
      const ok = drewFlow && drewBatch && (readSummary?.ok ?? false);
      pushLog({
        title: 'Demo complete',
        status: ok ? 'ok': 'error',
        detail: ok
          ? `Provenance verified: ${readSummary?.agentIds.join(', ') ?? 'none'}`: 'One or more steps failed — see log',
      });
      if (ok) {
        window.dispatchEvent(
          new CustomEvent('landi:assistant-message', {
            detail: {
              text: 'Demo complete — the career flow (Client brief → Final delivery) and Northstar provenance marks are on the canvas. Activity log shows each tool step.',
            },
            bubbles: true,
            composed: true,
          }));
        window.__p8AgentDrawDemoChatSettled = true;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 450);
        });
        await fitCanvasToAgentDrawings(NORTHSTAR_AGENT.agentId);
      }
      window.__galleryReady = { example: 'p8-agent-draw-demo', ok };
    } finally {
      setBusy(false);
    }
  }, [busy, narrow, pushLog, runClear, runDrawBatch, runDrawFlow, runReadCanvas]);

  const whiteboardConfig = useMemo(() => ({
      tenant: NORTHSTAR_BRAND.tenant,
      primaryColor: '#7C3AED',
      welcomeMessage: `${NORTHSTAR_BRAND.name} — ${NORTHSTAR_BRAND.tagline}`,
      persona: {
        assistantName: 'Astra',
        tenantTitle: 'Design Agent',
        systemPrompt: 'You are Astra, a fictional Northstar Atelier design agent.',
      },
    }),
    []);

  const canvasMode = useMemo(() =>
      useBoundedFallback
        ? ({ kind: 'bounded' as const, bounds: { x: 0, y: 0, w: 400, h: 700 } }): ({ kind: 'infinite' as const }),
    [useBoundedFallback]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr': '340px 1fr',
        gridTemplateRows: narrow ? 'minmax(0, auto) minmax(0, 1fr)': 'minmax(0, 1fr)',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <aside
        style={{
          padding: '1.25rem',
          borderRight: narrow ? undefined: '1px solid #334155',
          borderBottom: narrow ? '1px solid #334155': undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflow: 'auto',
          minHeight: 0,
          maxHeight: narrow ? '40dvh': undefined,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem' }}>{NORTHSTAR_BRAND.name}</h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            P8 try-it: agent <strong>draw</strong> + <strong>see</strong> (scripted tools, no API keys)
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            type="button"
            data-testid="p8-run-full-demo"
            disabled={busy}
            onClick={() => void runFullDemo()}
            style={buttonStyle(true)}
          >
            Run full demo
          </button>
          <button
            type="button"
            data-testid="p8-draw-flow"
            disabled={busy}
            onClick={() => void runDrawFlow()}
            style={buttonStyle(false)}
          >
            Draw flow diagram
          </button>
          <button
            type="button"
            data-testid="p8-draw-batch"
            disabled={busy}
            onClick={() => void runDrawBatch()}
            style={buttonStyle(false)}
          >
            Draw shape batch
          </button>
          <button
            type="button"
            data-testid="p8-read-canvas"
            disabled={busy}
            onClick={() => void runReadCanvas()}
            style={buttonStyle(false)}
          >
            Read canvas (see)
          </button>
          <button
            type="button"
            data-testid="p8-clear"
            disabled={busy}
            onClick={() => void runClear()}
            style={buttonStyle(false)}
          >
            Clear agent drawings
          </button>
        </div>

        {summary !== null ? (
          <dl
            data-testid="p8-provenance-summary"
            style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}
          >
            <dt style={{ color: '#94a3b8' }}>Agent-stamped shapes</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{summary.agentStampedCount}</dd>
            <dt style={{ color: '#94a3b8' }}>Provenance agent ids</dt>
            <dd style={{ margin: 0 }}>{summary.agentIds.join(', ') || '—'}</dd>
          </dl>
        ): null}

        <div style={{ flex: 1, minHeight: 120 }}>
          <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', margin: '0 0 0.5rem' }}>
            Activity log
          </h2>
          <ol
            data-testid="p8-activity-log"
            style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#cbd5e1' }}
          >
            {logs.map((entry) => (
              <li key={entry.id} style={{ marginBottom: '0.35rem' }}>
                <strong>{entry.title}</strong>
                {entry.detail ? ` — ${entry.detail}`: ''}
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <main
        ref={canvasMainRef}
        style={{
          minHeight: 0,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: narrow ? 1: undefined,
        }}
      >
        <div
          data-testid="p8-canvas-host"
          style={{ flex: 1, minHeight: 0, height: '100%', width: '100%', overflow: 'hidden' }}
        >
          <WhiteboardShell
            key={useBoundedFallback ? 'bounded': 'infinite'}
            config={whiteboardConfig}
            openChatOnMount={false}
            showNavSidebar={false}
            enableVoiceTool={false}
            enableLayersPanel
            hideTopBar={false}
            darkCanvas
            persistenceScope="p8-agent-draw-demo"
            mode={canvasMode}
            toolbarConfig={{
              tools: ['select', 'hand', 'layers', 'reset'],
              layoutActionPlacement: 'topbar',
            }}
          />
        </div>
      </main>
    </div>
  );
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    padding: '0.55rem 0.75rem',
    borderRadius: 8,
    border: primary ? 'none': '1px solid #475569',
    background: primary ? '#7C3AED': 'transparent',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textAlign: 'left',
  };
}

declare global {
  interface Window {
    __galleryExample?: string;
    __galleryReady?: { example: string; ok: boolean };
    __p8AgentDrawDemoResult?: P8DemoRunSummary;
    __p8AgentDrawDemoCanvasLegible?: boolean;
    __p8AgentDrawDemoChatSettled?: boolean;
    __p8AgentDrawDemoLegibility?: {
      agentShapeCount: number;
      legibleCount: number;
      geoNodeCount: number;
      visibleGeoNodeCount: number;
    };
    __p8AgentDrawDemoShapeDump?: {
      zoom: number;
      viewport: { x: number; y: number; w: number; h: number };
      centroids?: ScreenCentroid[];
      shapes: Array<Record<string, unknown>>;
    };
    __p8AgentDrawDemoCameraLoopLog?: CameraLoopAttempt[];
    __runP8AgentDrawDemo?: () => Promise<void>;
  }
}

window.__galleryExample = 'p8-agent-draw-demo';

const mount = document.getElementById('root');
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <DemoErrorBoundary>
        <P8AgentDrawDemoApp />
      </DemoErrorBoundary>
    </StrictMode>);
  window.__runP8AgentDrawDemo = async () => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="p8-run-full-demo"]');
    button?.click();
  };
} else {
  window.__galleryReady = { example: 'p8-agent-draw-demo', ok: false };
}

export { P8AgentDrawDemoApp };
