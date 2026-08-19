---
"agentable-canvas": minor
---

P1 schema renderer wave: spec IR and validator, v1 catalog, block renderer with data lifecycle, panel builder, AG-UI invalidation, streaming resume, i18n, and list virtualization.

### Added

- Spec IR under `src/panels/spec`: `validateSpec` with sanitization and budget enforcement (`SPEC_MAX_DEPTH`, `SPEC_MAX_NODES`, `SPEC_MAX_STRING_PROP`, `SPEC_MAX_TOTAL_BYTES`), plus `migrateSpec`/`canMigrateSpec` version migrations and `CURRENT_SPEC_VERSION`.
- v1 component catalog under `src/panels/catalog`: `v1CatalogEntries`, catalog components, and the component/state matrix, exported as the default spec catalog.
- Block renderer and data lifecycle under `src/panels/renderer`: `SpecRenderer`/`SpecNodeView`, `createDataLifecycle` with `DataAdapter` SPI, source bindings (`resolveSourceParams`, `evaluateShowIf`), and stable source cache keys.
- Panel builder in `src/panels/builder.ts`: `defineSchemaPanel` and `defineStaticPanel` typed builders (blocks, sources, actions, tabs) with `PanelBuilderError` diagnostics.
- Streaming spec hydration: `StreamingSpecRenderer`, `createStreamingSpecSession`, `specToStreamChunks`, and `useStreamingSpec` with interrupted-stream resume tokens per/.
- Framework locale layer under `src/i18n`: `createI18n`/`configureI18n`/`getI18n`/`t()`, ICU MessageFormat catalogs (English built in), locale resolution with fallback chains, text direction, and locale-bound `Intl` formatters per.
- List virtualization for large fixtures: `AgentableVirtualListElement` custom element (`VIRTUAL_LIST_TAG`) and virtualization helpers wired into catalog list rendering.

### Changed

- `host.data.invalidate` now emits AG-UI patch events for spec-bound sources so agent surfaces observe data invalidation.
- Catalog components, renderer chrome, and validator messages resolve all user-facing strings through the i18n `t()` gate (string gate).

### Fixed

- Hardened spec validator sanitization coverage (URL schemes, event-handler props, and unknown-node handling).
