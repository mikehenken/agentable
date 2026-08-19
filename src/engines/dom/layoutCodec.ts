/**

 * Converts between DOM region/tab placement and engine-neutral

 * WorkspaceLayoutRecord rows.

 */

import {

  layoutXFromAppShellRegion,

  migrateLayoutRecord,

} from '../../engine/layoutRecordMigrate';

import type { AppShellRegionId, WorkspaceLayoutRecord } from '../../engine/types';

import type { JsonObject } from '../../panels/types';

import { isPanelPinned, readPanelOrigin } from '../../panels/provenance';

import {

  createEmptyDomLayoutSnapshot,

  type DomLayoutSnapshot,

  type DomPanelRecord,

  type DomRegionId,

} from './types';



const DEFAULT_PANEL_SIZE = { w: 320, h: 240 };



const DOM_REGION_TO_APP_SHELL: Record<DomRegionId, AppShellRegionId> = {

  main: 'main',

  sidebar: 'sidebar',

};



const APP_SHELL_TO_DOM_REGION: Record<string, DomRegionId> = {
  main: 'main',
  sidebar: 'sidebar',
  right: 'sidebar',
  left: 'main',
};

/** Map unified app-shell region targeting to the default DOM split regions. */
export function domRegionFromAppShellRegion(region: AppShellRegionId): DomRegionId {
  return APP_SHELL_TO_DOM_REGION[region] ?? 'main';
}

export function domRegionFromEnginePlacement(request: {
  region?: AppShellRegionId;
  position?: { x: number; y: number };
}): DomRegionId {
  if (request.region !== undefined) {
    return domRegionFromAppShellRegion(request.region);
  }
  if (request.position !== undefined && request.position.x >= 1) {
    return 'sidebar';
  }
  return 'main';
}



function domRegionFromRecord(record: WorkspaceLayoutRecord): DomRegionId {

  const migrated = migrateLayoutRecord(record);

  if (migrated.region !== undefined) {

    return APP_SHELL_TO_DOM_REGION[migrated.region] ?? 'main';

  }

  return migrated.position.x >= 1 ? 'sidebar': 'main';

}



function tabIndexFromRecord(record: WorkspaceLayoutRecord): number {

  const migrated = migrateLayoutRecord(record);

  return migrated.order ?? Math.max(0, Math.trunc(migrated.position.y));

}



export function domPanelFromLayoutRecord(record: WorkspaceLayoutRecord): DomPanelRecord {

  const migrated = migrateLayoutRecord(record);

  const regionId = domRegionFromRecord(migrated);

  const tabIndex = tabIndexFromRecord(migrated);

  const data: JsonObject =

    migrated.origin === 'agent' ? { origin: 'agent' as const }: {};

  if (migrated.contextId !== null) {

    data.contextRef = migrated.contextId;

  }

  return {

    panelId: migrated.panelId,

    regionId,

    tabIndex,

    size: { w: migrated.size.w, h: migrated.size.h },

    pinned: migrated.pinned,

    contextId: migrated.contextId,

    data,

  };

}



export function layoutRecordFromDomPanel(panel: DomPanelRecord): WorkspaceLayoutRecord {

  const region = DOM_REGION_TO_APP_SHELL[panel.regionId];

  const order = panel.tabIndex;

  return {

    panelId: panel.panelId,

    contextId: panel.contextId,

    region,

    tabGroup: 0,

    order,

    position: {

      x: layoutXFromAppShellRegion(region),

      y: order,

    },

    size: { w: panel.size.w, h: panel.size.h },

    pinned: panel.pinned,

    origin: readPanelOrigin(panel.data),

  };

}



export function exportLayoutFromSnapshot(snapshot: DomLayoutSnapshot): WorkspaceLayoutRecord[] {

  return snapshot.panels.map(layoutRecordFromDomPanel);

}



/**

 * Converts one panel record into a plain JSON value for `exportSnapshot`
 * (the SPI native-snapshot contract is JSON). `DomPanelRecord` is a
 * named interface, not an index-signature type, so TypeScript will not
 * structurally widen a `DomPanelRecord[]` reference into `JsonValue[]`
 * on its own; rebuilding each panel as a fresh literal here, checked
 * against the declared `JsonObject` return type, is what makes the
 * conversion sound rather than an unsafe cast.

 */

export function domPanelRecordToJson(panel: DomPanelRecord): JsonObject {

  return {

    panelId: panel.panelId,

    regionId: panel.regionId,

    tabIndex: panel.tabIndex,

    size: { w: panel.size.w, h: panel.size.h },

    pinned: panel.pinned,

    contextId: panel.contextId,

    data: panel.data,

  };

}



export function importLayoutIntoSnapshot(

  base: DomLayoutSnapshot,

  records: WorkspaceLayoutRecord[]): DomLayoutSnapshot {

  const panels = records.map(domPanelFromLayoutRecord);

  const activeTab: Record<DomRegionId, number> = {...base.activeTab };

  for (const regionId of ['main', 'sidebar'] as const) {

    const regionPanels = panels.filter((panel) => panel.regionId === regionId);

    if (regionPanels.length === 0) {

      activeTab[regionId] = 0;

      continue;

    }

    const maxTab = Math.max(...regionPanels.map((panel) => panel.tabIndex));

    activeTab[regionId] = Math.min(activeTab[regionId], maxTab);

  }

  return {...base, panels, activeTab };

}



export function snapshotFromNativeExport(snapshot: JsonObject): DomLayoutSnapshot | null {

  if (snapshot.version !== 1 || !Array.isArray(snapshot.panels)) {

    return null;

  }

   // Runtime-checked above (Array.isArray); DomPanelRecord is a named
   // interface rather than an index-signature type, so it is not
   // structurally comparable to JsonValue[] without the unknown step,
   // matching the same idiom the tldraw engine uses for its native
   // snapshot import (engines/tldraw/engine.ts importSnapshot).
  const panels = snapshot.panels as unknown as DomPanelRecord[];

  return {

    version: 1,

    panels,

    sidebarSplit:

      typeof snapshot.sidebarSplit === 'number' ? snapshot.sidebarSplit: baseSidebarSplit,

    activeTab: readActiveTab(snapshot.activeTab),

    sidebarDrawerOpen: snapshot.sidebarDrawerOpen === true,

  };

}



function baseSidebarSplit(): number {

  return createEmptyDomLayoutSnapshot().sidebarSplit;

}



function readActiveTab(value: unknown): Record<DomRegionId, number> {

  if (!value || typeof value !== 'object') {

    return { main: 0, sidebar: 0 };

  }

  const record = value as Record<string, unknown>;

  return {

    main: typeof record.main === 'number' ? Math.max(0, Math.trunc(record.main)): 0,

    sidebar: typeof record.sidebar === 'number' ? Math.max(0, Math.trunc(record.sidebar)): 0,

  };

}



export function panelDataFromRequest(data: JsonObject | undefined): JsonObject {

  return data ?? {};

}



export function isPinnedFromData(data: Record<string, unknown>): boolean {

  return isPanelPinned(data);

}



export { DEFAULT_PANEL_SIZE };


