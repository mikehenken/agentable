---
lrn: lrn::en:platform:agentable-canvas.feature.published-conformance-a11y-skill::doc
related_docs:
  - docs/features/compose-eval-harness.md
  - docs/features/canvas-over-mcp.md
  - docs/setup/RELEASE.md
  -.cursor/skills/agentable-framework/SKILL.md
changelog:
  - date: 2026-07-21
    summary: Published conformance + axe a11y gate scaffold, framework SKILL.md, and llms.txt.
---

# Published conformance, a11y, skill, and llms.txt 

Category-defining deliverable: per-release **engine SPI conformance** and **axe accessibility** results, plus a **framework skill** and **`llms.txt`** so coding agents integrate against real APIs.

## Components

| Artifact | Path | Role |
|----------|------|------|
| Framework skill | `.cursor/skills/agentable-framework/SKILL.md` | Agent-facing integration guide |
| Skill references | `.cursor/skills/agentable-framework/references/` | Package exports, tools, spec IR, safety, workflows |
| llms.txt | `llms.txt` (package root) | Machine-readable doc index |
| Conformance types | `tests/conformance/types.ts` | Report schema |
| Report builder | `tests/conformance/releaseReport.ts` | Markdown + fingerprint |
| Regression gate | `tests/conformance/releaseGate.ts` | Engine + a11y + artifact thresholds |
| Vitest suite | `tests/unit/releaseConformanceGate.test.ts` | Gate + artifact existence proofs |
| CLI | `scripts/run-release-conformance.mjs` | CI/local runner + optional report write |
| Report template | `docs/conformance/RELEASE_REPORT.template.md` | Per-release scaffold |

## Conformance suites

### Engine SPI 

| Item | Detail |
|------|--------|
| Kit | `src/engine/testing/conformanceSuite.ts` |
| Harness | `tests/unit/engineConformance/tldrawHarness.ts` |
| CI entry | `tests/unit/engineConformanceTldraw.test.ts` |

### Accessibility — axe 

| Item | Detail |
|------|--------|
| Tests | `tests/component/a11y.test.ts` |
| Runner | `web-test-runner.a11y.config.js` — isolated axe gate (7 smokes) |
| Assertion | `@open-wc/testing` accessible (axe-core) |
| Target | 0 critical/serious WCAG 2.1 AA violations per major embed state |

## CI commands

```bash
# Vitest gate (engine + report builder + artifact checks)
npm run test:release-conformance

# Full gate: vitest + component axe + optional logs/report
node scripts/run-release-conformance.mjs --write-log --write-report
```

npm script `test:release-conformance` runs `engineConformanceTldraw.test.ts` and `releaseConformanceGate.test.ts`.

Component axe smokes run via `npm run test:component` (included in the CLI script).

## Regression gate defaults

`DEFAULT_RELEASE_CONFORMANCE_THRESHOLDS`:

- Engine SPI suite must pass entirely
- axe smoke suite must pass entirely
- `criticalSeriousViolations` budget = **0**
- `SKILL.md`, `llms.txt`, and ≥5 reference docs must exist

## Freeze publish deferral

Under `deploy_allowed: false`:

- ✅ In-repo scaffold reports (`docs/conformance/releases/v*-scaffold.md`)
- ✅ CI gate artifacts and local test logs
- ❌ Public docs-site publish of per-release report pages
- ❌ HTTP serving of `llms.txt` from production docs 

When freeze lifts, wire `llms.txt` into the docs site static root and publish generated release reports alongside semver tags.

## Related decisions

- ** (5)** — published conformance per release
- ** (6)** — framework skill + llms.txt
- **** — helios/archipelago deployment freeze (does not block framework scaffold)
- **** — agentable landing page deploy follows separate authorization

## Tests

- `tests/unit/releaseConformanceGate.test.ts` — report fingerprint, gate logic, artifact existence, template scaffold
