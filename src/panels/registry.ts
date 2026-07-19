/**
 * Unified panel registry. Hosts hand `createCanvasHost` a list of
 * `PanelDefinition`s; the registry indexes them by id for open calls and
 * for shells rendering panel bodies. `reactPanelDefinitions` wraps the
 * loader-map shape the canvas shells register panels with today into
 * `kind: 'react'` definitions, so the legacy loader-map wiring and the
 * definition wiring resolve through one registry code path.
 */
import type { ComponentType } from 'react';
import type { PanelDefinition, PanelMeta } from './types';

/** The react-tier member of the `PanelDefinition` union. */
export type ReactPanelDefinition = Extract<PanelDefinition, { kind: 'react' }>;

/** Lazy component loader carried by a react-tier definition. */
export type ReactPanelLoader = ReactPanelDefinition['loader'];

/**
 * The `PanelProps` subset that components registered through a loader map
 * receive today: instance data plus the canvas-hosting flag, no scope or
 * handle yet.
 */
export interface ReactPanelLoaderProps {
  data?: Record<string, unknown>;
  hostedInWhiteboard?: boolean;
}

/** Panel id to loader map, the registration shape shells accept today. */
export type ReactPanelLoaderMap = Record<
  string,
  () => Promise<{ default: ComponentType<ReactPanelLoaderProps> }>
>;

/** Read surface over registered panel definitions. */
export interface PanelRegistry {
  has(id: string): boolean;
  get(id: string): PanelDefinition | undefined;
  /** Ids in registration order, deduplicated. Stable array instance. */
  ids(): readonly string[];
  /** Stable array instance, so consumers can cache derivations by identity. */
  definitions(): readonly PanelDefinition[];
}

export function createPanelRegistry(
  definitions: Iterable<PanelDefinition>,
): PanelRegistry {
  // On id collision the later definition wins, matching how hosts
  // override entries today by spreading one loader map over another.
  const byId = new Map<string, PanelDefinition>();
  for (const definition of definitions) {
    byId.set(definition.id, definition);
  }
  const all = Object.freeze([...byId.values()]);
  const idList = Object.freeze(all.map((definition) => definition.id));
  return {
    has: (id) => byId.has(id),
    get: (id) => byId.get(id),
    ids: () => idList,
    definitions: () => all,
  };
}

const wrappedByLoaderMap = new WeakMap<
  ReactPanelLoaderMap,
  readonly PanelDefinition[]
>();

/**
 * Wrap a loader map into `kind: 'react'` definitions. Meta is derived
 * from the id (title-cased, schema version 1); hosts wanting real titles,
 * icons, or layout hints register full definitions instead. Results are
 * cached by loader-map identity: shells memoise lazy panel components by
 * registry identity, so re-wrapping the same map must not mint new
 * definition objects.
 */
export function reactPanelDefinitions(
  loaders: ReactPanelLoaderMap,
): readonly PanelDefinition[] {
  const cached = wrappedByLoaderMap.get(loaders);
  if (cached) return cached;
  const definitions = Object.freeze(
    Object.entries(loaders).map(
      ([id, loader]): PanelDefinition => ({
        kind: 'react',
        id,
        meta: derivedMeta(id),
        loader: loader as ReactPanelLoader,
      }),
    ),
  );
  wrappedByLoaderMap.set(loaders, definitions);
  return definitions;
}

function derivedMeta(id: string): PanelMeta {
  const title = id
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { title: title || 'Panel', schemaVersion: 1 };
}
