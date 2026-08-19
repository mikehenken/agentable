import { MessageSquare } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CanvasHost } from '../../../panels/host';
import { reactPanelDefinitions } from '../../../panels/registry';
import type { PanelDefinition } from '../../../panels/types';

export type WhiteboardPanelLoader = () => Promise<{
  default: ComponentType<WhiteboardPanelProps>;
}>;

export interface WhiteboardPanelProps {
  data?: Record<string, unknown>;
  hostedInWhiteboard?: boolean;
}

export type WhiteboardPanelRegistry = Record<string, WhiteboardPanelLoader>;

/**
 * Default registry (B2): chat-only example. Domain packs register additional
 * panels via createCanvasHost / whiteboard wiring providers.
 */
export const DEFAULT_WHITEBOARD_PANEL_REGISTRY = {
  chat: () =>
    import('../chat/WhiteboardChatPanel').then((m) => ({
      default: m.WhiteboardChatPanel,
    })),
} satisfies WhiteboardPanelRegistry;

const loaderMapByDefinitions = new WeakMap<
  readonly PanelDefinition[],
  WhiteboardPanelRegistry
>();

export function whiteboardLoadersForDefinitions(
  definitions: readonly PanelDefinition[],
): WhiteboardPanelRegistry {
  const cached = loaderMapByDefinitions.get(definitions);
  if (cached) return cached;
  const map: WhiteboardPanelRegistry = {};
  for (const definition of definitions) {
    if (definition.kind !== 'react') continue;
    map[definition.id] = definition.loader as WhiteboardPanelLoader;
  }
  loaderMapByDefinitions.set(definitions, map);
  return map;
}

export function resolveWhiteboardPanelLoaders(
  host: CanvasHost | undefined,
  loaders: WhiteboardPanelRegistry,
): WhiteboardPanelRegistry {
  const fromLoaderMap = whiteboardLoadersForDefinitions(reactPanelDefinitions(loaders));
  if (!host) {
    return fromLoaderMap;
  }
  const fromHost = whiteboardLoadersForDefinitions(host.panels.definitions());
  return { ...fromLoaderMap, ...fromHost };
}
