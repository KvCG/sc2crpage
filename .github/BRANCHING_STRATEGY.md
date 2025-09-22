# SC2CR Branching Strategy

## Overview

This document outlines the branching and deployment strategy for the SC2CR project, ensuring smooth coordination between client and server deployments while minimizing downtime.

## Branch Types

### Main Branches
- `main` - Production branch, always deployable
- `develop` - Integration branch for feature development

### Supporting Branches
- `feature/*` - New features and non-emergency fixes
- `release/*` - Release preparation
- `hotfix/*` - Emergency production fixes
- `server/*` - Server-specific features
- `client/*` - Client-specific features

## Branch Naming Convention

```
<type>/<scope>/<description>

Types:
- feature
- server
- client
- hotfix
- release

Scope:
- auth
- ranking
- replays
- tournament
- etc.

Example:
feature/ranking/add-mmr-tracking
server/auth/jwt-implementation
client/ui/ranking-table-redesign
```

## Workflow

### Feature Development

1. **Create Feature Branch**
   ```bash
   # From develop branch
   git checkout develop
   git pull origin develop
   git checkout -b feature/scope/description
   ```

2. **Regular Development**
 `dev` - Integration/sandbox branch for feature development
   git commit -m "feat(scope): descriptive message"
   git push origin feature/scope/description
   ```

3. **Prepare for Review**
    # From dev branch
    git checkout dev
    git pull origin dev
   git push origin feature/scope/description -f
   ```

### Server-First Deployment

    git fetch origin dev
    git rebase origin/dev
   git checkout -b server/feature-name
   # Make server changes
   git push origin server/feature-name
   # Create PR to develop
   ```

2. **Client Changes**
    git checkout dev
    git pull origin dev
   # Make client changes
   git push origin client/feature-name
   # Create PR to develop after server PR is merged
   ```

### Release Process

1. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/1.x.x
   ```

2. **Deploy Order**
   - Tag server version
   - Deploy server changes
   - Verify server health
   - Deploy client changes

3. **Finalize Release**
   ```bash
   git checkout main
   git merge release/1.x.x --no-ff
   ```

## Branch Protection Rules

- `main` branch:
  - No direct pushes
  - No deletion

- `develop` branch:
  - Require pull request reviews
  - Require status checks to pass
  - No direct pushes

## Testing Requirements

- All PRs must include relevant tests
- Server changes must include API tests
- Client changes must include component tests
- E2E tests required for user-facing features

## Deployment Integration

### Development
- Feature branches deploy to preview environments
- Develop branch deploys to staging

### Production
1. Server deployment
   - Deploy from `main` to Render
   - Verify health checks
   - Run smoke tests

2. Client deployment
   - Deploy from `main` to Vercel
   - Verify client-server integration
   - Monitor error rates

## Hotfix Process

1. **Create Hotfix**
   ```bash
   git checkout main
   git checkout -b hotfix/description
   # Make fixes
   git commit -m "fix: description"
   ```

2. **Deploy Hotfix**
   - Create PR to `main`
   - After approval, merge and deploy
   - Cherry-pick to `develop`

## Examples

### Feature Development
```bash
# New ranking feature
git checkout develop
git checkout -b feature/ranking/mmr-history
# Make changes
git commit -m "feat(ranking): add MMR history graph"
git push origin feature/ranking/mmr-history
```

### Server-First Feature
```bash
# Server changes
git checkout -b server/auth/jwt
# Make server changes
git push origin server/auth/jwt

# Client changes (after server merge)
git checkout -b client/auth/jwt-integration
# Make client changes
git push origin client/auth/jwt-integration
```

### Hotfix
```bash
git checkout main
git checkout -b hotfix/ranking-api-fix
# Fix the issue
git commit -m "fix(ranking): handle null MMR values"
git push origin hotfix/ranking-api-fix
```