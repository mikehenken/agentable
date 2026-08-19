/**
 * Model-agnostic agent runtime types.
 * Aliases are opaque client-safe strings; provider ids, model names, and
 * keys resolve only through a host-supplied resolver.
 */

/** Resolved server-side capabilities for a provider binding. */
export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  contextTokens: number;
  streaming: boolean;
}

/** Host-resolved provider binding for an alias. */
export interface ProviderBinding {
  providerId: string;
  model: string;
  caps: ModelCapabilities;
  /**
   * Ordered alias chain tried when this binding is unavailable or its caps
 * do not satisfy the session's requirements.
   */
  fallback?: readonly string[];
  /**
   * When false, resolution falls through to `fallback` without treating this
   * binding as usable. Defaults to true.
   */
  available?: boolean;
}

export interface ModelResolveContext {
  tenantId?: string;
  agentId?: string;
}

export type ModelResolver = (
  alias: string,
  ctx: ModelResolveContext,
) => Promise<ProviderBinding>;

export interface ResolvedModelBinding {
  /** Alias that ultimately supplied the binding (after fallback). */
  resolvedAlias: string;
  /** Alias requested by the session or config layer. */
  requestedAlias: string;
  binding: ProviderBinding;
  /** True when `resolvedAlias` differs from `requestedAlias`. */
  fallbackUsed: boolean;
  notes: readonly CapabilityNote[];
}

export interface CapabilityNote {
  code: CapabilityNoteCode;
  message: string;
  /** Alias that failed before fallback advanced. */
  alias?: string;
}

export type CapabilityNoteCode =
  | 'MODEL_UNAVAILABLE'
  | 'CAPABILITY_MISMATCH'
  | 'ENGINE_CAPABILITY_MISMATCH'
  | 'TOOL_DEGRADED'
  | 'BUFFERED_TURNS';

export type AgentSessionKind = 'chat' | 'voice' | 'background';

export type AgentSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'done'
  | 'cancelled';

export interface CreateAgentSessionOptions {
  agentId: string;
  modelAlias: string;
  kind?: AgentSessionKind;
  tenantId?: string;
  label?: string;
 /** Minimum capabilities required for this session (gating). */
  requiredCaps?: Partial<ModelCapabilities>;
}

export interface AgentSession {
  readonly agentId: string;
  readonly kind: AgentSessionKind;
  readonly label: string;
  readonly requestedAlias: string;
  readonly resolvedAlias: string;
  readonly binding: ProviderBinding;
  readonly fallbackUsed: boolean;
  readonly notes: readonly CapabilityNote[];
  status: AgentSessionStatus;
  /** Re-resolve the session against a new alias without changing agent id. */
  rebindModel(alias: string): Promise<void>;
}

export class ModelResolveError extends Error {
  readonly code: 'NO_RESOLVER' | 'RESOLVE_EXHAUSTED';

  constructor(code: 'NO_RESOLVER' | 'RESOLVE_EXHAUSTED', message: string) {
    super(message);
    this.name = 'ModelResolveError';
    this.code = code;
  }
}
