/**
 * `<agentable-panel lazy-hydrate>` vitest coverage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';
import { ensurePageSession } from '../../src/session/pageSession';

describe('agentable-panel — lazy hydration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows skeleton and defers page-session join until hydration', async () => {
    const panel = document.createElement('agentable-panel') as AgentablePanelElement;
    panel.setAttribute('lazy-hydrate', '');
    panel.setAttribute('data-skip-react-mount', '');
    panel.setAttribute('panel', 'open-positions');
    document.body.appendChild(panel);

    await panel.updateComplete;
    expect(panel.shadowRoot?.querySelector('[data-testid="agentable-panel-embed-skeleton"]')).not.toBeNull();
    expect(panel.shadowRoot?.querySelector('.agentable-panel-mount')).toBeNull();
    expect(ensurePageSession().getSnapshot().participantIds).toHaveLength(0);

    panel.removeAttribute('lazy-hydrate');
    panel.lazyHydrate = false;
    await panel.updateComplete;
    await panel.updateComplete;

    expect(panel.shadowRoot?.querySelector('.agentable-panel-mount')).not.toBeNull();
    expect(panel.shadowRoot?.querySelector('[data-testid="agentable-panel-embed-skeleton"]')).toBeNull();
    expect(ensurePageSession().getSnapshot().participantIds.length).toBeGreaterThan(0);
  });
});
