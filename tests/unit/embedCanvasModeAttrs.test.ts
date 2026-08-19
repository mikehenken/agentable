/**
 * Embed attribute contract for canvas mode + fullpage.
 * Vitest coverage mirrors tests/component/canvasModeFullpage.test.ts when
 * web-test-runner is unavailable in CI/agent environments.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCanvasModeFromEmbed,
  parseHostHeaderHeight,
} from '../../src/engines/tldraw/canvasMode';

describe('embed canvas-mode attribute contract', () => {
  it('maps bounded embed attrs to CanvasMode', () => {
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

  it('normalizes host-header-height for fullpage CSS var', () => {
    expect(parseHostHeaderHeight('72')).toBe('72px');
  });
});
