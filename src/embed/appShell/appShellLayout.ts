/**
 * Default DOM app-shell placement and layout persistence for the
 * `<agentable-app-shell>` embed. Pure functions only: no DOM
 * globals, no React, no engine instance, so behavior is unit-testable in
 * isolation from both the Lit shell and the DOM workspace engine.
 *
 * Persists the DOM engine's *native* snapshot (`engine.exportSnapshot`
 * `engine.importSnapshot`), not the engine-agnostic `WorkspaceLayoutRecord[]`
 * transport (`engine.exportLayout` `engine.importLayout`). The
 * agnostic transport carries only panel placement (region, tab group,
 * order) so it round-trips across engines that share no other structure;
 * it deliberately drops DOM-engine-only UI state (which tab is active per
 * region, the sidebar split percentage, whether the drawer is open). The
 * native snapshot carries all of it, which is what "layout survives
 * reload" means for this example: not just which panels are open, but
 * which tab you were looking at.
 */
import type { EnginePanelPlacement } from '../../engine/types';
import type { JsonObject } from '../../panels/types';

/** Minimal storage seam; satisfied by `window.localStorage` or a test double. */
export interface AppShellStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = 'agentable-app-shell:';

/** Namespaced localStorage key for one tenant's app-shell layout. */
export function appShellStorageKey(tenant: string): string {
  const trimmed = tenant.trim();
  return `${STORAGE_PREFIX}${trimmed.length > 0 ? trimmed: 'default'}`;
}

/**
 * Default career-pack placement: two tabs in `main` (the primary reading
 * column) and two tabs in `sidebar` (secondary reference panels). Exercises
 * both multi-region and multi-tab-per-region DOM workspace placement with
 * the same four unmodified career-pack `PanelDefinition`s.
 */
export function buildDefaultAppShellPlacements(): readonly EnginePanelPlacement[] {
  return [
    { panelId: 'open-positions', region: 'main', order: 0 },
    { panelId: 'growth-paths', region: 'main', order: 1 },
    { panelId: 'applications', region: 'sidebar', order: 0 },
    { panelId: 'resources', region: 'sidebar', order: 1 },
  ];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Defensive top-level shape check only: `{ version: 1, panels: [...] }`.
 * Mirrors the guard `snapshotFromNativeExport` (the engine's own codec)
 * applies first; sub-field defects (a malformed panel entry, an
 * out-of-range `activeTab`) are the engine's own responsibility to
 * tolerate on import, not this module's to pre-validate. This function
 * only needs to reject corrupted or unrelated JSON before it ever reaches
 * the engine.
 */
function looksLikeDomEngineSnapshot(value: unknown): value is JsonObject {
  return isPlainObject(value) && value.version === 1 && Array.isArray(value.panels);
}

/**
 * Read a previously saved native snapshot for `key`. Returns `null` for
 * anything that is not a well-formed `{ version: 1, panels: [...] }`
 * object (missing key, corrupted JSON, unrelated JSON shape), so the
 * caller falls back to `buildDefaultAppShellPlacements` instead of
 * importing garbage.
 */
export function loadStoredAppShellLayout(
  storage: AppShellStorageLike,
  key: string): JsonObject | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null || raw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return looksLikeDomEngineSnapshot(parsed) ? parsed: null;
}

/** Persist the current native snapshot. Swallows storage errors (quota, private mode, disabled). */
export function saveAppShellLayout(
  storage: AppShellStorageLike,
  key: string,
  snapshot: JsonObject): void {
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
     // Best-effort persistence; a full or unavailable store must not crash the workspace.
  }
}
