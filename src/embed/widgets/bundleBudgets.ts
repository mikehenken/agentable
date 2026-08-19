/**
 * Declared gzip budgets for widget embed bundles.
 * Enforced by `scripts/check-bundle-size.mjs` and unit-tested here.
 */
export interface WidgetBundleBudget {
  /** Path under `dist/` */
  readonly file: string;
  readonly maxBytes: number;
  readonly label: string;
}

const KB = 1024;

export const WIDGET_BUNDLE_BUDGETS: readonly WidgetBundleBudget[] = [
  { file: 'embed/voice-call-button.js', maxBytes: 40 * KB, label: 'ESM' },
  { file: 'embed/voice-call-button.umd.js', maxBytes: 60 * KB, label: 'UMD' },
  { file: 'embed/agentable-starter-chip.js', maxBytes: 28 * KB, label: 'ESM' },
  { file: 'embed/agentable-starter-chip.umd.js', maxBytes: 40 * KB, label: 'UMD' },
  { file: 'embed/ask-about-this-button.js', maxBytes: 28 * KB, label: 'ESM' },
  { file: 'embed/ask-about-this-button.umd.js', maxBytes: 40 * KB, label: 'UMD' },
  { file: 'embed/agent-status-pill.js', maxBytes: 28 * KB, label: 'ESM' },
  { file: 'embed/agent-status-pill.umd.js', maxBytes: 40 * KB, label: 'UMD' },
] as const;

export const WIDGET_BUNDLE_FILE_BASES = [
  'voice-call-button',
  'agentable-starter-chip',
  'ask-about-this-button',
  'agent-status-pill',
] as const;
