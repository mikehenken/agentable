/**
 * Pure PNG pixel-ratio math for canvas screenshots. Deliberately tldraw-free
 * so the eager chat/agent path (`clampPixelRatio` in postDrawCanvasReview and
 * the perception tools) can import it without dragging the tldraw editor into
 * the embed's synchronous graph. The editor-coupled perception driver
 * (`canvasPerceptionApi`) re-exports these so its public API stays intact.
 */

/** Sensible PNG pixel ratio bounds. Fractional ratios below 1 are valid. */
export const MIN_PIXEL_RATIO = 0.25;
export const MAX_PIXEL_RATIO = 4;

export function clampPixelRatio(value: number | undefined): number {
  const base = value ?? 1;
  if (!Number.isFinite(base)) {
    return 1;
  }
  return Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, base));
}
