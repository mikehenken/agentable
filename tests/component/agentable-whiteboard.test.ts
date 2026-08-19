/**
 * Component smoke tests for `<agentable-whiteboard>` (Lit shell → WhiteboardShell).
 */
import { expect } from '@open-wc/testing';
import { fixture, html } from '@open-wc/testing';
import '../../src/embed/agentable-whiteboard';
import type { AgentableWhiteboardElement } from '../../src/embed/agentable-whiteboard';

describe('<agentable-whiteboard>', () => {
  describe('registration', () => {
    it('registers the custom element', () => {
      expect(customElements.get('agentable-whiteboard')).to.exist;
    });

    it('renders the.agentable-whiteboard-mount target inside shadow', async () => {
      const el = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount></agentable-whiteboard>`);
      const mount = el.shadowRoot!.querySelector('.agentable-whiteboard-mount');
      expect(mount).to.exist;
    });

    it('voiceEnabled defaults to false ', async () => {
      const el = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount></agentable-whiteboard>`);
      expect(el.voiceEnabled).to.equal(false);
    });

    it('exposes dark-canvas and light-canvas attribute toggles', async () => {
      const darkEl = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount dark-canvas></agentable-whiteboard>`);
      expect(darkEl.darkCanvas).to.equal(true);
      expect(darkEl.hasAttribute('dark-canvas')).to.equal(true);

      const lightEl = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount light-canvas></agentable-whiteboard>`);
      expect(lightEl.lightCanvas).to.equal(true);
      expect(lightEl.hasAttribute('light-canvas')).to.equal(true);
    });

    it('reflects voice-enabled boolean attribute for opt-in', async () => {
      const el = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount voice-enabled></agentable-whiteboard>`);
      expect(el.voiceEnabled).to.equal(true);
    });

    it('applies Archipelago brand token from primary-color attribute', async () => {
      const el = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard
          data-skip-react-mount
          primary-color="#0077B6"
        ></agentable-whiteboard>`);
      expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('#0077B6');
    });

    it('adopts AiPersona halo CSS into the shadow root (not document-only)', async () => {
      const el = await fixture<AgentableWhiteboardElement>(
        html`<agentable-whiteboard data-skip-react-mount></agentable-whiteboard>`);
      const sheets = (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
      const styleTag = el.shadowRoot!.querySelector('style');
      const allCss = [...sheets.flatMap((s) => Array.from(s.cssRules ?? []).map((r) => r.cssText)),
        styleTag?.textContent ?? '',
      ].join('\n');
      expect(allCss).to.include('.agentable-persona');
      expect(allCss).to.include('ap-breathe');
      expect(allCss).to.include('ap-ping');
    });
  });
});
