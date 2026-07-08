/**
 * Nested scroll isolation for whiteboard PanelShape content.
 *
 * tldraw attaches a non-passive wheel handler on the editor container
 * (`useGestureEvents`) that always preventDefault + pans/zooms unless the
 * pointer is over an *editing* shape with `canScroll() === true`. Panel
 * shapes are interactive but not in edit mode, so we intercept wheel in
 * **capture** phase on the panel root and stop propagation before tldraw
 * sees the event.
 *
 * Pattern aligned with tldraw's scroll example + `usePassThroughWheelEvents`:
 * scrollable descendants consume the wheel; everything else over the panel
 * still blocks canvas zoom.
 */
import { useEffect, type RefObject, type WheelEvent as ReactWheelEvent } from 'react';

function isElementScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY || el.style.overflowY;
  const overflowX = style.overflowX || el.style.overflowX;
  const scrollableY =
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight + 1;
  const scrollableX =
    (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
    el.scrollWidth > el.clientWidth + 1;
  return scrollableY || scrollableX;
}

function canScrollVertically(el: HTMLElement, deltaY: number): boolean {
  if (deltaY === 0) return false;
  const atTop = el.scrollTop <= 0;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  if (deltaY < 0) return !atTop;
  return !atBottom;
}

function canScrollHorizontally(el: HTMLElement, deltaX: number): boolean {
  if (deltaX === 0) return false;
  const atLeft = el.scrollLeft <= 0;
  const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  if (deltaX < 0) return !atLeft;
  return !atRight;
}

/**
 * Walk from the event target upward until `panelRoot`, looking for a
 * scrollable element that can still absorb this wheel delta.
 */
export function findScrollableWheelTarget(
  panelRoot: HTMLElement,
  target: EventTarget | null,
  deltaX: number,
  deltaY: number,
): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node && panelRoot.contains(node)) {
    if (isElementScrollable(node)) {
      const canScroll =
        (deltaY !== 0 && canScrollVertically(node, deltaY)) ||
        (deltaX !== 0 && canScrollHorizontally(node, deltaX));
      if (canScroll) return node;
    }
    if (node === panelRoot) break;
    node = node.parentElement;
  }
  return null;
}

/** Capture-phase wheel handler for panel roots. */
export function handlePanelWheelCapture(panelRoot: HTMLElement, event: WheelEvent): void {
  if (!panelRoot.contains(event.target as Node)) return;

  const scrollTarget = findScrollableWheelTarget(
    panelRoot,
    event.target,
    event.deltaX,
    event.deltaY,
  );

  if (scrollTarget) {
    event.stopPropagation();
    return;
  }

  // Over the panel but nothing scrollable can absorb — block canvas pan/zoom.
  event.stopPropagation();
  event.preventDefault();
}

/**
 * Attach capture-phase wheel isolation on `panelRoot`. Returns a cleanup fn.
 * Safe to call from React useEffect.
 */
export function attachPanelScrollWheelIsolation(panelRoot: HTMLElement): () => void {
  const onWheelCapture = (event: WheelEvent): void => {
    handlePanelWheelCapture(panelRoot, event);
  };
  panelRoot.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
  return () => {
    panelRoot.removeEventListener('wheel', onWheelCapture, { capture: true });
  };
}

/** React props helper for optional nested scroll regions outside PanelShape. */
export function panelScrollWheelCaptureProps(): {
  onWheelCapture: (event: ReactWheelEvent<HTMLElement>) => void;
} {
  return {
    onWheelCapture: (event) => {
      handlePanelWheelCapture(event.currentTarget, event.nativeEvent);
    },
  };
}

/** Hook — attach wheel isolation to a panel root ref. */
export function usePanelScrollWheelIsolation(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    return attachPanelScrollWheelIsolation(el);
  }, [ref, enabled]);
}
