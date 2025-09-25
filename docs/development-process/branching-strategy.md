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
   - After approval and verification, merge to `main`
   - Tag the release and push tags; CI/CD deploys production
   ```bash
   git tag v1.x.x
   git push origin main --tags
   ```

4. **Clean up**
   ```bash
   git branch -D temp-release-prep
   ```

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

## Practical Examples

### Example: FE + BE developed together, partial release

```
dev:  [A: BE endpoint] - [B: FE wires BE] - [C: Docs] - [D: WIP replay analyzer]
main: [release v1.3.0]

# Prepare curated release with A, B, C (skip D)
git checkout dev && git pull
git checkout -b temp-release-prep
git rebase -i origin/main   # pick A, B, C; drop D

git checkout main && git pull
git checkout -b release/1.3.1
git merge --no-ff temp-release-prep

# Test, then merge PR to main, tag v1.3.1
```

### Example: Solo day-to-day without feature branch

```
git checkout dev && git pull
# commit small changes directly, push, verify on dev environment
```

### Example: Long-running or risky work

```
git checkout dev && git pull
git checkout -b feature/risk/experiment
# work safely; keep rebasing/merging dev as needed
git checkout dev && git merge feature/risk/experiment
```

## Comparison with GitFlow

Our trunk-based approach differs from the previous GitFlow strategy:

1. **Simpler Structure**: Two primary branches instead of multiple long-lived branches
2. **Faster Integration**: Features integrate to `dev` immediately, not at release time
3. **Selective Releases**: Choose which changes go to production rather than releasing all at once
4. **Reduced Complexity**: Fewer merge conflicts and simpler mental model