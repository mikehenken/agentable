/**
 * canvasTools - shared built-in tool registry for voice + chat agents.
 *
 * career demo tools removed (B3); panel opens route through the
 * whiteboard substrate only. Domain tools register via createCanvasHost.
 */
import { usePanelIntentStore } from '../../stores/panelIntentStore';
import {
  closePanelInCanvas,
  getEditor as getWhiteboardEditor,
  openPanelInCanvas,
} from '../../engines/tldraw/shapes/panelShapeApi';
import { emitAgUiStatePatch } from '../../protocol/ag-ui';
import { getHostActions } from '../../panels/tools';
import {
  filterCoreToolsForDomainRouting,
} from './domainRoutingToolFilter';
import { isCanvasChatSuppressed } from '../../engines/tldraw/layout/suppressCanvasChat';
import {
  gateToolsForEngineCapabilities,
  selectEngineOfferedTools,
} from '../capabilities';
import { getEngineCapabilities } from '../engineBridge';
import {
  evaluateOperatorModeToolDenial,
  getOperatorMode,
  isOperatorModeEnforcementActive,
} from '../surface/operatorModeBridge';
import { getAllowedToolsForOperatorMode } from '../surface/operatorModeScope';
import { OPERATOR_AGENT_ID } from '../surface/constants';
import { getAgentToolContext } from '../agentContext';
import { logToolCallDev } from '../toolCallDevLogger';
import { DRAWING_TOOLS } from './drawingTools';
import { AUTHORING_TOOLKIT_TOOLS } from './authoringToolkitTools';
import { PERCEPTION_TOOLS } from './perceptionTools';
import { WALKTHROUGH_TOOLS } from './walkthroughTools';
import type { ToolDeclaration, ToolDefinition, ToolResult } from '../../panels/tools';

export type {
  ToolDeclaration,
  ToolDefinition,
  ToolHandler,
  ToolParameterSchema,
  ToolResult,
} from '../../panels/tools';
export {
  PANEL_ACTING_TOOL_NAMES,
  PANEL_INTROSPECTION_TOOL_NAMES,
  PANEL_TOOL_NAMES,
  createPanelToolsFromRegistry,
} from '../../panels/tools';

function showPanel(id: string, source: string): ToolResult {
  if (!getWhiteboardEditor()) {
    return { ok: false, error: 'canvas editor not bound' };
  }
  openPanelInCanvas(id, { focus: true, preserveZoom: true });
  return {
    ok: true,
    result: `Opened ${id} panel${source ? ` (via ${source})` : ''}.`,
  };
}

function hidePanel(panelId: string): ToolResult {
  if (!getWhiteboardEditor()) {
    return { ok: false, error: 'canvas editor not bound' };
  }
  closePanelInCanvas(panelId);
  return { ok: true, result: `Closed ${panelId} panel.` };
}

export const CANVAS_TOOLS: readonly ToolDefinition[] = [
  {
    declaration: {
      name: 'open_chat',
      description:
        'Open the chat panel and focus the input. Use when handing off from voice to text.',
      parameters: { type: 'object', properties: {} },
    },
    handler: () => {
      if (isCanvasChatSuppressed()) {
        return {
          ok: false,
          error: 'Canvas chat panel is disabled for this host (operator-only mode).',
        };
      }
      const result = showPanel('chat', 'tool');
      window.dispatchEvent(new CustomEvent('landi:focus-chat-input'));
      return result;
    },
  },
  {
    declaration: {
      name: 'dismiss_panel',
      description: 'Close a panel by id.',
      parameters: {
        type: 'object',
        properties: {
          panelId: { type: 'string', description: 'Registered panel id to close.' },
        },
        required: ['panelId'],
      },
    },
    handler: ({ panelId }) => {
      if (typeof panelId !== 'string' || panelId.length === 0) {
        return { ok: false, error: 'panelId must be a non-empty string' };
      }
      return hidePanel(panelId);
    },
  },
  {
    declaration: {
      name: 'share_artifact',
      description:
        'Add a generated artifact to the Artifacts panel for the user to review later.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short label for the artifact.' },
          content: { type: 'string', description: 'The artifact body.' },
          kind: { type: 'string', description: 'Optional artifact type label.' },
        },
        required: ['name', 'content'],
      },
    },
    handler: ({ name, content, kind }) => {
      if (typeof name !== 'string' || typeof content !== 'string') {
        return { ok: false, error: 'name and content must be strings' };
      }
      usePanelIntentStore.getState().pushArtifact({
        id: `art-${Date.now().toString(36)}`,
        name,
        content,
        kind: typeof kind === 'string' ? kind : 'note',
        createdAt: new Date().toISOString(),
      });
      const panelResult = showPanel('artifacts', 'tool');
      if (panelResult.ok) {
        return panelResult;
      }
      return {
        ok: true,
        result: `Saved artifact "${name}" (artifacts panel unavailable on this host).`,
      };
    },
  },
  {
    declaration: {
      name: 'knowledge_search',
      description:
        'Search the tenant knowledge base. Returns grounding chunks you can cite by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text query, 4-200 chars.' },
          topK: { type: 'number', description: 'How many chunks to return (1-10). Default 6.' },
        },
        required: ['query'],
      },
    },
    handler: async ({ query, topK }) => {
      if (typeof query !== 'string' || query.trim().length < 3) {
        return { ok: false, error: 'query must be a string of at least 3 chars' };
      }
      const k = Math.min(10, Math.max(1, typeof topK === 'number' ? topK : 6));
      const endpoint = (import.meta.env.VITE_KNOWLEDGE_SEARCH_URL as string | undefined)?.trim();
      if (!endpoint) {
        return {
          ok: false,
          error:
            'knowledge_search not configured (set VITE_KNOWLEDGE_SEARCH_URL). Answer from system-prompt facts only.',
        };
      }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: query.trim(), topK: k }),
        });
        if (!response.ok) {
          return { ok: false, error: `knowledge_search HTTP ${response.status}` };
        }
        const data: unknown = await response.json();
        return { ok: true, result: data };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message: String(err);
        return { ok: false, error: `knowledge_search failed: ${message}` };
      }
    },
  },
] as const;

