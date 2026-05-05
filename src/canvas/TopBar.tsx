import { LayoutGrid, Settings } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { useCanvasConfig } from './CanvasContext';

export function TopBar() {
  const { autoOrganize, showPanel, toggleSnapGrid, snapGrid } = useLayoutStore();
  const { persona } = useCanvasConfig();
  const title = persona.tenantTitle;
  const initial = (persona.assistantName?.[0] ?? title[0] ?? 'A').toUpperCase();

  return (
    <>
      {/* LEFT: Logo */}
      <div className="absolute top-3 left-3 z-50 flex items-center gap-2.5 pointer-events-auto">
        <div className="w-8 h-8 rounded-lg bg-canvas-primary flex items-center justify-center text-white text-sm font-bold">
          {initial}
        </div>
        <span className="text-base font-semibold text-canvas">{title}</span>
      </div>

      {/* RIGHT: Actions */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={autoOrganize}
          className="text-sm font-medium text-canvas-muted px-4 py-2 rounded-xl bg-canvas-surface border border-canvas-border hover:bg-canvas-surface-subtle transition-colors shadow-sm"
        >
          Auto-organize
        </button>
        <button
          onClick={toggleSnapGrid}
          className={`p-2.5 rounded-xl border transition-colors shadow-sm ${
            snapGrid 
              ? 'bg-canvas-primary-tint border-canvas-primary text-canvas-primary' 
              : 'bg-canvas-surface border-canvas-border text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle'
          }`}
          title={snapGrid ? 'Snap grid: ON' : 'Snap grid: OFF'}
        >
          <LayoutGrid size={18} />
        </button>
        <button
          onClick={() => showPanel('settings')}
          className="p-2.5 rounded-xl bg-canvas-surface border border-canvas-border text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle transition-colors shadow-sm"
        >
          <Settings size={18} />
        </button>
        {/* External-link button removed for the OSS build. Tenants can
            re-add via a custom TopBar or by injecting a header slot. */}
      </div>
    </>
  );
}
