/**
 * MCP client fixture drives panel open/fill on a live dev workspace
 * under OAuth token scope + agent role scope enforcement.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defineSchemaPanel } from '../../src/panels/builder';
import { createCanvasHost, type EngineHandle, type EngineLifecycleEvent } from '../../src/panels/host';
import { createPanelRegistry } from '../../src/panels/registry';
import { createPanelToolRuntime } from '../../src/panels/panelToolRuntime';
import { createApprovalController } from '../../src/panels/approval';
import { createPanelToolsFromRegistry } from '../../src/panels/tools';
import { createAgentRegistry } from '../../src/agents/registry';
import { createActivityLog } from '../../src/agents/activity';
import { createDigestCompiler } from '../../src/agents/digest';
import {
  AUTH_SCOPE_DENIED_CODE,
  CANVAS_MCP_SCOPES,
  createCanvasMcpFixture,
  callCanvasMcpTool,
  createInMemoryCanvasMcpAuthStore,
  mintTestAccessToken,
  resetTestTokenCounterForTests,
  protectedResourceMetadata,
  authorizationServerMetadata,
  isToolAllowedByTokenScope,
  type LiveWorkspaceBridge,
} from '../../src/mcp';
import type { JsonObject } from '../../src/panels/types';

class FakeEngine implements EngineHandle {
  openRequests: string[] = [];
  private ready = true;
  private listeners: Record<EngineLifecycleEvent, Set<() => void>> = {
    ready: new Set(),
    change: new Set(),
  };

  get isReady(): boolean {
    return this.ready;
  }

  on(event: EngineLifecycleEvent, listener: () => void): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  exportSnapshot(): JsonObject {
    return {};
  }

  importSnapshot(): void {}

  openPanel(request: { panelId: string }): void {
    this.openRequests.push(request.panelId);
  }
}

const SEO_SPEC_PANEL = defineSchemaPanel({
  id: 'site-seo',
  meta: {
    title: 'SEO',
    schemaVersion: 1,
    agentDescription: 'Edit search engine settings for the active site or page.',
    contextKinds: ['site', 'page'],
  },
  sources: {
    seo: { source: 'site.seo', params: { pageId: '$scope.entityId' } },
  },
  actions: {
    save: { kind: 'mutate', source: 'site.seo', op: 'update', mutates: true },
  },
  blocks: [
    {
      block: 'form',
      bind: 'seo',
      fields: [
        { bind: 'title', type: 'text', label: 'Meta title' },
        { bind: 'description', type: 'textarea', label: 'Meta description' },
      ],
    },
    { block: 'actions', actions: ['save'] },
  ],
} as const satisfies Parameters<typeof defineSchemaPanel>[0]);

const WORKSPACE_ID = 'dev-workspace-p10t4';

function buildLiveWorkspaceBridge(options?: {
  allowedTools?: readonly string[];
  allowedPanels?: readonly string[];
}): {
  bridge: LiveWorkspaceBridge;
  engine: FakeEngine;
  cleanup: () => void;
} {
  const engine = new FakeEngine();
  const host = createCanvasHost({
    engine,
    panels: [SEO_SPEC_PANEL],
  });
  const registry = createPanelRegistry(host.panels.definitions);
  const runtime = createPanelToolRuntime(
    { panels: host.panels, catalog: host.catalog },
    registry,
    { approvalController: createApprovalController });
  const panelTools = createPanelToolsFromRegistry(registry, runtime);
  const activity = createActivityLog();
  const agentRegistry = createAgentRegistry();
  agentRegistry.register({
    id: 'mcp-external-client',
    kind: 'text',
    label: 'External MCP Client',
    transport: 'mcp',
    allowedTools: options?.allowedTools ?? [
      'list_panels',
      'open_panel',
      'fill_panel',
      'get_workspace_digest',
      'describe_panel',
    ],
    allowedPanels: options?.allowedPanels ?? ['site-seo'],
  });
  const digest = createDigestCompiler();

  const bridge: LiveWorkspaceBridge = {
    workspaceId: WORKSPACE_ID,
    panelTools,
    registry: agentRegistry,
    activity,
    digest,
    getDigest: () => digest.full({
      user: { id: 'mcp-client' },
      contexts: [],
      agents: agentRegistry.list().map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
        scope: entry.scope,
        status: entry.status,
        task: entry.task,
      })),
      recentActivity: activity.getEntries({ limit: 15 }),
    }).digest,
    resolvePanelDefinitionId: (panelId) => runtime.resolveDefinitionId(panelId),
  };

  return {
    bridge,
    engine,
    cleanup: () => {
      runtime.dispose();
      host.dispose();
    },
  };
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  resetTestTokenCounterForTests();
  while (cleanups.length > 0) {
    cleanups.pop?.();
  }
});

describe('canvas MCP scopes', () => {
  it('maps panel tools to read/act/digest scopes', () => {
    expect(isToolAllowedByTokenScope('list_panels', [CANVAS_MCP_SCOPES.READ])).toBe(true);
    expect(isToolAllowedByTokenScope('open_panel', [CANVAS_MCP_SCOPES.READ])).toBe(false);
    expect(isToolAllowedByTokenScope('open_panel', [CANVAS_MCP_SCOPES.ACT])).toBe(true);
    expect(isToolAllowedByTokenScope('get_workspace_digest', [CANVAS_MCP_SCOPES.DIGEST])).toBe(true);
  });

  it('exposes OAuth discovery metadata without secret values', () => {
    const url = new URL('https://canvas-mcp.dev/canvas/mcp');
    const resource = protectedResourceMetadata({}, url);
    expect(resource.scopes_supported).toEqual([
      // CANVAS_MCP_SCOPES.READ,
      // CANVAS_MCP_SCOPES.ACT,
      // CANVAS_MCP_SCOPES.DIGEST,
    ]);
    const authServer = authorizationServerMetadata({}, url);
    expect(authServer.token_endpoint).toBe('https://canvas-mcp.dev/canvas/oauth/token');
    expect(resource.resource).toBe('https://canvas-mcp.dev/canvas/mcp');
    expect(Object.keys(resource)).not.toContain('MCP_CREDENTIAL_PEPPER');
  });
});

describe('canvas MCP client fixture', () => {
  it('lists panels from a live workspace bridge', async () => {
    const { bridge, cleanup } = buildLiveWorkspaceBridge;
    cleanups.push(cleanup);

    const fixture = await createCanvasMcpFixture({ bridge });
    cleanups.push(() => void fixture.close);

    const listed = await callCanvasMcpTool<Array<{ id: string }>>(
      fixture,
      'list_panels');
    expect(listed.ok).toBe(true);
    expect(Array.isArray(listed.result)).toBe(true);
    expect(listed.result?.some((panel) => panel.id === 'site-seo')).toBe(true);
  });

  it('opens and fills a panel under full act scope', async () => {
    const { bridge, engine, cleanup } = buildLiveWorkspaceBridge;
    cleanups.push(cleanup);

    const fixture = await createCanvasMcpFixture({
      bridge,
      scopes: [CANVAS_MCP_SCOPES.READ, CANVAS_MCP_SCOPES.ACT, CANVAS_MCP_SCOPES.DIGEST],
    });
    cleanups.push(() => void fixture.close);

    const opened = await callCanvasMcpTool<{ panelId: string }>(fixture, 'open_panel', {
      id: 'site-seo',
    });
    expect(opened.ok).toBe(true);
    expect(opened.result?.panelId).toBeTruthy();
    expect(engine.openRequests).toContain('site-seo');

    const filled = await callCanvasMcpTool<{ applied: string[] }>(fixture, 'fill_panel', {
      id: 'site-seo',
      patch: { title: 'MCP-filled title', description: 'Filled by external MCP client' },
    });
    expect(filled.ok).toBe(true);
    expect(filled.result?.applied).toEqual(expect.arrayContaining(['title', 'description']));
  });

  it('denies open_panel when token lacks workspace:act scope', async () => {
    const { bridge, cleanup } = buildLiveWorkspaceBridge;
    cleanups.push(cleanup);

    const authStore = createInMemoryCanvasMcpAuthStore();
    const readOnlyToken = mintTestAccessToken(authStore, {
      workspaceId: WORKSPACE_ID,
      scopes: [CANVAS_MCP_SCOPES.READ, CANVAS_MCP_SCOPES.DIGEST],
    });

    const fixture = await createCanvasMcpFixture({
      bridge,
      authStore,
      accessToken: readOnlyToken,
    });
    cleanups.push(() => void fixture.close);

    const denied = await callCanvasMcpTool(fixture, 'open_panel', { id: 'site-seo' });
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain(AUTH_SCOPE_DENIED_CODE);
    expect(denied.error).toContain('open_panel');
  });

  it('denies fill_panel when agent role scope excludes the tool ', async () => {
    const { bridge, cleanup } = buildLiveWorkspaceBridge({
      allowedTools: ['list_panels', 'open_panel'],
    });
    cleanups.push(cleanup);

    const fixture = await createCanvasMcpFixture({
      bridge,
      scopes: [CANVAS_MCP_SCOPES.READ, CANVAS_MCP_SCOPES.ACT],
    });
    cleanups.push(() => void fixture.close);

    await callCanvasMcpTool(fixture, 'open_panel', { id: 'site-seo' });

    const denied = await callCanvasMcpTool(fixture, 'fill_panel', {
      id: 'site-seo',
      patch: { title: 'should not apply' },
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('SCOPE_DENIED');
    expect(denied.error).toContain('fill_panel');
  });

  it('returns workspace digest for digest-scoped tokens', async () => {
    const { bridge, cleanup } = buildLiveWorkspaceBridge;
    cleanups.push(cleanup);

    const fixture = await createCanvasMcpFixture({
      bridge,
      scopes: [CANVAS_MCP_SCOPES.DIGEST],
    });
    cleanups.push(() => void fixture.close);

    const digest = await callCanvasMcpTool<{ user: { id: string } }>(
      fixture,
      'get_workspace_digest',
      { mode: 'full' });
    expect(digest.ok).toBe(true);
    expect(digest.result?.user.id).toBe('mcp-client');
  });
});
