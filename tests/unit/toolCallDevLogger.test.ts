import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logToolCallDev, isToolCallLoggingEnabled } from '../../src/agents/toolCallDevLogger';

describe('toolCallDevLogger', () => {
  beforeEach(() => {
    vi.stubEnv('LOG_TOOL_CALLS', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is enabled in dev or when VITE_LOG_TOOL_CALLS=1', () => {
    expect(isToolCallLoggingEnabled).toBe(true);
  });

  it('emits landi:tool-call-log with panelOpened inference', () => {
    const handler = vi.fn();
    window.addEventListener('landi:tool-call-log', handler as EventListener);
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logToolCallDev({
      toolName: 'open_positions',
      args: { department: 'Operations' },
      result: { ok: true, result: 'Opened open-positions.' },
      agentId: 'agentable-chat-agent',
      source: 'chat',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.toolName).toBe('open_positions');
    expect(event.detail.panelOpened).toBe('open-positions');
    expect(event.detail.ok).toBe(true);

    window.removeEventListener('landi:tool-call-log', handler as EventListener);
    spy.mockRestore();
  });
});
