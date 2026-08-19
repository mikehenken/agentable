/**
 * DOM workspace shell — React mount surface for the DOM canvas engine.
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { DomRegionLayout } from './components/DomRegionLayout';
import type { DomEngineHandle } from './engine';
import type { DomPanelRecord } from './types';

export interface DomWorkspaceShellProps {
  engine: DomEngineHandle;
  /** Optional panel body renderer; defaults to a labeled placeholder. */
  renderPanel?: (panel: DomPanelRecord) => ReactNode;
  /** Human-readable tab labels; defaults to raw panel ids. */
  resolvePanelLabel?: (panelId: string) => string;
  className?: string;
}

function defaultRenderPanel(panel: DomPanelRecord): ReactElement {
  return (
    <div
      className="dom-panel-slot rounded border border-dashed border-border p-4 text-sm"
      data-dom-panel-id={panel.panelId}
      data-dom-panel-region={panel.regionId}
      data-testid={`dom-panel-${panel.panelId}`}
    >
      {panel.panelId}
    </div>
  );
}

export function DomWorkspaceShell({
  engine,
  renderPanel = defaultRenderPanel,
  resolvePanelLabel,
  className,
}: DomWorkspaceShellProps): ReactElement {
  const [, bump] = useState(0);

  useEffect(() => engine.subscribe(() => bump((value) => value + 1)), [engine]);

  const snapshot = engine.getDomLayout;

  const onActiveTabChange = useCallback(
    (regionId: 'main' | 'sidebar', tabIndex: number) => {
      engine.setActiveTab(regionId, tabIndex);
    },
    [engine]);

  const onSidebarDrawerOpenChange = useCallback(
    (open: boolean) => {
      engine.setSidebarDrawerOpen(open);
    },
    [engine]);

  const onSidebarSplitChange = useCallback(
    (size: number) => {
      engine.setSidebarSplit(size);
    },
    [engine]);

  return (
    <div
      className={`dom-workspace-shell app-shell--gallery-dark whiteboard-shell--vibe-dark flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background text-foreground ${className ?? ''}`}
      data-dom-engine="true"
      data-camera="none"
    >
      <DomRegionLayout
        snapshot={snapshot}
        activeTab={snapshot().activeTab}
        onActiveTabChange={onActiveTabChange}
        sidebarDrawerOpen={snapshot().sidebarDrawerOpen}
        onSidebarDrawerOpenChange={onSidebarDrawerOpenChange}
        onSidebarSplitChange={onSidebarSplitChange}
        renderPanel={renderPanel}
        resolvePanelLabel={resolvePanelLabel}
      />
    </div>
  );
}
