/**
 * Canvas authoring policy.
 * `guarded` is the framework default; hosts opt into `open` explicitly.
 */

export type CanvasPolicyPreset = 'guarded' | 'open';

export type CanvasPolicyRegion = 'frame' | 'bounded' | 'unbounded';

export type CanvasPolicyToolset = 'draw' | 'authoring-full';

/** Partial policy input from any config layer. */
export interface CanvasPolicyInput {
  preset?: CanvasPolicyPreset;
  hitlOnCompose?: boolean;
  autoPin?: boolean;
  region?: CanvasPolicyRegion;
  allowDelete?: boolean;
  toolset?: CanvasPolicyToolset;
 /** Off by default; P14 code-preview tier. */
  allowCodePreview?: boolean;
}

/** Fully resolved policy after preset + per-gate merge. */
export interface ResolvedCanvasPolicy {
  preset: CanvasPolicyPreset;
  hitlOnCompose: boolean;
  autoPin: boolean;
  region: CanvasPolicyRegion;
  allowDelete: boolean;
  toolset: CanvasPolicyToolset;
  allowCodePreview: boolean;
}

export const CANVAS_POLICY_PRESET_DEFAULTS: Record<
  CanvasPolicyPreset,
  Omit<ResolvedCanvasPolicy, 'preset'>
> = {
  guarded: {
    hitlOnCompose: true,
    autoPin: false,
    region: 'frame',
    allowDelete: false,
    toolset: 'draw',
    allowCodePreview: false,
  },
  open: {
    hitlOnCompose: false,
    autoPin: true,
    region: 'unbounded',
    allowDelete: true,
    toolset: 'authoring-full',
    allowCodePreview: false,
  },
};

export const FRAMEWORK_DEFAULT_CANVAS_POLICY: ResolvedCanvasPolicy = {
  preset: 'guarded',
  ...CANVAS_POLICY_PRESET_DEFAULTS.guarded,
};

export function isOpenCanvasPolicy(policy: ResolvedCanvasPolicy): boolean {
  return policy.preset === 'open';
}

const KNOWN_CANVAS_POLICY_KEYS = new Set<string>([
  'preset',
  'hitlOnCompose',
  'autoPin',
  'region',
  'allowDelete',
  'toolset',
  'allowCodePreview',
]);

/** Warn on unknown canvasPolicy fields (web-components rule). */
export function warnUnknownCanvasPolicyFields(
  input: CanvasPolicyInput | undefined,
  source: string,
): void {
  if (!input || typeof input !== 'object') {
    return;
  }
  // Read via globalThis so browser-only programs typecheck without @types/node.
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.NODE_ENV;
  if (nodeEnv === 'production') {
    return;
  }
  for (const key of Object.keys(input)) {
    if (!KNOWN_CANVAS_POLICY_KEYS.has(key)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[canvasPolicy] Unknown field "${key}" in ${source}; ignored.`,
      );
    }
  }
}
