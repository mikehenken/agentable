/**
 * Component tests for `<agentable-canvas>` (Lit shell).
 *
 * Per `web-components-ui.md` §9.2 — runs in a REAL browser via
 * @web/test-runner + Playwright. Asserts against `shadowRoot`, not the
 * light DOM. The custom element is registered as a side effect of the
 * embed entry import.
 *
 * Coverage matrix (per §9.2): every public property × default + attribute
 * + runtime-property + DOM reflection × lifecycle hooks (firstUpdated,
 * updated, disconnectedCallback) × public methods × events × parts.
 */
import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/agentable-canvas';
import type { AgentableCanvasElement } from '../../src/embed/agentable-canvas';

describe('<agentable-canvas>', () => {
  describe('registration & shadow DOM', () => {
    it('registers the custom element', () => {
      expect(customElements.get('agentable-canvas')).to.exist;
    });

    it('mounts and exposes an open Shadow Root (Lit default)', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      expect(el.shadowRoot, 'shadowRoot exists').to.exist;
      expect(el.shadowRoot!.mode, 'mode is open').to.equal('open');
    });

    it('renders the .agentable-canvas-mount target inside shadow', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      const mount = el.shadowRoot!.querySelector('.agentable-canvas-mount');
      expect(mount, 'mount target rendered').to.exist;
    });

    it('static styles include :host display:block + contain:layout paint', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      // Lit emits styles via adoptedStyleSheets where supported, falling back
      // to a <style> tag. Check both surfaces.
      const sheets = (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] })
        .adoptedStyleSheets ?? [];
      const styleTag = el.shadowRoot!.querySelector('style');
      const allCss = [
        ...sheets.flatMap((s) => Array.from(s.cssRules ?? []).map((r) => r.cssText)),
        styleTag?.textContent ?? '',
      ].join('\n');
      expect(allCss).to.include('display: block');
      expect(allCss).to.include('contain: layout paint');
    });
  });

  describe('default property values (DEFAULT_CONFIG)', () => {
    let el: AgentableCanvasElement;
    beforeEach(async () => {
      el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
    });

    it('tenant defaults to "default"', () => {
      expect(el.tenant).to.equal('default');
    });
    it('primaryColor defaults to "#3B82F6"', () => {
      expect(el.primaryColor).to.equal('#3B82F6');
    });
    it('welcomeMessage defaults to "Hi! How can I help?"', () => {
      expect(el.welcomeMessage).to.equal('Hi! How can I help?');
    });
    it('apiEndpoint defaults to "/api"', () => {
      expect(el.apiEndpoint).to.equal('/api');
    });
    it('voiceEnabled defaults to true', () => {
      expect(el.voiceEnabled).to.equal(true);
    });
    it('snapGrid defaults to true', () => {
      expect(el.snapGrid).to.equal(true);
    });
    it('systemPrompt defaults to empty string', () => {
      expect(el.systemPrompt).to.equal('');
    });
    it('voiceGreeting defaults to empty string', () => {
      expect(el.voiceGreeting).to.equal('');
    });
  });

  describe('attribute → property reflection', () => {
    it('reflects tenant attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount tenant="acme"></agentable-canvas>`
      );
      expect(el.tenant).to.equal('acme');
    });

    it('reflects primary-color attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount primary-color="#0D7377"></agentable-canvas>`
      );
      expect(el.primaryColor).to.equal('#0D7377');
    });

    it('reflects welcome-message attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount welcome-message="Hello!"></agentable-canvas>`
      );
      expect(el.welcomeMessage).to.equal('Hello!');
    });

    it('reflects api-endpoint attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount api-endpoint="/v2/api"></agentable-canvas>`
      );
      expect(el.apiEndpoint).to.equal('/v2/api');
    });

    it('reflects voice-enabled boolean attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      // Boolean attribute presence
      const el2 = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount voice-enabled></agentable-canvas>`
      );
      expect(el2.voiceEnabled).to.equal(true);
      // The default is also true; verify property surfaces correctly either way.
      expect(el.voiceEnabled).to.equal(true);
    });

    it('reflects snap-grid boolean attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount snap-grid></agentable-canvas>`
      );
      expect(el.snapGrid).to.equal(true);
    });

    it('reflects system-prompt attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount system-prompt="You are Riley."></agentable-canvas>`
      );
      expect(el.systemPrompt).to.equal('You are Riley.');
    });

    it('reflects voice-greeting attribute', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount voice-greeting="Hi there!"></agentable-canvas>`
      );
      expect(el.voiceGreeting).to.equal('Hi there!');
    });
  });

  describe('runtime property updates trigger update()', () => {
    it('changing tenant triggers an update cycle', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount tenant="default"></agentable-canvas>`
      );
      await elementUpdated(el);
      el.tenant = 'acme';
      await elementUpdated(el);
      expect(el.tenant).to.equal('acme');
    });

    it('changing systemPrompt triggers an update cycle', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      el.systemPrompt = 'New persona';
      await elementUpdated(el);
      expect(el.systemPrompt).to.equal('New persona');
    });

    it('changing voiceGreeting triggers an update cycle', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      el.voiceGreeting = 'Welcome back';
      await elementUpdated(el);
      expect(el.voiceGreeting).to.equal('Welcome back');
    });
  });

  describe('brand-token cascade (M2.5 dual-form contract)', () => {
    it('applies dual-form CSS custom properties on firstUpdated', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount primary-color="#FF0000"></agentable-canvas>`
      );
      await elementUpdated(el);
      expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('#FF0000');
      expect(el.style.getPropertyValue('--landi-color-primary-hsl')).to.equal('0 100% 50%');
    });

    it('re-runs _applyBrandTokens when primaryColor changes at runtime', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount primary-color="#FF0000"></agentable-canvas>`
      );
      await elementUpdated(el);
      el.primaryColor = '#00FF00';
      await elementUpdated(el);
      // BOTH forms must resync — the architect-reviewer M2.5 critical bug.
      expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('#00FF00');
      expect(el.style.getPropertyValue('--landi-color-primary-hsl')).to.equal('120 100% 50%');
    });

    it('warns but does not crash on invalid primary-color (M2.6 W4)', async () => {
      // CRITICAL ORDERING: patch console.warn BEFORE fixture(). The
      // `_applyBrandTokens` call that emits the warn fires inside
      // `firstUpdated`, which runs during fixture setup — so any patch
      // installed AFTER `await fixture(...)` returns would miss the
      // emission. (Architect-reviewer F.7.3 expansion WARNING.)
      const warnings: unknown[][] = [];
      const origWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args);
      };
      let el: AgentableCanvasElement | null = null;
      try {
        el = await fixture<AgentableCanvasElement>(
          html`<agentable-canvas data-skip-react-mount primary-color="teal"></agentable-canvas>`
        );
        await elementUpdated(el);
        expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('teal');
        expect(el.style.getPropertyValue('--landi-color-primary-hsl')).to.equal('');
        const matched = warnings.some((args) =>
          String(args[0] ?? '').includes('not a valid hex')
        );
        expect(matched, 'console.warn fired about invalid hex during firstUpdated')
          .to.equal(true);
      } finally {
        console.warn = origWarn;
      }
    });
  });

  describe('lifecycle: firstUpdated mounts React', () => {
    it('mount target receives a React-rendered child after firstUpdated', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      // Allow microtasks for createRoot + render to flush.
      await new Promise((r) => setTimeout(r, 50));
      const mount = el.shadowRoot!.querySelector<HTMLDivElement>('.agentable-canvas-mount');
      expect(mount, 'mount node exists').to.exist;
      // After React mounts, the mount div is no longer empty.
      expect(mount!.childElementCount, 'React rendered into mount').to.be.greaterThan(0);
    });
  });

  describe('lifecycle: disconnectedCallback', () => {
    it('unmounts React root when removed from DOM', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      await elementUpdated(el);
      await new Promise((r) => setTimeout(r, 50));

      // Remove from DOM — disconnectedCallback unmounts React.
      el.remove();
      // Inspect private _root via index access (component test access).
      const internalRoot = (el as unknown as { _root: unknown })._root;
      expect(internalRoot, 'React root cleared on disconnect').to.equal(null);
    });
  });

  describe('public API: voice events', () => {
    it('startVoiceCall dispatches landi:voice-start-requested (bubbles, composed)', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      let received: Event | null = null;
      el.addEventListener('landi:voice-start-requested', (e) => {
        received = e;
      });
      el.startVoiceCall();
      expect(received, 'event fired').to.exist;
      expect(received!.bubbles).to.equal(true);
      expect(received!.composed).to.equal(true);
    });

    it('endVoiceCall dispatches landi:voice-end-requested (bubbles, composed)', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount></agentable-canvas>`
      );
      let received: Event | null = null;
      el.addEventListener('landi:voice-end-requested', (e) => {
        received = e;
      });
      el.endVoiceCall();
      expect(received, 'event fired').to.exist;
      expect(received!.bubbles).to.equal(true);
      expect(received!.composed).to.equal(true);
    });
  });

  describe('React root preservation across prop changes', () => {
    it('does NOT recreate the React root when tenant changes (kernel state preserved)', async () => {
      const el = await fixture<AgentableCanvasElement>(
        html`<agentable-canvas data-skip-react-mount tenant="default"></agentable-canvas>`
      );
      await elementUpdated(el);
      await new Promise((r) => setTimeout(r, 50));
      const rootBefore = (el as unknown as { _root: unknown })._root;
      el.tenant = 'acme';
      await elementUpdated(el);
      const rootAfter = (el as unknown as { _root: unknown })._root;
      expect(rootAfter, 'same root reference reused').to.equal(rootBefore);
    });
  });
});
