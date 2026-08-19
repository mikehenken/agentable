import { isDrawCapabilityAvailable } from '../engineBridge';

/**
 * Operator canvas tool readiness.
 * Uses the whiteboard host — never imports panelShapeApi/tldraw in the operator embed.
 */
interface WhiteboardReadyHost extends HTMLElement {
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
}

const DEFAULT_READY_TIMEOUT_MS = 5_000;

/** Poll until the embed whiteboard reports editor + draw readiness. */
export async function waitForOperatorCanvasToolsReady(
  timeoutMs: number = DEFAULT_READY_TIMEOUT_MS,
): Promise<boolean> {
  const host = document.querySelector('agentable-whiteboard');
  if (!(host instanceof HTMLElement) || typeof (host as WhiteboardReadyHost).whenReady !== 'function') {
    return false;
  }
  const ready = await (host as WhiteboardReadyHost).whenReady?.(timeoutMs);
  return ready === true && isDrawCapabilityAvailable();
}

export function isOperatorCanvasToolsReady(): boolean {
  const host = document.querySelector('agentable-whiteboard');
  return host instanceof HTMLElement && isDrawCapabilityAvailable();
}
