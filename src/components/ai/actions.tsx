import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Actions({
  children,
  className,...props
}: ActionsProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-0.5', className)} data-testid="operator-actions" {...props}>
      {children}
    </div>
  );
}

export interface ActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: React.ReactNode;
}

export function Action({
  label,
  icon,
  className,...props
}: ActionProps): React.ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded text-[var(--vibe-text-muted,#9a9a9a)]',
        'transition-colors hover:bg-[var(--vibe-hover-bg,rgb(255_255_255/0.06))] hover:text-[var(--vibe-text,#ececec)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
        className)}
      {...props}
    >
      {icon}
    </button>
  );
}
