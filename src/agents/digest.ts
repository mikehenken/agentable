/**
 * Workspace world-model digest (D22, D43): attention-tiered, token-budgeted
 * context compiled from canvas/session truth. Agents receive deltas by default
 * and a full digest on demand.
 */
import type { ActivityEntry } from './activity';
import { cloneDigestShapeSummaries } from './digestShapes';
import type { AgentDrawShapeKind } from '../engine/agentDrawingTypes';
import type { AgentSessionKind, AgentSessionStatus } from './types';

export type AttentionTier = 'focused' | 'visible' | 'background';

export interface DigestUser {
  id: string;
  name?: string;
}

export interface DigestPanelSummary {
  id: string;
  type: string;
  title: string;
  dirty?: boolean;
  origin: 'host' | 'agent';
  minimized?: boolean;
}

export interface DigestContext {
  id: string;
  kind: string;
  label: string;
  attention: AttentionTier;
  panels: DigestPanelSummary[];
}

export interface DigestAgentSummary {
  id: string;
  kind: AgentSessionKind;
  label: string;
  scope?: string;
  status: Extract<AgentSessionStatus, 'idle' | 'running' | 'waiting_approval'> | AgentSessionStatus;
  task?: string;
}

export interface DigestJobSummary {
  id: string;
  capability: string;
  scope: string;
  status: string;
  progress?: number;
}

export interface DigestPendingApproval {
  id: string;
  agentId: string;
  panelId: string;
  summary: string;
}

export interface DigestActivitySummary {
  ts: string;
  actor: string;
  verb: string;
  target: string;
}

/** Compact canvas mark summary for agent/user drawings (D41, P8-T4). */
export interface DigestShapeSummary {
  id: string;
  nativeType: string;
  kind?: AgentDrawShapeKind | 'annotation';
  label: string;
  agentId?: string;
  userAuthored?: boolean;
  attention?: AttentionTier;
  /** Stable fingerprint for delta diffing. */
  revision: string;
}

export interface WorkspaceDigest {
  user: DigestUser;
  contexts: DigestContext[];
  agents: DigestAgentSummary[];
  jobs: DigestJobSummary[];
  pendingApprovals: DigestPendingApproval[];
  recentActivity: DigestActivitySummary[];
  /** Agent and user canvas drawings summarized for digest delivery. */
  shapes: DigestShapeSummary[];
}

/** Viewport/selection inputs used to derive attention tiers (D22). */
export interface AttentionInput {
  contextId: string;
  selected?: boolean;
  beingEdited?: boolean;
  intersectsViewport?: boolean;
}

export type DigestBudgetDrop =
  | 'recentActivity'
  | 'backgroundContexts'
  | 'backgroundPanels'
  | 'backgroundShapes'
  | 'userShapes'
  | 'shapes'
  | 'jobs'
  | 'pendingApprovals';

export interface DigestBudgetOptions {
  /** Soft target (~1.5k tokens). */
  targetTokens?: number;
  /** Hard cap (3k tokens). */
  hardCapTokens?: number;
}

export interface DigestCompileResult {
  digest: WorkspaceDigest;
  estimatedTokens: number;
  dropped: DigestBudgetDrop[];
  capped: boolean;
}

export interface DigestDelta {
  /** Whether anything changed since the prior digest. */
  changed: boolean;
  addedContexts: string[];
  removedContexts: string[];
  attentionChanges: Array<{ id: string; from: AttentionTier; to: AttentionTier }>;
  agentStatusChanges: Array<{ id: string; from: string; to: string }>;
  newActivity: DigestActivitySummary[];
  newJobs: string[];
  newApprovals: string[];
  newShapes: string[];
  changedShapes: string[];
  removedShapes: string[];
  /** Compact digest containing only changed slices (D43 default delivery). */
  patch: Partial<WorkspaceDigest>;
}

export interface DigestCompilerInput {
  user: DigestUser;
  contexts: DigestContext[];
  agents: DigestAgentSummary[];
  jobs?: DigestJobSummary[];
  pendingApprovals?: DigestPendingApproval[];
  recentActivity?: DigestActivitySummary[] | readonly ActivityEntry[];
  /** Change-batch id; cache hits when unchanged. */
  changeBatchId?: string;
  /** Canvas drawing summaries from the host shape collector (P8-T4). */
  shapes?: DigestShapeSummary[];
}

