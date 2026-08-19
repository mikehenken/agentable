/**
 * Host-configurable whiteboard layout hints (panel sizing, arrange order, palette).
 * Domain packs register hints via {@link configureWhiteboardLayoutHints}; core
 * never hardcodes career or tenant-specific panel id lists.
 *
 * Hints are stored on `globalThis` so Vite dev (duplicate module instances for
 * career-pack vs core) still reads the same active configuration.
 */

export interface WhiteboardPaletteEntity {
  id: string;
  label: string;
  panelId: string;
}

export interface WhiteboardLayoutHints {
  /** Panel ids that receive list-style responsive sizing (wide scrollable panels). */
  listPanelIds?: readonly string[];
  /** Lower index = earlier in auto-arrange sort order. */
  panelArrangeOrder?: readonly string[];
  /** Command palette insert entities beyond the always-available chat entry. */
  paletteEntities?: readonly WhiteboardPaletteEntity[];
}

const GLOBAL_HINTS_KEY = '__landiWhiteboardLayoutHints';

const DEFAULT_LIST_PANEL_IDS: readonly string[] = [];

const DEFAULT_PANEL_ARRANGE_ORDER: readonly string[] = ['chat'];

const DEFAULT_PALETTE_ENTITIES: readonly WhiteboardPaletteEntity[] = [
  {
    id: 'lrn::en:platform.feature.chat::component',
    label: 'Chat panel',
    panelId: 'chat',
  },
];

type GlobalWithHints = typeof globalThis & {
  [GLOBAL_HINTS_KEY]?: WhiteboardLayoutHints;
};

function readGlobalHints(): WhiteboardLayoutHints {
  const store = globalThis as GlobalWithHints;
  if (!store[GLOBAL_HINTS_KEY]) {
    store[GLOBAL_HINTS_KEY] = {};
  }
  return store[GLOBAL_HINTS_KEY]!;
}

export function configureWhiteboardLayoutHints(hints: WhiteboardLayoutHints): void {
  const activeHints = readGlobalHints();
  const merged: WhiteboardLayoutHints = {
    ...activeHints,
    ...hints,
    listPanelIds: hints.listPanelIds ?? activeHints.listPanelIds,
    panelArrangeOrder: hints.panelArrangeOrder ?? activeHints.panelArrangeOrder,
    paletteEntities: hints.paletteEntities ?? activeHints.paletteEntities,
  };
  (globalThis as GlobalWithHints)[GLOBAL_HINTS_KEY] = merged;
}

export function resetWhiteboardLayoutHints(): void {
  (globalThis as GlobalWithHints)[GLOBAL_HINTS_KEY] = {};
}

export function getWhiteboardListPanelIds(): ReadonlySet<string> {
  const ids = readGlobalHints().listPanelIds ?? DEFAULT_LIST_PANEL_IDS;
  return new Set(ids);
}

export function getWhiteboardPanelArrangeOrder(): readonly string[] {
  return readGlobalHints().panelArrangeOrder ?? DEFAULT_PANEL_ARRANGE_ORDER;
}

export function getWhiteboardPaletteEntities(): readonly WhiteboardPaletteEntity[] {
  const extra = readGlobalHints().paletteEntities ?? [];
  const chatEntity = DEFAULT_PALETTE_ENTITIES[0];
  const merged = [chatEntity, ...extra.filter((entity) => entity.panelId !== 'chat')];
  return merged;
}

export function compareWhiteboardPanelArrangeOrder(
  panelIdA: string,
  panelIdB: string,
): number {
  const order = getWhiteboardPanelArrangeOrder();
  const indexA = order.indexOf(panelIdA);
  const indexB = order.indexOf(panelIdB);
  const rankA = indexA >= 0 ? indexA : 50 + order.length;
  const rankB = indexB >= 0 ? indexB : 50 + order.length;
  return rankA - rankB;
}
