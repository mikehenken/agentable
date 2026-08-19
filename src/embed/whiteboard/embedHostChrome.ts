/**
 * Embed host chrome — fullpage engage + host header height for Lit shadow hosts.
 *
 * Host pages may listen for `landi:canvas-fullpage` on the embed element
 * (composed + bubbling) to expand the canvas section below a site header.
 */
import {
  HOST_HEADER_HEIGHT_VAR,
  parseHostHeaderHeight,
} from '../../engines/tldraw/canvasMode';

export const EMBED_HOST_FULLPAGE_CLASS = 'agentable-canvas-host-fullpage';

export const CANVAS_FULLPAGE_EVENT = 'landi:canvas-fullpage';

/** @deprecated Alias emitted alongside {@link CANVAS_FULLPAGE_EVENT} for older hosts. */
export const CANVAS_FULLPAGE_EVENT_ALIAS = 'agentable:fullpage';

export interface CanvasFullpageDetail {
  active: boolean;
}

/** Resolve the Lit custom-element host from a node inside its shadow tree. */
export function resolveEmbedHostElement(node: Node | null): HTMLElement | null {
  if (node === null) {
    return null;
  }
  const root = node.getRootNode;
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    return root.host;
  }
  return null;
}

export function applyHostHeaderHeight(
  host: HTMLElement | null,
  rawHeight: string | null | undefined): void {
  if (host === null) {
    return;
  }
  const parsed = parseHostHeaderHeight(rawHeight ?? null);
  if (parsed === null) {
    host.style.removeProperty(HOST_HEADER_HEIGHT_VAR);
    return;
  }
  host.style.setProperty(HOST_HEADER_HEIGHT_VAR, parsed);
}

export function clearHostHeaderHeight(host: HTMLElement | null): void {
  host?.style.removeProperty(HOST_HEADER_HEIGHT_VAR);
}

export function dispatchCanvasFullpageEvent(
  host: HTMLElement | null,
  active: boolean): void {
  if (host === null) {
    return;
  }
  const detail: CanvasFullpageDetail = { active };
  for (const type of [CANVAS_FULLPAGE_EVENT_ALIAS, CANVAS_FULLPAGE_EVENT] as const) {
    host.dispatchEvent(
      new CustomEvent<CanvasFullpageDetail>(type, {
        bubbles: true,
        composed: true,
        detail,
      }));
  }
}

export function enterEmbedHostFullpage(
  host: HTMLElement | null,
  hostHeaderHeight: string | null | undefined): void {
  if (host === null) {
    return;
  }
  applyHostHeaderHeight(host, hostHeaderHeight);
  host.classList.add(EMBED_HOST_FULLPAGE_CLASS);
  dispatchCanvasFullpageEvent(host, true);
}

export function exitEmbedHostFullpage(host: HTMLElement | null): void {
  if (host === null) {
    return;
  }
  host.classList.remove(EMBED_HOST_FULLPAGE_CLASS);
  clearHostHeaderHeight(host);
  dispatchCanvasFullpageEvent(host, false);
}
