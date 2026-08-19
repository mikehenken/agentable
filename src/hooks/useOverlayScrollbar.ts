import { useCallback, useEffect, useRef, type RefObject } from 'react';

/** Idle delay before hiding the overlay scrollbar thumb. */
export const OVERLAY_SCROLLBAR_IDLE_MS = 1000;

const ACTIVE_CLASS = 'landi-overlay-scroll--active';
const BASE_CLASS = 'landi-overlay-scroll';

/**
 * Reveals a thin overlay scrollbar while the user scrolls, then hides it after
 * idle. Applies `landi-overlay-scroll` classes to the target element.
 */
export function useOverlayScrollbar(ref: RefObject<HTMLElement | null>): void {
  const timeoutRef = useRef<number | null>(null);

  const reveal = useCallback((el: HTMLElement) => {
    el.classList.add(ACTIVE_CLASS);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      el.classList.remove(ACTIVE_CLASS);
      timeoutRef.current = null;
    }, OVERLAY_SCROLLBAR_IDLE_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add(BASE_CLASS);

    const onScroll = (): void => {
      reveal(el);
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      el.classList.remove(BASE_CLASS, ACTIVE_CLASS);
    };
  }, [ref, reveal]);
}
