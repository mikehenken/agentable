/**
 * Minimal nav chrome state for WhiteboardShell (replaces layoutStore nav fields).
 * Legacy absolute-positioned canvas used layoutStore for panel placement; the
 * whiteboard substrate routes panel opens through openPanelInCanvas instead.
 */
import { create } from 'zustand';

interface NavChromeState {
  navSidebarExpanded: boolean;
  setNavSidebarExpanded: (expanded: boolean) => void;
}

export const useNavChromeStore = create<NavChromeState>((set) => ({
  navSidebarExpanded: true,
  setNavSidebarExpanded: (expanded) => set({ navSidebarExpanded: expanded }),
}));

/** @deprecated alias — whiteboard code migrated off layoutStore. */
export const useLayoutStore = useNavChromeStore;
