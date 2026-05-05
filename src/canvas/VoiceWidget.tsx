import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';
import { useGeminiLive } from './voice/useGeminiLive';
import { useCanvasConfig } from './CanvasContext';

const BAR_COUNT = 32;

export function VoiceWidget() {
  const { panels, showPanel } = useLayoutStore();
  // Persona comes from the tenant config injected by the consuming wrapper.
  // OSS canvas core has zero tenant defaults.
  const { persona } = useCanvasConfig();
  const live = useGeminiLive({
    persona,
    mockScenario: persona.mockScenario,
  });
  const assistantName = persona.assistantName ?? 'Assistant';

  // Auto-open the voice panel when a call starts (via button OR parent event).
  useEffect(() => {
    if (live.state === 'connecting' || live.state === 'listening' || live.state === 'speaking') {
      if (!panels.voice?.visible) showPanel('voice');
    }
  }, [live.state, panels.voice?.visible, showPanel]);

  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => ({
        id: i,
        baseHeight: 4 + Math.sin(i * 0.5) * 8,
        phase: (i / BAR_COUNT) * Math.PI * 2,
      })),
    []
  );

  const layout = panels.voice;
  if (!layout?.visible) return null;

  const isSpeaking = live.state === 'speaking';
  const isListening = live.state === 'listening';
  const isConnecting = live.state === 'connecting';
  const isCallActive = isListening || isSpeaking || isConnecting;

  // Level drives amplitude: prefer output level while the agent is speaking,
  // otherwise mic input level while listening.
  const rawLevel = isSpeaking ? live.outputLevel : isListening ? live.inputLevel : 0;
  // Gentle curve so quiet speech still shows motion but loud speech doesn't clip.
  const level = Math.min(1, Math.pow(rawLevel, 0.6) * 3);

  const isError = live.state === 'error';
  const statusLabel = (() => {
    if (isError) return live.error ?? 'Voice transport error';
    if (isConnecting) return 'Connecting...';
    if (isSpeaking) return `${assistantName} is speaking`;
    if (isListening) return 'Listening';
    return 'Tap Start to begin voice conversation';
  })();
  // Honor user OS-level reduced-motion preference. happy-dom + jest-dom
  // tests stub matchMedia; in production this is a real query.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <DraggablePanel id="voice" title="Voice Conversation">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center gap-[2px] h-14 px-4 py-3">
          {bars.map((bar) => {
            // Envelope: bars near the middle move more than those at the edges.
            const edgeWeight = 1 - Math.abs(bar.id - BAR_COUNT / 2) / (BAR_COUNT / 2);
            const amplitude = level * 28 * (0.35 + 0.65 * edgeWeight);
            const targetHeight = isCallActive ? bar.baseHeight + amplitude : 4;
            // Reduced-motion: collapse the per-frame envelope to static
            // bars at base height so we don't pulse for users who asked
            // the OS not to. The bars stay visible (presence is
            // information) but stop animating.
            const finalHeight = prefersReducedMotion ? bar.baseHeight : targetHeight;
            return (
              <motion.div
                key={bar.id}
                className="w-[2px] rounded-full"
                animate={prefersReducedMotion ? false : { height: finalHeight }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                style={{
                  height: prefersReducedMotion ? bar.baseHeight : 4,
                  // Tokenized: red on error, accent color when assistant is
                  // speaking, primary brand color while listening. Falls back
                  // to canonical hexes so embeds without token overrides
                  // still render correctly.
                  background: isError
                    ? 'var(--landi-color-error, #EF4444)'
                    : isSpeaking
                    ? 'var(--landi-color-accent, #C9A227)'
                    : 'var(--landi-color-primary, #0D7377)',
                }}
              />
            );
          })}
        </div>

        <div className="px-4 pb-3">
          <p className="text-[10px] text-canvas-faint uppercase tracking-wider mb-1">
            {isError ? 'Error' : isSpeaking ? assistantName : isListening ? 'You' : 'Status'}
          </p>
          {isError ? (
            // Errors interrupt with `role="alert"` + assertive — the user
            // needs to know the call failed before any next-step copy.
            // AlertCircle icon converts the red color from "noise" into
            // semantic signal. Retry button restores agency: without it,
            // the only recovery path is a page refresh.
            <div role="alert" aria-live="assertive" className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm text-[#EF4444] font-medium">
                <AlertCircle size={14} aria-hidden="true" />
                <span className="truncate">{statusLabel}</span>
              </p>
              <button
                type="button"
                onClick={() => void live.start()}
                className="text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded"
                style={{
                  // Falls back to canvas brand teal when the token isn't
                  // overridden by the host. Tokenized so each embed picks
                  // up its own accent without forking the component.
                  color: 'var(--landi-color-primary, #0D7377)',
                  // Tailwind doesn't allow var() in `ring-` arbitrary values
                  // pre-v4; inline outlineColor mirrors the focus ring.
                  outlineColor: 'var(--landi-color-primary, #0D7377)',
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            <p
              className="text-sm italic truncate text-canvas-muted"
              // Non-error transitions are polite — they queue politely
              // behind any in-flight speech instead of interrupting.
              role="status"
              aria-live="polite"
            >
              {statusLabel}
              {live.lastTranscript && isSpeaking ? ` — ${live.lastTranscript}` : ''}
            </p>
          )}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={() => void live.toggle()}
            disabled={!live.available || isConnecting}
            className="flex-1 py-2 rounded-lg border border-canvas-border text-sm font-medium text-canvas-muted hover:bg-canvas-surface-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCallActive ? 'End' : isConnecting ? 'Connecting…' : 'Start'}
          </button>
          <button
            onClick={() => void live.stop()}
            disabled={!isCallActive}
            className="flex-1 py-2 rounded-lg bg-[#1A1A1A] text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            End Call
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}
