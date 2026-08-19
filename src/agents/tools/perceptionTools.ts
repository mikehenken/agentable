/**
 * Agent canvas perception tools: read_canvas, screenshot_canvas.
 * Model capability gating for screenshot_canvas is handled by in capabilities.ts.
 * Engine capability gating: both tools read the tldraw shape
 * graph, so both require engine.capabilities.draw the same way draw and
 * walkthrough tools do; an engine that declares draw: false (the DOM
 * workspace engine) refuses with the same structured capability error
 * instead of throwing out of the tldraw-only perception driver below.
 */
import type { CanvasPerceptionRegion } from '../../engine/canvasPerceptionTypes';
import type { Rect } from '../../engine/types';
import type { ToolDeclaration, ToolDefinition } from '../../panels/tools';
import {
  clampPixelRatio,
  readCanvasShapeGraph,
  screenshotCanvasRegion,
} from '../../engines/tldraw/perception/canvasPerceptionApi';
import { drawCapabilityRefusal, isDrawCapabilityAvailable } from '../engineBridge';
import { waitForOperatorCanvasToolsReady } from '../surface/operatorCanvasToolBridge';

export const PERCEPTION_TOOL_NAMES = ['read_canvas', 'screenshot_canvas'] as const;

export type PerceptionToolName = (typeof PERCEPTION_TOOL_NAMES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value: undefined;
}

function readRegion(value: unknown): CanvasPerceptionRegion | undefined {
  if (value === 'viewport') {
    return { kind: 'viewport' };
  }
  if (!isRecord(value)) return undefined;
  if (value.kind === 'viewport') {
    return { kind: 'viewport' };
  }
  if (value.kind === 'rect' && isRecord(value.rect)) {
    const x = readFiniteNumber(value.rect.x);
    const y = readFiniteNumber(value.rect.y);
    const w = readFiniteNumber(value.rect.w);
    const h = readFiniteNumber(value.rect.h);
    if (x === undefined || y === undefined || w === undefined || h === undefined || w <= 0 || h <= 0) {
      return undefined;
    }
    const rect: Rect = { x, y, w, h };
    return { kind: 'rect', rect };
  }
  return undefined;
}

function readBudget(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded: undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  return out.length > 0 ? out: undefined;
}

function readPixelRatio(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return clampPixelRatio(value);
}

const declarationReadCanvas: ToolDeclaration = {
  name: 'read_canvas',
  description:
    'Read a structured shape graph from the canvas: types, geometry, text, arrow links, grouping, z-order, and panel metadata. Deterministic on a seeded canvas. Use when the model lacks vision or for wireframe-to-layout workflows.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      region: {
        type: 'object',
        description:
          'Scope to viewport or a page-coordinate rect. Defaults to viewport when omitted.',
      },
      budget: {
        type: 'number',
        description: 'Maximum shapes returned before truncation (default 200).',
      },
    },
  },
};

const declarationScreenshotCanvas: ToolDeclaration = {
  name: 'screenshot_canvas',
  description:
    'Capture a raster PNG of the viewport or region for vision-model input. Requires model vision capability; degrades to read_canvas when vision is unavailable.',
  costClass: 'cheap',
  parameters: {
    type: 'object',
    properties: {
      region: {
        type: 'object',
        description:
          'Scope to viewport or a page-coordinate rect. Defaults to viewport when omitted.',
      },
      pixelRatio: {
        type: 'number',
        description: 'PNG pixel ratio (default 1, clamped to 0.25–4).',
      },
      fallbackShapeIds: {
        type: 'array',
        description:
          'When the viewport region has no shapes, screenshot the union bounds of these shape ids instead.',
        items: { type: 'string' },
      },
    },
  },
};

export const PERCEPTION_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: declarationReadCanvas,
    handler: async (args) => {
      if (!isDrawCapabilityAvailable) {
        const ready = await waitForOperatorCanvasToolsReady;
        if (!ready) {
          return drawCapabilityRefusal;
        }
      }
      const regionArg = args.region;
      let region: CanvasPerceptionRegion | undefined;
      if (regionArg !== undefined) {
        const parsed = readRegion(regionArg);
        if (parsed === undefined) {
          return {
            ok: false,
            error: 'region must be "viewport" or { kind: "rect", rect: { x, y, w, h } }',
          };
        }
        region = parsed;
      }
      const budget = readBudget(args.budget);
      try {
        const graph = readCanvasShapeGraph({ region, budget });
        return { ok: true, result: graph };
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    },
  },
  {
    declaration: declarationScreenshotCanvas,
    handler: async (args) => {
      if (!isDrawCapabilityAvailable) {
        const ready = await waitForOperatorCanvasToolsReady;
        if (!ready) {
          return drawCapabilityRefusal;
        }
      }
      const regionArg = args.region;
      let region: CanvasPerceptionRegion | undefined;
      if (regionArg !== undefined) {
        const parsed = readRegion(regionArg);
        if (parsed === undefined) {
          return {
            ok: false,
            error: 'region must be "viewport" or { kind: "rect", rect: { x, y, w, h } }',
          };
        }
        region = parsed;
      }
      const pixelRatio = readPixelRatio(args.pixelRatio);
      const fallbackShapeIds = readStringArray(args.fallbackShapeIds);
      try {
        const capture = await screenshotCanvasRegion({ region, pixelRatio, fallbackShapeIds });
        return { ok: true, result: capture };
      } catch (err) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: message };
      }
    },
  },
];
