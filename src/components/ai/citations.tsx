import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Citation {
  id: string;
  title: string;
  href?: string;
  snippet?: string;
}

export interface CitationsProps extends React.HTMLAttributes<HTMLDivElement> {
  citations: readonly Citation[];
}

export function Citations({
  citations,
  className,...props
}: CitationsProps): React.ReactElement {
  if (citations.length === 0) {
    return <></>;
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] text-xs',
        className)}
      data-testid="operator-citations"
      {...props}
    >
      <div className="border-b border-[var(--vibe-border,rgb(255_255_255/0.09))] px-3 py-2 font-medium text-[var(--vibe-text,#ececec)]">
        Sources
      </div>
      <ul className="divide-y divide-[var(--vibe-border,rgb(255_255_255/0.09))]">
        {citations.map((citation) => (
          <li key={citation.id} className="px-3 py-2">
            {citation.href ? (
              <a
                href={citation.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:underline"
              >
                {citation.title}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ): (
              <span className="text-[var(--vibe-text,#ececec)]">{citation.title}</span>
            )}
            {citation.snippet ? (
              <p className="mt-1 text-[var(--vibe-text-muted,#9a9a9a)]">{citation.snippet}</p>
            ): null}
          </li>
        ))}
      </ul>
    </div>
  );
}
