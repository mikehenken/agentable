import { describe, expect, it } from 'vitest';
import { createActivityLog } from '../../src/agents/activity';
import { createAgentRegistry } from '../../src/agents/registry';
import {
  createAgentToolExecutor,
  SCOPE_DENIED_CODE,
} from '../../src/agents/toolExecutor';
import {
  bindOperatorModeEnforcement,
  getOperatorMode,
  isOperatorModeEnforcementActive,
  resetOperatorModeBridgeForTests,
  syncOperatorMode,
  unbindOperatorModeEnforcement,
} from '../../src/agents/surface/operatorModeBridge';
import {
  getAllowedToolsForOperatorMode,
  isToolAllowedForOperatorMode,
  OPERATOR_ASK_TOOL_NAMES,
  OPERATOR_BUILD_TOOL_NAMES,
  OPERATOR_DRAW_ONLY_TOOL_NAMES,
} from '../../src/agents/surface/operatorModeScope';
import type { ToolDefinition } from '../../src/panels/tools';

const MUTATION_TOOL: ToolDefinition = {
  declaration: {
    name: 'fill_panel',
    description: 'test mutation stub',
    parameters: { type: 'object', properties: {} },
  },
  handler: () => ({ ok: true, result: 'mutated' }),
};

const READ_TOOL: ToolDefinition = {
  declaration: {
    name: 'list_panels',
    description: 'test read stub',
    parameters: { type: 'object', properties: {} },
  },
  handler: () => ({ ok: true, result: [] }),
};

const DRAW_TOOL: ToolDefinition = {
  declaration: {
    name: 'draw_shapes',
    description: 'test draw stub',
    parameters: { type: 'object', properties: {} },
  },
  handler: () => ({ ok: true, result: 'drawn' }),
};

describe('operatorModeScope', () => {
  it('classifies ask tools as read-only', () => {
    for (const toolName of OPERATOR_ASK_TOOL_NAMES) {
      expect(isToolAllowedForOperatorMode(toolName, 'ask')).toBe(true);
    }
  });

  it('denies mutation and draw tools in ask mode', () => {
    expect(isToolAllowedForOperatorMode('fill_panel', 'ask')).toBe(false);
    expect(isToolAllowedForOperatorMode('patch_panel', 'ask')).toBe(false);
    expect(isToolAllowedForOperatorMode('run_panel_action', 'ask')).toBe(false);
    expect(isToolAllowedForOperatorMode('draw_shapes', 'ask')).toBe(false);
    expect(isToolAllowedForOperatorMode('present_walkthrough', 'ask')).toBe(false);
  });

  it('allows build structural tools but blocks draw-only tools in build mode', () => {
    for (const toolName of OPERATOR_BUILD_TOOL_NAMES) {
      expect(isToolAllowedForOperatorMode(toolName, 'build')).toBe(true);
    }
    for (const toolName of OPERATOR_DRAW_ONLY_TOOL_NAMES) {
      expect(isToolAllowedForOperatorMode(toolName, 'build')).toBe(false);
    }
  });

  it('denies unknown host tools in build mode (deny-by-default)', () => {
    expect(isToolAllowedForOperatorMode('host_only_tool', 'build')).toBe(false);
    expect(isToolAllowedForOperatorMode('host_generate_report', 'build')).toBe(false);
  });

  it('allows all known tools in draw and auto mode at scope layer', () => {
    for (const mode of ['draw', 'auto'] as const) {
      expect(isToolAllowedForOperatorMode('draw_shapes', mode)).toBe(true);
      expect(isToolAllowedForOperatorMode('fill_panel', mode)).toBe(true);
      expect(isToolAllowedForOperatorMode('list_panels', mode)).toBe(true);
    }
  });

  it('auto mode allow-list matches draw (full union)', () => {
    expect(getAllowedToolsForOperatorMode('auto')).toEqual(getAllowedToolsForOperatorMode('draw'));
  });

  it('returns stable allow-lists per mode', () => {
    expect(getAllowedToolsForOperatorMode('ask')).toEqual([...OPERATOR_ASK_TOOL_NAMES]);
    expect(getAllowedToolsForOperatorMode('build')).toEqual([...OPERATOR_ASK_TOOL_NAMES,...OPERATOR_BUILD_TOOL_NAMES,
    ]);
    expect(getAllowedToolsForOperatorMode('draw').length).toBeGreaterThan(
      getAllowedToolsForOperatorMode('build').length);
  });
});

