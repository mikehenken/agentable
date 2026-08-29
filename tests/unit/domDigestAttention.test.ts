/**
 * automated check: digest attention tiers derived from tab/visibility.
 */
import { describe, expect, it } from 'vitest';
import {
  applyBrowserAttentionSignals,
  buildDomDigestCompilerInput,
  buildDomDigestContexts,
  classifyDomPanelVisibility,
  computeDomPanelVisibilityRatio,
  deriveDomPanelAttention,
  mapDomVisibilityToAttention,
  type BrowserAttentionSignals,
} from '../../src/engines/dom/digestAttention';
import {
  __resetDomEngineForTests__,
  createDomEngine,
} from '../../src/engines/dom';
import type { DomLayoutSnapshot, DomPanelRecord } from '../../src/engines/dom/types';
import { createEmptyDomLayoutSnapshot } from '../../src/engines/dom/types';

function panel(
  partial: Pick<DomPanelRecord, 'panelId' | 'regionId' | 'tabIndex'> &
    Partial<Omit<DomPanelRecord, 'panelId' | 'regionId' | 'tabIndex'>>): DomPanelRecord {
  return {
    panelId: partial.panelId,
    regionId: partial.regionId,
    tabIndex: partial.tabIndex,
    size: partial.size ?? { w: 320, h: 240 },
    pinned: partial.pinned ?? false,
    contextId: partial.contextId ?? null,
    data: partial.data ?? {},
  };
}

function layout(overrides: Partial<DomLayoutSnapshot> = {}): DomLayoutSnapshot {
  return {...createEmptyDomLayoutSnapshot(),...overrides,
  };
}

