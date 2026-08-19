/**
 * DOM layout persistence round-trip tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { migrateLayoutRecords } from '../../src/engine/layoutRecordMigrate';
import { __resetDomEngineForTests__, createDomEngine } from '../../src/engines/dom';
import {
  importLayoutIntoSnapshot,
} from '../../src/engines/dom/layoutCodec';
import { createEmptyDomLayoutSnapshot } from '../../src/engines/dom/types';
import type { WorkspaceLayoutRecord } from '../../src/engine/types';

const SAMPLE_LAYOUT: WorkspaceLayoutRecord[] = [
  {
    panelId: 'chat',
    contextId: null,
    region: 'main',
    tabGroup: 0,
    order: 0,
    position: { x: 0, y: 0 },
    size: { w: 320, h: 240 },
    pinned: false,
    origin: 'host',
  },
  {
    panelId: 'preview',
    contextId: 'ctx:1',
    region: 'main',
    tabGroup: 0,
    order: 1,
    position: { x: 0, y: 1 },
    size: { w: 300, h: 200 },
    pinned: false,
    origin: 'agent',
  },
  {
    panelId: 'files',
    contextId: null,
    region: 'sidebar',
    tabGroup: 0,
    order: 0,
    position: { x: 1, y: 0 },
    size: { w: 280, h: 400 },
    pinned: true,
    origin: 'host',
  },
];

describe('DOM layout persistence round-trip', () => {
  afterEach(() => {
    __resetDomEngineForTests__();
  });

  it('exports v2 layout records with region, tabGroup, and order', () => {
    const engine = createDomEngine();
    engine.importLayout(SAMPLE_LAYOUT);

    expect(engine.exportLayout).toEqual(SAMPLE_LAYOUT);
  });

  it('round-trips through JSON persistence and migration', () => {
    const engine = createDomEngine();
    engine.importLayout(SAMPLE_LAYOUT);
    engine.setActiveTab('main', 1);

    const exported = engine.exportLayout;
    const persisted = JSON.parse(JSON.stringify(exported)) as WorkspaceLayoutRecord[];
    const restoredRecords = migrateLayoutRecords(persisted);

    const engine2 = createDomEngine();
    engine2.importLayout(restoredRecords);

    expect(engine2.exportLayout).toEqual(exported);
  });

  it('round-trips legacy v1 records without explicit region fields', () => {
    const legacy: WorkspaceLayoutRecord[] = [
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
    ];

    const engine = createDomEngine();
    engine.importLayout(legacy);
    const exported = engine.exportLayout;

    expect(exported).toEqual([
      expect.objectContaining({ panelId: 'alpha', region: 'main', order: 0, tabGroup: 0 }),
      expect.objectContaining({ panelId: 'beta', region: 'main', order: 1, tabGroup: 0 }),
    ]);

    const engine2 = createDomEngine();
    engine2.importLayout(migrateLayoutRecords(JSON.parse(JSON.stringify(legacy))));
    expect(engine2.exportLayout).toEqual(exported);
  });

  it('clamps activeTab when re-import reduces tab count', () => {
    const base = createEmptyDomLayoutSnapshot();
    base.activeTab.main = 5;

    const imported = importLayoutIntoSnapshot(base, [
      {
        panelId: 'solo',
        contextId: null,
        position: { x: 0, y: 0 },
        size: { w: 300, h: 200 },
        pinned: false,
        origin: 'host',
      },
    ]);

    expect(imported.activeTab.main).toBe(0);
    expect(imported.panels).toHaveLength(1);
  });
});
