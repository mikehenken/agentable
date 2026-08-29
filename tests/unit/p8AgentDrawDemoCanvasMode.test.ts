/**
 * Regression: the P8 "agent draw & see" demo shipped with
 * `canvasMode: "bounded"` / `canvasBounds: "400x720"` / `canvasBehavior:
 * "contain"`. Through `parseCanvasModeFromEmbed` that resolves to a bounded
 * mode with no `zoom` spec, which `applyCanvasModeToEditor` turns into
 * `wheelBehavior: 'zoom'` plus a `contain` camera constraint on a 400x720
 * artboard. On a demo whose whole point is watching the agent sketch a wide
 * brief-to-delivery timeline and panning around it, that locked the grabber
 * and made the wheel zoom instead of pan (owner report: "cant pan / grabber
 * doesnt even work / panning can result in only zooming in").
 *
 * The fix flips the demo config to `infinite`, the only mode that guarantees
 * a free, unlocked, unconstrained camera (see `applyCanvasModeToEditor`:
 * `infinite` => `{ isLocked: false, wheelBehavior: 'pan', constraints:
 * undefined }`). This test reads the shipped config, resolves it through the
 * same parser the embed uses, and pins that a draw-and-explore demo stays
 * pannable. It also proves the guard has teeth by resolving the exact old
 * field set and asserting it produced the non-pannable bounded+contain mode.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCanvasModeFromEmbed } from '../../src/engines/tldraw/canvasMode';

const configPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../examples/p8-agent-draw-demo/config.example.json',
);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
  canvasMode?: string;
  canvasBounds?: string;
  canvasBehavior?: string;
  canvasZoom?: string;
  welcomeMessage?: string;
};

describe('p8 agent-draw-demo canvas mode', () => {
  it('is a draw-and-explore demo (guards the intent this test protects)', () => {
    // The assertion above only matters because this demo exists to draw and be
    // panned. If that framing ever changes, revisit the mode requirement.
    expect(config.welcomeMessage ?? '').toContain('agent draw & see');
  });

  it('resolves to a freely pannable canvas mode', () => {
    const mode = parseCanvasModeFromEmbed({
      mode: config.canvasMode ?? '',
      bounds: config.canvasBounds ?? '',
      behavior: config.canvasBehavior ?? '',
      zoom: config.canvasZoom ?? '',
    });
    // `infinite` is the only mode that yields wheelBehavior:'pan',
    // isLocked:false and no camera constraint in applyCanvasModeToEditor.
    expect(mode.kind).toBe('infinite');
  });

  it('does not ship the bounded 400x720 contain artboard that broke panning', () => {
    expect(config.canvasMode).not.toBe('bounded');
    expect(config).not.toHaveProperty('canvasBounds');
    expect(config).not.toHaveProperty('canvasBehavior');
  });

  it('the old field set would have failed this guard (regression has teeth)', () => {
    // The exact configuration that shipped broken, run through the same parser.
    const brokenMode = parseCanvasModeFromEmbed({
      mode: 'bounded',
      bounds: '400x720',
      behavior: 'contain',
      zoom: '',
    });
    expect(brokenMode.kind).toBe('bounded');
    // No zoom spec => applyCanvasModeToEditor uses wheelBehavior:'zoom'; the
    // contain behavior clamps the camera to the tiny artboard: not pannable.
    expect(brokenMode).toMatchObject({ kind: 'bounded', behavior: 'contain' });
    expect('zoom' in brokenMode ? brokenMode.zoom : undefined).toBeUndefined();
  });
});
