/**
 * Canvas mode parsing (embed attributes + config) and camera clamping for
 * bounded/fixed modes (panel system spec section 9, D27/D44).
 */
import type { CameraState, CanvasMode } from '../../engine/types';

export const DEFAULT_CANVAS_MODE: CanvasMode = { kind: 'infinite' };

export const HOST_HEADER_HEIGHT_VAR = '--agentable-host-header-height';

export type CanvasModeKind = CanvasMode['kind'];

export interface ParsedCanvasBounds {
  w: number;
  h: number;
}

export interface ParseCanvasModeInput {
  mode?: string | null;
  bounds?: string | null;
  behavior?: string | null;
  zoom?: string | null;
}

const CANVAS_MODE_KINDS: readonly CanvasModeKind[] = ['infinite', 'bounded', 'fixed'];

function isCanvasModeKind(value: string): value is CanvasModeKind {
  return (CANVAS_MODE_KINDS as readonly string[]).includes(value);
}

function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Parses `canvas-bounds` embed/config values:
 *   - `1200x800` or `1200,800`
 *   - JSON `{"w":1200,"h":800}`
 */
export function parseCanvasBounds(raw: string | null | undefined): ParsedCanvasBounds | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { w?: unknown; h?: unknown };
      const w = typeof parsed.w === 'number' ? parsed.w : Number(parsed.w);
      const h = typeof parsed.h === 'number' ? parsed.h : Number(parsed.h);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { w, h };
    } catch {
      return null;
    }
  }

  const dimensionMatch = /^(\d+(?:\.\d+)?)\s*[x,]\s*(\d+(?:\.\d+)?)$/i.exec(trimmed);
  if (dimensionMatch) {
    const w = parsePositiveNumber(dimensionMatch[1] ?? '');
    const h = parsePositiveNumber(dimensionMatch[2] ?? '');
    if (w === null || h === null) return null;
    return { w, h };
  }

  return null;
}

function parseZoomSpec(
  raw: string | null | undefined,
): { min: number; max: number } | 'locked' | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === 'locked') return 'locked';

  const rangeMatch = /^([\d.]+)\s*[-:]\s*([\d.]+)$/.exec(trimmed);
  if (rangeMatch) {
    const min = parsePositiveNumber(rangeMatch[1] ?? '');
    const max = parsePositiveNumber(rangeMatch[2] ?? '');
    if (min === null || max === null || min > max) return undefined;
    return { min, max };
  }

  return undefined;
}

function parseBehavior(
  raw: string | null | undefined,
): 'contain' | 'inside' | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'contain' || trimmed === 'inside') return trimmed;
  return undefined;
}

/**
 * Resolves a `CanvasMode` from embed attributes / tenant config fields.
 * Unknown mode strings fall back to `infinite`. `bounded` without parseable
 * bounds falls back to `infinite` and logs a warning in dev.
 */
export function parseCanvasModeFromEmbed(input: ParseCanvasModeInput): CanvasMode {
  const kindRaw = input.mode?.trim().toLowerCase() ?? 'infinite';
  const kind = isCanvasModeKind(kindRaw) ? kindRaw : 'infinite';

  if (kind === 'infinite' || kind === 'fixed') {
    return { kind };
  }

  const bounds = parseCanvasBounds(input.bounds ?? null);
  if (!bounds) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[agentable-canvas] canvas-mode="bounded" requires canvas-bounds (e.g. 1200x800); falling back to infinite.',
      );
    }
    return DEFAULT_CANVAS_MODE;
  }

  const behavior = parseBehavior(input.behavior);
  const zoom = parseZoomSpec(input.zoom);

  return {
    kind: 'bounded',
    bounds,
    ...(behavior !== undefined ? { behavior } : {}),
    ...(zoom !== undefined ? { zoom } : {}),
  };
}

/**
 * Clamps a programmatic camera update for bounded mode. Uses the same
 * page-space approximation tldraw applies when constraints are active:
 * visible page width ≈ viewportScreen.w / zoom.
 */
export function clampCameraForMode(
  mode: CanvasMode,
  camera: CameraState,
  viewportScreen: { w: number; h: number },
): CameraState {
  if (mode.kind === 'infinite') return camera;
  if (mode.kind === 'fixed') return camera;

  let zoom = camera.zoom;
  if (mode.zoom === 'locked') {
    zoom = camera.zoom;
  } else if (mode.zoom !== undefined) {
    zoom = Math.max(mode.zoom.min, Math.min(mode.zoom.max, camera.zoom));
  }

  const visibleW = viewportScreen.w / zoom;
  const visibleH = viewportScreen.h / zoom;
  const maxLeft = Math.max(0, mode.bounds.w - visibleW);
  const maxTop = Math.max(0, mode.bounds.h - visibleH);

  const pageLeft = -camera.x / zoom;
  const pageTop = -camera.y / zoom;
  const clampedLeft = Math.min(maxLeft, Math.max(0, pageLeft));
  const clampedTop = Math.min(maxTop, Math.max(0, pageTop));

  return {
    x: -clampedLeft * zoom,
    y: -clampedTop * zoom,
    zoom,
  };
}

export function parseHostHeaderHeight(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const asNumber = parsePositiveNumber(trimmed);
  if (asNumber !== null) return `${asNumber}px`;
  return trimmed;
}
