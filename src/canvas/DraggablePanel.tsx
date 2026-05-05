import { useRef, useState, useCallback, type ReactNode } from 'react';
import { GripVertical, Minus, X } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import type { PanelId } from '../types';

interface DraggablePanelProps {
  id: PanelId;
  title: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}

export function DraggablePanel({
  id,
  title,
  children,
  className = '',
  headerClassName = '',
}: DraggablePanelProps & { className?: string; headerClassName?: string }) {
  const { panels, movePanel, resizePanel, hidePanel, minimizePanel, maximizePanel } = useLayoutStore();
  const [isResizing, setIsResizing] = useState(false);
  const resizePreviewRef = useRef<{ w: number; h: number } | null>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const layout = panels[id];
  if (!layout?.visible) return null;

  const x = layout.x ?? 100;
  const y = layout.y ?? 100;
  const w = isResizing && resizePreviewRef.current ? resizePreviewRef.current.w : (layout.w ?? 400);
  const h = layout.minimized ? 44 : (layout.h ?? 300);
  const minimized = layout.minimized ?? false;
  const resizable = layout.resizable ?? false;

  // DRAG: Header drag handler
  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const panelX = x;
    const panelY = y;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movePanel(id, panelX + dx, panelY + dy);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [id, x, y, movePanel]);

  // RESIZE: corner/edge drag handler
  const handleResizePointerDown = useCallback((e: React.PointerEvent, direction: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: layout.w ?? 400,
      h: layout.h ?? 300,
    };
    resizePreviewRef.current = { w: layout.w ?? 400, h: layout.h ?? 300 };

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      let newW = resizeStartRef.current.w;
      let newH = resizeStartRef.current.h;
      if (direction.includes('e')) newW = Math.max((layout.minW ?? 200), resizeStartRef.current.w + dx);
      if (direction.includes('s')) newH = Math.max((layout.minH ?? 150), resizeStartRef.current.h + dy);
      if (direction.includes('se')) {
        newW = Math.max((layout.minW ?? 200), resizeStartRef.current.w + dx);
        newH = Math.max((layout.minH ?? 150), resizeStartRef.current.h + dy);
      }
      resizePreviewRef.current = { w: newW, h: newH };
      setIsResizing(prev => prev);
    };

    const handleUp = () => {
      const preview = resizePreviewRef.current;
      if (preview) {
        resizePanel(id, preview.w, preview.h);
      }
      resizePreviewRef.current = null;
      setIsResizing(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [id, layout.w, layout.h, layout.minW, layout.minH, resizePanel]);

  return (
    <div
      className={`absolute bg-canvas-surface rounded-xl border border-canvas-border shadow-md flex flex-col overflow-hidden ${className}`.trim()}
      style={{
        left: x,
        top: y,
        width: w,
        height: minimized ? 44 : (layout.autoHeight ? 'auto' : (isResizing && resizePreviewRef.current ? resizePreviewRef.current.h : h)),
        zIndex: minimized ? 10 : 30,
        minWidth: layout.minW || 200,
        minHeight: minimized ? 44 : (layout.minH || 150),
        transition: isResizing ? 'none' : 'box-shadow 0.15s ease',
      }}
    >
      {/* DRAG HEADER with grip, title, minimize, close */}
      {title ? (
        <div
          className={`flex items-center justify-between px-3 py-2 border-b border-canvas-border select-none shrink-0 ${headerClassName}`}
          onPointerDown={handleHeaderPointerDown}
          style={{ cursor: 'grab' }}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-canvas-faint shrink-0" />
            <span className="text-sm font-medium text-canvas">{title}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); minimized ? maximizePanel(id) : minimizePanel(id); }}
              className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-muted transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); hidePanel(id); }}
              className="p-1.5 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-muted transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* Custom close button for panels without title */
        !minimized && (
          <div className="absolute top-0 right-0 z-30 p-1">
            <button
              onClick={(e) => { e.stopPropagation(); hidePanel(id); }}
              className="p-1.5 rounded-lg hover:bg-canvas-surface/10 text-canvas-faint hover:text-white transition-colors"
              style={{ cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )
      )}

      {/* CONTENT (hidden when minimized) */}
      {!minimized && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      )}

      {/* RESIZE HANDLES */}
      {resizable && !minimized && !layout.autoHeight && (
        <>
          <div
            className="absolute bottom-0 right-0 w-5 h-5 z-20"
            style={{ cursor: 'se-resize' }}
            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1 right-1 text-canvas-faint">
              <path d="M1 9L9 1M4 9L9 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div
            className="absolute top-10 right-0 w-2 h-[calc(100%-40px)] z-20"
            style={{ cursor: 'e-resize' }}
            onPointerDown={(e) => handleResizePointerDown(e, 'e')}
          />
          <div
            className="absolute bottom-0 left-4 w-[calc(100%-40px)] h-2 z-20"
            style={{ cursor: 's-resize' }}
            onPointerDown={(e) => handleResizePointerDown(e, 's')}
          />
        </>
      )}
    </div>
  );
}
