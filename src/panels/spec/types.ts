import type { z } from 'zod';
import type {
  JsonObject,
  JsonValue,
  PanelSpec,
  SpecMigration,
  SpecNode,
  SpecOrigin,
} from '../types';
import { UNKNOWN_NODE_RAW_KEY } from './constants';

/** Frozen validation error codes (repair vocabulary foundation). */
export type SpecErrorCode =
  | 'SPEC_ENVELOPE_INVALID'
  | 'SPEC_VERSION_UNKNOWN'
  | 'SPEC_ROOT_MISSING'
  | 'SPEC_ROOT_UNKNOWN'
  | 'SPEC_NODES_INVALID'
  | 'SPEC_NODE_UNKNOWN'
  | 'SPEC_NODE_PROPS_INVALID'
  | 'SPEC_ACTION_REF_MISSING'
  | 'SPEC_ACTION_REF_SMUGGLED'
  | 'SPEC_ACTION_URL_FORBIDDEN'
  | 'SPEC_ACTION_SOURCE_UNKNOWN'
  | 'SPEC_HOST_ACTION_UNKNOWN'
  | 'SPEC_PANEL_UNKNOWN'
  | 'SPEC_BUDGET_NODES'
  | 'SPEC_BUDGET_DEPTH'
  | 'SPEC_BUDGET_STRING'
  | 'SPEC_BUDGET_SIZE'
  | 'SPEC_CYCLE'
  | 'SPEC_DUPLICATE_CHILD'
  | 'SPEC_ORPHAN_NODE'
  | 'SPEC_SANITIZE_JAVASCRIPT_URL'
  | 'SPEC_SANITIZE_CONTROL_CHAR'
  | 'SPEC_SANITIZE_URL_SCHEME';

export interface SpecIssue {
  code: SpecErrorCode;
  message: string;
  severity: 'error' | 'warning';
  nodeId?: string;
  path?: string;
 /** Nearest valid alternative for agent repair rounds. */
  hint?: string;
}

/** Catalog entry shape consumed by the validator (no React dependency). */
export interface SpecCatalogEntry {
  name: string;
  props: z.ZodType;
  internal?: boolean;
}

export interface SpecValidationContext {
  catalog: ReadonlyMap<string, SpecCatalogEntry>;
  adapterSources: ReadonlySet<string>;
  hostActions: ReadonlySet<string>;
  panelRegistry: ReadonlySet<string>;
  migrations?: readonly SpecMigration[];
}

export interface ValidateSpecOptions {
 /** When true, step 7 formats errors for a single agent repair round (.7). */
  agentRepairRound?: boolean;
}

/** Node after validation; unknown types retain preserved raw JSON. */
export interface NormalizedSpecNode extends SpecNode {
  [UNKNOWN_NODE_RAW_KEY]?: JsonObject;
}

export interface NormalizedPanelSpec extends PanelSpec {
  nodes: Record<string, NormalizedSpecNode>;
}

export interface ValidateSpecSuccess {
  ok: true;
  spec: NormalizedPanelSpec;
  warnings: SpecIssue[];
  /** True when step 7 agent repair formatting was applied. */
  agentRepairEligible?: boolean;
}

export interface ValidateSpecFailure {
  ok: false;
  errors: SpecIssue[];
  warnings: SpecIssue[];
 /** True when the caller may attempt one structured repair round (.7). */
  agentRepairEligible?: boolean;
}

export type ValidateSpecResult = ValidateSpecSuccess | ValidateSpecFailure;

export type { PanelSpec, SpecMigration, SpecNode, SpecOrigin, JsonObject, JsonValue };
export { UNKNOWN_NODE_RAW_KEY };
