/**
 * Shape-id reference normalization shared by the agent drawing and authoring
 * toolkit APIs (P8/P12).
 *
 * An agent draws a shape and assigns it a logical id ("ignition"), then later
 * references that same id from connect_shapes group_shapes frame_shapes.
 * tldraw shape ids are branded `shape:<unique>` strings, and `createShapeId`
 * is a pure prefixer, so `createShapeId('ignition')` always yields
 * `shape:ignition`. Normalizing both the draw-time id and the reference-time
 * id through this one function is what makes the round-trip resolve.
 */
import { createShapeId, type TLShapeId } from 'tldraw';

const SHAPE_ID_PREFIX = 'shape:';

/**
 * Normalize a shape reference to a `TLShapeId`. Accepts both a raw logical id
 * a model assigns ("ignition") and an already-formatted id
 * ("shape:ignition", e.g. `String(createShapeId(...))`), mapping both to the
 * same id without ever double-prefixing (`shape:shape:...`).
 */
export function toShapeId(ref: string): TLShapeId {
  return ref.startsWith(SHAPE_ID_PREFIX) ? (ref as TLShapeId): createShapeId(ref);
}
