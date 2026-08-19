/**
 * Live whiteboard chrome insets — reads NavSidebar expanded state so default
 * panel placement / auto-arrange clear the Menu overlay (expanded vs rail).
 */
import type { Editor } from 'tldraw';
import type { ViewportLayoutConfig } from '../../../layout/panelLayoutEngine';
import { useLayoutStore } from '../../../components/chrome/navChromeStore';
import {
  WHITEBOARD_VIEWPORT_INSET,
  computeWhiteboardChromeInsets,
  type WhiteboardChromeInsets,
} from './responsiveWhiteboardLayout';

export interface ResolveWhiteboardChromeInsetsOptions {
  /** Override store-backed nav expanded flag (tests). */
  navExpanded?: boolean;
  showNavSidebar?: boolean;
}

/** Resolve chrome insets from viewport width + live (or overridden) nav state. */
export function resolveWhiteboardChromeInsets(
  viewportWidth: number,
  options: ResolveWhiteboardChromeInsetsOptions = {},
): WhiteboardChromeInsets {
  const navExpanded =
    options.navExpanded ?? useLayoutStore.getState().navSidebarExpanded;
  return computeWhiteboardChromeInsets({
    viewportWidth,
    navExpanded,
    showNavSidebar: options.showNavSidebar,
  });
}

/**
 * Free-canvas viewport box in page space — left/top clear Menu + edge inset.
 */
export function getFreeCanvasViewportConfig(
  editor: Editor,
  options: ResolveWhiteboardChromeInsetsOptions & { gap?: number } = {},
): ViewportLayoutConfig {
  const viewportBounds = editor.getViewportPageBounds();
  const chrome = resolveWhiteboardChromeInsets(viewportBounds.w, options);
  const inset = WHITEBOARD_VIEWPORT_INSET;
  return {
    left: viewportBounds.x + chrome.left,
    top: viewportBounds.y + chrome.top,
    right: viewportBounds.x + viewportBounds.w - inset,
    bottom: viewportBounds.y + viewportBounds.h - inset,
    gap: options.gap ?? 16,
  };
}

export {
  WHITEBOARD_VIEWPORT_INSET,
  computeWhiteboardChromeInsets,
  type WhiteboardChromeInsets,
};
