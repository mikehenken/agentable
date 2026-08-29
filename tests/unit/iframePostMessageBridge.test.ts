/**
 * postMessage bridge unit coverage (parent + child).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIframeChildBridge } from '../../src/embed/iframe/iframeChildBridge';
import { createIframeParentBridge } from '../../src/embed/iframe/iframeParentBridge';
import { createBridgeEnvelope } from '../../src/embed/iframe/embedBridgeProtocol';

const PARENT_ORIGIN = 'https://cms.example.com';
const EMBED_ORIGIN = 'https://embed.agentable.dev';

describe('iframe postMessage bridge', () => {
  let iframe: HTMLIFrameElement;
  let mockParent: Window;
  let mockChild: Window;

  beforeEach(() => {
    iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    mockParent = {
      postMessage(data: unknown) {
        window.dispatchEvent(
          new MessageEvent('message', {
            data,
            origin: EMBED_ORIGIN,
            source: mockChild,
          }));
      },
    } as unknown as Window;

    mockChild = {
      postMessage(data: unknown) {
        window.dispatchEvent(
          new MessageEvent('message', {
            data,
            origin: PARENT_ORIGIN,
            source: mockParent,
          }));
      },
    } as unknown as Window;

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: mockChild,
    });
  });

  afterEach(() => {
    iframe.remove();
    vi.restoreAllMocks();
  });

  it('completes handshake and forwards panel events to parent', () => {
    const bridgeId = 'bridge_integration';

    const onReady = vi.fn();
    const onEvent = vi.fn();

    const childBridge = createIframeChildBridge({
      bridgeId,
      surface: 'panel',
      allowedParentOrigins: [PARENT_ORIGIN],
      targetWindow: mockParent,
    });

    const childCleanup = childBridge.start();

    const parentBridge = createIframeParentBridge({
      bridgeId,
      iframe,
      embedOrigin: EMBED_ORIGIN,
      parentOrigin: PARENT_ORIGIN,
      contentWindow: mockChild,
      onReady,
      onEvent,
    });

    const parentCleanup = parentBridge.connect();

    mockChild.postMessage(
      createBridgeEnvelope('agentable:bridge:handshake', {
        bridgeId,
        parentOrigin: PARENT_ORIGIN,
      }),
      EMBED_ORIGIN);
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ bridgeId, surface: 'panel' }));

    childBridge.publishEvent('agentable:panel-ready', {
      panelId: 'open-positions',
      definitionKind: 'spec',
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        bridgeId,
        eventType: 'agentable:panel-ready',
      }));

    parentCleanup();
    childCleanup();
  });

  it('ignores messages from disallowed origins', () => {
    const bridgeId = 'bridge_denied';
    const onReady = vi.fn();

    const childCleanup = createIframeChildBridge({
      bridgeId,
      surface: 'panel',
      allowedParentOrigins: ['https://cms.example.com'],
      targetWindow: mockParent,
    }).start();

    const parentCleanup = createIframeParentBridge({
      bridgeId,
      iframe,
      embedOrigin: 'https://embed.agentable.dev',
      parentOrigin: 'https://cms.example.com',
      contentWindow: mockChild,
      onReady,
    }).connect();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: createBridgeEnvelope('agentable:bridge:handshake', {
          bridgeId,
          parentOrigin: 'https://evil.example.com',
        }),
        origin: 'https://evil.example.com',
        source: mockParent,
      }));

    expect(onReady).not.toHaveBeenCalled();

    parentCleanup();
    childCleanup();
  });

  it('rejects parent script injection commands outside the protocol', () => {
    const bridgeId = 'bridge_protocol';
    const onEvent = vi.fn();

    const childCleanup = createIframeChildBridge({
      bridgeId,
      surface: 'panel',
      allowedParentOrigins: [PARENT_ORIGIN],
      targetWindow: mockParent,
    }).start();

    const parentCleanup = createIframeParentBridge({
      bridgeId,
      iframe,
      embedOrigin: EMBED_ORIGIN,
      parentOrigin: PARENT_ORIGIN,
      contentWindow: mockChild,
      onEvent,
    }).connect();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          v: '1',
          type: 'agentable:bridge:eval',
          payload: { bridgeId, script: 'alert(1)' },
        },
        origin: PARENT_ORIGIN,
        source: mockParent,
      }));

    expect(onEvent).not.toHaveBeenCalled();

    parentCleanup();
    childCleanup();
  });
});
