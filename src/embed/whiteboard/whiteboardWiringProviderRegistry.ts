/**

 * Generic whiteboard wiring provider registry — packs register factories here;

 * core embed elements resolve wiring without importing any pack.

 */

import type { PartialCanvasTenantConfig } from '../../config/CanvasContext';

import type { RawPanelDataPayload } from '../../config/panelDataNormalize';

import type { NavItemConfig } from '../../components/chrome/navItems';

import type { CanvasHost } from '../../panels/host';

import type { WhiteboardPanelRegistry } from '../../engines/tldraw/shapes/whiteboardPanelRegistry';

import type { EmbedConfigDocument } from '../types/embedConfig';



export interface WhiteboardWiringProviderInput {

  configDocument: EmbedConfigDocument | null;

  tenantConfig: PartialCanvasTenantConfig;

  panelDataRaw: RawPanelDataPayload | null;

  tenant: string;

  fetchFn?: typeof fetch;

}



export interface WhiteboardWiringProviderResult {

  host: CanvasHost;

  navItems: NavItemConfig[];

  panels: WhiteboardPanelRegistry;

  adapterSources?: readonly string[];

  dispose: () => void;

}



export type WhiteboardWiringProvider = (

  input: WhiteboardWiringProviderInput) => WhiteboardWiringProviderResult | null;



const providers: WhiteboardWiringProvider[] = [];



type WhiteboardWiringProviderChangeListener = ()=> void;



const providerChangeListeners = new Set<WhiteboardWiringProviderChangeListener>();



function notifyWhiteboardWiringProvidersChanged(): void {

  for (const listener of providerChangeListeners) {

    listener();
  }

}



/**

 * Subscribe to provider registration changes (e.g. split-script hosts where the

 * pack script loads after the core embed defines the custom element).

 */

export function onWhiteboardWiringProvidersChanged(

  listener: WhiteboardWiringProviderChangeListener): () => void {

  providerChangeListeners.add(listener);

  return () => {

    providerChangeListeners.delete(listener);

  };

}



export function registerWhiteboardWiringProvider(

  provider: WhiteboardWiringProvider): () => void {

  providers.push(provider);

  notifyWhiteboardWiringProvidersChanged();
  return () => {

    const index = providers.indexOf(provider);

    if (index >= 0) {

      providers.splice(index, 1);

      notifyWhiteboardWiringProvidersChanged();
    }

  };

}



export function resetWhiteboardWiringProviders(): void {

  if (providers.length > 0) {

    providers.length = 0;

    notifyWhiteboardWiringProvidersChanged();
  } else {

    providers.length = 0;

  }

}



export function resolveWhiteboardWiringFromProviders(

  input: WhiteboardWiringProviderInput): WhiteboardWiringProviderResult | null {

  for (const provider of providers) {

    const result = provider(input);

    if (result !== null) {

      return result;

    }

  }

  return null;

}



/** @internal Test helper — number of registered providers. */

export function getWhiteboardWiringProviderCount(): number {

  return providers.length;

}


