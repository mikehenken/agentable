/**
 * Dot-path read/write helpers for field-form draft values. Segments may be
 * object keys or numeric array indices (`rules.0.name`).
 */
import type { JsonObject, JsonValue } from '../types';

export function splitFieldPath(path: string): string[] {
  if (path.length === 0) return [];
  return path.split('.').filter((segment) => segment.length > 0);
}

export function readFieldPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of splitFieldPath(path)) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function writeFieldPath(root: Record<string, unknown>, path: string, nextValue: unknown): void {
  const segments = splitFieldPath(path);
  if (segments.length === 0) return;

  let current: Record<string, unknown> | unknown[] = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) return;

    const child = readChild(current, segment);
    if (child === undefined) {
      const created = createContainer(segments[index + 1]);
      assignChild(current, segment, created);
      current = created;
      continue;
    }
    current = child;
  }

  const leaf = segments[segments.length - 1];
  if (leaf === undefined) return;
  assignChild(current, leaf, nextValue);
}

function readChild(
  container: Record<string, unknown> | unknown[],
  segment: string): Record<string, unknown> | unknown[] | undefined {
  if (Array.isArray(container)) {
    const index = Number(segment);
    if (!Number.isInteger(index) || index < 0 || index >= container.length) {
      return undefined;
    }
    const value = container[index];
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown> | unknown[];
    }
    return undefined;
  }
  const value = container[segment];
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown> | unknown[];
  }
  return undefined;
}

function createContainer(nextSegment: string | undefined): Record<string, unknown> | unknown[] {
  if (nextSegment !== undefined && /^\d+$/.test(nextSegment)) {
    return [];
  }
  return {};
}

function assignChild(
  container: Record<string, unknown> | unknown[],
  segment: string,
  value: unknown): void {
  if (Array.isArray(container)) {
    const index = Number(segment);
    if (!Number.isInteger(index) || index < 0) return;
    while (container.length <= index) {
      container.push(null);
    }
    container[index] = value;
    return;
  }
  container[segment] = value as JsonValue;
}

export function cloneRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return structuredClone(value) as Record<string, unknown>;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry));
}

export function mergeDraft(
  serverData: Record<string, unknown> | undefined,
  draft: Record<string, unknown> | null): Record<string, unknown> {
  if (draft !== null) return draft;
  return serverData !== undefined ? cloneRecord(serverData): {};
}