function resolveActiveTools(): readonly ToolDefinition[] {
  const byName = new Map<string, ToolDefinition>();
  for (const tool of CANVAS_TOOLS) {
    byName.set(tool.declaration.name, tool);
  }
  for (const tool of DRAWING_TOOLS) {
    byName.set(tool.declaration.name, tool);
  }
  for (const tool of AUTHORING_TOOLKIT_TOOLS) {
    byName.set(tool.declaration.name, tool);
  }
  for (const tool of PERCEPTION_TOOLS) {
    byName.set(tool.declaration.name, tool);
  }
  for (const tool of WALKTHROUGH_TOOLS) {
    byName.set(tool.declaration.name, tool);
  }
  // Read host actions from globalThis directly so Vite duplicate module
  // instances (alias vs relative) still share one registration store.
  const hostRegistrations = (
    globalThis as typeof globalThis & {
      __agentable_host_action_registrations__?: (readonly ToolDefinition[])[];
    }
  ).__agentable_host_action_registrations__;
  const hostTools = Array.isArray(hostRegistrations) ? hostRegistrations.flat() : getHostActions();
  for (const tool of hostTools) {
    byName.set(tool.declaration.name, tool);
  }
  const merged = [...byName.values()];
  return filterCoreToolsForDomainRouting(merged);
}

/** Tools offered to models and voice/chat clients (engine draw gate). */
function resolveOfferedTools(): readonly ToolDefinition[] {
  const offers = gateToolsForEngineCapabilities(
    resolveActiveTools(),
    getEngineCapabilities());
  return selectEngineOfferedTools(offers);
}

export function getTool(name: string): ToolDefinition | undefined {
  return resolveActiveTools().find((t) => t.declaration.name === name);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>): Promise<ToolResult> {
  const actingAgentId = getAgentToolContext()?.agentId;
  const operatorModeDenial = evaluateOperatorModeToolDenial(name, actingAgentId);
  if (operatorModeDenial !== null) {
    return operatorModeDenial;
  }

  const tool = getTool(name);
  if (!tool) {
    const failure: ToolResult = { ok: false, error: `unknown tool "${name}"` };
    logToolCallDev({
      toolName: name,
      args: args ?? {},
      result: failure,
      agentId: actingAgentId,
      source: 'unknown',
    });
    return failure;
  }
  try {
    const result = await tool.handler(args ?? {});
    logToolCallDev({
      toolName: name,
      args: args ?? {},
      result,
      agentId: actingAgentId,
      source:
        actingAgentId?.includes('voice')
          ? 'voice': actingAgentId?.includes('chat')
            ? 'chat': 'unknown',
    });
    if (result.ok) {
      emitAgUiStatePatch(
        [{ op: 'replace', path: `/tools/${name}/lastResult`, value: result.result }],
        { source: 'tool', toolName: name });
    }
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message: String(err);
    const failure: ToolResult = { ok: false, error: `${name} threw: ${message}` };
    logToolCallDev({
      toolName: name,
      args: args ?? {},
      result: failure,
      agentId: actingAgentId,
    });
    return failure;
  }
}

export function getFunctionDeclarations(options?: { agentId?: string }): ToolDeclaration[] {
  const offered = resolveOfferedTools();
  const agentId = options?.agentId ?? getAgentToolContext()?.agentId;
  if (
    isOperatorModeEnforcementActive() &&
    agentId === OPERATOR_AGENT_ID
  ) {
    const allowed = new Set(getAllowedToolsForOperatorMode(getOperatorMode()));
    return offered.filter((tool) => allowed.has(tool.declaration.name)).map((tool) => tool.declaration);
  }
  return offered.map((tool) => tool.declaration);
}
