/**
 * Agent session factory. Sessions bind to opaque model aliases and
 * resolve provider metadata through the host resolver at the runtime boundary.
 */
import { transportNotesForBinding } from './capabilities';
import { resolveModelBinding } from './modelResolver';
import type {
  AgentSession,
  AgentSessionKind,
  AgentSessionStatus,
  CapabilityNote,
  CreateAgentSessionOptions,
  ModelCapabilities,
  ResolvedModelBinding,
} from './types';

function defaultLabel(agentId: string, kind: AgentSessionKind): string {
  return `${kind}:${agentId}`;
}

class AgentSessionImpl implements AgentSession {
  readonly agentId: string;
  readonly kind: AgentSessionKind;
  readonly label: string;
  private readonly tenantId?: string;
  private readonly requiredCaps?: Partial<ModelCapabilities>;
  requestedAlias: string;
  resolvedAlias: string;
  binding: ResolvedModelBinding['binding'];
  fallbackUsed: boolean;
  notes: ResolvedModelBinding['notes'];
  status: AgentSessionStatus;

  constructor(
    options: CreateAgentSessionOptions,
    resolved: ResolvedModelBinding) {
    this.agentId = options.agentId;
    this.kind = options.kind ?? 'chat';
    this.label = options.label ?? defaultLabel(options.agentId, this.kind);
    this.tenantId = options.tenantId;
    this.requiredCaps = options.requiredCaps;
    this.requestedAlias = resolved.requestedAlias;
    this.resolvedAlias = resolved.resolvedAlias;
    this.binding = resolved.binding;
    this.fallbackUsed = resolved.fallbackUsed;
    this.notes = mergeSessionNotes(resolved.notes, resolved.binding);
    this.status = 'idle';
  }

  async rebindModel(alias: string): Promise<void> {
    const resolved = await resolveModelBinding(
      alias,
      {
        tenantId: this.tenantId,
        agentId: this.agentId,
      },
      { requiredCaps: this.requiredCaps });
    this.requestedAlias = resolved.requestedAlias;
    this.resolvedAlias = resolved.resolvedAlias;
    this.binding = resolved.binding;
    this.fallbackUsed = resolved.fallbackUsed;
    this.notes = mergeSessionNotes(resolved.notes, resolved.binding);
  }
}

function mergeSessionNotes(
  resolveNotes: readonly CapabilityNote[],
  binding: ResolvedModelBinding['binding']): CapabilityNote[] {
  return [...resolveNotes,...transportNotesForBinding(binding)];
}

export async function createAgentSession(
  options: CreateAgentSessionOptions): Promise<AgentSession> {
  const resolved = await resolveModelBinding(options.modelAlias, {
    tenantId: options.tenantId,
    agentId: options.agentId,
  }, { requiredCaps: options.requiredCaps });

  return new AgentSessionImpl(options, resolved);
}
