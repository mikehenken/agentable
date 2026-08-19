/**
 * Operator registration bridge (P13-T5): registers the canvas-wide operator
 * agent alongside scoped page agents without clobbering their identity, leases,
 * or HITL queues.
 *
 * Distinct from scoped agents:
 * - Stable `OPERATOR_AGENT_ID` with `canvas:operator` scope
 * - Mode-derived tool allow-list synced on Ask/Build/Draw changes
 * - Advisory canvas-wide lease while the operator surface is mounted
 */
import type { AgentToolExecutionContext } from '../agentContext';
import type { AgentRegistryRegisterInput } from '../registry';
import type { AgentRuntime } from '../runtime';
import {
  OPERATOR_AGENT_ID,
  OPERATOR_LABEL,
  OPERATOR_LEASE_SCOPE,
  OPERATOR_LEASE_TTL_MS,
  OPERATOR_REGISTRY_SCOPE,
} from './constants';
import { getAllowedToolsForOperatorMode } from './operatorModeScope';
import type { OperatorMode } from './types';

export type OperatorRegistrationRuntime = Pick<
  AgentRuntime,
  'register' | 'claim' | 'registry' | 'leases' | 'activity'
>;

/** Stable acting-agent context for operator tool execution (D45). */
export const OPERATOR_TOOL_CONTEXT: AgentToolExecutionContext = {
  agentId: OPERATOR_AGENT_ID,
  agentLabel: OPERATOR_LABEL,
};

let activeRuntime: OperatorRegistrationRuntime | null = null;
let registrationActive = false;
let activeLeaseId: string | null = null;
let activeMode: OperatorMode = 'auto';

/** Host/runtime hook — called from `createCanvasHost` so the Lit surface can register. */
export function setOperatorRegistrationRuntime(
  runtime: OperatorRegistrationRuntime | null,
): void {
  activeRuntime = runtime;
}

export function getOperatorRegistrationRuntime(): OperatorRegistrationRuntime | null {
  return activeRuntime;
}

/** Whether the operator agent is registered in the world-model registry. */
export function isOperatorRegistrationActive(): boolean {
  return registrationActive;
}

export function buildOperatorRegistrationInput(mode: OperatorMode): AgentRegistryRegisterInput {
  return {
    id: OPERATOR_AGENT_ID,
    kind: 'chat',
    label: OPERATOR_LABEL,
    scope: OPERATOR_REGISTRY_SCOPE,
    transport: 'operator-surface',
    allowedTools: [...getAllowedToolsForOperatorMode(mode)],
  };
}

function appendRegistrationActivity(
  runtime: OperatorRegistrationRuntime,
  verb: 'operator_registered' | 'operator_unregistered' | 'operator_mode_synced',
  target: string,
): void {
  runtime.activity.append({
    actor: `agent:${OPERATOR_AGENT_ID}`,
    verb,
    target,
    provenance: { derivedFrom: `agent:${OPERATOR_AGENT_ID}` },
    reversal: { reversible: false, persisted: false },
  });
}

function claimOperatorLease(runtime: OperatorRegistrationRuntime): void {
  const claimResult = runtime.claim({
    source: OPERATOR_AGENT_ID,
    scope: OPERATOR_LEASE_SCOPE,
    ttlMs: OPERATOR_LEASE_TTL_MS,
  });
  if (claimResult.ok) {
    activeLeaseId = claimResult.lease.id;
  }
}

function releaseOperatorLease(runtime: OperatorRegistrationRuntime): void {
  if (activeLeaseId !== null) {
    runtime.leases.release(activeLeaseId);
    activeLeaseId = null;
    return;
  }
  runtime.leases.releaseScope(OPERATOR_LEASE_SCOPE, OPERATOR_AGENT_ID);
}

/**
 * Register the canvas-wide operator agent when the operator surface connects.
 * No-ops registry/lease work when no runtime is wired (offline Lit shell).
 */
export function bindOperatorRegistration(mode: OperatorMode): void {
  activeMode = mode;

  if (registrationActive) {
    syncOperatorRegistrationMode(mode);
    return;
  }

  const runtime = activeRuntime;
  if (runtime !== null) {
    runtime.register(buildOperatorRegistrationInput(mode));
    claimOperatorLease(runtime);
    appendRegistrationActivity(runtime, 'operator_registered', OPERATOR_REGISTRY_SCOPE);
  }

  registrationActive = true;
}

/** Sync mode-derived tool allow-list on the registered operator agent. */
export function syncOperatorRegistrationMode(mode: OperatorMode): void {
  activeMode = mode;
  const runtime = activeRuntime;
  if (runtime === null || !registrationActive) {
    return;
  }

  runtime.register(buildOperatorRegistrationInput(mode));
  appendRegistrationActivity(runtime, 'operator_mode_synced', mode);
}

/** Unregister operator agent and release canvas-wide lease on surface disconnect. */
export function unbindOperatorRegistration(): void {
  if (!registrationActive) {
    return;
  }

  const runtime = activeRuntime;
  if (runtime !== null) {
    releaseOperatorLease(runtime);
    runtime.registry.unregister(OPERATOR_AGENT_ID);
    appendRegistrationActivity(runtime, 'operator_unregistered', OPERATOR_REGISTRY_SCOPE);
  }

  registrationActive = false;
  activeLeaseId = null;
  activeMode = 'auto';
}

/** Test helper — reset bridge state between cases. */
export function resetOperatorRegistrationBridgeForTests(): void {
  unbindOperatorRegistration();
  activeRuntime = null;
}

export function getOperatorRegistrationModeForTests(): OperatorMode {
  return activeMode;
}
