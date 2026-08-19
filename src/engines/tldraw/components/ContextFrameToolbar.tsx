import { useCallback, type ReactElement } from 'react';
import { LayoutGrid, Plus, Share2 } from 'lucide-react';
import {
  Box,
  TldrawUiButton,
  TldrawUiContextualToolbar,
  TldrawUiDropdownMenuCheckboxItem,
  TldrawUiDropdownMenuContent,
  TldrawUiDropdownMenuRoot,
  TldrawUiDropdownMenuTrigger,
  TldrawUiToolbarButton,
  track,
  useEditor,
  useValue,
  type TLShapeId,
} from 'tldraw';
import { resolveContextFrameFromSelection } from '../context/contextGroupApi';
import {
  emitContextFrameToolbarAction,
  type ContextFrameToolbarPanelId,
} from '../context/contextFrameToolbarEvents';

const ADD_PANEL_ITEMS: { panelId: ContextFrameToolbarPanelId; label: string }[] = [
  { panelId: 'web-preview', label: 'Preview' },
  { panelId: 'file-manager', label: 'Files' },
  { panelId: 'project-brief', label: 'Brief' },
  { panelId: 'chat', label: 'Chat' },
  { panelId: 'settings', label: 'Settings' },
  { panelId: 'assets', label: 'Assets' },
  { panelId: 'snapshots', label: 'Snapshots' },
];

function getSiteFrameScreenBounds(
  editor: ReturnType<typeof useEditor>,
  frameId: TLShapeId,
): Box | undefined {
  const pageBounds = editor.getShapePageBounds(frameId);
  if (!pageBounds) return undefined;
  const topLeft = editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y });
  const topRight = editor.pageToScreen({ x: pageBounds.maxX, y: pageBounds.y });
  return new Box(topLeft.x, topLeft.y, topRight.x - topLeft.x, 0);
}

export const ContextFrameToolbar = track(function ContextFrameToolbar(): ReactElement | null {
  const editor = useEditor();

  const siteContext = useValue(
    'siteContextToolbar',
    () => {
      if (!editor.isInAny('select.idle', 'select.pointing_shape')) return null;
      return resolveContextFrameFromSelection(editor);
    },
    [editor],
  );

  const getSelectionBounds = useCallback((): Box | undefined => {
    if (!siteContext) return undefined;
    const frameBounds = getSiteFrameScreenBounds(editor, siteContext.frameId);
    if (frameBounds) return frameBounds;
    const fullBounds = editor.getSelectionScreenBounds();
    if (!fullBounds) return undefined;
    return new Box(fullBounds.x, fullBounds.y, fullBounds.width, 0);
  }, [editor, siteContext]);

  if (!siteContext) return null;

  const { siteId: contextId } = siteContext;

  const openPanel = (panelId: ContextFrameToolbarPanelId): void => {
    emitContextFrameToolbarAction({ type: 'open-panel', panelId, contextId });
  };

  return (
    <div data-testid="site-context-contextual-toolbar">
      <TldrawUiContextualToolbar getSelectionBounds={getSelectionBounds} label="Site actions">
        <TldrawUiDropdownMenuRoot id="site-context-add-panel">
          <TldrawUiDropdownMenuTrigger>
            <TldrawUiToolbarButton type="menu" title="Add panel">
              <Plus size={16} aria-hidden />
            </TldrawUiToolbarButton>
          </TldrawUiDropdownMenuTrigger>
          <TldrawUiDropdownMenuContent side="bottom" align="start">
            {ADD_PANEL_ITEMS.map(({ panelId, label }) => (
              <TldrawUiDropdownMenuCheckboxItem
                key={panelId}
                title={label}
                onSelect={() => openPanel(panelId)}
              >
                {label}
              </TldrawUiDropdownMenuCheckboxItem>
            ))}
          </TldrawUiDropdownMenuContent>
        </TldrawUiDropdownMenuRoot>

        <TldrawUiToolbarButton
          type="icon"
          title="Auto-arrange panels"
          data-testid="site-context-auto-arrange"
          onClick={() => emitContextFrameToolbarAction({ type: 'auto-arrange', contextId })}
        >
          <LayoutGrid size={16} aria-hidden />
        </TldrawUiToolbarButton>

        <TldrawUiToolbarButton
          type="icon"
          title="Publish"
          onClick={() => emitContextFrameToolbarAction({ type: 'publish', contextId })}
        >
          <Share2 size={16} aria-hidden />
        </TldrawUiToolbarButton>

        <TldrawUiButton
          type="normal"
          title="Save canvas snapshot"
          onClick={() => emitContextFrameToolbarAction({ type: 'save', contextId })}
        >
          Save
        </TldrawUiButton>
      </TldrawUiContextualToolbar>
    </div>
  );
});
