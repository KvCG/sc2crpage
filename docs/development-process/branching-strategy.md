# SC2CR Branching Strategy

## Overview

This document outlines the trunk-based development approach for the SC2CR project, focusing on developer productivity and release flexibility.

## Core Branches

- `dev` - Primary development branch, always integrating new features
- `main` - Production branch, receives selective changes from `dev`

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
   - CI/CD automatically deploys `dev` to preview environments

## Release Process

Our approach allows selective promotion of changes from `dev` to `main`:

1. **Prepare Release**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/version
   ```

2. **Select Changes**
   ```bash
   # Option 1: Cherry-pick specific commits
   git cherry-pick <commit-hash>
   
   # Option 2: Interactive rebase to select commits
   git rebase -i origin/dev
   # In the editor, keep only commits for this release
   ```

3. **Finalize Release**
   - Create PR from `release/version` to `main`
   - After approval, merge to `main`
   - CI/CD automatically deploys to production

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

## Comparison with GitFlow

Our trunk-based approach differs from the previous GitFlow strategy:

1. **Simpler Structure**: Two primary branches instead of multiple long-lived branches
2. **Faster Integration**: Features integrate to `dev` immediately, not at release time
3. **Selective Releases**: Choose which changes go to production rather than releasing all at once
4. **Reduced Complexity**: Fewer merge conflicts and simpler mental model