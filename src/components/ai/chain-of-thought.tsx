import { useEffect, useState, type ReactElement } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Wrench, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatToolCallLabel } from '../../chat/toolCallLabels';

export type OperatorToolStatus = 'running' | 'succeeded' | 'failed';

export interface ChainOfThoughtStep {
  id: string;
  toolName: string;
  status: OperatorToolStatus;
  inputSummary?: string;
  resultSummary?: string;
}

export interface ChainOfThoughtProps {
  title?: string;
  steps: readonly ChainOfThoughtStep[];
  defaultOpen?: boolean;
  className?: string;
}

function StepStatusIcon({ status }: { status: OperatorToolStatus }): ReactElement {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" aria-hidden />;
  }
  if (status === 'failed') {
    return <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
}

function isTerminal(status: OperatorToolStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

/** Collapsible operator tool execution thread (shadcn AI Chain of Thought pattern). */
export function ChainOfThought({
  title = 'Tool activity',
  steps,
  defaultOpen,
  className,
}: ChainOfThoughtProps): ReactElement {
  const complete = steps.length > 0 && steps.every((step) => isTerminal(step.status));
  const [open, setOpen] = useState(() => (defaultOpen !== undefined ? defaultOpen : !complete));
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (defaultOpen !== undefined) {
      return;
    }
    if (complete) {
      setOpen(false);
    }
  }, [complete, defaultOpen]);

  if (steps.length === 0) {
    return <></>;
  }

  return (
    <div
      data-testid="operator-chain-of-thought"
      className={cn(
        'rounded-md border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)]',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open ? 'true' : 'false'}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--vibe-text-muted,#9a9a9a)]"
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench size={13} className="shrink-0" />
        <span className="flex-1 font-medium text-[var(--vibe-text,#ececec)]">{title}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform', open ? 'rotate-180' : 'rotate-0')}
        />
      </button>
      {open ? (
        <div className="space-y-1 border-t border-[var(--vibe-border,rgb(255_255_255/0.09))] px-2 py-2">
          {steps.map((step) => {
            const expanded = expandedStepId === step.id;
            const summary =
              step.resultSummary ??
              formatToolCallLabel(step.toolName, {}, step.status !== 'failed');
            return (
              <div key={step.id} className="rounded px-2 py-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-[11px] text-[var(--vibe-text-muted,#9a9a9a)]"
                  onClick={() =>
                    setExpandedStepId((current) => (current === step.id ? null : step.id))
                  }
                >
                  <StepStatusIcon status={step.status} />
                  <span className="flex-1 truncate text-[var(--vibe-text,#ececec)]">
                    {step.toolName}
                  </span>
                  <span className="truncate">{summary}</span>
                </button>
                {expanded && step.inputSummary ? (
                  <pre className="mt-1 overflow-x-auto rounded bg-black/20 p-2 text-[10px] text-[var(--vibe-text-faint,#6f6f6f)]">
                    {step.inputSummary}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export interface ToolCallCardProps {
  toolName: string;
  ok: boolean;
  args?: Record<string, unknown>;
}

/** Single tool call card for operator transcript rows. */
export function ToolCallCard({ toolName, ok, args = {} }: ToolCallCardProps): ReactElement {
  return (
    <div
      data-testid="operator-tool-call"
      className="rounded-md border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2 text-[var(--vibe-text,#ececec)]">
        <Wrench size={13} className="text-[var(--vibe-text-muted,#9a9a9a)]" />
        <span className="font-medium">{toolName}</span>
        <span className={ok ? 'text-emerald-400' : 'text-red-400'}>
          {ok ? 'succeeded' : 'failed'}
        </span>
      </div>
      <p className="mt-1 text-[var(--vibe-text-muted,#9a9a9a)]">
        {formatToolCallLabel(toolName, args, ok)}
      </p>
    </div>
  );
}
