/**
 * Lightweight whiteboard readiness probes for gallery embeds (P13-T7 iter-13).
 * No meridian/document imports — safe for gallery-13-chrome bundle.
 */
import { isDrawCapabilityAvailable } from '../agents/engineBridge';
import { getEditor } from '../engines/tldraw/shapes/panelShapeApi';

export async function waitForGalleryWhiteboardReady(
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isDrawCapabilityAvailable() && getEditor() !== null) {
      return true;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50);
    });
  }
  return false;
}

/** After gallery-13 resizable chrome reparents the canvas pane, nudge layout + re-bind editor. */
export async function settleGalleryWhiteboardAfterChromeMount(
  timeoutMs = 25_000,
): Promise<boolean> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'));
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 120);
      });
    });
  });
  return waitForGalleryWhiteboardReady(timeoutMs);
}
