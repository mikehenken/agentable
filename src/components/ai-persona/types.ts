/**
 * Reusable AI persona visual — shadcn.io/ai-inspired presence for chat + chrome.
 * Halo is CSS/SVG (no licensed Rive assets); additional `type` values can be added.
 *** Visual style family. Extensible string union. */
export type AiPersonaType = 'halo' | (string & {});

/**
 * Animation presence state driven by voice + chat lifecycle.
 * Mirrors the shadcn.io/ai Persona state set.
 */
export type AiPersonaState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'asleep'
  | (string & {});

/** Size presets for chat avatar vs header compact vs empty-state hero. */
export type AiPersonaSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Tenant config under `persona.visual`.
 * When omitted, hosts keep letter-initial avatars.
 */
export interface AiPersonaVisualConfig {
  /** Visual family — currently `halo` is implemented. */
  type: AiPersonaType;
  /** Show animated persona in chat empty state + assistant message avatars. */
  showInChat?: boolean;
  /** Show animated persona in TopBar Talk-to-* chrome. */
  showInHeader?: boolean;
}

export interface AiPersonaProps {
  /** Visual family. Default `halo`. */
  type?: AiPersonaType;
  /** Current presence state. Default `idle`. */
  state?: AiPersonaState;
  /** Size preset. Default `md`. */
  size?: AiPersonaSize;
  /**
   * Optional mic/output level 0..1 — modulates listening/speaking ring scale.
   * Ignored for idle asleep thinking.
   */
  level?: number;
  /** Accessible name (e.g. assistant name). */
  label?: string;
  /** Optional initial letter overlay (halo core). */
  initial?: string;
  className?: string;
  /** Test id for e2e unit queries. */
  'data-testid'?: string;
}
