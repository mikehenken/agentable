/**
 * Component tests for `<agentable-app-shell>` (Lit shell → AppShellWorkspace,
 * the DOM workspace engine app-shell embed).
 *
 * Per web-components-ui §9.2: real browser via @web/test-runner + Playwright.
 * Uses no `career-data-url` attribute so every test runs against the
 * built-in `MINIMAL_CAREER_DATASET` fixture; no network fetch, no
 * dependency on the e2e static file server being up.
 */
import { fixture, expect, html, elementUpdated, oneEvent } from '@open-wc/testing';
import '../../src/embed/agentable-app-shell';
import type { AgentableAppShellElement } from '../../src/embed/agentable-app-shell';

describe('<agentable-app-shell>', () => {
  describe('registration & shadow DOM', () => {
    it('registers the custom element', () => {
      expect(customElements.get('agentable-app-shell')).to.exist;
    });

    it('mounts an open shadow root with a mount target', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell></agentable-app-shell>`);
      expect(el.shadowRoot?.mode).to.equal('open');
      expect(el.shadowRoot?.querySelector('.agentable-app-shell-mount')).to.exist;
    });

    it('exposes part="mount" for host styling', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell></agentable-app-shell>`);
      const mount = el.shadowRoot?.querySelector('[part="mount"]');
      expect(mount).to.exist;
      expect(mount?.classList.contains('agentable-app-shell-mount')).to.equal(true);
    });

    it('static styles include:host display:block', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell></agentable-app-shell>`);
      await elementUpdated(el);
      const sheets =
        (el.shadowRoot as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
      const styleTag = el.shadowRoot!.querySelector('style');
      const allCss = [...sheets.flatMap((sheet) => Array.from(sheet.cssRules ?? []).map((rule) => rule.cssText)),
        styleTag?.textContent ?? '',
      ].join('\n');
      expect(allCss).to.include('display: block');
    });
  });

  describe('attributes & defaults', () => {
    it('defaults tenant to archipelago-resorts', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell></agentable-app-shell>`);
      expect(el.tenant).to.equal('archipelago-resorts');
    });

    it('reflects tenant, locale, and career-data-url attributes to properties', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell
          tenant="northwind"
          locale="es"
          career-data-url="/fixtures/career.json"
        ></agentable-app-shell>`);
      expect(el.tenant).to.equal('northwind');
      expect(el.locale).to.equal('es');
      expect(el.careerDataUrl).to.equal('/fixtures/career.json');
    });

    it('applies dual-form brand tokens from primary-color', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell primary-color="#FF0000"></agentable-app-shell>`);
      await elementUpdated(el);
      expect(el.style.getPropertyValue('--landi-color-primary')).to.equal('#FF0000');
      expect(el.style.getPropertyValue('--landi-color-primary-hsl')).to.equal('0 100% 50%');
    });
  });

  describe('workspace-ready event', () => {
    it('dispatches agentable:workspace-ready with tenant + restored detail on first mount', async () => {
      const el = document.createElement('agentable-app-shell') as AgentableAppShellElement;
      el.setAttribute('tenant', 'archipelago-resorts-component-test');
      const eventPromise = oneEvent(el, 'agentable:workspace-ready');
      document.body.appendChild(el);
      const event = await eventPromise;
      expect(event.detail.tenant).to.equal('archipelago-resorts-component-test');
       // First mount for this tenant in a fresh browser storage area: no
       // saved layout yet, so the workspace seeds the default placement.
      expect(event.detail.restored).to.equal(false);
      document.body.removeChild(el);
    });
  });

  describe('DOM workspace engine layout', () => {
    it('renders the main/sidebar split with per-region tabs and no canvas surface', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell tenant="archipelago-resorts-layout-test"></agentable-app-shell>`);
      await oneEvent(el, 'agentable:workspace-ready');
      await elementUpdated(el);

      const root = el.shadowRoot!;
      expect(root.querySelector('[data-dom-engine="true"]')).to.exist;
      expect(root.querySelector('[data-camera="none"]')).to.exist;
      expect(root.querySelector('[data-dom-region="main"]')).to.exist;
      expect(root.querySelector('[data-dom-region="sidebar"]')).to.exist;
      expect(root.querySelector('[data-dom-tab="open-positions"]')).to.exist;
      expect(root.querySelector('[data-dom-tab="growth-paths"]')).to.exist;
      expect(root.querySelector('[data-dom-tab="applications"]')).to.exist;
      expect(root.querySelector('[data-dom-tab="resources"]')).to.exist;
       // No tldraw canvas, no `.tl-container` surface: this is the DOM engine, not the whiteboard.
      expect(root.querySelector('.tl-container')).to.not.exist;
      expect(root.querySelector('canvas')).to.not.exist;
    });

    it('renders the active main-region panel body via the schema renderer', async () => {
      const el = await fixture<AgentableAppShellElement>(
        html`<agentable-app-shell tenant="archipelago-resorts-body-test"></agentable-app-shell>`);
      await oneEvent(el, 'agentable:workspace-ready');
      await elementUpdated(el);
      const panel = el.shadowRoot!.querySelector('[data-testid="app-shell-panel-open-positions"]');
      expect(panel).to.exist;
      expect(panel!.querySelector('[data-testid="header"]')).to.exist;
    });
  });
});
