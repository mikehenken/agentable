/**
 * Tab strip for a DOM workspace region.
 */
import type { ReactElement } from 'react';
import type { DomPanelRecord, DomRegionId } from '../types';

export interface DomTabStripProps {
  regionId: DomRegionId;
  panels: DomPanelRecord[];
  activeIndex: number;
  onSelect: (tabIndex: number) => void;
  /** Human-readable tab labels; defaults to raw panel ids. */
  resolvePanelLabel?: (panelId: string) => string;
}

export function DomTabStrip({
  regionId,
  panels,
  activeIndex,
  onSelect,
  resolvePanelLabel,
}: DomTabStripProps): ReactElement | null {
  if (panels.length <= 1) {
    return null;
  }

  const sorted = [...panels].sort((a, b) => a.tabIndex - b.tabIndex);
  const labelFor = (panelId: string): string => resolvePanelLabel?.(panelId) ?? panelId;

  return (
    <div
      className="dom-tab-strip flex min-w-0 shrink-0 gap-1 border-b border-border px-2 py-1"
      role="tablist"
      aria-label={`${regionId} panels`}
      data-dom-region={regionId}
    >
      {sorted.map((panel) => {
        const selected = panel.tabIndex === activeIndex;
        const label = labelFor(panel.panelId);
        return (
          <button
            key={panel.panelId}
            type="button"
            role="tab"
            aria-selected={selected}
            title={label}
            data-dom-tab={panel.panelId}
            data-active={selected ? 'true': 'false'}
            className={`max-w-[50%] truncate rounded px-2 py-1 text-xs ${
              selected ? 'bg-muted font-medium': 'text-muted-foreground hover:bg-muted/60'
            }`}
            onClick={() => {
              onSelect(panel.tabIndex);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
