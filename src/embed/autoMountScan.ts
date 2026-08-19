/**

 * auto-mount scan: one script tag, zero authored JS.

 *

 * Scans `[data-agentable-panel]` placeholders and `[data-agentable-slot]`

 * regions, wiring both into the shared page session.

 *

 * placeholders with `data-lazy-hydrate` show a skeleton until visible,

 * then mount `<agentable-panel>` on intersection.

 */

import { ensurePageSession } from '../session/pageSession';

import { ensurePageSlotRegistry } from '../session/pageSlots';

import {

  clearPlaceholderEmbedSkeleton,

  DATA_LAZY_PENDING_ATTR,
  observeLazyVisibility,

  renderPlaceholderEmbedSkeleton,

} from './lazyHydration';

import {

  mountAgentablePanelIn,

  readMountConfigFromPlaceholder,

  resolvePanelIdFromPlaceholder,

} from './mountAgentablePanel';



export const DATA_PANEL_ATTR = 'data-agentable-panel';

export const DATA_SLOT_ATTR = 'data-agentable-slot';

export const DATA_MOUNTED_ATTR = 'data-agentable-mounted';

export { DATA_LAZY_PENDING_ATTR } from './lazyHydration';



export interface AutoMountScanResult {

  panelsMounted: number;

  panelsDeferred: number;

  slotsRegistered: number;

  skipped: number;

}



export interface AutoMountScanOptions {

  root?: ParentNode;

  /** When true, observe DOM mutations for late-added placeholders. Default true. */

  observe?: boolean;

}



const lazyMountHandles = new WeakMap<HTMLElement, () => void>();



function isElement(node: Node): node is Element {

  return node.nodeType === Node.ELEMENT_NODE;

}



function isAlreadyMounted(element: Element): boolean {

  return element.hasAttribute(DATA_MOUNTED_ATTR) || element.querySelector('agentable-panel') !== null;

}



function finalizePanelMount(element: HTMLElement, config: NonNullable<ReturnType<typeof readMountConfigFromPlaceholder>>): void {

  mountAgentablePanelIn(element, config);

  clearPlaceholderEmbedSkeleton(element);

  element.removeAttribute(DATA_LAZY_PENDING_ATTR);

  element.setAttribute(DATA_MOUNTED_ATTR, '');

}



function mountPanelPlaceholder(element: HTMLElement): 'mounted' | 'deferred' | 'skipped' {

  if (isAlreadyMounted(element)) {

    return 'skipped';

  }



  const config = readMountConfigFromPlaceholder(element);

  if (config === null) {

    console.warn('[autoMountScan] skipping panel placeholder without panel id', element);

    return 'skipped';

  }



  if (config.lazyHydrate) {

    if (element.hasAttribute(DATA_LAZY_PENDING_ATTR)) {

      return 'deferred';

    }



    renderPlaceholderEmbedSkeleton(element);

    element.setAttribute(DATA_LAZY_PENDING_ATTR, '');



    const priorHandle = lazyMountHandles.get(element);

    priorHandle?.();



    const handle = observeLazyVisibility(element, () => {

      if (isAlreadyMounted(element)) {

        return;

      }

      finalizePanelMount(element, { ...config, lazyHydrate: false });

      lazyMountHandles.delete(element);

    });

    lazyMountHandles.set(element, handle.disconnect);

    return 'deferred';

  }



  finalizePanelMount(element, config);

  return 'mounted';

}



function registerSlotPlaceholder(element: HTMLElement): boolean {

  const slotId = element.getAttribute(DATA_SLOT_ATTR)?.trim();

  if (!slotId) {

    console.warn('[autoMountScan] skipping slot placeholder without slot id', element);

    return false;

  }



  const registry = ensurePageSlotRegistry();

  const prior = element.dataset.agentableSlotRegistered;

  if (prior === slotId) {

    return false;

  }



  registry.register(slotId, element);

  element.dataset.agentableSlotRegistered = slotId;

  return true;

}



/**

 * Scan `root` for panel placeholders and named slots. Idempotent for

 * already-mounted panels and already-registered slots.

 */

export function scanAutoMountTargets(root: ParentNode = document): AutoMountScanResult {

  ensurePageSession();
  let panelsMounted = 0;

  let panelsDeferred = 0;

  let slotsRegistered = 0;

  let skipped = 0;



  const panelNodes = root.querySelectorAll(`[${DATA_PANEL_ATTR}]`);

  for (const node of panelNodes) {

    if (!isElement(node) || !(node instanceof HTMLElement)) {

      continue;

    }

    const outcome = mountPanelPlaceholder(node);

    if (outcome === 'mounted') {

      panelsMounted += 1;

    } else if (outcome === 'deferred') {

      panelsDeferred += 1;

    } else if (!resolvePanelIdFromPlaceholder(node)) {

      skipped += 1;

    }

  }



  const slotNodes = root.querySelectorAll(`[${DATA_SLOT_ATTR}]`);

  for (const node of slotNodes) {

    if (!isElement(node) || !(node instanceof HTMLElement)) {

      continue;

    }

    if (registerSlotPlaceholder(node)) {

      slotsRegistered += 1;

    }

  }



  return { panelsMounted, panelsDeferred, slotsRegistered, skipped };

}



/** Observe DOM additions and scan new placeholders. Returns disconnect fn. */

export function startAutoMountObserver(root: ParentNode = document.documentElement): () => void {

  if (typeof MutationObserver === 'undefined') {

    return () => undefined;

  }



  const observer = new MutationObserver((records) => {

    for (const record of records) {

      for (const node of record.addedNodes) {

        if (!isElement(node)) {

          continue;

        }

        if (node.matches(`[${DATA_PANEL_ATTR}]`) && node instanceof HTMLElement) {

          mountPanelPlaceholder(node);

        }

        if (node.matches(`[${DATA_SLOT_ATTR}]`) && node instanceof HTMLElement) {

          registerSlotPlaceholder(node);

        }

        scanAutoMountTargets(node);

      }

    }

  });



  observer.observe(root, { childList: true, subtree: true });

  return () => {

    observer.disconnect();
  };

}



/**

 * Initial scan + optional MutationObserver. Returns teardown for tests.

 */

export function bootstrapAutoMountScan(options: AutoMountScanOptions = {}): () => void {

  const root = options.root ?? document;

  const result = scanAutoMountTargets(root);



  if (result.panelsMounted > 0 || result.panelsDeferred > 0 || result.slotsRegistered > 0) {

    console.info(

      `[autoMountScan] mounted ${result.panelsMounted} panel(s), deferred ${result.panelsDeferred} lazy panel(s), registered ${result.slotsRegistered} slot(s)`);

  }



  if (options.observe === false) {

    return () => undefined;

  }



  const observeRoot = root instanceof Document ? root.documentElement : root;

  return startAutoMountObserver(observeRoot);

}



/** Test-only: disconnect lazy observers registered for a placeholder. */

export function __disconnectLazyMountForTests__(element: HTMLElement): void {

  lazyMountHandles.get(element)?.();

  lazyMountHandles.delete(element);

}


