/**
 * Scoped agent tool execution: role allow-lists enforced before handlers run.
 */
import type { ToolDefinition, ToolResult } from '../panels/tools';
import { getHostActions } from '../panels/tools';
import {
  buildToolTelemetryEvent,
  extractToolErrorCodes,
  type TelemetryEmit,
} from '../telemetry';
import {
  getAgentToolContext,
  resolveAgentLabel,
  withAgentToolContextAsync,
  type AgentToolExecutionContext,
} from './agentContext';
import type { ActivityLog } from './activity';
import type { AgentBudgetSignal, BudgetSpendRecord } from './budget';
import { CHEAP_DEFAULT_UNITS, EXPENSIVE_DEFAULT_UNITS } from './budget';
import type { AgentRegistry } from './registry';
import {
  evaluateOperatorModeToolDenial,
} from './surface/operatorModeBridge';

export const SCOPE_DENIED_CODE = 'SCOPE_DENIED';

export interface AgentToolExecutorOptions {
  registry: AgentRegistry;
  activity?: ActivityLog;
  /** When set, only these tools are considered (e.g. panel tools on a host). */
  tools?: readonly ToolDefinition[];
  /** Resolve instance ids to definition ids for panel scope checks. */
  resolvePanelDefinitionId?: (panelId: string) => string | undefined;
  /** Host telemetry sink hook for tool latency + frozen error codes. */
  telemetryEmit?: TelemetryEmit;
  /** Optional budget signal for costClass spend recording ( ). */
  budget?: AgentBudgetSignal;
}

export interface AgentToolExecutor {
  execute(
    toolName: string,
    args: Record<string, unknown>,
    context: AgentToolExecutionContext): Promise<ToolResult>;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value: undefined;
}

function resolveTool(name: string, tools?: readonly ToolDefinition[]): ToolDefinition | undefined {
  const catalog = tools ?? getHostActions();
  return catalog.find((entry) => entry.declaration.name === name);
}

function panelIdFromArgs(toolName: string, args: Record<string, unknown>): string | undefined {
  if (toolName === 'open_panel' || toolName === 'fill_panel') {
    return readString(args.id);
  }
  if (toolName === 'run_panel_action' || toolName === 'patch_panel') {
    return readString(args.panelId);
  }
  if (toolName === 'describe_panel') {
    return readString(args.panelId);
  }
  return undefined;
}

function panelScopeTarget(
  toolName: string,
  args: Record<string, unknown>,
  resolvePanelDefinitionId?: (panelId: string) => string | undefined): string | undefined {
  const raw = panelIdFromArgs(toolName, args);
  if (raw === undefined) return undefined;
  const resolved = resolvePanelDefinitionId?.(raw);
  return resolved ?? raw;
}

function slotFromArgs(args: Record<string, unknown>): string | undefined {
  if (!args.scope || typeof args.scope !== 'object' || Array.isArray(args.scope)) {
    return undefined;
  }
  const scope = args.scope as Record<string, unknown>;
  return readString(scope.slot);
}

function emitToolTelemetry(
  telemetryEmit: TelemetryEmit | undefined,
  input: {
    toolName: string;
    agentId: string;
    latencyMs: number;
    result: ToolResult;
  }): void {
  if (telemetryEmit === undefined) {
    return;
  }
  const errorCodes = extractToolErrorCodes(input.result);
  telemetryEmit(
    buildToolTelemetryEvent({
      toolName: input.toolName,
      agentId: input.agentId,
      latencyMs: input.latencyMs,
      outcome: errorCodes.length > 0 ? 'error': 'success',...(errorCodes.length > 0 ? { errorCodes }: {}),
    }));
}

function recordToolSpend(
  budget: AgentBudgetSignal | undefined,
  tool: ToolDefinition,
  toolName: string,
  agentId: string): BudgetSpendRecord | undefined {
  const costClass = tool.declaration.costClass;
  if (budget === undefined || costClass === undefined) {
    return undefined;
  }
  const units =
    costClass === 'expensive' ? EXPENSIVE_DEFAULT_UNITS: CHEAP_DEFAULT_UNITS;
  return budget.record({
    agentId,
    capability: toolName,
    costClass,
    units,
  });
}

