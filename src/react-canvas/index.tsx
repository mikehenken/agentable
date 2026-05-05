/**
 * Pure-React canvas export (Embed mode C).
 *
 * Exposes `<CanvasShell>` directly, with no Lit shell wrapping it. The host's
 * React copy renders the canvas straight into the host's DOM tree — no
 * Shadow DOM, no double React bundle, no Tailwind-pierce problems.
 *
 * Use this when:
 *  - The host is React 19 and willing to add React + Tailwind as peer deps
 *  - You want a single React copy on the page (smaller bundle)
 *  - You want CopilotKit's `<CopilotKit>` provider to wrap the canvas
 *    directly (M3 integration)
 *
 * Skip this (use `agentable-canvas/react` instead) when:
 *  - The host is Vue / Angular / plain HTML
 *  - The host wants Shadow DOM isolation
 *
 * Required CSS: import `agentable-canvas/styles.css` from the host so
 * Tailwind utility classes used inside the canvas resolve. (When the canvas
 * runs inside the Lit shell, those classes are scoped to Shadow DOM via the
 * embed bundle's CSS; when running purely in React, they need to live in the
 * host's document `<head>`.)
 */

// Side-effect: install the shared voice-state kernel on `window.__voiceKernel__`
// so a parallel `<voice-call-button>` (or any kernel subscriber) can drive the
// call without timing risk.
import { ensureVoiceKernel } from '../shared/voiceKernel';
ensureVoiceKernel();

export { CanvasShell, type CanvasShellProps } from '../canvas/CanvasShell';
export {
  CanvasProvider,
  useCanvasConfig,
  type CanvasPersona,
  type CanvasTenantConfig,
  type CanvasPanelData,
  type PartialCanvasTenantConfig,
  type CanvasProviderProps,
} from '../canvas/CanvasContext';
// Public panel data shapes — consumers passing tenant data via
// `<CanvasShell config.panelData.*>` import these to type their data
// arrays correctly.
export type { Job, DeptTone } from '../canvas/OpenPositionsPanel';
export type {
  Application,
  StageEvent,
  StatusTone,
} from '../canvas/ApplicationsPanel';
export type {
  Path as GrowthPath,
  Milestone as GrowthPathMilestone,
  LevelKey as GrowthPathLevelKey,
} from '../canvas/GrowthPathsPanel';
export type {
  Resource,
  ResourceTone,
} from '../canvas/ResourcesPanel';
// Tone gradient tokens — needed by tenants constructing GrowthPath
// data with gradient backgrounds matching the canvas's tone palette.
export { TONE_GRADIENT, type ToneKey } from '../canvas/toneTokens';
// Re-export voice-kernel surface so React hosts can subscribe to it without
// reaching into `agentable-canvas/src/shared/...` (which is internal).
export {
  ensureVoiceKernel,
  getVoiceKernel,
  installVoiceKernel,
  type VoiceState,
  type VoiceKernelSnapshot,
  type VoiceController,
  type VoiceKernel,
} from '../shared/voiceKernel';
// First-class React hook + label resolver for voice-driven CTAs.
export {
  useVoiceCall,
  defaultVoiceLabel,
  type UseVoiceCallResult,
} from './useVoiceCall';
