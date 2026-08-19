/**
 * WorkspaceLayoutRecord migration tests.
 */
import { describe, expect, it } from 'vitest';
import {
  CURRENT_LAYOUT_RECORD_VERSION,
  isLegacyDomLayoutRecord,
  migrateLayoutRecord,
  migrateLayoutRecords,
  normalizeLayoutRecord,
} from '../../src/engine/layoutRecordMigrate';
import type { WorkspaceLayoutRecord } from '../../src/engine/types';

const LEGACY_MAIN: WorkspaceLayoutRecord = {
  panelId: 'chat',
  contextId: null,
  position: { x: 0, y: 1 },
  size: { w: 320, h: 240 },
  pinned: false,
  origin: 'host',
};

const LEGACY_SIDEBAR: WorkspaceLayoutRecord = {
  panelId: 'preview',
  contextId: 'ctx:1',
  position: { x: 1, y: 0 },
  size: { w: 280, h: 200 },
  pinned: true,
  origin: 'agent',
};

describe('WorkspaceLayoutRecord migrations', () => {
  it('exposes the current layout record schema version', () => {
    expect(CURRENT_LAYOUT_RECORD_VERSION).toBe(2);
  });

  it('detects legacy DOM records without app-shell fields', () => {
    expect(isLegacyDomLayoutRecord(LEGACY_MAIN)).toBe(true);
    expect(
      isLegacyDomLayoutRecord({...LEGACY_MAIN,
        region: 'main',
        order: 1,
      })).toBe(false);
    expect(isLegacyDomLayoutRecord({
      panelId: 'spatial',
      contextId: null,
      position: { x: 120, y: 80 },
      size: { w: 300, h: 200 },
      pinned: false,
      origin: 'host',
    })).toBe(false);
  });

  it('migrates legacy position.x/y encoding to region, tabGroup, and order', () => {
    expect(migrateLayoutRecord(LEGACY_MAIN)).toEqual({...LEGACY_MAIN,
      region: 'main',
      tabGroup: 0,
      order: 1,
      position: { x: 0, y: 1 },
    });
    expect(migrateLayoutRecord(LEGACY_SIDEBAR)).toEqual({...LEGACY_SIDEBAR,
      region: 'sidebar',
      tabGroup: 0,
      order: 0,
      position: { x: 1, y: 0 },
    });
  });

  it('normalizes v2 records with aligned position', () => {
    const v2: WorkspaceLayoutRecord = {
      panelId: 'tools',
      contextId: null,
      region: 'sidebar',
      tabGroup: 0,
      order: 2,
      position: { x: 99, y: 99 },
      size: { w: 240, h: 180 },
      pinned: false,
      origin: 'host',
    };
    expect(normalizeLayoutRecord(v2)).toEqual({...v2,
      position: { x: 1, y: 2 },
    });
  });

  it('leaves spatial canvas records without region fields unchanged', () => {
    const spatial: WorkspaceLayoutRecord = {
      panelId: 'jobs',
      contextId: null,
      position: { x: 120, y: 80 },
      size: { w: 300, h: 200 },
      pinned: false,
      origin: 'host',
    };
    expect(migrateLayoutRecord(spatial)).toEqual(spatial);
    expect(normalizeLayoutRecord(spatial)).toEqual(spatial);
  });

  it('batch-migrates persisted layout arrays', () => {
    const migrated = migrateLayoutRecords([LEGACY_MAIN, LEGACY_SIDEBAR]);
    expect(migrated).toHaveLength(2);
    expect(migrated[0]?.region).toBe('main');
    expect(migrated[1]?.region).toBe('sidebar');
  });
});
