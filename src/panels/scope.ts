/**
 * Panel scope in persisted instance data. The typed `PanelScope` object
 * lives under the reserved `scope` key and is the source of truth; the
 * legacy reserved `__siteId` key (older hosts' spelling of the landi
 * contextId) stays readable through the fallback here. Plain `siteId` is
 * a host domain key, not a reserved key, so its handling stays with the
 * engine code that always owned it.
 */
import type { PanelScope } from './types';

/** Reserved instance-data key holding the typed scope object. */
export const PANEL_SCOPE_DATA_KEY = 'scope';

/** Every legacy reserved scope key and the typed field it maps to. */
export const LEGACY_PANEL_SCOPE_DATA_KEYS = {
  __siteId: 'contextId',
} as const satisfies Record<string, keyof PanelScope>;

export type LegacyPanelScopeDataKey = keyof typeof LEGACY_PANEL_SCOPE_DATA_KEYS;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Resolve the scope a panel instance is bound to. Typed fields under
 * `data.scope` win; the legacy `__siteId` key fills `contextId` when the
 * typed object leaves it unset.
 */
export function resolvePanelScope(
  data: Record<string, unknown> | undefined,
): PanelScope {
  const scope: PanelScope = {};
  if (!data) return scope;
  const typed = asRecord(data[PANEL_SCOPE_DATA_KEY]);

  const contextId = readString(typed?.contextId) ?? readString(data.__siteId);
  if (contextId !== undefined) scope.contextId = contextId;
  const entityId = readString(typed?.entityId);
  if (entityId !== undefined) scope.entityId = entityId;
  return scope;
}
