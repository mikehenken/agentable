/**
 * Observe whiteboard shell size — sync nav expand/compact chrome without
 * mutating camera zoom (preserveZoom contract on resize).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLayoutStore } from '../../../components/chrome/navChromeStore';
import { useCanvasViewportStore } from '../../../stores/canvasViewportStore';
import {
  shouldExpandWhiteboardNav,
  shouldUseCompactWhiteboardChrome,
} from '../layout/responsiveWhiteboardLayout';

const DEBOUNCE_MS = 120;

export interface WhiteboardViewportChromeState {
  width: number;
  height: number;
  compactChrome: boolean;
  navExpandedPreferred: boolean;
}

export function useWhiteboardViewportChrome(
  rootRef: RefObject<HTMLElement | null>,
): WhiteboardViewportChromeState {
  const [state, setState] = useState<WhiteboardViewportChromeState>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    compactChrome: false,
    navExpandedPreferred: true,
  }));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDimensions = useCanvasViewportStore((s) => s.setDimensions);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const apply = (width: number, height: number): void => {
      const compactChrome = shouldUseCompactWhiteboardChrome(width);
      const navExpandedPreferred = shouldExpandWhiteboardNav(width);
      setDimensions(width, height);
      setState({ width, height, compactChrome, navExpandedPreferred });

      const { navSidebarExpanded, setNavSidebarExpanded } = useLayoutStore.getState();
      // Auto-collapse on narrow (mobile); auto-expand at tablet+ so Menu
      // starts expanded on whiteboard load (career UX).
      if (!navExpandedPreferred && navSidebarExpanded) {
        setNavSidebarExpanded(false);
      } else if (navExpandedPreferred && !navSidebarExpanded) {
        setNavSidebarExpanded(true);
      }
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => apply(width, height), DEBOUNCE_MS);
    });

    ro.observe(el);
    apply(el.clientWidth, el.clientHeight);

    return () => {
      ro.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rootRef, setDimensions]);

  return state;
}
