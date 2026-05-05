import { create } from 'zustand';
import type { PanelLayout, PanelId } from '../types';

interface LayoutState {
  panels: Record<string, PanelLayout>;
  pan: { x: number; y: number };
  navCollapsed: boolean;
  settingsOpen: boolean;
  snapGrid: boolean;
  
  // Actions
  showPanel: (id: PanelId) => void;
  toggleSnapGrid: () => void;
  hidePanel: (id: PanelId) => void;
  togglePanel: (id: PanelId) => void;
  movePanel: (id: PanelId, x: number, y: number) => void;
  resizePanel: (id: PanelId, w: number, h: number) => void;
  minimizePanel: (id: PanelId) => void;
  maximizePanel: (id: PanelId) => void;
  autoOrganize: () => void;
  panBy: (dx: number, dy: number) => void;
  resetPan: () => void;
  toggleNavCollapsed: () => void;
  toggleSettings: () => void;
  setPanelPosition: (id: PanelId, x: number, y: number) => void;
}

function findFreePosition(
  panels: Record<string, PanelLayout>,
  openingId: string
): { x: number; y: number } {
  const GAP = 16;
  const visiblePanels = Object.entries(panels)
    .filter(([id, p]) => id !== openingId && p.visible)
    .map(([_, p]) => p);

  if (visiblePanels.length === 0) {
    return { x: 260, y: 80 };
  }

  // Find rightmost panel
  const rightmost = visiblePanels.reduce((max, p) =>
    p.x + (p.w || 300) > max.x + (max.w || 300) ? p : max
  , visiblePanels[0]);

  // Find bottom panel
  const bottommost = visiblePanels.reduce((max, p) =>
    p.y + (p.h || 400) > max.y + (max.h || 400) ? p : max
  , visiblePanels[0]);

  // Try placing to the right first
  const rightX = rightmost.x + (rightmost.w || 300) + GAP;
  const rightY = rightmost.y;

  // If too wide, cascade diagonally
  if (rightX + 400 > window.innerWidth - 32) {
    return {
      x: rightmost.x + 32,
      y: bottommost.y + (bottommost.h || 400) + GAP,
    };
  }

  return { x: rightX, y: rightY };
}

const defaultLayouts: Record<string, PanelLayout> = {
  nav: { x: 16, y: 64, w: 200, h: 320, visible: true, autoHeight: true, resizable: false },
  chat: { x: 240, y: 72, w: 520, h: 560, visible: true, resizable: true, minW: 420, minH: 420 },
  artifacts: { x: 800, y: 72, w: 420, h: 340, visible: false, resizable: true, minW: 360, minH: 280 },
  'open-positions': { x: 240, y: 72, w: 640, h: 560, visible: false, resizable: true, minW: 500, minH: 420 },
  applications: { x: 260, y: 72, w: 560, h: 520, visible: false, resizable: true, minW: 460, minH: 380 },
  resources: { x: 260, y: 72, w: 560, h: 520, visible: false, resizable: true, minW: 460, minH: 380 },
  'career-tools': { x: 260, y: 72, w: 560, h: 520, visible: false, resizable: true, minW: 460, minH: 380 },
  'growth-paths': { x: 240, y: 72, w: 880, h: 540, visible: false, resizable: true, minW: 700, minH: 420 },
  'career-trajectories': { x: 240, y: 72, w: 900, h: 420, visible: false, resizable: true, minW: 700, minH: 320 },
  voice: { x: 20, y: 520, w: 280, h: 200, visible: false, resizable: false },
  journey: { x: 800, y: 440, w: 420, h: 300, visible: false, resizable: true, minW: 360, minH: 240 },
  settings: { x: 400, y: 200, w: 480, h: 400, visible: false, resizable: false },
};

