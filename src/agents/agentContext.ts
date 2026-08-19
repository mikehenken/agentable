/**
 * Acting-agent context for tool execution.
 *
 * Threaded through panel tool handlers so mutations, HITL requests, and field
 * fills carry stable agent identity without polluting tool argument schemas.
 */
export interface AgentToolExecutionContext {
  agentId: string;
  agentLabel: string;
}

let activeContext: AgentToolExecutionContext | null = null;

export function withAgentToolContext<T>(
  context: AgentToolExecutionContext,
  fn: () => T,
): T {
  const previous = activeContext;
  activeContext = context;
  try {
    return fn();
  } finally {
    activeContext = previous;
  }
}

export async function withAgentToolContextAsync<T>(
  context: AgentToolExecutionContext,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = activeContext;
  activeContext = context;
  try {
    return await fn();
  } finally {
    activeContext = previous;
  }
}

export function getAgentToolContext(): AgentToolExecutionContext | null {
  return activeContext;
}

export function resolveAgentLabel(
  registry: { get(agentId: string): { label: string } | undefined },
  agentId: string,
): string {
  return registry.get(agentId)?.label ?? agentId;
}

export function toApprovalActor(agentId: string): `agent:${string}` {
  return agentId.startsWith('agent:') ? (agentId as `agent:${string}`) : `agent:${agentId}`;
}

export function approvalActorAgentId(actor: string): string | undefined {
  if (actor === 'agent') return 'default';
  if (actor.startsWith('agent:')) return actor.slice('agent:'.length);
  if (actor === 'user') return undefined;
  return actor;
}
