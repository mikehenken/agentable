/** Current spec envelope version (`PanelSpec.v`). */
export const CURRENT_SPEC_VERSION = 1;

/** Maximum node count in a single spec (D9.5). */
export const SPEC_MAX_NODES = 200;

/** Maximum tree depth from `root` (D9.5). */
export const SPEC_MAX_DEPTH = 12;

/** Maximum length of any single string prop value (D9.5). */
export const SPEC_MAX_STRING_PROP = 8192;

/** Maximum serialized spec size in bytes (D9.5). */
export const SPEC_MAX_TOTAL_BYTES = 262_144;

/** Prop key used to preserve raw JSON for unknown catalog node types (D11). */
export const UNKNOWN_NODE_RAW_KEY = '__raw';

/** Node type rendered for unknown catalog entries (D11). */
export const UNKNOWN_NODE_PLACEHOLDER_TYPE = 'unknown-node';
