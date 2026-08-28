# Remediation Wave 0: baseline capture (2026-08-28)

Baseline for the remediation plan (STUDY-018 continuation, Part 2). All numbers measured on `main` @ `dbbec37` before any wave landed. No behavior changes in this wave.

## Working tree triage

`tests/unit/__snapshots__/telemetryFrozenCodes.test.ts.snap` showed modified but the diff was empty apart from LF/CRLF normalization; restored with `git checkout`. Untracked `.claude/` holds local session config (`launch.json`, `settings.local.json`) and gets gitignored in the strays wave.

## Test suites

| Measurement | Value |
|---|---|
| `npm run test:release` | 168 files, 1220/1220 tests passing, 140.8s |
| `npm run test` (full suite) | **74 failed / 169 passed files (243)**; 191 failed / 1558 passed / 2 skipped tests (1751); 11 unhandled errors; 397.2s |
| `tests/release-exclusions.txt` entries | 75 files at capture (74 after `widgetBundleBudgets` removal in Wave 1) |

Notable unhandled rejections in the full run: `createFixedClock: invalid ISO timestamp "undefined"` (composeEvalHarness), `resolveCatalogString(meta.title)` on undefined meta (openAgentCanvasE2e), `sketch.shapes.map` on undefined (wireframeToLayoutE2e), and `host.agents.registry.list.map is not a function` (multiAgentE2eScenario), which is the same defect breaking live example 09.

## Typecheck

`npx tsc -p tsconfig.app.json --noEmit`: **361 errors**. Top codes:

| Code | Count | Dominant cause |
|---|---|---|
| TS2339 (property does not exist) | 127 | unregistered `panel` shape: `TLShape` union lacks the custom shape, property access on `never`/base types |
| TS2322 (type not assignable) | 54 | same cluster |
| TS2367 (comparison appears unintentional) | 46 | `shape.type === 'panel'` narrowing against a union that lacks `'panel'` |
| TS2345 (argument not assignable) | 25 | |
| TS2353 (unknown properties in object literals) | 19 | |
| TS6133 (declared but never read) | 17 | |
| TS2307 (cannot find module) | 14 | |
| TS7006 (implicit any) | 12 | |

## Bundle sizes (gzipped, clean `build:embed:site`)

At capture, `scripts/check-bundle-size.mjs` declared budgets for only 5 files (agentable-canvas ESM/UMD at 950/750 KB against a ~3.9/3.4 MB reality, voice-call-button ESM/UMD, styles.css), so the gate failed on every honest run. Wave 1 recalibrated to measured +10% RATCHET ceilings and added every meaningful artifact.

| Artifact | Measured KB gz | Artifact | Measured KB gz |
|---|---|---|---|
| career-whiteboard.js | 4256.6 | agentable-panel.js | 833.6 |
| agentable-whiteboard.js | 4207.5 | agentable-panel.umd.js | 653.4 |
| agentable-canvas.js | 3865.6 | iframe-host-PanelEmbedShell.js | 516.6 |
| agentable-operator-surface-placement.js | 3818.0 | agentable-app-shell.js | 202.5 |
| career-whiteboard.umd.js | 3792.7 | agentable-app-shell.umd.js | 170.9 |
| agentable-whiteboard.umd.js | 3749.3 | agentable-gallery-13-chrome.js | 102.9 |
| agentable-canvas.umd.js | 3437.9 | agentable-gallery-13-chrome.umd.js | 82.4 |
| agentable-operator-surface-placement.umd.js | 3402.6 | gallery-13-chrome.css | 16.9 |
| agentable-whiteboard.css | 940.6 | voice-call-button.js | 12.0 |
| career-whiteboard.css | 940.6 | agent-status-pill.js | 10.0 |
| agentable-operator-surface-placement.css | 940.3 | agentable-starter-chip.js | 9.5 |
| agentable-canvas.css | 922.9 | ask-about-this-button.js | 9.2 |

Plus ~40 small iframe-host panel chunks (0.2-65 KB) and dist/styles.css at 17.0 KB. The four tldraw-bearing embeds each carry a full tldraw copy inline (fonts and assets inlined into their ~940 KB CSS); the lazy-tldraw wave is the structural fix.

## dist/site listing

Top level: `index.html`, `embed/`, `examples/`, `functions/`, `gallery/`. Shipped examples (15): 01-13, p8-agent-draw-demo, support-inbox-quickstart, plus `examples/shared/` data. Not shipped: spec-playground and shared (SKIP list), telemetry-reference-sink (no index.html). Known defect shipped today: `p8-agent-draw-demo/index.dev.html` rides along verbatim with 404-broken `/tests/e2e/harness/` references (Wave 2 excludes `*.dev.html`).

## Live gallery walk (all 12 HITM-approved surfaces)

Every approved example on https://agentable-examples.pages.dev loads and renders its key content. Walked 2026-08-28 with an 7-10s settle per page. Console errors observed (attribution refined by the Wave 2 Playwright smoke, since the walk's console log accumulated across navigations):

| Class | Where | Detail |
|---|---|---|
| voiceKernel PRODUCTION misconfiguration | every voice-bearing page (01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 13; twice on 13, consistent with its double embed load) | neither `VITE_GEMINI_API_KEY` nor `tokenEndpoint` reaches the deployed embeds, so the voice CTA would fail live. The mint at `/v1/voice/token` exists and `deploy-examples.yml` documents that examples are meant to call it; the wiring gap is the defect. Fix scheduled in Wave 2 under gate parity. |
| embed config fetch failure | whiteboard-bearing pages (08 onward) | `[agentable-whiteboard] Failed to load embed config from "./config.local.json"`: the file is not shipped, Pages returns the SPA fallback HTML, JSON parse fails (logged twice per page). Page still renders on defaults. |
| example 09 functional break | 09-multi-agent-page | `Uncaught (in promise) TypeError: e.agents.registry.list.map is not a function` from `/gallery/09-multi-agent-harness.js`; the demo sticks at "running…". Matches the failing P6 `multiAgentDefaults` cluster. Fix scheduled in Wave 5 (P6) with live verification. |

Page-by-page load check: 01 career homepage OK; 02 job board OK; 03 dashboard OK; 05 kiosk OK; 06 react host OK; 07 iframe CMS OK; 08 agent presents OK; 09 multi-agent LOADS but demo stalls (error above); 10 locale RTL OK (RTL text renders); 11 app shell (DOM engine) OK; 12 open agent canvas OK; 13 canvas-wide operator OK.

PNG baseline: captured programmatically at the start of Wave 2 (Playwright), before the first behavior-changing wave (Wave 3) merges.

