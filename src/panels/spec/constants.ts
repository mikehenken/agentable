/** Current spec envelope version (`PanelSpec.v`). */
export const CURRENT_SPEC_VERSION = 1;

/** Maximum node count in a single spec (.5). */
export const SPEC_MAX_NODES = 200;

/** Maximum tree depth from `root` (.5). */
export const SPEC_MAX_DEPTH = 12;

/** Maximum length of any single string prop value (.5). */
export const SPEC_MAX_STRING_PROP = 8192;

/** Maximum serialized spec size in bytes (.5). */
export const SPEC_MAX_TOTAL_BYTES = 262_144;

/** Prop key used to preserve raw JSON for unknown catalog node types. */
export const UNKNOWN_NODE_RAW_KEY = '__raw';

/** Node type rendered for unknown catalog entries. */
export const UNKNOWN_NODE_PLACEHOLDER_TYPE = 'unknown-node';

/**
 * Synthetic node type for spec nodes that have been referenced by an
 * arrived parent but have not streamed in yet (streaming hydration).
 * The renderer paints these as skeletons; they never persist.
 */
export const STREAMING_SKELETON_TYPE = 'streaming-skeleton';
