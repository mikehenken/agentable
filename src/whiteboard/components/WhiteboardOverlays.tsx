import { type ReactElement } from 'react';
import { LayersPanel } from './LayersPanel';
import { PanelDockHighlightOverlay } from './PanelDockHighlightOverlay';
import { SiteContextContextualToolbar } from './SiteContextContextualToolbar';

export interface WhiteboardOverlaysProps {
  enableLayersPanel?: boolean;
  enableSiteContextToolbar?: boolean;
}

/** InFrontOfTheCanvas overlays — layers tree + site-context contextual toolbar. */
export function WhiteboardOverlays({
  enableLayersPanel = false,
  enableSiteContextToolbar = false,
}: WhiteboardOverlaysProps): ReactElement {
  return (
    <>
      <PanelDockHighlightOverlay />
      {enableSiteContextToolbar ? <SiteContextContextualToolbar /> : null}
      {enableLayersPanel ? <LayersPanel /> : null}
    </>
  );
}
