/**
 * VoiceChip — always-visible voice CTA pinned in the WhiteboardShell
 * top bar.
 *
 * Subscribes to `useVoiceCall()` (which subscribes to the global voice
 * kernel) so it reflects state across:
 *   - Calls started via this chip
 *   - Calls started by agent tools (e.g. open_chat → focus chat input,
 *     or any future tool that triggers a call)
 *   - Voice activity from a parallel `<voice-call-button>` web component
 *     elsewhere on the page (kernel is the single source of truth)
 *
 * Visual states:
 *   - idle:        muted mic icon + "Talk to {assistantName}" label
 *   - connecting:  spinner-ish dot + "Connecting…"
 *   - listening:   pulsing primary dot + "Listening" + level meter
 *   - speaking:    accent dot + "{name} is speaking" + level meter
 *   - error:       AlertCircle + "Try again"
 *
 * Click toggles the call. Disabled when `available: false` (no
 * transport / no API key).
 */
import type { ReactElement } from 'react';
import { AlertCircle, Mic, MicOff } from 'lucide-react';
import { useVoiceCall } from '../../react-canvas/useVoiceCall';
import { useCanvasConfig } from '../../canvas/CanvasContext';

export function VoiceChip(): ReactElement {
  const voice = useVoiceCall();
  const { persona } = useCanvasConfig();
  const assistantName = persona.assistantName ?? 'Assistant';
  const idleLabel = `Talk to ${assistantName}`;

  const isListening = voice.state === 'listening';
  const isSpeaking = voice.state === 'speaking';
  const isConnecting = voice.state === 'connecting';
  const isError = voice.state === 'error';

  const label = isError
    ? 'Try again'
    : isSpeaking
    ? `${assistantName} is speaking`
    : isListening
    ? 'Listening · End call'
    : isConnecting
    ? 'Connecting…'
    : idleLabel;

  // Level meter — gentle gamma curve so quiet speech still pulses but
  // loud speech doesn't clip the dot.
  const level = Math.min(1, Math.pow(voice.level, 0.6) * 3);

  // Color tokens:
  //   - error: red
  //   - speaking: accent (default gold)
  //   - listening: primary (default teal)
  //   - idle/connecting: muted
  const dotColor = isError
    ? 'var(--landi-color-error, #EF4444)'
    : isSpeaking
    ? 'var(--landi-color-accent, #C9A227)'
    : voice.isActive
    ? 'var(--landi-color-primary, #0D7377)'
    : 'var(--landi-color-text-muted, #6B6B66)';

  const Icon = isError ? AlertCircle : voice.isActive ? Mic : MicOff;
  const disabled = !voice.available && !isError;

  return (
    <button
      type="button"
      onClick={() => voice.toggle()}
      disabled={disabled}
      aria-label={label}
      title={voice.errorMessage ?? label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${
          voice.isActive
            ? 'var(--landi-color-primary, #0D7377)'
            : 'var(--landi-color-border, #E5E5E0)'
        }`,
        background: voice.isActive
          ? 'var(--landi-color-primary-tint, rgba(13, 115, 119, 0.08))'
          : 'var(--landi-color-surface, #FFFFFF)',
        color: 'var(--landi-color-text, #1A1A1A)',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 18,
          height: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: dotColor,
        }}
      >
        <Icon size={14} />
        {/* Level pulse — only visible while a call is active. The ring
            scales with the published mic/output level so the chip moves
            in time with the assistant's speech (or yours). */}
        {voice.isActive && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${dotColor}`,
              transform: `scale(${1 + level * 0.6})`,
              opacity: 0.35,
              transition: 'transform 0.08s linear',
              pointerEvents: 'none',
            }}
          />
        )}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}
