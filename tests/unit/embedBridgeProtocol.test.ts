/**
 * embed bridge protocol unit coverage.
 */
import { describe, it, expect } from 'vitest';
import {
  createBridgeEnvelope,
  parseBridgeEnvelope,
  isParentBridgeCommand,
  isChildBridgeEvent,
  IFRAME_EMBED_SANDBOX,
} from '../../src/embed/iframe/embedBridgeProtocol';

describe('embedBridgeProtocol', () => {
  it('round-trips a parent handshake envelope', () => {
    const envelope = createBridgeEnvelope('agentable:bridge:handshake', {
      bridgeId: 'bridge_test',
      parentOrigin: 'https://cms.example.com',
    });
    const parsed = parseBridgeEnvelope(envelope);
    expect(parsed).toEqual(envelope);
    expect(isParentBridgeCommand(parsed!)).toBe(true);
    expect(isChildBridgeEvent(parsed!)).toBe(false);
  });

  it('round-trips a child event envelope', () => {
    const envelope = createBridgeEnvelope('agentable:bridge:event', {
      bridgeId: 'bridge_test',
      eventType: 'agentable:panel-ready',
      detail: { panelId: 'open-positions', definitionKind: 'react' },
    });
    const parsed = parseBridgeEnvelope(envelope);
    expect(parsed?.type).toBe('agentable:bridge:event');
    expect(isChildBridgeEvent(parsed!)).toBe(true);
  });

  it('rejects unknown message types and malformed payloads', () => {
    expect(parseBridgeEnvelope(null)).toBeNull();
    expect(parseBridgeEnvelope({ v: '1', type: 'evil:run-script', payload: {} })).toBeNull();
    expect(parseBridgeEnvelope({ v: '2', type: 'agentable:bridge:ping', payload: {} })).toBeNull();
    expect(parseBridgeEnvelope({ v: '1', type: 'agentable:bridge:ping', payload: 'nope' })).toBeNull();
  });

  it('declares a scripts-only sandbox token set', () => {
    expect(IFRAME_EMBED_SANDBOX).toContain('allow-scripts');
    expect(IFRAME_EMBED_SANDBOX).not.toContain('allow-same-origin');
  });
});
