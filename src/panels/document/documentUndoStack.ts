/**
 * Pre-save document block undo/redo stack (D53, P12-T2).
 * Persisted document writes reverse only through HITL compensating actions.
 */
import { applyBlockOp } from './blockOps';
import type { BlockOp, DocBlock } from './types';

export interface DocumentUndoStack {
  readonly blocks: readonly DocBlock[];
  apply(op: BlockOp): readonly DocBlock[];
  undo(): readonly DocBlock[] | null;
  redo(): readonly DocBlock[] | null;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(blocks: readonly DocBlock[]): void;
}

export function createDocumentUndoStack(initial: readonly DocBlock[]): DocumentUndoStack {
  let current: DocBlock[] = initial.map((block) => ({ ...block }));
  const undoStack: DocBlock[][] = [];
  const redoStack: DocBlock[][] = [];

  const snapshot = (): DocBlock[] => current.map((block) => ({ ...block }));

  return {
    get blocks(): readonly DocBlock[] {
      return current;
    },

    apply(op: BlockOp): readonly DocBlock[] {
      undoStack.push(snapshot());
      redoStack.length = 0;
      current = applyBlockOp(current, op);
      return current;
    },

    undo(): readonly DocBlock[] | null {
      if (undoStack.length === 0) return null;
      redoStack.push(snapshot());
      const previous = undoStack.pop();
      if (previous === undefined) return null;
      current = previous.map((block) => ({ ...block }));
      return current;
    },

    redo(): readonly DocBlock[] | null {
      if (redoStack.length === 0) return null;
      undoStack.push(snapshot());
      const next = redoStack.pop();
      if (next === undefined) return null;
      current = next.map((block) => ({ ...block }));
      return current;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    reset(blocks: readonly DocBlock[]): void {
      current = blocks.map((block) => ({ ...block }));
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
