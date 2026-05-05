/**
 * WhiteboardTopBar — slim chrome strip at the top of the whiteboard
 * route. Hosts:
 *   - Persona title ("{assistantName} · {tenantTitle}")
 *   - VoiceChip (always-visible voice CTA)
 *   - Maximize button (toggle document fullscreen)
 *
 * Sits above the chat-column / tldraw grid so its real estate is fixed,
 * never panned. Distinct from the legacy canvas's `<TopBar>` which
 * floats over absolute-positioned panels — this one renders inline.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCanvasConfig } from '../../canvas/CanvasContext';
import { VoiceChip } from '../voice/VoiceChip';

export function WhiteboardTopBar(): ReactElement {
  const { persona } = useCanvasConfig();
  const assistantName = persona.assistantName ?? 'Assistant';
  const tenantTitle = persona.tenantTitle ?? 'AI Assistant';
  const isFullscreen = useFullscreenState();
  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      const target = document.documentElement;
      void target.requestFullscreen?.();
    }
  }, []);

  return (
    <header
      style={{
        height: 48,
        flex: '0 0 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--landi-color-border, #E5E5E0)',
        background: 'var(--landi-color-surface, #FFFFFF)',
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--landi-color-text, #1A1A1A)',
          minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--landi-color-on-primary, #FFFFFF)',
            background:
              'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 100%)',
          }}
        >
          {assistantName.charAt(0).toUpperCase() || 'A'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {assistantName} · {tenantTitle}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <VoiceChip />
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Maximize'}
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--landi-color-border, #E5E5E0)',
            borderRadius: 8,
            background: 'var(--landi-color-surface, #FFFFFF)',
            color: 'var(--landi-color-text-muted, #6B6B66)',
            cursor: 'pointer',
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </header>
  );
}

/** Subscribe to document.fullscreenElement so the icon flips correctly
 *  when the user exits via Esc (browser-driven, not via our button). */
function useFullscreenState(): boolean {
  const [isFs, setIsFs] = useState(() =>
    typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return isFs;
}
