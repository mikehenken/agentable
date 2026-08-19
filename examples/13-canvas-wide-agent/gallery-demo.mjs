/**
 * Gallery controller for canvas-wide operator.
 * Uses published embed bundles only — no src/ imports.
 */

const statusEl = document.getElementById('status');
const floatingPlacement = document.getElementById('operator-floating');
const headerRoot = document.getElementById('gallery-demo-header-root');

const STORAGE_VISIBLE = 'p13-operator-floating-visible';
const STORAGE_PRESET = 'p13-operator-floating-preset';

/** @typedef {'bottom-left' | 'bottom-right' | 'top-right' | 'free'} FloatingPreset ***
 * @param {HTMLElement | null} el
 * @param {boolean} visible
 */
function applyFloatingVisibility(el, visible) {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.classList.toggle('floating-visible', visible);
  window.localStorage.setItem(STORAGE_VISIBLE, visible ? '1': '0');
}

/**
 * @param {HTMLElement & { setFloatingPreset?: (preset: FloatingPreset) => void } | null} el
 * @param {FloatingPreset} preset
 */
function applyFloatingPreset(el, preset) {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  window.localStorage.setItem(STORAGE_PRESET, preset);
  el.setFloatingPreset?.(preset);
}

if (floatingPlacement instanceof HTMLElement) {
  const savedVisible = window.localStorage.getItem(STORAGE_VISIBLE) === '1';
  applyFloatingVisibility(floatingPlacement, savedVisible);

  window.addEventListener('gallery:floating-toggle', (event) => {
    const detail = /** @type {CustomEvent<{ visible?: boolean }>} */ (event).detail;
    const visible =
      typeof detail?.visible === 'boolean'
        ? detail.visible: !floatingPlacement.classList.contains('floating-visible');
    applyFloatingVisibility(floatingPlacement, visible);
  });

  window.addEventListener('gallery:floating-preset', (event) => {
    const detail = /** @type {CustomEvent<{ preset?: FloatingPreset }>} */ (event).detail;
    if (
      detail?.preset === 'bottom-left' ||
      detail?.preset === 'bottom-right' ||
      detail?.preset === 'top-right'
    ) {
      applyFloatingPreset(
        /** @type {HTMLElement & { setFloatingPreset?: (preset: FloatingPreset) => void }} */ (
          floatingPlacement
        ),
        detail.preset);
    }
  });

  window.addEventListener('gallery:floating-state', (event) => {
    const detail = /** @type {CustomEvent<{ visible?: boolean; preset?: FloatingPreset }>} */ (
      event
    ).detail;
    if (typeof detail?.visible === 'boolean') {
      applyFloatingVisibility(floatingPlacement, detail.visible);
    }
    if (
      detail?.preset === 'bottom-left' ||
      detail?.preset === 'bottom-right' ||
      detail?.preset === 'top-right'
    ) {
      applyFloatingPreset(
        /** @type {HTMLElement & { setFloatingPreset?: (preset: FloatingPreset) => void }} */ (
          floatingPlacement
        ),
        detail.preset);
    }
  });
}

/** @typedef {{ placement: string; placementId: string; pageSessionId: string; surfaceMounted: boolean }} PlacementCheck */

window.__galleryExample = '13-canvas-wide-agent';

window.__operatorGalleryResult = {
  ok: false,
  whiteboardReady: false,
  pageSessionId: '',
  sharedSession: false,
  placementCount: 0,
  placements: /** @type {PlacementCheck[]} */ ([]),
  operatorSurfaceDefined: false,
  voiceDefaultOff: false,
};

/**
 * @param {string} placementId
 * @returns {Promise<HTMLElement & { getOperatorSurface?: => HTMLElement | null; placement?: string; placementId?: string }>}
 */