export interface DigestCompiler {
  compile(input: DigestCompilerInput, options?: DigestBudgetOptions): DigestCompileResult;
  /** Full digest (bypasses last-turn delta path). */
  full(input: DigestCompilerInput, options?: DigestBudgetOptions): DigestCompileResult;
  /** Delta vs the last compiled digest for `agentId` (D43). */
  deltaFor(agentId: string, input: DigestCompilerInput, options?: DigestBudgetOptions): {
    result: DigestCompileResult;
    delta: DigestDelta;
  };
  clearCache(): void;
  getLastDigest(agentId?: string): WorkspaceDigest | undefined;
}

export const DIGEST_TARGET_TOKENS = 1_500;
export const DIGEST_HARD_CAP_TOKENS = 3_000;
export const DIGEST_RECENT_ACTIVITY_LIMIT = 15;

/** Rough token estimate: UTF-16 code units / 4 (stable for unit budgets). */
export function estimateDigestTokens(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return 0;
  return Math.ceil(serialized.length / 4);
}

/**
 * Attention derivation mirrors tldraw agent-kit tiers:
 * focused = selected/being-edited; visible = intersects viewport; else background.
 */
export function deriveAttention(input: AttentionInput): AttentionTier {
  if (input.selected === true || input.beingEdited === true) return 'focused';
  if (input.intersectsViewport === true) return 'visible';
  return 'background';
}

function toActivitySummary(
  entry: DigestActivitySummary | ActivityEntry,
): DigestActivitySummary {
  return {
    ts: entry.ts,
    actor: String(entry.actor),
    verb: entry.verb,
    target: entry.target,
  };
}

function normalizeInput(input: DigestCompilerInput): WorkspaceDigest {
  const recent = (input.recentActivity ?? [])
    .map(toActivitySummary)
    .slice(-DIGEST_RECENT_ACTIVITY_LIMIT);

  return {
    user: { ...input.user },
    contexts: input.contexts.map((context) => ({
      ...context,
      panels: context.panels.map((panel) => ({ ...panel })),
    })),
    agents: input.agents.map((agent) => ({ ...agent })),
    jobs: (input.jobs ?? []).map((job) => ({ ...job })),
    pendingApprovals: (input.pendingApprovals ?? []).map((approval) => ({ ...approval })),
    recentActivity: recent,
    shapes: cloneDigestShapeSummaries(input.shapes ?? []),
  };
}

function cloneDigest(digest: WorkspaceDigest): WorkspaceDigest {
  return normalizeInput(digest);
}

/**
 * Apply token budget. Drop order (03 section 3.1):
 * 1. recentActivity
 * 2. background contexts (entire context)
 * 3. remaining background panels (defensive)
 * 4. jobs / pendingApprovals if still over hard cap
 */
