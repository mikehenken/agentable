import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language,
  filename,
  showLineNumbers = false,
  className,...props
}: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [code]);

  const lines = code.split('\n');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-black/30 text-xs',
        className)}
      data-testid="operator-code-block"
      {...props}
    >
      <div className="flex items-center gap-2 border-b border-[var(--vibe-border,rgb(255_255_255/0.09))] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--vibe-text-muted,#9a9a9a)]">
          {filename ?? language ?? 'code'}
        </span>
        <button
          type="button"
          aria-label={copied ? 'Copied': 'Copy code'}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--vibe-text-muted,#9a9a9a)] hover:text-[var(--vibe-text,#ececec)]"
          onClick={() => void handleCopy}
        >
          {copied ? <Check size={13} />: <Copy size={13} />}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--vibe-text-muted,#9a9a9a)]">
        {showLineNumbers
          ? lines.map((line, index) => (
              <div key={`${index}-${line}`} className="flex gap-3">
                <span className="w-6 shrink-0 select-none text-right text-[var(--vibe-text-faint,#6f6f6f)]">
                  {index + 1}
                </span>
                <code>{line}</code>
              </div>
            )): code}
      </pre>
    </div>
  );
}
