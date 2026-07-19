/**
 * Cache key construction for source bindings. Params serialize with
 * sorted object keys so semantically equal bindings share one cache
 * entry regardless of property order.
 */
import type { JsonValue, PanelScope } from '../types';
import type { SourceRef } from './types';

export function stableStringify(value: JsonValue | undefined): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',');
  return `{${body}}`;
}

export function sourceCacheKey(ref: SourceRef, scope: PanelScope): string {
  return JSON.stringify([
    ref.source,
    stableStringify(ref.params),
    scope.contextId ?? null,
    scope.entityId ?? null,
  ]);
}

/** Partial scope match: a filter matches on every key it defines. */
export function scopeMatches(filter: PanelScope, scope: PanelScope): boolean {
  if (filter.contextId !== undefined && filter.contextId !== scope.contextId) return false;
  if (filter.entityId !== undefined && filter.entityId !== scope.entityId) return false;
  return true;
}
