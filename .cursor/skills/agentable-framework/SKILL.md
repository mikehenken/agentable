---
name: agentable-framework
description: Integrate with agentable-canvas — panel IR, six generic agent tools, embed/whiteboard exports, HITL mutations, engine SPI, and safety invariants. Use when building hosts, packs, or driving a live canvas from a coding agent.
---

# agentable-canvas framework

Embeddable AI canvas: Lit embed shell, tldraw whiteboard substrate, panel registry (Tiers 1–4), DataAdapter, and six generic agent tools. Domain lives in host packs (`career-pack`, `support-inbox-pack`); the framework knows no panel ids by default.

## When to use this skill

| Goal | Start here |
|------|------------|
| Embed on a marketing page | [references/workflows/adopt-embed.md](references/workflows/adopt-embed.md) |
| React whiteboard host | [references/package-exports.md](references/package-exports.md) |
| Agent composes UI | [references/spec-ir.md](references/spec-ir.md) + [references/panel-tools.md](references/panel-tools.md) |
| Safety HITL review | [references/safety-invariants.md](references/safety-invariants.md) |

Machine-readable index: [`llms.txt`](../../../llms.txt) at package root.

## Architecture (one sentence)

One flat-node-map spec IR, one validator, one block renderer; hosts author via `defineSchemaPanel`, agents emit IR; mutations always pass HITL unless whitelisted.

## Package exports (published subpaths)

| Subpath | Use |
|---------|-----|
| `agentable-canvas/whiteboard` | tldraw canvas + `PanelShape` panels |
| `agentable-canvas/embed` | Lit `<agentable-canvas>` bundle |
| `agentable-canvas/embed/panel` | Single `<agentable-panel>` element |
| `agentable-canvas/react` | React wrapper over Lit shell |
| `agentable-canvas/a2ui` | A2UI v1.0 → native IR adapter (P10) |
| `agentable-canvas/devtools` | Spec inspector + validation trace |
| `agentable-canvas/career-pack` | Example domain pack (fixtures) |
| `agentable-canvas/support-inbox-pack` | Second example pack adopter tutorial |

Full export table: [references/package-exports.md](references/package-exports.md).

## Six generic panel tools 

Read-only: `list_panels`, `describe_panel`. 
UI: `open_panel`, `fill_panel`, `compose_panel`, `patch_panel`. 
Mutations: `run_panel_action` only — always HITL for agent callers unless `autoApprove`.

`compose_panel` is `costClass: expensive`; orchestrators should budget it.

Details, parameters, and repair vocabulary: [references/panel-tools.md](references/panel-tools.md).

## Spec IR essentials 

- Flat node map JSON; closed bindings: `$scope.*`, `$data.*`, `$state.*`
- Only conditional: `showIf: { $eq: [...] }`
- Agent specs carry `origin: 'agent'` + provenance badge 
- Seven-step validation pipeline identical for host and agent 

Schema patterns: [references/spec-ir.md](references/spec-ir.md).

## Safety invariants (never bypass)

1. **HITL at the mutation line** — agent `run_panel_action` shows payload diff 
2. **Dirty-field protection** — `fill_panel` never overwrites user-dirtied fields 
3. **No LLM HTML in trusted context** — code only in sandboxed code-preview tier 
4. **Untrusted data** — adapter payloads and site HTML are data, not instructions 
5. **Provider keys server-side only** — client carries aliases, never secrets 

Full list: [references/safety-invariants.md](references/safety-invariants.md).

## Conformance and a11y 

Per release the framework publishes:

- **Engine SPI conformance kit** results (`src/engine/testing/`, tldraw harness in CI)
- **axe accessibility** smoke results (Lit embed/widgets in `tests/component/a11y.test.ts`)

Run locally:

```bash
npm run test:release-conformance
node scripts/run-release-conformance.mjs --write-log
```

Report template: `docs/conformance/RELEASE_REPORT.template.md`.

## Related platform docs

| Doc | Topic |
|-----|-------|
| `docs/development/ARCHITECTURE.md` | Substrate, registry, exports |
| `docs/setup/ADOPTER_QUICKSTART.md` | Two-panel React quickstart |
| `docs/features/compose-eval-harness.md` | Compose regression gate |
| `docs/features/canvas-over-mcp.md` | MCP over live workspace |

## References

- [references/package-exports.md](references/package-exports.md)
- [references/panel-tools.md](references/panel-tools.md)
- [references/spec-ir.md](references/spec-ir.md)
- [references/safety-invariants.md](references/safety-invariants.md)
- [references/workflows/adopt-embed.md](references/workflows/adopt-embed.md)
