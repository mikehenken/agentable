import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ModeOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface ModeSelectorProps {
  value: string;
  options: ModeOption[];
  onChange: (modeId: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Header operator mode dropdown — mirrors ModelSelector (NAS agent parity). */
export function ModeSelector({
  value,
  options,
  onChange,
  disabled = false,
  className,
}: ModeSelectorProps): React.ReactElement {
  const selected = options.find((opt) => opt.id === value) ?? options[0];

  return (
    <div className={cn('relative shrink-0', className)} data-testid="operator-mode-selector">
      <label className="sr-only" htmlFor="operator-mode-select">
        Mode
      </label>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
        ▾
      </div>
      <select
        id="operator-mode-select"
        part="mode-switcher"
        value={selected?.id ?? value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'mode-switcher operator-mode-switcher appearance-none rounded-md border py-1 pl-2 pr-7 text-[11px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vibe-accent,#ff6b57)]',
          disabled && 'opacity-50')}
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
