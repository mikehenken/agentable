/**

 * Internal telemetry emit helpers for panel runtime and agent hooks.

 */

import type { TelemetryErrorCode } from './frozenErrorCodes';

import type {

  ComposeTelemetryEvent,

  CostTelemetryEvent,

  EmbedTelemetryEvent,

  HitlTelemetryEvent,

  TelemetryEvent,

  ToolTelemetryEvent,

  VoiceTelemetryEvent,

} from './types';



export type TelemetryEmit = (event: TelemetryEvent) => void;



export function buildComposeTelemetryEvent(

  input: Omit<ComposeTelemetryEvent, 'ts' | 'family'>,

): ComposeTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'compose',

    ...input,

  };

}



export function buildHitlTelemetryEvent(

  input: Omit<HitlTelemetryEvent, 'ts' | 'family'>,

): HitlTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'hitl',

    ...input,

  };

}



export function buildToolTelemetryEvent(

  input: Omit<ToolTelemetryEvent, 'ts' | 'family'>,

): ToolTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'tool',

    ...input,

  };

}



export function buildVoiceTelemetryEvent(

  input: Omit<VoiceTelemetryEvent, 'ts' | 'family'>,

): VoiceTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'voice',

    ...input,

  };

}



export function buildCostTelemetryEvent(

  input: Omit<CostTelemetryEvent, 'ts' | 'family'>,

): CostTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'cost',

    ...input,

  };

}



export function buildEmbedTelemetryEvent(

  input: Omit<EmbedTelemetryEvent, 'ts' | 'family'>,

): EmbedTelemetryEvent {

  return {

    ts: new Date().toISOString(),

    family: 'embed',

    ...input,

  };

}



export type { TelemetryErrorCode };


