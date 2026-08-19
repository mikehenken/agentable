/**
 * DOM workspace engine component tests.
 *
 * Covers region layout, tab switching, and drawer collapse at breakpoints.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DomWorkspaceShell,
  __resetDomEngineForTests__,
  createDomEngine,
  DOM_TABLET_MEDIA_QUERY,
} from '../../src/engines/dom';
import { DOM_SPLIT_SIZE_PROPS } from '../../src/engines/dom/components/DomRegionLayout';

function mockMatchMedia(compact: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn.mockImplementation((query: string) => ({
      matches: query === DOM_TABLET_MEDIA_QUERY ? compact: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('DOM workspace engine — region layout', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  it('uses string percentage size props for react-resizable-panels v4', () => {
    expect(DOM_SPLIT_SIZE_PROPS.sidebarMinSize).toBe('18');
    expect(DOM_SPLIT_SIZE_PROPS.sidebarMaxSize).toBe('42');
    expect(DOM_SPLIT_SIZE_PROPS.mainMinSize).toBe('40');
    for (const value of Object.values(DOM_SPLIT_SIZE_PROPS)) {
      expect(typeof value).toBe('string');
      expect(Number.isNaN(Number(value))).toBe(false);
    }
  });

  it('renders horizontal split with main and sidebar regions on wide viewports', () => {
    mockMatchMedia(false);
    const engine = createDomEngine();
    engine.openPanel({ panelId: 'main-panel', position: { x: 0, y: 0 }, size: { w: 400, h: 300 } });
    engine.openPanel({ panelId: 'side-panel', position: { x: 1, y: 0 }, size: { w: 280, h: 300 } });

    const { container } = render(<DomWorkspaceShell engine={engine} />);

    expect(container.querySelector('[data-dom-layout="split"]')).not.toBeNull();
    expect(container.querySelector('[data-dom-panel="main"]')).not.toBeNull();
    expect(container.querySelector('[data-dom-panel="sidebar"]')).not.toBeNull();
    expect(screen.getByText('main-panel')).toBeInTheDocument;
    expect(screen.getByText('side-panel')).toBeInTheDocument;
  });

  it('exports layout records with region and tab indices', () => {
    const engine = createDomEngine();
    engine.importLayout([
      {
        panelId: 'chat',
        contextId: null,
        position: { x: 0, y: 0 },
        size: { w: 320, h: 240 },
        pinned: false,
        origin: 'host',
      },
      {
        panelId: 'preview',
        contextId: 'ctx:1',
        position: { x: 1, y: 1 },
        size: { w: 280, h: 200 },
        pinned: false,
        origin: 'agent',
      },
    ]);

    expect(engine.exportLayout).toEqual([
      expect.objectContaining({
        panelId: 'chat',
        region: 'main',
        tabGroup: 0,
        order: 0,
        position: { x: 0, y: 0 },
      }),
      expect.objectContaining({
        panelId: 'preview',
        region: 'sidebar',
        tabGroup: 0,
        order: 1,
        position: { x: 1, y: 1 },
        contextId: 'ctx:1',
      }),
    ]);
  });
});

describe('DOM workspace engine — tab switching', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('switches active panel when a region tab is selected', () => {
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
    ]);

    render(<DomWorkspaceShell engine={engine} />);

    const mainRegion = screen.getByLabelText('main panels');
    expect(within(mainRegion).getByRole('tab', { name: 'alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('dom-panel-alpha')).toBeInTheDocument;

    fireEvent.click(within(mainRegion).getByRole('tab', { name: 'beta' }));

    expect(within(mainRegion).getByRole('tab', { name: 'beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('dom-panel-beta')).toBeInTheDocument;
    expect(engine.getDomLayout().activeTab.main).toBe(1);
  });
});

describe('DOM workspace engine — drawer collapse at breakpoints', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  it('collapses sidebar into a drawer on compact viewports', () => {
    mockMatchMedia(true);
    const engine = createDomEngine();
    engine.openPanel({ panelId: 'main-panel', position: { x: 0, y: 0 } });
    engine.openPanel({ panelId: 'side-panel', position: { x: 1, y: 0 } });

    const { container } = render(<DomWorkspaceShell engine={engine} />);

    expect(container.querySelector('[data-dom-layout="split"]')).toBeNull();
    expect(container.querySelector('.dom-region-layout--compact')).not.toBeNull();

    const drawer = container.querySelector('[data-dom-drawer="true"]');
    expect(drawer).not.toBeNull();
    expect(drawer).toHaveAttribute('data-dom-drawer-open', 'false');
    expect(screen.queryByText('side-panel')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /open sidebar/i }));
    expect(drawer).toHaveAttribute('data-dom-drawer-open', 'true');
    expect(screen.getByText('side-panel')).toBeInTheDocument;
  });
});

describe('DOM workspace engine — SPI camera:none', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  it('reports fixed camera and disables spatial capabilities', () => {
    const engine = createDomEngine();
    expect(engine.getCamera).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(engine.capabilities).toEqual({
      frames: false,
      draw: false,
      minimap: false,
      infinitePan: false,
      nativeSnapshots: false,
    });
    engine.setCamera({ x: 50, y: 50, zoom: 2 });
    expect(engine.getCamera).toEqual({ x: 0, y: 0, zoom: 1 });
    engine.destroy();
  });
});

describe('DOM workspace engine — exportSnapshot JSON safety', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  it('exportSnapshot returns JSON-serializable output and survives a JSON round-trip', () => {
    const engine = createDomEngine();
    engine.openPanel({
      panelId: 'chat',
      position: { x: 0, y: 0 },
      size: { w: 320, h: 240 },
      data: {
        title: 'Chat',
        tags: ['a', 'b'],
        nested: { flag: true, count: 3 },
        contextRef: 'ctx:1',
      },
    });
    engine.openPanel({
      panelId: 'files',
      position: { x: 1, y: 0 },
      size: { w: 280, h: 200 },
    });

    const snapshot = engine.exportSnapshot();

    // JSON.stringify throws on non-serializable values (functions, symbols,
    // bigints, circular refs); a clean round-trip proves exportSnapshot
    // returns real JsonObject data rather than only satisfying the type at
    // the declaration site.
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(roundTripped).toEqual(snapshot);

    const engine2 = createDomEngine();
    engine2.importSnapshot(roundTripped);
    expect(engine2.exportSnapshot()).toEqual(snapshot);
    engine2.destroy();
    engine.destroy();
  });
});
