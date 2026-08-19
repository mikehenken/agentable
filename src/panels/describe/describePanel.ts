/**
 * Read-only panel and catalog introspection for describe_panel.
 */
import type { PanelRegistry } from '../registry';
import { derivePanelAgentMeta } from '../registryMetadata';
import type { CatalogEntry, PanelDefinition, PanelSpec } from '../types';
import { curatedExampleSummariesForTarget } from './curatedExamples';
import type {
  DescribeCatalogEntryResult,
  DescribePanelArgs,
  DescribePanelOutcome,
  DescribePanelResult,
} from './types';
import { describeCatalogPropsSchema } from './zodPropsSchema';

export interface DescribePanelDependencies {
  registry: PanelRegistry;
  catalog: ReadonlyMap<string, CatalogEntry>;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function describeCatalogEntry(
  catalogEntry: string,
  catalog: ReadonlyMap<string, CatalogEntry>): DescribeCatalogEntryResult | { error: string } {
  const entry = catalog.get(catalogEntry);
  if (entry === undefined) {
    return { error: `unknown catalog entry "${catalogEntry}"` };
  }

  return {
    kind: 'catalog',
    catalogEntry,
    agentHint: entry.agentHint,
    internal: entry.internal,
    propsSchema: describeCatalogPropsSchema(entry.props),
    curatedExamples: curatedExampleSummariesForTarget('catalog', catalogEntry),
  };
}

function specFromDefinition(definition: PanelDefinition): PanelSpec | undefined {
  return definition.kind === 'spec' ? definition.spec: undefined;
}

function describeRegisteredPanel(
  panelId: string,
  registry: PanelRegistry): DescribePanelResult | { error: string } {
  const definition = registry.get(panelId);
  if (definition === undefined) {
    return { error: `unknown panel id "${panelId}"` };
  }

  const meta = derivePanelAgentMeta(definition);
  const spec = specFromDefinition(definition);

  return {
    kind: 'panel',
    panelId: meta.id,
    title: meta.title,
    agentDescription: meta.agentDescription,
    scope: meta.scope,
    contextKinds: meta.contextKinds,
    fields: meta.fields,
    actions: meta.actions,
    sources: spec?.sources,
    spec,
    curatedExamples: curatedExampleSummariesForTarget('panel', panelId),
  };
}

export function describePanel(
  args: DescribePanelArgs,
  deps: DescribePanelDependencies): DescribePanelOutcome {
  const panelId = readNonEmptyString(args.panelId);
  const catalogEntry = readNonEmptyString(args.catalogEntry);

  if (panelId !== undefined && catalogEntry !== undefined) {
    return { ok: false, error: 'provide panelId or catalogEntry, not both' };
  }
  if (panelId === undefined && catalogEntry === undefined) {
    return { ok: false, error: 'panelId or catalogEntry is required' };
  }

  if (catalogEntry !== undefined) {
    const described = describeCatalogEntry(catalogEntry, deps.catalog);
    if ('error' in described) {
      return { ok: false, error: described.error };
    }
    return { ok: true, result: described };
  }

  const described = describeRegisteredPanel(panelId!, deps.registry);
  if ('error' in described) {
    return { ok: false, error: described.error };
  }
  return { ok: true, result: described };
}
