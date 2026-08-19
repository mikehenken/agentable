/**
 * Undo/reversal model: canvas-local stack undo vs compensating HITL reversal.
 *
 * - Canvas ops (draw, arrange, layout) push onto a per-actor undo stack.
 * - Persisted mutations (`run_panel_action`) are recorded in the activity ledger
 *   and refuse stack-undo; they reverse only through `reverseMutation`.
 * - Irreversible actions refuse both stack-undo and compensating reversal.
 */
import type { ApprovalActor } from '../panels/approval/types';
import type { PanelActionMeta } from '../panels/registryMetadata';
import type { JsonValue } from '../panels/types';
import type { RunPanelActionResult } from '../panels/panelToolRuntime';
import {
  createActivityLog,
  type ActivityActor,
  type ActivityEntry,
  type ActivityLog,
  type ActivityLogFilter,
  type ActivityProvenance,
  type DeclaredInverseAction,
} from './activity';

export type StackUndoErrorCode =
  | 'STACK_EMPTY'
  | 'PERSISTED_MUTATION_NOT_STACK_UNDOABLE'
  | 'IRREVERSIBLE'
  | 'ACTOR_MISMATCH'
  | 'ALREADY_REVERSED';

export type StackUndoResult =
  | { ok: true; entry: ActivityEntry }
  | { ok: false; code: StackUndoErrorCode; message: string };

export type StackRedoResult =
  | { ok: true; entry: ActivityEntry }
  | { ok: false; code: 'STACK_EMPTY' | 'ACTOR_MISMATCH'; message: string };

export type ReversalErrorCode =
  | 'ENTRY_NOT_FOUND'
  | 'NOT_REVERSIBLE'
  | 'ALREADY_REVERSED'
  | 'MISSING_INVERSE'
  | 'COMPENSATION_FAILED'
  | 'COMPENSATION_REJECTED';

export type ReversalResult =
  | { ok: true; reversalEntryId: string; result: unknown }
  | { ok: false; code: ReversalErrorCode; message: string };

export interface CanvasStackOp {
  verb: string;
  target: string;
  provenance?: ActivityProvenance;
  reversible?: boolean;
  undo: () => void;
  redo: () => void;
}

export interface RecordedMutationInput {
  actor: ApprovalActor;
  panelId: string;
  definitionId: string;
  actionId: string;
  actionLabel: string;
  payload: Record<string, JsonValue>;
  beforeData: Record<string, JsonValue>;
  actionMeta: PanelActionMeta;
  provenance?: ActivityProvenance;
}

export interface UndoReversalRuntime {
  readonly activity: ActivityLog;
  pushCanvasOp(actor: ActivityActor, op: CanvasStackOp): ActivityEntry;
  stackUndo(actor: ActivityActor): StackUndoResult;
  stackRedo(actor: ActivityActor): StackRedoResult;
  recordPersistedMutation(input: RecordedMutationInput): ActivityEntry;
  reverseMutation(
    ledgerEntryId: string,
    actor: ApprovalActor,
  ): Promise<ReversalResult>;
  canReverse(ledgerEntryId: string): { ok: true } | { ok: false; code: ReversalErrorCode; message: string };
  getLedger(filter?: ActivityLogFilter): readonly ActivityEntry[];
}

export interface UndoReversalRuntimeOptions {
  activity?: ActivityLog;
  executeCompensatingAction: (
    panelId: string,
    actionId: string,
    payload: Record<string, JsonValue> | undefined,
    actor: ApprovalActor,
  ) => Promise<RunPanelActionResult>;
}

interface StackFrame {
  entryId: string;
  actor: ActivityActor;
  undo: () => void;
  redo: () => void;
}

function actorFromApproval(actor: ApprovalActor): ActivityActor {
  if (actor === 'user') return 'user';
  if (actor === 'agent') return 'agent:default';
  return actor.startsWith('agent:') ? actor : `agent:${actor}`;
}

