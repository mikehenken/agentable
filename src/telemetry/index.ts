export type {
  ComposeTelemetryEvent,
  ComposeTelemetryOutcome,
  ComposeTelemetryPhase,
  ComposeTelemetryTool,
  CostTelemetryEvent,
  CostTelemetryOutcome,
  EmbedTelemetryEvent,
  EmbedTelemetryOperation,
  EmbedTelemetryOutcome,
  HitlTelemetryEvent,
  HitlTelemetryOutcome,
  HostTelemetry,
  TelemetryErrorCode,
  TelemetryEvent,
  TelemetryEventFamily,
  TelemetrySink,
  ToolTelemetryEvent,
  ToolTelemetryOutcome,
  VoiceTelemetryEvent,
  VoiceTelemetryOutcome,
} from './types';

export { createHostTelemetry } from './hostTelemetry';

export {
  isForbiddenTelemetryKey,
  isForbiddenTelemetrySecretValue,
  redactTelemetryEvent,
  redactTelemetryString,
  TELEMETRY_REDACTED,
  TELEMETRY_REDACTED_EMAIL,
} from './redactTelemetryEvent';

export {
  buildComposeTelemetryEvent,
  buildCostTelemetryEvent,
  buildEmbedTelemetryEvent,
  buildHitlTelemetryEvent,
  buildToolTelemetryEvent,
  buildVoiceTelemetryEvent,
  type TelemetryEmit,
} from './emit';

export {
  FROZEN_TELEMETRY_ERROR_CODES,
  TELEMETRY_COST_ERROR_CODES,
  TELEMETRY_EMBED_ERROR_CODES,
  TELEMETRY_TOOL_ERROR_CODES,
  TELEMETRY_VOICE_ERROR_CODES,
  isFrozenTelemetryErrorCode,
  normalizeTelemetryErrorCodes,
} from './frozenErrorCodes';

export {
  assertFrozenTelemetryErrorCodes,
  extractToolErrorCodes,
} from './extractToolErrorCodes';

export { wrapBudgetWithTelemetry } from './budgetBridge';

export {
  bindVoiceTelemetry,
  resetVoiceTelemetrySessionCounterForTests,
} from './voiceBridge';

export {
  clearEmbedTelemetryEmitForTests,
  emitEmbedRateLimitTelemetry,
  registerEmbedTelemetryEmit,
} from './embedBridge';
