/**
 * Mount React gallery demo header for example 13.
 */
import { createRoot, type Root } from 'react-dom/client';
import { GalleryDemoHeader } from './GalleryDemoHeader';
import '../../index.css';

let activeRoot: Root | null = null;

export interface MountGalleryDemoHeaderResult {
  ok: boolean;
  error?: string;
}

export function mountGalleryDemoHeader(container: HTMLElement): MountGalleryDemoHeaderResult {
  if (!(container instanceof HTMLElement)) {
    return { ok: false, error: 'header container missing' };
  }

  activeRoot?.unmount;
  activeRoot = createRoot(container);
  activeRoot.render(<GalleryDemoHeader />);
  return { ok: true };
}

export function unmountGalleryDemoHeader(): void {
  activeRoot?.unmount;
  activeRoot = null;
}

if (typeof window !== 'undefined') {
  window.__mountGalleryDemoHeader = mountGalleryDemoHeader;
}

declare global {
  interface Window {
    __mountGalleryDemoHeader?: typeof mountGalleryDemoHeader;
  }
}
