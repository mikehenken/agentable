/**
 * Imperative canvas perception driver for the tldraw whiteboard (D41, P8-T2).
 *
 * Called from agent tools (non-React). Uses the same editor binding as
 * panelShapeApi and agentDrawingApi.
 */
import { Box, type Editor, type TLShapeId } from 'tldraw';
import type {
  CanvasReadOptions,
  CanvasScreenshotOptions,
  CanvasScreenshotResult,
  CanvasShapeGraph,
} from '../../../engine/canvasPerceptionTypes';
import type { Rect } from '../../../engine/types';
import { getEditor } from '../shapes/panelShapeApi';
import {
  resolvePerceptionRegionBounds,
  serializeShapeGraph,
} from './shapeGraphSerializer';

const DEFAULT_READ_BUDGET = 200;

/** Sensible PNG pixel ratio bounds — fractional ratios below 1 are valid. */
export const MIN_PIXEL_RATIO = 0.25;
export const MAX_PIXEL_RATIO = 4;

export function clampPixelRatio(value: number | undefined): number {
  const base = value ?? 1;
  if (!Number.isFinite(base)) {
    return 1;
  }
  return Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, base));
}

function requireEditor(): Editor {
  const editor = getEditor();
  if (!editor) {
    throw new Error('canvas editor not bound');
  }
  return editor;
}

function viewportBounds(editor: Editor): Rect {
  const viewport = editor.getViewportPageBounds();
  return { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h };
}

function shapeIdsInRegion(editor: Editor, region: Rect): string[] {
  const ids: string[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) continue;
    const shapeRect: Rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
    const intersects =
      shapeRect.x < region.x + region.w &&
      shapeRect.x + shapeRect.w > region.x &&
      shapeRect.y < region.y + region.h &&
      shapeRect.y + shapeRect.h > region.y;
    if (intersects) ids.push(String(shape.id));
  }
  return ids;
}

function unionPageBounds(editor: Editor, shapeIds: readonly string[]): Rect | null {
  let union: Rect | null = null;
  for (const shapeId of shapeIds) {
    const bounds = editor.getShapePageBounds(shapeId as TLShapeId);
    if (!bounds) continue;
    const rect: Rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
    if (union === null) {
      union = { ...rect };
      continue;
    }
    const x2 = Math.max(union.x + union.w, rect.x + rect.w);
    const y2 = Math.max(union.y + union.h, rect.y + rect.h);
    union = {
      x: Math.min(union.x, rect.x),
      y: Math.min(union.y, rect.y),
      w: x2 - Math.min(union.x, rect.x),
      h: y2 - Math.min(union.y, rect.y),
    };
  }
  return union;
}

const MIN_CAPTURE_DIMENSION = 32;
const CAPTURE_BOUNDS_PADDING = 16;

function filterValidShapeIds(editor: Editor, shapeIds: readonly string[]): string[] {
  return shapeIds.filter((shapeId) => {
    const id = shapeId as TLShapeId;
    if (editor.getShape(id) === undefined) {
      return false;
    }
    const bounds = editor.getShapePageBounds(id);
    return bounds !== null;
  });
}

function padAndMinCaptureRegion(region: Rect): Rect {
  const padded: Rect = {
    x: region.x - CAPTURE_BOUNDS_PADDING,
    y: region.y - CAPTURE_BOUNDS_PADDING,
    w: region.w + CAPTURE_BOUNDS_PADDING * 2,
    h: region.h + CAPTURE_BOUNDS_PADDING * 2,
  };
  if (padded.w < MIN_CAPTURE_DIMENSION) {
    const expand = (MIN_CAPTURE_DIMENSION - padded.w) / 2;
    padded.x -= expand;
    padded.w = MIN_CAPTURE_DIMENSION;
  }
  if (padded.h < MIN_CAPTURE_DIMENSION) {
    const expand = (MIN_CAPTURE_DIMENSION - padded.h) / 2;
    padded.y -= expand;
    padded.h = MIN_CAPTURE_DIMENSION;
  }
  return padded;
}

