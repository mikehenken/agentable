/**
 * Host-facing telemetry facade (`host.telemetry`, D55).
 *
 * Mirrors the model-resolver boundary (D49): the framework emits structured
 * events; the host registers a sink that routes them to its own stack.
 */
import { redactTelemetryEvent } from './redactTelemetryEvent';
import type { HostTelemetry, TelemetryEvent, TelemetrySink } from './types';

export function createHostTelemetry(initialSink?: TelemetrySink): HostTelemetry {
  let activeSink: TelemetrySink | null = initialSink ?? null;

  return {
    registerSink(sink: TelemetrySink): () => void {
      activeSink = sink;
      return () => {
        if (activeSink === sink) {
          activeSink = null;
        }
      };
    },

    emit(event: TelemetryEvent): void {
      if (!activeSink) {
        return;
      }
      activeSink(redactTelemetryEvent(event));
    },
  };
}
