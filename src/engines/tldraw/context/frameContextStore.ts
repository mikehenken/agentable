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

import {
  getWhiteboardPaletteEntities,
  type WhiteboardPaletteEntity,
} from '../layout/whiteboardLayoutConfig';

export { getWhiteboardPaletteEntities, type WhiteboardPaletteEntity };

/**
 * @deprecated Use {@link getWhiteboardPaletteEntities} — packs register palette entities.
 * Evaluated at call time so runtime pack hints are included.
 */
export function readWhiteboardPaletteEntities(): readonly WhiteboardPaletteEntity[] {
  return getWhiteboardPaletteEntities();
}
