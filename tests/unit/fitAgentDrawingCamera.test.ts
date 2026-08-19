import { describe, expect, it } from 'vitest';
import {
  computeFitZoomForPageBounds,
  isViewportPageBoundsCorrupted,
} from '../../src/engines/tldraw/agentDrawing/fitAgentDrawingCamera';

describe('fitAgentDrawingCamera', () => {
  it('detects corrupted viewport page bounds', () => {
    expect(isViewportPageBoundsCorrupted({ y: 0, h: 800 })).toBe(false);
    expect(isViewportPageBoundsCorrupted({ y: -16167, h: 33182 })).toBe(true);
    expect(isViewportPageBoundsCorrupted(undefined)).toBe(true);
  });

  it('computes fit zoom from screen size and agent bounds only', () => {
    const bounds = { minX: 72, minY: 100, maxX: 284, maxY: 560 };
    const screen = { w: 940, h: 752 };
    const zoom = computeFitZoomForPageBounds(bounds, screen);
    expect(zoom).toBeGreaterThan(0.5);
    expect(zoom).toBeLessThanOrEqual(2.5);
  });

  it('caps page height used for zoom when bounds are extreme', () => {
    const screen = { w: 940, h: 752 };
    const extreme = computeFitZoomForPageBounds(
      { minX: 0, minY: 0, maxX: 260, maxY: 20_000 },
      screen,
      { maxPageHeight: 2400 });
    const uncappedExtreme = computeFitZoomForPageBounds(
      { minX: 0, minY: 0, maxX: 260, maxY: 20_000 },
      screen,
      { maxPageHeight: 20_000 });
    expect(extreme).toBeGreaterThan(uncappedExtreme);
  });
});