export function createAgentToolExecutor(options: AgentToolExecutorOptions): AgentToolExecutor {
  const { registry, activity, telemetryEmit, budget } = options;

  return {
    async execute(
      toolName: string,
      args: Record<string, unknown>,
      context: AgentToolExecutionContext): Promise<ToolResult> {
      const startedAt = Date.now();
      const label = context.agentLabel || resolveAgentLabel(registry, context.agentId);

      if (!registry.isToolAllowed(context.agentId, toolName)) {
        activity?.append({
          actor: `agent:${context.agentId}`,
          verb: 'tool_scope_denied',
          target: toolName,
          provenance: { derivedFrom: `agent:${context.agentId}` },
          reversal: { reversible: false, persisted: false },
        });
        const result: ToolResult = {
          ok: false,
          error: `${SCOPE_DENIED_CODE}: agent "${label}" is not allowed to call "${toolName}"`,
        };
        emitToolTelemetry(telemetryEmit, {
          toolName,
          agentId: context.agentId,
          latencyMs: Date.now() - startedAt,
          result,
        });
        return result;
      }

      const operatorModeDenial = evaluateOperatorModeToolDenial(toolName, context.agentId);
      if (operatorModeDenial !== null) {
        activity?.append({
          actor: `agent:${context.agentId}`,
          verb: 'operator_mode_scope_denied',
          target: toolName,
          provenance: { derivedFrom: `agent:${context.agentId}` },
          reversal: { reversible: false, persisted: false },
        });
        emitToolTelemetry(telemetryEmit, {
          toolName,
          agentId: context.agentId,
          latencyMs: Date.now() - startedAt,
          result: operatorModeDenial,
        });
        return operatorModeDenial;
      }

      const panelTarget = panelScopeTarget(
        toolName,
        args,
        options.resolvePanelDefinitionId);
      if (panelTarget !== undefined && !registry.isPanelAllowed(context.agentId, panelTarget)) {
        activity?.append({
          actor: `agent:${context.agentId}`,
          verb: 'panel_scope_denied',
          target: panelTarget,
          provenance: { derivedFrom: `agent:${context.agentId}` },
          reversal: { reversible: false, persisted: false },
        });
        const result: ToolResult = {
          ok: false,
          error: `${SCOPE_DENIED_CODE}: agent "${label}" may not access panel "${panelTarget}"`,
        };
        emitToolTelemetry(telemetryEmit, {
          toolName,
          agentId: context.agentId,
          latencyMs: Date.now() - startedAt,
          result,
        });
        return result;
      }

      const slotTarget = slotFromArgs(args);
      if (slotTarget !== undefined && !registry.isSlotAllowed(context.agentId, slotTarget)) {
        activity?.append({
          actor: `agent:${context.agentId}`,
          verb: 'slot_scope_denied',
          target: slotTarget,
          provenance: { derivedFrom: `agent:${context.agentId}` },
          reversal: { reversible: false, persisted: false },
        });
        const result: ToolResult = {
          ok: false,
          error: `${SCOPE_DENIED_CODE}: agent "${label}" may not use slot "${slotTarget}"`,
        };
        emitToolTelemetry(telemetryEmit, {
          toolName,
          agentId: context.agentId,
          latencyMs: Date.now() - startedAt,
          result,
        });
        return result;
      }

      const tool = resolveTool(toolName, options.tools);
      if (tool === undefined) {
        const result: ToolResult = { ok: false, error: `unknown tool "${toolName}"` };
        emitToolTelemetry(telemetryEmit, {
          toolName,
          agentId: context.agentId,
          latencyMs: Date.now() - startedAt,
          result,
        });
        return result;
      }

      const executionContext: AgentToolExecutionContext = {
        agentId: context.agentId,
        agentLabel: label,
      };

      return withAgentToolContextAsync(executionContext, async () => {
        activity?.append({
          actor: `agent:${context.agentId}`,
          verb: 'tool_call',
          target: toolName,
          provenance: { derivedFrom: `agent:${context.agentId}` },
          reversal: { reversible: false, persisted: false },
        });

        try {
          const result = await tool.handler(args ?? {});
          const errorCodes = extractToolErrorCodes(result);
          if (errorCodes.length === 0) {
            recordToolSpend(budget, tool, toolName, context.agentId);
          }
          emitToolTelemetry(telemetryEmit, {
            toolName,
            agentId: context.agentId,
            latencyMs: Date.now() - startedAt,
            result,
          });
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message: String(err);
          const result: ToolResult = { ok: false, error: `${toolName} threw: ${message}` };
          emitToolTelemetry(telemetryEmit, {
            toolName,
            agentId: context.agentId,
            latencyMs: Date.now() - startedAt,
            result,
          });
          return result;
        }
      });
    },
  };
}

/** Read the active agent context when handlers run inside `createAgentToolExecutor`. */
export function requireAgentToolContext(): AgentToolExecutionContext {
  const ctx = getAgentToolContext;
  if (ctx === null) {
    throw new Error('agent tool context is required for this operation');
  }
  return ctx;
}
