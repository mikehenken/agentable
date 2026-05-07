# F.8 — Voice No-Audio Root Cause + Sibling-`.env.local` Fallback (2026-04-25)

User-reported: voice triggers on `localhost:5180/career-canvas` but no audio plays. Two architect-reviewer iterations; both CRITICALs resolved; production-leak assertion verified at runtime.

## Root cause

Page-load diagnostic logs (added this loop in `useGeminiLive.ts` and `geminiLiveClient.ts`) revealed:
```
[voiceKernel] useGeminiLive mounted {
  transportSelected: 'MOCK',
  apiKeyPresent: false,
  envMock: false,
  systemPromptChars: 4182,
  systemPromptHead: 'You are Sandy, the Sandals Resorts Career Concierge...',
  voiceGreetingChars: 195,
}
```

Persona pipeline confirmed intact end-to-end (4182-char Sandals system prompt reaching the canvas). But `apiKeyPresent: false` → mock transport selected → `MockGeminiLiveClient` ships transcripts but no audio frames by design. So Sandy "connects" but plays nothing.

Vite's `loadEnv` reads from the workspace it's running in, not its sibling. `agentable-canvas/.env.local` had `VITE_GEMINI_API_KEY` (used by canvas dev tooling) but `sandals/website/.env.local` didn't exist, so the website's Vite never saw it. Unique-per-developer `.env.local` files in two workspaces is the wrong contract.

## Fix

`sandals/website/vite.config.ts` — DEV-ONLY sibling-env fallback:

- Strict gate `mode === "development" && command === "serve"` — fully skipped on `vite build` / `wrangler deploy`. No prod credential leak.
- Mutates `process.env` BEFORE Vite's natural `loadEnv` injection runs (rather than via `define`, which would be silently overwritten by Vite's own `import.meta.env.X` synthesis — architect-reviewer CRITICAL #2).
- Workspace-local website `.env.local` always wins (`if (process.env[k]) continue`).
- Uses `dotenv.parse` (transitive Vite dep) instead of regex.
- `console.info` on successful injection + `console.warn` when the file is missing surface the indirection so future devs aren't stuck on the same symptom.

## Architect-reviewer findings

### CRITICAL — RESOLVED

| # | Finding | Resolution |
|---|---|---|
| C1 | Production credential leak — original v1 ran the fallback unconditionally; on `vite build` (Cloudflare Workers prod target), `define` would have textually replaced `import.meta.env.VITE_GEMINI_API_KEY` with the literal string from `agentable-canvas/.env.local`. Key bakes into shipped JS. | Added compound gate `isDevServer = mode === "development" && command === "serve"`. Both halves load-bearing — `mode` alone fails on `--mode development` builds; `command` alone fails on `vite serve --mode production`. |
| C2 | `define` is the wrong knob — Vite's internal `import.meta.env` synthesis runs after user `define` and overwrites it for `import.meta.env.X` keys. Using `define` would have left the website still seeing `undefined`, so the fix wouldn't have actually fixed the original symptom. | Replaced `define` with `process.env[k] = v` BEFORE `loadEnv`. Vite's natural pipeline picks the values up automatically, correctly shapes `import.meta.env`, and "website wins" precedence holds via the `!process.env[k]` guard. |

### WARNING — RESOLVED

| # | Finding | Resolution |
|---|---|---|
| W1 | Hand-rolled regex parser misses `export VITE_X=...`, multi-line values, comments after value, escaped quotes | Switched to `import { parse as parseDotenv } from "dotenv"` (already a transitive Vite dep — confirmed at `node_modules/dotenv/`). |
| W2 | Path assumption brittle if workspace reorganized; silent fallback to mock if file missing | Added `console.warn` when file is absent so future devs see the warning instead of debugging silent mock-mode for hours. |

### NIT (acceptable)

| # | Finding | Status |
|---|---|---|
| N1 | `vite preview --mode development` will emit the dev-fallback log lines harmlessly | Acceptable — preview re-evaluates the config but doesn't re-build, so no leak; logs are just noise. |
| N2 | Restart semantics — editing canvas `.env.local` requires `vite` server restart | Documented in inline comment. |

## Verification

- **Two-iter architect review APPROVED.** Second-pass verdict: "Both CRITICALs are properly resolved. No remaining blocking issues."
- **Production build runtime assertion (this iter):**
  ```bash
  cd sandals/website && npx vite build       # build succeeded, 31s
  Grep "AIza[A-Za-z0-9_-]{8,}" sandals/website/dist/  # 0 matches
  ```
  Zero Google API key strings in the production bundle. The dev-only gate is empirically working — not just paper-working.
- **Tests:** vitest 56/56 still pass post-config-change.

## Status

**DONE.** User must restart the website dev server (`Ctrl+C` then `npm run dev`) so Vite re-reads env files at startup. After restart:
- Vite startup output should show: `[vite] loaded N VITE_ var(s) from ../../agentable-canvas/.env.local (dev fallback). Edit canvas .env.local + restart dev server to refresh.`
- Browser console at page load should now show: `transportSelected: 'real Gemini Live', apiKeyPresent: true`
- Click voice → audio plays, Sandy responds with full Sandals persona via systemInstruction.

If the runtime log still shows `transportSelected: 'MOCK'` post-restart, the next-loop diagnostic is whether the website's own `.env.local` exists and is overriding (workspace local always wins per gate logic).
