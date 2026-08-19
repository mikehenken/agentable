/**
 * Operator surface placement kinds and typed events ( §13).
 *
 * Four host placements share one page session while each wrapper
 * mounts `<agentable-operator-surface>` and emits consistent lifecycle events.
 *** Where the operator surface is anchored on the host page. */
export type OperatorSurfacePlacementKind = 'dock-inside' | 'dock-outside' | 'slot' | 'floating';

export const OPERATOR_SURFACE_PLACEMENT_KINDS: readonly OperatorSurfacePlacementKind[] = [
  'dock-inside',
  'dock-outside',
  'slot',
  'floating',
] as const;

export function isOperatorSurfacePlacementKind(value: string): value is OperatorSurfacePlacementKind {
  return (OPERATOR_SURFACE_PLACEMENT_KINDS as readonly string[]).includes(value);
}

/** Fired once after the nested operator surface is connected. */
export interface OperatorPlacementMountedDetail {
  placement: OperatorSurfacePlacementKind;
  placementId: string;
  pageSessionId: string;
  slotName?: string;
}

/** Fired when the user focuses or activates the placement chrome. */
export type OperatorPlacementInteractionKind = 'focus' | 'pointerdown';

export interface OperatorPlacementInteractedDetail {
  placement: OperatorSurfacePlacementKind;
  placementId: string;
  pageSessionId: string;
  interactionKind: OperatorPlacementInteractionKind;
  slotName?: string;
}

export interface OperatorPlacementEventMap {
  'landi:operator-placement-mounted': CustomEvent<OperatorPlacementMountedDetail>;
  'landi:operator-placement-interacted': CustomEvent<OperatorPlacementInteractedDetail>;
}

declare global {
   // eslint-disable-next-line / @typescript-eslint/no-empty-object-type -- Lit typed event map augmentation
  interface HTMLElementEventMap extends OperatorPlacementEventMap {}
}
