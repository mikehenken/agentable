/**
 * Embed `fullscreen-mode` attribute contract.
 *
 * The expand button in the whiteboard top bar had exactly one behavior:
 * `documentElement.requestFullscreen()`. The host chrome layer has always
 * supported a second, `canvas-expand`, which grows the canvas into a fixed
 * overlay below the host's sticky nav instead of taking over the browser
 * window. Nothing could reach it: the embed element never passed `hostChrome`
 * to the shell, so a page embedding `<agentable-whiteboard>` was stuck with
 * document fullscreen no matter what it configured.
 *
 * These tests pin the attribute mapping and, just as importantly, pin that an
 * element WITHOUT the attribute still resolves to the old behavior, so adding
 * the seam cannot move any existing embedder.
 */
import { describe, it, expect } from 'vitest';
import {
  parseFullscreenMode,
  resolveWhiteboardHostChrome,
  DEFAULT_WHITEBOARD_HOST_CHROME,
} from '../../src/engines/tldraw/hostChrome/whiteboardHostChrome';

describe('embed fullscreen-mode attribute contract', () => {
  it('maps the canvas-expand attribute value to the canvas-expand mode', () => {
    expect(parseFullscreenMode('canvas-expand')).toBe('canvas-expand');
  });

  it('resolves an absent attribute to document fullscreen', () => {
    // getAttribute returns null when the attribute is not present. This is the
    // case that every embedder predating the attribute lands in.
    expect(parseFullscreenMode(null)).toBe('document');
    expect(parseFullscreenMode(undefined)).toBe('document');
  });

  it('degrades an unrecognized value to document rather than to nothing', () => {
    // A typo should leave the button doing what it did before, not break it.
    expect(parseFullscreenMode('canvasexpand')).toBe('document');
    expect(parseFullscreenMode('')).toBe('document');
    expect(parseFullscreenMode('fullscreen')).toBe('document');
  });

  it('carries the parsed mode through host chrome resolution', () => {
    const chrome = resolveWhiteboardHostChrome({
      fullscreenMode: parseFullscreenMode('canvas-expand'),
      hostHeaderHeight: '64px',
    });
    expect(chrome.fullscreenMode).toBe('canvas-expand');
    // The offset is what keeps a sticky site nav visible while expanded.
    expect(chrome.hostHeaderHeight).toBe('64px');
  });

  it('leaves every other chrome value at its default when only the mode is set', () => {
    // Guards the blast radius: passing hostChrome for the first time must not
    // quietly turn on the career pack's frame border or width inset.
    const chrome = resolveWhiteboardHostChrome({
      fullscreenMode: parseFullscreenMode(null),
    });
    expect(chrome).toEqual(DEFAULT_WHITEBOARD_HOST_CHROME);
  });
});
