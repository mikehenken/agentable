/**
 * Pin-to-persist for agent-composed panel specs. Ephemeral
 * composed instances carry `__composedSpec` until the user pins; pinning
 * promotes the validated envelope to `__spec` so tldraw snapshots restore
 * it like any other panel instance.
 */
import type { JsonObject, PanelSpec, SpecOrigin } from '../types';

/** Persisted composed spec envelope on a panel shape. */
export const PANEL_SPEC_DATA_KEY = '__spec';

/** Ephemeral composed spec before the user pins (stripped on export). */
export const PANEL_COMPOSED_EPHEMERAL_KEY = '__composedSpec';

/** Shape data key recording who placed the panel. */
export const PANEL_ORIGIN_DATA_KEY = 'origin';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readSpecEnvelope(value: unknown): PanelSpec | null {
  const record = asRecord(value);
  if (record === undefined) return null;
  if (typeof record.v !== 'number' || typeof record.root !== 'string') return null;
  if (record.origin !== 'host' && record.origin !== 'agent') return null;
  if (typeof record.nodes !== 'object' || record.nodes === null) return null;
  return record as unknown as PanelSpec;
}

export function readPinnedSpec(data: Record<string, unknown> | undefined): PanelSpec | null {
  if (data === undefined) return null;
  return readSpecEnvelope(data[PANEL_SPEC_DATA_KEY]);
}

export function readEphemeralComposedSpec(
  data: Record<string, unknown> | undefined,
): PanelSpec | null {
  if (data === undefined) return null;
  return readSpecEnvelope(data[PANEL_COMPOSED_EPHEMERAL_KEY]);
}

export function readComposedSpec(data: Record<string, unknown> | undefined): PanelSpec | null {
  return readPinnedSpec(data) ?? readEphemeralComposedSpec(data);
}

export function isPanelPinned(data: Record<string, unknown> | undefined): boolean {
  return readPinnedSpec(data) !== null;
}

export function isComposedEphemeral(data: Record<string, unknown> | undefined): boolean {
  return readEphemeralComposedSpec(data) !== null && !isPanelPinned(data);
}

export function readPanelOrigin(data: Record<string, unknown> | undefined): SpecOrigin {
  const spec = readComposedSpec(data);
  if (spec !== null) return spec.origin;
  if (data?.[PANEL_ORIGIN_DATA_KEY] === 'agent') return 'agent';
  return 'host';
}

export function buildPinnedShapePatch(spec: PanelSpec): JsonObject {
  const envelope = { ...(spec as unknown as JsonObject), origin: 'agent' as const };
  return {
    [PANEL_SPEC_DATA_KEY]: envelope,
    [PANEL_ORIGIN_DATA_KEY]: 'agent',
  };
}

export function buildEphemeralShapePatch(spec: PanelSpec): JsonObject {
  const envelope = { ...(spec as unknown as JsonObject), origin: 'agent' as const };
  return {
    [PANEL_COMPOSED_EPHEMERAL_KEY]: envelope,
    [PANEL_ORIGIN_DATA_KEY]: 'agent',
  };
}

export function shouldShowProvenanceBadge(data: Record<string, unknown> | undefined): boolean {
  return readPanelOrigin(data) === 'agent';
}

export function shouldShowPinButton(data: Record<string, unknown> | undefined): boolean {
  return isComposedEphemeral(data);
}
