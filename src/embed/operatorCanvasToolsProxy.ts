/**
 * Operator embed proxy — forwards tool execution to the whiteboard host bundle
 * so the operator surface does not ship a second tldraw copy (P13-T7 iter-9).
 */
import type { ToolResult } from '../panels/tools';
import {
  getOperatorEmbedFunctionDeclarations,
  type ToolDeclaration,
} from './operatorCanvasToolDeclarations';

export type { ToolDeclaration };
export { getOperatorEmbedFunctionDeclarations as getFunctionDeclarations };

type GalleryScriptedToolName = 'draw_shapes' | 'read_canvas' | 'clear_agent_drawings' | string;

interface WhiteboardToolHost extends HTMLElement {
  whenReady?: (timeoutMs?: number) => Promise<boolean>;
  runMeridianDemo?: (
    step: 'document' | 'wireframe' | 'full',
  ) => Promise<{
    ok: boolean;
    document?: { ok: boolean; panelId: string; blockCount: number; title: string };
  }>;
  runOperatorScriptedTool?: (
    toolName: GalleryScriptedToolName,
    args?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result?: unknown; error?: string; toolName?: string }>;
  runScriptedTool?: (
    toolName: GalleryScriptedToolName,
    args?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result?: unknown; error?: string; toolName?: string }>;
}

const WHITEBOARD_HOST_TOOLS = new Set<string>([
  'draw_shapes',
  'read_canvas',
  'clear_agent_drawings',
  'group_shapes',
  'screenshot_canvas',
  'arrange',
  'open_panel',
  'compose_panel',
  'fill_panel',
  'patch_panel',
]);

async function resolveWhiteboardHost(): Promise<WhiteboardToolHost | null> {
  const host = document.querySelector('agentable-whiteboard');
  if (!(host instanceof HTMLElement)) {
    return null;
  }
  const whiteboard = host as WhiteboardToolHost;
  if (typeof whiteboard.whenReady === 'function') {
    await whiteboard.whenReady(15_000);
  }
  return whiteboard;
}

export async function executeTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const host = await resolveWhiteboardHost();
  if (host === null) {
    return { ok: false, error: 'whiteboard host unavailable for operator tool execution' };
  }

  if (name === 'open_panel' && typeof host.runMeridianDemo === 'function') {
    const demo = await host.runMeridianDemo('document');
    if (demo.document?.ok === true) {
      return {
        ok: true,
        result: {
          panelId: demo.document.panelId,
          title: demo.document.title,
        },
      };
    }
  }

  const runner =
    typeof host.runOperatorScriptedTool === 'function'
      ? host.runOperatorScriptedTool.bind(host)
      : typeof host.runScriptedTool === 'function'
        ? host.runScriptedTool.bind(host)
        : null;

  if (runner === null || !WHITEBOARD_HOST_TOOLS.has(name)) {
    return {
      ok: false,
      error: `operator embed proxy cannot execute "${name}" — use the whiteboard host API`,
    };
  }

  const result = await runner(name, args);
  if (!result.ok) {
    return {
      ok: false,
      error: typeof result.error === 'string' ? result.error : `${name} failed on whiteboard host`,
    };
  }
  return { ok: true, result: result.result };
}

export function createAgentToolExecutor(): never {
  throw new Error('createAgentToolExecutor is not available in the operator embed proxy');
}