// Clamp initially-visible panels to the viewport on first load so chat/etc.
// never start below the fold on smaller screens.
function clampDefaultsToViewport(
  layouts: Record<string, PanelLayout>
): Record<string, PanelLayout> {
  if (typeof window === 'undefined') return layouts;
  const TOPBAR_H = 56;
  const BOTTOMBAR_H = 72;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const out: Record<string, PanelLayout> = {};
  for (const [id, p] of Object.entries(layouts)) {
    if (!p.visible) {
      out[id] = p;
      continue;
    }
    const maxBottom = VH - BOTTOMBAR_H;
    const maxRight = VW - 20;
    const minW = p.minW || 280;
    const minH = p.minH || 200;
    const w = Math.max(minW, Math.min(p.w || 400, Math.max(minW, VW - (p.x || 0) - 24)));
    const h = Math.max(minH, Math.min(p.h || 300, Math.max(minH, maxBottom - (p.y || TOPBAR_H))));
    const x = Math.max(12, Math.min(p.x || 0, maxRight - w));
    const y = Math.max(TOPBAR_H, Math.min(p.y || TOPBAR_H, maxBottom - h));
    out[id] = { ...p, x, y, w, h };
  }
  return out;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  panels: clampDefaultsToViewport({ ...defaultLayouts }),
  pan: { x: 0, y: 0 },
  navCollapsed: false,
  settingsOpen: false,
  snapGrid: true,

  toggleSnapGrid: () => {
    set((state) => ({ snapGrid: !state.snapGrid }));
  },

  showPanel: (id: PanelId) => {
    set((state) => {
      const panel = state.panels[id];
      if (!panel) {
        console.warn(`Panel "${id}" not found in layoutStore`);
        return state;
      }

      // Viewport guardrails — panels must land ON screen, never below the fold
      const GAP = 16;
      const TOPBAR_H = 56;     // top bar + gap
      const BOTTOMBAR_H = 72;  // bottom bar + breathing room
      const SIDEBAR_X = 240;   // clears the collapsed nav sidebar
      const VW = window.innerWidth;
      const VH = window.innerHeight;
      const MAX_W = Math.max(360, VW - SIDEBAR_X - 24);
      const MAX_H = Math.max(320, VH - TOPBAR_H - BOTTOMBAR_H);

      // Respect min constraints but clamp to viewport
      const desiredW = panel.w || 400;
      const desiredH = panel.h || 300;
      const newW = Math.min(desiredW, MAX_W);
      const newH = Math.min(desiredH, MAX_H);

      const startX = SIDEBAR_X;
      const startY = TOPBAR_H;
      const maxBottom = VH - BOTTOMBAR_H;       // panel's bottom edge cannot cross this
      const maxRight = VW - 20;                 // panel's right edge cannot cross this

      const visiblePanels = Object.entries(state.panels)
        .filter(([pid, p]) => pid !== id && p.visible)
        .map(([_, p]) => p);

      let newX = startX;
      let newY = startY;
      let placed = false;

      // Cascade: try columns left-to-right, then rows top-to-bottom, then accept overlap
      outer: for (let row = 0; row < 6; row++) {
        const rowY = startY + row * (newH * 0.35 + GAP);
        // If this row would push the panel past the fold, stop cascading
        if (rowY + newH > maxBottom) break;

        for (let col = 0; col < 6; col++) {
          const colX = startX + col * (newW * 0.4 + GAP);
          if (colX + newW > maxRight) break; // next row

          // Overlap check against visible panels
          let overlaps = false;
          for (const vp of visiblePanels) {
            const vpW = vp.w || 300;
            const vpH = vp.h || 400;
            if (
              colX < vp.x + vpW + GAP &&
              colX + newW + GAP > vp.x &&
              rowY < vp.y + vpH + GAP &&
              rowY + newH + GAP > vp.y
            ) {
              overlaps = true;
              break;
            }
          }
          if (!overlaps) {
            newX = colX;
            newY = rowY;
            placed = true;
            break outer;
          }
        }
      }

      // Fallback: no clean slot found — place at startX/startY but clamp to viewport
      if (!placed) {
        newX = Math.min(startX, maxRight - newW);
        newY = Math.min(startY, maxBottom - newH);
      }

      // Final clamp — guarantee on-screen regardless of path taken
      newX = Math.max(12, Math.min(newX, maxRight - newW));
      newY = Math.max(TOPBAR_H, Math.min(newY, maxBottom - newH));

      return {
        panels: {
          ...state.panels,
          [id]: {
            ...panel,
            visible: true,
            x: newX,
            y: newY,
            w: newW,
            h: newH,
            minimized: false,
          },
        },
      };
    });
  },

  hidePanel: (id: PanelId) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], visible: false },
      },
    }));
  },

  togglePanel: (id: PanelId) => {
    set((state) => {
      const panel = state.panels[id];
      if (!panel) return state;
      const isVisible = panel.visible;
      if (isVisible) {
        return {
          panels: {
            ...state.panels,
            [id]: { ...panel, visible: false },
          },
        };
      } else {
        const newPos = findFreePosition(state.panels, id);
        return {
          panels: {
            ...state.panels,
            [id]: {
              ...panel,
              visible: true,
              x: panel.x || newPos.x,
              y: panel.y || newPos.y,
              minimized: false,
            },
          },
        };
      }
    });
  },

  movePanel: (id: PanelId, x: number, y: number) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], x, y },
      },
    }));
  },

  resizePanel: (id: PanelId, w: number, h: number) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], w, h },
      },
    }));
  },

  minimizePanel: (id: PanelId) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], minimized: true },
      },
    }));
  },

  maximizePanel: (id: PanelId) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], minimized: false },
      },
    }));
  },

  autoOrganize: () => {
    set((state) => {
      const TOPBAR_H = 48;
      const GAP = 16;
      const NAV_W = state.navCollapsed ? 44 : 200;
      const NAV_X = 16;
      const NAV_Y = TOPBAR_H + GAP;
      const CHAT_W = 520;
      const ART_W = 320;

      return {
        panels: {
          ...state.panels,
          nav: {
            ...state.panels.nav,
            x: NAV_X,
            y: NAV_Y,
            w: NAV_W,
            visible: true,
          },
          chat: {
            ...state.panels.chat,
            x: NAV_X + NAV_W + GAP,
            y: NAV_Y,
            w: CHAT_W,
            h: Math.min(480, window.innerHeight - NAV_Y - GAP),
            visible: true,
          },
          artifacts: {
            ...state.panels.artifacts,
            x: NAV_X + NAV_W + GAP + CHAT_W + GAP,
            y: NAV_Y,
            w: ART_W,
            h: Math.min(480, window.innerHeight - NAV_Y - GAP),
            visible: true,
          },
          journey: {
            ...state.panels.journey,
            x: NAV_X + NAV_W + GAP + CHAT_W + GAP,
            y: NAV_Y + Math.min(480, window.innerHeight - NAV_Y - GAP) + GAP,
            w: ART_W,
            h: 280,
            visible: true,
          },
          'growth-paths': {
            ...state.panels['growth-paths'],
            x: NAV_X + NAV_W + GAP,
            y: NAV_Y + Math.min(480, window.innerHeight - NAV_Y - GAP) + GAP,
            w: CHAT_W,
            h: 400,
            visible: false,
          },
          voice: {
            ...state.panels.voice,
            x: NAV_X,
            y: window.innerHeight - 220 - GAP,
            w: 280,
            h: 200,
            visible: false,
          },
        },
        pan: { x: 0, y: 0 },
      };
    });
  },

  panBy: (dx: number, dy: number) => {
    set((state) => ({
      pan: { x: state.pan.x + dx, y: state.pan.y + dy },
    }));
  },

  resetPan: () => {
    set({ pan: { x: 0, y: 0 } });
  },

  toggleNavCollapsed: () => {
    set((state) => ({ navCollapsed: !state.navCollapsed }));
  },

  toggleSettings: () => {
    set((state) => ({ settingsOpen: !state.settingsOpen }));
  },

  setPanelPosition: (id: PanelId, x: number, y: number) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [id]: { ...state.panels[id], x, y },
      },
    }));
  },
}));
