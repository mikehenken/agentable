/**
 * Derives agent-facing panel metadata from registered definitions so the
 * six generic panel tools stay aligned with the live registry.
 */
import type { PanelRegistry } from './registry';
import { resolveCatalogString } from '../i18n/resolveCatalogString';
import type { PanelDefinition, PanelMeta, PanelSpec, SpecAction, SpecNode } from './types';

export interface PanelFieldMeta {
  path: string;
  kind?: string;
  label?: string;
}

export interface PanelActionMeta {
  id: string;
  kind: SpecAction['kind'];
  destructive?: boolean;
  label?: string;
  source?: string;
  confirmMessage?: string;
  reversible?: boolean;
 /** Declared compensating action for reversal. */
  inverseActionId?: string;
}

export type PanelScopeKind = 'global' | 'context';

export interface PanelAgentMeta {
  id: string;
  title: string;
  agentDescription?: string;
  scope: PanelScopeKind;
  contextKinds?: readonly string[];
  fields: readonly PanelFieldMeta[];
  actions: readonly PanelActionMeta[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function scopeKindFromMeta(meta: PanelMeta): PanelScopeKind {
  const kinds = meta.contextKinds;
  return kinds !== undefined && kinds.length > 0 ? 'context' : 'global';
}

function extractFieldsFromSpec(spec: PanelSpec): PanelFieldMeta[] {
  const seen = new Set<string>();
  const fields: PanelFieldMeta[] = [];

  for (const node of Object.values(spec.nodes) as SpecNode[]) {
    if (node.type !== 'field-form' || node.props === undefined) continue;
    const rawFields = node.props.fields;
    if (!Array.isArray(rawFields)) continue;

    for (const raw of rawFields) {
      if (!isRecord(raw)) continue;
      const path = readString(raw.bind);
      if (path === undefined || seen.has(path)) continue;
      seen.add(path);
      fields.push({
        path,
        kind: readString(raw.type),
        label: readString(raw.label),
      });
    }
  }

  return fields;
}

function extractActionsFromSpec(spec: PanelSpec): PanelActionMeta[] {
  const actions = spec.actions;
  if (actions === undefined) return [];

  return Object.entries(actions).map(([id, action]) => {
    if (action.kind === 'mutate') {
      const reversible =
        action.reversible === false || action.destructive === true ? false : true;
      return {
        id,
        kind: action.kind,
        destructive: action.destructive,
        label: id,
        source: action.source,
        confirmMessage: action.confirm,
        reversible,
        inverseActionId: action.inverse,
      };
    }
    return {
      id,
      kind: action.kind,
      label: id,
    };
  });
}

export function derivePanelAgentMeta(definition: PanelDefinition): PanelAgentMeta {
  const { id, meta } = definition;
  const base: PanelAgentMeta = {
    id,
    title: resolveCatalogString(meta.title),
    agentDescription: meta.agentDescription,
    scope: scopeKindFromMeta(meta),
    contextKinds: meta.contextKinds,
    fields: [],
    actions: [],
  };

  if (definition.kind === 'spec') {
    return {
      ...base,
      fields: extractFieldsFromSpec(definition.spec),
      actions: extractActionsFromSpec(definition.spec),
    };
  }

  return base;
}

export function deriveRegistryAgentMetas(registry: PanelRegistry): readonly PanelAgentMeta[] {
  return registry.definitions().map(derivePanelAgentMeta);
}

export function findPanelAgentMeta(
  registry: PanelRegistry,
  panelId: string,
): PanelAgentMeta | undefined {
  const definition = registry.get(panelId);
  return definition === undefined ? undefined : derivePanelAgentMeta(definition);
}

export function declaredFieldPaths(meta: PanelAgentMeta): ReadonlySet<string> {
  return new Set(meta.fields.map((field) => field.path));
}

export function declaredActionIds(meta: PanelAgentMeta): ReadonlySet<string> {
  return new Set(meta.actions.map((action) => action.id));
}
