/**
 * Parent-side postMessage bridge — manages a sandboxed agentable iframe embed.
 */
import {
  createBridgeEnvelope,
  IFRAME_EMBED_SANDBOX,
  isChildBridgeEvent,
  parseBridgeEnvelope,
  type EmbedBridgeEnvelope,
  type EmbedBridgeSurface,
} from './embedBridgeProtocol';
import { isOriginAllowed } from './originValidation';

export interface IframeParentBridgeHandlers {
  onReady?: (detail: { bridgeId: string; surface: EmbedBridgeSurface; sessionId: string }) => void;
  onEvent?: (detail: { bridgeId: string; eventType: string; detail: Record<string, unknown> }) => void;
  onSession?: (detail: { bridgeId: string; snapshot: EmbedBridgeEnvelope<'agentable:bridge:session'>['payload']['snapshot'] }) => void;
  onError?: (detail: { bridgeId: string; code: string; message: string }) => void;
  onPong?: (detail: { bridgeId: string }) => void;
}

export interface IframeParentBridgeOptions extends IframeParentBridgeHandlers {
  bridgeId: string;
  iframe: HTMLIFrameElement;
  embedOrigin: string;
  parentOrigin: string;
  contentWindow?: Window | null;
}

export interface IframeParentBridge {
  connect(): () => void;
  ping(): void;
  resize(width: number, height: number): void;
}

function resolveEmbedOrigin(embedOrigin: string): string {
  try {
    return new URL(embedOrigin).origin;
  } catch {
    throw new Error(`Invalid embed origin: ${embedOrigin}`);
  }
}

export function applySandboxedIframeAttributes(
  iframe: HTMLIFrameElement,
  src: string): void {
  iframe.src = src;
  iframe.setAttribute('sandbox', IFRAME_EMBED_SANDBOX);
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('title', 'Agentable embed');
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
}

export function createIframeParentBridge(
  options: IframeParentBridgeOptions): IframeParentBridge {
  const embedOrigin = resolveEmbedOrigin(options.embedOrigin);
  const contentWindow = options.contentWindow ?? options.iframe.contentWindow;
  let connected = false;
  let ready = false;

  const postToChild = (envelope: EmbedBridgeEnvelope): void => {
    if (contentWindow === null) {
      return;
    }
    contentWindow.postMessage(envelope, embedOrigin);
  };

  const sendHandshake = (): void => {
    postToChild(
      createBridgeEnvelope('agentable:bridge:handshake', {
        bridgeId: options.bridgeId,
        parentOrigin: options.parentOrigin,
      }));
  };

  const handleMessage = (event: MessageEvent): void => {
    if (event.source !== contentWindow) {
      return;
    }
    if (!isOriginAllowed(event.origin, [embedOrigin])) {
      return;
    }
    const envelope = parseBridgeEnvelope(event.data);
    if (envelope === null || !isChildBridgeEvent(envelope)) {
      return;
    }
    if (envelope.payload.bridgeId !== options.bridgeId) {
      return;
    }

    switch (envelope.type) {
      case 'agentable:bridge:handshake-ack':
        ready = true;
        options.onReady?.({
          bridgeId: envelope.payload.bridgeId,
          surface: envelope.payload.surface,
          sessionId: envelope.payload.sessionId,
        });
        break;
      case 'agentable:bridge:pong':
        options.onPong?.({ bridgeId: envelope.payload.bridgeId });
        break;
      case 'agentable:bridge:event':
        options.onEvent?.({
          bridgeId: envelope.payload.bridgeId,
          eventType: envelope.payload.eventType,
          detail: envelope.payload.detail,
        });
        break;
      case 'agentable:bridge:session':
        options.onSession?.({
          bridgeId: envelope.payload.bridgeId,
          snapshot: envelope.payload.snapshot,
        });
        break;
      case 'agentable:bridge:error':
        options.onError?.({
          bridgeId: envelope.payload.bridgeId,
          code: envelope.payload.code,
          message: envelope.payload.message,
        });
        break;
      default:
        break;
    }
  };

  return {
    connect() {
      if (connected) {
        return () => undefined;
      }
      connected = true;
      window.addEventListener('message', handleMessage);

      const onLoad = (): void => {
        sendHandshake();
      };
      options.iframe.addEventListener('load', onLoad);
      if (options.iframe.contentDocument?.readyState === 'complete') {
        sendHandshake();
      }

      return () => {
        window.removeEventListener('message', handleMessage);
        options.iframe.removeEventListener('load', onLoad);
        connected = false;
        ready = false;
      };
    },
    ping() {
      if (!ready) {
        sendHandshake();
      }
      postToChild(
        createBridgeEnvelope('agentable:bridge:ping', {
          bridgeId: options.bridgeId,
        }));
    },
    resize(width: number, height: number) {
      postToChild(
        createBridgeEnvelope('agentable:bridge:resize', {
          bridgeId: options.bridgeId,
          width,
          height,
        }));
    },
  };
}
