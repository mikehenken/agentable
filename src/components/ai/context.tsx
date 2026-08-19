import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ContextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tokens consumed in the current turn or session. */
  usedTokens: number;
  /** Maximum context window size. */
  maxTokens: number;
  label?: string;
}

/** Context window usage meter (shadcn.io/ai Context pattern). */
export function Context({
  usedTokens,
  maxTokens,
  label = 'Context',
  className,...props
}: ContextProps): React.ReactElement {
  const safeMax = maxTokens > 0 ? maxTokens: 1;
  const ratio = Math.min(1, Math.max(0, usedTokens / safeMax));
  const percent = Math.round(ratio * 100);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] px-3 py-2 text-xs',
        className)}
      data-testid="operator-context"
      {...props}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[var(--vibe-text-muted,#9a9a9a)]">
        <span className="font-medium text-[var(--vibe-text,#ececec)]">{label}</span>
        <span>
          {usedTokens.toLocaleString()} {safeMax.toLocaleString()} ({percent}%)
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-black/30"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={usedTokens}
        aria-label={`${label} usage`}
      >
        <div
          className="h-full rounded-full bg-[var(--vibe-accent,#ff6b57)] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
