/**
 * panelIntentStore — cross-panel command bus for agent tool calls.
 *
 * Why a separate store from `layoutStore`:
 *   `layoutStore` owns layout primitives (visibility, position, size). Mixing
 *   per-panel intent (selected job id, search query, filter chips) into it
 *   would couple every panel to the geometry store and force every panel
 *   render to re-subscribe through the same selectors.
 *
 *   This store carries ONLY the "agent asked for something specific" state.
 *   Panels read it via `usePanelIntentStore` and treat it as a one-shot
 *   command — once they apply the intent, they call `clearXIntent()` so a
 *   subsequent `showPanel` from a click doesn't re-apply a stale agent
 *   command.
 *
 * Why not window CustomEvents:
 *   We use both. Internal React panels read this store (predictable, typed,
 *   testable). External Lit components and embedded scripts can also dispatch
 *   `landi:panel-intent` events; the store has a window listener that mirrors
 *   them. One source of truth for state, two surfaces for input.
 */
import { create } from 'zustand';

export interface OpenPositionsIntent {
  /** Department filter chip to apply. */
  department?: string;
  /** Free-text search to seed. */
  search?: string;
  /** Job to auto-select on open. Use null to clear; undefined leaves prior. */
  selectedJobId?: number | null;
  /** Used when only the title is known — partial match against MOCK_JOBS. */
  selectedJobTitle?: string;
}

export interface ResourcesIntent {
  search?: string;
}

export interface GrowthPathsIntent {
  fromRole?: string;
}

export interface CanvasArtifact {
  id: string;
  name: string;
  content: string;
  kind: string;
  createdAt: string;
}

interface PanelIntentState {
  openPositions: OpenPositionsIntent | null;
  resources: ResourcesIntent | null;
  growthPaths: GrowthPathsIntent | null;
  savedJobIds: Set<number>;
  artifacts: CanvasArtifact[];

  setOpenPositionsIntent: (intent: OpenPositionsIntent) => void;
  clearOpenPositionsIntent: () => void;
  setResourcesIntent: (intent: ResourcesIntent) => void;
  clearResourcesIntent: () => void;
  setGrowthPathsIntent: (intent: GrowthPathsIntent) => void;
  clearGrowthPathsIntent: () => void;
  toggleSavedJob: (jobId: number) => void;
  pushArtifact: (artifact: CanvasArtifact) => void;
  clearArtifacts: () => void;
}

export const usePanelIntentStore = create<PanelIntentState>((set) => ({
  openPositions: null,
  resources: null,
  growthPaths: null,
  savedJobIds: new Set<number>(),
  artifacts: [],

  setOpenPositionsIntent: (intent) =>
    set((state) => ({
      openPositions: { ...(state.openPositions ?? {}), ...intent },
    })),
  clearOpenPositionsIntent: () => set({ openPositions: null }),
  setResourcesIntent: (intent) => set({ resources: intent }),
  clearResourcesIntent: () => set({ resources: null }),
  setGrowthPathsIntent: (intent) => set({ growthPaths: intent }),
  clearGrowthPathsIntent: () => set({ growthPaths: null }),
  toggleSavedJob: (jobId) =>
    set((state) => {
      const next = new Set(state.savedJobIds);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return { savedJobIds: next };
    }),
  pushArtifact: (artifact) =>
    set((state) => ({ artifacts: [artifact, ...state.artifacts] })),
  clearArtifacts: () => set({ artifacts: [] }),
}));
