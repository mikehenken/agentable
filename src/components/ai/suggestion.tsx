import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SuggestionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Suggestions({
  children,
  className,...props
}: SuggestionsProps): React.ReactElement {
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)} {...props}>
      {children}
    </div>
  );
}

export interface SuggestionProps {
  suggestion: string;
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function Suggestion({
  suggestion,
  onSelect,
  className,
}: SuggestionProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className={cn(
        'operator-suggestion-chip rounded-full border px-3 py-1.5 text-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
        className)}
    >
      {suggestion}
    </button>
  );
}