function buildInversePayload(
  beforeData: Record<string, JsonValue>,
  appliedPayload: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const inverse: Record<string, JsonValue> = { ...beforeData };
  for (const key of Object.keys(appliedPayload)) {
    if (!(key in beforeData)) {
      inverse[key] = null;
    }
  }
  return inverse;
}

function resolveInverseAction(
  input: RecordedMutationInput,
): DeclaredInverseAction | undefined {
  if (input.actionMeta.reversible === false) {
    return undefined;
  }
  const inverseActionId = input.actionMeta.inverseActionId ?? input.actionId;
  return {
    panelId: input.panelId,
    definitionId: input.definitionId,
    actionId: inverseActionId,
    payload: buildInversePayload(input.beforeData, input.payload),
  };
}

export function createUndoReversalRuntime(
  options: UndoReversalRuntimeOptions,
): UndoReversalRuntime {
  const activity = options.activity ?? createActivityLog();
  const undoStacks = new Map<ActivityActor, StackFrame[]>();
  const redoStacks = new Map<ActivityActor, StackFrame[]>();

  const getUndoStack = (actor: ActivityActor): StackFrame[] => {
    const stack = undoStacks.get(actor);
    if (stack !== undefined) return stack;
    const created: StackFrame[] = [];
    undoStacks.set(actor, created);
    return created;
  };

  const getRedoStack = (actor: ActivityActor): StackFrame[] => {
    const stack = redoStacks.get(actor);
    if (stack !== undefined) return stack;
    const created: StackFrame[] = [];
    redoStacks.set(actor, created);
    return created;
  };

  const clearRedo = (actor: ActivityActor): void => {
    redoStacks.set(actor, []);
  };

  return {
    activity,

    pushCanvasOp(actor: ActivityActor, op: CanvasStackOp): ActivityEntry {
      const entry = activity.append({
        actor,
        verb: op.verb,
        target: op.target,
        provenance: op.provenance,
        reversal: {
          reversible: op.reversible !== false,
          persisted: false,
        },
      });
      getUndoStack(actor).push({
        entryId: entry.id,
        actor,
        undo: op.undo,
        redo: op.redo,
      });
      clearRedo(actor);
      return entry;
    },

    stackUndo(actor: ActivityActor): StackUndoResult {
      const stack = getUndoStack(actor);
      const frame = stack.pop();
      if (frame === undefined) {
        return { ok: false, code: 'STACK_EMPTY', message: 'nothing to undo' };
      }
      if (frame.actor !== actor) {
        stack.push(frame);
        return {
          ok: false,
          code: 'ACTOR_MISMATCH',
          message: 'cannot undo another actor\'s canvas operation',
        };
      }

      const entry = activity.get(frame.entryId);
      if (entry === undefined) {
        return { ok: false, code: 'STACK_EMPTY', message: 'ledger entry missing for stack frame' };
      }

      if (entry.reversal.persisted) {
        stack.push(frame);
        return {
          ok: false,
          code: 'PERSISTED_MUTATION_NOT_STACK_UNDOABLE',
          message:
            'persisted mutations reverse only through a compensating action under HITL',
        };
      }

      if (!entry.reversal.reversible) {
        stack.push(frame);
        return {
          ok: false,
          code: 'IRREVERSIBLE',
          message: 'this action cannot be undone',
        };
      }

      if (entry.reversal.reversedByEntryId !== undefined) {
        stack.push(frame);
        return {
          ok: false,
          code: 'ALREADY_REVERSED',
          message: 'this operation was already reversed',
        };
      }

      frame.undo();
      getRedoStack(actor).push(frame);

      const undoEntry = activity.append({
        actor,
        verb: 'undo',
        target: entry.target,
        provenance: entry.provenance,
        reversal: {
          reversible: true,
          persisted: false,
          reversesEntryId: entry.id,
        },
      });
      activity.markReversed(entry.id, undoEntry.id);
      return { ok: true, entry: undoEntry };
    },

    stackRedo(actor: ActivityActor): StackRedoResult {
      const stack = getRedoStack(actor);
      const frame = stack.pop();
      if (frame === undefined) {
        return { ok: false, code: 'STACK_EMPTY', message: 'nothing to redo' };
      }
      if (frame.actor !== actor) {
        stack.push(frame);
        return {
          ok: false,
          code: 'ACTOR_MISMATCH',
          message: 'cannot redo another actor\'s canvas operation',
        };
      }

      frame.redo();
      getUndoStack(actor).push(frame);

      const original = activity.get(frame.entryId);
      const redoEntry = activity.append({
        actor,
        verb: 'redo',
        target: original?.target ?? frame.entryId,
        provenance: original?.provenance,
        reversal: {
          reversible: true,
          persisted: false,
          reversesEntryId: frame.entryId,
        },
      });
      return { ok: true, entry: redoEntry };
    },

    recordPersistedMutation(input: RecordedMutationInput): ActivityEntry {
      const inverse = resolveInverseAction(input);
      const reversible = input.actionMeta.reversible !== false && inverse !== undefined;
      return activity.append({
        actor: actorFromApproval(input.actor),
        verb: input.actionLabel,
        target: `${input.definitionId}:${input.actionId}`,
        provenance: input.provenance,
        reversal: {
          inverse,
          reversible,
          persisted: true,
        },
      });
    },

    canReverse(ledgerEntryId: string): { ok: true } | { ok: false; code: ReversalErrorCode; message: string } {
      const entry = activity.get(ledgerEntryId);
      if (entry === undefined) {
        return { ok: false, code: 'ENTRY_NOT_FOUND', message: `unknown ledger entry "${ledgerEntryId}"` };
      }
      if (!entry.reversal.persisted) {
        return {
          ok: false,
          code: 'NOT_REVERSIBLE',
          message: 'canvas-local operations use stack undo, not compensating reversal',
        };
      }
      if (!entry.reversal.reversible) {
        return { ok: false, code: 'NOT_REVERSIBLE', message: 'this action is irreversible' };
      }
      if (entry.reversal.reversedByEntryId !== undefined) {
        return { ok: false, code: 'ALREADY_REVERSED', message: 'mutation already reversed' };
      }
      if (entry.reversal.inverse === undefined) {
        return { ok: false, code: 'MISSING_INVERSE', message: 'no compensating inverse declared' };
      }
      return { ok: true };
    },

    async reverseMutation(
      ledgerEntryId: string,
      actor: ApprovalActor,
    ): Promise<ReversalResult> {
      const eligibility = this.canReverse(ledgerEntryId);
      if (!eligibility.ok) {
        return { ok: false, code: eligibility.code, message: eligibility.message };
      }

      const entry = activity.get(ledgerEntryId)!;
      const inverse = entry.reversal.inverse!;

      const actionResult = await options.executeCompensatingAction(
        inverse.panelId,
        inverse.actionId,
        inverse.payload,
        actor,
      );

      if (actionResult.status !== 'ok') {
        if (actionResult.status === 'rejected_by_user') {
          return {
            ok: false,
            code: 'COMPENSATION_REJECTED',
            message: 'compensating reversal rejected by user',
          };
        }
        return {
          ok: false,
          code: 'COMPENSATION_FAILED',
          message: actionResult.status === 'error' ? actionResult.message : 'compensation did not complete',
        };
      }

      const reversalEntryId = actionResult.ledgerEntryId;
      if (reversalEntryId === undefined) {
        return {
          ok: false,
          code: 'COMPENSATION_FAILED',
          message: 'compensating action did not produce a ledger entry',
        };
      }

      activity.markReversed(ledgerEntryId, reversalEntryId);

      return {
        ok: true,
        reversalEntryId,
        result: actionResult.result,
      };
    },

    getLedger(filter?: ActivityLogFilter): readonly ActivityEntry[] {
      return activity.getEntries(filter);
    },
  };
}
