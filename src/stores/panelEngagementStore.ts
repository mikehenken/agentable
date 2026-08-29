import { create } from 'zustand';
import type { PanelId } from '../types';

/** How the panel gained focus — useful for future analytics tuning. */
export type EngagementSource =
  | 'open'
  | 'toggle-open'
  | 'focus'
  | 'bring-to-front'
  | 'tool';

export interface PanelEngagementEntry {
  panelId: PanelId;
  timestamp: number;
  source: EngagementSource;
}

/** Read-only snapshot for policy helpers (no zustand subscription). */
export interface PanelEngagementSnapshot {
  lastEngagedAt: Readonly<Record<string, number>>;
  stackOrder: readonly PanelId[];
}

interface PanelEngagementState extends PanelEngagementSnapshot {
  /** Ring buffer of recent engagements (newest last). */
  history: PanelEngagementEntry[];
  recordEngagement: (panelId: PanelId, source: EngagementSource) => void;
  bringToFront: (panelId: PanelId) => void;
  getLastEngagedAt: (panelId: PanelId) => number | null;
  /** 0 = most recently engaged, higher = staler. */
  getEngagementRank: (panelId: PanelId) => number;
  getZIndexBase: (panelId: PanelId) => number;
  toSnapshot: () => PanelEngagementSnapshot;
}

const HISTORY_CAP = 64;
const Z_INDEX_BASE = 20;

function buildRankMap(stackOrder: readonly PanelId[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  const len = stackOrder.length;
  for (let i = 0; i < len; i += 1) {
    ranks[stackOrder[i]] = len - 1 - i;
  }
  return ranks;
}

export const usePanelEngagementStore = create<PanelEngagementState>((set, get) => ({
  history: [],
  lastEngagedAt: {},
  stackOrder: [],

  recordEngagement: (panelId: PanelId, source: EngagementSource) => {
    const now = Date.now();
    set((state) => {
      const entry: PanelEngagementEntry = { panelId, timestamp: now, source };
      const history = [...state.history, entry].slice(-HISTORY_CAP);
      const lastEngagedAt = {...state.lastEngagedAt, [panelId]: now };
      const without = state.stackOrder.filter((id) => id !== panelId);
      const stackOrder = [...without, panelId];
      return { history, lastEngagedAt, stackOrder };
    });
  },

  bringToFront: (panelId: PanelId) => {
    set((state) => {
      if (!state.stackOrder.includes(panelId)) {
        return {
          stackOrder: [...state.stackOrder, panelId],
        };
      }
      const without = state.stackOrder.filter((id) => id !== panelId);
      return { stackOrder: [...without, panelId] };
    });
  },

  getLastEngagedAt: (panelId: PanelId) => {
    const ts = get().lastEngagedAt[panelId];
    return ts ?? null;
  },

  getEngagementRank: (panelId: PanelId) => {
    const ranks = buildRankMap(get().stackOrder);
    return ranks[panelId] ?? -1;
  },

  getZIndexBase: (panelId: PanelId) => {
    const rank = get().getEngagementRank(panelId);
    if (rank < 0) return Z_INDEX_BASE;
    const stackLen = get().stackOrder.length;
    return Z_INDEX_BASE + Math.max(0, stackLen - 1 - rank);
  },

  toSnapshot: () => {
    const { lastEngagedAt, stackOrder } = get();
    return { lastEngagedAt, stackOrder };
  },
}));
