/**
 * Thread-local turn canvas shape ids for scoped clear_agent_drawings.
 * Mirrors the stack pattern in `drawIntentContext.ts`.
 */

const turnShapeIdsStack: string[][] = [];

export function withTurnCanvasShapeIds<T>(shapeIds: readonly string[], fn: () => T): T {
  turnShapeIdsStack.push([...shapeIds]);
  try {
    return fn();
  } finally {
    turnShapeIdsStack.pop();
  }
}

export async function withTurnCanvasShapeIdsAsync<T>(
  shapeIds: readonly string[],
  fn: () => Promise<T>): Promise<T> {
  turnShapeIdsStack.push([...shapeIds]);
  try {
    return await fn;
  } finally {
    turnShapeIdsStack.pop();
  }
}

export function getTurnCanvasShapeIds(): readonly string[] {
  const current = turnShapeIdsStack[turnShapeIdsStack.length - 1];
  return current ?? [];
}

export function setTurnCanvasShapeIds(shapeIds: readonly string[]): void {
  const current = turnShapeIdsStack[turnShapeIdsStack.length - 1];
  if (current === undefined) {
    turnShapeIdsStack.push([...shapeIds]);
    return;
  }
  turnShapeIdsStack[turnShapeIdsStack.length - 1] = [...shapeIds];
}
