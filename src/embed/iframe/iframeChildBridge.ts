/**
 * Child-side postMessage bridge — runs inside the sandboxed iframe host page.
 */
import { ensurePageSession, type PageSessionSnapshot } from '../../session/pageSession';
import {
  createBridgeEnvelope,
  isParentBridgeCommand,
  parseBridgeEnvelope,
  type EmbedBridgeEnvelope,
  type EmbedBridgeSurface,
} from './embedBridgeProtocol';
import { isOriginAllowed, parseAllowedOrigins } from './originValidation';

export interface IframeChildBridgeOptions {
  bridgeId: string;
  surface: EmbedBridgeSurface;
  allowedParentOrigins: readonly string[];
  targetWindow?: Window;
  onResize?: (size: { width: number; height: number }) => void;
}

export interface IframeChildBridge {
  start(): () => void;
  publishEvent(eventType: string, detail: Record<string, unknown>): void;
  publishSessionSnapshot(snapshot?: PageSessionSnapshot): void;
}

function postToParent(
  target: Window,
  origin: string,
  envelope: EmbedBridgeEnvelope): void {
  target.postMessage(envelope, origin);
}

export function createIframeChildBridge(options: IframeChildBridgeOptions): IframeChildBridge {
  const parentWindow = options.targetWindow ?? window.parent;
  let handshakeOrigin: string | null = null;
  let started = false;

  const publishSessionSnapshot = (snapshot?: PageSessionSnapshot): void => {
    if (handshakeOrigin === null) {
      return;
    }
    const session = ensurePageSession();
    postToParent(
      parentWindow,
      handshakeOrigin,
      createBridgeEnvelope('agentable:bridge:session', {
        bridgeId: options.bridgeId,
        snapshot: snapshot ?? session.getSnapshot(),
      }));
  };

  const publishEvent = (eventType: string, detail: Record<string, unknown>): void => {
    if (handshakeOrigin === null) {
      return;
    }
    postToParent(
      parentWindow,
      handshakeOrigin,
      createBridgeEnvelope('agentable:bridge:event', {
        bridgeId: options.bridgeId,
        eventType,
        detail,
      }));
  };

  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== parentWindow) {
      return;
    }
    if (!isOriginAllowed(event.origin, options.allowedParentOrigins)) {
      return;
    }
    const envelope = parseBridgeEnvelope(event.data);
    if (envelope === null || !isParentBridgeCommand(envelope)) {
      return;
    }
    if (envelope.payload.bridgeId !== options.bridgeId) {
      return;
    }

    switch (envelope.type) {
      case 'agentable:bridge:handshake': {
        handshakeOrigin = envelope.payload.parentOrigin;
        if (!isOriginAllowed(handshakeOrigin, options.allowedParentOrigins)) {
          postToParent(
            parentWindow,
            event.origin,
            createBridgeEnvelope('agentable:bridge:error', {
              bridgeId: options.bridgeId,
              code: 'ORIGIN_DENIED',
              message: 'Parent origin is not in the embed allowlist.',
            }));
          return;
        }
        const session = ensurePageSession();
        postToParent(
          parentWindow,
          handshakeOrigin,
          createBridgeEnvelope('agentable:bridge:handshake-ack', {
            bridgeId: options.bridgeId,
            surface: options.surface,
            sessionId: session.sessionId,
          }));
        publishSessionSnapshot(session.getSnapshot());
        break;
      }
      case 'agentable:bridge:ping': {
        if (handshakeOrigin === null) {
          return;
        }
        postToParent(
          parentWindow,
          handshakeOrigin,
          createBridgeEnvelope('agentable:bridge:pong', {
            bridgeId: options.bridgeId,
          }));
        break;
      }
      case 'agentable:bridge:resize': {
        options.onResize?.({
          width: envelope.payload.width,
          height: envelope.payload.height,
        });
        break;
      }
      default:
        break;
    }
  };

  return {
    start() {
      if (started) {
        return () => undefined;
      }
      started = true;
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
        started = false;
        handshakeOrigin = null;
      };
    },
    publishEvent,
    publishSessionSnapshot,
  };
}

/** Resolve parent-origin allowlist from iframe host query params. */
export function readParentOriginAllowlistFromSearchParams(
  params: URLSearchParams,
  referrer?: string | null): string[] {
  const explicit = parseAllowedOrigins(params.get('parent-origin') ?? undefined);
  if (explicit.length > 0) {
    return explicit;
  }
  const fromReferrer = parseAllowedOrigins(
    params.get('referrer-origin') ?? undefined);
  if (fromReferrer.length > 0) {
    return fromReferrer;
  }
  const derived = parseAllowedOrigins(
    referrer !== undefined ? [referrer]: []);
  return derived;
}

export function createBridgeIdFromParams(params: URLSearchParams): string {
  const explicit = params.get('bridge-id')?.trim();
  if (explicit) {
    return explicit;
  }
  return `bridge_${Math.random().toString(36).slice(2, 10)}`;
}
