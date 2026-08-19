/**
 * Component tests for `<agentable-panel>` (Lit shell → PanelEmbedShell).
 *
 * Per web-components-ui §9.2 — real browser via @web/test-runner + Playwright.
 */
import { fixture, expect, html, elementUpdated, oneEvent } from '@open-wc/testing';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

describe('<agentable-panel>', () => {
  describe('registration & shadow DOM', () => {
    it('registers the custom element', () => {
      expect(customElements.get('agentable-panel')).to.exist;
    });

    it('mounts an open shadow root with mount target', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      expect(el.shadowRoot?.mode).to.equal('open');
      expect(el.shadowRoot?.querySelector('.agentable-panel-mount')).to.exist;
    });

    it('reflects panel attribute to property', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      expect(el.panel).to.equal('open-positions');
    });

    it('voiceEnabled defaults to false ', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel data-skip-react-mount panel="open-positions"></agentable-panel>`);
      expect(el.voiceEnabled).to.equal(false);
    });

    it('reflects voice-enabled boolean attribute for opt-in', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
          voice-enabled
        ></agentable-panel>`);
      expect(el.voiceEnabled).to.equal(true);
    });

    it('applies dual-form brand tokens from primary-color', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
          primary-color="#FF0000"
        ></agentable-panel>`);
      await elementUpdated(el);
      expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('#FF0000');
      expect(el.style.getPropertyValue('--landi-color-primary-hsl')).to.equal('0 100% 50%');
    });

    it('static styles include:host display:block + min-height', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel data-skip-react-mount panel="open-positions"></agentable-panel>`);
      await elementUpdated(el);
      const sheets =
        (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
      const styleTag = el.shadowRoot!.querySelector('style');
      const allCss = [...sheets.flatMap((sheet) => Array.from(sheet.cssRules ?? []).map((rule) => rule.cssText)),
        styleTag?.textContent ?? '',
      ].join('\n');
      expect(allCss).to.include('display: block');
      expect(allCss).to.include('min-height: 420px');
    });
  });

  describe('events', () => {
    it('dispatches agentable:config-reloaded from reload', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      await elementUpdated(el);
      const eventPromise = oneEvent(el, 'agentable:config-reloaded');
      await el.reload();
      const event = await eventPromise;
      expect(event.detail.ok).to.equal(true);
      expect(event.detail.panelId).to.equal('open-positions');
    });
  });

  describe('a11y basics', () => {
    it('exposes part="mount" landmark in open shadow root', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      await elementUpdated(el);
      const mount = el.shadowRoot?.querySelector('[part="mount"]');
      expect(mount).to.exist;
      expect(mount?.classList.contains('agentable-panel-mount')).to.equal(true);
    });

    it('does not leave inert interactive controls in skeleton mode', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      await elementUpdated(el);
      const controls = el.shadowRoot?.querySelectorAll('button, a, input, select, textarea');
      expect(controls?.length ?? 0).to.equal(0);
    });
  });

  describe('public API', () => {
    it('reload resolves without throwing when config-url is unset', async () => {
      const el = await fixture<AgentablePanelElement>(
        html`<agentable-panel
          data-skip-react-mount
          panel="open-positions"
        ></agentable-panel>`);
      await elementUpdated(el);
      await el.reload();
    });
  });
});
