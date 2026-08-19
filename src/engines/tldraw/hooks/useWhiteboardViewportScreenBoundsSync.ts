import type { Editor } from 'tldraw';



const VIEWPORT_SELECTOR = '[data-testid="whiteboard-tldraw-viewport"]';

const VIEWPORT_SYNC_DEBOUNCE_MS = 48;



export function readWhiteboardViewportScreenSize(): { w: number; h: number } | null {

  if (typeof document === 'undefined') {

    return null;

  }

  const viewportEl = document.querySelector(VIEWPORT_SELECTOR);

  if (!(viewportEl instanceof HTMLElement)) {

    return null;

  }

  const rect = viewportEl.getBoundingClientRect();

  if (rect.width <= 80 || rect.height <= 80) {

    return null;

  }

  return { w: rect.width, h: rect.height };

}



/**

 * Point tldraw's instance screenBounds at the shell viewport host, not the

 * inflated `.tl-container` scroll height (chat panel DOM can exceed 5k px).

 */

export function syncWhiteboardViewportScreenBounds(editor: Editor): { w: number; h: number } | null {

  if (typeof document === 'undefined') {

    return null;

  }

  const viewportEl = document.querySelector(VIEWPORT_SELECTOR);

  if (!(viewportEl instanceof HTMLElement)) {

    return null;

  }

  viewportEl.style.overflow = 'hidden';

  const tlContainer = viewportEl.querySelector('.tl-container');

  if (tlContainer instanceof HTMLElement) {

    tlContainer.style.height = '100%';

    tlContainer.style.maxHeight = '100%';

    tlContainer.style.minHeight = '0';

  }

  editor.updateViewportScreenBounds(viewportEl);

  return readWhiteboardViewportScreenSize();

}



export function bindWhiteboardViewportScreenBoundsSync(editor: Editor): () => void {

  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') {

    syncWhiteboardViewportScreenBounds(editor);

    return () => undefined;

  }



  const viewportEl = document.querySelector(VIEWPORT_SELECTOR);

  if (!(viewportEl instanceof HTMLElement)) {

    syncWhiteboardViewportScreenBounds(editor);

    return () => undefined;

  }



  let debounceTimer: number | null = null;

  const sync = (): void => {

    syncWhiteboardViewportScreenBounds(editor);

  };

  const scheduleSync = (): void => {

    if (debounceTimer !== null) {

      window.clearTimeout(debounceTimer);

    }

    debounceTimer = window.setTimeout(() => {

      debounceTimer = null;

      sync();

    }, VIEWPORT_SYNC_DEBOUNCE_MS);

  };



  sync();



  const observer = new ResizeObserver(() => {

    scheduleSync();

  });

  observer.observe(viewportEl);

  return () => {
    observer.disconnect();
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}


