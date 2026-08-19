import * as React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InlineCitationProps extends React.HTMLAttributes<HTMLSpanElement> {
  path: string;
  label?: string;
}

/** Inline path citation for virtual workspace files (shadcn AI inline-citation pattern). */
export function InlineCitation({
  path,
  label,
  className,...props
}: InlineCitationProps): React.ReactElement {
  const display = label ?? path;
  return (
    <span
      className={cn(
        'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] px-1.5 py-0.5 align-middle text-[11px] text-[var(--vibe-text-muted,#9a9a9a)]',
        className)}
      title={path}
      data-citation-path={path}
      data-testid="operator-inline-citation"
      {...props}
    >
      <FileText className="h-3 w-3 shrink-0 text-sky-400" aria-hidden />
      <span className="truncate font-mono">{display}</span>
    </span>
  );
}
