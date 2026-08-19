import type { JsonValue } from '../types';
import { sanitizeInertText } from '../../security/codeExecutionBoundary';
import type { PayloadDiffEntry } from './types';

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableStringify(value: JsonValue | undefined): string {
  if (value === undefined) return '';
  return JSON.stringify(value);
}

/**
 * Field-level diff between current panel data and a pending action payload.
 * Only paths present in the payload are compared; unchanged values are omitted.
 */
export function computePayloadDiff(
  currentData: Record<string, JsonValue>,
  payload: Record<string, JsonValue>): PayloadDiffEntry[] {
  const entries: PayloadDiffEntry[] = [];

  for (const [path, after] of Object.entries(payload)) {
    const before = currentData[path];
    if (before === undefined) {
      entries.push({ path, before: undefined, after, kind: 'add' });
      continue;
    }
    if (stableStringify(before) !== stableStringify(after)) {
      entries.push({ path, before, after, kind: 'change' });
    }
  }

  for (const path of Object.keys(currentData)) {
    if (!(path in payload)) {
      entries.push({
        path,
        before: currentData[path],
        after: undefined,
        kind: 'remove',
      });
    }
  }

  return entries;
}

export function mergePayloadIntoCurrent(
  currentData: Record<string, JsonValue>,
  payload: Record<string, JsonValue>): Record<string, JsonValue> {
  const next: Record<string, JsonValue> = {...currentData };
  for (const [path, value] of Object.entries(payload)) {
    if (value === null && isRecord(currentData) && path in currentData) {
      delete next[path];
      continue;
    }
    next[path] = value;
  }
  return next;
}

export function formatDiffValue(value: JsonValue | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return sanitizeInertText(value);
  return JSON.stringify(value, null, 2);
}
