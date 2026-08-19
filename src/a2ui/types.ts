import type { JsonObject, JsonValue, PanelSpec, SpecAction } from '../panels/types';

/** A2UI v1.0 server-to-client envelope (one message key per object). */
export interface A2UIEnvelope {
  version: string;
  createSurface?: A2UICreateSurface;
  updateComponents?: A2UIUpdateComponents;
  updateDataModel?: A2UIUpdateDataModel;
  deleteSurface?: A2UIDeleteSurface;
}

export interface A2UICreateSurface {
  surfaceId: string;
  catalogId: string;
  surfaceProperties?: JsonObject;
  sendDataModel?: boolean;
  components?: readonly A2UIComponent[];
  dataModel?: JsonObject;
}

export interface A2UIUpdateComponents {
  surfaceId: string;
  components: readonly A2UIComponent[];
}

export interface A2UIUpdateDataModel {
  surfaceId: string;
  path?: string;
  value?: JsonValue;
}

export interface A2UIDeleteSurface {
  surfaceId: string;
}

/** Flat adjacency-list component from an A2UI surface update. */
export interface A2UIComponent {
  id: string;
  component: string;
  children?: readonly string[];
  child?: string;
  [key: string]: JsonValue | readonly string[] | undefined;
}

export interface A2UISurfaceState {
  surfaceId: string;
  catalogId: string | null;
  deleted: boolean;
  components: Map<string, A2UIComponent>;
  dataModel: JsonObject;
}

export type A2UIIngestErrorCode =
  | 'A2UI_ENVELOPE_INVALID'
  | 'A2UI_VERSION_UNSUPPORTED'
  | 'A2UI_SURFACE_MISSING'
  | 'A2UI_SURFACE_DELETED'
  | 'A2UI_ROOT_MISSING'
  | 'A2UI_COMPONENT_INVALID'
  | 'A2UI_DYNAMIC_UNRESOLVED';

export interface A2UIIngestIssue {
  code: A2UIIngestErrorCode;
  message: string;
  componentId?: string;
  path?: string;
}

export interface A2UIIngestSuccess {
  ok: true;
  spec: PanelSpec;
  surfaceId: string;
  actions: Record<string, SpecAction>;
  warnings: A2UIIngestIssue[];
}

export interface A2UIIngestFailure {
  ok: false;
  errors: A2UIIngestIssue[];
  warnings: A2UIIngestIssue[];
}

export type A2UIIngestResult = A2UIIngestSuccess | A2UIIngestFailure;

export interface A2UIIngestOptions {
  /** Defaults to agent — A2UI payloads are agent-authored UI. */
  origin?: PanelSpec['origin'];
  /** When set, only this surface id is accepted. */
  surfaceId?: string;
}

/** One A2UI conformance fixture: wire payload(s) plus expected native IR. */
export interface A2UIConformanceFixture {
  id: string;
  description: string;
  messages: readonly A2UIEnvelope[];
  expectedIr: PanelSpec;
  validation?: {
    adapterSources?: readonly string[];
    hostActions?: readonly string[];
    panelRegistry?: readonly string[];
  };
}
