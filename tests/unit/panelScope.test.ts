/**
 * Mapping contract for `src/panels/scope.ts`: the typed scope object under
 * `data.scope` is the source of truth and the legacy reserved `__siteId`
 * key keeps resolving to `contextId` for documents older hosts wrote.
 */
import { describe, it, expect } from 'vitest';
import {
  LEGACY_PANEL_SCOPE_DATA_KEYS,
  PANEL_SCOPE_DATA_KEY,
  resolvePanelScope,
} from '../../src/panels/scope';

describe('legacy key catalog', () => {
  it('covers exactly the reserved scope keys in use', () => {
    expect(LEGACY_PANEL_SCOPE_DATA_KEYS).toEqual({ __siteId: 'contextId' });
  });
});

describe('resolvePanelScope', () => {
  it('resolves the legacy __siteId key to contextId', () => {
    expect(resolvePanelScope({ __siteId: 'site-1' })).toEqual({ contextId: 'site-1' });
  });

  it('reads the typed scope object', () => {
    const scope = resolvePanelScope({
      [PANEL_SCOPE_DATA_KEY]: { contextId: 'site-2', entityId: 'page-9' },
    });
    expect(scope).toEqual({ contextId: 'site-2', entityId: 'page-9' });
  });

  it('prefers the typed contextId over the legacy key', () => {
    const scope = resolvePanelScope({
      [PANEL_SCOPE_DATA_KEY]: { contextId: 'site-new' },
      __siteId: 'site-old',
    });
    expect(scope.contextId).toBe('site-new');
  });

  it('falls back to the legacy key when the typed value has the wrong type', () => {
    const scope = resolvePanelScope({
      [PANEL_SCOPE_DATA_KEY]: { contextId: 12 },
      __siteId: 'site-1',
    });
    expect(scope.contextId).toBe('site-1');
  });

  it('ignores non-string legacy values and non-object scope values', () => {
    expect(resolvePanelScope({ __siteId: 12 })).toEqual({});
    expect(resolvePanelScope({ [PANEL_SCOPE_DATA_KEY]: 'site-1' })).toEqual({});
  });

  it('returns an empty scope for missing or unrelated data', () => {
    expect(resolvePanelScope(undefined)).toEqual({});
    expect(resolvePanelScope({ siteId: 'plain-host-key' })).toEqual({});
  });
});
