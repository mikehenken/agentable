/**
 * Public contract types for the panel system. Hosts register panels as
 * `PanelDefinition`s; panel components receive `PanelProps`; imperative
 * control flows through `PanelHandle`. Spec-tier panels carry a `PanelSpec`
 * envelope validated and rendered by the framework.
 */
import type { ComponentType } from 'react';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type SpecOrigin = 'host' | 'agent';

/** Named data binding resolved through the host's data adapter. */
export interface SpecSourceBinding {
  source: string;
  params?: JsonObject;
}

/**
 * Equality over two bound or literal values. Deliberately the only
 * conditional the spec language supports; anything needing more logic
 * belongs in a vetted catalog component.
 */
export interface SpecCondition {
  $eq: [JsonValue, JsonValue];
}

/**
 * One node in the spec tree. `children` reference sibling node ids; the
 * graph must stay a tree reachable from the envelope's `root`.
 */
export interface SpecNode {
  type: string;
  props?: JsonObject;
  children?: string[];
  showIf?: SpecCondition;
}

export type SpecAction =
  | {
      kind: 'mutate';
      source: string;
      op: string;
      mutates?: boolean;
      destructive?: boolean;
      confirm?: string;
      variant?: 'ai';
      targetFields?: string[];
      /** Set false to declare the mutation not undoable. */
      reversible?: boolean;
      /** Declared compensating action id for reversal. */
      inverse?: string;
    }
  | { kind: 'host'; action: string }
  | { kind: 'panel'; panelId: string; scopeFrom?: string }
  | { kind: 'prompt'; prompt: string };

/** The persisted spec envelope. JSON throughout so it round-trips verbatim. */
export interface PanelSpec {
  v: number;
  origin: SpecOrigin;
  root: string;
  sources?: Record<string, SpecSourceBinding>;
  state?: JsonObject;
  nodes: Record<string, SpecNode>;
  actions?: Record<string, SpecAction>;
}

export interface SpecMigration {
  from: number;
  to: number;
  up: (spec: PanelSpec) => PanelSpec;
}

export interface PanelMeta {
  /** Static in v1; dynamic titles arrive later via chrome data bindings. */
  title: string;
  /** Lucide icon name; hosts may register custom glyph components. */
  icon?: string;
  /** Stamped on every persisted instance so migrations know where to start. */
  schemaVersion: number;
  /** Ordered oldest to newest; applied when a persisted spec predates `schemaVersion`. */
  migrations?: SpecMigration[];
  defaultSize?: { w: number; h: number };
  /** Span on the 12-column workspace grid. */
  gridSpan?: number;
  /** Layout hint consumed when a workspace opens for a context. */
  workspaceRole?: 'primary' | 'secondary';
  /** Context-frame kinds this panel belongs to. */
  contextKinds?: string[];
  /** Passed verbatim into panel enumeration and agent tool grounding. */
  agentDescription?: string;
  /** Panel body overflow behavior: 'auto' scrolls, 'hidden' clips. */
  bodyScroll?: 'auto' | 'hidden';
}

/**
 * Deliberately closed: hosts assign meaning to the two keys for their
 * domain rather than extending the shape with their own fields.
 */
export interface PanelScope {
  contextId?: string;
  entityId?: string;
  /** Page-session slot the panel is scoped to (embed panel-only engine). */
  slot?: string;
}

export interface PanelChromeOptions {
  title?: string;
  hideChrome?: boolean;
  fullBleed?: boolean;
  noBorder?: boolean;
  /** Collapse the instance to its title bar. Chrome state, not a style. */
  minimized?: boolean;
}

export interface PanelFillResult {
  /** Fields left untouched because the user had already dirtied them. */
  skipped: string[];
}

export interface SpecNodeContextValue {
  scope: PanelScope;
  data: Record<string, unknown>;
  dispatch: (actionRef: string, payload?: Record<string, unknown>) => void;
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  state: 'loading' | 'empty' | 'populated' | 'error' | 'dirty' | 'saving' | 'stale';
}

export interface CatalogEntry<TProps = any> {
  name: string;
  props: import('zod').ZodType<TProps>;
  component: ComponentType<TProps & { context: SpecNodeContextValue }>;
  agentHint?: string;
  internal?: boolean;
  /**
   * When true, the component renders its own binding-error UI and the spec
   * renderer suppresses its default error card for this entry.
   */
  selfManagedBindingErrors?: boolean;
}

/** Typed facade over a mounted panel instance. */
export interface PanelHandle {
  /** The panel definition id; `shapeId` identifies this mounted instance. */
  id: string;
  shapeId: string;
  scope: PanelScope;
  focus(): void;
  close(): void;
  setChrome(options: PanelChromeOptions): void;
  fill(patch: Record<string, unknown>): Promise<PanelFillResult>;
  runAction(actionId: string, payload?: Record<string, unknown>): Promise<unknown>;
  /** Settles once, when the instance leaves the workspace. */
  onClosed: Promise<void>;
}

export interface PanelProps {
  scope: PanelScope;
  /** JSON-serializable values only; this blob persists with the panel instance. */
  data?: Record<string, unknown>;
  /** Set when rendered inside a canvas panel container rather than a plain React tree. */
  hostedInWhiteboard?: boolean;
  handle: PanelHandle;
}

export type PanelDefinition =
  | { kind: 'spec'; id: string; meta: PanelMeta; spec: PanelSpec }
  | {
      kind: 'react';
      id: string;
      meta: PanelMeta;
      loader: () => Promise<{ default: ComponentType<PanelProps> }>;
    };
