/**
 * CanvasChromeContext — structural tenant injection for canvas chrome.
 *
 * Distinct from `CanvasContext` (tenant persona/labels/copy). This carries
 * the registries that drive the SHELL ITSELF — the lazy panel set and the
 * sidebar nav items. Both are tenant-supplied so the OSS canvas can be
 * shipped framework-neutral with zero baked-in domain.
 *
 * `<CanvasShell panels={...} navItems={...}>` populates this context; any
 * descendant chrome component (`NavSidebar` today, future `<CommandBar>`,
 * `<KeyboardShortcuts>`, etc.) reads from here without prop-drilling.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_PANEL_REGISTRY, type PanelRegistry } from './panelLoader';
import { DEFAULT_NAV_ITEMS, type NavItemConfig } from './navItems';
import { DEFAULT_NAV_CHROME, resolveNavChrome, type NavChromeConfig } from './navChrome';

export interface CanvasChromeContextValue {
  panels: PanelRegistry;
  navItems: NavItemConfig[];
  /** When set, nav clicks route here instead of layoutStore (whiteboard substrate). */
  openPanel?: (panelId: string) => void;
  /** Optional footer slot (career voice rail + settings gear). */
  navFooter?: ReactNode;
  navChrome: ReturnType<typeof resolveNavChrome>;
}

/**
 * Sentinel default — distinct identity so `useCanvasChrome` can detect
 * "called outside a `<CanvasShell>`" and warn (dev) before silently
 * returning career-themed defaults. Architect-LOW 2026-04-26 follow-up:
 * keeps fail-soft semantics for forward-compat while surfacing misuse
 * loudly during development.
 */
const SENTINEL_CHROME: CanvasChromeContextValue = {
  panels: DEFAULT_PANEL_REGISTRY,
  navItems: DEFAULT_NAV_ITEMS,
  navChrome: resolveNavChrome(DEFAULT_NAV_CHROME),
};

const CanvasChromeContext =
  createContext<CanvasChromeContextValue>(SENTINEL_CHROME);

export function CanvasChromeProvider({
  panels,
  navItems,
  openPanel,
  navFooter,
  navChrome,
  children,
}: {
  panels: PanelRegistry;
  navItems: NavItemConfig[];
  openPanel?: (panelId: string) => void;
  navFooter?: ReactNode;
  navChrome?: NavChromeConfig;
  children: ReactNode;
}) {
  const resolvedNavChrome = useMemo(() => resolveNavChrome(navChrome), [navChrome]);
  const value = useMemo(() => ({ panels, navItems, openPanel, navFooter, navChrome: resolvedNavChrome }),
    [panels, navItems, openPanel, navFooter, resolvedNavChrome]);
  return (
    <CanvasChromeContext.Provider value={value}>
      {children}
    </CanvasChromeContext.Provider>
  );
}

export function useCanvasChrome(): CanvasChromeContextValue {
  const value = useContext(CanvasChromeContext);
  if (
    value === SENTINEL_CHROME &&
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production'
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[CanvasChrome] useCanvasChrome() called outside <CanvasShell>. ' +
        'Falling back to default career-themed registry — likely a misuse. ' +
        'Wrap your tree in <CanvasShell panels={...} navItems={...}>.');
  }
  return value;
}
