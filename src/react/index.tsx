/**
 * React wrappers for the OSS canvas + voice call button web components.
 *
 * Why this layer exists:
 *   - React 19 supports custom elements in JSX natively, but writing
 *     `<agentable-canvas primary-color="...">` everywhere is awkward
 *     (kebab-case attrs, no autocomplete on props, no typed event names).
 *   - This wrapper exposes camelCase props, typed events as `onCall*`
 *     callbacks, and registers the underlying custom elements via
 *     side-effect imports so consumers don't have to remember to do that.
 *
 * Usage in a React 19 host:
 *
 *     import { AgentableCanvas, VoiceCallButton } from 'agentable-canvas/react';
 *
 *     <AgentableCanvas
 *       tenant="acme"
 *       primaryColor="#3B82F6"
 *       welcomeMessage="Hi! How can I help?"
 *       voiceEnabled
 *     />
 *     <VoiceCallButton
 *       variant="hero"
 *       onCallStarted={(e) => console.log(e.detail)}
 *     >
 *       Talk to AI
 *     </VoiceCallButton>
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
// Side-effect: register custom elements with the browser.
import '../embed/agentable-canvas';
import '../embed/voice-call-button';
import type {
  VoiceCallButtonElement,
  VoiceCallButtonEventMap,
} from '../embed/voice-call-button';
import type { AgentableCanvasElement } from '../embed/agentable-canvas';

// ---------------------------------------------------------------------------
// AgentableCanvas
// ---------------------------------------------------------------------------

export interface AgentableCanvasProps {
  tenant?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  apiEndpoint?: string;
  voiceEnabled?: boolean;
  snapGrid?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function AgentableCanvas(props: AgentableCanvasProps) {
  return (
    <agentable-canvas
      tenant={props.tenant}
      primary-color={props.primaryColor}
      welcome-message={props.welcomeMessage}
      api-endpoint={props.apiEndpoint}
      voice-enabled={props.voiceEnabled}
      snap-grid={props.snapGrid}
      className={props.className}
      style={props.style}
    >
      {props.children}
    </agentable-canvas>
  );
}

// ---------------------------------------------------------------------------
// VoiceCallButton
// ---------------------------------------------------------------------------

export interface VoiceCallButtonProps {
  variant?: 'nav' | 'hero';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onCallStarted?: (e: VoiceCallButtonEventMap['landi:call-started']) => void;
  onCallEnded?: (e: VoiceCallButtonEventMap['landi:call-ended']) => void;
  onCallStateChanged?: (e: VoiceCallButtonEventMap['landi:call-state-changed']) => void;
  onCallError?: (e: VoiceCallButtonEventMap['landi:call-error']) => void;
}

export function VoiceCallButton(props: VoiceCallButtonProps) {
  const ref = useRef<VoiceCallButtonElement | null>(null);

  // Wire custom-event callbacks via addEventListener — React 19 does this
  // automatically for known synthetic events, but custom events with colons
  // need explicit handling. Refs over render to avoid stale-closure bugs.
  const handlersRef = useRef({
    onCallStarted: props.onCallStarted,
    onCallEnded: props.onCallEnded,
    onCallStateChanged: props.onCallStateChanged,
    onCallError: props.onCallError,
  });
  handlersRef.current = {
    onCallStarted: props.onCallStarted,
    onCallEnded: props.onCallEnded,
    onCallStateChanged: props.onCallStateChanged,
    onCallError: props.onCallError,
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onStart = (e: Event) =>
      handlersRef.current.onCallStarted?.(e as VoiceCallButtonEventMap['landi:call-started']);
    const onEnd = (e: Event) =>
      handlersRef.current.onCallEnded?.(e as VoiceCallButtonEventMap['landi:call-ended']);
    const onStateChange = (e: Event) =>
      handlersRef.current.onCallStateChanged?.(
        e as VoiceCallButtonEventMap['landi:call-state-changed']
      );
    const onError = (e: Event) =>
      handlersRef.current.onCallError?.(e as VoiceCallButtonEventMap['landi:call-error']);
    el.addEventListener('landi:call-started', onStart);
    el.addEventListener('landi:call-ended', onEnd);
    el.addEventListener('landi:call-state-changed', onStateChange);
    el.addEventListener('landi:call-error', onError);
    return () => {
      el.removeEventListener('landi:call-started', onStart);
      el.removeEventListener('landi:call-ended', onEnd);
      el.removeEventListener('landi:call-state-changed', onStateChange);
      el.removeEventListener('landi:call-error', onError);
    };
  }, []);

  return (
    <voice-call-button
      ref={ref}
      variant={props.variant}
      disabled={props.disabled}
      className={props.className}
      style={props.style}
    >
      {props.children}
    </voice-call-button>
  );
}

// Re-export types so consumers can type their event handlers strongly.
export type {
  AgentableCanvasElement,
  VoiceCallButtonElement,
  VoiceCallButtonEventMap,
};
