import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ModelSelectorProps {
  value: string;
  options: ModelOption[];
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Header model dropdown — shadcn AI model-selector pattern (NAS agent parity). */
export function ModelSelector({
  value,
  options,
  onChange,
  disabled = false,
  className,
}: ModelSelectorProps): React.ReactElement {
  const selected = options.find((opt) => opt.id === value) ?? options[0];

  return (
    <div className={cn('relative shrink-0', className)} data-testid="operator-model-selector">
      <label className="sr-only" htmlFor="operator-model-select">
        Model
      </label>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
        ▾
      </div>
      <select
        id="operator-model-select"
        part="model-switcher"
        value={selected?.id ?? value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'model-switcher operator-model-switcher appearance-none rounded-md border py-1 pl-2 pr-7 text-[11px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
          disabled && 'opacity-50')}
        title={selected?.description}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id} disabled={opt.disabled === true}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
