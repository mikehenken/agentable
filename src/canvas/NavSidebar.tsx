import { useState } from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { prefetchPanel } from './panelImports';
import { useCanvasChrome } from './CanvasChromeContext';
import type { NavItemConfig } from './navItems';

/**
 * Tenant-driven sidebar. Reads `navItems` and the active `panels` registry
 * from `CanvasChromeContext` — set on `<CanvasShell navItems={...} panels={...}>`.
 * No baked-in career copy; the OSS default registry is just the path of
 * least surprise.
 *
 * `prefetchKey` on a nav item maps it to a `panels` registry key so hover/
 * focus warms the chunk ~100 ms before the click. Items pointing at eager
 * panels (chat, artifacts, voice) leave `prefetchKey` undefined.
 */
export function NavSidebar() {
  const { showPanel, resetPan } = useLayoutStore();
  const { navItems, panels } = useCanvasChrome();
  const [collapsed, setCollapsed] = useState(true);

  const handleItemClick = (item: NavItemConfig) => {
    if (!item.panelId) return;
    resetPan();
    showPanel(item.panelId as Parameters<typeof showPanel>[0]);
  };

  const handlePrefetch = (item: NavItemConfig) => {
    // Prefer explicit `prefetchKey`, fall back to `panelId`. Membership
    // check against the active registry naturally skips eager panels
    // (chat, artifacts) — they don't appear in `panels`. Architect-LOW
    // 2026-04-26 follow-up: removes the silent-no-op footgun when a
    // tenant nav id matches a registry id without redundant `prefetchKey`.
    const key = item.prefetchKey ?? item.panelId;
    if (panels[key]) prefetchPanel(key, panels);
  };

  if (collapsed) {
    return (
      <div className="absolute left-3 top-16 z-40 w-11 bg-canvas-surface rounded-xl border border-canvas-border shadow-sm overflow-hidden py-1.5 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center py-2 text-canvas-faint hover:text-canvas hover:bg-canvas-surface-subtle transition-colors"
          title="Expand sidebar"
        >
          <PanelRight size={18} />
        </button>
        <div className="border-t border-canvas-border my-1 mx-2" />
        {navItems.map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => handleItemClick(item)}
            onPointerEnter={() => handlePrefetch(item)}
            onFocus={() => handlePrefetch(item)}
            className="w-full flex items-center justify-center py-2 text-canvas-faint hover:text-canvas-primary hover:bg-canvas-primary-tint transition-colors"
          >
            <item.icon size={18} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute left-3 top-16 z-40 w-[210px] bg-canvas-surface rounded-xl border border-canvas-border shadow-sm overflow-hidden pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-canvas-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-canvas-muted">Menu</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeft size={16} />
        </button>
      </div>
      {navItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 px-3 py-2 text-sm text-canvas-muted hover:bg-canvas-primary-tint hover:text-canvas-primary cursor-pointer transition-colors"
          onClick={() => handleItemClick(item)}
          onPointerEnter={() => handlePrefetch(item)}
        >
          <item.icon size={18} className="text-canvas-faint" />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
