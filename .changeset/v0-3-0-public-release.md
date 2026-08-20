---
"agentable-canvas": minor
---

Public-release hardening.

BREAKING: career-pack tenant ids are now generic fictional brands. Hosts
passing `tenant="sandals"` or `tenant="moss"` must switch to `"archipelago"`
and `"helios"` respectively; the tenant modules, fixtures, prompts and exported
constants renamed with them.

- Recovered the panel and whiteboard embed surfaces. `createCanvasHost` had lost
  four of its ten returned members (`agents`, `telemetry`, `approvals`, `undo`),
  which left `<agentable-panel>` and `<agentable-whiteboard>` mounting an empty
  shadow root with no console error.
- The examples gallery now publishes to Cloudflare Pages on pushes to `main`
  and after a successful release, assembled by `npm run build:examples-site`.
- Removed internal orchestration material from the published tree: review and
  status docs, 67 internal QA driver scripts, the unreferenced orchestration
  review UI, and scripts that embedded absolute local filesystem paths.
- Test fixtures no longer read from sibling repositories, so the suite runs for
  external contributors.