async function waitForPlacement(placementId) {
  await customElements.whenDefined('agentable-operator-surface-placement');
  const el = document.querySelector(
    `agentable-operator-surface-placement[placement-id="${placementId}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`placement ${placementId} missing`);
  }
  await new Promise((resolve) => {
    const surface = /** @type {{ getOperatorSurface?: => HTMLElement | null }} */ (el).getOperatorSurface?.;
    if (surface) {
      resolve(undefined);
      return;
    }
    el.addEventListener('landi:operator-placement-mounted', () => resolve(undefined), {
      once: true,
    });
  });
  return el;
}

/**
 * @param {HTMLElement & { whenReady?: (timeoutMs?: number) => Promise<boolean> }} whiteboard
 */
async function waitForWhiteboard(whiteboard) {
  await customElements.whenDefined('agentable-whiteboard');
  if (typeof whiteboard.whenReady !== 'function') {
    return false;
  }
  return whiteboard.whenReady(45_000);
}

function mountGalleryHeader {
  if (!(headerRoot instanceof HTMLElement)) {
    return false;
  }
  if (typeof window.__mountGalleryDemoHeader !== 'function') {
    return false;
  }
  const result = window.__mountGalleryDemoHeader(headerRoot);
  return result.ok === true;
}

customElements.whenDefined('agentable-operator-surface-placement').then(async () => {
  try {
    mountGalleryHeader;

    await customElements.whenDefined('agentable-operator-surface');

    const whiteboard = document.querySelector('agentable-whiteboard');
    if (!(whiteboard instanceof HTMLElement)) {
      throw new Error('agentable-whiteboard element missing');
    }

    const [dockInside, floating] = await Promise.all([
      waitForPlacement('operator-main'),
      waitForPlacement('operator-floating'),
    ]);

    const savedPreset = window.localStorage.getItem(STORAGE_PRESET);
    if (
      savedPreset === 'bottom-right' ||
      savedPreset === 'top-right' ||
      savedPreset === 'bottom-left'
    ) {
      applyFloatingPreset(
        /** @type {HTMLElement & { setFloatingPreset?: (preset: FloatingPreset) => void }} */ (
          floating
        ),
        savedPreset);
    }

    const layoutRoot = document.querySelector('.canvas-chrome');
    const skipChrome = window.location.search.includes('nochrome=1');
    if (
      !skipChrome &&
      layoutRoot instanceof HTMLElement &&
      typeof window.__mountCanvasWideAgentChrome === 'function'
    ) {
      const layoutResult = window.__mountCanvasWideAgentChrome(layoutRoot);
      if (!layoutResult.ok) {
        console.warn('[13-canvas-wide-agent] resizable chrome mount skipped:', layoutResult.error);
      }
    }

    let whiteboardReady = await waitForWhiteboard(
      /** @type {HTMLElement & { whenReady?: (timeoutMs?: number) => Promise<boolean> }} */ (
        whiteboard
      ));

    if (
      !skipChrome &&
      layoutRoot instanceof HTMLElement &&
      typeof window.__awaitGalleryChromeWhiteboardReady === 'function' &&
      document.querySelector('.gallery-resizable-mounted') instanceof HTMLElement
    ) {
      whiteboardReady = await window.__awaitGalleryChromeWhiteboardReady(layoutRoot, 30_000);
    }

    const pageSessionHost = window.__agentablePageSession__;
    const pageSessionId =
      pageSessionHost?.session &&
      typeof pageSessionHost.session.sessionId === 'string'
        ? pageSessionHost.session.sessionId: '';

    /** @param {HTMLElement & { getOperatorSurface?: => HTMLElement | null; placement?: string; placementId?: string }} placement */
    function summarizePlacement(placement) {
      const surface = placement.getOperatorSurface?. ?? null;
      return {
        placement: placement.placement ?? placement.getAttribute('placement') ?? '',
        placementId: placement.placementId ?? placement.getAttribute('placement-id') ?? '',
        pageSessionId,
        surfaceMounted: surface instanceof HTMLElement,
      };
    }

    const placements = [summarizePlacement(dockInside), summarizePlacement(floating)];

    const sharedSession =
      pageSessionId.length > 0 &&
      placements.every((entry) => entry.pageSessionId === pageSessionId) &&
      placements.every((entry) => entry.surfaceMounted);

    const result = {
      ok:
        whiteboardReady &&
        sharedSession &&
        placements.length === 2 &&
        customElements.get('agentable-operator-surface') !== undefined,
      whiteboardReady,
      pageSessionId,
      sharedSession,
      placementCount: placements.length,
      placements,
      operatorSurfaceDefined: customElements.get('agentable-operator-surface') !== undefined,
      voiceDefaultOff: whiteboard.getAttribute('voice-enabled') === null,
      canvasChatDisabled:
        whiteboard.getAttribute('open-chat-on-mount') === 'false' &&
        whiteboard.hasAttribute('suppress-canvas-chat'),
      canvasChatSuppressed: whiteboard.hasAttribute('suppress-canvas-chat'),
      resizableChromeMounted: document.querySelector('.gallery-resizable-mounted') instanceof HTMLElement,
      galleryHeaderMounted: document.querySelector('[data-testid="gallery-demo-header"]') !== null,
      floatingVisible: window.localStorage.getItem(STORAGE_VISIBLE) === '1',
      floatingPreset: window.localStorage.getItem(STORAGE_PRESET) ?? 'bottom-left',
    };

    window.__operatorGalleryResult = result;
    window.__galleryReady = {
      example: '13-canvas-wide-agent',
      ok: result.ok,
      whiteboardReady: result.whiteboardReady,
      sharedSession: result.sharedSession,
      placementCount: result.placementCount,
    };

    result.resizableChromeMounted =
      skipChrome === false && document.querySelector('.gallery-resizable-mounted') instanceof HTMLElement;

    window.__operatorGalleryResult = result;

    if (statusEl) {
      statusEl.textContent = JSON.stringify(result, null, 2);
    }
  } catch (err) {
    console.error('[13-canvas-wide-agent] demo failed:', err);
    window.__galleryReady = { example: '13-canvas-wide-agent', ok: false };
    if (statusEl) {
      statusEl.textContent = String(err);
    }
  }
});
