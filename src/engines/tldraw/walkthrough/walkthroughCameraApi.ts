/**
 * tldraw camera adapter for story-mode walkthrough.
 */
import { createShapeId, type Editor, type TLShapeId } from 'tldraw';
import { bindWalkthroughRuntime } from '../../../agents/walkthroughBridge';
import type { CameraQueue } from '../../../agents/camera';
import type { WalkthroughCameraIntent, WalkthroughTarget } from '../../../agents/walkthroughTypes';
import type { Rect } from '../../../engine/types';

function panelShapeId(panelId: string): TLShapeId {
  return createShapeId(`panel:${panelId}`);
}

function readRect(value: unknown): Rect | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = record.x;
  const y = record.y;
  const w = record.w;
  const h = record.h;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return null;
  }
  return { x, y, w, h };
}

function unionBounds(boundsList: readonly Rect[]): Rect | null {
  if (boundsList.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const bounds of boundsList) {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function shapeBounds(editor: Editor, shapeId: string): Rect | null {
  const bounds = editor.getShapePageBounds(shapeId as TLShapeId);
  if (!bounds) return null;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

export function resolveWalkthroughTargetBounds(
  editor: Editor,
  target: WalkthroughTarget,
): Rect | null {
  if (target.kind === 'panel') {
    return shapeBounds(editor, panelShapeId(target.panelId));
  }
  if (target.kind === 'frame' || target.kind === 'shape') {
    const id = target.kind === 'frame' ? target.frameId : target.shapeId;
    return shapeBounds(editor, id);
  }
  const rects = target.shapeIds
    .map((shapeId) => shapeBounds(editor, shapeId))
    .filter((rect): rect is Rect => rect !== null);
  return unionBounds(rects);
}

export function resolveWalkthroughTargetIntent(
  editor: Editor,
  target: WalkthroughTarget,
): WalkthroughCameraIntent | null {
  const rect = resolveWalkthroughTargetBounds(editor, target);
  if (rect === null) return null;
  return { kind: 'zoomTo', rect, inset: 64 };
}

export function applyWalkthroughCameraIntent(
  editor: Editor,
  intent: WalkthroughCameraIntent,
): void {
  if (intent.kind !== 'zoomTo') return;
  const rect = readRect(intent.rect);
  if (rect === null) return;
  editor.zoomToBounds(
    { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    {
      inset: intent.inset ?? 64,
      animation: { duration: 220 },
    },
  );
}

/** Try panel id, direct shape id, then raw frame id. */
export function resolveWalkthroughSingleTargetIntent(
  editor: Editor,
  id: string,
): WalkthroughCameraIntent | null {
  const panelIntent = resolveWalkthroughTargetIntent(editor, { kind: 'panel', panelId: id });
  if (panelIntent !== null) return panelIntent;

  const shapeIntent = resolveWalkthroughTargetIntent(editor, { kind: 'shape', shapeId: id });
  if (shapeIntent !== null) return shapeIntent;

  return resolveWalkthroughTargetIntent(editor, { kind: 'frame', frameId: id });
}

export function createWalkthroughTargetResolver(
  editor: Editor,
): (target: WalkthroughTarget) => WalkthroughCameraIntent | null {
  return (target: WalkthroughTarget) => {
    if (target.kind === 'panel') {
      const panelIntent = resolveWalkthroughTargetIntent(editor, target);
      if (panelIntent !== null) return panelIntent;
      return resolveWalkthroughTargetIntent(editor, { kind: 'shape', shapeId: target.panelId });
    }
    return resolveWalkthroughTargetIntent(editor, target);
  };
}

export function subscribeWalkthroughUserCameraCancel(
  editor: Editor,
  onUserInput: () => void,
): () => void {
  return editor.store.listen(
    () => {
      onUserInput();
    },
    { source: 'user', scope: 'session' },
  );
}

export function bindWalkthroughForEditor(editor: Editor, camera: CameraQueue): () => void {
  return bindWalkthroughRuntime({
    camera,
    resolveTarget: createWalkthroughTargetResolver(editor),
    applyIntent: (intent: WalkthroughCameraIntent) => applyWalkthroughCameraIntent(editor, intent),
    registerCancelListener: (onCancel) => subscribeWalkthroughUserCameraCancel(editor, onCancel),
  });
}
