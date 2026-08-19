/**
 * Shared Playwright helpers for gallery e2e.
 */
import type { Page } from '@playwright/test';

const DEFAULT_IGNORE = [
  'Lit is in dev mode',
  'not a valid hex',
  'Gemini',
  'VITE_GEMINI',
  'Failed to load resource',
  'net::ERR',
];

export function attachConsoleGuard(page: Page, extraIgnore: string[] = []): string[] {
  const consoleErrors: string[] = [];
  const ignore = [...DEFAULT_IGNORE,...extraIgnore];

  page.on('console', (message) => {
    if (message.type === 'error') {
      consoleErrors.push(message.text);
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  return consoleErrors.filter((line) => !ignore.some((fragment) => line.includes(fragment)));
}

export function filterConsoleErrors(errors: string[], extraIgnore: string[] = []): string[] {
  const ignore = [...DEFAULT_IGNORE,...extraIgnore];
  return errors.filter((line) => !ignore.some((fragment) => line.includes(fragment)));
}

export async function waitForGalleryReady(
  page: Page,
  exampleId: string,
  timeoutMs = 30_000): Promise<{ ok: boolean; [key: string]: unknown }> {
  await page.waitForFunction(
    (id) => {
      const ready = window.__galleryReady;
      return ready?.example === id && ready.ok === true;
    },
    exampleId,
    { timeout: timeoutMs });
  return page.evaluate(() => window.__galleryReady ?? { ok: false });
}

declare global {
  interface Window {
    __galleryExample?: string;
    __galleryReady?: { example: string; ok: boolean; [key: string]: unknown };
    __multiAgentE2eResult?: { ok: boolean; checks: Array<{ name: string; ok: boolean }> };
    __agentPresentsGalleryResult?: { ok: boolean; checks: Array<{ name: string; ok: boolean }> };
    __meridianDemoResult?: {
      ok: boolean;
      flowBoxCount: number;
      stencilCount: number;
      totalShapes: number;
    };
    __meridianDocumentResult?: {
      ok: boolean;
      panelId: string;
      blockCount: number;
      title: string;
    };
    __meridianExportResult?: {
      ok: boolean;
      filename?: string;
      sha256?: string;
      format: 'pdf';
    };
    __meridianHitlResult?: {
      ok: boolean;
      pendingBeforeSave: number;
      pendingAfterSave: number;
      saveCompleted: boolean;
      authoringDidNotQueueHitl: boolean;
    };
    __appShellReadyDetail?: { tenant: string; restored: boolean };
    __operatorGalleryResult?: {
      ok: boolean;
      whiteboardReady: boolean;
      pageSessionId: string;
      sharedSession: boolean;
      placementCount: number;
      placements: Array<{
        placement: string;
        placementId: string;
        pageSessionId: string;
        surfaceMounted: boolean;
      }>;
      operatorSurfaceDefined: boolean;
      voiceDefaultOff: boolean;
    };
  }
}

export const GALLERY_EXAMPLES = [
  { id: '01-career-homepage', path: '/examples/01-career-homepage/index.html' },
  { id: '02-job-board-inline', path: '/examples/02-job-board-inline/index.html' },
  { id: '03-multi-surface-dashboard', path: '/examples/03-multi-surface-dashboard/index.html' },
  { id: '04-zero-js-marketing', path: '/examples/04-zero-js-marketing/index.html' },
  { id: '05-bounded-demo-kiosk', path: '/examples/05-bounded-demo-kiosk/index.html' },
  { id: '06-react-host-deep', path: '/examples/06-react-host-deep/index.html' },
  { id: '07-iframe-cms', path: '/examples/07-iframe-cms/index.html' },
  { id: '08-agent-presents', path: '/examples/08-agent-presents/index.html' },
  { id: '09-multi-agent-page', path: '/examples/09-multi-agent-page/index.html' },
  { id: '10-locale-rtl', path: '/examples/10-locale-rtl/index.html' },
  { id: '11-app-shell', path: '/examples/11-app-shell/index.html' },
  { id: '12-open-agent-canvas', path: '/examples/12-open-agent-canvas/index.html' },
  { id: '13-canvas-wide-agent', path: '/examples/13-canvas-wide-agent/index.html' },
] as const;
