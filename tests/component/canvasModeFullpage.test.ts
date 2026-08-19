/**
 * Embed canvas-mode + fullpage attribute component tests.
 */
import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/agentable-canvas';
import type { AgentableCanvasElement } from '../../src/embed/agentable-canvas';
import { parseCanvasModeFromEmbed } from '../../src/engines/tldraw/canvasMode';

describe('embed canvas mode + fullpage attrs', () => {
  it('reflects canvas-mode and canvas-bounds attributes', async () => {
    const el = await fixture<AgentableCanvasElement>(
      html`<agentable-canvas
        data-skip-react-mount
        canvas-mode="bounded"
        canvas-bounds="1200x800"
        canvas-behavior="inside"
        canvas-zoom="0.5-2"
      ></agentable-canvas>`);
    await elementUpdated(el);
    expect(el.canvasMode).to.equal('bounded');
    expect(el.canvasBounds).to.equal('1200x800');
    expect(
      parseCanvasModeFromEmbed({
        mode: el.canvasMode,
        bounds: el.canvasBounds,
        behavior: el.canvasBehavior,
        zoom: el.canvasZoom,
      })).to.deep.equal({
      kind: 'bounded',
      bounds: { w: 1200, h: 800 },
      behavior: 'inside',
      zoom: { min: 0.5, max: 2 },
    });
  });

  it('reflects fullpage-on-engage and host-header-height', async () => {
    const el = await fixture<AgentableCanvasElement>(
      html`<agentable-canvas
        data-skip-react-mount
        fullpage-on-engage
        host-header-height="72"
      ></agentable-canvas>`);
    await elementUpdated(el);
    expect(el.fullpageOnEngage).to.equal(true);
    expect(el.hostHeaderHeight).to.equal('72');
  });

  it('includes fullpage host CSS in static styles', async () => {
    const el = await fixture<AgentableCanvasElement>(
      html`<agentable-canvas data-skip-react-mount></agentable-canvas>`);
    await elementUpdated(el);
    const sheets = (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
    const styleTag = el.shadowRoot!.querySelector('style');
    const allCss = [...sheets.flatMap((s) => Array.from(s.cssRules ?? []).map((r) => r.cssText)),
      styleTag?.textContent ?? '',
    ].join('\n');
    expect(allCss).to.include('.agentable-canvas-host-fullpage');
  });
});
