/**
 * Core whiteboard embed wiring — chat-only default + provider injection.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { resolveWhiteboardEmbedWiring, type ResolveWhiteboardEmbedWiringState } from '../../src/embed/whiteboard/resolveWhiteboardEmbedWiring';
import {
  registerWhiteboardWiringProvider,
  resetWhiteboardWiringProviders,
} from '../../src/embed/whiteboard/whiteboardWiringProviderRegistry';
import type { WhiteboardWiringProviderResult } from '../../src/embed/whiteboard/whiteboardWiringProviderRegistry';

describe('resolveWhiteboardEmbedWiring (core)', () => {
  afterEach(() => {
    resetWhiteboardWiringProviders();
  });

  it('returns chat-only wiring when no provider or injection', () => {
    const { wiring, activeProvider } = resolveWhiteboardEmbedWiring({
      configDocument: null,
      tenantConfig: { tenant: 'acme-demo' },
      panelDataRaw: null,
      tenant: 'acme-demo',
    });
    expect(activeProvider).toBeNull();
    expect(wiring.host).toBeUndefined();
    expect(wiring.navItems).toEqual([]);
    expect(Object.keys(wiring.panelLoaders).sort()).toEqual(['chat']);
    wiring.dispose();
  });

  it('prefers explicit injected wiring over providers', () => {
    registerWhiteboardWiringProvider(() => ({
      host: {} as never,
      navItems: [{ id: 'x', label: 'X', icon: (() => null) as never, panelId: 'chat' }],
      panels: { chat: () => Promise.resolve({ default: (() => null) as never }) },
      dispose: () => {},
    }));

    const { wiring } = resolveWhiteboardEmbedWiring({
      configDocument: null,
      tenantConfig: { tenant: 'sandals' },
      panelDataRaw: null,
      tenant: 'sandals',
      injected: {
        navItems: [{ id: 'injected', label: 'Injected', icon: (() => null) as never, panelId: 'chat' }],
      },
    });

    expect(wiring.navItems.map((item) => item.id)).toEqual(['injected']);
    wiring.dispose();
  });

  it('re-resolves when a provider registers after an initial chat-only resolve', () => {
    let first: ResolveWhiteboardEmbedWiringState | null = null;

    first = resolveWhiteboardEmbedWiring({
      configDocument: null,
      tenantConfig: { tenant: 'sandals' },
      panelDataRaw: null,
      tenant: 'sandals',
    });
    expect(first.activeProvider).toBeNull();
    expect(Object.keys(first.wiring.panelLoaders)).toEqual(['chat']);

    registerWhiteboardWiringProvider((): WhiteboardWiringProviderResult | null => ({
      host: {} as never,
      navItems: [{ id: 'late', label: 'Late', icon: (() => null) as never, panelId: 'open-positions' }],
      panels: {
        chat: () => Promise.resolve({ default: (() => null) as never }),
        'open-positions': () => Promise.resolve({ default: (() => null) as never }),
      },
      dispose: () => {},
    }));

    const second = resolveWhiteboardEmbedWiring(
      {
        configDocument: null,
        tenantConfig: { tenant: 'sandals' },
        panelDataRaw: null,
        tenant: 'sandals',
      },
      first.activeProvider);

    expect(second.activeProvider).not.toBeNull();
    expect(Object.keys(second.wiring.panelLoaders).sort()).toEqual(['chat', 'open-positions']);
    first.wiring.dispose();
    second.wiring.dispose();
  });
});
