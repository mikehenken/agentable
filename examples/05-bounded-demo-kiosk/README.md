# 05 — Bounded demo kiosk

 gallery example (P4/P5 seed): trade-show kiosk with **bounded canvas** loaded entirely from a `config-url` JSON — no build step.

## Use case

Event kiosks ship a static HTML shell plus JSON config (`canvasMode: bounded`, `canvasBounds: 1200x800`). Operators swap JSON without redeploying JS.

## Published entry points

- `/embed/agentable-canvas.js`
- Config: `/examples/shared/archipelago-career-config.json`

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "05-bounded-demo-kiosk"
```
