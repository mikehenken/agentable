import * as React from 'react';
import { CheckCircle2, ChevronDown, Loader2, Wrench, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatToolCallLabel } from '../../chat/toolCallLabels';

export type ToolStatus = 'running' | 'succeeded' | 'failed';

export interface ToolProps extends React.HTMLAttributes<HTMLDivElement> {
  toolName: string;
  status: ToolStatus;
  inputSummary?: string;
  resultSummary?: string;
  /** Raw tool error — shown in Output when status is failed. */
  error?: string;
  args?: Record<string, unknown>;
  defaultOpen?: boolean;
}

export function Tool({
  toolName,
  status,
  inputSummary,
  resultSummary,
  error,
  args = {},
  defaultOpen = false,
  className,...props
}: ToolProps): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);
  const displayName = toolName.replace(/_/g, ' ');
  const StatusIcon =
    status === 'running' ? Loader2: status === 'failed' ? XCircle: CheckCircle2;

  const inputText = (inputSummary ?? JSON.stringify(args, null, 2)).trim() || '(no parameters)';
  const failedError = status === 'failed' && error !== undefined && error.trim().length > 0
    ? error.trim() : undefined;
  const outputText =
    status === 'running'
      ? 'Running…': failedError ??
        ((resultSummary ?? '').trim() ||
          formatToolCallLabel(toolName, args, status !== 'failed', error));

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] text-xs',
        className)}
      data-testid="operator-tool"
      data-tool-name={toolName}
      data-tool-status={status}
      {...props}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-[var(--vibe-border,rgb(255_255_255/0.09))] px-3 py-2 text-left hover:bg-[var(--vibe-hover-bg,rgb(255_255_255/0.06))]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open ? 'true': 'false'}
      >
        <Wrench className="h-3.5 w-3.5 shrink-0 text-[var(--vibe-text-muted,#9a9a9a)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium capitalize text-[var(--vibe-text,#ececec)]">
          {displayName}
        </span>
        <span className="truncate font-mono text-[10px] text-[var(--vibe-text-faint,#6f6f6f)]">
          {toolName}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            status === 'running' && 'bg-sky-500/10 text-sky-400',
            status === 'succeeded' && 'bg-emerald-500/10 text-emerald-400',
            status === 'failed' && 'bg-red-500/10 text-red-400')}
        >
          <StatusIcon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} aria-hidden />
          {status}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[var(--vibe-text-muted,#9a9a9a)] transition-transform',
            open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <>
          <ToolContent>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--vibe-text-faint,#6f6f6f)]">
              Input
            </p>
            <ToolInput>{inputText}</ToolInput>
          </ToolContent>
          <ToolContent className="border-t border-[var(--vibe-border,rgb(255_255_255/0.09))]">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--vibe-text-faint,#6f6f6f)]">
              Output
            </p>
            <ToolOutput failed={status === 'failed'}>{outputText}</ToolOutput>
          </ToolContent>
        </>
      ): null}
    </div>
  );
}

export function ToolContent({
  children,
  className,...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={cn('px-3 py-2', className)} {...props}>
      {children}
    </div>
  );
}

export function ToolInput({
  children,
  className,...props
}: React.HTMLAttributes<HTMLPreElement>): React.ReactElement {
  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-[var(--vibe-text-muted,#9a9a9a)]',
        className)}
      {...props}
    >
      {children}
    </pre>
  );
}

export function ToolOutput({
  children,
  failed = false,
  className,...props
}: React.HTMLAttributes<HTMLPreElement> & { failed?: boolean }): React.ReactElement {
  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre-wrap text-[11px]',
        failed ? 'text-red-300': 'text-[var(--vibe-text-muted,#9a9a9a)]',
        className)}
      {...props}
    >
      {children}
    </pre>
  );
}
