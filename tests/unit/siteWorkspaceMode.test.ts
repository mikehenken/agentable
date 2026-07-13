/**
 * Unit tests for enterSiteWorkspaceMode zoom-to-fit behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { createShapeId } from 'tldraw';
import { enterSiteWorkspaceMode } from '../../src/whiteboard/context/siteWorkspaceMode';

const SITE_ID = 'site-zoom';
const FRAME_ID = createShapeId('context:site:site-zoom');

function makeEditor(frameBounds: { x: number; y: number; w: number; h: number }) {
  const zoomToBounds = vi.fn();
  const select = vi.fn();
  const editor = {
    getShape: (id: string) => (id === FRAME_ID ? { type: 'frame', id: FRAME_ID } : null),
    getShapePageBounds: (id: string) => (id === FRAME_ID ? frameBounds : undefined),
    getViewportScreenBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
    getCameraOptions: () => ({ zoomSteps: [0.1, 0.25, 0.5, 1, 2, 4, 8] }),
    select,
    zoomToBounds,
  };
  return { editor, zoomToBounds, select };
}

describe('enterSiteWorkspaceMode zoom-to-fit', () => {
  it('caps zoom at the default 2x for a tiny frame (no absurd over-zoom)', () => {
    // 400x300 would fit at ~2.8x; the default maxZoom caps it at 2x so a tiny
    // group fills the screen without ballooning to a 425%-style over-zoom.
    const { editor, zoomToBounds, select } = makeEditor({ x: 500, y: 500, w: 400, h: 300 });

    const ok = enterSiteWorkspaceMode(editor as never, SITE_ID, { arrangeFirst: false });

    expect(ok).toBe(true);
    expect(select).toHaveBeenCalledWith(FRAME_ID);
    const opts = zoomToBounds.mock.calls[0]?.[1];
    expect(opts?.targetZoom).toBe(2);
  });

  it('fills the viewport for a real site group (fit zoom, not capped)', () => {
    // ~1200x720 group with a 24px inset → min((1440-48)/1200, (900-48)/720)
    // ≈ 1.16, i.e. it scales UP past 100% to fill the screen but under the cap.
    const { editor, zoomToBounds } = makeEditor({ x: 200, y: 200, w: 1200, h: 720 });

    enterSiteWorkspaceMode(editor as never, SITE_ID, { arrangeFirst: false });

    const opts = zoomToBounds.mock.calls[0]?.[1];
    const expected = Math.min((1440 - 48) / 1200, (900 - 48) / 720);
    expect(opts?.targetZoom).toBeCloseTo(expected, 5);
    expect(opts?.targetZoom).toBeGreaterThan(1);
    expect(opts?.targetZoom).toBeLessThan(2);
  });

  it('scales a large frame down to fit fully in the viewport', () => {
    // 4000x3000 with a 24px inset → min((1440-48)/4000, (900-48)/3000) ≈ 0.284.
    const { editor, zoomToBounds } = makeEditor({ x: 0, y: 0, w: 4000, h: 3000 });

    enterSiteWorkspaceMode(editor as never, SITE_ID, { arrangeFirst: false });

    const opts = zoomToBounds.mock.calls[0]?.[1];
    const expected = Math.min((1440 - 48) / 4000, (900 - 48) / 3000);
    expect(opts?.targetZoom).toBeCloseTo(expected, 5);
    expect(opts?.targetZoom).toBeLessThan(1);
  });

  it('honors a custom maxZoom option', () => {
    const { editor, zoomToBounds } = makeEditor({ x: 0, y: 0, w: 400, h: 300 });

    enterSiteWorkspaceMode(editor as never, SITE_ID, { arrangeFirst: false, maxZoom: 0.75 });

    const opts = zoomToBounds.mock.calls[0]?.[1];
    expect(opts?.targetZoom).toBe(0.75);
  });

  it('returns false when the site frame is missing', () => {
    const editor = {
      getShape: () => null,
      getShapePageBounds: () => undefined,
      getViewportScreenBounds: () => ({ x: 0, y: 0, w: 1440, h: 900 }),
      select: vi.fn(),
      zoomToBounds: vi.fn(),
    };
    expect(enterSiteWorkspaceMode(editor as never, SITE_ID, { arrangeFirst: false })).toBe(false);
  });
});
