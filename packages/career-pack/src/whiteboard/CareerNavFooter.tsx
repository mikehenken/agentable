import { PhoneOff, Settings } from 'lucide-react';
import type { ReactElement } from 'react';

export interface CareerNavFooterProps {
  voiceActive?: boolean;
  onEndCall?: () => void;
  onOpenSettings?: () => void;
  collapsed?: boolean;
}

/** Voice waveform bars (decorative — Moss/Sandals nav rail footer). */
function VoiceWaveform(): ReactElement {
  const heights = [6, 12, 8, 14, 10, 16, 9, 13];
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
      {heights.map((h, index) => (
        <span
          key={index}
          className="w-0.5 rounded-full bg-canvas-primary animate-pulse"
          style={{ height: h, animationDelay: `${index * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function CareerNavFooter({
  voiceActive = false,
  onEndCall,
  onOpenSettings,
  collapsed = false,
}: CareerNavFooterProps): ReactElement {
  return (
    <div
      className="border-t border-canvas-border bg-canvas-surface-subtle/50"
      data-testid="career-nav-footer"
    >
      {voiceActive ? (
        <div className={`px-3 py-2.5 ${collapsed ? 'flex flex-col items-center gap-2': ''}`}>
          {!collapsed ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">
              Voice conversation
            </p>
          ): null}
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col': ''}`}>
            <VoiceWaveform />
            {!collapsed ? (
              <span className="text-[11px] text-canvas-muted flex-1 truncate">Sandy is listening…</span>
            ): null}
            <button
              type="button"
              onClick={onEndCall}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
              aria-label="End call"
            >
              <PhoneOff size={13} />
              {!collapsed ? 'End Call': null}
            </button>
          </div>
        </div>
      ): null}
      <div className={`px-2 py-2 ${collapsed ? 'flex justify-center': ''}`}>
        <button
          type="button"
          onClick={onOpenSettings}
          className={`flex items-center gap-2 w-full rounded-lg text-[13px] text-canvas-muted hover:bg-canvas-primary-tint hover:text-canvas-primary transition-colors ${
            collapsed ? 'justify-center px-0 py-2': 'px-3 py-2'
          }`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={18} />
          {!collapsed ? <span>Settings</span>: null}
        </button>
      </div>
    </div>
  );
}
