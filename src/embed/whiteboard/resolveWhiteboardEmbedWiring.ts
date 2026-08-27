/**
 * Resolve whiteboard embed wiring from injected host/nav/panels or registered providers.
 * Core never auto-detects career tenants or sniffs panel payloads.
 */
import {
  DEFAULT_WHITEBOARD_PANEL_REGISTRY,
  type WhiteboardPanelRegistry,
} from '../../engines/tldraw/shapes/whiteboardPanelRegistry';
import type { CanvasHost } from '../../panels/host';
import type { NavItemConfig } from '../../components/chrome/navItems';
import type { WhiteboardShellProps } from '../../engines/tldraw/WhiteboardShell';
import type { PartialCanvasTenantConfig } from '../../config/CanvasContext';
import type { RawPanelDataPayload } from '../../config/panelDataNormalize';
import type { EmbedConfigDocument } from '../types/embedConfig';
import {
  resolveWhiteboardWiringFromProviders,
  type WhiteboardWiringProviderInput,
  type WhiteboardWiringProviderResult,
} from './whiteboardWiringProviderRegistry';

export interface InjectedWhiteboardWiring {
  host?: CanvasHost;
  navItems?: NavItemConfig[];
  panels?: WhiteboardPanelRegistry;
  adapterSources?: readonly string[];
  renderNavFooter?: WhiteboardShellProps['renderNavFooter'];
  dispose?: () => void;
}

export interface ResolveWhiteboardEmbedWiringInput {
  configDocument: EmbedConfigDocument | null;
  tenantConfig: PartialCanvasTenantConfig;
  panelDataRaw: RawPanelDataPayload | null;
  tenant: string;
  fetchFn?: typeof fetch;
  /** Explicit wiring from React hosts — takes precedence over providers. */
  injected?: InjectedWhiteboardWiring | null;
}

export interface WhiteboardEmbedWiring {
  host: CanvasHost | undefined;
  navItems: NavItemConfig[];
  panelLoaders: WhiteboardPanelRegistry;
  adapterSources: readonly string[];
  /** Pack-owned nav footer renderer; undefined when the pack supplies none. */
  renderNavFooter?: WhiteboardShellProps['renderNavFooter'];
  /** Dispose any allocated host bundle. */
  dispose: () => void;
}

export interface ResolveWhiteboardEmbedWiringState {
  wiring: WhiteboardEmbedWiring;
  activeProvider: WhiteboardWiringProviderResult | null;
}

function mergeInjectedWiring(
  injected: InjectedWhiteboardWiring,
): WhiteboardEmbedWiring {
  return {
    host: injected.host,
    navItems: injected.navItems ?? [],
    panelLoaders: injected.panels ?? DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    adapterSources: injected.adapterSources ?? [],
    renderNavFooter: injected.renderNavFooter,
    dispose: injected.dispose ?? (() => {}),
  };
}

function chatOnlyWiring(): WhiteboardEmbedWiring {
  return {
    host: undefined,
    navItems: [],
    panelLoaders: DEFAULT_WHITEBOARD_PANEL_REGISTRY,
    adapterSources: [],
    dispose: () => {},
  };
}

function providerResultToWiring(
  result: WhiteboardWiringProviderResult,
): WhiteboardEmbedWiring {
  return {
    host: result.host,
    navItems: result.navItems,
    panelLoaders: result.panels,
    adapterSources: result.adapterSources ?? [],
    renderNavFooter: result.renderNavFooter,
    dispose: result.dispose,
  };
}

export function resolveWhiteboardEmbedWiring(
  input: ResolveWhiteboardEmbedWiringInput,
  previousProvider: WhiteboardWiringProviderResult | null = null,
): ResolveWhiteboardEmbedWiringState {
  previousProvider?.dispose();

  if (input.injected !== undefined && input.injected !== null) {
    const hasPanels = input.injected.panels !== undefined;
    const hasHost = input.injected.host !== undefined;
    if (hasPanels || hasHost || (input.injected.navItems?.length ?? 0) > 0) {
      return {
        wiring: mergeInjectedWiring(input.injected),
        activeProvider: null,
      };
    }
  }

  const providerInput: WhiteboardWiringProviderInput = {
    configDocument: input.configDocument,
    tenantConfig: input.tenantConfig,
    panelDataRaw: input.panelDataRaw,
    tenant: input.tenant,
    fetchFn: input.fetchFn,
  };

  const fromProvider = resolveWhiteboardWiringFromProviders(providerInput);
  if (fromProvider !== null) {
    return {
      wiring: providerResultToWiring(fromProvider),
      activeProvider: fromProvider,
    };
  }

  return {
    wiring: chatOnlyWiring(),
    activeProvider: null,
  };
}
