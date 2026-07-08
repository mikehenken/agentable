/**
 * Nested scroll isolation for whiteboard PanelShape content.
 *
 * tldraw attaches a non-passive wheel handler on the editor container
 * (`useGestureEvents`) that always preventDefault + pans/zooms unless the
 * pointer is over an *editing* shape with `canScroll() === true`. Panel
 * shapes are interactive but not in edit mode, so we intercept wheel in
 * **capture** phase on the panel body and stop propagation before tldraw
 * sees the event — but only when a scrollable descendant can absorb the
 * wheel delta.
 *
 * Policy:
 * - Empty canvas / panel chrome: pass through → canvas pan/zoom
 * - Panel body with vertical overflow: vertical wheel scrolls the panel
 * - Preview/draft panels only: horizontal wheel captured when tab strip
 *   (or other descendant) has horizontal overflow
 */
import { useEffect, type RefObject, type WheelEvent as ReactWheelEvent } from 'react';

export interface PanelWheelCaptureOptions {
  /** When true, horizontal wheel may be captured by horizontally scrollable descendants. */
  captureHorizontalWheel?: boolean;
}

function isElementVerticallyScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowY = style.overflowY || el.style.overflowY;
  return (
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight + 1
  );
}

function isElementHorizontallyScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const overflowX = style.overflowX || el.style.overflowX;
  return (
    (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') &&
    el.scrollWidth > el.clientWidth + 1
  );
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
  options: PanelWheelCaptureOptions = {},
): HTMLElement | null {
  const { captureHorizontalWheel = false } = options;
  let node = target instanceof HTMLElement ? target : null;
  while (node && panelRoot.contains(node)) {
    const canScrollY =
      isElementVerticallyScrollable(node) && deltaY !== 0 && canScrollVertically(node, deltaY);
    const canScrollX =
      captureHorizontalWheel &&
      isElementHorizontallyScrollable(node) &&
      deltaX !== 0 &&
      canScrollHorizontally(node, deltaX);
    if (canScrollY || canScrollX) return node;
    if (node === panelRoot) break;
    node = node.parentElement;
  }
  return null;
}

/** Capture-phase wheel handler for panel body roots. */
export function handlePanelWheelCapture(
  panelRoot: HTMLElement,
  event: WheelEvent,
  options: PanelWheelCaptureOptions = {},
): void {
  if (!panelRoot.contains(event.target as Node)) return;

  const scrollTarget = findScrollableWheelTarget(
    panelRoot,
    event.target,
    event.deltaX,
    event.deltaY,
    options,
  );

  if (scrollTarget) {
    event.stopPropagation();
  }
}

/**
 * Attach capture-phase wheel isolation on `panelRoot`. Returns a cleanup fn.
 * Safe to call from React useEffect.
 */
export function attachPanelScrollWheelIsolation(
  panelRoot: HTMLElement,
  options: PanelWheelCaptureOptions = {},
): () => void {
  const onWheelCapture = (event: WheelEvent): void => {
    handlePanelWheelCapture(panelRoot, event, options);
  };
  panelRoot.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
  return () => {
    panelRoot.removeEventListener('wheel', onWheelCapture, { capture: true });
  };
}

/** React props helper for optional nested scroll regions outside PanelShape. */
export function panelScrollWheelCaptureProps(
  options: PanelWheelCaptureOptions = {},
): {
  onWheelCapture: (event: ReactWheelEvent<HTMLElement>) => void;
} {
  return {
    onWheelCapture: (event) => {
      handlePanelWheelCapture(event.currentTarget, event.nativeEvent, options);
    },
  };
}

/** Hook — attach wheel isolation to a panel root ref. */
export function usePanelScrollWheelIsolation(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  options: PanelWheelCaptureOptions = {},
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    return attachPanelScrollWheelIsolation(el, options);
  }, [ref, enabled, options.captureHorizontalWheel]);
}

/** Panel ids whose tab strip may capture horizontal wheel when overflowing. */
export const HORIZONTAL_WHEEL_PANEL_IDS = new Set(['web-preview', 'draft-preview']);

export function panelCapturesHorizontalWheel(panelId: string): boolean {
  return HORIZONTAL_WHEEL_PANEL_IDS.has(panelId);
}
