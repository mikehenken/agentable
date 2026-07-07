---
doc_type: guide
title: Branching Strategy
description: main-only development flow for agentable-canvas; master branch deprecated and removed.
created_at: "2026-07-07"
version: "1.0.0"
updated_at: "2026-07-07"
lrn: "lrn::en:platform:component:agentable-canvas:branching::doc"
entity_id: platform.component.agentable-canvas.branching
entity_type: guide
related_docs:
  - "setup/RELEASE.md"
  - "development/ARCHITECTURE.md"
  - "DOCS_INDEX.md"
changelog:
  - version: "1.0.0"
    date: "2026-07-07"
    type: "minor"
    author: "system"
    description: "Initial branching documentation after main/master reconciliation"
---

# Branching Strategy

## Canonical branch: `main`

| Branch | Status |
|--------|--------|
| `main` | **Canonical** — default branch, CI, releases |
| `master` | **Deprecated / removed** — historical orchestration pushed here; reconciled into `main` |

All new work targets **`main`**. Do not recreate `master`.

## Development flow

```mermaid
flowchart LR
  A[feature branch] --> B[PR to main]
  B --> C[CI gates]
  C --> D[merge to main]
  D --> E[manual release workflow]
```

1. Branch from `main`: `git checkout -b feat/my-change main`
2. Open a pull request into **`main`**
3. CI (`.github/workflows/ci.yml`) runs lint, typecheck, and tests
4. Merge after review and green CI
5. Release via [RELEASE.md](RELEASE.md) when ready to publish

## Remote setup

```bash
git remote add public https://github.com/mikehenken/agentable.git
git fetch public
git checkout main
git pull public main
```

## Branch protection

`main` should be protected (require PR, require CI). On **GitHub Free** private repos, branch protection rules may return **403 Forbidden**. If so, enforce the same policy by convention:

- No direct pushes to `main` except the release bot commit
- All changes via PR with green CI

Document any waiver in repo issues if protection cannot be enabled.

## Historical note

Prior orchestration sessions pushed whiteboard work to `master` while GitHub's default was `main`. Reconciliation fast-forwarded `main` to include all `master` commits, then deleted `master` on the remote.
