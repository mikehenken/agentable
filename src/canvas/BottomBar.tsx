import { Download } from 'lucide-react';

export function BottomBar() {
  return (
    <div className="absolute bottom-3 left-3 z-50 flex items-center pointer-events-none">
      <div className="flex items-center gap-1 bg-canvas-surface rounded-xl border border-canvas-border shadow-sm px-1 py-1 pointer-events-auto">
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle rounded-lg transition-colors">
          <Download size={14} />
          Download conversation
        </button>
        <div className="w-px h-4 bg-canvas-border" />
        <button className="px-3 py-1.5 text-xs text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle rounded-lg transition-colors">
          About
        </button>
        <div className="w-px h-4 bg-canvas-border" />
        <button className="px-3 py-1.5 text-xs text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle rounded-lg transition-colors">
          Help
        </button>
        <div className="w-px h-4 bg-canvas-border" />
        <button className="px-3 py-1.5 text-xs text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle rounded-lg transition-colors">
          Docs
        </button>
      </div>
    </div>
  );
}
