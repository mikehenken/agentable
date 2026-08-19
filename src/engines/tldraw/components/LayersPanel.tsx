import { type ReactElement } from 'react';
import {
  track,
  useEditor,
  useValue,
  type TLShapeId,
} from 'tldraw';
import { LAYERS_TOOL_ID } from '../tools/layersEvents';
import {
  focusShapeInCanvas,
  getShapeLabel,
  isPanelShape,
} from '../utils/shapeTextUtils';

const PANEL_STROKE = 'rgba(255, 140, 122, 0.55)';
const SELECTED_BG = 'rgb(255 140 122 / 0.14)';
const HOVER_BG = 'var(--landi-color-hover, rgb(0 0 0 / 0.04))';

interface ShapeListProps {
  shapeIds: TLShapeId[];
  depth: number;
}

function ShapeList({ shapeIds, depth }: ShapeListProps): ReactElement | null {
  if (shapeIds.length === 0) return null;

  return (
    <ul
      data-testid="layers-panel-tree"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {shapeIds.map((shapeId) => (
        <ShapeListItem key={shapeId} shapeId={shapeId} depth={depth} />
      ))}
    </ul>
  );
}

interface ShapeListItemProps {
  shapeId: TLShapeId;
  depth: number;
}

function ShapeListItem({ shapeId, depth }: ShapeListItemProps): ReactElement | null {
  const editor = useEditor();
  const shape = useValue('shape', () => editor.getShape(shapeId), [editor, shapeId]);
  const childIds = useValue(
    'childIds',
    () => editor.getSortedChildIdsForParent(shapeId),
    [editor, shapeId],
  );
  const isSelected = useValue(
    'isSelected',
    () => editor.getSelectedShapeIds().includes(shapeId),
    [editor, shapeId],
  );

  if (!shape) return null;

  const label = getShapeLabel(editor, shape);

  const handleSelect = (): void => {
    focusShapeInCanvas(editor, shape.id);
  };

  return (
    <li data-testid={`layers-panel-item-${shapeId}`}>
      <button
        type="button"
        data-testid={`layers-panel-select-${shapeId}`}
        onPointerDown={(event) => {
          event.preventDefault();
          handleSelect();
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          paddingLeft: 10 + depth * 14,
          border: 'none',
          borderRadius: 6,
          background: isSelected ? SELECTED_BG : 'transparent',
          color: 'var(--landi-color-text, #1A1A1A)',
          fontSize: 12,
          lineHeight: 1.35,
          textAlign: 'left',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
        onMouseEnter={(event) => {
          if (!isSelected) {
            event.currentTarget.style.background = HOVER_BG;
          }
        }}
        onMouseLeave={(event) => {
          if (!isSelected) {
            event.currentTarget.style.background = 'transparent';
          }
        }}
      >
        {isPanelShape(shape) ? (
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 2,
              background: PANEL_STROKE,
              flexShrink: 0,
            }}
          />
        ) : null}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {label}
        </span>
      </button>
      {childIds.length > 0 ? <ShapeList shapeIds={childIds} depth={depth + 1} /> : null}
    </li>
  );
}

/** Fixed right-side shape tree — visible while the layers toolbar tool is active. */
export const LayersPanel = track(function LayersPanel(): ReactElement | null {
  const editor = useEditor();
  const isOpen = useValue(
    'layersPanelOpen',
    () => editor.getCurrentToolId() === LAYERS_TOOL_ID,
    [editor],
  );
  const rootShapeIds = useValue(
    'rootShapeIds',
    () => editor.getSortedChildIdsForParent(editor.getCurrentPageId()),
    [editor],
  );

  if (!isOpen) return null;

  return (
    <aside
      data-testid="layers-panel"
      style={{
        position: 'fixed',
        top: 56,
        right: 12,
        width: 240,
        maxHeight: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        zIndex: 400,
        borderRadius: 10,
        border: '1px solid var(--landi-color-border, #E5E5E5)',
        background: 'var(--landi-color-surface, #FFFFFF)',
        boxShadow: 'var(--landi-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.06))',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '10px 12px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--landi-color-text-muted, #a1a1aa)',
          borderBottom: '1px solid var(--landi-color-border, #3a3a3a)',
        }}
      >
        Layers
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '6px 4px 8px',
        }}
      >
        {rootShapeIds.length === 0 ? (
          <p
            data-testid="layers-panel-empty"
            style={{
              margin: 0,
              padding: '12px 10px',
              fontSize: 12,
              color: 'var(--landi-color-text-muted, #a1a1aa)',
            }}
          >
            No shapes on this page yet.
          </p>
        ) : (
          <ShapeList shapeIds={rootShapeIds} depth={0} />
        )}
      </div>
    </aside>
  );
});
