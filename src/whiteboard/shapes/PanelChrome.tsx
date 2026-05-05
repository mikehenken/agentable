/**
 * PanelChrome — title bar rendered atop a panel shape's body.
 *
 * Important pointer-event policy:
 *   The title bar deliberately does NOT call `stopPropagation` on pointer
 *   events. Pointer events fall through to tldraw, so the user can grab the
 *   shape by its title and drag it. The body container (in `PanelShape.tsx`)
 *   is the layer that stops propagation — that's where the panel's
 *   interactive content lives.
 *
 * Buttons inside the title bar (close, minimise) DO stop propagation so the
 * click doesn't accidentally start a tldraw drag. They also call
 * `e.preventDefault()` to keep tldraw from initiating its own gesture
 * pipeline.
 */
import type { ReactElement } from 'react';
import { Minus, X } from 'lucide-react';
import { closePanelInCanvas, updatePanelProps } from './panelShapeApi';

export interface PanelChromeProps {
  panelId: string;
  /** Title text. Day 1 stub passes the panelId verbatim; Day 2 panels supply
   * a friendlier title via shape `data`. */
  title: string;
  minimized: boolean;
}

export function PanelChrome({ panelId, title, minimized }: PanelChromeProps): ReactElement {
  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px 0 12px',
        borderBottom: '1px solid var(--landi-color-border, #E5E5E0)',
        background: 'var(--landi-color-surface, #FAFAF7)',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--landi-color-text, #1A1A1A)',
        userSelect: 'none',
        cursor: 'grab',
        // No `pointer-events: none` — we want the title bar to be hoverable
        // by tldraw for drag selection. We also don't stopPropagation so
        // the drag actually works.
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <ChromeButton
          aria-label={minimized ? 'Restore panel' : 'Minimize panel'}
          onClick={() => updatePanelProps(panelId, { __minimized: !minimized })}
        >
          <Minus size={12} />
        </ChromeButton>
        <ChromeButton
          aria-label="Close panel"
          onClick={() => closePanelInCanvas(panelId)}
        >
          <X size={12} />
        </ChromeButton>
      </div>
    </div>
  );
}

interface ChromeButtonProps {
  'aria-label': string;
  onClick: () => void;
  children: ReactElement;
}

function ChromeButton(props: ChromeButtonProps): ReactElement {
  return (
    <button
      type="button"
      aria-label={props['aria-label']}
      onPointerDown={(e) => {
        // Prevent tldraw from starting a drag when the user clicks a chrome
        // button. Without this, the click would be swallowed by the drag
        // gesture and the close/minimise actions would never fire.
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--landi-color-text-muted, #6B6B66)',
        cursor: 'pointer',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'var(--landi-color-hover, rgba(0,0,0,0.05))';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {props.children}
    </button>
  );
}
