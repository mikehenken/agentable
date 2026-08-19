/**
 * Frozen telemetry error vocabulary ( ).
 *
 * Compose/patch rejections use repair codes; tool/voice/cost layers
 * extend the same snapshot-tested set so host sinks never see ad-hoc strings.
 */
import {
  FROZEN_REPAIR_ERROR_CODES,
  isFrozenRepairErrorCode,
  type RepairErrorCode,
} from '../panels/spec/repairVocabulary';

/** Agent tool-scope and executor-layer rejections. */
export const TELEMETRY_TOOL_ERROR_CODES = [
  'SCOPE_DENIED',
  'UNKNOWN_TOOL',
  'TOOL_HANDLER_ERROR',
] as const;

/** Voice transport outcomes surfaced to telemetry. */
export const TELEMETRY_VOICE_ERROR_CODES = [
  'VOICE_CONNECT_FAILED',
  'VOICE_RECONNECT_EXHAUSTED',
] as const;

/** Budget costClass refusal codes ( costClass). */
export const TELEMETRY_COST_ERROR_CODES = ['BUDGET_HARD_CAP'] as const;

/** Public embed anon-key rate limit refusals ( ). */
export const TELEMETRY_EMBED_ERROR_CODES = ['RATE_LIMITED'] as const;

export type TelemetryToolErrorCode = (typeof TELEMETRY_TOOL_ERROR_CODES)[number];
export type TelemetryVoiceErrorCode = (typeof TELEMETRY_VOICE_ERROR_CODES)[number];
export type TelemetryCostErrorCode = (typeof TELEMETRY_COST_ERROR_CODES)[number];
export type TelemetryEmbedErrorCode = (typeof TELEMETRY_EMBED_ERROR_CODES)[number];

export type TelemetryErrorCode =
  | RepairErrorCode
  | TelemetryToolErrorCode
  | TelemetryVoiceErrorCode
  | TelemetryCostErrorCode
  | TelemetryEmbedErrorCode;

/**
 * Canonical sorted frozen codes for telemetry `errorCodes` fields.
 * Snapshot-tested in.
 */
export const FROZEN_TELEMETRY_ERROR_CODES = [...FROZEN_REPAIR_ERROR_CODES,...TELEMETRY_TOOL_ERROR_CODES,...TELEMETRY_VOICE_ERROR_CODES,...TELEMETRY_COST_ERROR_CODES,...TELEMETRY_EMBED_ERROR_CODES,
] as const satisfies readonly TelemetryErrorCode[];

const frozenSet = new Set<string>(FROZEN_TELEMETRY_ERROR_CODES);

export function isFrozenTelemetryErrorCode(code: string): code is TelemetryErrorCode {
  return frozenSet.has(code) || isFrozenRepairErrorCode(code);
}

/** Assert every code is frozen; drops unknown entries. */
export function normalizeTelemetryErrorCodes(
  codes: readonly string[]): readonly TelemetryErrorCode[] {
  const normalized: TelemetryErrorCode[] = [];
  for (const code of codes) {
    if (isFrozenTelemetryErrorCode(code)) {
      normalized.push(code);
    }
  }
  return normalized;
}
