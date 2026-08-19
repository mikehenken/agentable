/**
 * Nested scroll isolation for whiteboard PanelShape content.
 *
 * tldraw attaches a non-passive wheel handler on the editor container
 * (`useGestureEvents`) that pans/zooms unless the event is consumed by an
 * interactive overlay. Panel shapes are interactive but not in edit mode, so
 * we stop wheel propagation on the bubble phase after the scroll target has
 * received the event — blocking canvas pan/zoom for axes where the panel
 * (or a descendant) is scrollable, including at scroll boundaries.
 *
 * Policy:
 * - Empty canvas panel chrome: pass through → canvas pan/zoom
 * - Vertically scrollable region + vertical wheel: block canvas (always)
 * - Horizontally scrollable region + horizontal wheel: block canvas (always)
 * - Axis-specific: vertical-only panels do not block horizontal canvas pan
 * - iframe previews: bubble guard on iframe + pointer-tracked window capture
 */
import { useEffect, type RefObject, type WheelEvent as ReactWheelEvent } from 'react';

export interface PanelWheelCaptureOptions {
  /**
   * @deprecated Horizontal scrollability is always detected from layout.
   * Kept for call-site compatibility.
   */
  captureHorizontalWheel?: boolean;
}

export interface PanelWheelBlockResult {
  block: boolean;
  blockVertical: boolean;
  blockHorizontal: boolean;
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

/**
 * Walk from the event target upward until `panelRoot`, checking which wheel
 * axes should be blocked based on scrollability (not scroll position).
 */
export function resolvePanelWheelBlock(
  panelRoot: HTMLElement,
  target: EventTarget | null,
  deltaX: number,
  deltaY: number): PanelWheelBlockResult {
  let blockVertical = false;
  let blockHorizontal = false;
  let node = target instanceof HTMLElement ? target: null;

  while (node && panelRoot.contains(node)) {
    if (deltaY !== 0 && isElementVerticallyScrollable(node)) {
      blockVertical = true;
    }
    if (deltaX !== 0 && isElementHorizontallyScrollable(node)) {
      blockHorizontal = true;
    }
    if (node === panelRoot) break;
    node = node.parentElement;
  }

  return {
    block: blockVertical || blockHorizontal,
    blockVertical,
    blockHorizontal,
  };
}

/**
 * @deprecated Prefer `resolvePanelWheelBlock`. Returns the nearest scrollable
 * ancestor when the wheel should be captured for at least one axis.
 */
export function findScrollableWheelTarget(
  panelRoot: HTMLElement,
  target: EventTarget | null,
  deltaX: number,
  deltaY: number): HTMLElement | null {
  const { block, blockVertical, blockHorizontal } = resolvePanelWheelBlock(
    panelRoot,
    target,
    deltaX,
    deltaY);
  if (!block) return null;

  let node = target instanceof HTMLElement ? target: null;
  while (node && panelRoot.contains(node)) {
    const scrollY = blockVertical && isElementVerticallyScrollable(node);
    const scrollX = blockHorizontal && isElementHorizontallyScrollable(node);
    if (scrollY || scrollX) return node;
    if (node === panelRoot) break;
    node = node.parentElement;
  }
  return null;
}

/** Bubble-phase wheel handler for panel body roots. */
export function handlePanelWheelCapture(
  panelRoot: HTMLElement,
  event: WheelEvent): void {
  if (!panelRoot.contains(event.target as Node)) return;

  const { block } = resolvePanelWheelBlock(
    panelRoot,
    event.target,
    event.deltaX,
    event.deltaY);

  if (block) {
    event.stopPropagation();
  }
}

/**
 * Attach bubble-phase wheel isolation on `panelRoot`. Returns a cleanup fn.
 * Safe to call from React useEffect.
 */
export function attachPanelScrollWheelIsolation(
  panelRoot: HTMLElement): () => void {
  const onWheel = (event: WheelEvent): void => {
    handlePanelWheelCapture(panelRoot, event);
  };
  panelRoot.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    panelRoot.removeEventListener('wheel', onWheel);
  };
}

/**
 * iframe wheel events do not always bubble to the panel root. Guard the iframe
 * element and, while the pointer is over an iframe inside `panelRoot`, stop
 * propagation at the window capture phase so tldraw does not pan/zoom.
 */
export function attachIframeWheelGuards(panelRoot: HTMLElement): () => void {
  const iframeCleanups: Array<() => void> = [];
  let pointerOverIframe = false;

  const bindIframe = (iframe: HTMLIFrameElement): void => {
    const onIframeWheel = (event: WheelEvent): void => {
      event.stopPropagation();
    };
    iframe.addEventListener('wheel', onIframeWheel, { passive: true });
    iframeCleanups.push(() => {
      iframe.removeEventListener('wheel', onIframeWheel);
    });
  };

  const syncIframes = (): void => {
    iframeCleanups.splice(0).forEach((cleanup) => cleanup);
    panelRoot.querySelectorAll('iframe').forEach((node) => {
      if (node instanceof HTMLIFrameElement) {
        bindIframe(node);
      }
    });
  };

  const onPointerMove = (event: PointerEvent): void => {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    pointerOverIframe =
      hit instanceof HTMLIFrameElement && panelRoot.contains(hit);
  };

  const onPointerLeave = (): void => {
    pointerOverIframe = false;
  };

  const onWindowWheelCapture = (event: WheelEvent): void => {
    if (!pointerOverIframe) return;
    event.stopPropagation();
  };

  syncIframes();
  const observer = new MutationObserver(syncIframes);
  observer.observe(panelRoot, { childList: true, subtree: true });

  panelRoot.addEventListener('pointermove', onPointerMove, { passive: true });
  panelRoot.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('wheel', onWindowWheelCapture, { capture: true, passive: true });

  return () => {
    observer.disconnect();
    panelRoot.removeEventListener('pointermove', onPointerMove);
    panelRoot.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('wheel', onWindowWheelCapture, { capture: true });
    iframeCleanups.splice(0).forEach((cleanup) => cleanup);
  };
}

/** React props helper for optional nested scroll regions outside PanelShape. */
export function panelScrollWheelCaptureProps(): {
  onWheel: (event: ReactWheelEvent<HTMLElement>) => void;
} {
  return {
    onWheel: (event) => {
      handlePanelWheelCapture(event.currentTarget, event.nativeEvent);
    },
  };
}

/** Hook — attach wheel isolation to a panel root ref. */
export function usePanelScrollWheelIsolation(
  ref: RefObject<HTMLElement | null>,
  enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    return attachPanelScrollWheelIsolation(el);
  }, [ref, enabled]);
}

/** Panel ids whose tab strip may capture horizontal wheel when overflowing. */
export const HORIZONTAL_WHEEL_PANEL_IDS = new Set(['web-preview', 'draft-preview']);

/** @deprecated Horizontal scroll is always detected from layout. */
export function panelCapturesHorizontalWheel(panelId: string): boolean {
  void panelId;
  return true;
}
