/**

 * Runtime telemetry event shapes.

 *

 * establishes the host sink boundary; expands event coverage

 * and frozen error-code snapshots across compose/HITL/tool/voice/cost families.

 */

import type { ToolCostClass } from '../panels/tools';

import type { TelemetryErrorCode } from './frozenErrorCodes';



export type TelemetryEventFamily = 'compose' | 'hitl' | 'tool' | 'voice' | 'cost' | 'embed';



export interface TelemetryEventBase {

  /** ISO-8601 timestamp assigned at emit time. */

  ts: string;

  family: TelemetryEventFamily;

}



export type ComposeTelemetryPhase = 'compose' | 'repair';



export type ComposeTelemetryOutcome = 'rejected' | 'success' | 'repaired_success';



export type ComposeTelemetryTool = 'compose_panel' | 'patch_panel';



export interface ComposeTelemetryEvent extends TelemetryEventBase {

  family: 'compose';

  phase: ComposeTelemetryPhase;

  outcome: ComposeTelemetryOutcome;

  tool: ComposeTelemetryTool;

  agentRepairEligible?: boolean;

  errorCodes?: readonly TelemetryErrorCode[];

  panelId?: string;

}



export type HitlTelemetryOutcome = 'queued' | 'approved' | 'rejected' | 'timeout';



export interface HitlTelemetryEvent extends TelemetryEventBase {

  family: 'hitl';

  outcome: HitlTelemetryOutcome;

  panelId: string;

  definitionId: string;

  actionId: string;

  agentId?: string;

}



export type ToolTelemetryOutcome = 'success' | 'error';



export interface ToolTelemetryEvent extends TelemetryEventBase {

  family: 'tool';

  toolName: string;

  outcome: ToolTelemetryOutcome;

  /** Wall-clock handler duration in milliseconds. */

  latencyMs: number;

  agentId?: string;

  errorCodes?: readonly TelemetryErrorCode[];

}



export type VoiceTelemetryOutcome = 'connected' | 'dropped' | 'reconnected' | 'error';



export interface VoiceTelemetryEvent extends TelemetryEventBase {

  family: 'voice';

  outcome: VoiceTelemetryOutcome;

  sessionId?: string;

  errorCodes?: readonly TelemetryErrorCode[];

}



export type CostTelemetryOutcome = 'recorded' | 'refused';



export interface CostTelemetryEvent extends TelemetryEventBase {

  family: 'cost';

  outcome: CostTelemetryOutcome;

  agentId: string;

  capability: string;

  costClass: ToolCostClass;

  units: number;

  errorCodes?: readonly TelemetryErrorCode[];

}



export type EmbedTelemetryOperation = 'tenant_lookup' | 'embed_bootstrap';



export type EmbedTelemetryOutcome = 'allowed' | 'refused';



export interface EmbedTelemetryEvent extends TelemetryEventBase {

  family: 'embed';

  operation: EmbedTelemetryOperation;

  outcome: EmbedTelemetryOutcome;

  retryAfterMs?: number;

  limit?: number;

  windowMs?: number;

  /** Truncated anon-key hint — never the full key. */

  anonKeyHint?: string;

  errorCodes?: readonly TelemetryErrorCode[];

}



export type TelemetryEvent =

  | ComposeTelemetryEvent

  | HitlTelemetryEvent

  | ToolTelemetryEvent

  | VoiceTelemetryEvent

  | CostTelemetryEvent

  | EmbedTelemetryEvent;



/** Host-supplied sink registered on `host.telemetry`. */

export type TelemetrySink = (event: TelemetryEvent) => void;



/** `host.telemetry` surface on `createCanvasHost`. */

export interface HostTelemetry {

  /** Register a host-supplied sink. Returns an unregister function. */

  registerSink(sink: TelemetrySink): () => void;

  /** Emit a structured runtime telemetry event to the registered sink. */

  emit(event: TelemetryEvent): void;

}



export type { TelemetryErrorCode };


