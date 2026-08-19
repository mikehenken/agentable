/**
 * reference telemetry sink.
 *
 * Host-side example: route structured canvas telemetry by family and
 * validate frozen error codes before forwarding to your observability stack.
 *
 * See docs/features/telemetry-event-catalog.md
 */
import {
  assertFrozenTelemetryErrorCodes,
  type TelemetryEvent,
  type TelemetrySink,
} from '../../src/telemetry';

export interface ReferenceTelemetryRecord {
  readonly kind: TelemetryEvent['family'];
  readonly ts: string;
  readonly payload: Record<string, unknown>;
}

export type ReferenceTelemetryRecorder = (record: ReferenceTelemetryRecord) => void;

/**
 * Build a host-supplied sink suitable for `createCanvasHost({ telemetrySink })`
 * or `host.telemetry.registerSink(...)`.
 */
export function createReferenceTelemetrySink(
  recorder: ReferenceTelemetryRecorder): TelemetrySink {
  return (event: TelemetryEvent) => {
    if (event.errorCodes !== undefined && event.errorCodes.length > 0) {
      assertFrozenTelemetryErrorCodes(event.errorCodes);
    }

    switch (event.family) {
      case 'compose':
        recorder({
          kind: 'compose',
          ts: event.ts,
          payload: {
            phase: event.phase,
            outcome: event.outcome,
            tool: event.tool,
            panelId: event.panelId,
            agentRepairEligible: event.agentRepairEligible,
            errorCodes: event.errorCodes,
          },
        });
        break;
      case 'hitl':
        recorder({
          kind: 'hitl',
          ts: event.ts,
          payload: {
            outcome: event.outcome,
            panelId: event.panelId,
            definitionId: event.definitionId,
            actionId: event.actionId,
            agentId: event.agentId,
          },
        });
        break;
      case 'tool':
        recorder({
          kind: 'tool',
          ts: event.ts,
          payload: {
            toolName: event.toolName,
            outcome: event.outcome,
            latencyMs: event.latencyMs,
            agentId: event.agentId,
            errorCodes: event.errorCodes,
          },
        });
        break;
      case 'voice':
        recorder({
          kind: 'voice',
          ts: event.ts,
          payload: {
            outcome: event.outcome,
            sessionId: event.sessionId,
            errorCodes: event.errorCodes,
          },
        });
        break;
      case 'cost':
        recorder({
          kind: 'cost',
          ts: event.ts,
          payload: {
            outcome: event.outcome,
            agentId: event.agentId,
            capability: event.capability,
            costClass: event.costClass,
            units: event.units,
            errorCodes: event.errorCodes,
          },
        });
        break;
      case 'embed':
        recorder({
          kind: 'embed',
          ts: event.ts,
          payload: {
            operation: event.operation,
            outcome: event.outcome,
            retryAfterMs: event.retryAfterMs,
            limit: event.limit,
            windowMs: event.windowMs,
            anonKeyHint: event.anonKeyHint,
            errorCodes: event.errorCodes,
          },
        });
        break;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }
  };
}
