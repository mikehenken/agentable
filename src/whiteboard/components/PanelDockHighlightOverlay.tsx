/**
 * Edge glow lines shown while dragging a panel near a dock zone (~12px).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useEditor, useValue } from 'tldraw';
import {
  getPanelDockPreview,
  setPanelDockPreview,
  subscribePanelDockPreview,
} from '../hooks/panelDockUiState';
import type { DockZoneHighlight } from '../context/panelDockEngine';

const HIGHLIGHT_COLOR = 'rgba(56, 189, 248, 0.95)';
const HIGHLIGHT_GLOW = 'rgba(56, 189, 248, 0.35)';

function HighlightLine({ segment }: { segment: DockZoneHighlight }): ReactElement {
  const editor = useEditor();
  const camera = useValue('dockHighlightCamera', () => editor.getCamera(), [editor]);

  const zoom = camera.z;
  const pageX1 = segment.x1;
  const pageY1 = segment.y1;
  const pageX2 = segment.x2;
  const pageY2 = segment.y2;

  const screenX1 = (pageX1 + camera.x) * zoom;
  const screenY1 = (pageY1 + camera.y) * zoom;
  const screenX2 = (pageX2 + camera.x) * zoom;
  const screenY2 = (pageY2 + camera.y) * zoom;

  const isHorizontal = segment.y1 === segment.y2;
  const strokeWidth = isHorizontal ? 3 : 3;
  const length = isHorizontal ? Math.abs(screenX2 - screenX1) : Math.abs(screenY2 - screenY1);

  return (
    <div
      aria-hidden
      data-testid={`panel-dock-highlight-${segment.edge}`}
      style={{
        position: 'absolute',
        left: Math.min(screenX1, screenX2),
        top: Math.min(screenY1, screenY2),
        width: isHorizontal ? length : strokeWidth,
        height: isHorizontal ? strokeWidth : length,
        background: HIGHLIGHT_COLOR,
        boxShadow: `0 0 10px 2px ${HIGHLIGHT_GLOW}`,
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 1200,
      }}
    />
  );
}

export function PanelDockHighlightOverlay(): ReactElement | null {
  const editor = useEditor();
  const [preview, setPreview] = useState(getPanelDockPreview);

  useEffect(() => subscribePanelDockPreview(() => setPreview(getPanelDockPreview())), []);

  const isDraggingPanel = useValue(
    'panelDockDragging',
    () => {
      if (!editor.isIn('select.translating')) return false;
      const selected = editor.getSelectedShapeIds();
      return selected.length === 1 && editor.getShape(selected[0])?.type === 'panel';
    },
    [editor],
  );

  useEffect(() => {
    if (!isDraggingPanel) {
      setPanelDockPreview(null);
    }
  }, [isDraggingPanel]);

  if (!isDraggingPanel || !preview) {
    return null;
  }

  return (
    <div
      data-testid="panel-dock-highlight-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <HighlightLine segment={preview.highlight} />
    </div>
  );
}
