/** Supported A2UI protocol version for ingestion. */
export const A2UI_PROTOCOL_VERSION = 'v1.0';

/** Well-known basic catalog id from the A2UI v1.0 specification. */
export const A2UI_BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/** Synthetic source key used when A2UI data-model fields map to field-form binds. */
export const A2UI_DATA_SOURCE_KEY = 'a2ui';

/** Backend source name registered on adapters for ingested field-form panels. */
export const A2UI_DATA_ADAPTER_SOURCE = 'a2ui.data';

/** Layout-oriented A2UI basic-catalog components mapped to panel-body. */
export const A2UI_LAYOUT_COMPONENTS = new Set([
  'Column',
  'Row',
  'Card',
  'List',
]);

/** A2UI components omitted from IR (no catalog equivalent in v1). */
export const A2UI_SKIPPED_COMPONENTS = new Set(['Divider']);
