/**
 * Single config-merge module (D54).
 * Precedence: platform → tenant → agent → embed → runtime (later wins).
 */
import {
  CANVAS_POLICY_PRESET_DEFAULTS,
  FRAMEWORK_DEFAULT_CANVAS_POLICY,
  warnUnknownCanvasPolicyFields,
  type CanvasPolicyInput,
  type ResolvedCanvasPolicy,
} from './canvasPolicyTypes';

export interface CanvasConfigLayerInput {
  canvasPolicy?: CanvasPolicyInput;
}

export interface CanvasConfigLayers {
  platform?: CanvasConfigLayerInput;
  tenant?: CanvasConfigLayerInput;
  agent?: CanvasConfigLayerInput;
  embed?: CanvasConfigLayerInput;
  runtime?: CanvasConfigLayerInput;
}

export interface MergedCanvasConfig {
  canvasPolicy: ResolvedCanvasPolicy;
}

const LAYER_ORDER = ['platform', 'tenant', 'agent', 'embed', 'runtime'] as const;

type LayerKey = (typeof LAYER_ORDER)[number];

function layerCanvasPolicy(
  layers: CanvasConfigLayers,
  key: LayerKey,
): CanvasPolicyInput | undefined {
  return layers[key]?.canvasPolicy;
}

function applyGateOverrides(
  resolved: ResolvedCanvasPolicy,
  partial: CanvasPolicyInput,
): ResolvedCanvasPolicy {
  return {
    preset: resolved.preset,
    hitlOnCompose: partial.hitlOnCompose ?? resolved.hitlOnCompose,
    autoPin: partial.autoPin ?? resolved.autoPin,
    region: partial.region ?? resolved.region,
    allowDelete: partial.allowDelete ?? resolved.allowDelete,
    toolset: partial.toolset ?? resolved.toolset,
    allowCodePreview: partial.allowCodePreview ?? resolved.allowCodePreview,
  };
}

/**
 * Merge `canvasPolicy` across standard config layers.
 * Preset changes re-base gate defaults; explicit gates override the active preset.
 */
export function mergeCanvasPolicy(layers: CanvasConfigLayers): ResolvedCanvasPolicy {
  let resolved: ResolvedCanvasPolicy = { ...FRAMEWORK_DEFAULT_CANVAS_POLICY };

  for (const layerKey of LAYER_ORDER) {
    const partial = layerCanvasPolicy(layers, layerKey);
    if (!partial) {
      continue;
    }
    warnUnknownCanvasPolicyFields(partial, layerKey);

    if (partial.preset !== undefined) {
      const presetDefaults = CANVAS_POLICY_PRESET_DEFAULTS[partial.preset];
      resolved = {
        preset: partial.preset,
        ...presetDefaults,
      };
    }

    resolved = applyGateOverrides(resolved, partial);
  }

  return resolved;
}

/** Merge all supported canvas config slices. Extend here as new D54 keys land. */
export function mergeCanvasConfig(layers: CanvasConfigLayers): MergedCanvasConfig {
  return {
    canvasPolicy: mergeCanvasPolicy(layers),
  };
}

/** Platform layer — framework default stays guarded (D50, D61). */
export const PLATFORM_CANVAS_CONFIG_LAYER: CanvasConfigLayerInput = {
  canvasPolicy: { preset: 'guarded' },
};
