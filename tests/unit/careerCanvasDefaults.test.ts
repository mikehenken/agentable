import { describe, expect, it } from 'vitest';
import {
  applyCareerEmbedDefaults,
  DEFAULT_CAREER_BOUNDED_MODE,
  DEFAULT_CAREER_EMBED_CANVAS_ATTRS,
  DEFAULT_CAREER_TOOLBAR_CONFIG,
  DEFAULT_CAREER_HOST_CHROME,
  resolveCareerWhiteboardShellDefaults,
  toEmbedConfigDocument,
  createCareerPack,
  resolveCareerHostConfig,
} from '@agentable/career-pack';
import { parseCanvasModeFromEmbed } from '../../src/engines/tldraw/canvasMode';

describe('career canvas defaults', () => {
  it('DEFAULT_CAREER_BOUNDED_MODE locks zoom on bounded page', () => {
    expect(DEFAULT_CAREER_BOUNDED_MODE).toEqual({
      kind: 'bounded',
      bounds: { w: 1200, h: 800 },
      behavior: 'inside',
      zoom: 'locked',
    });
  });

  it('parseCanvasModeFromEmbed resolves canvas-zoom locked', () => {
    const parsed = parseCanvasModeFromEmbed({
      mode: DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasMode,
      bounds: DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasBounds,
      zoom: DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasZoom,
    });
    expect(parsed.kind).toBe('bounded');
    if (parsed.kind === 'bounded') {
      expect(parsed.zoom).toBe('locked');
      expect(parsed.bounds).toEqual({ w: 1200, h: 800 });
    }
  });

  it('applyCareerEmbedDefaults fills canvas + toolbar when omitted', () => {
    const merged = applyCareerEmbedDefaults({ tenant: 'archipelago' });
    expect(merged.canvasMode).toBe('bounded');
    expect(merged.canvasBounds).toBe('1200x800');
    expect(merged.canvasZoom).toBe('locked');
    expect(merged.toolbar?.layoutActionPlacement).toBe('toolbar');
  });

  it('toEmbedConfigDocument applies career embed defaults', () => {
    const pack = createCareerPack({ tenant: 'helios' });
    const doc = toEmbedConfigDocument(resolveCareerHostConfig(pack, { tenant: 'helios' }));
    expect(doc.canvasZoom).toBe('locked');
    expect(doc.toolbar).toEqual(DEFAULT_CAREER_TOOLBAR_CONFIG);
  });

  it('resolveCareerWhiteboardShellDefaults matches bounded locked mode', () => {
    const shell = resolveCareerWhiteboardShellDefaults;
    expect(shell.mode).toEqual(DEFAULT_CAREER_BOUNDED_MODE);
    expect(shell.toolbarConfig.layoutActionPlacement).toBe('toolbar');
    expect(shell.snapGrid).toBe(true);
    expect(shell.hostChrome.frameWidthPercent).toBe(DEFAULT_CAREER_HOST_CHROME.frameWidthPercent);
    expect(shell.hostChrome.fullscreenMode).toBe('canvas-expand');
  });
});
