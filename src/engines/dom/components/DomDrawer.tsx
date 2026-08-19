/**
 * Collapsible drawer wrapper for compact (tablet/mobile) sidebar region.
 */
import type { ReactElement, ReactNode } from 'react';

export interface DomDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  children: ReactNode;
}

export function DomDrawer({
  open,
  onOpenChange,
  label = 'Sidebar',
  children,
}: DomDrawerProps): ReactElement {
  return (
    <>
      <button
        type="button"
        className="dom-drawer-toggle border border-border rounded px-2 py-1 text-xs"
        aria-expanded={open}
        aria-controls="dom-sidebar-drawer"
        data-dom-drawer-toggle="true"
        onClick={() => {
          onOpenChange(!open);
        }}
      >
        {open ? `Close ${label}`: `Open ${label}`}
      </button>
      <aside
        id="dom-sidebar-drawer"
        data-dom-drawer="true"
        data-dom-drawer-open={open ? 'true': 'false'}
        aria-hidden={!open}
        className={`dom-drawer-panel border border-border bg-background ${
          open ? 'block': 'hidden'
        }`}
      >
        {open ? children: null}
      </aside>
    </>
  );
}
