# 10 — Locale RTL

 gallery example: **Arabic locale** with RTL document direction and framework chrome using logical CSS.

## Use case

Global career sites render right-to-left for Arabic locales. The panel receives `locale="ar"` and config `locale: ar`; SpecRenderer sets `dir="rtl"` on the workspace root.

## Published entry points

- `/embed/agentable-panel.js`
- Config: `/examples/shared/archipelago-locale-ar-config.json`

## Interop matrix notes

React/Vue/Svelte wrappers accept `locale` prop/attribute and forward to the Lit element unchanged.

## Run e2e

```bash
npm run test:e2e -- tests/e2e/gallery.spec.ts -g "10-locale-rtl"
```
