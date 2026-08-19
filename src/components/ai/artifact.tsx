import * as React from 'react';
import { FileCode2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ArtifactProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  language?: string;
  content?: string;
}

export function Artifact({
  title,
  description,
  language,
  content,
  className,...props
}: ArtifactProps): React.ReactElement {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] text-xs',
        className)}
      data-testid="operator-artifact"
      {...props}
    >
      <div className="flex items-center gap-2 border-b border-[var(--vibe-border,rgb(255_255_255/0.09))] px-3 py-2">
        <FileCode2 className="h-3.5 w-3.5 text-[var(--vibe-text-muted,#9a9a9a)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--vibe-text,#ececec)]">{title}</p>
          {description ? (
            <p className="truncate text-[var(--vibe-text-muted,#9a9a9a)]">{description}</p>
          ): null}
        </div>
        {language ? (
          <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--vibe-text-muted,#9a9a9a)]">
            {language}
          </span>
        ): null}
      </div>
      {content ? (
        <pre className="max-h-48 overflow-auto px-3 py-2 font-mono text-[11px] text-[var(--vibe-text-muted,#9a9a9a)]">
          {content}
        </pre>
      ): null}
    </div>
  );
}
