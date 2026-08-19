/**
 * WorkspaceLayoutRecord migrations.
 *
 * v1 (legacy DOM): region encoded in `position.x` (0 main, 1 sidebar),
 * tab index in `position.y`.
 * v2 (current): explicit `{ region, tabGroup, order }` with aligned `position`.
 */
import type { AppShellRegionId, WorkspaceLayoutRecord } from './types';

/** Layout record schema generation written by DOM engine export. */
export const CURRENT_LAYOUT_RECORD_VERSION = 2;

/** Legacy DOM records omit explicit app-shell placement fields and use rail encoding in position.x. */
export function isLegacyDomLayoutRecord(record: WorkspaceLayoutRecord): boolean {
  if (record.region !== undefined || record.order !== undefined) {
    return false;
  }
  const { x, y } = record.position;
  return (x === 0 || x === 1) && Number.isInteger(y) && y >= 0;
}

function regionFromLegacyPositionX(x: number): AppShellRegionId {
  return x >= 1 ? 'sidebar': 'main';
}

/** Maps app-shell region to the legacy SPI `position.x` rail encoding. */
export function layoutXFromAppShellRegion(region: AppShellRegionId): number {
  switch (region) {
    case 'sidebar':
    case 'right':
      return 1;
    case 'left':
      return -1;
    case 'bottom':
      return 2;
    case 'drawer':
      return 3;
    default:
      return 0;
  }
}

function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.trunc(value));
}

/**
 * Ensures v2 app-shell fields and aligned `position` on a layout record.
 * Spatial records without `region` pass through unchanged.
 */
export function normalizeLayoutRecord(record: WorkspaceLayoutRecord): WorkspaceLayoutRecord {
  if (record.region === undefined && record.order === undefined) {
    return record;
  }

  const region = record.region ?? regionFromLegacyPositionX(record.position.x);
  const tabGroup = record.tabGroup ?? 0;
  const order =
    record.order !== undefined
      ? clampNonNegativeInt(record.order): clampNonNegativeInt(record.position.y);

  return {...record,
    region,
    tabGroup,
    order,
    position: {
      x: layoutXFromAppShellRegion(region),
      y: order,
    },
  };
}

/**
 * Upgrades a legacy DOM layout record (position.x/y encoding) to v2 fields.
 * Records that already declare `region` or `order` are normalized only.
 */
export function migrateLayoutRecord(record: WorkspaceLayoutRecord): WorkspaceLayoutRecord {
  if (!isLegacyDomLayoutRecord(record)) {
    return normalizeLayoutRecord(record);
  }

  const region = regionFromLegacyPositionX(record.position.x);
  const order = clampNonNegativeInt(record.position.y);
  const tabGroup = record.tabGroup ?? 0;

  return normalizeLayoutRecord({...record,
    region,
    tabGroup,
    order,
  });
}

/** Batch migration for persisted layout arrays (reload host restore). */
export function migrateLayoutRecords(records: WorkspaceLayoutRecord[]): WorkspaceLayoutRecord[] {
  return records.map(migrateLayoutRecord);
}
