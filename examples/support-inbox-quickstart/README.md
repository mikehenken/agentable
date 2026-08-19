# Support inbox quickstart 

Adopter tutorial for **`agentable-canvas/support-inbox-pack`**: a filterable support inbox on mock fixtures, loaded from a `config-url` JSON document with **zero build step**.

## Use case

SaaS support teams embed a ticket queue mid-page without standing up a helpdesk backend. The pack ships Tier 2 schema panels (`inbox`, `ticket-detail`, `macros`), generated tools, and a static adapter for fixture-only demos.

## Freeze limitation 

While `deploy_allowed: false`, the pack lives in the monorepo and is imported via the git pin workspace alias — it is **not** yet on npm. After freeze lifts, newcomers install only from the published `agentable-canvas` package:

```bash
npm install github:mikehenken/agentable#v0.2.0
```

Then import `agentable-canvas/support-inbox-pack` (no `src/` paths).

## Files

| Path | Role |
|------|------|
| `/embed/agentable-panel.js` | Single-panel embed bundle |
| `/examples/shared/northwind-support-config.json` | Tenant + persona + adapter config-url |
| `/examples/shared/northwind-support-data.json` | Fixture tickets, messages, macros |
| `packages/support-inbox-pack/README.md` | Full pack API + React host wiring |

## Run locally

From `agentable-canvas`:

```bash
npm run build:embed:panel
npm run test:e2e -- tests/e2e/support-inbox-quickstart.spec.ts
```

Open `http://127.0.0.1:<e2e-port>/examples/support-inbox-quickstart/index.html` while the e2e static server is running.

## Verify

```bash
npm run test:support-inbox-pack
npm run lint
```

## Related

- First example pack: `@agentable/career-pack` + gallery `01`–`10`
- Generic adopter guide: `docs/setup/ADOPTER_QUICKSTART.md`
- Feature doc: `docs/features/support-inbox-pack.md`
