import type {
  PanelActionMeta,
  PanelAgentMeta,
  PanelFieldMeta,
  PanelScopeKind,
} from '../registryMetadata';
import type { JsonObject, PanelSpec, SpecSourceBinding } from '../types';

/** JSON-schema-style props description derived from catalog Zod schemas. */
export type PropsSchemaDescription = JsonObject;

export interface CuratedExampleSpec {
  id: string;
  title: string;
  description: string;
  spec: PanelSpec;
}

export interface CuratedExampleValidationHints {
  adapterSources?: readonly string[];
  hostActions?: readonly string[];
  panelRegistry?: readonly string[];
}

export interface CuratedExampleEntry extends CuratedExampleSpec {
  targetKind: 'catalog' | 'panel';
  targetId: string;
  validation: CuratedExampleValidationHints;
}

export interface DescribeCatalogEntryResult {
  kind: 'catalog';
  catalogEntry: string;
  agentHint?: string;
  internal?: boolean;
  propsSchema: PropsSchemaDescription;
  curatedExamples: readonly CuratedExampleSpec[];
}

export interface DescribePanelResult {
  kind: 'panel';
  panelId: string;
  title: string;
  agentDescription?: string;
  scope: PanelScopeKind;
  contextKinds?: readonly string[];
  fields: readonly PanelFieldMeta[];
  actions: readonly PanelActionMeta[];
  sources?: Record<string, SpecSourceBinding>;
  spec?: PanelSpec;
  curatedExamples: readonly CuratedExampleSpec[];
}

export type DescribePanelToolResult = DescribeCatalogEntryResult | DescribePanelResult;

export interface DescribePanelArgs {
  panelId?: string;
  catalogEntry?: string;
}

export type DescribePanelError = { ok: false; error: string };

export type DescribePanelSuccess = { ok: true; result: DescribePanelToolResult };

export type DescribePanelOutcome = DescribePanelSuccess | DescribePanelError;

/** Registry-derived panel metadata without open-instance state. */
export type PanelIntrospectionMeta = PanelAgentMeta;
