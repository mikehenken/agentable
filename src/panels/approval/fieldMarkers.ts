/**
 * CSS class helpers for agent fill and user dirty field markers.
 * Spec field components apply these classes so users can see what an agent
 * touched versus what they edited themselves.
 */
export const AGENT_FILLED_FIELD_CLASS = 'panel-field--agent-filled';
export const USER_DIRTY_FIELD_CLASS = 'panel-field--user-dirty';

export interface FieldMarkerState {
  agentFilled: ReadonlySet<string>;
  userDirty: ReadonlySet<string>;
  /** Optional per-field agent attribution for chrome badges. */
  fieldAttribution?: ReadonlyMap<string, { agentId: string; agentLabel: string }>;
}

export function fieldAttributionAttributes(
  fieldPath: string,
  markers: FieldMarkerState): Record<string, string> | undefined {
  const entry = markers.fieldAttribution?.get(fieldPath);
  if (entry === undefined) return undefined;
  return {
    'data-agent-id': entry.agentId,
    'data-agent-label': entry.agentLabel,
    'data-testid': `field-attribution-${fieldPath}`,
  };
}

export function fieldMarkerClassName(
  fieldPath: string,
  markers: FieldMarkerState): string | undefined {
  if (markers.userDirty.has(fieldPath)) {
    return USER_DIRTY_FIELD_CLASS;
  }
  if (markers.agentFilled.has(fieldPath)) {
    return AGENT_FILLED_FIELD_CLASS;
  }
  return undefined;
}

export function mergeFieldMarkerClass(
  fieldPath: string,
  markers: FieldMarkerState,
  existingClassName?: string): string {
  const markerClass = fieldMarkerClassName(fieldPath, markers);
  if (markerClass === undefined) {
    return existingClassName ?? '';
  }
  if (existingClassName === undefined || existingClassName.length === 0) {
    return markerClass;
  }
  return `${existingClassName} ${markerClass}`;
}
