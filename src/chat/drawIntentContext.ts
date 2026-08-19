/**
 * Thread-local user message context for draw_shapes enforcement.
 * Mirrors the stack pattern in `agentContext.ts`.
 */

const drawUserMessageStack: string[] = [];

export function withDrawUserMessage<T>(userText: string | undefined, fn: () => T): T {
  drawUserMessageStack.push(userText ?? '');
  try {
    return fn();
  } finally {
    drawUserMessageStack.pop();
  }
}

export async function withDrawUserMessageAsync<T>(
  userText: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  drawUserMessageStack.push(userText ?? '');
  try {
    return await fn();
  } finally {
    drawUserMessageStack.pop();
  }
}

export function getDrawUserMessage(): string | undefined {
  const current = drawUserMessageStack[drawUserMessageStack.length - 1];
  if (current === undefined || current.length === 0) {
    return undefined;
  }
  return current;
}
