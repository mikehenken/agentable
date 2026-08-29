/**
 * auto-mount scan unit coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scanAutoMountTargets,
  startAutoMountObserver,
  DATA_MOUNTED_ATTR,
  DATA_LAZY_PENDING_ATTR,
  __disconnectLazyMountForTests__,
} from '../../src/embed/autoMountScan';
import {
  readMountConfigFromPlaceholder,
  resolvePanelIdFromPlaceholder,
} from '../../src/embed/mountAgentablePanel';
import { ensurePageSlotRegistry } from '../../src/session/pageSlots';
import { ensurePageSession } from '../../src/session/pageSession';
import '../../src/embed/agentable-panel';
import type { AgentablePanelElement } from '../../src/embed/agentable-panel';

import { PANEL_EMBED_SKELETON_CLASS } from '../../src/embed/lazyHydration';

type IntersectionCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observe = vi.fn((target: Element) => {
    this.targets.add(target);
  });
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn().mockReturnValue([]);
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];

  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  static reset(): void {
    MockIntersectionObserver.instances = [];
  }

  static emitFor(target: Element, isIntersecting: boolean): void {
    for (const instance of MockIntersectionObserver.instances) {
      if (!instance.targets.has(target)) {
        continue;
      }
      instance.callback(
        [
          {
            isIntersecting,
            target,
            intersectionRatio: isIntersecting ? 1 : 0,
          } as IntersectionObserverEntry,
        ],
        instance as unknown as IntersectionObserver);
    }
  }
}

async function waitForAgentablePanel(element: Element | null | undefined): Promise<AgentablePanelElement | null> {
  if (element === null || element === undefined) {
    return null;
  }
  await customElements.whenDefined('agentable-panel');
  const panel =
    element instanceof HTMLElement && element.tagName.toLowerCase() === 'agentable-panel'
      ? (element as AgentablePanelElement) : element.querySelector<AgentablePanelElement>('agentable-panel');
  if (panel) {
    await panel.updateComplete;
  }
  return panel;
}

describe('autoMountScan — attribute mapping', () => {
  it('resolves panel id from data-panel or marker value', () => {
    const byPanel = document.createElement('div');
    byPanel.setAttribute('data-agentable-panel', '');
    byPanel.setAttribute('data-panel', 'open-positions');
    expect(resolvePanelIdFromPlaceholder(byPanel)).toBe('open-positions');

    const byMarker = document.createElement('div');
    byMarker.setAttribute('data-agentable-panel', 'applications');
    expect(resolvePanelIdFromPlaceholder(byMarker)).toBe('applications');
  });

  it('maps data-* branding attributes onto mount config', () => {
    const host = document.createElement('div');
    host.setAttribute('data-agentable-panel', 'open-positions');
    host.setAttribute('data-config-url', '/config/archipelago-career.json');
    host.setAttribute('data-primary-color', '#0077B6');
    host.setAttribute('data-slot-name', 'sidebar');
    host.setAttribute('data-lazy-hydrate', '');

    expect(readMountConfigFromPlaceholder(host)).toEqual({
      panelId: 'open-positions',
      configUrl: '/config/archipelago-career.json',
      primaryColor: '#0077B6',
      slotName: 'sidebar',
      lazyHydrate: true,
    });
  });
});

describe('autoMountScan — scan lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    MockIntersectionObserver.reset();
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const host of document.querySelectorAll(`[${DATA_LAZY_PENDING_ATTR}]`)) {
      if (host instanceof HTMLElement) {
        __disconnectLazyMountForTests__(host);
      }
    }
  });

  it('mounts panel placeholders and registers named slots', async () => {
    document.body.innerHTML = `
      <div data-agentable-panel="open-positions" data-config-url="/cfg.json" data-skip-react-mount></div>
      <aside data-agentable-slot="sidebar"></aside>
    `;

    const sessionBefore = ensurePageSession().sessionId;
    const result = scanAutoMountTargets(document);

    expect(result.panelsMounted).toBe(1);
    expect(result.slotsRegistered).toBe(1);

    const host = document.querySelector('[data-agentable-panel]');
    expect(host?.hasAttribute(DATA_MOUNTED_ATTR)).toBe(true);
    const panel = await waitForAgentablePanel(host);
    expect(panel?.getAttribute('panel')).toBe('open-positions');

    const slots = ensurePageSlotRegistry;
    expect(slots().get('sidebar')).not.toBeNull();
    expect(ensurePageSession().sessionId).toBe(sessionBefore);
  });

  it('is idempotent for already-mounted placeholders', () => {
    document.body.innerHTML =
      '<div data-agentable-panel="open-positions"></div>';

    const first = scanAutoMountTargets(document);
    const second = scanAutoMountTargets(document);

    expect(first.panelsMounted).toBe(1);
    expect(second.panelsMounted).toBe(0);
    expect(document.querySelectorAll('agentable-panel')).toHaveLength(1);
  });

  it('observes late-added placeholders', async () => {
    const disconnect = startAutoMountObserver(document.documentElement);

    const host = document.createElement('div');
    host.setAttribute('data-agentable-panel', 'applications');
    host.setAttribute('data-skip-react-mount', '');
    document.body.appendChild(host);

    await vi.waitUntil(() => host.querySelector('agentable-panel') !== null,
      { timeout: 3000, interval: 20 });

    const panel = await waitForAgentablePanel(host);
    expect(panel?.getAttribute('panel')).toBe('applications');
    disconnect();
  });

  it('defers lazy placeholders until intersection, then mounts panel', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-agentable-panel', 'open-positions');
    host.setAttribute('data-lazy-hydrate', '');
    host.setAttribute('data-skip-react-mount', '');
    document.body.appendChild(host);

    const result = scanAutoMountTargets(document);
    expect(result.panelsMounted).toBe(0);
    expect(result.panelsDeferred).toBe(1);
    expect(host.hasAttribute(DATA_MOUNTED_ATTR)).toBe(false);
    expect(host.hasAttribute(DATA_LAZY_PENDING_ATTR)).toBe(true);
    expect(host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`)).not.toBeNull();
    expect(host.querySelector('agentable-panel')).toBeNull();

    MockIntersectionObserver.emitFor(host, true);
    const panel = await waitForAgentablePanel(host);
    expect(host.hasAttribute(DATA_MOUNTED_ATTR)).toBe(true);
    expect(host.hasAttribute(DATA_LAZY_PENDING_ATTR)).toBe(false);
    expect(host.querySelector(`.${PANEL_EMBED_SKELETON_CLASS}`)).toBeNull();
    expect(panel?.getAttribute('panel')).toBe('open-positions');
    expect(panel?.hasAttribute('lazy-hydrate')).toBe(false);
  });
});
