/**
 * Page slot registry unit coverage ( section 15).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensurePageSlotRegistry,
  __resetPageSlotsForTests__,
} from '../../src/session/pageSlots';
import '../../src/embed/agentable-panel';

describe('pageSlots — registry', () => {
  beforeEach(() => {
    __resetPageSlotsForTests__();
  });

  it('registers and resolves slot mount elements', () => {
    const registry = ensurePageSlotRegistry;
    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-agentable-slot', 'sidebar');

    const unregister = registry().register('sidebar', sidebar);
    expect(registry().get('sidebar')).toBe(sidebar);
    expect(registry().list).toEqual(['sidebar']);

    unregister();
    expect(registry().get('sidebar')).toBeNull();
  });

  it('mounts a panel into a registered slot container', async () => {
    const registry = ensurePageSlotRegistry;
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    registry().register('main', slot);

    const mounted = registry().mountPanel('main', {
      panelId: 'open-positions',
      slotName: 'main',
      skipReactMount: true,
    });
    expect(mounted?.tagName.toLowerCase()).toBe('agentable-panel');
    expect(mounted?.getAttribute('panel')).toBe('open-positions');
    expect(slot.querySelector('agentable-panel')).toBe(mounted);
  });

  it('updates an existing agentable-panel registered as the slot target', () => {
    const registry = ensurePageSlotRegistry;
    const panel = document.createElement('agentable-panel');
    panel.setAttribute('panel', 'applications');
    panel.setAttribute('slot-name', 'rail');
    registry().register('rail', panel);

    const mounted = registry().mountPanel('rail', { panelId: 'open-positions' });
    expect(mounted).toBe(panel);
    expect(panel.getAttribute('panel')).toBe('open-positions');
  });
});
