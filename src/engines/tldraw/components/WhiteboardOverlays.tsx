import { type ReactElement } from 'react';
import { LayersPanel } from './LayersPanel';
import { PanelDockHighlightOverlay } from './PanelDockHighlightOverlay';
import { ContextFrameToolbar } from './ContextFrameToolbar';

export interface WhiteboardOverlaysProps {
  enableLayersPanel?: boolean;
  enableContextToolbar?: boolean;
}

/** InFrontOfTheCanvas overlays — layers tree + site-context contextual toolbar. */
export function WhiteboardOverlays({
  enableLayersPanel = false,
  enableContextToolbar = false,
}: WhiteboardOverlaysProps): ReactElement {
  return (
    <>
      <PanelDockHighlightOverlay />
      {enableContextToolbar ? <ContextFrameToolbar /> : null}
      {enableLayersPanel ? <LayersPanel /> : null}
    </>
  );
}
