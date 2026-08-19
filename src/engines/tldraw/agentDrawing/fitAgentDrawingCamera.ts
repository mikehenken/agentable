import type { Editor } from 'tldraw';
import {
  readWhiteboardViewportScreenSize,
  syncWhiteboardViewportScreenBounds,
} from '../hooks/useWhiteboardViewportScreenBoundsSync';

export interface AgentDrawingPageBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FitAgentDrawingCameraOptions {
  inset?: number;
  toolbarClearancePx?: number;
  maxPageHeight?: number;
  maxZoom?: number;
  minZoom?: number;
  screen?: { w: number; h: number };
}

const DEFAULT_INSET = 80;
const DEFAULT_TOOLBAR_CLEARANCE_PX = 96;
const DEFAULT_MAX_PAGE_HEIGHT = 2400;
const DEFAULT_MAX_ZOOM = 2.5;
const DEFAULT_MIN_ZOOM = 0.15;
const VIEWPORT_CORRUPTION_PAGE_H = 5000;
const VIEWPORT_CORRUPTION_SCREEN_H = 5000;

export function isViewportPageBoundsCorrupted(
  viewport: { y: number; h: number } | undefined): boolean {
  if (viewport === undefined) {
    return true;
  }
  return (
    !Number.isFinite(viewport.y) ||
    !Number.isFinite(viewport.h) ||
    Math.abs(viewport.y) > 10_000 ||
    viewport.h > VIEWPORT_CORRUPTION_PAGE_H
  );
}

export function resetEditorCameraIfViewportCorrupted(editor: Editor): boolean {
  const viewport = editor.getViewportPageBounds();
  if (!isViewportPageBoundsCorrupted(viewport)) {
    return false;
  }
  editor.setCamera({ x: 0, y: 0, z: 1 }, { animation: { duration: 0 } });
  return true;
}

function resolveViewportScreenBounds(
  editor: Editor,
  override?: { w: number; h: number }): { w: number; h: number } | null {
  const synced = syncWhiteboardViewportScreenBounds(editor);
  if (synced !== null) {
    return synced;
  }

  if (
    override !== undefined &&
    override.w > 80 &&
    override.h > 80 &&
    override.h < VIEWPORT_CORRUPTION_SCREEN_H
  ) {
    return override;
  }

  const fromEditor = editor.getViewportScreenBounds?.();
  if (
    fromEditor !== undefined &&
    fromEditor.w > 80 &&
    fromEditor.h > 80 &&
    fromEditor.h < VIEWPORT_CORRUPTION_SCREEN_H
  ) {
    return { w: fromEditor.w, h: fromEditor.h };
  }

  return readWhiteboardViewportScreenSize();
}

export function computeFitZoomForPageBounds(
  bounds: AgentDrawingPageBounds,
  screen: { w: number; h: number },
  options: FitAgentDrawingCameraOptions = {}): number {
  const inset = options.inset ?? DEFAULT_INSET;
  const toolbarClearancePx = options.toolbarClearancePx ?? DEFAULT_TOOLBAR_CLEARANCE_PX;
  const maxPageHeight = options.maxPageHeight ?? DEFAULT_MAX_PAGE_HEIGHT;
  const maxZoom = options.maxZoom ?? DEFAULT_MAX_ZOOM;
  const minZoom = options.minZoom ?? DEFAULT_MIN_ZOOM;
  const contentW = Math.max(bounds.maxX - bounds.minX, 1);
  const contentH = Math.min(Math.max(bounds.maxY - bounds.minY, 1), maxPageHeight);
  return Math.max(
    minZoom,
    Math.min(
      (screen.w - inset * 2) / contentW,
      (screen.h - inset * 2 - toolbarClearancePx) / contentH,
      maxZoom));
}

/**
 * Fit agent drawing bounds using tldraw's zoomToBounds camera math with
 * screen bounds from the canvas viewport DOM when instance bounds lie.
 */
export function fitAgentDrawingCamera(
  editor: Editor,
  bounds: AgentDrawingPageBounds,
  options: FitAgentDrawingCameraOptions = {}): void {
  resetEditorCameraIfViewportCorrupted(editor);

  const inset = options.inset ?? DEFAULT_INSET;
  const toolbarClearancePx = options.toolbarClearancePx ?? DEFAULT_TOOLBAR_CLEARANCE_PX;
  const screen = resolveViewportScreenBounds(editor, options.screen);
  if (screen === null) {
    return;
  }

  const contentW = Math.max(bounds.maxX - bounds.minX, 1);
  const contentH = Math.min(
    Math.max(bounds.maxY - bounds.minY, 1),
    options.maxPageHeight ?? DEFAULT_MAX_PAGE_HEIGHT);
  const fitScreen = {
    w: screen.w,
    h: Math.max(screen.h - toolbarClearancePx, 120),
  };
  const fitZoom = computeFitZoomForPageBounds(bounds, fitScreen, options);

  editor.setCamera(
    {
      x: -bounds.minX + (screen.w - contentW * fitZoom) / 2 / fitZoom,
      y: -bounds.minY + (fitScreen.h - contentH * fitZoom) / 2 / fitZoom,
      z: fitZoom,
    },
    { animation: { duration: 0 } });
}
