/**
 * — /v1/chat Pages Function: request mapping and input validation.
 *
 * Ephemeral tokens from /v1/voice/token only authenticate the Gemini Live
 * WebSocket API; `generateContent` rejects them ("Ephemeral tokens are only
 * supported by the live API"), so text chat must route through this proxy.
 */
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error — plain-JS Cloudflare Pages Function, no type declarations.
import { buildUpstreamBody, onRequestPost } from '../../functions/v1/chat.js';

describe('chat proxy function', () => {
  it('wraps a string systemInstruction into a Content object', () => {
    const upstream = buildUpstreamBody({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      config: { systemInstruction: 'You are Meridian.' },
    });

    expect(upstream.systemInstruction).toEqual({ parts: [{ text: 'You are Meridian.' }] });
    expect(upstream.contents).toHaveLength(1);
  });

  it('passes tools and object systemInstruction through untouched', () => {
    const tools = [{ functionDeclarations: [{ name: 'listRoles', parametersJsonSchema: {} }] }];
    const systemInstruction = { parts: [{ text: 'already shaped' }] };
    const upstream = buildUpstreamBody({
      contents: [],
      config: { systemInstruction, tools },
    });

    expect(upstream.tools).toBe(tools);
    expect(upstream.systemInstruction).toBe(systemInstruction);
  });

  it('omits tools and systemInstruction when the config has none', () => {
    const upstream = buildUpstreamBody({ contents: [], config: {} });
    expect('tools' in upstream).toBe(false);
    expect('systemInstruction' in upstream).toBe(false);
  });

  it('rejects non-gemini models before touching the upstream', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const request = new Request('https://example.test/v1/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-4o',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      }),
    });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: 'k' } });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns 503 when the key is not bound instead of calling upstream', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const request = new Request('https://example.test/v1/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'gemini-3.1-pro-preview', contents: [{}] }),
    });
    const response = await onRequestPost({ request, env: {} });

    expect(response.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('forwards a valid request and passes the upstream body through verbatim', async () => {
    const upstreamPayload = {
      candidates: [{ content: { role: 'model', parts: [{ text: 'aloha' }] } }],
    };
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify(upstreamPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const request = new Request('https://example.test/v1/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gemini-3.1-pro-preview',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        config: { systemInstruction: 'sys' },
      }),
    });
    const response = await onRequestPost({ request, env: { GEMINI_API_KEY: 'k' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamPayload);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent',
    );
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const sent = JSON.parse(String(init.body));
    expect(sent.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    vi.unstubAllGlobals();
  });
});