function resolveScreenshotShapeIds(
  editor: Editor,
  region: Rect,
  fallbackShapeIds: readonly string[] | undefined,
): { shapeIds: string[]; captureRegion: Rect } {
  const inRegion = filterValidShapeIds(editor, shapeIdsInRegion(editor, region));
  if (inRegion.length > 0) {
    return { shapeIds: inRegion, captureRegion: padAndMinCaptureRegion(region) };
  }

  const fallbackCandidates = filterValidShapeIds(
    editor,
    fallbackShapeIds !== undefined && fallbackShapeIds.length > 0
      ? [...fallbackShapeIds]
      : editor.getCurrentPageShapes().map((shape) => String(shape.id)),
  );

  if (fallbackCandidates.length === 0) {
    throw new Error('no shapes in screenshot region');
  }

  const union = unionPageBounds(editor, fallbackCandidates);
  if (union === null) {
    throw new Error('no shapes in screenshot region');
  }

  return {
    shapeIds: fallbackCandidates,
    captureRegion: padAndMinCaptureRegion(union),
  };
}

export function readCanvasShapeGraph(options: CanvasReadOptions = {}): CanvasShapeGraph {
  const editor = requireEditor();
  const region = resolvePerceptionRegionBounds(options.region, viewportBounds(editor));
  const shapes = editor.getCurrentPageShapes();

  return serializeShapeGraph({
    shapes: shapes.map((shape) => ({
      id: String(shape.id),
      type: shape.type,
      x: shape.x,
      y: shape.y,
      parentId: shape.parentId ? String(shape.parentId) : undefined,
      index: shape.index,
      meta: shape.meta as Record<string, unknown>,
      props: shape.props as Record<string, unknown>,
    })),
    region,
    budget: options.budget ?? DEFAULT_READ_BUDGET,
    getPageBounds: (shapeId) => {
      const bounds = editor.getShapePageBounds(shapeId as TLShapeId);
      if (!bounds) return null;
      return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
    },
  });
}

export async function screenshotCanvasRegion(
  options: CanvasScreenshotOptions = {},
): Promise<CanvasScreenshotResult> {
  const editor = requireEditor();
  const region = resolvePerceptionRegionBounds(options.region, viewportBounds(editor));
  const { shapeIds, captureRegion } = resolveScreenshotShapeIds(
    editor,
    region,
    options.fallbackShapeIds,
  );

  const pixelRatio = clampPixelRatio(options.pixelRatio);
  const bounds = new Box(captureRegion.x, captureRegion.y, captureRegion.w, captureRegion.h);

  async function renderAtRatio(ratio: number): Promise<CanvasScreenshotResult> {
    const validShapeIds = filterValidShapeIds(editor, shapeIds);
    if (validShapeIds.length === 0) {
      throw new Error('no valid shapes to screenshot');
    }
    const image = await editor.toImageDataUrl(validShapeIds as TLShapeId[], {
      format: 'png',
      pixelRatio: ratio,
      bounds,
      padding: CAPTURE_BOUNDS_PADDING,
      background: true,
    });

    const dataUrl = typeof image === 'string' ? image : image.url;
    const width =
      typeof image === 'string'
        ? Math.max(1, Math.round(captureRegion.w * ratio))
        : Math.max(1, Math.round(image.width));
    const height =
      typeof image === 'string'
        ? Math.max(1, Math.round(captureRegion.h * ratio))
        : Math.max(1, Math.round(image.height));

    return {
      dataUrl,
      width,
      height,
      format: 'png',
      region: captureRegion,
    };
  }

  try {
    return await renderAtRatio(pixelRatio);
  } catch (firstError) {
    if (pixelRatio === 1) {
      throw firstError;
    }
    return renderAtRatio(1);
  }
}
