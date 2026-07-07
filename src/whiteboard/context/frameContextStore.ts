/**
 * Frame context registry — sticky contextRef scope for whiteboard panels.
 *
 * Panels opened while a frame context is active inherit its contextRef until
 * the scope is cleared. Used by panelShapeApi and the command palette for
 * entity-scoped inserts (Stage 05).
 */
import { create } from 'zustand';

export interface FrameContextState {
  /** Active sticky context ref (e.g. lrn::en:platform.feature.chat::component). */
  activeContextRef: string | null;
  setActiveContextRef: (contextRef: string | null) => void;
  resolveContextRef: (explicit?: string | null) => string | null;
}

export const useFrameContextStore = create<FrameContextState>((set, get) => ({
  activeContextRef: null,
  setActiveContextRef: (contextRef) => set({ activeContextRef: contextRef }),
  resolveContextRef: (explicit) => {
    if (explicit && explicit.trim()) return explicit.trim();
    return get().activeContextRef;
  },
}));

export function getActiveContextRef(): string | null {
  return useFrameContextStore.getState().activeContextRef;
}

/** Entity ids wired to command palette insert actions (Stage 05 / 11). */
export const WHITEBOARD_PALETTE_ENTITIES = [
  {
    id: 'lrn::en:platform.feature.chat::component',
    label: 'Chat panel',
    panelId: 'chat',
  },
  {
    id: 'lrn::en:platform.feature.open-positions::component',
    label: 'Open positions',
    panelId: 'open-positions',
  },
  {
    id: 'lrn::en:platform.feature.resources::component',
    label: 'Resources',
    panelId: 'resources',
  },
] as const;
