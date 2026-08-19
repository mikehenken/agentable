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

export function createBridgeEnvelope<TType extends EmbedBridgeMessageType>(
  type: TType,
  payload: EmbedBridgePayloadMap[TType],
): EmbedBridgeEnvelope<TType> {
  return { v: EMBED_BRIDGE_VERSION, type, payload };
}

export function parseBridgeEnvelope(data: unknown): EmbedBridgeEnvelope | null {
  if (!isRecord(data)) {
    return null;
  }
  if (data.v !== EMBED_BRIDGE_VERSION) {
    return null;
  }
  if (typeof data.type !== 'string') {
    return null;
  }
  if (!isRecord(data.payload)) {
    return null;
  }
  const type = data.type as EmbedBridgeMessageType;
  if (!PARENT_COMMAND_TYPES.has(type) && !CHILD_EVENT_TYPES.has(type)) {
    return null;
  }
  return {
    v: EMBED_BRIDGE_VERSION,
    type,
    payload: data.payload as EmbedBridgePayloadMap[typeof type],
  };
}

export function isParentBridgeCommand(
  envelope: EmbedBridgeEnvelope,
): envelope is EmbedBridgeEnvelope<EmbedBridgeParentCommandType> {
  return PARENT_COMMAND_TYPES.has(envelope.type);
}

export function isChildBridgeEvent(
  envelope: EmbedBridgeEnvelope,
): envelope is EmbedBridgeEnvelope<EmbedBridgeChildEventType> {
  return CHILD_EVENT_TYPES.has(envelope.type);
}

/** Default sandbox for oEmbed / CMS iframe snippets (scripts only inside our origin). */
export const IFRAME_EMBED_SANDBOX =
  'allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox' as const;

export const IFRAME_EMBED_DEFAULT_WIDTH = 640;
export const IFRAME_EMBED_DEFAULT_HEIGHT = 480;
