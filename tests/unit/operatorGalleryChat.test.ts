/**
 * — operator offline fallback and live credential gating.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitOperatorComposerMessage } from '../../src/agents/surface/operatorComposer';
import { DEFAULT_OPERATOR_THREADS } from '../../src/agents/surface/constants';
import { isOperatorTextMessage } from '../../src/agents/surface/types';

describe('operator gallery chat endpoint ', () => {
  beforeEach(() => {
    document.body.innerHTML = '<agentable-whiteboard tenant="meridian-labs"></agentable-whiteboard>';
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_LANDI_CHAT_PROXY_URL', '');
    vi.stubEnv('VITE_TOKEN_MINT_URL', '');
    vi.stubEnv('VITE_VOICE_TOKEN_ENDPOINT', '');
    vi.stubEnv('VITE_LANDI_MOCK', '1');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllEnvs();
  });

  it('submitOperatorComposerMessage returns offline assistant without gallery demo toast copy', async () => {
    const activeThreadId = DEFAULT_OPERATOR_THREADS[0]?.id ?? 'thread-main';
    const result = await submitOperatorComposerMessage({
      text: 'Summarize the canvas',
      threads: DEFAULT_OPERATOR_THREADS,
      activeThreadId,
      mode: 'ask',
    });

    expect(result.error).toBeUndefined();
    const thread = result.threads.find((entry) => entry.id === activeThreadId);
    const assistant = thread?.messages.find(
      (message) => isOperatorTextMessage(message) && message.role === 'assistant');
    expect(assistant).toBeDefined();
    if (assistant && isOperatorTextMessage(assistant)) {
      expect(assistant.text.toLowerCase()).not.toContain('gallery demo mode');
      expect(assistant.text.toLowerCase()).not.toContain('completed analysis');
    }
  });

  it('uses live path when api-endpoint is configured on whiteboard', async () => {
    vi.stubEnv('VITE_LANDI_MOCK', '');
    const whiteboard = document.querySelector('agentable-whiteboard');
    whiteboard?.setAttribute('api-endpoint', 'https://chat.example.test/proxy');

    const activeThreadId = DEFAULT_OPERATOR_THREADS[0]?.id ?? 'thread-main';

    const fetchMock = vi.fn().mockRejectedValue(new Error('network blocked in test'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitOperatorComposerMessage({
      text: 'Wireframe onboarding',
      threads: DEFAULT_OPERATOR_THREADS,
      activeThreadId,
      mode: 'build',
    });

    expect(fetchMock).toHaveBeenCalled;
    expect(result.error).toBeDefined();
    expect(result.error).not.toMatch(/gallery demo mode/i);
  });
});
