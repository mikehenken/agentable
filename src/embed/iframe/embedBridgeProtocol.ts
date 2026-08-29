/**
 * Typed postMessage bridge between a script-stripping parent host and an
 * agentable iframe surface.
 */
import type { PageSessionSnapshot } from '../../session/pageSession';

export const EMBED_BRIDGE_VERSION = '1' as const;

export type EmbedBridgeVersion = typeof EMBED_BRIDGE_VERSION;

/** Parent → child commands (no script execution or DOM access). */
export type EmbedBridgeParentCommandType =
  | 'agentable:bridge:handshake'
  | 'agentable:bridge:ping'
  | 'agentable:bridge:resize';

/** Child → parent notifications. */
export type EmbedBridgeChildEventType =
  | 'agentable:bridge:handshake-ack'
  | 'agentable:bridge:pong'
  | 'agentable:bridge:event'
  | 'agentable:bridge:session'
  | 'agentable:bridge:error';

export type EmbedBridgeMessageType =
  | EmbedBridgeParentCommandType
  | EmbedBridgeChildEventType;

export type EmbedBridgeSurface = 'panel' | 'canvas' | 'widget';

export interface EmbedBridgeHandshakePayload {
  bridgeId: string;
  parentOrigin: string;
}

export interface EmbedBridgeHandshakeAckPayload {
  bridgeId: string;
  surface: EmbedBridgeSurface;
  sessionId: string;
}

export interface EmbedBridgePingPayload {
  bridgeId: string;
}

export interface EmbedBridgePongPayload {
  bridgeId: string;
}

export interface EmbedBridgeResizePayload {
  bridgeId: string;
  width: number;
  height: number;
}

export interface EmbedBridgeEventPayload {
  bridgeId: string;
  eventType: string;
  detail: Record<string, unknown>;
}

export interface EmbedBridgeSessionPayload {
  bridgeId: string;
  snapshot: PageSessionSnapshot;
}

export interface EmbedBridgeErrorPayload {
  bridgeId: string;
  code: string;
  message: string;
}

export type EmbedBridgePayloadMap = {
  'agentable:bridge:handshake': EmbedBridgeHandshakePayload;
  'agentable:bridge:handshake-ack': EmbedBridgeHandshakeAckPayload;
  'agentable:bridge:ping': EmbedBridgePingPayload;
  'agentable:bridge:pong': EmbedBridgePongPayload;
  'agentable:bridge:resize': EmbedBridgeResizePayload;
  'agentable:bridge:event': EmbedBridgeEventPayload;
  'agentable:bridge:session': EmbedBridgeSessionPayload;
  'agentable:bridge:error': EmbedBridgeErrorPayload;
};

export interface EmbedBridgeEnvelope<
  TType extends EmbedBridgeMessageType = EmbedBridgeMessageType,
> {
  v: EmbedBridgeVersion;
  type: TType;
  payload: EmbedBridgePayloadMap[TType];
}

/**
 * One concrete envelope per message type. Unlike `EmbedBridgeEnvelope` with
 * its default union type argument (whose `payload` collapses to a union that
 * never narrows), this union is discriminated on `type`, so a `switch` over
 * `envelope.type` narrows `envelope.payload` to the matching payload shape.
 */
export type EmbedBridgeMessage = {
  [K in EmbedBridgeMessageType]: EmbedBridgeEnvelope<K>;
}[EmbedBridgeMessageType];

/** Parent → child command envelopes, discriminated on `type`. */
export type EmbedBridgeParentCommand = {
  [K in EmbedBridgeParentCommandType]: EmbedBridgeEnvelope<K>;
}[EmbedBridgeParentCommandType];

/** Child → parent event envelopes, discriminated on `type`. */
export type EmbedBridgeChildEvent = {
  [K in EmbedBridgeChildEventType]: EmbedBridgeEnvelope<K>;
}[EmbedBridgeChildEventType];

