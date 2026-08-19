/**
 * — canvasPolicy merge precedence.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  mergeCanvasConfig,
  mergeCanvasPolicy,
  PLATFORM_CANVAS_CONFIG_LAYER,
} from '../../src/config/merge';
import {
  CANVAS_POLICY_PRESET_DEFAULTS,
  FRAMEWORK_DEFAULT_CANVAS_POLICY,
} from '../../src/config/canvasPolicyTypes';

describe('mergeCanvasPolicy — layer precedence', () => {
  it('framework platform default stays guarded with guarded gate defaults', () => {
    const policy = mergeCanvasPolicy({ platform: PLATFORM_CANVAS_CONFIG_LAYER });
    expect(policy).toEqual(FRAMEWORK_DEFAULT_CANVAS_POLICY);
    expect(policy.hitlOnCompose).toBe(true);
    expect(policy.toolset).toBe('draw');
  });

  it('tenant open overrides platform guarded ( studio path)', () => {
    const policy = mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: { canvasPolicy: { preset: 'open' } },
    });
    expect(policy.preset).toBe('open');
    expect(policy.hitlOnCompose).toBe(false);
    expect(policy.autoPin).toBe(true);
    expect(policy.region).toBe('unbounded');
    expect(policy.toolset).toBe('authoring-full');
  });

  it('later layers win: runtime guarded overrides tenant open', () => {
    const policy = mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: { canvasPolicy: { preset: 'open' } },
      runtime: { canvasPolicy: { preset: 'guarded' } },
    });
    expect(policy.preset).toBe('guarded');
    expect(policy.hitlOnCompose).toBe(true);
  });

  it('per-gate overrides survive after preset change in same layer', () => {
    const policy = mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: {
        canvasPolicy: {
          preset: 'open',
          hitlOnCompose: true,
        },
      },
    });
    expect(policy.preset).toBe('open');
    expect(policy.hitlOnCompose).toBe(true);
    expect(policy.autoPin).toBe(true);
  });

  it('embed layer sits between agent and runtime', () => {
    const policy = mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      agent: { canvasPolicy: { preset: 'open', region: 'bounded' } },
      embed: { canvasPolicy: { region: 'unbounded' } },
      runtime: { canvasPolicy: { allowDelete: false } },
    });
    expect(policy.preset).toBe('open');
    expect(policy.region).toBe('unbounded');
    expect(policy.allowDelete).toBe(false);
  });

  it('partial gate override on guarded keeps other guarded defaults', () => {
    const policy = mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: { canvasPolicy: { toolset: 'authoring-full' } },
    });
    expect(policy.preset).toBe('guarded');
    expect(policy.toolset).toBe('authoring-full');
    expect(policy.hitlOnCompose).toBe(CANVAS_POLICY_PRESET_DEFAULTS.guarded.hitlOnCompose);
  });

  it('mergeCanvasConfig returns canvasPolicy slice', () => {
    const merged = mergeCanvasConfig({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: { canvasPolicy: { preset: 'open' } },
    });
    expect(merged.canvasPolicy.preset).toBe('open');
  });
});

describe('mergeCanvasPolicy — unknown field warnings', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('warns on unknown canvasPolicy keys in non-production', () => {
    const tenantPolicy = {
      preset: 'guarded' as const,
      mysteryGate: true,
    };
    mergeCanvasPolicy({
      platform: PLATFORM_CANVAS_CONFIG_LAYER,
      tenant: { canvasPolicy: tenantPolicy as typeof tenantPolicy & { preset: 'guarded' } },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('mysteryGate'));
  });
});