describe('DOM digest attention tiers', () => {
  it('maps focused tab > visible > tabbed-hidden > closed to digest tiers', () => {
    expect(mapDomVisibilityToAttention('focused-tab')).toBe('focused');
    expect(mapDomVisibilityToAttention('visible')).toBe('visible');
    expect(mapDomVisibilityToAttention('tabbed-hidden')).toBe('background');
    expect(mapDomVisibilityToAttention('closed')).toBe('background');
  });

  it('classifies main active tab as focused-tab', () => {
    const snapshot = layout({
      panels: [
        panel({ panelId: 'alpha', regionId: 'main', tabIndex: 0 }),
        panel({ panelId: 'beta', regionId: 'main', tabIndex: 1 }),
      ],
      activeTab: { main: 0, sidebar: 0 },
    });

    expect(classifyDomPanelVisibility(snapshot.panels[0]!, snapshot)).toBe('focused-tab');
    expect(classifyDomPanelVisibility(snapshot.panels[1]!, snapshot)).toBe('tabbed-hidden');
    expect(deriveDomPanelAttention(snapshot.panels[0]!, snapshot)).toBe('focused');
    expect(deriveDomPanelAttention(snapshot.panels[1]!, snapshot)).toBe('background');
  });

  it('classifies sidebar active tab as visible when drawer is open', () => {
    const snapshot = layout({
      panels: [
        panel({ panelId: 'main-panel', regionId: 'main', tabIndex: 0 }),
        panel({ panelId: 'side-panel', regionId: 'sidebar', tabIndex: 0 }),
      ],
      sidebarDrawerOpen: true,
      activeTab: { main: 0, sidebar: 0 },
    });

    expect(deriveDomPanelAttention(snapshot.panels[0]!, snapshot)).toBe('focused');
    expect(deriveDomPanelAttention(snapshot.panels[1]!, snapshot)).toBe('visible');
  });

  it('classifies sidebar panels as closed when drawer is collapsed', () => {
    const snapshot = layout({
      panels: [panel({ panelId: 'side-panel', regionId: 'sidebar', tabIndex: 0 })],
      sidebarDrawerOpen: false,
    });

    expect(classifyDomPanelVisibility(snapshot.panels[0]!, snapshot)).toBe('closed');
    expect(deriveDomPanelAttention(snapshot.panels[0]!, snapshot)).toBe('background');
  });

  it('promotes selected panel to focused even on inactive tab', () => {
    const snapshot = layout({
      panels: [
        panel({ panelId: 'alpha', regionId: 'main', tabIndex: 0 }),
        panel({ panelId: 'beta', regionId: 'main', tabIndex: 1 }),
      ],
      activeTab: { main: 0, sidebar: 0 },
    });

    expect(
      deriveDomPanelAttention(snapshot.panels[1]!, snapshot, {
        selectedPanelIds: ['beta'],
      })).toBe('focused');
  });

  it('builds digest contexts with aggregated attention per context', () => {
    const snapshot = layout({
      panels: [
        panel({
          panelId: 'chat',
          regionId: 'main',
          tabIndex: 0,
          contextId: 'ctx:workspace',
          data: { title: 'Chat', type: 'chat' },
        }),
        panel({
          panelId: 'notes',
          regionId: 'main',
          tabIndex: 1,
          contextId: 'ctx:workspace',
          data: { title: 'Notes', type: 'document' },
        }),
        panel({
          panelId: 'preview',
          regionId: 'sidebar',
          tabIndex: 0,
          contextId: 'ctx:preview',
          data: { title: 'Preview', type: 'preview', origin: 'agent' },
        }),
      ],
      sidebarDrawerOpen: true,
      activeTab: { main: 0, sidebar: 0 },
    });

    const contexts = buildDomDigestContexts(snapshot);
    const workspace = contexts.find((entry) => entry.id === 'ctx:workspace');
    const preview = contexts.find((entry) => entry.id === 'ctx:preview');

    expect(workspace?.attention).toBe('focused');
    expect(workspace?.panels.map((entry) => entry.id).sort()).toEqual(['chat', 'notes']);
    expect(preview?.attention).toBe('visible');
    expect(preview?.panels[0]?.origin).toBe('agent');
  });

  it('reports viewport visibility only for active tabs in visible regions', () => {
    const snapshot = layout({
      panels: [
        panel({ panelId: 'alpha', regionId: 'main', tabIndex: 0 }),
        panel({ panelId: 'beta', regionId: 'main', tabIndex: 1 }),
        panel({ panelId: 'side', regionId: 'sidebar', tabIndex: 0 }),
      ],
      sidebarDrawerOpen: false,
      activeTab: { main: 0, sidebar: 0 },
    });

    expect(computeDomPanelVisibilityRatio(snapshot.panels[0]!, snapshot)).toBe(1);
    expect(computeDomPanelVisibilityRatio(snapshot.panels[1]!, snapshot)).toBe(0);
    expect(computeDomPanelVisibilityRatio(snapshot.panels[2]!, snapshot)).toBe(0);
  });

  it('engine getViewportInfo and getDigestCompilerInput stay aligned', () => {
    __resetDomEngineForTests__();
    const engine = createDomEngine();
    engine.importLayout([
      {
        panelId: 'alpha',
        contextId: null,
        position: { x: 0, y: 0 },
        size: { w: 300, h: 200 },
        pinned: false,
        origin: 'host',
      },
      {
        panelId: 'beta',
        contextId: null,
        position: { x: 0, y: 1 },
        size: { w: 300, h: 200 },
        pinned: false,
        origin: 'host',
      },
      {
        panelId: 'side',
        contextId: 'ctx:side',
        position: { x: 1, y: 0 },
        size: { w: 280, h: 200 },
        pinned: false,
        origin: 'agent',
      },
    ]);
    engine.setSidebarDrawerOpen(true);

    const viewport = engine.getViewportInfo;
    expect(viewport().panelVisibility.alpha).toBe(1);
    expect(viewport().panelVisibility.beta).toBe(0);
    expect(viewport().panelVisibility.side).toBe(1);

    const digestInput = engine.getDigestCompilerInput({ id: 'user-1', name: 'Ada' });
    expect(digestInput.user.id).toBe('user-1');
    expect(digestInput.contexts.some((context) => context.attention === 'focused')).toBe(true);
    expect(digestInput.contexts.some((context) => context.attention === 'visible')).toBe(true);
    expect(
      digestInput.contexts.every(
        (context) => context.attention === 'focused' || context.attention === 'visible')).toBe(true);

    engine.openPanel({ panelId: 'beta', position: { x: 0, y: 1 }, focus: true });
    const focusedDigest = engine.getDigestCompilerInput({ id: 'user-1' });
    const mainContext = focusedDigest.contexts.find((entry) => entry.id === 'region:main');
    expect(mainContext?.attention).toBe('focused');
    expect(engine.getSelectedPanelIds()).toEqual(['beta']);

    engine.destroy();
  });

  it('buildDomDigestCompilerInput returns compiler-ready user/contexts slice', () => {
    const snapshot = layout({
      panels: [panel({ panelId: 'only', regionId: 'main', tabIndex: 0 })],
    });
    const input = buildDomDigestCompilerInput(snapshot, { id: 'u1' });
    expect(input.contexts).toHaveLength(1);
    expect(input.contexts[0]?.attention).toBe('focused');
  });

  describe('browser tab-focus + document-visibility composition', () => {
    const visibleFocused: BrowserAttentionSignals = {
      documentVisibility: 'visible',
      windowFocused: true,
    };
    const visibleBlurred: BrowserAttentionSignals = {
      documentVisibility: 'visible',
      windowFocused: false,
    };
    const hiddenFocused: BrowserAttentionSignals = {
      documentVisibility: 'hidden',
      windowFocused: true,
    };
    const hiddenBlurred: BrowserAttentionSignals = {
      documentVisibility: 'hidden',
      windowFocused: false,
    };

    it('passes the panel tier through unchanged when the tab is focused and visible', () => {
      expect(applyBrowserAttentionSignals('focused', visibleFocused)).toBe('focused');
      expect(applyBrowserAttentionSignals('visible', visibleFocused)).toBe('visible');
      expect(applyBrowserAttentionSignals('background', visibleFocused)).toBe('background');
    });

    it('caps focused down to visible when the window is blurred but the document is visible', () => {
      expect(applyBrowserAttentionSignals('focused', visibleBlurred)).toBe('visible');
      expect(applyBrowserAttentionSignals('visible', visibleBlurred)).toBe('visible');
      expect(applyBrowserAttentionSignals('background', visibleBlurred)).toBe('background');
    });

    it('caps every tier to background when the document is hidden, regardless of window focus', () => {
      expect(applyBrowserAttentionSignals('focused', hiddenFocused)).toBe('background');
      expect(applyBrowserAttentionSignals('visible', hiddenFocused)).toBe('background');
      expect(applyBrowserAttentionSignals('focused', hiddenBlurred)).toBe('background');
      expect(applyBrowserAttentionSignals('background', hiddenBlurred)).toBe('background');
    });

    it('defaults to the visible+focused pass-through when no signals are supplied', () => {
      expect(applyBrowserAttentionSignals('focused')).toBe('focused');
    });

    it('derives the DOM panel attention tier deterministically from all three inputs', () => {
      const snapshot = layout({
        panels: [
          panel({ panelId: 'alpha', regionId: 'main', tabIndex: 0 }),
          panel({ panelId: 'beta', regionId: 'main', tabIndex: 1 }),
          panel({ panelId: 'side', regionId: 'sidebar', tabIndex: 0 }),
        ],
        sidebarDrawerOpen: true,
        activeTab: { main: 0, sidebar: 0 },
      });
      const [alpha, beta, side] = snapshot.panels;

      // Focused window + visible document: workspace visibility wins outright.
      expect(deriveDomPanelAttention(alpha!, snapshot, { signals: visibleFocused })).toBe(
        'focused');
      expect(deriveDomPanelAttention(side!, snapshot, { signals: visibleFocused })).toBe(
        'visible');
      expect(deriveDomPanelAttention(beta!, snapshot, { signals: visibleFocused })).toBe(
        'background');

      // Blurred window: the main active tab is capped from focused to visible;
      // tiers already at or below visible are unaffected.
      expect(deriveDomPanelAttention(alpha!, snapshot, { signals: visibleBlurred })).toBe(
        'visible');
      expect(deriveDomPanelAttention(side!, snapshot, { signals: visibleBlurred })).toBe(
        'visible');
      expect(deriveDomPanelAttention(beta!, snapshot, { signals: visibleBlurred })).toBe(
        'background');

      // Hidden document: every panel collapses to background, even the
      // main active tab and even a panel explicitly selected by the host.
      expect(
        deriveDomPanelAttention(alpha!, snapshot, {
          signals: hiddenFocused,
          selectedPanelIds: ['alpha'],
        })).toBe('background');
    });

    it('never raises the workspace-derived tier, only caps it, for every signal combination', () => {
      const rank: Record<'focused' | 'visible' | 'background', number> = {
        focused: 3,
        visible: 2,
        background: 1,
      };
      const baseTiers = ['focused', 'visible', 'background'] as const;
      const signalCombos: BrowserAttentionSignals[] = [
        visibleFocused,
        visibleBlurred,
        hiddenFocused,
        hiddenBlurred,
      ];

      for (const baseTier of baseTiers) {
        for (const signals of signalCombos) {
          const resolved = applyBrowserAttentionSignals(baseTier, signals);
          expect(rank[resolved]).toBeLessThanOrEqual(rank[baseTier]);
        }
      }
    });

    it('orders the three digest tiers focused-tab > visible > hidden', () => {
      expect(mapDomVisibilityToAttention('focused-tab')).toBe('focused');
      expect(mapDomVisibilityToAttention('visible')).toBe('visible');
      expect(mapDomVisibilityToAttention('closed')).toBe('background');
      const rank: Record<'focused' | 'visible' | 'background', number> = {
        focused: 3,
        visible: 2,
        background: 1,
      };
      expect(rank.focused).toBeGreaterThan(rank.visible);
      expect(rank.visible).toBeGreaterThan(rank.background);
    });
  });
});
