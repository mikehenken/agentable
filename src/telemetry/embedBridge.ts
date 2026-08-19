/**
 * Embed rate-limit telemetry bridge ( ).
 *
 * Embeds may emit before `createCanvasHost` exists; hosts wire
 * `registerEmbedTelemetryEmit(host.telemetry.emit)` at host construction.
 */
import { buildEmbedTelemetryEvent, type TelemetryEmit } from './emit';
import type { EmbedTelemetryOperation, EmbedTelemetryOutcome } from './types';

let activeEmit: TelemetryEmit | null = null;

export function registerEmbedTelemetryEmit(emit: TelemetryEmit): () => void {
  activeEmit = emit;
  return () => {
    if (activeEmit === emit) {
      activeEmit = null;
    }
  };
}

export function clearEmbedTelemetryEmitForTests(): void {
  activeEmit = null;
}

export interface EmbedRateLimitTelemetryInput {
  operation: EmbedTelemetryOperation;
  outcome: EmbedTelemetryOutcome;
  retryAfterMs?: number;
  limit?: number;
  windowMs?: number;
  anonKeyHint?: string;
}

export function emitEmbedRateLimitTelemetry(input: EmbedRateLimitTelemetryInput): void {
  if (!activeEmit) {
    return;
  }

  activeEmit(
    buildEmbedTelemetryEvent({
      operation: input.operation,
      outcome: input.outcome,
      retryAfterMs: input.retryAfterMs,
      limit: input.limit,
      windowMs: input.windowMs,
      anonKeyHint: input.anonKeyHint,
      errorCodes: input.outcome === 'refused' ? ['RATE_LIMITED']: undefined,
    }));
}
