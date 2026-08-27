/**
 * Text-chat proxy for the examples gallery.
 *
 * Ephemeral tokens from `/v1/voice/token` authenticate ONLY the Gemini Live
 * (WebSocket) API — `generateContent` rejects them with "Ephemeral tokens are
 * only supported by the live API." So voice uses the token mint, and text chat
 * comes through this same-origin proxy, where the provider key stays
 * server-side (Pages environment secret, never shipped to the browser).
 *
 * Contract (matches `runGenerate` in src/chat/geminiChatClient.ts):
 *   POST { model, contents, config: { systemInstruction?, tools? } }
 *   → Google generateContent response, passed through verbatim; the client
 *     reads `candidates[0].content.parts` (text and functionCall parts).
 *
 * Secret: GEMINI_API_KEY (Pages project → Settings → Environment variables)
 */

const UPSTREAM_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gallery pages only ever ask for Gemini models; anything else is refused. */
const MODEL_PATTERN = /^gemini-[a-z0-9.-]+$/;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * Map the client's SDK-shaped `{ model, contents, config }` body onto the REST
 * `generateContent` payload. The SDK normalizes a string systemInstruction to
 * a Content object before it hits the wire; the proxy has to do the same.
 * Exported for unit tests.
 */
export function buildUpstreamBody(body) {
  const upstream = { contents: body.contents ?? [] };

  const config = body.config ?? {};
  if (typeof config.systemInstruction === 'string') {
    upstream.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  } else if (config.systemInstruction && typeof config.systemInstruction === 'object') {
    upstream.systemInstruction = config.systemInstruction;
  }
  if (Array.isArray(config.tools) && config.tools.length > 0) {
    upstream.tools = config.tools;
  }

  return upstream;
}

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json(
      {
        error: 'gemini_api_key_missing',
        hint: 'Set GEMINI_API_KEY as a Pages environment secret for this project.',
      },
      503,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!MODEL_PATTERN.test(model)) {
    return json({ error: 'model_not_allowed', model }, 400);
  }
  if (!Array.isArray(body.contents) || body.contents.length === 0) {
    return json({ error: 'contents_required' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Header rather than query string, so the key stays out of any
        // intermediary access logs that record URLs.
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify(buildUpstreamBody(body)),
    });
  } catch (err) {
    return json({ error: 'gemini_unreachable', detail: String(err) }, 502);
  }

  // Pass Google's response body through verbatim (success or error) so the
  // client sees the same shape the browser SDK would produce; scrub upstream
  // headers rather than forwarding them.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Probe endpoint so a deploy can be checked without spending tokens. */
export async function onRequestGet({ env }) {
  return json({ ok: true, key_bound: Boolean(env.GEMINI_API_KEY) });
}
