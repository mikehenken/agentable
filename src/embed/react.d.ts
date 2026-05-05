/**
 * JSX type augmentation for React 19+ hosts.
 *
 * Lets host apps write `<agentable-canvas tenant="acme" ...>` and
 * `<voice-call-button variant="hero" />` directly inside TSX with full
 * type safety on attributes and event listeners.
 *
 * Usage in a React 19 host:
 *
 *     // somewhere in your app once (side-effect import registers the
 *     // custom elements with the browser):
 *     import 'agentable-canvas/embed/canvas';
 *     import 'agentable-canvas/embed/voice-call-button';
 *
 *     // then use the elements as JSX:
 *     <agentable-canvas
 *       tenant="acme"
 *       primary-color="#3B82F6"
 *       welcome-message="Hi! How can I help?"
 *     />
 *     <voice-call-button variant="hero">Talk to AI</voice-call-button>
 *
 * Pre-React-19 hosts: use a `@lit/react` wrapper instead. Not shipped today.
 */

import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { AgentableCanvasElement } from './agentable-canvas';
import type { VoiceCallButtonElement, VoiceCallButtonEventMap } from './voice-call-button';

type AgentableCanvasJSXProps = DetailedHTMLProps<
  HTMLAttributes<AgentableCanvasElement> & {
    tenant?: string;
    'primary-color'?: string;
    'welcome-message'?: string;
    'api-endpoint'?: string;
    'voice-enabled'?: boolean;
    'snap-grid'?: boolean;
  },
  AgentableCanvasElement
>;

type VoiceCallButtonJSXProps = DetailedHTMLProps<
  HTMLAttributes<VoiceCallButtonElement> & {
    variant?: 'nav' | 'hero';
    disabled?: boolean;
    /**
     * React 19 forwards all `oncamelcase` props to addEventListener under
     * the lowercased name. Custom events with colons (e.g. `landi:call-started`)
     * need the literal string form below.
     */
    'onlandi:call-started'?: (e: VoiceCallButtonEventMap['landi:call-started']) => void;
    'onlandi:call-ended'?: (e: VoiceCallButtonEventMap['landi:call-ended']) => void;
    'onlandi:call-state-changed'?: (
      e: VoiceCallButtonEventMap['landi:call-state-changed']
    ) => void;
    'onlandi:call-error'?: (e: VoiceCallButtonEventMap['landi:call-error']) => void;
  },
  VoiceCallButtonElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agentable-canvas': AgentableCanvasJSXProps;
      'voice-call-button': VoiceCallButtonJSXProps;
    }
  }
}

export {};
