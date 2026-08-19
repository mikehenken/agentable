export {
  CURRENT_SPEC_VERSION,
  SPEC_MAX_DEPTH,
  SPEC_MAX_NODES,
  SPEC_MAX_STRING_PROP,
  SPEC_MAX_TOTAL_BYTES,
  STREAMING_SKELETON_TYPE,
  UNKNOWN_NODE_PLACEHOLDER_TYPE,
  UNKNOWN_NODE_RAW_KEY,
} from './constants';
export { canMigrateSpec, migrateSpec, SpecMigrationError, type MigrateSpecResult } from './migrate';
export type {
  NormalizedPanelSpec,
  NormalizedSpecNode,
  SpecCatalogEntry,
  SpecErrorCode,
  SpecIssue,
  SpecValidationContext,
  ValidateSpecFailure,
  ValidateSpecOptions,
  ValidateSpecResult,
  ValidateSpecSuccess,
} from './types';
export { validateSpec } from './validate';
export {
  COMPOSE_GATE_CLOSED_CODE,
  FROZEN_REPAIR_ERROR_CODES,
  PANEL_TOOL_REPAIR_ERROR_CODES,
  SPEC_ERROR_CODES,
  isFrozenRepairErrorCode,
  type ComposeGateErrorCode,
  type PanelToolRepairErrorCode,
  type RepairErrorCode,
} from './repairVocabulary';
export { catalog as defaultCatalog } from '../catalog';
