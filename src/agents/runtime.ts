/**
 * Host-facing agent runtime facade (`host.agents`,–).
 *
 * Composes model sessions with the workspace world model: registry, activity,
 * leases, camera politeness, budget signal, digest compiler, and drill-downs.
 */
import { createActivityLog, type ActivityLog } from './activity';
import { createAgentBudget, type AgentBudgetSignal } from './budget';
import { createCameraQueue, type CameraQueue } from './camera';
import { createDigestCompiler, type DigestCompiler, type DigestCompilerInput } from './digest';
import { getEngineDigestShapeSlice } from './engineBridge';
import { bindDrawingActivityLog } from './drawingActivity';
import { createDrillDownTools, type DrillDownHost } from './drillDowns';
import { createHandoff, type HandoffInput, type HandoffResult } from './handoff';
import { createLeaseManager, type LeaseClaimInput, type LeaseClaimResult, type LeaseManager } from './leases';
import { registerModelResolver } from './modelResolver';
import {
  createAgentRegistry,
  type AgentRegistry,
  type AgentRegistryEntry,
  type AgentRegistryRegisterInput,
} from './registry';
import { createAgentSession } from './session';
import type {
  CreateAgentSessionOptions,
  AgentSession,
  ModelResolver,
} from './types';
import type { ToolDefinition, ToolResult } from '../panels/tools';
import {
  createAgentToolExecutor,
  type AgentToolExecutor,
} from './toolExecutor';
import type { AgentToolExecutionContext } from './agentContext';
import type { TelemetryEmit } from '../telemetry';
import { wrapBudgetWithTelemetry } from '../telemetry/budgetBridge';

export interface AgentRuntimeOptions {
  activity?: ActivityLog;
  registry?: AgentRegistry;
  leases?: LeaseManager;
  camera?: CameraQueue;
  budget?: AgentBudgetSignal;
  digest?: DigestCompiler;
  /** Optional live digest input resolver for drill-downs / compile helpers. */
  resolveDigestInput?: () => DigestCompilerInput;
  getPanelState?: (panelId: string) => Record<string, unknown> | null;
 /** Scoped panel/host tools for enforcement. When omitted, uses live host actions. */
  tools?: readonly ToolDefinition[];
 /** Resolve open instance ids to definition ids for panel scope enforcement. */
  resolvePanelDefinitionId?: (panelId: string) => string | undefined;
 /** Host telemetry sink for tool latency/error and cost events. */
  telemetryEmit?: TelemetryEmit;
}

export interface AgentRuntime {
  registerModelResolver(resolver: ModelResolver): () => void;
  createSession(options: CreateAgentSessionOptions): Promise<AgentSession>;
  /** Register agent presence for the world-model digest (03 section 3.2). */
  register(input: AgentRegistryRegisterInput): AgentRegistryEntry;
  claim(input: LeaseClaimInput): LeaseClaimResult;
  handoff(input: HandoffInput): HandoffResult;
  /** Bound drill-down ToolDefinitions (read / free-fire). */
  createDrillDownTools(): ToolDefinition[];
 /** Execute a registered tool with role-scope enforcement and attribution. */
  executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: AgentToolExecutionContext,
  ): Promise<ToolResult>;
  readonly registry: AgentRegistry;
  readonly activity: ActivityLog;
  readonly leases: LeaseManager;
  readonly camera: CameraQueue;
  readonly budget: AgentBudgetSignal;
  readonly digest: DigestCompiler;
}

export function createAgentRuntime(options: AgentRuntimeOptions = {}): AgentRuntime {
  const activity = options.activity ?? createActivityLog();
  const registry = options.registry ?? createAgentRegistry();
  const leases = options.leases ?? createLeaseManager();
  const camera = options.camera ?? createCameraQueue();
  const baseBudget = options.budget ?? createAgentBudget();
  const budget =
    options.telemetryEmit !== undefined
      ? wrapBudgetWithTelemetry(baseBudget, options.telemetryEmit)
      : baseBudget;
  const digest = options.digest ?? createDigestCompiler();
  bindDrawingActivityLog(activity);

  const mergeDigestInput = (base: DigestCompilerInput): DigestCompilerInput => {
    const shapeSlice = getEngineDigestShapeSlice();
    if (shapeSlice === null) {
      return base;
    }
    return {
      ...base,
      shapes: shapeSlice.shapes,
      changeBatchId:
        base.changeBatchId !== undefined
          ? `${base.changeBatchId}|${shapeSlice.changeBatchId}`
          : shapeSlice.changeBatchId,
    };
  };

  const resolveLiveDigestInput = (): DigestCompilerInput => {
    if (options.resolveDigestInput !== undefined) {
      return mergeDigestInput(options.resolveDigestInput());
    }
    const agents = registry.list().map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      label: entry.label,
      scope: entry.scope,
      status: entry.status,
      task: entry.task,
    }));
    return mergeDigestInput({
      user: { id: 'anonymous' },
      contexts: [],
      agents,
      recentActivity: activity.getEntries({ limit: 15 }),
    });
  };

  const getDigest = (): ReturnType<DigestCompiler['compile']>['digest'] => {
    return digest.compile(resolveLiveDigestInput()).digest;
  };

  const drillDownHost: DrillDownHost = {
    registry,
    activity,
    digest,
    getDigest,
    getPanelState: options.getPanelState,
  };

  const toolExecutor: AgentToolExecutor = createAgentToolExecutor({
    registry,
    activity,
    tools: options.tools,
    resolvePanelDefinitionId: options.resolvePanelDefinitionId,
    telemetryEmit: options.telemetryEmit,
    budget,
  });

  return {
    registerModelResolver(resolver: ModelResolver): () => void {
      return registerModelResolver(resolver);
    },

    async createSession(sessionOptions: CreateAgentSessionOptions): Promise<AgentSession> {
      const session = await createAgentSession(sessionOptions);
      registry.register({
        id: session.agentId,
        kind: session.kind,
        label: session.label,
        transport: 'session',
        capabilities: [],
      });
      return session;
    },

    register(input: AgentRegistryRegisterInput): AgentRegistryEntry {
      return registry.register(input);
    },

    claim(input: LeaseClaimInput): LeaseClaimResult {
      const result = leases.claim(input);
      if (!result.ok && result.reason === 'conflict') {
 // Advisory soft lease: warn in activity, do not block callers.
        activity.append({
          actor: input.source,
          verb: 'lease_conflict',
          target: input.scope,
          provenance: { derivedFrom: `agent:${input.source}` },
          reversal: { reversible: false, persisted: false },
        });
      }
      return result;
    },

    handoff(input: HandoffInput): HandoffResult {
      return createHandoff(input, { registry, activity });
    },

    createDrillDownTools(): ToolDefinition[] {
      return createDrillDownTools(drillDownHost);
    },

    executeTool(
      toolName: string,
      args: Record<string, unknown>,
      context: AgentToolExecutionContext,
    ): Promise<ToolResult> {
      return toolExecutor.execute(toolName, args, context);
    },

    registry,
    activity,
    leases,
    camera,
    budget,
    digest,
  };
}
