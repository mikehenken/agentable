# 07 — iframe CMS

 gallery example: **iframe oEmbed fallback** for CMS hosts that strip inline scripts.

## Use case

Enterprise CMS pages embed a sandboxed iframe pointed at `/embed/iframe-host.html` with query params (`surface`, `panel`, `config-url`, `parent-origin`). postMessage bridge wires parent ↔ child.

## Published entry points

- `/embed/iframe-host.html`
- `agentable-canvas/embed/iframe-oembed` (discovery helpers)

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "07-iframe-cms"
```
