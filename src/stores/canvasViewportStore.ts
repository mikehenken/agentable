import { create } from 'zustand';

interface CanvasViewportState {
  width: number;
  height: number;
  setDimensions: (width: number, height: number) => void;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function readInitialWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  return window.innerWidth;
}

function readInitialHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  return window.innerHeight;
}

export const useCanvasViewportStore = create<CanvasViewportState>((set) => ({
  width: readInitialWidth(),
  height: readInitialHeight(),
  setDimensions: (width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    set({ width, height });
  },
}));