export function applyDigestBudget(
  digest: WorkspaceDigest,
  options: DigestBudgetOptions = {},
): DigestCompileResult {
  const targetTokens = options.targetTokens ?? DIGEST_TARGET_TOKENS;
  const hardCapTokens = options.hardCapTokens ?? DIGEST_HARD_CAP_TOKENS;
  const working = cloneDigest(digest);
  const dropped: DigestBudgetDrop[] = [];

  const overTarget = (): boolean => estimateDigestTokens(working) > targetTokens;
  const overHard = (): boolean => estimateDigestTokens(working) > hardCapTokens;

  if (overTarget() && working.recentActivity.length > 0) {
    working.recentActivity = [];
    dropped.push('recentActivity');
  }

  if (overTarget()) {
    const kept = working.contexts.filter((context) => context.attention !== 'background');
    if (kept.length !== working.contexts.length) {
      working.contexts = kept;
      dropped.push('backgroundContexts');
    }
  }

  if (overTarget()) {
    let trimmedPanels = false;
    working.contexts = working.contexts.map((context) => {
      if (context.attention !== 'background') return context;
      if (context.panels.length === 0) return context;
      trimmedPanels = true;
      return { ...context, panels: [] };
    });
    if (trimmedPanels) {
      dropped.push('backgroundPanels');
    }
  }

  if (overTarget() && working.shapes.length > 0) {
    const kept = working.shapes.filter((shape) => shape.attention !== 'background');
    if (kept.length !== working.shapes.length) {
      working.shapes = kept;
      dropped.push('backgroundShapes');
    }
  }

  if (overTarget() && working.shapes.length > 0) {
    const agentOnly = working.shapes.filter((shape) => shape.agentId !== undefined);
    if (agentOnly.length !== working.shapes.length) {
      working.shapes = agentOnly;
      dropped.push('userShapes');
    }
  }

  if (overHard() && working.shapes.length > 0) {
    working.shapes = [];
    dropped.push('shapes');
  }

  if (overHard() && working.jobs.length > 0) {
    working.jobs = [];
    dropped.push('jobs');
  }

  if (overHard() && working.pendingApprovals.length > 0) {
    working.pendingApprovals = [];
    dropped.push('pendingApprovals');
  }

  const estimatedTokens = estimateDigestTokens(working);
  return {
    digest: working,
    estimatedTokens,
    dropped,
    capped: estimatedTokens > hardCapTokens || dropped.length > 0,
  };
}

export function computeDigestDelta(
  previous: WorkspaceDigest | undefined,
  current: WorkspaceDigest,
): DigestDelta {
  if (previous === undefined) {
    return {
      changed: true,
      addedContexts: current.contexts.map((context) => context.id),
      removedContexts: [],
      attentionChanges: [],
      agentStatusChanges: [],
      newActivity: [...current.recentActivity],
      newJobs: current.jobs.map((job) => job.id),
      newApprovals: current.pendingApprovals.map((approval) => approval.id),
      newShapes: current.shapes.map((shape) => shape.id),
      changedShapes: [],
      removedShapes: [],
      patch: cloneDigest(current),
    };
  }

  const prevContexts = new Map(previous.contexts.map((context) => [context.id, context]));
  const currContexts = new Map(current.contexts.map((context) => [context.id, context]));
  const addedContexts = current.contexts
    .filter((context) => !prevContexts.has(context.id))
    .map((context) => context.id);
  const removedContexts = previous.contexts
    .filter((context) => !currContexts.has(context.id))
    .map((context) => context.id);

  const attentionChanges: DigestDelta['attentionChanges'] = [];
  for (const context of current.contexts) {
    const prior = prevContexts.get(context.id);
    if (prior !== undefined && prior.attention !== context.attention) {
      attentionChanges.push({
        id: context.id,
        from: prior.attention,
        to: context.attention,
      });
    }
  }

  const prevAgents = new Map(previous.agents.map((agent) => [agent.id, agent]));
  const agentStatusChanges: DigestDelta['agentStatusChanges'] = [];
  for (const agent of current.agents) {
    const prior = prevAgents.get(agent.id);
    if (prior !== undefined && prior.status !== agent.status) {
      agentStatusChanges.push({
        id: agent.id,
        from: prior.status,
        to: agent.status,
      });
    }
  }

  const prevActivityKeys = new Set(
    previous.recentActivity.map((entry) => `${entry.ts}|${entry.actor}|${entry.verb}|${entry.target}`),
  );
  const newActivity = current.recentActivity.filter(
    (entry) => !prevActivityKeys.has(`${entry.ts}|${entry.actor}|${entry.verb}|${entry.target}`),
  );

  const prevJobs = new Set(previous.jobs.map((job) => job.id));
  const newJobs = current.jobs.filter((job) => !prevJobs.has(job.id)).map((job) => job.id);

  const prevApprovals = new Set(previous.pendingApprovals.map((approval) => approval.id));
  const newApprovals = current.pendingApprovals
    .filter((approval) => !prevApprovals.has(approval.id))
    .map((approval) => approval.id);

  const prevShapes = new Map(previous.shapes.map((shape) => [shape.id, shape]));
  const currShapes = new Map(current.shapes.map((shape) => [shape.id, shape]));
  const newShapes = current.shapes
    .filter((shape) => !prevShapes.has(shape.id))
    .map((shape) => shape.id);
  const removedShapes = previous.shapes
    .filter((shape) => !currShapes.has(shape.id))
    .map((shape) => shape.id);
  const changedShapes = current.shapes
    .filter((shape) => {
      const prior = prevShapes.get(shape.id);
      return prior !== undefined && prior.revision !== shape.revision;
    })
    .map((shape) => shape.id);

  const changed =
    addedContexts.length > 0 ||
    removedContexts.length > 0 ||
    attentionChanges.length > 0 ||
    agentStatusChanges.length > 0 ||
    newActivity.length > 0 ||
    newJobs.length > 0 ||
    newApprovals.length > 0 ||
    newShapes.length > 0 ||
    changedShapes.length > 0 ||
    removedShapes.length > 0 ||
    previous.user.id !== current.user.id;

  const patch: Partial<WorkspaceDigest> = {};
  if (addedContexts.length > 0 || attentionChanges.length > 0 || removedContexts.length > 0) {
    patch.contexts = current.contexts.filter(
      (context) =>
        addedContexts.includes(context.id) ||
        attentionChanges.some((change) => change.id === context.id),
    );
  }
  if (agentStatusChanges.length > 0) {
    patch.agents = current.agents.filter((agent) =>
      agentStatusChanges.some((change) => change.id === agent.id),
    );
  }
  if (newActivity.length > 0) patch.recentActivity = newActivity;
  if (newJobs.length > 0) {
    patch.jobs = current.jobs.filter((job) => newJobs.includes(job.id));
  }
  if (newApprovals.length > 0) {
    patch.pendingApprovals = current.pendingApprovals.filter((approval) =>
      newApprovals.includes(approval.id),
    );
  }
  if (newShapes.length > 0 || changedShapes.length > 0) {
    patch.shapes = current.shapes.filter(
      (shape) => newShapes.includes(shape.id) || changedShapes.includes(shape.id),
    );
  }

  return {
    changed,
    addedContexts,
    removedContexts,
    attentionChanges,
    agentStatusChanges,
    newActivity,
    newJobs,
    newApprovals,
    newShapes,
    changedShapes,
    removedShapes,
    patch,
  };
}

