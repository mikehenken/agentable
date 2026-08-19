/**
 * rename-wave migration tests (A10 meta key, B10 persistence key).
 */
import { describe, expect, it } from 'vitest';
import { createShapeId } from 'tldraw';
import {
  CONTEXT_META_KEY,
  LEGACY_CONTEXT_META_KEY,
  getContextGroupMeta,
  findContextFrameGroupForShape,
  resolveContextIdFromPanelData,
} from '../../src/engines/tldraw/context/contextGroupApi';
import {
  isLegacyPersistenceKey,
  resolvePersistenceKeys,
  PERSISTENCE_KEY_PREFIX,
  LEGACY_PERSISTENCE_KEY_PREFIX,
} from '../../src/engines/tldraw/persistenceKey';

describe('context frame meta migration (A10)', () => {
  it('reads legacy landiContextGroup meta from persisted snapshots', () => {
    const shape = {
      type: 'frame',
      meta: { [LEGACY_CONTEXT_META_KEY]: { kind: 'site', id: 'site-legacy-1' } },
    };
    expect(getContextGroupMeta(shape)).toEqual({ kind: 'site', id: 'site-legacy-1' });
  });

  it('prefers canonical agentableContextFrame meta when both keys exist', () => {
    const shape = {
      type: 'frame',
      meta: {
        [LEGACY_CONTEXT_META_KEY]: { kind: 'site', id: 'old' },
        [CONTEXT_META_KEY]: { kind: 'site', id: 'new' },
      },
    };
    expect(getContextGroupMeta(shape)).toEqual({ kind: 'site', id: 'new' });
  });

  it('writes canonical meta key on new frames', () => {
    expect(CONTEXT_META_KEY).toBe('agentableContextFrame');
    expect(LEGACY_CONTEXT_META_KEY).toBe('landiContextGroup');
  });

  it('resolves context id from legacy panel data siteId field', () => {
    expect(resolveContextIdFromPanelData({ siteId: 'site-1' })).toBe('site-1');
    expect(
      resolveContextIdFromPanelData({ scope: { contextId: 'ctx-2' } })).toBe('ctx-2');
  });

  it('finds context frame groups using legacy meta on child panels', () => {
    const frameId = createShapeId('context:site:site-1');
    const panelId = createShapeId('panel:chat');
    const frames = new Map<string, unknown>([
      [
        frameId,
        {
          id: frameId,
          type: 'frame',
          props: { name: 'Site site-1' },
          meta: { [LEGACY_CONTEXT_META_KEY]: { kind: 'site', id: 'site-1' } },
        },
      ],
    ]);
    const panels = new Map<string, unknown>([
      [
        panelId,
        {
          id: panelId,
          type: 'panel',
          parentId: frameId,
          props: { panelId: 'chat', data: {} },
        },
      ],
    ]);
    const editor = {
      getShape: (id: string) => frames.get(id) ?? panels.get(id),
    };
    const ctx = findContextFrameGroupForShape(editor as never, panelId);
    expect(ctx?.siteId).toBe('site-1');
    expect(ctx?.frameId).toBe(frameId);
  });
});

describe('persistence key migration (B10)', () => {
  it('maps tenant scope to canonical agentable-canvas prefix', () => {
    expect(resolvePersistenceKeys('acme')).toEqual({
      persistenceKey: `${PERSISTENCE_KEY_PREFIX}acme`,
      legacyPersistenceKey: `${LEGACY_PERSISTENCE_KEY_PREFIX}acme`,
    });
  });

  it('maps tenant + host scope to both canonical and legacy keys', () => {
    expect(resolvePersistenceKeys('acme', 'site-9')).toEqual({
      persistenceKey: 'agentable-canvas-acme-site-9',
      legacyPersistenceKey: 'career-whiteboard-acme-site-9',
    });
  });

  it('detects legacy career-whiteboard keys for hydration fallback', () => {
    expect(isLegacyPersistenceKey('career-whiteboard-demo')).toBe(true);
    expect(isLegacyPersistenceKey('agentable-canvas-demo')).toBe(false);
  });
});
