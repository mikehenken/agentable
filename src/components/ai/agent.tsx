import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AgentProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  description?: string;
  initials?: string;
  active?: boolean;
  meta?: string;
}

/** Agent identity block for operator header (shadcn AI agent pattern). */
export function Agent({
  name,
  description,
  initials = 'AI',
  active = false,
  meta,
  className,...props
}: AgentProps): React.ReactElement {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)} {...props}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white',
          active ? 'bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.25)]': 'bg-indigo-600/90')}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--vibe-text,#ececec)]">{name}</p>
        {description ? (
          <p className="truncate text-xs text-[var(--vibe-text-muted,#9a9a9a)]">{description}</p>
        ): null}
        {meta ? (
          <p className="truncate text-[10px] text-[var(--vibe-text-faint,#6f6f6f)]" title={meta}>
            {meta}
          </p>
        ): null}
      </div>
    </div>
  );
}