export function compileWorkspaceDigest(
  input: DigestCompilerInput,
  options?: DigestBudgetOptions,
): DigestCompileResult {
  return applyDigestBudget(normalizeInput(input), options);
}

export function createDigestCompiler(): DigestCompiler {
  let lastBatchId: string | undefined;
  let lastCompiled: DigestCompileResult | undefined;
  const perAgent = new Map<string, WorkspaceDigest>();

  const compileFresh = (
    input: DigestCompilerInput,
    options?: DigestBudgetOptions,
  ): DigestCompileResult => {
    if (
      input.changeBatchId !== undefined &&
      input.changeBatchId === lastBatchId &&
      lastCompiled !== undefined
    ) {
      return {
        digest: cloneDigest(lastCompiled.digest),
        estimatedTokens: lastCompiled.estimatedTokens,
        dropped: [...lastCompiled.dropped],
        capped: lastCompiled.capped,
      };
    }
    const result = compileWorkspaceDigest(input, options);
    lastBatchId = input.changeBatchId;
    lastCompiled = result;
    return result;
  };

  return {
    compile: compileFresh,
    full: compileFresh,
    deltaFor(agentId, input, options) {
      const result = compileFresh(input, options);
      const previous = perAgent.get(agentId);
      const delta = computeDigestDelta(previous, result.digest);
      perAgent.set(agentId, cloneDigest(result.digest));
      return { result, delta };
    },
    clearCache() {
      lastBatchId = undefined;
      lastCompiled = undefined;
      perAgent.clear();
    },
    getLastDigest(agentId) {
      if (agentId !== undefined) {
        const digest = perAgent.get(agentId);
        return digest !== undefined ? cloneDigest(digest) : undefined;
      }
      return lastCompiled !== undefined ? cloneDigest(lastCompiled.digest) : undefined;
    },
  };
}
