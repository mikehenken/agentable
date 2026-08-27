/**
 * Ephemeral Gemini Live token mint for the examples gallery.
 *
 * Runs as a Cloudflare Pages Function on the same origin as the gallery, so
 * the examples call a relative `/v1/voice/token` with no CORS and no URL to
 * configure per environment.
 *
 * The provider key is held server-side as a Pages environment secret and is
 * never sent to the browser: the client receives a short-lived token that it
 * uses to open its Gemini Live session. Baking `VITE_GEMINI_API_KEY` into the
 * bundle would publish the key to anyone who opens devtools, which is the
 * leak this endpoint exists to prevent.
 *
 * Secret: GEMINI_API_KEY (Pages project → Settings → Environment variables)
 */

const MINT_URL = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
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

  let body = {};
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json();
    }
  } catch {
    /* Empty or malformed body is fine — fall back to defaults. */
  }

  const ttlSeconds = clamp(body.ttl_seconds ?? 1200, 60, 1800);
  const newSessionWindow = clamp(body.new_session_window_seconds ?? 60, 30, 600);
  const now = Date.now();

  let upstream;
  try {
    upstream = await fetch(MINT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Header rather than query string, so the key stays out of any
        // intermediary access logs that record URLs.
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        uses: 1,
        expire_time: new Date(now + ttlSeconds * 1000).toISOString(),
        new_session_expire_time: new Date(now + newSessionWindow * 1000).toISOString(),
      }),
    });
  } catch (err) {
    return json({ error: 'gemini_unreachable', detail: String(err) }, 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return json(
      {
        error: 'gemini_token_mint_failed',
        upstream_status: upstream.status,
        detail: detail.slice(0, 500),
      },
      upstream.status,
    );
  }

  // The endpoint surfaces the bearer as `token`, or conflates it with the
  // resource `name` (authTokens/abc123). Clients treat both as opaque.
  const data = await upstream.json().catch(() => ({}));
  const token = data.token ?? data.name;
  if (!token) {
    return json({ error: 'gemini_token_shape', detail: 'response missing token/name' }, 502);
  }

  return json({ token, expires_in: ttlSeconds });
}

/** Probe endpoint so a deploy can be checked without minting a token. */
export async function onRequestGet({ env }) {
  return json({ ok: true, key_bound: Boolean(env.GEMINI_API_KEY) });
}
