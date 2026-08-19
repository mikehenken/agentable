/**
 * A2A-shaped handoff records: written to the activity log and surfaced
 * to the target session. Not the full A2A protocol.
 */
import type { ActivityLog, ActivityProvenance } from './activity';
import type { AgentRegistry } from './registry';

export interface HandoffInput {
  from: string;
  to: string;
  task: string;
  scope?: string;
  artifacts?: readonly string[];
  returnTo?: string;
}

export interface HandoffRecord {
  id: string;
  from: string;
  to: string;
  task: string;
  scope?: string;
  artifacts: readonly string[];
  returnTo?: string;
  activityEntryId: string;
  at: string;
}

export type HandoffResult =
  | {
      ok: true;
      record: HandoffRecord;
    }
  | {
      ok: false;
      reason: 'unknown_target' | 'unknown_source';
      message: string;
    }

let handoffCounter = 0;

export function resetHandoffCounterForTests(): void {
  handoffCounter = 0;
}

export function createHandoff(
  input: HandoffInput,
  deps: { registry: AgentRegistry; activity: ActivityLog }): HandoffResult {
  const source = deps.registry.get(input.from);
  if (source === undefined) {
    return {
      ok: false,
      reason: 'unknown_source',
      message: `Handoff source agent "${input.from}" is not registered.`,
    };
  }
  const target = deps.registry.get(input.to);
  if (target === undefined) {
    return {
      ok: false,
      reason: 'unknown_target',
      message: `Handoff target agent "${input.to}" is not registered.`,
    };
  }

  handoffCounter += 1;
  const id = `handoff-${handoffCounter}`;
  const provenance: ActivityProvenance = { derivedFrom: `agent:${input.from}` };
  const activityEntry = deps.activity.append({
    actor: input.from,
    verb: 'handoff',
    target: input.to,
    provenance,
    reversal: { reversible: false, persisted: false },
  });

   // Nudge target status when idle so digest escalation can surface the task.
  if (target.status === 'idle' || target.status === 'done') {
    deps.registry.setStatus(input.to, 'running', input.task);
  }

  return {
    ok: true,
    record: {
      id,
      from: input.from,
      to: input.to,
      task: input.task,
      scope: input.scope,
      artifacts: [...(input.artifacts ?? [])],
      returnTo: input.returnTo,
      activityEntryId: activityEntry.id,
      at: activityEntry.ts,
    },
  };
}