const PARENT_COMMAND_TYPES: ReadonlySet<string> = new Set([
  'agentable:bridge:handshake',
  'agentable:bridge:ping',
  'agentable:bridge:resize',
]);

const CHILD_EVENT_TYPES: ReadonlySet<string> = new Set([
  'agentable:bridge:handshake-ack',
  'agentable:bridge:pong',
  'agentable:bridge:event',
  'agentable:bridge:session',
  'agentable:bridge:error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const BRIDGE_SURFACES: ReadonlySet<string> = new Set(['panel', 'canvas', 'widget']);

function isBridgeSurface(value: unknown): value is EmbedBridgeSurface {
  return typeof value === 'string' && BRIDGE_SURFACES.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isKnownBridgeMessageType(value: string): value is EmbedBridgeMessageType {
  return PARENT_COMMAND_TYPES.has(value) || CHILD_EVENT_TYPES.has(value);
}

/**
 * Field-level validation for untrusted postMessage payloads. Every payload
 * must carry a string `bridgeId`; per-type required fields are verified so
 * downstream handlers can rely on the discriminated envelope union without
 * re-validating each field.
 */
function isPayloadValidForType(
  type: EmbedBridgeMessageType,
  payload: Record<string, unknown>,
): boolean {
  if (typeof payload.bridgeId !== 'string') {
    return false;
  }
  switch (type) {
    case 'agentable:bridge:handshake':
      return typeof payload.parentOrigin === 'string';
    case 'agentable:bridge:handshake-ack':
      return isBridgeSurface(payload.surface) && typeof payload.sessionId === 'string';
    case 'agentable:bridge:ping':
    case 'agentable:bridge:pong':
      return true;
    case 'agentable:bridge:resize':
      return isFiniteNumber(payload.width) && isFiniteNumber(payload.height);
    case 'agentable:bridge:event':
      return typeof payload.eventType === 'string' && isRecord(payload.detail);
    case 'agentable:bridge:session':
      return isRecord(payload.snapshot);
    case 'agentable:bridge:error':
      return typeof payload.code === 'string' && typeof payload.message === 'string';
  }
}

export function createBridgeEnvelope<TType extends EmbedBridgeMessageType>(
  type: TType,
  payload: EmbedBridgePayloadMap[TType],
): EmbedBridgeEnvelope<TType> {
  return { v: EMBED_BRIDGE_VERSION, type, payload };
}

export function parseBridgeEnvelope(data: unknown): EmbedBridgeMessage | null {
  if (!isRecord(data)) {
    return null;
  }
  if (data.v !== EMBED_BRIDGE_VERSION) {
    return null;
  }
  if (typeof data.type !== 'string' || !isKnownBridgeMessageType(data.type)) {
    return null;
  }
  if (!isRecord(data.payload)) {
    return null;
  }
  if (!isPayloadValidForType(data.type, data.payload)) {
    return null;
  }
  // Safety: postMessage boundary — `type` membership and the per-type payload
  // fields were verified by isPayloadValidForType above; TS cannot correlate
  // the already-validated type/payload pair across the discriminated union.
  return {
    v: EMBED_BRIDGE_VERSION,
    type: data.type,
    payload: data.payload,
  } as unknown as EmbedBridgeMessage;
}

export function isParentBridgeCommand(
  envelope: EmbedBridgeEnvelope,
): envelope is EmbedBridgeParentCommand {
  return PARENT_COMMAND_TYPES.has(envelope.type);
}

export function isChildBridgeEvent(
  envelope: EmbedBridgeEnvelope,
): envelope is EmbedBridgeChildEvent {
  return CHILD_EVENT_TYPES.has(envelope.type);
}

/** Default sandbox for oEmbed / CMS iframe snippets (scripts only inside our origin). */
export const IFRAME_EMBED_SANDBOX =
  'allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox' as const;

export const IFRAME_EMBED_DEFAULT_WIDTH = 640;
export const IFRAME_EMBED_DEFAULT_HEIGHT = 480;
