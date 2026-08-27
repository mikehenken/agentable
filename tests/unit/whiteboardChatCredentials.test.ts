/**
 * — shared whiteboard chat credential resolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWhiteboardChatClientOptions,
  resolveWhiteboardLiveChatEnabled,
} from '../../src/chat/whiteboardChatCredentials';

describe('whiteboardChatCredentials ', () => {
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

  it('treats api-endpoint on whiteboard as live chat proxy', () => {
    vi.stubEnv('VITE_LANDI_MOCK', '');
    const whiteboard = document.querySelector('agentable-whiteboard');
    whiteboard?.setAttribute('api-endpoint', 'https://chat.example.test/proxy');

    expect(resolveWhiteboardLiveChatEnabled()).toBe(true);
    const options = createWhiteboardChatClientOptions({ systemInstruction: 'test' });
    expect(options?.proxyUrl).toBe('https://chat.example.test/proxy');
  });

  it('returns null client options when no credentials are configured', () => {
    expect(resolveWhiteboardLiveChatEnabled()).toBe(false);
    expect(createWhiteboardChatClientOptions()).toBeNull();
  });

  /*
   * Regression: the plain-api-key branch used to read `creds().apiKey` — calling
   * an object. Ternary lazy evaluation hid it, because every host exercised in
   * CI supplied a token endpoint, so only the truthy branch ever ran.
   */
  it('passes a configured api key straight through as the api key source', () => {
    vi.stubEnv('VITE_LANDI_MOCK', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key-123');

    const options = createWhiteboardChatClientOptions({ systemInstruction: 'test' });
    expect(options?.apiKeySource).toBe('test-key-123');
  });

  it('mints through the token endpoint when one is configured', async () => {
    vi.stubEnv('VITE_LANDI_MOCK', '');
    vi.stubEnv('VITE_VOICE_TOKEN_ENDPOINT', '/v1/voice/token');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'auth_tokens/deadbeef' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const options = createWhiteboardChatClientOptions({ systemInstruction: 'test' });
    expect(typeof options?.apiKeySource).toBe('function');

    const minted = await (options?.apiKeySource as () => Promise<string>)();
    expect(minted).toBe('auth_tokens/deadbeef');
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/voice/token',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.unstubAllGlobals();
  });
});
