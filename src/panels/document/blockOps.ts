/**
 * Structured block operations for the document primitive.
 * Agents edit through insert/replace/move/remove — never markup.
 */
import type { BlockOp, DocBlock, DocBlockInput } from './types';

let blockIdCounter = 0;

/** Reset monotonic id counter for deterministic tests. */
export function resetDocumentBlockIdCounterForTests(next = 0): void {
  blockIdCounter = next;
}

function assignBlockId(input: DocBlockInput): string {
  if (input.id !== undefined && input.id.length > 0) {
    return input.id;
  }
  blockIdCounter += 1;
  return `block-${blockIdCounter}`;
}

function normalizeBlockInput(input: DocBlockInput): DocBlock {
  const id = assignBlockId(input);
  switch (input.type) {
    case 'heading':
      return { id, type: 'heading', level: input.level, text: input.text };
    case 'paragraph':
      return { id, type: 'paragraph', runs: [...input.runs] };
    case 'list':
      return {
        id,
        type: 'list',
        ordered: input.ordered,
        items: input.items.map((group) => group.map((item) => ({ ...item }))),
      };
    case 'table':
      return { id, type: 'table', rows: input.rows.map((row) => row.map((cell) => [...cell])) };
    case 'image':
      return {
        id,
        type: 'image',
        assetId: input.assetId,
        ...(input.alt !== undefined ? { alt: input.alt } : {}),
      };
    case 'callout':
      return { id, type: 'callout', tone: input.tone, runs: [...input.runs] };
    case 'pageBreak':
      return { id, type: 'pageBreak' };
    default: {
      const exhaustive: never = input;
      throw new Error(`Unknown block type: ${(exhaustive as DocBlockInput).type}`);
    }
  }
}

function findBlockIndex(blocks: readonly DocBlock[], blockId: string): number {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index < 0) {
    throw new Error(`Block "${blockId}" not found`);
  }
  return index;
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(0, index), length);
}

/**
 * Apply one block op immutably. Throws on invalid indices or missing block ids.
 */
export function applyBlockOp(blocks: readonly DocBlock[], op: BlockOp): DocBlock[] {
  const next = blocks.map((block) => ({ ...block }));

  switch (op.op) {
    case 'insert': {
      const index = clampIndex(op.index, next.length);
      next.splice(index, 0, normalizeBlockInput(op.block));
      return next;
    }
    case 'replace': {
      const index = findBlockIndex(next, op.blockId);
      next[index] = normalizeBlockInput({ ...op.block, id: op.blockId });
      return next;
    }
    case 'move': {
      const fromIndex = findBlockIndex(next, op.blockId);
      const [moved] = next.splice(fromIndex, 1);
      if (moved === undefined) {
        throw new Error(`Block "${op.blockId}" missing after splice`);
      }
      const toIndex = clampIndex(op.toIndex, next.length);
      next.splice(toIndex, 0, moved);
      return next;
    }
    case 'remove': {
      const index = findBlockIndex(next, op.blockId);
      next.splice(index, 1);
      return next;
    }
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown block op: ${(exhaustive as BlockOp).op}`);
    }
  }
}
