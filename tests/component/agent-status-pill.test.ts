import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import '../../src/embed/widgets/agent-status-pill';
import {
  ensureAgentStatusKernel,
  __resetAgentStatusKernelForTests__,
} from '../../src/shared/agentStatusKernel';
import type { AgentStatusPillElement } from '../../src/embed/widgets/agent-status-pill';

describe('<agent-status-pill>', () => {
  beforeEach(() => {
    __resetAgentStatusKernelForTests__();
    ensureAgentStatusKernel();
  });

  it('renders running state with spinner', async () => {
    const el = await fixture<AgentStatusPillElement>(
      html`<agent-status-pill agent-id="concierge"></agent-status-pill>`);
    await elementUpdated(el);

    ensureAgentStatusKernel().agents._publish({
      agentId: 'concierge',
      label: 'Concierge',
      status: 'running',
      task: 'Searching',
    });
    await elementUpdated(el);

    expect(el.shadowRoot?.querySelector('.spinner')).to.exist;
    expect(el.shadowRoot?.textContent).to.contain('Working');
  });

  it('dispatches landi:agent-status-changed on transitions', async () => {
    const el = await fixture<AgentStatusPillElement>(
      html`<agent-status-pill agent-id="concierge"></agent-status-pill>`);
    await elementUpdated(el);

    let changed: CustomEvent | null = null;
    el.addEventListener('landi:agent-status-changed', (event) => {
      changed = event as CustomEvent;
    });

    ensureAgentStatusKernel().agents._publish({
      agentId: 'concierge',
      label: 'Concierge',
      status: 'running',
    });
    await elementUpdated(el);

    expect(changed).to.exist;
    expect(changed!.detail.status).to.equal('running');
  });

  it('hides when hide-when-idle and no agents registered', async () => {
    const el = await fixture<AgentStatusPillElement>(
      html`<agent-status-pill hide-when-idle></agent-status-pill>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector('.pill')).to.equal(null);
  });
});
