/**
 * operator model bridge — session rebind and capability gating.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearModelResolverForTests,
  registerModelResolver,
  type ModelCapabilities,
  type ModelResolver,
  type ProviderBinding,
} from '../../src/agents';
import {
  bindOperatorModelBridge,
  evaluateOperatorModelOptions,
  getOperatorAgentSession,
  getOperatorModelBinding,
  isOperatorModelBridgeActive,
  rebindOperatorModel,
  resetOperatorModelBridgeForTests,
  unbindOperatorModelBridge,
} from '../../src/agents/surface/operatorModelBridge';
import { OPERATOR_AGENT_ID } from '../../src/agents/surface/constants';

const FULL_CAPS: ModelCapabilities = {
  vision: true,
  tools: true,
  contextTokens: 128_000,
  streaming: true,
};

const TEXT_ONLY_CAPS: ModelCapabilities = {
  vision: false,
  tools: true,
  contextTokens: 32_000,
  streaming: false,
};

const NO_TOOLS_CAPS: ModelCapabilities = {
  vision: false,
  tools: false,
  contextTokens: 8_000,
  streaming: false,
};

function binding(
  providerId: string,
  model: string,
  caps: ModelCapabilities,
  extra?: Partial<ProviderBinding>): ProviderBinding {
  return { providerId, model, caps, available: true,...extra };
}

function makeResolver(map: Record<string, ProviderBinding>): ModelResolver {
  return async (alias) => {
    const resolved = map[alias];
    if (!resolved) {
      throw new Error(`unknown alias "${alias}"`);
    }
    return resolved;
  };
}

describe('operatorModelBridge ', () => {
  afterEach(() => {
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
  });

  it('binds an operator session through the host resolver', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('vertex', 'gemini-default', FULL_CAPS),
      }));

    const bound = await bindOperatorModelBridge({ initialAlias: 'default' });
    expect(bound).toBe(true);
    expect(isOperatorModelBridgeActive()).toBe(true);

    const session = getOperatorAgentSession();
    expect(session).not.toBeNull();
    expect(session?.().agentId).toBe(OPERATOR_AGENT_ID);
    expect(session?.().requestedAlias).toBe('default');
    expect(session?.().binding.model).toBe('gemini-default');
  });

  it('rebinds server-side when the switcher selects a new alias', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('vertex', 'gemini-default', FULL_CAPS),
        fast: binding('vertex', 'gemini-flash', TEXT_ONLY_CAPS),
      }));

    await bindOperatorModelBridge({ initialAlias: 'default' });
    const result = await rebindOperatorModel('fast');

    expect(result.modelAlias).toBe('fast');
    expect(result.previousModelAlias).toBe('default');
    expect(result.resolvedAlias).toBe('fast');
    expect(result.binding.model).toBe('gemini-flash');
    expect(getOperatorModelBinding?.().model).toBe('gemini-flash');
  });

  it('preserves requiredCaps across rebind (capability-aware resolution)', async () => {
    registerModelResolver(
      makeResolver({
        'no-tools': binding('mock', 'text-only', NO_TOOLS_CAPS),
        'with-tools': binding('mock', 'tool-model', TEXT_ONLY_CAPS),
      }));

    await bindOperatorModelBridge({
      initialAlias: 'with-tools',
      requiredCaps: { tools: true },
    });

    await expect(rebindOperatorModel('no-tools')).rejects.toMatchObject({
      code: 'RESOLVE_EXHAUSTED',
    });
    expect(getOperatorAgentSession?.().requestedAlias).toBe('with-tools');
  });

  it('marks capability-ineligible aliases unavailable in option evaluation', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('vertex', 'gemini-default', FULL_CAPS),
        fast: binding('vertex', 'gemini-flash', TEXT_ONLY_CAPS),
        broken: binding('mock', 'no-tools', NO_TOOLS_CAPS),
      }));

    await bindOperatorModelBridge({
      initialAlias: 'default',
      requiredCaps: { tools: true },
    });

    const evaluated = await evaluateOperatorModelOptions(
      [
        { alias: 'default', label: 'Default' },
        { alias: 'fast', label: 'Fast' },
        { alias: 'broken', label: 'Broken' },
      ],
      { requiredCaps: { tools: true } });

    expect(evaluated.find((entry) => entry.alias === 'default')?.available).toBe(true);
    expect(evaluated.find((entry) => entry.alias === 'fast')?.available).toBe(true);
    expect(evaluated.find((entry) => entry.alias === 'broken')?.available).toBe(false);
  });

  it('does not bind when no host resolver is registered', async () => {
    const bound = await bindOperatorModelBridge({ initialAlias: 'default' });
    expect(bound).toBe(false);
    expect(isOperatorModelBridgeActive()).toBe(false);
    expect(getOperatorAgentSession).toBeNull();
  });

  it('unbind clears the active session', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('vertex', 'gemini-default', FULL_CAPS),
      }));
    await bindOperatorModelBridge({ initialAlias: 'default' });
    unbindOperatorModelBridge();
    expect(isOperatorModelBridgeActive()).toBe(false);
    expect(getOperatorAgentSession).toBeNull();
  });
});
