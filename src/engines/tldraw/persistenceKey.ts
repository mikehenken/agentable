/**
 * tldraw IndexedDB persistence key resolution (B10).
 * Writes use the agentable-canvas prefix; legacy career-whiteboard keys
 * remain readable for one minor version.
 */

export const PERSISTENCE_KEY_PREFIX = 'agentable-canvas-';
export const LEGACY_PERSISTENCE_KEY_PREFIX = 'career-whiteboard-';

export interface PersistenceKeyResolution {
  /** Canonical key tldraw writes to. */
  persistenceKey: string;
  /** Prior key to hydrate from when the canonical slot is empty. */
  legacyPersistenceKey: string;
}

function persistenceSuffix(tenant: string, persistenceScope?: string): string {
  return persistenceScope ? `${tenant}-${persistenceScope}` : tenant;
}

export function resolvePersistenceKeys(
  tenant: string,
  persistenceScope?: string,
): PersistenceKeyResolution {
  const suffix = persistenceSuffix(tenant, persistenceScope);
  return {
    persistenceKey: `${PERSISTENCE_KEY_PREFIX}${suffix}`,
    legacyPersistenceKey: `${LEGACY_PERSISTENCE_KEY_PREFIX}${suffix}`,
  };
}

/** True when `key` matches the pre-B10 career-whiteboard naming scheme. */
export function isLegacyPersistenceKey(key: string): boolean {
  return key.startsWith(LEGACY_PERSISTENCE_KEY_PREFIX);
}
