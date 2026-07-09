/**
 * Context group frames — visual tldraw `frame` shapes that group panels by
 * site or agency workspace. Uses native `fitFrameToContent` for bounds.
 */
import { createShapeId, fitFrameToContent, type Editor, type TLShapeId } from 'tldraw';
import { GRID_SIZE, snapToGrid } from '../../canvas/panelLayoutEngine';

export type ContextGroupKind = 'site' | 'agency';

export interface ContextGroupRef {
  kind: ContextGroupKind;
  id: string;
  label: string;
  /** When set on a site group, nests the site frame under an agency frame. */
  agencyId?: string | null;
}

export interface AssignPanelsOptions {
  siteLabel?: string;
  agencyId?: string | null;
}

const CONTEXT_FRAME_PADDING = 40;
const CONTEXT_META_KEY = 'landiContextGroup';

export function contextGroupFrameId(ref: Pick<ContextGroupRef, 'kind' | 'id'>): TLShapeId {
  return createShapeId(`context:${ref.kind}:${ref.id}`);
}

export function resolveSiteIdFromPanelData(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const siteId = data.__siteId ?? data.siteId;
  return typeof siteId === 'string' && siteId.trim().length > 0 ? siteId.trim() : null;
}

function inferCommonSiteId(editor: Editor, panelIds: string[]): string | null {
  const siteIds = new Set<string>();
  for (const panelId of panelIds) {
    const shape = editor.getShape(createShapeId(`panel:${panelId}`));
    if (!shape) continue;
    const data = (shape.props as { data?: Record<string, unknown> }).data;
    const siteId = resolveSiteIdFromPanelData(data);
    if (siteId) siteIds.add(siteId);
  }
  return siteIds.size === 1 ? [...siteIds][0] ?? null : null;
}

function snapFrameOrigin(editor: Editor, frameId: TLShapeId): void {
  const frame = editor.getShape(frameId);
  if (!frame || frame.type !== 'frame') return;
  editor.updateShape({
    id: frameId,
    type: 'frame',
    x: snapToGrid(frame.x),
    y: snapToGrid(frame.y),
  });
}

/** Create or update a labeled context frame (site or agency). */
export function ensureContextGroupFrame(editor: Editor, ref: ContextGroupRef): TLShapeId {
  const frameId = contextGroupFrameId(ref);
  const existing = editor.getShape(frameId);

  if (!existing) {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: snapToGrid(0),
      y: snapToGrid(0),
      props: {
        w: GRID_SIZE * 40,
        h: GRID_SIZE * 30,
        name: ref.label,
        color: ref.kind === 'agency' ? 'violet' : 'blue',
      },
      meta: {
        [CONTEXT_META_KEY]: { kind: ref.kind, id: ref.id },
        ...(ref.agencyId ? { agencyId: ref.agencyId } : {}),
      },
    });
  } else if (existing.type === 'frame') {
    editor.updateShape({
      id: frameId,
      type: 'frame',
      props: { name: ref.label },
    });
  }

  if (ref.kind === 'site' && ref.agencyId) {
    const agencyRef: ContextGroupRef = {
      kind: 'agency',
      id: ref.agencyId,
      label: `Agency ${ref.agencyId.slice(0, 8)}`,
    };
    const agencyFrameId = ensureContextGroupFrame(editor, agencyRef);
    const siteFrame = editor.getShape(frameId);
    if (siteFrame && siteFrame.parentId !== agencyFrameId) {
      editor.reparentShapes([frameId], agencyFrameId);
    }
  }

  return frameId;
}

/** Reparent panel shapes into a context frame and fit the frame to content. */
export function assignPanelsToContextGroup(
  editor: Editor,
  panelIds: string[],
  ref: ContextGroupRef,
): boolean {
  if (panelIds.length === 0) return false;

  const panelShapeIds = panelIds
    .map((panelId) => createShapeId(`panel:${panelId}`))
    .filter((id) => Boolean(editor.getShape(id)));

  if (panelShapeIds.length === 0) return false;

  const frameId = ensureContextGroupFrame(editor, ref);
  editor.reparentShapes(panelShapeIds, frameId);
  fitFrameToContent(editor, frameId, { padding: CONTEXT_FRAME_PADDING });
  snapFrameOrigin(editor, frameId);
  return true;
}

/** Site-scoped helper — groups chat, brief, preview, file manager under one frame. */
export function assignPanelsToSiteGroup(
  editor: Editor,
  panelIds: string[],
  siteId: string,
  options: AssignPanelsOptions = {},
): boolean {
  return assignPanelsToContextGroup(editor, panelIds, {
    kind: 'site',
    id: siteId,
    label: options.siteLabel ?? `Site ${siteId.slice(0, 8)}`,
    agencyId: options.agencyId,
  });
}

export function panelsAlreadyInContextFrame(
  editor: Editor,
  panelShapeIds: TLShapeId[],
): boolean {
  if (panelShapeIds.length < 2) return false;
  const parentIds = panelShapeIds.map((id) => editor.getShape(id)?.parentId);
  const firstParent = parentIds[0];
  if (!firstParent) return false;
  const parentShape = editor.getShape(firstParent);
  if (!parentShape || parentShape.type !== 'frame') return false;
  const siblings = editor.getSortedChildIdsForParent(firstParent);
  return panelShapeIds.every((id) => siblings.includes(id));
}

export function groupPanelsWithContext(
  editor: Editor,
  panelIds: string[],
  options: AssignPanelsOptions & { siteId?: string } = {},
): boolean {
  if (panelIds.length < 2) return false;

  const shapeIds = panelIds.map((panelId) => createShapeId(`panel:${panelId}`));
  const existing = shapeIds.filter((id) => Boolean(editor.getShape(id)));
  if (existing.length < 2) return false;

  if (panelsAlreadyInContextFrame(editor, existing)) {
    return true;
  }

  const siteId = options.siteId ?? inferCommonSiteId(editor, panelIds);
  if (siteId) {
    return assignPanelsToSiteGroup(editor, panelIds, siteId, options);
  }

  for (const shapeId of existing) {
    const parentId = editor.getShape(shapeId)?.parentId;
    if (!parentId) continue;
    const parentType = editor.getShape(parentId)?.type;
    if (parentType === 'group' || parentType === 'frame') {
      const siblings = editor.getSortedChildIdsForParent(parentId);
      if (existing.every((id) => siblings.includes(id))) {
        return true;
      }
    }
  }

  editor.setCurrentTool('select');
  editor.groupShapes(existing);
  return true;
}
