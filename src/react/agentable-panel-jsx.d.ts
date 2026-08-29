/**
 * JSX type augmentation for the `<agentable-panel>` custom element so the
 * React wrapper (and React 19+ hosts) can render it directly in TSX.
 * Follows the same pattern as `src/embed/react.d.ts`.
 */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { AgentablePanelElement } from '../embed/agentable-panel';

type AgentablePanelJSXProps = DetailedHTMLProps<
  HTMLAttributes<AgentablePanelElement> & {
    panel?: string;
    tenant?: string;
    'primary-color'?: string;
    'welcome-message'?: string;
    'api-endpoint'?: string;
    'anon-key'?: string;
    'config-path'?: string;
    'voice-enabled'?: boolean;
    'snap-grid'?: boolean;
    'system-prompt'?: string;
    'voice-greeting'?: string;
    'voice-greeting-mode'?: string;
    'token-endpoint'?: string;
    locale?: string;
    'config-url'?: string;
    'panel-data-url'?: string;
    'panel-title'?: string;
    'hide-chrome'?: boolean;
    'slot-name'?: string;
    'lazy-hydrate'?: boolean;
    'data-skip-react-mount'?: boolean;
  },
  AgentablePanelElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agentable-panel': AgentablePanelJSXProps;
    }
  }
}

export {};
