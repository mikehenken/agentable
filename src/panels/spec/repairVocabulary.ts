import type { SpecErrorCode } from './types';

/**
 * Canonical spec validation codes emitted by `validateSpec`.
 * Keep in sync with the `SpecErrorCode` union in `types.ts`.
 */
export const SPEC_ERROR_CODES = [
  'SPEC_ENVELOPE_INVALID',
  'SPEC_VERSION_UNKNOWN',
  'SPEC_ROOT_MISSING',
  'SPEC_ROOT_UNKNOWN',
  'SPEC_NODES_INVALID',
  'SPEC_NODE_UNKNOWN',
  'SPEC_NODE_PROPS_INVALID',
  'SPEC_ACTION_REF_MISSING',
  'SPEC_ACTION_REF_SMUGGLED',
  'SPEC_ACTION_URL_FORBIDDEN',
  'SPEC_ACTION_SOURCE_UNKNOWN',
  'SPEC_HOST_ACTION_UNKNOWN',
  'SPEC_PANEL_UNKNOWN',
  'SPEC_BUDGET_NODES',
  'SPEC_BUDGET_DEPTH',
  'SPEC_BUDGET_STRING',
  'SPEC_BUDGET_SIZE',
  'SPEC_CYCLE',
  'SPEC_DUPLICATE_CHILD',
  'SPEC_ORPHAN_NODE',
  'SPEC_SANITIZE_JAVASCRIPT_URL',
  'SPEC_SANITIZE_CONTROL_CHAR',
  'SPEC_SANITIZE_URL_SCHEME',
] as const satisfies readonly SpecErrorCode[];

/** Structured error codes for compose/patch tool-layer rejections. */
export const PANEL_TOOL_REPAIR_ERROR_CODES = [
  'VALIDATION',
  'PATCH_APPLY_FAILED',
  'RUNTIME_DISPOSED',
  /**: undo stack empty (disposed runtime or no frames). */
  'STACK_EMPTY',
  /**: compensating reversal target missing from activity ledger. */
  'ENTRY_NOT_FOUND',
] as const;

export type PanelToolRepairErrorCode = (typeof PANEL_TOOL_REPAIR_ERROR_CODES)[number];

/** Frozen rejection code when compose is gated ( vocabulary). */
export const COMPOSE_GATE_CLOSED_CODE = 'COMPOSE_GATE_CLOSED' as const;

export type ComposeGateErrorCode = typeof COMPOSE_GATE_CLOSED_CODE;

/** All structured error codes agents may see from compose/patch repair paths. */
export type RepairErrorCode = SpecErrorCode | ComposeGateErrorCode | PanelToolRepairErrorCode;

/**
 * Frozen repair vocabulary for agent tool rejections.
 * Snapshot-tested; add new codes here before emitting them from runtime paths.
 */
export const FROZEN_REPAIR_ERROR_CODES = [...SPEC_ERROR_CODES,...PANEL_TOOL_REPAIR_ERROR_CODES,
  COMPOSE_GATE_CLOSED_CODE,
] as const satisfies readonly RepairErrorCode[];

const frozenSet = new Set<string>(FROZEN_REPAIR_ERROR_CODES);

export function isFrozenRepairErrorCode(code: string): code is RepairErrorCode {
  return frozenSet.has(code);
}