describe('operatorModeBridge + toolExecutor', () => {
  it('binds enforcement when operator surface mode is active', () => {
    resetOperatorModeBridgeForTests();
    bindOperatorModeEnforcement('build');
    expect(isOperatorModeEnforcementActive()).toBe(true);
    expect(getOperatorMode()).toBe('build');
    syncOperatorMode('ask');
    expect(getOperatorMode()).toBe('ask');
    unbindOperatorModeEnforcement();
    expect(isOperatorModeEnforcementActive()).toBe(false);
    expect(getOperatorMode()).toBe('auto');
  });

  it('refuses mutation tools in ask mode via tool executor', async () => {
    resetOperatorModeBridgeForTests();
    bindOperatorModeEnforcement('ask');

    const registry = createAgentRegistry();
    registry.register({
      id: 'operator',
      kind: 'chat',
      label: 'Operator',
      transport: 'chat',
    });
    const activity = createActivityLog();
    const executor = createAgentToolExecutor({
      registry,
      activity,
      tools: [MUTATION_TOOL, READ_TOOL, DRAW_TOOL],
    });

    const denied = await executor.execute(
      'fill_panel',
      { id: 'site-seo', patch: {} },
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error).toContain(SCOPE_DENIED_CODE);
    expect(denied.error).toContain('operator mode "ask"');

    const allowed = await executor.execute(
      'list_panels',
      {},
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(allowed.ok).toBe(true);

    const drawDenied = await executor.execute(
      'draw_shapes',
      { shapes: [] },
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(drawDenied.ok).toBe(false);
    if (drawDenied.ok) return;
    expect(drawDenied.error).toContain(SCOPE_DENIED_CODE);

    const entries = activity.getEntries({ limit: 10 });
    expect(entries.some((entry) => entry.verb === 'operator_mode_scope_denied')).toBe(true);

    unbindOperatorModeEnforcement();
  });

  it('allows build tools but not draw tools in build mode', async () => {
    resetOperatorModeBridgeForTests();
    bindOperatorModeEnforcement('build');

    const registry = createAgentRegistry();
    registry.register({
      id: 'operator',
      kind: 'chat',
      label: 'Operator',
      transport: 'chat',
    });
    const executor = createAgentToolExecutor({
      registry,
      tools: [MUTATION_TOOL, DRAW_TOOL],
    });

    const buildAllowed = await executor.execute(
      'fill_panel',
      { id: 'site-seo', patch: {} },
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(buildAllowed.ok).toBe(true);

    const drawDenied = await executor.execute(
      'draw_shapes',
      { shapes: [] },
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(drawDenied.ok).toBe(false);
    if (drawDenied.ok) return;
    expect(drawDenied.error).toContain(SCOPE_DENIED_CODE);

    unbindOperatorModeEnforcement();
  });

  it('skips operator mode checks when bridge is unbound', async () => {
    resetOperatorModeBridgeForTests();

    const registry = createAgentRegistry();
    registry.register({
      id: 'operator',
      kind: 'chat',
      label: 'Operator',
      transport: 'chat',
    });
    const executor = createAgentToolExecutor({
      registry,
      tools: [MUTATION_TOOL],
    });

    const result = await executor.execute(
      'fill_panel',
      { id: 'site-seo', patch: {} },
      { agentId: 'operator', agentLabel: 'Operator' });
    expect(result.ok).toBe(true);
  });
});

describe('canvasTools operator-mode enforcement ( iteration 2 agent scope)', () => {
  it('denies mutation tools via executeTool when operator agent context is active in Ask mode', async () => {
    resetOperatorModeBridgeForTests();
    bindOperatorModeEnforcement('ask');

    const { executeTool } = await import('../../src/agents/tools/canvasTools');
    const { withAgentToolContextAsync } = await import('../../src/agents/agentContext');
    const { OPERATOR_TOOL_CONTEXT } = await import('../../src/agents/surface/operatorRegistrationBridge');

    const denied = await withAgentToolContextAsync(OPERATOR_TOOL_CONTEXT, async () =>
      executeTool('fill_panel', { id: 'site-seo', patch: {} }));
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error).toContain(SCOPE_DENIED_CODE);
    expect(denied.error).toContain('operator mode "ask"');

    const allowed = await executeTool('knowledge_search', { query: 'test query here' });
    expect(allowed.ok).toBe(false);
    if (allowed.ok) return;
     // knowledge_search fails without VITE_KNOWLEDGE_SEARCH_URL but passes operator scope
    expect(allowed.error).not.toContain('operator mode "ask"');
    expect(allowed.error).not.toContain(SCOPE_DENIED_CODE);

    unbindOperatorModeEnforcement();
  });

  it('filters getFunctionDeclarations only for the operator agent id', async () => {
    resetOperatorModeBridgeForTests();
    bindOperatorModeEnforcement('ask');
    const { bindEngineCapabilities } = await import('../../src/agents/engineBridge');
    bindEngineCapabilities({
      frames: true,
      draw: true,
      minimap: true,
      infinitePan: true,
      nativeSnapshots: true,
    });

    const { getFunctionDeclarations } = await import('../../src/agents/tools/canvasTools');
    const { OPERATOR_AGENT_ID } = await import('../../src/agents/surface/constants');

    const chatNames = getFunctionDeclarations().map((entry) => entry.name);
    expect(chatNames).toContain('draw_shapes');
    expect(chatNames).toContain('open_chat');

    const operatorNames = getFunctionDeclarations({ agentId: OPERATOR_AGENT_ID }).map(
      (entry) => entry.name);
    expect(operatorNames).toContain('knowledge_search');
    expect(operatorNames).not.toContain('draw_shapes');
    expect(operatorNames).not.toContain('fill_panel');

    syncOperatorMode('build');
    const buildNames = getFunctionDeclarations({ agentId: OPERATOR_AGENT_ID }).map(
      (entry) => entry.name);
    expect(buildNames).toContain('open_chat');
    expect(buildNames).not.toContain('draw_shapes');
    expect(buildNames.length).toBeGreaterThan(operatorNames.length);

    syncOperatorMode('auto');
    const autoNames = getFunctionDeclarations({ agentId: OPERATOR_AGENT_ID }).map(
      (entry) => entry.name);
    expect(autoNames).toContain('draw_shapes');
    expect(autoNames.length).toBeGreaterThan(buildNames.length);
    expect(getAllowedToolsForOperatorMode('auto')).toEqual(getAllowedToolsForOperatorMode('draw'));

    unbindOperatorModeEnforcement();
  });
});
