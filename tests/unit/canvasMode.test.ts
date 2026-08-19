/**
 * Canvas mode parsing + camera clamp proofs (automated_check: mode camera clamps).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  clampCameraForMode,
  parseCanvasBounds,
  parseCanvasModeFromEmbed,
  parseHostHeaderHeight,
} from '../../src/engines/tldraw/canvasMode';

describe('parseCanvasBounds', () => {
  it('parses WxH and comma forms', () => {
    expect(parseCanvasBounds('1200x800')).toEqual({ w: 1200, h: 800 });
    expect(parseCanvasBounds('1440,900')).toEqual({ w: 1440, h: 900 });
  });

  it('parses JSON bounds objects', () => {
    expect(parseCanvasBounds('{"w":960,"h":640}')).toEqual({ w: 960, h: 640 });
  });

  it('returns null for invalid bounds', () => {
    expect(parseCanvasBounds('')).toBeNull();
    expect(parseCanvasBounds('abc')).toBeNull();
    expect(parseCanvasBounds('0x800')).toBeNull();
  });
});

describe('parseCanvasModeFromEmbed', () => {
  it('defaults to infinite', () => {
    expect(parseCanvasModeFromEmbed({})).toEqual({ kind: 'infinite' });
  });

  it('parses fixed mode', () => {
    expect(parseCanvasModeFromEmbed({ mode: 'fixed' })).toEqual({ kind: 'fixed' });
  });

  it('parses bounded mode with behavior and zoom range', () => {
    expect(
      parseCanvasModeFromEmbed({
        mode: 'bounded',
        bounds: '1200x800',
        behavior: 'inside',
        zoom: '0.5-2',
      })).toEqual({
      kind: 'bounded',
      bounds: { w: 1200, h: 800 },
      behavior: 'inside',
      zoom: { min: 0.5, max: 2 },
    });
  });

  it('falls back to infinite when bounded lacks bounds', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseCanvasModeFromEmbed({ mode: 'bounded' })).toEqual({ kind: 'infinite' });
    warn.mockRestore();
  });
});

describe('clampCameraForMode', () => {
  const viewport = { w: 800, h: 600 };

  it('passes through infinite mode unchanged', () => {
    const camera = { x: 500, y: -200, zoom: 1.5 };
    expect(clampCameraForMode({ kind: 'infinite' }, camera, viewport)).toEqual(camera);
  });

  it('clamps zoom and pan for bounded mode', () => {
    const mode = {
      kind: 'bounded' as const,
      bounds: { w: 1200, h: 800 },
      zoom: { min: 0.5, max: 2 },
    };
    const camera = { x: -5000, y: -5000, zoom: 4 };
    const clamped = clampCameraForMode(mode, camera, viewport);
    expect(clamped.zoom).toBe(2);
    const visibleW = viewport.w / clamped.zoom;
    const pageLeft = -clamped.x / clamped.zoom;
    const pageTop = -clamped.y / clamped.zoom;
    expect(pageLeft).toBeGreaterThanOrEqual(0);
    expect(pageTop).toBeGreaterThanOrEqual(0);
    expect(pageLeft + visibleW).toBeLessThanOrEqual(mode.bounds.w + 0.001);
  });

  it('keeps fixed mode camera values (engine rejects writes separately)', () => {
    const camera = { x: 10, y: 20, zoom: 1 };
    expect(clampCameraForMode({ kind: 'fixed' }, camera, viewport)).toEqual(camera);
  });
});

describe('parseHostHeaderHeight', () => {
  it('normalizes numeric values to px', () => {
    expect(parseHostHeaderHeight('72')).toBe('72px');
  });

  it('passes through explicit CSS lengths', () => {
    expect(parseHostHeaderHeight('4.5rem')).toBe('4.5rem');
  });
});
