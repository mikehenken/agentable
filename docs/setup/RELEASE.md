---
doc_type: guide
title: Release Process
description: Manual GitHub Actions workflow for semver bumps, git tags, GitHub Packages publish, and consumer SHA pinning in landi-canvas-studio.
created_at: "2026-07-07"
version: "1.0.0"
updated_at: "2026-07-07"
lrn: "lrn::en:platform:component:agentable-canvas:release::doc"
entity_id: platform.component.agentable-canvas.release
entity_type: guide
related_docs:
  - "setup/BRANCHING.md"
  - "development/ARCHITECTURE.md"
  - "DOCS_INDEX.md"
changelog:
  - version: "1.0.0"
    date: "2026-07-07"
    type: "minor"
    author: "system"
    description: "Initial release workflow documentation"
---

# Release Process

`agentable-canvas` ships from the [`mikehenken/agentable`](https://github.com/mikehenken/agentable) repository on the **`main`** branch. Releases are **manual** via GitHub Actions — never triggered automatically on merge.

## Workflow

| Item | Value |
|------|-------|
| Workflow file | `.github/workflows/release-package.yml` |
| Trigger | `workflow_dispatch` (Actions → **Release package** → **Run workflow**) |
| Target branch | `main` |
| Tag format | `vX.Y.Z` (e.g. `v0.2.0`) |
| Registry | GitHub Packages (`npm.pkg.github.com`) |

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Explicit semver (`0.2.0`) **or** bump keyword (`patch`, `minor`, `major`) |
| `prerelease` | No | When `true`, marks the GitHub Release as prerelease |
| `release_notes` | No | Free-text notes appended to generated release body |

## Semver rules

- **patch** — bug fixes, no API changes (`0.1.9` → `0.1.10`)
- **minor** — backward-compatible features (`0.1.9` → `0.2.0`)
- **major** — breaking changes (`0.1.9` → `1.0.0`)
- Explicit versions must be valid semver; the workflow **fails** if the tag already exists.

## Release steps (automated)

1. Checkout `main`
2. Run **lint**, **typecheck**, and **unit tests** (gate)
3. Bump `package.json` version (+ `package-lock.json` when present)
4. Commit `[release] vX.Y.Z`
5. Create and push git tag `vX.Y.Z`
6. `npm publish` to GitHub Packages
7. Create GitHub Release via `gh release create` with consumer bump instructions

## Required GitHub configuration

### Secrets (names only)

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Provided by Actions; needs `contents:write` and `packages:write` (workflow sets permissions) |

No additional secrets are required when publishing to GitHub Packages with the default `GITHUB_TOKEN`. If you later switch to npmjs.org, add:

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm registry publish token |
| `NODE_AUTH_TOKEN` | Auth token consumed by `actions/setup-node` for registry login |

### Repository settings

- Default branch: **`main`**
- `package.json` → `publishConfig.registry`: `https://npm.pkg.github.com`

## Consumer bump — landi-canvas-studio

`landi-canvas-studio` pins the library by **git SHA**, not only by npm version:

```json
"agentable-canvas": "github:mikehenken/agentable#<full-or-short-sha>"
```

After a release:

1. Copy the commit SHA from the release workflow run or the `vX.Y.Z` tag.
2. Update `package.json` in `landi-canvas-studio`.
3. Run `npm install` and verify `LazyWhiteboardShell` loads.
4. Run `npm run lint`, `npm run typecheck`, and `npm run test`.

See [BRANCHING.md](BRANCHING.md) for the `main`-only contribution flow.

## Do not run accidentally

The release workflow **pushes tags and publishes packages**. Only run it when you intend to ship a new version. For day-to-day validation, use the **CI** workflow (`.github/workflows/ci.yml`) on PRs and pushes to `main`.
