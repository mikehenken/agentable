/**
 * Component tests for `<agentable-panel lazy-hydrate>`.
 */
import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

describe('<agentable-panel lazy-hydrate>', () => {
  it('renders skeleton-first with status semantics', async () => {
    const el = await fixture<AgentablePanelElement>(
      html`<agentable-panel
        lazy-hydrate
        data-skip-react-mount
        panel="open-positions"
        style="display:block;width:320px;height:420px;margin-top:120vh"
      ></agentable-panel>`);
    await elementUpdated(el);

    const skeleton = el.shadowRoot?.querySelector('[data-testid="agentable-panel-embed-skeleton"]');
    expect(skeleton).to.not.equal(null);
    expect(skeleton?.getAttribute('role')).to.equal('status');
    expect(skeleton?.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot?.querySelector('.agentable-panel-mount')).to.equal(null);
  });

  it('does not expose interactive controls in skeleton mode', async () => {
    const el = await fixture<AgentablePanelElement>(
      html`<agentable-panel
        lazy-hydrate
        data-skip-react-mount
        panel="open-positions"
      ></agentable-panel>`);
    await elementUpdated(el);

    const controls = el.shadowRoot?.querySelectorAll('button, a, input, select, textarea');
    expect(controls?.length ?? 0).to.equal(0);
  });

  it('hydrates mount target when lazy-hydrate is cleared', async () => {
    const el = await fixture<AgentablePanelElement>(
      html`<agentable-panel
        lazy-hydrate
        data-skip-react-mount
        panel="open-positions"
      ></agentable-panel>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector('[data-testid="agentable-panel-embed-skeleton"]')).to.not.equal(null);

    el.removeAttribute('lazy-hydrate');
    await elementUpdated(el);
    await elementUpdated(el);

    expect(el.shadowRoot?.querySelector('.agentable-panel-mount')).to.not.equal(null);
    expect(el.shadowRoot?.querySelector('[data-testid="agentable-panel-embed-skeleton"]')).to.equal(null);
  });
});
