/**
 * Map agent tool results to frozen telemetry error codes.
 */
import type { ToolResult } from '../panels/tools';
import { SCOPE_DENIED_CODE } from '../agents/toolExecutor';
import {
  isFrozenTelemetryErrorCode,
  normalizeTelemetryErrorCodes,
  type TelemetryErrorCode,
} from './frozenErrorCodes';

function readStructuredErrorCodes(payload: unknown): readonly TelemetryErrorCode[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.errors)) {
    return [];
  }
  const raw = record.errors.filter((entry): entry is { code?: unknown } => typeof entry === 'object' && entry !== null).map((entry) => (typeof entry.code === 'string' ? entry.code: undefined)).filter((code): code is string => code !== undefined);
  return normalizeTelemetryErrorCodes(raw);
}

/**
 * Derive frozen error codes from a scoped tool execution result.
 * Returns an empty array on success paths.
 */
export function extractToolErrorCodes(result: ToolResult): readonly TelemetryErrorCode[] {
  if (!result.ok) {
    if (result.error.startsWith(`${SCOPE_DENIED_CODE}:`)) {
      return ['SCOPE_DENIED'];
    }
    if (result.error.startsWith('unknown tool')) {
      return ['UNKNOWN_TOOL'];
    }
    return ['TOOL_HANDLER_ERROR'];
  }

  const payload = result.result;
  if (
    payload &&
    typeof payload === 'object' &&
    'ok' in payload &&
    (payload as { ok: unknown }).ok === false
  ) {
    const structured = readStructuredErrorCodes(payload);
    if (structured.length > 0) {
      return structured;
    }
    return ['VALIDATION'];
  }

  return [];
}

/** Validate that every code on a telemetry event is in the frozen set. */
export function assertFrozenTelemetryErrorCodes(codes: readonly string[]): void {
  for (const code of codes) {
    if (!isFrozenTelemetryErrorCode(code)) {
      throw new Error(`telemetry event carried non-frozen error code: ${code}`);
    }
  }
}
