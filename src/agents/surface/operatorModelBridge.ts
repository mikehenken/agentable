/**
 * Operator model bridge: syncs `<agentable-operator-surface>` model
 * selection to the runtime layer via host `registerModelResolver`.
 *
 * Aliases stay opaque on the client; provider ids and model names resolve only
 * through the registered resolver at rebind time — never via client API keys.
 *
 * Intentionally avoids importing `session.ts` `capabilities.ts` so Lit
 * component tests do not pull the canvas tool graph into the browser bundle.
 */
import {
  getRegisteredModelResolver,
  registerModelResolver,
  resolveModelBinding,
} from '../modelResolver';
import type {
  AgentSession,
  AgentSessionStatus,
  CapabilityNote,
  ModelCapabilities,
  ProviderBinding,
} from '../types';
import { ModelResolveError } from '../types';
import { OPERATOR_AGENT_ID, DEFAULT_OPERATOR_REQUIRED_CAPS } from './constants';
import type { OperatorModelOption } from './types';

export const OPERATOR_MODEL_BRIDGE_NOT_BOUND_CODE = 'OPERATOR_MODEL_BRIDGE_NOT_BOUND';

/** NAS pattern: `auto` is the default switcher value and routes to `default`. */
export const OPERATOR_AUTO_MODEL_ALIAS = 'auto';
export const OPERATOR_AUTO_RESOLVED_ALIAS = 'default';

/**
 * Resolve UI model aliases for rebind. When `model === 'auto'`, route to
 * the default/fast alias — same NAS agent-panel behavior.
 */
export function resolveOperatorModelAlias(alias: string): string {
  const trimmed = alias.trim();
  if (trimmed === OPERATOR_AUTO_MODEL_ALIAS) {
    return OPERATOR_AUTO_RESOLVED_ALIAS;
  }
  return trimmed;
}

export interface BindOperatorModelBridgeOptions {
  initialAlias: string;
  tenantId?: string;
  requiredCaps?: Partial<ModelCapabilities>;
  label?: string;
}

export interface OperatorModelRebindResult {
  modelAlias: string;
  previousModelAlias: string;
  resolvedAlias: string;
  fallbackUsed: boolean;
  binding: ProviderBinding;
}

export interface OperatorModelOptionAvailability extends OperatorModelOption {
  available: boolean;
  resolvedAlias?: string;
  fallbackUsed?: boolean;
  unavailableReason?: string;
}

interface OperatorSessionSnapshot {
  readonly agentId: string;
  readonly kind: 'chat';
  readonly label: string;
  requestedAlias: string;
  resolvedAlias: string;
  binding: ProviderBinding;
  fallbackUsed: boolean;
  notes: CapabilityNote[];
  status: AgentSessionStatus;
  rebindModel(alias: string): Promise<void>;
}

let activeSession: OperatorSessionSnapshot | null = null;
let bridgeBound = false;
let bridgeRequiredCaps: Partial<ModelCapabilities> | undefined;
let bridgeTenantId: string | undefined;
let bridgeLabel = 'Operator';

async function resolveOperatorSession(
  alias: string,
  requiredCaps?: Partial<ModelCapabilities>): Promise<{
  requestedAlias: string;
  resolvedAlias: string;
  binding: ProviderBinding;
  fallbackUsed: boolean;
  notes: CapabilityNote[];
}> {
  const resolved = await resolveModelBinding(
    resolveOperatorModelAlias(alias),
    { agentId: OPERATOR_AGENT_ID, tenantId: bridgeTenantId },
    { requiredCaps: requiredCaps ?? bridgeRequiredCaps ?? DEFAULT_OPERATOR_REQUIRED_CAPS });
  return {
    requestedAlias: resolved.requestedAlias,
    resolvedAlias: resolved.resolvedAlias,
    binding: resolved.binding,
    fallbackUsed: resolved.fallbackUsed,
    notes: [...resolved.notes],
  };
}

function buildSessionSnapshot(
  initial: Awaited<ReturnType<typeof resolveOperatorSession>>): OperatorSessionSnapshot {
  const snapshot: OperatorSessionSnapshot = {
    agentId: OPERATOR_AGENT_ID,
    kind: 'chat',
    label: bridgeLabel,
    requestedAlias: initial.requestedAlias,
    resolvedAlias: initial.resolvedAlias,
    binding: initial.binding,
    fallbackUsed: initial.fallbackUsed,
    notes: initial.notes,
    status: 'idle',
    async rebindModel(alias: string): Promise<void> {
      const next = await resolveOperatorSession(alias);
      snapshot.requestedAlias = next.requestedAlias;
      snapshot.resolvedAlias = next.resolvedAlias;
      snapshot.binding = next.binding;
      snapshot.fallbackUsed = next.fallbackUsed;
      snapshot.notes = next.notes;
    },
  };
  return snapshot;
}

