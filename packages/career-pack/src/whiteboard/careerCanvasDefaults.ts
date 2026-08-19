/**
 * Career whiteboard canvas + toolbar defaults (Moss Sandals ).
 *
 * Hosts may override via embed config (`canvasZoom`, `toolbar`) or React
 * `WhiteboardShell` props (`mode`, `toolbarConfig`).
 */
import type { CanvasMode } from '../../../../src/engine/types';
import type { EmbedConfigDocument } from '../../../../src/embed/types/embedConfig';
import type { WhiteboardToolbarConfig } from '../../../../src/engines/tldraw/toolbar/toolbarConfig';
import {
  DEFAULT_CAREER_HOST_CHROME,
  resolveCareerHostChrome,
  type WhiteboardHostChromeConfig,
} from '../../../../src/engines/tldraw/hostChrome/whiteboardHostChrome';
import {
  DEFAULT_CAREER_NAV_CHROME,
  type NavChromeConfig,
} from '../../../../src/components/chrome/navChrome';

/** Bounded page with pan-only camera — no free zoom in/out (Moss/Sandals parity). */
export const DEFAULT_CAREER_BOUNDED_MODE: CanvasMode = {
  kind: 'bounded',
  bounds: { w: 1200, h: 800 },
  behavior: 'inside',
  zoom: 'locked',
};

/** Embed attribute config-url fields for career hosts. */
export const DEFAULT_CAREER_EMBED_CANVAS_ATTRS = {
  canvasMode: 'bounded',
  canvasBounds: '1200x800',
  canvasZoom: 'locked',
  snapGrid: true,
} as const;

/**
 * Career toolbar: pan/select/draw + career chrome.
 * Layout actions (auto-arrange reset) live on the bottom toolbar only.
 */
export const DEFAULT_CAREER_TOOLBAR_CONFIG: WhiteboardToolbarConfig = {
  drawingEnabled: true,
  tools: [
    'select',
    'draw',
    'hand',
    'layers',
    'voice',
    'attach',
    'recent-activity',
    'screenshot',
    'dock-menu',
    'auto-arrange',
    'reset',
  ],
  layoutActionPlacement: 'toolbar',
  customActions: [
    { id: 'attach', label: 'Attach', icon: 'paperclip', placement: 'toolbar' },
    { id: 'recent-activity', label: 'Recent activity', icon: 'clock', placement: 'toolbar' },
    { id: 'screenshot', label: 'Screenshot', icon: 'camera', placement: 'toolbar' },
    { id: 'dock-menu', label: 'Dock', icon: 'layout-grid', placement: 'toolbar' },
  ],
};

/** Merge career canvas + toolbar defaults into an embed config document. */
export function applyCareerEmbedDefaults(doc: EmbedConfigDocument): EmbedConfigDocument {
  return {...doc,
    canvasMode: doc.canvasMode ?? DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasMode,
    canvasBounds: doc.canvasBounds ?? DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasBounds,
    canvasZoom: doc.canvasZoom ?? DEFAULT_CAREER_EMBED_CANVAS_ATTRS.canvasZoom,
    snapGrid: doc.snapGrid ?? DEFAULT_CAREER_EMBED_CANVAS_ATTRS.snapGrid,
    toolbar: doc.toolbar ?? DEFAULT_CAREER_TOOLBAR_CONFIG,
  };
}

/** Shell props slice for React career whiteboard wrappers. */
export function resolveCareerWhiteboardShellDefaults(): {
  mode: CanvasMode;
  toolbarConfig: WhiteboardToolbarConfig;
  snapGrid: boolean;
  hostChrome: ReturnType<typeof resolveCareerHostChrome>;
  navChrome: NavChromeConfig;
} {
  return {
    mode: DEFAULT_CAREER_BOUNDED_MODE,
    toolbarConfig: DEFAULT_CAREER_TOOLBAR_CONFIG,
    snapGrid: DEFAULT_CAREER_EMBED_CANVAS_ATTRS.snapGrid,
    hostChrome: resolveCareerHostChrome(),
    navChrome: DEFAULT_CAREER_NAV_CHROME,
  };
}

/** Marketing homepage `#agent` embed — isolated persistence + first-paint layout. */
export const CAREER_HOMEPAGE_EMBED_PERSISTENCE_SCOPE = 'homepage-embed';

export function resolveCareerHomepageEmbedHostChrome(): ReturnType<typeof resolveCareerHostChrome> {
  return resolveCareerHostChrome({
    frameWidthPercent: 98,
    frameEdgeMargin: 3,
    frameBorder: true,
    frameBorderRadius: 16,
    hostHeaderHeight: '80px',
    fullscreenMode: 'canvas-expand',
  });
}

export { DEFAULT_CAREER_HOST_CHROME, resolveCareerHostChrome, type WhiteboardHostChromeConfig };
