import { createContext, useContext, useMemo, type ReactElement } from 'react';
import type { CanvasHost } from '../../panels/host';

export interface PanelEmbedHostContextValue {
  host: CanvasHost;
  adapterSources: readonly string[];
}

const PanelEmbedHostContext = createContext<PanelEmbedHostContextValue | null>(null);

const EMPTY_ADAPTER_SOURCES: readonly string[] = [];

export function PanelEmbedHostProvider(props: {
  host: CanvasHost;
  adapterSources?: readonly string[];
  children: React.ReactNode;
}): ReactElement {
  const value = useMemo(
    (): PanelEmbedHostContextValue => ({
      host: props.host,
      adapterSources: props.adapterSources ?? EMPTY_ADAPTER_SOURCES,
    }),
    [props.host, props.adapterSources],
  );
  return (
    <PanelEmbedHostContext.Provider value={value}>
      {props.children}
    </PanelEmbedHostContext.Provider>
  );
}

export function useOptionalPanelEmbedHost(): PanelEmbedHostContextValue | null {
  return useContext(PanelEmbedHostContext);
}

export function usePanelEmbedHost(): CanvasHost {
  const ctx = useContext(PanelEmbedHostContext);
  if (ctx === null) {
    throw new Error('usePanelEmbedHost must render inside PanelEmbedHostProvider');
  }
  return ctx.host;
}

export function usePanelEmbedAdapterSources(): readonly string[] {
  const ctx = useContext(PanelEmbedHostContext);
  return ctx?.adapterSources ?? EMPTY_ADAPTER_SOURCES;
}
