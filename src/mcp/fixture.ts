/**
 * Test/dev fixture: in-memory MCP client wired to a live workspace bridge.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  createInMemoryCanvasMcpAuthStore,
  mintTestAccessToken,
  type CanvasMcpAuthStore,
} from './auth';
import { registerCanvasMcpTools, createCanvasMcpServerMetadata } from './registerTools';
import type { LiveWorkspaceBridge } from './workspaceBridge';
import { CANVAS_MCP_SCOPES } from './scopes';

export interface CanvasMcpFixtureOptions {
  bridge: LiveWorkspaceBridge;
  authStore?: CanvasMcpAuthStore;
  scopes?: readonly string[];
  accessToken?: string;
}

export interface CanvasMcpFixture {
  client: Client;
  authStore: CanvasMcpAuthStore;
  accessToken: string;
  close: () => Promise<void>;
}

export async function createCanvasMcpFixture(
  options: CanvasMcpFixtureOptions): Promise<CanvasMcpFixture> {
  const authStore = options.authStore ?? createInMemoryCanvasMcpAuthStore();
  const accessToken =
    options.accessToken ??
    mintTestAccessToken(authStore, {
      workspaceId: options.bridge.workspaceId,
      scopes: options.scopes ?? [
        // CANVAS_MCP_SCOPES.READ,
        // CANVAS_MCP_SCOPES.ACT,
        // CANVAS_MCP_SCOPES.DIGEST,
      ],
    });

  const meta = createCanvasMcpServerMetadata();
  const server = new McpServer(meta);

  registerCanvasMcpTools({
    server,
    bridge: options.bridge,
    authStore,
    accessToken,
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'canvas-mcp-test-client', version: '0.1.0' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    authStore,
    accessToken,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export async function callCanvasMcpTool<T = unknown>(
  fixture: CanvasMcpFixture,
  toolName: string,
  args: Record<string, unknown> = {}): Promise<{ ok: boolean; result?: T; error?: string; code?: string }> {
  const response = await fixture.client.callTool({ name: toolName, arguments: args });
  const textBlock = response.content.find((block) => block.type === 'text');
  if (textBlock === undefined || textBlock.type !== 'text') {
    return { ok: false, error: 'MCP tool returned no text content' };
  }
  try {
    return JSON.parse(textBlock.text) as { ok: boolean; result?: T; error?: string; code?: string };
  } catch {
    return { ok: false, error: `invalid JSON from MCP tool: ${textBlock.text}` };
  }
}
