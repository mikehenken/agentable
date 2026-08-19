/**
 * Professional dark gallery header for example 13.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CURRENT_GALLERY_EXAMPLE_ID,
  GALLERY_EXAMPLES,
  type FloatingPreset,
} from './galleryExamples';

export interface GalleryDemoHeaderProps {
  initialFloatingVisible?: boolean;
  initialFloatingPreset?: FloatingPreset;
}

function readStoredFloatingVisible(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem('p13-operator-floating-visible') === '1';
}

function readStoredFloatingPreset(): FloatingPreset {
  if (typeof window === 'undefined') {
    return 'bottom-left';
  }
  const raw = window.localStorage.getItem('p13-operator-floating-preset');
  if (raw === 'bottom-right' || raw === 'top-right' || raw === 'bottom-left') {
    return raw;
  }
  return 'bottom-left';
}

export function GalleryDemoHeader({
  initialFloatingVisible,
  initialFloatingPreset,
}: GalleryDemoHeaderProps): ReactElement {
  const [floatingVisible, setFloatingVisible] = useState<boolean>(
    () => initialFloatingVisible ?? readStoredFloatingVisible(),
  );
  const [floatingPreset, setFloatingPreset] = useState<FloatingPreset>(
    () => initialFloatingPreset ?? readStoredFloatingPreset(),
  );
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('gallery:floating-state', {
        detail: { visible: floatingVisible, preset: floatingPreset },
      }),
    );
  }, [floatingVisible, floatingPreset]);

  const handleNavigate = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }, []);

  const handlePreset = useCallback((preset: FloatingPreset) => {
    setFloatingPreset(preset);
    window.dispatchEvent(
      new CustomEvent('gallery:floating-preset', { detail: { preset } }),
    );
  }, []);

  const handleFloatingToggle = useCallback(() => {
    setFloatingVisible((current) => {
      const next = !current;
      window.dispatchEvent(
        new CustomEvent('gallery:floating-toggle', { detail: { visible: next } }),
      );
      return next;
    });
  }, []);

  const currentExample =
    GALLERY_EXAMPLES.find((entry) => entry.id === CURRENT_GALLERY_EXAMPLE_ID) ??
    GALLERY_EXAMPLES[GALLERY_EXAMPLES.length - 1];

  return (
    <header
      data-testid="gallery-demo-header"
      className={cn(
        'flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3',
        'border-[rgb(255_255_255/0.09)] bg-[#0b1220] text-[#ececec]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[#1a2438] text-xs font-bold text-[#e7ecf3]"
        >
          ML
        </div>
        <h1 className="truncate text-[0.95rem] font-semibold tracking-wide text-[#f4f7fb]">
          Meridian Labs
        </h1>
        <div className="relative">
          <button
            type="button"
            data-testid="gallery-demo-switcher"
            aria-haspopup="listbox"
            aria-expanded={demoMenuOpen}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs',
              'border-[rgb(255_255_255/0.09)] bg-[#121212] text-[#9a9a9a]',
              'hover:text-[#ececec]',
            )}
            onClick={() => setDemoMenuOpen((open) => !open)}
          >
            {currentExample.label}
            <ChevronDown size={14} aria-hidden />
          </button>
          {demoMenuOpen ? (
            <ul
              role="listbox"
              className={cn(
                'absolute left-0 top-[calc(100%+4px)] z-50 max-h-64 min-w-[220px] overflow-auto rounded-md border py-1 shadow-lg',
                'border-[rgb(255_255_255/0.09)] bg-[#121212]',
              )}
            >
              {GALLERY_EXAMPLES.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={entry.id === CURRENT_GALLERY_EXAMPLE_ID}
                    className={cn(
                      'block w-full px-3 py-1.5 text-left text-xs',
                      entry.id === CURRENT_GALLERY_EXAMPLE_ID
                        ? 'bg-[#1a2438] text-[#ececec]'
                        : 'text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-[#ececec]',
                    )}
                    onClick={() => {
                      setDemoMenuOpen(false);
                      if (entry.id !== CURRENT_GALLERY_EXAMPLE_ID) {
                        handleNavigate(entry.path);
                      }
                    }}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div
        data-testid="gallery-floating-controls"
        className="flex flex-wrap items-center justify-end gap-2"
      >
        <div
          role="group"
          aria-label="Floating operator anchor"
          className={cn(
            'inline-flex overflow-hidden rounded-full border p-0.5',
            'border-[rgb(255_255_255/0.09)] bg-[#121212]',
          )}
        >
          {(['bottom-left', 'bottom-right', 'top-right'] as const).map((preset) => {
            const label = preset === 'bottom-left' ? 'BL' : preset === 'bottom-right' ? 'BR' : 'TR';
            const selected = floatingPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                data-testid={`floating-preset-${preset}`}
                aria-pressed={selected}
                title={preset.replace('-', ' ')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-colors',
                  selected
                    ? 'bg-[#1a2438] text-[#ececec]'
                    : 'text-[#9a9a9a] hover:text-[#ececec]',
                )}
                onClick={() => handlePreset(preset)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="floating-toggle"
          aria-pressed={floatingVisible}
          className={cn(
            'rounded-full border px-3 py-1 text-[0.72rem] font-medium transition-colors',
            'border-[rgb(255_255_255/0.09)] bg-[#121212]',
            floatingVisible
              ? 'border-[rgb(255_107_87/0.45)] text-[#ffb199]'
              : 'text-[#9a9a9a] hover:text-[#ececec]',
          )}
          onClick={handleFloatingToggle}
        >
          Floating operator
        </button>
      </div>
    </header>
  );
}
