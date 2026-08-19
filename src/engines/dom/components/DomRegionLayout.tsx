/**
 * Region layout with resizable horizontal split and per-region tab strips.
 */
import { useCallback, type ReactElement, type ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { DomTabStrip } from './DomTabStrip';
import { DomDrawer } from './DomDrawer';
import { useDomBreakpoint } from '../hooks/useDomBreakpoint';
import type { DomLayoutSnapshot, DomPanelRecord, DomRegionId } from '../types';

/** Sidebar width bounds (percent of horizontal split). */
const SIDEBAR_MIN_SIZE_PERCENT = 18;
const SIDEBAR_MAX_SIZE_PERCENT = 42;
const MAIN_MIN_SIZE_PERCENT = 40;
const MAIN_PANEL_ID = 'dom-main';
const SIDEBAR_PANEL_ID = 'dom-sidebar';

/**
 * react-resizable-panels v4 treats numeric size props as pixels; strings are
 * percentages. Export for unit tests that assert v4 sizing semantics.
 */
export const DOM_SPLIT_SIZE_PROPS = {
  sidebarMinSize: String(SIDEBAR_MIN_SIZE_PERCENT),
  sidebarMaxSize: String(SIDEBAR_MAX_SIZE_PERCENT),
  mainMinSize: String(MAIN_MIN_SIZE_PERCENT),
} as const;

/** defaultLayout uses numeric flexGrow percentages (0–100), not pixel strings. */
function buildDefaultSplitLayout(
  sidebarSize: number): Record<string, number> {
  const clampedSidebar = clampSidebarSplit(sidebarSize);
  return {
    [MAIN_PANEL_ID]: 100 - clampedSidebar,
    [SIDEBAR_PANEL_ID]: clampedSidebar,
  };
}

export interface DomRegionLayoutProps {
  snapshot: DomLayoutSnapshot;
  activeTab: Record<DomRegionId, number>;
  onActiveTabChange: (regionId: DomRegionId, tabIndex: number) => void;
  sidebarDrawerOpen: boolean;
  onSidebarDrawerOpenChange: (open: boolean) => void;
  onSidebarSplitChange: (size: number) => void;
  renderPanel: (panel: DomPanelRecord) => ReactNode;
  resolvePanelLabel?: (panelId: string) => string;
}

function panelsForRegion(panels: DomPanelRecord[], regionId: DomRegionId): DomPanelRecord[] {
  return panels.filter((panel) => panel.regionId === regionId);
}

function activePanel(
  panels: DomPanelRecord[],
  regionId: DomRegionId,
  activeIndex: number): DomPanelRecord | null {
  const regionPanels = panelsForRegion(panels, regionId);
  if (regionPanels.length === 0) return null;
  return (
    regionPanels.find((panel) => panel.tabIndex === activeIndex) ??
    regionPanels.sort((a, b) => a.tabIndex - b.tabIndex)[0] ??
    null
  );
}

function clampSidebarSplit(size: number): number {
  return Math.max(
    SIDEBAR_MIN_SIZE_PERCENT,
    Math.min(SIDEBAR_MAX_SIZE_PERCENT, size));
}

function RegionPane({
  regionId,
  snapshot,
  activeTab,
  onActiveTabChange,
  renderPanel,
  resolvePanelLabel,
}: {
  regionId: DomRegionId;
  snapshot: DomLayoutSnapshot;
  activeTab: Record<DomRegionId, number>;
  onActiveTabChange: (regionId: DomRegionId, tabIndex: number) => void;
  renderPanel: (panel: DomPanelRecord) => ReactNode;
  resolvePanelLabel?: (panelId: string) => string;
}): ReactElement {
  const regionPanels = panelsForRegion(snapshot.panels, regionId);
  const current = activePanel(snapshot.panels, regionId, activeTab[regionId]);

  return (
    <div
      className="dom-region flex h-full min-h-0 min-w-0 flex-col"
      data-dom-region={regionId}
      data-panel-count={regionPanels.length}
    >
      <DomTabStrip
        regionId={regionId}
        panels={regionPanels}
        activeIndex={activeTab[regionId]}
        resolvePanelLabel={resolvePanelLabel}
        onSelect={(tabIndex) => {
          onActiveTabChange(regionId, tabIndex);
        }}
      />
      <div
        className={`dom-region-body dom-region-body--${regionId} min-h-0 min-w-0 flex-1 overflow-auto`}
        data-dom-region-body={regionId}
      >
        {current ? (
          renderPanel(current)
        ): (
          <div className="text-muted-foreground text-xs" data-dom-empty-region={regionId}>
            No panel
          </div>
        )}
      </div>
    </div>
  );
}

export function DomRegionLayout({
  snapshot,
  activeTab,
  onActiveTabChange,
  sidebarDrawerOpen,
  onSidebarDrawerOpenChange,
  onSidebarSplitChange,
  renderPanel,
  resolvePanelLabel,
}: DomRegionLayoutProps): ReactElement {
  const { isCompact } = useDomBreakpoint;
  const defaultLayout = buildDefaultSplitLayout(snapshot.sidebarSplit);

  const handleSplitLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      const sidebarPercent = layout[SIDEBAR_PANEL_ID];
      if (typeof sidebarPercent !== 'number' || !Number.isFinite(sidebarPercent)) {
        return;
      }
      const clamped = clampSidebarSplit(sidebarPercent);
      if (Math.abs(clamped - snapshot.sidebarSplit) < 0.25) {
        return;
      }
      onSidebarSplitChange(clamped);
    },
    [onSidebarSplitChange, snapshot.sidebarSplit]);

  const sidebarPane = (
    <RegionPane
      regionId="sidebar"
      snapshot={snapshot}
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
      renderPanel={renderPanel}
      resolvePanelLabel={resolvePanelLabel}
    />
  );

  if (isCompact) {
    return (
      <div className="dom-region-layout dom-region-layout--compact flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
        <div className="dom-region-layout__toolbar flex shrink-0 items-center gap-2 px-2 pt-2">
          <DomDrawer
            open={sidebarDrawerOpen}
            onOpenChange={onSidebarDrawerOpenChange}
            label="Sidebar"
          >
            {sidebarPane}
          </DomDrawer>
        </div>
        <div className="dom-region-layout__main min-h-0 min-w-0 flex-1 overflow-hidden">
          <RegionPane
            regionId="main"
            snapshot={snapshot}
            activeTab={activeTab}
            onActiveTabChange={onActiveTabChange}
            renderPanel={renderPanel}
            resolvePanelLabel={resolvePanelLabel}
          />
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      id="dom-app-shell-split"
      orientation="horizontal"
      className="dom-region-layout dom-region-layout--split h-full min-h-0 min-w-0 overflow-hidden"
      data-dom-layout="split"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleSplitLayoutChanged}
    >
      <ResizablePanel
        id={MAIN_PANEL_ID}
        minSize={DOM_SPLIT_SIZE_PROPS.mainMinSize}
        className="min-w-0 overflow-hidden"
        data-dom-panel="main"
      >
        <RegionPane
          regionId="main"
          snapshot={snapshot}
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
          renderPanel={renderPanel}
          resolvePanelLabel={resolvePanelLabel}
        />
      </ResizablePanel>
      <ResizableHandle withHandle data-dom-split-handle="true" className="shrink-0" />
      <ResizablePanel
        id={SIDEBAR_PANEL_ID}
        minSize={DOM_SPLIT_SIZE_PROPS.sidebarMinSize}
        maxSize={DOM_SPLIT_SIZE_PROPS.sidebarMaxSize}
        className="min-w-0 overflow-hidden"
        data-dom-panel="sidebar"
      >
        {sidebarPane}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
