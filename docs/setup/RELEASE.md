---
doc_type: guide
title: Release Process
description: GitHub Actions workflow for automatic releases on package.json version bumps, manual dispatch, git tags, and consumer SHA pinning in landi-canvas-studio.
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

`agentable-canvas` ships from the [`mikehenken/agentable`](https://github.com/mikehenken/agentable) repository on the **`main`** branch.

## Workflow

| Item | Value |
|------|-------|
| Workflow file | `.github/workflows/release-package.yml` |
| Auto trigger | Push/merge to `main` when `package.json` **version** changes |
| Manual trigger | `workflow_dispatch` (Actions → **Release package** → **Run workflow**) |
| Target branch | `main` |
| Tag format | `vX.Y.Z` (e.g. `v0.2.0`) |
| Registry | GitHub Packages (`npm.pkg.github.com`, advisory until scoped) |

## Automatic release (recommended)

1. Bump `version` in `package.json` (and `package-lock.json` when present) in your PR or commit.
2. Merge to `main`.
3. The **Release package** workflow detects `HEAD^` vs `HEAD` version change, runs unit tests, tags `vX.Y.Z`, creates a GitHub Release, and attempts npm publish.

Pushes that only change `package.json` without a version bump are skipped. Pushes from `github-actions[bot]` (manual dispatch version commits) do not re-trigger auto-release.

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

**On version bump merge to `main`:**

1. Checkout `main`
2. Detect version change in `package.json`
3. Run **unit tests** (gate); lint and typecheck are advisory in CI until debt is cleared
4. Create and push git tag `vX.Y.Z` at the merge commit
5. Create GitHub Release via `gh release create` with consumer bump instructions
6. Attempt `npm publish` to GitHub Packages (advisory)

**On manual `workflow_dispatch`:**

1. Resolve bump keyword or explicit semver
2. Bump `package.json` version (lockfile updated when present)
3. Commit `[release] vX.Y.Z` and push to `main`
4. Tag, release, and publish as above

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

## Day-to-day validation

Use the **CI** workflow (`.github/workflows/ci.yml`) on PRs and pushes to `main`. Only bump `package.json` version when you intend to ship a new release.
