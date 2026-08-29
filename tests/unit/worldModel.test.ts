/**
 * automated checks:
 * - digest budgeter drop order
 * - lease TTL
 * - capability derivation
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyDigestBudget,
  compileWorkspaceDigest,
  createAgentBudget,
  createAgentRegistry,
  createAgentRuntime,
  createAgentSession,
  createCameraQueue,
  createDigestCompiler,
  createLeaseManager,
  deriveAttention,
  deriveCapabilities,
  estimateDigestTokens,
  registerModelResolver,
  resetActivityLogCounterForTests,
  resetCameraIntentCounterForTests,
  resetHandoffCounterForTests,
  resetLeaseCounterForTests,
  clearModelResolverForTests,
  DIGEST_TARGET_TOKENS,
  type ModelCapabilities,
  type ModelResolver,
  type ProviderBinding,
  type WorkspaceDigest,
} from '../../src/agents';
import type { ToolDefinition } from '../../src/panels/tools';
import { createCanvasHost } from '../../src/panels/host';

const FULL_CAPS: ModelCapabilities = {
  vision: true,
  tools: true,
  contextTokens: 128_000,
  streaming: true,
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
    if (!resolved) throw new Error(`unknown alias "${alias}"`);
    return resolved;
  };
}

function stubTool(
  name: string,
  extras?: { description?: string; costClass?: 'cheap' | 'expensive' }): ToolDefinition {
  return {
    declaration: {
      name,
      description: extras?.description ?? `${name} tool`,
      costClass: extras?.costClass,
      parameters: { type: 'object', properties: {} },
    },
    handler: () => ({ ok: true, result: name }),
  };
}

function bulkyDigest(): WorkspaceDigest {
  const backgroundContexts = Array.from({ length: 40 }, (_, index) => ({
    id: `bg-${index}`,
    kind: 'frame',
    label: `Background context ${index} with a long descriptive label to inflate tokens`,
    attention: 'background' as const,
    panels: Array.from({ length: 8 }, (_, panelIndex) => ({
      id: `bg-${index}-panel-${panelIndex}`,
      type: 'schema',
      title: `Panel ${panelIndex} title with extra filler text for token pressure`,
      origin: 'host' as const,
      dirty: panelIndex % 2 === 0,
    })),
  }));

  return {
    user: { id: 'user-1', name: 'Ada' },
    contexts: [
      {
        id: 'focused-1',
        kind: 'frame',
        label: 'Focused frame',
        attention: 'focused',
        panels: [
          {
            id: 'panel-focused',
            type: 'schema',
            title: 'Focused panel',
            origin: 'agent',
            dirty: true,
          },
        ],
      },
      {
        id: 'visible-1',
        kind: 'frame',
        label: 'Visible frame',
        attention: 'visible',
        panels: [
          {
            id: 'panel-visible',
            type: 'schema',
            title: 'Visible panel',
            origin: 'host',
          },
        ],
      },...backgroundContexts,
    ],
    agents: [
      {
        id: 'chat-1',
        kind: 'chat',
        label: 'Editor',
        status: 'running',
        task: 'compose',
      },
      {
        id: 'job-1',
        kind: 'background',
        label: 'Generator',
        status: 'waiting_approval',
        task: 'generate',
      },
    ],
    jobs: Array.from({ length: 12 }, (_, index) => ({
      id: `job-${index}`,
      capability: 'site.generate',
      scope: `site-${index}`,
      status: 'running',
      progress: index / 12,
    })),
    pendingApprovals: Array.from({ length: 8 }, (_, index) => ({
      id: `approval-${index}`,
      agentId: 'job-1',
      panelId: `panel-${index}`,
      summary: `Approve mutation ${index} with a longer summary for tokens`,
    })),
    recentActivity: Array.from({ length: 15 }, (_, index) => ({
      ts: new Date(Date.UTC(2026, 6, 21, 10, index)).toISOString(),
      actor: index % 2 === 0 ? 'user': 'chat-1',
      verb: 'edit',
      target: `panel-${index}`,
    })),
    shapes: [],
  };
}

describe(' digest budgeter drop order', () => {
  it('derives attention tiers from selection and viewport', () => {
    expect(deriveAttention({ contextId: 'a', selected: true })).toBe('focused');
    expect(deriveAttention({ contextId: 'a', beingEdited: true })).toBe('focused');
    expect(deriveAttention({ contextId: 'a', intersectsViewport: true })).toBe('visible');
    expect(deriveAttention({ contextId: 'a' })).toBe('background');
  });

  it('drops recentActivity first, then background contexts', () => {
    const digest = bulkyDigest();
    const before = estimateDigestTokens(digest);
    expect(before).toBeGreaterThan(DIGEST_TARGET_TOKENS);

    const result = applyDigestBudget(digest, {
      targetTokens: DIGEST_TARGET_TOKENS,
      hardCapTokens: 3_000,
    });

    expect(result.dropped[0]).toBe('recentActivity');
    expect(result.dropped).toContain('backgroundContexts');
    expect(result.dropped.indexOf('recentActivity')).toBeLessThan(
      result.dropped.indexOf('backgroundContexts'));
    expect(result.digest.recentActivity).toEqual([]);
    expect(result.digest.contexts.every((context) => context.attention !== 'background')).toBe(
      true);
    expect(result.digest.contexts.some((context) => context.attention === 'focused')).toBe(true);
    expect(result.digest.contexts.some((context) => context.attention === 'visible')).toBe(true);
    expect(result.estimatedTokens).toBeLessThanOrEqual(before);
  });

  it('preserves focused/visible contexts when only recentActivity must drop', () => {
    const digest = bulkyDigest();
     // Force only activity to be large enough relative to a high target by
     // keeping a moderate target that activity alone exceeds after clone.
    const modest = {...digest,
      contexts: digest.contexts.filter((context) => context.attention !== 'background').slice(0, 2),
      jobs: [],
      pendingApprovals: [],
      recentActivity: Array.from({ length: 15 }, (_, index) => ({
        ts: new Date(Date.UTC(2026, 6, 21, 10, index)).toISOString(),
        actor: 'chat-1',
        verb: 'narrate',
        target: `x`.repeat(400),
      })),
    };

    const result = applyDigestBudget(modest, { targetTokens: 200, hardCapTokens: 3_000 });
    expect(result.dropped[0]).toBe('recentActivity');
    expect(result.digest.contexts.map((context) => context.id).sort()).toEqual(
      ['focused-1', 'visible-1'].sort());
  });

  it('caches compiles per change-batch and computes deltas ', () => {
    const compiler = createDigestCompiler();
    const input = {
      user: { id: 'u1' },
      changeBatchId: 'batch-1',
      contexts: [
        {
          id: 'c1',
          kind: 'frame',
          label: 'One',
          attention: 'focused' as const,
          panels: [],
        },
      ],
      agents: [
        { id: 'a1', kind: 'chat' as const, label: 'Chat', status: 'idle' as const },
      ],
      recentActivity: [],
    };

    const first = compiler.compile(input);
    const second = compiler.compile(input);
    expect(second.digest).toEqual(first.digest);

     // Establish per-agent baseline.
    compiler.deltaFor('a1', input);

    const { delta } = compiler.deltaFor('a1', {...input,
      changeBatchId: 'batch-2',
      agents: [
        { id: 'a1', kind: 'chat', label: 'Chat', status: 'waiting_approval', task: 'save' },
      ],
    });
    expect(delta.changed).toBe(true);
    expect(delta.agentStatusChanges).toEqual([
      { id: 'a1', from: 'idle', to: 'waiting_approval' },
    ]);
  });

  it('compileWorkspaceDigest limits recent activity to 15', () => {
    const result = compileWorkspaceDigest({
      user: { id: 'u' },
      contexts: [],
      agents: [],
      recentActivity: Array.from({ length: 40 }, (_, index) => ({
        ts: `2026-07-21T00:00:${String(index).padStart(2, '0')}.000Z`,
        actor: 'user',
        verb: 'click',
        target: `t-${index}`,
      })),
    });
    expect(result.digest.recentActivity).toHaveLength(15);
    expect(result.digest.recentActivity[0]?.target).toBe('t-25');
  });
});

describe(' lease TTL', () => {
  beforeEach(() => {
    resetLeaseCounterForTests();
  });

  it('expires leases after ttl and GCs them', () => {
    let nowMs = 1_000;
    const leases = createLeaseManager({ now: () => nowMs });

    const claimed = leases.claim({ source: 'agent-a', scope: 'panel-1', ttlMs: 500 });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;

    expect(leases.get('panel-1')?.id).toBe(claimed.lease.id);
    expect(leases.isExpired(claimed.lease.id, 1_400)).toBe(false);

    nowMs = 1_600;
    expect(leases.isExpired(claimed.lease.id, nowMs)).toBe(true);
    expect(leases.get('panel-1')).toBeUndefined();
    expect(leases.gc(nowMs)).toBe(0);
  });

  it('returns holder info on conflict without overwriting (advisory soft lease)', () => {
    const leases = createLeaseManager({ now: () => 5_000 });
    const first = leases.claim({ source: 'agent-a', scope: 'panel-x', ttlMs: 10_000 });
    expect(first.ok).toBe(true);

    const conflict = leases.claim({ source: 'agent-b', scope: 'panel-x', ttlMs: 10_000 });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.reason).toBe('conflict');
    expect(conflict.holder.source).toBe('agent-a');
    expect(leases.get('panel-x')?.source).toBe('agent-a');
  });

  it('renews ttl for the same source and rejects invalid ttl', () => {
    let nowMs = 10_000;
    const leases = createLeaseManager({ now: () => nowMs });
    const first = leases.claim({ source: 'agent-a', scope: 's1', ttlMs: 1_000 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    nowMs = 10_500;
    const renewed = leases.claim({ source: 'agent-a', scope: 's1', ttlMs: 2_000 });
    expect(renewed.ok).toBe(true);
    if (!renewed.ok) return;
    expect(renewed.lease.id).toBe(first.lease.id);
    expect(renewed.lease.expiresAt).toBe(12_500);

    const invalid = leases.claim({ source: 'agent-a', scope: 's2', ttlMs: 0 });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.reason).toBe('invalid_ttl');
  });

  it('runtime.claim appends lease_conflict activity on soft conflict', () => {
    resetActivityLogCounterForTests();
    const runtime = createAgentRuntime();
    runtime.register({
      id: 'agent-a',
      kind: 'chat',
      label: 'A',
      transport: 'test',
    });
    runtime.register({
      id: 'agent-b',
      kind: 'chat',
      label: 'B',
      transport: 'test',
    });

    expect(runtime.claim({ source: 'agent-a', scope: 'panel-1', ttlMs: 5_000 }).ok).toBe(true);
    const conflict = runtime.claim({ source: 'agent-b', scope: 'panel-1', ttlMs: 5_000 });
    expect(conflict.ok).toBe(false);

    const warnings = runtime.activity.getEntries({ actor: 'agent-b' });
    expect(warnings.some((entry) => entry.verb === 'lease_conflict')).toBe(true);
  });
});

describe(' capability derivation', () => {
  afterEach(() => {
    clearModelResolverForTests();
  });

  it('derives class/approval/costClass/summary from the tool registry', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('mock', 'mock-model', FULL_CAPS),
      }));
    // Session registration side effect is what the assertions below observe.
    await createAgentSession({
      agentId: 'cap-1',
      modelAlias: 'default',
    });

    const tools = [
      stubTool('list_panels', { description: 'List open panels\nMore detail' }),
      stubTool('describe_context', { description: 'Describe a context' }),
      stubTool('get_activity', { description: 'Read activity' }),
      stubTool('read_panel_state', { description: 'Read panel state' }),
      stubTool('list_agents', { description: 'List agents' }),
      stubTool('compose_panel', {
        description: 'Compose a panel',
        costClass: 'expensive',
      }),
      stubTool('run_panel_action', { description: 'Run a panel action' }),
      stubTool('site_generator_workflow', {
        description: 'Start generation job',
        costClass: 'expensive',
      }),
    ];

    const caps = deriveCapabilities(tools);
    const byId = new Map(caps.map((capability) => [capability.id, capability]));

    expect(byId.get('list_panels')).toMatchObject({
      class: 'read',
      approval: 'none',
      summary: 'List open panels',
    });
    expect(byId.get('describe_context')?.class).toBe('read');
    expect(byId.get('get_activity')?.class).toBe('read');
    expect(byId.get('read_panel_state')?.class).toBe('read');
    expect(byId.get('list_agents')?.class).toBe('read');
    expect(byId.get('compose_panel')).toMatchObject({
      class: 'ui',
      approval: 'none',
      costClass: 'expensive',
    });
    expect(byId.get('run_panel_action')).toMatchObject({
      class: 'mutate',
      approval: 'hitl',
    });
    expect(byId.get('site_generator_workflow')).toMatchObject({
      class: 'job',
      approval: 'hitl',
      costClass: 'expensive',
    });
  });
});

describe(' world-model runtime surface', () => {
  beforeEach(() => {
    resetActivityLogCounterForTests();
    resetLeaseCounterForTests();
    resetCameraIntentCounterForTests();
    resetHandoffCounterForTests();
  });

  afterEach(() => {
    clearModelResolverForTests();
  });

  it('exposes registry, leases, camera, budget, digest, and drill-downs on host.agents', async () => {
    registerModelResolver(
      makeResolver({
        default: binding('mock', 'mock-model', FULL_CAPS),
      }));

    const host = createCanvasHost({
      engine: {
        isReady: () => true,
        on: () => ()=> undefined,
        exportSnapshot: () => ({}),
        importSnapshot: () => undefined,
      },
    });

    host.agents.register({
      id: 'nas',
      kind: 'chat',
      label: 'NAS',
      transport: 'copilotkit',
      scope: 'site-1',
    });

    const session = await host.agents.createSession({
      agentId: 'editor',
      modelAlias: 'default',
    });
    expect(session.agentId).toBe('editor');
    expect(host.agents.registry.get('editor')).toBeDefined();
    expect(host.agents.registry.get('nas')?.transport).toBe('copilotkit');

    const claim = host.agents.claim({
      source: 'editor',
      scope: 'panel-seo',
      ttlMs: 2_000,
    });
    expect(claim.ok).toBe(true);

    host.agents.camera.recordUserInteraction(10_000);
    const cam = host.agents.camera.enqueue('editor', { focus: 'panel-seo' }, 10_100);
    expect(cam.ok).toBe(false);
    if (!cam.ok) {
      expect(cam.badge).toBe('attention');
      expect(cam.reason).toBe('user_recent');
    }

    const budgetCheck = host.agents.budget.checkCostClass('expensive');
    expect(budgetCheck.ok).toBe(true);

    const tools = host.agents.createDrillDownTools();
    expect(tools.map((tool) => tool.declaration.name).sort()).toEqual([
      'describe_context',
      'get_activity',
      'list_agents',
      'read_panel_state',
    ]);

    const listed = await tools.find((tool) => tool.declaration.name === 'list_agents')!.handler({});
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const agents = listed.result as Array<{ id: string }>;
      expect(agents.map((agent) => agent.id).sort()).toEqual(['editor', 'nas']);
    }

    const handoff = host.agents.handoff({
      from: 'editor',
      to: 'nas',
      task: 'review SEO draft',
      scope: 'site-1',
    });
    expect(handoff.ok).toBe(true);

    host.dispose();
  });

  it('budget warns when expensive spend would dip below warnBelow', () => {
    const budget = createAgentBudget({
      limits: { hardCap: 120, warnBelow: 40 },
      initialSpent: 50,
    });
    const check = budget.checkCostClass('expensive', 50);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.warning).toMatch(/warn below 40/);
  });

  it('camera clamps agent ops in bounded/fixed modes', () => {
    const camera = createCameraQueue({ mode: 'bounded', now: () => 10_000 });
    const result = camera.enqueue('agent-a', { x: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('mode_clamped');
      expect(result.badge).toBe('attention');
    }
  });

  it('registry enforces role tool scopes when allow-lists are set ', () => {
    const registry = createAgentRegistry();
    registry.register({
      id: 'concierge',
      kind: 'voice',
      label: 'Voice',
      transport: 'voice',
      allowedTools: ['list_panels', 'open_panel'],
    });
    expect(registry.isToolAllowed('concierge', 'list_panels')).toBe(true);
    expect(registry.isToolAllowed('concierge', 'run_panel_action')).toBe(false);
  });
});
