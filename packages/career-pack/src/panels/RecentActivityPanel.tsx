import type { ReactElement } from 'react';
import { Briefcase, MessageSquare, PanelTop, Wrench } from 'lucide-react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';

const ACTIVITY = [
  {
    id: 'a1',
    time: '2m ago',
    label: 'Opened Open Positions',
    detail: 'Filtered: Professionals · Jamaica',
    icon: Briefcase,
  },
  {
    id: 'a2',
    time: '18m ago',
    label: 'Tool call: open_positions()',
    detail: 'Sandy surfaced 5 matching roles',
    icon: Wrench,
  },
  {
    id: 'a3',
    time: '1h ago',
    label: 'Viewed application timeline',
    detail: 'Resort Manager · Interview scheduled',
    icon: PanelTop,
  },
  {
    id: 'a4',
    time: 'Yesterday',
    label: 'New chat started',
    detail: 'Asked about SCU learning programs',
    icon: MessageSquare,
  },
] as const;

export function RecentActivityPanel(_props: ReactPanelLoaderProps): ReactElement {
  return (
    <div className="flex flex-col h-full min-h-[320px]" data-testid="recent-activity-panel">
      <div className="shrink-0 px-4 py-3 border-b border-canvas-border">
        <h2 className="text-[15px] font-semibold text-canvas">Recent Activity</h2>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-canvas-border">
        {ACTIVITY.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className="px-4 py-3 flex gap-3" data-testid={`activity-${item.id}`}>
              <div className="w-8 h-8 rounded-lg bg-canvas-surface-subtle flex items-center justify-center shrink-0">
                <Icon size={16} className="text-canvas-muted" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-canvas truncate">{item.label}</p>
                  <span className="text-[10px] text-canvas-faint shrink-0">{item.time}</span>
                </div>
                <p className="text-[12px] text-canvas-muted mt-0.5">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
