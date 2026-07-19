/**
 * Spec binding resolution for the renderer: `$scope.<key>` in source
 * params, and `$scope.<key>` / `$state.<key>` / `$data.<source>.<path>`
 * operands inside `showIf` conditions (02 section 2 rules).
 */
import type { JsonObject, JsonValue, PanelScope, SpecCondition } from '../types';

const SCOPE_PREFIX = '$scope.';
const STATE_PREFIX = '$state.';
const DATA_PREFIX = '$data.';

export function resolveScopeBinding(expression: string, scope: PanelScope): JsonValue {
  const key = expression.slice(SCOPE_PREFIX.length);
  if (key === 'contextId') return scope.contextId ?? null;
  if (key === 'entityId') return scope.entityId ?? null;
  return null;
}

/** Replace `$scope.*` strings inside source params with scope values. */
export function resolveSourceParams(
  params: JsonObject | undefined,
  scope: PanelScope,
): JsonObject | undefined {
  if (params === undefined) return undefined;
  return resolveParamsValue(params, scope) as JsonObject;
}

function resolveParamsValue(value: JsonValue, scope: PanelScope): JsonValue {
  if (typeof value === 'string') {
    return value.startsWith(SCOPE_PREFIX) ? resolveScopeBinding(value, scope) : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveParamsValue(entry, scope));
  }
  if (typeof value === 'object' && value !== null) {
    const next: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = resolveParamsValue(entry, scope);
    }
    return next;
  }
  return value;
}

function readPath(value: unknown, path: string[]): JsonValue {
  let current: unknown = value;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return (current ?? null) as JsonValue;
}

export interface ShowIfEnvironment {
  scope: PanelScope;
  state: JsonObject;
  /** Data for source names referenced by `$data.*` operands. */
  sourceData: (sourceName: string) => unknown;
}

function resolveOperand(operand: JsonValue, env: ShowIfEnvironment): JsonValue {
  if (typeof operand !== 'string') return operand;
  if (operand.startsWith(SCOPE_PREFIX)) {
    return resolveScopeBinding(operand, env.scope);
  }
  if (operand.startsWith(STATE_PREFIX)) {
    return (env.state[operand.slice(STATE_PREFIX.length)] ?? null) as JsonValue;
  }
  if (operand.startsWith(DATA_PREFIX)) {
    const segments = operand.slice(DATA_PREFIX.length).split('.');
    const [sourceName, ...path] = segments;
    if (sourceName === undefined || sourceName.length === 0) return null;
    return readPath(env.sourceData(sourceName), path);
  }
  return operand;
}

/** Source names referenced by `$data.*` operands in a condition. */
export function showIfDataSources(condition: SpecCondition | undefined): string[] {
  if (condition === undefined) return [];
  const names = new Set<string>();
  for (const operand of condition.$eq) {
    if (typeof operand === 'string' && operand.startsWith(DATA_PREFIX)) {
      const name = operand.slice(DATA_PREFIX.length).split('.')[0];
      if (name !== undefined && name.length > 0) names.add(name);
    }
  }
  return [...names];
}

export function evaluateShowIf(
  condition: SpecCondition | undefined,
  env: ShowIfEnvironment,
): boolean {
  if (condition === undefined) return true;
  const [left, right] = condition.$eq;
  const a = resolveOperand(left, env);
  const b = resolveOperand(right, env);
  return jsonEquals(a, b);
}

function jsonEquals(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => jsonEquals(entry, b[index] as JsonValue));
  }
  if (
    typeof a === 'object' &&
    a !== null &&
    !Array.isArray(a) &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(b)
  ) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => jsonEquals(a[key] as JsonValue, (b as JsonObject)[key] as JsonValue));
  }
  return false;
}
