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
import { closePanelInCanvas, updatePanelChrome } from './panelShapeApi';

export interface PanelChromeProps {
  panelId: string;
  /** Title text. Day 1 stub passes the panelId verbatim; Day 2 panels supply
   * a friendlier title via shape `data`. */
  title: string;
  minimized: boolean;
}

export function PanelChrome({ panelId, title, minimized }: PanelChromeProps): ReactElement {
  return (
    <div className="panel-chrome" data-testid={`panel-chrome-${panelId}`}>
      <span className="panel-chrome__title">{title}</span>
      <div className="panel-chrome__actions">
        <ChromeButton
          aria-label={minimized ? 'Restore panel' : 'Minimize panel'}
          onClick={() => updatePanelChrome(panelId, { minimized: !minimized })}
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
      className="panel-chrome__btn"
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
    >
      {props.children}
    </button>
  );
}
