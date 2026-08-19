/**
 * integration: operator surface event path triggers session rebind.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearModelResolverForTests,
  registerModelResolver,
  type ModelCapabilities,
  type ModelResolver,
  type ProviderBinding,
} from '../../src/agents';
import {
  bindOperatorModelBridge,
  getOperatorAgentSession,
  rebindOperatorModel,
  resetOperatorModelBridgeForTests,
} from '../../src/agents/surface/operatorModelBridge';

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

function binding(
  providerId: string,
  model: string,
  caps: ModelCapabilities): ProviderBinding {
  return { providerId, model, caps, available: true };
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

describe('operator model rebind integration ', () => {
  beforeEach(() => {
    registerModelResolver(
      makeResolver({
        default: binding('vertex', 'gemini-default', FULL_CAPS),
        fast: binding('vertex', 'gemini-flash', TEXT_ONLY_CAPS),
      }));
  });

  afterEach(() => {
    resetOperatorModelBridgeForTests();
    clearModelResolverForTests();
  });

  it('mirrors surface switch sequence: bind then rebind updates server-side binding', async () => {
    await bindOperatorModelBridge({ initialAlias: 'default' });
    expect(getOperatorAgentSession?.().binding.model).toBe('gemini-default');

    const result = await rebindOperatorModel('fast');
    expect(result.modelAlias).toBe('fast');
    expect(result.resolvedAlias).toBe('fast');
    expect(getOperatorAgentSession?.().binding.model).toBe('gemini-flash');
    expect(getOperatorAgentSession?.().binding.providerId).toBe('vertex');
  });
});
