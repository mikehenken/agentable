import type { JsonValue } from '../types';

/** RFC 6902 operation supported for composed spec hydration. */
export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: JsonValue;
}

export interface ApplyJsonPatchSuccess<T> {
  ok: true;
  document: T;
}

export interface ApplyJsonPatchFailure {
  ok: false;
  message: string;
}

export type ApplyJsonPatchResult<T> = ApplyJsonPatchSuccess<T> | ApplyJsonPatchFailure;

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unescapePointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function parseJsonPointer(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) {
    throw new Error(`JSON Patch path must start with "/": ${path}`);
  }
  if (path === '/') {
    throw new Error('JSON Patch path "/" is not supported for spec envelopes');
  }
  return path
    .slice(1)
    .split('/')
    .map(unescapePointerToken);
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getParent(
  root: Record<string, JsonValue> | JsonValue[],
  tokens: string[],
): { parent: Record<string, JsonValue> | JsonValue[]; key: string } | null {
  if (tokens.length === 0) return null;

  let current: JsonValue = root;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i];
    if (token === undefined) return null;

    if (Array.isArray(current)) {
      if (token === '-') return null;
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return null;
      current = current[index] as JsonValue;
      continue;
    }

    if (!isRecord(current)) return null;
    const next = current[token];
    if (next === undefined) return null;
    current = next;
  }

  const key = tokens[tokens.length - 1];
  if (key === undefined) return null;

  if (Array.isArray(current)) {
    return { parent: current, key };
  }
  if (isRecord(current)) {
    return { parent: current, key };
  }
  return null;
}

function applyOnePatch(
  document: Record<string, JsonValue>,
  operation: JsonPatchOperation,
): ApplyJsonPatchResult<Record<string, JsonValue>> {
  let tokens: string[];
  try {
    tokens = parseJsonPointer(operation.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }

  if (tokens.length === 0) {
    return { ok: false, message: 'cannot patch the document root' };
  }

  const located = getParent(document, tokens);
  if (located === null) {
    return { ok: false, message: `patch path not found: ${operation.path}` };
  }

  const { parent, key } = located;

  switch (operation.op) {
    case 'add': {
      if (operation.value === undefined) {
        return { ok: false, message: `add requires value at ${operation.path}` };
      }
      if (Array.isArray(parent)) {
        if (key === '-') {
          parent.push(operation.value);
          return { ok: true, document };
        }
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index > parent.length) {
          return { ok: false, message: `invalid array index at ${operation.path}` };
        }
        parent.splice(index, 0, operation.value);
        return { ok: true, document };
      }
      if (isRecord(parent)) {
        parent[key] = operation.value;
        return { ok: true, document };
      }
      return { ok: false, message: `add target is not an object or array at ${operation.path}` };
    }
    case 'replace': {
      if (operation.value === undefined) {
        return { ok: false, message: `replace requires value at ${operation.path}` };
      }
      if (Array.isArray(parent)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
          return { ok: false, message: `invalid array index at ${operation.path}` };
        }
        parent[index] = operation.value;
        return { ok: true, document };
      }
      if (isRecord(parent)) {
        if (!(key in parent)) {
          return { ok: false, message: `replace path not found: ${operation.path}` };
        }
        parent[key] = operation.value;
        return { ok: true, document };
      }
      return { ok: false, message: `replace target is not an object or array at ${operation.path}` };
    }
    case 'remove': {
      if (Array.isArray(parent)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
          return { ok: false, message: `invalid array index at ${operation.path}` };
        }
        parent.splice(index, 1);
        return { ok: true, document };
      }
      if (isRecord(parent)) {
        if (!(key in parent)) {
          return { ok: false, message: `remove path not found: ${operation.path}` };
        }
        delete parent[key];
        return { ok: true, document };
      }
      return { ok: false, message: `remove target is not an object or array at ${operation.path}` };
    }
    default:
      return { ok: false, message: `unsupported patch op "${operation.op as string}"` };
  }
}

/**
 * Apply RFC 6902 JSON Patch operations to a JSON document (used by patch_panel).
 */
export function applyJsonPatch<T extends Record<string, JsonValue>>(
  document: T,
  operations: readonly JsonPatchOperation[],
): ApplyJsonPatchResult<T> {
  const working = cloneJsonValue(document);
  for (const operation of operations) {
    const result = applyOnePatch(working, operation);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true, document: working };
}