/** Whether the operator model bridge holds an active session. */
export function isOperatorModelBridgeActive(): boolean {
  return bridgeBound && activeSession !== null;
}

/** Active operator agent session after bind; null when bridge is inactive. */
export function getOperatorAgentSession(): AgentSession | null {
  return bridgeBound ? activeSession: null;
}

/** Requested alias on the active operator session, if bound. */
export function getOperatorModelAlias(): string | null {
  return activeSession?.requestedAlias ?? null;
}

/** Server-resolved provider binding for the active operator session. */
export function getOperatorModelBinding(): ProviderBinding | null {
  return activeSession?.binding ?? null;
}

/**
 * Create (or replace) the operator session when a host resolver is registered.
 * No-ops when no resolver is present so the Lit shell can still mount offline.
 */
export async function bindOperatorModelBridge(
  options: BindOperatorModelBridgeOptions): Promise<boolean> {
  if (getRegisteredModelResolver === null) {
    bridgeBound = false;
    activeSession = null;
    return false;
  }

  bridgeRequiredCaps = options.requiredCaps ?? DEFAULT_OPERATOR_REQUIRED_CAPS;
  bridgeTenantId = options.tenantId;
  bridgeLabel = options.label ?? 'Canvas Operator';

  const initial = await resolveOperatorSession(options.initialAlias, bridgeRequiredCaps);
  activeSession = buildSessionSnapshot(initial);
  bridgeBound = true;
  return true;
}

/** Re-resolve the operator session against a new alias through the host resolver. */
export async function rebindOperatorModel(alias: string): Promise<OperatorModelRebindResult> {
  if (!bridgeBound || activeSession === null) {
    throw new ModelResolveError(
      'NO_RESOLVER',
      `${OPERATOR_MODEL_BRIDGE_NOT_BOUND_CODE}: operator model bridge is not bound`);
  }

  const trimmed = alias.trim();
  if (!trimmed) {
    throw new ModelResolveError('RESOLVE_EXHAUSTED', 'Model alias must be a non-empty string.');
  }

  const previousModelAlias = activeSession.requestedAlias;
  await activeSession.rebindModel(trimmed);

  return {
    modelAlias: trimmed,
    previousModelAlias,
    resolvedAlias: activeSession.resolvedAlias,
    fallbackUsed: activeSession.fallbackUsed,
    binding: activeSession.binding,
  };
}

/** Evaluate which switcher options satisfy session capability requirements. */
export async function evaluateOperatorModelOptions(
  options: readonly OperatorModelOption[],
  ctx?: {
    tenantId?: string;
    requiredCaps?: Partial<ModelCapabilities>;
  }): Promise<OperatorModelOptionAvailability[]> {
  if (getRegisteredModelResolver === null) {
    return options.map((option) => ({...option, available: true }));
  }

  const requiredCaps = ctx?.requiredCaps ?? bridgeRequiredCaps ?? DEFAULT_OPERATOR_REQUIRED_CAPS;
  const tenantId = ctx?.tenantId ?? bridgeTenantId;
  const savedTenant = bridgeTenantId;
  bridgeTenantId = tenantId;

  const results: OperatorModelOptionAvailability[] = [];
  for (const option of options) {
    if (option.alias === OPERATOR_AUTO_MODEL_ALIAS) {
      results.push({...option, available: true, resolvedAlias: OPERATOR_AUTO_RESOLVED_ALIAS });
      continue;
    }
    try {
      const resolved = await resolveModelBinding(
        resolveOperatorModelAlias(option.alias),
        { agentId: OPERATOR_AGENT_ID, tenantId },
        { requiredCaps });
      results.push({...option,
        available: true,
        resolvedAlias: resolved.resolvedAlias,
        fallbackUsed: resolved.fallbackUsed,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message: `Could not resolve alias "${option.alias}" for operator session.`;
      results.push({...option,
        available: false,
        unavailableReason: message,
      });
    }
  }

  bridgeTenantId = savedTenant;
  return results;
}

/** Called when the operator surface unmounts; releases the bridge session. */
export function unbindOperatorModelBridge(): void {
  bridgeBound = false;
  activeSession = null;
  bridgeRequiredCaps = undefined;
  bridgeTenantId = undefined;
  bridgeLabel = 'Canvas Operator';
}

/** Test helper — reset bridge state between cases. */
export function resetOperatorModelBridgeForTests(): void {
  unbindOperatorModelBridge();
}

/** Component-test helper — registers a minimal resolver map without pulling chat SDKs. */
export function registerOperatorSurfaceTestModelResolver(
  map: Record<string, ProviderBinding>): void {
  registerModelResolver(async (alias) => {
    const resolved = map[alias];
    if (!resolved) {
      throw new Error(`unknown alias "${alias}"`);
    }
    return resolved;
  });
}

export { clearModelResolverForTests } from '../modelResolver';
