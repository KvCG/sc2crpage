# SC2CR Branching Strategy

## Overview

This document outlines the trunk-based development approach for the SC2CR project, focusing on developer productivity and release flexibility.

## Core Branches

- `dev` — Primary development branch (trunk), integrates ongoing work and experiments
- `main` — Production branch, only receives selected, release-ready changes

Important: We never merge `dev` into `main`. Releases are curated subsets of `dev`.

## Feature Development Workflow

1. **Start From Dev**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/description
   ```

2. **Regular Development**
   ```bash
   # Make small, focused commits
   git commit -m "feat(scope): descriptive message"
   git push origin feature/description
   ```

3. **Integration**
   - Create PR from `feature/description` to `dev`
   - After code review, merge to `dev`
   - CI/CD deploys `dev` to the permanent dev environment (and per-PR previews)

## Release Process

Curate a release by selecting only the commits you want from `dev`:

1. **Prepare a curated set**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b temp-release-prep
   # Select commits relative to main
   git rebase -i origin/main
   # In the editor: pick only the commits you want, drop the rest, squash related ones
   ```

2. **Create release branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/1.x.x
   git merge --no-ff temp-release-prep
   ```

3. **Finalize Release**
   - Open PR from `release/1.x.x` → `main`
   - After approval and verification, merge to `main` (this triggers production deploy)
   - Tag the merge commit for traceability; push the tag
   ```bash
   git tag -a v1.x.x
   git push origin v1.x.x
   ```

4. **Clean up**
   ```bash
   git branch -D temp-release-prep
   ```

## Release Checklist

- Scope decided: curated set from `dev` merged to `main` via `release/*` PR
- CI status: green on PR and on `main` after merge
- Version bump: choose `vX.Y.Z` (semver)
- Tagging: create annotated tag on `main`, push tag
- Notes: draft concise change summary using Conventional Commit categories
- Operational checks (env vars, data files, runtime): see `docs/development-process/deployment.md`

This checklist is the authoritative source.


## Versioning, Tags, and Changelog

Establish explicit version numbers, use annotated tags, and maintain a reproducible changelog. This provides consistent signals for developers, speeds up diffs, and simplifies rollbacks. Start with a manual workflow based on Conventional Commits, then move to automation once the conventions are stable.

- Versioning: Semantic Versioning (`MAJOR.MINOR.PATCH`). Start at `v1.0.0` for first prod-ready release.
- Tag format: Annotated tags `vX.Y.Z` on `main` only. Include concise release notes in the tag message.
- Tagging location: Always tag the merge commit on `main` that represents the release.
- Changelog now: Generate from merged PR titles or commit messages using Conventional Commits categories.
- Automation later: Adopt a tool (e.g., `standard-version` or `semantic-release`) once conventions are stable.

Changelog structure (keepachangelog style, minimal):
- Added: new features
- Changed: behavior changes
- Fixed: bug fixes
- Removed: deprecation removals

Quick manual generation from Conventional Commits:

```bash
# Generate categorized lists since last tag
git fetch --tags
LAST_TAG=$(git describe --tags --abbrev=0)
git log --pretty=format:"%s" ${LAST_TAG}..HEAD \
   | grep -E "^(feat|fix|perf|refactor|docs|chore)(\(.*\))?:" || true
```

Mapping guide:

| Conventional prefix | Changelog section |
| --- | --- |
| `feat` | Added |
| `fix` | Fixed |
| `perf`, `refactor` | Changed |
| `docs`, `chore`, `build`, `ci` | (omit or include as Maintenance) |

Placeholders for automation (to be refined):
- Tooling: evaluate `standard-version` vs `semantic-release` for tag+CHANGELOG.
- Commit policy: enforce Conventional Commits via CI (commitlint) before enabling automation.
- Pipeline: publish GitHub Release notes from generated changelog on tag push.

## Hotfix Process

For urgent production fixes:

1. **Create Hotfix**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/description
   ```

2. **Apply Fix**
   ```bash
   # Make minimal changes to fix the issue
   git commit -m "fix: description"
   ```

3. **Deploy and Sync**
   - Create PR to `main`, merge after review
   - After deployment, port changes to `dev`:

   ```bash
      git checkout dev
      git cherry-pick <hotfix-commit>
      git push origin dev
   ```

### Solo day-to-day without feature branch

   ```bash
   git checkout dev && git pull
   # commit small changes directly, push, verify on dev environment
   ```

## Rollback

Goal: fast restore of last known good in production.

- If tag just pushed and deploy started: delete the tag to stop follow-on jobs
```bash
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

- If `main` contains bad merge: revert the merge commit, create a new patch tag
```bash
git checkout main && git pull
git revert -m 1 <merge-commit-sha>
git push origin main
git tag -a vX.Y.(Z+1) -m "revert: rollback vX.Y.Z"
git push origin vX.Y.(Z+1)
```

- If hotfix needed: follow Hotfix Process, then tag `vX.Y.(Z+1)`

Time reference: all timestamps/logs in America/Costa_Rica.

## Open Questions / TODOs

- Decide automation tool: `standard-version` (local tagging) vs `semantic-release` (CI-driven)
- Define exact CI trigger: deploy on tag push vs merge to `main` vs both
- Add commit linting in CI and/or pre-commit hooks to enforce Conventional Commits
- Template GitHub Release notes using changelog sections; attach artifacts if needed
- Document how to handle concurrent release branches (policy: keep only one open)