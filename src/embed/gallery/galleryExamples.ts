/**
 * Static gallery example list — mirrors `tests/e2e/helpers/galleryHelpers.ts`.
 */
export interface GalleryExampleEntry {
  id: string;
  path: string;
  label: string;
}

export const GALLERY_EXAMPLES: readonly GalleryExampleEntry[] = [
  { id: '01-career-homepage', path: '/examples/01-career-homepage/index.html', label: '01 · Career homepage' },
  { id: '02-job-board-inline', path: '/examples/02-job-board-inline/index.html', label: '02 · Job board inline' },
  { id: '03-multi-surface-dashboard', path: '/examples/03-multi-surface-dashboard/index.html', label: '03 · Multi-surface dashboard' },
  { id: '04-zero-js-marketing', path: '/examples/04-zero-js-marketing/index.html', label: '04 · Zero-JS marketing' },
  { id: '05-bounded-demo-kiosk', path: '/examples/05-bounded-demo-kiosk/index.html', label: '05 · Bounded demo kiosk' },
  { id: '06-react-host-deep', path: '/examples/06-react-host-deep/index.html', label: '06 · React host deep' },
  { id: '07-iframe-cms', path: '/examples/07-iframe-cms/index.html', label: '07 · iframe CMS' },
  { id: '08-agent-presents', path: '/examples/08-agent-presents/index.html', label: '08 · Agent presents' },
  { id: '09-multi-agent-page', path: '/examples/09-multi-agent-page/index.html', label: '09 · Multi-agent page' },
  { id: '10-locale-rtl', path: '/examples/10-locale-rtl/index.html', label: '10 · Locale RTL' },
  { id: '11-app-shell', path: '/examples/11-app-shell/index.html', label: '11 · App shell' },
  { id: '12-open-agent-canvas', path: '/examples/12-open-agent-canvas/index.html', label: '12 · Open agent canvas' },
  { id: '13-canvas-wide-agent', path: '/examples/13-canvas-wide-agent/index.html', label: '13 · Canvas-wide agent' },
] as const;

export const CURRENT_GALLERY_EXAMPLE_ID = '13-canvas-wide-agent';

export type FloatingPreset = 'bottom-left' | 'bottom-right' | 'top-right';
