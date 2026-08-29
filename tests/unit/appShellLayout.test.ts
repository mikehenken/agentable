/**
 * Pure-logic tests for the `<agentable-app-shell>` default placement and
 * localStorage layout persistence helpers. No DOM, no engine, no
 * React: these are plain functions over an injected storage seam.
 *
 * Persistence works over the DOM engine's *native* snapshot shape
 * (`{ version, panels, sidebarSplit, activeTab, sidebarDrawerOpen }`, what
 * `engine.exportSnapshot` `engine.importSnapshot` produce/consume),
 * not the engine-agnostic `WorkspaceLayoutRecord[]` transport: see the
 * module doc comment in `appShellLayout.ts` for why: the agnostic
 * transport drops which tab is active per region, the split percentage,
 * and drawer-open state, all of which "layout survives reload" needs.
 */
import { describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '../../src/panels/types';
import {
  appShellStorageKey,
  buildDefaultAppShellPlacements,
  loadStoredAppShellLayout,
  saveAppShellLayout,
  type AppShellStorageLike,
} from '../../src/embed/appShell/appShellLayout';

function createFakeStorage(seed: Record<string, string> = {}): AppShellStorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const VALID_SNAPSHOT: JsonObject = {
  version: 1,
  panels: [
    {
      panelId: 'open-positions',
      regionId: 'main',
      tabIndex: 0,
      size: { w: 320, h: 240 },
      pinned: false,
      contextId: null,
      data: {},
    },
    {
      panelId: 'growth-paths',
      regionId: 'main',
      tabIndex: 1,
      size: { w: 320, h: 240 },
      pinned: false,
      contextId: null,
      data: {},
    },
  ],
  sidebarSplit: 30,
  activeTab: { main: 1, sidebar: 0 },
  sidebarDrawerOpen: false,
};

describe('appShellStorageKey', () => {
  it('namespaces the key by tenant', () => {
    expect(appShellStorageKey('archipelago-resorts')).toBe('agentable-app-shell:archipelago-resorts');
  });

  it('trims whitespace around the tenant', () => {
    expect(appShellStorageKey(' archipelago-resorts ')).toBe('agentable-app-shell:archipelago-resorts');
  });

  it('falls back to "default" for an empty or whitespace-only tenant', () => {
    expect(appShellStorageKey('')).toBe('agentable-app-shell:default');
    expect(appShellStorageKey(' ')).toBe('agentable-app-shell:default');
  });
});

describe('buildDefaultAppShellPlacements', () => {
  it('places all four career panels, split across main and sidebar', () => {
    const placements = buildDefaultAppShellPlacements();
    expect(placements).toHaveLength(4);

    const byId = new Map(placements.map((placement) => [placement.panelId, placement]));
    expect(byId.get('open-positions')).toMatchObject({ region: 'main', order: 0 });
    expect(byId.get('growth-paths')).toMatchObject({ region: 'main', order: 1 });
    expect(byId.get('applications')).toMatchObject({ region: 'sidebar', order: 0 });
    expect(byId.get('resources')).toMatchObject({ region: 'sidebar', order: 1 });
  });

  it('assigns a stable, deterministic order per region (no duplicate orders within a region)', () => {
    const placements = buildDefaultAppShellPlacements();
    const mainOrders = placements.filter((p) => p.region === 'main').map((p) => p.order);
    const sidebarOrders = placements.filter((p) => p.region === 'sidebar').map((p) => p.order);
    expect(new Set(mainOrders).size).toBe(mainOrders.length);
    expect(new Set(sidebarOrders).size).toBe(sidebarOrders.length);
  });
});

describe('loadStoredAppShellLayout', () => {
  it('returns null when nothing is stored', () => {
    const storage = createFakeStorage();
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null for an empty string value', () => {
    const storage = createFakeStorage({ 'agentable-app-shell:default': '' });
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null for corrupted JSON', () => {
    const storage = createFakeStorage({ 'agentable-app-shell:default': '{not json' });
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null for valid JSON that is not a plain object', () => {
    const storage = createFakeStorage({ 'agentable-app-shell:default': '[1,2,3]' });
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null when version is not 1', () => {
    const storage = createFakeStorage({
      'agentable-app-shell:default': JSON.stringify({ version: 2, panels: [] }),
    });
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null when panels is not an array', () => {
    const storage = createFakeStorage({
      'agentable-app-shell:default': JSON.stringify({ version: 1, panels: 'nope' }),
    });
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('returns null when getItem throws (storage disabled private mode)', () => {
    const storage: AppShellStorageLike = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {},
    };
    expect(loadStoredAppShellLayout(storage, 'agentable-app-shell:default')).toBeNull();
  });

  it('accepts an empty panels array (a validly-shaped, if unusual, snapshot)', () => {
    const key = 'agentable-app-shell:default';
    const storage = createFakeStorage({
      [key]: JSON.stringify({ version: 1, panels: [], sidebarSplit: 30, activeTab: { main: 0, sidebar: 0 }, sidebarDrawerOpen: false }),
    });
    expect(loadStoredAppShellLayout(storage, key)).toEqual({
      version: 1,
      panels: [],
      sidebarSplit: 30,
      activeTab: { main: 0, sidebar: 0 },
      sidebarDrawerOpen: false,
    });
  });

  it('returns the parsed snapshot for a well-formed stored layout, including activeTab and sidebarSplit', () => {
    const key = 'agentable-app-shell:archipelago-resorts';
    const storage = createFakeStorage({ [key]: JSON.stringify(VALID_SNAPSHOT) });
    expect(loadStoredAppShellLayout(storage, key)).toEqual(VALID_SNAPSHOT);
  });
});

describe('saveAppShellLayout', () => {
  it('serializes the snapshot as JSON under the given key', () => {
    const storage = createFakeStorage();
    const key = 'agentable-app-shell:archipelago-resorts';
    saveAppShellLayout(storage, key, VALID_SNAPSHOT);
    expect(storage.data.get(key)).toBe(JSON.stringify(VALID_SNAPSHOT));
  });

  it('round-trips through loadStoredAppShellLayout, preserving activeTab', () => {
    const storage = createFakeStorage();
    const key = appShellStorageKey('archipelago-resorts');
    saveAppShellLayout(storage, key, VALID_SNAPSHOT);
    const loaded = loadStoredAppShellLayout(storage, key);
    expect(loaded).toEqual(VALID_SNAPSHOT);
    expect((loaded as typeof VALID_SNAPSHOT).activeTab).toEqual({ main: 1, sidebar: 0 });
  });

  it('swallows a thrown error from setItem (quota exceeded, disabled storage)', () => {
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    const storage: AppShellStorageLike = { getItem: () => null, setItem };
    expect(() => saveAppShellLayout(storage, 'k', VALID_SNAPSHOT)).not.toThrow();
    expect(setItem).toHaveBeenCalledOnce();
  });
});
