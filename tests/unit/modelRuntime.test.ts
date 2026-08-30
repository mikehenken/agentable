/**
 * automated checks: dual-alias sessions, fallback resolution, and
 * capability gating at the model-agnostic runtime boundary.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearModelResolverForTests,
  createAgentSession,
  gateToolsForCapabilities,
  registerModelResolver,
  resolveModelBinding,
  selectOfferedTools,
  type ModelCapabilities,
  type ModelResolver,
  type ProviderBinding,
} from '../../src/agents';
import { createCanvasHost } from '../../src/panels/host';
import type { ToolDefinition } from '../../src/panels/tools';

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
  caps: ModelCapabilities,
  extra?: Partial<ProviderBinding>): ProviderBinding {
  return { providerId, model, caps, available: true,...extra };
}

function stubTool(name: string): ToolDefinition {
  return {
    declaration: {
      name,
      description: `${name} tool`,
      parameters: { type: 'object', properties: {} },
    },
    handler: () => ({ ok: true, result: name }),
  };
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

describe('model resolver + sessions ', () => {
  afterEach(() => {
    clearModelResolverForTests();
  });

  it('creates sessions for two aliases through the same resolver without code changes', async () => {
    registerModelResolver(
      makeResolver({
        'landi-fast': binding('vertex', 'gemini-3.5-flash', TEXT_ONLY_CAPS),
        'landi-quality': binding('vertex', 'gemini-2.5-pro', FULL_CAPS),
      }));

    const fast = await createAgentSession({
      agentId: 'editor-a',
      modelAlias: 'landi-fast',
    });
    const quality = await createAgentSession({
      agentId: 'editor-b',
      modelAlias: 'landi-quality',
    });

    expect(fast.resolvedAlias).toBe('landi-fast');
    expect(fast.binding.model).toBe('gemini-3.5-flash');
    // resolvedAlias echoes the requested alias (see the landi-fast case above),
    // not the bound model; the binding's model is asserted separately.
    expect(quality.resolvedAlias).toBe('landi-quality');
    expect(quality.binding.model).toBe('gemini-2.5-pro');
    expect(fast.binding.providerId).toBe('vertex');
    expect(quality.binding.providerId).toBe('vertex');
  });

  it('falls back when the primary binding is unavailable', async () => {
    registerModelResolver(
      makeResolver({
        primary: binding('openai', 'gpt-4.1', FULL_CAPS, {
          available: false,
          fallback: ['backup'],
        }),
        backup: binding('anthropic', 'claude-sonnet', FULL_CAPS),
      }));

    const resolved = await resolveModelBinding('primary', { agentId: 'job-1' });
    expect(resolved.fallbackUsed).toBe(true);
    expect(resolved.resolvedAlias).toBe('backup');
    expect(resolved.binding.model).toBe('claude-sonnet');
    expect(resolved.notes.some((note) => note.code === 'MODEL_UNAVAILABLE')).toBe(true);
  });

  it('falls back when required capabilities are unmet', async () => {
    registerModelResolver(
      makeResolver({
        'vision-lite': binding('vertex', 'text-only', TEXT_ONLY_CAPS, {
          fallback: ['vision-pro'],
        }),
        'vision-pro': binding('vertex', 'multimodal', FULL_CAPS),
      }));

    const session = await createAgentSession({
      agentId: 'perception-1',
      modelAlias: 'vision-lite',
      requiredCaps: { vision: true },
    });

    expect(session.fallbackUsed).toBe(true);
    expect(session.resolvedAlias).toBe('vision-pro');
    expect(session.binding.caps.vision).toBe(true);
  });

  it('exposes registerModelResolver on createCanvasHost.agents', async () => {
    const engine = {
      isReady: () => true,
      on: () => ()=> undefined,
      exportSnapshot: () => ({}),
      importSnapshot: () => undefined,
    };
    const host = createCanvasHost({ engine });
    registerModelResolver(
      makeResolver({
        alias: binding('mock', 'mock-model', FULL_CAPS),
      }));

    const session = await host.agents.createSession({
      agentId: 'host-agent',
      modelAlias: 'alias',
    });
    expect(session.binding.model).toBe('mock-model');
    host.dispose();
  });

  it('degrades screenshot_canvas to read_canvas when vision is unavailable', () => {
    const tools = [
      stubTool('read_canvas'),
      stubTool('screenshot_canvas'),
      stubTool('list_panels'),
    ];
    const offers = gateToolsForCapabilities(
      tools,
      binding('vertex', 'text-only', TEXT_ONLY_CAPS));
    const offered = selectOfferedTools(offers).map((tool) => tool.declaration.name);

    expect(offered).toContain('read_canvas');
    expect(offered).not.toContain('screenshot_canvas');
    expect(
      offers.find((offer) => offer.degradedFrom === 'screenshot_canvas')?.note?.code).toBe('TOOL_DEGRADED');
  });

  it('surfaces buffered-turn notes for non-streaming bindings', async () => {
    registerModelResolver(
      makeResolver({
        buffered: binding('anthropic', 'claude-haiku', TEXT_ONLY_CAPS),
      }));

    const session = await createAgentSession({
      agentId: 'chat-1',
      modelAlias: 'buffered',
    });

    expect(session.notes.some((note) => note.code === 'BUFFERED_TURNS')).toBe(true);
  });

  it('rebindModel preserves requiredCaps from session creation', async () => {
    registerModelResolver(
      makeResolver({
        primary: binding('vertex', 'text-only', TEXT_ONLY_CAPS),
        backup: binding('vertex', 'tool-model', FULL_CAPS),
      }));

    const session = await createAgentSession({
      agentId: 'operator',
      modelAlias: 'backup',
      requiredCaps: { vision: true },
    });

    expect(session.resolvedAlias).toBe('backup');
    await expect(session.rebindModel('primary')).rejects.toMatchObject({
      code: 'RESOLVE_EXHAUSTED',
    });
    expect(session.requestedAlias).toBe('backup');
  });
});
