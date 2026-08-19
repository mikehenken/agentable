/**
 * Gallery-13 embed entry — resizable chrome + demo header (P13-T7 iter-7).
 */
export { mountCanvasWideAgentChrome } from './mountCanvasWideAgentChrome';
export { mountGalleryDemoHeader } from './mountGalleryDemoHeader';

import {
  mountCanvasWideAgentChrome,
  awaitGalleryChromeWhiteboardReady,
} from './mountCanvasWideAgentChrome';
import { mountGalleryDemoHeader } from './mountGalleryDemoHeader';

if (typeof window !== 'undefined') {
  window.__mountCanvasWideAgentChrome = mountCanvasWideAgentChrome;
  window.__mountGalleryDemoHeader = mountGalleryDemoHeader;
  window.__awaitGalleryChromeWhiteboardReady = awaitGalleryChromeWhiteboardReady;
}

declare global {
  interface Window {
    __mountCanvasWideAgentChrome?: typeof mountCanvasWideAgentChrome;
    __mountGalleryDemoHeader?: typeof mountGalleryDemoHeader;
    __awaitGalleryChromeWhiteboardReady?: typeof awaitGalleryChromeWhiteboardReady;
  }
}
