import type { JsonObject, JsonValue } from '../panels/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonPointerToPathSegments(pointer: string): string[] {
  if (pointer === '' || pointer === '/') {
    return [];
  }
  const normalized = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  return normalized.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Read a JSON Pointer value from a plain data model object. */
export function readDataModelPath(dataModel: JsonObject, pointer: string): JsonValue | undefined {
  const segments = jsonPointerToPathSegments(pointer);
  let current: JsonValue | undefined = dataModel;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/** Write or replace a value at a JSON Pointer path (merge into data model). */
export function writeDataModelPath(
  dataModel: JsonObject,
  pointer: string | undefined,
  value: JsonValue | undefined,
): JsonObject {
  const path = pointer === undefined || pointer === '' ? '/' : pointer;
  if (path === '/') {
    return isRecord(value) ? { ...value } : {};
  }
  const segments = jsonPointerToPathSegments(path);
  if (segments.length === 0) {
    return isRecord(value) ? { ...value } : dataModel;
  }
  const root: JsonObject = { ...dataModel };
  let cursor: JsonObject = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    const next = cursor[key];
    const nextObject: JsonObject = isRecord(next) ? { ...next } : {};
    cursor[key] = nextObject;
    cursor = nextObject;
  }
  const leaf = segments[segments.length - 1]!;
  if (value === undefined) {
    delete cursor[leaf];
  } else {
    cursor[leaf] = value;
  }
  return root;
}

export interface ResolveDynamicOptions {
  dataModel: JsonObject;
  /** When true, unresolved function calls become empty string instead of error. */
  allowUnresolvedFunctions?: boolean;
}

export type ResolveDynamicResult =
  | { ok: true; value: JsonValue }
  | { ok: false; reason: string };

/**
 * Resolve an A2UI Dynamic* value: literal primitives, `{ path }`, or
 * `{ literalString }` / `{ literalNumber }` wrappers from older examples.
 */
export function resolveDynamicValue(
  raw: unknown,
  options: ResolveDynamicOptions,
): ResolveDynamicResult {
  if (
    raw === null ||
    typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
  ) {
    return { ok: true, value: raw };
  }
  if (Array.isArray(raw)) {
    return { ok: true, value: raw as JsonValue };
  }
  if (!isRecord(raw)) {
    return { ok: false, reason: 'Dynamic value must be a literal or binding object' };
  }
  if (typeof raw.path === 'string') {
    const resolved = readDataModelPath(options.dataModel, raw.path);
    if (resolved === undefined) {
      return { ok: false, reason: `Data model path "${raw.path}" is undefined` };
    }
    return { ok: true, value: resolved };
  }
  if (typeof raw.literalString === 'string') {
    return { ok: true, value: raw.literalString };
  }
  if (typeof raw.literalNumber === 'number') {
    return { ok: true, value: raw.literalNumber };
  }
  if (typeof raw.literalBoolean === 'boolean') {
    return { ok: true, value: raw.literalBoolean };
  }
  if (raw.call !== undefined || raw.functionCall !== undefined) {
    if (options.allowUnresolvedFunctions) {
      return { ok: true, value: '' };
    }
    return { ok: false, reason: 'Function-call dynamic values are not supported in v1 ingestion' };
  }
  return { ok: false, reason: 'Unrecognized dynamic value shape' };
}

export function resolveDynamicString(
  raw: unknown,
  options: ResolveDynamicOptions,
): ResolveDynamicResult {
  const resolved = resolveDynamicValue(raw, options);
  if (!resolved.ok) {
    return resolved;
  }
  if (typeof resolved.value === 'string') {
    return resolved;
  }
  if (resolved.value === null || resolved.value === undefined) {
    return { ok: true, value: '' };
  }
  return { ok: true, value: String(resolved.value) };
}

/** Convert `/contact/email` to nested `{ contact: { email } }` for PanelSpec.state. */
export function dataModelToPanelState(dataModel: JsonObject): JsonObject {
  return { ...dataModel };
}
