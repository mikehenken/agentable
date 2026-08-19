import * as React from 'react';
import { ArrowUp, Loader2, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AgentChatStatus } from './types';

export interface PromptInputProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit: () => void;
  children: React.ReactNode;
}

/** NAS-parity compound prompt input shell (shadcn.io/ai). */
export function PromptInput({
  onSubmit,
  children,
  className,...props
}: PromptInputProps): React.ReactElement {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={cn(
        'operator-prompt-input rounded-xl border shadow-sm transition-colors',
        className)}
      {...props}
    >
      {children}
    </form>
  );
}

export interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onEnterSubmit?: () => void;
}

export function PromptInputTextarea({
  className,
  onEnterSubmit,
  onKeyDown,...props
}: PromptInputTextareaProps): React.ReactElement {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  const autosize = React.useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }
  }, []);

  React.useEffect(() => {
    autosize();
  }, [autosize, props.value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      onInput={autosize}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.shiftKey && onEnterSubmit) {
          event.preventDefault();
          onEnterSubmit();
        }
        onKeyDown?.(event);
      }}
      className={cn(
        'w-full resize-none bg-transparent px-3 py-2.5 pb-2.5 text-sm outline-none',
        'min-h-[2.75rem] leading-[1.45]',
        'text-[var(--vibe-text,#ececec)] placeholder:text-[var(--vibe-text-muted,#9a9a9a)]',
        className)}
      {...props}
    />
  );
}

export interface PromptInputToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputToolbar({
  children,
  className,...props
}: PromptInputToolbarProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-[var(--vibe-border,rgb(255_255_255/0.09))] px-2 py-1.5',
        className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PromptInputSubmitProps {
  status: AgentChatStatus;
  disabled?: boolean;
  className?: string;
  /** When set, busy state shows a clickable Stop control instead of a disabled spinner. */
  onStop?: () => void;
}

export function PromptInputSubmit({
  status,
  disabled = false,
  className,
  onStop,
}: PromptInputSubmitProps): React.ReactElement {
  const busy = status === 'submitted' || status === 'streaming';

  if (busy && onStop) {
    return (
      <button
        type="button"
        part="composer-stop"
        aria-label="Stop generating"
        onClick={(event) => {
          event.preventDefault();
          onStop();
        }}
        className={cn(
          'ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white',
          'bg-[linear-gradient(135deg,var(--vibe-accent,#ff6b57)_0%,var(--vibe-accent-2,#ff8f6b)_100%)]',
          'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
          className)}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    );
  }

  if (busy) {
    return (
      <button
        type="button"
        disabled
        aria-label="Generating response"
        className={cn(
          'ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white',
          'bg-[linear-gradient(135deg,var(--vibe-accent,#ff6b57)_0%,var(--vibe-accent-2,#ff8f6b)_100%)]',
          'disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
          className)}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  return (
    <button
      type="submit"
      part="composer-submit"
      disabled={disabled}
      aria-label="Send message"
      className={cn(
        'ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-white',
        'bg-[linear-gradient(135deg,var(--vibe-accent,#ff6b57)_0%,var(--vibe-accent-2,#ff8f6b)_100%)]',
        'hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
        className)}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
