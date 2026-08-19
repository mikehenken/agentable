/**
 * integration: auto-mount scan + shared session + open_panel slot placement.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createCareerPanelDefinitions } from '../../packages/career-pack/src/index';
import { scanAutoMountTargets } from '../../src/embed/autoMountScan';
import { PanelOnlyEngine } from '../../src/embed/panel/panelOnlyEngine';
import { createCanvasHost } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { ensurePageSession } from '../../src/session/pageSession';
import { ensurePageSlotRegistry } from '../../src/session/pageSlots';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

async function waitForPanels(root: ParentNode): Promise<void> {
  await customElements.whenDefined('agentable-panel');
  const panels = root.querySelectorAll('agentable-panel');
  await Promise.all([...panels].map((panel) => (panel as AgentablePanelElement).updateComplete));
}

describe('auto-mount scan — shared session integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('joins mounted panels into one page session', async () => {
    document.body.innerHTML = `
      <div data-agentable-panel="open-positions" data-skip-react-mount></div>
      <div data-agentable-panel="applications" data-skip-react-mount></div>
    `;

    const session = ensurePageSession;
    scanAutoMountTargets(document);
    await waitForPanels(document.body);

    const participants = session().getSnapshot().participantIds;
    expect(participants.length).toBe(2);
    expect(participants.every((id) => id.startsWith('panel-embed-'))).toBe(true);
  });

  it('open_panel targets a named slot registered by auto-mount scan', async () => {
    document.body.innerHTML = '<section data-agentable-slot="sidebar"></section>';
    scanAutoMountTargets(document);

    const engine = new PanelOnlyEngine();
    const definitions = createCareerPanelDefinitions();
    const registry = createPanelRegistry(definitions);
    const host = createCanvasHost({
      engine,
      panels: definitions,
    });
    const runtime = createPanelToolRuntime(host, registry);

    const result = await runtime.openPanel('open-positions', undefined, 'sidebar');
    expect(result.ok).toBe(true);

    const slotTarget = ensurePageSlotRegistry().get('sidebar');
    expect(slotTarget).not.toBeNull();
    const panel =
      slotTarget?.tagName.toLowerCase() === 'agentable-panel'
        ? slotTarget: slotTarget?.querySelector('agentable-panel');
    expect(panel?.getAttribute('panel')).toBe('open-positions');
    expect(engine.lastOpen?.slot).toBe('sidebar');
  });
});
