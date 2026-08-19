/**
 * DOM workspace engine layout types.
 *
 * Regions, splits, tabs, and drawer collapse are expressed in engine-neutral
 * terms so the SPI layout records round-trip without tldraw coordinates.
 */
import type { PanelInstanceId } from '../../engine/types';
import type { JsonObject } from '../../panels/types';

/** Named workspace regions in the default horizontal split layout. */
export type DomRegionId = 'main' | 'sidebar';

/** Responsive breakpoints for drawer collapse (match CSS media queries). */
export const DOM_MOBILE_BP = 640;
export const DOM_TABLET_BP = 768;
export const DOM_TABLET_MEDIA_QUERY = `(max-width: ${DOM_TABLET_BP}px)`;

/** Default sidebar width as a percentage of the horizontal split. */
export const DOM_DEFAULT_SIDEBAR_SPLIT = 30;

/**
 * One panel instance assigned to a region tab strip. `data` is JSON, not a
 * loose `Record<string, unknown>` bag, because it round-trips through
 * `exportSnapshot` (the SPI native-snapshot contract is JSON).
 */
export interface DomPanelRecord {
  panelId: PanelInstanceId;
  regionId: DomRegionId;
  tabIndex: number;
  size: { w: number; h: number };
  pinned: boolean;
  contextId: string | null;
  data: JsonObject;
}

/** Serializable DOM workspace snapshot (nativeSnapshots: false enhancement). */
export interface DomLayoutSnapshot {
  version: 1;
  panels: DomPanelRecord[];
  sidebarSplit: number;
  activeTab: Record<DomRegionId, number>;
  sidebarDrawerOpen: boolean;
}

export function createEmptyDomLayoutSnapshot(): DomLayoutSnapshot {
  return {
    version: 1,
    panels: [],
    sidebarSplit: DOM_DEFAULT_SIDEBAR_SPLIT,
    activeTab: { main: 0, sidebar: 0 },
    sidebarDrawerOpen: false,
  };
}

/** Region id encoded in WorkspaceLayoutRecord.position.x (SPI bridge). */
export function regionIdFromLayoutX(x: number): DomRegionId {
  return x >= 1 ? 'sidebar': 'main';
}

export function layoutXFromRegionId(regionId: DomRegionId): number {
  return regionId === 'sidebar' ? 1: 0;
}
