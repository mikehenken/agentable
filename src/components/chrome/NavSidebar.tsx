import { PanelLeft, PanelRight } from 'lucide-react';
import { useState } from 'react';
import { useNavChromeStore } from './navChromeStore';
import { prefetchPanel } from './panelLoader';
import { useCanvasChrome } from './CanvasChromeContext';
import type { NavItemConfig } from './navItems';
import { resolveCatalogString } from '../../i18n/resolveCatalogString';
import type { NavChromeConfig } from './navChrome';
import { resolveNavChrome } from './navChrome';

export type NavSidebarVariant = 'bounded' | 'whiteboard';

export interface NavSidebarProps {
  forceCollapsed?: boolean;
  variant?: NavSidebarVariant;
  navChrome?: NavChromeConfig;
}

export function NavSidebar({
  forceCollapsed,
  variant = 'whiteboard',
  navChrome: navChromeOverride,
}: NavSidebarProps = {}) {
  const { navSidebarExpanded, setNavSidebarExpanded } = useNavChromeStore();
  const { navItems, panels, openPanel, navFooter, navChrome: contextNavChrome } = useCanvasChrome();
  const navChrome = resolveNavChrome(navChromeOverride ?? contextNavChrome);
  const [expandableHover, setExpandableHover] = useState(false);

  const railVariant = navChrome.variant;
  const usePopover = railVariant === 'popover';
  const useExpandableRail = railVariant === 'expandable-rail';

  const collapsed =
    forceCollapsed === true
      ? true: usePopover
        ? !navSidebarExpanded: useExpandableRail
          ? !expandableHover: true;

  const topClass = variant === 'whiteboard' ? 'top-3' : 'top-16';

  const handleItemClick = (item: NavItemConfig) => {
    if (!item.panelId || !openPanel) return;
    openPanel(item.panelId);
  };

  const navLabel = (item: NavItemConfig): string => resolveCatalogString(item.label);

  const handlePrefetch = (item: NavItemConfig) => {
    const key = item.prefetchKey ?? item.panelId;
    if (panels[key]) prefetchPanel(key, panels);
  };

  if (navItems.length === 0) {
    return null;
  }

  const railShellClass = useExpandableRail
    ? `absolute left-[3px] ${topClass} z-[100] bg-canvas-surface/95 rounded-2xl border border-canvas-border shadow-md overflow-hidden pointer-events-auto backdrop-blur-sm transition-[width] duration-200 ease-out`: `absolute left-3 ${topClass} z-[100] w-11 bg-canvas-surface rounded-xl border border-canvas-border shadow-sm overflow-hidden py-1.5 pointer-events-auto`;

  if (collapsed) {
    return (
      <div
        className={railShellClass}
        style={useExpandableRail ? { width: 52 }: undefined}
        data-testid="nav-sidebar"
        data-collapsed="true"
        data-variant={variant}
        data-rail-variant={railVariant}
        data-chrome="nav-sidebar"
        onMouseEnter={useExpandableRail ? ()=> setExpandableHover(true): undefined}
        onMouseLeave={useExpandableRail ? ()=> setExpandableHover(false): undefined}
      >
        {usePopover ? (
          <button
            type="button"
          onClick={() => setNavSidebarExpanded(true)}
          className="w-full flex items-center justify-center py-2 text-canvas-faint hover:text-canvas hover:bg-canvas-surface-subtle transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
          >
          <PanelRight size={18} />
          </button>
        ): null}
        {usePopover ? <div className="border-t border-canvas-border my-1 mx-2" />: null}
        <div className={useExpandableRail ? 'flex flex-col gap-1 p-1.5': undefined}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
            title={navLabel(item)}
            aria-label={navLabel(item)}
              onClick={() => handleItemClick(item)}
              onPointerEnter={() => handlePrefetch(item)}
            onFocus={() => handlePrefetch(item)}
              className={
                useExpandableRail
                  ? 'flex h-9 w-9 items-center justify-center rounded-xl text-canvas-faint hover:bg-canvas-primary-tint hover:text-canvas-primary transition-colors': 'w-full flex items-center justify-center py-2 text-canvas-faint hover:text-canvas-primary hover:bg-canvas-primary-tint transition-colors'
              }
            >
            <item.icon size={18} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const expandedShellClass = useExpandableRail
    ? `absolute left-[3px] ${topClass} z-[100] w-[210px] max-w-[calc(100%-24px)] bg-canvas-surface/95 rounded-2xl border border-canvas-border shadow-md overflow-hidden pointer-events-auto flex flex-col max-h-[calc(100vh-80px)] backdrop-blur-sm transition-[width] duration-200 ease-out`: `absolute left-3 ${topClass} z-[100] w-[210px] max-w-[calc(100%-24px)] bg-canvas-surface rounded-xl border border-canvas-border shadow-sm overflow-hidden pointer-events-auto flex flex-col max-h-[calc(100vh-80px)]`;

  return (
    <div
      className={expandedShellClass}
      data-testid="nav-sidebar"
      data-collapsed="false"
      data-variant={variant}
      data-rail-variant={railVariant}
      data-chrome="nav-sidebar"
      onMouseEnter={useExpandableRail ? ()=> setExpandableHover(true): undefined}
      onMouseLeave={useExpandableRail ? ()=> setExpandableHover(false): undefined}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-canvas-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-canvas-muted">
            {useExpandableRail ? 'Tools': 'Menu'}
          </span>
        </div>
        {usePopover ? (
          <button
            type="button"
          onClick={() => setNavSidebarExpanded(false)}
          className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas transition-colors"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          >
          <PanelLeft size={16} />
          </button>
        ): null}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
      {navItems.map((item) => (
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          className={
            useExpandableRail
              ? 'mx-2 my-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-canvas-muted hover:bg-canvas-primary-tint hover:text-canvas-primary cursor-pointer transition-colors': 'flex items-center gap-3 px-3 py-2 text-sm text-canvas-muted hover:bg-canvas-primary-tint hover:text-canvas-primary cursor-pointer transition-colors'
          }
          onClick={() => handleItemClick(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleItemClick(item);
            }
          }}
          onPointerEnter={() => handlePrefetch(item)}
        >
          <item.icon size={18} className="text-canvas-faint shrink-0" />
          <span className="truncate">{navLabel(item)}</span>
        </div>
      ))}
      </div>
      {navFooter ? <div className="shrink-0 mt-auto">{navFooter}</div> : null}
    </div>
  );
}
