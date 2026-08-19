/**
 * Operator mode bridge (P13-T2): syncs `<agentable-operator-surface>` mode
 * to the runtime tool-scope enforcement layer.
 */
import type { ToolResult } from '../../panels/tools';
import { OPERATOR_AGENT_ID } from './constants';
import { isToolAllowedForOperatorMode } from './operatorModeScope';
import type { OperatorMode } from './types';

export const OPERATOR_MODE_SCOPE_DENIED_CODE = 'SCOPE_DENIED';

let activeMode: OperatorMode = 'auto';
let enforcementBound = false;

/** Current operator mode used by tool-scope enforcement. */
export function getOperatorMode(): OperatorMode {
  return activeMode;
}

/** Whether operator-mode scope checks run in the tool executor. */
export function isOperatorModeEnforcementActive(): boolean {
  return enforcementBound;
}

/** Called when the operator surface mounts; binds enforcement to the given mode. */
export function bindOperatorModeEnforcement(mode: OperatorMode): void {
  activeMode = mode;
  enforcementBound = true;
}

/** Sync mode after UI change or external attribute update. */
export function syncOperatorMode(mode: OperatorMode): void {
  activeMode = mode;
}

/** Called when the operator surface unmounts; disables operator-mode checks. */
export function unbindOperatorModeEnforcement(): void {
  enforcementBound = false;
  activeMode = 'auto';
}

/** Test helper — reset bridge state between cases. */
export function resetOperatorModeBridgeForTests(): void {
  enforcementBound = false;
  activeMode = 'auto';
}

/** Build the structured denial when operator mode blocks a tool (P13-T2). */
export function buildOperatorModeScopeDenial(toolName: string, mode: OperatorMode): ToolResult {
  return {
    ok: false,
    error: `${OPERATOR_MODE_SCOPE_DENIED_CODE}: operator mode "${mode}" does not allow "${toolName}"`,
  };
}

/**
 * Returns a tool denial when operator-mode enforcement is active for the
 * acting agent and the tool is out of scope; otherwise `null` (caller may proceed).
 *
 * enforcement applies only to `OPERATOR_AGENT_ID` so scoped page agents
 * coexist on the same D44 session without inheriting operator Ask/Build/Draw gates.
 */
export function evaluateOperatorModeToolDenial(
  toolName: string,
  agentId?: string): ToolResult | null {
  if (!enforcementBound) {
    return null;
  }
  if (agentId !== undefined && agentId !== OPERATOR_AGENT_ID) {
    return null;
  }
  if (isToolAllowedForOperatorMode(toolName, activeMode)) {
    return null;
  }
  return buildOperatorModeScopeDenial(toolName, activeMode);
}
