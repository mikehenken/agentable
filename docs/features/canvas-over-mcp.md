---
lrn: lrn::en:platform:agentable-canvas.feature.canvas-over-mcp::doc
related_docs:
  - docs/features/compose-eval-harness.md
  - docs/features/panel-devtools-spec-playground.md
changelog:
  - date: 2026-07-21
    summary: canvas-over-MCP scaffold — MCP server over live workspace panel tools + digest, OAuth scope pattern, Cloudflare worker on dd84ae29 account.
---

# Canvas-over-MCP 

Thin **streamable HTTP MCP** surface exposing a **live dev workspace's** panel tools and workspace digest. External MCP clients (Cursor, Claude Desktop, orchestrator workflows) can list panels, open/fill under scope enforcement, and read digest deltas — without the full landi MCP platform surface.

## Architecture

```
 External MCP client
        │ Bearer token (workspace:read | act | digest)
        ▼
 cloudflare/canvas-mcp worker ──► LiveWorkspaceBridge
        │ ├── panel tools (P3 runtime)
        │ ├── drill-down read tools
        │ └── get_workspace_digest
        ▼
 Dev browser host (canvas studio embed)
```

| Layer | Module | Role |
|-------|--------|------|
| Scopes | `src/mcp/scopes.ts` | `workspace:read`, `workspace:act`, `workspace:digest` |
| Auth pattern | `src/mcp/auth.ts` | NAS OAuth pattern — RFC 9728/8414 metadata, in-memory test tokens |
| Bridge | `src/mcp/workspaceBridge.ts` | Proxies MCP calls into panel runtime + role scopes |
| Registration | `src/mcp/registerTools.ts` | `@modelcontextprotocol/sdk` tool registration |
| Fixture | `src/mcp/fixture.ts` | InMemoryTransport client for Vitest |
| Worker | `cloudflare/canvas-mcp/` | Wrangler scaffold targeting account `dd84ae290b8a011725410e223c0ea928` |

## OAuth scopes

| Scope | Tools |
|-------|-------|
| `workspace:read` | `list_panels`, `describe_panel`, drill-down read tools |
| `workspace:act` | `open_panel`, `fill_panel`, `compose_panel`, `patch_panel`, `run_panel_action` |
| `workspace:digest` | `get_workspace_digest` |

Token scope is enforced **before** agent role scopes in `executeWorkspaceTool`.

## Worker secrets (names only)

Configured in `cloudflare/canvas-mcp/wrangler.jsonc`:

- `MCP_OAUTH_ISSUER`
- `MCP_RESOURCE_URI`
- `MCP_CREDENTIAL_PEPPER`
- `CANVAS_MCP_OAUTH_KV`

No secret values in repo. Dev/preview deploy satisfies P10 AC; production exposure rides normal deploy gating.

## Local testing

```bash
npm run test:canvas-mcp
```

Vitest drives an MCP client over `InMemoryTransport`, attaches a live `PanelToolRuntime` bridge, and asserts:

- `open_panel` + `fill_panel` succeed with `workspace:act`
- `open_panel` denied without act scope (`AUTH_SCOPE_DENIED`)
- `fill_panel` denied when agent `allowedTools` excludes it (`SCOPE_DENIED`)

## Boundary 

This feature exposes **framework workspace** tools only. Site/agency/platform MCP routes remain in `landing-editor/.cursor/plans/landi-full-mcp-surface.plan.md`.

## Tests

- `tests/unit/canvasMcp.test.ts` — scope mapping, OAuth metadata, MCP client open/fill fixture
