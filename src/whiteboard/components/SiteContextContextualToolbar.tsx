import { useCallback, type ReactElement } from 'react';
import {
  Box,
  TldrawUiButton,
  TldrawUiButtonIcon,
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
import { resolveSiteContextFromSelection } from '../context/contextGroupApi';
import {
  emitSiteContextToolbarAction,
  type SiteContextToolbarPanelId,
} from '../context/siteContextToolbarEvents';

const ADD_PANEL_ITEMS: { panelId: SiteContextToolbarPanelId; label: string }[] = [
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

export const SiteContextContextualToolbar = track(function SiteContextContextualToolbar(): ReactElement | null {
  const editor = useEditor();

  const siteContext = useValue(
    'siteContextToolbar',
    () => {
      if (!editor.isInAny('select.idle', 'select.pointing_shape')) return null;
      return resolveSiteContextFromSelection(editor);
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

  const { siteId } = siteContext;

  const openPanel = (panelId: SiteContextToolbarPanelId): void => {
    emitSiteContextToolbarAction({ type: 'open-panel', panelId, siteId });
  };

  return (
    <div data-testid="site-context-contextual-toolbar">
      <TldrawUiContextualToolbar getSelectionBounds={getSelectionBounds} label="Site actions">
        <TldrawUiDropdownMenuRoot id="site-context-add-panel">
          <TldrawUiDropdownMenuTrigger>
            <TldrawUiToolbarButton type="menu" title="Add panel">
              <TldrawUiButtonIcon icon="plus" />
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
          title="Publish"
          onClick={() => emitSiteContextToolbarAction({ type: 'publish', siteId })}
        >
          <TldrawUiButtonIcon icon="play" />
        </TldrawUiToolbarButton>

        <TldrawUiButton
          type="normal"
          title="Save canvas snapshot"
          onClick={() => emitSiteContextToolbarAction({ type: 'save', siteId })}
        >
          Save
        </TldrawUiButton>
      </TldrawUiContextualToolbar>
    </div>
  );
});
